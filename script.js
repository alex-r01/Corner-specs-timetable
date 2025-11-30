// --- CONFIGURATION AND UI ELEMENTS ---
const elements = {
    // Selectors
    weekSelect: document.getElementById('weekSelect'),
    daySelect: document.getElementById('daySelect'),
    periodSelect: document.getElementById('periodSelect'),
    whoSelect: document.getElementById('whoSelect'),
    weekSelect2: document.getElementById('weekSelect2'),
    daySelect2: document.getElementById('daySelect2'),

    // Buttons
    checkBtn: document.getElementById('checkBtn'),
    lessonBtn: document.getElementById('lessonBtn'),
    toggleExtra: document.getElementById('toggleExtra'),
    addPhraseBtn: document.getElementById('addPhraseBtn'),
    refreshTag: document.getElementById('refreshTag'),
    whatBtn: document.getElementById('whatBtn'),
    
    // Panels & Results
    randomTag: document.getElementById('randomTag'),
    extraPanel: document.getElementById('extraPanel'),
    resultArea: document.getElementById('resultArea'),
    phraseInput: document.getElementById('phraseInput'),

    // Modals
    scheduleModalBack: document.getElementById('scheduleModalBack'),
    scheduleTitle: document.getElementById('scheduleTitle'),
    modalScheduleContent: document.getElementById('modalScheduleContent'),
    scheduleClose: document.getElementById('scheduleClose'),
    darkModeToggle: document.getElementById('darkModeToggle')
};

let timetableData = null;
let catchphrases = [];
// Identifiers for free periods from the sheet data, including blank fields.
const FREE_WORDS = ['free', 'period 4', 'period 5', '']; 

// --- THEME LOGIC ---

const body = document.body;
const storageKey = 'timetable-theme';

