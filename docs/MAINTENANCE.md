# Maintenance guide

This guide is written for contributors who are new to the codebase. The app is static HTML, CSS, and plain JavaScript, with no build system or backend.

## How the pieces fit together

- `index.html` defines controls and the workspace, including the raster canvas, SVG vector layer, and overlay canvases for guides, selection, and onion-skin previews.
- `styles.css` controls layout, visual states, responsive behavior, and the Corvette dashboard's amber/green/red/blue lighting.
- `app.js` is the main editor. State variables track the active tool and gesture. Raster pixels are drawn on the main canvas; editable vector geometry is stored separately in SVG paths.
- `painting.js` adds a color-mixing drawer. It draws on the same raster canvas so these strokes are included in raster exports.
- `radio.js` owns the Macintosh SE radio. `stopPlayback()` removes active player elements to prevent old streams continuing after station changes.
- `corvette.js` creates the optional dashboard and updates the local clock, browser-reported battery status, and user-requested weather.
- `scripts/check-project.js` catches common wiring mistakes before deployment.
- `.github/workflows/code-quality.yml` runs syntax and project-integrity checks; `.github/workflows/static.yml` publishes the repository to GitHub Pages.

## Important design rules

1. **Keep raster and vector art separate.** The canvas stores pixels; vector paths remain editable until export or animation compositing.
2. **Use the coordinate helpers.** Pointer coordinates must be translated from the displayed element's size to the underlying canvas bitmap. Do not mix CSS pixels and canvas pixels.
3. **Use snapshots for undo and animation.** Changes to history or frames should preserve both raster images and the relevant vector geometry.
4. **Keep optional features optional.** A blocked location request, unavailable battery API, failed radio stream, or missing browser storage should not prevent core drawing.
5. **Keep privacy predictable.** Do not request location until the user explicitly asks for weather. Do not upload artwork used by local tracing.
6. **Respect reduced motion.** New animation effects should include a `prefers-reduced-motion` alternative where practical.
7. **Avoid broad find-and-replace edits.** Make small changes near the feature that owns the behavior, and explain non-obvious decisions in comments.

## Local development and checks

Use Node.js 22 or newer. No `npm install` is required because the project has no package dependencies.

```sh
npm test
```

The command syntax-checks every local JavaScript module and runs the project-integrity script. GitHub Actions runs this on pull requests and pushes to `main`.

## Manual regression checklist

Before merging changes that affect the editor, test the relevant items on desktop and a touch device when possible:

- [ ] Draw, erase, fill, select, move, and clear raster artwork.
- [ ] Create and move vector shapes; edit anchors and Bézier handles.
- [ ] Convert shapes and use Shape Builder/Pathfinder without losing unrelated artwork.
- [ ] Import a tracing reference, adjust tracing, and verify resulting paths remain editable.
- [ ] Undo/redo and reload to confirm artwork and preferences behave as expected.
- [ ] Export PNG and SVG; add multiple animation frames, copy/delete a frame, play/stop, and export GIF.
- [ ] Toggle Corvette mode, reload, and verify the saved theme, amber clock, green battery, red weather digits, and blue EL borders.
- [ ] Test radio power and station switching; verify the previous stream stops.
- [ ] Check the browser console and test a narrow phone layout plus iPad portrait and landscape.

## Debugging tips

- Read the first browser-console error first; later errors may be consequences of the first one.
- If a control does nothing, verify its HTML `id`, its event listener, and any related CSS state.
- If a drawing gesture is offset, inspect the coordinate conversion helper before changing tool-specific math.
- If a feature fails only on one device, check browser API support and permission settings before assuming drawing logic is broken.
- If GitHub Pages does not reflect a merged change, check the latest **Deploy static content to Pages** run before troubleshooting the code.
