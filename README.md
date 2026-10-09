# MacDraw Enhanced

A classic-Mac-inspired drawing app that combines pixel painting with editable SVG vector paths.

## Open the app

Visit https://wonka15.github.io/Mac-Paint-Draw-Enhanced-/

## Beginner-friendly project structure

- `index.html` — the page structure: buttons, panels, canvas, and labels.
- `styles.css` — the visual design and layout.
- `app.js` — drawing tools, vector paths, saving, undo/redo, and exports.

Keep these jobs separate: HTML describes the interface, CSS styles it, and JavaScript makes it work. Most tool behavior lives in `app.js`.

## Vector pen and anchor points

1. Choose **Vector Pen**.
2. Click to place straight-line anchor points.
3. Click the first anchor to close a path (three or more points), or press **Enter** to finish an open path.
4. Choose **Edit Points** and drag an anchor to adjust the path.
5. Choose **Export SVG · Vinyl** to save vector paths as black, unfilled SVG outlines.

The SVG export contains vector paths only. Freehand pencil marks on the raster canvas are not included. SVG is commonly accepted by vinyl-cutting software, but confirm your cutter software's import settings and perform a small test cut first.

## How AI could fit in

GitHub Pages serves static files, so it cannot safely keep a private AI API key. A real AI feature—such as “make a simple cat silhouette” or “clean up this outline”—should call a small server-side endpoint that stores the key securely. Never put a secret API key in `app.js` or any public GitHub file.

## Planned upgrades

- Smooth Bézier curve handles.
- Select, move, scale, and duplicate whole vector objects.
- SVG import and bitmap tracing.
- Optional AI-assisted outline creation through a secure backend.
