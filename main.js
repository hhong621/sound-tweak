import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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

const NOTE_OPTIONS = Object.fromEntries(NOTES.map((n) => [n, n]));

function frequencyFromNote(note, octave) {
    return NOTE_FREQUENCIES[note][octave];
}

function closestNoteFromFrequency(freq) {
    let bestNote = 'A';
    let bestOctave = 4;
    let bestDiff = Infinity;

    for (const note of NOTES) {
        for (let octave = 0; octave <= 8; octave++) {
            const diff = Math.abs(NOTE_FREQUENCIES[note][octave] - freq);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestNote = note;
                bestOctave = octave;
            }
        }
    }

    return { note: bestNote, octave: bestOctave };
}

const params = {
    frequencyMode: 'hz',
    note: 'A',
    octave: 4,
    frequency: 440,
    oscillatorType: 'sine',
    useFilter: false,
    filterType: 'lowpass',
    filterFrequency: 1000,
    filterQ: 5,
    gain: 0.3,
    duration: 0.2,
};

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
analyser.smoothingTimeConstant = 0.75;
analyser.connect(audioContext.destination);

const freqData = new Uint8Array(analyser.frequencyBinCount);
const BAR_COUNT = 32;

const vizCanvas = document.getElementById('viz');
const vizCtx = vizCanvas.getContext('2d');
let vizActive = false;
let vizEndTime = 0;
let idlePhase = 0;

function resizeViz() {
    const dpr = window.devicePixelRatio || 1;
    const rect = vizCanvas.getBoundingClientRect();
    vizCanvas.width = rect.width * dpr;
    vizCanvas.height = rect.height * dpr;
    vizCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawViz() {
    const w = vizCanvas.clientWidth;
    const h = vizCanvas.clientHeight;
    const gap = 3;
    const barW = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    const playing = vizActive && performance.now() < vizEndTime;

    vizCtx.clearRect(0, 0, w, h);

    if (playing) {
        analyser.getByteFrequencyData(freqData);
        const step = Math.floor(freqData.length / BAR_COUNT);

        for (let i = 0; i < BAR_COUNT; i++) {
            const value = freqData[i * step] / 255;
            const barH = Math.max(4, value * h * 0.92);
            const x = i * (barW + gap);
            const y = (h - barH) / 2;

            vizCtx.fillStyle = `rgba(255, 213, 99, ${0.45 + value * 0.55})`;
            vizCtx.beginPath();
            vizCtx.roundRect(x, y, barW, barH, 2);
            vizCtx.fill();
        }
    } else {
        if (vizActive && performance.now() >= vizEndTime) {
            vizActive = false;
        }

        idlePhase += 0.04;
        for (let i = 0; i < BAR_COUNT; i++) {
            const wave = (Math.sin(idlePhase + i * 0.35) + 1) / 2;
            const barH = 4 + wave * 6;
            const x = i * (barW + gap);
            const y = (h - barH) / 2;

            vizCtx.fillStyle = 'rgba(255, 213, 99, 0.18)';
            vizCtx.beginPath();
            vizCtx.roundRect(x, y, barW, barH, 2);
            vizCtx.fill();
        }
    }

    requestAnimationFrame(drawViz);
}

function startVisualization(durationSec) {
    vizActive = true;
    vizEndTime = performance.now() + durationSec * 1000;
}

function playSound(context, settings) {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = settings.oscillatorType;
    oscillator.frequency.value = settings.frequency;

    if (settings.useFilter) {
        const filter = context.createBiquadFilter();
        filter.type = settings.filterType;
        filter.frequency.value = settings.filterFrequency;
        filter.Q.value = settings.filterQ;

        oscillator.connect(filter);
        filter.connect(gainNode);
    } else {
        oscillator.connect(gainNode);
    }

    gainNode.connect(analyser);
    gainNode.gain.setValueAtTime(settings.gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);

    oscillator.start(now);
    oscillator.stop(now + settings.duration);
    startVisualization(settings.duration);
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

function setKeyPressed(key, pressed) {
    const btn = keyToButton[key];
    if (btn) btn.classList.toggle('pressed', pressed);
}

function playNote(note) {
    const settings = {
        ...params,
        frequency: frequencyFromNote(note, params.octave),
    };
    playSound(audioContext, settings);
}

async function triggerNote(note) {
    await ensureAudioRunning();
    playNote(note);
}

document.querySelectorAll('.piano-key').forEach((btn) => {
    btn.addEventListener('click', () => {
        triggerNote(btn.dataset.note);
    });
});

document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.target.closest('input, select, textarea')) return;

    const note = KEY_TO_NOTE[e.key];
    if (!note) return;

    e.preventDefault();
    setKeyPressed(e.key, true);
    triggerNote(note);
});

