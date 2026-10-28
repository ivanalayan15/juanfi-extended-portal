const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const loaderSource = fs.readFileSync(path.join(__dirname, "../assets/js/core-loader.js"), "utf8");
const repositoryRoot = findRepositoryRoot();

function findRepositoryRoot() {
    let current = path.resolve(__dirname, "..");
    while (current !== path.dirname(current)) {
        if (fs.existsSync(path.join(current, "HOTSPOT_MANAGER.sln"))) return current;
        current = path.dirname(current);
    }
    return null;
}

function createHarness(response, gamesScriptUrl, localCoreUrl = "assets/js/core.js?v=local-core", localGamesUrl = "assets/js/games.js?v=local-games", portalAssets = []) {
    const scripts = [];
    const timers = new Map();
    const elements = new Map();
    const requests = [];
    function matchingAssets(tagName) {
        return portalAssets.filter(asset => asset.tagName.toLowerCase() === tagName.toLowerCase());
    }
    let nextTimerId = 1;
    const document = {
        currentScript: {
            getAttribute(name) {
                if (name === "data-games-src") return gamesScriptUrl;
                if (name === "data-local-core") return localCoreUrl;
                if (name === "data-local-games") return localGamesUrl;
                return null;
            }
        },
        body: {
            appendChild(element) {
                element.parentNode = this;
                if (element.tagName === "SCRIPT") scripts.push(element);
                else elements.set(element.id, element);
                return element;
            },
            removeChild(element) {
                element.removed = true;
                element.parentNode = null;
                return element;
            }
        },
        createElement(tagName) {
            return {
                tagName: tagName.toUpperCase(),
                children: [],
                style: {},
                setAttribute(name, value) { this[name] = value; },
                appendChild(child) { this.children.push(child); }
            };
        },
        getElementById(id) { return elements.get(id) || null; }
        ,getElementsByTagName: matchingAssets
    };
    document.documentElement = { nodeType: 1, getElementsByTagName: matchingAssets };
    class FakeXhr {
        open(method, url, async) {
            this.method = method;
            this.url = url;
            this.async = async;
        }
        send() {
            requests.push(this);
            this.status = response.status;
            this.responseText = response.body;
            if (response.event === "error") this.onerror();
            else if (response.event === "timeout") this.ontimeout();
            else this.onload();
        }
    }

    const localStorage = new Map();
    const window = {
        localStorage: { setItem(key, value) { localStorage.set(key, value); } },
        location: { reloadCalled: false, reload() { this.reloadCalled = true; } },
        append: "router-cache-token"
    };
    const setTimer = (callback, delay) => {
        const id = nextTimerId++;
        timers.set(id, { callback, delay });
        return id;
    };
    const clearTimer = id => timers.delete(id);
    function runNextTimer() {
        const entry = timers.entries().next().value;
        assert.ok(entry, "expected a pending timeout");
        const [id, timer] = entry;
        timers.delete(id);
        timer.callback();
        return timer.delay;
    }

    const context = { window, document, XMLHttpRequest: FakeXhr, Date, encodeURIComponent, setTimeout: setTimer, clearTimeout: clearTimer };
    vm.runInNewContext(loaderSource, context);
    return { window, document, scripts, requests, elements, localStorage, timers, runNextTimer, context };
}

function createPortalAsset(tagName, key, localUrl) {
    const attributes = { "data-opi-asset": key, "data-local-asset": localUrl };
    return {
        tagName: tagName.toUpperCase(),
        attributes,
        getAttribute(name) { return attributes[name] || null; },
        setAttribute(name, value) { attributes[name] = value; }
    };
}

test("loads the Opi core and games from validated router JSON in order", () => {
    const harness = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    }, "assets/js/games.js?v=portal-version");

    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0].method, "GET");
    assert.match(harness.requests[0].url, /^\/juanfi-extended\.json\?t=/);
    assert.equal(harness.requests[0].timeout, 200);
    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, "http://192.168.88.253:8080/api/portal/core.js?v=406");
    assert.equal(harness.localStorage.get("juanfi_extended_data_append"), "router-cache-token");

    harness.scripts[0].onload();
    assert.equal(harness.scripts.length, 2);
    assert.equal(harness.scripts[1].src, "http://192.168.88.253:8080/api/portal/games.js?v=406");
});

test("loads allowlisted CSS and images from Opi and falls back per asset on error", () => {
    const css = createPortalAsset("link", "assets/css/core.css", "assets/css/core.css?v=router");
    const image = createPortalAsset("img", "assets/img/coin.png", "assets/img/coin.png");
    const harness = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: "v 406" })
    }, null, undefined, undefined, [css, image]);

    assert.equal(css.href, "http://192.168.88.253:8080/api/portal/static/assets/css/core.css?v=v%20406");
    assert.equal(image.src, "http://192.168.88.253:8080/api/portal/static/assets/img/coin.png?v=v%20406");

    css.onerror();
    image.onerror();
    assert.equal(css.href, "assets/css/core.css?v=router");
    assert.equal(image.src, "assets/img/coin.png");
});

