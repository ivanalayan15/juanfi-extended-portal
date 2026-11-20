const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function runInlineScripts(page, routerValues) {
    const html = fs.readFileSync(path.join(__dirname, "..", page), "utf8");
    const timers = [];
    const context = vm.createContext({
        location: { search: "" },
        setInterval(callback, delay) { timers.push({ callback, delay }); }
    });
    context.window = context;
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        let script = match[1];
        if (routerValues) {
            script = script
                .replace(/\$\(if refresh - timeout\)([\s\S]*?)\$\(endif\)/g,
                    (_, body) => routerValues["refresh - timeout"] ? body : "")
                .replace(/\$\(([a-z -]+)\)/g, (token, key) =>
                    Object.hasOwn(routerValues, key) ? routerValues[key] : token);
        }
        vm.runInContext(script, context, { filename: page });
    }
    return { context, timers };
}

for (const page of ["juanfi.html", "games.html"]) {
    test(page + " opens directly with unresolved router variables", () => {
        const { context, timers } = runInlineScripts(page);
        assert.equal(context.isLoggedIn, false);
        assert.equal(timers.length, 0);
    });

    test(page + " derives its initial session hint from the router status and time", () => {
        for (const [loggedIn, seconds, expected] of [["no", "120", false], ["yes", "0", false], ["yes", "120", true]]) {
            const { context, timers } = runInlineScripts(page, {
                "logged-in": loggedIn, "session-time-left-secs": seconds, "refresh - timeout": false, "refresh - timeout - secs": "120"
            });
            assert.equal(context.isLoggedIn, expected);
            assert.equal(timers.length, 0);
        }
    });
}

test("home refresh waits for a configured timeout and skips coin insertion", () => {
    const { context, timers } = runInlineScripts("juanfi.html", { "refresh - timeout": true, "refresh - timeout - secs": "90" });
    assert.equal(timers.length, 1);
    const [{ callback, delay }] = timers;
    assert.equal(delay, 90000);
    callback(); // The inline script can load before the hosted core.
    let logins = 0;
    context.newLogin = () => logins++;
    context.insertingCoin = true;
    callback();
    assert.equal(logins, 0);
    context.insertingCoin = false;
    callback();
    assert.equal(logins, 1);
});


test("home refresh ignores invalid delays and values that wrap a browser timer", () => {
    for (const seconds of ["", "0", "-1", "garbage", "2147484"]) {
        const { timers } = runInlineScripts("juanfi.html", {
            "refresh - timeout": true, "refresh - timeout - secs": seconds
        });
        assert.equal(timers.length, 0, seconds);
    }
});
