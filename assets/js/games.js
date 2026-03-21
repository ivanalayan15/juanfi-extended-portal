function getGamesUrlParameter(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
    var results = regex.exec(window.location.search || "");
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

var serverIp = getGamesUrlParameter("ip");

var winningDuck = 0;
var wonPoints = 0;
var selectedDuck = null;
var isRacing = false;
var currentPoints = 0;
var duckRacingMusic = null;
var lobbyMusic = null;
var gamesPageInitialized = false;
var gamesUiBound = false;
var gamesConfigInitialized = false;
var gamesUserInfoRequestInFlight = false;
var gamesRaceInterval = null;
var lobbyMusicStarted = false;
var audioUnlockBound = false;
var audioStartRequested = false;
var gamesPointsEnabled = false;
var duckNamesPool = ["Herbie", "Allan", "Jenyl", "Arkie", "Charlie"];
var currentDuckNames = {};

function gamesBindEvent(target, eventName, handler) {
    if (typeof bindEvent === "function") {
        bindEvent(target, eventName, handler);
        return;
    }

    if (!target) {
        return;
    }

    if (target.addEventListener) {
        target.addEventListener(eventName, handler);
    } else if (target.attachEvent) {
        target.attachEvent("on" + eventName, handler);
    } else {
        target["on" + eventName] = handler;
    }
}

function gamesAddClass(element, className) {
    if (typeof addClassCompat === "function") {
        addClassCompat(element, className);
        return;
    }

    if (!element) {
        return;
    }

    if (element.className.indexOf(className) === -1) {
        element.className = element.className ? (element.className + " " + className) : className;
    }
}

function gamesRemoveClass(element, className) {
    if (typeof removeClassCompat === "function") {
        removeClassCompat(element, className);
        return;
    }

    if (!element) {
        return;
    }

    element.className = (" " + element.className + " ").replace(" " + className + " ", " ").replace(/^\s+|\s+$/g, "");
}

function gamesHasClass(element, className) {
    if (!element) {
        return false;
    }

    if (element.classList) {
        return element.classList.contains(className);
    }

    return (" " + element.className + " ").indexOf(" " + className + " ") !== -1;
}

function gamesRemoveNode(node) {
    if (typeof removeNode === "function") {
        removeNode(node);
        return;
    }

    if (node && node.parentNode) {
        node.parentNode.removeChild(node);
    }
}

function normalizeMac(value) {
    if (!value) {
        return "";
    }

    if (typeof replaceAll === "function") {
        return replaceAll(value, ":");
    }

    return value.replace(/:/g, "");
}

function attemptPlayAudio(audio, onSuccess, onFailure) {
    if (!audio || typeof audio.play !== "function") {
        if (onFailure) {
            onFailure();
        }
        return;
    }

    try {
        var playResult = audio.play();
        if (playResult && typeof playResult.then === "function") {
            playResult.then(function () {
                if (onSuccess) {
                    onSuccess();
                }
            }, function (error) {
                if (onFailure) {
                    onFailure(error);
                }
            });
            return;
        }

        if (onSuccess) {
            onSuccess();
        }
    } catch (e) {
        if (onFailure) {
            onFailure(e);
        }
    }
}

function stopAudio(audio) {
    if (!audio) {
        return;
    }

    try {
        audio.pause();
        audio.currentTime = 0;
    } catch (e) {
    }
}

function bindAudioUnlockEvents() {
    if (audioUnlockBound) {
        return;
    }

    audioUnlockBound = true;

    var unlockHandler = function () {
        audioStartRequested = true;

        if (lobbyMusicStarted) {
            return;
        }

        startLobbyMusic(false);
    };

    gamesBindEvent(document, "click", unlockHandler);
    gamesBindEvent(document, "touchstart", unlockHandler);
    gamesBindEvent(document, "keydown", unlockHandler);
    gamesBindEvent(document, "mousedown", unlockHandler);
}

function startLobbyMusic(resetTime) {
    if (!lobbyMusic) {
        return;
    }

    if (resetTime) {
        try {
            lobbyMusic.currentTime = 0;
        } catch (e) {
        }
    }

    lobbyMusic.loop = true;
    lobbyMusic.volume = 1.0;
    attemptPlayAudio(lobbyMusic, function () {
        lobbyMusicStarted = true;
    }, function () {
    });
}

function initializeAudio(server) {
    if (!server || !server.ip) {
        bindAudioUnlockEvents();
        return;
    }

    juanfiExtendedIp = server.ip;
    buttonEffect = new Audio("http://" + server.ip + ":8080/sounds/button.mp3");
    duckRacingMusic = new Audio("http://" + server.ip + ":8080/sounds/duck-racing.mp3");
    lobbyMusic = new Audio("http://" + server.ip + ":8080/sounds/lobby.mp3");

    duckRacingMusic.loop = true;
    lobbyMusic.loop = true;

    bindAudioUnlockEvents();
    startLobbyMusic(true);

    if (audioStartRequested && !lobbyMusicStarted) {
        startLobbyMusic(false);
    }
}

function showGamesPage() {
    $("#loaderDiv").addClass("hide");
    $("#containerDiv").removeClass("hide");
    $("#containerDiv").show();
}

function updatePointsDisplays(totalPoints) {
    $(".availablePointsDisplay").html(totalPoints.toFixed(2));

    var pointsDisplay = document.getElementById("userPointsDisplay");
    if (pointsDisplay) {
        pointsDisplay.innerHTML = totalPoints.toFixed(2);
    }

    var headerPointsDisplay = document.getElementById("headerPointsDisplay");
    if (headerPointsDisplay) {
        headerPointsDisplay.innerHTML = totalPoints.toFixed(2);
    }
}

function updateDuckRaceActionState() {
    var startBtn = document.getElementById("duckRaceStartBtn");
    var resultAlert = document.getElementById("raceResult");
    var raceAgainBtn = document.getElementById("raceAgainBtn");

    if (!startBtn || !resultAlert) {
        return;
    }

    if (selectedDuck && currentPoints <= 0) {
        startBtn.disabled = true;
        gamesRemoveClass(resultAlert, "d-none");
        if (!isRacing) {
            resultAlert.className = "alert mt-3 fw-bold text-center shadow alert-warning";
            resultAlert.innerHTML = "You don't have enough points to join the race. Drop a coin first!";
        }
        return;
    }

    if (selectedDuck && currentPoints > 0 && !isRacing) {
        startBtn.disabled = false;
        if (!(raceAgainBtn && !gamesHasClass(raceAgainBtn, "d-none"))) {
            gamesAddClass(resultAlert, "d-none");
        }
        return;
    }

    startBtn.disabled = true;
}

function initializeGamesConfig(callback) {
    if (gamesConfigInitialized) {
        if (callback) {
            callback();
        }
        return;
    }

    if (typeof fetchPortalConfig !== "function") {
        gamesConfigInitialized = true;
        if (callback) {
            callback();
        }
        return;
    }

    fetchPortalConfig(function (data, error) {
        if (error) {
            console.error("Failed to fetch games portal config:", error);
        }

        if (data) {
            wheelConfig = data.wheelConfig || [];
            gamesPointsEnabled = data.pointsPercentage > 0;
            if ((!vendorIpAddress || vendorIpAddress === "") && data.vendorIpAddress) {
                vendorIpAddress = data.vendorIpAddress;
            }
        } else {
            wheelConfig = [];
            gamesPointsEnabled = false;
        }

        if (typeof showPointsRedeemBtns === "function") {
            showPointsRedeemBtns(currentPoints, gamesPointsEnabled, wheelConfig);
        }

        $(".redeemRatio").text(redeemRatioValue);
        gamesConfigInitialized = true;

        if (callback) {
            callback();
        }
    });
}

function fetchUserPoints(callback) {
    if (gamesUserInfoRequestInFlight) {
        if (callback) {
            callback(false);
        }
        return;
    }

    if (typeof fetchUserInfo !== "function" || !macNoColon) {
        console.error("core.js is not fully loaded or macNoColon is undefined");
        if (callback) {
            callback(false);
        }
        return;
    }

    gamesUserInfoRequestInFlight = true;

    fetchUserInfo(macNoColon, true, function (userData, error) {
        gamesUserInfoRequestInFlight = false;

        if (error) {
            console.error("Failed to fetch user points for games:", error);
            if (callback) {
                callback(false);
            }
            return;
        }

        if (userData) {
            var totalPoints = Number(userData.totalPoints) || 0;
            currentPoints = (typeof getWholeNumber === "function") ? getWholeNumber(totalPoints) : parseInt(totalPoints, 10);
            if (isNaN(currentPoints)) {
                currentPoints = 0;
            }

            rewardPointsBalance = totalPoints;
            gamesPointsEnabled = !!userData.pointsEnabled;

            updatePointsDisplays(totalPoints);
            updateDuckRaceActionState();
        }

        if (callback) {
            callback(true);
        }
    });
}

function goBackToPortal() {
    addLoader("gamesBackBtn");
    window.location.href = "/";
}

function shuffleArray(array) {
    var i;
    for (i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function assignDuckNames() {
    var namesCopy = duckNamesPool.slice(0);
    var shuffledNames = shuffleArray(namesCopy);
    var betButtons = document.querySelectorAll(".duck-bet-btn");
    var i;

    for (i = 1; i <= 5; i++) {
        var duckName = shuffledNames[i - 1];
        currentDuckNames[i] = duckName;

        var duckLabel = document.querySelector("#duck-" + i + " .duck-label");
        if (duckLabel) {
            duckLabel.innerHTML = duckName;
        }

        var buttonIndex;
        for (buttonIndex = 0; buttonIndex < betButtons.length; buttonIndex++) {
            var btn = betButtons[buttonIndex];
            if (parseInt(btn.getAttribute("data-duck"), 10) === i) {
                btn.innerHTML = duckName;
                break;
            }
        }
    }
}

function clearBetButtonState() {
    var betButtons = document.querySelectorAll(".duck-bet-btn");
    var i;

    for (i = 0; i < betButtons.length; i++) {
        gamesRemoveClass(betButtons[i], "active");
    }
}

function selectDuckBet(button) {
    if (isRacing) {
        return;
    }

    clearBetButtonState();
    gamesAddClass(button, "active");
    selectedDuck = parseInt(button.getAttribute("data-duck"), 10);
    updateDuckRaceActionState();

    var resultAlert = document.getElementById("raceResult");
    var startBtn = document.getElementById("duckRaceStartBtn");
    if (!resultAlert || !startBtn) {
        return;
    }

    if (currentPoints > 0) {
        startBtn.disabled = false;
        gamesAddClass(resultAlert, "d-none");
    } else {
        startBtn.disabled = true;
        gamesRemoveClass(resultAlert, "d-none");
        resultAlert.innerHTML = "You don't have enough points to join the race. Drop a coin first!";
    }
}

function getDuckElements() {
    var ducks = [];
    var i;

    for (i = 1; i <= 5; i++) {
        ducks.push(document.getElementById("duck-" + i));
    }

    return ducks;
}

function arrayContainsValue(items, value) {
    var i;
    for (i = 0; i < items.length; i++) {
        if (items[i] === value) {
            return true;
        }
    }
    return false;
}

function maxPositionExcluding(positions, excludedIndex) {
    var maxValue = 0;
    var i;

    for (i = 0; i < positions.length; i++) {
        if (i === excludedIndex) {
            continue;
        }

        if (positions[i] > maxValue) {
            maxValue = positions[i];
        }
    }

    return maxValue;
}

function anyDuckNearFinish(positions, finishDistance) {
    var i;
    for (i = 0; i < positions.length; i++) {
        if (positions[i] >= finishDistance * 0.65) {
            return true;
        }
    }
    return false;
}

function buildUnluckyDucks() {
    var otherDucks = [];
    var unluckyDucks = [];
    var i;

    for (i = 1; i <= 5; i++) {
        if (i !== winningDuck) {
            otherDucks.push(i);
        }
    }

    while (unluckyDucks.length < 2 && otherDucks.length > 0) {
        var randomDuck = otherDucks[Math.floor(Math.random() * otherDucks.length)];
        if (!arrayContainsValue(unluckyDucks, randomDuck)) {
            unluckyDucks.push(randomDuck);
        }
    }

    return unluckyDucks;
}

function startRaceAnimation() {
    var ducks = getDuckElements();
    var raceTrack = document.querySelector(".race-track");
    var waterBackground = document.querySelector(".water-background");
    var finishDistance = raceTrack ? (raceTrack.offsetHeight - 80) : 0;
    var positions = [0, 0, 0, 0, 0];
    var unluckyDucks = buildUnluckyDucks();
    var i;

    if (gamesRaceInterval) {
        clearInterval(gamesRaceInterval);
        gamesRaceInterval = null;
    }

    for (i = 0; i < ducks.length; i++) {
        if (ducks[i]) {
            ducks[i].style.bottom = "10px";
        }
    }

    if (waterBackground) {
        gamesAddClass(waterBackground, "active");
    }

    if (duckRacingMusic) {
        duckRacingMusic.currentTime = 0;
        attemptPlayAudio(duckRacingMusic, null, function () {
            console.error("Audio playback error: duck racing music blocked");
        });
    }

    if (lobbyMusic) {
        lobbyMusic.volume = 0.3;
    }

    gamesRaceInterval = setInterval(function () {
        var raceFinished = false;
        var nearFinish = anyDuckNearFinish(positions, finishDistance);

        for (i = 0; i < ducks.length; i++) {
            var duck = ducks[i];
            var duckId = i + 1;
            var completion = finishDistance > 0 ? (positions[i] / finishDistance) : 0;
            var speed = Math.random() * 2 + 1;

            if (duckId === winningDuck) {
                if (nearFinish) {
                    var maxOtherPos = maxPositionExcluding(positions, i);
                    if (positions[i] < maxOtherPos) {
                        speed = 4 + Math.random() * 2;
                    } else {
                        speed = 3 + Math.random();
                    }
                } else if (completion > 0.1 && completion < 0.6) {
                    speed = 1 + Math.random() * 0.5;
                } else {
                    speed = speed + 0.5;
                }
            } else if (arrayContainsValue(unluckyDucks, duckId)) {
                if (Math.random() > 0.6) {
                    speed = speed * 0.3;
                }
                if (Math.random() > 0.85) {
                    speed = 0;
                }
            } else if (Math.random() > 0.8) {
                speed = 0;
            }

            positions[i] = positions[i] + speed;

            if (positions[i] >= finishDistance) {
                positions[i] = finishDistance;
                if (duckId === winningDuck) {
                    raceFinished = true;
                }
            }

            if (duck) {
                duck.style.bottom = (10 + positions[i]) + "px";
            }
        }

        if (raceFinished) {
            clearInterval(gamesRaceInterval);
            gamesRaceInterval = null;
            announceWinner();
        }
    }, 50);
}

function announceWinner() {
    var resultAlert = document.getElementById("raceResult");
    var startBtn = document.getElementById("duckRaceStartBtn");
    var raceAgainBtn = document.getElementById("raceAgainBtn");
    var winningName = currentDuckNames[winningDuck];

    isRacing = false;

    stopAudio(duckRacingMusic);

    if (lobbyMusic) {
        lobbyMusic.volume = 1.0;
        if (!lobbyMusicStarted) {
            startLobbyMusic(false);
        }
    }

    if (resultAlert) {
        gamesRemoveClass(resultAlert, "d-none");

        if (selectedDuck === winningDuck) {
            resultAlert.className = "alert mt-3 fw-bold text-center shadow alert-success";
            resultAlert.innerHTML = "Congratulations! " + winningName + " won the race! You won " + wonPoints + " points!";
            showVictorySprinkles();
        } else {
            resultAlert.className = "alert mt-3 fw-bold text-center shadow alert-danger";
            resultAlert.innerHTML = "Oh no! " + winningName + " won the race. You LOST!";
        }
    }

    if (startBtn) {
        gamesAddClass(startBtn, "d-none");
    }

    if (raceAgainBtn) {
        gamesRemoveClass(raceAgainBtn, "d-none");
    }

    removeLoader("duckRaceStartBtn");

    setTimeout(function () {
        fetchUserPoints();
    }, 300);
}

function resetGame() {
    var startBtn = document.getElementById("duckRaceStartBtn");
    var raceAgainBtn = document.getElementById("raceAgainBtn");
    var resultAlert = document.getElementById("raceResult");
    var betButtons = document.querySelectorAll(".duck-bet-btn");
    var ducks = getDuckElements();
    var waterBackground = document.querySelector(".water-background");
    var i;

    selectedDuck = null;
    isRacing = false;

    if (gamesRaceInterval) {
        clearInterval(gamesRaceInterval);
        gamesRaceInterval = null;
    }

    if (startBtn) {
        startBtn.disabled = true;
        gamesRemoveClass(startBtn, "d-none");
    }

    if (raceAgainBtn) {
        gamesAddClass(raceAgainBtn, "d-none");
    }

    for (i = 0; i < betButtons.length; i++) {
        gamesRemoveClass(betButtons[i], "active");
        gamesRemoveClass(betButtons[i], "d-none");
        betButtons[i].disabled = false;
    }

    if (resultAlert) {
        gamesAddClass(resultAlert, "d-none");
        resultAlert.className = "alert mt-3 d-none fw-bold text-center shadow";
        resultAlert.innerHTML = "";
    }

    for (i = 0; i < ducks.length; i++) {
        if (ducks[i]) {
            ducks[i].style.bottom = "10px";
        }
    }

    if (waterBackground) {
        gamesRemoveClass(waterBackground, "active");
    }

    stopAudio(duckRacingMusic);

    if (lobbyMusic) {
        lobbyMusic.volume = 1.0;
        if (!lobbyMusicStarted) {
            startLobbyMusic(false);
        }
    }

    assignDuckNames();
    updateDuckRaceActionState();
}

function showVictorySprinkles() {
    var track = document.querySelector(".race-track");
    var colors = ["#ffd700", "#ff4d4d", "#33cc33", "#3399ff", "#cc33ff", "#ff9900"];
    var i;

    if (!track) {
        return;
    }

    for (i = 0; i < 80; i++) {
        var sprinkle = document.createElement("div");
        sprinkle.className = "sprinkle";
        sprinkle.style.left = (Math.random() * 100) + "%";
        sprinkle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        sprinkle.style.animationDuration = (Math.random() * 1.5 + 1) + "s";
        sprinkle.style.animationDelay = (Math.random() * 0.5) + "s";

        track.appendChild(sprinkle);

        (function (sprinkleNode) {
            setTimeout(function () {
                gamesRemoveNode(sprinkleNode);
            }, 3000);
        })(sprinkle);
    }
}

function bindDuckSelectionEvents() {
    var betButtons = document.querySelectorAll(".duck-bet-btn");
    var i;

    for (i = 0; i < betButtons.length; i++) {
        (function (button) {
            gamesBindEvent(button, "click", function () {
                startLobbyMusic(false);
                selectDuckBet(button);
            });
        })(betButtons[i]);
    }
}

function bindGamesUi() {
    if (gamesUiBound) {
        return;
    }

    gamesUiBound = true;

    var startBtn = document.getElementById("duckRaceStartBtn");
    var duckRaceModal = document.getElementById("duckRaceModal");
    var raceAgainBtn = document.getElementById("raceAgainBtn");

    assignDuckNames();
    bindDuckSelectionEvents();

    gamesBindEvent(startBtn, "click", function () {
        var raceServerIp = serverIp;
        var resultAlert = document.getElementById("raceResult");
        var betButtons = document.querySelectorAll(".duck-bet-btn");
        var i;

        if (!selectedDuck || isRacing) {
            return;
        }

        addLoader("duckRaceStartBtn");
        fetchDuckRaceReward(raceServerIp, macNoColon, selectedDuck).then(function (result) {
            if (!result) {
                return;
            }

            winningDuck = result.winningDuck;
            wonPoints = result.wonPoints;
            isRacing = true;

            if (startBtn) {
                startBtn.disabled = true;
                gamesAddClass(startBtn, "d-none");
            }

            for (i = 0; i < betButtons.length; i++) {
                betButtons[i].disabled = true;
                gamesAddClass(betButtons[i], "d-none");
            }

            if (resultAlert) {
                gamesRemoveClass(resultAlert, "d-none");
                resultAlert.className = "alert mt-3 fw-bold text-center shadow alert-info";
                resultAlert.innerHTML = "You bet on: <span class=\"text-primary fs-5\">" + currentDuckNames[selectedDuck] + "</span>. Good luck!";
            }

            startRaceAnimation();
        });
    });

    if (duckRaceModal) {
        gamesBindEvent(duckRaceModal, "hidden.bs.modal", function () {
            if (isRacing) {
                return;
            }
            resetGame();
        });
    }

    if (raceAgainBtn) {
        gamesBindEvent(raceAgainBtn, "click", function () {
            resetGame();
        });
    }
}

function initializeGamesSharedState() {
    if (typeof initValues === "function") {
        initValues();
    }

    if ((!serverIp || serverIp === "") && typeof vendorIpAddress !== "undefined") {
        serverIp = vendorIpAddress;
    }

    if ((!macNoColon || macNoColon === "") && typeof mac !== "undefined") {
        macNoColon = normalizeMac(mac);
    }
}

function initializeGamesPage() {
    if (gamesPageInitialized) {
        return;
    }

    gamesPageInitialized = true;
    initializeGamesSharedState();
    bindGamesUi();
    bindAudioUnlockEvents();

    fetchServerData().then(function (server) {
        if (server) {
            juanfiExtendedServerUrl = "http://" + server.ip + ":8080/api/portal";
            initializeAudio(server);
        } else {
            bindAudioUnlockEvents();
        }

        initializeGamesConfig(function () {
            fetchUserPoints(function () {
                showGamesPage();
            });
        });
    }).catch(function (error) {
        console.error("Failed to initialize games page:", error);
        bindAudioUnlockEvents();
        initializeGamesConfig(function () {
            fetchUserPoints(function () {
                showGamesPage();
            });
        });
    });
}

$(document).ready(function () {
    initializeGamesPage();
});
