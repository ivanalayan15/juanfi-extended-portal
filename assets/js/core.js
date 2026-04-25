var errorCodeMap = [];
errorCodeMap['coins.wait.expired'] = 'Coin slot expired';
errorCodeMap['coin.not.inserted'] = 'Coin not inserted';
errorCodeMap['coinslot.cancelled'] = 'Coinslot was cancelled';
errorCodeMap['coinslot.busy'] = 'Coin slot is busy';
errorCodeMap['coin.slot.banned'] = 'You have been banned from using coin slot, due to multiple request for insert coin, please try again later!';
errorCodeMap['coin.slot.notavailable'] = 'Coin slot is not available as of the moment, Please try again later';
errorCodeMap['no.internet.detected'] = 'No internet connection as of the moment, Please try again later';
errorCodeMap['product.hash.invalid'] = 'Product hash has been tampered, your a hacker';
errorCodeMap['convertVoucher.empty'] = 'Please enter voucher code to convert';
errorCodeMap['convertVoucher.invalid'] = 'Invalid voucher code';
errorCodeMap['load.not.enough'] = 'Machine has insufficient load to cater your request';
errorCodeMap['eload.failed'] = 'Sorry, Eload processing is failed';

//DO NOT UPDATE - START
var initLoad = false;
var insertcoinbg = null;
var coinCount = null;
var TOPUP_CHARGER = "CHARGER";
var TOPUP_INTERNET = "INTERNET";
var TOPUP_ELOAD = "ELOAD";
var juanfiExtendedServerUrl = ""; //do not change value of this line
var totalCoinReceived;
var voucher;
var insertingCoin;
var topupMode;
var chargerTimer = null;
var rateType;
var autologin;
var voucherToConvert = "";
var redeemRatioValue;
var selectedVendoDtls = {};
var spinEventsCreated = false;
var rewardPointsBalance = 0;
//DO NOT UPDATE - END

var juanfiExtendedIp = "";
var isMultiVendo;
var multiVendoOption;
var multiVendoAddresses = [];
var loginOption;
var dataRateOption;
var vendorIpAddress;
var chargingEnable, eloadEnable, showPauseTime, showMemberLogin, showExtendTimeButton, disableVoucherInput,
    macAsVoucherCode, qrCodeVoucherPurchase, pointsEnabled;
var wheelConfig = [];
var macNoColon;
var isPaused;
var hasWiFree = false;
var announcementText = '';
var isTestMode = window.location.href.indexOf("http") !== 0;
var pauseAwaitingUserInfoResponse = false;
var pauseRequestInFlight = false;
var resumeRequestInFlight = false;
var userInfoRequestPool = {};
var voucherCode = "";
var userInfo = null;
var persistedUserInfoStorageKey = "persistedUserInfo";
var isUserInfoOfflineFallbackActive = false;
var announcementMarqueeState = {
    announcement: null,
    track: null,
    text: null,
    isBound: false,
    animationFrameId: null,
    measureRetryId: null,
    lastFrameTime: 0,
    hasMeasured: false,
    currentOffset: 0,
    startOffset: 0,
    endOffset: 0,
    speed: 0,
    isPaused: false,
    isDragging: false,
    activePointerId: null,
    dragStartClientX: 0,
    dragStartOffset: 0
};
var requestCompatAnimationFrame = window.requestAnimationFrame ? function (callback) {
    return window.requestAnimationFrame(callback);
} : function (callback) {
    return window.setTimeout(function () {
        callback((new Date()).getTime());
    }, 16);
};
var cancelCompatAnimationFrame = window.cancelAnimationFrame ? function (frameId) {
    window.cancelAnimationFrame(frameId);
} : function (frameId) {
    window.clearTimeout(frameId);
};
var isTimeLeftPollingPaused = false;
var isInsertCoinPollingPausePending = false;
var isInsertCoinModalVisible = false;
var activeTimeLeftRequest = null;
var hasQueuedCancelTopUpOnUnload = false;
var lastKnownVoucherSessionState = {
    isOnline: false,
    timeRemaining: 0
};
var insertCoinSessionTransition = {
    shouldRestoreLogin: false,
    request: null,
    restoreInProgress: false
};

function updateLastKnownVoucherSessionState(isOnlineValue, timeRemainingValue) {
    var parsedTimeRemaining = parseInt(timeRemainingValue, 10);

    lastKnownVoucherSessionState.isOnline = !!isOnlineValue;
    lastKnownVoucherSessionState.timeRemaining = isNaN(parsedTimeRemaining) ? 0 : parsedTimeRemaining;
}

function resetInsertCoinSessionTransition() {
    insertCoinSessionTransition.shouldRestoreLogin = false;
    insertCoinSessionTransition.request = null;
    insertCoinSessionTransition.restoreInProgress = false;
}

function getPendingTopUpVendorIpAddress() {
    var activeVendorIpAddress = vendorIpAddress;

    if (!activeVendorIpAddress && typeof localStorageCompat !== "undefined" && localStorageCompat && typeof localStorageCompat.getItem === "function") {
        activeVendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    }

    return activeVendorIpAddress || "";
}

function getPendingTopUpVoucherValue() {
    return resolveVoucherValue(voucher);
}

function shouldCancelPendingTopUp(forceCancel) {
    var activeVendorIpAddress = getPendingTopUpVendorIpAddress();
    var activeVoucher = getPendingTopUpVoucherValue();
    var parsedTotalCoinReceived = parseInt(totalCoinReceived, 10);

    if (isNaN(parsedTotalCoinReceived)) {
        parsedTotalCoinReceived = 0;
    }

    if (!forceCancel && !insertingCoin) {
        return false;
    }

    return !!activeVendorIpAddress && !!activeVoucher && parsedTotalCoinReceived === 0;
}

function buildCancelTopUpRequestData() {
    return "voucher=" + encodeURIComponent(getPendingTopUpVoucherValue()) + "&mac=" + encodeURIComponent(mac || "");
}

function cancelPendingTopUp(forceCancel) {
    var activeVendorIpAddress;
    var requestData;

    if (!shouldCancelPendingTopUp(forceCancel)) {
        return false;
    }

    activeVendorIpAddress = getPendingTopUpVendorIpAddress();
    requestData = buildCancelTopUpRequestData();

    $.ajax({
        type: "POST",
        url: "http://" + activeVendorIpAddress + "/cancelTopUp",
        data: requestData,
        success: function () {
        },
        error: function () {
        }
    });

    return true;
}

function cancelPendingTopUpOnUnload() {
    var activeVendorIpAddress;
    var requestData;
    var requestUrl;
    var beaconPayload;

    if (hasQueuedCancelTopUpOnUnload || !shouldCancelPendingTopUp(false)) {
        return false;
    }

    activeVendorIpAddress = getPendingTopUpVendorIpAddress();
    requestData = buildCancelTopUpRequestData();
    requestUrl = "http://" + activeVendorIpAddress + "/cancelTopUp";

    if (navigator && typeof navigator.sendBeacon === "function") {
        try {
            if (typeof Blob === "function") {
                beaconPayload = new Blob([requestData], {
                    type: "application/x-www-form-urlencoded; charset=UTF-8"
                });
            } else {
                beaconPayload = requestData;
            }

            if (navigator.sendBeacon(requestUrl, beaconPayload)) {
                hasQueuedCancelTopUpOnUnload = true;
                return true;
            }
        } catch (e) {
        }
    }

    if (window.fetch) {
        try {
            window.fetch(requestUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                },
                body: requestData,
                keepalive: true
            });
            hasQueuedCancelTopUpOnUnload = true;
            return true;
        } catch (e) {
        }
    }

    return false;
}

function handlePendingTopUpPageHide(evt) {
    if (evt && evt.persisted) {
        return;
    }

    cancelPendingTopUpOnUnload();
}

window.addEventListener("beforeunload", cancelPendingTopUpOnUnload);
window.addEventListener("pagehide", handlePendingTopUpPageHide);

function hasInsertCoinReconnectableSession() {
    var fallbackTimeRemaining = typeof sessiontimeInSecs !== "undefined"
        ? parseInt(sessiontimeInSecs, 10)
        : 0;
    var activeUserData = getActiveUserInfo();
    var hasRemainingTime = lastKnownVoucherSessionState.timeRemaining > 0;
    var hasVoucherState = !!voucher
        || !!getStorageValue("voucherCode")
        || !!getStorageValue("activeVoucher")
        || (activeUserData && activeUserData.code);

    if (isNaN(fallbackTimeRemaining)) {
        fallbackTimeRemaining = 0;
    }

    if (!hasRemainingTime && fallbackTimeRemaining > 0) {
        hasRemainingTime = true;
    }

    if (!hasVoucherState) {
        return false;
    }

    return lastKnownVoucherSessionState.isOnline || hasRemainingTime;
}

function logoutVoucherForInsertCoin() {
    if (getStorageValue("isPaused") === "1" && !lastKnownVoucherSessionState.isOnline) {
        return resolveCompatPromise(true);
    }

    return createCompatPromise(function (resolve) {
        logoutVoucher(macNoColon, function (success) {
            if (success) {
                setStorageValue("isPaused", "1");
                updateLastKnownVoucherSessionState(false, lastKnownVoucherSessionState.timeRemaining);
            }

            resolve(!!success);
        });
    });
}

function restoreVoucherSessionAfterInsertCoin() {
    return createCompatPromise(function (resolve) {
        loginVoucher(macNoColon, function (success) {
            if (success) {
                setStorageValue("isPaused", "0");
                sessiontimeInSecs = 0;
                updateLastKnownVoucherSessionState(true, lastKnownVoucherSessionState.timeRemaining);
                newLogin();
            } else {
                setStorageValue("isPaused", "1");
                newLogin();
            }

            resolve(!!success);
        });
    });
}

function finalizeInsertCoinModalClose() {
    if (insertCoinSessionTransition.restoreInProgress) {
        return;
    }

    if (!insertCoinSessionTransition.shouldRestoreLogin) {
        releaseTimeLeftPollingAfterInsertCoin(true);
        resetInsertCoinSessionTransition();
        return;
    }

    insertCoinSessionTransition.restoreInProgress = true;

    (insertCoinSessionTransition.request || resolveCompatPromise(false))
        .then(function (logoutSucceeded) {
            if (!logoutSucceeded) {
                releaseTimeLeftPollingAfterInsertCoin(true);
                resetInsertCoinSessionTransition();
                return;
            }

            return restoreVoucherSessionAfterInsertCoin()
                .then(function () {
                    releaseTimeLeftPollingAfterInsertCoin(true);
                    resetInsertCoinSessionTransition();
                });
        })
        .catch(function () {
            releaseTimeLeftPollingAfterInsertCoin(true);
            resetInsertCoinSessionTransition();
        });
}

function suspendTimeLeftPolling() {
    isTimeLeftPollingPaused = true;

    if (activeTimeLeftRequest && typeof activeTimeLeftRequest.abort === "function") {
        try {
            activeTimeLeftRequest.abort();
        } catch (e) {
        }
    }

    activeTimeLeftRequest = null;
}

function resumeTimeLeftPolling(shouldRefresh) {
    var wasPaused = isTimeLeftPollingPaused;

    isTimeLeftPollingPaused = false;

    if (shouldRefresh === false) {
        return;
    }

    if (wasPaused && remainingTimer != null) {
        getTimeLeftInSecs(function () {
        });
    }
}

function pauseTimeLeftPollingForInsertCoin() {
    isInsertCoinPollingPausePending = true;
    suspendTimeLeftPolling();
}

function releaseTimeLeftPollingAfterInsertCoin(shouldRefresh) {
    isInsertCoinPollingPausePending = false;
    isInsertCoinModalVisible = false;
    resumeTimeLeftPolling(shouldRefresh);
}

function getPersistedUserInfo() {
    var storedValue = localStorageCompat.getItem(persistedUserInfoStorageKey);
    if (!storedValue) {
        return null;
    }

    try {
        return JSON.parse(storedValue);
    } catch (e) {
        localStorageCompat.removeItem(persistedUserInfoStorageKey);
        return null;
    }
}

function persistUserInfo(data) {
    if (!data || typeof data !== "object" || data.code == null || data.code === "") {
        return;
    }

    try {
        localStorageCompat.setItem(persistedUserInfoStorageKey, JSON.stringify(data));
    } catch (e) {
        // Ignore storage failures and continue with the in-memory copy.
    }
}

function clearPersistedUserInfo() {
    userInfo = null;
    localStorageCompat.removeItem(persistedUserInfoStorageKey);
}

function getActiveUserInfo() {
    if (userInfo && typeof userInfo === "object") {
        return userInfo;
    }

    return null;
}

function setUserInfoOfflineButtonsDisabled(disabled) {
    var buttons = document.querySelectorAll("button");
    var i;
    var button;

    for (i = 0; i < buttons.length; i++) {
        button = buttons[i];

        if (disabled) {
            if (button.disabled) {
                continue;
            }

            button.disabled = true;
            button.setAttribute("data-user-info-offline-disabled", "true");
            continue;
        }

        if (button.getAttribute("data-user-info-offline-disabled") === "true") {
            button.disabled = false;
            button.removeAttribute("data-user-info-offline-disabled");
        }
    }
}

function setUserInfoOfflineFallbackState(isActive) {
    var serverStatus = document.getElementById("serverStatus");
    var previousClassName;
    var previousText;

    isUserInfoOfflineFallbackActive = !!isActive;

    if (isUserInfoOfflineFallbackActive) {
        $('.modal').modal('hide');
        setUserInfoOfflineButtonsDisabled(true);

        if (serverStatus) {
            if (serverStatus.getAttribute("data-user-info-offline-active") !== "true") {
                serverStatus.setAttribute("data-user-info-prev-class", serverStatus.className || "");
                serverStatus.setAttribute("data-user-info-prev-text", serverStatus.textContent || "");
            }

            serverStatus.setAttribute("data-user-info-offline-active", "true");
            serverStatus.className = "small py-0 bg-warning text-dark container text-center";
            serverStatus.textContent = "Warning: Server is currently offline.";
        }

        return;
    }

    setUserInfoOfflineButtonsDisabled(false);

    if (!serverStatus || serverStatus.getAttribute("data-user-info-offline-active") !== "true") {
        return;
    }

    previousClassName = serverStatus.getAttribute("data-user-info-prev-class");
    previousText = serverStatus.getAttribute("data-user-info-prev-text");

    serverStatus.className = previousClassName || "small py-0 bg-danger text-white container text-center hide";
    serverStatus.textContent = previousText != null ? previousText : "Offline";
    serverStatus.removeAttribute("data-user-info-offline-active");
    serverStatus.removeAttribute("data-user-info-prev-class");
    serverStatus.removeAttribute("data-user-info-prev-text");
}

function resolveVoucherValue(fallbackValue) {
    var activeUserInfo = getActiveUserInfo();
    var resolvedVoucher = "";

    if (activeUserInfo && activeUserInfo.code != null && activeUserInfo.code !== "") {
        resolvedVoucher = activeUserInfo.code;
    }

    if (resolvedVoucher === "" && fallbackValue != null && fallbackValue !== "") {
        resolvedVoucher = fallbackValue;
    }

    if (resolvedVoucher === "") {
        var storedVoucherCode = getStorageValue("voucherCode");
        if (storedVoucherCode != null && storedVoucherCode !== "") {
            resolvedVoucher = storedVoucherCode;
        }
    }

    if (resolvedVoucher === "") {
        var activeVoucher = getStorageValue("activeVoucher");
        if (activeVoucher != null && activeVoucher !== "") {
            resolvedVoucher = activeVoucher;
        }
    }

    voucher = resolvedVoucher || "";
    console.log(voucher);
    return voucher;
}

function patchPromiseCatch(promise) {
    if (!promise || typeof promise.then !== 'function' || typeof promise.catch === 'function') {
        return promise;
    }

    var originalThen = promise.then;
    promise.then = function () {
        return patchPromiseCatch(originalThen.apply(promise, arguments));
    };
    promise.catch = function (onRejected) {
        return patchPromiseCatch(promise.then(null, onRejected));
    };

    return promise;
}

function createCompatPromise(executor) {
    if (typeof Promise === 'function') {
        return new Promise(executor);
    }

    var deferred = $.Deferred();
    try {
        executor(function (value) {
            deferred.resolve(value);
        }, function (reason) {
            deferred.reject(reason);
        });
    } catch (e) {
        deferred.reject(e);
    }

    return patchPromiseCatch(deferred.promise());
}

function resolveCompatPromise(value) {
    if (typeof Promise === 'function' && typeof Promise.resolve === 'function') {
        return Promise.resolve(value);
    }

    var deferred = $.Deferred();
    deferred.resolve(value);
    return patchPromiseCatch(deferred.promise());
}

var storageAreaCompatCache = {};
var storageAreaCompatMemory = {
    localStorage: {},
    sessionStorage: {}
};

function resolveStorageAreaCompat(areaName) {
    if (storageAreaCompatCache.hasOwnProperty(areaName)) {
        return storageAreaCompatCache[areaName];
    }

    try {
        var storageArea = window[areaName];
        var testKey = "__juanfi_storage_test__";
        if (!storageArea) {
            storageAreaCompatCache[areaName] = null;
            return null;
        }

        storageArea.setItem(testKey, testKey);
        storageArea.removeItem(testKey);
        storageAreaCompatCache[areaName] = storageArea;
        return storageArea;
    } catch (e) {
        storageAreaCompatCache[areaName] = null;
        return null;
    }
}

function getStorageAreaMemoryCompat(areaName) {
    if (!storageAreaCompatMemory[areaName]) {
        storageAreaCompatMemory[areaName] = {};
    }

    return storageAreaCompatMemory[areaName];
}

function createStorageFacadeCompat(areaName) {
    return {
        getItem: function (key) {
            var storageArea = resolveStorageAreaCompat(areaName);
            var memoryStore = getStorageAreaMemoryCompat(areaName);

            if (storageArea) {
                try {
                    return storageArea.getItem(key);
                } catch (e) {
                }
            }

            return memoryStore.hasOwnProperty(key) ? memoryStore[key] : null;
        },
        setItem: function (key, value) {
            var storageArea = resolveStorageAreaCompat(areaName);
            var memoryStore = getStorageAreaMemoryCompat(areaName);
            var stringValue = value == null ? "" : String(value);

            memoryStore[key] = stringValue;

            if (storageArea) {
                try {
                    storageArea.setItem(key, stringValue);
                    return true;
                } catch (e) {
                }
            }

            return false;
        },
        removeItem: function (key) {
            var storageArea = resolveStorageAreaCompat(areaName);
            var memoryStore = getStorageAreaMemoryCompat(areaName);

            delete memoryStore[key];

            if (storageArea) {
                try {
                    storageArea.removeItem(key);
                    return true;
                } catch (e) {
                }
            }

            return false;
        },
        clear: function () {
            var storageArea = resolveStorageAreaCompat(areaName);
            storageAreaCompatMemory[areaName] = {};

            if (storageArea) {
                try {
                    storageArea.clear();
                    return true;
                } catch (e) {
                }
            }

            return false;
        },
        supported: function () {
            return !!resolveStorageAreaCompat(areaName);
        }
    };
}

