// -- Core State --
let isRunning = false;
let isPaused = false;
let isBreakMode = false;
let initialDuration = 1500; 
let targetTime = 0;
let timeRemaining = initialDuration;
let timerInterval = null;

let dailyGoalMins = parseInt(localStorage.getItem('terraGoal')) || 180;
let currentTag = { name: 'Deep Work', color: 'var(--primary)' };
const WEEKLY_GOAL_MINS = 600;

// -- DOM Elements --
const display = document.getElementById('time-display');
const companionText = document.getElementById('companion-text');
const taskInput = document.getElementById('task-name');
const smartStartChips = document.getElementById('smart-start-chips');
const topProgressBar = document.getElementById('top-progress-bar');
const toastEl = document.getElementById('toast');

const btnTag = document.getElementById('btn-tag');
const tagDropdown = document.getElementById('tag-dropdown');
const tagOptions = document.querySelectorAll('.tag-option');
const currentTagDot = document.getElementById('current-tag-dot');

const btnPlay = document.getElementById('btn-play');
const btnReset = document.getElementById('btn-reset');
const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const sheet = document.getElementById('settings-sheet');
const presetBtns = document.querySelectorAll('.preset-btn');
const btnCustom = document.getElementById('btn-custom');
const inpDailyGoal = document.getElementById('inp-daily-goal');
const inpDailyIntention = document.getElementById('daily-intention');

const btnFocusPause = document.getElementById('btn-focus-pause');
const btnFocusEnd = document.getElementById('btn-focus-end');
const iconPause = document.getElementById('icon-pause');
const iconResume = document.getElementById('icon-resume');

const btnTheme = document.getElementById('btn-theme');
const iconSun = document.getElementById('icon-sun');
const iconMoon = document.getElementById('icon-moon');

const btnTools = document.getElementById('btn-sounds');
const btnHistory = document.getElementById('btn-stats');
const sidebar = document.getElementById('tools-sidebar');
const historyModal = document.getElementById('history-modal');
const overlay = document.getElementById('overlay');
const closeBtns = document.querySelectorAll('.close-btn');

const celebrationOverlay = document.getElementById('celebration-overlay');
const btnStartBreak = document.getElementById('btn-start-break');
const btnSkipBreak = document.getElementById('btn-skip-break');
const celebTitle = document.getElementById('celebration-title');
const celebMsg = document.getElementById('celebration-msg');

let audioCtx;
const synths = { rain: null, cafe: null, wind: null, chime: null };

const sounds = [
    { id: 'rain', slider: document.getElementById('vol-rain'), targetVol: 0, currentVol: 0 },
    { id: 'cafe', slider: document.getElementById('vol-cafe'), targetVol: 0, currentVol: 0 },
    { id: 'wind', slider: document.getElementById('vol-wind'), targetVol: 0, currentVol: 0 }
];

const soundPresetBtns = document.querySelectorAll('.sound-preset-btn');
let volumeInterval = null;

function initSynth() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    
    function createNoiseNode(type, cutoff, isWind = false) {
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
        
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
            if (type === 'brown') {
                b0 = (b0 + (0.02 * white)) / 1.02;
                data[i] = b0 * 3.5;
            } else if (type === 'pink') {
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11;
                b6 = white * 0.115926;
            }
        }
        
        const src = audioCtx.createBufferSource();
        src.buffer = buffer; src.loop = true;
        
        const filter = audioCtx.createBiquadFilter();
        if (isWind) {
            filter.type = 'bandpass'; filter.frequency.value = 500;
            const lfo = audioCtx.createOscillator();
            lfo.type = 'sine'; lfo.frequency.value = 0.2;
            const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 300;
            lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();
        } else {
            filter.type = 'lowpass'; filter.frequency.value = cutoff;
        }
        
        const gain = audioCtx.createGain(); gain.gain.value = 0;
        src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        src.start();
        return gain;
    }
    
    synths.rain = createNoiseNode('brown', 400); // Muffled low rain
    synths.cafe = createNoiseNode('pink', 800);  // Simulating crowd hum
    synths.wind = createNoiseNode('pink', 500, true); // Sweeping wind
    
    synths.chime = {
        play: () => {
            if(!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 1.5);
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 2);
        }
    };
}

