import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';

const NOTE_FREQUENCIES = {
    C:  [16.35, 32.70, 65.41, 130.81, 261.63, 523.25, 1046.50, 2093.00, 4186.01],
    'C#': [17.32, 34.65, 69.30, 138.59, 277.18, 554.37, 1108.73, 2217.46, 4434.92],
    D:  [18.35, 36.71, 73.42, 146.83, 293.66, 587.33, 1174.66, 2349.32, 4698.63],
    'D#': [19.45, 38.89, 77.78, 155.56, 311.13, 622.25, 1244.51, 2489.02, 4978.03],
    E:  [20.60, 41.20, 82.41, 164.81, 329.63, 659.25, 1318.51, 2637.02, 5274.04],
    F:  [21.83, 43.65, 87.31, 174.61, 349.23, 698.46, 1396.91, 2793.83, 5587.65],
    'F#': [23.12, 46.25, 92.50, 185.00, 369.99, 739.99, 1479.98, 2959.96, 5919.91],
    G:  [24.50, 49.00, 98.00, 196.00, 392.00, 783.99, 1567.98, 3135.96, 6271.93],
    'G#': [25.96, 51.91, 103.83, 207.65, 415.30, 830.61, 1661.22, 3322.44, 6644.88],
    A:  [27.50, 55.00, 110.00, 220.00, 440.00, 880.00, 1760.00, 3520.00, 7040.00],
    'A#': [29.14, 58.27, 116.54, 233.08, 466.16, 932.33, 1864.66, 3729.31, 7458.62],
    B:  [30.87, 61.74, 123.47, 246.94, 493.88, 987.77, 1975.53, 3951.07, 7902.13],
};

function frequencyFromNote(note, octave) {
    return NOTE_FREQUENCIES[note][octave];
}

const params = {
    frequency: 440,
    oscillatorType: 'sine',
    useFilter: false,
    filterType: 'lowpass',
    filterFrequency: 1000,
    filterQ: 5,
    gain: 0.3,
    duration: 0.2,
    sustainOnPress: false,
};

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
analyser.smoothingTimeConstant = 0.75;
analyser.connect(audioContext.destination);

const freqData = new Uint8Array(analyser.frequencyBinCount);
const BAR_COUNT = 32;
const VIZ_PIXEL = 4;
const VIZ_PIXEL_GAP = 1;
const VIZ_BAR_GAP = 2;
const VIZ_BLOCKS_PER_BAR = 2;

const vizCanvas = document.getElementById('viz');
const vizCtx = vizCanvas.getContext('2d');
vizCtx.imageSmoothingEnabled = false;
let vizActive = false;
let vizEndTime = 0;
let sustainVizCount = 0;
let idlePhase = 0;
const activeVoices = new Map();
const RELEASE_SEC = 0.05;

function resizeViz() {
    const dpr = window.devicePixelRatio || 1;
    const rect = vizCanvas.getBoundingClientRect();
    vizCanvas.width = rect.width * dpr;
    vizCanvas.height = rect.height * dpr;
    vizCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vizCtx.imageSmoothingEnabled = false;
}

function getVizGrid(w, h) {
    const cell = VIZ_PIXEL + VIZ_PIXEL_GAP;
    const rows = Math.max(1, Math.floor((h + VIZ_PIXEL_GAP) / cell));
    const barWidth = VIZ_BLOCKS_PER_BAR * VIZ_PIXEL + (VIZ_BLOCKS_PER_BAR - 1) * VIZ_PIXEL_GAP;
    const barStride = barWidth + VIZ_BAR_GAP;
    const gridW = BAR_COUNT * barStride - VIZ_BAR_GAP;
    const gridH = rows * VIZ_PIXEL + (rows - 1) * VIZ_PIXEL_GAP;

    return {
        rows,
        originX: (w - gridW) / 2,
        originY: (h - gridH) / 2,
        barWidth,
        barStride,
    };
}