var localStorageCompat = createStorageFacadeCompat("localStorage");
var sessionStorageCompat = createStorageFacadeCompat("sessionStorage");

function getPerformanceTimeCompat() {
    if (window.performance && typeof window.performance.now === "function") {
        return window.performance.now();
    }

    return (new Date()).getTime();
}

function parseDateCompat(value) {
    var parsedDate;
    var normalizedValue;
    var numericValue;

    if (value == null || value === "") {
        return null;
    }

    if (Object.prototype.toString.call(value) === "[object Date]") {
        return isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number") {
        parsedDate = new Date(value);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    if (typeof value !== "string") {
        return null;
    }

    normalizedValue = value.replace(/^\s+|\s+$/g, "");
    if (normalizedValue === "") {
        return null;
    }

    if (/^\d+$/.test(normalizedValue)) {
        numericValue = parseInt(normalizedValue, 10);
        if (normalizedValue.length <= 10) {
            numericValue = numericValue * 1000;
        }

        parsedDate = new Date(numericValue);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }

    parsedDate = new Date(normalizedValue);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
    }

    if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(normalizedValue)) {
        normalizedValue = normalizedValue
            .replace(/^(\d{4})-(\d{2})-(\d{2})/, "$1/$2/$3")
            .replace("T", " ");
        parsedDate = new Date(normalizedValue);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }

    return null;
}

function formatDateTimeCompat(value) {
    var parsedDate = parseDateCompat(value);

    if (!parsedDate) {
        return "";
    }

    try {
        return parsedDate.toLocaleString();
    } catch (e) {
        return parsedDate.toString();
    }
}

function setInputCustomValidityCompat(input, message) {
    if (input && typeof input.setCustomValidity === "function") {
        input.setCustomValidity(message || "");
    }
}

function reportInputValidityCompat(input, message) {
    setInputCustomValidityCompat(input, message);

    if (!input || !message) {
        return;
    }

    if (typeof input.reportValidity === "function") {
        input.reportValidity();
        return;
    }

    try {
        input.focus();
    } catch (e) {
    }

    if (window.$ && $.toast) {
        $.toast({
            title: "Validation",
            content: message,
            type: "warning",
            delay: 3000
        });
    }
}

function checkInputValidityCompat(input) {
    if (!input || typeof input.checkValidity !== "function") {
        return true;
    }

    return input.checkValidity();
}

function removeNode(node) {
    if (node && node.parentNode) {
        node.parentNode.removeChild(node);
    }
}

function isArrayCompat(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
}

function safeAudioPlay(audio) {
    if (!audio || typeof audio.play !== 'function') {
        return;
    }

    try {
        var playResult = audio.play();
        if (playResult && typeof playResult.catch === 'function') {
            playResult.catch(function (e) {
                console.error("Audio playback error:", e);
            });
        }
    } catch (e) {
        console.error("Audio playback error:", e);
    }
}

function createAudioInstance(src) {
    if (typeof Audio !== 'function') {
        return null;
    }

    try {
        return new Audio(src);
    } catch (e) {
        return null;
    }
}

function ensureInsertCoinAudio() {
    if (!insertcoinbg) {
        insertcoinbg = createAudioInstance('assets/insertcoinbg.mp3');
        if (insertcoinbg) {
            insertcoinbg.loop = true;
            insertcoinbg.preload = 'none';
        }
    }

    return insertcoinbg;
}

function ensureCoinCountAudio() {
    if (!coinCount) {
        coinCount = createAudioInstance('assets/coin-received.mp3');
        if (coinCount) {
            coinCount.preload = 'none';
        }
    }

    return coinCount;
}

function resetAudio(audio) {
    if (!audio) {
        return;
    }

    try {
        audio.pause();
        audio.currentTime = 0.0;
    } catch (e) {
    }
}

function bindEvent(target, eventName, handler) {
    if (!target) {
        return;
    }

    if (target.addEventListener) {
        target.addEventListener(eventName, handler);
    } else if (target.attachEvent) {
        target.attachEvent('on' + eventName, handler);
    } else {
        target['on' + eventName] = handler;
    }
}

function getComputedStyleCompat(element) {
    if (!element) {
        return null;
    }

    if (window.getComputedStyle) {
        return window.getComputedStyle(element);
    }

    return element.currentStyle || null;
}

function hasClassCompat(element, className) {
    if (!element) {
        return false;
    }

    if (element.classList) {
        return element.classList.contains(className);
    }

    return (" " + element.className + " ").indexOf(" " + className + " ") !== -1;
}

function addClassCompat(element, className) {
    if (!element) {
        return;
    }

    if (element.classList) {
        element.classList.add(className);
    } else if ((" " + element.className + " ").indexOf(" " + className + " ") === -1) {
        element.className = element.className ? (element.className + " " + className) : className;
    }
}

function removeClassCompat(element, className) {
    if (!element) {
        return;
    }

    if (element.classList) {
        element.classList.remove(className);
    } else {
        element.className = (" " + element.className + " ").replace(" " + className + " ", " ").replace(/^\s+|\s+$/g, "");
    }
}

function prependNode(parent, child) {
    if (!parent || !child) {
        return;
    }

    if (parent.firstChild) {
        parent.insertBefore(child, parent.firstChild);
    } else {
        parent.appendChild(child);
    }
}

function getRootUrl() {
    if (window.location.protocol && window.location.host) {
        return window.location.protocol + "//" + window.location.host + "/";
    }

    return "/";
}

function isGamesPageContext() {
    var path = window.location.pathname || "";
    return path.indexOf("games") !== -1;
}

if (isTestMode) {
    $('#loaderDiv').addClass("hide");
    var containerDiv = $('#containerDiv');
    containerDiv.removeClass("hide");
    containerDiv.show();
    $("#serverStatus").removeClass("hide");
    $("#serverStatus").html('Test Mode')
} else {
    $("#serverStatus").addClass("hide");
}

try {
    setTimeout(function () {
        if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState({}, document.title, getRootUrl());
        }
    }, 100)
} catch (e) {

}

function initValues() {
    //DO NOT UPDATE - START
    macNoColon = replaceAll(mac, ":");
    totalCoinReceived = 0;
    userInfo = null;
    voucher = resolveVoucherValue(getStorageValue('activeVoucher'));
    insertingCoin = false;
    topupMode = TOPUP_INTERNET;
    chargerTimer = null;
    rateType = "1";
    autologin = false;
    voucherToConvert = "";
    redeemRatioValue = 1; //do not change value of this line to avoid conflict/misrepresentation of UI to API data
    pointsEnabled = false;//enable reward points by checking if points percentage is configured in admin
    wheelConfig = [];//values displayed on spin the wheel
    selectedVendoDtls = {};
    rewardPointsBalance = 0;
    //DO NOT UPDATE - END

    //DEFAULT VALUES (WILL BE USED IF CONFIG API DOES NOT WORK) - START
    //this is to enable multi vendo setup, set to true when multi vendo is supported
    isMultiVendo = true;
    // 0 = traditional (client choose a vendo) , 1 = auto select vendo base on hotspot address, 2 = interface name ( this will preserve one hotspot server ip only)
    multiVendoOption = 0;

    //list here all node mcu address for multi vendo setup
    multiVendoAddresses = [
        {
            vendoName: "Vendo 1 - ESP32 Wireless", //change accordingly to your vendo name
            vendoIp: "10.10.10.252", //change accordingly to your vendo ip
            chargingEnable: true,  //change true if you want to enable charging station
            eloadEnable: true, //change true if you want to enable eloading station
            hotspotAddress: "10.10.10.1", // use for multi vendo option = 1, means your vendo map to this hotspot and autoselect it when client connected to this
            interfaceName: "vlan11-hotspot1" // hotspot interface name preser
        },
        {
            vendoName: "Vendo 2 - ESP8622 Wireless", //change accordingly to your vendo name
            vendoIp: "10.10.10.251", //change accordingly to your vendo ip
            chargingEnable: false,  //change true if you want to enable charging station
            eloadEnable: true //change true if you want to enable eloading station
        },
        {
            vendoName: "Vendo 3 - ESP8622 LAN", //change accordingly to your vendo name
            vendoIp: "10.10.10.253", //change accordingly to your vendo ip
            chargingEnable: false,  //change true if you want to enable charging station
            eloadEnable: false //change true if you want to enable eloading station
        },
        {
            vendoName: "Vendo 4 - ESP32 LAN", //change accordingly to your vendo name
            vendoIp: "10.10.10.254", //change accordingly to your vendo ip
            chargingEnable: true,  //change true if you want to enable charging station
            eloadEnable: false //change true if you want to enable eloading station
        }
    ];

    //0 means its login by username only, 1 = means if login by username + password
    loginOption = 0; //replace 1 if you want login voucher by username + password

    dataRateOption = false; //replace true if you enable data rates
    //put here the default selected address
    vendorIpAddress = "10.10.10.252";

    chargingEnable = false; //replace true if you enable charging, this can be override if multivendo setup

    eloadEnable = false; //replace true if you enable eload, this can be override if multivendo setup

    showPauseTime = true; //hide pause time / logout true = you want to show pause / logout button

    showMemberLogin = true; //enable member login, true = if you want to enable member login

    showExtendTimeButton = true; //enable extend time button for customers

    disableVoucherInput = false; //disable voucher input

    macAsVoucherCode = false; //enable mac address as voucher code

    qrCodeVoucherPurchase = false; //enable voucher purchase via QR Code (epayment)
    //DEFAULT VALUES (WILL BE USED IF CONFIG API DOES NOT WORK) - END
}

$(document).ready(function () {
    if (isGamesPageContext()) {
        return;
    }

    fetchServerData().then(function (server) {
        juanfiExtendedServerUrl = "http://" + server.ip + ":8080/api/portal";
        $('#displayVersion').html("v" + server.version);
        if (!initLoad) {
            initValues();
            renderView();
            useVoucherBtnEvt();
        }
    });
});

function newLogin() {
    initValues();
    if (isGamesPageContext()) {
        if (typeof fetchUserPoints === 'function') {
            fetchUserPoints();
        }
        return;
    }
    renderView();
}

function updateRemainTimeExpandedSize() {
    var remainTime = document.getElementById("remainTime");
    var remainingTimeContainer = document.getElementById("remainingTimeContainer");
    var containerStyle;
    var availableWidth;
    var baseFontSize;
    var maxExpandedFontSize;
    var expandedTextWidth;
    var expandedFontSize;

    if (!remainTime) {
        return;
    }

    remainTime.style.fontSize = "";

    if (!hasClassCompat(remainTime, "is-expanded") || !remainingTimeContainer) {
        return;
    }

    containerStyle = getComputedStyleCompat(remainingTimeContainer);
    if (!containerStyle) {
        return;
    }

    availableWidth = remainingTimeContainer.clientWidth
        - parseFloat(containerStyle.paddingLeft || 0)
        - parseFloat(containerStyle.paddingRight || 0)
        - 8;

    if (availableWidth <= 0) {
        return;
    }

    baseFontSize = parseFloat(getComputedStyleCompat(remainTime).fontSize);
    if (!baseFontSize) {
        return;
    }

    maxExpandedFontSize = baseFontSize * 1.3;
    remainTime.style.fontSize = maxExpandedFontSize + "px";
    expandedTextWidth = remainTime.scrollWidth || remainTime.offsetWidth;

    if (!expandedTextWidth) {
        remainTime.style.fontSize = "";
        return;
    }

    expandedFontSize = maxExpandedFontSize;
    if (expandedTextWidth > availableWidth) {
        expandedFontSize = maxExpandedFontSize * (availableWidth / expandedTextWidth) * 0.98;
    }

    if (expandedFontSize < baseFontSize) {
        expandedFontSize = baseFontSize;
    }

    remainTime.style.fontSize = expandedFontSize + "px";
}

function setRemainingTimeConnectionState(isConnected) {
    var remainingTimeContainer = document.getElementById("remainingTimeContainer");

    if (!remainingTimeContainer) {
        return;
    }

    if (isConnected) {
        addClassCompat(remainingTimeContainer, "connection-state-green");
        removeClassCompat(remainingTimeContainer, "connection-state-red");
    } else {
        addClassCompat(remainingTimeContainer, "connection-state-red");
        removeClassCompat(remainingTimeContainer, "connection-state-green");
    }
}

bindEvent(window, "resize", function () {
    updateRemainTimeExpandedSize();
});

function cacheAnnouncementMarqueeElements() {
    var announcement = document.getElementById("announcement");
    announcementMarqueeState.announcement = announcement;
    announcementMarqueeState.track = announcement ? announcement.querySelector(".marquee") : null;
    announcementMarqueeState.text = document.getElementById("announcementText");

    return !!(announcementMarqueeState.announcement && announcementMarqueeState.track && announcementMarqueeState.text);
}

function isAnnouncementMarqueeHidden() {
    return !announcementMarqueeState.announcement || announcementMarqueeState.announcement.className.indexOf("hide") !== -1;
}

function stopAnnouncementMarqueeLoop() {
    if (announcementMarqueeState.animationFrameId !== null) {
        cancelCompatAnimationFrame(announcementMarqueeState.animationFrameId);
        announcementMarqueeState.animationFrameId = null;
    }
}

function clearAnnouncementMarqueeRetry() {
    if (announcementMarqueeState.measureRetryId !== null) {
        window.clearTimeout(announcementMarqueeState.measureRetryId);
        announcementMarqueeState.measureRetryId = null;
    }
}

function scheduleAnnouncementMarqueeRetry(resetPosition) {
    if (announcementMarqueeState.measureRetryId !== null) {
        return;
    }

    announcementMarqueeState.measureRetryId = window.setTimeout(function () {
        announcementMarqueeState.measureRetryId = null;
        updateAnnouncementMarqueeSpeed(resetPosition);
    }, 80);
}

function startAnnouncementMarqueeLoop() {
    if (announcementMarqueeState.animationFrameId !== null) {
        return;
    }

    announcementMarqueeState.animationFrameId = requestCompatAnimationFrame(runAnnouncementMarqueeFrame);
}

function getAnnouncementClientX(event) {
    if (!event) {
        return 0;
    }

    if (event.touches && event.touches.length) {
        return event.touches[0].clientX;
    }

    if (event.changedTouches && event.changedTouches.length) {
        return event.changedTouches[0].clientX;
    }

    return typeof event.clientX === "number" ? event.clientX : 0;
}

function clampAnnouncementMarqueeOffset(offset) {
    if (offset > announcementMarqueeState.startOffset) {
        return announcementMarqueeState.startOffset;
    }

    if (offset < announcementMarqueeState.endOffset) {
        return announcementMarqueeState.endOffset;
    }

    return offset;
}

function setAnnouncementMarqueeOffset(offset) {
    if (!announcementMarqueeState.text) {
        return;
    }

    announcementMarqueeState.currentOffset = clampAnnouncementMarqueeOffset(offset);
    announcementMarqueeState.text.style.transform = "translateX(" + announcementMarqueeState.currentOffset + "px)";
}

function setAnnouncementMarqueePaused(isPaused) {
    announcementMarqueeState.isPaused = isPaused;
    announcementMarqueeState.lastFrameTime = 0;

    if (!announcementMarqueeState.track) {
        return;
    }

    if (isPaused) {
        addClassCompat(announcementMarqueeState.track, "is-paused");
    } else {
        removeClassCompat(announcementMarqueeState.track, "is-paused");
    }
}

function getAnnouncementActivePointerId(event) {
    if (typeof event.pointerId !== "undefined") {
        return event.pointerId;
    }

    return event.type.indexOf("mouse") === 0 ? "mouse" : "touch";
}

function matchesAnnouncementActivePointer(event) {
    if (announcementMarqueeState.activePointerId === null) {
        return false;
    }

    if (typeof event.pointerId !== "undefined") {
        return announcementMarqueeState.activePointerId === event.pointerId;
    }

    if (event.type.indexOf("mouse") === 0) {
        return announcementMarqueeState.activePointerId === "mouse";
    }

    return announcementMarqueeState.activePointerId === "touch";
}

function finishAnnouncementMarqueeDrag(event) {
    if (!announcementMarqueeState.isDragging || (event && !matchesAnnouncementActivePointer(event))) {
        return;
    }

    announcementMarqueeState.isDragging = false;
    announcementMarqueeState.activePointerId = null;
    removeClassCompat(announcementMarqueeState.track, "is-dragging");
    setAnnouncementMarqueePaused(false);

    if (event && event.preventDefault) {
        event.preventDefault();
    }
}

function ensureAnnouncementMarqueeBindings() {
    var supportsPointerEvents = typeof window.PointerEvent !== "undefined";

    if (announcementMarqueeState.isBound || !cacheAnnouncementMarqueeElements()) {
        return;
    }

    function startDrag(event) {
        if (!cacheAnnouncementMarqueeElements() || isAnnouncementMarqueeHidden()) {
            return;
        }

        if (event.type === "mousedown" && typeof event.button === "number" && event.button !== 0) {
            return;
        }

        if (event.touches && event.touches.length > 1) {
            return;
        }

        if (!announcementMarqueeState.hasMeasured) {
            updateAnnouncementMarqueeSpeed(true);
        }

        announcementMarqueeState.isDragging = true;
        announcementMarqueeState.activePointerId = getAnnouncementActivePointerId(event);
        announcementMarqueeState.dragStartClientX = getAnnouncementClientX(event);
        announcementMarqueeState.dragStartOffset = announcementMarqueeState.currentOffset;
        addClassCompat(announcementMarqueeState.track, "is-dragging");
        setAnnouncementMarqueePaused(true);

        if (event.preventDefault) {
            event.preventDefault();
        }
    }

    function moveDrag(event) {
        var deltaX;

        if (!announcementMarqueeState.isDragging || !matchesAnnouncementActivePointer(event)) {
            return;
        }

        deltaX = getAnnouncementClientX(event) - announcementMarqueeState.dragStartClientX;
        setAnnouncementMarqueeOffset(announcementMarqueeState.dragStartOffset + deltaX);

        if (event.preventDefault) {
            event.preventDefault();
        }
    }

    if (supportsPointerEvents) {
        bindEvent(announcementMarqueeState.track, "pointerdown", startDrag);
        bindEvent(document, "pointermove", moveDrag);
        bindEvent(document, "pointerup", finishAnnouncementMarqueeDrag);
        bindEvent(document, "pointercancel", finishAnnouncementMarqueeDrag);
    } else {
        bindEvent(announcementMarqueeState.track, "mousedown", startDrag);
        bindEvent(document, "mousemove", moveDrag);
        bindEvent(document, "mouseup", finishAnnouncementMarqueeDrag);
        bindEvent(announcementMarqueeState.track, "touchstart", startDrag);
        bindEvent(document, "touchmove", moveDrag);
        bindEvent(document, "touchend", finishAnnouncementMarqueeDrag);
        bindEvent(document, "touchcancel", finishAnnouncementMarqueeDrag);
    }

    announcementMarqueeState.isBound = true;
}

