const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../../Opi/Opi/PortalAssets/core.js'), 'utf8');
const pollFunction = source.match(/function pollPortalPaymentStatus\(generation\) \{[\s\S]*?\n\}/)[0];

function harness(status, extra = {}) {
    const events = [];
    const element = { textContent: '' };
    const context = {
        portalPaymentPollingState: { generation: 1, inFlight: false, pollingEnabled: true,
            reference: 'PMP-paid', voucherCode: 'guest', startedAt: Date.now() },
        PORTAL_PAYMENT_POLL_TIMEOUT_MS: 60000,
        isPortalPaymentDialogVisibleWithFrame: () => true,
        vendorIpAddress: 'local',
        document: { getElementById: () => element },
        fetchPortalAPI: async () => ({ success: true, data: { status, ...extra } }),
        schedulePortalPaymentStatusPoll: generation => events.push(['poll', generation]),
        finishPortalPayment: (...args) => events.push(['finish', ...args]),
        stopPortalPaymentStatusPolling: () => events.push(['stop']),
        $: { toast: value => events.push(['toast', value]) }
    };
    vm.createContext(context);
    vm.runInContext(pollFunction, context);
    return { context, events, element };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('paid but undelivered checkout continues polling without reporting purchase success', async () => {
    const { context, events, element } = harness('paid_pending_fulfillment');
    context.pollPortalPaymentStatus(1);
    await flush();
    assert.deepEqual(events, [['poll', 1]]);
    assert.equal(context.portalPaymentPollingState.inFlight, false);
    assert.equal(context.portalPaymentPollingState.paymentReceived, true);
    assert.match(element.textContent, /Waiting for your hotspot time/);
    assert.match(element.textContent, /Do not pay again.*PMP-paid/);
});

test('locally delivered checkout finishes successfully', async () => {
    const { context, events } = harness('completed');
    context.pollPortalPaymentStatus(1);
    await flush();
    assert.deepEqual(events, [['finish', 'completed', 'PMP-paid']]);
});

test('paid fulfillment timeout retains reference and explicitly warns against paying twice', () => {
    const { context, events } = harness('paid_pending_fulfillment');
    context.portalPaymentPollingState.paymentReceived = true;
    context.portalPaymentPollingState.startedAt = 0;
    context.pollPortalPaymentStatus(1);
    assert.equal(events[0][0], 'stop');
    assert.equal(events[1][1].title, 'Payment received; time pending');
    assert.match(events[1][1].content, /Do not pay again.*PMP-paid/);
    assert.equal(events.some(event => event[0] === 'finish'), false);
});

test('stale checkout response cannot complete a newer purchase', async () => {
    const { context, events } = harness('completed');
    context.pollPortalPaymentStatus(1);
    context.portalPaymentPollingState.generation = 2;
    await flush();
    assert.deepEqual(events, []);
});


test('points fallback finishes with exact credited amount instead of claiming time was delivered', async () => {
    const { context, events } = harness('points_credited', { creditedPoints: 5 });
    context.pollPortalPaymentStatus(1);
    await flush();
    assert.deepEqual(events, [['finish', 'points_credited', 'PMP-paid', 5]]);
});

test('points completion explains fallback and refreshes user balance', () => {
    const { context, events } = harness('points_credited');
    const jquery = () => ({ modal: action => events.push(['modal', action]) });
    jquery.toast = value => events.push(['toast', value]);
    context.$ = jquery;
    context.refreshPortalUserInfoAfterPayment = () => events.push(['refresh']);
    context.clearPortalPaymentRequestId = () => events.push(['clear-request']);
    const finishFunction = source.match(/function finishPortalPayment\(status, reference, creditedPoints\) \{[\s\S]*?\n\}/)[0];
    vm.runInContext(finishFunction, context);
    context.finishPortalPayment('points_credited', 'PMP-paid', 5);
    const toast = events.find(event => event[0] === 'toast')[1];
    assert.equal(toast.title, 'Payment saved as points');
    assert.match(toast.content, /^5 points were credited because hotspot time could not be added/);
    assert.match(toast.content, /PMP-paid/);
    assert.equal(events.filter(event => event[0] === 'refresh').length, 1);
    assert.equal(events.filter(event => event[0] === 'clear-request').length, 1);
});

test('compensated points can be redeemed with rewards disabled without enabling wheel spins', () => {
    const classes = new Map();
    const state = selector => {
        if (!classes.has(selector)) classes.set(selector, new Set(['hide']));
        return classes.get(selector);
    };
    const context = {
        $: selector => ({ addClass: name => state(selector).add(name), removeClass: name => state(selector).delete(name) }),
        macNoColon: 'guest',
        onRedeemRewardPtsEvt: () => {},
        onRedeemRewardPtsConfirmBtnEvt: () => {},
        onRedeemRewardPtsSliderChangeEvt: () => {}
    };
    vm.createContext(context);
    for (const name of ['canUseVoucherPoints', 'showPointsRedeemBtns']) {
        vm.runInContext(source.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0], context);
    }
    context.showPointsRedeemBtns(5, false, [{ id: 'wheel' }]);
    assert.equal(state('#redeemWrapper').has('hide'), false);
    assert.equal(state('#rewardBtnWrapper').has('hide'), false);
    assert.equal(state('#spinWrapper').has('hide'), true);
    assert.equal(state('#spinWheelCard').has('hide'), true);
    context.showPointsRedeemBtns(0, false, [{ id: 'wheel' }]);
    assert.equal(state('#redeemWrapper').has('hide'), true);
    assert.equal(state('#rewardBtnWrapper').has('hide'), true);
});
