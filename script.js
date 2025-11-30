// Firebase Imports (MUST use cdn links provided by the environment)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion, getDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global Variables
let db;
let auth;
let userId = null;
let isAuthReady = false;
let peopleData = []; // [{ id: 'name', name: 'Name', color: 'var(--color-x)' }, ...]
let timetableData = {}; // { Person: { Week 1: { Day: [Periods] } } }
let currentCatchphrases = []; // ['phrase1', 'phrase2', ...]

// --- Configuration and Initialization ---

// Mandatory Canvas environment variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firestore Paths
const TIMETABLE_DOC_PATH = `artifacts/${appId}/public/data/timetable/schedule`;
const CATCHPHRASE_DOC_PATH = `artifacts/${appId}/public/data/catchphrases/phrases`;
const PEOPLE_DOC_PATH = `artifacts/${appId}/public/data/people/roster`;
const DARK_MODE_DOC_REF = () => doc(db, `artifacts/${appId}/users/${userId}/preferences/settings`);

// Initial Data Structure (re-embedded from uploaded files for database seeding)
const INITIAL_TIMETABLE_DATA = {
    "Alex": {
        "color": "blue",
        "Week 1": {
            "Monday": ["Business", "Sociology", "Media Lesson 10", "", ""],
            "Tuesday": ["Media", "Business", "", "Sociology", ""],
            "Wednesday": ["", "", "", "Media", "Business"],
            "Thursday": ["", "Sociology Lesson 10", "Sociology", "Business", "Media"],
            "Friday": ["", "Media", "Business", "", "Sociology"]
        },
        "Week 2": {
            "Monday": ["Business", "Sociology", "Business Lesson 10", "Media", ""],
            "Tuesday": ["Media", "Business", "TPE", "Citizenship", ""],
            "Wednesday": ["", "Sociology", "", "Media", "Business"],
            "Thursday": ["Psychology", "Sociology", "Sociology", "Business", "Sociology"],
            "Friday": ["", "Media", "Business", "", "Sociology"]
        }
    },
    "Oliwia": {
        "color": "pink",
        "Week 1": {
            "Monday": ["Maths", "", "Sociology Lesson 10", "Psychology Lesson 10", ""],
            "Tuesday": ["Sociology", "Maths", "", "Maths Lesson 10", "Psychology"],
            "Wednesday": ["", "TPE", "Psychology", "Sociology", "Maths"],
            "Thursday": ["Psychology", "", "", "Maths", "Sociology"],
            "Friday": ["Maths", "TPE", "Media Lesson 10", "Psychology Lesson 10", ""]
        },
        "Week 2": {
            "Monday": ["Maths", "", "Psychology", "Sociology", ""],
            "Tuesday": ["Sociology", "Maths", "", "Citizenship", "Psychology"],
            "Wednesday": ["", "", "Psychology", "Sociology", "Maths"],
            "Thursday": ["Psychology", "", "", "", "Sociology"],
            "Friday": ["Maths", "TPE", "Media Lesson 10", "Psychology Lesson 10", ""]
        }
    },
    "Prinson": {
        "color": "darkgreen",
        "Week 1": {
            "Monday": ["", "Chemistry Lesson 10", "Biology", "Psychology Lesson 10", ""],
            "Tuesday": ["Biology", "", "", "Chemistry", "Psychology"],
            "Wednesday": ["EQA", "TPE", "Psychology", "Biology", ""],
            "Thursday": ["Psychology", "Chemistry", "Chemistry", "", "Biology"],
            "Friday": ["EQA", "TPE", "Chemistry", "Psychology", "Biology"]
        },
        "Week 2": {
            "Monday": ["", "Chemistry", "Psychology", "Biology Lesson 10", ""],
            "Tuesday": ["Biology", "", "", "Citizenship", "Psychology"],
            "Wednesday": ["EQA", "Chemistry", "Psychology", "Biology", ""],
            "Thursday": ["Psychology", "Chemistry", "Chemistry", "", "Biology"],
            "Friday": ["EQA", "TPE", "Chemistry", "Psychology", "Biology"]
        }
    },
    "Hanan": {
        "color": "red",
        "Week 1": {
            "Monday": ["", "Sociology", "Media Lesson 10", "CTEC Business", ""],
            "Tuesday": ["Media", "", "", "Sociology", "CTEC Business"],
            "Wednesday": ["", "", "CTEC Business Lesson 10", "Media", ""],
            "Thursday": ["CTEC Business", "Sociology", "CTEC Business", "Maths re-take", "Health & Social Care"],
            "Friday": ["CTEC Business", "Sociology", "Media", "", "Sociology"]
        },
        "Week 2": {
            "Monday": ["", "Sociology", "CTEC Business", "Media", ""],
            "Tuesday": ["Media", "", "TPE", "Citizenship", "CTEC Business"],
            "Wednesday": ["", "Sociology", "CTEC Business", "Media", ""],
            "Thursday": ["CTEC Business", "Sociology", "Sociology", "", "Media"],
            "Friday": ["CTEC Business", "Sociology", "Media", "Health & Social Care", "Health & Social Care"]
        }
    },
    "Hannah": {
        "color": "yellow",
        "Week 1": {
            "Monday": ["EQA", "", "Media Lesson 10", "CTEC Business", "Health & Social Care"],
            "Tuesday": ["Media", "", "Health & Social Care", "Maths re-take", "CTEC Business"],
            "Wednesday": ["Health & Social Care", "Health & Social Care", "CTEC Business Lesson 10", "Media", ""],
            "Thursday": ["CTEC Business", "Sociology", "CTEC Business", "Maths re-take", "Health & Social Care"],
            "Friday": ["CTEC Business", "Sociology", "Media", "Health & Social Care", "Health & Social Care"]
        },
        "Week 2": {
            "Monday": ["EQA", "", "CTEC Business", "Media", "Health & Social Care"],
            "Tuesday": ["Media", "", "Health & Social Care", "Citizenship", "CTEC Business"],
            "Wednesday": ["Health & Social Care", "maths re-take", "CTEC Business", "Media", "TPE"],
            "Thursday": ["CTEC Business", "maths re-take", "CTEC Business", "Maths", "Media"],
            "Friday": ["CTEC Business", "Sociology", "Media", "Health & Social Care", "Health & Social Care"]
        }
    }
};

