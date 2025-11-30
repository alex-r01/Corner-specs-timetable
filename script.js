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
let currentWhoSelect = 'alessandro'; // Default to Alessandro

// --- Configuration and Initialization ---

// Mandatory Canvas environment variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Mock Data (Used until Firestore data loads)
const MOCK_PEOPLE = [
    { id: 'alessandro', name: 'Alessandro', color: 'var(--color-red)' },
    { id: 'liam', name: 'Liam', color: 'var(--color-blue)' },
    { id: 'prinson', name: 'Prinson', color: 'var(--color-darkgreen)' },
    { id: 'oliwia', name: 'Oliwia', color: 'var(--color-pink)' },
    { id: 'hanan', name: 'Hanan', color: 'var(--color-yellow)' },
    { id: 'hannah', name: 'Hannah', color: 'var(--color-yellow)' }, // Using yellow, will adjust later
];

// MOCK Timetable (To prevent errors before Firebase data is loaded)
const MOCK_TIMETABLE = {
    'Alessandro': {
        'color': 'red',
        'Week 1': { 'Monday': ['Maths', 'English', 'Science', 'Period 4', 'Period 5'] },
        'Week 2': { 'Monday': ['History', 'Geography', 'Art', 'Period 4', 'Period 5'] }
    }
};

// --- Helper Functions ---

/**
 * Creates and shows a custom modal dialog for messages or confirmations.
 * @param {string} title The title of the modal.
 * @param {string} message The main message content.
 * @param {string} [confirmText] Text for the primary action button. If null, only an OK/Close button is shown.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise.
 */
