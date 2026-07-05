# Sound Tweak

Browser playground for shaping short oscillator tones with the Web Audio API. Tweak waveform, gain, duration, and an optional biquad filter, then preview with a live pixel spectrum visualizer.

## Run

Open `index.html` in a browser, or serve the folder locally:

```bash
npx serve .
```

Click **Play** once to unlock audio (browsers require a user gesture).

## Controls

**Tweakpane** — frequency (Hz), oscillator type, gain, duration, optional filter (type, frequency, Q), **Play**, and **Export Settings** (params as JSON).

**Keyboard** — on-screen piano with QWERTY shortcuts (`s`–`k` naturals, `e`/`r`/`y`/`u`/`i` sharps). Octave slider (0–8). **Export** copies the last played note, octave, and current settings as JSON.

Built with [Tweakpane](https://tweakpane.github.io/docs/) (CDN). No build step.