const INITIAL_PEOPLE_DATA = [
    { id: 'Alex', name: 'Alex', color: 'var(--color-blue)' },
    { id: 'Oliwia', name: 'Oliwia', color: 'var(--color-pink)' },
    { id: 'Prinson', name: 'Prinson', color: 'var(--color-darkgreen)' },
    { id: 'Hanan', name: 'Hanan', color: 'var(--color-red)' },
    { id: 'Hannah', name: 'Hannah', color: 'var(--color-yellow)' }
];


// --- Firebase Logic ---

/**
 * Checks if key data documents exist and uploads initial data if they don't.
 */
const seedDatabase = async () => {
    if (!db || !userId) return;

    try {
        // 1. Seed Timetable Data
        const timetableRef = doc(db, TIMETABLE_DOC_PATH);
        const timetableSnap = await getDoc(timetableRef);

        if (!timetableSnap.exists()) {
            await setDoc(timetableRef, { data: INITIAL_TIMETABLE_DATA });
            console.log("Firestore: Timetable data seeded.");
        }

        // 2. Seed People Data (Roster)
        const peopleRef = doc(db, PEOPLE_DOC_PATH);
        const peopleSnap = await getDoc(peopleRef);

        if (!peopleSnap.exists()) {
            await setDoc(peopleRef, { people: INITIAL_PEOPLE_DATA });
            console.log("Firestore: People data seeded.");
        }

        // 3. Seed Catchphrases (if collection is empty)
        const catchphraseRef = doc(db, CATCHPHRASE_DOC_PATH);
        const catchphraseSnap = await getDoc(catchphraseRef);
        
        // Initialize with an empty array if not present, no default phrases
        if (!catchphraseSnap.exists()) {
             await setDoc(catchphraseRef, { phrases: [] });
             console.log("Firestore: Catchphrases initialized.");
        }

    } catch (error) {
        console.error("Error seeding database:", error);
    }
}

/**
 * Sets up real-time listeners for all public and private data documents.
 */
