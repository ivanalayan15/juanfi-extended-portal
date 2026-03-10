
// Get IP from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const serverIp = urlParams.get('ip');

// --- Points Fetching Logic via core.js ---
function fetchUserPoints() {
    if (typeof fetchUserInfo !== 'function' || !macNoColon) {
        console.error("core.js is not fully loaded or macNoColon is undefined");
        return;
    }

    // Call fetchUserInfo from core.js
    // macNoColon is initialized in core.js initValues()
    fetchUserInfo(macNoColon, true, function (userData, error) {
        if (error) {
            console.error("Failed to fetch user points for games:", error);
            return;
        }
        if (userData) {
            const totalPoints = Number(userData.totalPoints) || 0;
            const pointsDisplay = document.getElementById('userPointsDisplay');
            if (pointsDisplay) {
                pointsDisplay.textContent = totalPoints.toFixed(2);
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Give core.js a slight delay to ensure all its DOMContentLoaded logic runs first
    setTimeout(fetchUserPoints, 300);
});
// ----------------------------------------

// This variable determines which duck will win the race (1-5)
var winningDuck = 0;
var wonPoints = 0;
var selectedDuck = null;
var isRacing = false;

const duckNamesPool = ["Herbie", "Allan", "Jenyl", "Arkie", "Charlie"];
let currentDuckNames = {}; // Map of duck ID (1-5) to Name

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function assignDuckNames() {
    const shuffledNames = shuffleArray([...duckNamesPool]);
    const betButtons = document.querySelectorAll(".duck-bet-btn");

    for (let i = 1; i <= 5; i++) {
        const duckName = shuffledNames[i - 1];
        currentDuckNames[i] = duckName;

        // Update Duck label on the track
        const duckLabel = document.querySelector(`#duck-${i} .duck-label`);
        if (duckLabel) duckLabel.textContent = duckName;

        // Update betting button
        const btn = Array.from(betButtons).find(b => parseInt(b.getAttribute("data-duck")) === i);
        if (btn) btn.textContent = duckName;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const betButtons = document.querySelectorAll(".duck-bet-btn");
    const startBtn = document.getElementById("duckRaceStartBtn");
    const resultAlert = document.getElementById("raceResult");

    // Initialize names on load
    assignDuckNames();

    // Handle duck selection
    betButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (isRacing) return; // Prevent changing bet during race

            // Remove active class from all
            betButtons.forEach(b => b.classList.remove("active"));

            // Set active class on clicked
            btn.classList.add("active");
            selectedDuck = parseInt(btn.getAttribute("data-duck"));

            // Enable start button
            startBtn.disabled = false;
        });
    });

    // Handle race start
    startBtn.addEventListener("click", () => {
        if (!selectedDuck || isRacing) return;
        addLoader('duckRaceStartBtn');
        fetchDuckRaceReward(serverIp, macNoColon, selectedDuck).then(function (result) {
            if (!result) return;
            winningDuck = result.winningDuck;
            wonPoints = result.wonPoints;

            isRacing = true;
            startBtn.disabled = true;
            startBtn.classList.add("d-none"); // Hide Start button

            // Hide bet buttons
            betButtons.forEach(b => {
                b.disabled = true;
                b.classList.add("d-none");
            });

            // Hide previous results
            resultAlert.classList.add("d-none");
            resultAlert.className = "alert mt-3 fw-bold text-center shadow d-none"; // Reset classes

            startRaceAnimation();
        });
    });

    // Handle modal close to reset game state
    const duckRaceModal = document.getElementById('duckRaceModal');
    if (duckRaceModal) {
        duckRaceModal.addEventListener('hidden.bs.modal', () => {
            if (isRacing) return; // Optional: Could force stop, but better to let it finish or prevent close during race
            resetGame();
        });
    }

    const raceAgainBtn = document.getElementById("raceAgainBtn");
    if (raceAgainBtn) {
        raceAgainBtn.addEventListener("click", () => {
            resetGame();
        });
    }
});

