# The API is additive-only within a major version

An installed app must keep working with a newer server, so within a major version the API only adds, and CI runs `oasdiff breaking` against the last release's OpenAPI spec and fails any breaking change (oasdiff v1.32.1 has a GitHub Action, confirmed 2026-09-28). A truly breaking change bumps the major version, and the server then advertises a minimum app version, so an old app shows "Please update CanonCore" instead of erroring.
