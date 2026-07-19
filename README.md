# Sound Tweak

Browser playground for shaping short oscillator tones with the Web Audio API. Tweak waveform, gain, duration, and an optional biquad filter, then preview with a live pixel spectrum visualizer.

## Run

Open `index.html` in a browser, or serve the folder locally:

```bash
npx serve .
```

Click **Play** once to unlock audio (browsers require a user gesture).

## Controls

**Top bar** — spectrum visualizer (center), **Export Last Played** (last note + current settings as JSON). **Initial Setup** is a placeholder with no behavior yet.

**Gain Node** — gain, duration, sustain-on-press toggle.

**Biquad Filter** — enable toggle, type (lowpass / bandpass / highpass), frequency, Q.

**Oscillator Node** — frequency, waveform type, **Play**, octave slider (0–8), last note display, and on-screen piano with QWERTY shortcuts (`s`–`k` naturals, `e`/`r`/`y`/`u`/`i` sharps).

No build step. Vanilla HTML, CSS, and ES modules.