function startRaceAnimation() {
    const ducks = [1, 2, 3, 4, 5].map(id => document.getElementById(`duck-${id}`));
    const trackHeight = document.querySelector('.race-track').offsetHeight;
    // Finish line is top 20px, duck is bottom 10px. Walk distance ~ (trackHeight - 80px)
    const finishDistance = trackHeight - 80;

    let positions = [0, 0, 0, 0, 0];
    let raceInterval;

    // Reset ducks to start
    ducks.forEach(duck => {
        duck.style.bottom = "10px";
    });

    raceInterval = setInterval(() => {
        let raceFinished = false;

        ducks.forEach((duck, index) => {
            const duckId = index + 1;

            // Increment position randomly
            let speed = Math.random() * 2 + 1;

            // Give the winning duck a slight advantage so it always wins
            if (duckId === winningDuck) {
                // Ensure it stays slightly ahead but looks random
                let maxOtherPos = Math.max(...positions.filter((_, i) => i !== index));
                if (positions[index] < maxOtherPos) {
                    speed += 0.00005; // Catch up boost
                } else {
                    speed += 0.000000001; // Normal winning speed
                }
            } else {
                // Occasional slowdown for losing ducks
                if (Math.random() > 0.8) speed = 0;
            }

            positions[index] += speed;

            // Check for finish
            if (positions[index] >= finishDistance) {
                positions[index] = finishDistance;
                if (duckId === winningDuck) {
                    raceFinished = true;
                }
            }

            duck.style.bottom = `${10 + positions[index]}px`;
        });

        if (raceFinished) {
            clearInterval(raceInterval);
            announceWinner();
        }
    }, 50); // 20fps for smooth random movement
}

function announceWinner() {
    isRacing = false;
    const resultAlert = document.getElementById("raceResult");
    const startBtn = document.getElementById("duckRaceStartBtn");
    const betButtons = document.querySelectorAll(".duck-bet-btn");

    resultAlert.classList.remove("d-none");

    const winningName = currentDuckNames[winningDuck];

    if (selectedDuck === winningDuck) {
        resultAlert.classList.add("alert-success");
        resultAlert.innerHTML = `🎉 Congratulations! ${winningName} won the race! You won ${wonPoints} points! 🎉`;
    } else {
        resultAlert.classList.add("alert-danger");
        resultAlert.innerHTML = `😢 Oh no! ${winningName} won the race. You LOST! 😢`;
    }

    // Show race again button instead of re-enabling start
    startBtn.classList.add("d-none");
    const raceAgainBtn = document.getElementById("raceAgainBtn");
    if (raceAgainBtn) raceAgainBtn.classList.remove("d-none");
    removeLoader('duckRaceStartBtn');
    setTimeout(fetchUserPoints, 300);
}

function resetGame() {
    selectedDuck = null;
    const startBtn = document.getElementById("duckRaceStartBtn");
    const raceAgainBtn = document.getElementById("raceAgainBtn");
    const resultAlert = document.getElementById("raceResult");
    const betButtons = document.querySelectorAll(".duck-bet-btn");

    startBtn.disabled = true;
    startBtn.classList.remove("d-none");
    if (raceAgainBtn) raceAgainBtn.classList.add("d-none");

    // Reset buttons
    betButtons.forEach(b => {
        b.classList.remove("active");
        b.classList.remove("d-none"); // Ensure they reappear
        b.disabled = false;
    });

    // Hide results
    if (resultAlert) {
        resultAlert.classList.add("d-none");
        resultAlert.className = "alert mt-3 d-none fw-bold text-center shadow"; // Reset classes
    }

    // Reset duck positions
    const ducks = [1, 2, 3, 4, 5].map(id => document.getElementById(`duck-${id}`));
    ducks.forEach(duck => {
        if (duck) duck.style.bottom = "10px";
    });

    // Assign new names for the next race
    assignDuckNames();
}
