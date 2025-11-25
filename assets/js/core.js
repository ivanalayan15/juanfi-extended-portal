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

var totalCoinReceived = 0;
var insertcoinbg = new Audio('assets/insertcoinbg.mp3');
insertcoinbg.loop = true;
var coinCount = new Audio('assets/coin-received.mp3');
var voucher = getStorageValue('activeVoucher');
var insertingCoin = false;
var TOPUP_CHARGER = "CHARGER";
var TOPUP_INTERNET = "INTERNET";
var TOPUP_ELOAD = "ELOAD";
var topupMode = TOPUP_INTERNET;
var chargerTimer = null;
var rateType = "1";
var autologin = false;
var voucherToConvert = "";

var juanfiExtendedServerUrl = `http://${juanfiExtendedServerIP}:8080/api/portal`; //do not change value of this line

var redeemRatioValue = 1; //do not change value of this line to avoid conflict/misrepresentation of UI to API data

//this is to enable multi vendo setup, set to true when multi vendo is supported
var isMultiVendo = true;
// 0 = traditional (client choose a vendo) , 1 = auto select vendo base on hotspot address, 2 = interface name ( this will preserve one hotspot server ip only)
var multiVendoOption = 0;

//list here all node mcu address for multi vendo setup
var multiVendoAddresses = [
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
var loginOption = 0; //replace 1 if you want login voucher by username + password

var dataRateOption = false; //replace true if you enable data rates
//put here the default selected address
var vendorIpAddress = "10.10.10.252";

var chargingEnable = false; //replace true if you enable charging, this can be override if multivendo setup

var eloadEnable = false; //replace true if you enable eload, this can be override if multivendo setup

//hide pause time / logout true = you want to show pause / logout button
var showPauseTime = true;

//enable member login, true = if you want to enable member login
var showMemberLogin = true;

//enable extend time button for customers
var showExtendTimeButton = true;

//disable voucher input
var disableVoucherInput = false;

//enable mac address as voucher code
var macAsVoucherCode = false;

var qrCodeVoucherPurchase = false;

var pointsEnabled = false;

$(document).ready(function(){
	//$(document).ajaxStart(function(){ $("#loaderDiv").removeClass("hidden"); });
    //$(document).ajaxStop(function(){ $("#loaderDiv").addClass("hidden"); });

	$("#ipInfo").html(uIp)
	$("#macInfo").html(mac)

	showLoader();

	fetchPortalConfig(function(data, error){
		if(!!error){
			hideLoader();
			$.toast({
				title: 'Failed',
				content: 'Failed to connect to server. Try again later.',
				type: 'error',
				delay: 4000
			});
			return;
		}

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


		// handle the data if needed
		$( "#saveVoucherButton" ).prop('disabled', true);	
		$( "#cncl" ).prop('disabled', false);
		$('#coinToast').toast({delay: 1000, animation: true});
		$('#coinSlotError').toast({delay: 5000, animation: true});
		var voucherError = false;
		
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

		if(isMultiVendo){
			if(multiVendoOption == 1){
				$("#vendoSelectDiv").addClass("hide");
				for(var i=0;i<multiVendoAddresses.length;i++){
					var currentHotspot = hotspotAddress.split(":")[0];
					if(multiVendoAddresses[i].hotspotAddress == currentHotspot){
						vendorIpAddress = multiVendoAddresses[i].vendoIp;
					}
				}  
			}else if(multiVendoOption == 2){
				$("#vendoSelectDiv").addClass("hide");
				for(var i=0;i<multiVendoAddresses.length;i++){
					var currentInterfaceName = interfaceName;
					if(multiVendoAddresses[i].interfaceName == currentInterfaceName){
						vendorIpAddress = multiVendoAddresses[i].vendoIp;
					}
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
					}
				}  
				if(selectedVendo != null){
					vendorIpAddress = selectedVendo;
				}
				$("#vendoSelected").val(vendorIpAddress);
				$("#vendoSelected").change(function(){
					vendorIpAddress = $("#vendoSelected").val();
					setStorageValue('selectedVendo', vendorIpAddress);
					evaluateChargingButton();
					evaluateEloadButton();
				});
			}
			
			$("#vendoSelected").trigger("change");

		}else{
			$("#vendoSelectDiv").addClass("hide");
		}
		
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
				evaluateChargingButton();
			}else{
				$("#chargingBtn").addClass("hide");
				$("#rateTypeDiv").addClass("hide");
			}
		}

		if(!eloadEnable){
			if(isMultiVendo){
			evaluateEloadButton();
			}else{
			$("#eloadBtn").addClass("hide");
			}
		}
		
		var redirectLogin = getStorageValue("redirectLogin");
		if(redirectLogin == "1"){
			removeStorageValue("redirectLogin");
			location.reload();
			return;
		}

		var macNoColon = replaceAll(mac, ":");

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
					content: 'Failed to retrieve your voucher details. Try again later.',
					type: 'error',
					delay: 4000
				});
				return;
			}
			let {isOnline,
				voucherCode,
				pointsEnabled,
				totalPoints,
				timeRemaining,
				timeExpiry,
				timeRemainingStr} = userData;
				
			if(pointsEnabled === true){
				var min = parseInt($('#redeemSlider').attr('min'),10) || 0;
	
				$("#rewardPoints").html((!!totalPoints) ? totalPoints.toFixed(2) : "0");
				$(".redeemRatio").text(redeemRatioValue);
				$("#rewardDtls").removeClass("hide");
				if(totalPoints > min){
					$("#rewardDtlsWrapper").removeClass("col-sm-12").addClass("col-sm-6");
					$("#rewardBtnWrapper").removeClass("hide");
					
					onRedeemRewardPtsEvt();
					onRedeemRewardPtsConfirmBtnEvt(macNoColon);
					onRedeemRewardPtsSliderChangeEvt();
				}else{
					$("#rewardDtlsWrapper").removeClass("col-sm-6").addClass("col-sm-12");
					$("#rewardBtnWrapper").addClass("hide");
				}
			}else{
				$("#rewardDtls").addClass("hide");
			}

			$("#voucherCode").html(voucherCode);
			var isPaused = (!isOnline);
			
			if(isOnline){
				$("#connectionStatus").html("Connected");
				$("#connectionStatus").attr("class", "blinking2");
				$("#statusImg").attr("src", "assets/img/wifi.png");
				$("#statusImg").removeClass("hide");
				$("#statusImg").addClass("blinking2");

				var time = timeRemaining;
				$("#remainTime").html(secondsToDhms(time));
				remainingTimer = setInterval(function(){
					time--;
					$("#remainTime").html(secondsToDhms(time));
					if(time <= 0){
						$.toast({
							title: 'Success',
							content: 'Time limit exceeded, Thank you for the purchase, will be logout shortly',
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
				$("#remainTime").html(timeRemainingStr);
				if(timeRemaining > 0){
					isPaused = true;
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

				var pausedState = getStorageValue("isPaused")
				var isLoggedIn = getStorageValue("isLoggedIn");
				
				if((!isLoggedIn) && autologin && pausedState !== "1"){
					showLoader();
					loginVoucher(macNoColon, function(success){
						if(success){
							checkIsLoggedIn();
						}
						hideLoader();
					});
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
				setStorageValue("isPaused", "1");
				$("#pauseRemainTime").html(getStorageValue(voucher+"remain"));
				$("#resumeTimeBtn").removeClass("hide");

				$('#resumeTimeBtn').on('click', function(){
					showLoader();
					loginVoucher(macNoColon, function(success){
						hideLoader();
					});
				});
			}else{
				$("#resumeTimeBtn").addClass("hide");
			}

			setStorageValue('activeVoucher', voucherCode);

			if(showPauseTime && isOnline){
				$("#pauseTimeBtn").removeClass("hide");
				$("#pauseTimeBtn").on('click', function(){
					var r = confirm("Are you sure you want to temporarily disconnect from the network?");
					if(r){
						pause(macNoColon);
					}
				});
			}else{
				$("#pauseTimeBtn").addClass("hide");
			}

			
			// Initial call to display immediately
			updateDeviceDateTime();

			// Update every second (1000 milliseconds)
			setInterval(updateDeviceDateTime, 1000);

			hideLoader();
		});
	});
});

function showLoader(){
	$("#loaderDiv").removeClass("hidden");
}

function hideLoader(){
	$("#loaderDiv").addClass("hidden");
}

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

function evaluateChargingButton(){
	//var style = $("#chargingBtn").attr("style");
	//$("#chargingBtn").attr("style", style+"; display: block"); 
	$("#chargingBtn").removeClass("hide");
	//$("#rateTypeDiv").attr("style", "display: block");
	$("#rateTypeDiv").removeClass("hide");
	for(var i=0;i<multiVendoAddresses.length;i++){
	  if(multiVendoAddresses[i].vendoIp == vendorIpAddress && (!multiVendoAddresses[i].chargingEnable)){
		  //style = $("#chargingBtn").attr("style");
		  //$("#chargingBtn").attr("style", style+"; display: none");
		  $("#chargingBtn").addClass("hide");
		  $("#rateTypeDiv").addClass("hide");
		  break;
	  }
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
					  content: 'Thank you for the purchase!, will do auto login shortly',
					  type: 'success',
					  delay: 3000
					});
					
					var type = $( "#saveVoucherButton" ).attr('data-save-type');

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
								content: 'Coin slot expired!, but was able to succesfully process the coin '+totalCoinReceived +", will do auto login shortly",
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
						content: 'Coin slot cancelled!, but was able to succesfully process the coin '+totalCoinReceived +", will do auto login shortly",
						type: 'info',
						delay: 5000
					  });
					  var type = $( "#saveVoucherButton" ).attr('data-save-type');
					  setTimeout(function (){
						  if(type == "extend"){
							  setStorageValue('reLogin', '1');
							  document.logout.submit();
						  }else{
							  newLogin();
						  }
					  }, 3000);
				}
			}else{
				notifyCoinSlotError(data.errorCode);
				clearInterval(timer);
			}
		}
	  },error: function (jqXHR, exception) {
			console.log('error!!!');
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

function newLogin(){
	location.reload();
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

	$.ajax({
		type: "GET",
		url: `${juanfiExtendedServerUrl}/user-info?${params}`,
		success: function(data){
			if(!data){
				cb(null, "No data received.");
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
		},
		error: function(d){
			cb(null, d);
	   	}
	});
}

function fetchPortalConfig(cb){
	$.ajax({
		type: "GET",
		url: `${juanfiExtendedServerUrl}/config`,
		success: function(data){
			if(!data) {
				cb(null);
				return;
			}
			let output = { ...data };
			cb(output, null);
		},
		error: function(d){
			cb(null, d);
	   	}
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

function onRedeemRewardPtsEvt(){
	$('#redeemPtsBtn').on('click', function(e){
		e.preventDefault();
		var avail = parseRewardPoints($('#rewardPoints').text());
		if(avail <= 0){
			$.toast({ title: 'Info', content: 'No reward points available to redeem.', type: 'info', delay: 3000 });
			return;
		}
		var min = parseInt($('#redeemSlider').attr('min')) || 0;
		$('#availablePointsDisplay').text(avail);
		$('#redeemSlider').attr('max', parseInt(avail));
		$('#redeemSlider').val(min);
		$('#selectedPointsInput').attr('max', avail);
        $('#selectedPointsInput').val(min);
		updateRedeemRewardPtsUI('input');
		$('#redeemModal').modal('show');
	});
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
	$('#confirmRedeemBtn').on('click', function(){
		showLoader();
		var selected = parseInt($('#selectedPointsInput').val(),10) || 0;
		if(selected <= 0){
			$.toast({ title: 'Warning', content: 'Please select at least 1 point to redeem.', type: 'warning', delay: 2500 });
			return;
		}
		var estimatedPhp = (selected * redeemRatioValue).toFixed(2);

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
	});
}

function logoutVoucher(macNoColon){
	try{
		$.ajax({
			type: "POST",
			url: `${juanfiExtendedServerUrl}/logout`,
			data: {mac: macNoColon},
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

				if(result.status === "success"){
					$("#resumeTimeBtn").removeClass("hide");
					
					$.toast({
						title: 'Success',
						content: 'You have been successfully disconnected to the network. Page will reload shortly.',
						type: 'success',
						delay: 4000
					});

					setTimeout(function (){
						newLogin();
					}, 1000);
				}else{
					$.toast({
						title: 'Failed',
						content: 'Failed to disconnect.',
						type: 'error',
						delay: 4000
					});
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
				cb();
			}
		});
	}catch(e){
		$.toast({
			title: 'Failed',
			content: 'Runtime error. Contact vendo owner.',
			type: 'error',
			delay: 4000
		});
		cb();
	}
}

function loginVoucher(macNoColon, cb){
	try{
		$.ajax({
			type: "POST",
			url: `${juanfiExtendedServerUrl}/login`,
			data: {mac: macNoColon},
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

				if(result.status === "success"){
					cb(true);
				}else{
					$.toast({
						title: 'Failed',
						content: 'Failed to connect voucher.',
						type: 'error',
						delay: 4000
					});
					cb(false);
				}
			},
			error: function(d){
				$.toast({
					title: 'Failed',
					content: 'Failed to connect to server. Try again later.',
					type: 'error',
					delay: 4000
				});
				cb(false);
			},
			complete: function(){
			}
		});
	}catch(e){
		$.toast({
			title: 'Failed',
			content: 'Runtime error. Contact vendo owner.',
			type: 'error',
			delay: 4000
		});
		cb(false);
	}
}

function updateDeviceDateTime() {
	var now = new Date();
	$("#deviceDate").text(now);
}

function checkIsLoggedIn(){
	fetchUserInfo(macNoColon, null, function(userData, error){
		if(!!error){
			throw error;
		}
		let {isOnline} = userData;
		if(isOnline){
			$.toast({
				title: 'Success',
				content: 'You are now connected. Page will reload shortly.',
				type: 'success',
				delay: 4000
			});

			setTimeout(function (){
				newLogin();
			}, 1000);
			setStorageValue("isLoggedIn", true);
		}else{
			setStorageValue("isLoggedIn", false);
		}
	});
}