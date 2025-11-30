// Firebase Imports (MUST use cdn links provided by the environment)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global Variables
let db;
let auth;
let userId = null;
let isAuthReady = false;
let peopleData = [];
let timetableData = {};
let currentCatchphrases = [];

// --- Configuration and Initialization ---

// Mandatory Canvas environment variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Mock Data (Used until Firestore data loads)
// This mock data is based on the timetable.json file structure for people and colors
const MOCK_PEOPLE = [
    { id: 'Alex', name: 'Alex', color: 'var(--color-blue)' },
    { id: 'Oliwia', name: 'Oliwia', color: 'var(--color-pink)' },
    { id: 'Prinson', name: 'Prinson', color: 'var(--color-red)' },
    { id: 'Hanan', name: 'Hanan', color: 'var(--color-darkgreen)' },
    { id: 'Hannah', name: 'Hannah', color: 'var(--color-yellow)' },
];

const MOCK_TIMETABLE_DATA = {
    // Structure populated from timetable.json
};

// --- Firebase Setup and Data Management ---

const getPublicCatchphrasesDocRef = () => {
    // Catchphrases are public data shared across all users
    const path = `/artifacts/${appId}/public/data/catchphrases`;
    return doc(db, path, 'shared_list');
};

/**
 * Initializes Firebase, authenticates the user, and sets up real-time listeners.
 */
const setupFirebase = async () => {
    try {
        if (!firebaseConfig) {
            console.error("Firebase config is missing. Cannot initialize Firebase.");
            return;
        }

        // Initialize App and Services
        setLogLevel('Debug');
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Sign In
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            // Fallback to anonymous sign-in if token is not provided
            await signInAnonymously(auth);
        }

        // Auth State Listener
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                // Display the user ID for debugging/sharing in a multi-user context
                document.getElementById('userIdDisplay').textContent = `User ID: ${userId}`;
            } else {
                // If signed out or anonymous, use a placeholder ID
                userId = 'anonymous-user';
                document.getElementById('userIdDisplay').textContent = `User ID: ${userId} (Anon)`;
            }
            isAuthReady = true;

            // Once authenticated, start loading/listening to data
            if (isAuthReady) {
                // In a real app, this is where you'd fetch initial config
                peopleData = MOCK_PEOPLE;
                timetableData = window.timetableData || MOCK_TIMETABLE_DATA; // Use data loaded from <script> tag if available, otherwise mock
                populateSelects();

                // Setup listeners for real-time data
                loadCatchphrases();
            }
        });

    } catch (error) {
        console.error("Error during Firebase setup:", error);
        showModal('Error', `Failed to connect to the database. Error: ${error.message}`);
    }
};

// --- Catchphrase Logic (Shared Data) ---

/**
 * Sets up a real-time listener for the shared catchphrases list.
 */
const loadCatchphrases = () => {
    if (!db) return;

    const catchphraseRef = getPublicCatchphrasesDocRef();

    onSnapshot(catchphraseRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentCatchphrases = data.phrases || [];
            updateCatchphraseUI();
        } else {
            console.log("Catchphrase document does not exist, initializing...");
            // Initialize the document if it doesn't exist
            setDoc(catchphraseRef, { phrases: ["What do you have today?"] }, { merge: true })
                .catch(e => console.error("Error initializing catchphrase doc:", e));
            currentCatchphrases = ["What do you have today?"];
            updateCatchphraseUI();
        }
    }, (error) => {
        console.error("Error listening to catchphrases:", error);
    });
};

/**
 * Updates the UI with a randomly selected catchphrase.
 */
const updateCatchphraseUI = () => {
    const catchphraseElement = document.getElementById('catchphrase');
    if (currentCatchphrases.length > 0) {
        const randomIndex = Math.floor(Math.random() * currentCatchphrases.length);
        catchphraseElement.textContent = currentCatchphrases[randomIndex];
    } else {
        catchphraseElement.textContent = "Time for a new catchphrase!";
    }
};

/**
 * Handles adding a new catchphrase to the shared list.
 */