function runAnnouncementMarqueeFrame(timestamp) {
    var elapsedSeconds;
    var nextOffset;

    announcementMarqueeState.animationFrameId = null;

    if (!cacheAnnouncementMarqueeElements() || isAnnouncementMarqueeHidden() || !announcementMarqueeState.hasMeasured || announcementMarqueeState.speed <= 0) {
        return;
    }

    if (announcementMarqueeState.isPaused || announcementMarqueeState.isDragging) {
        announcementMarqueeState.lastFrameTime = timestamp;
        startAnnouncementMarqueeLoop();
        return;
    }

    if (!announcementMarqueeState.lastFrameTime) {
        announcementMarqueeState.lastFrameTime = timestamp;
        startAnnouncementMarqueeLoop();
        return;
    }

    elapsedSeconds = (timestamp - announcementMarqueeState.lastFrameTime) / 1000;
    announcementMarqueeState.lastFrameTime = timestamp;

    if (elapsedSeconds > 0) {
        nextOffset = announcementMarqueeState.currentOffset - (announcementMarqueeState.speed * elapsedSeconds);

        if (nextOffset <= announcementMarqueeState.endOffset) {
            nextOffset = announcementMarqueeState.startOffset;
        }

        setAnnouncementMarqueeOffset(nextOffset);
    }

    startAnnouncementMarqueeLoop();
}

function updateAnnouncementMarqueeSpeed(resetPosition) {
    var containerWidth;
    var textWidth;
    var totalDistance;
    var durationInSeconds;

    ensureAnnouncementMarqueeBindings();

    if (!cacheAnnouncementMarqueeElements() || isAnnouncementMarqueeHidden()) {
        clearAnnouncementMarqueeRetry();
        stopAnnouncementMarqueeLoop();
        return;
    }

    containerWidth = announcementMarqueeState.track.offsetWidth;
    textWidth = announcementMarqueeState.text.offsetWidth;

    if (!containerWidth || !textWidth) {
        scheduleAnnouncementMarqueeRetry(resetPosition);
        return;
    }

    clearAnnouncementMarqueeRetry();
    totalDistance = containerWidth + textWidth;
    durationInSeconds = totalDistance / 65;

    if (durationInSeconds < 12) {
        durationInSeconds = 12;
    }

    announcementMarqueeState.startOffset = containerWidth;
    announcementMarqueeState.endOffset = -textWidth;
    announcementMarqueeState.speed = totalDistance / durationInSeconds;
    announcementMarqueeState.hasMeasured = true;

    if (resetPosition) {
        setAnnouncementMarqueeOffset(announcementMarqueeState.startOffset);
    } else {
        setAnnouncementMarqueeOffset(announcementMarqueeState.currentOffset);
    }

    announcementMarqueeState.lastFrameTime = 0;
    startAnnouncementMarqueeLoop();
}

bindEvent(window, "resize", function () {
    updateAnnouncementMarqueeSpeed(false);
});

function renderView() {
    $("#voucherInput").val("");
    $('.modal').modal('hide');
    $("#ipInfo").html(uIp);
    $("#macInfo").html(mac);
    wheelConfig = [];
    multiVendoAddresses = [];
    fetchPortalConfig(function (data, error) {
        if (!!error) {

            $.toast({
                title: 'Failed',
                content: error || 'Server request failed. Try again later. Data shown are locally stored dummy/test values only.',
                type: 'error',
                delay: 4000
            });
        }

        if (!!data) {
            isMultiVendo = data.isMultiVendo;
            multiVendoOption = data.multiVendoOption;
            multiVendoAddresses = data.multiVendoAddresses;
            loginOption = data.loginOption;
            dataRateOption = data.dataRateOption;
            vendorIpAddress = data.vendorIpAddress;
            chargingEnable = data.chargingEnable;
            eloadEnable = data.eLoadEnable;
            showPauseTime = data.showPauseTime;
            showMemberLogin = data.showMemberLogin;
            showExtendTimeButton = data.showExtendTimeButton;
            macAsVoucherCode = data.macAsVoucherCode;
            qrCodeVoucherPurchase = data.qrCodeVoucherPurchase;
            disableVoucherInput = !data.showPortalInputVoucher;
            pointsEnabled = data.pointsPercentage > 0;
            autologin = data.autoLoginHotspot;
            wheelConfig = data.wheelConfig;
            hasWiFree = data.hasWiFree;
            announcementText = data.announcement;
        }
        localStorageCompat.setItem('vendorIpAddress', vendorIpAddress);
        if (announcementText) {
            var announcement = $("#announcement");
            announcement.removeClass("hide");
            $("#announcementText").html(announcementText);
            setTimeout(function () {
                updateAnnouncementMarqueeSpeed(true);
            }, 0);
        }
        // handle the data if needed
        $("#saveVoucherButton").prop('disabled', true);
        hideDoneButton();
        $("#cncl").prop('disabled', false);
        $('#coinToast').toast({delay: 1000, animation: true});
        $('#coinSlotError').toast({delay: 5000, animation: true});

        if (!dataRateOption) {
            $("#dataInfoDiv").addClass("hide");
            $("#dataInfoDiv2").addClass("hide");
        }
        if (!showMemberLogin) {
            $("#memberBtn").addClass("hide");
        }
        if (data) {
            if (!data.showInsertCoin) {
                $("#insertBtnContainer").addClass("hide");
            } else {
                $("#insertBtnContainer").removeClass("hide");
            }
            if (!data.showPauseTime) {
                $("#pauseBtnContainer").addClass("hide");
            }
            if (!data.showPortalHistory) {
                $("#historyContainer").addClass("hide");
                $("#historyTab").addClass("hide");
                $("#history").addClass("hide");
            }

            if (!data.showPortalHeader) {
                $("#headerContainer").addClass("hide");
            } else {
                $("#headerContainer").removeClass("hide");
            }
        }


        if (qrCodeVoucherPurchase) {
            $("#scanQrBtn").attr("style", "display: block");
        }
        if (disableVoucherInput) {
            $("#useVoucherContainer").addClass("hide");
        }


        // if (data.hideRates) {
        //     $("#rateTable").addClass("hide");
        //     $("#btnPromoRates").addClass("hide");
        // } else {
        //     $("#rateTable").removeClass("hide");
        //     $("#btnPromoRates").removeClass("hide");
        // }

        if (!chargingEnable) {
            if (isMultiVendo) {
                evaluateChargingButton(selectedVendoDtls);
            } else {
                $("#chargingBtn").addClass("hide");
                $("#rateTypeDiv").addClass("hide");
            }
        }

        if (!eloadEnable) {
            if (isMultiVendo) {
                evaluateEloadButton(selectedVendoDtls);
            } else {
                $("#eloadBtn").addClass("hide");
            }
        }

        if (!wheelConfig) {
            $("#spinRedeemBtn").addClass("hide");
        }

        voucher = resolveVoucherValue(macNoColon);

        var ignoreSaveCode = getStorageValue("ignoreSaveCode");
        if (ignoreSaveCode == null || ignoreSaveCode == "0") {
            ignoreSaveCode = "0";
        }
        fetchUserInfo(macNoColon, pointsEnabled, function (userData, error) {
            if (pauseAwaitingUserInfoResponse) {
                removeLoader('pauseTimeBtn');
                pauseAwaitingUserInfoResponse = false;
                pauseRequestInFlight = false;
            }

            if (!!error) {

                $.toast({
                    title: 'Failed',
                    content: error || 'Server request failed. Try again later.',
                    type: 'error',
                    delay: 4000
                });
                return;
            }

            var isOnline = false, pointsEnabled = false;
            var isMember = false;
            voucherCode = macNoColon;
            var timeRemainingStr = "";
            var totalPoints = 0, timeRemaining, timeExpiry;
            if (!!userData) {
                isOnline = userData.isOnline;
                voucherCode = userData.voucherCode;
                pointsEnabled = userData.pointsEnabled;
                isMember = userData.isMember;
                totalPoints = Number(userData.totalPoints) || 0;
                timeRemaining = userData.timeRemaining;
                timeRemainingStr = userData.timeRemainingStr;
                timeExpiry = userData.timeExpiry;
            }
            voucher = resolveVoucherValue(voucherCode);
            if (isMultiVendo) {
                if (multiVendoOption == 1) {
                    $("#vendoSelectDiv").addClass("hide");
                    var currentHotspot = hotspotAddress.split(":")[0];
                    var dtls = null;
                    for (var i = 0; i < multiVendoAddresses.length; i++) {
                        if (multiVendoAddresses[i].hotspotAddress === currentHotspot) {
                            dtls = multiVendoAddresses[i];
                            break;
                        }
                    }
                    if (!!dtls) {
                        selectedVendoDtls = dtls;
                        vendorIpAddress = dtls.vendoIp;
                        localStorageCompat.setItem('vendorIpAddress', vendorIpAddress);
                        multiVendoConfiguration(dtls, userData);
                    }
                } else if (multiVendoOption == 2) {
                    $("#vendoSelectDiv").addClass("hide");
                    var dtls = null;
                    for (var i = 0; i < multiVendoAddresses.length; i++) {
                        if (multiVendoAddresses[i].interfaceName === interfaceName) {
                            dtls = multiVendoAddresses[i];
                            break;
                        }
                    }
                    if (!!dtls) {
                        selectedVendoDtls = dtls;
                        vendorIpAddress = dtls.vendoIp;
                        localStorageCompat.setItem('vendorIpAddress', vendorIpAddress);
                        multiVendoConfiguration(dtls, userData);
                    }
                } else {
                    var selectedVendo = getStorageValue('selectedVendo');
                    if (selectedVendo === "null") {
                        selectedVendo = null;
                    }
                    for (var i = 0; i < multiVendoAddresses.length; i++) {
                        $("#vendoSelected").append($('<option>', {
                            value: multiVendoAddresses[i].vendoIp,
                            text: multiVendoAddresses[i].vendoName
                        }));
                        if (i === 0 && (!selectedVendo)) {
                            setStorageValue('selectedVendo', multiVendoAddresses[i].vendoIp);
                            selectedVendo = multiVendoAddresses[i].vendoIp;
                            selectedVendoDtls = multiVendoAddresses[i];
                        }
                        if (selectedVendo === multiVendoAddresses[i].vendoIp) {
                            selectedVendoDtls = multiVendoAddresses[i];
                        }
                    }
                    if (selectedVendo != null) {
                        vendorIpAddress = selectedVendo;
                        localStorageCompat.setItem('vendorIpAddress', vendorIpAddress);
                    }

                    $("#vendoSelected").val(vendorIpAddress);
                    var vendoSelectOption = document.getElementById("vendoSelected");
                    vendoSelectOption.onchange = function () {
                        vendorIpAddress = $("#vendoSelected").val();
                        setStorageValue('selectedVendo', vendorIpAddress);
                        localStorageCompat.setItem('vendorIpAddress', vendorIpAddress);
                        var dtls = null;
                        for (var i = 0; i < multiVendoAddresses.length; i++) {
                            if (multiVendoAddresses[i].vendoIp === vendorIpAddress) {
                                dtls = multiVendoAddresses[i];
                                break;
                            }
                        }

                        if (!!dtls) {
                            selectedVendoDtls = dtls;
                            wheelConfig = selectedVendoDtls.wheelConfig;
                            pointsEnabled = selectedVendoDtls.pointsPercentage > 0;
                            showPointsRedeemBtns(totalPoints, pointsEnabled, wheelConfig);
                            multiVendoConfiguration(dtls, userData);
                        }

                        evaluateChargingButton(selectedVendoDtls);
                        evaluateEloadButton(selectedVendoDtls);
                    }
                }

                $("#vendoSelected").trigger("change");

            } else {
                $("#vendoSelectDiv").addClass("hide");
            }
            showPointsRedeemBtns(totalPoints, pointsEnabled, wheelConfig);
            if (pointsEnabled) {
                rewardPointsBalance = totalPoints;
                $("#rewardPoints").html(totalPoints.toFixed(2));
                $(".redeemRatio").text(redeemRatioValue);
                $("#rewardDtls").removeClass("hide");
                $("#rewardDtlsBtn").removeClass("hide");

                // if (parseInt(rewardPointsBalance) < 0) {
                // 	document.getElementById('spinRedeemBtn').disabled = true;
                // 	document.getElementById('redeemPtsBtn').disabled = true;
                // }
            } else {
                $("#rewardDtls").addClass("hide");
                $("#rewardDtlsBtn").addClass("hide");
            }

            // $("#voucherCode").html(voucherCode);
            isPaused = (!isOnline);
            var time = parseInt(timeRemaining, 10);
            if (isNaN(time)) {
                time = parseInt(sessiontimeInSecs, 10) || 0;
            }

            function updateRemainingTimeDisplay(timeValue) {
                var parsedTime = parseInt(timeValue, 10);
                if (isNaN(parsedTime)) {
                    return false;
                }

                time = parsedTime;
                $("#remainTime").html(secondsToDhms(time));
                updateRemainTimeExpandedSize();
                return true;
            }

            updateRemainingTimeDisplay(time);
            if (remainingTimer != null) {
                clearInterval(remainingTimer);
                remainingTimer = null;
            }

            if (!showExtendTimeButton && time > 0) {
                $("#insertBtnContainer").addClass("hide");
            }
            if (time > 0) {
                $("#insertBtn").html("EXTEND");
            }

            if (isOnline) {
                $("#connectionDot").attr("class", "connection-dot blinking-dot-green").attr("title", "Connected");
                setRemainingTimeConnectionState(true);
                $("#statusImg").attr("src", "assets/img/wifi.png");
                $("#statusImg").removeClass("hide");
                $("#statusImg").addClass("blinking2");
                $("#remainingTimeWrapper").removeClass("hide");

                if (!isTimeLeftPollingPaused) {
                    getTimeLeftInSecs(function (latestTime) {
                        updateRemainingTimeDisplay(latestTime);
                    });
                }

                remainingTimer = setInterval(function () {
                    if (isTimeLeftPollingPaused) {
                        return;
                    }

                    getTimeLeftInSecs(function (latestTime) {
                        if (!updateRemainingTimeDisplay(latestTime)) {
                            return;
                        }


                        if (time <= 0 && !isMember) {
                            localStorageCompat.clear();
                            clearInterval(remainingTimer);
                            setTimeout(function () {
                                isOnline = false;
                                renderView();
                            }, 300);
                        }
                    });
                }, 1000);

            } else {
                //$("#remainTime").html(timeRemainingStr);
                if (timeRemaining > 0 && !isMember) {
                    isPaused = true;
                    $("#remainingTimeWrapper").removeClass("hide");
                } else {
                    setStorageValue("isPaused", "0");
                    removeStorageValue(macNoColon + "tempValidity");
                    isPaused = false;
                    $("#remainingTimeWrapper").addClass("hide");
                }

                $("#connectionDot").attr("class", "connection-dot blinking-dot-red").attr("title", "Disconnected");
                setRemainingTimeConnectionState(false);
                $("#statusImg").attr("src", "assets/img/off_wifi.png");
                $("#statusImg").removeClass("hide");
                $("#statusImg").addClass("blinking1");
                showResumeButton();
            }

            if (!!timeExpiry) {
                var expirationTime = parseDateCompat(timeExpiry);
                if (expirationTime) {
                    $("#expirationTime").html(formatDateTimeCompat(expirationTime));
                } else {
                    $("#expirationTime").html(timeExpiry);
                }
            } else {
                $("#expirationTimeWrapper").addClass("hide");
            }

            if (showPauseTime && isPaused) {
                $("#pauseRemainTime").html(getStorageValue(voucher + "remain"));
                showResumeButton();
            } else {
                showPauseButton();
            }

            setStorageValue('activeVoucher', voucherCode);

            if (showPauseTime && isOnline) {
                showPauseButton();
            } else {
                showResumeButton();
            }
            if (hasWiFree) {
                $("#wifreeBtn").removeClass("hide");
            } else {
                $("#wifreeBtn").addClass("hide");
            }

            // Initial call to display immediately
            updateDeviceDateTime();

            // Update every second (1000 milliseconds)
            setInterval(updateDeviceDateTime, 1000);

            if (isMember) {
                $("#networkStatusContainer").addClass("hide");
                $("#remainingTimeContainer").addClass("hide");
                $("#serverStatus").addClass("hide");
                $("#freeInternetContainer").addClass("hide");
                $("#gamesContainer").addClass("hide");

                $("#insertBtnContainer").addClass("hide");
                $("#vendoSelectDiv").addClass("hide");

                // Keep the member dashboard and hide everything else inside tabs
                $("#myTab").addClass("hide");
                $("#myTabContent").addClass("hide");
                $("#memberDashboardContainer").removeClass("hide");

                // Show the voucher code or some identifier in the Dashboard
                var displayUsername = (userData && userData.username) ? userData.username : voucherCode;
                $("#memberUI_Username").text(displayUsername);

                $("#refreshBtn").addClass("hide"); // Hide default refresh

                $("#historyTab").addClass("hide");
                $("#rewardDtlsBtn").addClass("hide");
                $("#resumeBtnContainer").addClass("hide");
                $("#pauseBtnContainer").addClass("hide");
                $("#rateTable").addClass("hide");
                $("#chargingBtn").addClass("hide");
                $("#eloadBtn").addClass("hide");
                $("#useVoucherContainer").addClass("hide");
                $("#wifreeBtn").addClass("hide");
                $("#remainingTimeWrapper").removeClass("hide");
            }

            if (isOnline && isMember) {
                $("#connectionDot").attr("class", "connection-dot blinking-dot-green").attr("title", "Member Connected");
                setRemainingTimeConnectionState(true);
            }
            if (isOnline) {
                $("#connectVoucherBtn").addClass("hide");
                checkInternet();
                var connectVoucherBtn = document.getElementById('connectVoucherBtn');
                if (connectVoucherBtn) {
                    bindEvent(connectVoucherBtn, 'click', function () {
                        addLoader('connectVoucherBtn');
                        RefreshPortal();
                    });
                }
                var confirmLogoutMemberBtn = document.getElementById('confirmLogoutMemberBtn');
                if (confirmLogoutMemberBtn) {
                    bindEvent(confirmLogoutMemberBtn, 'click', function () {
                        addLoader('confirmLogoutMemberBtn');
                        logoutMember();
                    });
                }
            }
            if (!initLoad) {
                $('#loaderDiv').addClass("hide");
                var containerDiv = $('#containerDiv');
                containerDiv.removeClass("hide");
                containerDiv.show();
                setTimeout(function () {
                    updateAnnouncementMarqueeSpeed(false);
                }, 0);
            }

            initLoad = true;
        });
    });
}