test("loads Bootstrap styles from Opi while preserving the stylesheet path used by its fonts", () => {
    const bootstrap = createPortalAsset("link", "assets/css/bootstrap.min.css", "assets/css/bootstrap.min.css?v=router");
    const icons = createPortalAsset("link", "assets/lib/bootstrap-icons.css", "assets/lib/bootstrap-icons.css?v=router");
    createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    }, null, undefined, undefined, [bootstrap, icons]);

    assert.equal(bootstrap.href, "http://192.168.88.253:8080/api/portal/static/assets/css/bootstrap.min.css?v=406");
    assert.equal(icons.href, "http://192.168.88.253:8080/api/portal/static/assets/lib/bootstrap-icons.css?v=406");
    assert.match(icons.href, /\/assets\/lib\/bootstrap-icons\.css\?/);
    icons.onerror();
    assert.equal(icons.href, "assets/lib/bootstrap-icons.css?v=router");
});

test("keeps ordered JavaScript dependencies on router-local URLs", () => {
    const page = fs.readFileSync(path.join(__dirname, "../juanfi.html"), "utf8");
    assert.match(page, /assets\/js\/jquery\.min\.js[\s\S]*assets\/js\/bootstrap\.bundle\.min\.js[\s\S]*assets\/js\/cache\.js[\s\S]*assets\/js\/core-loader\.js/);
    assert.match(page, /loadDeferredScript\("pakoScript", "assets\/js\/pako\.min\.js/);
    assert.match(page, /loadDeferredScript\("eloadScript", "assets\/js\/eload\.js/);
});

test("all entrypoints invalidate cached loaders for Opi asset support", () => {
    const expectedSource = "assets/js/core-loader.js?v=$(ip)-$(mac)-core-loader-20261028-opi-assets";
    for (const filename of ["alogin.html", "games.html", "juanfi.html", "status.html"]) {
        const page = fs.readFileSync(path.join(__dirname, "..", filename), "utf8");
        const loaderTags = page.match(/<script\b[^>]*\bid="juanfiCoreLoader"[^>]*>/g) || [];
        assert.equal(loaderTags.length, 1, `${filename} has one loader`);
        assert.ok(loaderTags[0].includes(`src="${expectedSource}"`), `${filename} requests the current asset-capable loader`);
    }
});

test("uses local assets when router metadata is unavailable and bounds Opi asset waits", () => {
    const css = createPortalAsset("link", "assets/css/JuanFi.css", "assets/css/JuanFi.css?v=router");
    const fallbackHarness = createHarness({ status: 503, body: "unavailable" }, null, undefined, undefined, [css]);
    assert.equal(css.href, "assets/css/JuanFi.css?v=router");

    const slowImage = createPortalAsset("img", "assets/img/coin.png", "assets/img/coin.png");
    const opiHarness = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    }, null, undefined, undefined, [slowImage]);
    assert.match(slowImage.src, /^http:\/\/192\.168\.88\.253:8080\/api\/portal\/static\//);
    assert.equal(opiHarness.runNextTimer(), 600);
    assert.equal(slowImage.src, "assets/img/coin.png");
    assert.equal(fallbackHarness.scripts[0].src, "assets/js/core.js?v=local-core");
});

test("dynamic core assets use the same validated Opi URL and local fallback helper", () => {
    const harness = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    });
    const audio = createPortalAsset("audio", "", "");
    harness.window.juanfiSetPortalAssetSource(audio, "assets/insertcoinbg.mp3");

    assert.equal(audio.src, "http://192.168.88.253:8080/api/portal/static/assets/insertcoinbg.mp3?v=406");
    audio.onerror();
    assert.equal(audio.src, "assets/insertcoinbg.mp3");
});

test("dynamic status images switch sources and ignore stale callbacks and timers", () => {
    const harness = createHarness({ status: 200, body: JSON.stringify({ ip: "192.168.88.253", version: 406 }) });
    const image = createPortalAsset("img", "", "");
    harness.window.juanfiSetPortalAssetSource(image, "assets/img/wifi.png");
    const staleError = image.onerror;
    const staleLoad = image.onload;
    const oldTimerId = image.__juanfiPortalAssetTimeout;
    const staleTimeout = harness.timers.get(oldTimerId).callback;

    harness.window.juanfiSetPortalAssetSource(image, "assets/img/off_wifi.png");
    const currentUrl = "http://192.168.88.253:8080/api/portal/static/assets/img/off_wifi.png?v=406";
    assert.equal(image.src, currentUrl);
    assert.equal(harness.timers.has(oldTimerId), false);
    const currentTimerId = image.__juanfiPortalAssetTimeout;
    staleError();
    staleLoad();
    staleTimeout();
    assert.equal(image.src, currentUrl);
    assert.equal(harness.timers.has(currentTimerId), true);

    image.onerror();
    assert.equal(image.src, "assets/img/off_wifi.png");
    harness.window.juanfiSetPortalAssetSource(image, "assets/img/off_wifi.png");
    assert.equal(image.src, "assets/img/off_wifi.png", "same-source render must retain the local fallback");
    harness.window.juanfiSetPortalAssetSource(image, "assets/img/wifi.png");
    assert.match(image.src, /\/wifi\.png\?v=406$/);
});

test("dynamic status images can change after success or without Opi metadata", () => {
    for (const response of [
        { status: 200, body: JSON.stringify({ ip: "192.168.88.253", version: 406 }) },
        { status: 503, body: "unavailable" }
    ]) {
        const harness = createHarness(response);
        const image = createPortalAsset("img", "", "");
        harness.window.juanfiSetPortalAssetSource(image, "assets/img/wifi.png");
        if (image.onload) image.onload();
        harness.window.juanfiSetPortalAssetSource(image, "assets/img/off_wifi.png");
        assert.match(image.src, /\/off_wifi\.png(?:\?v=406)?$/);
        if (response.status !== 200) assert.equal(image.src, "assets/img/off_wifi.png");
    }
});

test("switching to an unlisted local source cancels the old fallback", () => {
    const harness = createHarness({ status: 200, body: JSON.stringify({ ip: "192.168.88.253", version: 406 }) });
    const image = createPortalAsset("img", "", "");
    harness.window.juanfiSetPortalAssetSource(image, "assets/img/wifi.png");
    const staleError = image.onerror;
    const oldTimerId = image.__juanfiPortalAssetTimeout;
    harness.window.juanfiSetPortalAssetSource(image, "assets/img/no_wifi.png");
    staleError();
    assert.equal(image.src, "assets/img/no_wifi.png");
    assert.equal(harness.timers.has(oldTimerId), false);
    assert.equal(image.getAttribute("data-opi-asset"), null);
});

test("accepts RFC1918, link-local, and carrier-grade NAT Opi addresses", () => {
    const supportedAddresses = [
        "10.0.0.1",
        "172.16.0.1",
        "172.31.255.254",
        "192.168.88.253",
        "169.254.1.1",
        "100.64.0.1",
        "100.127.255.254"
    ];

    for (const ip of supportedAddresses) {
        const harness = createHarness({
            status: 200,
            body: JSON.stringify({ ip, version: 406 })
        });
        assert.equal(harness.scripts[0].src, `http://${ip}:8080/api/portal/core.js?v=406`, `${ip} should be accepted`);
    }
});

test("rejects public, loopback, multicast, and out-of-range addresses to local fallback", () => {
    const rejectedAddresses = [
        "1.2.3.4",
        "8.8.8.8",
        "172.32.0.1",
        "192.167.0.1",
        "100.128.0.1",
        "127.0.0.1",
        "224.0.0.1"
    ];

    for (const ip of rejectedAddresses) {
        const harness = createHarness({
            status: 200,
            body: JSON.stringify({ ip, version: 406 })
        });
        assert.equal(harness.scripts.length, 1, `${ip} should use exactly one fallback script`);
        assert.equal(harness.scripts[0].src, "assets/js/core.js?v=local-core", `${ip} must never become a remote script host`);
    }
});

test("falls back to the local core when router JSON has an invalid Opi address", () => {
    const harness = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253:8080/evil", version: 406 })
    });

    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, "assets/js/core.js?v=local-core");
    harness.scripts[0].onload();
    assert.equal(harness.timers.size, 0);
});

