// SugarCut v2.0 — Personal Intelligence System
// ============================================================

// ── Constants ────────────────────────────────────────────────
const ANNA_NAGAR_LAT = 13.0827;
const ANNA_NAGAR_LNG = 80.2118;
const RADIUS_KM = 3;
const SUGAR_PER_CLEAN_DAY_G = 35;
const DAILY_SUGAR_LIMIT_G = 50;
const MILESTONE_DAYS = [1, 3, 7, 14, 30, 60, 90];

// ── State ─────────────────────────────────────────────────────
let streakData = JSON.parse(localStorage.getItem('sugarcut_streak')) || {
    days: 0, rewards: 0, sugarAvoided: 0, lastLogDate: null
};

// ── Personal AI Engine ────────────────────────────────────────
const PersonalAI = {

    getLog() {
        return JSON.parse(localStorage.getItem('sugarcut_foodlog')) || [];
    },

    saveLog(log) {
        localStorage.setItem('sugarcut_foodlog', JSON.stringify(log));
    },

    addEntry(entry) {
        const log = this.getLog();
        log.unshift(entry);
        if (log.length > 1000) log.pop();
        this.saveLog(log);
    },

    inferMeal(hour) {
        if (hour >= 6 && hour <= 10)  return 'BREAKFAST';
        if (hour >= 11 && hour <= 14) return 'LUNCH';
        if (hour >= 15 && hour <= 17) return 'SNACK';
        if (hour >= 18 && hour <= 21) return 'DINNER';
        return 'LATE NIGHT';
    },

    getTodayEntries() {
        const todayStr = new Date().toDateString();
        return this.getLog().filter(e => new Date(e.timestamp).toDateString() === todayStr);
    },

    getTodaySugar() {
        return this.getTodayEntries().reduce((sum, e) => sum + (e.sugar_g || 0), 0);
    },

    getLast7Days() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toDateString();
            const entries = this.getLog().filter(e => new Date(e.timestamp).toDateString() === dateStr);
            const total = entries.reduce((sum, e) => sum + (e.sugar_g || 0), 0);
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
            days.push({ date: d, label: dayLabel, total: parseFloat(total.toFixed(1)), count: entries.length });
        }
        return days;
    },

    // Returns { hour: totalSugar } for all hours with sugar entries
    getVulnerabilityWindows() {
        const log = this.getLog().filter(e => (e.sugar_g || 0) > 2);
        const map = {};
        log.forEach(e => {
            const h = new Date(e.timestamp).getHours();
            map[h] = (map[h] || 0) + (e.sugar_g || 0);
        });
        return map;
    },

    getTopOffenders(n = 5) {
        const log = this.getLog().filter(e => (e.sugar_g || 0) > 2);
        const foodMap = {};
        log.forEach(e => {
            const key = (e.food || 'Unknown').toLowerCase().trim();
            if (!foodMap[key]) foodMap[key] = { name: e.food || 'Unknown', total: 0, count: 0 };
            foodMap[key].total += (e.sugar_g || 0);
            foodMap[key].count += 1;
        });
        return Object.values(foodMap)
            .sort((a, b) => b.total - a.total)
            .slice(0, n)
            .map(f => ({ ...f, total: parseFloat(f.total.toFixed(1)) }));
    },

    getRiskScore() {
        const todaySugar = this.getTodaySugar();
        const hour = new Date().getHours();
        const vulnMap = this.getVulnerabilityWindows();

        // Intake contribution (0-65)
        const intakeScore = Math.min(65, (todaySugar / DAILY_SUGAR_LIMIT_G) * 65);

        // Historical hour danger (0-25)
        const allHourVals = Object.values(vulnMap);
        const maxHourSugar = allHourVals.length ? Math.max(...allHourVals) : 1;
        const hourScore = ((vulnMap[hour] || 0) / maxHourSugar) * 25;

        // Streak discipline reduction (0–10 reduction)
        const streakBonus = Math.min(10, streakData.days * 0.3);

        return Math.round(Math.min(100, Math.max(0, intakeScore + hourScore - streakBonus)));
    },

    getRiskLabel(score) {
        if (score >= 70) return { label: 'CRITICAL', color: '#FF6A00' };
        if (score >= 40) return { label: 'MODERATE', color: '#FFD93D' };
        if (score >= 15) return { label: 'LOW',      color: '#00e5ff' };
        return              { label: 'CLEAN',        color: '#39FF14' };
    },

    getRecommendations() {
        const log = this.getLog();
        const todaySugar = this.getTodaySugar();
        const topOffenders = this.getTopOffenders(3);
        const vulnMap = this.getVulnerabilityWindows();
        const recs = [];

        if (log.length === 0) {
            return [
                { icon: '🧠', title: 'CALIBRATING MODEL', text: 'Your personal AI has no data yet. Scan a food item and commit it to your log — every entry sharpens the model.' },
                { icon: '📊', title: 'BUILD YOUR BASELINE', text: 'Log consistently for 3 days to unlock vulnerability window analysis and personalized risk scoring.' },
                { icon: '🎯', title: 'FIRST MISSION', text: 'Scan every meal today. Breakfast, lunch, snack, dinner — build your full daily sugar footprint.' }
            ];
        }

        // Peak vulnerability hour
        const peakEntry = Object.entries(vulnMap).sort((a, b) => b[1] - a[1])[0];
        if (peakEntry) {
            const h = parseInt(peakEntry[0]);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            recs.push({
                icon: '⏰',
                title: `DANGER ZONE: ${h12}:00 ${ampm}`,
                text: `Historical data shows your highest sugar intake occurs around ${h12}:00 ${ampm}. Pre-plan your meal or snack for this window — deploy maximum discipline here.`
            });
        }

        // Primary offender
        if (topOffenders[0]) {
            const f = topOffenders[0];
            recs.push({
                icon: '⚔️',
                title: 'PRIMARY TARGET',
                text: `"${f.name}" has contributed ${f.total}g sugar across ${f.count} scan${f.count > 1 ? 's' : ''}. Find a zero-sugar replacement or eliminate it completely from your routine.`
            });
        }

        // Today status
        if (todaySugar > 35) {
            recs.push({ icon: '🚨', title: 'RED ALERT: INTAKE CRITICAL', text: `${todaySugar.toFixed(1)}g sugar logged today — exceeding safe limits. Switch to water, black coffee, and zero-sugar foods. No exceptions.` });
        } else if (todaySugar > 15) {
            recs.push({ icon: '⚠️', title: 'MODERATE INTAKE DETECTED', text: `${todaySugar.toFixed(1)}g sugar today. Avoid all snacks and sweetened beverages for the rest of the day to stay under 50g.` });
        } else if (todaySugar > 0) {
            recs.push({ icon: '✅', title: 'CLEAN TRAJECTORY', text: `Only ${todaySugar.toFixed(1)}g sugar today. Solid discipline. Maintain this protocol through dinner and you will have a clean day.` });
        } else {
            recs.push({ icon: '🏆', title: 'ZERO SUGAR TODAY', text: `No sugar detected in today's log. Perfect protocol adherence. Stay consistent through the evening — this is how streaks are built.` });
        }

        // Streak-based tip
        if (streakData.days >= 7) {
            recs.push({ icon: '⚡', title: 'METABOLIC ADAPTATION', text: `${streakData.days} days clean. Your insulin sensitivity is improving. Sugar cravings will continue to diminish — this is the adaptation phase, stay locked in.` });
        } else if (recs.length < 3) {
            recs.push({ icon: '💧', title: 'HYDRATION PROTOCOL', text: 'Replace all sweetened drinks with water, black coffee, or plain green tea. Liquid sugar spikes insulin with zero satiety — it is the fastest way to break a streak.' });
        }

        return recs.slice(0, 3);
    }
};

