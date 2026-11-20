const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const core = fs.readFileSync(path.join(__dirname, "../assets/js/core.js"), "utf8");

test("an offline fallback cannot reuse a previously confirmed connection", () => {
    const functions = core.match(
        /function normalizeUserInfoResponseData\([\s\S]*?(?=\nfunction resolveUserInfoRequestFailure)/
    );
    assert.ok(functions);
    const confirmedStates = [];
    const noop = () => {};
    const applyUserInfo = vm.runInNewContext(`${functions[0]}\napplyUserInfoState`, {
        setUserInfoOfflineFallbackState: noop,
        setStorageValue: noop,
        resolveVoucherValue: value => value,
        updateLastKnownVoucherSessionState: online => confirmedStates.push(online),
        renderHistories: noop
    });
    const savedUser = { code: "voucher", isOnline: true, timeRemainingInSeconds: 60 };

    assert.equal(applyUserInfo(savedUser, "guest", { isPersistedFallback: true }).isOnline, false);
    assert.equal(applyUserInfo(savedUser, "guest").isOnline, true);
    assert.deepEqual(confirmedStates, [false, true]);
});

function loadCaptiveCore({ replaceState = () => {}, elements = {}, createElement } = {}) {
    const timers = [];
    const context = {
        window: {
            location: { href: "http://hotspot.test/juanfi.html", host: "hotspot.test", protocol: "http:" },
            history: { replaceState },
            addEventListener() {}
        },
        document: {
            cookie: "", title: "Portal", createElement,
            getElementById: id => elements[id] || (id === "toastContainer" ? {} : null)
        },
        $: () => ({ addClass() {}, hide() {}, on() {}, ready() {} }),
        setTimeout(callback) { timers.push(callback); }
    };
    vm.runInNewContext(core, context);
    return { context, timers };
}

test("a captive browser rejecting a delayed history update leaves startup intact", () => {
    const visited = [];
    const { timers } = loadCaptiveCore({
        replaceState(state, title, url) {
            visited.push(url);
            throw new Error("History update denied");
        }
    });
    for (const callback of timers) callback();
    assert.deepEqual(visited, ["http://hotspot.test/"]);
});

test("spinner and toast expose accessibility attributes on elements without reflected ARIA properties", () => {
    function element() {
        const attributes = new Map();
        return {
            style: {}, children: [],
            getAttribute: key => attributes.get(key),
            setAttribute: (key, value) => attributes.set(key, value),
            appendChild(child) { this.children.push(child); }
        };
    }
    const button = element();
    const container = element();
    const { context } = loadCaptiveCore({
        elements: { refreshBtn: button, toastContainer: container }, createElement: element
    });
    context.bootstrap = { Toast: class { show() {} } };
    context.addLoader("refreshBtn");
    const [spinner] = button.children;
    assert.equal(spinner.getAttribute("role"), "status");
    assert.equal(spinner.getAttribute("aria-hidden"), "true");
    context.$.toast({ content: "Ready" });
    const [toast] = container.children;
    assert.equal(toast.getAttribute("role"), "alert");
    assert.equal(toast.getAttribute("aria-live"), "assertive");
});

test("restricted WebView storage keeps current Vendo changes when native writes fail", () => {
    const source = core.match(/var storageAreaCompatCache[\s\S]+?(?=function getPerformanceTimeCompat)/)[0];
    const native = new Map();
    let refuseWrites = false;
    function assertWritable() {
        if (refuseWrites) throw new Error("Storage write refused");
    }
    const localStorage = {
        getItem(key) { return native.get(key) ?? null; },
        setItem(key, value) { assertWritable(); native.set(key, value); },
        removeItem(key) { assertWritable(); native.delete(key); },
        clear() { assertWritable(); native.clear(); }
    };
    const storage = vm.runInNewContext(source + "\nlocalStorageCompat", { window: { localStorage } });
    const key = "vendorIpAddress";
    storage.setItem(key, "10.0.0.1");
    native.set("config", "saved");
    refuseWrites = true;
    assert.equal(storage.setItem(key, "10.0.0.2"), false);
    assert.equal(storage.getItem(key), "10.0.0.2");
    assert.equal(storage.getItem("config"), "saved");
    assert.equal(storage.removeItem(key), false);
    assert.equal(storage.getItem(key), null);

    refuseWrites = false;
    assert.equal(storage.setItem(key, "10.0.0.3"), true);
    native.set(key, "10.0.0.4"); // A second tab updated the stored address.
    assert.equal(storage.getItem(key), "10.0.0.4");

    refuseWrites = true;
    assert.equal(storage.clear(), false);
    assert.equal(storage.getItem("config"), null);
    assert.equal(storage.getItem(key), null);
    storage.setItem(key, "10.0.0.5");
    assert.equal(storage.getItem(key), "10.0.0.5");
});

test("the banner shows a fallback until a named Vendo is selected", () => {
    const elements = {};
    const header = {
        style: {},
        querySelector() { return { parentNode: header }; },
        appendChild(label) { label.parentNode = this; elements[label.id] = label; }
    };
    elements.headerContainer = header;
    const { context } = loadCaptiveCore({ elements, createElement: () => ({ style: {} }) });
    context.renderPortalVendoName(null, null, false);
    const label = elements.portalVendoName;
    assert.equal(label.textContent, "No vendo");
    assert.equal(label.hidden, false);
    context.renderPortalVendoName("10.0.0.1", "Front desk", false);
    assert.equal(label.textContent, "Front desk");
    context.renderPortalVendoName("10.0.0.1", "Front desk", true);
    assert.equal(label.hidden, true);
});
