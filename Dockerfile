# syntax=docker/dockerfile:1

# CanonCore as a container. In this genre the container IS the install
# instructions (ADR-0115), so this file is the install path rather than a
# convenience beside one.
#
# THE NODE MAJOR IS A RULE, NOT A NUMBER (ADR-0112): the newest Node major that
# has reached LTS. Every `FROM` below states it, and `packages/config/src/
# node-major.test.ts` reads them and fails when they disagree with each other,
# with `ci.yml`, or with the rule itself. This file is the FIFTH place the major
# is written and the only one that ships, which is what makes it the one that
# pins it.

# ---------------------------------------------------------------------------
# build: the workspace installed from the lockfile, built once.
# ---------------------------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

# PNPM FROM THE `packageManager` PIN, AND NEVER VIA COREPACK. `corepack enable
# pnpm` is the line in both of Next's own example Dockerfiles and it has an
# expiry here: the Node TSC stopped distributing corepack from the 25 line on,
# so it is absent from `node:26-slim` and this image would stop building on
# 2026-10-28, the day ADR-0112's rule selects 26. Reading the pin works on every
# major, and it is the same field pnpm/setup reads in CI, so one value decides
# the version in both places.
#
# The `+sha` half of a hashed pin is dropped: npm cannot install that form, and
# the field is allowed to carry one.
COPY package.json ./
RUN npm install --global "$(node -p "require('./package.json').packageManager.split('+')[0]")"

# THE MANIFESTS BEFORE THE SOURCE, so editing a component does not reinstall the
# world. `--parents` keeps each manifest at its own path, which is what lets one
# line stand in for a COPY per workspace package -- and a package added later
# needs no edit here. A manifest that moves out of step with the lockfile fails
# this install rather than quietly resolving something else (ADR-0106).
COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile

COPY . .

# A DUMMY, AND AN `ARG` RATHER THAN AN `ENV`. `next.config.ts` imports
# `@canoncore/env/server`, so the build fails without a non-empty DATABASE_URL
# and CI has a job asserting exactly that. An `ENV` would bake this string into
# the image and hand every installation a connection string nobody chose; an
# `ARG` reaches the build and stops there. The host is `.invalid`, which RFC
# 2606 reserves precisely so that it resolves nowhere: nothing connects to this.
ARG DATABASE_URL=postgresql://canoncore:canoncore@build.invalid:5432/canoncore
RUN pnpm build

# THE MIGRATOR'S OWN MODULE TREE, because the standalone output cannot carry it.
# Turbopack compiles the parts of `drizzle-orm` the app reaches into the server
# chunks, so they are not addressable as a module, and the migrator is a part the
# app never reaches. Measured on 16.3.4: 30 traced packages, `pg` among them,
# `drizzle-orm` not.
#
# The two versions are READ OUT OF THE WORKSPACE the lockfile just installed
# rather than restated here, so this tree cannot drift from the one the app was
# built against. `drizzle-orm` declares no runtime dependencies of its own and
# every one of its peers is optional -- which is why `auto-install-peers=false`
# matters: with peers on, its optional `typescript` peer arrives and puts 30 MB
# of a DEV dependency in the runner.
RUN mkdir -p /migrator && cd /migrator \
    && printf '{"name":"canoncore-migrator","private":true,"type":"module"}\n' > package.json \
    && pnpm add --prod --config.auto-install-peers=false \
        "drizzle-orm@$(node -p "require('/app/packages/db/node_modules/drizzle-orm/package.json').version")" \
        "pg@$(node -p "require('/app/packages/db/node_modules/pg/package.json').version")" \
    && cp /app/packages/db/src/migrate.ts /app/docker/migrate.mjs /migrator/

# ---------------------------------------------------------------------------
# runner: the standalone server, its migrator, and nothing that built them.
# ---------------------------------------------------------------------------
FROM node:24-slim AS runner
WORKDIR /app

# The election the LICENSE file cannot state and GitHub cannot read. `licensee`
# does not parse SPDX expressions, so the repository badge says the deprecated
# bare `AGPL-3.0` however the project elected -- and `docker/metadata-action`
# builds this label out of that same badge value. These labels are the one
# artefact where `-or-later` survives, which is why the workflow overrides the
# generated one rather than letting it win. `licence.test.ts` holds this string
# to the manifest's.
LABEL org.opencontainers.image.title="CanonCore" \
      org.opencontainers.image.description="A self-hosted catalogue for collections that do not fit one folder tree." \
      org.opencontainers.image.source="https://github.com/jacobdrees-canoncore/CanonCore" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"

ENV NODE_ENV=production
# What Next's standalone server reads. 0.0.0.0 rather than the default
# 127.0.0.1: a server bound to loopback INSIDE a container is reachable from
# nothing at all, including a published port.
ENV PORT=3000 HOSTNAME=0.0.0.0

# `node:<major>-slim` ships an unprivileged `node` user already, so this needs
# no adduser of its own. The image runs as it because nothing here needs root,
# and a container that does not need it should not have it.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
# Standalone does not copy these itself -- Next's own documentation says so,
# because it assumes a CDN serves them. There is no CDN here, and `server.js`
# serves them from this path once they are in it.
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /migrator ./migrator
# THE LADDER, at a path that is NOT the one `migrate.ts` computes for itself.
# That resolution runs off `import.meta.url`, which inside a bundle points into a
# chunk; the folder is a parameter for exactly this reason, and keeping the two
# paths different is what makes the entrypoint's explicit argument load-bearing
# rather than decorative.
COPY --from=build --chown=node:node /app/packages/db/src/migrations ./migrations
COPY --from=build /app/docker/entrypoint.sh /usr/local/bin/canoncore-entrypoint
# THE LICENCE TRAVELS WITH THE WORK. An image is a conveyance under AGPL-3.0
# section 4, and the `licenses` label states an election rather than granting
# anything; this is the text that election is an election of (ADR-0113).
COPY --from=build --chown=node:node /app/LICENSE ./LICENSE

USER node
EXPOSE 3000

# MIGRATE, THEN SERVE, and never the other way round: the entrypoint runs the
# ladder to head and `exec`s this only if it succeeded, so the app cannot answer
# a request against a database it has not migrated.
ENTRYPOINT ["canoncore-entrypoint"]
CMD ["node", "apps/web/server.js"]
