/*
  ===============================================================================
  Mac Paint Draw Enhanced — App Logic
  ===============================================================================

  This file handles the drawing behavior, tool actions, history, local save/load,
  export, and support for mobile-friendly pointer input.

  Comments are grouped by feature so it is easier to understand and maintain.
*/

(() => {
  'use strict';

  // --- DOM references --------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const paper = $('paper');
  const art = $('art');
  const overlay = $('overlay');
  const guides = $('guides');
  const ctx = paper.getContext('2d');
  const octx = overlay.getContext('2d');
  const gctx = guides.getContext('2d');

  // --- Tool state ------------------------------------------------------------
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
  let guideX = null;
  let guideY = null;
  let saveTimer = null;

  // --- Utility helpers -------------------------------------------------------
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

  function point(e) {
    const rect = paper.getBoundingClientRect();
    let x = ((e.clientX - rect.left) * W()) / rect.width;
    let y = ((e.clientY - rect.top) * H()) / rect.height;

    if ($('snapCheck').checked) {
      if (guideX !== null && Math.abs(x - guideX) < 14) x = guideX;
      if (guideY !== null && Math.abs(y - guideY) < 14) y = guideY;
    }

    return {
      x: Math.max(0, Math.min(W() - 1, x)),
      y: Math.max(0, Math.min(H() - 1, y))
    };
  }

  // --- History / undo redos --------------------------------------------------
  function snapshot() {
    try {
      history.push(ctx.getImageData(0, 0, W(), H()));
      if (history.length > 40) history.shift();
      redoStack = [];
      updateUndo();
      scheduleSave();
    } catch (error) {}
  }

  function updateUndo() {
    $('undoBtn').disabled = !history.length;
    $('redoBtn').disabled = !redoStack.length;
  }

  // --- Canvas resize / guide drawing -----------------------------------------
  function resizeCanvas(width, height, preserve = true) {
    let oldCanvas = null;

    if (preserve && W() && H()) {
      oldCanvas = document.createElement('canvas');
      oldCanvas.width = W();
      oldCanvas.height = H();
      oldCanvas.getContext('2d').drawImage(paper, 0, 0);
    }

    [paper, art, overlay, guides].forEach((canvas) => {
      canvas.width = width;
      canvas.height = height;
    });

    if (oldCanvas) {
      ctx.drawImage(oldCanvas, 0, 0);
    }

    drawGuides();
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
  }

  // --- Local save / restore ---------------------------------------------------
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem('mpde-art', JSON.stringify({
          w: W(),
          h: H(),
          image: paper.toDataURL('image/png'),
          color,
          size,
          tool,
          guideX,
          guideY
        }));
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

        $('colorInput').value = color;
        $('sizeInput').value = size;
        $('sizeDisplay').textContent = `${size}px`;
        selectTool(tool);
        drawGuides();
      };
      img.src = saved.image;
    } catch (error) {}
  }

  // --- Shape rendering -------------------------------------------------------
  function drawShape(currentPoint) {
    octx.clearRect(0, 0, W(), H());
    octx.save();
    octx.strokeStyle = color;
    octx.fillStyle = color;
    octx.lineWidth = size;
    octx.lineCap = 'round';
    octx.lineJoin = 'round';

    const x = Math.min(start.x, currentPoint.x);
    const y = Math.min(start.y, currentPoint.y);
    const width = Math.abs(start.x - currentPoint.x);
    const height = Math.abs(start.y - currentPoint.y);

    if (tool === 'line') {
      octx.beginPath();
      octx.moveTo(start.x, start.y);
      octx.lineTo(currentPoint.x, currentPoint.y);
      octx.stroke();
    } else if (tool === 'rect') {
      if (fill) octx.fillRect(x, y, width, height);
      else octx.strokeRect(x, y, width, height);
    } else if (tool === 'ellipse') {
      octx.beginPath();
      octx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI);
      if (fill) octx.fill();
      else octx.stroke();
    }

    octx.restore();
  }

  // --- Pointer interactions ---------------------------------------------------
  function handlePointerDown(e) {
    e.preventDefault();
    const p = point(e);
    $('coordStatus').textContent = `${Math.round(p.x)} × ${Math.round(p.y)} px`;

    if (tool === 'text') {
      const text = prompt('What would you like to write?');
      if (text) {
        snapshot();
        ctx.fillStyle = color;
        ctx.font = `${size * 2}px sans-serif`;
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

  function handlePointerMove(e) {
    if (!drawing) return;

    const p = point(e);
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

  function handlePointerUp(e) {
    if (!drawing) return;

    drawing = false;
    const p = point(e);

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

  // --- Button events ---------------------------------------------------------
  document.querySelectorAll('.tool').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.tool));
  });

  document.querySelectorAll('.swatch').forEach((button) => {
    button.addEventListener('click', () => {
      color = button.dataset.color;
      $('colorInput').value = color;
    });
  });

  $('colorInput').addEventListener('input', (e) => {
    color = e.target.value;
  });

  $('sizeInput').addEventListener('input', (e) => {
    size = parseInt(e.target.value, 10);
    $('sizeDisplay').textContent = `${size}px`;
  });

  $('fillCheck').addEventListener('change', (e) => {
    fill = e.target.checked;
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

  $('gridCheck').addEventListener('change', (e) => {
    showGrid = e.target.checked;
    drawGuides();
  });

  $('undoBtn').addEventListener('click', () => {
    if (!history.length) return;

    redoStack.push(ctx.getImageData(0, 0, W(), H()));
    ctx.putImageData(history.pop(), 0, 0);
    updateUndo();
    scheduleSave();
    toast('Undid action');
  });

  $('redoBtn').addEventListener('click', () => {
    if (!redoStack.length) return;

    history.push(ctx.getImageData(0, 0, W(), H()));
    ctx.putImageData(redoStack.pop(), 0, 0);
    updateUndo();
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

  // --- Save / export / load ---------------------------------------------------
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

  $('loadBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
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
        img.src = event.target.result;
      };

      reader.readAsDataURL(file);
    });

    input.click();
  });

  // --- Canvas event wiring ----------------------------------------------------
  paper.addEventListener('pointerdown', handlePointerDown);
  paper.addEventListener('pointermove', handlePointerMove);
  paper.addEventListener('pointerup', handlePointerUp);
  paper.addEventListener('pointercancel', handlePointerUp);

  // --- Initial app setup ------------------------------------------------------
  resizeCanvas(1200, 800, false);
  restore();
  setStatus();
})();
