(function (window, document) {
    "use strict";

    if (window.__juanfiCoreLoaderStarted) {
        return;
    }
    window.__juanfiCoreLoaderStarted = true;

    var scriptElement = document.currentScript || document.getElementById("juanfiCoreLoader");
    var gamesScriptUrl = scriptElement && scriptElement.getAttribute("data-games-src");
    var localGamesUrl = scriptElement && scriptElement.getAttribute("data-local-games");
    var localCoreUrl = scriptElement && scriptElement.getAttribute("data-local-core");
    var requestUrl = "/juanfi-extended.json?t=" + new Date().getTime();
    var request = new XMLHttpRequest();
    var requestTimeoutId = null;
    var requestCompleted = false;
    var failed = false;
    var fallbackStarted = false;
    var coreReady = false;
    var gamesStarted = false;
    var gamesReady = false;
    var gamesFallbackStarted = false;
    var activeCoreScript = null;
    var coreTimeoutId = null;
    var activeGamesScript = null;
    var gamesTimeoutId = null;
    var opiGamesUrl = null;
    var opiAssetIp = null;
    var opiAssetVersion = null;
    var portalAssetsResolved = false;
    var portalAssetObserver = null;
    var routerJsonTimeoutMs = 200;
    var opiCoreTimeoutMs = 300;
    var fallbackCoreTimeoutMs = 8000;
    var opiGamesTimeoutMs = 1000;
    var fallbackGamesTimeoutMs = 8000;
    var portalAssetTimeoutMs = 600;
    var portalAssetKeys = {
        "assets/css/core.css": true,
        "assets/css/JuanFi.css": true,
        "assets/css/games.css": true,
        "assets/css/bootstrap.min.css": true,
        "assets/lib/bootstrap-icons.css": true,
        "assets/lib/fonts/bootstrap-icons.woff": true,
        "assets/lib/fonts/bootstrap-icons.woff2": true,
        "assets/MainPic.PNG": true,
        "assets/img/coin.png": true,
        "assets/img/ic_msg.png": true,
        "assets/img/wifi.png": true,
        "assets/img/off_wifi.png": true,
        "assets/img/payment_qrph.png": true,
        "assets/insertcoinbg.mp3": true,
        "assets/coin-received.mp3": true
    };

    function assetKeyFromUrl(value) {
        if (typeof value !== "string") {
            return null;
        }

        var key = value.split("?")[0].replace(/^\/+/, "");
        return Object.prototype.hasOwnProperty.call(portalAssetKeys, key) ? key : null;
    }

    function setAssetUrl(element, property, value) {
        if (property === "href") {
            element.href = value;
        } else {
            element.src = value;
        }
    }

    function assetUrl(key) {
        var path = key.split("/").map(encodeURIComponent).join("/");
        var version = opiAssetVersion === null ? "current" : opiAssetVersion;
        return "http://" + opiAssetIp + ":8080/api/portal/static/" + path + "?v=" + version;
    }

    function applyAssetToNode(element, useOpi) {
        if (!element || element.__juanfiPortalAssetState) {
            return;
        }

        var key = assetKeyFromUrl(element.getAttribute("data-opi-asset"));
        var localUrl = element.getAttribute("data-local-asset");
        if (!key || !localUrl || assetKeyFromUrl(localUrl) !== key) {
            return;
        }

        var property = String(element.tagName).toUpperCase() === "LINK" ? "href" : "src";
        var state = useOpi && opiAssetIp ? "opi" : "local";
        element.__juanfiPortalAssetState = state;
        element.__juanfiPortalAssetTimeout = null;

        function settle(success) {
            if (element.__juanfiPortalAssetState !== "opi") {
                return;
            }
            if (element.__juanfiPortalAssetTimeout !== null) {
                clearTimeout(element.__juanfiPortalAssetTimeout);
                element.__juanfiPortalAssetTimeout = null;
            }
            element.onload = null;
            element.onerror = null;
            element.onloadeddata = null;
            if (success) {
                element.__juanfiPortalAssetState = "loaded";
                return;
            }

            element.__juanfiPortalAssetState = "local";
            setAssetUrl(element, property, localUrl);
        }

        if (state !== "opi") {
            setAssetUrl(element, property, localUrl);
            return;
        }

        element.onload = function () { settle(true); };
        element.onerror = function () { settle(false); };
        if (String(element.tagName).toUpperCase() === "AUDIO") {
            element.onloadeddata = function () { settle(true); };
        }
        setAssetUrl(element, property, assetUrl(key));
        if (String(element.tagName).toUpperCase() !== "AUDIO") {
            element.__juanfiPortalAssetTimeout = setTimeout(function () { settle(false); }, portalAssetTimeoutMs);
        }
    }

    function processPortalAssets(useOpi, root) {
        root = root || document;
        if (!root || typeof root.getElementsByTagName !== "function") {
            return;
        }

        var tags = ["link", "img", "audio", "source"];
        for (var tagIndex = 0; tagIndex < tags.length; tagIndex++) {
            var elements = root.getElementsByTagName(tags[tagIndex]);
            for (var elementIndex = 0; elementIndex < elements.length; elementIndex++) {
                applyAssetToNode(elements[elementIndex], useOpi);
            }
        }

        if (root.nodeType === 1) {
            applyAssetToNode(root, useOpi);
        }
    }

    function watchPortalAssets() {
        if (!window.MutationObserver || !document.documentElement || portalAssetObserver) {
            return;
        }

        portalAssetObserver = new window.MutationObserver(function (records) {
            if (!portalAssetsResolved) {
                return;
            }
            for (var recordIndex = 0; recordIndex < records.length; recordIndex++) {
                var nodes = records[recordIndex].addedNodes;
                for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
                    processPortalAssets(opiAssetIp !== null, nodes[nodeIndex]);
                }
            }
        });
        portalAssetObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.juanfiSetPortalAssetSource = function (element, localUrl) {
        var key = assetKeyFromUrl(localUrl);
        if (!element || !key) {
            if (element && localUrl) {
                element.src = localUrl;
            }
            return;
        }
        element.setAttribute("data-opi-asset", key);
        element.setAttribute("data-local-asset", localUrl);
        applyAssetToNode(element, portalAssetsResolved && opiAssetIp !== null);
    };

    watchPortalAssets();

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

    function stopGamesRequest(script) {
        if (gamesTimeoutId !== null) {
            clearTimeout(gamesTimeoutId);
            gamesTimeoutId = null;
        }

        if (script && script.parentNode) {
            script.onload = null;
            script.onerror = null;
            script.parentNode.removeChild(script);
        }
    }

    function loadLocalGames() {
        if (gamesReady || gamesFallbackStarted || failed) {
            return;
        }
        gamesFallbackStarted = true;
        stopGamesRequest(activeGamesScript);
        activeGamesScript = null;

        if (!localGamesUrl) {
            showFailure();
            return;
        }

        loadGamesScript(localGamesUrl, true);
    }

    function loadGamesScript(url, isFallback) {
        var gamesScript = document.createElement("script");
        gamesScript.src = url;
        gamesScript.async = false;
        activeGamesScript = gamesScript;

        function complete(success) {
            if (activeGamesScript !== gamesScript || gamesReady || failed) {
                return;
            }

            stopGamesRequest(gamesScript);
            activeGamesScript = null;
            if (success) {
                gamesReady = true;
            } else if (isFallback) {
                showFailure();
            } else {
                loadLocalGames();
            }
        }

        gamesScript.onload = function () { complete(true); };
        gamesScript.onerror = function () { complete(false); };
        (document.body || document.documentElement).appendChild(gamesScript);
        gamesTimeoutId = setTimeout(function () {
            if (activeGamesScript === gamesScript && !gamesReady && !failed) {
                if (isFallback) {
                    stopGamesRequest(gamesScript);
                    activeGamesScript = null;
                    showFailure();
                } else {
                    loadLocalGames();
                }
            }
        }, isFallback ? fallbackGamesTimeoutMs : opiGamesTimeoutMs);
    }

    function startGamesScript() {
        if (!gamesScriptUrl || gamesStarted || failed) {
            return;
        }
        gamesStarted = true;

        if (opiGamesUrl) {
            loadGamesScript(opiGamesUrl, false);
        } else {
            loadLocalGames();
        }
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
        portalAssetsResolved = true;
        processPortalAssets(false);
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
                startGamesScript();
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
        opiAssetIp = server.ip;
        opiAssetVersion = version;
        portalAssetsResolved = true;
        processPortalAssets(true);
        opiGamesUrl = "http://" + server.ip + ":8080/api/portal/games.js?v=" + version;
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
