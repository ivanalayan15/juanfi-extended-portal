# Infrastructure and database baseline

## Static client ownership
- Static RouterOS captive portal: `juanfi.html`, `status.html`, `alogin.html`, `games.html`, other login/error pages, and `assets/`. RouterOS supplies template variables and router-local files.
- No application database, table definitions, migrations, database credentials, server environment configuration, or cloud deployment project is defined by this checkout. Browser localStorage holds optional cached configuration and client session state; it is not a database authority.
- Companion server/controller and deployment ownership is in HOTSPOT_MANAGER. Financial records and payment processing remain server-owned and are outside this assets PR.

## Runtime endpoints and assets
- `assets/js/core-loader.js` fetches router-local `/juanfi-extended.json` for installation IP/version metadata.
- Validated installation IP supplies Opi HTTP port 8080 routes `/api/portal/core.js`, `/api/portal/games.js`, and `/api/portal/static/{allowlisted-path}`. Failure uses existing router-local asset URLs. No installation IP is hardcoded into the loader.
- Allowed static client assets include core/JuanFi/games/Bootstrap styles, Bootstrap Icons fonts/styles, selected portal images, and coin audio. Third-party script dependency order stays local.
- Existing core also uses installation/vendor-local portal APIs; endpoint authorization and persistence belong to those services. This task adds no API mutation, credentials, hostnames, or schema.

## Release and verification
- Paired Opi build publishes 19 exact-allowlist static assets plus fixed core/games scripts; current local publish verified all 21 hashes. No server schema/configuration change is required by this static portal integration.
- The full games execution guard and refreshed loader/fallback tokens are prepared in PR #8. Historical October 19 Opi deployment evidence does not establish the current device version; no new deployment or router upload occurred here.
- Router publication is a separate manual upload; merging this repository does not deploy assets to a router. This integration authorizes no upload or deployment.
- Local test runner: Node built-in `node --test tests/*.test.js`; there is no package installation or application build required for the static files.
