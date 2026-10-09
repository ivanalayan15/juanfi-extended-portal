const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const loaderSource = fs.readFileSync(path.join(__dirname, "../assets/js/core-loader.js"), "utf8");

function createHarness(response, gamesScriptUrl, localCoreUrl = "assets/js/core.js?v=local-core") {
    const scripts = [];
    const timers = new Map();
    const elements = new Map();
    const requests = [];
    let nextTimerId = 1;
    const document = {
        currentScript: {
            getAttribute(name) {
                if (name === "data-games-src") return gamesScriptUrl;
                if (name === "data-local-core") return localCoreUrl;
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
    };
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

test("loads the Opi core from validated router JSON and chains games after core", () => {
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
    assert.equal(harness.scripts[1].src, "assets/js/games.js?v=portal-version");
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
    assert.equal(scriptFailure.scripts[2].src, "assets/js/games.js?v=portal-version");
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
    assert.equal(harness.scripts[2].src, "assets/js/games.js?v=portal-version");
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

test("router fallback and Opi canonical core stay byte-identical", () => {
    const portalRoot = path.join(__dirname, "..");
    const repositoryRoot = path.resolve(portalRoot, "../..");
    const routerCore = fs.readFileSync(path.join(portalRoot, "assets/js/core.js"));
    const opiCore = fs.readFileSync(path.join(repositoryRoot, "Opi/Opi/PortalAssets/core.js"));
    assert.deepEqual(routerCore, opiCore);
});