// ── DOM Elements ──────────────────────────────────────────────
const navBtns  = document.querySelectorAll('.nav-btn');
const views    = document.querySelectorAll('.view');

const streakDaysEl      = document.getElementById('streak-days');
const rewardsCountEl    = document.getElementById('rewards-count');
const sugarSavedEl      = document.getElementById('sugar-saved');
const streakStatusLabel = document.getElementById('streak-status-label');
const aiInsightText     = document.getElementById('ai-insight-text');
const logDayBtn         = document.getElementById('log-day-btn');
const logDayStatus      = document.getElementById('log-day-status');
const dashTodaySugar    = document.getElementById('dash-today-sugar');
const dashTodayBar      = document.getElementById('dash-today-bar');
const routineAlert      = document.getElementById('routine-alert');
const modalOverlay      = document.getElementById('overlay-modal');
const closeModalBtn     = document.getElementById('close-modal');
const analyzeBtn        = document.getElementById('analyze-btn');
const aiResultBox       = document.getElementById('ai-result-box');
const aiVerdictEl       = document.getElementById('ai-verdict');
const estSugarEl        = document.getElementById('est-sugar');
const aiReasonEl        = document.getElementById('ai-reason');
const logCommitArea     = document.getElementById('log-commit-area');
const commitLogBtn      = document.getElementById('commit-log-btn');
const inferredMealEl    = document.getElementById('inferred-meal');
const foodImageInput    = document.getElementById('food-image');
const foodTextInput     = document.getElementById('food-text');
const fileNameEl        = document.getElementById('file-name');
const resetStreakBtn    = document.getElementById('reset-streak-btn');
const exportDataBtn     = document.getElementById('export-data-btn');
const clearLogBtn       = document.getElementById('clear-log-btn');
const headerRiskValue   = document.getElementById('header-risk-value');
const toastEl           = document.getElementById('toast');

