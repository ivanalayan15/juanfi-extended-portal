const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../../Opi/Opi/PortalAssets/core.js'), 'utf8');
function sourceFunction(name) {
    return source.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
}

function element() {
    const attributes = new Map();
    const listeners = {};
    return {
        attributes,
        listeners,
        value: '',
        disabled: false,
        required: false,
        innerHTML: '',
        addEventListener: (name, handler) => (listeners[name] ||= []).push(handler),
        getAttribute: name => attributes.get(name) || null,
        setAttribute: (name, value) => attributes.set(name, String(value)),
    };
}

function createHarness(fetchPortalAPI) {
    const elements = {
        payNowBtn: element(),
        inputMobileNumber: element(),
        mobileError: element(),
        wifreeMobileNumberGroup: element(),
        'checkout-container': element(),
        portalPaymentCheckoutModal: element(),
    };
    const context = {
        portalPurchaseSelection: null,
        portalPurchaseInFlight: false,
        portalPaymentPollingState: { voucherCode: '', voucherPlanId: '', requestId: '' },
        walletChannel: 'EXTENDED',
        vendorIpAddress: 'local',
        document: { getElementById: id => elements[id] || null },
        localStorageCompat: { getItem: () => 'local' },
        getStorageValue: () => 'voucher',
        isPortalWalletChannel: () => true,
        normalizeWalletChannel: value => value,
        minutesToTime: value => String(value),
        addLoader: () => {},
        removeLoader: () => {},
        addClassCompat: () => {},
        removeClassCompat: () => {},
        bindEvent: (target, name, handler) => target.addEventListener(name, handler),
        renderWifreeList: () => {},
        openPortalPaymentCheckout: () => true,
        startPortalPaymentStatusPolling: () => {},
        stopPortalPaymentStatusPolling: () => {},
        fetchPortalAPI,
        $: () => ({ modal: () => {} }),
    };
    context.$.toast = () => {};
    vm.createContext(context);
    for (const name of [
        'createPortalPaymentRequestId', 'beginPortalPaymentAttempt', 'getPortalPaymentRequestId',
        'clearPortalPaymentRequestId', 'ensurePortalPurchaseHandlers',
        'ensurePortalPaymentCheckoutEvents',
        'onPortalPayNowClicked', 'onPurchaseClicked',
    ]) {
        vm.runInContext(sourceFunction(name), context);
    }
    return { context, elements };
}

const rate = (id, price) => ({ id, price, timeInMinutes: 15, expirationInMinutes: 30 });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('selecting rate B after rate A posts only B and uses a distinct deliberate-attempt ID', async () => {
    const payloads = [];
    const { context, elements } = createHarness(async (_url, _method, _host, payload) => {
        payloads.push(payload);
        return { success: false, error: 'Temporary failure' };
    });

    context.onPurchaseClicked(rate('rate-a', 10));
    const firstId = context.getPortalPaymentRequestId('voucher', 'rate-a');
    context.onPurchaseClicked(rate('rate-b', 20));
    const secondId = context.getPortalPaymentRequestId('voucher', 'rate-b');
    assert.notEqual(secondId, firstId);
    assert.equal(elements.payNowBtn.listeners.click.length, 1);

    elements.payNowBtn.listeners.click[0]();
    await flush();
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].code, 'voucher');
    assert.equal(payloads[0].purchaseId, 'rate-b');
    assert.equal(payloads[0].requestId, secondId);
});

test('retries within one Pay Now attempt reuse its request ID', async () => {
    const payloads = [];
    const { context, elements } = createHarness(async (_url, _method, _host, payload) => {
        payloads.push(payload);
        return { success: false, error: 'Temporary failure' };
    });

    context.onPurchaseClicked(rate('rate-a', 10));
    const expectedId = context.getPortalPaymentRequestId('voucher', 'rate-a');
    elements.payNowBtn.listeners.click[0]();
    await flush();
    elements.payNowBtn.listeners.click[0]();
    await flush();

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].requestId, expectedId);
    assert.equal(payloads[1].requestId, expectedId);
});

test('an unavailable checkout retires the attempt so a later Pay Now click creates a fresh request ID', async () => {
    const payloads = [];
    const { context, elements } = createHarness(async (_url, _method, _host, payload) => {
        payloads.push(payload);
        return { success: true, data: {} };
    });

    context.onPurchaseClicked(rate('rate-a', 10));
    elements.payNowBtn.listeners.click[0]();
    await flush();
    elements.payNowBtn.listeners.click[0]();
    await flush();

    assert.equal(payloads.length, 2);
    assert.notEqual(payloads[0].requestId, payloads[1].requestId);
});

test('closing an unpaid QR retires that local attempt without cancelling the provider order', () => {
    const { context, elements } = createHarness(async () => ({ success: false }));
    context.onPurchaseClicked(rate('rate-a', 10));
    const abandonedRequestId = context.getPortalPaymentRequestId('voucher', 'rate-a');
    context.portalPaymentPollingState = {
        voucherCode: 'voucher', voucherPlanId: 'rate-a', requestId: abandonedRequestId,
    };

    context.ensurePortalPaymentCheckoutEvents();
    elements.portalPaymentCheckoutModal.listeners['hidden.bs.modal'][0]();

    assert.equal(context.portalPurchaseSelection.requestId, '');
    assert.notEqual(context.getPortalPaymentRequestId('voucher', 'rate-a'), abandonedRequestId);
});
