// API Configuration
const API_URL = 'http://localhost:5000/api';
let subjects = [];

// Device Identification
const getDeviceId = () => {
    let id = localStorage.getItem('bunkerMate_deviceId');
    if (!id) {
        id = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('bunkerMate_deviceId', id);
    }
    return id;
};

const DEVICE_ID = getDeviceId();

// Helpers
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getMonthYearStr = (date) => {
    const d = new Date(date);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const getStartOfWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
};

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('bunkerMate_theme') || 'system';
    const scaling = localStorage.getItem('bunkerMate_scaling') === 'true';
    applyTheme(savedTheme);
    applyScaling(scaling);
    document.querySelectorAll('.theme-card').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === savedTheme);
    });
    document.getElementById('scaling-toggle').checked = scaling;
}

function applyTheme(theme) {
    localStorage.setItem('bunkerMate_theme', theme);
    document.querySelectorAll('.theme-card').forEach(opt => opt.classList.toggle('active', opt.dataset.theme === theme));
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (localStorage.getItem('bunkerMate_theme') === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
});

function applyScaling(active) {
    localStorage.setItem('bunkerMate_scaling', active);
    document.body.classList.toggle('scaled-90', active);
}

// DOM Elements
const subjectList = document.getElementById('subject-list');
const addSubjectBtn = document.getElementById('add-subject-btn');
const addModal = document.getElementById('add-modal');
const closeModal = document.getElementById('close-modal');
const addSubjectForm = document.getElementById('add-subject-form');
const currentYearDate = document.getElementById('current-date');
const historyModal = document.getElementById('history-modal');
const historyContent = document.getElementById('history-content');
const historyTitle = document.getElementById('history-title');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');

const overallPercentageEl = document.getElementById('overall-percentage');
const overallProgressEl = document.getElementById('overall-progress');
const topSubjectEl = document.getElementById('top-subject');
const topSubjectCountEl = document.getElementById('top-subject-count');
const bunkableClassesEl = document.getElementById('bunkable-classes');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setCurrentDate();
    initFloatingBackground();
    loadData();
});

function setCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentYearDate.textContent = `Today, ${new Date().toLocaleDateString('en-US', options)}`;
}

// Modal Logic
addSubjectBtn.onclick = () => addModal.classList.add('active');
closeModal.onclick = () => addModal.classList.remove('active');
settingsBtn.onclick = () => settingsModal.classList.add('active');

window.onclick = (e) => {
    if (e.target === addModal) addModal.classList.remove('active');
    if (e.target === settingsModal) settingsModal.classList.remove('active');
    if (e.target === historyModal) historyModal.classList.remove('active');
};

// Form Submission
addSubjectForm.onsubmit = async (e) => {
    e.preventDefault();

    const payload = {
        name: document.getElementById('subject-name').value,
        weekly_hours: parseInt(document.getElementById('subject-hours').value),
        lecture_days: Array.from(document.querySelectorAll('input[name="lecture-day"]:checked')).map(cb => parseInt(cb.value)),
        start_date: document.getElementById('subject-start-date').value || getTodayStr(),
        end_date: document.getElementById('subject-end-date').value || null
    };

    try {
        const response = await fetch(`${API_URL}/subjects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-id': DEVICE_ID
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast(`Added ${payload.name}`);
            await loadData();
        } else {
            showToast("Failed to save subject");
        }
    } catch (err) {
        console.error("Subject save failure:", err);
    }

    addModal.classList.remove('active');
    addSubjectForm.reset();
};

// Data Persistence
async function loadData() {
    try {
        const response = await fetch(`${API_URL}/subjects`, {
            headers: { 'x-device-id': DEVICE_ID }
        });
        const data = await response.json();
        if (response.ok) {
            subjects = data.map(s => ({
                id: s.id,
                name: s.name,
                weeklyHours: s.weekly_hours,
                lectureDays: s.lecture_days,
                startDate: s.start_date,
                endDate: s.end_date,
                history: s.history || []
            }));
            renderSubjects();
            updateDashboard();
        }
    } catch (err) {
        console.warn("Initial load bypassed server (Offline).");
    }
}

// Settings Listeners
document.querySelectorAll('.theme-card').forEach(opt => {
    opt.onclick = () => applyTheme(opt.dataset.theme);
});

document.getElementById('scaling-toggle').onchange = (e) => {
    applyScaling(e.target.checked);
};

// Attendance Actions
async function markAttended(id) {
    const subject = subjects.find(s => s.id === id);
    if (subject) {
        const today = getTodayStr();
        if (subject.history.some(h => h.date === today)) {
            showToast("Already marked for today!");
            return;
        }

        try {
            const resp = await fetch(`${API_URL}/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': DEVICE_ID
                },
                body: JSON.stringify({ subject_id: id, date: today, status: 'attended' })
            });
            if (resp.ok) {
                await loadData();
            } else {
                showToast("Sync failed");
            }
        } catch (err) { showToast("Server error"); }
    }
}

