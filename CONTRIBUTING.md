# Contributing

Thanks for helping improve Mac Paint / Draw Enhanced.

## Before changing code

1. Read [the maintenance guide](docs/MAINTENANCE.md) to understand the raster canvas, SVG layer, and frame model.
2. Keep changes focused and preserve existing artwork and undo history.
3. Add comments that explain why complex behavior exists, not just what a line says.
4. Keep touch layouts usable and respect `prefers-reduced-motion` for new animation effects.
5. Never request location until the user explicitly asks for a location-based feature.

## Test your changes

Use Node.js 22 or newer. Dependencies are not required for the checks:

```sh
npm test
```

Then open the app in a browser and test the affected feature, including a touch-sized layout when relevant. Check the browser console for errors.

## Pull requests

- Describe the user-facing change and why it is needed.
- List the checks you ran and any manual tests you performed.
- Include screenshots for meaningful visual changes when practical.
- Keep the README and CHANGELOG in sync when behavior or release status changes.
