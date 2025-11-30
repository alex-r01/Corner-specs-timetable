// Firebase Imports (MUST use cdn links provided by the environment)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global Variables
let db;
let auth;
let userId = null;
let isAuthReady = false;
let timetableData = {}; // Will hold the content of timetable.json
let currentCatchphrases = [];

// Constants for Schedule Dropdowns
const SCHEDULE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SCHEDULE_WEEKS = ["Week 1", "Week 2"];
const SCHEDULE_PERIODS = ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5"];

// --- Configuration and Initialization ---
// Mandatory Canvas environment variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Custom Alert/Modal utility (Replaces alert() and window.confirm())
const showCustomAlert = (title, message) => {
    const modal = document.getElementById('confirmModal');
    // Simple implementation for demonstration
    modal.style.display = 'flex'; // Use flex to center
    modal.innerHTML = `
        <div class="scheduleModalBack" style="display:flex;">
            <div class="scheduleModal">
                <div class="scheduleHeader">
                    <h3 style="margin:0;">${title}</h3>
                    <span class="modalClose" onclick="document.getElementById('confirmModal').style.display='none';">&times;</span>
                </div>
                <div style="padding: 10px 0;">${message}</div>
                <button class="btn primary" style="width:100%" onclick="document.getElementById('confirmModal').style.display='none';">OK</button>
            </div>
        </div>
    `;
};


// --- FIREBASE AND DATA LOADING ---

const setupFirebase = async () => {
    if (!firebaseConfig) {
        console.error("Firebase configuration is missing.");
        return;
    }
    setLogLevel('Debug');
    
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // 1. Authentication
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (user) => {
            const userIdDisplay = document.getElementById('userIdDisplay');
            if (user) {
                userId = user.uid;
                isAuthReady = true;
                userIdDisplay.textContent = userId;
                console.log("Authenticated with user ID:", userId);
                // 2. Start listening to catchphrases after authentication
                startCatchphraseListener();
            } else {
                // Should only happen if sign-in failed, but ensure state is clean
                userId = crypto.randomUUID(); // Use a temp ID if auth failed
                isAuthReady = true;
                userIdDisplay.textContent = 'Anonymous';
                console.log("User is signed out or anonymous.");
            }
        });

    } catch (error) {
        console.error("Firebase initialization or sign-in failed:", error);
    }
};

const startCatchphraseListener = () => {
    if (!db || !isAuthReady) return;

    // Public collection for shared catchphrases
    const phrasesCollectionRef = collection(db, `artifacts/${appId}/public/data/catchphrases`);
    
    onSnapshot(phrasesCollectionRef, (snapshot) => {
        currentCatchphrases = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.phrase) {
                currentCatchphrases.push(data.phrase);
            }
        });
        console.log(`Loaded ${currentCatchphrases.length} catchphrases.`);
        updateCatchphraseUI();
    }, (error) => {
        console.error("Error listening to catchphrases:", error);
    });
};

// --- CATCHPHRASE LOGIC ---

const updateCatchphraseUI = () => {
    const displayElement = document.getElementById('catchphraseDisplay');

    if (currentCatchphrases.length === 0) {
        displayElement.innerHTML = `<p style="text-align:center; color:var(--muted); margin:0;">No catchphrases added yet. Be the first!</p>`;
        return;
    }

    // Display all phrases as tags for better UX, or randomly select one if preferred
    // For now, let's stick to shuffling the display:
    const randomIndex = Math.floor(Math.random() * currentCatchphrases.length);
    displayElement.innerHTML = `<p style="text-align:center; font-weight: 500; margin:0;">"${currentCatchphrases[randomIndex]}"</p>`;
};

const handleAddPhrase = async () => {
    const input = document.getElementById('newPhraseInput');
    const newPhrase = input.value.trim();

    if (!newPhrase) {
        showCustomAlert("Input Error", "Please enter a phrase before adding.");
        return;
    }

    if (!isAuthReady || !db) {
        showCustomAlert("Error", "App is still loading. Please wait a moment.");
        return;
    }

    try {
        const phrasesCollectionRef = collection(db, `artifacts/${appId}/public/data/catchphrases`);
        // Use setDoc with a generated ID
        await setDoc(doc(phrasesCollectionRef), {
            phrase: newPhrase,
            authorId: userId,
            timestamp: new Date().toISOString()
        });

        input.value = ''; // Clear the input
        showCustomAlert("Success", "Catchphrase added and shared!");
        // The onSnapshot listener handles the UI update
    } catch (error) {
        console.error("Error adding phrase to Firestore:", error);
        showCustomAlert("Save Error", "Failed to add phrase. Check console for details.");
    }
};

// --- TIMETABLE DATA LOADING ---

