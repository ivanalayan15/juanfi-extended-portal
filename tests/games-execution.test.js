const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const gamesSource = fs.readFileSync(path.join(__dirname, "../assets/js/games.js"), "utf8");

test("games page invalidates cached fallback scripts lacking the execution guard", () => {
    const page = fs.readFileSync(path.join(__dirname, "../games.html"), "utf8");
    const expectedSource = "assets/js/games.js?v=$(ip)-$(mac)-$(interface-name)-games-20261028-once";
    assert.ok(page.includes(`data-games-src="${expectedSource}"`));
    assert.ok(page.includes(`data-local-games="${expectedSource}"`));
});

test("late duplicate games script preserves state and binds reward handlers only once", () => {
    const listeners = new Map();
    function element(id) {
        return {
            addEventListener(event, handler) {
                const key = `${id}:${event}`;
                listeners.set(key, [...(listeners.get(key) || []), handler]);
            }
        };
    }
    const elements = {
        duckRaceStartBtn: element("start"),
        duckRaceModal: element("modal"),
        raceAgainBtn: element("again")
    };
    const document = Object.assign(element("document"), {
        getElementById(id) { return elements[id] || null; },
        querySelectorAll() { return []; },
        querySelector() { return null; }
    });
    let readyCalls = 0;
    let configRequests = 0;
    let rewardRequests = 0;
    let cacheWrites = 0;
    // Hold asynchronous configuration/reward completion while both script copies execute.
    const pending = { then() { return pending; }, catch() { return pending; } };
    const context = vm.createContext({
        document,
        location: { search: "?ip=192.168.88.253", href: "" },
        localStorage: { setItem() { cacheWrites += 1; } },
        macNoColon: "aabbccddeeff",
        $() { return { ready(callback) { readyCalls += 1; callback(); } }; },
        fetchServerData() { configRequests += 1; return pending; },
        fetchDuckRaceReward() { rewardRequests += 1; return pending; },
        addLoader() {}
    });
    context.window = context;

    vm.runInContext(gamesSource, context);
    assert.equal(context.gamesPageInitialized, true);
    assert.equal(context.gamesUiBound, true);
    assert.equal(typeof context.goBackToPortal, "function", "inline HTML handler remains global");
    const originalInitializer = context.initializeGamesPage;
    const originalNames = context.currentDuckNames;
    context.selectedDuck = 3;
    context.currentPoints = 57;
    context.gamesRaceInterval = 123;
    context.gamesUserInfoRequestInFlight = true;

    vm.runInContext(gamesSource, context);
    assert.equal(context.initializeGamesPage, originalInitializer);
    assert.equal(context.currentDuckNames, originalNames);
    assert.equal(context.selectedDuck, 3);
    assert.equal(context.currentPoints, 57);
    assert.equal(context.gamesRaceInterval, 123);
    assert.equal(context.gamesUserInfoRequestInFlight, true);
    assert.equal(context.gamesPageInitialized, true);
    assert.equal(context.gamesUiBound, true);
    assert.equal(readyCalls, 1);
    assert.equal(configRequests, 1);
    assert.equal(cacheWrites, 1);
    for (const handlers of listeners.values()) assert.equal(handlers.length, 1);
    assert.equal(listeners.get("start:click").length, 1);
    for (const handler of listeners.get("start:click")) handler();
    assert.equal(rewardRequests, 1, "one click must send one reward request after duplicate execution");
    context.goBackToPortal();
    assert.equal(context.location.href, "/");
});
