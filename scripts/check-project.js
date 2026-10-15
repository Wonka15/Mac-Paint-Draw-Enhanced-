const fs = require('node:fs');
const assert = require('node:assert/strict');

const read = path => fs.readFileSync(path, 'utf8');
const html = read('index.html');
const css = read('styles.css');
const readme = read('README.md');
const changelog = read('CHANGELOG.md');
const packageInfo = JSON.parse(read('package.json'));
const scriptPaths = ['app.js', 'painting.js', 'radio.js', 'corvette.js'];
const scripts = scriptPaths.map(path => ({ path, source: read(path) }));

// Duplicate IDs can make a control bind to the wrong element.
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicates)], [], 'HTML IDs must be unique');

// Some elements are created dynamically and therefore are not declared in HTML.
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

// Confirm that every local JavaScript module is loaded by the page.
for (const path of scriptPaths) {
  assert.ok(html.includes('src="' + path + '"'), 'Missing local script tag: ' + path);
  assert.ok(fs.existsSync(path), 'Missing local JavaScript file: ' + path);
}

// Keep app UI, package metadata, and release notes aligned on version 2.0.
assert.equal(packageInfo.version, '2.0.0', 'Update package.json version intentionally when releasing');
assert.ok(html.includes('Mac Paint / Draw Enhanced 2.0'), 'Page title should show version 2.0');
assert.ok(html.includes('version-badge">v2.0</span>'), 'Visible version badge should show v2.0');
assert.ok(readme.includes('Version 2.0') && changelog.includes('## [2.0.0]'), 'Release docs should include version 2.0');

for (const id of [
  'traceLogoUpload', 'traceLogoBtn', 'convertShapeBtn', 'vectorLayer',
  'corvetteModeBtn', 'seRadioPower', 'seRadioNext', 'paintingDrawer',
  'frameStrip', 'addFrameBtn', 'exportGifBtn'
]) {
  assert.ok(ids.includes(id), 'Missing required control or layer: #' + id);
}
const app = scripts.find(script => script.path === 'app.js').source;
assert.ok(app.includes("document.querySelector('.stage')"), 'Focus Canvas selector should exist');
assert.ok(app.includes('function traceLogo()') && app.includes('draggingVector'),
  'Tracing and vector movement must be present');
assert.ok(css.includes('#traceLogoCard'), 'Trace UI must be styled');
assert.ok(css.includes('.corvette-dash'), 'Corvette dashboard must have styling');
assert.ok(css.includes('c4ElectricalRim'), 'Corvette electrical border effect must be styled');

// Catch missing or extra CSS block braces without adding a build dependency.
const cssWithoutCommentsOrStrings = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
let braceDepth = 0;
for (const character of cssWithoutCommentsOrStrings) {
  if (character === '{') braceDepth += 1;
  if (character === '}') braceDepth -= 1;
  assert.ok(braceDepth >= 0, 'CSS has a closing brace without an opening brace');
}
assert.equal(braceDepth, 0, 'CSS blocks must have balanced braces');

console.log('Project checks passed (version metadata, HTML wiring, required controls, and CSS block balance).');