test("rejects non-canonical IPv4 octets and uses the local core", () => {
    const harness = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.088.253", version: 406 })
    });

    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, "assets/js/core.js?v=local-core");
});

test("falls back when router JSON or the Opi script is unavailable", () => {
    const jsonFailure = createHarness({ status: 404, body: "not found" });
    assert.equal(jsonFailure.scripts.length, 1);
    assert.equal(jsonFailure.scripts[0].src, "assets/js/core.js?v=local-core");

    const jsonTimeout = createHarness({ event: "timeout", status: 0, body: "" });
    assert.equal(jsonTimeout.requests[0].timeout, 200);
    assert.equal(jsonTimeout.scripts[0].src, "assets/js/core.js?v=local-core");

    const scriptFailure = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    }, "assets/js/games.js?v=portal-version");
    scriptFailure.scripts[0].onerror();
    assert.equal(scriptFailure.scripts.length, 2);
    assert.equal(scriptFailure.scripts[1].src, "assets/js/core.js?v=local-core");
    scriptFailure.scripts[1].onload();
    assert.equal(scriptFailure.scripts[2].src, "http://192.168.88.253:8080/api/portal/games.js?v=406");
});

test("Opi timeout removes the primary script, loads fallback, and keeps games ordered", () => {
    const harness = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    }, "assets/js/games.js?v=portal-version");
    const opiScript = harness.scripts[0];

    assert.equal(harness.runNextTimer(), 300);
    assert.ok(harness.requests[0].timeout + 300 < 1000, "primary loader failure must trigger fallback before the one-second captive redirect");
    assert.equal(opiScript.removed, true);
    assert.equal(harness.scripts.length, 2);
    const localScript = harness.scripts[1];
    assert.equal(localScript.src, "assets/js/core.js?v=local-core");

    assert.equal(opiScript.onload, null, "the removed Opi script must not keep a late load callback");
    assert.equal(harness.scripts.length, 2, "a late Opi load must not start games or another core");
    localScript.onload();
    assert.equal(harness.scripts[2].src, "http://192.168.88.253:8080/api/portal/games.js?v=406");
});