async function markMissed(id) {
    const subject = subjects.find(s => s.id === id);
    if (subject) {
        const today = getTodayStr();
        if (subject.history.some(h => h.date === today)) {
            showToast("Already marked for today!");
            return;
        }

        try {
            const resp = await fetch(`${API_URL}/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': DEVICE_ID
                },
                body: JSON.stringify({ subject_id: id, date: today, status: 'missed' })
            });
            if (resp.ok) {
                await loadData();
            } else {
                showToast("Sync failed");
            }
        } catch (err) { showToast("Server error"); }
    }
}

async function deleteSubject(id) {
    if (confirm('Are you sure you want to remove this subject?')) {
        try {
            const resp = await fetch(`${API_URL}/subjects/${id}`, {
                method: 'DELETE',
                headers: { 'x-device-id': DEVICE_ID }
            });
            if (resp.ok) {
                await loadData();
            } else {
                showToast("Delete failed");
            }
        } catch (err) { showToast("Connection error"); }
    }
}

function viewHistory(id) {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;

    historyTitle.textContent = `${subject.name} - History`;
    const stats = calculateStats(subject);

    let html = '';
    const months = Object.keys(stats.monthlyStats).sort((a, b) => new Date(b) - new Date(a));

    if (months.length === 0) {
        html = '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">No logs yet.</p>';
    }

    months.forEach(month => {
        const mStats = stats.monthlyStats[month];
        const mPerc = (mStats.attended / (mStats.attended + mStats.missed)) * 100;

        html += `
            <div style="margin-bottom: 2rem;">
                <h4 style="display:flex; justify-content:space-between; margin-bottom:1rem; border-bottom:1px solid var(--glass-border); padding-bottom:0.5rem;">
                    <span>${month}</span>
                    <span style="color:${getPercentageColor(mPerc)}">${mPerc.toFixed(1)}%</span>
                </h4>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:0.5rem;">
                    ${subject.history.filter(h => getMonthYearStr(h.date) === month).reverse().map(log => `
                        <div style="background:rgba(255,255,255,0.03); padding:0.5rem; border-radius:8px; display:flex; justify-content:space-between; font-size:0.8rem;">
                            <span>${new Date(log.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                            <span style="color:${log.status === 'attended' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}">${log.status}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    historyContent.innerHTML = html;
    historyModal.classList.add('active');
}

// Stats Calculation
function calculateStats(subject) {
    const history = subject.history || [];
    const attended = history.filter(h => h.status === 'attended').length;
    const missed = history.filter(h => h.status === 'missed').length;
    const total = attended + missed;
    const percentage = total === 0 ? 0 : (attended / total) * 100;

    const monthlyStats = {};
    history.forEach(log => {
        const month = getMonthYearStr(log.date);
        if (!monthlyStats[month]) monthlyStats[month] = { attended: 0, missed: 0 };
        monthlyStats[month][log.status]++;
    });

    const weekStart = getStartOfWeek();
    const thisWeekHistory = history.filter(h => h.date >= weekStart);
    const attendedThisWeek = thisWeekHistory.filter(h => h.status === 'attended').length;
    const missedThisWeek = thisWeekHistory.filter(h => h.status === 'missed').length;

    let remainingThisWeek = Math.max(0, subject.weeklyHours - (attendedThisWeek + missedThisWeek));

    if (subject.lectureDays && subject.lectureDays.length > 0) {
        const todayDay = new Date().getDay();
        const todayStr = getTodayStr();
        const isTodayMarked = history.some(h => h.date === todayStr);
        const scheduledRemaining = subject.lectureDays.filter(d => {
            if (todayDay === 0) return d === 0 && !isTodayMarked;
            if (d === 0) return true;
            if (d > todayDay) return true;
            if (d === todayDay && !isTodayMarked) return true;
            return false;
        }).length;
        remainingThisWeek = scheduledRemaining;
    }

    const totalPossibleByEndOfWeek = total + remainingThisWeek;
    const maxMissedByEndOfWeek = Math.floor(totalPossibleByEndOfWeek * 0.25);
    const canMissInRemaining = Math.max(0, maxMissedByEndOfWeek - missed);

    let statusMessage = '';
    let statusType = '';
    let bunkerEstimate = 0;

    if (total === 0) {
        statusMessage = `New week! ${subject.weeklyHours} lectures ahead.`;
        statusType = "status-safe";
    } else if (percentage >= 75) {
        const canBunkTotal = Math.floor(attended / 0.75 - total);
        bunkerEstimate = canBunkTotal;
        const weeklyMsg = canMissInRemaining > 0 ? `You can bunk ${Math.min(canMissInRemaining, remainingThisWeek)} more this week.` : `Attend all remaining classes this week.`;
        statusMessage = (canBunkTotal === 0 ? "On the edge! " : "Safe! ") + weeklyMsg;
        statusType = canBunkTotal === 0 ? "status-warning" : "status-safe";
    } else {
        const needAttend = Math.ceil(3 * total - 4 * attended);
        bunkerEstimate = -needAttend;
        statusMessage = `Attend ${needAttend} more to hit 75%.`;
        statusType = "status-danger";
    }

    return { percentage, total, attended, missed, statusMessage, statusType, bunkerEstimate, monthlyStats };
}

// UI Rendering
function renderSubjects() {
    subjectList.innerHTML = '';
    if (subjects.length === 0) {
        subjectList.innerHTML = `<div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 3rem; border-style: dashed;"><p style="color: var(--text-secondary); font-weight: 500;">No subjects found.</p></div>`;
        return;
    }

    subjects.forEach(subject => {
        const stats = calculateStats(subject);
        const card = document.createElement('div');
        card.className = 'glass-card subject-card';
        const today = getTodayStr();
        const isTodayMarked = subject.history.some(h => h.date === today);

        card.innerHTML = `
            <div class="subject-header" style="justify-content: space-between; display: flex; align-items: flex-start; margin-bottom: 1rem;">
                <div><h3 class="subject-name">${subject.name}</h3><div class="subject-stats"><span>${stats.attended}A / ${stats.total}T</span></div></div>
                <div class="attendance-display" style="text-align: right;"><span class="percentage-text" style="color: ${getPercentageColor(stats.percentage)}; font-weight: 800; font-size: 1.25rem;">${stats.percentage.toFixed(1)}%</span></div>
            </div>
            <div class="mini-progress-track" style="height: 4px; margin-bottom: 1rem;"><div class="mini-progress-fill" style="width: ${stats.percentage}%; background: ${getPercentageColor(stats.percentage)}"></div></div>
            <div class="bunker-status ${stats.statusType}" style="font-size: 0.75rem; margin-bottom: 1.25rem; font-weight: 600;">${stats.statusMessage}</div>
            <div class="subject-controls" style="display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 0.8rem; align-items: center;">
                <button class="btn btn-sm btn-success" style="padding: 0.6rem; font-size: 0.8rem; justify-content: center; height: 42px;" onclick="markAttended(${subject.id})" ${isTodayMarked ? 'disabled' : ''}>${isTodayMarked && subject.history.find(h => h.date === today).status === 'attended' ? '✓' : 'Attended'}</button>
                <button class="btn btn-sm btn-danger" style="padding: 0.6rem; font-size: 0.8rem; justify-content: center; height: 42px;" onclick="markMissed(${subject.id})" ${isTodayMarked ? 'disabled' : ''}>${isTodayMarked && subject.history.find(h => h.date === today).status === 'missed' ? '✖' : 'Missed'}</button>
                <button class="icon-btn-bordered" style="width: 42px; height: 42px; border-radius: 12px;" onclick="viewHistory(${subject.id})"><i data-lucide="history" style="width: 18px;"></i></button>
                <button class="icon-btn-bordered" style="width: 42px; height: 42px; border-radius: 12px;" onclick="deleteSubject(${subject.id})"><i data-lucide="trash-2" style="width: 18px;"></i></button>
            </div>
        `;
        subjectList.appendChild(card);
    });
    lucide.createIcons();
}

function getPercentageColor(percentage) {
    if (percentage >= 75) return 'var(--accent-emerald)';
    if (percentage >= 65) return 'var(--accent-amber)';
    return 'var(--accent-rose)';
}

function updateDashboard() {
    if (subjects.length === 0) {
        overallPercentageEl.textContent = '0%';
        overallProgressEl.style.width = '0%';
        topSubjectEl.textContent = '--';
        if (topSubjectCountEl) topSubjectCountEl.textContent = '0/0 CLASSES';
        bunkableClassesEl.textContent = '0';
        return;
    }

    let totalAttended = 0, totalClasses = 0, totalBunkable = 0, bestSubject = subjects[0], bestPercentage = -1;
    subjects.forEach(s => {
        const stats = calculateStats(s);
        totalAttended += stats.attended;
        totalClasses += stats.total;
        if (stats.percentage > bestPercentage) { bestPercentage = stats.percentage; bestSubject = s; }
        if (stats.bunkerEstimate > 0) totalBunkable += stats.bunkerEstimate;
    });

    const overallPerc = totalClasses === 0 ? 0 : (totalAttended / totalClasses) * 100;
    const bestStats = calculateStats(bestSubject);
    overallPercentageEl.textContent = `${overallPerc.toFixed(1)}%`;
    overallProgressEl.style.width = `${overallPerc}%`;
    topSubjectEl.textContent = bestSubject.name;
    if (topSubjectCountEl) topSubjectCountEl.textContent = `${bestStats.attended}/${bestStats.total} CLASSES`;
    bunkableClassesEl.textContent = totalBunkable;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function initFloatingBackground() {
    const container = document.getElementById('floating-elements');
    if (!container) return;
    const items = ['book', 'graduation-cap', 'pencil', 'award', 'library'];
    for (let i = 0; i < 12; i++) {
        const item = document.createElement('div');
        item.className = 'floating-item';
        item.innerHTML = `<i data-lucide="${items[Math.floor(Math.random() * items.length)]}"></i>`;
        item.style.left = `${Math.random() * 100}%`;
        item.style.top = `${Math.random() * 100}%`;
        item.style.fontSize = `${20 + Math.random() * 40}px`;
        item.style.animationDuration = `${15 + Math.random() * 25}s`;
        item.style.animationDelay = `${-Math.random() * 20}s`;
        container.appendChild(item);
    }
    lucide.createIcons();
}
