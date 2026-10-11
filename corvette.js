/* Toggle the C4 Corvette dashboard / Timex Indiglo-inspired EL night palette. */
(() => {
  'use strict';
  const button = document.getElementById('corvetteModeBtn');
  if (!button) return;
  const key = 'mpde-corvette-mode';
  const apply = enabled => {
    document.body.classList.toggle('corvette-mode', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? '◉ Corvette ON' : '◉ Corvette';
    button.title = enabled
      ? 'Turn off C4 Corvette / Timex Indiglo night styling'
      : 'Turn on C4 Corvette dashboard / Timex Indiglo styling';
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch (_) {}
  };
  let enabled = false;
  try { enabled = localStorage.getItem(key) === 'on'; } catch (_) {}
  apply(enabled);
  button.addEventListener('click', () => apply(!document.body.classList.contains('corvette-mode')));
})();