const showCustomModal = (title, message, confirmText = null) => {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        modal.innerHTML = ''; // Clear previous content

        const isConfirm = confirmText !== null;
        
        // Define the modal structure and styling
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center;
            z-index: 1000;
        `;

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = `
            padding: 20px; max-width: 300px; text-align: center;
            background: var(--bg); color: var(--text);
            border-radius: var(--radius);
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        `;

        const h3 = document.createElement('h3');
        h3.textContent = title;
        h3.style.margin = '0 0 10px 0';
        h3.style.color = 'var(--text)';

        const p = document.createElement('p');
        p.textContent = message;
        p.style.margin = '0 0 20px 0';
        p.style.fontSize = '14px';
        p.style.color = 'var(--text)';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = isConfirm ? 'space-between' : 'center';
        buttonContainer.style.gap = '10px';

        const createButton = (text, isPrimary, action) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.className = 'btn';
            btn.style.flex = isConfirm ? '1' : 'none';
            if (isPrimary) {
                btn.classList.add('btn-primary');
            } else {
                btn.classList.add('btn-secondary');
            }
            btn.style.width = '100%';
            btn.onclick = () => {
                modal.style.display = 'none';
                resolve(action);
            };
            return btn;
        };

        if (isConfirm) {
            const confirmBtn = createButton(confirmText, true, true);
            const cancelBtn = createButton('Cancel', false, false);
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);
        } else {
            const okBtn = createButton('OK', true, true);
            okBtn.style.width = '100%';
            buttonContainer.appendChild(okBtn);
        }

        card.appendChild(h3);
        card.appendChild(p);
        card.appendChild(buttonContainer);
        modal.appendChild(card);
        modal.style.display = 'flex';
    });
};

// --- Firebase Setup and Data Handlers ---

/**
 * Initializes Firebase, authenticates the user, and sets up real-time listeners.
 */
const setupFirebase = async () => {
    if (!firebaseConfig) {
        console.error("Firebase config is missing. Cannot initialize Firestore.");
        return;
    }
    try {
        setLogLevel('Debug');
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Sign in using the provided token or anonymously if not available
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        // Set up Auth State Observer
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                document.getElementById('userIdDisplay').textContent = userId;
                isAuthReady = true;
                console.log("Firebase Auth Ready. User ID:", userId);

                // Start data listeners only once auth is ready
                setupDataListeners();
            } else {
                userId = null;
                isAuthReady = true; // Still ready, but logged out/anonymous
                console.log("Firebase Auth Ready. No user logged in (anonymous or logged out).");
            }
        });

    } catch (error) {
        console.error("Error setting up Firebase:", error);
    }
};

/**
 * Sets up real-time listeners for timetable and catchphrase data.
 */
const setupDataListeners = () => {
    if (!isAuthReady || !userId) {
        console.warn("Cannot set up listeners: Auth not ready or userId missing.");
        return;
    }

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'userTimetables', 'allData');
    
    // 1. Timetable Data Listener
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            timetableData = docSnap.data().timetable || {};
            console.log("Timetable data updated:", timetableData);
            
            // Rebuild peopleData array from the keys of timetableData
            peopleData = Object.keys(timetableData).map(name => ({
                id: name.toLowerCase(),
                name: name,
                color: `var(--color-${timetableData[name].color})` // Use color from Firestore
            }));

            // If the person selects were already populated, update them in case people changed
            if (document.getElementById('whoSelect').options.length > 0) {
                 populateSelects();
            }

            // Update UI dependent on this data
            updateCatchphraseUI();
            
        } else {
            console.log("No initial timetable data found in Firestore. Using mock data.");
            timetableData = MOCK_TIMETABLE;
            peopleData = MOCK_PEOPLE;
        }

        // Initialize selects after data load
        populateSelects();

    }, (error) => {
        console.error("Error listening to timetable data:", error);
        showCustomModal('Data Error', 'Failed to load timetable data. Check console for details.');
    });

    // 2. Catchphrase Data Listener (Public shared list)
    const catchphraseRef = doc(db, 'artifacts', appId, 'public', 'data', 'catchphrases', 'allPhrases');
    
    onSnapshot(catchphraseRef, (docSnap) => {
        if (docSnap.exists()) {
            currentCatchphrases = docSnap.data().phrases || [];
            console.log("Catchphrases updated:", currentCatchphrases);
        } else {
            console.log("No catchphrase data found. Initializing with empty array.");
            currentCatchphrases = [];
            // Create the document if it doesn't exist to prevent errors on first write
            setDoc(catchphraseRef, { phrases: [] }, { merge: true }).catch(err => console.error("Error creating catchphrase doc:", err));
        }
        updateCatchphraseUI();
    }, (error) => {
        console.error("Error listening to catchphrase data:", error);
    });
};


// --- UI Population Functions ---

/**
 * Populates all <select> elements with the loaded people, weeks, and days.
 */
const populateSelects = () => {
    // Check if data is ready
    if (peopleData.length === 0) return;

    const whoSelects = [document.getElementById('whoSelect'), document.getElementById('whoSelect2')];
    const whoSelectForToday = document.getElementById('whoSelectToday');
    const weekSelect1 = document.getElementById('weekSelect1');
    const weekSelect2 = document.getElementById('weekSelect2');
    const daySelect1 = document.getElementById('daySelect1');
    const daySelect2 = document.getElementById('daySelect2');

    // --- Person Selects ---
    const currentSelectedPerson = whoSelects[0].value || currentWhoSelect;
    
    whoSelects.forEach(select => {
        select.innerHTML = '';
        peopleData.forEach(person => {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = person.name;
            option.style.backgroundColor = person.color; // Set background color based on person
            option.style.color = 'var(--text)';
            // Select the person currently being viewed in the main section
            if (person.id === currentSelectedPerson) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    });

    // Special case for 'Who has that subject?' select
    whoSelectForToday.innerHTML = '';
    whoSelectForToday.appendChild(new Option("Select Person...", "")); // Empty/default option
    peopleData.forEach(person => {
        whoSelectForToday.appendChild(new Option(person.name, person.name));
    });


    // Ensure whoSelect in the main section tracks the current view
    document.getElementById('whoSelect').value = currentSelectedPerson;
    currentWhoSelect = currentSelectedPerson;
    updatePersonDisplay(currentSelectedPerson); // Update main display on initial load

    // --- Week Selects ---
    const weeks = ['Week 1', 'Week 2'];
    [weekSelect1, weekSelect2].forEach(select => {
        select.innerHTML = '';
        weeks.forEach(week => {
            select.appendChild(new Option(week, week));
        });
    });

    // --- Day Selects ---
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    [daySelect1, daySelect2].forEach(select => {
        select.innerHTML = '';
        days.forEach(day => {
            select.appendChild(new Option(day, day));
        });
    });

    // Set today's date defaults
    setDefaultDay();
};

/**
 * Sets the default day/week in the select menus based on the current date.
 */
const setDefaultDay = () => {
    const today = new Date();
    const dayIndex = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let dayName = daysOfWeek[dayIndex];

    // Check if it's a weekend, default to Monday
    if (dayIndex === 0 || dayIndex === 6) {
        dayName = 'Monday';
    }

    // Set the default day in the selects
    document.getElementById('daySelect1').value = dayName;
    document.getElementById('daySelect2').value = dayName;
    
    // Logic for Week 1 or Week 2 - You'll need external logic for this, 
    // but for now, we'll default to Week 1 or hardcode an assumption.
    // Assuming we start with Week 1. In a real app, this would be based on a calendar.
    const weekSelect1 = document.getElementById('weekSelect1');
    const weekSelect2 = document.getElementById('weekSelect2');
    
    // A simplistic way to alternate weeks (e.g., based on week number parity)
    const currentWeekNumber = getWeekNumber(today);
    const defaultWeek = currentWeekNumber % 2 === 0 ? 'Week 2' : 'Week 1';
    
    if (weekSelect1.querySelector(`option[value="${defaultWeek}"]`)) {
        weekSelect1.value = defaultWeek;
    }
    if (weekSelect2.querySelector(`option[value="${defaultWeek}"]`)) {
        weekSelect2.value = defaultWeek;
    }
};

/**
 * Calculates the week number for the year, useful for alternating weeks.
 * Source: https://stackoverflow.com/a/6117888
 * @param {Date} d 
 * @returns {number} The week number.
 */
const getWeekNumber = (d) => {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    // Return array of year and week number
    return weekNo;
}


// --- UI Update Logic ---

/**
 * Updates the main display with the selected person's timetable for the chosen week and day.
 */
const updatePersonDisplay = (personId) => {
    // 1. Get current selection values
    const whoSelect = document.getElementById('whoSelect');
    const weekSelect = document.getElementById('weekSelect1');
    const daySelect = document.getElementById('daySelect1');
    const dayDisplay = document.getElementById('dayDisplay');

    // Use the ID passed in or the current select value
    const selectedPersonId = personId || whoSelect.value;
    currentWhoSelect = selectedPersonId; // Update global tracking variable
    
    const selectedWeek = weekSelect.value;
    const selectedDay = daySelect.value;
    
    // 2. Find selected person's data
    const personData = peopleData.find(p => p.id === selectedPersonId);
    
    if (!personData) {
        dayDisplay.innerHTML = '<p>Error: Person data not found.</p>';
        return;
    }

    const timetable = timetableData[personData.name];

    if (!timetable || !timetable[selectedWeek] || !timetable[selectedWeek][selectedDay]) {
        dayDisplay.innerHTML = `<p style="text-align:center; color:var(--muted);">Timetable not available for ${personData.name} on ${selectedDay} (${selectedWeek}).</p>`;
        document.getElementById('personName').textContent = personData.name;
        document.getElementById('personName').style.color = personData.color;
        return;
    }

    // 3. Get the schedule array and person color
    const schedule = timetable[selectedWeek][selectedDay];
    const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'];
    
    // Update the main header
    document.getElementById('personName').textContent = personData.name;
    document.getElementById('personName').style.color = personData.color;
    
    // 4. Render the schedule
    let html = '';
    schedule.forEach((subject, index) => {
        const periodName = periods[index];
        const displaySubject = subject && subject.trim() !== '' ? subject : '— Free Period —';
        
        // Determine the class/style for the subject row
        let subjectClass = 'subject-row';
        if (displaySubject === '— Free Period —') {
            subjectClass += ' free-period';
        }
        
        html += `
            <div class="${subjectClass}">
                <span class="period-name">${periodName}</span>
                <span class="subject-name">${displaySubject}</span>
            </div>
        `;
    });
    
    dayDisplay.innerHTML = html;
};

/**
 * Updates the catchphrase display with a random phrase from the list.
 */
const updateCatchphraseUI = () => {
    const tag = document.getElementById('catchphraseTag');
    if (currentCatchphrases.length > 0) {
        const randomIndex = Math.floor(Math.random() * currentCatchphrases.length);
        tag.textContent = currentCatchphrases[randomIndex];
    } else {
        tag.textContent = 'Add your first iconic phrase!';
    }
};


// --- Event Handlers (User Actions) ---

/**
 * Handles the logic for the 'Who has that subject?' feature.
 */
const handleWhoHasSubject = () => {
    // 1. Get input values
    const subjectInput = document.getElementById('subjectInput').value.trim();
    const weekSelect = document.getElementById('weekSelect2').value;
    const daySelect = document.getElementById('daySelect2').value;

    if (!subjectInput) {
        showCustomModal('Missing Subject', 'Please enter the subject name you are looking for.');
        return;
    }

    // 2. Clear previous results
    const whoResult = document.getElementById('whoResult');
    whoResult.innerHTML = '';
    
    const matchingPeople = [];

    // 3. Iterate through all people and check their timetable
    Object.keys(timetableData).forEach(personName => {
        const personTimetable = timetableData[personName];
        
        if (personTimetable[weekSelect] && personTimetable[weekSelect][daySelect]) {
            const schedule = personTimetable[weekSelect][daySelect];
            
            schedule.forEach((subject, index) => {
                // Case-insensitive comparison
                if (subject.toLowerCase().includes(subjectInput.toLowerCase())) {
                    const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'];
                    matchingPeople.push({
                        name: personName,
                        period: periods[index],
                        color: `var(--color-${personTimetable.color})` // Use color from Firestore
                    });
                }
            });
        }
    });

    // 4. Render results
    if (matchingPeople.length > 0) {
        let html = '';
        matchingPeople.forEach(match => {
            html += `
                <div class="result-row" style="border-left: 3px solid ${match.color};">
                    <span class="result-person">${match.name}</span>
                    <span class="result-period">${match.period}</span>
                </div>
            `;
        });
        whoResult.innerHTML = html;
    } else {
        whoResult.innerHTML = `<p style="text-align:center; color:var(--muted); padding:10px 0;">No one has "${subjectInput}" on ${daySelect} in ${weekSelect}.</p>`;
    }
};

/**
 * Handles the logic for the 'When is a person free?' feature.
 */
const handleWhenIsPersonFree = () => {
    // 1. Get input values
    const personName = document.getElementById('whoSelectToday').value;
    const weekSelect = document.getElementById('weekSelect3').value;
    const daySelect = document.getElementById('daySelect3').value;

    if (!personName) {
        showCustomModal('Missing Selection', 'Please select a person.');
        return;
    }

    // 2. Clear previous results
    const freeResult = document.getElementById('freeResult');
    freeResult.innerHTML = '';

    // 3. Find person's data
    const personTimetable = timetableData[personName];

    if (!personTimetable || !personTimetable[weekSelect] || !personTimetable[weekSelect][daySelect]) {
        freeResult.innerHTML = `<p style="text-align:center; color:var(--muted); padding:10px 0;">Timetable data not found for ${personName} on ${daySelect} (${weekSelect}).</p>`;
        return;
    }

    // 4. Check for free periods (empty string or contains 'Period')
    const schedule = personTimetable[weekSelect][daySelect];
    const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'];
    const freePeriods = [];

    schedule.forEach((subject, index) => {
        const normalizedSubject = subject ? subject.trim().toLowerCase() : '';
        if (normalizedSubject === '' || normalizedSubject.includes('free') || normalizedSubject.includes('period')) {
            freePeriods.push(periods[index]);
        }
    });

    // 5. Render results
    if (freePeriods.length > 0) {
        const color = `var(--color-${personTimetable.color})`;
        let html = '<p style="text-align:center; font-weight:600; margin-bottom:10px;">Free Periods:</p>';
        
        freePeriods.forEach(period => {
            html += `<div class="result-row" style="border-left: 3px solid ${color}; justify-content: center;">
                        <span class="result-period" style="font-weight:600;">${period}</span>
                     </div>`;
        });
        freeResult.innerHTML = html;
    } else {
        freeResult.innerHTML = `<p style="text-align:center; color:var(--muted); padding:10px 0;">${personName} is not free on ${daySelect} in ${weekSelect}.</p>`;
    }
};


/**
 * Handles the action of showing the selected person's daily schedule in a modal.
 */
const handleShowDailySchedule = () => {
    // 1. Get input values
    const selectedPersonId = document.getElementById('whoSelect').value;
    const selectedWeek = document.getElementById('weekSelect2').value;
    const selectedDay = document.getElementById('daySelect2').value;
    
    // Find selected person's data
    const personData = peopleData.find(p => p.id === selectedPersonId);
    if (!personData) return;

    const personName = personData.name;
    const timetable = timetableData[personName];

    // Check if data is available
    if (!timetable || !timetable[selectedWeek] || !timetable[selectedWeek][selectedDay]) {
        showCustomModal('Schedule Not Found', `Timetable not available for ${personName} on ${selectedDay} (${selectedWeek}).`);
        return;
    }

    const schedule = timetable[selectedWeek][selectedDay];
    const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'];
    const color = personData.color; 
    
    // 2. Update Modal Content
    document.getElementById('scheduleTitle').textContent = `${personName}'s Schedule`;
    
    const contentDiv = document.getElementById('modalScheduleContent');
    contentDiv.innerHTML = '';
    
    let html = '';
    schedule.forEach((subject, index) => {
        const periodName = periods[index];
        const displaySubject = subject && subject.trim() !== '' ? subject : '— Free Period —';
        
        // Determine the class/style for the subject row
        let subjectClass = 'schedule-row';
        if (displaySubject === '— Free Period —') {
            subjectClass += ' free-period-modal';
        }

        html += `
            <div class="${subjectClass}" style="border-left-color: ${color};">
                <span class="schedule-period">${periodName}</span>
                <span class="schedule-subject">${displaySubject}</span>
            </div>
        `;
    });
    
    contentDiv.innerHTML = html;

    // 3. Show the modal
    document.getElementById('scheduleModalBack').style.display = 'flex';
};


