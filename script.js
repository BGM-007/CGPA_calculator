// Data & Constants
const STORAGE_KEY = 'cgpa_neon_v1';
let sems = [];
let nextSemId = 1;
let nextSubId = 1;

// --- Logic ---

function gradeToGP(grade, isFR) {
    if (isFR || grade === 'FR') return { gp: 0, excluded: true };
    if (!grade) return { gp: null, excluded: false };
    const g = String(grade).trim().toUpperCase();
    const map = { 'A+': 10, 'A': 9, 'B+': 8, 'B': 7, 'C+': 6, 'C': 5, 'D': 4, 'F': 0 };
    return map.hasOwnProperty(g) ? { gp: map[g], excluded: false } : { gp: null, excluded: false };
}

function marksToGrade(marks) {
    if (marks === null || marks === '') return null;
    const m = Number(marks);
    if (isNaN(m)) return null;
    if (m >= 91) return 'A+';
    if (m >= 81) return 'A';
    if (m >= 71) return 'B+';
    if (m >= 61) return 'B';
    if (m >= 51) return 'C+';
    if (m >= 46) return 'C';
    if (m >= 40) return 'D';
    return 'F';
}

// --- Persistence ---
function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sems)); } catch (e) { }
    updateUI();
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        // Migration support from prev versions if needed, else start fresh
        const data = raw ? JSON.parse(raw) : null;
        if (Array.isArray(data) && data.length) {
            sems = data;
            nextSemId = sems.reduce((m, s) => Math.max(m, s.id), 0) + 1;
            nextSubId = sems.flatMap(s => s.subjects || []).reduce((m, sub) => Math.max(m, sub.id || 0), 0) + 1;
            return;
        }
    } catch (e) { }
    // Default
    sems = [{ id: 1, subjects: [newSubject(), newSubject(), newSubject()] }];
    nextSemId = 2; nextSubId = 4;
}

function newSubject() {
    return { id: nextSubId++, name: '', credits: 3, grade: '', marks: '', isFR: false };
}

function newSemester() {
    return { id: nextSemId++, subjects: [newSubject(), newSubject()] };
}

// --- Stats ---
function getSemStats(sem) {
    let sumC = 0, sumGP = 0;
    sem.subjects.forEach(s => {
        const gVal = (s.grade && s.grade !== '') ? s.grade : marksToGrade(s.marks);
        const { gp, excluded } = gradeToGP(gVal, s.isFR);
        const cred = Number(s.credits);
        if (!excluded && gp !== null && cred > 0) {
            sumC += cred;
            sumGP += cred * gp;
        }
    });
    return { gpa: sumC ? sumGP / sumC : 0, credits: sumC, hasData: sumC > 0 };
}

function getOverallStats() {
    let totalC = 0, totalGP = 0;
    sems.forEach(sem => {
        sem.subjects.forEach(s => {
            const gVal = (s.grade && s.grade !== '') ? s.grade : marksToGrade(s.marks);
            const { gp, excluded } = gradeToGP(gVal, s.isFR);
            const cred = Number(s.credits);
            if (!excluded && gp !== null && cred > 0) {
                totalC += cred;
                totalGP += cred * gp;
            }
        });
    });
    const cgpa = totalC ? totalGP / totalC : 0;
    const percent = totalC ? (cgpa - 0.5) * 10 : 0;
    return { cgpa, percent, totalCredits: totalC };
}

// --- Rendering ---
const container = document.getElementById('semesters-container');
const cgpaEl = document.getElementById('cgpa-display');
const percentEl = document.getElementById('percent-display');
const chartEl = document.getElementById('trend-chart');