function drawPixelBlock(x, y, color) {
    vizCtx.fillStyle = color;
    vizCtx.fillRect(x, y, VIZ_PIXEL, VIZ_PIXEL);
}

function drawPixelBar(grid, barIndex, litRows, color) {
    const { rows, originX, originY, barWidth, barStride } = grid;
    const blocks = Math.max(1, Math.min(rows, Math.round(litRows)));
    const barX = originX + barIndex * barStride;
    const stackH = blocks * VIZ_PIXEL + (blocks - 1) * VIZ_PIXEL_GAP;
    const stackY = originY + (rows * VIZ_PIXEL + (rows - 1) * VIZ_PIXEL_GAP - stackH) / 2;
    const cell = VIZ_PIXEL + VIZ_PIXEL_GAP;

    for (let row = 0; row < blocks; row++) {
        const y = stackY + (blocks - 1 - row) * cell;
        for (let col = 0; col < VIZ_BLOCKS_PER_BAR; col++) {
            const x = barX + col * cell;
            drawPixelBlock(x, y, color);
        }
    }
}

function drawViz() {
    const w = vizCanvas.clientWidth;
    const h = vizCanvas.clientHeight;
    const grid = getVizGrid(w, h);
    const playing = vizActive && (sustainVizCount > 0 || performance.now() < vizEndTime);

    vizCtx.clearRect(0, 0, w, h);

    if (playing) {
        analyser.getByteFrequencyData(freqData);
        const step = Math.floor(freqData.length / BAR_COUNT);

        for (let i = 0; i < BAR_COUNT; i++) {
            const value = freqData[i * step] / 255;
            const litRows = 1 + value * (grid.rows - 1) * 0.92;
            const alpha = 0.45 + value * 0.55;
            drawPixelBar(grid, i, litRows, `rgba(255, 213, 99, ${alpha})`);
        }
    } else {
        if (vizActive && sustainVizCount === 0 && performance.now() >= vizEndTime) {
            vizActive = false;
        }

        idlePhase += 0.04;
        for (let i = 0; i < BAR_COUNT; i++) {
            const wave = (Math.sin(idlePhase + i * 0.35) + 1) / 2;
            const litRows = 1 + wave * 2;
            drawPixelBar(grid, i, litRows, 'rgba(255, 213, 99, 0.18)');
        }
    }

    requestAnimationFrame(drawViz);
}

function startVisualization(durationSec) {
    vizActive = true;
    vizEndTime = performance.now() + durationSec * 1000;
}

function createVoice(context, settings) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = settings.oscillatorType;
    oscillator.frequency.value = settings.frequency;

    let filter = null;
    if (settings.useFilter) {
        filter = context.createBiquadFilter();
        filter.type = settings.filterType;
        filter.frequency.value = settings.filterFrequency;
        filter.Q.value = settings.filterQ;
        oscillator.connect(filter);
        filter.connect(gainNode);
    } else {
        oscillator.connect(gainNode);
    }

    gainNode.connect(analyser);
    return { oscillator, gainNode, filter };
}

function releaseVoice(context, voice) {
    const now = context.currentTime;
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.001, now + RELEASE_SEC);
    voice.oscillator.stop(now + RELEASE_SEC);
}

function playSound(context, settings) {
    const now = context.currentTime;
    const voice = createVoice(context, settings);

    voice.gainNode.gain.setValueAtTime(settings.gain, now);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
    voice.oscillator.start(now);
    voice.oscillator.stop(now + settings.duration);
    startVisualization(settings.duration);
}

function startSustainedSound(context, settings, voiceId) {
    stopSustainedSound(voiceId);

    const now = context.currentTime;
    const voice = createVoice(context, settings);

    voice.gainNode.gain.setValueAtTime(settings.gain, now);
    voice.oscillator.start(now);

    activeVoices.set(voiceId, voice);
    sustainVizCount++;
    vizActive = true;

    return voice;
}

function stopSustainedSound(voiceId) {
    const voice = activeVoices.get(voiceId);
    if (!voice) return;

    activeVoices.delete(voiceId);
    releaseVoice(audioContext, voice);
    sustainVizCount = Math.max(0, sustainVizCount - 1);
}