const handleAddPhrase = async () => {
    if (!db || !isAuthReady) {
        showModal('Hold On', 'Database connection is not ready yet. Please wait.');
        return;
    }

    const input = document.getElementById('newPhraseInput');
    const newPhrase = input.value.trim();

    if (newPhrase.length < 3) {
        showModal('Error', 'Catchphrase must be at least 3 characters long.');
        return;
    }

    const catchphraseRef = getPublicCatchphrasesDocRef();
    try {
        // Use arrayUnion to safely add the new phrase without duplicates
        await updateDoc(catchphraseRef, {
            phrases: arrayUnion(newPhrase)
        });
        input.value = ''; // Clear input on success
        showModal('Success', 'New catchphrase added! Click the refresh icon to see it.');
    } catch (e) {
        console.error("Error adding catchphrase: ", e);
        showModal('Error', `Failed to add phrase: ${e.message}`);
    }
};

// --- Timetable Logic ---

/**
 * Populates the dropdown selects based on the loaded timetable data.
 */
const populateSelects = () => {
    const whoSelect1 = document.getElementById('whoSelect1');
    const whoSelect2 = document.getElementById('whoSelect');
    const weekSelect1 = document.getElementById('weekSelect1');
    const weekSelect2 = document.getElementById('weekSelect2');
    const daySelect1 = document.getElementById('daySelect1');
    const daySelect2 = document.getElementById('daySelect2');

    // 1. Populate Who Selects (People)
    const people = Object.keys(timetableData);
    if (people.length === 0) {
        peopleData.forEach(p => people.push(p.id));
    }
    
    // Clear existing options
    [whoSelect1, whoSelect2].forEach(select => {
        select.innerHTML = '';
        people.forEach(person => {
            const option = document.createElement('option');
            option.value = person;
            option.textContent = person;
            select.appendChild(option);
        });
    });

    // 2. Populate Week Selects
    const weeks = Object.keys(timetableData[people[0]] || { 'Week 1': 0, 'Week 2': 0 }); // Use keys from first person or default
    [weekSelect1, weekSelect2].forEach(select => {
        select.innerHTML = '';
        weeks.forEach(week => {
            const option = document.createElement('option');
            option.value = week;
            option.textContent = week;
            select.appendChild(option);
        });
    });
    
    // 3. Populate Day Selects
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    [daySelect1, daySelect2].forEach(select => {
        select.innerHTML = '';
        days.forEach(day => {
            const option = document.createElement('option');
            option.value = day;
            option.textContent = day;
            select.appendChild(option);
        });
    });

    // Automatically select current week/day
    const { currentWeek, currentDay } = getCurrentWeek();
    weekSelect1.value = currentWeek;
    weekSelect2.value = currentWeek;
    daySelect1.value = currentDay;
    daySelect2.value = currentDay;
};

/**
 * Determines the current day and week (assuming a fixed 2-week rotation cycle).
 * @returns {{currentWeek: string, currentDay: string}}
 */
const getCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const startOfWeek = new Date(now.setDate(now.getDate() - dayOfWeek + 1)); // Set to Monday

    // Calculate days elapsed since a fixed starting point (e.g., Week 1, Monday, Sept 1, 2025)
    // For this example, let's assume Week 1 started on Monday, September 1st, 2025 (a real-world date for example)
    const weekOneStart = new Date('2025-09-01T00:00:00'); 
    
    // Calculate total days passed since the start date
    const diffTime = Math.abs(startOfWeek - weekOneStart);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    // Calculate the week number (2-week cycle)
    const totalWeeksPassed = Math.floor(diffDays / 7);
    const isWeekOne = (totalWeeksPassed % 2 === 0); // Assuming 0-indexed weeks
    
    const currentWeek = isWeekOne ? 'Week 1' : 'Week 2';

    const dayMap = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
    const currentDay = dayMap[dayOfWeek] || 'Monday'; // Default to Monday if it's weekend

    return { currentWeek, currentDay };
};


/**
 * Handles showing the daily schedule in a modal based on selected options.
 */
