# Maintenance guide

## File responsibilities
- `index.html`: UI structure and controls.
- `styles.css`: layout, visual styling, responsive behavior.
- `app.js`: raster tools, vector paths, state, persistence, tracing, audio, and Frame Studio.

## Pre-merge checklist
1. Run `node --check app.js` and `node scripts/check-project.js`.
2. Check browser console errors.
3. Test raster tools, vector creation/movement, anchor editing, shape conversion, logo tracing, undo/redo, storage, exports, sound toggle, and animation playback.
4. Keep canvas layers separate and preserve the animation panel when editing unrelated tools.

## Safe editing
Prefer small, focused changes over broad replacements. Explain coordinate transforms, vector state, and persistence with comments. Catch optional storage/audio failures without blocking core drawing. Keep image tracing local and avoid adding dependencies without a clear need.