document.addEventListener('keyup', (e) => {
    if (KEY_TO_NOTE[e.key]) {
        setKeyPressed(e.key, false);
    }
});

window.addEventListener('blur', () => {
    document.querySelectorAll('.piano-key.pressed').forEach((btn) => {
        btn.classList.remove('pressed');
    });
});

const pane = new Pane({ title: 'Sound Tweak', container: document.getElementById('pane-root') });

const frequencyFolder = pane.addFolder({ title: 'Frequency', expanded: true });
const frequencyModeBinding = frequencyFolder.addBinding(params, 'frequencyMode', {
    label: 'mode',
    options: [
        { text: 'Hz', value: 'hz' },
        { text: 'Note', value: 'note' },
    ],
});
const frequencyBinding = frequencyFolder.addBinding(params, 'frequency', {
    min: 20,
    max: 4000,
    step: 1,
    label: 'frequency',
});
const noteBinding = frequencyFolder.addBinding(params, 'note', {
    label: 'note',
    options: NOTE_OPTIONS,
});
const octaveBinding = frequencyFolder.addBinding(params, 'octave', {
    min: 0,
    max: 8,
    step: 1,
    label: 'octave',
});

function applyNoteFrequency() {
    params.frequency = frequencyFromNote(params.note, params.octave);
    pane.refresh();
}

function snapToClosestNote() {
    const closest = closestNoteFromFrequency(params.frequency);
    params.note = closest.note;
    params.octave = closest.octave;
    params.frequency = frequencyFromNote(params.note, params.octave);
    pane.refresh();
}

function updateFrequencyVisibility() {
    const noteMode = params.frequencyMode === 'note';
    frequencyBinding.hidden = noteMode;
    noteBinding.hidden = !noteMode;
    octaveBinding.hidden = !noteMode;
}

frequencyModeBinding.on('change', () => {
    updateFrequencyVisibility();
    if (params.frequencyMode === 'note') {
        snapToClosestNote();
    } else {
        pane.refresh();
    }
});

noteBinding.on('change', () => {
    if (params.frequencyMode === 'note') {
        applyNoteFrequency();
    }
});

octaveBinding.on('change', () => {
    if (params.frequencyMode === 'note') {
        applyNoteFrequency();
    }
});

updateFrequencyVisibility();

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

const exportBtn = pane.addButton({ title: 'Export Settings' });
exportBtn.on('click', async () => {
    const { frequencyMode, note, octave, ...rest } = params;
    const exportSettings = {
        ...rest,
        frequency: frequencyMode === 'note'
            ? frequencyFromNote(note, octave)
            : params.frequency,
    };
    await navigator.clipboard.writeText(JSON.stringify(exportSettings, null, 2));
    alert('Settings copied to clipboard');
});

const playBtn = pane.addButton({ title: 'Play' });
playBtn.on('click', async () => {
    await ensureAudioRunning();
    playSound(audioContext, params);
});

const actionsRow = document.createElement('div');
actionsRow.className = 'actions-row';
const exportEl = exportBtn.element;
const playEl = playBtn.element;
exportEl.parentElement.insertBefore(actionsRow, exportEl);
actionsRow.append(exportEl, playEl);

resizeViz();
window.addEventListener('resize', resizeViz);
requestAnimationFrame(drawViz);
