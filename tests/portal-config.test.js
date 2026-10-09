const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "../../..");
const canonicalCorePath = path.join(repoRoot, "Opi/Opi/PortalAssets/core.js");
const routerCorePath = path.join(__dirname, "../assets/js/core.js");
const canonicalCore = fs.readFileSync(canonicalCorePath, "utf8");
const routerCore = fs.readFileSync(routerCorePath, "utf8");

function loadPurchaseSettingReader(source) {
    const match = source.match(/function readEWalletPurchaseEnabled\(config\) \{[\s\S]*?\n\}/);
    assert.ok(match, "portal core should define the E-Wallet config reader");
    return vm.runInNewContext(`${match[0]}\nreadEWalletPurchaseEnabled`, {});
}

test("canonical portal core and router fallback remain identical", () => {
    assert.equal(routerCore, canonicalCore);
});

test("canonical false overrides a conflicting legacy true value", () => {
    const readEnabled = loadPurchaseSettingReader(canonicalCore);
    assert.equal(readEnabled({ eWalletPurchaseEnabled: false, ewalletPurchaseEnabled: true }), false);
});

test("canonical true enables E-Wallet purchases", () => {
    const readEnabled = loadPurchaseSettingReader(canonicalCore);
    assert.equal(readEnabled({ eWalletPurchaseEnabled: true }), true);
});

test("legacy true is used when the canonical key is absent", () => {
    const readEnabled = loadPurchaseSettingReader(canonicalCore);
    assert.equal(readEnabled({ ewalletPurchaseEnabled: true }), true);
});

test("missing setting remains disabled", () => {
    const readEnabled = loadPurchaseSettingReader(canonicalCore);
    assert.equal(readEnabled({}), false);
});
