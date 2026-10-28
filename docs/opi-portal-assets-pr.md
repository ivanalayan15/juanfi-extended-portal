# Load portal assets from Opi with reliable local fallbacks

Use Opi-hosted portal styles, icons, images, sounds, and games while retaining router-local fallbacks. HTML, the bootstrap loader, and ordered third-party scripts stay local. Dynamic source changes cancel old timers and reject stale callbacks; a full games execution guard prevents duplicate startup when fallback races an Opi load.

## Release notes

- Preserve the exact allowed asset mapping and existing local fallback URLs.
- Refresh loader cache tokens on all four entry pages and the guarded games fallback token.
- Make standalone test harnesses use this repository's own core when the main Opi canonical file is absent; mirror-only checks skip explicitly.
- Keep payment behavior unchanged. Paired Opi hosting implementation is HOTSPOT_MANAGER PR #342; this refresh updates existing PR #8.

Final security review PASS. Standalone tests: 34 passed, three expected canonical-mirror skips. Paired main tests: 41/41; controllers: 33/33; Release build: zero errors with 24 existing dependency warnings; local publish: 21/21 asset hashes verified.

Merged as PR #8 at `587567279ff8a2ddc74a31c9eaa391440eaf4bb2`; paired HOTSPOT_MANAGER PR #342 merged at `6df7b20ac3bd3c5bbcbcb435f36550fb1c067266`. No deployment, router upload, live payment, or captive-client validation occurred. Historical October 19 Opi deployment is not proof of current device version. No database/schema/configuration changes; unrelated `.DS_Store` files and build/cache artifacts are excluded.
