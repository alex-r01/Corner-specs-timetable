// Firebase Imports (MUST use cdn links provided by the environment)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
const MOCK_PEOPLE = [
    { id: 'alessandro', name: 'Alessandro', color: 'var(--color-red)' },
    { id: 'liam', name: 'Liam', color: 'var(--color-blue)' },
    { id: 'eliza', name: 'Eliza', color: 'var(--color-pink)' },
    { id: 'oscar', name: 'Oscar', color: 'var(--color-yellow)' },
    { id: 'sara', name: 'Sara', color: 'var(--color-darkgreen)' },
];

const MOCK_TIMETABLE = {
    WeekA: {
        Monday: {
            1: { subject: 'Math', people: ['alessandro', 'liam'] },
            2: { subject: 'English', people: ['eliza', 'sara'] },
            3: { subject: 'Free', people: [] },
            4: { subject: 'Science', people: ['oscar', 'alessandro'] },
            5: { subject: 'PE', people: ['liam', 'eliza', 'sara', 'oscar'] },
        },
        Tuesday: {
            1: { subject: 'History', people: ['eliza'] },
            2: { subject: 'Free', people: [] },
            3: { subject: 'Art', people: ['alessandro', 'oscar'] },
            4: { subject: 'Math', people: ['liam', 'sara'] },
            5: { subject: 'Free', people: [] },
        },
        Wednesday: {
            1: { subject: 'Chem', people: ['alessandro', 'eliza'] },
            2: { subject: 'Physics', people: ['liam', 'oscar'] },
            3: { subject: 'Free', people: [] },
            4: { subject: 'English', people: ['sara'] },
            5: { subject: 'IT', people: ['alessandro', 'liam', 'oscar'] },
        },
        Thursday: {
            1: { subject: 'Bio', people: ['sara', 'eliza'] },
            2: { subject: 'Art', people: ['alessandro', 'oscar'] },
            3: { subject: 'Free', people: ['liam', 'sara'] },
            4: { subject: 'Free', people: [] },
            5: { subject: 'Math', people: ['eliza', 'liam', 'alessandro'] },
        },
        Friday: {
            1: { subject: 'PE', people: ['liam', 'oscar', 'sara'] },
            2: { subject: 'History', people: ['alessandro'] },
            3: { subject: 'Science', people: ['eliza', 'oscar'] },
            4: { subject: 'Free', people: ['alessandro', 'liam'] },
            5: { subject: 'English', people: ['eliza', 'sara'] },
        }
    },
    WeekB: {
        Monday: {
            1: { subject: 'Science', people: ['alessandro', 'eliza', 'oscar'] },
            2: { subject: 'Free', people: [] },
            3: { subject: 'Geo', people: ['liam', 'sara'] },
            4: { subject: 'Free', people: [] },
            5: { subject: 'English', people: ['alessandro', 'liam', 'eliza', 'oscar', 'sara'] },
        },
        Tuesday: {
            1: { subject: 'Math', people: ['liam', 'sara'] },
            2: { subject: 'IT', people: ['alessandro', 'eliza'] },
            3: { subject: 'Free', people: [] },
            4: { subject: 'Chem', people: ['oscar'] },
            5: { subject: 'Physics', people: ['liam', 'eliza'] },
        },
        Wednesday: {
            1: { subject: 'History', people: ['alessandro', 'oscar'] },
            2: { subject: 'Bio', people: ['sara', 'liam'] },
            3: { subject: 'English', people: ['eliza', 'alessandro'] },
            4: { subject: 'Free', people: [] },
            5: { subject: 'Art', people: ['oscar', 'liam'] },
        },
        Thursday: {
            1: { subject: 'Free', people: [] },
            2: { subject: 'PE', people: ['alessandro', 'eliza', 'sara'] },
            3: { subject: 'Math', people: ['oscar', 'liam'] },
            4: { subject: 'Science', people: ['alessandro', 'eliza'] },
            5: { subject: 'Geo', people: ['sara', 'oscar'] },
        },
        Friday: {
            1: { subject: 'English', people: ['alessandro', 'liam'] },
            2: { subject: 'Math', people: ['eliza', 'oscar', 'sara'] },
            3: { subject: 'Free', people: ['alessandro', 'liam'] },
            4: { subject: 'IT', people: ['eliza', 'sara'] },
            5: { subject: 'PE', people: ['oscar', 'alessandro'] },
        }
    }
};