// INTEL elements
const riskScoreValue    = document.getElementById('risk-score-value');
const riskScoreLabel    = document.getElementById('risk-score-label');
const gaugeFillCircle   = document.getElementById('gauge-fill-circle');
const todaySugarBig     = document.getElementById('today-sugar-big');
const todayIntakeBar    = document.getElementById('today-intake-bar');
const todayScanCount    = document.getElementById('today-scan-count');
const weeklyChartCont   = document.getElementById('weekly-chart-container');
const vulnMapCont       = document.getElementById('vuln-map-container');
const recsCont          = document.getElementById('recommendations-container');
const offendersCont     = document.getElementById('top-offenders-container');
const foodLogCont       = document.getElementById('food-log-container');

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(r => console.log('[SW] Registered:', r.scope))
            .catch(e => console.warn('[SW] Failed:', e));
    });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type} visible`;
    setTimeout(() => toastEl.classList.remove('visible'), 3200);
}

// ── Three.js ──────────────────────────────────────────────────
function initThreeJS() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas || !window.THREE) return;

    const scene    = new THREE.Scene();
    scene.fog      = new THREE.FogExp2(0x09090e, 0.05);

    const camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 1;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const geo  = new THREE.IcosahedronGeometry(1.5, 1);
    const mat  = new THREE.MeshStandardMaterial({ color: 0x00e5ff, wireframe: true, emissive: 0x00e5ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 });
    const core = new THREE.Mesh(geo, mat);
    scene.add(core);

    const iGeo  = new THREE.IcosahedronGeometry(1.2, 0);
    const iMat  = new THREE.MeshStandardMaterial({ color: 0x09090e, roughness: 0.1, metalness: 0.8 });
    const inner = new THREE.Mesh(iGeo, iMat);
    core.add(inner);

    scene.add(new THREE.AmbientLight(0x404040));
    const pl1 = new THREE.PointLight(0xB026FF, 2, 10); pl1.position.set(-2, 2, 2); scene.add(pl1);
    const pl2 = new THREE.PointLight(0x00e5ff, 2, 10); pl2.position.set(2, -2, 2); scene.add(pl2);

    function animate() {
        requestAnimationFrame(animate);
        core.rotation.y += 0.002; core.rotation.x += 0.001;
        inner.rotation.y -= 0.001;
        core.position.y = Math.sin(Date.now() * 0.001) * 0.2 + 0.8;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// ── Navigation ────────────────────────────────────────────────
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        views.forEach(v => v.classList.toggle('active', v.id === target));
        if (target === 'intel') renderIntel();
    });
});

// ── Dashboard ─────────────────────────────────────────────────
function updateDashboard() {
    const todaySugar = PersonalAI.getTodaySugar();

    streakDaysEl.textContent   = streakData.days;
    rewardsCountEl.textContent = streakData.rewards;
    if (sugarSavedEl) sugarSavedEl.textContent = (streakData.sugarAvoided || 0) + 'g';

    // Mini sugar bar
    if (dashTodaySugar) dashTodaySugar.textContent = todaySugar.toFixed(1);
    if (dashTodayBar) {
        const pct = Math.min(100, (todaySugar / DAILY_SUGAR_LIMIT_G) * 100);
        dashTodayBar.style.width = pct + '%';
        dashTodayBar.style.background = pct > 70 ? 'var(--vibrant-orange)' : pct > 40 ? '#FFD93D' : 'var(--neon-green)';
    }

    // Status label
    if (streakStatusLabel) {
        if (streakData.days === 0)     { streakStatusLabel.textContent = 'BEGIN';    streakStatusLabel.className = 'neon-label purple'; }
        else if (streakData.days < 7)  { streakStatusLabel.textContent = 'BUILDING'; streakStatusLabel.className = 'neon-label orange'; }
        else                           { streakStatusLabel.textContent = 'OPTIMAL';  streakStatusLabel.className = 'neon-label green'; }
    }

    // AI insight
    updateAIInsight();

    // Header risk badge
    const score = PersonalAI.getRiskScore();
    const { label, color } = PersonalAI.getRiskLabel(score);
    if (headerRiskValue) { headerRiskValue.textContent = score; headerRiskValue.style.color = color; }

    // Log day button state
    const todayStr = new Date().toDateString();
    if (logDayBtn) {
        const logged = streakData.lastLogDate === todayStr;
        logDayBtn.disabled = logged;
        logDayBtn.classList.toggle('logged', logged);
        if (logDayStatus) logDayStatus.textContent = logged ? '✓ Clean day logged. Return tomorrow.' : '';
    }
}

function updateAIInsight() {
    if (!aiInsightText) return;
    const d = streakData.days;
    const msgs = [
        "No signal. Log your first clean day to begin streak analysis.",
        "Signal detected. Day 1 complete — glucose stabilizing. Stay alert.",
        "Momentum initiated. Liver glycogen beginning to regulate.",
        "3 days clean. Insulin sensitivity improving. Neural clarity incoming.",
        "1 week streak. Fat oxidation pathways activating. Excellent discipline.",
        "2 weeks clean. Dopamine receptors recovering from sugar dependency cycles.",
        "1 month elapsed. Cortisol regulation normalized. Peak efficiency mode.",
        "Legendary protocol. Metabolic system fully recalibrated."
    ];
    let idx = d >= 30 ? 6 : d >= 14 ? 5 : d >= 7 ? 4 : d >= 3 ? 3 : d >= 2 ? 2 : d >= 1 ? 1 : 0;
    aiInsightText.textContent = msgs[idx];
}

// ── Log Clean Day ─────────────────────────────────────────────
if (logDayBtn) {
    logDayBtn.addEventListener('click', () => {
        const todayStr = new Date().toDateString();
        if (streakData.lastLogDate === todayStr) { showToast('Already logged today.', 'warning'); return; }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (streakData.lastLogDate === yesterday.toDateString() || streakData.lastLogDate === null) {
            streakData.days += 1;
        } else {
            streakData.days = 1;
            showToast('Streak reset — Day 1 restart!', 'warning');
        }

        streakData.sugarAvoided = (streakData.sugarAvoided || 0) + SUGAR_PER_CLEAN_DAY_G;
        streakData.lastLogDate  = todayStr;

        if (MILESTONE_DAYS.includes(streakData.days)) {
            streakData.rewards += 1;
            showToast(`🏆 MILESTONE: ${streakData.days}-day streak!`, 'success');
        } else {
            showToast(`✓ Day ${streakData.days} logged. Keep going.`, 'success');
        }

        localStorage.setItem('sugarcut_streak', JSON.stringify(streakData));
        updateDashboard();
    });
}

// ── Image Handling ────────────────────────────────────────────
let currentImageBase64  = null;
let currentImageMimeType = null;
let lastScanResult      = null; // { food, sugar_g, reason }

if (foodImageInput) {
    foodImageInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            fileNameEl.textContent = `[${file.name.toUpperCase()}] DETECTED`;
            fileNameEl.style.color = 'var(--neon-green)';
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                currentImageBase64    = result.substring(result.indexOf(',') + 1);
                currentImageMimeType  = file.type;
            };
            reader.readAsDataURL(file);
        } else {
            resetImageState();
        }
    });
}

function resetImageState() {
    fileNameEl.textContent = 'SENSOR IDLE';
    fileNameEl.style.color = 'var(--text-muted)';
    currentImageBase64     = null;
    currentImageMimeType   = null;
}

// ── AI Food Scanner ───────────────────────────────────────────
if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        const textInput = foodTextInput.value.trim();
        if (!textInput && !currentImageBase64) { showToast('Provide an image or food description.', 'error'); return; }

        analyzeBtn.disabled    = true;
        analyzeBtn.textContent = 'SCANNING...';
        aiResultBox.style.display = 'block';
        aiVerdictEl.textContent   = 'Processing Neural Matrix...';
        aiVerdictEl.style.color   = 'var(--text-muted)';
        aiVerdictEl.classList.remove('glow-text-red');
        estSugarEl.textContent    = '--';
        if (aiReasonEl) aiReasonEl.textContent = '';
        if (logCommitArea) logCommitArea.style.display = 'none';
        lastScanResult = null;

        try {
            const aiResponse = await callBackendAPI(textInput, currentImageBase64, currentImageMimeType);
            let parsed = { sugar_g: 0, reason: '', food: textInput || 'Scanned Food' };

            try {
                const cbMatch = aiResponse.match(/```(?:json)?\n([\s\S]*?)\n```/);
                if (cbMatch) {
                    parsed = { ...parsed, ...JSON.parse(cbMatch[1]) };
                } else {
                    const i = aiResponse.indexOf('{'), j = aiResponse.lastIndexOf('}');
                    if (i !== -1 && j !== -1) {
                        parsed = { ...parsed, ...JSON.parse(aiResponse.substring(i, j + 1)) };
                    } else throw new Error('No JSON found');
                }
            } catch (_) {
                const m = aiResponse.match(/sugar.*?(\d+(\.\d+)?)/i);
                if (m) parsed.sugar_g = parseFloat(m[1]);
                else throw new Error('Unexpected response format.');
            }

            const sugar = parseFloat(parsed.sugar_g) || 0;
            lastScanResult = { food: parsed.food || textInput || 'Scanned Food', sugar_g: sugar, reason: parsed.reason || '' };

            if (sugar > 10) {
                aiVerdictEl.textContent = '🛑 TOXICITY HIGH. ABORT.';
                aiVerdictEl.style.color = 'var(--vibrant-orange)';
                aiVerdictEl.classList.add('glow-text-red');
            } else if (sugar > 0) {
                aiVerdictEl.textContent = '⚠️ CAUTION: MODERATE SUGAR.';
                aiVerdictEl.style.color = '#FFD93D';
            } else {
                aiVerdictEl.textContent = '✅ SYSTEM CLEARED. SUGAR FREE.';
                aiVerdictEl.style.color = 'var(--neon-green)';
            }

            estSugarEl.textContent = sugar;
            if (aiReasonEl && parsed.reason) aiReasonEl.textContent = parsed.reason;

            // Show commit button
            if (logCommitArea) {
                const hour = new Date().getHours();
                if (inferredMealEl) inferredMealEl.textContent = PersonalAI.inferMeal(hour);
                logCommitArea.style.display = 'block';
            }

        } catch (err) {
            console.error('[Scan Error]', err);
            aiVerdictEl.textContent = 'UPLINK ERROR: ' + err.message;
            aiVerdictEl.style.color = 'var(--vibrant-orange)';
        } finally {
            analyzeBtn.disabled    = false;
            analyzeBtn.textContent = 'EXECUTE ANALYSIS';
        }
    });
}

// ── Commit to Log ─────────────────────────────────────────────
if (commitLogBtn) {
    commitLogBtn.addEventListener('click', () => {
        if (!lastScanResult) return;

        const now  = new Date();
        const hour = now.getHours();
        const entry = {
            id:        now.getTime(),
            timestamp: now.toISOString(),
            date:      now.toDateString(),
            hour,
            food:      lastScanResult.food,
            sugar_g:   lastScanResult.sugar_g,
            reason:    lastScanResult.reason,
            meal:      PersonalAI.inferMeal(hour),
            verdict:   lastScanResult.sugar_g > 10 ? 'HIGH' : lastScanResult.sugar_g > 0 ? 'MODERATE' : 'CLEAN'
        };

        PersonalAI.addEntry(entry);
        logCommitArea.style.display = 'none';
        commitLogBtn.textContent = '✓ COMMITTED';

        showToast(`⊕ Logged: ${entry.food} (${entry.sugar_g}g sugar)`, 'success');
        updateDashboard();

        setTimeout(() => {
            if (commitLogBtn) commitLogBtn.innerHTML = '<span>⊕ COMMIT TO PERSONAL LOG</span>';
        }, 2000);
    });
}

// ── API Proxy ─────────────────────────────────────────────────
async function callBackendAPI(textContext, base64Image, mimeType) {
    const parts = [{
        text: `You are a hardcore sugar elimination coach specializing in Indian (Chennai) cuisine.