function RefreshPortal() {
    setTimeout(function () {
        localStorageCompat.clear();
        voucher = resolveVoucherValue(voucher);
        window.location.href = "/login?vc=" + voucher;
    }, 1500);
}

function isCaptivePortal() {

    var ua = navigator.userAgent || "";

    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (isAndroid && !window.opener && window.innerHeight < 700) {
        return true;
    }

    if (isIOS && !navigator.standalone) {
        return true;
    }

    return false;
}

function multiVendoConfiguration(vendo, user) {
    if (!vendo.showExtendTimeButton && user.timeRemaining > 0) {
        $("#insertBtnContainer").addClass("hide");
    } else {
        $("#insertBtnContainer").removeClass("hide");
    }
    if (user.timeRemaining <= 0) {
        showResumeButton();
    } else {
        if (vendo.showPauseTime && isPaused) {
            showPauseButton();
        } else {
            showResumeButton();
        }
    }
    if (vendo.hideRates) {
        $("#rateTable").addClass("hide");
        $("#btnPromoRates").addClass("hide");
    } else {
        $("#rateTable").removeClass("hide");
        $("#btnPromoRates").removeClass("hide");
    }
    if (!vendo.showMemberLogin) {
        $("#memberBtn").addClass("hide");
    } else {
        $("#memberBtn").removeClass("hide");
    }
    if (!vendo.showInsertCoin) {
        $("#insertBtnContainer").addClass("hide");
    } else {
        $("#insertBtnContainer").removeClass("hide");
    }
    showPauseTime = vendo.showPauseTime;
    if (!vendo.showPauseTime) {
        $("#pauseBtnContainer").addClass("hide");
    } else {
        $("#pauseBtnContainer").removeClass("hide");
    }

    if (!vendo.showPortalInputVoucher) {
        $("#useVoucherContainer").addClass("hide");
    } else {
        $("#useVoucherContainer").removeClass("hide");
    }
    if (!vendo.showPortalHistory) {
        $("#historyContainer").addClass("hide");
        $("#historyTab").addClass("hide");
        $("#history").addClass("hide");
    } else {
        $("#historyContainer").removeClass("hide");
        $("#historyTab").removeClass("hide");
        $("#history").removeClass("hide");
    }
    if (!vendo.showPortalHeader) {
        $("#headerContainer").addClass("hide");
    } else {
        $("#headerContainer").removeClass("hide");
    }
    if (!vendo.wheelConfig) {
        $("#spinRedeemBtn").addClass("hide");
    } else {
        $("#spinRedeemBtn").removeClass("hide");
    }
}

$('#insertCoinModal').on('show.bs.modal', function () {
    isInsertCoinModalVisible = true;
    isInsertCoinPollingPausePending = true;
    hasQueuedCancelTopUpOnUnload = false;
    suspendTimeLeftPolling();
    resetInsertCoinSessionTransition();

    if (!hasInsertCoinReconnectableSession()) {
        return;
    }

    insertCoinSessionTransition.shouldRestoreLogin = true;
    insertCoinSessionTransition.request = logoutVoucherForInsertCoin();
});

$('#insertCoinModal').on('hidden.bs.modal', function () {
    clearInterval(timer);
    timer = null;
    resetAudio(insertcoinbg);
    cancelPendingTopUp(true);
    insertingCoin = false;

    finalizeInsertCoinModalClose();
});

$('#eloadModal').on('hidden.bs.modal', function () {
    insertingCoin = false;
});

$('#wifreeModal').on('show.bs.modal', function (e) {
    renderWifreeList();
});

$('#redeemBySpinModal').on('hidden.bs.modal', function () {
    if (isGamesPageContext()) {
        if (typeof fetchUserPoints === 'function') {
            fetchUserPoints();
        }
    } else {
        renderView();
    }
});
$("#pauseBtnContainer").addClass("hide");
$("#resumeBtnContainer").addClass("hide");
var pauseTimeBtn = document.getElementById('pauseTimeBtn');
if (pauseTimeBtn) {
    pauseTimeBtn.onclick = function () {
        if (pauseRequestInFlight) {
            return false;
        }

        pause(macNoColon);
        isLoggedIn = false;
        return false;
    }
}


var memberLoginExecuteBtn = document.getElementById('memberLoginExecuteBtn');
if (memberLoginExecuteBtn) {
    memberLoginExecuteBtn.onclick = function () {
        var username = $("#inputMemberUsername").val().trim();
        var password = $("#inputMemberPassword").val().trim();
        var isValid = true;
        var message = "";

        if (username === "") {
            isValid = false;
            message = "Username is required";
            $("#inputMemberUsername").addClass("is-invalid");
        } else {
            $("#inputMemberUsername").removeClass("is-invalid");
        }

        if (password === "") {
            isValid = false;
            message = message || "Password is required";
            $("#inputMemberPassword").addClass("is-invalid");
        } else {
            $("#inputMemberPassword").removeClass("is-invalid");
        }

        if (!isValid) {
            $("#errorMsg").text(message).removeClass("d-none");
            return;
        }

        $("#errorMsg").addClass("d-none");
        addLoader('memberLoginExecuteBtn');
        var old_mac = getStorageValue('activeVoucher')
        vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
        fetchPortalAPI("/member-login", "POST", vendorIpAddress, {
            mac: mac,
            old_mac: old_mac,
            username: username,
            password: password
        })
            .then(function (result) {
                if ((!result) || (!result.success)) {
                    message = "Username or password is incorrect.";
                    $("#errorMsg").text(message).removeClass("d-none");
                    removeLoader('pauseTimeBtn');
                    return;
                }

                var data = result.data;
                if ((!!data) || (data && data.status === "success")) {
                    $.toast({
                        title: 'Success',
                        content: data.message,
                        type: 'success',
                        delay: 3000
                    });
                    $('#memberModal').modal('hide');
                    newLogin();
                    RefreshPortal();
                } else {
                    message = "Username or password is incorrect.";
                    $("#errorMsg").text(message).removeClass("d-none");
                }
            })
            .catch(function (error) {
                message = JSON.stringify(error);
                $("#errorMsg").text(message).removeClass("d-none");

                removeLoader('memberLoginExecuteBtn');
            });
    }
}

var resumeTimeBtn = document.getElementById('resumeTimeBtn');
if (resumeTimeBtn) {
    resumeTimeBtn.onclick = function () {
        if (resumeRequestInFlight) {
            return false;
        }

        resumeRequestInFlight = true;
        addLoader('resumeTimeBtn');
        setStorageValue("isPaused", "0");
        loginVoucher(macNoColon, function (success) {
            isLoggedIn = success;
            if (success) {
                sessiontimeInSecs = 0;
                removeLoader('resumeTimeBtn');
                newLogin();
                resumeRequestInFlight = false;
            } else {
                removeLoader('resumeTimeBtn');
                resumeRequestInFlight = false;
            }
        });
        return false;
    };
}


function replaceAll(str, rep) {
    var aa = str;
    while (aa.indexOf(rep) > 0) {
        aa = aa.replace(rep, "");
    }
    return aa;
}

if (voucher == null) {
    voucher = resolveVoucherValue("");
}

if (voucher != "") {
    $('#voucherInput').val(voucher);
}

function evaluateChargingButton(vendoDtls) {
    if ((!!vendoDtls) && (!vendoDtls.chargingEnable)) {
        $("#chargingBtn").addClass("hide");
        $("#rateTypeDiv").addClass("hide");
    } else {
        $("#chargingBtn").removeClass("hide");
        $("#rateTypeDiv").removeClass("hide");
    }
}

function hideInsertButtons() {
    $("#saveVoucherButton").hide();
    $("#cncl").hide();
}

hideInsertButtons();

function hideDoneButton() {
    $("#saveVoucherButton").hide();
    $("#cncl").show();
}

function showDoneButton() {
    $("#saveVoucherButton").show();
    $("#cncl").hide();
}

function cancelPause() {
    var r = confirm("Are you sure you want to cancel the session?");
    if (r) {
        removeStorageValue("isPaused");
        removeStorageValue("activeVoucher");
        clearPersistedUserInfo();
        setStorageValue('isPaused', "1");
        setStorageValue('forceLogout', "1");
        document.logout.submit();
    }
}

function promoBtnAction() {
    $('#promoRatesModal').modal('show');
    return false;
}

function chargingBtnAction() {
    $('#chargingModal').modal('show');
    return false;
}

var timer = null;

function getPromoRatesStorageKey() {
    if (vendorIpAddress == null) {
        return null;
    }

    return vendorIpAddress + (typeof append !== 'undefined' ? append : "");
}

function getPersistedPromoRates() {
    var storageKey = getPromoRatesStorageKey();
    if (!storageKey) {
        return null;
    }

    try {
        var storedValue = localStorageCompat.getItem(storageKey);
        if (!storedValue) {
            return null;
        }

        var parsedValue = JSON.parse(storedValue);
        if (parsedValue && parsedValue.ratesByType) {
            return parsedValue.ratesByType[rateType] || null;
        }

        return storedValue;
    } catch (e) {
        return null;
    }
}

function persistPromoRates(data) {
    var storageKey = getPromoRatesStorageKey();
    if (!storageKey) {
        return;
    }

    try {
        var storedValue = localStorageCompat.getItem(storageKey);
        var parsedValue = {};

        if (storedValue) {
            parsedValue = JSON.parse(storedValue) || {};
        }

        if (!parsedValue.ratesByType) {
            parsedValue.ratesByType = {};
        }

        parsedValue.ratesByType[rateType] = data;
        localStorageCompat.setItem(storageKey, JSON.stringify(parsedValue));
    } catch (e) {
        console.error("Failed to persist promo rates:", e);
    }
}

function clearPersistedPromoRates() {
    var storageKey = getPromoRatesStorageKey();
    if (!storageKey) {
        return;
    }

    try {
        localStorageCompat.removeItem(storageKey);
    } catch (e) {
        console.error("Failed to clear promo rates:", e);
    }
}

function renderPromoRatesTable(data, tableBody) {
    var allRows = data.split("|");
    var rows = [];
    for (var i = 0; i < allRows.length; i++) {
        if (allRows[i].trim() !== "") {
            rows.push(allRows[i]);
        }
    }

    for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        var allParts = row.split("#");
        var parts = [];
        for (var k = 0; k < allParts.length; k++) {
            if (allParts[k] !== "") {
                parts.push(allParts[k]);
            }
        }

        var plan = parts[0];
        var price = parts[1];

        var duration = minutesToTime(parts[2]);
        var expiry = minutesToTime(parts[3]);

        var tr = document.createElement("tr");

        var values = [plan, price, duration, expiry];
        for (var l = 0; l < values.length; l++) {
            var td = document.createElement("td");
            td.textContent = values[l].trim();
            tr.appendChild(td);
        }

        tableBody.appendChild(tr);
    }
}

function insertBtnAction() {
    pauseTimeLeftPollingForInsertCoin();
    removeStorageValue("ignoreSaveCode");
    setStorageValue('insertCoinRefreshed', "0");
    clearPersistedPromoRates();
    $("#progressDiv").attr('style', 'width: 100%');
    $("#saveVoucherButton").prop('disabled', true);
    $("#cncl").prop('disabled', false);
    hideDoneButton();
    addLoader('insertBtn');
    totalCoinReceived = 0;

    var totalCoinReceivedSaved = getStorageValue("totalCoinReceived");
    if (totalCoinReceivedSaved != null) {
        totalCoinReceived = totalCoinReceivedSaved;
    }

    $('#totalCoin').html("0");
    $('#totalTime').html(secondsToDhms(parseInt(0)));
    saveLogs("Attempting to insert a coin");
    callTopupAPI(0);

    return false;
}

$('#promoRatesModal').on('shown.bs.modal', function (e) {
    var tableBody = document.querySelector("#rateTable tbody");
    tableBody.innerHTML = "";

    var persistedPromoRates = getPersistedPromoRates();
    if (persistedPromoRates) {
        renderPromoRatesTable(persistedPromoRates, tableBody);
        return;
    }

    populatePromoRates(0);
})
$('#promoRatesModal').on('hidden.bs.modal', function (e) {
    var tableBody = document.querySelector("#rateTable tbody");
    tableBody.innerHTML = "";
});

function parseDuration(minutes) {
    var mins = parseInt(minutes, 10);

    if (mins < 60) {
        return mins.toFixed(2) + "m";
    }

    if (mins < 1440) {
        return (mins / 60).toFixed(2) + "h";
    }

    return (mins / 1440).toFixed(2) + "d";
}

function populatePromoRates(retryCount) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    var tableBody = document.querySelector("#rateTable tbody");
    tableBody.innerHTML = "";
    $.ajax({
        type: "GET",
        url: "http://" + vendorIpAddress + "/getRates?rateType=" + rateType + "&date=" + (new Date().getTime()),
        crossOrigin: true,
        contentType: 'text/plain',
        success: function (data) {
            persistPromoRates(data);
            renderPromoRatesTable(data, tableBody);
        }, error: function (jqXHR, exception) {
            setTimeout(function () {
                if (retryCount < 2) {
                    populatePromoRates(retryCount + 1);
                }
            }, 1000);
        }
    });
}

function parseTimeLeftResponse(data) {
    if (!data) {
        return null;
    }

    if (typeof data === "object") {
        return data;
    }

    if (typeof data !== "string") {
        return null;
    }

    var normalizedData = data.replace(/,\s*([}\]])/g, "$1");

    try {
        return JSON.parse(normalizedData);
    } catch (e) {
        var sessionTimeMatch = normalizedData.match(/"sessiontimeInSecs"\s*:\s*(\d+)/);
        if (sessionTimeMatch) {
            return {
                sessiontimeInSecs: parseInt(sessionTimeMatch[1], 10)
            };
        }
    }

    return null;
}

function getTimeLeftInSecs(cb) {
    if (isTimeLeftPollingPaused) {
        if (typeof cb === "function") {
            cb(null, {pollingPaused: true});
        }
        return;
    }

    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    var timeLeftRequest = $.ajax({
        type: "GET",
        url: "http://" + hotspotAddress + "/api",
        crossOrigin: true,
        dataType: "text",
        contentType: 'text/plain',
        success: function (data) {
            if (activeTimeLeftRequest === timeLeftRequest) {
                activeTimeLeftRequest = null;
            }

            var responseData = parseTimeLeftResponse(data);
            var latestTime = responseData ? parseInt(responseData.sessiontimeInSecs, 10) : NaN;
            var isCurrentlyConnected = responseData && responseData.status === 'Connected';
            voucher = resolveVoucherValue(responseData.code);
            if (!isNaN(latestTime)) {
                $("#remainTime").html(secondsToDhms(latestTime));
                updateRemainTimeExpandedSize();
                sessiontimeInSecs = latestTime;
            }
            updateLastKnownVoucherSessionState(isCurrentlyConnected, !isNaN(latestTime) ? latestTime : lastKnownVoucherSessionState.timeRemaining);
            if (isCurrentlyConnected) {
                showPauseButton();
            } else {
                renderView();
                pause(macNoColon);
                showResumeButton();
            }
            if (typeof cb === "function") {
                cb(latestTime, responseData);
            }
        }, error: function (jqXHR, exception) {
            if (activeTimeLeftRequest === timeLeftRequest) {
                activeTimeLeftRequest = null;
            }

            if (exception === "abort" || (jqXHR && jqXHR.statusText === "abort")) {
                return;
            }

            if (typeof cb === "function") {
                cb(null);
            }
        }
    });

    activeTimeLeftRequest = timeLeftRequest;
}

$('#chargingModal').on('shown.bs.modal', function (e) {
    populateChargingStations(0);
})

function minutesToTime(totalMinutes) {
    totalMinutes = parseInt(totalMinutes);

    if (isNaN(totalMinutes) || totalMinutes < 0) {
        return "Invalid value";
    }

    var days = Math.floor(totalMinutes / (24 * 60));
    var hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    var minutes = totalMinutes % 60;

    var parts = [];

    if (days > 0) parts.push(days + "day" + (days > 1 ? "s" : ""));
    if (hours > 0) parts.push(hours + "hr" + (hours > 1 ? "s" : ""));
    if (minutes > 0 || parts.length === 0)
        parts.push(minutes + "min" + (minutes > 1 ? "s" : ""));

    return parts.join(" ");
}

function populateChargingStations(retryCount) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    clearInterval(chargerTimer);
    chargerTimer = setInterval(refreshChargerTimer, 1000);
    $.ajax({
        type: "GET",
        url: "http://" + vendorIpAddress + "/getChargingStation?date=" + (new Date().getTime()),
        crossOrigin: true,
        contentType: 'text/plain',
        success: function (data) {
            var rows = data.split("|");
            var chargingStation = "";
            for (r in rows) {
                var columns = rows[r].split("#");
                var curDate = new Date();
                var targetTimestamp = 0;
                var pinSetting = columns[1];
                var targetTime = parseInt(columns[3]);
                if (targetTime > 0) {
                    var targetTimeDate = new Date(targetTime * 1000);
                    if (targetTimeDate.getTime() > curDate.getTime()) {
                        targetTimestamp = targetTimeDate.getTime();
                    }
                }
                var style = "";
                if (pinSetting == "-1") {
                    style = "display: none";
                }
                chargingStation = chargingStation + "<div class='rholder' style='" + style + "' row-type='charger-port' target-time='" + targetTimestamp + "'>";
                chargingStation = chargingStation + "<div class='rdata'><span>Name: </span>";
                chargingStation = chargingStation + columns[0];
                chargingStation = chargingStation + "</div>";
                chargingStation = chargingStation + "<div class='rdata'><span style='color: #a3a7ad'>Status: <span name='portStatus'>-";
                chargingStation = chargingStation + "</span></span></div>";
                chargingStation = chargingStation + "<div class='rdata'><span style='color: #a3a7ad'>Remaining: <span name='remainTime'>-";
                chargingStation = chargingStation + "</span></span></div>";
                chargingStation = chargingStation + "<div class='rdata'><span style='color: #a3a7ad'>";
                chargingStation = chargingStation + "<button class='btn btn-success' style='display: none' name='useBtn' onClick=\"addChargerTime(" + r + ", \'" + columns[0] + "\',0)\">Avail</button>";
                chargingStation = chargingStation + "</span></div>";
                chargingStation = chargingStation + "</div>";
            }

            $("#chargingBody").html(chargingStation);
        }, error: function (jqXHR, exception) {
            setTimeout(function () {
                if (retryCount < 2) {
                    populateChargingStations(retryCount + 1);
                }
            }, 1000);
        }
    });
}

