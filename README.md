# Mac Paint / Draw Enhanced

A browser-based, classic-Mac-inspired paint and vector design studio.

**Live app:** https://wonka15.github.io/Mac-Paint-Draw-Enhanced-/

## Features
- Raster painting, erasing, fills, patterns, custom brush stamps, and repeating textures.
- Editable vector paths, anchor editing, shape ordering, Shape Builder, and Pathfinder.
- Drag a vector shape's body with **Edit Points** to move it; drag anchors to reshape it. Alt-click a path to add an anchor.
- Shape Lab conversions: rectangle, rounded rectangle, oval, capsule, cylinder, and star.
- Logo Trace Studio: import a faded reference and create editable threshold-based vector silhouettes.
- Pixel Mode / FatBits, rulers, guides, panning, zoom, editable text, undo/redo, exports, retro sounds, and Frame Studio.

## Logo tracing
Tracing runs locally; images are not uploaded. The tracer converts thresholded pixels into simplified polygon outlines. It works best for high-contrast logos and stickers and is not a full-color vectorizer. Interior holes, fine details, and gradients may need manual cleanup.

## Architecture
- `index.html`: app layout, controls, and canvas/SVG layers.
- `styles.css`: classic desktop UI and responsive styling.
- `app.js`: raster drawing, vector paths, editor state, undo/redo, persistence, tracing, audio, and Frame Studio.
- Keep raster canvas content, SVG vectors, and Frame Studio frames separate. Preserve the animation panel when changing unrelated features.

## Dependencies and checks
The app is static and has no backend. Some boolean operations and GIF export use public CDN libraries. Run `node --check app.js`, inspect the browser console, and test drawing, vector movement, shape conversion, tracing, undo/redo, exports, and Frame Studio after changes.

See [docs/MAINTENANCE.md](docs/MAINTENANCE.md) for the review checklist.
