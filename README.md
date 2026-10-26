# WordPath Studio

A static, browser-based word-list optimizer with optional Gemini-powered crossword title and clue generation.

## Project files

- `index.html`: marketing site plus the hidden studio workspace
- `css/styles.css`: workspace (tool) styling
- `css/site.css`: marketing-site styling (header, hero, sections, footer)
- `js/site.js`: navigation, tabs, scroll effects, and the on-demand studio overlay
- `js/app.js`: optimizer interactions, reports, and Gemini API requests
- `assets/favicon.svg`: local site icon

## Run or deploy

Upload the contents of this folder to any static hosting provider, or serve this folder locally with a small development server. No build step or package installation is required.

The optimizer runs in the browser. Gemini clue generation requires an internet connection and a valid Google Gemini API key entered in the app. The key is used by the browser for direct requests to Google's API; do not share your key or embed it in published source code.

© 2026 WordPath Studio. All rights reserved.

## API key storage

Paste a Gemini API key in the AI clues panel. Select **Save key in this browser** to store it in this site's browser local storage for future visits. Select **Remove saved key** to remove the saved copy and clear the input. Browser storage is not encrypted, so only save a key in a browser profile and on a device you trust. The key is used for direct requests from the browser to Google's Gemini API; it is not sent to a WordPath server.

The responsive layout includes mobile-specific sizing and wrapping to prevent horizontal page scrolling on narrow screens.
