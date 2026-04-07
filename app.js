// SugarCut PWA - Core Logic
// --- State Management & Constants ---

const ANNA_NAGAR_LAT = 13.0827;
const ANNA_NAGAR_LNG = 80.2118;
const RADIUS_KM = 3;

// Average sugar per clean day avoided (grams) — approximate daily sugar-heavy diet baseline
const SUGAR_AVOIDED_PER_DAY_G = 35;

// Milestone thresholds (streak days)
const MILESTONE_DAYS = [1, 3, 7, 14, 30, 60, 90];

// Load persisted streak data
let streakData = JSON.parse(localStorage.getItem('sugarcut_streak')) || {
    days: 0,
    rewards: 0,
    sugarAvoided: 0,
    lastLogDate: null
};

// --- DOM Elements ---
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

// Dashboard UI
const streakDaysEl = document.getElementById('streak-days');
const rewardsCountEl = document.getElementById('rewards-count');
const sugarSavedEl = document.getElementById('sugar-saved');
const streakStatusLabel = document.getElementById('streak-status-label');
const aiInsightText = document.getElementById('ai-insight-text');

// Log Day UI
const logDayBtn = document.getElementById('log-day-btn');
const logDayStatus = document.getElementById('log-day-status');

// Routines UI
const routineAlert = document.getElementById('routine-alert');
const modalOverlay = document.getElementById('overlay-modal');
const closeModalBtn = document.getElementById('close-modal');

// AI UI
const analyzeBtn = document.getElementById('analyze-btn');
const aiResultBox = document.getElementById('ai-result-box');
const aiVerdictEl = document.getElementById('ai-verdict');
const estSugarEl = document.getElementById('est-sugar');
const aiReasonEl = document.getElementById('ai-reason');
const foodImageInput = document.getElementById('food-image');
const foodTextInput = document.getElementById('food-text');
const fileNameEl = document.getElementById('file-name');

// Settings
const resetStreakBtn = document.getElementById('reset-streak-btn');

// Toast
const toastEl = document.getElementById('toast');

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('[SW] Registered:', reg.scope))
            .catch((err) => console.warn('[SW] Registration failed:', err));
    });
}