let audioUnlocked = false;
function unlockAudio() {
    if(audioUnlocked) return;
    initSynth();
    if(audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    audioUnlocked = true;
}
document.addEventListener('click', unlockAudio, { once: true });

function init() {
    initTheme();
    if (inpDailyIntention) {
        inpDailyIntention.value = localStorage.getItem('terraIntention') || '';
        inpDailyIntention.addEventListener('change', (e) => {
            localStorage.setItem('terraIntention', e.target.value);
        });
    }
    inpDailyGoal.value = dailyGoalMins;
    updateDisplay(initialDuration);
    updateDashboard();
    renderSmartStart();
    setCompanionText("Ready to focus.");
    
    // Listeners
    btnTheme.addEventListener('click', toggleTheme);
    btnSettingsToggle.addEventListener('click', () => { sheet.classList.add('open'); overlay.classList.add('open'); });
    btnTools.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('open'); });
    btnHistory.addEventListener('click', () => { updateDashboard(); historyModal.classList.add('open'); overlay.classList.add('open'); triggerStatsAnimation(); });
    closeBtns.forEach(btn => btn.addEventListener('click', closeAllOverlays));
    overlay.addEventListener('click', closeAllOverlays);

    // Tags
    btnTag.addEventListener('click', (e) => { e.stopPropagation(); tagDropdown.classList.toggle('open'); });
    document.addEventListener('click', () => tagDropdown.classList.remove('open'));
    tagOptions.forEach(opt => {
        opt.addEventListener('click', (e) => {
            currentTag.name = e.target.dataset.tag;
            currentTag.color = e.target.dataset.color;
            currentTagDot.style.background = currentTag.color;
        });
    });
    taskInput.addEventListener('input', () => { if(taskInput.value.trim().length > 0) smartStartChips.classList.add('hidden'); else smartStartChips.classList.remove('hidden'); });

    // Audio
    sounds.forEach(snd => {
        snd.slider.addEventListener('input', (e) => setSoundVolume(snd.id, parseFloat(e.target.value)));
    });
    soundPresetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const p = e.target.dataset.preset;
            if(p === 'deep-work') smoothFadeSounds({ rain: 0.4, wind: 0.2, cafe: 0 });
            else if (p === 'rain') smoothFadeSounds({ rain: 0.8, wind: 0, cafe: 0 });
            else if (p === 'silence') smoothFadeSounds({ rain: 0, wind: 0, cafe: 0 });
        });
    });

    // Timer Logic
    btnPlay.addEventListener('click', startTimer);
    btnFocusPause.addEventListener('click', () => {
        if(isPaused) resumeTimer();
        else pauseTimer(true);
    });
    btnFocusEnd.addEventListener('click', () => endTimerEarly(true));
    btnReset.addEventListener('click', () => setTimer(initialDuration));
    presetBtns.forEach(btn => btn.addEventListener('click', (e) => setTimer(parseInt(e.target.dataset.sec))));
    btnCustom.addEventListener('click', () => {
        let h = parseInt(document.getElementById('inp-h').value) || 0;
        let m = parseInt(document.getElementById('inp-m').value) || 0;
        let s = parseInt(document.getElementById('inp-s').value) || 0;
        let total = (h * 3600) + (m * 60) + s;
        if (total > 0) setTimer(total);
    });

    inpDailyGoal.addEventListener('change', (e) => {
        dailyGoalMins = parseInt(e.target.value) || 180;
        localStorage.setItem('terraGoal', dailyGoalMins);
        updateDashboard();
    });

    // Break Actions
    btnStartBreak.addEventListener('click', () => {
        celebrationOverlay.classList.remove('active');
        startBreak(300); // 5 min default break
    });
    btnSkipBreak.addEventListener('click', () => {
        celebrationOverlay.classList.remove('active');
        endBreak();
    });
}

