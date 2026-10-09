# Mac paint/draw enhanced

A friendly, browser-based drawing studio inspired by the immediacy of classic Macintosh paint and drawing apps, with a few modern layout comforts.

## What's included

- Pencil, eraser, line, rectangle, oval, text, color picker, and guide-placement tools
- Color palette, adjustable stroke size, and optional shape fill
- Undo/redo, grid, guides, safe-area overlay, and optional snapping to guides
- Common canvas presets for banners, square art, portrait posts, and HD layouts
- PNG export without editor overlays
- Local browser autosave; no account or server required
- Responsive layout for desktop and touch screens

## Run locally

This is a dependency-free static app. Open `index.html` in a modern browser, or serve the folder with any static file server.

For example, with Python installed:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish on GitHub Pages

1. Create a new public repository named `mac-paint-draw-enhanced`.
2. Upload `index.html`, `README.md`, `LICENSE`, and `.gitignore` to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Wait for GitHub Pages to finish deploying; the site URL will appear in the Pages settings.

## Keyboard shortcuts

- `⌘/Ctrl + Z`: Undo
- `⌘/Ctrl + Shift + Z`: Redo
- `Esc`: Cancel an in-progress shape preview

## Notes and limitations

This is a polished starter/MVP, not a full replacement for MacPaint, MacDraw, or Affinity Designer. It currently focuses on a single raster canvas. It does not yet include a full vector object model, editable Bézier anchor points, native project-file format, multi-layer editing, PDF/SVG export, print-bleed setup, or automated browser tests. Those are good candidates for future versions.

The app saves the current canvas in browser local storage on the same device/browser. Export PNG backups regularly; clearing browser storage can remove the local saved copy.

## Project values

- Keep the interface approachable and playful.
- Make drawing feel direct, not bureaucratic.
- Keep the code readable and easy for contributors to improve.
- Take inspiration from classic software without reusing proprietary Apple source code or artwork.

## License

MIT. See `LICENSE`.