function stopAllSustainedSounds() {
    [...activeVoices.keys()].forEach(stopSustainedSound);
}

async function ensureAudioRunning() {
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}

const KEY_TO_NOTE = {
    s: 'C', d: 'D', f: 'E', g: 'F', h: 'G', j: 'A', k: 'B',
    e: 'C#', r: 'D#', y: 'F#', u: 'G#', i: 'A#',
};

const keyToButton = Object.fromEntries(
    [...document.querySelectorAll('.piano-key')].map((btn) => [btn.dataset.key, btn]),
);

const lastNoteDisplay = document.getElementById('last-note-display');
const octaveDisplay = document.getElementById('octave-display');
const octaveSlider = document.getElementById('octave-slider');
const noteExportBtn = document.getElementById('note-export-btn');

let lastNote = null;
let octave = 4;

function updateOctaveDisplay() {
    octaveDisplay.textContent = String(octave);
    const fill = (octave / 8) * 100;
    octaveSlider.style.setProperty('--slider-fill', `${fill}%`);
}

function updateLastNoteDisplay(note) {
    lastNote = note;
    lastNoteDisplay.textContent = note;
}

function setKeyPressed(key, pressed) {
    const btn = keyToButton[key];
    if (btn) btn.classList.toggle('pressed', pressed);
}

function playNote(note) {
    updateLastNoteDisplay(note);
    const settings = {
        ...params,
        frequency: frequencyFromNote(note, octave),
    };
    playSound(audioContext, settings);
}

function startNote(note) {
    updateLastNoteDisplay(note);
    const settings = {
        ...params,
        frequency: frequencyFromNote(note, octave),
    };
    startSustainedSound(audioContext, settings, `note:${note}`);
}

function stopNote(note) {
    stopSustainedSound(`note:${note}`);
}

async function triggerNote(note) {
    await ensureAudioRunning();
    if (params.sustainOnPress) {
        startNote(note);
    } else {
        playNote(note);
    }
}

async function releaseNote(note) {
    if (params.sustainOnPress) {
        stopNote(note);
    }
}

document.querySelectorAll('.piano-key').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        triggerNote(btn.dataset.note);
    });
    btn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        releaseNote(btn.dataset.note);
    });
    btn.addEventListener('mouseleave', () => {
        releaseNote(btn.dataset.note);
    });
});

function isTextEntryControl(element) {
    if (!element) return false;
    if (element.isContentEditable) return true;
    const tag = element.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;

    const type = element.type;
    return type !== 'range' && type !== 'checkbox' && type !== 'radio'
        && type !== 'button' && type !== 'submit' && type !== 'reset';
}

function isRangeControl(element) {
    return element?.tagName === 'INPUT' && element.type === 'range';
}

function shouldReleaseFocusOnChange(element) {
    if (!element) return false;
    if (isRangeControl(element)) return true;
    if (element.tagName === 'SELECT') return true;
    if (element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) {
        return true;
    }
    return false;
}

function releaseControlFocus(container) {
    requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active && container.contains(active)) {
            active.blur();
        }
    });
}

