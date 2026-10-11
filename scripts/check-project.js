const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const scriptPaths = ['app.js', 'painting.js', 'radio.js', 'corvette.js'];
const scripts = scriptPaths.map(path => ({ path, source: fs.readFileSync(path, 'utf8') }));

// Duplicate HTML IDs make controls bind unpredictably.
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicates)], [], 'HTML IDs must be unique');

// Validate common static selectors across every local script. The dashboard is
// generated at runtime, so corvetteDash is intentionally not present in HTML.
const dynamicIds = new Set(['corvetteDash']);
const missing = [];
for (const { path, source } of scripts) {
  const refs = [
    ...source.matchAll(/\$\(["']([^'"]+)["']\)/g),
    ...source.matchAll(/getElementById\(["']([^'"]+)["']\)/g)
  ].map(match => match[1]);
  for (const id of new Set(refs)) {
    if (!ids.includes(id) && !dynamicIds.has(id)) missing.push(path + ': #' + id);
  }
}
assert.deepEqual(missing, [], 'JavaScript ID lookups must exist in HTML');

for (const id of ['traceLogoUpload', 'traceLogoBtn', 'convertShapeBtn', 'vectorLayer',
  'corvetteModeBtn', 'seRadioPower', 'seRadioNext', 'paintingDrawer']) {
  assert.ok(ids.includes(id), 'Missing control: ' + id);
}
const app = scripts.find(script => script.path === 'app.js').source;
assert.ok(app.includes("document.querySelector('.stage')"), 'Focus Canvas selector should exist');
assert.ok(app.includes('function traceLogo()') && app.includes('draggingVector'),
  'Tracing and vector movement must be present');
assert.ok(css.includes('#traceLogoCard'), 'Trace UI must be styled');
assert.ok(css.includes('.corvette-dash'), 'Corvette dashboard must have styling');

console.log('Static checks passed.');
