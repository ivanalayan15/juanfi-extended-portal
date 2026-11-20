# Decision log

- 2026-11-20 — Use Android 6 with Chrome or Chromium WebView 60 and iOS Safari 12 as the oldest mobile compatibility targets. Check the affected code paths and layout on every portal change.
- 2026-11-20 — Treat cached session information as offline until the portal receives current confirmation. Browser storage may remain readable after it refuses a write, so preserve the latest selection for the current page.