const subscribeToData = () => {
    if (!db || !userId || !isAuthReady) return;

    // 1. Subscribe to Timetable Data
    onSnapshot(doc(db, TIMETABLE_DOC_PATH), (docSnap) => {
        if (docSnap.exists() && docSnap.data().data) {
            timetableData = docSnap.data().data;
            updateTimetableUI();
            console.log("Firestore: Timetable data updated in real-time.");
        } else {
            timetableData = {};
            updateTimetableUI();
            console.log("Firestore: Timetable document not found or empty.");
        }
    }, (error) => {
        console.error("Error subscribing to timetable:", error);
    });

    // 2. Subscribe to People Data (Roster)
    onSnapshot(doc(db, PEOPLE_DOC_PATH), (docSnap) => {
        if (docSnap.exists() && docSnap.data().people) {
            peopleData = docSnap.data().people;
            updateTimetableUI(); 
            updateCatchphraseUI(); 
            console.log("Firestore: People data updated in real-time.");
        } else {
            peopleData = [];
            updateTimetableUI();
            console.log("Firestore: People document not found or empty.");
        }
    }, (error) => {
        console.error("Error subscribing to people data:", error);
    });

    // 3. Subscribe to Catchphrases
    onSnapshot(doc(db, CATCHPHRASE_DOC_PATH), (docSnap) => {
        if (docSnap.exists() && Array.isArray(docSnap.data().phrases)) {
            currentCatchphrases = docSnap.data().phrases;
            updateCatchphraseUI();
            console.log("Firestore: Catchphrases updated in real-time.");
        } else {
            currentCatchphrases = [];
            updateCatchphraseUI();
            console.log("Firestore: Catchphrases document not found or empty array.");
        }
    }, (error) => {
        console.error("Error subscribing to catchphrases:", error);
    });

    // 4. Subscribe to Dark Mode Preference (Private Data)
    onSnapshot(DARK_MODE_DOC_REF(), (docSnap) => {
        if (docSnap.exists() && typeof docSnap.data().darkMode === 'boolean') {
            setDarkMode(docSnap.data().darkMode, false); // false to avoid Firestore write loop
            console.log("Firestore: Dark mode preference loaded/updated.");
        } else {
            // If no preference exists, default to light mode (false) and save it.
            setDarkMode(false, true); 
        }
    }, (error) => {
        console.error("Error subscribing to dark mode preference:", error);
        setDarkMode(false, false);
    });
}

/**
 * Initializes Firebase, authenticates the user, and starts the data loading process.
 */
const setupFirebase = async () => {
    if (!firebaseConfig) {
        console.error("Firebase configuration is missing.");
        return;
    }

    setLogLevel('debug');
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Sign in using the provided token or anonymously
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        // Wait for auth state change to get the userId
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                isAuthReady = true;
                document.getElementById('userIdDisplay').textContent = `User ID: ${userId}`;

                // Seed the database only after auth is ready
                await seedDatabase();

                // Start real-time listeners
                subscribeToData();

            } else {
                userId = null;
                isAuthReady = true; 
                document.getElementById('userIdDisplay').textContent = 'User ID: N/A (Anon)';
            }
        });

    } catch (error) {
        console.error("Firebase initialization or sign-in failed:", error);
    }
};

// --- UI Rendering and Interaction ---

/**
 * Updates the UI elements (selects) based on loaded people data.
 */
const updateTimetableUI = () => {
    const whoSelects = document.querySelectorAll('#whoSelect2'); // Only whoSelect2 is used for lookup
    const daySelects = document.querySelectorAll('#daySelect2');
    
    // Clear existing options
    whoSelects.forEach(select => select.innerHTML = '');
    daySelects.forEach(select => select.innerHTML = '');

    if (peopleData.length > 0) {
        // Populate Who Selects (People)
        peopleData.forEach(person => {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = person.name;
            whoSelects.forEach(select => select.appendChild(option.cloneNode(true)));
        });

        // Set the first person as default
        whoSelects.forEach(select => select.value = peopleData[0].id);

        // Populate Day Selects
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        days.forEach(day => {
            const option = document.createElement('option');
            option.value = day;
            option.textContent = day;
            daySelects.forEach(select => select.appendChild(option.cloneNode(true)));
        });
        
        // Ensure initial selection is set for Day
        if (days.length > 0) {
             daySelects.forEach(select => select.value = days[0]);
        }
    } else {
        // Fallback or loading state
        whoSelects.forEach(select => select.innerHTML = '<option value="">Loading People...</option>');
        daySelects.forEach(select => select.innerHTML = '<option value="">Loading Days...</option>');
    }
};

/**
 * Updates the catchphrase display with a random phrase from the database.
 */
const updateCatchphraseUI = () => {
    const phraseDisplay = document.getElementById('catchphraseDisplay');

    if (currentCatchphrases.length === 0) {
        phraseDisplay.textContent = "Time for a new tag line!";
        return;
    }

    const randomIndex = Math.floor(Math.random() * currentCatchphrases.length);
    phraseDisplay.textContent = currentCatchphrases[randomIndex];
};

/**
 * Custom function to display a schedule in the modal.
 * @param {string} title The title of the schedule.
 * @param {Array<string>} schedule An array of period names.
 * @param {string} color The CSS variable name for the person's color.
 */
const showScheduleModal = (title, schedule, color) => {
    const modalBack = document.getElementById('scheduleModalBack');
    const modal = document.getElementById('scheduleModal');
    const modalTitle = document.getElementById('scheduleTitle');
    const content = document.getElementById('modalScheduleContent');

    modalTitle.textContent = title;
    // Set color variable for the schedule item border
    modal.style.setProperty('--person-color', color);
    content.innerHTML = ''; // Clear previous content

    const periods = ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5"];

    schedule.forEach((subject, index) => {
        const periodName = periods[index] || `Period ${index + 1}`;
        const subjectText = subject.trim() || 'FREE PERIOD 🧘';
        
        const row = document.createElement('div');
        row.className = 'scheduleRow';
        row.innerHTML = `
            <div class="schedulePeriod">${periodName}</div>
            <div class="scheduleSubject">${subjectText}</div>
        `;
        content.appendChild(row);
    });

    modalBack.style.display = 'flex';
};