function updateUI() {
    // Stats
    const total = getOverallStats();
    cgpaEl.textContent = total.cgpa.toFixed(2);
    percentEl.textContent = total.percent.toFixed(2) + '%';

    // Chart
    renderChart();

    // List
    // We do a full re-render for simplicity and robust alignment
    container.innerHTML = '';

    sems.forEach((sem, idx) => {
        const stats = getSemStats(sem);

        const card = document.createElement('div');
        card.className = 'semester-card';
        card.style.animationDelay = `${idx * 0.1}s`;

        // Focus Mode Events
        card.addEventListener('mouseenter', () => document.body.classList.add('has-focus'));
        card.addEventListener('mouseleave', () => document.body.classList.remove('has-focus'));

        card.innerHTML = `
            <div class="sem-header">
                <div class="sem-title">SEMESTER 0${sem.id}</div>
                <div class="sem-info">
                    GPA: <span>${stats.gpa.toFixed(2)}</span>
                    CREDITS: <span>${stats.credits}</span>
                    <button class="btn-icon" onclick="removeSemester(${sem.id})" style="margin-left:10px;">✕</button>
                </div>
            </div>

            <div class="subjects-header">
                <div>Subject Name</div>
                <div>Credits</div>
                <div>Grade</div>
                <div class="text-center">FR</div>
                <div class="text-center">GP</div>
                <div></div>
            </div>

            <div class="subject-list" id="sem-list-${sem.id}"></div>
            
            <div style="margin-top:20px;">
                <button class="btn" onclick="addSubject(${sem.id})">+ ADD SUBJECT</button>
            </div>
        `;

        container.appendChild(card);
        const listContainer = document.getElementById(`sem-list-${sem.id}`);

        sem.subjects.forEach(sub => {
            const row = document.createElement('div');
            row.className = 'subject-row';

            const gVal = (sub.grade && sub.grade !== '') ? sub.grade : marksToGrade(sub.marks);
            const { gp } = gradeToGP(gVal, sub.isFR);

            const grades = ['', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F', 'FR'];
            const opts = grades.map(g => `<option value="${g}" ${sub.grade === g ? 'selected' : ''}>${g || '-'}</option>`).join('');

            row.innerHTML = `
                <div>
                    <span class="mobile-label">SUBJECT</span>
                    <input type="text" value="${sub.name}" placeholder="Subject Name" onchange="updateSub(${sem.id}, ${sub.id}, 'name', this.value)">
                </div>
                <div>
                    <span class="mobile-label">CREDITS</span>
                    <input type="number" value="${sub.credits}" step="0.5" onchange="updateSub(${sem.id}, ${sub.id}, 'credits', this.value)">
                </div>
                <div>
                    <span class="mobile-label">GRADE</span>
                    <select onchange="updateSub(${sem.id}, ${sub.id}, 'grade', this.value)">${opts}</select>
                </div>
                <div class="text-center">
                    <span class="mobile-label">FR?</span>
                    <input type="checkbox" ${sub.isFR ? 'checked' : ''} onchange="updateSub(${sem.id}, ${sub.id}, 'isFR', this.checked)">
                </div>
                <div class="text-center gp-val">
                    <span class="mobile-label">GP</span>
                    ${gp !== null ? gp : '-'}
                </div>
                <div class="text-center">
                    <button class="btn-icon" onclick="removeSubject(${sem.id}, ${sub.id})">🗑</button>
                </div>
            `;
            listContainer.appendChild(row);
        });
    });
}

function renderChart() {
    const data = sems.map(s => getSemStats(s).hasData ? getSemStats(s).gpa : null).filter(x => x !== null);
    if (data.length < 2) { chartEl.innerHTML = ''; return; }

    // Simple SVG Line
    const w = 300, h = 80;
    const pts = data.map((d, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (d / 10) * h; // scale 0-10
        return `${x},${y}`;
    }).join(' ');

    chartEl.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" overflow="visible">
        <polyline points="${pts}" class="chart-line" fill="none" />
        ${data.map((d, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (d / 10) * h;
        return `<circle cx="${x}" cy="${y}" r="3" class="chart-dot" />`;
    }).join('')}
    </svg>`;
}

// --- Actions ---
window.updateSub = (semId, subId, field, val) => {
    const sem = sems.find(s => s.id === semId);
    const sub = sem.subjects.find(s => s.id === subId);
    if (field === 'grade') sub.grade = val; // simple set
    else if (field === 'isFR') sub.isFR = val; // bool
    else sub[field] = val;

    // Auto-FR logic
    if (field === 'grade' && val === 'FR') sub.isFR = true;
    if (field === 'isFR' && val) sub.grade = 'FR';

    save();
};

window.addSubject = (semId) => {
    sems.find(s => s.id === semId).subjects.push(newSubject());
    save();
};

window.removeSubject = (semId, subId) => {
    const sem = sems.find(s => s.id === semId);
    sem.subjects = sem.subjects.filter(s => s.id !== subId);
    save();
};

window.addSemester = () => {
    sems.push(newSemester());
    save();
};

window.removeSemester = (id) => {
    if (confirm('Delete Semester?')) {
        sems = sems.filter(s => s.id !== id);
        save();
    }
};

window.resetAll = () => {
    if (confirm('HARD RESET: This will wipe all data. Confirm?')) {
        localStorage.removeItem(STORAGE_KEY);
        // Clear potential legacy keys too
        localStorage.removeItem('cgpa_v2_data');
        location.reload(); // Simplest way to ensure clean slate
    }
};

window.exportData = () => {
    const blob = new Blob([JSON.stringify(sems, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'neon_cgpa_backup.json';
    a.click();
};

document.getElementById('file-upload').addEventListener('change', e => {
    const r = new FileReader();
    r.onload = res => {
        try { sems = JSON.parse(res.target.result); save(); }
        catch (err) { alert('Invalid File'); }
    };
    if (e.target.files[0]) r.readAsText(e.target.files[0]);
});

// Init
load();
save();