function refreshChargerTimer() {
    $("[row-type='charger-port']").each(function () {
        var targetTime = parseInt($(this).attr('target-time'));
        var curDate = new Date();
        var portStatus = "Available";
        if (targetTime > 0) {
            if (targetTime > curDate.getTime()) {
                difference = (targetTime - curDate.getTime()) / 1000;
                $(this).find("[name='remainTime']").html(secondsToDhms(difference));
                portStatus = "In Use";
            } else {
                portStatus = "Available";
                $(this).find("[name='useBtn']").attr('style', 'display: block');
            }
        } else {
            $(this).find("[name='useBtn']").attr('style', 'display: block');
        }
        $(this).find("[name='portStatus']").html(portStatus);
    });
}

function onRateTypeChange(evt) {
    rateType = $(evt).val();
    populatePromoRates(0);
}

function addChargerTime(port, portName, retryCount) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    topupMode = TOPUP_CHARGER;
    $.ajax({
        type: "POST",
        url: "http://" + vendorIpAddress + "/topUp",
        data: "voucher=" + portName + "&topupType=CHARGER&chargerPort=" + port + "&mac=" + mac,
        success: function (data) {

            if (data.status == "true") {
                voucher = resolveVoucherValue(data.voucher);
                $('#insertCoinModal').modal('show');
                insertingCoin = true;
                $('#codeGeneratedBlock').attr('style', 'display: none');
                if (timer == null) {
                    timer = setInterval(checkCoin, 1000);
                }
                if (isMultiVendo) {
                    $("#insertCoinModalTitle").html("Please insert the coin on " + $("#vendoSelected option:selected").text());
                }
                safeAudioPlay(ensureInsertCoinAudio());
            } else {
                notifyCoinSlotError(data.errorCode);
                clearInterval(timer);
                timer = null;
            }
        }, error: function (jqXHR, exception) {
            setTimeout(function () {
                if (retryCount < 2) {
                    addChargerTime(port, portName, retryCount + 1);
                }
            }, 1000);
        }
    });
}

function callTopupAPI(retryCount) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    $('#cncl').html("CANCEL");
    $("#vcCodeDiv").attr('style', 'display: block');
    var type = $("#saveVoucherButton").attr('data-save-type');

    var ipAddCriteria = "";
    if (typeof uIp !== 'undefined') {
        ipAddCriteria = "&ipAddress=" + uIp;
    }

    if (type == "extend") {
        extendTimeCriteria = "&extendTime=1";
    } else {
        extendTimeCriteria = "&extendTime=0";
    }
    voucher = resolveVoucherValue(voucher);
    $.ajax({
        type: "POST",
        url: "http://" + vendorIpAddress + "/topUp",
        data: "voucher=" + voucher + "&mac=" + mac + ipAddCriteria + extendTimeCriteria,
        success: function (data) {
            if (data.status == "true") {
                voucher = resolveVoucherValue(data.voucher);
                $('#insertCoinModal').modal('show');
                insertingCoin = true;
                $('#codeGenerated').html(voucher);
                $('#codeGeneratedBlock').attr('style', 'display: none');
                if (timer == null) {
                    timer = setInterval(checkCoin, 1000);
                }
                if (isMultiVendo) {
                    $("#insertCoinModalTitle").html("Please insert the coin on " + $("#vendoSelected option:selected").text());
                }
                safeAudioPlay(ensureInsertCoinAudio());
            } else {
                notifyCoinSlotError(data.errorCode);
                clearInterval(timer);
                timer = null;
                removeLoader('insertBtn');
                if (isInsertCoinPollingPausePending && !isInsertCoinModalVisible) {
                    releaseTimeLeftPollingAfterInsertCoin(false);
                }
            }
        }, error: function (jqXHR, exception) {
            setTimeout(function () {
                if (retryCount < 3) {
                    callTopupAPI(retryCount + 1);
                } else {
                    removeLoader('insertBtn');
                    notifyCoinSlotError("coin.slot.notavailable");
                    if (isInsertCoinPollingPausePending && !isInsertCoinModalVisible) {
                        releaseTimeLeftPollingAfterInsertCoin(false);
                    }
                }
            }, 1000);
        }
    });
}

function saveVoucherBtnAction() {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    addLoader('saveVoucherButton')
    voucher = resolveVoucherValue(voucher);

    if (topupMode == TOPUP_INTERNET) {
        setStorageValue('activeVoucher', voucher);
        removeStorageValue("totalCoinReceived");
        $('#voucherInput').val(voucher);
    }

    clearInterval(timer);
    timer = null;
    resetAudio(insertcoinbg);
    $.ajax({
        type: "POST",
        url: "http://" + vendorIpAddress + "/useVoucher",
        data: "voucher=" + voucherCode,
        success: function (data) {
            if (data.status == "true") {
                if (topupMode == TOPUP_CHARGER) {
                    populateChargingStations();
                    $.toast({
                        title: 'Success',
                        content: 'Thank you for the purchase!, you can now use the service',
                        type: 'success',
                        delay: 3000
                    });

                } else {
                    setStorageValue(voucher + "tempValidity", data.validity);

                    $.toast({
                        title: 'Success',
                        content: 'Thank you for the purchase!',
                        type: 'success',
                        delay: 3000
                    });
                    saveLogs(totalCoinReceived + " coins successfully inserted.");

                    setTimeout(function () {
                        newLogin();
                        removeLoader('insertBtn')
                        removeLoader('saveVoucherButton')
                        RefreshPortal();
                    }, 1300);
                }
                // if (parseInt(rewardPointsBalance) < 0) {
                // 	document.getElementById('spinRedeemBtn').disabled = true;
                // 	document.getElementById('redeemPtsBtn').disabled = true;
                // }
            } else {
                notifyCoinSlotError(data.errorCode);
            }
            totalCoinReceived = 0;
        }, error: function (jqXHR, exception) {

            if (totalCoinReceived > 0) {
                saveLogs("Insert coin error: " + ((exception && exception.message) || exception || "Unknown error"));
                $.toast({
                    title: 'Warning',
                    content: 'Connect/Login failed, however coin has been process, please manually connect using this voucher: ' + voucher,
                    type: 'info',
                    delay: 8000
                });
                setTimeout(function () {
                    newLogin();
                }, 3000);
            }
        }
    });

}

function checkCoin() {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    voucher = resolveVoucherValue(voucher);
    $.ajax({
        type: "POST",
        url: "http://" + vendorIpAddress + "/checkCoin",
        data: "voucher=" + voucher,
        success: function (data) {
            $("#noticeDiv").attr('style', 'display: none');
            if (data.status == "true") {
                totalCoinReceived = parseInt(data.totalCoin);

                $('#totalCoin').html(data.totalCoin);
                $('#totalTime').html(secondsToDhms(parseInt(data.timeAdded)));
                if (topupMode == TOPUP_INTERNET) {
                    $('#codeGeneratedBlock').attr('style', 'display: block');
                    $('#totalData').html(data.data);
                    $('#voucherInput').val(voucher);
                }

                setStorageValue('activeVoucher', voucher);
                setStorageValue('totalCoinReceived', totalCoinReceived);
                setStorageValue(voucher + "tempValidity", data.validity);
                notifyCoinSuccess(data.newCoin);
                $("#cncl").prop('disabled', true);
            } else {
                if (data.errorCode == "coin.is.reading") {
                    $("#noticeDiv").attr('style', 'display: block');
                    $("#noticeText").html("Verifying, please wait..");
                } else if (data.errorCode == "coin.not.inserted") {
                    setStorageValue(voucher + "tempValidity", data.validity);

                    var remainTime = parseInt(parseInt(data.remainTime) / 1000);
                    var waitTime = parseFloat(data.waitTime);
                    var percent = parseInt(((remainTime * 1000) / waitTime) * 100);
                    totalCoinReceived = parseInt(data.totalCoin);
                    if (totalCoinReceived > 0) {
                        $("#saveVoucherButton").prop('disabled', false);
                        showDoneButton();
                        $("#cncl").prop('disabled', true);
                    }
                    if (remainTime == 0) {
                        $('#insertCoinModal').modal('hide');
                        resetAudio(insertcoinbg);
                        if (totalCoinReceived > 0) {

                            if (topupMode == TOPUP_INTERNET) {
                                $.toast({
                                    title: 'Success',
                                    content: 'Coin slot expired!, but was able to succesfully process the coin ' + totalCoinReceived + ".",
                                    type: 'info',
                                    delay: 5000
                                });
                                var type = $("#saveVoucherButton").attr('data-save-type');
                                setTimeout(function () {
                                    newLogin();
                                }, 1000);
                            } else if (topupMode == TOPUP_CHARGER) {
                                populateChargingStations();
                                $.toast({
                                    title: 'Success',
                                    content: 'Coin slot expired!, but was able to succesfully process the coin ' + totalCoinReceived + " you can now use the service",
                                    type: 'info',
                                    delay: 5000
                                });
                            }
                        } else {
                            notifyCoinSlotError('coins.wait.expired');
                        }
                    } else {
                        totalCoinReceived = parseInt(data.totalCoin);
                        if (totalCoinReceived > 0) {
                            $("#saveVoucherButton").prop('disabled', false);
                            showDoneButton();
                            $("#cncl").prop('disabled', true);
                            $('#codeGeneratedBlock').attr('style', 'display: block');
                        }
                        $('#totalCoin').html(data.totalCoin);
                        $('#totalData').html(data.data);
                        $('#totalTime').html(secondsToDhms(parseInt(data.timeAdded)));
                        //$( "#remainingTime" ).html(remainTime);
                        $("#progressDiv").attr('style', 'width: ' + percent + '%')
                    }

                } else if (data.errorCode == "coinslot.busy") {
                    //when manually cleared the button
                    resetAudio(insertcoinbg);
                    clearInterval(timer);
                    $('#insertCoinModal').modal('hide');
                    if (totalCoinReceived == 0) {
                        notifyCoinSlotError("coinslot.cancelled");
                    } else {
                        $.toast({
                            title: 'Success',
                            content: 'Coin slot cancelled!, but was able to succesfully process the coin ' + totalCoinReceived + ".",
                            type: 'info',
                            delay: 5000
                        });
                        var type = $("#saveVoucherButton").attr('data-save-type');
                        setTimeout(function () {
                            newLogin();
                        }, 3000);
                    }
                } else {
                    notifyCoinSlotError(data.errorCode);
                    clearInterval(timer);
                }
            }
        }, error: function (jqXHR, exception) {
        }
    });
}

function convertVoucherAction() {
    var vc = $("#convertVoucherCode").val();
    if (vc != "") {
        voucherToConvert = vc;
        voucher = resolveVoucherValue(voucher);
        $("#convertBtn").prop('disabled', true);
        $.ajax({
            type: "POST",
            url: "http://" + vendorIpAddress + "/convertVoucher",
            data: "voucher=" + voucher + "&convertVoucher=" + voucherToConvert,
            success: function (data) {
                if (data.status == "true") {
                    $.toast({
                        title: 'Success',
                        content: 'Voucher converted succesfully',
                        type: 'info',
                        delay: 1000
                    });
                } else {
                    notifyCoinSlotError("convertVoucher.invalid");
                }
                $("#convertVoucherCode").val("");
                $("#convertBtn").prop('disabled', false);
                voucherToConvert = "";
            }, error: function () {
                notifyCoinSlotError("convertVoucher.invalid");
                $("#convertVoucherCode").val("");
                $("#convertBtn").prop('disabled', false);
                voucherToConvert = "";
            }
        });
    } else {
        notifyCoinSlotError("convertVoucher.empty");
    }
}


function notifyCoinSlotError(errorCode, delay) {
    if (delay === undefined) delay = 5000;
    $.toast({
        title: "Coin Error",
        content: errorCodeMap[errorCode],
        type: "error",
        delay: delay
    });
}

function notifyCoinSuccess(coin, delay) {
    if (delay === undefined) delay = 5000;
    safeAudioPlay(ensureCoinCountAudio());

    $.toast({
        title: "Insert Coin",
        content: coin + " peso(s) was inserted",
        type: "success",
        delay: delay
    });

}

function secondsToDhms(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);

    var dDisplay = d > 0 ? d + (d == 1 ? "d" : "d") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? "" : "") : "0";
    var mDisplay = m > 0 ? m + (m == 1 ? "" : "") : "0";
    var sDisplay = s > 0 ? s + (s == 1 ? "" : "") : "0";
    return dDisplay + " " + hDisplay + "h : " + mDisplay + "m : " + sDisplay + "s";
}

function setStorageValue(key, value) {
    setCookie(key, value, 364);
}

function removeStorageValue(key) {
    eraseCookie(key);
}

function clearStorageValues() {
    localStorageCompat.clear();
    clearPersistedUserInfo();
}

function pause(macNoColon) {
    if (pauseRequestInFlight) {
        return;
    }

    pauseRequestInFlight = true;
    addLoader('pauseTimeBtn');
    setStorageValue("isPaused", "1");
    logoutVoucher(macNoColon, function (success) {
        if (success) {
            showResumeButton();
            pauseAwaitingUserInfoResponse = true;
            newLogin();
        } else {
            removeLoader('pauseTimeBtn');
            pauseAwaitingUserInfoResponse = false;
            pauseRequestInFlight = false;
        }
    });
}

function resume() {
    removeStorageValue("isPaused");
    removeStorageValue("activeVoucher");
    removeStorageValue("ignoreSaveCode");
    clearPersistedUserInfo();
    location.reload();
}

function getStorageValue(key) {
    return getCookie(key);
}

function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;';
}

function parseTime(str) {
    try {
        if (!str) return null;

        var timeArr = str.split(":");
        if (timeArr.length == 3) {
            var hr = Number(timeArr[0]);
            var min = Number(timeArr[1]);
            var sec = Number(timeArr[2]);

            var totalSeconds = (hr * 3600) + (min * 60) + sec;

            return totalSeconds;
        }
        return null;
    } catch (e) {
        return null;
    }
}

var checkInternetMaxCount = 10;

function checkInternet() {
    if (checkInternetMaxCount > 10)
        return;

    try {
        var iframe = document.createElement('iframe');
        var os = getDeviceOS();

        switch (os) {
            case 'Android':
                iframe.src = "https://connectivitycheck.gstatic.com/generate_204";
                break;
            case 'iOS':
                iframe.src = "https://captive.apple.com/hotspot-detect.html";
                break;
            case 'Windows':
                iframe.src = "http://www.msftconnecttest.com/connecttest.txt";
                break;
            default:
                iframe.src = "https://www.google.com";
                break;
        }

        iframe.style.width = "1px";
        iframe.style.height = "1px";
        iframe.style.position = "absolute";
        iframe.style.display = "none";
        iframe.setAttribute("aria-hidden", "true");
        iframe.tabIndex = -1;

        document.body.appendChild(iframe);

        iframe.onload = function () {
            checkInternetMaxCount++;
            setTimeout(checkInternet, 1000);
        };
    } catch (error) {
        console.error("checkInternet error:", error);
        setTimeout(checkInternet, 1000);
    }
}

function getDeviceOS() {
    var userAgent = window.navigator.userAgent;

    // 1. Safety check: handle null/undefined/empty
    if (!userAgent) return 'Unknown';

    // 2. Detection Logic
    if (/android/i.test(userAgent)) {
        return 'Android';
    }
    if (/iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        return 'iOS';
    }
    if (/Windows/i.test(userAgent)) {
        return 'Windows';
    }
    if (/Macintosh|Mac OS X/i.test(userAgent)) {
        return 'macOS';
    }
    if (/Linux/i.test(userAgent)) {
        return 'Linux';
    }
    if (/CrOS/i.test(userAgent)) {
        return 'ChromeOS';
    }

    return 'Unknown';
}

function createUserInfoResponsePayload(data, pointsEnabled) {
    if (!data) {
        return null;
    }

    return {
        isOnline: data.isOnline,
        isMember: data.isMember,
        voucherCode: data.voucherCode,
        pointsEnabled: pointsEnabled,
        totalPoints: data.totalPoints,
        timeRemaining: data.timeRemaining,
        timeExpiry: data.timeExpiry,
        timeRemainingStr: data.timeRemainingStr
    };
}

function normalizeUserInfoResponseData(data) {
    var normalizedVoucherCode;
    var normalizedTimeRemaining;
    var normalizedTimeRemainingStr;

    if (!data || typeof data !== "object") {
        return null;
    }

    normalizedVoucherCode = data.code;
    if (normalizedVoucherCode == null || normalizedVoucherCode === "") {
        normalizedVoucherCode = data.voucherCode;
    }

    normalizedTimeRemaining = data.timeRemainingInSeconds;
    if (normalizedTimeRemaining == null || normalizedTimeRemaining === "") {
        normalizedTimeRemaining = data.timeRemaining;
    }

    normalizedTimeRemainingStr = data.timeRemaining;
    if (normalizedTimeRemainingStr == null || normalizedTimeRemainingStr === "") {
        normalizedTimeRemainingStr = data.timeRemainingStr;
    }

    return {
        isOnline: data.isOnline,
        isMember: data.isMember,
        voucherCode: normalizedVoucherCode,
        totalPoints: data.totalPoints,
        timeRemaining: normalizedTimeRemaining,
        timeExpiry: data.timeExpiry,
        timeRemainingStr: normalizedTimeRemainingStr
    };
}

function applyUserInfoState(data, macNoColon, options) {
    var normalizedData = normalizeUserInfoResponseData(data);
    var allowFreeInternetActions = !(options && options.allowFreeInternetActions === false);
    var isPersistedFallback = !!(options && options.isPersistedFallback);

    if (!normalizedData) {
        return null;
    }

    setUserInfoOfflineFallbackState(isPersistedFallback);
    userInfo = data;
    voucherCode = normalizedData.voucherCode || "";
    if (voucherCode !== "") {
        setStorageValue("voucherCode", voucherCode)
    }
    voucher = resolveVoucherValue(voucherCode);
    updateLastKnownVoucherSessionState(normalizedData.isOnline, normalizedData.timeRemaining);

    if (allowFreeInternetActions && data.hasFreeInternet) {
        $("#freeInternetContainer").removeClass("hide");
        document.getElementById("claimFreeInternetBtn").onclick = function () {
            $("#claimFreeInternetModal").modal("show");
            claimFreeInternet(voucherCode);
        };
        document.getElementById("confirmClaimFreeInternetBtn").onclick = function () {
            addLoader("confirmClaimFreeInternetBtn");
            claimFreeInternetFetch(macNoColon, function (success) {
                if (success) {
                    newLogin();
                    $("#freeInternetContainer").addClass("hide");
                    $.toast({
                        title: "Success",
                        content: "Free internet claimed successfully!",
                        type: "success",
                        delay: 4000
                    });
                }
                removeLoader("confirmClaimFreeInternetBtn");
            });
        };

        $("#claimFreeInternetModal").modal("show");
        $("#freeMinutesLabel").html("You are eligible to claim " + parseInt(data.freeMinutes, 10) + " minutes of internet access");
    }

    renderHistories(data);

    return normalizedData;
}

