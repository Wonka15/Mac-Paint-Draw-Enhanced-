# Maintenance guide

## File responsibilities
- `index.html`: UI structure and controls.
- `styles.css`: layout, visual styling, responsive behavior.
- `app.js`: raster tools, vector paths, state, persistence, tracing, and Frame Studio.
- `painting.js`: color mixing and brush behavior in the optional painting drawer.
- `radio.js`: station definitions, playback lifecycle, and draggable radio panel.
- `corvette.js`: Corvette theme toggle, saved preference, and dashboard markup.

## Pre-merge checklist
1. Run `node --check app.js`, `node --check painting.js`, `node --check radio.js`, `node --check corvette.js`, and `node scripts/check-project.js`.
2. Check browser console errors.
3. Test raster tools, vector creation/movement, anchor editing, shape conversion, logo tracing, undo/redo, storage, exports, sound toggle, and animation playback.
4. Test both radio stations on desktop and mobile; stream availability and embedding can vary by provider.
5. Toggle Corvette mode on/off and reload to confirm its saved preference works without changing artwork.
6. Keep canvas layers separate and preserve the animation panel when editing unrelated tools.

## Safe editing
Prefer small, focused changes over broad replacements. Explain coordinate transforms, vector state, and persistence with comments. Catch optional storage/audio failures without blocking core drawing. Keep image tracing local and avoid adding dependencies without a clear need.