const handleShowDailySchedule = () => {
    const who = document.getElementById('whoSelect').value;
    const week = document.getElementById('weekSelect2').value;
    const day = document.getElementById('daySelect2').value;

    if (!who || !week || !day) {
        showModal('Missing Info', 'Please select a person, week, and day.');
        return;
    }
    
    const personSchedule = timetableData[who];
    if (!personSchedule) {
        showModal('Error', `Timetable data for ${who} is missing.`);
        return;
    }

    const daySchedule = personSchedule[week]?.[day];

    if (!daySchedule || daySchedule.length === 0) {
        showModal('Not Found', `No schedule found for ${who} on ${week}, ${day}.`);
        return;
    }

    // Prepare modal content
    const modalTitle = document.getElementById('scheduleTitle');
    const modalContent = document.getElementById('modalScheduleContent');
    modalContent.innerHTML = '';
    
    modalTitle.textContent = `${who}'s Schedule: ${day}, ${week}`;

    const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'];
    const personColor = peopleData.find(p => p.id === who)?.color || 'var(--text)';
    
    daySchedule.forEach((subject, index) => {
        const periodName = periods[index];
        if (subject && subject.trim() !== '') {
            const row = document.createElement('div');
            row.className = 'scheduleRow';
            row.innerHTML = `
                <div class="periodLabel">${periodName}</div>
                <div class="subjectName" style="color: ${personColor};">${subject}</div>
            `;
            modalContent.appendChild(row);
        }
    });

    if (modalContent.children.length === 0) {
        modalContent.innerHTML = `<p style="text-align:center; padding: 20px;">No classes found for this day.</p>`;
    }

    document.getElementById('scheduleModalBack').style.display = 'flex';
};


// --- Modal / UI Helper Functions ---

/**
 * Shows the custom alert/confirmation modal.
 * @param {string} title The title of the modal.
 * @param {string} message The message content.
 */
const showModal = (title, message) => {
    const modal = document.getElementById('confirmModal');
    modal.innerHTML = `
        <div class="modalBackdrop">
            <div class="modalContent">
                <h3 style="margin-top: 0;">${title}</h3>
                <p>${message}</p>
                <div style="text-align: right; margin-top: 15px;">
                    <button class="btn secondaryBtn" onclick="document.getElementById('confirmModal').style.display='none'">OK</button>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'block';
};

/**
 * Hides the schedule modal.
 */
const closeModal = (modalId) => {
    document.getElementById(modalId).style.display = 'none';
};


// --- Event Listeners Setup ---

const setupEventListeners = () => {
    // Catchphrase Feature
    document.getElementById('addPhraseBtn').addEventListener('click', handleAddPhrase);
    document.getElementById('refreshTag').addEventListener('click', updateCatchphraseUI);

    // Daily Schedule Feature
    document.getElementById('whatBtn').addEventListener('click', handleShowDailySchedule);
    document.getElementById('scheduleClose').addEventListener('click', () => {
        document.getElementById('scheduleModalBack').style.display = 'none';
    });
    
    // Select change listeners to automatically update the 'What do I have today?' form
    document.getElementById('whoSelect').addEventListener('change', () => {
        const selectedPerson = document.getElementById('whoSelect').value;
        const personColor = peopleData.find(p => p.id === selectedPerson)?.color || 'var(--text)';
        const whatCard = document.getElementById('whatCard');
        whatCard.style.borderTop = `1px solid ${personColor}`;
    });

    // Dark Mode Toggle
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
};

// --- Dark Mode Logic ---

const loadDarkModePreference = () => {
    // Check if the user has a preference saved, or respects the system preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const storedPreference = localStorage.getItem('darkMode');
    
    let isDarkMode = false;
    if (storedPreference !== null) {
        // Explicitly set by user
        isDarkMode = storedPreference === 'true';
    } else if (prefersDark) {
        // System preference
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
    // Load data from the separately loaded JSON file (timetable.json)
    if (typeof window.timetableData !== 'undefined' && window.timetableData !== null) {
        timetableData = window.timetableData;
    }
    
    loadDarkModePreference();
    setupEventListeners();
    // Firebase setup must happen last as it triggers data loading and auth state change
    await setupFirebase(); 
};
