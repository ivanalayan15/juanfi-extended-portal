# Handoff

## 2026-10-28 — Integration prepared for authorized merge
- Paired PRs: HOTSPOT_MANAGER #342 and this repository #8. Existing PR branch: `feature/opi-host-more-portal-assets`; local integration branch: `feature/merge-opi-portal-assets`.
- Upstream master `4d83629` is already an ancestor of the existing PR head `7a113cc`; no merge conflict or payment-runtime synchronization was needed here.
- `assets/js/core-loader.js` and its targeted tests mirror the main repository. Dynamic wifi/off_wifi transitions now cancel prior timers and reject stale callbacks.
- Four tracking documents initialized from inspected source. Unrelated `.DS_Store` modifications remain untouched.
- Full games execution sentinel prevents duplicate startup; all four loader tokens and the games fallback token are refreshed. The two old harness paths now use local core when the main canonical file is absent.
- Final security PASS; full standalone suite 34 passed/3 expected canonical-mirror skips; paired main suite 41/41 and controller suite 33/33. Main Release build passed with zero errors/24 existing dependency warnings; local Release publish at `/tmp/hotspot-portal-assets-qa.ndDK4p` verified 21/21 bundled hashes.
- Root will commit/push to the existing PR branch, update PR #8 using `docs/opi-portal-assets-pr.md`, and merge as authorized. No new deployment, router upload, live payment, or captive-client validation occurred. Historical October 19 Opi deployment does not prove the current device version. Preserve both unrelated `.DS_Store` changes.