The user is completely cutting out sugar.
Analyze the food described and/or shown: "${textContext}".
Estimate total sugar content (added + natural, in grams).
Also name the food if not specified.
Return ONLY this exact JSON (no extra text): {"food": "<name>", "sugar_g": <number>, "reason": "<one sentence explanation>"}`
    }];

    if (base64Image) {
        parts.push({ inline_data: { mime_type: mimeType, data: base64Image } });
    }

    const response = await fetch('/api/gemini', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1 } })
    });

    if (!response.ok) {
        let errStr = 'Proxy Server Failed';
        try {
            const d = await response.json();
            errStr = (d.error && d.error.message) ? d.error.message : (typeof d.error === 'string' ? d.error : JSON.stringify(d.error));
        } catch (_) {}
        throw new Error(errStr);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// ── INTEL Rendering ───────────────────────────────────────────
function renderIntel() {
    renderRiskGauge();
    renderTodayIntake();
    renderWeeklyChart();
    renderVulnerabilityMap();
    renderRecommendations();
    renderTopOffenders();
    renderFoodLog();
}

function renderRiskGauge() {
    const score = PersonalAI.getRiskScore();
    const { label, color } = PersonalAI.getRiskLabel(score);

    if (riskScoreValue) { riskScoreValue.textContent = score; riskScoreValue.style.color = color; }
    if (riskScoreLabel) { riskScoreLabel.textContent = label; riskScoreLabel.style.color = color; }

    if (gaugeFillCircle) {
        const circumference = 2 * Math.PI * 50; // r=50 → C≈314
        const offset = circumference - (score / 100) * circumference;
        gaugeFillCircle.style.strokeDashoffset = offset;
        gaugeFillCircle.style.stroke = color;
    }

    // Update header badge
    if (headerRiskValue) { headerRiskValue.textContent = score; headerRiskValue.style.color = color; }
}

function renderTodayIntake() {
    const sugar = PersonalAI.getTodaySugar();
    const count = PersonalAI.getTodayEntries().length;
    const pct   = Math.min(100, (sugar / DAILY_SUGAR_LIMIT_G) * 100);
    const color = pct > 70 ? 'var(--vibrant-orange)' : pct > 40 ? '#FFD93D' : 'var(--neon-green)';

    if (todaySugarBig) todaySugarBig.innerHTML = `${sugar.toFixed(1)}<span class="intake-unit">g</span>`;
    if (todayIntakeBar) { todayIntakeBar.style.width = pct + '%'; todayIntakeBar.style.background = color; }
    if (todayScanCount) todayScanCount.textContent = count;
}

function renderWeeklyChart() {
    if (!weeklyChartCont) return;
    const days = PersonalAI.getLast7Days();
    const maxVal = Math.max(...days.map(d => d.total), DAILY_SUGAR_LIMIT_G, 1);

    const hasData = days.some(d => d.total > 0);
    if (!hasData) {
        weeklyChartCont.innerHTML = '<p class="empty-intel-msg">No data yet. Start scanning food to build your trend.</p>';
        return;
    }

    weeklyChartCont.innerHTML = `
        <div class="chart-bars">
            ${days.map(d => {
                const pct   = (d.total / maxVal) * 100;
                const color = d.total > 35 ? '#FF6A00' : d.total > 15 ? '#FFD93D' : d.total > 0 ? '#00e5ff' : '#1e1e2e';
                const isToday = d.date.toDateString() === new Date().toDateString();
                return `<div class="chart-bar-col">
                    <div class="chart-bar-val">${d.total > 0 ? d.total + 'g' : ''}</div>
                    <div class="chart-bar-wrap">
                        <div class="chart-bar" style="height:${pct}%;background:${color};${isToday ? 'opacity:1;' : 'opacity:0.7;'}"></div>
                        ${isToday ? '<div class="chart-bar-limit" style="bottom:' + ((DAILY_SUGAR_LIMIT_G/maxVal)*100) + '%"></div>' : ''}
                    </div>
                    <div class="chart-bar-label ${isToday ? 'today-label-active' : ''}">${d.label}</div>
                </div>`;
            }).join('')}
        </div>
        <div class="chart-legend">
            <span class="legend-dot" style="background:#FF6A00"></span><span>High (&gt;35g)</span>
            <span class="legend-dot" style="background:#FFD93D"></span><span>Moderate</span>
            <span class="legend-dot" style="background:#00e5ff"></span><span>Clean</span>
        </div>`;
}

function renderVulnerabilityMap() {
    if (!vulnMapCont) return;
    const vulnMap = PersonalAI.getVulnerabilityWindows();
    const totalEntries = PersonalAI.getLog().length;

    if (totalEntries < 3) {
        vulnMapCont.innerHTML = '<p class="empty-intel-msg">Scan at least 3 foods to activate window analysis.</p>';
        return;
    }

    const allVals    = Object.values(vulnMap);
    const maxSugar   = allVals.length ? Math.max(...allVals, 1) : 1;
    const hours      = Array.from({ length: 17 }, (_, i) => i + 6); // 6am–10pm

    vulnMapCont.innerHTML = `
        <div class="vuln-grid">
            ${hours.map(h => {
                const sugar  = vulnMap[h] || 0;
                const pct    = sugar / maxSugar;
                const color  = pct > 0.7 ? '#FF6A00' : pct > 0.4 ? '#FFD93D' : pct > 0.1 ? '#00e5ff' : 'rgba(255,255,255,0.06)';
                const ampm   = h >= 12 ? 'P' : 'A';
                const h12    = h > 12 ? h - 12 : (h === 0 ? 12 : h);
                const label  = `${h12}${ampm}`;
                const isNow  = new Date().getHours() === h;
                return `<div class="vuln-hour ${isNow ? 'vuln-hour-now' : ''}" title="${h12}:00 ${h >= 12 ? 'PM' : 'AM'} — ${sugar.toFixed(1)}g historical">
                    <div class="vuln-bar" style="background:${color};opacity:${0.15 + pct * 0.85}"></div>
                    <span class="vuln-label">${label}</span>
                </div>`;
            }).join('')}
        </div>
        <p class="vuln-legend">Block intensity = historical sugar accumulation. Red = danger zone.</p>`;
}

function renderRecommendations() {
    if (!recsCont) return;
    const recs = PersonalAI.getRecommendations();
    recsCont.innerHTML = recs.map(r => `
        <div class="rec-card glass-panel">
            <div class="rec-icon">${r.icon}</div>
            <div class="rec-body">
                <h3 class="rec-title">${r.title}</h3>
                <p class="rec-text">${r.text}</p>
            </div>
        </div>`).join('');
}

function renderTopOffenders() {
    if (!offendersCont) return;
    const offenders = PersonalAI.getTopOffenders();

    if (offenders.length === 0) {
        offendersCont.innerHTML = '<p class="empty-intel-msg">No offenders detected yet.</p>';
        return;
    }

    const maxTotal = offenders[0].total;
    offendersCont.innerHTML = offenders.map((f, i) => {
        const pct = (f.total / maxTotal) * 100;
        const color = i === 0 ? 'var(--vibrant-orange)' : i === 1 ? '#FFD93D' : 'var(--cyan)';
        return `<div class="offender-row">
            <div class="offender-rank">#${i + 1}</div>
            <div class="offender-info">
                <div class="offender-name">${f.name}</div>
                <div class="offender-bar-track">
                    <div class="offender-bar" style="width:${pct}%;background:${color}"></div>
                </div>
            </div>
            <div class="offender-meta">
                <span class="offender-total" style="color:${color}">${f.total}g</span>
                <span class="offender-count">${f.count}x</span>
            </div>
        </div>`;
    }).join('');
}

function renderFoodLog() {
    if (!foodLogCont) return;
    const log = PersonalAI.getLog();

    if (log.length === 0) {
        foodLogCont.innerHTML = '<p class="empty-intel-msg">No entries logged yet. Scan food and commit it to your log.</p>';
        return;
    }

    foodLogCont.innerHTML = log.slice(0, 50).map(e => {
        const d     = new Date(e.timestamp);
        const time  = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const date  = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const color = e.verdict === 'HIGH' ? 'var(--vibrant-orange)' : e.verdict === 'MODERATE' ? '#FFD93D' : 'var(--neon-green)';
        return `<div class="log-entry" data-id="${e.id}">
            <div class="log-entry-left">
                <span class="log-verdict-dot" style="background:${color}"></span>
                <div>
                    <p class="log-food-name">${e.food}</p>
                    <p class="log-meta">${e.meal} · ${date} ${time}</p>
                </div>
            </div>
            <div class="log-entry-right">
                <span class="log-sugar" style="color:${color}">${e.sugar_g}g</span>
                <button class="log-delete-btn" data-id="${e.id}" aria-label="Delete entry">✕</button>
            </div>
        </div>`;
    }).join('');

    // Wire delete buttons
    foodLogCont.querySelectorAll('.log-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id  = parseInt(btn.getAttribute('data-id'));
            const log = PersonalAI.getLog().filter(e => e.id !== id);
            PersonalAI.saveLog(log);
            renderIntel();
            updateDashboard();
            showToast('Entry deleted.', 'warning');
        });
    });
}

// ── Settings Actions ──────────────────────────────────────────
if (resetStreakBtn) {
    resetStreakBtn.addEventListener('click', () => {
        if (!confirm('Reset all streak data? This cannot be undone.')) return;
        streakData = { days: 0, rewards: 0, sugarAvoided: 0, lastLogDate: null };
        localStorage.setItem('sugarcut_streak', JSON.stringify(streakData));
        updateDashboard();
        showToast('Streak data reset.', 'warning');
    });
}

if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
        if (!confirm('Clear entire food log? This removes all AI training data.')) return;
        PersonalAI.saveLog([]);
        renderFoodLog();
        renderIntel();
        updateDashboard();
        showToast('Food log cleared.', 'warning');
    });
}

if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
        const payload = {
            exportedAt:  new Date().toISOString(),
            streakData,
            foodLog:     PersonalAI.getLog()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `sugarcut_export_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully.', 'success');
    });
}

// ── Routines & Geo-fence ──────────────────────────────────────
function checkRoutines() {
    const now   = new Date();
    const hours = now.getHours();
    const mins  = now.getMinutes();

    if (routineAlert) routineAlert.style.display = (hours === 18 && mins < 30) ? 'flex' : 'none';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            ({ coords: { latitude: lat, longitude: lng } }) => {
                const dist = calcDistance(lat, lng, ANNA_NAGAR_LAT, ANNA_NAGAR_LNG);
                if (dist < RADIUS_KM && !sessionStorage.getItem('anna_nagar_warned')) {
                    if (modalOverlay) modalOverlay.classList.add('active');
                    sessionStorage.setItem('anna_nagar_warned', 'true');
                }
            },
            err => console.info('[Geo] Unavailable:', err.message),
            { timeout: 8000, maximumAge: 60000 }
        );
    }
}

function calcDistance(lat1, lon1, lat2, lon2) {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

if (closeModalBtn) closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
if (modalOverlay)  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });

// ── Init ──────────────────────────────────────────────────────
function init() {
    updateDashboard();
    checkRoutines();
    setInterval(checkRoutines, 60000);
    initThreeJS();
}

init();