function resolveUserInfoRequestFailure(requestKey, macNoColon, error) {
    var persistedData;
    var resolvedData;

    // fetchPortalAPI already performs the configured retries before this handler runs.
    persistedData = getPersistedUserInfo();
    if (!persistedData) {
        resolveUserInfoRequest(requestKey, null, error);
        return;
    }

    resolvedData = applyUserInfoState(persistedData, macNoColon, {
        allowFreeInternetActions: false,
        isPersistedFallback: true
    });

    if (!resolvedData) {
        resolveUserInfoRequest(requestKey, null, error);
        return;
    }

    resolveUserInfoRequest(requestKey, resolvedData, null);
}

function resolveUserInfoRequest(requestKey, data, error) {
    var requestEntry = userInfoRequestPool[requestKey];
    if (!requestEntry) {
        return;
    }

    delete userInfoRequestPool[requestKey];
    var subscribers = requestEntry.subscribers || [];

    for (var i = 0; i < subscribers.length; i++) {
        var subscriber = subscribers[i];
        if (!subscriber || typeof subscriber.cb !== "function") {
            continue;
        }

        try {
            if (error) {
                subscriber.cb(null, error);
            } else if (!data) {
                subscriber.cb(null, null);
            } else {
                subscriber.cb(createUserInfoResponsePayload(data, subscriber.pointsEnabled), null);
            }
        } catch (cbError) {
            console.error("fetchUserInfo callback error:", cbError);
        }
    }
}

function fetchUserInfo(macNoColon, pointsEnabled, cb) {
    if (typeof cb !== "function") {
        cb = function () {
        };
    }

    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    var params = "mac=" + macNoColon + "&interfaceName=" + interfaceName;
    var old_mac = getStorageValue("activeVoucher");
    if (old_mac && old_mac !== "") {
        params += "&old_mac=" + old_mac;

        var pausedState = getStorageValue("isPaused");
        if (pausedState === "1") {
            params += "&isPaused=true";
        } else {
            params += "&isPaused=false";
        }
    }
    var requestKey = (vendorIpAddress || "") + "|" + params;
    var requestEntry = userInfoRequestPool[requestKey];

    if (requestEntry) {
        requestEntry.subscribers.push({pointsEnabled: pointsEnabled, cb: cb});
        return;
    }

    userInfoRequestPool[requestKey] = {
        subscribers: [{pointsEnabled: pointsEnabled, cb: cb}]
    };

    fetchPortalAPI("/user-info?" + params, "GET", vendorIpAddress, null)
        .then(function (result) {
            if ((!result) || (!result.success)) {
                resolveUserInfoRequestFailure(requestKey, macNoColon, (result && result.error) || "Server request failed.");
                return;
            }
            var data = result.data;
            if (!data) {
                resolveUserInfoRequest(requestKey, null, null);
                return;
            }
            persistUserInfo(data);
            resolveUserInfoRequest(requestKey, applyUserInfoState(data, macNoColon), null);
        })
        .catch(function (error) {
            resolveUserInfoRequestFailure(requestKey, macNoColon, error);
        });
}

function renderHistories(data, containerId) {
    if (containerId === undefined) {
        containerId = "historyContainer";
    }
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";
    container.setAttribute("style", "overflow-y:auto;max-height:60vh;max-height:60dvh;");
    container.className = "history-list d-flex flex-column gap-2 pb-3";

    if (!data || !isArrayCompat(data.histories) || data.histories.length === 0) {
        container.innerHTML = '<div class="text-center py-3" style="color:#7b93bf;font-size:0.82rem;">No history available</div>';
        return;
    }

    data.histories.forEach(function (item) {
        var div = document.createElement("div");
        div.className = "voucher-card";

        var date = formatDateTimeCompat(item.date) || item.date;
        var amount = item.coin ? item.coin.toFixed(2) : "0.00";
        var points = Number(item.pointsEarned.toFixed(2));

        div.innerHTML =
            '<div class="d-flex justify-content-between align-items-center">' +
            '<span class="voucher-amount">₱ ' + amount + '</span>' +
            '<span class="voucher-activity">' + item.activity + '</span>' +
            '</div>' +
            '<div class="voucher-divider"></div>' +
            '<div class="d-flex justify-content-between align-items-center">' +
            '<span class="voucher-date">' + date + '</span>' +
            '<span class="voucher-points">' + points + ' pts</span>' +
            '</div>';

        container.appendChild(div);
    });
}

function onPurchaseClicked(item) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    addLoader('wifreeBtn');
    $('#wifreeCheckOutModal').modal('show');
    $('#wifreeModal').modal('hide');
    var container = document.getElementById('checkout-container');
    container.innerHTML =
        '<div class="d-flex flex-column gap-2 px-2 py-2 shadow" style="border:1px solid #7e7e7e;border-radius: 5px">' +
        '<div class="d-flex justify-content-between align-items-center gap-2 w-100">' +
        '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" width="35" height="29.52" viewBox="0 0 135.33 114.13">' +
        '<title>GCash</title>' +
        '<path d="M301.23,384.14a64.85,64.85,0,0,1-7,29.49,6.56,6.56,0,0,0,2.33,8.54h0a6.53,6.53,0,0,0,9-2q.16-.25.29-.51a78.4,78.4,0,0,0,0-70.9,6.54,6.54,0,0,0-8.81-2.81l-.5.29h0a6.56,6.56,0,0,0-2.33,8.53A64.88,64.88,0,0,1,301.23,384.14Z" transform="translate(-179 -327.08)" style="fill:#51c1ff"/>' +
        '<path d="M280.06,384.14a43.85,43.85,0,0,1-4,18.4,6.55,6.55,0,0,0,2.46,8.28h0A6.56,6.56,0,0,0,288,408a57.4,57.4,0,0,0,0-47.68,6.56,6.56,0,0,0-9.45-2.82h0a6.55,6.55,0,0,0-2.46,8.28A43.85,43.85,0,0,1,280.06,384.14Z" transform="translate(-179 -327.08)" style="fill:#51c1ff"/>' +
        '<path d="M236.06,428.13a44,44,0,1,1,26.87-78.85,6.54,6.54,0,0,0,8.63-.53h0a6.53,6.53,0,0,0-.63-9.79,57.08,57.08,0,1,0,.09,90.3,6.44,6.44,0,0,0,.61-9.63l-.14-.14A6.45,6.45,0,0,0,263,419,43.82,43.82,0,0,1,236.06,428.13Z" transform="translate(-179 -327.08)" style="fill:#007cff"/>' +
        '<path d="M271.15,379.35a6.75,6.75,0,0,0-4.76-2h0l-31.35,0h0a6.77,6.77,0,1,0,0,13.53h23.59a23.52,23.52,0,1,1-10-26.75,6.78,6.78,0,0,0,8.4-1h0a6.75,6.75,0,0,0-1.14-10.45,37.36,37.36,0,0,0-27.8-4.88,36.55,36.55,0,0,0-28.24,28.48,37.08,37.08,0,1,0,73.34,7.78A6.78,6.78,0,0,0,271.15,379.35Z" transform="translate(-179 -327.08)" style="fill:#002cb8"/>' +
        '</svg>' +
        '<h2 class="fw-bolder">₱ ' + item.price.toFixed(2) + '</h2>' +
        '</div>' +
        '<div class="divider-primary"></div>' +
        '<div class="d-flex justify-content-between gap-0 w-100">' +
        '<small>' +
        'Time: ' + minutesToTime(item.timeInMinutes) +
        '</small>' +
        '<small class="text-end">' +
        'Expiry: ' + minutesToTime(item.expirationInMinutes) +
        '</small>' +
        '</div>' +
        '</div>';
    var payNowBtn = document.getElementById('payNowBtn');
    var inputMobileNumber = document.getElementById('inputMobileNumber');
    var mobileError = document.getElementById('mobileError');

    bindEvent(payNowBtn, 'click', function (e) {
        var mobileValue = inputMobileNumber.value.trim();
        var onlyNumbers = /^\d+$/;

        removeClassCompat(inputMobileNumber, 'is-invalid');
        removeClassCompat(inputMobileNumber, 'is-valid');
        var errorMessage = "";

        if (mobileValue === "") {
            errorMessage = "Mobile number is required.";
        } else if (!onlyNumbers.test(mobileValue)) {
            errorMessage = "Please enter numbers only (no letters or spaces).";
        } else if (mobileValue.length !== 11) {
            errorMessage = "Number must be exactly 11 digits.";
        }

        if (errorMessage) {
            mobileError.textContent = errorMessage;
            addClassCompat(inputMobileNumber, 'is-invalid');
        } else {
            addClassCompat(inputMobileNumber, 'is-valid');

            addLoader('payNowBtn');

            var code = getStorageValue('activeVoucher');

            fetchPortalAPI("/wifree-vouchers", "POST", vendorIpAddress, {
                code: code,
                purchaseId: item.id,
                mobile: mobileValue
            })
                .then(function (result) {
                    if ((!result) || (!result.success)) {
                        $.toast({
                            title: 'Failed',
                            content: (result && result.error) || 'Request failed. Please try again.',
                            type: 'error',
                            delay: 4000
                        });
                        removeLoader('payNowBtn');
                        return;
                    }

                    var data = result.data;
                    if ((!!data) || (data && data.status === "success")) {
                        window.location.href = data.url;
                    } else {
                        $.toast({
                            title: 'Failed',
                            content: 'Failed to disconnect device.',
                            type: 'error',
                            delay: 4000
                        });
                    }
                })
                .catch(function (error) {
                    $.toast({
                        title: 'Failed',
                        content: (error && (error.message || error)) || 'Failed to connect to server. Try again later.',
                        type: 'error',
                        delay: 4000
                    });
                    removeLoader('payNowBtn');
                });
        }
    });

    bindEvent(inputMobileNumber, 'input', function () {
        removeClassCompat(inputMobileNumber, 'is-invalid');
    });

}

$('#inputMobileNumber').on('input', function () {
    this.value = this.value.replace(/\D/g, '');
    if (this.value.length > 11) {
        this.value = this.value.slice(0, 11);
    }
});

function renderWifreeList() {
    fetchPortalAPI("/wifree-vouchers", "GET", null, null)
        .then(function (result) {
            if ((!result) || (!result.success)) {
                return;
            }
            var data = result.data;
            var container = document.getElementById('wifreeList');
            container.innerHTML = "";
            data.forEach(function (item) {
                var div = document.createElement("div");
                div.style.cursor = "pointer";
                div.innerHTML =
                    '<div class="d-flex flex-column gap-2 px-2 py-2 shadow" style="border:1px solid #7e7e7e;border-radius: 5px">' +
                    '<div class="d-flex justify-content-between align-items-center gap-2 w-100">' +
                    '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" width="35" height="29.52" viewBox="0 0 135.33 114.13">' +
                    '<title>GCash</title>' +
                    '<path d="M301.23,384.14a64.85,64.85,0,0,1-7,29.49,6.56,6.56,0,0,0,2.33,8.54h0a6.53,6.53,0,0,0,9-2q.16-.25.29-.51a78.4,78.4,0,0,0,0-70.9,6.54,6.54,0,0,0-8.81-2.81l-.5.29h0a6.56,6.56,0,0,0-2.33,8.53A64.88,64.88,0,0,1,301.23,384.14Z" transform="translate(-179 -327.08)" style="fill:#51c1ff"/>' +
                    '<path d="M280.06,384.14a43.85,43.85,0,0,1-4,18.4,6.55,6.55,0,0,0,2.46,8.28h0A6.56,6.56,0,0,0,288,408a57.4,57.4,0,0,0,0-47.68,6.56,6.56,0,0,0-9.45-2.82h0a6.55,6.55,0,0,0-2.46,8.28A43.85,43.85,0,0,1,280.06,384.14Z" transform="translate(-179 -327.08)" style="fill:#51c1ff"/>' +
                    '<path d="M236.06,428.13a44,44,0,1,1,26.87-78.85,6.54,6.54,0,0,0,8.63-.53h0a6.53,6.53,0,0,0-.63-9.79,57.08,57.08,0,1,0,.09,90.3,6.44,6.44,0,0,0,.61-9.63l-.14-.14A6.45,6.45,0,0,0,263,419,43.82,43.82,0,0,1,236.06,428.13Z" transform="translate(-179 -327.08)" style="fill:#007cff"/>' +
                    '<path d="M271.15,379.35a6.75,6.75,0,0,0-4.76-2h0l-31.35,0h0a6.77,6.77,0,1,0,0,13.53h23.59a23.52,23.52,0,1,1-10-26.75,6.78,6.78,0,0,0,8.4-1h0a6.75,6.75,0,0,0-1.14-10.45,37.36,37.36,0,0,0-27.8-4.88,36.55,36.55,0,0,0-28.24,28.48,37.08,37.08,0,1,0,73.34,7.78A6.78,6.78,0,0,0,271.15,379.35Z" transform="translate(-179 -327.08)" style="fill:#002cb8"/>' +
                    '</svg>' +
                    '<h2 class="fw-bolder">₱ ' + item.price.toFixed(2) + '</h2>' +
                    '</div>' +
                    '<div class="divider-primary"></div>' +
                    '<div class="d-flex justify-content-between gap-0 w-100">' +
                    '<small>' +
                    'Time: ' + minutesToTime(item.timeInMinutes) +
                    '</small>' +
                    '<small class="text-end">' +
                    'Expiry: ' + minutesToTime(item.expirationInMinutes) +
                    '</small>' +
                    '</div>' +
                    '</div>';
                $(div).on('click', function () {
                    onPurchaseClicked(item);
                });
                container.appendChild(div);
            });

        })
        .catch(function (error) {
            $.toast({
                title: 'Failed',
                content: (error && (error.message || error)) || 'Failed to connect to server. Try again later.',
                type: 'error',
                delay: 4000
            });
        });
}

bindEvent(document, 'hidden.bs.modal', function () {
    var buttons = document.querySelectorAll('button[data-loading="true"]');
    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var spinner = btn.querySelector('[data-spinner="true"]');
        if (spinner) removeNode(spinner);
        btn.disabled = false;
        btn.removeAttribute('data-loading');
    }
});

function fetchServerData() {
    var maxRetries = 5;
    var retryDelay = 2000;
    var attempt = 1;
    var storageKey = 'juanfi_extended_data';
    var expiryKey = 'juanfi_extended_data_expiry';
    var appendKey = 'juanfi_extended_data_append';

    return createCompatPromise(function (resolve, reject) {
        if (isTestMode)
            return;

        var cachedData = localStorageCompat.getItem(storageKey);
        var cachedExpiry = localStorageCompat.getItem(expiryKey);
        var now = new Date().getTime();

        var isAppendValid = true;
        if (typeof append !== 'undefined') {
            var cachedAppend = localStorageCompat.getItem(appendKey);
            isAppendValid = (cachedAppend === append);
        }

        if (isAppendValid && cachedData && cachedExpiry && now < parseInt(cachedExpiry)) {
            try {
                var parsedData = JSON.parse(cachedData);
                juanfiExtendedIp = parsedData.ip;
                console.log('JuanFi Extended Version (cached):', parsedData.version);
                resolve(parsedData);
                $("#serverStatus").addClass("hide");
                $("#serverStatus").html(null);
                return;
            } catch (e) {
                console.error('Failed to parse cached data, fetching new data');
            }
        }

        function doFetch() {
            $.ajax({
                url: '/juanfi-extended.json?t=' + new Date().getTime(),
                method: 'GET',
                dataType: 'json',
                success: function (data) {
                    console.log('JuanFi Extended Version:', data.version);
                    try {
                        localStorageCompat.setItem(storageKey, JSON.stringify(data));
                        // 5 minutes expiration
                        localStorageCompat.setItem(expiryKey, (new Date().getTime() + 5 * 60 * 1000).toString());

                        if (typeof append !== 'undefined') {
                            localStorageCompat.setItem(appendKey, append);
                        }

                        if (data) {
                            juanfiExtendedIp = data.ip;
                        }
                    } catch (e) {
                        console.error('Failed to save to localStorage:', e);
                    }
                    resolve(data);
                    $("#serverStatus").addClass("hide");
                    $("#serverStatus").html(null);
                },
                error: function (xhr, status, err) {
                    console.error('Attempt ' + attempt + ' failed:', err);
                    if (attempt < maxRetries) {
                        attempt++;
                        setTimeout(doFetch, retryDelay);
                    } else {
                        $.toast({
                            title: 'Failed',
                            content: 'juanfi-extended.json missing or unreachable after 5 attempts.',
                            type: 'error',
                            delay: 4000
                        });
                        $("#serverStatus").removeClass("hide");
                        $("#serverStatus").html('Missing juanfi-extended.json')
                        resolve(null);
                    }
                }
            });
        }

        doFetch();
    });
}

function fetchPortalConfig(cb) {
    var storageKey = 'juanfi_portal_config';
    var appendKey = 'juanfi_portal_config_append';
    var cachedData = localStorageCompat.getItem(storageKey);
    var shouldUseCache = !!cachedData;

    if (shouldUseCache && typeof append !== 'undefined') {
        var appendValue = (append || "").toString();
        var hasTemplateToken = appendValue.indexOf("$(") !== -1;
        var cachedAppend = localStorageCompat.getItem(appendKey);

        // Use strict append matching only when append is a resolved value.
        // Games page can have unresolved template tokens, which should not force cache misses.
        if (!hasTemplateToken && cachedAppend && cachedAppend !== appendValue) {
            shouldUseCache = false;
        }
    }

    if (shouldUseCache) {
        try {
            var data = JSON.parse(cachedData);
            var output = {};
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    output[key] = data[key];
                }
            }
            cb(output, null);
            return;
        } catch (e) {
            console.error('Failed to parse cached config, fetching new data');
        }
    }

    fetchPortalAPI("/config", "GET", null, null)
        .then(function (result) {
            if ((!result) || (!result.success)) {
                cb(null, (result && result.error) || "Server request failed.");
                return;
            }
            var data = result.data;
            if (!data) {
                cb(null, null);
                return;
            }

            if (typeof append !== 'undefined') {
                try {
                    localStorageCompat.setItem(storageKey, JSON.stringify(data));
                    var appendValue = (append || "").toString();
                    if (appendValue.indexOf("$(") === -1) {
                        localStorageCompat.setItem(appendKey, appendValue);
                    }
                } catch (e) {
                    console.error('Failed to save config to localStorage:', e);
                }
            }

            var output = {};
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    output[key] = data[key];
                }
            }
            cb(output, null);
        })
        .catch(function (error) {
            cb(null, error);
        });
}


