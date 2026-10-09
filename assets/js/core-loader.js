(function (window, document) {
    "use strict";

    if (window.__juanfiCoreLoaderStarted) {
        return;
    }
    window.__juanfiCoreLoaderStarted = true;

    var scriptElement = document.currentScript || document.getElementById("juanfiCoreLoader");
    var gamesScriptUrl = scriptElement && scriptElement.getAttribute("data-games-src");
    var localCoreUrl = scriptElement && scriptElement.getAttribute("data-local-core");
    var requestUrl = "/juanfi-extended.json?t=" + new Date().getTime();
    var request = new XMLHttpRequest();
    var requestTimeoutId = null;
    var requestCompleted = false;
    var failed = false;
    var fallbackStarted = false;
    var coreReady = false;
    var gamesStarted = false;
    var activeCoreScript = null;
    var coreTimeoutId = null;
    var routerJsonTimeoutMs = 200;
    var opiCoreTimeoutMs = 300;
    var fallbackCoreTimeoutMs = 8000;

    function showFailure() {
        if (failed) {
            return;
        }

        failed = true;
        if (document.getElementById("juanfiCoreLoadFailure")) {
            return;
        }

        var panel = document.createElement("div");
        panel.id = "juanfiCoreLoadFailure";
        panel.setAttribute("role", "alert");
        panel.style.cssText = "position:fixed;z-index:2147483647;inset:0 0 auto 0;padding:16px;background:#fff;color:#222;border-bottom:1px solid #bbb;font:16px sans-serif;text-align:center";

        var message = document.createElement("p");
        message.textContent = "JuanFi could not connect to this installation. Check your connection and try again.";
        panel.appendChild(message);

        var retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Try again";
        retry.onclick = function () {
            window.location.reload();
        };
        panel.appendChild(retry);
        (document.body || document.documentElement).appendChild(panel);
    }

    function validIpv4(value) {
        if (typeof value !== "string" || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
            return false;
        }

        var parts = value.split(".");
        for (var i = 0; i < parts.length; i++) {
            var octet = Number(parts[i]);
            if (octet < 0 || octet > 255 || String(octet) !== parts[i]) {
                return false;
            }
        }

        var firstOctet = Number(parts[0]);
        var secondOctet = Number(parts[1]);

        return firstOctet === 10 ||
            (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
            (firstOctet === 192 && secondOctet === 168) ||
            (firstOctet === 169 && secondOctet === 254) ||
            (firstOctet === 100 && secondOctet >= 64 && secondOctet <= 127);
    }

    function loadGamesScript() {
        if (!gamesScriptUrl || gamesStarted || failed) {
            return;
        }
        gamesStarted = true;

        var gamesScript = document.createElement("script");
        gamesScript.src = gamesScriptUrl;
        gamesScript.async = false;
        gamesScript.onerror = showFailure;
        (document.body || document.documentElement).appendChild(gamesScript);
    }

    function stopCoreRequest(script) {
        if (coreTimeoutId !== null) {
            clearTimeout(coreTimeoutId);
            coreTimeoutId = null;
        }

        if (script && script.parentNode) {
            script.onload = null;
            script.onerror = null;
            script.parentNode.removeChild(script);
        }
    }

    function loadLocalCore() {
        if (coreReady || fallbackStarted || failed) {
            return;
        }
        fallbackStarted = true;
        stopCoreRequest(activeCoreScript);
        activeCoreScript = null;

        if (!localCoreUrl) {
            showFailure();
            return;
        }

        loadCoreScript(localCoreUrl, true);
    }

    function loadCoreScript(url, isFallback) {
        var coreScript = document.createElement("script");
        coreScript.src = url;
        coreScript.async = false;
        activeCoreScript = coreScript;

        function complete(success) {
            if (activeCoreScript !== coreScript || coreReady || failed) {
                return;
            }

            stopCoreRequest(coreScript);
            activeCoreScript = null;
            if (success) {
                coreReady = true;
                loadGamesScript();
            } else if (isFallback) {
                showFailure();
            } else {
                loadLocalCore();
            }
        }

        coreScript.onload = function () { complete(true); };
        coreScript.onerror = function () { complete(false); };
        (document.body || document.documentElement).appendChild(coreScript);
        coreTimeoutId = setTimeout(function () {
            if (activeCoreScript === coreScript && !coreReady && !failed) {
                if (isFallback) {
                    stopCoreRequest(coreScript);
                    activeCoreScript = null;
                    showFailure();
                } else {
                    loadLocalCore();
                }
            }
        }, isFallback ? fallbackCoreTimeoutMs : opiCoreTimeoutMs);
    }

    function loadCore(server) {
        if (!server || !validIpv4(server.ip)) {
            loadLocalCore();
            return;
        }

        try {
            window.localStorage.setItem("juanfi_extended_data", JSON.stringify(server));
            window.localStorage.setItem("juanfi_extended_data_expiry", String(new Date().getTime() + 5 * 60 * 1000));
            if (typeof window.append !== "undefined") {
                window.localStorage.setItem("juanfi_extended_data_append", window.append);
            }
        } catch (ignore) {
            // Storage is optional; the core script can fetch the same router-local file itself.
        }

        var version = server.version === undefined || server.version === null
            ? "current"
            : encodeURIComponent(String(server.version));
        loadCoreScript("http://" + server.ip + ":8080/api/portal/core.js?v=" + version, false);
    }

    function clearRequestTimeout() {
        if (requestTimeoutId !== null) {
            clearTimeout(requestTimeoutId);
            requestTimeoutId = null;
        }
    }

    function failRouterJsonRequest() {
        if (requestCompleted) {
            return;
        }

        requestCompleted = true;
        clearRequestTimeout();
        try {
            request.abort();
        } catch (ignore) {
            // Aborting is only a resource cleanup; the local fallback remains independent.
        }
        loadLocalCore();
    }

    request.open("GET", requestUrl, true);
    request.timeout = routerJsonTimeoutMs;
    request.onload = function () {
        if (requestCompleted) {
            return;
        }
        requestCompleted = true;
        clearRequestTimeout();
        if (request.status < 200 || request.status >= 300) {
            loadLocalCore();
            return;
        }

        try {
            loadCore(JSON.parse(request.responseText));
        } catch (ignore) {
            loadLocalCore();
        }
    };
    request.onerror = failRouterJsonRequest;
    request.ontimeout = failRouterJsonRequest;
    requestTimeoutId = setTimeout(failRouterJsonRequest, routerJsonTimeoutMs);
    request.send();
})(window, document);
