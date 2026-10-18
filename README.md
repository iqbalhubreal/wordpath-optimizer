# WordPath Optimizer Studio

A responsive, browser-based word-list optimizer that builds letter-linked word chains, flags unused words, supports multiple batches, and exports a plain-text report.

## Run it

1. Extract the ZIP (or keep these three files in the same folder).
2. Open `index.html` in a modern browser.
3. Paste words separated by commas, semicolons, or line breaks and click **Optimize word paths**.

No build step, API key, account, server, or third-party JavaScript library is required. The app runs locally in your browser.

## Files

- `index.html`: accessible page structure and metadata.
- `styles.css`: responsive interface styles and layout.
- `app.js`: batch controls, optimization logic, result rendering, clipboard and text export.

## Optimization notes

The optimizer first searches for chains of 10 words, then works on remaining words for chains of 7 to 10 words. The effort setting controls how many first-stage attempts are explored. Results are heuristic, so repeat runs can produce different chains and are not guaranteed to be mathematically optimal.