function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// -- Smart Start Engine --
function renderSmartStart() {
    const history = getHistory();
    smartStartChips.innerHTML = '';
    
    const taskFreq = {};
    history.forEach(s => {
        if (s.task && s.task !== 'Quick Focus' && s.task !== 'Deep Work') {
            taskFreq[s.task] = (taskFreq[s.task] || 0) + 1;
        }
    });
    const topTasks = Object.entries(taskFreq).sort((a,b) => b[1] - a[1]).slice(0, 2);
    
    // Quick
    let c1 = document.createElement('div');
    c1.className = 'chip'; c1.textContent = 'Quick 25m';
    c1.onclick = () => { taskInput.value = 'Quick Focus'; setTimer(1500); startTimer(); };
    smartStartChips.appendChild(c1);

    // Deep
    let c2 = document.createElement('div');
    c2.className = 'chip'; c2.textContent = 'Deep Work 50m';
    c2.onclick = () => { taskInput.value = 'Deep Work'; currentTag = {name: 'Deep Work', color: 'var(--primary)'}; currentTagDot.style.background = currentTag.color; setTimer(3000); startTimer(); };
    smartStartChips.appendChild(c2);

    // Dynamic Top Tasks
    topTasks.forEach(([taskName, count]) => {
        let c = document.createElement('div');
        c.className = 'chip'; c.textContent = taskName;
        c.onclick = () => { 
            taskInput.value = taskName; 
            const lastSession = history.slice().reverse().find(s => s.task === taskName);
            if(lastSession && lastSession.tag) { currentTag.name = lastSession.tag; currentTag.color = lastSession.tagColor; currentTagDot.style.background = currentTag.color; } 
            setTimer(3000); startTimer(); 
        };
        smartStartChips.appendChild(c);
    });
}

// -- Theme Engine --
function initTheme() {
    const savedTheme = localStorage.getItem('terraTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}
function toggleTheme() {
    let currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('terraTheme', newTheme);
    updateThemeIcon(newTheme);
}
function updateThemeIcon(theme) {
    if(theme === 'light') { iconSun.style.display = 'none'; iconMoon.style.display = 'block'; } 
    else { iconSun.style.display = 'block'; iconMoon.style.display = 'none'; }
}

function setCompanionText(msg) {
    companionText.style.opacity = 0;
    setTimeout(() => { companionText.textContent = msg; companionText.style.opacity = 0.8; }, 250);
}

function closeAllOverlays() {
    sidebar.classList.remove('open');
    historyModal.classList.remove('open');
    sheet.classList.remove('open');
    overlay.classList.remove('open');
}

// -- Audio Fade Logic --
function setSoundVolume(id, vol) {
    const snd = sounds.find(s => s.id === id);
    if(!snd) return;
    snd.targetVol = vol; snd.currentVol = vol; snd.slider.value = vol;
    snd.slider.previousElementSibling.querySelector('.val').textContent = Math.round(vol * 100) + '%';
    
    if (synths[id]) {
        if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        synths[id].gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
    }
}
function smoothFadeSounds(targets) {
    clearInterval(volumeInterval);
    sounds.forEach(s => {
        if(targets[s.id] !== undefined) s.targetVol = targets[s.id];
        if (synths[s.id]) {
            if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }
    });
    volumeInterval = setInterval(() => {
        let allDone = true;
        sounds.forEach(s => {
            if(Math.abs(s.currentVol - s.targetVol) > 0.02) {
                allDone = false;
                s.currentVol += (s.targetVol > s.currentVol) ? 0.02 : -0.02;
                s.slider.value = s.currentVol;
                s.slider.previousElementSibling.querySelector('.val').textContent = Math.round(s.currentVol * 100) + '%';
                if(synths[s.id]) synths[s.id].gain.value = s.currentVol;
            } else {
                s.currentVol = s.targetVol;
                if(synths[s.id]) synths[s.id].gain.value = s.currentVol;
            }
        });
        if(allDone) clearInterval(volumeInterval);
    }, 50);
}

// -- Timer Core --
let lastTimeString = "";
function updateDisplay(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    let timeString = "";
    if (h > 0) timeString = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    else timeString = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    
    if (timeString !== lastTimeString) {
        if (!lastTimeString || lastTimeString.length !== timeString.length) {
            display.innerHTML = timeString.split('').map(c => `<span>${c}</span>`).join('');
        } else {
            const spans = display.querySelectorAll('span');
            for (let i = 0; i < timeString.length; i++) {
                if (timeString[i] !== lastTimeString[i]) {
                    const sp = spans[i];
                    sp.style.transform = 'translateY(-4px)';
                    sp.style.opacity = '0';
                    setTimeout(() => {
                        sp.textContent = timeString[i];
                        sp.style.transform = 'translateY(4px)';
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                sp.style.transform = 'translateY(0)';
                                sp.style.opacity = '1';
                            });
                        });
                    }, 200);
                }
            }
        }
        lastTimeString = timeString;
    }
    document.title = `${timeString} — FocusSpace`;
}

