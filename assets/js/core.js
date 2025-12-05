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
var insertcoinbg = new Audio('assets/insertcoinbg.mp3');
var coinCount = new Audio('assets/coin-received.mp3');
var TOPUP_CHARGER = "CHARGER";
var TOPUP_INTERNET = "INTERNET";
var TOPUP_ELOAD = "ELOAD";
var juanfiExtendedServerUrl = `http://${juanfiExtendedServerIP}:8080/api/portal`; //do not change value of this line
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
var chargingEnable, eloadEnable, showPauseTime, showMemberLogin, showExtendTimeButton, disableVoucherInput, macAsVoucherCode, qrCodeVoucherPurchase, pointsEnabled;

var wheelConfig = [];
var macNoColon;

function initValues(){
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

$(document).ready(function(){
	if(!initLoad){
		initValues();
		renderView();
		useVoucherBtnEvt();
	}
});

function newLogin(){
	initValues();
	renderView();
}

function renderView(){
	showLoader();
	$("#voucherInput").val("");
	$('.modal').modal('hide');
	$("#ipInfo").html(uIp);
	$("#macInfo").html(mac);
	wheelConfig = [];
	multiVendoAddresses = [];
	fetchPortalConfig(function(data, error){
		if(!!error){
			hideLoader();
			$.toast({
				title: 'Failed',
				content: error ?? 'Server request failed. Try again later. Data shown are locally stored dummy/test values only.',
				type: 'error',
				delay: 4000
			});
		}

		if(!!data){
			isMultiVendo = data.isMultiVendo;
			multiVendoOption = data.multiVendoOption;
			multiVendoAddresses = data.multiVendoAddresses;
			loginOption = data.loginOption;
			dataRateOption = data.dataRateOption;
			vendorIpAddress = data.vendorIpAddress;
			chargingEnable = data.chargingEnable;
			eloadEnable = data.eloadEnable;
			showPauseTime = data.showPauseTime;
			showMemberLogin = data.showMemberLogin;
			showExtendTimeButton = data.showExtendTimeButton;
			macAsVoucherCode = data.macAsVoucherCode;
			qrCodeVoucherPurchase = data.qrCodeVoucherPurchase;
			disableVoucherInput = data.disableVoucherInput;
			pointsEnabled = data.pointsPercentage > 0;
			autologin = data.autoLoginHotspot;
			wheelConfig = data.wheelConfig;
		}

		// handle the data if needed
		$( "#saveVoucherButton" ).prop('disabled', true);	
		$( "#cncl" ).prop('disabled', false);
		$('#coinToast').toast({delay: 1000, animation: true});
		$('#coinSlotError').toast({delay: 5000, animation: true});
		
		if(!dataRateOption){
			$("#dataInfoDiv").addClass("hide");
			$("#dataInfoDiv2").addClass("hide");
		}
		
		if(!showMemberLogin){
			$("#memberLoginBtn").addClass("hide");
		}
		
		if(!showExtendTimeButton){
			var inserType = $( "#insertBtn" ).attr('data-insert-type');
			if(inserType == "extend"){
				$("#insertBtn").addClass("hide");
			}
		}
		
		if( qrCodeVoucherPurchase ){
			$("#scanQrBtn").attr("style", "display: block");
		}
			
		if(!chargingEnable){
			if(isMultiVendo){
				evaluateChargingButton(selectedVendoDtls);
			}else{
				$("#chargingBtn").addClass("hide");
				$("#rateTypeDiv").addClass("hide");
			}
		}

		if(!eloadEnable){
			if(isMultiVendo){
				evaluateEloadButton(selectedVendoDtls);
			}else{
				$("#eloadBtn").addClass("hide");
			}
		}

		voucher = macNoColon;
		
		var ignoreSaveCode = getStorageValue("ignoreSaveCode");
		if(ignoreSaveCode == null || ignoreSaveCode == "0"){
			ignoreSaveCode = "0";
		}
		
		$('#resumeTimeBtn').addClass("hide");

		fetchUserInfo(macNoColon, pointsEnabled, function(userData, error){
			if(!!error){
				hideLoader();
				$.toast({
					title: 'Failed',
					content: error ?? 'Server request failed. Try again later.',
					type: 'error',
					delay: 4000
				});
				return;
			}

			let isOnline = false, pointsEnabled = false;
			let voucherCode = macNoColon, timeRemainingStr;
			let totalPoints = 0, timeRemaining, timeExpiry;

			if(!!userData){
				isOnline = userData?.isOnline;
				voucherCode = userData?.voucherCode;
				pointsEnabled = userData?.pointsEnabled;
				totalPoints = userData?.totalPoints;
				timeRemaining = userData?.timeRemaining;
				timeRemainingStr = userData?.timeRemainingStr;
				timeExpiry = userData?.timeExpiry;
			}

			if(isMultiVendo){
				if(multiVendoOption == 1){
					$("#vendoSelectDiv").addClass("hide");
					var currentHotspot = hotspotAddress.split(":")[0];
					var dtls = multiVendoAddresses.find(x => x.hotspotAddress === currentHotspot);
					if(!!dtls){
						selectedVendoDtls = dtls;
						vendorIpAddress = dtls.vendoIp;
					} 
				}else if(multiVendoOption == 2){
					$("#vendoSelectDiv").addClass("hide");
					var dtls = multiVendoAddresses.find(x => x.interfaceName === interfaceName);
					if(!!dtls){
						selectedVendoDtls = dtls;
						vendorIpAddress = dtls.vendoIp;
					}
				}else{
					var selectedVendo = getStorageValue('selectedVendo');
					if(selectedVendo === "null"){ selectedVendo = null; }
					for(var i=0;i<multiVendoAddresses.length;i++){
						$("#vendoSelected").append($('<option>', {
							value: multiVendoAddresses[i].vendoIp,
							text: multiVendoAddresses[i].vendoName
						}));
						if(i === 0 && (!selectedVendo)){
							setStorageValue('selectedVendo', multiVendoAddresses[i].vendoIp);
							selectedVendo = multiVendoAddresses[i].vendoIp;
							selectedVendoDtls = multiVendoAddresses[i];
						}
						if(selectedVendo === multiVendoAddresses[i].vendoIp){
							selectedVendoDtls = multiVendoAddresses[i];
						}
					}  
					if(selectedVendo != null){
						vendorIpAddress = selectedVendo;
					}

					$("#vendoSelected").val(vendorIpAddress);
					var vendoSelectOption = document.getElementById("vendoSelected");
					vendoSelectOption.onchange = function(){
						vendorIpAddress = $("#vendoSelected").val();
						setStorageValue('selectedVendo', vendorIpAddress);
						let dtls = multiVendoAddresses.find(x => x.vendoIp === vendorIpAddress);
						
						if(!!dtls){
							selectedVendoDtls = dtls;
							wheelConfig = selectedVendoDtls.wheelConfig;
							pointsEnabled = selectedVendoDtls.pointsPercentage > 0;
							showPointsRedeemBtns(totalPoints, pointsEnabled, wheelConfig);
						}
				
						evaluateChargingButton(selectedVendoDtls);
						evaluateEloadButton(selectedVendoDtls);
					}
				}
				
				$("#vendoSelected").trigger("change");

			}else{
				$("#vendoSelectDiv").addClass("hide");
			}
			
			showPointsRedeemBtns(totalPoints, pointsEnabled, wheelConfig);
			if(pointsEnabled){
				rewardPointsBalance = totalPoints;
				$("#rewardPoints").html((!!totalPoints) ? totalPoints.toFixed(2) : "0");
				$(".redeemRatio").text(redeemRatioValue);
				$("#rewardDtls").removeClass("hide");
			}else{
				$("#rewardDtls").addClass("hide");
			}

			$("#voucherCode").html(voucherCode);
			var isPaused = (!isOnline);
			var time = timeRemaining;
			$("#remainTime").html(secondsToDhms(time));
			if(remainingTimer != null){
				clearInterval(remainingTimer);
				remainingTimer = null;
			}
			
			if(isOnline){
				$("#connectionStatus").html("Connected");
				$("#connectionStatus").attr("class", "blinking2");
				$("#statusImg").attr("src", "assets/img/wifi.png");
				$("#statusImg").removeClass("hide");
				$("#statusImg").addClass("blinking2");
				$("#remainingTimeWrapper").removeClass("hide");

				remainingTimer = setInterval(function(){
					time--;
					$("#remainTime").html(secondsToDhms(time));
					if(time <= 0){
						$.toast({
							title: 'Success',
							content: 'Time limit reached. You will be logged out shortly',
							type: 'success',
							delay: 5000
						});
						clearInterval(remainingTimer);
						setTimeout(function(){
							newLogin();
						}, 4000);
					}
				}, 1000);
			}else{
				//$("#remainTime").html(timeRemainingStr);
				if(timeRemaining > 0){
					isPaused = true;
					$("#remainingTimeWrapper").removeClass("hide");
				}else{
					setStorageValue("isPaused", "0");
					removeStorageValue(macNoColon+"tempValidity");
					isPaused = false;
					$("#remainingTimeWrapper").addClass("hide");
				}

				$("#connectionStatus").html("Disconnected");
				$("#connectionStatus").attr("class", "blinking1");
				$("#statusImg").attr("src", "assets/img/off_wifi.png");
				$("#statusImg").removeClass("hide");
				$("#statusImg").addClass("blinking1");
				
				if(!initLoad){
					var pausedState = getStorageValue("isPaused")
					if(autologin && pausedState !== "1" && timeRemaining > 0){
						showLoader();
						loginVoucher(macNoColon, function(success){
							if(success){
								checkIsLoggedIn(macNoColon);
							}
							hideLoader();
						});
					}
				}
			}

			if(!!timeExpiry){
				let expirationTime = new Date(timeExpiry);
				$("#expirationTime").html(expirationTime.toLocaleString());
				$("#expirationTimeImg").attr("src", "assets/img/time.png");
			}else{
				$("#expirationTimeWrapper").addClass("hide");
			}
			
			if(showPauseTime && isPaused){
				$("#pauseRemainTime").html(getStorageValue(voucher+"remain"));
				$("#resumeTimeBtn").removeClass("hide");
			}else{
				$("#resumeTimeBtn").addClass("hide");
			}

			setStorageValue('activeVoucher', voucherCode);

			if(showPauseTime && isOnline){
				$("#pauseTimeBtn").removeClass("hide");
			}else{
				$("#pauseTimeBtn").addClass("hide");
			}
			
			// Initial call to display immediately
			updateDeviceDateTime();

			// Update every second (1000 milliseconds)
			setInterval(updateDeviceDateTime, 1000);

			initLoad = true;
			hideLoader();
		});
	});
}

$('#insertCoinModal').on('hidden.bs.modal', function () {
	clearInterval(timer);
	timer = null;
	insertingCoin = false;
	insertcoinbg.pause();
	insertcoinbg.currentTime = 0.0;
	if(totalCoinReceived == 0){
		$.ajax({
			type: "POST",
			url: "http://"+vendorIpAddress+"/cancelTopUp",
			data: "voucher="+voucher+"&mac="+mac,
			success: function(data){
				hideLoader();
			},error: function (jqXHR, exception) {
				hideLoader();
			}
		});
	}
});

$('#eloadModal').on('hidden.bs.modal', function () {
	insertingCoin = false;
});

const pauseTimeBtn = document.getElementById('pauseTimeBtn');
pauseTimeBtn.onclick = function(){
	var r = confirm("Are you sure you want to temporarily disconnect from the network?");
	if(r){
		pause(macNoColon);
	}
}

const resumeTimeBtn = document.getElementById('resumeTimeBtn');
resumeTimeBtn.onclick = function(){
	showLoader();
	setStorageValue("isPaused", "0");
	loginVoucher(macNoColon, function(success){
		if(success){
			setTimeout(function (){
				checkIsLoggedIn(macNoColon);
			}, 1000);
		}
		else{
			hideLoader();
		}
	});
};

function replaceAll(str, rep){
	var aa = str;
	while(aa.indexOf(rep) > 0){
		aa = aa.replace(rep, "");
	}
	return aa;
}

if(voucher == null){
	voucher = "";
}

if(voucher != ""){
	$('#voucherInput').val(voucher);
}

function evaluateChargingButton(vendoDtls){
	if((!!vendoDtls) && (!vendoDtls.chargingEnable)){
		$("#chargingBtn").addClass("hide");
		$("#rateTypeDiv").addClass("hide");
	}else{
		$("#chargingBtn").removeClass("hide");
		$("#rateTypeDiv").removeClass("hide");
	}
}

function cancelPause(){
	var r = confirm("Are you sure you want to cancel the session?");
	if(r){
		removeStorageValue("isPaused");
		removeStorageValue("activeVoucher");
		setStorageValue('isPaused', "1");
		setStorageValue('forceLogout', "1");
		document.logout.submit();
	}
}

function promoBtnAction(){
	$('#promoRatesModal').modal('show');
	return false;
}

function chargingBtnAction(){
	$('#chargingModal').modal('show');
	return false;
}

var timer = null;

function insertBtnAction(){
	removeStorageValue("ignoreSaveCode");
	setStorageValue('insertCoinRefreshed', "0");
	$("#progressDiv").attr('style','width: 100%');
	$( "#saveVoucherButton" ).prop('disabled', true);
	$( "#cncl" ).prop('disabled', false);
	showLoader();
	totalCoinReceived = 0;
	
	var totalCoinReceivedSaved = getStorageValue("totalCoinReceived");
	if(totalCoinReceivedSaved != null){
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

function populatePromoRates(retryCount){
	$.ajax({
	  type: "GET",
	  url: "http://"+vendorIpAddress+"/getRates?rateType="+rateType+"&date="+(new Date().getTime()),
	  crossOrigin: true,
	  contentType: 'text/plain',
	  success: function(data){
		var rows = data.split("|");
		var rates = "";
		for(r in rows){
			var columns = rows[r].split("#");
			rates = rates + "<div class='rholder'>";
			rates = rates + "<div class='rdata'><span>Rate: </span>";
			rates = rates + columns[0];
			rates = rates + "</div>";
			rates = rates + "<div class='rdata'><span style='color: #a3a7ad'>Validity: ";
			rates = rates + secondsToDhms(parseInt(columns[3])*60);
			rates = rates + "</span></div>";
			if(dataRateOption){
				rates = rates + "<div class='rdata'><span style='color: #a3a7ad'>Data: ";
				if(columns[4] != ""){
					rates = rates + columns[4];
					rates = rates + " MB";
				}else{
					rates = rates + "unlimited";
				}
				rates = rates + "</span></div>";
			}
			rates = rates + "</div>";
		}
		$("#ratesBody").html(rates);
	  },error: function (jqXHR, exception) {
		  setTimeout(function() {
			if(retryCount < 2){
				populatePromoRates(retryCount+1);
			}
		  }, 1000 );
	  }
	});
}

$('#chargingModal').on('shown.bs.modal', function (e) {
	populateChargingStations(0);
})

function populateChargingStations(retryCount){
	clearInterval(chargerTimer);
	chargerTimer = setInterval(refreshChargerTimer, 1000);
	$.ajax({
	  type: "GET",
	  url: "http://"+vendorIpAddress+"/getChargingStation?date="+(new Date().getTime()),
	  crossOrigin: true,
	  contentType: 'text/plain',
	  success: function(data){
		var rows = data.split("|");
		var chargingStation = "";
		for(r in rows){
			var columns = rows[r].split("#");
			var curDate = new Date();
			var targetTimestamp  = 0;
			var pinSetting = columns[1];
			var targetTime = parseInt(columns[3]);
			if(targetTime > 0){
				var targetTimeDate = new Date(targetTime * 1000);
				if(targetTimeDate.getTime() > curDate.getTime()){
					targetTimestamp  = targetTimeDate.getTime();
				}
			}
			var style = "";
			if(pinSetting == "-1"){
				style = "display: none";
			}
			chargingStation = chargingStation + "<div class='rholder' style='"+style+"' row-type='charger-port' target-time='"+targetTimestamp+"'>";
			chargingStation = chargingStation + "<div class='rdata'><span>Name: </span>";
			chargingStation = chargingStation + columns[0];
			chargingStation = chargingStation + "</div>";
			chargingStation = chargingStation + "<div class='rdata'><span style='color: #a3a7ad'>Status: <span name='portStatus'>-";
			chargingStation = chargingStation + "</span></span></div>";
			chargingStation = chargingStation + "<div class='rdata'><span style='color: #a3a7ad'>Remaining: <span name='remainTime'>-";
			chargingStation = chargingStation + "</span></span></div>";
			chargingStation = chargingStation + "<div class='rdata'><span style='color: #a3a7ad'>";
			chargingStation = chargingStation + "<button class='btn btn-success' style='display: none' name='useBtn' onClick=\"addChargerTime("+r+", \'"+columns[0]+"\',0)\">Avail</button>";
			chargingStation = chargingStation + "</span></div>";
			chargingStation = chargingStation + "</div>";
		}
		
		$("#chargingBody").html(chargingStation);
	  },error: function (jqXHR, exception) {
		  setTimeout(function() {
			if(retryCount < 2){
				populateChargingStations(retryCount+1);
			}
		  }, 1000 );
	  }
	});
}

function refreshChargerTimer(){
	$("[row-type='charger-port']").each(function () {
       var targetTime = parseInt($(this).attr('target-time'));	
	   var curDate = new Date();
	   var portStatus = "Available";
	   if(targetTime > 0){
			if(targetTime > curDate.getTime()){
				difference = (targetTime- curDate.getTime()) / 1000;
				$(this).find("[name='remainTime']").html(secondsToDhms(difference));
				portStatus = "In Use";
			}else{
				portStatus = "Available";
				$(this).find("[name='useBtn']").attr('style','display: block');
			}
	   }else{
		   $(this).find("[name='useBtn']").attr('style','display: block');
	   }
	   $(this).find("[name='portStatus']").html(portStatus);
  });
}

function onRateTypeChange(evt){
	rateType = $(evt).val();
	populatePromoRates(0);
}

function addChargerTime(port, portName, retryCount){
	topupMode = TOPUP_CHARGER;
	$.ajax({
	  type: "POST",
	  url: "http://"+vendorIpAddress+"/topUp",
	  data: "voucher="+portName+"&topupType=CHARGER&chargerPort="+port+"&mac="+mac,
	  success: function(data){
		hideLoader();
		if(data.status == "true"){
			voucher = data.voucher;
			$('#insertCoinModal').modal('show');
			insertingCoin = true;
			$('#codeGeneratedBlock').attr('style', 'display: none');
			if(timer == null){
				timer = setInterval(checkCoin, 1000);
			}
			if(isMultiVendo){
				$("#insertCoinModalTitle").html("Please insert the coin on "+$("#vendoSelected option:selected").text());
			}
			insertcoinbg.play();
		}else{
			notifyCoinSlotError(data.errorCode);
			clearInterval(timer);
			timer = null;
		}
	  },error: function (jqXHR, exception) {
		  setTimeout(function() {
			if(retryCount < 2){
				addChargerTime(port, portName, retryCount+1);
			}
		  }, 1000 );
	  }
	});
}

function callTopupAPI(retryCount){
	$('#cncl').html("Cancel");
	$("#vcCodeDiv").attr('style', 'display: block');
	var type = $( "#saveVoucherButton" ).attr('data-save-type');

	var ipAddCriteria = "";
	if( typeof uIp !== 'undefined' ){
		ipAddCriteria = "&ipAddress="+uIp;
	}

	if(type == "extend"){
		extendTimeCriteria = "&extendTime=1";
	}else{
		extendTimeCriteria = "&extendTime=0";
	}
	
	$.ajax({
	  type: "POST",
	  url: "http://"+vendorIpAddress+"/topUp",
	  data: "voucher="+voucher+"&mac="+mac+ipAddCriteria+extendTimeCriteria,
	  success: function(data){
		hideLoader();
		if(data.status == "true"){
			voucher = data.voucher;
			$('#insertCoinModal').modal('show');
			insertingCoin = true;
			$('#codeGenerated').html(voucher);
			$('#codeGeneratedBlock').attr('style', 'display: none');
			if(timer == null){
				timer = setInterval(checkCoin, 1000);
			}
			if(isMultiVendo){
				$("#insertCoinModalTitle").html("Please insert the coin on "+$("#vendoSelected option:selected").text());
			}
			insertcoinbg.play();
		}else{
			notifyCoinSlotError(data.errorCode);
			clearInterval(timer);
			timer = null;
		}
	  },error: function (jqXHR, exception) {
		  setTimeout(function() {
			if(retryCount < 3){
				callTopupAPI(retryCount+1);
			}else{
				hideLoader();
				notifyCoinSlotError("coin.slot.notavailable");
			}
		  }, 1000 );
	  }
	});
}

function saveVoucherBtnAction(){
	showLoader();
	
	if(topupMode == TOPUP_INTERNET){
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
	  url: "http://"+vendorIpAddress+"/useVoucher",
	  data: "voucher="+voucher,
	  success: function(data){
	
			totalCoinReceived = 0;
			hideLoader();
			if(data.status == "true"){
				if(topupMode == TOPUP_CHARGER){
					populateChargingStations();
					$.toast({
						  title: 'Success',
						  content: 'Thank you for the purchase!, you can now use the service',
						  type: 'success',
						  delay: 3000
					});
				}else{
					setStorageValue(voucher+"tempValidity", data.validity);
					
					$.toast({
					  title: 'Success',
					  content: 'Thank you for the purchase! Page will reload shortly',
					  type: 'success',
					  delay: 3000
					});

					setTimeout(function (){
						newLogin();
					}, 1000);
				}
			}else{
				notifyCoinSlotError(data.errorCode);
			}
		
		
	  },error: function (jqXHR, exception) {
		 hideLoader();
		 if(totalCoinReceived > 0){
		    $.toast({
			  title: 'Warning',
			  content: 'Connect/Login failed, however coin has been process, please manually connect using this voucher: '+voucher,
			  type: 'info',
			  delay: 8000
			});
			setTimeout(function (){
				newLogin();
			}, 3000);
		 }
	  }
	});
	
}

function checkCoin(){
	$.ajax({
	  type: "POST",
	  url: "http://"+vendorIpAddress+"/checkCoin",
	  data: "voucher="+voucher,
	  success: function(data){
		$("#noticeDiv").attr('style', 'display: none');
		if(data.status == "true"){
			totalCoinReceived = parseInt(data.totalCoin);
			
			$('#totalCoin').html(data.totalCoin);	
			$('#totalTime').html(secondsToDhms(parseInt(data.timeAdded)));
			if(topupMode == TOPUP_INTERNET){
				$('#codeGeneratedBlock').attr('style', 'display: block');
				$('#totalData').html(data.data);
				$('#voucherInput').val(voucher);
			}
			
			setStorageValue('activeVoucher', voucher);
			setStorageValue('totalCoinReceived', totalCoinReceived);
			setStorageValue(voucher+"tempValidity", data.validity);
			notifyCoinSuccess(data.newCoin);
		}else{
			if(data.errorCode == "coin.is.reading"){
				$("#noticeDiv").attr('style', 'display: block');
				$("#noticeText").html("Verifying, please wait..");
			}
			else if(data.errorCode == "coin.not.inserted"){
				setStorageValue(voucher+"tempValidity", data.validity);
				
				var remainTime = parseInt(parseInt(data.remainTime)/1000);
				var waitTime = parseFloat(data.waitTime);
				var percent = parseInt(((remainTime*1000) / waitTime) * 100);
				totalCoinReceived = parseInt(data.totalCoin);
				if(totalCoinReceived > 0 ){
					$( "#saveVoucherButton" ).prop('disabled', false);
					$( "#cncl" ).prop('disabled', true);
				}
				if(remainTime == 0){
					$('#insertCoinModal').modal('hide');
					insertcoinbg.pause();
					insertcoinbg.currentTime = 0.0;
					if(totalCoinReceived > 0){

						if(topupMode == TOPUP_INTERNET){
							$.toast({
								title: 'Success',
								content: 'Coin slot expired!, but was able to succesfully process the coin '+totalCoinReceived +". Page will reload shortly",
								type: 'info',
								delay: 5000
							});
							var type = $( "#saveVoucherButton" ).attr('data-save-type');
							setTimeout(function (){
								newLogin();
							}, 1000);
						}else if(topupMode == TOPUP_CHARGER){
							populateChargingStations();
							$.toast({
								title: 'Success',
								content: 'Coin slot expired!, but was able to succesfully process the coin '+totalCoinReceived + " you can now use the service",
								type: 'info',
								delay: 5000
							});
						}
					}else{
						notifyCoinSlotError('coins.wait.expired');
					}
				}else{
					totalCoinReceived = parseInt(data.totalCoin);
					if(totalCoinReceived > 0 ){
						$( "#saveVoucherButton" ).prop('disabled', false);
						$( "#cncl" ).prop('disabled', true);
						$('#codeGeneratedBlock').attr('style', 'display: block');
					}
					$('#totalCoin').html(data.totalCoin);
					$('#totalData').html(data.data);
					$('#totalTime').html(secondsToDhms(parseInt(data.timeAdded)));
					//$( "#remainingTime" ).html(remainTime);
					$("#progressDiv").attr('style','width: '+percent+'%')
				}
				
			}else if(data.errorCode == "coinslot.busy"){
				//when manually cleared the button
				insertcoinbg.pause();
				insertcoinbg.currentTime = 0.0;
				clearInterval(timer);
				$('#insertCoinModal').modal('hide');
				if(totalCoinReceived == 0){
					notifyCoinSlotError("coinslot.cancelled");
				}else{
					 $.toast({
						title: 'Success',
						content: 'Coin slot cancelled!, but was able to succesfully process the coin '+totalCoinReceived +". Page will reload shortly",
						type: 'info',
						delay: 5000
					  });
					  var type = $( "#saveVoucherButton" ).attr('data-save-type');
					  setTimeout(function (){
						  newLogin();
					  }, 3000);
				}
			}else{
				notifyCoinSlotError(data.errorCode);
				clearInterval(timer);
			}
		}
	  },error: function (jqXHR, exception) {
	  }
	});
}

function convertVoucherAction(){
	var vc = $("#convertVoucherCode").val();
	if(vc != ""){
		voucherToConvert = vc;
		$( "#convertBtn" ).prop('disabled', true);
		$.ajax({
			type: "POST",
			url: "http://"+vendorIpAddress+"/convertVoucher",
			data: "voucher="+voucher+"&convertVoucher="+voucherToConvert,
			success: function(data){
				if(data.status == "true"){
					$.toast({
						title: 'Success',
						content: 'Voucher converted succesfully',
						type: 'info',
						delay: 1000
					  });
				}else{
					notifyCoinSlotError("convertVoucher.invalid");
				}
				$( "#convertVoucherCode" ).val("");
				$( "#convertBtn" ).prop('disabled', false);
				voucherToConvert = "";
			},error: function(){
				notifyCoinSlotError("convertVoucher.invalid");
				$( "#convertVoucherCode" ).val("");
				$( "#convertBtn" ).prop('disabled', false);
				voucherToConvert = "";
			}
		  });
	}else{
		notifyCoinSlotError("convertVoucher.empty");
	}
}

function notifyCoinSlotError(errorCode){
	$.toast({
	  title: 'Error',
	  content: errorCodeMap[errorCode],
	  type: 'error',
	  delay: 5000
	});
}

function notifyCoinSuccess(coin){
	$.toast({
	  title: 'Coin inserted',
	  content: coin+' peso(s) was inserted',
	  type: 'success',
	  delay: 2000
	});
	coinCount.play();
}

function secondsToDhms(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600*24));
	var h = Math.floor(seconds % (3600*24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);

	var dDisplay = d > 0 ? d + (d == 1 ? " Day " : " Days ") : "";
	var hDisplay = h > 0 ? h + (h == 1 ? "" : "") : "0";
	var mDisplay = m > 0 ? m + (m == 1 ? "" : "") : "0";
	var sDisplay = s > 0 ? s + (s == 1 ? "" : "") : "0";
	return dDisplay + " " + hDisplay + "h : " + mDisplay + "m : " + sDisplay + "s";
}

function setStorageValue(key, value){
	if(localStorage != null){
		localStorage.setItem(key, value);
	}else{
		setCookie(key,value,364);
	}
}

function removeStorageValue(key){
	if(localStorage != null){
		localStorage.removeItem(key);
	}else{
		eraseCookie(key);
	}
}

function clearStorageValues(){
	localStorage.clear();
}

function pause(macNoColon){
	showLoader();
	setStorageValue("isPaused", "1");
	logoutVoucher(macNoColon, function(){
		hideLoader();
	});
}

function resume(){
	removeStorageValue("isPaused");
	removeStorageValue("activeVoucher");
	removeStorageValue("ignoreSaveCode");
	location.reload();
}

function getStorageValue(key){
	if(localStorage!= null){
		return localStorage.getItem(key);
	}else{
		return getCookie(key);
	}
}

function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {   
    document.cookie = name+'=; Max-Age=-99999999;';  
}

function parseTime(str){
	try{
		if(!str) return null;

		var timeArr = str.split(":");
		if(timeArr.length == 3){
			var hr = Number(timeArr[0]);
			var min = Number(timeArr[1]);
			var sec = Number(timeArr[2]);

			let totalSeconds = (hr*3600) + (min*60) + sec;

			return totalSeconds;
		}
		return null;
	}catch(e) {
		return null;
	}
}

function fetchUserInfo(macNoColon, pointsEnabled, cb){
	var params = `mac=${macNoColon}`
	var activeMac = getStorageValue('activeVoucher')

	if(activeMac && activeMac !== ""){
		params += `&oldMac=${activeMac}`
	}

	fetchPortalAPI(`/user-info?${params}`, "GET", vendorIpAddress, null)
	.then(result => {
		if((!result) || (!result?.success)){
			cb(null, result?.error ?? "Server request failed.");
			return;
		}
		let data = result?.data;
		if(!data) {
			cb(null, null);
			return;
		}

		var isOnline = data.isOnline;
		var voucherCode = data.code;
		var totalPoints = data.totalPoints;
		var timeRemainingStr = data.timeRemaining;
		var timeRemaining = data.timeRemainingInSeconds;
		var timeExpiry = data.timeExpiry;
		
		cb({
			isOnline,
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

function fetchPortalConfig(cb){
	fetchPortalAPI("/config", "GET", null, null)
	.then(result => {
		if((!result) || (!result?.success)){
			cb(null, result?.error ?? "Server request failed.");
			return;
		}
		let data = result?.data;
		if(!data) {
			cb(null, null);
			return;
		}
		let output = { ...data };
		cb(output, null);
	})
	.catch(error => {
		cb(null, error);
	});
}

function parseRewardPoints(text){
	try{
		var n = parseFloat((text||"0").toString());
		return isNaN(n) ? 0 : n;
	}catch(e){
		return 0;
	}
}

function updateRedeemRewardPtsUI(from){
	// from: 'slider' | 'input' | undefined
    var min = parseInt($('#redeemSlider').attr('min')) || 0;
    var max = parseInt($('#redeemSlider').attr('max')) || 0;
    var sliderVal = parseInt($('#redeemSlider').val()) || 0;
    var inputVal = parseInt($('#selectedPointsInput').val()) || 0;
    var selected = sliderVal;

    if(from === 'input'){
        // clamp input
        if((!inputVal) || isNaN(inputVal)) inputVal = 0;
        if(inputVal < min) inputVal = min;
        if(max > 0 && inputVal > max) inputVal = max;
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
    if(selected > min && (max === 0 || selected <= max)){
        $("#confirmRedeemBtn").removeClass("disabled");
    } else {
        $("#confirmRedeemBtn").addClass("disabled");
    }
}

function onRedeemRewardPtsEvt(macNoColon, wheelConfig){
	var redeemPtsBtn = document.getElementById("redeemPtsBtn");
	redeemPtsBtn.onclick = function(e){
		e.preventDefault();
		var avail = parseRewardPoints($('#rewardPoints').text());
		if(avail <= 0){
			$.toast({ title: 'Info', content: 'No reward points available to redeem.', type: 'info', delay: 3000 });
			return;
		}
		var min = parseInt($('#redeemSlider').attr('min')) || 0;
		$(".availablePointsDisplay").html((!!avail) ? avail.toFixed(2) : "0.00");
		$('#redeemSlider').attr('max', parseInt(avail));
		$('#redeemSlider').val(min);
		$('#selectedPointsInput').attr('max', avail);
        $('#selectedPointsInput').val(min);
		updateRedeemRewardPtsUI('input');
		$('#redeemModal').modal('show');
	};

	if(!!wheelConfig){
		var spinRedeemBtn = document.getElementById("spinRedeemBtn");
		spinRedeemBtn.onclick = function(e){
			e.preventDefault();
			var avail = rewardPointsBalance;
			if(avail <= 0){
				$.toast({ title: 'Info', content: 'No reward points available to redeem.', type: 'info', delay: 3000 });
				return;
			}
			spinBtn.disabled = false;
			$("#redeemedValueWrapper").addClass("hide");
			$("#selectedReward").text("")

			$(".availablePointsDisplay").html((!!avail) ? avail.toFixed(2) : "0.00");
			$("#spinBtn").text("Spin");
			$('#redeemBySpinModal').modal('show');
			
			const colors = ["#FFD6E8","#E0F7FA","#FFF7C0","#E8F6E9","#FDEFEF","#E8EAF6","#FBE9E7","#E6F0FF"];
			drawSpinWheel(macNoColon, wheelConfig, colors);
		};
	}
}

function onRedeemRewardPtsSliderChangeEvt(){
	$('#redeemSlider').on('input change', function(){
		updateRedeemRewardPtsUI('slider');
	});
	$('#selectedPointsInput').on('input change', function(){
        // ensure integer
        var v = $(this).val();
        var intV = parseInt(v, 10);
        if(isNaN(intV)) intV = 0;
        $(this).val(intV);
        updateRedeemRewardPtsUI('input');
    });
}

function onRedeemRewardPtsConfirmBtnEvt(macNoColon){
	var confirmRedeemBtn = document.getElementById("confirmRedeemBtn");
	confirmRedeemBtn.onclick = function(){
		var selected = parseInt($('#selectedPointsInput').val(),10) || 0;
		if(selected <= 0){
			$.toast({ title: 'Warning', content: 'Please select at least 1 point to redeem.', type: 'warning', delay: 2500 });
			return;
		}
		var estimatedPhp = (selected * redeemRatioValue).toFixed(2);
		showLoader();
		try{
			$.ajax({
				type: "POST",
				url: `http://${vendorIpAddress}/redeemPoints?mac=${macNoColon}&points=${selected}`,
				success: function(result){
					if(!result) {
						$.toast({
							title: 'Failed',
							content: 'Request failed. Please try again.',
							type: 'error',
							delay: 4000
						});
						return;
					}

					if(result.status === "false"){
						$.toast({
							title: 'Failed',
							content: 'Failed to redeem points.',
							type: 'error',
							delay: 4000
						});
						return;
					}else{
						var timeAdded = parseInt(result.timeAdded);
						$('#redeemModal').modal('hide');
						$.toast({
							title: 'Success',
							content: 'Redeemed ' + selected + ' points (PHP ' + estimatedPhp + '). Added',
							content: `Redeemed ${selected} points (PHP ${estimatedPhp}). Added ${secondsToDhms(timeAdded*60)} time to current voucher.`,
							type: 'success',
							delay: 4000
						});
						setTimeout(function (){
							newLogin();
				 		}, 1000); 
					}
				},
				error: function(d){
					$.toast({
						title: 'Failed',
						content: 'Failed to connect to server. Try again later.',
						type: 'error',
						delay: 4000
					});
				},
				complete: function(){
					hideLoader();
				}
			});
		}catch(e){
			hideLoader();
			$.toast({
				title: 'Failed',
				content: 'Runtime error. Contact vendo owner.',
				type: 'error',
				delay: 4000
			});
		}
	};
}

function logoutVoucher(macNoColon){
	fetchPortalAPI(`/logout`, "POST", vendorIpAddress, {mac: macNoColon})
	.then(result => {
		if((!result) || (!result?.success)){
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
		if((!!data) || (data?.status === "success")) {
			$("#resumeTimeBtn").removeClass("hide");
			$.toast({
				title: 'Success',
				content: 'You have been successfully disconnected to the network. Page will reload shortly',
				type: 'success',
				delay: 4000
			});

			setTimeout(function (){
				newLogin();
			}, 1000);
		}else{
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
		cb(false);
	});
}

function loginVoucher(macNoColon, cb){
	fetchPortalAPI(`/login`, "POST", vendorIpAddress, {mac: macNoColon})
	.then(result => {
		if((!result) || (!result?.success)){
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
		if((!!data) || (data?.status === "success")) {
			cb(true);
		}else{
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

function updateDeviceDateTime() {
	var now = new Date();
	$("#deviceDate").text(now);
}

function checkIsLoggedIn(macNoColon){
	fetchUserInfo(macNoColon, null, function(userData, error){
		if(!!error){
			hideLoader();
			return;
		}
		let {isOnline} = userData;
		if(isOnline){
			$.toast({
				title: 'Success',
				content: 'You are now connected. Page will reload shortly.',
				type: 'success',
				delay: 4000
			});
		}

		setTimeout(function (){
			hideLoader();
			newLogin();
		}, 1000);
	});
}

function fetchSpinWheelReward(mac, cb){
	fetchPortalAPI("/promo/spin-wheel", "POST", vendorIpAddress, JSON.stringify({mac}), {contentType: 'application/json; charset=utf-8', dataType: "json"})
	.then(result => {
		if((!result) || (!result?.success)){
			cb(null, result?.error ?? "Server request failed.");
			return;
		}
		let data = result?.data;
		if(!data) {
			cb(null, null);
			return;
		}
		cb (data, null);
	})
	.catch(error => {
		cb(null, error);
	})
}

function drawSpinWheel(mac, prizes, colors){
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
	function generateExpandedPrizes(){
		expandedPrizes = [];
		const maxSlices = 10;
		
		// Calculate total winning percentage
		let totalPercentage = 0;
		prizes.forEach(p => {
			if(p){
				let winPercent = Math.floor(p.percentage);
				if(winPercent > 0){
					totalPercentage += winPercent;
				}
			}
		});
		
		// If no percentages set, just use original prizes
		if(totalPercentage === 0){
			expandedPrizes = prizes.slice();
			return;
		}
		
		const maxPercentage = 100;
		
		// Distribute prizes proportionally to fill max 10 slices
		prizes.forEach(p => {
			if(p && p.percentage > 0){
				// Calculate how many slices this prize should occupy
				const proportion = p.percentage / maxPercentage;
				const sliceCount = Math.max(1, Math.round(proportion * maxSlices));
				// Add this prize multiple times
				for(let i = 0; i < sliceCount; i++){
					expandedPrizes.push(p);
				}
			}
		});
		
		// Trim to exactly 10 slices if needed (remaining slots become blank)
		if(expandedPrizes.length > maxSlices){
			expandedPrizes = expandedPrizes.slice(0, maxSlices);
		}
		
		// Pad remaining slices with undefined (blank)
		while(expandedPrizes.length < maxSlices){
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
	let center = {x:0,y:0};
	let radius = 0;
	let currentRotation = 0; // radians
	let spinning = false;
	let lastSliceSound = -1;

	/* ===== Resize (set CSS size + backing store for DPR) ===== */
	function resizeAll(){
		dpr = Math.max(window.devicePixelRatio || 1, 1);
		const shown = Math.min(window.innerWidth * 0.9, wheelSize);
		displaySize = Math.round(shown);

		// wheel canvas (use CSS px coordinates)
		wheelCanvas.style.width = displaySize + 'px';
		wheelCanvas.style.height = displaySize + 'px';
		wheelCanvas.width = displaySize * dpr;
		wheelCanvas.height = displaySize * dpr;
		wheelCtx.setTransform(dpr,0,0,dpr,0,0);

		center.x = displaySize / 2;
		center.y = displaySize / 2;
		radius = (displaySize / 2) - 18;

		// redraw
		drawWheel(currentRotation);
	}
	
	if(!spinEventsCreated){
		window.addEventListener('resize', resizeAll);
	}
	resizeAll();

	/* ===== draw wheel (rotation in radians) and optional highlighted slice ===== */
	function drawWheel(rotationRad = 0, highlightIndex = null, highlightAlpha = 0){
		const ctx = wheelCtx;
		ctx.clearRect(0,0,displaySize,displaySize);

		const displayPrizes = expandedPrizes.length > 0 ? expandedPrizes : prizes;
		const slice = (2 * Math.PI) / displayPrizes.length;

		// draw wheel rotated
		ctx.save();
		ctx.translate(center.x, center.y);
		ctx.rotate(rotationRad);
		ctx.translate(-center.x, -center.y);

		for(let i=0;i<displayPrizes.length;i++){
			const start = i * slice;
			ctx.beginPath();
			ctx.fillStyle = colors[i % colors.length];
			ctx.moveTo(center.x, center.y);
			ctx.arc(center.x, center.y, radius, start, start + slice);
			ctx.closePath();
			ctx.fill();

			// label (only if prize is defined)
			if(displayPrizes[i] && displayPrizes[i].promoName){
				ctx.save();
				ctx.translate(center.x, center.y);
				ctx.rotate(start + slice/2);
				ctx.fillStyle = "#2b2b2b";
				ctx.font = `${Math.max(12, displaySize/24)}px Arial`;
				ctx.textAlign = 'right';
				ctx.fillText(displayPrizes[i].promoName, radius - 12, 6);
				ctx.restore();
			}
		}

		// highlight overlay in wheel's rotated coordinate system
		if(highlightIndex !== null && highlightAlpha > 0){
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

	function drawPointer(){
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
	function rotationToIndex(rotationRad){
		const displayPrizes = expandedPrizes.length > 0 ? expandedPrizes : prizes;
		const rotDeg = ((rotationRad * 180 / Math.PI) % 360 + 360) % 360;
		const pointerDeg = (270 - rotDeg + 360) % 360; // top = 270 deg
		const sliceDeg = 360 / displayPrizes.length;
		let idx = Math.floor(pointerDeg / sliceDeg);
		idx = ((idx % displayPrizes.length) + displayPrizes.length) % displayPrizes.length;
		return idx;
	}

	/* ===== spin logic (choose target index via API) ===== */
	function spinWheel(){
		if(spinning) return;

		spinning = true;
		spinBtn.disabled = true;
		if(isSpinTriggered){
			// fetch prize index from API
			fetchSpinWheelReward(mac, (result, error) => {
				if(!!error){
					$.toast({
						title: 'Failed',
						content: error ?? 'Server request failed.',
						type: 'error',
						delay: 4000
					});
					return;
				}
				let prizeIndex = expandedPrizes.findIndex(x => x.promoName === result.promoName);
				rewardPointsBalance = !!result ? result.remainingPoints : 0;
				
				$(".availablePointsDisplay").text((!!rewardPointsBalance) ? rewardPointsBalance.toFixed(2) : "0.00");
				executeSpin(prizeIndex, result, error);
				if(rewardPointsBalance > 0){
					spinBtn.disabled = true;
				}
				
				isSpinTriggered = false;
			});
		}
		
	}

	/* ===== execute spin animation with chosen index ===== */
	function executeSpin(chosenIndex, apiPrize, error){
		if(!!error) chosenIndex = -1;
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

		function step(ts){
			if(!startTime) startTime = ts;
			const elapsed = ts - startTime;
			const t = Math.min(1, elapsed / duration);
			const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
			const nowRot = startRot + (targetRotation - startRot) * ease;

			drawWheel(nowRot);

			// click sound when we move across slices
			const idx = rotationToIndex(nowRot);
			if(idx !== lastSliceSound){
				lastSliceSound = idx;
				//try{ clickSound.currentTime = 0; clickSound.play().catch(()=>{}); }catch(e){}
			}

			if(t < 1){
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
				if((!prizeToShow) || (!prizeToShow.promoName) || (prizeToShow.rewardValue <= 0)){
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
				
				if(rewardPointsBalance >= redeemRatioValue){
					spinBtn.disabled = false;
				}
				spinning = false;
				spinBtn.textContent = "SPIN AGAIN";
			});
		}

		requestAnimationFrame(step);
	}

	/* ===== smooth pulse highlight (alpha rises/falls) ===== */
	function pulseHighlight(index, pulses = 3, pulseDuration = 700, callback){
		const total = pulses * pulseDuration;
		const start = performance.now();
		function frame(now){
			const elapsed = now - start;
			if(elapsed >= total){
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
	function shufflePrizes(){
		// Fisher-Yates shuffle algorithm
		const target = (expandedPrizes && expandedPrizes.length > 0) ? expandedPrizes : prizes;
		for(let i = target.length - 1; i > 0; i--){
			const j = Math.floor(Math.random() * (i + 1));
			[target[i], target[j]] = [target[j], target[i]];
		}
	}

	if(!spinEventsCreated){
		/* ===== events & init ===== */
		window.addEventListener('resize', ()=>{
			resizeAll();
		});
		spinBtn.onclick = ()=> {
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
	function resizeAll(){
		resizeAll = null; // prevent recursion
		resizeAll = function(){ resizeAll = function(){}; }; // dummy replacement
		// Call the real function body:
		dpr = Math.max(window.devicePixelRatio || 1, 1);
		const shown = Math.min(window.innerWidth * 0.9, wheelSize);
		displaySize = Math.round(shown);
		wheelCanvas.style.width = displaySize + 'px';
		wheelCanvas.style.height = displaySize + 'px';
		wheelCanvas.width = displaySize * dpr;
		wheelCanvas.height = displaySize * dpr;
		wheelCtx.setTransform(dpr,0,0,dpr,0,0);
		center.x = displaySize/2; center.y = displaySize/2; radius = (displaySize/2)-18;
		drawWheel(currentRotation);
	}
	/* replace placeholder with proper function */
	resizeAll = function(){
		dpr = Math.max(window.devicePixelRatio || 1, 1);
		const shown = Math.min(window.innerWidth * 0.9, wheelSize);
		displaySize = Math.round(shown);
		wheelCanvas.style.width = displaySize + 'px';
		wheelCanvas.style.height = displaySize + 'px';
		wheelCanvas.width = displaySize * dpr;
		wheelCanvas.height = displaySize * dpr;
		wheelCtx.setTransform(dpr,0,0,dpr,0,0);
		center.x = displaySize/2; center.y = displaySize/2; radius = (displaySize/2)-18;
		drawWheel(currentRotation);
	};

	if(!spinEventsCreated){
		window.addEventListener('resize', resizeAll);
	}

	// ensure initial sizes are correct:
	resizeAll();
	spinEventsCreated = true;
}

function showLoader(){
	$("#loaderDiv").removeClass("hidden");
}

function hideLoader(){
	$("#loaderDiv").addClass("hidden");
}

function useVoucherBtnEvt(){
	const connectBtn = document.getElementById('connectBtn');
	connectBtn.onclick = function(e){
		e.preventDefault();
		showLoader();
		if(!macNoColon){
			$.toast({ title: 'Failed', content: "Unable to read device MAC Address.", type: 'error', delay: 3000 });
			return;
		}
		if(!vendorIpAddress){
			$.toast({ title: 'Failed', content: "Vendo not fully setup.", type: 'error', delay: 3000 });
			return;
		}
		
		var voucherCode = $("#voucherInput").val();
		if(!voucherCode){
			$.toast({ title: 'Failed', content: 'Voucher code is required.', type: 'error', delay: 3000 });
			hideLoader();
			return;
		}

		fetchUseVoucher(macNoColon, vendorIpAddress, voucherCode, function(success, error){
			if(success){
				$.toast({
					title: 'Success',
					content: 'You have successfully used your voucher! Page will reload shortly',
					type: 'success',
					delay: 3000
				});

				setTimeout(function (){
					hideLoader();
					newLogin();
				}, 3000);
			}else{
				hideLoader();
				$.toast({ title: 'Failed', content: error ?? "Server request failed.", type: 'error', delay: 3000 });
				
				return;
			}
		});
	}
}

function fetchUseVoucher(macNoColon, vendorIpAddress, voucherCode, cb){
	fetchPortalAPI(`/use-voucher`, "POST", vendorIpAddress, {mac: macNoColon, code: voucherCode})
	.then(result => {
		if((!result) || (!result?.success)){
			cb(null, result?.error ?? "Server request failed.");
			return;
		}
		let data = result?.data;
		if((!!data) || (data?.status === "success")) {
			cb (true, null);
		}else{
			cb(false, data?.message ?? "Failed to use voucher.");
		}
	})
	.catch(error => {
		cb(null, error);
	});
}

function parseAjaxErrorResponse(jqXHR, textStatus, errorThrown){
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
function fetchPortalAPI(apiUrl, type, vendorIpAddress, params, options){
	return new Promise(function(resolve, reject) {
		try{
			const timestamp = new Date().getTime();
			const separator = apiUrl.includes("?") ? "&" : "?";
			const finalUrl = `${juanfiExtendedServerUrl}${apiUrl}${separator}t=${timestamp}`;

			let headers = {
				...(!!vendorIpAddress) ? {'X-IP': vendorIpAddress} : undefined,
			};

			return $.ajax({
				type,
				url: finalUrl,
				headers,
				data: params,
				...options,
				success: function(data){
					if(!data) {
						resolve({
							success: false,
							error: "Failed to fetch."
						});
					}else{
						resolve({
							success: true,
							data
						});
					}
				},
				error: function(jqXHR, textStatus, errorThrown){
					let err = parseAjaxErrorResponse(jqXHR, textStatus, errorThrown);
					reject(err?.message ?? "Server request failed!");
				}
			});
		}catch(e){
			reject("Runtime error!");
		}
	});
}


function showPointsRedeemBtns(totalPoints, pointsEnabled, wheelConfig){
	$("#rewardBtnWrapper").addClass("hide");
	if(pointsEnabled && totalPoints > 0){
		$("#redeemWrapper").removeClass("hide");
		if((!!wheelConfig) && wheelConfig?.length > 0){
			$("#spinWrapper").removeClass("hide");
			$("#spinWrapper").removeClass("col-sm-12");
			$("#spinWrapper").addClass("col-sm-6");
			$("#redeemWrapper").removeClass("col-sm-12");
			$("#redeemWrapper").addClass("col-sm-6");
		}else{
			$("#spinWrapper").addClass("hide");
			$("#spinWrapper").removeClass("col-sm-6");
			$("#spinWrapper").addClass("col-sm-12");
			$("#redeemWrapper").removeClass("col-sm-6");
			$("#redeemWrapper").addClass("col-sm-12");
		}
		$("#rewardBtnWrapper").removeClass("hide");
		onRedeemRewardPtsEvt(macNoColon, wheelConfig);
		onRedeemRewardPtsConfirmBtnEvt(macNoColon);
		onRedeemRewardPtsSliderChangeEvt();
	}else{
		$("#redeemWrapper").addClass("hide");
		$("#spinWrapper").addClass("hide");
		$("#rewardBtnWrapper").addClass("hide");
	}
}