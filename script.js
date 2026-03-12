// State Management
let subjects = [];

// Helper to get current date string (YYYY-MM-DD)
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getMonthYearStr = (date) => {
    const d = new Date(date);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const getStartOfWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
};

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

// Stats Elements
const overallPercentageEl = document.getElementById('overall-percentage');
const overallProgressEl = document.getElementById('overall-progress');
const topSubjectEl = document.getElementById('top-subject');
const topSubjectCountEl = document.getElementById('top-subject-count');
const bunkableClassesEl = document.getElementById('bunkable-classes');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateDashboard();
    renderSubjects();
    setCurrentDate();
});

function setCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentYearDate.textContent = `Today, ${new Date().toLocaleDateString('en-US', options)}`;
}

// Modal Logic
addSubjectBtn.onclick = () => addModal.classList.add('active');
closeModal.onclick = () => addModal.classList.remove('active');
window.onclick = (e) => {
    if (e.target === addModal) addModal.classList.remove('active');
}

// Form Submission
addSubjectForm.onsubmit = (e) => {
    e.preventDefault();

    const startDateInput = document.getElementById('subject-start-date').value;
    const endDateInput = document.getElementById('subject-end-date').value;
    const lectureDays = Array.from(document.querySelectorAll('input[name="lecture-day"]:checked')).map(cb => parseInt(cb.value));

    const newSubject = {
        id: Date.now(),
        name: document.getElementById('subject-name').value,
        weeklyHours: parseInt(document.getElementById('subject-hours').value),
        lectureDays: lectureDays,
        startDate: startDateInput || getTodayStr(),
        endDate: endDateInput || null,
        history: [] // [{ date: '2026-03-10', status: 'attended' }]
    };

    // If starting counts were provided, backfill history with dummy dates
    const attended = parseInt(document.getElementById('subject-attended').value) || 0;
    const missed = parseInt(document.getElementById('subject-missed').value) || 0;

    for (let i = 0; i < attended; i++) newSubject.history.push({ date: getTodayStr(), status: 'attended', note: 'Initial setup' });
    for (let i = 0; i < missed; i++) newSubject.history.push({ date: getTodayStr(), status: 'missed', note: 'Initial setup' });

    subjects.push(newSubject);
    saveData();
    renderSubjects();
    updateDashboard();
    addModal.classList.remove('active');
    addSubjectForm.reset();
    showToast(`Added ${newSubject.name}`);
};

// Data Persistence
function saveData() {
    localStorage.setItem('bunkerMate_subjects', JSON.stringify(subjects));
}

function loadData() {
    const data = localStorage.getItem('bunkerMate_subjects');
    if (data) subjects = JSON.parse(data);
}

// Attendance Actions
function markAttended(id) {
    const subject = subjects.find(s => s.id === id);
    if (subject) {
        const today = getTodayStr();
        if (subject.history.some(h => h.date === today)) {
            showToast("Already marked for today!");
            return;
        }
        subject.history.push({ date: today, status: 'attended' });
        saveData();
        renderSubjects();
        updateDashboard();
    }
}

function markMissed(id) {
    const subject = subjects.find(s => s.id === id);
    if (subject) {
        const today = getTodayStr();
        if (subject.history.some(h => h.date === today)) {
            showToast("Already marked for today!");
            return;
        }
        subject.history.push({ date: today, status: 'missed' });
        saveData();
        renderSubjects();
        updateDashboard();
    }
}

