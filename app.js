(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const paper = $('paper');
  const overlay = $('overlay');
  const guides = $('guides');
  const rulers = $('rulers');
  const ctx = paper.getContext('2d');
  const octx = overlay.getContext('2d');
  const gctx = guides.getContext('2d');
  const rctx = rulers.getContext('2d');

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
  let currentFont = 'sans-serif';

  const W = () => paper.width;
  const H = () => paper.height;

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
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
      button.classList.toggle('active', button.dataset.tool === nextTool);
    });
    setStatus();
  }

  function point(event) {
    const rect = paper.getBoundingClientRect();
    let x = ((event.clientX - rect.left) * W()) / rect.width;
    let y = ((event.clientY - rect.top) * H()) / rect.height;

    if ($('snapToggle').checked) {
      if (guideX !== null && Math.abs(x - guideX) < 14) x = guideX;
      if (guideY !== null && Math.abs(y - guideY) < 14) y = guideY;
    }

    return {
      x: Math.max(0, Math.min(W() - 1, x)),
      y: Math.max(0, Math.min(H() - 1, y))
    };
  }

  function snapshot() {
    try {
      history.push(ctx.getImageData(0, 0, W(), H()));
      if (history.length > 40) history.shift();
      redoStack = [];
      updateButtons();
      scheduleSave();
    } catch (err) {
      console.warn('Snapshot failed', err);
    }
  }

  function updateButtons() {
    $('undoBtn').disabled = history.length === 0;
    $('redoBtn').disabled = redoStack.length === 0;
  }

  function resizeCanvas(width, height, preserve = true) {
    let temp = null;
    if (preserve && W() && H()) {
      temp = document.createElement('canvas');
      temp.width = W();
      temp.height = H();
      temp.getContext('2d').drawImage(paper, 0, 0);
    }

    [paper, overlay, guides, rulers].forEach((canvas) => {
      canvas.width = width;
      canvas.height = height;
    });

    if (temp) ctx.drawImage(temp, 0, 0);
    drawGuides();
  }

  function drawRulers() {
    rctx.clearRect(0, 0, W(), H());
    if (!showRulers) return;

    rctx.save();
    rctx.strokeStyle = 'rgba(50,60,75,0.6)';
    rctx.fillStyle = 'rgba(50,60,75,0.8)';
    rctx.font = '10px sans-serif';
    rctx.lineWidth = 1;

    for (let x = 0; x <= W(); x += 50) {
      rctx.beginPath();
      rctx.moveTo(x, 0);
      rctx.lineTo(x, 18);
      rctx.stroke();
      rctx.fillText(String(x), x + 4, 12);
    }

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
      gctx.strokeStyle = 'rgba(100,130,220,0.18)';
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
    rulers.style.display = showRulers ? 'block' : 'none';
    drawRulers();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const state = {
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
        localStorage.setItem('mpde-art', JSON.stringify(state));
      } catch (err) {
        console.warn('Save failed', err);
      }
    }, 400);
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
        $('sizeInput').value = String(size);
        $('sizeValue').textContent = `${size}px`;
        $('ghostOpacity').value = String(ghostOpacity);
        $('ghostValue').textContent = Number(ghostOpacity).toFixed(2);
        const fontSelect = $('fontSelect');
        if ([...fontSelect.options].some((opt) => opt.value === currentFont)) {
          fontSelect.value = currentFont;
        }
        selectTool(tool);
      };
      img.src = saved.image;
    } catch (err) {
      console.warn('Restore failed', err);
    }
  }

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
      octx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      if (fill) octx.fill();
      else octx.stroke();
    }
    octx.restore();
  }

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

    if (tool === 'eyedropper') {
      const data = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
      const [r, g, b] = data;
      color = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      $('colorInput').value = color;
      toast('Color picked');
      return;
    }

    if (tool === 'hand') {
      toast('Pan tool is a placeholder');
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
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
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

    if (['line', 'rect', 'ellipse'].includes(tool)) {
      ctx.drawImage(overlay, 0, 0);
      octx.clearRect(0, 0, W(), H());
      scheduleSave();
    } else if (tool === 'pencil' || tool === 'eraser') {
      scheduleSave();
    }

    if (event) {
      const p = point(event);
      $('coordStatus').textContent = `${Math.round(p.x)} × ${Math.round(p.y)} px`;
    }
  }

  function drawGhostImage() {
    if (!ghostImage) return;
    const scale = Math.min(W() / ghostImage.width, H() / ghostImage.height);
    const x = (W() - ghostImage.width * scale) / 2;
    const y = (H() - ghostImage.height * scale) / 2;
    const w = ghostImage.width * scale;
    const h = ghostImage.height * scale;

    ctx.save();
    ctx.globalAlpha = ghostOpacity;
    ctx.drawImage(ghostImage, x, y, w, h);
    ctx.restore();
  }

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
    size = Number(event.target.value);
    $('sizeValue').textContent = `${size}px`;
  });

  $('fillToggle').addEventListener('change', (event) => {
    fill = event.target.checked;
  });

  $('gridToggle').addEventListener('change', (event) => {
    showGrid = event.target.checked;
    drawGuides();
  });

  $('snapToggle').addEventListener('change', () => {});

  $('guideBtn').addEventListener('click', () => {
    showGuides = !showGuides;
    if (showGuides && guideX === null && guideY === null) {
      guideX = Math.round(W() / 2);
      guideY = Math.round(H() / 2);
    }
    drawGuides();
  });

  $('rulerBtn').addEventListener('click', () => {
    showRulers = !showRulers;
    drawGuides();
  });

  $('ghostOpacity').addEventListener('input', (event) => {
    ghostOpacity = Number(event.target.value);
    $('ghostValue').textContent = Number(ghostOpacity).toFixed(2);
    if (ghostImage) drawGhostImage();
  });

  $('undoBtn').addEventListener('click', () => {
    if (!history.length) return;
    redoStack.push(ctx.getImageData(0, 0, W(), H()));
    ctx.putImageData(history.pop(), 0, 0);
    updateButtons();
    scheduleSave();
    toast('Undid action');
  });

  $('redoBtn').addEventListener('click', () => {
    if (!redoStack.length) return;
    history.push(ctx.getImageData(0, 0, W(), H()));
    ctx.putImageData(redoStack.pop(), 0, 0);
    updateButtons();
    scheduleSave();
    toast('Redid action');
  });

  $('clearBtn').addEventListener('click', () => {
    if (!confirm('Clear the whole canvas?')) return;
    snapshot();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W(), H());
    scheduleSave();
    toast('Canvas cleared');
  });

  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset canvas to 1200x800?')) return;
    resizeCanvas(1200, 800, true);
    toast('Canvas reset');
  });

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
    $('saveModal').classList.remove('show');
    toast('Saved PNG');
  });

  $('exportBtn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = paper.toDataURL('image/png');
    link.download = `drawing-${Date.now()}.png`;
    link.click();
    toast('Exported PNG');
  });

  $('svgBtn').addEventListener('click', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${W()}" height="${H()}">
        <image href="${paper.toDataURL('image/png')}" width="${W()}" height="${H()}" />
      </svg>
    `;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported SVG');
  });

  $('gifBtn').addEventListener('click', async () => {
    if (!window.GIF) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.js';
      script.onload = () => {
        toast('GIF ready');
      };
      document.head.appendChild(script);
      return;
    }

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: W(),
      height: H(),
      workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js'
    });

    for (let i = 0; i < 5; i++) {
      const frame = document.createElement('canvas');
      frame.width = W();
      frame.height = H();
      const fctx = frame.getContext('2d');
      fctx.drawImage(paper, 0, 0);
      gif.addFrame(frame, { copy: true, delay: 120 });
    }

    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drawing-${Date.now()}.gif`;
      a.click();
      URL.revokeObjectURL(url);
      toast('GIF exported');
    });

    gif.render();
  });

  $('fontSelect').addEventListener('change', (event) => {
    currentFont = event.target.value;
    toast(`Font set: ${currentFont}`);
  });

  $('fontImportBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ttf,.otf,.woff,.woff2';
    input.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const fontUrl = URL.createObjectURL(file);
      const fontName = file.name.replace(/\.[^.]+$/, '');
      const face = new FontFace(fontName, `url(${fontUrl})`);
      try {
        await face.load();
        document.fonts.add(face);
        currentFont = fontName;
        const select = $('fontSelect');
        if (![...select.options].some((opt) => opt.value === fontName)) {
          select.add(new Option(fontName, fontName));
        }
        select.value = fontName;
        toast(`Loaded ${fontName}`);
      } catch (err) {
        toast('Font load failed');
      }
    });
    input.click();
  });

  $('ghostImportBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          ghostImage = img;
          drawGhostImage();
          toast('Ghost image loaded');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
    input.click();
  });

  $('loadBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          snapshot();
          ctx.clearRect(0, 0, W(), H());
          const scale = Math.min(W() / img.width, H() / img.height);
          const x = (W() - img.width * scale) / 2;
          const y = (H() - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          scheduleSave();
          toast('Image loaded');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
    input.click();
  });

  paper.addEventListener('pointerdown', handlePointerDown);
  paper.addEventListener('pointermove', handlePointerMove);
  paper.addEventListener('pointerup', handlePointerUp);
  paper.addEventListener('pointercancel', handlePointerUp);

  resizeCanvas(1200, 800, false);
  drawGuides();
  restore();
  updateButtons();
  setStatus();
})();
