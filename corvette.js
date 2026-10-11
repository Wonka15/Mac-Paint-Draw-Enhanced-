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
      '<div class="c4-gauge"><span class="c4-gauge-label">LOCAL TIME</span><strong id="c4Clock">--:--</strong><small id="c4Date">SYNCING CLOCK</small><i aria-hidden="true"></i></div>',
      '<div class="c4-gauge"><span class="c4-gauge-label">DEVICE POWER</span><strong id="c4BatteryValue">--</strong><small id="c4BatteryLabel">BATTERY STATUS</small><div class="c4-battery-track" aria-hidden="true"><span id="c4BatteryFill"></span></div></div>',
      '<div class="c4-gauge"><span class="c4-gauge-label">LOCAL WEATHER</span><strong id="c4WeatherValue">--°</strong><small id="c4WeatherLabel">LOCATION NOT SHARED</small><button type="button" class="c4-weather-button" id="c4WeatherButton">GET WEATHER</button></div>',
      '<div class="c4-dash-right"><span class="c4-indiglo-led" aria-hidden="true"></span><strong>EL BLUE</strong><small>BLUE NIGHT ILLUMINATION</small><span class="c4-dash-rule" aria-hidden="true"></span><div class="c4-warning-bars" aria-label="Decorative C4-inspired color bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><small>BLUE · AMBER · RED</small></div>'
    ].join('');
    document.querySelector('.topbar')?.insertAdjacentElement('afterend', dashboard);
    return dashboard;
  }
  const dashboard = document.getElementById('corvetteDash') || makeDashboard();
  const clock = dashboard.querySelector('#c4Clock'), date = dashboard.querySelector('#c4Date');
  const batteryValue = dashboard.querySelector('#c4BatteryValue'), batteryLabel = dashboard.querySelector('#c4BatteryLabel'), batteryFill = dashboard.querySelector('#c4BatteryFill');
  const weatherValue = dashboard.querySelector('#c4WeatherValue'), weatherLabel = dashboard.querySelector('#c4WeatherLabel'), weatherButton = dashboard.querySelector('#c4WeatherButton');
  function updateClock() {
    const now = new Date();
    if (clock) clock.textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    if (date) date.textContent = now.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'}).toUpperCase();
  }
  updateClock();
  window.setInterval(updateClock, 1000);
  // Battery reporting is browser-dependent; never invent a percentage.
  async function updateBattery() {
    if (!navigator.getBattery) {
      if (batteryValue) batteryValue.textContent = 'N/A';
      if (batteryLabel) batteryLabel.textContent = 'BROWSER UNSUPPORTED';
      return;
    }
    try {
      const battery = await navigator.getBattery();
      const render = () => {
        const percent = Math.round(battery.level * 100);
        if (batteryValue) batteryValue.textContent = percent + '%';
        if (batteryLabel) batteryLabel.textContent = battery.charging ? 'CHARGING' : 'DEVICE BATTERY';
        if (batteryFill) {
          batteryFill.style.width = percent + '%';
          batteryFill.dataset.level = percent <= 15 ? 'low' : percent <= 35 ? 'medium' : 'normal';
        }
      };
      render();
      battery.addEventListener('levelchange', render);
      battery.addEventListener('chargingchange', render);
    } catch (error) {
      if (batteryValue) batteryValue.textContent = 'N/A';
      if (batteryLabel) batteryLabel.textContent = 'STATUS UNAVAILABLE';
    }
  }
  updateBattery();
  // Weather is opt-in: ask for location only when the visitor clicks the button.
  const codes = {0:'CLEAR SKY',1:'MOSTLY CLEAR',2:'PARTLY CLOUDY',3:'CLOUDY',45:'FOG',48:'RIME FOG',51:'LIGHT DRIZZLE',53:'DRIZZLE',55:'HEAVY DRIZZLE',61:'LIGHT RAIN',63:'RAIN',65:'HEAVY RAIN',71:'LIGHT SNOW',73:'SNOW',75:'HEAVY SNOW',80:'SHOWERS',81:'RAIN SHOWERS',82:'HEAVY SHOWERS',95:'THUNDERSTORM',96:'THUNDERSTORM + HAIL',99:'SEVERE THUNDERSTORM'};
  const weatherMessage = message => { if (weatherLabel) weatherLabel.textContent = message; };
  if (weatherButton) weatherButton.addEventListener('click', () => {
    if (!navigator.geolocation) { weatherMessage('GEOLOCATION UNSUPPORTED'); return; }
    weatherButton.disabled = true; weatherButton.textContent = 'CHECKING…'; weatherMessage('REQUESTING LOCATION PERMISSION');
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const {latitude,longitude} = position.coords;
        const url = 'https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(latitude)+'&longitude='+encodeURIComponent(longitude)+'&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather request failed');
        const data = await response.json();
        if (weatherValue) weatherValue.textContent = Math.round(data.current.temperature_2m)+'°F';
        weatherMessage(codes[data.current.weather_code] || 'CURRENT CONDITIONS');
        weatherButton.textContent = 'REFRESH';
      } catch (error) { weatherMessage('WEATHER UNAVAILABLE'); weatherButton.textContent = 'TRY AGAIN'; }
      finally { weatherButton.disabled = false; }
    }, error => {
      weatherMessage(error.code === 1 ? 'LOCATION PERMISSION DENIED' : 'LOCATION UNAVAILABLE');
      weatherButton.disabled = false; weatherButton.textContent = 'TRY AGAIN';
    }, {enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  });
  function applyTheme(enabled) {
    document.body.classList.toggle('corvette-mode', enabled); dashboard.hidden = !enabled;
    button.setAttribute('aria-pressed',String(enabled)); button.textContent = enabled ? '◉ Corvette ON' : '◉ Corvette';
    button.title = enabled ? 'Turn off C4 Corvette blue night dashboard styling' : 'Turn on C4 Corvette blue night dashboard styling';
    try { localStorage.setItem(storageKey,enabled?'on':'off'); } catch (error) { console.debug('Could not save Corvette theme preference.',error); }
  }
  let savedTheme = false;
  try { savedTheme = localStorage.getItem(storageKey)==='on'; } catch (error) {}
  applyTheme(savedTheme);
  button.addEventListener('click',()=>applyTheme(!document.body.classList.contains('corvette-mode')));
})();