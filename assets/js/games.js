
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
            currentPoints = getWholeNumber(totalPoints);

            // Sync with core.js points and spin wheel display
            if (typeof rewardPointsBalance !== 'undefined') {
                rewardPointsBalance = totalPoints;
            }
            $(".availablePointsDisplay").html(totalPoints.toFixed(2));

            const pointsDisplay = document.getElementById('userPointsDisplay');
            if (pointsDisplay) {
                pointsDisplay.textContent = totalPoints.toFixed(2);
            }

            const headerPointsDisplay = document.getElementById('headerPointsDisplay');
            if (headerPointsDisplay) {
                headerPointsDisplay.textContent = totalPoints.toFixed(2);
            }

            // Re-check start button state based on new points
            const startBtn = document.getElementById("duckRaceStartBtn");
            const resultAlert = document.getElementById("raceResult");
            if (selectedDuck && currentPoints <= 0) {
                if (startBtn) startBtn.disabled = true;
                if (resultAlert) {
                    resultAlert.classList.remove("d-none");
                    if (!isRacing) {
                        resultAlert.className = "alert mt-3 fw-bold text-center shadow alert-warning";
                        resultAlert.innerHTML = `⚠️ You don't have enough points to join the race. Drop a coin first! ⚠️`;
                    }
                }
            } else if (selectedDuck && currentPoints > 0 && !isRacing) {
                if (startBtn) startBtn.disabled = false;

                // Only hide the alert if we're not currently displaying race results
                const raceAgainBtn = document.getElementById("raceAgainBtn");
                const isDisplayingResult = raceAgainBtn && !raceAgainBtn.classList.contains("d-none");

                if (resultAlert && !isDisplayingResult) {
                    resultAlert.classList.add("d-none");
                }
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
var currentPoints = 0;

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

            // Enable start button if points > 0
            if (getWholeNumber(currentPoints) > 0) {
                startBtn.disabled = false;
                resultAlert.classList.add("d-none");
            } else {
                startBtn.disabled = true;
                resultAlert.classList.remove("d-none");
                resultAlert.innerHTML = `⚠️ You don't have enough points to join the race. Drop a coin first! ⚠️`;
            }
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

            // Show current bet
            resultAlert.classList.remove("d-none");
            resultAlert.className = "alert mt-3 fw-bold text-center shadow alert-info";
            resultAlert.innerHTML = `🦆 You bet on: <span class="text-primary fs-5">${currentDuckNames[selectedDuck]}</span>. Good luck! 🦆`;
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
    const finishDistance = trackHeight - 80;

    let positions = [0, 0, 0, 0, 0];
    let raceInterval;

    // Pick 2 random ducks (not the winner) to be "unlucky" and slow down
    const otherDucks = [1, 2, 3, 4, 5].filter(id => id !== winningDuck);
    const unluckyDucks = [];
    while (unluckyDucks.length < 2) {
        const randomDuck = otherDucks[Math.floor(Math.random() * otherDucks.length)];
        if (!unluckyDucks.includes(randomDuck)) {
            unluckyDucks.push(randomDuck);
        }
    }

    // Reset ducks to start
    ducks.forEach(duck => {
        if (duck) duck.style.bottom = "10px";
    });

    // Start water animation
    const waterBackground = document.querySelector('.water-background');
    if (waterBackground) waterBackground.classList.add('active');

    raceInterval = setInterval(() => {
        let raceFinished = false;
        const anyNearFinish = positions.some(pos => pos >= finishDistance * 0.65);

        ducks.forEach((duck, index) => {
            const duckId = index + 1;
            const completion = positions[index] / finishDistance;

            let speed = Math.random() * 2 + 1;

            if (duckId === winningDuck) {
                // Winner Logic
                if (anyNearFinish) {
                    // Sprint Phase: Catch up and pass everyone
                    const maxOtherPos = Math.max(...positions.filter((_, i) => i !== index));
                    if (positions[index] < maxOtherPos) {
                        speed = 4 + Math.random() * 2; // Super boost
                    } else {
                        speed = 3 + Math.random() * 1; // High lead speed
                    }
                } else if (completion > 0.1 && completion < 0.6) {
                    // Slowdown Phase: Keep it competitive but not "very slow"
                    speed = 1.0 + Math.random() * 0.5;
                } else {
                    // Normal Phase
                    speed += 0.5;
                }
            } else if (unluckyDucks.includes(duckId)) {
                // Unlucky Ducks: Slow down randomly
                if (Math.random() > 0.6) speed = speed * 0.3;
                if (Math.random() > 0.85) speed = 0;
            } else {
                // Regular Ducks
                if (Math.random() > 0.8) speed = 0;
            }

            positions[index] += speed;

            // Check for finish
            if (positions[index] >= finishDistance) {
                positions[index] = finishDistance;
                // Only the winningDuck can finish first to trigger the end
                if (duckId === winningDuck) {
                    raceFinished = true;
                }
            }

            if (duck) duck.style.bottom = `${10 + positions[index]}px`;
        });

        if (raceFinished) {
            clearInterval(raceInterval);
            announceWinner();
        }
    }, 50);
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

        // Trigger victory sprinkles
        showVictorySprinkles();
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

    // Stop water animation
    const waterBackground = document.querySelector('.water-background');
    if (waterBackground) waterBackground.classList.remove('active');

    // Assign new names for the next race
    assignDuckNames();
}

function showVictorySprinkles() {
    const track = document.querySelector('.race-track');
    if (!track) return;

    // Create 80 sprinkles
    for (let i = 0; i < 80; i++) {
        const sprinkle = document.createElement('div');
        sprinkle.className = 'sprinkle';

        // Random horizontal position
        sprinkle.style.left = Math.random() * 100 + '%';

        // Random colors: Gold, Red, Green, Blue, Purple
        const colors = ['#ffd700', '#ff4d4d', '#33cc33', '#3399ff', '#cc33ff', '#ff9900'];
        sprinkle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        // Random fall duration between 1s and 2.5s
        sprinkle.style.animationDuration = (Math.random() * 1.5 + 1) + 's';

        // Random delay up to 0.5s so they don't all fall exactly at once
        sprinkle.style.animationDelay = (Math.random() * 0.5) + 's';

        track.appendChild(sprinkle);

        // Clean up the sprinkle element after it falls
        setTimeout(() => {
            if (sprinkle.parentNode) {
                sprinkle.remove();
            }
        }, 3000); // 3s is enough for the longest animation (2.5s + 0.5s delay)
    }
}