test("falls back to router games when the Opi games script fails or times out", () => {
    const scriptFailure = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    }, "assets/js/games.js?v=portal-version");
    scriptFailure.scripts[0].onload();
    const opiGames = scriptFailure.scripts[1];
    assert.equal(opiGames.src, "http://192.168.88.253:8080/api/portal/games.js?v=406");
    opiGames.onerror();
    assert.equal(scriptFailure.scripts[2].src, "assets/js/games.js?v=local-games");
    assert.equal(opiGames.onload, null, "late Opi games callbacks must be detached");

    const timeout = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    }, "assets/js/games.js?v=portal-version");
    timeout.scripts[0].onload();
    assert.equal(timeout.runNextTimer(), 1000);
    assert.equal(timeout.scripts[2].src, "assets/js/games.js?v=local-games");
});

test("uses router games directly when router JSON is unavailable", () => {
    const harness = createHarness({ status: 404, body: "not found" }, "assets/js/games.js?v=portal-version");
    assert.equal(harness.scripts[0].src, "assets/js/core.js?v=local-core");
    harness.scripts[0].onload();
    assert.equal(harness.scripts[1].src, "assets/js/games.js?v=local-games");
});

test("shows the generic failure panel only when the local fallback fails", () => {
    const harness = createHarness({ event: "error", status: 0, body: "" });
    const localScript = harness.scripts[0];
    assert.equal(localScript.src, "assets/js/core.js?v=local-core");
    assert.equal(harness.elements.has("juanfiCoreLoadFailure"), false);

    localScript.onerror();
    const failure = harness.elements.get("juanfiCoreLoadFailure");
    assert.ok(failure);
    assert.equal(failure.role, "alert");
    assert.equal(failure.children[0].textContent, "JuanFi could not connect to this installation. Check your connection and try again.");
});

test("shows the generic failure panel if the local fallback times out", () => {
    const harness = createHarness({ event: "error", status: 0, body: "" });
    assert.equal(harness.runNextTimer(), 8000);
    assert.ok(harness.elements.has("juanfiCoreLoadFailure"));
});

test("does not inject the core twice when the loader is included more than once", () => {
    const harness = createHarness({
        status: 200,
        body: JSON.stringify({ ip: "192.168.88.253", version: 406 })
    });
    vm.runInNewContext(loaderSource, {
        ...harness.context,
        XMLHttpRequest: class { send() { throw new Error("duplicate loader request"); } }
    });
    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.requests.length, 1);
});

test("router fallback and Opi canonical core stay byte-identical", { skip: !repositoryRoot }, () => {
    const portalRoot = path.join(__dirname, "..");
    const routerCore = fs.readFileSync(path.join(portalRoot, "assets/js/core.js"));
    const opiCore = fs.readFileSync(path.join(repositoryRoot, "Opi/Opi/PortalAssets/core.js"));
    assert.deepEqual(routerCore, opiCore);
});

test("router fallback and Opi canonical games stay byte-identical", { skip: !repositoryRoot }, () => {
    const portalRoot = path.join(__dirname, "..");
    const routerGames = fs.readFileSync(path.join(portalRoot, "assets/js/games.js"));
    const opiGames = fs.readFileSync(path.join(repositoryRoot, "Opi/Opi/PortalAssets/games.js"));
    assert.deepEqual(routerGames, opiGames);
});