/**
 * Handles adding a new catchphrase to the public list in Firestore.
 */
const handleAddPhrase = async () => {
    if (!isAuthReady || !userId) {
        showCustomModal('Auth Required', 'Please wait for authentication to complete before adding phrases.');
        return;
    }

    const phraseInput = document.getElementById('newPhraseInput');
    const newPhrase = phraseInput.value.trim();

    if (!newPhrase) {
        showCustomModal('Input Missing', 'Please enter a phrase before clicking Add.');
        return;
    }
    
    if (newPhrase.length > 50) {
         showCustomModal('Too Long', 'Phrases must be 50 characters or less.');
         return;
    }

    // Check if phrase already exists (case-insensitive)
    const exists = currentCatchphrases.some(p => p.toLowerCase() === newPhrase.toLowerCase());
    if (exists) {
        showCustomModal('Duplicate', 'That phrase is already on the list!');
        phraseInput.value = '';
        return;
    }

    try {
        const catchphraseRef = doc(db, 'artifacts', appId, 'public', 'data', 'catchphrases', 'allPhrases');
        
        // Use arrayUnion to safely add the new phrase without overwriting existing ones
        await updateDoc(catchphraseRef, {
            phrases: arrayUnion(newPhrase)
        });
        
        phraseInput.value = '';
        console.log("Catchphrase added successfully:", newPhrase);
        // The onSnapshot listener will handle the UI update
        
    } catch (error) {
        console.error("Error adding catchphrase:", error);
        showCustomModal('Save Failed', 'Could not save the phrase to the database.');
    }
};