const DEFAULT_CATCHPHRASES = [
    "Fuckass Friday!",
    "Timetable Takedown!",
    "Is anyone free, please?",
    "Schedule Sucks.",
    "Bored of Free Periods!",
    "Lesson Loadout.",
];

// Utility: Gets Firestore document reference for public data
const getPublicDocRef = (collectionName, documentId) => {
    return doc(db, 'artifacts', appId, 'public', 'data', collectionName, documentId);
};

// Utility: Gets Firestore collection reference for public data
// const getPublicCollectionRef = (collectionName) => {
//     return collection(db, 'artifacts', appId, 'public', 'data', collectionName);
// }; // Not needed for this app, but kept for reference

// --- Firebase and Auth Setup ---

const setupFirebase = async () => {
    if (!firebaseConfig) {
        console.error("Firebase configuration is missing.");
        return;
    }
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('debug'); // Enable detailed logging

        // Ensure sign-in happens before Firestore calls
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                isAuthReady = true;
                console.log("User authenticated:", userId);
                startDataListeners();
            } else {
                console.log("Authentication failed or logged out.");
                // Fallback: Use a unique anonymous ID if auth fails
                userId = crypto.randomUUID(); 
                isAuthReady = true;
                startDataListeners(); 
            }
        });

    } catch (error) {
        console.error("Error during Firebase setup:", error);
    }
};

// --- Data Listeners ---

const startDataListeners = () => {
    if (!isAuthReady || !db) return;

    // 1. Listen for Timetable Data
    const timetableRef = getPublicDocRef('config', 'timetable');
    onSnapshot(timetableRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().schedule) {
            // NOTE: Firestore requires simple, flat data structures. Timetable must be JSON serializable.
            // Assuming timetableData is saved correctly as a simple map of maps of objects.
            timetableData = docSnap.data().schedule;
            console.log("Timetable data loaded from Firestore.");
        } else {
            timetableData = MOCK_TIMETABLE;
            console.warn("No timetable found in Firestore. Using mock data.");
            // Optionally initialize with mock data if needed for the first run
            // setDoc(timetableRef, { schedule: MOCK_TIMETABLE }, { merge: true });
        }
        // Ensure UI is populated after data is loaded
        populateAllSelects();
    }, (error) => {
        console.error("Error fetching timetable:", error);
        timetableData = MOCK_TIMETABLE; // Fallback
        populateAllSelects();
    });

    // 2. Listen for Catchphrases
    const phrasesRef = getPublicDocRef('config', 'catchphrases');
    onSnapshot(phrasesRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().phrases && Array.isArray(docSnap.data().phrases)) {
            currentCatchphrases = [...DEFAULT_CATCHPHRASES, ...docSnap.data().phrases];
            console.log(`Catchphrases loaded: ${currentCatchphrases.length} total.`);
        } else {
            currentCatchphrases = DEFAULT_CATCHPHRASES;
            console.warn("No custom catchphrases found. Using default list.");
        }
        updateCatchphraseUI();
    }, (error) => {
        console.error("Error fetching catchphrases:", error);
        currentCatchphrases = DEFAULT_CATCHPHRASES; // Fallback
        updateCatchphraseUI();
    });

    // 3. People Data (Assumed stable and can be mock or fetched separately)
    peopleData = MOCK_PEOPLE;
    populateWhoSelect();
};

// --- UI Rendering and Population ---

/**
 * Populates the Day select dropdown based on the selected Week.
 * @param {string} weekSelectId ID of the Week select element.
 * @param {string} daySelectId ID of the Day select element.
 */
const populateDaySelect = (weekSelectId, daySelectId) => {
    const weekSelect = document.getElementById(weekSelectId);
    const daySelect = document.getElementById(daySelectId);

    daySelect.innerHTML = '';
    const selectedWeek = weekSelect.value;
    
    if (timetableData[selectedWeek]) {
        // Get and sort days to ensure correct order
        const days = Object.keys(timetableData[selectedWeek]).sort((a, b) => {
            const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            return dayOrder.indexOf(a) - dayOrder.indexOf(b);
        });

        days.forEach(day => {
            const option = document.createElement('option');
            option.value = day;
            option.textContent = day;
            daySelect.appendChild(option);
        });
    }
};

/**
 * Populates all Week select dropdowns and triggers the initial Day population.
 */
