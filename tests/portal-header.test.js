const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const core = fs.readFileSync(path.join(__dirname, "../assets/js/core.js"), "utf8");
const helpers = core.slice(core.indexOf("function renderPortalVendoHeader("), core.indexOf("function showPortalDisconnected("));

function render(config, selection = {}) {
    let hidden;
    let name;
    const context = {
        interfaceName: "guest",
        hotspotAddress: "10.0.0.1:80",
        getStorageValue: () => null,
        ...selection,
        $: () => ({
            addClass: () => { hidden = true; },
            removeClass: () => { hidden = false; }
        }),
        renderPortalVendoName: (ip, label) => { name = ip && label || "No vendo"; },
        config
    };
    vm.runInNewContext(helpers + "\nrenderPortalHeaderFromConfig(config);", context);
    return { hidden, name };
}

const vendo = { vendoIp: "10.0.0.2", vendoName: "Lobby", interfaceName: "", showPortalHeader: false };
const config = { isMultiVendo: true, multiVendoOption: 2, multiVendoAddresses: [vendo], showPortalHeader: false };

test("an unmatched or blank interface shows the header even when the default Vendo hides it", () => {
    for (const interfaceName of ["guest", ""]) {
        assert.deepEqual(render(config, { interfaceName }), { hidden: false, name: "No vendo" });
    }
});

test("a resolved Vendo controls its own header across automatic and manual selection", () => {
    for (const showPortalHeader of [true, false]) {
        const row = { ...vendo, interfaceName: "guest", hotspotAddress: "10.0.0.1", showPortalHeader };
        for (const multiVendoOption of [0, 1, 2]) {
            const result = render({ ...config, multiVendoOption, multiVendoAddresses: [row] });
            assert.deepEqual(result, { hidden: !showPortalHeader, name: "Lobby" });
        }
    }
});

test("an empty single-Vendo address shows the header with older config responses", () => {
    assert.deepEqual(render({ vendorIpAddress: null, showPortalHeader: false }), { hidden: false, name: "No vendo" });
});