function parseRewardPoints(text) {
    try {
        var n = parseFloat((text || "0").toString());
        return isNaN(n) ? 0 : n;
    } catch (e) {
        return 0;
    }
}

function updateRedeemRewardPtsUI(from) {
    // from: 'slider' | 'input' | undefined
    var min = parseInt($('#redeemSlider').attr('min')) || 0;
    var max = parseInt($('#redeemSlider').attr('max')) || 0;
    var sliderVal = parseInt($('#redeemSlider').val()) || 0;
    var inputVal = parseInt($('#selectedPointsInput').val()) || 0;
    var selected = sliderVal;

    if (from === 'input') {
        // clamp input
        if ((!inputVal) || isNaN(inputVal)) inputVal = 0;
        if (inputVal < min) inputVal = min;
        if (max > 0 && inputVal > max) inputVal = max;
        selected = inputVal;
        $('#redeemSlider').val(selected);
        $('#selectedPointsInput').val(selected);
    } else {
        // default behaviour: use slider value and sync input
        selected = sliderVal;
        $('#selectedPointsInput').val(selected);
    }


    var value = (selected * redeemRatioValue);
    $('#estimatedValueDisplay').text('PHP ' + value.toFixed(2));

    // enable/disable confirm button based on range
    if (selected > min && (max === 0 || selected <= max)) {
        $("#confirmRedeemBtn").removeClass("disabled");
    } else {
        $("#confirmRedeemBtn").addClass("disabled");
    }
}

function onRedeemRewardPtsEvt(macNoColon, wheelConfig) {
    var redeemPtsBtn = document.getElementById("redeemPtsBtn");
    if (redeemPtsBtn) {
        redeemPtsBtn.onclick = function (e) {
            e.preventDefault();
            var avail = parseInt(rewardPointsBalance) || 0;
            if (avail <= 0) {
                $.toast({title: 'Info', content: 'No reward points available to redeem.', type: 'error', delay: 3000});
                return;
            }

            var min = parseInt($('#redeemSlider').attr('min')) || 0;
            $(".availablePointsDisplay").html((!!rewardPointsBalance) ? rewardPointsBalance.toFixed(2) : "0.00");
            $('#redeemSlider').attr('max', parseInt(avail));
            $('#redeemSlider').val(min);
            $('#selectedPointsInput').attr('max', avail);
            $('#selectedPointsInput').val(min);
            updateRedeemRewardPtsUI('input');
            $('#redeemModal').modal('show');
        };
    }

    if (!!wheelConfig) {
        var spinRedeemBtn = document.getElementById("spinRedeemBtn");

        if (spinRedeemBtn) {
            spinRedeemBtn.onclick = function (e) {
                e.preventDefault();

                var avail = parseInt(rewardPointsBalance) || 0;

                if (avail <= 0) {
                    $.toast({
                        title: 'Info',
                        content: 'No reward points available to redeem.',
                        type: 'error',
                        delay: 3000
                    });
                    return;
                }

                spinBtn.disabled = false;

                $("#redeemedValueWrapper").addClass("hide");
                $("#selectedReward").text("");

                $(".availablePointsDisplay").html(
                    (!!rewardPointsBalance) ? rewardPointsBalance.toFixed(2) : "0.00"
                );

                $("#spinBtn").text("Spin");

                $('#redeemBySpinModal').modal('show');

                var colors = [
                    "#FFD6E8",
                    "#E0F7FA",
                    "#FFF7C0",
                    "#E8F6E9",
                    "#FDEFEF",
                    "#E8EAF6",
                    "#FBE9E7",
                    "#E6F0FF"
                ];

                drawSpinWheel(macNoColon, wheelConfig, colors);
            };
        }
    }
}

function onRedeemRewardPtsSliderChangeEvt() {
    $('#redeemSlider').on('input change', function () {
        updateRedeemRewardPtsUI('slider');
    });
    $('#selectedPointsInput').on('input change', function () {
        // ensure integer
        var v = $(this).val();
        var intV = parseInt(v, 10);
        if (isNaN(intV)) intV = 0;
        $(this).val(intV);
        updateRedeemRewardPtsUI('input');
    });
}

function onRedeemRewardPtsConfirmBtnEvt(macNoColon) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    var confirmRedeemBtn = document.getElementById("confirmRedeemBtn");
    if (confirmRedeemBtn) {
        confirmRedeemBtn.onclick = function () {
            var selected = parseInt($('#selectedPointsInput').val(), 10) || 0;
            if (selected <= 0) {
                $.toast({
                    title: 'Warning',
                    content: 'Please select at least 1 point to redeem.',
                    type: 'warning',
                    delay: 2500
                });
                return;
            }
            var estimatedPhp = (selected * redeemRatioValue).toFixed(2);

            try {
                addLoader('confirmRedeemBtn');
                $.ajax({
                    type: "POST",
                    url: "http://" + vendorIpAddress + "/redeemPoints?mac=" + macNoColon + "&points=" + selected,
                    success: function (result) {
                        if (!result) {
                            $.toast({
                                title: 'Failed',
                                content: 'Request failed. Please try again.',
                                type: 'error',
                                delay: 4000
                            });
                            removeLoader('confirmRedeemBtn');
                            return;
                        }

                        if (result.status === "false") {
                            $.toast({
                                title: 'Failed',
                                content: 'Failed to redeem points.',
                                type: 'error',
                                delay: 4000
                            });
                            removeLoader('confirmRedeemBtn');
                            return;
                        } else {
                            var timeAdded = parseInt(result.timeAdded);
                            $('#redeemModal').modal('hide');
                            $.toast({
                                title: 'Success',
                                content: 'Redeemed ' + selected + ' points (PHP ' + estimatedPhp + '). Added ' + secondsToDhms(timeAdded * 60) + ' time to current voucher.',
                                type: 'success',
                                delay: 4000
                            });
                            setTimeout(function () {
                                newLogin();
                                removeLoader('confirmRedeemBtn');
                                RefreshPortal();
                            }, 1000);
                        }
                    },
                    error: function (d) {
                        $.toast({
                            title: 'Failed',
                            content: 'Failed to connect to server. Try again later.',
                            type: 'error',
                            delay: 4000
                        });
                        removeLoader('confirmRedeemBtn');
                    },
                    complete: function () {

                    }
                });
            } catch (e) {

                $.toast({
                    title: 'Failed',
                    content: 'Runtime error. Contact vendo owner.',
                    type: 'error',
                    delay: 4000
                });
                removeLoader('confirmRedeemBtn');
            }
        };
    }

}

function showPauseButton() {
    if (!showPauseTime) {
        $("#pauseBtnContainer").addClass("hide");
        $("#resumeBtnContainer").addClass("hide");
        return;
    }
    $("#pauseBtnContainer").removeClass("hide");
    $("#resumeBtnContainer").addClass("hide");
}

function showResumeButton() {
    if (!showPauseTime) {
        $("#pauseBtnContainer").addClass("hide");
        $("#resumeBtnContainer").addClass("hide");
        return;
    }
    $("#resumeBtnContainer").removeClass("hide");
    $("#pauseBtnContainer").addClass("hide");
}

function logoutMember() {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    voucher = resolveVoucherValue(voucher);
    fetchPortalAPI("/logout-member", "POST", vendorIpAddress, {mac: voucher})
        .then(function (result) {
            if ((!result) || (!result.success)) {
                $.toast({
                    title: 'Failed',
                    content: (result && result.error) || 'Request failed. Please try again.',
                    type: 'error',
                    delay: 4000
                });
                removeLoader('confirmLogoutMemberBtn');
                $('#logoutMemberModal').modal('hide');
                return;
            }

            var data = result.data;
            if ((!!data) || (data && data.status === "success")) {
                setTimeout(function () {
                    RefreshPortal();
                }, 1500);
            } else {
                $.toast({
                    title: 'Failed',
                    content: 'Failed to disconnect device.',
                    type: 'error',
                    delay: 4000
                });
                removeLoader('confirmLogoutMemberBtn');
                $('#logoutMemberModal').modal('hide');
            }
        })
        .catch(function (error) {
            $.toast({
                title: 'Failed',
                content: (error && (error.message || error)) || 'Failed to connect to server. Try again later.',
                type: 'error',
                delay: 4000
            });
            removeLoader('confirmLogoutMemberBtn');
            $('#logoutMemberModal').modal('hide');
        });
}

function logoutVoucher(macNoColon, cb) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    fetchPortalAPI("/logout", "POST", vendorIpAddress, {mac: macNoColon})
        .then(function (result) {
            if ((!result) || (!result.success)) {
                $.toast({
                    title: 'Failed',
                    content: (result && result.error) || 'Request failed. Please try again.',
                    type: 'error',
                    delay: 4000
                });
                removeLoader('pauseTimeBtn');
                if (cb) cb(false);
                return;
            }

            var data = result.data;
            if ((!!data) || (data && data.status === "success")) {
                if (cb) cb(true);
            } else {
                $.toast({
                    title: 'Failed',
                    content: 'Failed to disconnect device.',
                    type: 'error',
                    delay: 4000
                });
                if (cb) cb(false);
            }
        })
        .catch(function (error) {
            // $.toast({
            //     title: 'Failed',
            //     content: (error && (error.message || error)) || 'Failed to connect to server. Try again later.',
            //     type: 'error',
            //     delay: 4000
            // });
            removeLoader('pauseTimeBtn');
            if (cb) cb(false);
        });
}

function saveLogs(msg) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    if(voucherCode === "")
        voucherCode = getStorageValue("voucherCode");
    fetchPortalAPI("/logs", "POST", vendorIpAddress, JSON.stringify({code: voucherCode, message: msg}), {
        contentType: 'application/json; charset=utf-8',
        dataType: "json"
    })
        .then(function (result) {

        });
}

