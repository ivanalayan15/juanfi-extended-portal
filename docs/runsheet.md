# Runsheet

## 2026-10-28 — Existing Opi asset PR integration
- Baseline tracking initialized after inspecting the static portal, loader, and Node test suite. No database or deployment configuration is owned by this checkout.
- Existing PR #8 (`feature/opi-host-more-portal-assets`) already contains current upstream `master` at `4d83629`; integration work uses `feature/merge-opi-portal-assets`.
- Preserve Opi-first allowlisted assets, router-local fallback files, local vendor-script order, and existing payment behavior.
- Fixed repeated dynamic image-source changes and stale callback/timer interference; added regression coverage.
- Existing `.DS_Store` and `assets/.DS_Store` changes are unrelated and excluded.
- Final fixes add the complete games execution sentinel and refresh all four loader tokens (`20261028-opi-assets`) plus the games fallback token (`20261028-once`). Two old test harnesses now use this checkout's own core when the main canonical file is absent.
- Final security PASS; standalone suite 34 passed with three expected canonical-mirror skips. Paired main suite 41/41, controller tests 33/33, Release build zero errors/24 existing dependency warnings, and local publish 21/21 bundled hashes passed.
- Prepared for the authorized update/merge of existing PR #8; root handles commit/push/merge. No new deployment or router upload occurred. Historical October 19 Opi deployment does not establish current device version. PR body: `docs/opi-portal-assets-pr.md`.
