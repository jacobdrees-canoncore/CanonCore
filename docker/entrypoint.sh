#!/bin/sh
# Applies the ladder to DATABASE_URL, then hands the container over to the
# server -- and only if the ladder applied.
#
# `set -e` is the whole guarantee: a failed migration exits here, the container
# dies, and nothing serves against a database in an unknown shape. `exec` is the
# other half, so the server becomes PID 1 and a `docker stop` reaches it rather
# than killing this shell out from under it.
set -e

node /app/migrator/migrate.mjs /app/migrations

exec "$@"