function setTimer(seconds) {
    if(isRunning) endTimerEarly();
    initialDuration = seconds; timeRemaining = seconds;
    updateDisplay(timeRemaining); closeAllOverlays();
    document.title = `${display.textContent} — FocusSpace`;
}

function startTimer() {
    if (timeRemaining <= 0) return;
    document.body.classList.add('focus-active');
    document.body.classList.remove('focus-paused', 'break-active');
    isRunning = true; isPaused = false; isBreakMode = false;
    iconPause.style.display = 'block'; iconResume.style.display = 'none';
    
    setCompanionText("Stay locked in.");
    taskInput.blur(); closeAllOverlays();
    smartStartChips.classList.add('hidden');
    
    targetTime = Date.now() + (timeRemaining * 1000);
    timerInterval = setInterval(() => {
        const now = Date.now();
        timeRemaining = Math.max(0, Math.round((targetTime - now) / 1000));
        updateDisplay(timeRemaining);
        if (timeRemaining <= 0) completeTimer();
    }, 200);
}

function pauseTimer(manualInt = false) {
    isPaused = true; clearInterval(timerInterval);
    document.body.classList.add('focus-paused');
    iconPause.style.display = 'none'; iconResume.style.display = 'block';
    setCompanionText("Take a breath. Session paused.");
    if(manualInt) { logInterruption(); showToast("Focus interrupted."); }
}

function resumeTimer() {
    isPaused = false; document.body.classList.remove('focus-paused');
    iconPause.style.display = 'block'; iconResume.style.display = 'none';
    setCompanionText("One step at a time.");
    targetTime = Date.now() + (timeRemaining * 1000);
    timerInterval = setInterval(() => {
        const now = Date.now();
        timeRemaining = Math.max(0, Math.round((targetTime - now) / 1000));
        updateDisplay(timeRemaining);
        if (timeRemaining <= 0) {
            if(isBreakMode) endBreak(); else completeTimer();
        }
    }, 200);
}

function endTimerEarly(manualInt = false) {
    isRunning = false; isPaused = false; clearInterval(timerInterval);
    document.body.classList.remove('focus-active', 'focus-paused', 'break-active');
    timeRemaining = initialDuration; updateDisplay(timeRemaining);
    setCompanionText("Ready to focus.");
    if(manualInt) { logInterruption(); showToast("Session ended early."); }
    renderSmartStart();
}