const loadTimetableData = async () => {
    try {
        // Fetch the timetable data from the local JSON file
        const response = await fetch('timetable.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        timetableData = await response.json();
        console.log("Timetable data loaded successfully:", Object.keys(timetableData));
        return true;
    } catch (error) {
        console.error("Could not load timetable.json:", error);
        showCustomAlert("Data Error", "Could not load timetable data. Check console for details.");
        return false;
    }
};

// --- DROPDOWN INITIALIZATION AND LOGIC ---

const populateScheduleDropdowns = () => {
    // Who's in (or not) dropdowns
    const whoSelect1 = document.getElementById('whoSelect1');
    const weekSelect1 = document.getElementById('weekSelect1');
    const daySelect1 = document.getElementById('daySelect1');
    const periodSelect1 = document.getElementById('periodSelect1');

    // My Day dropdowns
    const whoSelect2 = document.getElementById('whoSelect');
    const weekSelect2 = document.getElementById('weekSelect2');
    const daySelect2 = document.getElementById('daySelect2');

    // Helper function to populate a select element
    const populateSelect = (selectElement, options, initialValue = "") => {
        selectElement.innerHTML = `<option value="">-- Select --</option>`;
        options.forEach(optionText => {
            const option = document.createElement('option');
            option.value = optionText;
            option.textContent = optionText;
            selectElement.appendChild(option);
        });
        if (options.includes(initialValue)) {
            selectElement.value = initialValue;
        }
    };
    
    // Get person names from timetableData keys
    const personNames = Object.keys(timetableData).sort();

    // 1. Populate Who (People)
    populateSelect(whoSelect1, personNames, personNames[0]);
    populateSelect(whoSelect2, personNames, personNames[0]); // whoSelect is the 'My Day' one

    // 2. Populate Weeks
    populateSelect(weekSelect1, SCHEDULE_WEEKS, SCHEDULE_WEEKS[0]);
    populateSelect(weekSelect2, SCHEDULE_WEEKS, SCHEDULE_WEEKS[0]);

    // 3. Populate Days
    populateSelect(daySelect1, SCHEDULE_DAYS, SCHEDULE_DAYS[0]);
    populateSelect(daySelect2, SCHEDULE_DAYS, SCHEDULE_DAYS[0]);

    // 4. Populate Periods (for Who's in)
    populateSelect(periodSelect1, SCHEDULE_PERIODS, SCHEDULE_PERIODS[0]);
};


const handleShowDailySchedule = () => {
    const who = document.getElementById('whoSelect').value;
    const week = document.getElementById('weekSelect2').value;
    const day = document.getElementById('daySelect2').value;

    const modalBack = document.getElementById('scheduleModalBack');
    const modalTitle = document.getElementById('scheduleTitle');
    const modalContent = document.getElementById('modalScheduleContent');

    if (!who || !week || !day) {
        showCustomAlert("Selection Error", "Please select a person, week, and day to check the schedule.");
        return;
    }

    const personSchedule = timetableData[who];

    // Check if data path exists
    if (!personSchedule || !personSchedule[week] || !personSchedule[week][day]) {
        modalTitle.textContent = `${who}'s Schedule`;
        modalContent.innerHTML = `<p style="padding: 10px; color: var(--text);">No schedule found for ${who} on ${week}, ${day}.</p>`;
        modalBack.style.display = 'flex';
        return;
    }

    const periods = personSchedule[week][day];
    // Get the color variable name from the data (e.g., 'blue', 'pink')
    const colorKey = personSchedule.color || 'primary-btn-bg';
    const personColorVar = `var(--color-${colorKey})`; // Maps to CSS variables

    modalTitle.textContent = `${who}'s Timetable: ${day} (${week})`;
    modalContent.innerHTML = ''; // Clear previous content

    periods.forEach((subject, index) => {
        // Period names are hardcoded 1 to 5 based on the JSON structure
        const periodName = SCHEDULE_PERIODS[index] || `Period ${index + 1}`;
        const actualSubject = subject.trim() || 'Free Period';
        const isFree = actualSubject === 'Free Period';
        
        // Define background based on subject type
        const bgColor = isFree ? 'var(--muted)' : personColorVar;

        const row = document.createElement('div');
        row.className = 'scheduleRow';
        row.innerHTML = `
            <span class="schedulePeriod" style="background-color: ${bgColor};">
                ${periodName}
            </span>
            <span class="scheduleSubject" style="color: ${isFree ? 'var(--muted)' : 'var(--text)'};">
                ${actualSubject}
            </span> 
        `;
        modalContent.appendChild(row);
    });

    modalBack.style.display = 'flex';
};


// --- WHO'S IN LOGIC (Placeholder for future implementation) ---

const handleFindPeople = () => {
    showCustomAlert("Feature Not Ready", "The 'Find people' feature logic is pending the next update. Please use the 'My Day' feature for now!");
    // The actual implementation would involve iterating through all timetableData and comparing the selected lesson.
};


// --- EVENT LISTENERS AND DARK MODE ---

const setupEventListeners = () => {
    document.getElementById('addPhraseBtn').addEventListener('click', handleAddPhrase);
    document.getElementById('refreshTag').addEventListener('click', updateCatchphraseUI);
    document.getElementById('findPeopleBtn').addEventListener('click', handleFindPeople);

    // Daily Schedule Feature
    document.getElementById('whatBtn').addEventListener('click', handleShowDailySchedule);
    document.getElementById('scheduleClose').addEventListener('click', () => {
        document.getElementById('scheduleModalBack').style.display = 'none';
    });
    
    // Close modal by clicking outside
    document.getElementById('scheduleModalBack').addEventListener('click', (e) => {
        if (e.target.id === 'scheduleModalBack') {
            document.getElementById('scheduleModalBack').style.display = 'none';
        }
    });


    // Dark Mode Toggle
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
};

// --- Dark Mode Logic ---

const loadDarkModePreference = () => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const storedPreference = localStorage.getItem('darkMode');
    
    let isDarkMode = false;
    if (storedPreference !== null) {
        isDarkMode = storedPreference === 'true';
    } else if (prefersDark) {
        isDarkMode = true;
    }

    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
};

const toggleDarkMode = () => {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
};

// --- Execution ---

window.onload = async () => {
    loadDarkModePreference();
    setupEventListeners();
    const dataLoaded = await loadTimetableData(); // Load JSON first
    if (dataLoaded) {
        populateScheduleDropdowns(); // Populate UI with loaded data
    }
    await setupFirebase(); // Start the Firebase auth and data loading process
};
