# JuanFi Extended Portal

This captive portal includes the hotspot login page, session status, and games. Open `juanfi.html` directly to preview the bundled interface. A live hotspot supplies session values and Vendo configuration.

## Mobile compatibility

Check every portal change against **Android 6 and later with Chrome or Chromium WebView 60 and later**, and **iOS Safari 12 and later**. Include the hotspot sign-in window when the change affects startup, login, or reconnection.

Check the JavaScript, CSS, and libraries used by the affected page, including scripts loaded before the main portal code. Provide a fallback for browser features that the oldest target lacks. Exercise the changed flow and record the browser or engine used, the result, and any outstanding physical-device checks in the pull request.

Run the local regression suite with Node.js 18 or later:

```sh
node --test tests/*.test.js
```