function completeTimer() {
    isRunning = false; isPaused = false; clearInterval(timerInterval);
    document.body.classList.remove('focus-active', 'focus-paused');
    
    saveSession(initialDuration, taskInput.value);
    timeRemaining = initialDuration; 
    
    setCompanionText("Take a breath. Good work.");
    if(synths.chime) synths.chime.play();
    
    setTimeout(() => {
        celebTitle.textContent = "Session Complete";
        celebMsg.textContent = "Take a breath. Good work.";
        document.getElementById('break-actions').style.display = 'flex';
        celebrationOverlay.classList.add('active');
    }, 1500);
}

// -- Break Mode --
function startBreak(seconds) {
    isBreakMode = true;
    document.body.classList.add('break-active');
    isRunning = true; isPaused = false;
    timeRemaining = seconds; updateDisplay(timeRemaining);
    setCompanionText("Take a breather 🧠");
    
    targetTime = Date.now() + (timeRemaining * 1000);
    timerInterval = setInterval(() => {
        const now = Date.now();
        timeRemaining = Math.max(0, Math.round((targetTime - now) / 1000));
        updateDisplay(timeRemaining);
        if (timeRemaining <= 0) endBreak();
    }, 200);
}

function endBreak() {
    isRunning = false; isPaused = false; isBreakMode = false; clearInterval(timerInterval);
    document.body.classList.remove('break-active');
    timeRemaining = initialDuration; updateDisplay(timeRemaining);
    setCompanionText("Ready for the next sprint.");
    if(synths.chime) synths.chime.play();
    
    celebTitle.textContent = "Break Over";
    celebMsg.textContent = "Time to lock in.";
    document.getElementById('break-actions').style.display = 'none';
    celebrationOverlay.classList.add('active');
    setTimeout(() => celebrationOverlay.classList.remove('active'), 3000);
    renderSmartStart();
}

// -- Stats Logic --
function getHistory() {
    const h = localStorage.getItem('terraHistory');
    return h ? JSON.parse(h) : [];
}

function logInterruption() {
    let ints = parseInt(localStorage.getItem('terraInts')) || 0;
    localStorage.setItem('terraInts', ints + 1);
    updateDashboard();
}

function saveSession(durationSec, taskName) {
    const history = getHistory();
    const dateStr = new Date().toISOString().split('T')[0];
    history.push({ 
        timestamp: Date.now(), 
        date: dateStr, 
        durationMins: Math.round(durationSec / 60), 
        task: taskName.trim() || 'Deep Work',
        tag: currentTag.name,
        tagColor: currentTag.color
    });
    localStorage.setItem('terraHistory', JSON.stringify(history));
    updateDashboard();
}

function formatTime(totalMins) {
    const h = Math.floor(totalMins / 60); const m = totalMins % 60;
    if(h > 0) return `${h}h ${m}m`; return `${m}m`;
}

