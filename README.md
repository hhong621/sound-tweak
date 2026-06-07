# Sound Tweak

Browser playground for shaping short oscillator tones with the Web Audio API. Tweak frequency, waveform, gain, duration, and an optional biquad filter, then preview the result with a live spectrum visualizer.

## Run

Open `index.html` in a browser, or serve the folder locally:

```bash
npx serve .
```

Click **Play** once to unlock audio (browsers require a user gesture).

## Controls

- **Frequency** — set in Hz or pick a note and octave
- **Oscillator** — sine, square, triangle, or sawtooth
- **Filter** — optional lowpass, bandpass, or highpass with frequency and Q
- **Export Settings** — copies the current config as JSON to the clipboard

Built with [Tweakpane](https://tweakpane.github.io/docs/) (loaded from CDN). No build step required.