/**
 * Initializes all required event listeners.
 */
const setupEventListeners = () => {
    // Timetable View Feature
    document.getElementById('whoSelect').addEventListener('change', () => updatePersonDisplay());
    document.getElementById('weekSelect1').addEventListener('change', () => updatePersonDisplay());
    document.getElementById('daySelect1').addEventListener('change', () => updatePersonDisplay());

    // Catchphrase Feature
    document.getElementById('addPhraseBtn').addEventListener('click', handleAddPhrase);
    document.getElementById('refreshTag').addEventListener('click', updateCatchphraseUI);

    // Who Has Subject Feature
    document.getElementById('whoBtn').addEventListener('click', handleWhoHasSubject);

    // When is Free Feature
    document.getElementById('freeBtn').addEventListener('click', handleWhenIsPersonFree);


    // Daily Schedule Feature (using the first section's who select for consistency)
    document.getElementById('whatBtn').addEventListener('click', handleShowDailySchedule);
    document.getElementById('scheduleClose').addEventListener('click', () => {
        document.getElementById('scheduleModalBack').style.display = 'none';
    });
    document.getElementById('scheduleModalBack').addEventListener('click', (e) => {
        if (e.target.id === 'scheduleModalBack') {
            document.getElementById('scheduleModalBack').style.display = 'none';
        }
    });


    // Dark Mode Toggle
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
};

// --- Dark Mode Logic ---

/**
 * Loads the dark mode preference from localStorage or system settings.
 */
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

/**
 * Toggles the dark mode class and saves the preference to localStorage.
 */
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
