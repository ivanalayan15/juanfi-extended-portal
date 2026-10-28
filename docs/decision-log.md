# Decision log

## 2026-10-28 — Preserve existing paired asset scope
- This repository is a static RouterOS portal companion to HOTSPOT_MANAGER. Do not synchronize unrelated payment-history changes as part of the assets PR.
- Keep HTML, loader, cache/eLoad, and ordered third-party scripts router-local. Opi asset URLs are built only from validated local-network IPv4 metadata and exact allowed asset keys.
- Each dynamic asset source owns a request identity. Replacing its source cancels its timer; stale callbacks cannot overwrite the replacement. Repeated identical sources retain their successful load or local fallback.
- Preserve local fallback paths and explicit allowlisting; do not add arbitrary file serving or schema changes.
- Guard the entire games script against duplicate execution when remote and fallback loads race. Refresh loader tokens in all four entry pages and the games fallback token.
- Standalone tests may read the repository's own core when the paired canonical file is absent; only canonical-mirror assertions skip. Retain unrelated `.DS_Store` changes and exclude caches/build output. Update/merge existing PR #8 without deployment or router publication.
