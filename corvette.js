/*
 * Corvette night mode: behavior lives here; colors and layout live in styles.css.
 * The dashboard is generated only once, so the base page stays uncluttered.
 */
(() => {
  'use strict';
  const button = document.getElementById('corvetteModeBtn');
  if (!button) return;
  const storageKey = 'mpde-corvette-mode';

  function makeDashboard() {
    const dashboard = document.createElement('section');
    dashboard.id = 'corvetteDash';
    dashboard.className = 'corvette-dash';
    dashboard.setAttribute('aria-label', 'C4 Corvette-inspired digital dashboard');
    dashboard.innerHTML = [
      '<div class="c4-dash-brand"><span>CHEVROLET</span><strong>C4</strong><span>DIGITAL COCKPIT</span></div>',
      '<div class="c4-gauge"><span class="c4-gauge-label">SPEED</span><strong>00</strong><small>MPH</small><i aria-hidden="true"></i></div>',
      '<div class="c4-gauge"><span class="c4-gauge-label">ENGINE</span><strong>0.0</strong><small>×1000 RPM</small><i aria-hidden="true"></i></div>',
      '<div class="c4-gauge"><span class="c4-gauge-label">SYSTEM</span><strong>13.8</strong><small>VOLTS</small><i aria-hidden="true"></i></div>',
      '<div class="c4-dash-right"><span class="c4-indiglo-led" aria-hidden="true"></span><strong>INDIGLO</strong><small>EL NIGHT LIGHT</small><span class="c4-dash-rule" aria-hidden="true"></span><small>1980s · DIGITAL PERFORMANCE</small></div>'
    ].join('');
    document.querySelector('.topbar')?.insertAdjacentElement('afterend', dashboard);
    return dashboard;
  }

  const dashboard = document.getElementById('corvetteDash') || makeDashboard();

  function applyTheme(enabled) {
    document.body.classList.toggle('corvette-mode', enabled);
    dashboard.hidden = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? '◉ Corvette ON' : '◉ Corvette';
    button.title = enabled
      ? 'Turn off C4 Corvette / Timex Indiglo styling'
      : 'Turn on C4 Corvette / Timex Indiglo styling';
    // localStorage may be disabled in private browsing; the toggle should still work.
    try { localStorage.setItem(storageKey, enabled ? 'on' : 'off'); }
    catch (error) { console.debug('Could not save Corvette theme preference.', error); }
  }

  let savedTheme = false;
  try { savedTheme = localStorage.getItem(storageKey) === 'on'; }
  catch (error) { /* Use the normal theme when storage is unavailable. */ }
  applyTheme(savedTheme);

  button.addEventListener('click', () => {
    applyTheme(!document.body.classList.contains('corvette-mode'));
  });
})();
