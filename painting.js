/*
 * Painting drawer: a small color mixer that paints onto the existing raster canvas.
 *
 * Beginner map: color helpers handle RGB math, updatePreview() updates the swatch,
 * toCanvasPoint() maps touch/mouse coordinates to canvas pixels, and drawStroke()
 * applies the chosen brush. Pointer events are captured only while this drawer is open.
 * It intentionally shares the main canvas so exports include these brush strokes.
 */
(() => {
  'use strict';
  const drawer = document.getElementById('paintingDrawer');
  const tab = document.getElementById('paintingTab');
  const canvas = document.getElementById('paper');
  if (!drawer || !tab || !canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const $ = id => document.getElementById(id);
  const tint = $('paintTint'), vibrancy = $('paintVibrancy'), hexLabel = $('paintHex');
  const preview = $('paintPreview'), size = $('paintSize'), water = $('paintWater'), oil = $('paintOil');
  if (![tint, vibrancy, hexLabel, preview, size, water, oil].every(Boolean)) {
    console.warn('Painting drawer controls are incomplete; skipping initialization.');
    return;
  }

  let isOpen = false, baseColor = '#e53935', paintColor = baseColor;
  let brushType = 'round', isDrawing = false, lastPoint = null;
  const selectedColors = new Set([baseColor]);

  // Color helpers keep channel math readable and prevent values outside 0–255.
  function hexToRgb(hex) {
    return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  }
  function rgbToHex(channels) {
    const safe = channels.map(value => Math.max(0, Math.min(255, Math.round(value))));
    return '#' + safe.map(value => value.toString(16).padStart(2, '0')).join('');
  }

  function updatePreview() {
    let channels = hexToRgb(baseColor);
    const tintAmount = Number(tint.value) / 100;
    const vibrancyAmount = Number(vibrancy.value) / 100;
    // Tint moves colors toward white; vibrancy expands or contracts their distance from gray.
    channels = channels.map(value => tintAmount > 0
      ? value + (255 - value) * tintAmount
      : value * (1 + tintAmount));
    const average = channels.reduce((sum, value) => sum + value, 0) / 3;
    channels = channels.map(value => average + (value - average) * vibrancyAmount);
    paintColor = rgbToHex(channels);
    hexLabel.textContent = paintColor.toUpperCase();
    preview.style.backgroundColor = paintColor;
  }

  function setOpen(open) {
    isOpen = open;
    drawer.open = open;
    drawer.setAttribute('aria-hidden', String(!open));
    tab.setAttribute('aria-expanded', String(open));
  }
  drawer.addEventListener('toggle', () => {
    isOpen = drawer.open;
    drawer.setAttribute('aria-hidden', String(!isOpen));
    tab.setAttribute('aria-expanded', String(isOpen));
  });
  $('paintingClose')?.addEventListener('click', () => setOpen(false));

  drawer.querySelectorAll('[data-paint]').forEach(button => {
    button.addEventListener('click', () => {
      const color = button.dataset.paint;
      if (selectedColors.has(color)) {
        selectedColors.delete(color);
        button.classList.remove('active');
      } else {
        selectedColors.add(color);
        button.classList.add('active');
      }
      baseColor = color; // The clicked color remains active even if removed from the mix.
      updatePreview();
    });
  });

  $('mixPaintBtn')?.addEventListener('click', () => {
    if (!selectedColors.size) return;
    const mixed = [0, 1, 2].map(channel =>
      [...selectedColors].reduce((sum, color) => sum + hexToRgb(color)[channel], 0) / selectedColors.size
    );
    baseColor = rgbToHex(mixed);
    tint.value = 0;
    vibrancy.value = 100;
    updatePreview();
  });
  [tint, vibrancy].forEach(control => control.addEventListener('input', updatePreview));

  drawer.querySelectorAll('[data-paint-brush]').forEach(button => {
    button.addEventListener('click', () => {
      brushType = button.dataset.paintBrush;
      drawer.querySelectorAll('[data-paint-brush]').forEach(item => item.classList.toggle('active', item === button));
    });
  });

  // The CSS display size may differ from the canvas bitmap size; convert coordinates.
  function toCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height };
  }

  function drawStroke(from, to) {
    const brushSize = Number(size.value);
    const waterAmount = Number(water.value) / 100;
    const oilAmount = Number(oil.value) / 100;
    context.save();
    context.strokeStyle = paintColor;
    context.lineWidth = brushSize * (1 + waterAmount * 0.25);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalAlpha = 0.5 + oilAmount * 0.5;
    context.shadowColor = paintColor;
    context.shadowBlur = waterAmount * brushSize * 0.3;
    context.beginPath();
    if (brushType === 'feather' || brushType === 'fan') {
      // Several slightly offset strokes create a simple bristle effect.
      for (let index = 0; index < 5; index += 1) {
        const offset = (index - 2) * brushSize * 0.16;
        context.moveTo(from.x + offset, from.y - offset);
        context.lineTo(to.x + offset, to.y - offset);
      }
      context.lineWidth = Math.max(1, brushSize * 0.18);
    } else {
      context.lineWidth = brushType === 'flat' ? brushSize * 0.55 : brushSize;
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
    }
    context.stroke();
    context.restore();
  }

  canvas.addEventListener('pointerdown', event => {
    if (!isOpen) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    isDrawing = true;
    lastPoint = toCanvasPoint(event);
    drawStroke(lastPoint, lastPoint);
    canvas.setPointerCapture(event.pointerId);
  }, true);
  canvas.addEventListener('pointermove', event => {
    if (!isOpen || !isDrawing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = toCanvasPoint(event);
    drawStroke(lastPoint, point);
    lastPoint = point;
  }, true);
  function finishStroke(event) {
    if (!isDrawing) return;
    event.stopImmediatePropagation();
    isDrawing = false;
    lastPoint = null;
  }
  canvas.addEventListener('pointerup', finishStroke, true);
  canvas.addEventListener('pointercancel', finishStroke, true);
  updatePreview();
})();