function updateDashboard() {
    const history = getHistory();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().split('T')[0];
    
    const daysMap = {}; const dayLabels = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        daysMap[dateStr] = 0;
        dayLabels.push({ dateStr, label: d.toLocaleDateString('en-US', {weekday: 'short'}) });
    }

    let completedSessions = history.length;
    history.forEach(s => { if(daysMap[s.date] !== undefined) daysMap[s.date] += s.durationMins; });

    let currentWeekMins = 0; Object.values(daysMap).forEach(m => currentWeekMins += m);
    
    let streak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    
    for(let i=364; i>=0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const dayMins = history.filter(s => s.date === dStr).reduce((acc, s) => acc + s.durationMins, 0);
        if(dayMins > 0) {
            tempStreak++;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
            if (i !== 0) tempStreak = 0;
        }
    }
    
    for(let i=0; i<365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const dayMins = history.filter(s => s.date === dStr).reduce((acc, s) => acc + s.durationMins, 0);
        if(dayMins > 0) streak++;
        else if (i === 0) continue;
        else break;
    }
    if (streak > bestStreak) bestStreak = streak;

    document.getElementById('stat-streak').textContent = `${streak}d`;
    if(document.getElementById('stat-best-streak')) document.getElementById('stat-best-streak').textContent = `${bestStreak}d`;
    
    const todayMins = daysMap[todayStr] || 0;
    document.getElementById('stat-today').textContent = formatTime(todayMins);

    // Top Progress Bar update
    const topPct = Math.min((todayMins / dailyGoalMins) * 100, 100);
    topProgressBar.style.width = `${topPct}%`;

    // Focus Score Calc
    let ints = parseInt(localStorage.getItem('terraInts')) || 0;
    let score = (completedSessions * 100) + (streak * 50) - (ints * 25);
    if(score < 0) score = 0;
    document.getElementById('stat-score').textContent = score;

    // Insights Logic
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
    const yesterdayMins = daysMap[yesterdayStr] || 0;
    let insight = "Keep going, you're building consistency 🚀";
    if (todayMins > yesterdayMins && yesterdayMins > 0) insight = "You focused more than yesterday 📈";
    else if (streak > 3) insight = `Incredible ${streak}-day streak! 🔥`;
    else if (currentWeekMins > WEEKLY_GOAL_MINS) insight = "You crushed your weekly goal! 🎉";
    
    if (streak >= 2 && !insight.includes("streak")) {
        insight += " • Don't break your streak 🔥";
    }
    document.getElementById('insight-message').textContent = insight;

    // Chart
    const chartContainer = document.getElementById('bar-chart');
    const hoverVal = document.getElementById('chart-hover-val');
    chartContainer.innerHTML = '';
    const maxMins = Math.max(...Object.values(daysMap), 60); 

    let bestDayMins = 0;
    Object.values(daysMap).forEach(m => { if(m > bestDayMins) bestDayMins = m; });

    dayLabels.forEach((dl) => {
        const mins = daysMap[dl.dateStr];
        const pct = Math.min((mins / maxMins) * 100, 100);
        const col = document.createElement('div'); col.className = 'chart-col';
        const wrapper = document.createElement('div'); wrapper.className = 'bar-wrapper';
        const fill = document.createElement('div'); fill.className = 'bar-fill';
        if(mins === bestDayMins && bestDayMins > 0) fill.classList.add('best-day');
        fill.style.height = '0%'; 
        const label = document.createElement('div'); label.className = 'day-label'; label.textContent = dl.label.charAt(0);
        wrapper.appendChild(fill); col.appendChild(wrapper); col.appendChild(label); chartContainer.appendChild(col);
        fill.dataset.targetHeight = `${pct}%`;
        col.addEventListener('mouseenter', () => { hoverVal.textContent = `${formatTime(mins)}`; hoverVal.style.opacity = 1; });
        col.addEventListener('mouseleave', () => { hoverVal.style.opacity = 0; });
    });

    // Recent Sessions
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '';
    const recent = history.slice().sort((a,b) => b.timestamp - a.timestamp).slice(0, 5);
    if(recent.length === 0) listEl.innerHTML = '<div style="color: var(--text-secondary)">No recent sessions.</div>';
    recent.forEach(s => {
        const d = new Date(s.timestamp);
        const time = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const tagCol = s.tagColor || 'var(--primary)';
        listEl.innerHTML += `<div class="history-item"><div style="display:flex; align-items:center;"><span class="history-tag-dot" style="background:${tagCol}"></span><span class="task">${s.task}</span></div><span class="dur">${s.durationMins}m • ${time}</span></div>`;
    });
}

function triggerStatsAnimation() {
    document.querySelectorAll('.bar-fill').forEach((fill, idx) => {
        fill.style.height = '0%'; setTimeout(() => { fill.style.height = fill.dataset.targetHeight; }, 50 + (idx * 50));
    });
}

init();