// --- Toast Helper ---
function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type} visible`;
    setTimeout(() => {
        toastEl.classList.remove('visible');
    }, 3000);
}

// --- Three.js Luxury Setup ---
function initThreeJS() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas || !window.THREE) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x09090e, 0.05);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 1;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Wireframe Icosahedron Core
    const geometry = new THREE.IcosahedronGeometry(1.5, 1);
    const material = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        wireframe: true,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });
    const coreMesh = new THREE.Mesh(geometry, material);
    scene.add(coreMesh);

    // Inner Solid Core
    const innerGeo = new THREE.IcosahedronGeometry(1.2, 0);
    const innerMat = new THREE.MeshStandardMaterial({
        color: 0x09090e,
        roughness: 0.1,
        metalness: 0.8
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreMesh.add(innerMesh);

    // Lighting
    scene.add(new THREE.AmbientLight(0x404040));

    const pointLight1 = new THREE.PointLight(0xB026FF, 2, 10);
    pointLight1.position.set(-2, 2, 2);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x00e5ff, 2, 10);
    pointLight2.position.set(2, -2, 2);
    scene.add(pointLight2);

    function animate() {
        requestAnimationFrame(animate);
        coreMesh.rotation.y += 0.002;
        coreMesh.rotation.x += 0.001;
        innerMesh.rotation.y -= 0.001;
        coreMesh.position.y = Math.sin(Date.now() * 0.001) * 0.2 + 0.8;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// --- Navigation ---
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        views.forEach(v => {
            v.classList.toggle('active', v.id === target);
        });
    });
});

// --- Dashboard Logic ---
function updateDashboard() {
    streakDaysEl.textContent = streakData.days;
    rewardsCountEl.textContent = streakData.rewards;
    if (sugarSavedEl) sugarSavedEl.textContent = (streakData.sugarAvoided || 0) + 'g';

    // Dynamic status label
    if (streakStatusLabel) {
        if (streakData.days === 0) {
            streakStatusLabel.textContent = 'BEGIN';
            streakStatusLabel.className = 'neon-label purple';
        } else if (streakData.days < 7) {
            streakStatusLabel.textContent = 'BUILDING';
            streakStatusLabel.className = 'neon-label orange';
        } else {
            streakStatusLabel.textContent = 'OPTIMAL';
            streakStatusLabel.className = 'neon-label green';
        }
    }

    // Dynamic AI insight
    updateAIInsight();

    // Check if already logged today
    const todayStr = new Date().toDateString();
    if (logDayBtn) {
        const alreadyLogged = streakData.lastLogDate === todayStr;
        logDayBtn.disabled = alreadyLogged;
        logDayBtn.classList.toggle('logged', alreadyLogged);
        if (logDayStatus) {
            logDayStatus.textContent = alreadyLogged
                ? '✓ Clean day logged for today. Return tomorrow.'
                : '';
        }
    }
}

function updateAIInsight() {
    if (!aiInsightText) return;
    const days = streakData.days;
    const messages = [
        "Awaiting telemetry. Log your first clean day to begin streak analysis.",
        "Signal detected. Day 1 complete — glucose levels stabilizing. Stay alert.",
        "Momentum building. Liver glycogen stores beginning to regulate.",
        "3 days clean. Insulin sensitivity improving. Neural clarity incoming.",
        "1 week streak. Fat oxidation pathways are activating. Excellent discipline.",
        "2 weeks clean. Dopamine receptors recovering from sugar dependency.",
        "1 month. Cortisol regulation normalized. You are operating at peak efficiency.",
        "Legendary protocol. Your metabolic system has been fully recalibrated."
    ];

    let idx = 0;
    if (days >= 30) idx = 6;
    else if (days >= 14) idx = 5;
    else if (days >= 7) idx = 4;
    else if (days >= 3) idx = 3;
    else if (days >= 2) idx = 2;
    else if (days >= 1) idx = 1;

    aiInsightText.textContent = messages[idx];
}

// --- Log Clean Day ---
if (logDayBtn) {
    logDayBtn.addEventListener('click', () => {
        const todayStr = new Date().toDateString();

        if (streakData.lastLogDate === todayStr) {
            showToast('Already logged today. Return tomorrow.', 'warning');
            return;
        }

        // Check if yesterday was logged (maintain streak continuity)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (streakData.lastLogDate === yesterdayStr || streakData.lastLogDate === null) {
            streakData.days += 1;
        } else {
            // Streak broken — reset to 1
            streakData.days = 1;
            showToast('Streak reset. Starting fresh — Day 1!', 'warning');
        }

        streakData.sugarAvoided += SUGAR_AVOIDED_PER_DAY_G;
        streakData.lastLogDate = todayStr;

        // Check milestones
        if (MILESTONE_DAYS.includes(streakData.days)) {
            streakData.rewards += 1;
            showToast(`🏆 MILESTONE UNLOCKED: ${streakData.days}-day streak!`, 'success');
        } else {
            showToast(`✓ Day ${streakData.days} logged. Keep pushing.`, 'success');
        }

        localStorage.setItem('sugarcut_streak', JSON.stringify(streakData));
        updateDashboard();
    });
}

// --- Reset Streak ---
if (resetStreakBtn) {
    resetStreakBtn.addEventListener('click', () => {
        if (!confirm('Reset all streak data? This cannot be undone.')) return;
        streakData = { days: 0, rewards: 0, sugarAvoided: 0, lastLogDate: null };
        localStorage.setItem('sugarcut_streak', JSON.stringify(streakData));
        updateDashboard();
        showToast('Streak data reset.', 'warning');
    });
}

// --- Image Handling ---
let currentImageBase64 = null;
let currentImageMimeType = null;

if (foodImageInput) {
    foodImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameEl.textContent = `[${file.name.toUpperCase()}] DETECTED`;
            fileNameEl.style.color = 'var(--neon-green)';
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                const commaIdx = result.indexOf(',');
                currentImageBase64 = result.substring(commaIdx + 1);
                currentImageMimeType = file.type;
            };
            reader.readAsDataURL(file);
        } else {
            fileNameEl.textContent = 'SENSOR IDLE';
            fileNameEl.style.color = 'var(--text-muted)';
            currentImageBase64 = null;
            currentImageMimeType = null;
        }
    });
}

// --- AI Analyzer Logic ---
if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        const textInput = foodTextInput.value.trim();
        if (!textInput && !currentImageBase64) {
            showToast('UPLINK FAILED: Provide an image or text input.', 'error');
            return;
        }

        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'PROCESSING...';
        aiResultBox.style.display = 'block';
        aiVerdictEl.textContent = 'Processing Neural Matrix...';
        aiVerdictEl.style.color = 'var(--text-muted)';
        aiVerdictEl.classList.remove('glow-text-red');
        estSugarEl.textContent = '--';
        if (aiReasonEl) aiReasonEl.textContent = '';

        try {
            const aiResponse = await callBackendAPI(textInput, currentImageBase64, currentImageMimeType);

            let parsed = { sugar_g: 0, reason: '' };
            try {
                const codeBlockMatch = aiResponse.match(/```(?:json)?\n([\s\S]*?)\n```/);
                if (codeBlockMatch) {
                    parsed = JSON.parse(codeBlockMatch[1]);
                } else {
                    const firstBrace = aiResponse.indexOf('{');
                    const lastBrace = aiResponse.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1) {
                        parsed = JSON.parse(aiResponse.substring(firstBrace, lastBrace + 1));
                    } else {
                        throw new Error('No JSON boundaries found');
                    }
                }
            } catch (e) {
                const sugarMatch = aiResponse.match(/sugar.*?(\d+(\.\d+)?)/i);
                if (sugarMatch) {
                    parsed.sugar_g = parseFloat(sugarMatch[1]);
                } else {
                    throw new Error('Unexpected neural format.');
                }
            }

            const sugar = parsed.sugar_g || 0;

            if (sugar > 10) {
                aiVerdictEl.textContent = '🛑 TOXICITY HIGH. ABORT.';
                aiVerdictEl.style.color = 'var(--vibrant-orange)';
                aiVerdictEl.classList.add('glow-text-red');
            } else if (sugar > 0) {
                aiVerdictEl.textContent = '⚠️ CAUTION: MODERATE TOXICITY.';
                aiVerdictEl.style.color = 'var(--vibrant-orange)';
            } else {
                aiVerdictEl.textContent = '✅ SYSTEM CLEARED. SUGAR FREE.';
                aiVerdictEl.style.color = 'var(--neon-green)';
            }

            estSugarEl.textContent = sugar;
            if (aiReasonEl && parsed.reason) {
                aiReasonEl.textContent = parsed.reason;
            }

        } catch (err) {
            console.error('[AI Error]', err);
            aiVerdictEl.textContent = 'UPLINK ERROR: ' + err.message;
            aiVerdictEl.style.color = 'var(--vibrant-orange)';
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'EXECUTE ANALYSIS';
        }
    });
}

// --- Backend API Proxy ---
async function callBackendAPI(textContext, base64Image, mimeType) {
    const parts = [
        {
            text: `You are an extremely strict, hardcore diet coach specialized in Indian (specifically Chennai) cuisine.
            Your user is completely cutting out sugar.
            Analyze the provided image and/or text context: "${textContext}".
            Calculate or strictly estimate the added and natural sugar content in grams.
            Return ONLY a valid JSON object matching exactly this format: {"sugar_g": <number>, "reason": "<string>"}`
        }
    ];

    if (base64Image) {
        parts.push({
            inline_data: {
                mime_type: mimeType,
                data: base64Image
            }
        });
    }

    const payload = {
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.1 }
    };

    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errStr = 'Proxy Server Failed';
        try {
            const errData = await response.json();
            errStr = (errData.error && errData.error.message)
                ? errData.error.message
                : (typeof errData.error === 'string' ? errData.error : JSON.stringify(errData.error));
        } catch (_) {}
        throw new Error(errStr);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// --- Timers & Location Watcher ---
function checkRoutines() {
    const now = new Date();
    const hours = now.getHours();
    const mins = now.getMinutes();

    if (routineAlert) {
        routineAlert.style.display = (hours === 18 && mins < 30) ? 'flex' : 'none';
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude: lat, longitude: lng } = position.coords;
                const distance = calculateDistance(lat, lng, ANNA_NAGAR_LAT, ANNA_NAGAR_LNG);
                if (distance < RADIUS_KM && !sessionStorage.getItem('anna_nagar_warned')) {
                    if (modalOverlay) modalOverlay.classList.add('active');
                    sessionStorage.setItem('anna_nagar_warned', 'true');
                }
            },
            (err) => {
                // Geolocation denied or unavailable — silently skip geo-fence check
                console.info('[Geo] Location unavailable:', err.message);
            },
            { timeout: 8000, maximumAge: 60000 }
        );
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
}

// Close modal on backdrop click
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });
}

// --- Init ---
function init() {
    updateDashboard();
    checkRoutines();
    setInterval(checkRoutines, 60000);
    initThreeJS();
}

init();