const populateAllSelects = () => {
    const weekSelect = document.getElementById('weekSelect');
    const weekSelect2 = document.getElementById('weekSelect2');
    
    // Store current values to avoid losing selection on data update
    const currentWeek1 = weekSelect.value;
    const currentWeek2 = weekSelect2.value;
    
    weekSelect.innerHTML = '';
    weekSelect2.innerHTML = '';

    const weeks = Object.keys(timetableData);
    if (weeks.length === 0) return;

    // Populate Week Selects
    weeks.forEach(week => {
        const textContent = week.replace('Week', 'Week ');
        const option1 = new Option(textContent, week);
        const option2 = new Option(textContent, week);
        weekSelect.appendChild(option1);
        weekSelect2.appendChild(option2);
    });
    
    // Restore selected values or default to the first week
    const defaultWeek = weeks[0];
    weekSelect.value = currentWeek1 && weeks.includes(currentWeek1) ? currentWeek1 : defaultWeek;
    weekSelect2.value = currentWeek2 && weeks.includes(currentWeek2) ? currentWeek2 : defaultWeek;

    // Set up dynamic listeners for Week changes
    weekSelect.onchange = () => populateDaySelect('weekSelect', 'daySelect');
    weekSelect2.onchange = () => populateDaySelect('weekSelect2', 'daySelect2');

    // Initial Day population
    populateDaySelect('weekSelect', 'daySelect');
    populateDaySelect('weekSelect2', 'daySelect2');
};

/**
 * Populates the Who select dropdown with people names.
 */
const populateWhoSelect = () => {
    const whoSelect = document.getElementById('whoSelect');
    whoSelect.innerHTML = '';

    peopleData.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        whoSelect.appendChild(option);
    });
    // Week/Day population for the extra panel is handled by populateAllSelects
};

/**
 * Updates the randomized catchphrase shown in the header.
 */
const updateCatchphraseUI = () => {
    const tagElement = document.getElementById('randomTag');
    if (currentCatchphrases.length > 0) {
        const randomIndex = Math.floor(Math.random() * currentCatchphrases.length);
        tagElement.textContent = currentCatchphrases[randomIndex];
    } else {
        tagElement.textContent = "No phrases yet!";
    }
    // Force reflow/reanimation for the fade-in effect
    tagElement.style.opacity = 0;
    setTimeout(() => {
        tagElement.style.opacity = 1;
    }, 10);
};

// --- Core Timetable Functions ---

const handleCheck = (mode) => {
    const week = document.getElementById('weekSelect').value;
    const day = document.getElementById('daySelect').value;
    const period = document.getElementById('periodSelect').value;
    const resultArea = document.getElementById('resultArea');

    if (!timetableData[week] || !timetableData[week][day] || !timetableData[week][day][period]) {
        resultArea.innerHTML = `<div class="muted">Timetable entry not found for ${week}, ${day}, Period ${period}.</div>`;
        return;
    }

    const lesson = timetableData[week][day][period];
    const peopleInLessonIds = lesson.people || []; // Ensure it's an array
    let resultPeople;
    let title;
    
    if (mode === 'free') {
        // Find people whose IDs are NOT in the lesson's people list
        resultPeople = peopleData.filter(p => !peopleInLessonIds.includes(p.id));
        title = `Free People (Period ${period}):`;
    } else { // mode === 'lesson'
        // Find people whose IDs ARE in the lesson's people list
        resultPeople = peopleData.filter(p => peopleInLessonIds.includes(p.id));
        title = `Lesson: ${lesson.subject} (Period ${period}):`;
    }

    if (resultPeople.length === 0) {
        resultArea.innerHTML = `<div class="muted" style="padding: 10px 0;">${mode === 'free' ? 'No one is free! Everyone has ' + lesson.subject + '.' : 'No one has this lesson!'}</div>`;
        return;
    }

    let html = `<div style="font-weight:600; margin-bottom:12px;">${title}</div>`;
    resultPeople.forEach(person => {
        // Find the color variable name based on the ID for consistency
        const colorVar = person.color;
        html += `
            <div class="person" style="background:${colorVar}15;">
                <div class="swatch" style="background:${colorVar};"></div>
                <div>${person.name}</div>
            </div>
        `;
    });

    resultArea.innerHTML = html;
};

// --- Extra Features Functions ---