function applyTheme(isDark) {
    if (isDark) {
        body.classList.add('dark-mode');
        elements.darkModeToggle.textContent = '🌙';
    } else {
        body.classList.remove('dark-mode');
        elements.darkModeToggle.textContent = '☀️';
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem(storageKey);
    // CRITICAL FIX: Removed the extraneous colon that caused the SyntaxError
    const prefersDark = savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(prefersDark);
}

function toggleTheme() {
    const isDark = body.classList.contains('dark-mode');
    const newMode = isDark ? 'light' : 'dark';
    applyTheme(newMode === 'dark');
    localStorage.setItem(storageKey, newMode);
}

// --- DATA INITIALIZATION ---

/**
 * Fetches JSON data from local files.
 */
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.statusText}`);
        }
        return response.json();
    } catch (e) {
        console.error(e);
        // Show user-friendly error message
        showError(`Error loading data from ${url}. Please ensure 'data/${url.split('/').pop()}' exists.`);
        return null;
    }
}

async function init() {
    // 1. Load data
    const [tData, cData] = await Promise.all([
        fetchData('data/timetable.json'),
        fetchData('data/catchphrases.json')
    ]);
    
    timetableData = tData;
    catchphrases = cData || []; // Use empty array if loading fails

    if (!timetableData || !timetableData.metadata) {
        // If critical data fails, stop initialization
        showError("Critical data (timetable.json) failed to load or is corrupt. Check Console for details.");
        return;
    }
    
    // 2. Populate Selects
    populateSelects(timetableData.metadata);

    // 3. Set Random Tag
    loadRandomTag();

    // 4. Set Event Listeners
    setupEventListeners();
}

function populateSelects(metadata) {
    const { weeks, days } = metadata;
    const people = Object.keys(timetableData).filter(key => key !== 'metadata');
    
    const selects = [
        { el: elements.weekSelect, data: weeks, defaultVal: weeks[0] },
        { el: elements.weekSelect2, data: weeks, defaultVal: weeks[0] },
        { el: elements.daySelect, data: days, defaultVal: days[0] },
        { el: elements.daySelect2, data: days, defaultVal: days[0] }
    ];

    selects.forEach(({ el, data, defaultVal }) => {
        el.innerHTML = data.map(item => `<option value="${item}">${item}</option>`).join('');
        if (defaultVal) el.value = defaultVal;
    });

    elements.whoSelect.innerHTML = people.map(p => `<option value="${p}">${p}</option>`).join('');
    if (people.length) elements.whoSelect.value = people[0];
}

// --- FEATURE LOGIC ---

function loadRandomTag() {
    if (catchphrases.length === 0) {
        elements.randomTag.style.display = 'none';
        return;
    }
    const randomIndex = Math.floor(Math.random() * catchphrases.length);
    elements.randomTag.textContent = catchphrases[randomIndex];
    elements.randomTag.style.display = 'block';
}

function toggleExtraPanel() {
    elements.extraPanel.classList.toggle('open');
    elements.toggleExtra.textContent = elements.extraPanel.classList.contains('open') ? 'Hide' : 'Show';
}

function isFree(lesson) {
    return FREE_WORDS.includes(lesson.toLowerCase().trim());
}

function checkAvailability(mode) {
    const week = elements.weekSelect.value;
    const day = elements.daySelect.value;
    const period = parseInt(elements.periodSelect.value, 10);
    
    if (!week || !day || isNaN(period)) {
        return showError("Please select a Week, Day, and Period.");
    }
    
    const results = { free: [], lessons: {} };
    const peopleNames = Object.keys(timetableData).filter(key => key !== 'metadata');
    
    peopleNames.forEach(name => {
        const personData = timetableData[name];
        
        if (!personData[week] || !personData[week][day] || personData[week][day].length < period) {
             console.warn(`Missing data for ${name} on ${week}, ${day}, Period ${period}`);
             return;
        }

        const lessonRaw = personData[week][day][period - 1];
        const lesson = (lessonRaw || '').toString().trim();
        const color = personData.color;

        if (isFree(lesson)) {
            results.free.push({ name, color });
        } else {
            if (!results.lessons[lesson]) {
                results.lessons[lesson] = [];
            }
            results.lessons[lesson].push({ name, color });
        }
    });
    
    // Render based on mode
    if (mode === 'free') {
        renderAvailability(results);
    } else { // mode === 'lesson'
        const lessonGroups = Object.keys(results.lessons).map(subject => ({
            subject: subject,
            people: results.lessons[subject]
        }));
        renderWhoHasLesson(lessonGroups);
    }
}

function showMyDay() {
    const who = elements.whoSelect.value;
    const week = elements.weekSelect2.value;
    const day = elements.daySelect2.value;
    
    if (!who || !week || !day) {
        return showConfirm("Please select who you are, the Week, and the Day.", null, 'OK');
    }

    const content = elements.modalScheduleContent;
    elements.scheduleTitle.textContent = `${who}'s Schedule for ${week}, ${day}`;
    showScheduleModal();

    const personData = timetableData[who];

    if (!personData || !personData[week] || !personData[week][day] || personData[week][day].length < 5) {
        content.innerHTML = `<div class="muted" style="text-align:center;">No schedule found for ${who} on ${day}.</div>`;
        return;
    }
    
    const periods = personData[week][day];
    const colorKey = personData.color;
    content.innerHTML = '';
    
    periods.forEach((lessonRaw, idx) => {
        const periodNum = idx + 1;
        const subject = lessonRaw || '';
        const displaySubject = isFree(subject) ? '(Free)' : subject;
        
        const row = document.createElement('div'); row.className = 'scheduleRow';
        
        const pnum = document.createElement('div'); 
        pnum.className = 'scheduleCell pnum'; 
        pnum.textContent = 'P' + periodNum;
        
        const subj = document.createElement('div'); 
        subj.className = 'scheduleCell subj'; 
        subj.textContent = displaySubject;
        
        // Custom colors from CSS variables
        if (!isFree(subject) && colorKey) {
            const cssColorVar = `--color-${colorKey.replace('dark', '').toLowerCase()}`;
            subj.style.backgroundColor = `var(${cssColorVar})`;
            // Set contrasting text for the yellow background
            if (colorKey.toLowerCase() === 'yellow') {
                subj.style.color = 'var(--text)';
            } else {
                subj.style.color = 'white';
            }
        } 

        row.appendChild(pnum);
        row.appendChild(subj);
        content.appendChild(row);
    });
}

function tryAddPhrase() {
    const txt = elements.phraseInput.value.trim();
    if (!txt) return showConfirm('Type a phrase first', null, 'OK');

    showConfirm(`Are you sure you want to add: "${txt}"?`, () => {
        // SIMULATED RESPONSE for static site
        catchphrases.push(txt);
        elements.phraseInput.value = '';
        loadRandomTag();
        showConfirm('Phrase added temporarily! (This is a static site, so it cannot save permanently. The phrase will be lost on refresh.)', null, 'OK');
    }, 'Yes, add', 'Cancel');
}


