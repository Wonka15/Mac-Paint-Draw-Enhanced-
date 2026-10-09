/*
  Mac Paint Draw Enhanced
  ----------------------

  This file is the heart of the app.

  Think of it like a Python script that runs when the page loads:
  - grab the canvas and buttons
  - track the current color and tool
  - allow drawing with mouse or touch
  - save the drawing to local storage
  - export the drawing as a PNG

  The comments are written to be beginner-friendly.
*/

(() => {
  'use strict';

  // ---------------------------------------------------------------
  // 1) Get references to the HTML elements we need
  // ---------------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  const paper = $('paper');
  const art = $('art');
  const overlay = $('overlay');
  const guides = $('guides');
  const rulerCanvas = $('rulers');

  const ctx = paper.getContext('2d');
  const octx = overlay.getContext('2d');
  const gctx = guides.getContext('2d');
  const rctx = rulerCanvas.getContext('2d');

  // ---------------------------------------------------------------
  // 2) State variables for the app
  // ---------------------------------------------------------------
  let tool = 'pencil';
  let color = '#20252b';
  let size = 4;
  let fill = false;
  let drawing = false;
  let start = null;
  let last = null;
  let history = [];
  let redoStack = [];
  let showGuides = false;
  let showGrid = false;
  let showRulers = false;
  let guideX = null;
  let guideY = null;
  let saveTimer = null;

  let ghostImage = null;
  let ghostOpacity = 0.35;

  let gifFrames = [];
  let gifRecording = false;

  let currentFont = 'sans-serif';

  // ---------------------------------------------------------------
  // 3) Small helper functions
  // ---------------------------------------------------------------
  const W = () => paper.width;
  const H = () => paper.height;

  function toast(message) {
    const t = $('toast');
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function setStatus() {
    const names = {
      pencil: 'Pencil',
      eraser: 'Eraser',
      line: 'Line',
      rect: 'Rectangle',
      ellipse: 'Oval',
      text: 'Text',
      eyedropper: 'Pick color',
      hand: 'Pan'
    };

    $('toolStatus').innerHTML = `<strong>Tool:</strong> ${names[tool] || tool}`;
  }

  function selectTool(nextTool) {
    tool = nextTool;

    document.querySelectorAll('.tool').forEach((button) => {
      const isActive = button.dataset.tool === nextTool;
      button.classList.toggle('active', isActive);
    });

    setStatus();
  }

  function point(event) {
    const rect = paper.getBoundingClientRect();
    let x = ((event.clientX - rect.left) * W()) / rect.width;
    let y = ((event.clientY - rect.top) * H()) / rect.height;

    if ($('snapCheck').checked) {
      if (guideX !== null && Math.abs(x - guideX) < 14) x = guideX;
      if (guideY !== null && Math.abs(y - guideY) < 14) y = guideY;
    }

    return {
      x: Math.max(0, Math.min(W() - 1, x)),
      y: Math.max(0, Math.min(H() - 1, y))
    };
  }

  // ---------------------------------------------------------------
  // 4) Undo / redo system
  // ---------------------------------------------------------------
  function snapshot() {
    try {
      history.push(ctx.getImageData(0, 0, W(), H()));
      if (history.length > 40) history.shift();
      redoStack = [];
      updateUndoButtons();
      scheduleSave();
    } catch (error) {}
  }

  function updateUndoButtons() {
    $('undoBtn').disabled = !history.length;
    $('redoBtn').disabled = !redoStack.length;
  }

  // ---------------------------------------------------------------
  // 5) Canvas resizing and guide drawing
  // ---------------------------------------------------------------
  function resizeCanvas(width, height, preserve = true) {
    let tempCanvas = null;

    if (preserve && W() && H()) {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = W();
      tempCanvas.height = H();
      tempCanvas.getContext('2d').drawImage(paper, 0, 0);
    }

    [paper, art, overlay, guides, rulerCanvas].forEach((canvas) => {
      canvas.width = width;
      canvas.height = height;
    });

    if (tempCanvas) {
      ctx.drawImage(tempCanvas, 0, 0);
    }

    drawGuides();
  }

  function drawRulers() {
    rctx.clearRect(0, 0, W(), H);
    if (!showRulers) return;

    rctx.save();
    rctx.strokeStyle = 'rgba(48, 64, 90, 0.4)';
    rctx.fillStyle = 'rgba(48, 64, 90, 0.7)';
    rctx.lineWidth = 1;
    rctx.font = '10px sans-serif';

    // Horizontal ruler
    for (let x = 0; x <= W(); x += 50) {
      rctx.beginPath();
      rctx.moveTo(x, 0);
      rctx.lineTo(x, 18);
      rctx.stroke();
      rctx.fillText(String(x), x + 4, 12);
    }

    // Vertical ruler
    for (let y = 0; y <= H(); y += 50) {
      rctx.beginPath();
      rctx.moveTo(0, y);
      rctx.lineTo(18, y);
      rctx.stroke();
      rctx.fillText(String(y), 4, y + 12);
    }

    rctx.restore();
  }

  function drawGuides() {
    gctx.clearRect(0, 0, W(), H());

    if (showGrid) {
      gctx.save();
      gctx.strokeStyle = '#6b8bd522';
      gctx.lineWidth = 1;

      for (let x = 50; x < W(); x += 50) {
        gctx.beginPath();
        gctx.moveTo(x, 0);
        gctx.lineTo(x, H());
        gctx.stroke();
      }

      for (let y = 50; y < H(); y += 50) {
        gctx.beginPath();
        gctx.moveTo(0, y);
        gctx.lineTo(W(), y);
        gctx.stroke();
      }

      gctx.restore();
    }

    if (showGuides) {
      gctx.save();
      gctx.strokeStyle = '#315cdb';
      gctx.lineWidth = 1;
      gctx.setLineDash([5, 5]);

      if (guideX !== null) {
        gctx.beginPath();
        gctx.moveTo(guideX, 0);
        gctx.lineTo(guideX, H());
        gctx.stroke();
      }

      if (guideY !== null) {
        gctx.beginPath();
        gctx.moveTo(0, guideY);
        gctx.lineTo(W(), guideY);
        gctx.stroke();
      }

      gctx.restore();
    }

    guides.style.display = (showGuides || showGrid) ? 'block' : 'none';
    drawRulers();
  }

  // ---------------------------------------------------------------
  // 6) Local save and restore
  // ---------------------------------------------------------------
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const savedState = {
          w: W(),
          h: H(),
          image: paper.toDataURL('image/png'),
          color,
          size,
          tool,
          guideX,
          guideY,
          ghostOpacity,
          currentFont
        };

        localStorage.setItem('mpde-art', JSON.stringify(savedState));
      } catch (error) {}
    }, 500);
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem('mpde-art'));
      if (!saved || !saved.image) return;

      const img = new Image();
      img.onload = () => {
        resizeCanvas(saved.w, saved.h, false);
        ctx.drawImage(img, 0, 0);

        color = saved.color || color;
        size = saved.size || size;
        tool = saved.tool || tool;
        guideX = saved.guideX || null;
        guideY = saved.guideY || null;
        ghostOpacity = saved.ghostOpacity || ghostOpacity;
        currentFont = saved.currentFont || currentFont;

        $('colorInput').value = color;
        $('sizeInput').value = size;
        $('sizeDisplay').textContent = `${size}px`;
        $('ghostOpacity').value = ghostOpacity;
        document.body.style.setProperty('--font-family', currentFont);
        selectTool(tool);
        drawGuides();
      };

      img.src = saved.image;
    } catch (error) {}
  }

  // ---------------------------------------------------------------
  // 7) Shape drawing logic
  // ---------------------------------------------------------------
  function drawShape(currentPoint) {
    octx.clearRect(0, 0, W(), H());
    octx.save();
    octx.strokeStyle = color;
    octx.fillStyle = color;
    octx.lineWidth = size;
    octx.lineCap = 'round';
    octx.lineJoin = 'round';

    const left = Math.min(start.x, currentPoint.x);
    const top = Math.min(start.y, currentPoint.y);
    const width = Math.abs(start.x - currentPoint.x);
    const height = Math.abs(start.y - currentPoint.y);

    if (tool === 'line') {
      octx.beginPath();
      octx.moveTo(start.x, start.y);
      octx.lineTo(currentPoint.x, currentPoint.y);
      octx.stroke();
    } else if (tool === 'rect') {
      if (fill) octx.fillRect(left, top, width, height);
      else octx.strokeRect(left, top, width, height);
    } else if (tool === 'ellipse') {
      octx.beginPath();
      octx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI);

      if (fill) octx.fill();
      else octx.stroke();
    }

    octx.restore();
  }

  // ---------------------------------------------------------------
  // 8) Mouse and touch events
  // ---------------------------------------------------------------
  function handlePointerDown(event) {
    event.preventDefault();
    const p = point(event);
    $('coordStatus').textContent = `${Math.round(p.x)} × ${Math.round(p.y)} px`;

    if (tool === 'text') {
      const text = prompt('What would you like to write?');
      if (text) {
        snapshot();
        ctx.fillStyle = color;
        ctx.font = `${size * 2}px ${currentFont}`;
        ctx.fillText(text, p.x, p.y);
        scheduleSave();
      }
      return;
    }

    if (tool === 'hand') return;

    if (tool === 'eyedropper') {
      const imageData = ctx.getImageData(p.x, p.y, 1, 1);
      const [r, g, b] = imageData.data;
      color = '#' + [r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('');
      $('colorInput').value = color;
      toast('Color picked!');
      return;
    }

    drawing = true;
    start = p;
    last = p;
    snapshot();
  }

  function handlePointerMove(event) {
    if (!drawing) return;

    const p = point(event);
    $('coordStatus').textContent = `${Math.round(p.x)} × ${Math.round(p.y)} px`;

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = tool === 'eraser' ? 'white' : color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      last = p;
    } else if (['line', 'rect', 'ellipse'].includes(tool)) {
      drawShape(p);
    }
  }

  function handlePointerUp(event) {
    if (!drawing) return;

    drawing = false;
    const p = point(event);

    if (['line', 'rect', 'ellipse'].includes(tool)) {
      ctx.drawImage(overlay, 0, 0);
      octx.clearRect(0, 0, W(), H());
      scheduleSave();
    }

    if (tool === 'pencil' || tool === 'eraser') {
      scheduleSave();
    }

    if (p) {
      $('coordStatus').textContent = `${Math.round(p.x)} × ${Math.round(p.y)} px`;
    }
  }

  // ---------------------------------------------------------------
  // 9) Buttons and controls
  // ---------------------------------------------------------------
  document.querySelectorAll('.tool').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.tool));
  });

  document.querySelectorAll('.swatch').forEach((button) => {
    button.addEventListener('click', () => {
      color = button.dataset.color;
      $('colorInput').value = color;
    });
  });

  $('colorInput').addEventListener('input', (event) => {
    color = event.target.value;
  });

  $('sizeInput').addEventListener('input', (event) => {
    size = parseInt(event.target.value, 10);
    $('sizeDisplay').textContent = `${size}px`;
  });

  $('fillCheck').addEventListener('change', (event) => {
    fill = event.target.checked;
  });

  $('guidesBtn').addEventListener('click', () => {
    showGuides = !showGuides;
    $('guidesBtn').setAttribute('aria-pressed', showGuides);

    if (showGuides && guideX === null && guideY === null) {
      guideX = Math.round(W() / 2);
      guideY = Math.round(H() / 2);
    }

    drawGuides();
  });

  $('gridCheck').addEventListener('change', (event) => {
    showGrid = event.target.checked;
    drawGuides();
  });

  $('rulerBtn').addEventListener('click', () => {
    showRulers = !showRulers;
    drawGuides();
    toast(showRulers ? 'Rulers on' : 'Rulers off');
  });

  $('ghostOpacity').addEventListener('input', (event) => {
    ghostOpacity = Number(event.target.value);
    $('ghostValue').textContent = ghostOpacity.toFixed(2);
    if (ghostImage) {
      drawGhostLayer();
    }
  });

  $('undoBtn').addEventListener('click', () => {
    if (!history.length) return;

    redoStack.push(ctx.getImageData(0, 0, W(), H()));
    ctx.putImageData(history.pop(), 0, 0);
    updateUndoButtons();
    scheduleSave();
    toast('Undid action');
  });

  $('redoBtn').addEventListener('click', () => {
    if (!redoStack.length) return;

    history.push(ctx.getImageData(0, 0, W(), H()));
    ctx.putImageData(redoStack.pop(), 0, 0);
    updateUndoButtons();
    scheduleSave();
    toast('Redid action');
  });

  $('clearBtn').addEventListener('click', () => {
    if (!confirm('Clear the whole canvas? You can undo this.')) return;

    snapshot();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W(), H());
    scheduleSave();
    toast('Canvas cleared');
  });

  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset canvas size to 1200×800?')) return;
    resizeCanvas(1200, 800, true);
    toast('Canvas reset');
  });

  // ---------------------------------------------------------------
  // 10) Save, export, and load features
  // ---------------------------------------------------------------
  $('saveBtn').addEventListener('click', () => {
    $('saveModal').classList.add('show');
    $('saveName').focus();
  });

  $('cancelSaveBtn').addEventListener('click', () => {
    $('saveModal').classList.remove('show');
  });

  $('confirmSaveBtn').addEventListener('click', () => {
    const name = $('saveName').value || 'drawing';
    const link = document.createElement('a');
    link.href = paper.toDataURL('image/png');
    link.download = `${name}-${Date.now()}.png`;
    link.click();

    toast(`Saved: ${name}`);
    $('saveModal').classList.remove('show');
    $('saveName').value = '';
  });

  $('exportBtn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = paper.toDataURL('image/png');
    link.download = `mac-paint-${Date.now()}.png`;
    link.click();
    toast('Exported as PNG');
  });

  $('svgExportBtn').addEventListener('click', () => {
    const pngData = paper.toDataURL('image/png');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${W()}" height="${H()}">
        <image href="${pngData}" width="${W()}" height="${H()}" preserveAspectRatio="xMidYMid meet"/>
      </svg>
    `;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mac-paint-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Exported as SVG');
  });

  $('gifRecordBtn').addEventListener('click', () => {
    if (!window.GIF) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.js';
      script.onload = () => {
        $('gifRecordBtn').click();
      };
      document.head.appendChild(script);
      return;
    }

    if (!gifRecording) {
      gifRecording = true;
      gifFrames = [];
      $('gifRecordBtn').textContent = 'Stop Recording';
      toast('GIF recording started');
      return;
    }

    gifRecording = false;
    $('gifRecordBtn').textContent = 'Record GIF';

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js',
      width: W(),
      height: H()
    });

    gifFrames.forEach((frame) => gif.addFrame(frame, { copy: true, delay: 80 }));
    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mac-paint-${Date.now()}.gif`;
      a.click();
      URL.revokeObjectURL(url);
      toast('GIF exported');
    });

    gif.render();
  });

  $('loadBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const img = new Image();
        img.onload = () => {
          snapshot();
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, W(), H());

          const scale = Math.min(W() / img.width, H() / img.height);
          const x = (W() - img.width * scale) / 2;
          const y = (H() - img.height * scale) / 2;

          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          scheduleSave();
          toast('Image loaded');
        };

        img.src = loadEvent.target.result;
      };

      reader.readAsDataURL(file);
    });

    input.click();
  });

  $('ghostImport').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const img = new Image();
        img.onload = () => {
          ghostImage = img;
          drawGhostLayer();
          toast('Ghost image loaded');
        };
        img.src = loadEvent.target.result;
      };

      reader.readAsDataURL(file);
    });

    input.click();
  });

  $('fontImport').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ttf,.otf,.woff,.woff2';

    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const fontUrl = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^.]+$/, '');
      const fontFace = new FontFace(name, `url(${fontUrl})`);

      fontFace.load().then(() => {
        document.fonts.add(fontFace);
        currentFont = name;
        $('fontSelect').value = name;
        $('fontSelect').append(new Option(name, name));
        toast(`${name} loaded`);
      }).catch(() => {
        toast('Font could not be loaded');
      });
    });

    input.click();
  });

  $('fontSelect').addEventListener('change', (event) => {
    currentFont = event.target.value;
    document.body.style.setProperty('--font-family', currentFont);
    toast(`Font changed to ${currentFont}`);
  });

  function drawGhostLayer() {
    if (!ghostImage) return;
    const ghostCanvas = document.createElement('canvas');
    ghostCanvas.width = W();
    ghostCanvas.height = H();
    const g = ghostCanvas.getContext('2d');
    g.clearRect(0, 0, W(), H());
    g.globalAlpha = ghostOpacity;
    const scale = Math.min(W() / ghostImage.width, H() / ghostImage.height);
    const x = (W() - ghostImage.width * scale) / 2;
    const y = (H() - ghostImage.height * scale) / 2;
    g.drawImage(ghostImage, x, y, ghostImage.width * scale, ghostImage.height * scale);

    const imageData = ghostCanvas.toDataURL('image/png');
    const overlayImage = new Image();
    overlayImage.onload = () => {
      ctx.save();
      ctx.globalAlpha = ghostOpacity;
      ctx.drawImage(overlayImage, x, y, ghostImage.width * scale, ghostImage.height * scale);
      ctx.restore();
    };
    overlayImage.src = imageData;
  }

  function recordFrame() {
    if (!gifRecording) return;
    gifFrames.push(paper.toCanvas ? paper.toCanvas() : paper);
  }

  // ---------------------------------------------------------------
  // 11) Connect pointer events to drawing functions
  // ---------------------------------------------------------------
  paper.addEventListener('pointerdown', handlePointerDown);
  paper.addEventListener('pointermove', handlePointerMove);
  paper.addEventListener('pointerup', handlePointerUp);
  paper.addEventListener('pointercancel', handlePointerUp);

  setInterval(() => {
    if (gifRecording) {
      gifFrames.push(paper.toDataURL('image/webp', 0.8));
    }
  }, 120);

  // ---------------------------------------------------------------
  // 12) Start the app
  // ---------------------------------------------------------------
  resizeCanvas(1200, 800, false);
  restore();
  setStatus();
})();