function deleteSubject(id) {
    if (confirm('Are you sure you want to remove this subject?')) {
        subjects = subjects.filter(s => s.id !== id);
        saveData();
        renderSubjects();
        updateDashboard();
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

// Advanced Statistics Calculation
function calculateStats(subject) {
    const history = subject.history || [];
    const attended = history.filter(h => h.status === 'attended').length;
    const missed = history.filter(h => h.status === 'missed').length;
    const total = attended + missed;
    const percentage = total === 0 ? 0 : (attended / total) * 100;

    // Monthly breakdown
    const monthlyStats = {};
    history.forEach(log => {
        const month = getMonthYearStr(log.date);
        if (!monthlyStats[month]) monthlyStats[month] = { attended: 0, missed: 0 };
        monthlyStats[month][log.status]++;
    });

    // Weekly calculation
    const weekStart = getStartOfWeek();
    const thisWeekHistory = history.filter(h => h.date >= weekStart);
    const attendedThisWeek = thisWeekHistory.filter(h => h.status === 'attended').length;
    const missedThisWeek = thisWeekHistory.filter(h => h.status === 'missed').length;
    
    let remainingThisWeek = Math.max(0, subject.weeklyHours - (attendedThisWeek + missedThisWeek));
    
    // More accurate remaining count if lecture days are specified
    if (subject.lectureDays && subject.lectureDays.length > 0) {
        const todayDay = new Date().getDay();
        const todayStr = getTodayStr();
        const isTodayMarked = history.some(h => h.date === todayStr);
        
        // Count scheduled days that are either in the future this week OR today if not yet marked
        const scheduledRemaining = subject.lectureDays.filter(d => {
            // We consider the week to end on Sunday (0) or Saturday (6) depending on getStartOfWeek logic
            // getStartOfWeek seems to consider Mon the start. So Sun is the end?
            // Actually getStartOfWeek: const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            // This is ISO week (Mon-Sun). 
            // If d is 1-6 (Mon-Sat), remaining are any d > todayDay AND d != 0, plus 0 (Sun)
            // If d is 0 (Sun), only today if not marked.
            
            if (todayDay === 0) { // It's Sunday
                 return d === 0 && !isTodayMarked;
            }
            
            if (d === 0) return true; // Sunday is always in the future if today is Mon-Sat
            if (d > todayDay) return true;
            if (d === todayDay && !isTodayMarked) return true;
            return false;
        }).length;
        
        remainingThisWeek = scheduledRemaining;
    }

    // Formula: (Total Attended + Attending Remaining) / (Total Classes + Remaining This Week) >= 0.75
    // Actually, simpler: How many of the remaining can I skip?
    // Max allowed missed = Floor( (Total Possible) * 0.25 ) - Already Missed
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

        const weeklyMsg = canMissInRemaining > 0
            ? `You can bunk ${Math.min(canMissInRemaining, remainingThisWeek)} more this week.`
            : `Must attend all remaining classes this week.`;

        if (canBunkTotal === 0) {
            statusMessage = "On the edge! " + weeklyMsg;
            statusType = "status-warning";
        } else {
            statusMessage = "Safe! " + weeklyMsg;
            statusType = "status-safe";
        }
    } else {
        const needAttend = Math.ceil(3 * total - 4 * attended);
        bunkerEstimate = -needAttend;
        statusMessage = `Attend ${needAttend} more to hit 75%.`;
        statusType = "status-danger";
    }

    // Estimate safe bunks per day until subject end date (if available)
    let dailyBunkable = 0;
    let remainingDays = 0;

    if (subject.endDate && bunkerEstimate > 0) {
        const today = new Date(getTodayStr());
        const end = new Date(subject.endDate);
        if (end >= today) {
            const diffMs = end.getTime() - today.getTime();
            remainingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // include today
            if (remainingDays > 0) {
                dailyBunkable = bunkerEstimate / remainingDays;
            }
        }
    }

    return {
        percentage,
        total,
        attended,
        missed,
        statusMessage,
        statusType,
        bunkerEstimate,
        monthlyStats,
        remainingThisWeek,
        canMissInRemaining,
        dailyBunkable,
        remainingDays
    };
}

// UI Rendering
function renderSubjects() {
    subjectList.innerHTML = '';

    if (subjects.length === 0) {
        subjectList.innerHTML = `
            <div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <p style="color: var(--text-secondary);">No subjects added yet. Start by adding your first subject!</p>
            </div>
        `;
        return;
    }

    subjects.forEach(subject => {
        const stats = calculateStats(subject);
        const card = document.createElement('div');
        card.className = 'glass-card subject-card';

        const today = getTodayStr();
        const todayDay = new Date().getDay();
        const isTodayMarked = subject.history.some(h => h.date === today);
        const isLectureToday = subject.lectureDays && subject.lectureDays.includes(todayDay);

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const lectureDaysStr = subject.lectureDays && subject.lectureDays.length > 0
            ? subject.lectureDays.map(d => dayNames[d]).join(', ')
            : 'Not set';

        // Monthly breakdown mini-view
        let monthlyHtml = '';
        Object.entries(stats.monthlyStats).slice(-2).reverse().forEach(([month, mStats]) => {
            const mPerc = (mStats.attended / (mStats.attended + mStats.missed)) * 100;
            monthlyHtml += `<div style="font-size: 0.7rem; color: var(--text-secondary);">${month}: ${mPerc.toFixed(1)}%</div>`;
        });

        card.innerHTML = `
            <div class="subject-header">
                <div>
                    <h3 class="subject-name">
                        ${subject.name}
                        ${isLectureToday ? '<span class="lecture-badge">Lecture Today</span>' : ''}
                    </h3>
                    <div class="subject-stats">
                        <span>${subject.weeklyHours} hrs/week</span>
                        <span>•</span>
                        <span>${stats.attended} Att / ${stats.missed} Miss</span>
                    </div>
                    <div class="subject-stats" style="font-size: 0.8rem; margin-top: 0.25rem; color: var(--text-secondary);">
                        <span>Days: ${lectureDaysStr}</span>
                    </div>
                    <div class="subject-stats" style="font-size: 0.8rem; margin-top: 0.25rem; color: var(--text-secondary);">
                        <span>Safe bunks/day: ${stats.dailyBunkable > 0 ? stats.dailyBunkable.toFixed(2) : '0'}</span>
                        ${stats.remainingDays > 0 ? `<span style="margin-left: 0.5rem;">(for next ${stats.remainingDays} days)</span>` : ''}
                    </div>
                </div>
                <div class="attendance-display">
                    <span class="percentage-text" style="color: ${getPercentageColor(stats.percentage)}">${stats.percentage.toFixed(1)}%</span>
                    <span class="percentage-label">Total</span>
                </div>
            </div>

            <div class="progress-container">
                <div class="progress-bar" style="width: ${stats.percentage}%; background: ${getPercentageColor(stats.percentage)}"></div>
            </div>

            <div class="bunker-status ${stats.statusType}">
                ${stats.statusMessage}
            </div>

            <div style="margin-top: 0.5rem; border-top: 1px solid var(--glass-border); padding-top: 0.5rem;">
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 2px;">Recent Performance:</div>
                ${monthlyHtml || '<div style="font-size: 0.7rem; color: var(--text-secondary);">Waiting for data...</div>'}
            </div>

            <div class="subject-controls">
                <button class="btn btn-sm btn-success" onclick="markAttended(${subject.id})" ${isTodayMarked ? 'disabled' : ''}>
                    ${isTodayMarked && subject.history.find(h => h.date === today).status === 'attended' ? '✓ Attended' : 'Attended'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="markMissed(${subject.id})" ${isTodayMarked ? 'disabled' : ''}>
                    ${isTodayMarked && subject.history.find(h => h.date === today).status === 'missed' ? '✖ Missed' : 'Missed'}
                </button>
                <button class="btn btn-outline-danger" onclick="viewHistory(${subject.id})" title="View History" style="border-color:var(--text-secondary); color:var(--text-secondary); background:transparent;">
                    <i data-lucide="history" style="width:18px; height:18px;"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="deleteSubject(${subject.id})" title="Delete Subject">
                    <i data-lucide="trash-2" style="width:18px; height:18px;"></i>
                </button>
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
        topSubjectCountEl.textContent = '0/0 Classes';
        bunkableClassesEl.textContent = '0';
        return;
    }

    let totalAttended = 0;
    let totalClasses = 0;
    let totalBunkable = 0;
    let bestSubject = subjects[0];
    let bestPercentage = -1;

    subjects.forEach(s => {
        const stats = calculateStats(s);
        totalAttended += stats.attended;
        totalClasses += stats.total;

        if (stats.percentage > bestPercentage) {
            bestPercentage = stats.percentage;
            bestSubject = s;
        }

        if (stats.bunkerEstimate > 0) {
            totalBunkable += stats.bunkerEstimate;
        }
    });

    const overallPerc = totalClasses === 0 ? 0 : (totalAttended / totalClasses) * 100;
    const bestStats = calculateStats(bestSubject);

    overallPercentageEl.textContent = `${overallPerc.toFixed(1)}%`;
    overallProgressEl.style.width = `${overallPerc}%`;
    overallProgressEl.style.background = getPercentageColor(overallPerc);

    topSubjectEl.textContent = bestSubject.name;
    topSubjectCountEl.textContent = `${bestStats.attended}/${bestStats.total} Classes`;

    bunkableClassesEl.textContent = totalBunkable;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
        toast.style.transform = 'translateY(150%)';
    }, 3000);
}