function setupControlFocusRelease(container) {
    container.addEventListener('pointerup', () => {
        const active = document.activeElement;
        if (isRangeControl(active) && container.contains(active)) {
            releaseControlFocus(container);
        }
    });
    container.addEventListener('change', (e) => {
        if (container.contains(e.target) && shouldReleaseFocusOnChange(e.target)) {
            releaseControlFocus(container);
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (isTextEntryControl(e.target)) return;

    const note = KEY_TO_NOTE[e.key];
    if (!note) return;

    e.preventDefault();
    setKeyPressed(e.key, true);
    triggerNote(note);
});

document.addEventListener('keyup', (e) => {
    const note = KEY_TO_NOTE[e.key];
    if (note) {
        setKeyPressed(e.key, false);
        releaseNote(note);
    }
});

window.addEventListener('blur', () => {
    document.querySelectorAll('.piano-key.pressed').forEach((btn) => {
        btn.classList.remove('pressed');
    });
    stopAllSustainedSounds();
});

octaveSlider.addEventListener('input', () => {
    octave = Number(octaveSlider.value);
    updateOctaveDisplay();
});

noteExportBtn.addEventListener('click', async () => {
    if (!lastNote) return;

    const exportSettings = {
        ...params,
        note: lastNote,
        octave,
        frequency: frequencyFromNote(lastNote, octave),
    };
    await navigator.clipboard.writeText(JSON.stringify(exportSettings, null, 2));
    alert('Settings copied to clipboard');
});

updateOctaveDisplay();

const pane = new Pane({ title: 'Sound Tweak', container: document.getElementById('pane-root') });

pane.addBinding(params, 'frequency', {
    min: 20,
    max: 4000,
    step: 1,
    label: 'frequency',
});

pane.addBinding(params, 'oscillatorType', {
    label: 'type',
    options: {
        sine: 'sine',
        square: 'square',
        triangle: 'triangle',
        sawtooth: 'sawtooth',
    },
});
pane.addBinding(params, 'gain', { min: 0, max: 1, step: 0.01 });
pane.addBinding(params, 'duration', { min: 0.01, max: 2, step: 0.01, label: 'duration' });
pane.addBinding(params, 'sustainOnPress', { label: 'sustain on press' });

const filterFolder = pane.addFolder({ title: 'Filter', expanded: true });
const useFilterBinding = filterFolder.addBinding(params, 'useFilter', { label: 'enabled' });
const filterTypeBinding = filterFolder.addBinding(params, 'filterType', {
    label: 'type',
    options: {
        lowpass: 'lowpass',
        bandpass: 'bandpass',
        highpass: 'highpass',
    },
});
const filterFrequencyBinding = filterFolder.addBinding(params, 'filterFrequency', {
    min: 20,
    max: 20000,
    step: 1,
    label: 'frequency',
});
const filterQBinding = filterFolder.addBinding(params, 'filterQ', { min: 0.1, max: 30, step: 0.1, label: 'Q' });

function updateFilterVisibility() {
    const hidden = !params.useFilter;
    filterTypeBinding.hidden = hidden;
    filterFrequencyBinding.hidden = hidden;
    filterQBinding.hidden = hidden;
}

useFilterBinding.on('change', updateFilterVisibility);
updateFilterVisibility();

const paneExportBtn = pane.addButton({ title: 'Export Settings' });
paneExportBtn.on('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(params, null, 2));
    alert('Settings copied to clipboard');
});

const playBtn = pane.addButton({ title: 'Play' });
const playBtnEl = playBtn.element.querySelector('button') ?? playBtn.element;

async function startCustomFrequency() {
    await ensureAudioRunning();
    if (params.sustainOnPress) {
        startSustainedSound(audioContext, params, 'custom');
    } else {
        playSound(audioContext, params);
    }
}

function stopCustomFrequency() {
    if (params.sustainOnPress) {
        stopSustainedSound('custom');
    }
}

playBtnEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startCustomFrequency();
});

playBtnEl.addEventListener('pointerup', (e) => {
    e.preventDefault();
    stopCustomFrequency();
});

playBtnEl.addEventListener('pointerleave', () => {
    stopCustomFrequency();
});

playBtnEl.addEventListener('pointercancel', () => {
    stopCustomFrequency();
});

const actionsRow = document.createElement('div');
actionsRow.className = 'actions-row';
const exportEl = paneExportBtn.element;
const playEl = playBtn.element;
exportEl.parentElement.insertBefore(actionsRow, exportEl);
actionsRow.append(exportEl, playEl);

setupControlFocusRelease(document.getElementById('pane-root'));
setupControlFocusRelease(document.getElementById('keyboard-root'));

resizeViz();
window.addEventListener('resize', resizeViz);
requestAnimationFrame(drawViz);