// --- UI UTILITIES (Modals and Rendering) ---

function renderAvailability(data) {
    elements.resultArea.innerHTML = '';
    if (!data.free || data.free.length === 0) { 
        elements.resultArea.innerHTML = '<div class="muted">No one free right now.</div>'; 
        return; 
    }
    
    const h = document.createElement('div'); h.style.marginBottom='8px'; h.textContent = 'Free right now:';
    elements.resultArea.appendChild(h);
    
    data.free.forEach((p, index) => {
        const row = document.createElement('div'); row.className = 'person';
        row.style.animationDelay = `${index * 50}ms`; 
        row.innerHTML = `<div class="swatch" style="background:var(--color-${p.color.replace('dark', '').toLowerCase()})"></div><div><strong>${p.name}</strong></div>`;
        elements.resultArea.appendChild(row);
    });
}

function renderWhoHasLesson(groups) {
    elements.resultArea.innerHTML = '';
    if (!groups || groups.length === 0) { 
        elements.resultArea.innerHTML = '<div class="muted">No one is in a lesson right now.</div>'; 
        return; 
    }
    
    let personCounter = 0;
    groups.forEach(g => {
        const block = document.createElement('div'); block.style.marginBottom='10px';
        block.innerHTML = `<div style="margin-bottom:6px; color:var(--text)"><strong>${g.subject}</strong></div>`;
        
        g.people.forEach(p => {
            const row = document.createElement('div'); row.className='person';
            row.style.animationDelay = `${personCounter * 50}ms`;
            row.innerHTML = `<div class="swatch" style="background:var(--color-${p.color.replace('dark', '').toLowerCase()})"></div><div>${p.name}</div>`;
            block.appendChild(row);
            personCounter++;
        });
        elements.resultArea.appendChild(block);
    });
}

function showError(msg) {
    elements.resultArea.innerHTML = `<div style="color:var(--color-red); padding: 8px;">${msg}</div>`;
}

// Function to handle custom confirmation modals (from your HTML)
function showConfirm(text, onYes, yesText = 'Yes', noText = 'Cancel') {
    const root = document.getElementById('confirmModal');
    const isAlert = !onYes;

    let buttonsHtml = '';
    if (isAlert) {
        buttonsHtml = `<button id="cNo" class="small" style="background:var(--primary-btn-bg);color:var(--primary-btn-text); flex:none; border:none; border: 1px solid var(--primary-btn-bg);">${yesText}</button>`;
    } else {
        buttonsHtml = `<button id="cNo" class="small" style="flex:none;">${noText}</button><button id="cYes" class="small" style="background:var(--primary-btn-bg);color:var(--primary-btn-text);flex:none; border:none;">${yesText}</button>`;
    }

    root.innerHTML = `<div class="modalBack"><div class="modal"><div><strong>${isAlert ? 'Notification' : 'Confirm'}</strong></div><div class="tiny" style="margin-top:8px">${text}</div><div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">${buttonsHtml}</div></div></div>`;
    root.style.display = 'block';

    const close = () => { root.style.display='none'; root.innerHTML=''; };

    document.getElementById('cNo').onclick = close;

    if (!isAlert) {
        document.getElementById('cYes').onclick = () => { close(); onYes(); };
    }
}

function showScheduleModal() {
    elements.scheduleModalBack.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideScheduleModal() {
    elements.scheduleModalBack.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function setupEventListeners() {
    elements.darkModeToggle.addEventListener('click', toggleTheme);
    elements.checkBtn.addEventListener('click', () => checkAvailability('free'));
    elements.lessonBtn.addEventListener('click', () => checkAvailability('lesson'));
    elements.toggleExtra.addEventListener('click', toggleExtraPanel);
    elements.refreshTag.addEventListener('click', loadRandomTag);
    elements.addPhraseBtn.addEventListener('click', tryAddPhrase);
    elements.whatBtn.addEventListener('click', showMyDay);
    elements.scheduleClose.addEventListener('click', hideScheduleModal);
    elements.scheduleModalBack.addEventListener('click', function(e) {
        // Close modal only if background is clicked, not the modal content itself
        if (e.target === this) {
            hideScheduleModal();
        }
    });
}

// Ensure the theme is loaded immediately upon script execution
loadTheme(); 

// Start the application after the document content is fully loaded
window.addEventListener('load', init);
