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
var insertcoinbg = new Audio('assets/insertcoinbg.mp3?v=' + appendUrl);
var coinCount = new Audio('assets/coin-received.mp3?v=' + appendUrl);
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
try {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    window.history.replaceState({}, document.title, url.toString());
} catch (e) {
    console.error(e);
}

function initValues() {
    //DO NOT UPDATE - START
    macNoColon = replaceAll(mac, ":");
    totalCoinReceived = 0;
    insertcoinbg.loop = true;
    voucher = getStorageValue('activeVoucher');
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
    fetchServerData().then(server => {
        juanfiExtendedServerUrl = `http://${server.ip}:8080/api/portal`;
        $('#displayVersion').html(`v${server.version}`);
        if (!initLoad) {
            initValues();
            renderView();
            useVoucherBtnEvt();
        }
    });
});

function newLogin() {
    initValues();
    renderView();
}

function renderView() {
    $("#voucherInput").val("");
    $('.modal').modal('hide');
    $("#ipInfo").html(uIp);
    $("#macInfo").html(mac);
    wheelConfig = [];
    multiVendoAddresses = [];
    populatePromoRates(0);
    fetchPortalConfig(function (data, error) {
        if (!!error) {

            $.toast({
                title: 'Failed',
                content: error ?? 'Server request failed. Try again later. Data shown are locally stored dummy/test values only.',
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
        if (!data.showInsertCoin) {
            $("#insertBtn").addClass("hide");
        } else {
            $("#insertBtn").removeClass("hide");
        }
        if (!data.showPauseTime) {
            $("#pauseBtnContainer").addClass("hide");
        }

        if (qrCodeVoucherPurchase) {
            $("#scanQrBtn").attr("style", "display: block");
        }
        if (disableVoucherInput) {
            $("#useVoucherContainer").addClass("hide");
        }
        if (!data.showPortalHistory) {
            $("#historyContainer").addClass("hide");
            $("#historyTab").addClass("hide");
            $("#history").addClass("hide");
        }

        if (!data.showPortalHeader) {
            $("#headerContainer").addClass("hide");
        }else{
            $("#headerContainer").removeClass("hide");
        }

        if (data.hideRates) {
            $("#rateTable").addClass("hide");
        }else{
            $("#rateTable").removeClass("hide");
        }

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

        voucher = macNoColon;

        var ignoreSaveCode = getStorageValue("ignoreSaveCode");
        if (ignoreSaveCode == null || ignoreSaveCode == "0") {
            ignoreSaveCode = "0";
        }
        fetchUserInfo(macNoColon, pointsEnabled, function (userData, error) {
            if (!!error) {

                $.toast({
                    title: 'Failed',
                    content: error ?? 'Server request failed. Try again later.',
                    type: 'error',
                    delay: 4000
                });
                return;
            }

            let isOnline = false, pointsEnabled = false;
            let isMember = false;
            let voucherCode = macNoColon, timeRemainingStr;
            let totalPoints = 0, timeRemaining, timeExpiry;
            if (!!userData) {
                isOnline = userData?.isOnline;
                voucherCode = userData?.voucherCode;
                pointsEnabled = userData?.pointsEnabled;
                isMember = userData?.isMember;
                totalPoints = Number(userData?.totalPoints) || 0;
                timeRemaining = userData?.timeRemaining;
                timeRemainingStr = userData?.timeRemainingStr;
                timeExpiry = userData?.timeExpiry;
            }
            if (isMultiVendo) {
                if (multiVendoOption == 1) {
                    $("#vendoSelectDiv").addClass("hide");
                    var currentHotspot = hotspotAddress.split(":")[0];
                    var dtls = multiVendoAddresses.find(x => x.hotspotAddress === currentHotspot);
                    if (!!dtls) {
                        selectedVendoDtls = dtls;
                        vendorIpAddress = dtls.vendoIp;
                    }
                    multiVendoConfiguration(dtls, userData);
                } else if (multiVendoOption == 2) {
                    $("#vendoSelectDiv").addClass("hide");
                    var dtls = multiVendoAddresses.find(x => x.interfaceName === interfaceName);
                    if (!!dtls) {
                        selectedVendoDtls = dtls;
                        vendorIpAddress = dtls.vendoIp;
                    }
                    multiVendoConfiguration(dtls, userData);
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
                    }

                    $("#vendoSelected").val(vendorIpAddress);
                    var vendoSelectOption = document.getElementById("vendoSelected");
                    vendoSelectOption.onchange = function () {
                        vendorIpAddress = $("#vendoSelected").val();
                        setStorageValue('selectedVendo', vendorIpAddress);
                        let dtls = multiVendoAddresses.find(x => x.vendoIp === vendorIpAddress);

                        if (!!dtls) {
                            selectedVendoDtls = dtls;
                            wheelConfig = selectedVendoDtls.wheelConfig;
                            pointsEnabled = selectedVendoDtls.pointsPercentage > 0;
                            showPointsRedeemBtns(totalPoints, pointsEnabled, wheelConfig);
                        }

                        multiVendoConfiguration(dtls, userData);

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
            var time = timeRemaining;
            $("#remainTime").html(secondsToDhms(time));
            if (remainingTimer != null) {
                clearInterval(remainingTimer);
                remainingTimer = null;
            }

            if (!showExtendTimeButton && time > 0) {
                $("#insertBtn").addClass("hide");
            }
            if (time > 0) {
                $("#insertBtn").html("EXTEND TIME");
            }

            if (isOnline) {
                $("#connectionStatus").html("Connected");
                $("#connectionStatus").attr("class", "blinking2");
                $("#statusImg").attr("src", "assets/img/wifi.png");
                $("#statusImg").removeClass("hide");
                $("#statusImg").addClass("blinking2");
                $("#remainingTimeWrapper").removeClass("hide");

                remainingTimer = setInterval(function () {
                    time--;
                    $("#remainTime").html(secondsToDhms(time))
                    showPauseButton();
                    if (time <= 0 && !isMember) {
                        clearInterval(remainingTimer);
                        setTimeout(function () {
                            renderView();
                        }, 1000);
                    }
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

                $("#connectionStatus").html("Disconnected");
                $("#connectionStatus").attr("class", "blinking1");
                $("#statusImg").attr("src", "assets/img/off_wifi.png");
                $("#statusImg").removeClass("hide");
                $("#statusImg").addClass("blinking1");
                showResumeButton();
            }

            if (!!timeExpiry) {
                let expirationTime = new Date(timeExpiry);
                $("#expirationTime").html(expirationTime.toLocaleString());
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
            if(hasWiFree){
                $("#wifreeBtn").removeClass("hide");
            }else{
                $("#wifreeBtn").addClass("hide");
            }

            // Initial call to display immediately
            updateDeviceDateTime();

            // Update every second (1000 milliseconds)
            setInterval(updateDeviceDateTime, 1000);
            if (!initLoad) {
                if(!isMultiVendo){
                    populatePromoRates(3);
                }
                $('#loaderDiv').addClass("hide");
                var containerDiv = $('#containerDiv');
                containerDiv.removeClass("hide");
                containerDiv.show();
            }

            if(isMember){
                $("#insertBtn").addClass("hide");
                $("#vendoSelectDiv").addClass("hide");
                $("#historyTab").addClass("hide");
                $("#rewardDtlsBtn").addClass("hide");
                $("#resumeTimeBtn").addClass("hide");
                $("#pauseTimeBtn").addClass("hide");
                $("#pauseBtnContainer").addClass("hide");
                $("#rateTable").addClass("hide");
                $("#chargingBtn").addClass("hide");
                $("#eloadBtn").addClass("hide");
                $("#useVoucherContainer").addClass("hide");
                $("#wifreeBtn").addClass("hide");
                $("#remainingTimeWrapper").removeClass("hide");
            }

            if (isOnline && isMember) {
                $("#connectionStatus").html("MEMBER CONNECTED");
                $("#connectionStatus").attr("class", "blinking2");
            }
            initLoad = true;

            if(isOnline) {
                checkInternet();
            }
        });
    });
}

function multiVendoConfiguration(vendo, user){
    console.log(vendo);
    console.log(user);
    if (!vendo.showExtendTimeButton && user.timeRemaining > 0) {
        $("#insertBtn").addClass("hide");
    }else{
        $("#insertBtn").removeClass("hide");
    }
    if(user.timeRemaining <= 0){
        showResumeButton();
    }else{
        if (vendo.showPauseTime && isPaused) {
            showPauseButton();
        } else {
            showResumeButton();
        }
    }
    if (vendo.hideRates) {
        $("#rateTable").addClass("hide");
    }else{
        $("#rateTable").removeClass("hide");
    }
    if (!vendo.showMemberLogin) {
        $("#memberBtn").addClass("hide");
    }else{
        $("#memberBtn").removeClass("hide");
    }
    if (!vendo.showInsertCoin) {
        $("#insertBtn").addClass("hide");
    } else {
        $("#insertBtn").removeClass("hide");
    }
    if (!vendo.showPauseTime) {
        $("#pauseBtnContainer").addClass("hide");
    }else{
        $("#pauseBtnContainer").removeClass("hide");
    }

    if (!vendo.showPortalInputVoucher) {
        $("#useVoucherContainer").addClass("hide");
    }else{
        $("#useVoucherContainer").removeClass("hide");
    }
    if (!vendo.showPortalHistory) {
        $("#historyContainer").addClass("hide");
        $("#historyTab").addClass("hide");
        $("#history").addClass("hide");
    }else{
        $("#historyContainer").removeClass("hide");
        $("#historyTab").removeClass("hide");
        $("#history").removeClass("hide");
    }
    if (!vendo.showPortalHeader) {
        $("#headerContainer").addClass("hide");
    }else{
        $("#headerContainer").removeClass("hide");
    }
    if (!vendo.wheelConfig) {
        $("#spinRedeemBtn").addClass("hide");
    }else{
        $("#spinRedeemBtn").removeClass("hide");
    }
    if(initLoad){
        populatePromoRates(0);
    }
}

$('#insertCoinModal').on('hidden.bs.modal', function () {
    clearInterval(timer);
    timer = null;
    insertingCoin = false;
    insertcoinbg.pause();
    insertcoinbg.currentTime = 0.0;
    if (totalCoinReceived == 0) {
        $.ajax({
            type: "POST",
            url: "http://" + vendorIpAddress + "/cancelTopUp",
            data: "voucher=" + voucher + "&mac=" + mac,
            success: function (data) {

            }, error: function (jqXHR, exception) {

            }
        });
    }
});

$('#eloadModal').on('hidden.bs.modal', function () {
    insertingCoin = false;
});

$('#wifreeModal').on('show.bs.modal', function (e) {
    renderWifreeList();
});

$('#redeemBySpinModal').on('hidden.bs.modal', function () {
    renderView();
});
$("#pauseTimeBtn").addClass("hide");
$("#resumeTimeBtn").addClass("hide");
const pauseTimeBtn = document.getElementById('pauseTimeBtn');
pauseTimeBtn.onclick = function () {
    pause(macNoColon);
}

const memberLoginExecuteBtn = document.getElementById('memberLoginExecuteBtn');
memberLoginExecuteBtn.onclick = function () {
    let username = $("#inputMemberUsername").val().trim();
    let password = $("#inputMemberPassword").val().trim();
    let isValid = true;
    let message = "";

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

    fetchPortalAPI(`/member-login`, "POST", vendorIpAddress, {
        mac: mac,
        old_mac: old_mac,
        username: username,
        password: password
    })
        .then(result => {
            if ((!result) || (!result?.success)) {
                message = "Username or password is incorrect."
                $("#errorMsg").text(message).removeClass("d-none");
                cb(false);
                removeLoader('pauseTimeBtn')
                return;
            }

            let data = result?.data;
            if ((!!data) || (data?.status === "success")) {
                $.toast({
                    title: 'Success',
                    content: data.message,
                    type: 'success',
                    delay: 3000
                });
                $('#memberModal').modal('hide');
                newLogin();
            } else {
                message = "Username or password is incorrect."
                $("#errorMsg").text(message).removeClass("d-none");
            }
        })
        .catch(error => {
            message = JSON.stringify(error);
            $("#errorMsg").text(message).removeClass("d-none");

            removeLoader('memberLoginExecuteBtn')
            // cb(false);
        });
}


const resumeTimeBtn = document.getElementById('resumeTimeBtn');
resumeTimeBtn.onclick = function () {
    addLoader('resumeTimeBtn')
    setStorageValue("isPaused", "0");
    loginVoucher(macNoColon, function (success) {
        if (success) {
            checkIsLoggedIn(macNoColon);
        } else {
            removeLoader('resumeTimeBtn')
        }
    });
};

function replaceAll(str, rep) {
    var aa = str;
    while (aa.indexOf(rep) > 0) {
        aa = aa.replace(rep, "");
    }
    return aa;
}

if (voucher == null) {
    voucher = "";
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

function insertBtnAction() {
    removeStorageValue("ignoreSaveCode");
    setStorageValue('insertCoinRefreshed', "0");
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

    callTopupAPI(0);

    return false;
}

$('#promoRatesModal').on('shown.bs.modal', function (e) {
    populatePromoRates(0);
})

function parseDuration(minutes) {
    const mins = parseInt(minutes, 10);

    if (mins < 60) {
        return `${mins.toFixed(2)}m`;
    }

    if (mins < 1440) {
        return `${(mins / 60).toFixed(2)}h`;
    }

    return `${(mins / 1440).toFixed(2)}d`;
}

function populatePromoRates(retryCount) {
    const tableBody = document.querySelector("#rateTable tbody");
    tableBody.innerHTML = "";
    $.ajax({
        type: "GET",
        url: "http://" + vendorIpAddress + "/getRates?rateType=" + rateType + "&date=" + (new Date().getTime()),
        crossOrigin: true,
        contentType: 'text/plain',
        success: function (data) {
            const rows = data.split("|").filter(r => r.trim() !== "");

            rows.forEach(row => {

                const parts = row.split("#").filter(v => v !== "");

                const plan = parts[0];
                const price = parts[1];

                const duration = minutesToTime(parts[2]);
                const expiry = minutesToTime(parts[3]);

                const tr = document.createElement("tr");

                [plan, price, duration, expiry].forEach(value => {
                    const td = document.createElement("td");
                    td.textContent = value.trim();
                    tr.appendChild(td);
                });

                tableBody.appendChild(tr);
            });
            // var rows = data.split("|");
            // var rates = "";
            // for (r in rows) {
            // 	var columns = rows[r].split("#");
            // 	rates = rates + "<div class='rholder'>";
            // 	rates = rates + "<div class='rdata'><span>Rate: </span>";
            // 	rates = rates + columns[0];
            // 	rates = rates + "</div>";
            // 	rates = rates + "<div class='rdata'><span style='color: #a3a7ad'>Validity: ";
            // 	rates = rates + secondsToDhms(parseInt(columns[3]) * 60);
            // 	rates = rates + "</span></div>";
            // 	if (dataRateOption) {
            // 		rates = rates + "<div class='rdata'><span style='color: #a3a7ad'>Data: ";
            // 		if (columns[4] != "") {
            // 			rates = rates + columns[4];
            // 			rates = rates + " MB";
            // 		} else {
            // 			rates = rates + "unlimited";
            // 		}
            // 		rates = rates + "</span></div>";
            // 	}
            // 	rates = rates + "</div>";
            // }
            // $("#ratesBody").html(rates);
        }, error: function (jqXHR, exception) {
            setTimeout(function () {
                if (retryCount < 2) {
                    populatePromoRates(retryCount + 1);
                }
            }, 1000);
        }
    });
}

$('#chargingModal').on('shown.bs.modal', function (e) {
    populateChargingStations(0);
})

function minutesToTime(totalMinutes) {
    totalMinutes = parseInt(totalMinutes);

    if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
        return "Invalid value";
    }

    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    const parts = [];

    if (days > 0) parts.push(`${days}day${days > 1 ? "s" : ""}`);
    if (hours > 0) parts.push(`${hours}hr${hours > 1 ? "s" : ""}`);
    if (minutes > 0 || parts.length === 0)
        parts.push(`${minutes}min${minutes > 1 ? "s" : ""}`);

    return parts.join(" ");
}

function populateChargingStations(retryCount) {
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
    topupMode = TOPUP_CHARGER;
    $.ajax({
        type: "POST",
        url: "http://" + vendorIpAddress + "/topUp",
        data: "voucher=" + portName + "&topupType=CHARGER&chargerPort=" + port + "&mac=" + mac,
        success: function (data) {

            if (data.status == "true") {
                voucher = data.voucher;
                $('#insertCoinModal').modal('show');
                insertingCoin = true;
                $('#codeGeneratedBlock').attr('style', 'display: none');
                if (timer == null) {
                    timer = setInterval(checkCoin, 1000);
                }
                if (isMultiVendo) {
                    $("#insertCoinModalTitle").html("Please insert the coin on " + $("#vendoSelected option:selected").text());
                }
                insertcoinbg.play();
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

    $.ajax({
        type: "POST",
        url: "http://" + vendorIpAddress + "/topUp",
        data: "voucher=" + voucher + "&mac=" + mac + ipAddCriteria + extendTimeCriteria,
        success: function (data) {
            if (data.status == "true") {
                voucher = data.voucher;
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
                insertcoinbg.play();
            } else {
                notifyCoinSlotError(data.errorCode);
                clearInterval(timer);
                timer = null;
                removeLoader('insertBtn')
            }
        }, error: function (jqXHR, exception) {
            setTimeout(function () {
                if (retryCount < 3) {
                    callTopupAPI(retryCount + 1);
                } else {
                    removeLoader('insertBtn')
                    notifyCoinSlotError("coin.slot.notavailable");
                }
            }, 1000);
        }
    });
}

function saveVoucherBtnAction() {
    addLoader('saveVoucherButton')

    if (topupMode == TOPUP_INTERNET) {
        setStorageValue('activeVoucher', voucher);
        removeStorageValue("totalCoinReceived");
        $('#voucherInput').val(voucher);
    }

    clearInterval(timer);
    timer = null;
    insertcoinbg.pause();
    insertcoinbg.currentTime = 0.0;
    $.ajax({
        type: "POST",
        url: "http://" + vendorIpAddress + "/useVoucher",
        data: "voucher=" + voucher,
        success: function (data) {

            totalCoinReceived = 0;
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

                    setTimeout(function () {
                        newLogin();
                        removeLoader('insertBtn')
                        removeLoader('saveVoucherButton')
                    }, 1000);
                }
                // if (parseInt(rewardPointsBalance) < 0) {
                // 	document.getElementById('spinRedeemBtn').disabled = true;
                // 	document.getElementById('redeemPtsBtn').disabled = true;
                // }
                setTimeout(checkInternet, 3000)
            } else {
                notifyCoinSlotError(data.errorCode);
            }


        }, error: function (jqXHR, exception) {

            if (totalCoinReceived > 0) {
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
                        insertcoinbg.pause();
                        insertcoinbg.currentTime = 0.0;
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
                    insertcoinbg.pause();
                    insertcoinbg.currentTime = 0.0;
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


function notifyCoinSlotError(errorCode, delay = 5000) {
    const toastEl = document.getElementById('errorToast');
    toastEl.querySelector('.toast-body').textContent = errorCodeMap[errorCode];

    const toast = new bootstrap.Toast(toastEl, {delay});
    toast.show();
}

function notifyCoinSuccess(coin, delay = 5000) {
    const toastEl = document.getElementById('successToast');
    toastEl.querySelector('.toast-body').textContent = coin + ' peso(s) was inserted';

    const toast = new bootstrap.Toast(toastEl, {delay});
    toast.show();
    coinCount.play();
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
    localStorage.clear();
}

function pause(macNoColon) {
    addLoader('pauseTimeBtn')
    setStorageValue("isPaused", "1");
    logoutVoucher(macNoColon, function () {
        removeLoader('pauseTimeBtn')
    });
}

function resume() {
    removeStorageValue("isPaused");
    removeStorageValue("activeVoucher");
    removeStorageValue("ignoreSaveCode");
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

            let totalSeconds = (hr * 3600) + (min * 60) + sec;

            return totalSeconds;
        }
        return null;
    } catch (e) {
        return null;
    }
}
function checkInternet(){
    window.location.href = "http://clients3.google.com/generate_204";
}
function fetchUserInfo(macNoColon, pointsEnabled, cb) {
    var params = `mac=${macNoColon}&interfaceName=${interfaceName}`
    var old_mac = getStorageValue('activeVoucher')
    if (old_mac && old_mac !== "") {
        params += `&old_mac=${old_mac}`

        var pausedState = getStorageValue("isPaused")
        if (pausedState === "1") {
            params += `&isPaused=true`;
        } else {
            params += `&isPaused=false`;
        }
    }
    fetchPortalAPI(`/user-info?${params}`, "GET", vendorIpAddress, null)
        .then(result => {
            if ((!result) || (!result?.success)) {
                cb(null, result?.error ?? "Server request failed.");
                return;
            }
            let data = result?.data;
            if (!data) {
                cb(null, null);
                return;
            }

            var isOnline = data.isOnline;
            var isMember = data.isMember;
            var voucherCode = data.code;
            var totalPoints = data.totalPoints;
            var timeRemainingStr = data.timeRemaining;
            var timeRemaining = data.timeRemainingInSeconds;
            var timeExpiry = data.timeExpiry;
            $("#voucherCode").html(voucherCode);

            if (data.hasFreeInternet) {
                $("#freeInternetContainer").removeClass("hide");
                document.getElementById('claimFreeInternetBtn').onclick = function () {
                    $('#claimFreeInternetModal').modal('show');
                    claimFreeInternet(voucherCode);
                }
                document.getElementById('confirmClaimFreeInternetBtn').onclick = function () {
                    addLoader('confirmClaimFreeInternetBtn')
                    claimFreeInternetFetch(macNoColon, function (success) {
                        if (success) {
                            newLogin();
                            $("#freeInternetContainer").addClass("hide");
                            $.toast({
                                title: 'Success',
                                content: 'Free internet claimed successfully!',
                                type: 'success',
                                delay: 4000
                            });
                        }
                        removeLoader('confirmClaimFreeInternetBtn')
                    });
                }

                $('#claimFreeInternetModal').modal('show');
                $('#freeMinutesLabel').html("You are eligible to claim " + parseInt(data.freeMinutes) + " minutes of internet access");
            }

            renderHistories(data);
            cb({
                isOnline,
                isMember,
                voucherCode,
                pointsEnabled,
                totalPoints,
                timeRemaining,
                timeExpiry,
                timeRemainingStr
            }, null);
        })
        .catch(error => {
            cb(null, error);
        });
}

function renderHistories(data, containerId = "historyContainer") {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";
    container.style = "overflow-y:scroll;max-height:60dvh;";
    container.className = "px-0 d-flex flex-column gap-2 pb-5";

    if (!data || !Array.isArray(data.histories) || data.histories.length === 0) {
        container.innerHTML = "<div>No history available</div>";
        return;
    }

    data.histories.forEach(item => {
        const div = document.createElement("div");
        div.className = "voucher-card";

        const date = new Date(item.date).toLocaleString();

        const amount = item.coin ? item.coin.toFixed(2) : "0.00";
        div.innerHTML = `
			<div class="d-flex justify-content-between align-items-center">
				<div class="voucher-amount fw-bolder">₱ ${amount}</div>
				<small class="voucher-date">
					${item.activity}
				</small>
			</div>
			<div class="d-flex justify-content-between align-items-center">
				<div class="voucher-date">${date}</div>
				<small class="voucher-date">${Number(item.pointsEarned.toFixed(2))} pts.</small>
			</div>
		`;

        container.appendChild(div);
    });
}

function onPurchaseClicked(item) {
    addLoader('wifreeBtn');
    $('#wifreeCheckOutModal').modal('show');
    $('#wifreeModal').modal('hide');
    const container = document.getElementById('checkout-container');
    container.innerHTML = `
        <div class="d-flex flex-column gap-2 px-2 py-2 shadow" style="border:1px solid #7e7e7e;border-radius: 5px">
            <div class="d-flex justify-content-between align-items-center gap-2 w-100">
                <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" width="35" height="29.52" viewBox="0 0 135.33 114.13">
                  <title>GCash</title>
                  <path d="M301.23,384.14a64.85,64.85,0,0,1-7,29.49,6.56,6.56,0,0,0,2.33,8.54h0a6.53,6.53,0,0,0,9-2q.16-.25.29-.51a78.4,78.4,0,0,0,0-70.9,6.54,6.54,0,0,0-8.81-2.81l-.5.29h0a6.56,6.56,0,0,0-2.33,8.53A64.88,64.88,0,0,1,301.23,384.14Z" transform="translate(-179 -327.08)" style="fill:#51c1ff"/>
                  <path d="M280.06,384.14a43.85,43.85,0,0,1-4,18.4,6.55,6.55,0,0,0,2.46,8.28h0A6.56,6.56,0,0,0,288,408a57.4,57.4,0,0,0,0-47.68,6.56,6.56,0,0,0-9.45-2.82h0a6.55,6.55,0,0,0-2.46,8.28A43.85,43.85,0,0,1,280.06,384.14Z" transform="translate(-179 -327.08)" style="fill:#51c1ff"/>
                  <path d="M236.06,428.13a44,44,0,1,1,26.87-78.85,6.54,6.54,0,0,0,8.63-.53h0a6.53,6.53,0,0,0-.63-9.79,57.08,57.08,0,1,0,.09,90.3,6.44,6.44,0,0,0,.61-9.63l-.14-.14A6.45,6.45,0,0,0,263,419,43.82,43.82,0,0,1,236.06,428.13Z" transform="translate(-179 -327.08)" style="fill:#007cff"/>
                  <path d="M271.15,379.35a6.75,6.75,0,0,0-4.76-2h0l-31.35,0h0a6.77,6.77,0,1,0,0,13.53h23.59a23.52,23.52,0,1,1-10-26.75,6.78,6.78,0,0,0,8.4-1h0a6.75,6.75,0,0,0-1.14-10.45,37.36,37.36,0,0,0-27.8-4.88,36.55,36.55,0,0,0-28.24,28.48,37.08,37.08,0,1,0,73.34,7.78A6.78,6.78,0,0,0,271.15,379.35Z" transform="translate(-179 -327.08)" style="fill:#002cb8"/>
                </svg>      
                <h2 class="fw-bolder">₱ ${item.price.toFixed(2)}</h2>
            </div>
            
            <div class="divider-primary"></div>
            <div class="d-flex justify-content-between gap-0 w-100">
                <small>
                    Time: ${item.timeInMinutes} mins
                </small>
                <small>
                    Expiry: ${item.expirationInMinutes} mins
                </small>
            </div>
        </div>
    `
    const payNowBtn = document.getElementById('payNowBtn');
    const inputMobileNumber = document.getElementById('inputMobileNumber');
    const mobileError = document.getElementById('mobileError');

    payNowBtn.addEventListener('click', (e) => {
        const mobileValue = inputMobileNumber.value.trim();
        const onlyNumbers = /^\d+$/;

        inputMobileNumber.classList.remove('is-invalid');
        inputMobileNumber.classList.remove('is-valid');
        let errorMessage = "";

        if (mobileValue === "") {
            errorMessage = "Mobile number is required.";
        } else if (!onlyNumbers.test(mobileValue)) {
            errorMessage = "Please enter numbers only (no letters or spaces).";
        } else if (mobileValue.length !== 11) {
            errorMessage = "Number must be exactly 11 digits.";
        }

        if (errorMessage) {
            mobileError.textContent = errorMessage;
            inputMobileNumber.classList.add('is-invalid');
        } else {
            inputMobileNumber.classList.add('is-valid');

            addLoader('payNowBtn')

            var code = getStorageValue('activeVoucher')

            fetchPortalAPI(`/wifree-vouchers`, "POST", vendorIpAddress, {
                code: code,
                purchaseId: item.id,
                mobile: mobileValue,
            })
                .then(result => {
                    if ((!result) || (!result?.success)) {
                        $.toast({
                            title: 'Failed',
                            content: result?.error ?? 'Request failed. Please try again.',
                            type: 'error',
                            delay: 4000
                        });
                        removeLoader('payNowBtn')
                        return;
                    }

                    let data = result?.data;
                    if ((!!data) || (data?.status === "success")) {
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
                .catch(error => {
                    $.toast({
                        title: 'Failed',
                        content: error ?? 'Failed to connect to server. Try again later.',
                        type: 'error',
                        delay: 4000
                    });
                    removeLoader('payNowBtn')
                });


        }
    });

    inputMobileNumber.addEventListener('input', () => {
        inputMobileNumber.classList.remove('is-invalid');
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
        .then(result => {
            if ((!result) || (!result?.success)) {
                return;
            }
            let data = result?.data;
            const container = document.getElementById('wifreeList');
            container.innerHTML = "";
            data.forEach(item => {
                const div = document.createElement("div");
                div.style.cursor = "pointer";
                div.innerHTML = `
                    <div class="d-flex flex-column gap-2 px-2 py-2 shadow" style="border:1px solid #7e7e7e;border-radius: 5px">
                        <div class="d-flex justify-content-between align-items-center gap-2 w-100">
                            <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" width="35" height="29.52" viewBox="0 0 135.33 114.13">
                              <title>GCash</title>
                              <path d="M301.23,384.14a64.85,64.85,0,0,1-7,29.49,6.56,6.56,0,0,0,2.33,8.54h0a6.53,6.53,0,0,0,9-2q.16-.25.29-.51a78.4,78.4,0,0,0,0-70.9,6.54,6.54,0,0,0-8.81-2.81l-.5.29h0a6.56,6.56,0,0,0-2.33,8.53A64.88,64.88,0,0,1,301.23,384.14Z" transform="translate(-179 -327.08)" style="fill:#51c1ff"/>
                              <path d="M280.06,384.14a43.85,43.85,0,0,1-4,18.4,6.55,6.55,0,0,0,2.46,8.28h0A6.56,6.56,0,0,0,288,408a57.4,57.4,0,0,0,0-47.68,6.56,6.56,0,0,0-9.45-2.82h0a6.55,6.55,0,0,0-2.46,8.28A43.85,43.85,0,0,1,280.06,384.14Z" transform="translate(-179 -327.08)" style="fill:#51c1ff"/>
                              <path d="M236.06,428.13a44,44,0,1,1,26.87-78.85,6.54,6.54,0,0,0,8.63-.53h0a6.53,6.53,0,0,0-.63-9.79,57.08,57.08,0,1,0,.09,90.3,6.44,6.44,0,0,0,.61-9.63l-.14-.14A6.45,6.45,0,0,0,263,419,43.82,43.82,0,0,1,236.06,428.13Z" transform="translate(-179 -327.08)" style="fill:#007cff"/>
                              <path d="M271.15,379.35a6.75,6.75,0,0,0-4.76-2h0l-31.35,0h0a6.77,6.77,0,1,0,0,13.53h23.59a23.52,23.52,0,1,1-10-26.75,6.78,6.78,0,0,0,8.4-1h0a6.75,6.75,0,0,0-1.14-10.45,37.36,37.36,0,0,0-27.8-4.88,36.55,36.55,0,0,0-28.24,28.48,37.08,37.08,0,1,0,73.34,7.78A6.78,6.78,0,0,0,271.15,379.35Z" transform="translate(-179 -327.08)" style="fill:#002cb8"/>
                            </svg>      
                            <h2 class="fw-bolder">₱ ${item.price.toFixed(2)}</h2>
                        </div>
                        
                        <div class="divider-primary"></div>
                        <div class="d-flex justify-content-between gap-0 w-100">
                            <small>
                                Time: ${item.timeInMinutes} mins
                            </small>
                            <small>
                                Expiry: ${item.expirationInMinutes} mins
                            </small>
                        </div>
                    </div>
                `
                $(div).on('click', function () {
                    onPurchaseClicked(item);
                });
                container.appendChild(div);
            })

        })
        .catch(error => {
            $.toast({
                title: 'Failed',
                content: error ?? 'Failed to connect to server. Try again later.',
                type: 'error',
                delay: 4000
            });
        });
}

document.addEventListener('hidden.bs.modal', function () {
    document.querySelectorAll('button[data-loading="true"]').forEach(btn => {
        const spinner = btn.querySelector('[data-spinner="true"]');
        if (spinner) spinner.remove();
        btn.disabled = false;
        btn.removeAttribute('data-loading');
    });
});

async function fetchServerData() {
    const maxRetries = 30;
    const retryDelay = 1000;
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch('/juanfi-extended.json?t=' + new Date().getTime());
            if (response.ok) {
                const data = await response.json();
                console.log('JuanFi Extended Version:', data.version);
                return data;
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

        } catch (err) {
            console.error(`Attempt ${attempt} failed:`, err);
            if (attempt < maxRetries) {
                await wait(retryDelay);
            } else {
                $.toast({
                    title: 'Failed',
                    content: 'juanfi-extended.json missing or unreachable after 30 attempts.',
                    type: 'error',
                    delay: 4000
                });
                return null;
            }
        }
    }
}

function fetchPortalConfig(cb) {
    fetchPortalAPI("/config", "GET", null, null)
        .then(result => {
            if ((!result) || (!result?.success)) {
                cb(null, result?.error ?? "Server request failed.");
                return;
            }
            let data = result?.data;
            if (!data) {
                cb(null, null);
                return;
            }
            let output = {...data};
            cb(output, null);
        })
        .catch(error => {
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

    if (!!wheelConfig) {
        var spinRedeemBtn = document.getElementById("spinRedeemBtn");
        spinRedeemBtn.onclick = function (e) {
            e.preventDefault();
            var avail = parseInt(rewardPointsBalance) || 0;
            ;
            if (avail <= 0) {
                $.toast({title: 'Info', content: 'No reward points available to redeem.', type: 'error', delay: 3000});
                return;
            }
            spinBtn.disabled = false;
            $("#redeemedValueWrapper").addClass("hide");
            $("#selectedReward").text("")

            $(".availablePointsDisplay").html((!!rewardPointsBalance) ? rewardPointsBalance.toFixed(2) : "0.00");
            $("#spinBtn").text("Spin");
            $('#redeemBySpinModal').modal('show');

            const colors = ["#FFD6E8", "#E0F7FA", "#FFF7C0", "#E8F6E9", "#FDEFEF", "#E8EAF6", "#FBE9E7", "#E6F0FF"];
            drawSpinWheel(macNoColon, wheelConfig, colors);
        };
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
    var confirmRedeemBtn = document.getElementById("confirmRedeemBtn");
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
            addLoader('confirmRedeemBtn')
            $.ajax({
                type: "POST",
                url: `http://${vendorIpAddress}/redeemPoints?mac=${macNoColon}&points=${selected}`,
                success: function (result) {
                    if (!result) {
                        $.toast({
                            title: 'Failed',
                            content: 'Request failed. Please try again.',
                            type: 'error',
                            delay: 4000
                        });
                        removeLoader('confirmRedeemBtn')
                        return;
                    }

                    if (result.status === "false") {
                        $.toast({
                            title: 'Failed',
                            content: 'Failed to redeem points.',
                            type: 'error',
                            delay: 4000
                        });
                        removeLoader('confirmRedeemBtn')
                        return;
                    } else {
                        var timeAdded = parseInt(result.timeAdded);
                        $('#redeemModal').modal('hide');
                        $.toast({
                            title: 'Success',
                            content: 'Redeemed ' + selected + ' points (PHP ' + estimatedPhp + '). Added',
                            content: `Redeemed ${selected} points (PHP ${estimatedPhp}). Added ${secondsToDhms(timeAdded * 60)} time to current voucher.`,
                            type: 'success',
                            delay: 4000
                        });
                        setTimeout(function () {
                            newLogin();
                            removeLoader('confirmRedeemBtn')
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
                    removeLoader('confirmRedeemBtn')
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
            removeLoader('confirmRedeemBtn')
        }
    };
}

function showPauseButton() {
    $("#pauseTimeBtn").removeClass("hide");
    $("#resumeTimeBtn").addClass("hide");
}

function showResumeButton() {
    $("#resumeTimeBtn").removeClass("hide");
    $("#pauseTimeBtn").addClass("hide");
}

function logoutVoucher(macNoColon) {
    fetchPortalAPI(`/logout`, "POST", vendorIpAddress, {mac: macNoColon})
        .then(result => {
            if ((!result) || (!result?.success)) {
                $.toast({
                    title: 'Failed',
                    content: result?.error ?? 'Request failed. Please try again.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
                removeLoader('pauseTimeBtn')
                return;
            }

            let data = result?.data;
            if ((!!data) || (data?.status === "success")) {


                setTimeout(function () {
                    showResumeButton();
                    newLogin();
                }, 1500);
            } else {
                $.toast({
                    title: 'Failed',
                    content: 'Failed to disconnect device.',
                    type: 'error',
                    delay: 4000
                });
            }
        })
        .catch(error => {
            $.toast({
                title: 'Failed',
                content: error ?? 'Failed to connect to server. Try again later.',
                type: 'error',
                delay: 4000
            });
            removeLoader('pauseTimeBtn')
            // cb(false);
        });
}

function loginVoucher(macNoColon, cb) {
    fetchPortalAPI(`/login`, "POST", vendorIpAddress, {mac: macNoColon})
        .then(result => {
            if ((!result) || (!result?.success)) {
                $.toast({
                    title: 'Failed',
                    content: result?.error ?? 'Request failed. Please try again.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
                return;
            }
            let data = result?.data;
            if ((!!data) || (data?.status === "success")) {
                cb(true);
            } else {
                $.toast({
                    title: 'Failed',
                    content: data?.message ?? 'Failed to connect voucher.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
            }
        })
        .catch(error => {
            $.toast({
                title: 'Failed',
                content: error ?? 'Failed to connect to server. Try again later.',
                type: 'error',
                delay: 4000
            });
            cb(false);
        });
}


function claimFreeInternetFetch(macNoColon, cb) {
    fetchPortalAPI(`/claim-free-internet`, "POST", vendorIpAddress, {mac: macNoColon})
        .then(result => {
            if ((!result) || (!result?.success)) {
                $.toast({
                    title: 'Failed',
                    content: result?.error ?? 'Request failed. Please try again.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
                return;
            }
            let data = result?.data;
            if ((!!data) || (data?.status === "success")) {
                cb(true);
            } else {
                $.toast({
                    title: 'Failed',
                    content: data?.message ?? 'Failed to claim free internet.',
                    type: 'error',
                    delay: 4000
                });
                cb(false);
            }
        })
        .catch(error => {
            $.toast({
                title: 'Failed',
                content: error ?? 'Failed to connect to server. Try again later.',
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
        let {isOnline} = userData;
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
    if (parseInt(rewardPointsBalance) < 0) {
        $.toast({
            title: 'Failed',
            content: error ?? 'Not enough points balance.',
            type: 'error',
            delay: 4000
        });
        removeLoader('spinBtn')
        return;
    }
    fetchPortalAPI("/promo/spin-wheel", "POST", vendorIpAddress, JSON.stringify({mac}), {
        contentType: 'application/json; charset=utf-8',
        dataType: "json"
    })
        .then(result => {
            if ((!result) || (!result?.success)) {
                cb(null, result?.error ?? "Server request failed.");
                return;
            }
            let data = result?.data;
            if (!data) {
                cb(null, null);
                return;
            }
            cb(data, null);
        })
        .catch(error => {
            cb(null, error);
        })
}

function drawSpinWheel(mac, prizes, colors) {
    /* ===== Elements & state ===== */
    const wheelCanvas = document.getElementById('wheelCanvas');
    const wheelCtx = wheelCanvas.getContext('2d');

    const spinBtn = document.getElementById('spinBtn');
    const spinCancelBtn = document.getElementById('spinCancelBtn');
    spinBtn.textContent = "SPIN";

    const clickSound = new Audio('https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg');

    // Expanded prizes array based on winning percentages (max 10 slices)
    let expandedPrizes = [];

    // Function to generate expanded prizes based on winning percentages
    function generateExpandedPrizes() {
        expandedPrizes = [];
        const maxSlices = 10;

        // Calculate total winning percentage
        let totalPercentage = 0;
        prizes.forEach(p => {
            if (p) {
                let winPercent = Math.floor(p.percentage);
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

        const maxPercentage = 100;

        // Distribute prizes proportionally to fill max 10 slices
        prizes.forEach(p => {
            if (p && p.percentage > 0) {
                // Calculate how many slices this prize should occupy
                const proportion = p.percentage / maxPercentage;
                const sliceCount = Math.max(1, Math.round(proportion * maxSlices));
                // Add this prize multiple times
                for (let i = 0; i < sliceCount; i++) {
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

    let displaySize = 460;
    let wheelSize = 520;
    let dpr = Math.max(window.devicePixelRatio || 1, 1);
    let center = {x: 0, y: 0};
    let radius = 0;
    let currentRotation = 0; // radians
    let spinning = false;
    let lastSliceSound = -1;

    /* ===== Resize (set CSS size + backing store for DPR) ===== */
    function resizeAll() {
        dpr = Math.max(window.devicePixelRatio || 1, 1);
        const shown = Math.min(window.innerWidth * 0.9, wheelSize);
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
        window.addEventListener('resize', resizeAll);
    }
    resizeAll();

    /* ===== draw wheel (rotation in radians) and optional highlighted slice ===== */
    function drawWheel(rotationRad = 0, highlightIndex = null, highlightAlpha = 0) {
        const ctx = wheelCtx;
        ctx.clearRect(0, 0, displaySize, displaySize);

        const displayPrizes = expandedPrizes.length > 0 ? expandedPrizes : prizes;
        const slice = (2 * Math.PI) / displayPrizes.length;

        // draw wheel rotated
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rotationRad);
        ctx.translate(-center.x, -center.y);

        for (let i = 0; i < displayPrizes.length; i++) {
            const start = i * slice;
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
                ctx.font = `${Math.max(12, displaySize / 24)}px Arial`;
                ctx.textAlign = 'right';
                ctx.fillText(displayPrizes[i].promoName, radius - 12, 6);
                ctx.restore();
            }
        }

        // highlight overlay in wheel's rotated coordinate system
        if (highlightIndex !== null && highlightAlpha > 0) {
            const start = highlightIndex * slice;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.arc(center.x, center.y, radius, start, start + slice);
            ctx.closePath();
            ctx.fillStyle = `rgba(255,230,100,${Math.min(1, highlightAlpha)})`;
            ctx.fill();
        }

        ctx.restore();

        // fixed pointer on top
        drawPointer();
    }

    function drawPointer() {
        const ctx = wheelCtx;
        ctx.save();
        const pointerHalf = Math.max(8, displaySize * 0.03);
        const y = center.y - radius - 4;
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
        const displayPrizes = expandedPrizes.length > 0 ? expandedPrizes : prizes;
        const rotDeg = ((rotationRad * 180 / Math.PI) % 360 + 360) % 360;
        const pointerDeg = (270 - rotDeg + 360) % 360; // top = 270 deg
        const sliceDeg = 360 / displayPrizes.length;
        let idx = Math.floor(pointerDeg / sliceDeg);
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
            fetchSpinWheelReward(mac, (result, error) => {
                if (!!error) {
                    $.toast({
                        title: 'Failed',
                        content: error ?? 'Server request failed.',
                        type: 'error',
                        delay: 4000
                    });
                    removeLoader('spinBtn')
                    return;
                }
                let prizeIndex = expandedPrizes.findIndex(x => x.promoName === result.promoName);
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
        const sliceDeg = 360 / expandedPrizes.length;
        const desiredPointerDeg = (chosenIndex + 0.5) * sliceDeg;
        const desiredWheelDegNormalized = (270 - desiredPointerDeg + 360) % 360;

        const currentDeg = ((currentRotation * 180 / Math.PI) % 360 + 360) % 360;
        let deltaDeg = (desiredWheelDegNormalized - currentDeg + 360) % 360;

        const extraSpins = 4 + Math.floor(Math.random() * 3); // 4..6
        const totalDeg = deltaDeg + extraSpins * 360;
        const targetRotation = currentRotation + (totalDeg * Math.PI / 180);

        const duration = 4200 + Math.floor(Math.random() * 800);
        const startRot = currentRotation;
        let startTime = null;
        lastSliceSound = -1;

        function step(ts) {
            if (!startTime) startTime = ts;
            const elapsed = ts - startTime;
            const t = Math.min(1, elapsed / duration);
            const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
            const nowRot = startRot + (targetRotation - startRot) * ease;

            drawWheel(nowRot);

            // click sound when we move across slices
            const idx = rotationToIndex(nowRot);
            if (idx !== lastSliceSound) {
                lastSliceSound = idx;
                //try{ clickSound.currentTime = 0; clickSound.play().catch(()=>{}); }catch(e){}
            }

            if (t < 1) {
                requestAnimationFrame(step);
                return;
            }

            // finished spinning
            currentRotation = targetRotation % (2 * Math.PI);
            drawWheel(currentRotation);

            const winningIndex = rotationToIndex(currentRotation);

            // pulse the winning slice then show modal
            pulseHighlight(winningIndex, 3, 700, () => {
                // prefer API-provided prize data if available, otherwise fall back to expanded/local prizes array
                const displayPrizes = expandedPrizes.length > 0 ? expandedPrizes : prizes;
                const prizeToShow = (apiPrize && apiPrize.promoName) ? apiPrize : displayPrizes[winningIndex];
                // Handle undefined or empty prizes
                $("#redeemedValueWrapper").removeClass("hide");
                if ((!prizeToShow) || (!prizeToShow.promoName) || (prizeToShow.rewardValue <= 0)) {
                    $("#selectedReward").text(`🥺 Sorry! Better luck next time.`);
                } else {
                    var msg = `🎁 Nice! You redeemed ${prizeToShow.promoName}`;
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
                removeLoader('spinBtn')
                if (parseInt(rewardPointsBalance) <= 0) {
                    $('#redeemBySpinModal').modal('hide');
                }
            });
        }

        requestAnimationFrame(step);

    }

    /* ===== smooth pulse highlight (alpha rises/falls) ===== */
    function pulseHighlight(index, pulses = 3, pulseDuration = 700, callback) {
        const total = pulses * pulseDuration;
        const start = performance.now();

        function frame(now) {
            const elapsed = now - start;
            if (elapsed >= total) {
                drawWheel(currentRotation, null, 0);
                callback && callback();
                return;
            }
            const pulseProgress = (elapsed % pulseDuration) / pulseDuration; // 0..1
            const alpha = Math.sin(pulseProgress * Math.PI); // smooth 0..1..0
            drawWheel(currentRotation, index, alpha * 0.95);
            requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
    }

    /* ===== shuffle prizes (randomize displayed positions) ===== */
    function shufflePrizes() {
        // Fisher-Yates shuffle algorithm
        const target = (expandedPrizes && expandedPrizes.length > 0) ? expandedPrizes : prizes;
        for (let i = target.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [target[i], target[j]] = [target[j], target[i]];
        }
    }

    if (!spinEventsCreated) {
        /* ===== events & init ===== */
        window.addEventListener('resize', () => {
            resizeAll();
        });
        spinBtn.onclick = () => {
            var avail = parseInt(rewardPointsBalance) || 0;
            if (avail <= 0) {
                $.toast({title: 'Info', content: 'No reward points available to redeem.', type: 'error', delay: 3000});
                $('#redeemBySpinModal').modal('hide');
                return;
            }
            addLoader('spinBtn')
            isSpinTriggered = true;
            shufflePrizes();
            spinWheel();
        };
        spinCancelBtn.onclick = (e) => {
            newLogin();
        };
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
        const shown = Math.min(window.innerWidth * 0.9, wheelSize);
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
        const shown = Math.min(window.innerWidth * 0.9, wheelSize);
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
        window.addEventListener('resize', resizeAll);
    }

    // ensure initial sizes are correct:
    resizeAll();
    spinEventsCreated = true;
}

function useVoucherBtnEvt() {
    const connectBtn = document.getElementById('connectBtn');
    connectBtn.onclick = function (e) {
        e.preventDefault();
        const input = document.getElementById('voucherInput');
        // Clear previous custom validity
        input.setCustomValidity('');

        // Trim the value to catch empty or whitespace-only input
        if (!input.value || input.value.trim() === '') {
            input.setCustomValidity('Please input a valid voucher');
            input.reportValidity();
            return;
        }

        // Optional: check HTML5 constraints
        if (!input.checkValidity()) {
            input.setCustomValidity('Please input a valid voucher');
            input.reportValidity();
            return;
        }

        // Check other variables
        if (!macNoColon || macNoColon.trim() === '') {
            input.setCustomValidity('Please input a valid voucher');
            input.reportValidity();
            return;
        }

        if (!vendorIpAddress || vendorIpAddress.trim() === '') {
            input.setCustomValidity('Please input a valid voucher');
            input.reportValidity();
            return;
        }

        addLoader('connectBtn')

        var voucherCode = $("#voucherInput").val();
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
                    removeLoader('connectBtn')
                }, 3000);
            } else {
                removeLoader('connectBtn')
                $.toast({title: 'Failed', content: error ?? "Server request failed.", type: 'error', delay: 3000});

                return;
            }
        });
    }
}

function fetchUseVoucher(macNoColon, vendorIpAddress, voucherCode, cb) {
    fetchPortalAPI(`/use-voucher`, "POST", vendorIpAddress, {mac: macNoColon, code: voucherCode})
        .then(result => {
            if ((!result) || (!result?.success)) {
                cb(null, result?.error ?? "Server request failed.");
                return;
            }
            let data = result?.data;
            if ((!!data) || (data?.status === "success")) {
                cb(true, null);
            } else {
                cb(false, data?.message ?? "Failed to use voucher.");
            }
        })
        .catch(error => {
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
    return new Promise(function (resolve, reject) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 1000; // 1 second

        let attemptCount = 0;

        const attemptRequest = () => {
            try {
                const timestamp = Date.now();
                const separator = apiUrl.includes("?") ? "&" : "?";
                const finalUrl = `${juanfiExtendedServerUrl}${apiUrl}${separator}t=${timestamp}`;

                const headers = vendorIpAddress
                    ? {'X-IP': vendorIpAddress}
                    : undefined;

                $.ajax({
                    type,
                    url: finalUrl,
                    headers,
                    data: params,
                    ...options,

                    success: function (data) {
                        if (!data) {
                            resolve({
                                success: false,
                                error: "Failed to fetch."
                            });
                        } else {
                            resolve({
                                success: true,
                                data
                            });
                        }
                    },

                    error: function (jqXHR, textStatus, errorThrown) {
                        const isNetworkError =
                            jqXHR.status === 0 ||
                            textStatus === "timeout" ||
                            (jqXHR.status >= 500 && jqXHR.status < 600);

                        if (isNetworkError && attemptCount < MAX_RETRIES) {
                            attemptCount++;

                            console.warn(
                                `fetchPortalAPI network retry ${attemptCount}/${MAX_RETRIES} in 1s`
                            );

                            setTimeout(attemptRequest, RETRY_DELAY);
                            return;
                        }

                        const err = parseAjaxErrorResponse(jqXHR, textStatus, errorThrown);
                        reject(err?.message ?? "Server request failed!");
                    }
                });
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
    if (pointsEnabled && totalPoints > 0) {
        $("#redeemWrapper").removeClass("hide");
        if ((!!wheelConfig) && wheelConfig?.length > 0) {
            $("#spinWrapper").removeClass("hide");
            $("#spinWrapper").removeClass("col-sm-12");
            $("#spinWrapper").addClass("col-sm-6");
            $("#redeemWrapper").removeClass("col-sm-12");
            $("#redeemWrapper").addClass("col-sm-6");
        } else {
            $("#spinWrapper").addClass("hide");
            $("#spinWrapper").removeClass("col-sm-6");
            $("#spinWrapper").addClass("col-sm-12");
            $("#redeemWrapper").removeClass("col-sm-6");
            $("#redeemWrapper").addClass("col-sm-12");
        }
        $("#rewardBtnWrapper").removeClass("hide");
    } else {
        $("#redeemWrapper").addClass("hide");
        $("#spinWrapper").addClass("hide");
        $("#rewardBtnWrapper").addClass("hide");
    }

    if (pointsEnabled) {
        onRedeemRewardPtsEvt(macNoColon, wheelConfig);
        onRedeemRewardPtsConfirmBtnEvt(macNoColon);
        onRedeemRewardPtsSliderChangeEvt();
    }
}

let lastButtonId = null;

function addLoader(buttonId) {
    if (lastButtonId && lastButtonId !== buttonId) {
        removeLoader(lastButtonId);
    }

    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (btn.dataset.loading === "true") return;

    const spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm me-2'; // small spinner with margin
    spinner.role = 'status';
    spinner.ariaHidden = true;
    spinner.dataset.spinner = "true"; // mark it for removal later

    btn.prepend(spinner);

    btn.disabled = true;
    btn.dataset.loading = "true";

    lastButtonId = buttonId;
}

function removeLoader(buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn || btn.dataset.loading !== "true") return;

    const spinner = btn.querySelector('span[data-spinner="true"]');
    if (spinner) btn.removeChild(spinner);

    btn.disabled = false;
    btn.dataset.loading = "false";

    if (lastButtonId === buttonId) lastButtonId = null;
}

function createToastContainer() {
    let container = document.getElementById('toastContainer');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'position-fixed top-0 end-0 p-3';
    container.style.zIndex = '99999';
    container.style.pointerEvents = 'none';

    document.body.appendChild(container);
    return container;
}

$.toast = function ({title = '', content = '', type = 'info', delay = 5000}) {
    const container = createToastContainer();

    let bgClass = 'bg-info text-white';
    if (type === 'error') bgClass = 'bg-danger text-white';
    else if (type === 'success') bgClass = 'bg-success text-white';
    else if (type === 'warning') bgClass = 'bg-warning text-dark';

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center ${bgClass} border-0 mb-2`;
    toastEl.style.pointerEvents = 'auto';
    toastEl.role = 'alert';
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
       <div class="d-flex mt-1">
          <div class="toast-body">
            ${title ? `<strong>${title}</strong><br>` : ''}
            ${content}
          </div>
          <button type="button" class="btn-close ${type === 'warning' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
       </div>
    `;

    container.appendChild(toastEl);

    const toast = new bootstrap.Toast(toastEl, {delay, autohide: true});
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
};

createToastContainer();