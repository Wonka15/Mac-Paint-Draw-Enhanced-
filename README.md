# MacDraw Enhanced

A classic-Mac-inspired drawing app that combines pixel painting with editable SVG vector paths.

## Open the app

Visit https://wonka15.github.io/Mac-Paint-Draw-Enhanced-/

## Beginner-friendly project structure

- `index.html` — the page structure: buttons, panels, canvas, and labels.
- `styles.css` — the visual design and layout.
- `app.js` — drawing tools, vector paths, saving, undo/redo, and exports.

Keep these jobs separate: HTML describes the interface, CSS styles it, and JavaScript makes it work. Most tool behavior lives in `app.js`.

## Vector pen, Bézier curves, and anchor points

- Choose **Vector Pen** and click to create straight-line anchor points.
- Choose **Bézier Curve** and click-drag at each anchor to shape its curve handles. Drag direction controls the outgoing curve; the opposite handle is mirrored for a smooth join.
- Click the first anchor (three or more points) to close a path, or press **Enter** / double-click to finish an open path.
- Choose **Edit Points** and drag an anchor to reposition it.
- Choose **Export SVG · Vinyl** to save vector paths, including curves, as black, unfilled SVG outlines.

The SVG export contains vector paths only. Freehand pencil marks on the raster canvas are not included. SVG is commonly accepted by vinyl-cutting software, but confirm your cutter software's import settings and perform a small test cut first.

## How AI could fit in

GitHub Pages serves static files, so it cannot safely keep a private AI API key. A real AI feature—such as “make a simple cat silhouette” or “clean up this outline”—should call a small server-side endpoint that stores the key securely. Never put a secret API key in `app.js` or any public GitHub file.

## Planned upgrades

- Smooth Bézier curve handles.
- Select, move, scale, and duplicate whole vector objects.
- SVG import and bitmap tracing.
- Optional AI-assisted outline creation through a secure backend.

## Zoom, rulers, guides, and Pathfinder

- Use **− / +** to zoom and **Fit** to fit the canvas to the available workspace.
- Drag from the top ruler down onto the canvas to place a horizontal guide. Drag from the left ruler right onto the canvas to place a vertical guide.
- Turn on **Snap to guides** to align pencil and vector points to guide positions.
- Use **Vector rect** and **Vector oval**, or draw and close a path with **Vector pen** or **Bezier curve**, to create editable closed vector shapes.
- In **Edit points**, click one closed vector shape, then **Shift-click** a second. Use **Unite**, **Subtract**, **Intersect**, or **Exclude** in Pathfinder.
- Pathfinder uses Paper.js from a public CDN, so those boolean operations require an internet connection.

## Bézier tool

Choose **Bezier curve**, then click-drag to create anchor points with handles. Press **Enter** or double-click to finish an open curve; click near the first point to close it. If the tool does not receive pointer input, refresh the live site to load the latest version.