// --- Feature Handlers (Firestore interactions) ---

/**
 * Handles the logic for adding a new catchphrase to Firestore.
 */
const handleAddPhrase = async () => {
    if (!isAuthReady || !db) {
        showCustomAlert("Error", "Authentication is not ready. Please wait.");
        return;
    }

    const newPhraseInput = document.getElementById('newPhraseInput');
    const newPhrase = newPhraseInput.value.trim();

    if (!newPhrase) {
        showCustomAlert("Error", "Please enter a phrase.");
        return;
    }

    try {
        const catchphraseRef = doc(db, CATCHPHRASE_DOC_PATH);
        await updateDoc(catchphraseRef, {
            phrases: arrayUnion(newPhrase)
        });

        newPhraseInput.value = '';
        showCustomAlert("Success", "New phrase added to the shared list!");
    } catch (error) {
        console.error("Error adding phrase:", error);
        showCustomAlert("Error", `Failed to add phrase: ${error.message}`);
    }
};

/**
 * Handles the button click for displaying a person's schedule.
 */
const handleShowDailySchedule = () => {
    const whoId = document.getElementById('whoSelect2').value;
    const week = document.getElementById('weekSelect2').value;
    const day = document.getElementById('daySelect2').value;

    if (!whoId || !week || !day) {
        showCustomAlert("Error", "Please select a person, week, and day.");
        return;
    }

    // Check if data is loaded
    if (Object.keys(timetableData).length === 0) {
        showCustomAlert("Error", "Timetable data is still loading. Please wait a moment.");
        return;
    }
    
    const personData = timetableData[whoId];
    if (!personData) {
        showCustomAlert("Error", `Timetable data not found for ${whoId}.`);
        return;
    }

    const schedule = personData[week]?.[day];

    if (!schedule || schedule.length === 0) {
        // Fallback for days with no schedule data
        showScheduleModal(`${whoId}'s Schedule: ${day} (${week})`, ["", "", "", "", ""], 'var(--muted)');
        return;
    }
    
    // Find person's color for styling
    const person = peopleData.find(p => p.id === whoId);
    const color = person ? person.color : 'var(--text)';

    const title = `${whoId}'s Schedule: ${day} (${week})`;
    showScheduleModal(title, schedule, color);
};


// --- Utility Functions (Alerts, Dark Mode) ---

/**
 * Shows a custom modal alert message instead of the blocked window.alert().
 * @param {string} title The title of the alert.
 * @param {string} message The message content.
 */
const showCustomAlert = (title, message) => {
    const modal = document.getElementById('confirmModal');
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modalContent">
            <h3>${title}</h3>
            <p>${message}</p>
            <button class="btn primary" onclick="document.getElementById('confirmModal').style.display='none'">OK</button>
        </div>
    `;
};
// Expose for inline onclick
window.showCustomAlert = showCustomAlert; 

/**
 * Sets the dark mode state and optionally updates Firestore.
 * @param {boolean} isDark - true for dark mode, false for light mode.
 * @param {boolean} updateFirestore - if true, save preference to Firestore.
 */
const setDarkMode = (isDark, updateFirestore = true) => {
    const toggleInput = document.getElementById('darkModeToggle');
    
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (toggleInput) toggleInput.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        if (toggleInput) toggleInput.checked = false;
    }

    if (updateFirestore && isAuthReady && db && userId) {
        const ref = DARK_MODE_DOC_REF();
        setDoc(ref, { darkMode: isDark }, { merge: true }).catch(e => {
            console.error("Failed to save dark mode preference:", e);
        });
    }
}

const toggleDarkMode = () => {
    const isDark = !document.body.classList.contains('dark-mode');
    setDarkMode(isDark, true);
};

// --- Event Listeners and Execution ---

const setupEventListeners = () => {
    // Add Phrase Feature
    document.getElementById('addPhraseBtn').addEventListener('click', handleAddPhrase);
    document.getElementById('refreshTag').addEventListener('click', updateCatchphraseUI);

    // Daily Schedule Feature
    document.getElementById('whatBtn').addEventListener('click', handleShowDailySchedule);
    document.getElementById('scheduleClose').addEventListener('click', () => {
        document.getElementById('scheduleModalBack').style.display = 'none';
    });

    // Dark Mode Toggle
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
};

// --- Execution ---

window.onload = async () => {
    setupEventListeners();
    await setupFirebase(); 
};
