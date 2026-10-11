/*
 * Macintosh SE desk radio.
 * Playback starts only after POWER is clicked. Switching stations always stops
 * the previous player first, preventing overlapping audio streams.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('seRadio');
  if (!root) return;

  const launch = $('seRadioLaunch'), panel = $('seRadioPanel');
  const power = $('seRadioPower'), powerText = $('seRadioPowerText');
  const status = $('seRadioStatus'), player = $('seRadioPlayer');
  const dragHandle = $('seRadioDrag'), track = $('seRadioTrack');

  // Prefer official HTTPS direct streams. The old ice1 SomaFM hostnames
  // were unreliable; use current official ice5 endpoints instead.
  const stations = [
    { name: 'LO-FI GIRL • OFFICIAL STUDY RADIO', short: 'LO-FI LIVE', frequency: '88.6', type: 'youtube', id: 'X4VbdwhkE10' },
    { name: 'ALL CLASSICAL • MOZART & DEBUSSY', short: 'CLASSICAL', frequency: '101.2', type: 'audio', url: 'https://allclassical.streamguys1.com/ac128kmp3' },
    // Official KZSC 88.1 FM high-quality 128 kbps MP3 stream from UC Santa Cruz.
    { name: 'KZSC • UC SANTA CRUZ 88.1 FM', short: 'KZSC 88.1 FM', frequency: '88.1', type: 'audio', url: 'https://kzscfms1-geckohost.radioca.st/kzschigh' },
    { name: 'SOMAFM • GROOVE SALAD', short: 'GROOVE SALAD', frequency: '90.1', type: 'audio', url: 'https://ice5.somafm.com/groovesalad-128-mp3' },
    { name: 'SOMAFM • DRONE ZONE', short: 'DRONE ZONE', frequency: '90.7', type: 'audio', url: 'https://ice5.somafm.com/dronezone-128-mp3' },
    { name: 'SOMAFM • SPACE STATION SOMA', short: 'SPACE STATION', frequency: '91.4', type: 'audio', url: 'https://ice5.somafm.com/spacestation-128-mp3' },
    { name: 'SOMAFM • GROOVE SALAD CLASSIC', short: 'SALAD CLASSIC', frequency: '92.0', type: 'audio', url: 'https://ice5.somafm.com/gsclassic-128-mp3' },
    { name: 'SOMAFM • LUSH', short: 'LUSH', frequency: '94.0', type: 'audio', url: 'https://ice5.somafm.com/lush-128-mp3' },
    { name: 'SOMAFM • BEAT BLENDER', short: 'BEAT BLENDER', frequency: '94.6', type: 'audio', url: 'https://ice5.somafm.com/beatblender-128-mp3' },
    { name: 'SOMAFM • SYN PHAERA RADIO', short: 'SYN PHAERA', frequency: '95.1', type: 'audio', url: 'https://ice5.somafm.com/synphaera-128-mp3' },
    { name: 'RADIO PARADISE • ECLECTIC MIX', short: 'RADIO PARADISE', frequency: '96.5', type: 'audio', url: 'https://stream.radioparadise.com/mp3-128' },
    { name: 'SOMAFM • UNDERGROUND 80S', short: 'UNDERGROUND 80S', frequency: '80.8', type: 'audio', url: 'https://ice5.somafm.com/u80s-128-mp3' },
    { name: '80S80S • REAL 80S RADIO', short: '80S80S RADIO', frequency: '80.0', type: 'audio', url: 'https://streams.80s80s.de/web/mp3-128/streams.80s80s.de/' }
  ];
  let stationIndex = 0, playing = false, dragState = null;

  function openPanel(open) {
    panel.hidden = !open;
    launch.setAttribute('aria-expanded', String(open));
  }

  function renderStation() {
    const station = stations[stationIndex];
    track.textContent = station.name;
    const frequency = root.querySelector('.se-radio-frequency strong');
    if (frequency) frequency.textContent = station.frequency;
    root.dataset.station = String(stationIndex);
  }

  function setStatus(isPlaying, message) {
    playing = isPlaying;
    root.classList.toggle('is-playing', isPlaying);
    power.setAttribute('aria-pressed', String(isPlaying));
    powerText.textContent = isPlaying ? 'POWER ON' : 'POWER OFF';
    status.textContent = message || (isPlaying ? 'CONNECTING…' : 'STANDBY');
  }

  function stopPlayback() {
    // Remove the player node as well as pausing it; this also stops YouTube audio.
    player.querySelectorAll('audio').forEach(audio => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
    player.replaceChildren();
    player.hidden = true;
    setStatus(false, 'STANDBY');
  }

  function startPlayback() {
    const station = stations[stationIndex];
    player.replaceChildren();
    player.hidden = false;
    setStatus(true, 'CONNECTING…');

    if (station.type === 'youtube') {
      const frame = document.createElement('iframe');
      frame.title = station.name + ' YouTube player';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.loading = 'eager';
      frame.src = 'https://www.youtube.com/embed/' + station.id
        + '?autoplay=1&playsinline=1&rel=0&modestbranding=1';
      frame.addEventListener('load', () => {
        if (playing && stations[stationIndex] === station) setStatus(true, 'PLAYER LOADED · ' + station.short);
      });
      player.appendChild(frame);
      return;
    }

    // Native audio is more reliable for a direct radio feed than embedding a video.
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.autoplay = true;
    audio.preload = 'none';
    audio.src = station.url;
    audio.setAttribute('aria-label', station.name);
    audio.addEventListener('playing', () => {
      if (playing && stations[stationIndex] === station) setStatus(true, 'ON AIR · ' + station.short);
    });
    audio.addEventListener('error', () => {
      if (stations[stationIndex] === station) setStatus(true, 'STREAM UNAVAILABLE · TRY AGAIN');
    });
    player.appendChild(audio);
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => setStatus(true, 'PRESS PLAY IN THE PLAYER'));
    }
  }

  function changeStation(direction) {
    const resume = playing;
    stopPlayback();
    stationIndex = (stationIndex + direction + stations.length) % stations.length;
    renderStation();
    if (resume) startPlayback();
  }

  launch.addEventListener('click', () => openPanel(panel.hidden));
  $('seRadioClose').addEventListener('click', () => openPanel(false));
  power.addEventListener('click', () => {
    openPanel(true);
    if (playing) stopPlayback();
    else startPlayback();
  });
  $('seRadioPrev').addEventListener('click', () => changeStation(-1));
  $('seRadioNext').addEventListener('click', () => changeStation(1));

  // Only drag from the title bar, and ignore its buttons so Close stays clickable.
  dragHandle.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    const rect = root.getBoundingClientRect();
    dragState = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    dragHandle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  dragHandle.addEventListener('pointermove', event => {
    if (!dragState || event.pointerId !== dragState.id) return;
    const left = Math.max(0, Math.min(window.innerWidth - root.offsetWidth, dragState.left + event.clientX - dragState.x));
    const top = Math.max(0, Math.min(window.innerHeight - root.offsetHeight, dragState.top + event.clientY - dragState.y));
    root.style.left = left + 'px';
    root.style.top = top + 'px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  });
  const stopDragging = () => { dragState = null; };
  dragHandle.addEventListener('pointerup', stopDragging);
  dragHandle.addEventListener('pointercancel', stopDragging);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) openPanel(false);
  });

  renderStation();
  openPanel(false);
  stopPlayback();
})();