function loginVoucher(macNoColon, cb) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    fetchPortalAPI("/login", "POST", vendorIpAddress, {mac: macNoColon})
        .then(function (result) {
            if ((!result) || (!result.success)) {
                $.toast({
                    title: 'Failed',
                    content: (result && result.error) || 'Request failed. Please try again.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
                return;
            }
            var data = result.data;
            if ((!!data) || (data && data.status === "success")) {
                cb(true);
            } else {
                $.toast({
                    title: 'Failed',
                    content: (data && data.message) || 'Failed to connect voucher.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
            }
        })
        .catch(function (error) {
            $.toast({
                title: 'Failed',
                content: (error && (error.message || error)) || 'Failed to connect to server. Try again later.',
                type: 'error',
                delay: 4000
            });
            cb(false);
        });
}


function claimFreeInternetFetch(macNoColon, cb) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    fetchPortalAPI("/claim-free-internet", "POST", vendorIpAddress, {mac: macNoColon})
        .then(function (result) {
            if ((!result) || (!result.success)) {
                $.toast({
                    title: 'Failed',
                    content: (result && result.error) || 'Request failed. Please try again.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
                return;
            }
            var data = result.data;
            if ((!!data) || (data && data.status === "success")) {
                cb(true);
            } else {
                $.toast({
                    title: 'Failed',
                    content: (data && data.message) || 'Failed to claim free internet.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
            }
        })
        .catch(function (error) {
            $.toast({
                title: 'Failed',
                content: (error && (error.message || error)) || 'Failed to connect to server. Try again later.',
                type: 'error',
                delay: 4000
            });
            cb(false);
        });
}

function updateDeviceDateTime() {
    var now = new Date();
    $("#deviceDate").text(now);
}

function checkIsLoggedIn(macNoColon) {
    fetchUserInfo(macNoColon, null, function (userData, error) {
        if (!!error) {
            return;
        }
        var isOnline = userData.isOnline;
        sessiontimeInSecs = userData.timeRemaining;
        if (isOnline) {
            showPauseButton();
        } else {
            showResumeButton();
        }

        setTimeout(function () {
            newLogin();
        }, 1000);
    });
}

function fetchSpinWheelReward(mac, cb) {
    vendorIpAddress = localStorageCompat.getItem("vendorIpAddress");
    if (parseInt(rewardPointsBalance) < 0) {
        $.toast({
            title: 'Failed',
            content: 'Not enough points balance.',
            type: 'error',
            delay: 4000
        });
        removeLoader('spinBtn');
        return;
    }
    fetchPortalAPI("/promo/spin-wheel", "POST", vendorIpAddress, JSON.stringify({mac: mac}), {
        contentType: 'application/json; charset=utf-8',
        dataType: "json"
    })
        .then(function (result) {
            if ((!result) || (!result.success)) {
                cb(null, (result && result.error) || "Server request failed.");
                return;
            }
            var data = result.data;
            if (!data) {
                cb(null, null);
                return;
            }
            cb(data, null);
        })
        .catch(function (error) {
            cb(null, error);
        });
}

function fetchDuckRaceReward(serverIp, mac, betNumber) {
    vendorIpAddress = serverIp;
    if (parseInt(rewardPointsBalance) < 0) {
        $.toast({
            title: 'Failed',
            content: 'Not enough points balance.',
            type: 'error',
            delay: 4000
        });

        removeLoader('duckRaceStartBtn');
        return resolveCompatPromise(null);
    }

    return fetchPortalAPI(
        "/race-duck",
        "POST",
        vendorIpAddress,
        JSON.stringify({mac: mac, betNumber: betNumber}),
        {
            contentType: 'application/json; charset=utf-8',
            dataType: "json"
        }
    )
        .then(function (result) {

            if ((!result) || (!result.success)) {
                $.toast({
                    title: 'Failed',
                    content: (result && result.error) || 'Failed to connect to server. Try again later.',
                    type: 'error',
                    delay: 4000
                });

                removeLoader('duckRaceStartBtn');
                return null;
            }

            var data = result.data;

            if (!data) {
                removeLoader('duckRaceStartBtn');
                return null;
            }

            return {
                winningDuck: data.result,
                wonPoints: data.rewards
            };
        })
        .catch(function (error) {

            $.toast({
                title: 'Failed',
                content: (error && (error.message || error)) || 'Failed to connect to server. Try again later.',
                type: 'error',
                delay: 4000
            });

            removeLoader('duckRaceStartBtn');
            return null;
        });
}

function drawSpinWheel(mac, prizes, colors) {
    /* ===== Elements & state ===== */
    var wheelCanvas = document.getElementById('wheelCanvas');
    var wheelCtx = wheelCanvas.getContext('2d');

    var spinBtn = document.getElementById('spinBtn');
    var spinCancelBtn = document.getElementById('spinCancelBtn');
    spinBtn.textContent = "SPIN";

    var clickSound = new Audio('https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg');

    // Expanded prizes array based on winning percentages (max 10 slices)
    var expandedPrizes = [];

    // Function to generate expanded prizes based on winning percentages
    function generateExpandedPrizes() {
        expandedPrizes = [];
        var maxSlices = 10;

        // Calculate total winning percentage
        var totalPercentage = 0;
        prizes.forEach(function (p) {
            if (p) {
                var winPercent = Math.floor(p.percentage);
                if (winPercent > 0) {
                    totalPercentage += winPercent;
                }
            }
        });

        // If no percentages set, just use original prizes
        if (totalPercentage === 0) {
            expandedPrizes = prizes.slice();
            return;
        }

        var maxPercentage = 100;

        // Distribute prizes proportionally to fill max 10 slices
        prizes.forEach(function (p) {
            if (p && p.percentage > 0) {
                // Calculate how many slices this prize should occupy
                var proportion = p.percentage / maxPercentage;
                var sliceCount = Math.max(1, Math.round(proportion * maxSlices));
                // Add this prize multiple times
                for (var i = 0; i < sliceCount; i++) {
                    expandedPrizes.push(p);
                }
            }
        });

        // Trim to exactly 10 slices if needed (remaining slots become blank)
        if (expandedPrizes.length > maxSlices) {
            expandedPrizes = expandedPrizes.slice(0, maxSlices);
        }

        // Pad remaining slices with undefined (blank)
        while (expandedPrizes.length < maxSlices) {
            expandedPrizes.push({
                "promoName": "Try again!",
                "percentage": null,
                "rewardValue": 0
            });
        }
    }

    var displaySize = 460;
    var wheelSize = 520;
    var dpr = Math.max(window.devicePixelRatio || 1, 1);
    var center = {x: 0, y: 0};
    var radius = 0;
    var currentRotation = 0; // radians
    var spinning = false;
    var lastSliceSound = -1;

    /* ===== Resize (set CSS size + backing store for DPR) ===== */
    function resizeAll() {
        dpr = Math.max(window.devicePixelRatio || 1, 1);
        var shown = Math.min(window.innerWidth * 0.9, wheelSize);
        displaySize = Math.round(shown);

        // wheel canvas (use CSS px coordinates)
        wheelCanvas.style.width = displaySize + 'px';
        wheelCanvas.style.height = displaySize + 'px';
        wheelCanvas.width = displaySize * dpr;
        wheelCanvas.height = displaySize * dpr;
        wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        center.x = displaySize / 2;
        center.y = displaySize / 2;
        radius = (displaySize / 2) - 18;

        // redraw
        drawWheel(currentRotation);
    }

    if (!spinEventsCreated) {
        bindEvent(window, 'resize', resizeAll);
    }
    resizeAll();

    /* ===== draw wheel (rotation in radians) and optional highlighted slice ===== */
    function drawWheel(rotationRad, highlightIndex, highlightAlpha) {
        if (rotationRad === undefined) rotationRad = 0;
        if (highlightIndex === undefined) highlightIndex = null;
        if (highlightAlpha === undefined) highlightAlpha = 0;

        var ctx = wheelCtx;
        ctx.clearRect(0, 0, displaySize, displaySize);

        var displayPrizes = expandedPrizes.length > 0 ? expandedPrizes : prizes;
        var slice = (2 * Math.PI) / displayPrizes.length;

        // draw wheel rotated
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rotationRad);
        ctx.translate(-center.x, -center.y);

        for (var i = 0; i < displayPrizes.length; i++) {
            var start = i * slice;
            ctx.beginPath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.moveTo(center.x, center.y);
            ctx.arc(center.x, center.y, radius, start, start + slice);
            ctx.closePath();
            ctx.fill();

            // label (only if prize is defined)
            if (displayPrizes[i] && displayPrizes[i].promoName) {
                ctx.save();
                ctx.translate(center.x, center.y);
                ctx.rotate(start + slice / 2);
                ctx.fillStyle = "#2b2b2b";
                ctx.font = Math.max(12, displaySize / 24) + "px Arial";
                ctx.textAlign = "right";
                ctx.fillText(displayPrizes[i].promoName, radius - 12, 6);
                ctx.restore();
            }
        }

        // highlight overlay in wheel's rotated coordinate system
        if (highlightIndex !== null && highlightAlpha > 0) {
            var hStart = highlightIndex * slice;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.arc(center.x, center.y, radius, hStart, hStart + slice);
            ctx.closePath();
            ctx.fillStyle = "rgba(255,230,100," + Math.min(1, highlightAlpha) + ")";
            ctx.fill();
        }

        ctx.restore();

        // fixed pointer on top
        drawPointer();
    }

    function drawPointer() {
        var ctx = wheelCtx;
        ctx.save();
        var pointerHalf = Math.max(8, displaySize * 0.03);
        var y = center.y - radius - 4;
        ctx.beginPath();
        ctx.moveTo(center.x - pointerHalf, y);
        ctx.lineTo(center.x + pointerHalf, y);
        ctx.lineTo(center.x, y + Math.max(18, displaySize * 0.06));
        ctx.closePath();
        ctx.fillStyle = "#666";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.restore();
    }

    /* ===== convert rotation -> index (slice under top pointer) ===== */
    function rotationToIndex(rotationRad) {
        var displayPrizes = expandedPrizes.length > 0 ? expandedPrizes : prizes;
        var rotDeg = ((rotationRad * 180 / Math.PI) % 360 + 360) % 360;
        var pointerDeg = (270 - rotDeg + 360) % 360; // top = 270 deg
        var sliceDeg = 360 / displayPrizes.length;
        var idx = Math.floor(pointerDeg / sliceDeg);
        idx = ((idx % displayPrizes.length) + displayPrizes.length) % displayPrizes.length;
        return idx;
    }

    /* ===== spin logic (choose target index via API) ===== */
    function spinWheel() {
        if (spinning) return;

        spinning = true;
        spinBtn.disabled = true;
        if (isSpinTriggered) {
            // fetch prize index from API
            fetchSpinWheelReward(mac, function (result, error) {
                if (!!error) {
                    $.toast({
                        title: 'Failed',
                        content: error || 'Server request failed.',
                        type: 'error',
                        delay: 4000
                    });
                    removeLoader('spinBtn');
                    return;
                }
                var prizeIndex = -1;
                if (result && result.promoName) {
                    for (var i = 0; i < expandedPrizes.length; i++) {
                        if (expandedPrizes[i].promoName === result.promoName) {
                            prizeIndex = i;
                            break;
                        }
                    }
                }
                rewardPointsBalance = !!result ? result.remainingPoints : 0;

                $(".availablePointsDisplay").text((!!rewardPointsBalance) ? rewardPointsBalance.toFixed(2) : "0.00");
                executeSpin(prizeIndex, result, error);
                if (parseInt(rewardPointsBalance) > 0) {
                    spinBtn.disabled = true;
                }

                isSpinTriggered = false;
            });
        }

    }

    /* ===== execute spin animation with chosen index ===== */
    function executeSpin(chosenIndex, apiPrize, error) {
        if (!!error) chosenIndex = -1;
        // compute target rotation so chosenIndex center ends under top pointer
        var sliceDeg = 360 / expandedPrizes.length;
        var desiredPointerDeg = (chosenIndex + 0.5) * sliceDeg;
        var desiredWheelDegNormalized = (270 - desiredPointerDeg + 360) % 360;

        var currentDeg = ((currentRotation * 180 / Math.PI) % 360 + 360) % 360;
        var deltaDeg = (desiredWheelDegNormalized - currentDeg + 360) % 360;

        var extraSpins = 4 + Math.floor(Math.random() * 3); // 4..6
        var totalDeg = deltaDeg + extraSpins * 360;
        var targetRotation = currentRotation + (totalDeg * Math.PI / 180);

        var duration = 4200 + Math.floor(Math.random() * 800);
        var startRot = currentRotation;
        var startTime = null;
        lastSliceSound = -1;

        function step(ts) {
            if (!startTime) startTime = ts;
            var elapsed = ts - startTime;
            var t = Math.min(1, elapsed / duration);
            var ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
            var nowRot = startRot + (targetRotation - startRot) * ease;

            drawWheel(nowRot);

            // click sound when we move across slices
            var idx = rotationToIndex(nowRot);
            if (idx !== lastSliceSound) {
                lastSliceSound = idx;
                //try{ clickSound.currentTime = 0; clickSound.play().catch(function(){}); }catch(e){}
            }

            if (t < 1) {
                requestCompatAnimationFrame(step);
                return;
            }

            // finished spinning
            currentRotation = targetRotation % (2 * Math.PI);
            drawWheel(currentRotation);

            var winningIndex = rotationToIndex(currentRotation);

            // pulse the winning slice then show modal
            pulseHighlight(winningIndex, 3, 700, function () {
                // prefer API-provided prize data if available, otherwise fall back to expanded/local prizes array
                var displayPrizes = expandedPrizes.length > 0 ? expandedPrizes : prizes;
                var prizeToShow = (apiPrize && apiPrize.promoName) ? apiPrize : displayPrizes[winningIndex];
                // Handle undefined or empty prizes
                $("#redeemedValueWrapper").removeClass("hide");
                if ((!prizeToShow) || (!prizeToShow.promoName) || (prizeToShow.rewardValue <= 0)) {
                    $("#selectedReward").text("🥺 Sorry! Better luck next time.");
                } else {
                    var msg = "🎁 Nice! You redeemed " + prizeToShow.promoName;
                    $("#selectedReward").text(msg);
                    $.toast({
                        title: 'Success',
                        content: msg,
                        type: 'success',
                        delay: 5000
                    });
                }
                if (rewardPointsBalance >= redeemRatioValue) {
                    spinBtn.disabled = false;
                }
                spinning = false;
                spinBtn.textContent = "SPIN AGAIN";
                removeLoader('spinBtn');
                if (parseInt(rewardPointsBalance) <= 0) {
                    $('#redeemBySpinModal').modal('hide');
                }

                // Avoid another /user-info call in games: values are already returned by spin API.
                if (isGamesPageContext()) {
                    if (typeof updatePointsDisplays === 'function') {
                        updatePointsDisplays(Number(rewardPointsBalance) || 0);
                    }
                } else if (typeof fetchUserPoints === 'function') {
                    fetchUserPoints();
                }
            });
        }

        requestCompatAnimationFrame(step);

    }

    /* ===== smooth pulse highlight (alpha rises/falls) ===== */
    function pulseHighlight(index, pulses, pulseDuration, callback) {
        if (pulses === undefined) pulses = 3;
        if (pulseDuration === undefined) pulseDuration = 700;
        var total = pulses * pulseDuration;
        var start = getPerformanceTimeCompat();

        function frame(now) {
            var elapsed = now - start;
            if (elapsed >= total) {
                drawWheel(currentRotation, null, 0);
                if (callback) callback();
                return;
            }
            var pulseProgress = (elapsed % pulseDuration) / pulseDuration; // 0..1
            var alpha = Math.sin(pulseProgress * Math.PI); // smooth 0..1..0
            drawWheel(currentRotation, index, alpha * 0.95);
            requestCompatAnimationFrame(frame);
        }

        requestCompatAnimationFrame(frame);
    }

    /* ===== shuffle prizes (randomize displayed positions) ===== */
    function shufflePrizes() {
        // Fisher-Yates shuffle algorithm
        var target = (expandedPrizes && expandedPrizes.length > 0) ? expandedPrizes : prizes;
        for (var i = target.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = target[i];
            target[i] = target[j];
            target[j] = temp;
        }
    }

    if (!spinEventsCreated) {
        /* ===== events & init ===== */
        bindEvent(window, 'resize', function () {
            resizeAll();
        });
        if (spinBtn) {
            spinBtn.onclick = function () {
                var avail = parseInt(rewardPointsBalance) || 0;
                if (avail <= 0) {
                    $.toast({
                        title: 'Info',
                        content: 'No reward points available to redeem.',
                        type: 'error',
                        delay: 3000
                    });
                    $('#redeemBySpinModal').modal('hide');
                    return;
                }
                addLoader('spinBtn');
                isSpinTriggered = true;
                shufflePrizes();
                spinWheel();
            };
        }
        if (spinCancelBtn) {
            spinCancelBtn.onclick = function (e) {
                if (isGamesPageContext()) {
                    return;
                }
                newLogin();
            };
        }

    }

    generateExpandedPrizes(); // generate expanded prizes based on winning percentages
    shufflePrizes(); // shuffle slices on initial load
    drawWheel(currentRotation);

    /* Provide a sane resizeAll in case called above */
    function resizeAll() {
        resizeAll = null; // prevent recursion
        resizeAll = function () {
            resizeAll = function () {
            };
        }; // dummy replacement
        // Call the real function body:
        dpr = Math.max(window.devicePixelRatio || 1, 1);
        var shown = Math.min(window.innerWidth * 0.9, wheelSize);
        displaySize = Math.round(shown);
        wheelCanvas.style.width = displaySize + 'px';
        wheelCanvas.style.height = displaySize + 'px';
        wheelCanvas.width = displaySize * dpr;
        wheelCanvas.height = displaySize * dpr;
        wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        center.x = displaySize / 2;
        center.y = displaySize / 2;
        radius = (displaySize / 2) - 18;
        drawWheel(currentRotation);
    }

    /* replace placeholder with proper function */
    resizeAll = function () {
        dpr = Math.max(window.devicePixelRatio || 1, 1);
        var shown = Math.min(window.innerWidth * 0.9, wheelSize);
        displaySize = Math.round(shown);
        wheelCanvas.style.width = displaySize + 'px';
        wheelCanvas.style.height = displaySize + 'px';
        wheelCanvas.width = displaySize * dpr;
        wheelCanvas.height = displaySize * dpr;
        wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        center.x = displaySize / 2;
        center.y = displaySize / 2;
        radius = (displaySize / 2) - 18;
        drawWheel(currentRotation);
    };

    if (!spinEventsCreated) {
        bindEvent(window, 'resize', resizeAll);
    }

    // ensure initial sizes are correct:
    resizeAll();
    spinEventsCreated = true;
}

function useVoucherBtnEvt() {
    var connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.onclick = function (e) {
            e.preventDefault();
            var input = document.getElementById('voucherInput');
            // Clear previous custom validity
            setInputCustomValidityCompat(input, '');

            // Trim the value to catch empty or whitespace-only input
            if (!input.value || input.value.trim() === '') {
                reportInputValidityCompat(input, 'Please input a valid voucher');
                return;
            }

            // Optional: check HTML5 constraints
            if (!checkInputValidityCompat(input)) {
                reportInputValidityCompat(input, 'Please input a valid voucher');
                return;
            }

            // Check other variables
            if (!macNoColon || macNoColon.trim() === '') {
                reportInputValidityCompat(input, 'Please input a valid voucher');
                return;
            }

            if (!vendorIpAddress || vendorIpAddress.trim() === '') {
                reportInputValidityCompat(input, 'Please input a valid voucher');
                return;
            }

            addLoader('connectBtn')

            voucherCode = $("#voucherInput").val();
            if (!voucherCode) {
                $.toast({title: 'Failed', content: 'Voucher code is required.', type: 'error', delay: 3000});
                removeLoader('connectBtn')
                return;
            }

            fetchUseVoucher(macNoColon, vendorIpAddress, voucherCode, function (success, error) {
                if (success) {
                    $.toast({
                        title: 'Success',
                        content: "Voucher successfully consumed.",
                        type: 'success',
                        delay: 3000
                    });
                    setTimeout(function () {
                        newLogin();
                    },1000)
                    removeLoader('connectBtn')
                } else {
                    removeLoader('connectBtn')
                    $.toast({title: 'Failed', content: error || "Server request failed.", type: 'error', delay: 3000});

                    return;
                }
            });
        }
    }

}

function fetchUseVoucher(macNoColon, vendorIpAddress, voucherCode, cb) {
    fetchPortalAPI("/use-voucher", "POST", vendorIpAddress, {mac: macNoColon, code: voucherCode})
        .then(function (result) {
            if ((!result) || (!result.success)) {
                cb(null, (result && result.error) || "Server request failed.");
                return;
            }
            var data = result.data;
            if ((!!data) || (data && data.status === "success")) {
                cb(true, null);
            } else {
                cb(false, (data && data.message) || "Failed to use voucher.");
            }
        })
        .catch(function (error) {
            cb(null, error);
        });
}

function parseAjaxErrorResponse(jqXHR, textStatus, errorThrown) {
    // Check if responseText exists and is a string
    if (jqXHR.responseText && typeof jqXHR.responseText === 'string') {
        try {
            // Parse the responseText as JSON
            var errorData = JSON.parse(jqXHR.responseText);
            return errorData;
        } catch (e) {
            return jqXHR.responseText;
        }
    } else {
        return "Error received from server.";
    }
}

function fetchPortalAPI(apiUrl, type, vendorIpAddress, params, options) {
    return createCompatPromise(function (resolve, reject) {
        var MAX_RETRIES = 3;
        var RETRY_DELAY = 1000; // 1 second

        var attemptCount = 0;

        var attemptRequest = function () {
            try {
                var timestamp = new Date().getTime();
                var separator = apiUrl.indexOf("?") !== -1 ? "&" : "?";
                var finalUrl = juanfiExtendedServerUrl + apiUrl + separator + "t=" + timestamp;

                var headers = vendorIpAddress
                    ? {'X-IP': vendorIpAddress}
                    : undefined;

                var ajaxOptions = {
                    type: type,
                    url: finalUrl,
                    headers: headers,
                    data: params,
                    success: function (data) {
                        if (!data) {
                            resolve({
                                success: false,
                                error: "Failed to fetch."
                            });
                        } else {
                            resolve({
                                success: true,
                                data: data
                            });
                        }
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        var isNetworkError =
                            jqXHR.status === 0 ||
                            textStatus === "timeout" ||
                            (jqXHR.status >= 500 && jqXHR.status < 600);

                        if (isNetworkError && attemptCount < MAX_RETRIES) {
                            attemptCount++;

                            console.warn(
                                "fetchPortalAPI network retry " + attemptCount + "/" + MAX_RETRIES + " in 1s"
                            );

                            setTimeout(attemptRequest, RETRY_DELAY);
                            return;
                        }

                        var err = parseAjaxErrorResponse(jqXHR, textStatus, errorThrown);
                        reject((err && err.message) || "Server request failed!");
                    }
                };

                if (options) {
                    for (var opt in options) {
                        if (options.hasOwnProperty(opt)) {
                            ajaxOptions[opt] = options[opt];
                        }
                    }
                }

                $.ajax(ajaxOptions);
            } catch (e) {
                reject("Runtime error!");
            }
        };

        // First attempt
        attemptRequest();
    });
}

function showPointsRedeemBtns(totalPoints, pointsEnabled, wheelConfig) {
    $("#rewardBtnWrapper").addClass("hide");
    if (pointsEnabled) {
        $("#redeemWrapper").removeClass("hide");
        if ((!!wheelConfig) && wheelConfig.length > 0) {
            $("#spinWrapper").removeClass("hide");
            $("#spinWheelCard").removeClass("hide");
            $("#spinWrapper").removeClass("col-sm-12");
            $("#spinWrapper").addClass("col-sm-6");
            $("#redeemWrapper").removeClass("col-sm-12");
            $("#redeemWrapper").addClass("col-sm-6");
        } else {
            $("#spinWrapper").addClass("hide");
            $("#spinWheelCard").addClass("hide");
            $("#spinWrapper").removeClass("col-sm-6");
            $("#spinWrapper").addClass("col-sm-12");
            $("#redeemWrapper").removeClass("col-sm-6");
            $("#redeemWrapper").addClass("col-sm-12");
        }
        if (totalPoints > 0) {
            $("#rewardBtnWrapper").removeClass("hide");
        }
    } else {
        $("#redeemWrapper").addClass("hide");
        $("#spinWrapper").addClass("hide");
        $("#spinWheelCard").addClass("hide");
        $("#rewardBtnWrapper").addClass("hide");
    }

    if (pointsEnabled) {
        onRedeemRewardPtsEvt(macNoColon, wheelConfig);
        onRedeemRewardPtsConfirmBtnEvt(macNoColon);
        onRedeemRewardPtsSliderChangeEvt();
    }
}

var lastButtonId = null;

function addLoader(buttonId) {
    if (lastButtonId && lastButtonId !== buttonId) {
        removeLoader(lastButtonId);
    }

    var btn = document.getElementById(buttonId);
    if (!btn) return;

    if (btn.getAttribute('data-loading') === "true") return;

    var spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm me-2'; // small spinner with margin
    spinner.role = 'status';
    spinner.ariaHidden = true;
    spinner.setAttribute('data-spinner', "true"); // mark it for removal later

    prependNode(btn, spinner);

    btn.disabled = true;
    btn.setAttribute('data-loading', "true");

    lastButtonId = buttonId;
}

function removeLoader(buttonId) {
    var btn = document.getElementById(buttonId);
    if (!btn || btn.getAttribute('data-loading') !== "true") return;

    var spinner = btn.querySelector('span[data-spinner="true"]');
    if (spinner) btn.removeChild(spinner);

    btn.disabled = false;
    btn.setAttribute('data-loading', "false");

    if (lastButtonId === buttonId) lastButtonId = null;
}

function createToastContainer() {
    var container = document.getElementById('toastContainer');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'position-fixed top-0 end-0 p-3';
    container.style.zIndex = '99999';
    container.style.pointerEvents = 'none';

    document.body.appendChild(container);
    return container;
}

$.toast = function (options) {
    var title = options.title || '';
    var content = options.content || '';
    var type = options.type || 'info';
    var delay = options.delay || 5000;

    var container = createToastContainer();

    var bgClass = 'bg-info text-white';
    if (type === 'error') bgClass = 'bg-danger text-white';
    else if (type === 'success') bgClass = 'bg-success text-white';
    else if (type === 'warning') bgClass = 'bg-warning text-dark';

    var toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center ' + bgClass + ' border-0 mb-2';
    toastEl.style.pointerEvents = 'auto';
    toastEl.role = 'alert';
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    var titleHtml = title ? '<strong>' + title + '</strong><br>' : '';
    toastEl.innerHTML =
        '<div class="d-flex mt-1">' +
        '<div class="toast-body">' +
        titleHtml +
        content +
        '</div>' +
        '<button type="button" class="btn-close ' + (type === 'warning' ? '' : 'btn-close-white') + ' me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
        '</div>';

    container.appendChild(toastEl);

    var toast = new bootstrap.Toast(toastEl, {delay: delay, autohide: true});
    toast.show();

    bindEvent(toastEl, 'hidden.bs.toast', function () {
        removeNode(toastEl);
    });
};

createToastContainer();

function getWholeNumber(num) {
    return num < 0 ? Math.ceil(num) : Math.floor(num);
}