const handleAddPhrase = async () => {
    const phraseInput = document.getElementById('phraseInput');
    const newPhrase = phraseInput.value.trim();

    if (newPhrase.length < 3) {
        // Use custom modal style instead of alert
        showCustomMessage("Phrase must be at least 3 characters long.", "Error");
        return;
    }

    if (currentCatchphrases.includes(newPhrase)) {
         showCustomMessage(`Phrase "${newPhrase}" already exists!`, "Info");
         return;
    }

    try {
        const phrasesRef = getPublicDocRef('config', 'catchphrases');
        // Use arrayUnion to safely add the new phrase to the existing array
        await updateDoc(phrasesRef, {
            phrases: arrayUnion(newPhrase)
        });
        phraseInput.value = '';
        // Note: The onSnapshot listener will update the UI via currentCatchphrases.
        showCustomMessage(`Phrase added! Refreshing tag...`, "Success");
    } catch (error) {
        if (error.code === 'not-found') {
             // Document doesn't exist, create it.
             await setDoc(phrasesRef, { phrases: [newPhrase] });
             phraseInput.value = '';
             showCustomMessage(`Phrase added! Refreshing tag...`, "Success");
        } else {
            console.error("Error adding phrase:", error);
            showCustomMessage("Failed to save phrase. Check console for details.", "Error");
        }
    }
};

const handleShowDailySchedule = () => {
    const whoId = document.getElementById('whoSelect').value;
    const week = document.getElementById('weekSelect2').value;
    const day = document.getElementById('daySelect2').value;
    
    const person = peopleData.find(p => p.id === whoId);
    
    if (!person || !timetableData[week] || !timetableData[week][day]) {
        showCustomMessage(`Could not retrieve schedule for ${whoId} on ${day} (${week}).`, "Error");
        return;
    }

    const dailySchedule = timetableData[week][day];
    const periods = Object.keys(dailySchedule).sort((a, b) => parseInt(a) - parseInt(b));
    
    let scheduleHTML = '';

    periods.forEach(pNum => {
        const lesson = dailySchedule[pNum];
        let subject = "Free Period";
        let isMatch = false;

        if (lesson.people && lesson.people.includes(person.id)) {
            subject = lesson.subject;
            isMatch = true;
        }

        const colorVar = person.color;

        scheduleHTML += `
            <div class="scheduleRow">
                <div class="scheduleCell pnum">P${pNum}</div>
                <div class="scheduleCell subj" style="${isMatch ? `font-weight:600; background: ${colorVar}30; border-color: ${colorVar};` : ''}">
                    ${subject}
                </div>
            </div>
        `;
    });

    document.getElementById('scheduleTitle').textContent = `${person.name}'s Schedule: ${day}, ${week.replace('Week', 'W')}`;
    document.getElementById('modalScheduleContent').innerHTML = scheduleHTML;
    document.getElementById('scheduleModalBack').style.display = 'flex';
};

// --- General UI and Event Handling ---

const showCustomMessage = (message, title) => {
    const modalBack = document.getElementById('confirmModal');
    // Existing style setup from HTML styles block
    const modalHtml = `
        <div class="modal">
            <h3 style="margin-top:0;">${title}</h3>
            <p>${message}</p>
            <div style="text-align:right;">
                <button class="btn" style="width:auto; padding:10px 20px; font-size:14px; margin-top:10px;" onclick="document.getElementById('confirmModal').style.display='none'">
                    Got it
                </button>
            </div>
        </div>
    `;
    modalBack.innerHTML = modalHtml;
    modalBack.style.display = 'flex';
};

const setupEventListeners = () => {
    // Core Timetable Buttons
    document.getElementById('checkBtn').addEventListener('click', () => handleCheck('free'));
    document.getElementById('lessonBtn').addEventListener('click', () => handleCheck('lesson'));

    // Extra Features Toggle
    const extraPanel = document.getElementById('extraPanel');
    const toggleBtn = document.getElementById('toggleExtra');

    toggleBtn.addEventListener('click', () => {
        const isOpen = extraPanel.classList.contains('open');
        if (isOpen) {
            extraPanel.classList.remove('open');
            toggleBtn.textContent = 'Show';
        } else {
            extraPanel.classList.add('open');
            toggleBtn.textContent = 'Hide';
        }
    });

    // Catchphrase Features
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

// --- Dark Mode Logic ---

const loadDarkModePreference = () => {
    // Check if the user has a preference saved, or respects the system preference
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
    await setupFirebase(); // Start the Firebase auth and data loading process
};
