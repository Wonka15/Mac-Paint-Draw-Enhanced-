# Mac Paint / Draw Enhanced — Version 2.0

A free, browser-based painting and vector-design studio inspired by classic Macintosh graphics software. Built as a static site, it runs in a modern browser and is published with GitHub Pages.

**Live app:** https://wonka15.github.io/Mac-Paint-Draw-Enhanced-/

**Release:** 2.0.0 · **License:** MIT

## Highlights

- **Raster drawing:** paintbrush, eraser, bucket fill, lasso selection, patterns, custom brush stamps, repeating textures, and pixel-level editing.
- **Vector design:** editable paths and Bézier curves, anchor editing, shape conversion, Shape Builder, Pathfinder/boolean operations, and editable text.
- **Logo Trace Studio:** turn high-contrast reference images into editable vector outlines locally in your browser.
- **Animation Studio:** create and preview frame-by-frame animations, copy a frame, use onion-skin alignment, adjust playback speed, and export animated GIFs.
- **Creative workspace:** rulers, guides, zoom, panning, undo/redo, PNG/SVG export, retro sounds, and a responsive iPad-friendly layout.
- **Classic Mac details:** optional Macintosh SE desk radio and a C4 Corvette / Timex Indiglo-inspired dashboard.
- **Corvette dashboard colors:** amber clock digits, green battery indicator, red weather digits, and softly flickering electrical-blue borders.

## Quick start

No build step or dependency installation is required to use the app.

1. Open the [live app](https://wonka15.github.io/Mac-Paint-Draw-Enhanced-/).
2. Or download/clone this repository and open `index.html` in a current browser. Some browser features, especially location-based weather, work best over HTTPS or a local web server.
3. To preview through a local server with Python installed, run `python -m http.server 8000` from the project directory, then visit `http://localhost:8000`.

## Run the project checks

The checks use Node.js 22 and do not require third-party npm packages:

```sh
npm test
```

This runs JavaScript syntax checks for every local module and a project-integrity script that checks important HTML IDs, script references, release metadata, and key styles. GitHub Actions runs the same checks on pull requests and pushes to `main`.

Automated checks catch common structural mistakes; they do not replace testing real drawing gestures in a browser. See [the maintenance guide](docs/MAINTENANCE.md) for a beginner-friendly manual test list.

## Project map

| File | Responsibility |
| --- | --- |
| `index.html` | Page structure, controls, canvas/SVG layers, and script loading. |
| `styles.css` | Classic desktop UI, responsive layout, tool states, and Corvette dashboard effects. |
| `app.js` | Main editor state, raster tools, vectors, selection, undo/redo, persistence, tracing, and Animation Studio. |
| `painting.js` | Optional color-mixing drawer and brush strokes on the main raster canvas. |
| `radio.js` | Macintosh SE radio station list, playback lifecycle, and draggable player panel. |
| `corvette.js` | Corvette theme preference and clock, battery, and opt-in weather dashboard. |
| `scripts/check-project.js` | Fast checks for common project wiring mistakes. |
| `.github/workflows/` | Automated quality checks and GitHub Pages deployment. |
| `docs/MAINTENANCE.md` | Architecture notes and manual regression checklist. |
| `CHANGELOG.md` | Version history and notable changes. |

## Privacy and external services

- Logo tracing and artwork editing run in the browser; reference images are not uploaded by the tracing feature.
- Weather requests location permission only after **GET WEATHER** is pressed and uses Open-Meteo for current conditions.
- Radio streams, vector boolean support, and GIF encoding may use third-party providers or CDN-hosted libraries. Availability and terms are controlled by those providers.
- Artwork and preferences may be stored in browser local storage. Clearing site data may remove saved settings or custom brushes/textures.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes. Keep changes focused, explain non-obvious logic with comments, run `npm test`, and manually test affected tools in a browser before opening a pull request.
