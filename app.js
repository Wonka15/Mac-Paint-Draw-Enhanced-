  (() => {
    'use strict';
    // Small helper: find a page element by its HTML id.
    const $ = id => document.getElementById(id);
    const canvas = $('paper');
    const ctx = canvas.getContext('2d');
    const overlay = $('overlay');
    const octx = overlay.getContext('2d');
    const guides = $('guides');
    const gctx = guides.getContext('2d');
    const rulers = $('rulers');
    const rctx = rulers.getContext('2d');
    const selectionLayer = $('selectionLayer');
    const sctx = selectionLayer.getContext('2d');
    const vectorLayer = $('vectorLayer');
    const canvasWrap = $('canvasWrap');
    if (!ctx || !octx || !gctx || !rctx || !sctx) {
      alert('Mac Paint could not start: your browser could not create a canvas. Try refreshing or using a current browser.');
      return;
    }

    // 🟩 HOW IT WORKS — State is the app's memory: selected tool, ink, and active gestures.
    // 🟪 BEGINNER TIP — When adding a setting, define its default here and wire its UI control below.
    // APP STATE: selected tool, drawing style, and current interaction.
    let tool = 'pencil', color = '#20252b', size = 4, fill = false, selectedPattern = 'solid', textSize = 24, selectedBrush = 'round', roughPaper = false, crtMode = 'off', fatBitsMode = false, zoomBeforeFatBits = 1, lastFatBit = null;
    let customBrushCanvas = null, customPatternCanvas = null, customPatternPixels = null;
    let drawing = false, startPoint = null, lastPoint = null;
    let fatBitsOffsetX = 0, fatBitsOffsetY = 0, fatBitsPanning = false, fatBitsPanStart = null, spaceHeld = false;
    let lassoPoints = [], lassoDrawing = false, selectionMask = null, selectionBitmap = null, selectionBase = null, selectionBounds = null, selectionMove = null;
    let history = [], redoStack = [], showGuides = false, showGrid = false;
    let guideX = null, guideY = null, ghostOpacity = 0.35, currentFont = 'sans-serif';
    let vectorPaths = [], activeVector = null, selectedVector = -1, selectedVectors = [], draggingAnchor = null, draggingHandle = null, curveDragAnchor = null;
    // Dragging a vector's body translates its anchors and curve handles together.
    let draggingVector = null;
    let traceReferenceData = '', traceReferenceOpacity = 0.24;
    let zoomLevel = 1, rulerDrag = null, vectorShapeStart = null, vectorShapeDragging = false;
    // Pan moves the whole artboard view without changing artwork coordinates.
    let panX = 0, panY = 0, panDragStart = null;
    // Text stays as editable SVG objects, so it can be moved after typing.
    let textObjects = [], draggingText = null, selectedText = -1;
    let canvasFocus = false;
    // Shape Builder selection is separate from anchor editing.
    let shapeBuilderDragging = false, shapeBuilderVisited = new Set();
    let saveTimer = null, audioContext = null, lastDragSound = 0;
    // FRAME STUDIO: each frame stores raster art plus editable vector paths.
    const onionCanvas = $('onion'), onionCtx = onionCanvas.getContext('2d');
    const frames = [];
    let currentFrame = -1, playbackTimer = null, playbackIndex = 0, frameBusy = false;

    const W = () => canvas.width, H = () => canvas.height;
    function toast(message) {
      const node = $('toast');
      if (!node) return;
      node.textContent = message;
      node.classList.add('show');
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => node.classList.remove('show'), 1800);
    }
    function status() {
      const names = {pencil:'Paintbrush',eraser:'Eraser',bucket:'Paint bucket',line:'Line',rect:'Rectangle',ellipse:'Oval',text:'Text / move text',eyedropper:'Pick color',hand:'Pan canvas',lasso:'Lasso select',pen:'Vector pen',bezier:'Bezier curve',vectorrect:'Vector rectangle',vectoroval:'Vector oval',editpoints:'Edit points',shapebuilder:'Shape Builder'};
      $('toolStatus').innerHTML = '<strong>Tool:</strong> ' + (names[tool] || tool);
      document.querySelectorAll('.tool').forEach(b => {
        const active = b.dataset.tool === tool;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
    }

    // Keep on/off buttons visually and accessibly in sync with their state.
    function setToggleButton(id, isOn) {
      const button = $(id);
      if (!button) return;
      button.setAttribute('aria-pressed', String(isOn));
      button.classList.toggle('primary', isOn);
    }

    // 🟩 HOW IT WORKS — The current-ink chip and palette outline always mirror the active color.
    // 🟪 BEGINNER TIP — If you add a new way to choose colors, call updateColorIndicator() afterwards.
    function updateColorIndicator() {
      const chip=$('colorChip'),hex=$('colorHex');
      if(chip)chip.style.backgroundColor=color;
      if(hex)hex.textContent=color.toUpperCase();
      document.querySelectorAll('.swatch').forEach(button=>{
        const active=(button.dataset.color||'').toLowerCase()===color.toLowerCase();
        button.classList.toggle('selected',active);
        button.setAttribute('aria-pressed',String(active));
      });
    }

    function drawCreatorTribute() {
      // 🟩 HOW IT WORKS — A one-bit pixel tribute is drawn onto the real canvas, so users can keep or clear it.
      // 🟪 BEGINNER TIP — New and Clear still work normally; this is just the first-launch starting artwork.
      ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,W(),H());
      const portraits=[
        {x:255,y:205,name:'BILL ATKINSON',role:'MACPAINT CREATOR',rows:[
          '....########....','...##########...','..############..','.###++++++++###.','###++++++++++###','##++##++++##++##','##++##++++##++##','##++++++++++++##','##+++######+++##','##++++++++++++##','.##+++####+++##.','..##++++++++##..','...##########...','....##++++##....','...###++++###...','..####++++####..','.################.','##################','..##..........##..','..##..........##..']},
        {x:665,y:205,name:'SUSAN KARE',role:'INTERFACE & ICON DESIGN',rows:[
          '....############....','...##############...','..################..','.####++++++++++####.','####++++++++++++####','####++##++++##++####','####++##++++##++####','####++++++++++++####','####++++####++++####','####++++++++++++####','####++++++++++++####','..##++++++++++++##..','...##############...','....##++++++++##....','...###++++++++###...','..####++++++++####..','.##################.','####################','...##..........##...','...##..........##...']}
      ];
      const px=13;
      portraits.forEach(person=>{
        person.rows.forEach((row,ry)=>[...row].forEach((mark,rx)=>{
          if(mark==='#'){ctx.fillStyle='#111';ctx.fillRect(person.x+rx*px,person.y+ry*px,px,px);}
          else if(mark==='+'){ctx.fillStyle='#aaa';ctx.fillRect(person.x+rx*px,person.y+ry*px,px,px);}
        }));
        ctx.fillStyle='#111';ctx.textAlign='center';ctx.font='bold 22px monospace';ctx.fillText(person.name,person.x+130,person.y+315);
        ctx.font='13px monospace';ctx.fillText(person.role,person.x+130,person.y+340);
      });
      ctx.textAlign='center';ctx.fillStyle='#111';ctx.font='bold 36px monospace';ctx.fillText('THANK YOU, BILL & SUSAN',W()/2,110);
      ctx.font='16px monospace';ctx.fillText('For making computer art feel possible for everyone.',W()/2,145);
      ctx.font='12px monospace';ctx.fillText('A pixel-art thank-you to the people behind the original MacPaint spirit.',W()/2,650);
      ctx.restore();
    }

    function applyCanvasFocus(enabled) {
      canvasFocus=!!enabled;
      $('appRoot').classList.toggle('canvas-focus',canvasFocus);
      setToggleButton('canvasFocusBtn',canvasFocus);
      $('canvasFocusBtn').textContent=canvasFocus?'Exit focus':'Focus canvas';
      setTimeout(()=>{if(canvasFocus){const stage=document.querySelector('.stage');const availableWidth=Math.max(240,stage.clientWidth-50);const availableHeight=Math.max(240,stage.clientHeight-48);setZoom(Math.min(1.4,availableWidth/W(),availableHeight/H()));}else setZoom(zoomLevel);},0);
    }

    function selectTool(next, toggleIfActive = false) {
      // User clicks can turn the current tool off; programmatic selection stays explicit.
      if (toggleIfActive && next === tool && next !== 'pencil') next = 'pencil';
      tool = next;
      vectorLayer.classList.toggle('vector-active', tool === 'pen' || tool === 'bezier' || tool === 'vectorrect' || tool === 'vectoroval' || tool === 'editpoints' || tool === 'shapebuilder' || tool === 'text' || tool === 'select');
      renderVectors();
      status();
      updateShapeBuilderStatus();
      if (next === 'eraser') retroSound('eraser'); else retroSound('select');
      if (tool === 'pen') toast('Vector Pen: click to add straight points; Enter finishes');
      if (tool === 'fingerpaint') toast('Fingerpaint: use your finger for soft, broad paint; Apple Pencil pressure is supported too');
      if (tool === 'bezier') toast('Bezier: click-drag to shape handles; Enter finishes');
      if (tool === 'editpoints') toast('Edit Points: drag a blue anchor to reshape a vector');
      if (tool === 'shapebuilder') toast('Shape Builder: click one closed shape, then Shift-click another');
      if (tool === 'hand') toast('Pan canvas: drag to move the whole page; drag from a ruler to add a guide');
      if (tool === 'text') toast('Text: click to add text, then drag existing text to move it');
      if (tool === 'bucket') toast('Paint bucket: fills only the connected region; patterns stay inside its boundary');
      if (tool === 'lasso') toast('Lasso: draw around pixels, drag inside the selection to move, or use Fill selection');
    }
    function updateButtons() {
      $('undoBtn').disabled = history.length === 0;
      $('redoBtn').disabled = redoStack.length === 0;
    }
    function snapshot() {
      try {
        history.push(ctx.getImageData(0, 0, W(), H()));
        if (history.length > 40) history.shift();
        redoStack = [];
        updateButtons();
      } catch (error) { console.error('Could not save undo state:', error); }
    }
    function saveSoon() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem('mpde-art', JSON.stringify({
            w: W(), h: H(), image: canvas.toDataURL('image/png'),
            color, size, textSize, currentFont, selectedPattern, selectedBrush, roughPaper, crtMode, tool, guideX, guideY, showGuides, showGrid, vectors: vectorPaths, texts: textObjects
          }));
        } catch (error) { console.warn('Autosave unavailable:', error); }
      }, 300);
    }

    // 🟩 HOW IT WORKS — Patterns are tiny repeating tiles; the browser repeats them as ink.
    // 🟪 BEGINNER TIP — Add a new pattern here AND in patternInkAt() below so the bucket matches the brush.
    // 🟩 HOW IT WORKS — One tile generator powers paint strokes, shape fills, and the palette previews.
    // 🟪 BEGINNER TIP — When adding a pattern, also add its matching rule to patternInkAt() below.
    // 🟩 HOW IT WORKS — These 16×16 one-bit tiles add tiny Macintosh-era portraits/icons to the pattern palette.
    // 🟪 BEGINNER TIP — A # is an ink pixel; a . is paper. The bucket uses the same rows below.
    const iconPatternRows = {
      // Keep the existing IDs so saved pattern choices continue to work.
      'steve-icon': [
        '................','....########....','...#........#...','...#........#...',
        '...#..####..#...','...#........#...','...#........#...','...#........#...',
        '...#........#...','...##########...','......####......','.....######.....',
        '....########....','................','................','................'
      ],
      'happy-mac': [
        '........##......','.......####.....','......######....','.....########...',
        '....##########..','...############.','...############.','...##########...',
        '...########.....','...#########....','....##########..','.....########...',
        '......######....','.......####.....','........##......','................'
      ]
    };
    function makePattern(patternName = selectedPattern, preview = false) {
      if (patternName === 'solid') return preview ? null : color;
      if (patternName === 'custom' && customPatternCanvas) return preview ? customPatternCanvas.toDataURL('image/png') : ctx.createPattern(customPatternCanvas, 'repeat');
      const tile = document.createElement('canvas');
      tile.width = tile.height = 16;
      const p = tile.getContext('2d');
      p.fillStyle = '#fff';
      p.fillRect(0, 0, 16, 16);
      p.fillStyle = color;
      p.strokeStyle = color;
      p.lineWidth = 1;
      const line = (x1,y1,x2,y2) => { p.beginPath(); p.moveTo(x1,y1); p.lineTo(x2,y2); p.stroke(); };
      switch (patternName) {
        case 'checker': p.fillRect(0,0,8,8); p.fillRect(8,8,8,8); break;
        case 'fine-checker': for(let y=0;y<16;y+=8) for(let x=0;x<16;x+=8) if(((x+y)/8)%2===0) p.fillRect(x,y,4,4); break;
        case 'dots': case 'large-dots': case 'tiny-dots': case 'stipple': {
          const step = patternName==='stipple'||patternName==='tiny-dots'?4:patternName==='large-dots'?8:8;
          const radius = patternName==='stipple'?0.7:patternName==='tiny-dots'?0.55:patternName==='large-dots'?2.1:1.25;
          for(let y=step/2;y<16;y+=step) for(let x=step/2;x<16;x+=step){p.beginPath();p.arc(x,y,radius,0,Math.PI*2);p.fill();}
          break;
        }
        case 'diagonal': for(let x=-16;x<32;x+=4) line(x,0,x+16,16); break;
        case 'cross': for(let x=-16;x<32;x+=6){line(x,0,x+16,16);line(x+16,0,x,16);} break;
        case 'horizontal': for(let y=0;y<16;y+=4)p.fillRect(0,y,16,1); break;
        case 'vertical': for(let x=0;x<16;x+=4)p.fillRect(x,0,1,16); break;
        case 'brick': p.strokeRect(0,0,16,8);line(8,0,8,8);line(0,8,16,8);line(4,8,4,16);line(12,8,12,16);break;
        case 'diamonds': line(8,0,16,8);line(16,8,8,16);line(8,16,0,8);line(0,8,8,0);break;
        case 'zigzag': for(let y=0;y<16;y+=8){line(0,y+4,4,y);line(4,y,8,y+4);line(8,y+4,12,y);line(12,y,16,y+4);}break;
        case 'weave': for(let n=0;n<16;n+=4){p.fillRect(n,0,1,16);p.fillRect(0,n,16,1);}p.clearRect(4,4,2,2);p.clearRect(12,12,2,2);break;
        case 'speckle': [[2,3],[6,1],[12,4],[15,9],[4,12],[9,7],[11,14],[1,15]].forEach(([x,y])=>p.fillRect(x,y,1,1));break;
        case 'gray-25': for(let y=0;y<16;y+=4)for(let x=(y/4%2)*2;x<16;x+=4)p.fillRect(x,y,1,1);break;
        case 'gray-50': for(let y=0;y<16;y+=4)for(let x=0;x<16;x+=4)p.fillRect(x,y,2,2);break;
        case 'grid': for(let n=0;n<=16;n+=4){line(n,0,n,16);line(0,n,16,n);}break;
        case 'horizontal-dash': for(let y=2;y<16;y+=4)for(let x=0;x<16;x+=6)p.fillRect(x,y,3,1);break;
        case 'vertical-dash': for(let x=2;x<16;x+=4)for(let y=0;y<16;y+=6)p.fillRect(x,y,1,3);break;
        case 'cross-dot': for(let y=2;y<16;y+=6)for(let x=2;x<16;x+=6){line(x-1,y,x+1,y);line(x,y-1,x,y+1);}break;
        case 'rings': case 'circles': for(let y=0;y<16;y+=8)for(let x=0;x<16;x+=8){p.beginPath();p.arc(x+4,y+4,patternName==='rings'?3:2,0,Math.PI*2);if(patternName==='rings')p.stroke();else p.fill();}break;
        case 'triangles': for(let y=0;y<16;y+=8)for(let x=0;x<16;x+=8){p.beginPath();p.moveTo(x+4,y+1);p.lineTo(x+7,y+7);p.lineTo(x+1,y+7);p.closePath();p.stroke();}break;
        case 'waves': for(let y=2;y<16;y+=5){p.beginPath();for(let x=0;x<=16;x++){const yy=y+Math.sin(x*Math.PI/4)*1.5;x===0?p.moveTo(x,yy):p.lineTo(x,yy);}p.stroke();}break;
        case 'herringbone': for(let y=0;y<16;y+=8){line(0,y+4,4,y);line(4,y,8,y+4);line(8,y+4,12,y+8);line(12,y+8,16,y+4);}break;
        case 'basket': for(let n=0;n<16;n+=8){p.fillRect(n,0,3,8);p.fillRect(0,n,8,3);p.clearRect(n+3,n+3,2,2);}break;
        case 'plus': for(let y=2;y<16;y+=6)for(let x=2;x<16;x+=6){p.fillRect(x-1,y,3,1);p.fillRect(x,y-1,1,3);}break;
        case 'confetti': [[1,2],[5,5],[12,1],[14,7],[3,11],[9,14],[13,12],[7,9]].forEach(([x,y],i)=>{if(i%2)p.fillRect(x,y,2,1);else p.fillRect(x,y,1,2);});break;
        case 'steve-icon': case 'happy-mac': iconPatternRows[patternName].forEach((row,y)=>[...row].forEach((pixel,x)=>{if(pixel==='#')p.fillRect(x,y,1,1);}));break;
      }
      return preview ? tile.toDataURL('image/png') : ctx.createPattern(tile, 'repeat');
    }
    // 🟩 HOW IT WORKS — Render tiny live previews from the same tiles used by the drawing engine.
    function renderPatternPreviews() {
      document.querySelectorAll('.pattern-swatch').forEach(button => {
        if (button.dataset.pattern === 'solid') {
          button.style.background = '#20252b';
          button.querySelector('span').style.color = '#fff';
          button.querySelector('span').style.background = 'rgba(0,0,0,.72)';
          return;
        }
        button.style.backgroundImage = 'url("' + makePattern(button.dataset.pattern, true) + '")';
        button.style.backgroundSize = '16px 16px';
        button.querySelector('span').style.color = '#20252b';
        button.querySelector('span').style.background = 'rgba(255,255,255,.9)';
      });
    }

    function drawingStyle(){return selectedPattern==='solid'?color:makePattern();}
    // Locally synthesized 80s-style UI sound kit; no external audio downloads.
    function retroSound(kind){if(!$('soundToggle')||!$('soundToggle').checked)return;try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!audioContext)audioContext=new A();if(audioContext.state==='suspended')audioContext.resume();const now=audioContext.currentTime;
    const tone=(type,a,b,d,v,delay=0)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=now+delay;o.type=type;o.frequency.setValueAtTime(Math.max(1,a),t);o.frequency.exponentialRampToValueAtTime(Math.max(1,b),t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+d+.01);};
    const noise=(d,v)=>{const n=Math.floor(audioContext.sampleRate*d),b=audioContext.createBuffer(1,n,audioContext.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*(1-i/n);const s=audioContext.createBufferSource(),f=audioContext.createBiquadFilter(),g=audioContext.createGain();s.buffer=b;f.type='lowpass';f.frequency.value=850;g.gain.setValueAtTime(v,now);g.gain.exponentialRampToValueAtTime(.0001,now+d);s.connect(f);f.connect(g);g.connect(audioContext.destination);s.start(now);};
    switch(kind){case'color':tone('sine',390,980,.095,.035);tone('triangle',780,540,.07,.018,.025);break;case'eraser':noise(.075,.035);tone('triangle',240,105,.105,.018);break;case'bomb':tone('sawtooth',125,38,.32,.075);noise(.25,.07);tone('square',420,65,.16,.025,.025);break;case'shape':tone('triangle',420,640,.075,.025);tone('sine',650,920,.07,.018,.055);break;case'select':tone('square',740,990,.035,.018);tone('square',990,740,.04,.014,.04);break;case'fill':tone('triangle',520,390,.11,.025);break;case'start':tone('square',660,560,.045,.018);break;case'end':tone('triangle',440,330,.055,.014);break;case'tick':tone('square',740,560,.022,.009);break;default:tone('square',740,560,.05,.016);}}catch(_){}}
    function hexRgb(hex){return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}
    // 🟩 HOW IT WORKS — This mirrors makePattern() so bucket fills use the same texture family.
    // 🟩 HOW IT WORKS — The bucket uses the same pattern families as the brush and shape fills.
    function patternInkAt(x, y) {
      const px=((Math.floor(x)%16)+16)%16, py=((Math.floor(y)%16)+16)%16;
      switch (selectedPattern) {
        case 'checker': return (Math.floor(x/8)+Math.floor(y/8))%2===0;
        case 'fine-checker': return (Math.floor(x/8)+Math.floor(y/8))%2===0 && px%8<4 && py%8<4;
        case 'dots': return px%8<3 && py%8<3;
        case 'large-dots': return (px-4)**2+(py-4)**2<=4 || (px-12)**2+(py-12)**2<=4;
        case 'tiny-dots': case 'stipple': return px%4===1 && py%4===1;
        case 'horizontal': return py%4===0;
        case 'vertical': return px%4===0;
        case 'diagonal': return (px+py)%4===0;
        case 'cross': return (px+py)%6===0 || (px-py+16)%6===0;
        case 'diamonds': return Math.abs(px-8)+Math.abs(py-8)<=1;
        case 'zigzag': return py%8<4?(px+py)%8===0:(px-py+16)%8===0;
        case 'weave': return px%4===0 || py%4===0;
        case 'speckle': return ((Math.floor(x)*13+Math.floor(y)*7)%29)<2;
        case 'brick': return px===0 || py%8===0 || ((Math.floor(y/8)%2===0?px:px+8)%16===0);
        case 'gray-25': return px%4===0 && py%4===0;
        case 'gray-50': return px%4<2 && py%4<2;
        case 'grid': return px%4===0 || py%4===0;
        case 'horizontal-dash': return py%4===2 && px%6<3;
        case 'vertical-dash': return px%4===2 && py%6<3;
        case 'cross-dot': return px%6===2 && py%6===2;
        case 'rings': {const dx=px%8-4,dy=py%8-4;return Math.abs(dx*dx+dy*dy-9)<=3;}
        case 'circles': {const dx=px%8-4,dy=py%8-4;return dx*dx+dy*dy<=4;}
        case 'triangles': return py%8>=1 && py%8<=6 && Math.abs(px%8-4)<=Math.floor((py%8)/2);
        case 'waves': return Math.abs((py%5)-Math.round(2+Math.sin(px*Math.PI/4)*1.5))<=0;
        case 'herringbone': return (px+py)%8===0 || (px-py+16)%8===0;
        case 'basket': return (px%8<3 && py%8<8) || (py%8<3 && px%8<8);
        case 'plus': return (px%6===2 && py%6<5)||(py%6===2&&px%6<5);
        case 'confetti': return ((Math.floor(x)*11+Math.floor(y)*17)%31)<3;
        case 'steve-icon': case 'happy-mac': return iconPatternRows[selectedPattern][py][px] === '#';
        case 'custom': { if (!customPatternPixels || !customPatternCanvas) return true; const tx=((Math.floor(x)%customPatternCanvas.width)+customPatternCanvas.width)%customPatternCanvas.width, ty=((Math.floor(y)%customPatternCanvas.height)+customPatternCanvas.height)%customPatternCanvas.height, k=(ty*customPatternCanvas.width+tx)*4, d=customPatternPixels; return d[k+3]>35 && (d[k]*.299+d[k+1]*.587+d[k+2]*.114)<245; }
        default: return true;
      }
    }

    function floodFill(seedX,seedY){
      const w=W(),h=H(),image=ctx.getImageData(0,0,w,h),data=image.data,original=new Uint8ClampedArray(data);
      const sx=Math.max(0,Math.min(w-1,Math.floor(seedX))),sy=Math.max(0,Math.min(h-1,Math.floor(seedY))),seed=sy*w+sx,seedByte=seed*4;
      const target=[original[seedByte],original[seedByte+1],original[seedByte+2],original[seedByte+3]],rgb=hexRgb(color),solid=selectedPattern==='solid';
      const tol=22;
      const matches=(idx)=>{const i=idx*4;return Math.abs(original[i]-target[0])<=tol&&Math.abs(original[i+1]-target[1])<=tol&&Math.abs(original[i+2]-target[2])<=tol&&Math.abs(original[i+3]-target[3])<=tol;};
      if(solid&&target[0]===rgb[0]&&target[1]===rgb[1]&&target[2]===rgb[2]&&target[3]===255)return;
      // MacPaint-style seed fill: only enqueue neighbors that match the seed color.
      // This keeps the fill connected to the clicked region instead of recoloring every
      // disconnected white area on the canvas.
      const count=w*h,seen=new Uint8Array(count),stack=new Uint32Array(count);let top=0;
      stack[top++]=seed;seen[seed]=1;
      while(top){
        const idx=stack[--top],x=idx%w,y=(idx/w)|0,di=idx*4;
        const ink=solid||patternInkAt(x,y);
        data[di]=ink?rgb[0]:255;data[di+1]=ink?rgb[1]:255;data[di+2]=ink?rgb[2]:255;data[di+3]=255;
        if(x>0){const next=idx-1;if(!seen[next]&&matches(next)){seen[next]=1;stack[top++]=next;}}
        if(x<w-1){const next=idx+1;if(!seen[next]&&matches(next)){seen[next]=1;stack[top++]=next;}}
        if(y>0){const next=idx-w;if(!seen[next]&&matches(next)){seen[next]=1;stack[top++]=next;}}
        if(y<h-1){const next=idx+w;if(!seen[next]&&matches(next)){seen[next]=1;stack[top++]=next;}}
      }
      ctx.putImageData(image,0,0);saveSoon();retroSound('fill');
    }

    function brushStamp(x,y,angle,erase=false){
      const ink=erase?'#ffffff':color, radius=Math.max(1,size/2);
      if(selectedBrush==='custom' && customBrushCanvas){ if(erase){ctx.save();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.restore();return;} ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.imageSmoothingEnabled=false;ctx.drawImage(customBrushCanvas,-radius,-radius,size,size);ctx.restore();return; }
      if(selectedBrush==='round'){ctx.fillStyle=ink;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();return;}
      if(selectedBrush==='calligraphy'){
        ctx.save();ctx.translate(x,y);ctx.rotate(angle-0.45);ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(0,0,Math.max(1,radius*1.3),Math.max(.6,radius*.24),0,0,Math.PI*2);ctx.fill();ctx.restore();return;
      }
      if(selectedBrush==='oil'){
        if(erase){ctx.save();ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.restore();return;}
        // Blend the chosen pigment with existing canvas color for a buttery oil-paint effect.
        const pad=Math.min(44,Math.ceil(radius*1.25)),left=Math.max(0,Math.floor(x-pad)),top=Math.max(0,Math.floor(y-pad));
        const right=Math.min(W(),Math.ceil(x+pad)),bottom=Math.min(H(),Math.ceil(y+pad));
        if(right>left&&bottom>top){
          const image=ctx.getImageData(left,top,right-left,bottom-top),d=image.data,[nr,ng,nb]=hexRgb(color);
          for(let py=0;py<image.height;py++)for(let px=0;px<image.width;px++){
            const dx=(left+px+.5-x)/Math.max(1,radius),dy=(top+py+.5-y)/Math.max(1,radius),dist=Math.sqrt(dx*dx+dy*dy);
            if(dist>1.12)continue;
            const k=(py*image.width+px)*4,edge=Math.max(0,Math.min(1,(1.08-dist)*7));
            const oldR=d[k],oldG=d[k+1],oldB=d[k+2],nearPaper=oldR>238&&oldG>238&&oldB>238;
            const mix=nearPaper?.88:.48,a=edge*mix;
            d[k]=oldR*(1-a)+nr*a;d[k+1]=oldG*(1-a)+ng*a;d[k+2]=oldB*(1-a)+nb*a;d[k+3]=255;
          }
          ctx.putImageData(image,left,top);
        }
        // A raised ridge, glossy highlight and pigment body suggest thick impasto.
        ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.lineCap='round';ctx.lineJoin='round';
        ctx.globalAlpha=.2;ctx.strokeStyle='#17120d';ctx.lineWidth=Math.max(1,radius*.42);ctx.beginPath();ctx.moveTo(-radius*.72,radius*.18);ctx.lineTo(radius*.78,radius*.18);ctx.stroke();
        ctx.globalAlpha=.16;ctx.strokeStyle='#fff7d7';ctx.lineWidth=Math.max(1,radius*.24);ctx.beginPath();ctx.moveTo(-radius*.65,-radius*.18);ctx.lineTo(radius*.4,-radius*.18);ctx.stroke();
        ctx.globalAlpha=.28;ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,0,radius*.88,radius*.62,0,0,Math.PI*2);ctx.fill();ctx.restore();return;
      }
      if(selectedBrush==='watercolor'){
        if(erase){ctx.save();ctx.globalAlpha=.25;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save();
        // A pale halo spreads farther than the pigment when the paper is very wet.
        ctx.globalAlpha=.055;ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(x,y,radius*1.65,radius*1.35,angle,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=.075;ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(x+(Math.random()-.5)*radius*.28,y+(Math.random()-.5)*radius*.28,radius*1.2,radius*(.75+Math.random()*.25),angle,0,Math.PI*2);ctx.fill();
        for(let i=0;i<3;i++){
          const spread=radius*(.35+i*.28),jitter=radius*.22;
          ctx.globalAlpha=.065+i*.022;ctx.fillStyle=ink;ctx.beginPath();
          ctx.ellipse(x+(Math.random()-.5)*jitter,y+(Math.random()-.5)*jitter,spread,spread*(.72+Math.random()*.45),angle,0,Math.PI*2);ctx.fill();
        }
        // Darker pigment gathers around the wet edge, with irregular bloom marks.
        ctx.globalAlpha=.12;ctx.strokeStyle=ink;ctx.lineWidth=Math.max(.6,radius*.11);ctx.beginPath();
        ctx.ellipse(x,y,radius*(.92+Math.random()*.13),radius*(.76+Math.random()*.15),angle,0,Math.PI*2);ctx.stroke();
        ctx.globalAlpha=.07;ctx.fillStyle=ink;ctx.beginPath();ctx.arc(x+radius*.48,y-radius*.28,Math.max(1,radius*.22),0,Math.PI*2);ctx.fill();
        ctx.restore();return;
      }
      if(selectedBrush==='acrylic'){
        ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=ink;
        const strands=Math.max(5,Math.min(18,Math.round(size*.65)));
        for(let i=0;i<strands;i++){if(Math.random()<.14)continue;const offset=(i/(strands-1)-.5)*radius*1.5;ctx.globalAlpha=.5+Math.random()*.5;ctx.fillRect(-radius*.9,offset,Math.max(1,radius*(1.2+Math.random()*.6)),Math.max(.5,radius*.08));}
        ctx.globalAlpha=.32;ctx.fillRect(-radius*.8,-radius*.13,radius*1.5,Math.max(1,radius*.25));ctx.restore();return;
      }
      ctx.save();ctx.fillStyle=ink;const dots=Math.max(8,Math.min(40,Math.round(size*1.5)));
      for(let i=0;i<dots;i++){if(Math.random()<.32)continue;const a=Math.random()*Math.PI*2,rr=Math.random()*radius;ctx.globalAlpha=.25+Math.random()*.6;ctx.fillRect(x+Math.cos(a)*rr,y+Math.sin(a)*rr,Math.max(.5,size*.06),Math.max(.5,size*.08));}
      ctx.restore();
    }
    function paintBrushSegment(from,to,erase=false){
      const dx=to.x-from.x,dy=to.y-from.y,dist=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
      if(selectedBrush==='round'&&selectedPattern!=='solid'&&!erase){
        ctx.save();ctx.strokeStyle=drawingStyle();ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.restore();return;
      }
      const spacing=Math.max(1,selectedBrush==='watercolor'?size*.22:selectedBrush==='acrylic'?size*.16:size*.2);
      const steps=Math.max(1,Math.ceil(dist/spacing));
      for(let i=0;i<=steps;i++){const t=i/steps;brushStamp(from.x+dx*t,from.y+dy*t,angle,erase);}
    }

    // 🟩 HOW IT WORKS — Both raster and vector tools use the same snapping rules.
    // Snap only to visible guides/grid, so hidden helpers never pull artwork unexpectedly.
    function snapPoint(x, y, ignoreAnchor = null) {
      if (!$('snapCheck').checked) return { x, y };
      const tolerance = 14;

      if (showGuides) {
        if (guideX !== null && Math.abs(x - guideX) <= tolerance) x = guideX;
        if (guideY !== null && Math.abs(y - guideY) <= tolerance) y = guideY;
      }

      // 🟪 BEGINNER TIP — Turn on Grid to get gentle 50-pixel alignment; you do not need to place guides.
      if (showGrid) {
        const gridSize = 50;
        const gridX = Math.round(x / gridSize) * gridSize;
        const gridY = Math.round(y / gridSize) * gridSize;
        if (Math.abs(x - gridX) <= 9) x = gridX;
        if (Math.abs(y - gridY) <= 9) y = gridY;
      }

      // Vector anchors act like Illustrator smart guides when working with vector tools.
      if (tool === 'pen' || tool === 'bezier' || tool === 'vectorrect' || tool === 'vectoroval' || tool === 'editpoints') {
        let nearest = null;
        for (let vectorIndex=0; vectorIndex<vectorPaths.length; vectorIndex++) {
          const vector=vectorPaths[vectorIndex];
          for (let pointIndex=0; pointIndex<vector.points.length; pointIndex++) {
            if(ignoreAnchor&&ignoreAnchor.vector===vectorIndex&&ignoreAnchor.point===pointIndex)continue;
            const anchor=vector.points[pointIndex];
            const distance = Math.hypot(anchor.x - x, anchor.y - y);
            if (distance <= tolerance && (!nearest || distance < nearest.distance)) {
              nearest = { x: anchor.x, y: anchor.y, distance };
            }
          }
        }
        if (nearest) { x = nearest.x; y = nearest.y; }
      }
      return { x, y };
    }

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      let x = (event.clientX - rect.left) * W() / rect.width;
      let y = (event.clientY - rect.top) * H() / rect.height;
      ({ x, y } = snapPoint(x, y));
      return { x: Math.max(0, Math.min(W() - 1, x)), y: Math.max(0, Math.min(H() - 1, y)) };
    }
    function drawGuides() {
      gctx.clearRect(0,0,W(),H());
      if (showGrid) {
        gctx.save(); gctx.strokeStyle='rgba(100,130,220,.2)'; gctx.lineWidth=1;
        for(let x=50;x<W();x+=50){gctx.beginPath();gctx.moveTo(x,0);gctx.lineTo(x,H());gctx.stroke();}
        for(let y=50;y<H();y+=50){gctx.beginPath();gctx.moveTo(0,y);gctx.lineTo(W(),y);gctx.stroke();}
        gctx.restore();
      }
      if (showGuides) {
        gctx.save(); gctx.strokeStyle='#315cdb'; gctx.lineWidth=1; gctx.setLineDash([5,5]);
        if(guideX!==null){gctx.beginPath();gctx.moveTo(guideX,0);gctx.lineTo(guideX,H());gctx.stroke();}
        if(guideY!==null){gctx.beginPath();gctx.moveTo(0,guideY);gctx.lineTo(W(),guideY);gctx.stroke();}
        gctx.restore();
      }
      guides.style.display = (showGuides || showGrid) ? 'block' : 'none';
      rctx.clearRect(0,0,W(),H());
      rulers.style.display='none';
      renderRulerLabels();
    }
    // 🟩 HOW IT WORKS — Raster pixels live on #paper; editable vector shapes live in the SVG layer.
    // 🟪 BEGINNER TIP — Keep vector edits in vectorPaths so users can still move anchors later.
    // VECTOR ENGINE: SVG paths are stored separately from the pixel paint canvas.
    function svgPoint(event, ignoreAnchor = null, shouldSnap = true) {
      const rect = vectorLayer.getBoundingClientRect();
      let x = (event.clientX - rect.left) * W() / rect.width;
      let y = (event.clientY - rect.top) * H() / rect.height;
      if(shouldSnap)({ x, y } = snapPoint(x, y, ignoreAnchor));
      return { x: Math.max(0, Math.min(W(), x)), y: Math.max(0, Math.min(H(), y)) };
    }

    // RULERS + ZOOM: ruler coordinates always map to the original 1200 × 800 artboard.
    let smartRulerLastPoint=null;
    function updateSmartRulers(event){const r=$('canvasWrap').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){$('rulerTop').classList.remove('cursor-visible');$('rulerLeft').classList.remove('cursor-visible');smartRulerLastPoint=null;return;}const x=Math.max(0,Math.min(W(),(event.clientX-r.left)*W()/r.width)),y=Math.max(0,Math.min(H(),(event.clientY-r.top)*H()/r.height));$('rulerTop').style.setProperty('--cursor-x',(x/W()*100)+'%');$('rulerLeft').style.setProperty('--cursor-y',(y/H()*100)+'%');$('rulerTop').classList.add('cursor-visible');$('rulerLeft').classList.add('cursor-visible');const dx=smartRulerLastPoint?x-smartRulerLastPoint.x:0,dy=smartRulerLastPoint?y-smartRulerLastPoint.y:0;$('coordStatus').textContent='X '+Math.round(x)+' · Y '+Math.round(y)+' px'+(smartRulerLastPoint?'  |  Δ '+Math.round(Math.hypot(dx,dy))+' px · '+Math.round(Math.atan2(dy,dx)*180/Math.PI)+'°':'');smartRulerLastPoint={x,y};}
    document.addEventListener('pointermove',updateSmartRulers,{passive:true});
    function renderRulerLabels(){
      const top=$('rulerTop'),left=$('rulerLeft');if(!top||!left)return;
      top.innerHTML='';left.innerHTML='';
      for(let x=0;x<=W();x+=100){const label=document.createElement('span');label.className='ruler-label';label.textContent=String(x);label.style.left=(x/W()*100)+'%';top.appendChild(label);}
      for(let y=0;y<=H();y+=100){const label=document.createElement('span');label.className='ruler-label';label.textContent=String(y);label.style.top=(y/H()*100)+'%';left.appendChild(label);}
    }
    function updateFatBitsGrid(){
      const grid=$('fatBitsGrid');
      if(!grid)return;
      // Canvas CSS dimensions can differ from its 1200×800 source bitmap; match the real source-pixel pitch.
      const cellWidth=canvasWrap.clientWidth/Math.max(1,W()),cellHeight=canvasWrap.clientHeight/Math.max(1,H());
      const lineWidth=1/Math.max(1,zoomLevel);
      grid.style.backgroundSize=cellWidth+'px '+cellHeight+'px';
      grid.style.backgroundImage='linear-gradient(to right, rgba(32,37,43,.68) '+lineWidth+'px, transparent '+lineWidth+'px), linear-gradient(to bottom, rgba(32,37,43,.68) '+lineWidth+'px, transparent '+lineWidth+'px)';
    }
    function updateFatBitsView(){
      const layers=['paper','onion','overlay','vectorLayer','guides','rulers','selectionLayer','fatBitsGrid'];
      if(fatBitsMode){
        canvasWrap.style.zoom='1';
        layers.forEach(id=>{const layer=$(id);if(layer){layer.style.transformOrigin='0 0';layer.style.transform='translate('+fatBitsOffsetX+'px, '+fatBitsOffsetY+'px) scale('+zoomLevel+')';}});
        updateFatBitsGrid();
      }else{
        layers.forEach(id=>{const layer=$(id);if(layer)layer.style.transform='';});
        canvasWrap.style.zoom=String(zoomLevel);
      }
      if(typeof updatePixelNavigator==='function')updatePixelNavigator();
    }
    // Pixel Mode navigator: thumbnail and cyan viewport are a map of the real canvas.
    function updatePixelNavigator(){
      const mini=$('pixelNavigatorCanvas'), viewport=$('pixelNavigatorViewport'), screen=$('pixelNavigatorScreen');
      if(!mini||!viewport||!screen)return;
      const mctx=mini.getContext('2d');
      if(mctx){
        mctx.imageSmoothingEnabled=false;
        mctx.fillStyle='#fff';mctx.fillRect(0,0,mini.width,mini.height);
        try{mctx.drawImage(canvas,0,0,mini.width,mini.height);}catch(_){}
      }
      const stage=document.querySelector('.stage');
      if(fatBitsMode&&stage&&canvasWrap.clientWidth&&canvasWrap.clientHeight){
        const cw=canvasWrap.clientWidth,ch=canvasWrap.clientHeight;
        const left=Math.max(0,Math.min(W(),(-fatBitsOffsetX+stage.scrollLeft)*W()/(cw*zoomLevel)));
        const top=Math.max(0,Math.min(H(),(-fatBitsOffsetY+stage.scrollTop)*H()/(ch*zoomLevel)));
        const vw=Math.min(W(),stage.clientWidth*W()/(cw*zoomLevel));
        const vh=Math.min(H(),stage.clientHeight*H()/(ch*zoomLevel));
        viewport.style.left=(left/W()*100)+'%';viewport.style.top=(top/H()*100)+'%';
        viewport.style.width=Math.max(1,vw/W()*100)+'%';viewport.style.height=Math.max(1,vh/H()*100)+'%';
        viewport.hidden=false;
        $('pixelNavigatorReadout').textContent='FATBITS '+Math.round(zoomLevel*100)+'% · '+Math.round(left)+','+Math.round(top);
      }else{
        viewport.style.left='0%';viewport.style.top='0%';viewport.style.width='100%';viewport.style.height='100%';
        viewport.hidden=false;
        $('pixelNavigatorReadout').textContent='FULL CANVAS · '+W()+' × '+H();
      }
      const toggle=$('pixelModeBtn');
      if(toggle){toggle.setAttribute('aria-pressed',String(fatBitsMode));toggle.textContent=fatBitsMode?'▦ Pixel Mode: ON':'▦ Toggle FatBits';}
    }
    function moveFatBitsToNavigatorPoint(event){
      const screen=$('pixelNavigatorScreen'),stage=document.querySelector('.stage');
      if(!screen||!stage)return;
      const rect=screen.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*W();
      const y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))*H();
      if(!fatBitsMode){
        fatBitsMode=true;zoomBeforeFatBits=zoomLevel;fatBitsOffsetX=0;fatBitsOffsetY=0;
        $('fatBitsGrid').classList.add('active');canvasWrap.classList.add('fatbits-active');setZoom(12);
        setToggleButton('fatBitsBtn',true);
      }
      const cw=canvasWrap.clientWidth,ch=canvasWrap.clientHeight;
      fatBitsOffsetX=stage.clientWidth/2-(x/W()*cw*zoomLevel);
      fatBitsOffsetY=stage.clientHeight/2-(y/H()*ch*zoomLevel);
      updateFatBitsView();updatePixelNavigator();
    }
    $('pixelModeBtn').addEventListener('click',()=>{
      $('fatBitsBtn').click();
      updatePixelNavigator();
    });
    $('pixelNavigatorScreen').addEventListener('click',moveFatBitsToNavigatorPoint);
    $('pixelNavigatorScreen').addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();const rect=$('pixelNavigatorScreen').getBoundingClientRect();moveFatBitsToNavigatorPoint({clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2});}
    });
    window.addEventListener('resize',updatePixelNavigator);
    setInterval(updatePixelNavigator,350);

    function setZoom(next){
      zoomLevel=Math.max(.25,Math.min(fatBitsMode?16:3,next));
      $('zoomReadout').textContent=Math.round(zoomLevel*100)+'%';
      updateFatBitsView();
    }
    function setGuideFromRuler(event){
      const rect=canvas.getBoundingClientRect();
      if(rulerDrag==='horizontal'){guideY=Math.max(0,Math.min(H(),(event.clientY-rect.top)*H()/rect.height));}
      if(rulerDrag==='vertical'){guideX=Math.max(0,Math.min(W(),(event.clientX-rect.left)*W()/rect.width));}
      showGuides=true;drawGuides();
    }
    $('zoomInBtn').addEventListener('click',()=>setZoom(zoomLevel+.25));
    $('zoomOutBtn').addEventListener('click',()=>setZoom(zoomLevel-.25));
    $('zoomFitBtn').addEventListener('click',()=>{
      const stage=document.querySelector('.stage');
      const availableWidth=Math.max(240,stage.clientWidth-48);
      const availableHeight=Math.max(240,stage.clientHeight-48);
      const fit=Math.min(1.4,availableWidth/Math.max(1,1200),availableHeight/Math.max(1,800));
      setZoom(fit);
    });
    $('canvasFocusBtn').addEventListener('click',()=>applyCanvasFocus(!canvasFocus));

    // Reversible animation-table focus: keep the canvas usable while the rest dims.
    function setFrameStudioMode(enabled) {
      const root = $('appRoot'), button = $('frameStudioModeBtn');
      if (!root || !button) return;
      root.classList.toggle('frame-studio-mode', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? '◉ Focus ON' : '◉ Studio Focus';
      button.title = enabled ? 'Turn off animation-table spotlight and restore the full workspace' : 'Dim the workspace and spotlight the animation drawing table';
      toast(enabled ? 'Frame Studio Focus on — lights down, animation table up' : 'Frame Studio Focus off — full workspace restored');
    }
    $('frameStudioModeBtn').addEventListener('click', () => setFrameStudioMode(!$('appRoot').classList.contains('frame-studio-mode')));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('appRoot').classList.contains('frame-studio-mode')) setFrameStudioMode(false); });
    $('rulersBtn').addEventListener('click',()=>{
      const layout=$('rulerLayout'),hidden=layout.classList.toggle('rulers-hidden');
      setToggleButton('rulersBtn', !hidden);
    });
    $('rulerTop').addEventListener('pointerdown',event=>{rulerDrag='horizontal';setGuideFromRuler(event);});
    $('rulerLeft').addEventListener('pointerdown',event=>{rulerDrag='vertical';setGuideFromRuler(event);});
    document.addEventListener('pointermove',event=>{if(rulerDrag)setGuideFromRuler(event);});
    document.addEventListener('pointerup',()=>{rulerDrag=null;});
    document.addEventListener('pointercancel',()=>{rulerDrag=null;});
    // PATHFINDER: boolean operations on two selected closed vector shapes.
    function vectorToPaperPath(scope,v){
      const segments=v.points.map(p=>new scope.Segment(new scope.Point(p.x,p.y),new scope.Point(p.in?p.in.x-p.x:0,p.in?p.in.y-p.y:0),new scope.Point(p.out?p.out.x-p.x:0,p.out?p.out.y-p.y:0)));
      return new scope.Path({segments,closed:!!v.closed,insert:false});
    }
    function paperItemToVectors(item,style){
      const items=item.className==='CompoundPath'?item.children:[item];
      return items.filter(p=>p.segments&&p.segments.length>=2).map(p=>({
        points:p.segments.map(seg=>({x:seg.point.x,y:seg.point.y,in:{x:seg.point.x+seg.handleIn.x,y:seg.point.y+seg.handleIn.y},out:{x:seg.point.x+seg.handleOut.x,y:seg.point.y+seg.handleOut.y}})),
        closed:p.closed,color:style.color,size:style.size,fill:true,curve:true
      }));
    }
    function runBoolean(operation){
      if(!window.paper){toast('Pathfinder library did not load — refresh with internet');return;}
      const indices=[...new Set(selectedVectors)].filter(i=>i>=0&&i<vectorPaths.length).sort((a,b)=>a-b);
      if(indices.length!==2){toast('Shift-click exactly two closed shapes in Edit Points');return;}
      const a=vectorPaths[indices[0]],b=vectorPaths[indices[1]];
      if(!a.closed||!b.closed){toast('Pathfinder needs two closed shapes. Close each path first.');return;}
      try{
        const scope=new window.paper.PaperScope();const scratch=document.createElement('canvas');scratch.width=W();scratch.height=H();scope.setup(scratch);
        const first=vectorToPaperPath(scope,a),second=vectorToPaperPath(scope,b);
        const methods={unite:'unite',subtract:'subtract',intersect:'intersect',exclude:'exclude'};
        const result=first[methods[operation]](second);const replacements=paperItemToVectors(result,a);
        first.remove();second.remove();result.remove();scope.project.clear();
        if(!replacements.length){toast('That operation produced an empty shape');return;}
        vectorPaths.splice(indices[0],1);vectorPaths.splice(indices[1]-1,1,...replacements);
        selectedVector=indices[0];selectedVectors=replacements.map((_,i)=>indices[0]+i);
        renderVectors();saveSoon();toast(({unite:'Shapes united',subtract:'Front shape subtracted',intersect:'Overlap kept',exclude:'Overlap excluded'})[operation]);
      }catch(error){console.error('Pathfinder operation failed:',error);toast('Could not combine these shapes. Try simple closed shapes.');}
    }
    document.querySelectorAll('[data-boolean]').forEach(button=>button.addEventListener('click',()=>runBoolean(button.dataset.boolean)));

    // 🟩 HOW IT WORKS — Shape Builder currently combines whole closed shapes, not individual overlap regions.
    // 🟪 BEGINNER TIP — Select two or more closed shapes, then choose an operation; Unite is the safest first test.
    // SHAPE BUILDER: combine any number of selected closed vector shapes.
    // The first selected shape is the base when Subtract is chosen.
    function updateShapeInspector(){const v=vectorPaths[selectedVector],card=$('shapeInspectorCard');if(!card)return;card.classList.toggle('has-selection',!!v);$('shapeInspectorStatus').textContent=v?'Selected shape '+(selectedVector+1)+' of '+vectorPaths.length:'No shape selected — choose Edit Points and click a shape';if(v){$('shapeStrokeColor').value=v.strokeColor||v.color||color;$('shapeStrokeWidth').value=v.strokeWidth||v.size||size;$('shapeStrokeWidthValue').textContent=(v.strokeWidth||v.size||size)+' px';}$('bringShapeFrontBtn').disabled=!v||selectedVector===vectorPaths.length-1;$('sendShapeBackBtn').disabled=!v||selectedVector===0;}
    function moveSelectedShape(front){if(selectedVector<0||!vectorPaths[selectedVector]){toast('Select a vector shape with Edit Points first');return;}const item=vectorPaths.splice(selectedVector,1)[0],to=front?vectorPaths.length:0;vectorPaths.splice(to,0,item);selectedVector=to;selectedVectors=[to];renderVectors();updateShapeInspector();saveSoon();retroSound('select');toast(front?'Shape brought to front':'Shape sent to back');}
    // Convert the selected path into a new silhouette without redrawing it.
    function convertSelectedShape(kind){
      const v=vectorPaths[selectedVector];if(!v||!v.points.length){toast('Select a vector shape with Edit Points first');return;}
      const xs=v.points.map(p=>p.x),ys=v.points.map(p=>p.y),l=Math.min(...xs),r=Math.max(...xs),t=Math.min(...ys),b=Math.max(...ys),w=Math.max(1,r-l),h=Math.max(1,b-t),cx=(l+r)/2,cy=(t+b)/2,k=.5522847498;
      const rounded=rad=>[{x:l+rad,y:t,in:{x:l+rad*(1-k),y:t},out:{x:l+rad+k*rad,y:t}},{x:r-rad,y:t,in:{x:r-rad-k*rad,y:t},out:{x:r-rad+k*rad,y:t}},{x:r,y:t+rad,in:{x:r,y:t+rad-k*rad},out:{x:r,y:t+rad+k*rad}},{x:r,y:b-rad,in:{x:r,y:b-rad-k*rad},out:{x:r,y:b-rad+k*rad}},{x:r-rad,y:b,in:{x:r-rad+k*rad,y:b},out:{x:r-rad-k*rad,y:b}},{x:l+rad,y:b,in:{x:l+rad+k*rad,y:b},out:{x:l+rad-k*rad,y:b}},{x:l,y:b-rad,in:{x:l,y:b-rad+k*rad},out:{x:l,y:b-rad-k*rad}},{x:l,y:t+rad,in:{x:l,y:t+rad+k*rad},out:{x:l,y:t+rad-k*rad}}];
      if(kind==='rectangle')v.points=[{x:l,y:t},{x:r,y:t},{x:r,y:b},{x:l,y:b}],v.details=[];
      if(kind==='rounded')v.points=rounded(Math.min(w,h)*.18),v.details=[];
      if(kind==='capsule')v.points=rounded(Math.min(w,h)/2),v.details=[];
      if(kind==='oval'){const rx=w/2,ry=h/2;v.points=[{x:cx,y:t,in:{x:cx-k*rx,y:t},out:{x:cx+k*rx,y:t}},{x:r,y:cy,in:{x:r,y:cy-k*ry},out:{x:r,y:cy+k*ry}},{x:cx,y:b,in:{x:cx+k*rx,y:b},out:{x:cx-k*rx,y:b}},{x:l,y:cy,in:{x:l,y:cy+k*ry},out:{x:l,y:cy-k*ry}}];v.details=[];}
      if(kind==='star'){const outer=Math.min(w,h)/2;v.points=Array.from({length:10},(_,i)=>{const rad=i%2?outer*.44:outer,a=-Math.PI/2+i*Math.PI/5;return{x:cx+Math.cos(a)*rad,y:cy+Math.sin(a)*rad};});v.details=[];}
      if(kind==='cylinder'){const ry=Math.min(h*.18,w*.22);v.points=[{x:l,y:t+ry},{x:r,y:t+ry},{x:r,y:b-ry},{x:l,y:b-ry}];v.details=[{closed:true,points:[{x:cx,y:t,in:{x:cx-w*.276,y:t},out:{x:cx+w*.276,y:t}},{x:r,y:t+ry,in:{x:r,y:t+ry*.552},out:{x:r,y:t+ry*.552}},{x:cx,y:t+ry*2,in:{x:cx+w*.276,y:t+ry*2},out:{x:cx-w*.276,y:t+ry*2}},{x:l,y:t+ry,in:{x:l,y:t+ry*.552},out:{x:l,y:t+ry*.552}}]}];}
      v.closed=true;renderVectors();updateShapeInspector();saveSoon();toast('Shape converted to '+kind);
    }

    function updateShapeBuilderStatus() {
      const count = selectedVectors.filter(index => index >= 0 && index < vectorPaths.length && vectorPaths[index].closed).length;
      const status = $('shapeBuilderStatus');
      if (status) status.textContent = count < 2 ? `${count} selected — click a closed shape, then Shift-click another` : `${count} shapes selected — choose what to do below`;
      // Disable actions until they can work, guiding beginners toward the next step.
      ['shapeBuilderUniteBtn','shapeBuilderSubtractBtn','shapeBuilderIntersectBtn','shapeBuilderExcludeBtn'].forEach(id => { const button=$(id); if(button)button.disabled=count<2; });
    }

    function runShapeBuilder(operation) {
      if (!window.paper) {
        toast('Shape Builder needs an internet connection to load its vector engine.');
        return;
      }
      // Keep selection order for subtraction; remove originals in reverse order later.
      const indices = [...new Set(selectedVectors)].filter(index => index >= 0 && index < vectorPaths.length);
      if (indices.length < 2) {
        toast('Select at least two closed vector shapes first.');
        return;
      }
      if (indices.some(index => !vectorPaths[index].closed)) {
        toast('Shape Builder works with closed vector shapes only.');
        return;
      }

      const base = vectorPaths[indices[0]];
      const methods = { unite: 'unite', subtract: 'subtract', intersect: 'intersect', exclude: 'exclude' };
      let scope;
      try {
        scope = new window.paper.PaperScope();
        const scratch = document.createElement('canvas');
        scratch.width = W();
        scratch.height = H();
        scope.setup(scratch);

        let result = vectorToPaperPath(scope, base);
        for (const index of indices.slice(1)) {
          const operand = vectorToPaperPath(scope, vectorPaths[index]);
          const combined = result[methods[operation]](operand);
          result.remove();
          operand.remove();
          result = combined;
        }

        const replacements = paperItemToVectors(result, base);
        result.remove();
        scope.project.clear();
        if (!replacements.length) {
          toast('That operation produced an empty shape.');
          return;
        }

        const insertionIndex = Math.min(...indices);
        [...indices].sort((a, b) => b - a).forEach(index => vectorPaths.splice(index, 1));
        vectorPaths.splice(insertionIndex, 0, ...replacements);
        selectedVector = insertionIndex;
        selectedVectors = replacements.map((_, offset) => insertionIndex + offset);
        renderVectors();
        updateShapeBuilderStatus();
        saveSoon();
        const messages = {unite: 'Shapes combined', subtract: 'Selected shapes subtracted', intersect: 'Overlap kept', exclude: 'Overlapping areas removed'};
        toast(messages[operation] || 'Shape Builder finished');
      } catch (error) {
        if (scope && scope.project) scope.project.clear();
        console.error('Shape Builder operation failed:', error);
        toast('Could not combine these shapes. Try simple, closed shapes.');
      }
    }

    $('shapeBuilderUniteBtn').addEventListener('click', () => runShapeBuilder('unite'));
    $('shapeBuilderSubtractBtn').addEventListener('click', () => runShapeBuilder('subtract'));
    $('shapeBuilderIntersectBtn').addEventListener('click', () => runShapeBuilder('intersect'));
    $('shapeBuilderExcludeBtn').addEventListener('click', () => runShapeBuilder('exclude'));
    $('shapeBuilderClearBtn').addEventListener('click', () => {
      selectedVector = -1;
      selectedVectors = [];
      shapeBuilderVisited.clear();
      renderVectors();
      updateShapeBuilderStatus();
      toast('Shape selection cleared');
    });

    function pathData(points, closed) {
      if (!points.length) return '';
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1], current = points[i];
        if (prev.out || current.in) {
          const c1 = prev.out || prev;
          const c2 = current.in || current;
          d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${current.x} ${current.y}`;
        } else d += ` L ${current.x} ${current.y}`;
      }
      if (closed) {
        const last = points[points.length - 1], first = points[0];
        if (last.out || first.in) {
          const c1 = last.out || last, c2 = first.in || first;
          d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${first.x} ${first.y}`;
        }
        d += ' Z';
      }
      return d;
    }
    // 🟩 HOW IT WORKS — Rectangles use corner anchors; ovals use four smooth Bézier anchors.
    // 🟪 BEGINNER TIP — The 0.5523 constant makes the oval handles follow a near-perfect circle.
    function vectorShapePoints(start, end, shapeType) {
      const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x);
      const top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);
      const cx=(left+right)/2,cy=(top+bottom)/2,rx=(right-left)/2,ry=(bottom-top)/2;
      if(shapeType==='vectorrect')return [{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
      const k=0.5522847498;
      return [
        {x:cx,y:top,in:{x:cx-k*rx,y:top},out:{x:cx+k*rx,y:top}},
        {x:right,y:cy,in:{x:right,y:cy-k*ry},out:{x:right,y:cy+k*ry}},
        {x:cx,y:bottom,in:{x:cx+k*rx,y:bottom},out:{x:cx-k*rx,y:bottom}},
        {x:left,y:cy,in:{x:left,y:cy+k*ry},out:{x:left,y:cy-k*ry}}
      ];
    }

    // 🟩 HOW IT WORKS — SVG paths stay editable; handles are lightweight controls layered above the artwork.
    // 🟪 BEGINNER TIP — Each handle stores a canvas position. Moving an anchor shifts its handles along with it.
    function renderVectors() {
      vectorLayer.innerHTML = '';
      const ns='http://www.w3.org/2000/svg';
      // The faded imported logo stays below vectors and cannot intercept drawing clicks.
      if(traceReferenceData){const image=document.createElementNS(ns,'image');image.setAttribute('href',traceReferenceData);image.setAttribute('x','0');image.setAttribute('y','0');image.setAttribute('width',String(W()));image.setAttribute('height',String(H()));image.setAttribute('preserveAspectRatio','xMidYMid meet');image.setAttribute('opacity',String(traceReferenceOpacity));image.setAttribute('pointer-events','none');vectorLayer.appendChild(image);}
      const all=vectorPaths.map((v,i)=>({v,i}));
      if(activeVector)all.push({v:activeVector,i:-1});
      const svgEl=(tag,attrs,className)=>{const node=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,String(v)));if(className)node.setAttribute('class',className);return node;};
      all.forEach(({v,i})=>{
        const path=svgEl('path',{d:pathData(v.points,v.closed),fill:v.closed&&v.fill?v.color:'none','fill-opacity':v.closed&&v.fill?'0.35':'1',stroke:v.strokeColor||v.color,'stroke-width':v.strokeWidth||v.size,'data-vector':i},'vector-path');
        path.setAttribute('pointer-events',v.closed?'visibleFill':'visiblePainted');
        if((tool==='editpoints'||tool==='shapebuilder')&&(i===selectedVector||selectedVectors.includes(i))){path.setAttribute('stroke-dasharray','5 4');path.setAttribute('stroke','#315cdb');}
        vectorLayer.appendChild(path);
        if(Array.isArray(v.details))v.details.forEach(detail=>vectorLayer.appendChild(svgEl('path',{d:pathData(detail.points,!!detail.closed),fill:'none',stroke:v.strokeColor||v.color,'stroke-width':v.strokeWidth||v.size,'data-vector':i},'vector-detail-path')));
        if(tool!=='editpoints'||i!==selectedVector)return;
        v.points.forEach((point,index)=>['in','out'].forEach(side=>{
          const handle=point[side];if(!handle)return;
          vectorLayer.appendChild(svgEl('line',{x1:point.x,y1:point.y,x2:handle.x,y2:handle.y,'pointer-events':'none'},'vector-handle-line'));
          vectorLayer.appendChild(svgEl('circle',{cx:handle.x,cy:handle.y,r:5,'data-handle':i+':'+index+':'+side,'aria-label':side==='in'?'Incoming curve handle':'Outgoing curve handle'},'vector-handle '+(side==='in'?'handle-in':'handle-out')));
        }));
        v.points.forEach((point,index)=>vectorLayer.appendChild(svgEl('circle',{cx:point.x,cy:point.y,r:6,'data-anchor':i+':'+index,'aria-label':'Anchor point '+(index+1)},'vector-anchor')));
      });
      // Text is drawn as real SVG text, not baked into the paint pixels.
      textObjects.forEach((item,index)=>{
        const node=svgEl('text',{x:item.x,y:item.y,'font-family':item.font,'font-size':item.size,fill:item.color,'data-text':index,'aria-label':'Text: '+item.text},'canvas-text');
        node.textContent=item.text;
        if(index===selectedText){node.setAttribute('paint-order','stroke');node.setAttribute('stroke','#fff');node.setAttribute('stroke-width','3');node.setAttribute('stroke-linejoin','round');node.setAttribute('filter','drop-shadow(0 0 1px #315cdb)');}
        vectorLayer.appendChild(node);
      });
    }
    // Split a straight or Bézier segment where the user clicks, preserving its original curve.
    function insertVectorPoint(vectorIndex, segmentIndex, t) {
      const vector=vectorPaths[vectorIndex];if(!vector||!vector.points.length)return false;
      const points=vector.points,nextIndex=(segmentIndex+1)%points.length,start=points[segmentIndex],end=points[nextIndex];
      const lerp=(a,b)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),curved=!!(start.out||end.in);
      let inserted;
      if(curved){
        const c1=start.out||start,c2=end.in||end,a=lerp(start,c1),b=lerp(c1,c2),c=lerp(c2,end),d=lerp(a,b),e=lerp(b,c),mid=lerp(d,e);
        start.out=a;end.in=c;inserted={x:mid.x,y:mid.y,in:d,out:e};
      }else inserted=lerp(start,end);
      if(vector.closed&&segmentIndex===points.length-1)points.push(inserted);else points.splice(segmentIndex+1,0,inserted);
      selectedVector=vectorIndex;selectedVectors=[vectorIndex];renderVectors();saveSoon();toast('Point added — drag its handles to shape the curve');return true;
    }
    function addPointNear(vectorIndex,target) {
      const vector=vectorPaths[vectorIndex],points=vector&&vector.points;if(!points||points.length<2)return false;
      let best=null;const segmentCount=vector.closed?points.length:points.length-1;
      const cubic=(p0,p1,p2,p3,t)=>{const u=1-t;return{x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y};};
      for(let i=0;i<segmentCount;i++){
        const p0=points[i],p3=points[(i+1)%points.length],isCurve=!!(p0.out||p3.in),p1=p0.out||p0,p2=p3.in||p3,samples=isCurve?32:1;
        for(let step=0;step<=samples;step++){const t=step/samples,q=isCurve?cubic(p0,p1,p2,p3,t):{x:p0.x+(p3.x-p0.x)*t,y:p0.y+(p3.y-p0.y)*t},distance=Math.hypot(q.x-target.x,q.y-target.y);if(!best||distance<best.distance)best={segment:i,t,distance};}
      }
      if(!best||best.distance>24)return false;
      return insertVectorPoint(vectorIndex,best.segment,Math.max(.02,Math.min(.98,best.t)));
    }
    // Commit the in-progress path to the vector object list.
    function finishVector(closed=false) {
      if (!activeVector || activeVector.points.length < 2) { activeVector=null; renderVectors(); return; }
      activeVector.closed=closed; vectorPaths.push(activeVector); selectedVector=vectorPaths.length-1; selectedVectors=[selectedVector]; activeVector=null;
      renderVectors(); saveSoon(); toast(closed?'Vector shape closed':'Vector path finished');
    }
    function vectorDown(event) {
      if(!['pen','bezier','vectorrect','vectoroval','editpoints','shapebuilder','text','select'].includes(tool))return;
      event.preventDefault();event.stopPropagation();const p=svgPoint(event);
      if(tool==='text'||tool==='select'){
        const textHit=event.target.closest?event.target.closest('[data-text]'):null;
        if(textHit){selectedText=Number(textHit.getAttribute('data-text'));const item=textObjects[selectedText];if(item)draggingText={index:selectedText,start:p,x:item.x,y:item.y};if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}renderVectors();return;}
        if(tool==='select'){selectedVector=-1;selectedVectors=[];renderVectors();toast('Click a vector shape or text, then drag to move it');return;}\n        const value=prompt('Type your text:');
        if(value&&value.trim()){textObjects.push({text:value,x:p.x,y:p.y,font:currentFont,size:textSize,color});selectedText=textObjects.length-1;renderVectors();saveSoon();retroSound('tick');toast('Text added — drag it to reposition');}
        return;
      }
      if(tool==='shapebuilder'){
        const pathHit=event.target.closest?event.target.closest('[data-vector]'):null;shapeBuilderDragging=true;shapeBuilderVisited=new Set();
        if(pathHit){const index=Number(pathHit.getAttribute('data-vector'));if(vectorPaths[index]&&vectorPaths[index].closed){if(event.shiftKey)selectedVectors=selectedVectors.includes(index)?selectedVectors.filter(item=>item!==index):[...selectedVectors,index];else selectedVectors=[index];selectedVector=selectedVectors.includes(index)?index:(selectedVectors[0]??-1);shapeBuilderVisited.add(index);}else{toast('Choose a closed vector shape.');shapeBuilderDragging=false;}}
        else{selectedVector=-1;selectedVectors=[];}
        if(shapeBuilderDragging&&vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}
        renderVectors();updateShapeBuilderStatus();return;
      }
      if(tool==='vectorrect'||tool==='vectoroval'){vectorShapeStart=p;vectorShapeDragging=true;activeVector={points:vectorShapePoints(p,p,tool),color,size,strokeColor:color,strokeWidth:size,fill,closed:true,curve:true};if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}renderVectors();return;}
      if(tool==='bezier'){
        if(activeVector&&activeVector.points.length>=3&&Math.hypot(p.x-activeVector.points[0].x,p.y-activeVector.points[0].y)<16){finishVector(true);return;}
        if(!activeVector)activeVector={points:[],color,size,strokeColor:color,strokeWidth:size,fill,closed:false,curve:true};
        activeVector.points.push({x:p.x,y:p.y,in:null,out:null});curveDragAnchor=activeVector.points.length-1;
        if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}renderVectors();return;
      }
      if(tool==='pen'){
        if(activeVector&&activeVector.points.length>=3&&Math.hypot(p.x-activeVector.points[0].x,p.y-activeVector.points[0].y)<16){finishVector(true);return;}
        if(!activeVector)activeVector={points:[],color,size,strokeColor:color,strokeWidth:size,fill,closed:false};activeVector.points.push({x:p.x,y:p.y});renderVectors();return;
      }
      const handleHit=event.target.closest?event.target.closest('[data-handle]'):null;
      if(handleHit){const [vector,point,side]=handleHit.getAttribute('data-handle').split(':');selectedVector=Number(vector);selectedVectors=[selectedVector];draggingHandle={vector:Number(vector),point:Number(point),side,breakPair:!!event.altKey};if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}renderVectors();return;}
      const anchorHit=event.target.closest?event.target.closest('[data-anchor]'):null;
      if(anchorHit){const [vector,point]=anchorHit.getAttribute('data-anchor').split(':').map(Number);selectedVector=vector;selectedVectors=[vector];draggingAnchor={vector,point,createHandles:!!(event.altKey||event.optionKey),original:{...vectorPaths[vector].points[point]}};if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}renderVectors();return;}
      const pathHit=event.target.closest?event.target.closest('[data-vector]'):null;
      if(pathHit){const index=Number(pathHit.getAttribute('data-vector'));if(event.shiftKey){selectedVectors=selectedVectors.includes(index)?selectedVectors.filter(i=>i!==index):[...selectedVectors,index];selectedVector=index;renderVectors();updateShapeInspector();return;}if(index>=0&&vectorPaths[index]){selectedVector=index;selectedVectors=[index];if(event.altKey&&addPointNear(index,p))return;const shape=vectorPaths[index];draggingVector={vector:index,start:p,points:shape.points.map(q=>({...q,in:q.in?{...q.in}:null,out:q.out?{...q.out}:null}))};if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}renderVectors();updateShapeInspector();return;}}
      selectedVector=-1;selectedVectors=[];updateShapeInspector();renderVectors();
    }
    function vectorMove(event) {
      if(draggingVector&&(tool==='editpoints'||tool==='select')){event.preventDefault();const p=svgPoint(event,null,false),dx=p.x-draggingVector.start.x,dy=p.y-draggingVector.start.y,v=vectorPaths[draggingVector.vector];if(v){v.points=draggingVector.points.map(q=>({...q,x:q.x+dx,y:q.y+dy,in:q.in?{x:q.in.x+dx,y:q.in.y+dy}:null,out:q.out?{x:q.out.x+dx,y:q.out.y+dy}:null}));renderVectors();}return;}
      if(draggingText&&(tool==='text'||tool==='select')){event.preventDefault();const p=svgPoint(event,null,false),item=textObjects[draggingText.index];if(item){item.x=draggingText.x+(p.x-draggingText.start.x);item.y=draggingText.y+(p.y-draggingText.start.y);renderVectors();}return;}
      if(shapeBuilderDragging&&tool==='shapebuilder'){const element=document.elementFromPoint(event.clientX,event.clientY),pathHit=element&&element.closest?element.closest('[data-vector]'):null;if(pathHit){const index=Number(pathHit.getAttribute('data-vector'));if(vectorPaths[index]&&vectorPaths[index].closed&&!shapeBuilderVisited.has(index)){shapeBuilderVisited.add(index);if(!selectedVectors.includes(index))selectedVectors.push(index);selectedVector=index;renderVectors();updateShapeBuilderStatus();}}return;}
      if(vectorShapeDragging&&vectorShapeStart&&activeVector&&(tool==='vectorrect'||tool==='vectoroval')){event.preventDefault();activeVector.points=vectorShapePoints(vectorShapeStart,svgPoint(event),tool);renderVectors();return;}
      if(tool==='bezier'&&curveDragAnchor!==null&&activeVector){event.preventDefault();const p=svgPoint(event,null,false),anchor=activeVector.points[curveDragAnchor];if(anchor){const dx=p.x-anchor.x,dy=p.y-anchor.y;anchor.out={x:p.x,y:p.y};anchor.in={x:anchor.x-dx,y:anchor.y-dy};renderVectors();}return;}
      if(draggingHandle&&tool==='editpoints'){event.preventDefault();const p=svgPoint(event,null,false),state=draggingHandle,v=vectorPaths[state.vector],anchor=v&&v.points[state.point];if(anchor){const dx=p.x-anchor.x,dy=p.y-anchor.y;anchor[state.side]={x:p.x,y:p.y};const other=state.side==='in'?'out':'in';if(!state.breakPair){const length=Math.hypot(dx,dy);anchor[other]=length?{x:anchor.x-dx,y:anchor.y-dy}:null;}renderVectors();}return;}
      if(draggingAnchor&&tool==='editpoints'){event.preventDefault();const state=draggingAnchor,v=vectorPaths[state.vector],anchor=v&&v.points[state.point];if(!anchor)return;if(state.createHandles){const p=svgPoint(event,null,false),dx=p.x-state.original.x,dy=p.y-state.original.y;anchor.x=state.original.x;anchor.y=state.original.y;anchor.out={x:p.x,y:p.y};anchor.in={x:anchor.x-dx,y:anchor.y-dy};}else{const p=svgPoint(event,{vector:state.vector,point:state.point}),dx=p.x-anchor.x,dy=p.y-anchor.y;anchor.x=p.x;anchor.y=p.y;if(anchor.in)anchor.in={x:anchor.in.x+dx,y:anchor.in.y+dy};if(anchor.out)anchor.out={x:anchor.out.x+dx,y:anchor.out.y+dy};}renderVectors();}
    }
    function vectorUp(event) {
      if(event&&vectorLayer.releasePointerCapture){try{vectorLayer.releasePointerCapture(event.pointerId);}catch(_){}}
      if(draggingText){draggingText=null;saveSoon();return;}
      if(draggingVector){draggingVector=null;renderVectors();updateShapeInspector();saveSoon();retroSound('shape');return;}
      if(shapeBuilderDragging){shapeBuilderDragging=false;shapeBuilderVisited.clear();updateShapeBuilderStatus();return;}
      if(vectorShapeDragging){if(event&&activeVector)activeVector.points=vectorShapePoints(vectorShapeStart,svgPoint(event),tool);if(activeVector){vectorPaths.push(activeVector);selectedVector=vectorPaths.length-1;selectedVectors=[selectedVector];}activeVector=null;vectorShapeStart=null;vectorShapeDragging=false;renderVectors();updateShapeInspector();saveSoon();retroSound('shape');return;}
      if(curveDragAnchor!==null){curveDragAnchor=null;renderVectors();saveSoon();return;}
      if(draggingHandle){draggingHandle=null;renderVectors();saveSoon();return;}
      if(draggingAnchor){draggingAnchor=null;renderVectors();saveSoon();return;}
    }
    function shape(p) {
      octx.clearRect(0,0,W(),H()); octx.save();
      octx.strokeStyle=drawingStyle(); octx.fillStyle=drawingStyle(); octx.lineWidth=size;
      octx.lineCap='round'; octx.lineJoin='round';
      const x=Math.min(startPoint.x,p.x), y=Math.min(startPoint.y,p.y);
      const w=Math.abs(startPoint.x-p.x), h=Math.abs(startPoint.y-p.y);
      if(tool==='line'){octx.beginPath();octx.moveTo(startPoint.x,startPoint.y);octx.lineTo(p.x,p.y);octx.stroke();}
      if(tool==='rect'){if(fill)octx.fillRect(x,y,w,h);else octx.strokeRect(x,y,w,h);}
      if(tool==='ellipse'){octx.beginPath();octx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);if(fill)octx.fill();else octx.stroke();}
      octx.restore();
    }
    // 🟩 HOW IT WORKS — FatBits magnifies the artboard and writes one real canvas pixel per click/drag.
    // 🟪 BEGINNER TIP — Turn FatBits off to return to normal freehand drawing; the pixels stay in your artwork.
    function selectionContains(x,y){
      if(!selectionMask||x<0||y<0||x>=W()||y>=H())return false;
      return selectionMask[Math.floor(y)*W()+Math.floor(x)]===1;
    }
    function drawSelectionOutline(close=false){
      sctx.clearRect(0,0,W(),H());
      if(!lassoPoints.length)return;
      sctx.save();sctx.strokeStyle='#111';sctx.lineWidth=1;sctx.setLineDash([4,3]);sctx.beginPath();
      sctx.moveTo(lassoPoints[0].x,lassoPoints[0].y);
      for(let i=1;i<lassoPoints.length;i++)sctx.lineTo(lassoPoints[i].x,lassoPoints[i].y);
      if(close)sctx.closePath();
      sctx.stroke();sctx.restore();
    }
    function rebuildSelectionLayers(){
      if(!selectionMask){selectionBitmap=null;selectionBase=null;return;}
      const w=W(),h=H(),current=ctx.getImageData(0,0,w,h),base=new ImageData(new Uint8ClampedArray(current.data),w,h),picked=new ImageData(w,h);
      let minX=w,minY=h,maxX=0,maxY=0,any=false;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const idx=y*w+x;if(!selectionMask[idx])continue;any=true;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
        const k=idx*4;picked.data[k]=current.data[k];picked.data[k+1]=current.data[k+1];picked.data[k+2]=current.data[k+2];picked.data[k+3]=current.data[k+3];
        base.data[k]=255;base.data[k+1]=255;base.data[k+2]=255;base.data[k+3]=255;
      }
      if(!any){selectionMask=null;selectionBase=null;selectionBitmap=null;selectionBounds=null;return;}
      selectionBase=base;selectionBounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
      selectionBitmap=document.createElement('canvas');selectionBitmap.width=w;selectionBitmap.height=h;selectionBitmap.getContext('2d').putImageData(picked,0,0);
    }
    function makeLassoSelection(){
      const w=W(),h=H();if(lassoPoints.length<3){lassoPoints=[];drawSelectionOutline();return;}
      const maskCanvas=document.createElement('canvas');maskCanvas.width=w;maskCanvas.height=h;const mctx=maskCanvas.getContext('2d');
      mctx.fillStyle='#fff';mctx.beginPath();mctx.moveTo(lassoPoints[0].x,lassoPoints[0].y);
      for(let i=1;i<lassoPoints.length;i++)mctx.lineTo(lassoPoints[i].x,lassoPoints[i].y);
      mctx.closePath();mctx.fill();
      const pixels=mctx.getImageData(0,0,w,h).data;selectionMask=new Uint8Array(w*h);
      for(let i=0;i<selectionMask.length;i++)if(pixels[i*4+3]>0)selectionMask[i]=1;
      rebuildSelectionLayers();drawSelectionOutline(true);
      $('toolStatus').innerHTML='<strong>Tool:</strong> Lasso select';
      toast('Selection made — drag inside it to move, or fill it with the active pattern');
    }
    function clearSelection(){
      selectionMask=null;selectionBitmap=null;selectionBase=null;selectionBounds=null;selectionMove=null;lassoPoints=[];lassoDrawing=false;sctx.clearRect(0,0,W(),H());toast('Selection cleared');
    }
    function fillSelection(){
      if(!selectionMask){toast('Make a lasso selection first');return;}
      snapshot();const image=ctx.getImageData(0,0,W(),H()),data=image.data,rgb=hexRgb(color);
      for(let idx=0;idx<selectionMask.length;idx++)if(selectionMask[idx]){
        const x=idx%W(),y=(idx/W)|0,k=idx*4,ink=selectedPattern==='solid'||patternInkAt(x,y);
        data[k]=ink?rgb[0]:255;data[k+1]=ink?rgb[1]:255;data[k+2]=ink?rgb[2]:255;data[k+3]=255;
      }
      ctx.putImageData(image,0,0);rebuildSelectionLayers();saveSoon();retroSound('fill');toast('Selection filled with '+(selectedPattern==='solid'?'solid ink':'active pattern'));
    }
    function paintInputSegment(from,to,event,erase=false){
      const originalSize=size;
      if(event&&event.pointerType==='pen'&&event.pressure>0)size=Math.max(1,originalSize*(.35+event.pressure*1.65));
      if(tool==='fingerpaint'&&!erase){
        const width=Math.max(12,size*1.8);
        ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;
        ctx.globalAlpha=.28;ctx.lineWidth=width*1.45;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
        ctx.globalAlpha=.62;ctx.lineWidth=width*.72;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
        ctx.globalAlpha=.22;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(to.x,to.y,Math.max(2,width*.12),0,Math.PI*2);ctx.fill();ctx.restore();
      }else paintBrushSegment(from,to,erase);
      size=originalSize;
    }

    function drawFatBit(event) {
      const rect=canvasWrap.getBoundingClientRect();
      const x=Math.max(0,Math.min(W()-1,Math.floor((event.clientX-rect.left-fatBitsOffsetX)/zoomLevel)));
      const y=Math.max(0,Math.min(H()-1,Math.floor((event.clientY-rect.top-fatBitsOffsetY)/zoomLevel)));
      if(lastFatBit&&lastFatBit.x===x&&lastFatBit.y===y)return;
      ctx.fillStyle=tool==='eraser'?'#ffffff':color;
      ctx.fillRect(x,y,1,1);
      lastFatBit={x,y};
      $('coordStatus').textContent=x+' × '+y+' px';
    }
    function down(event) {
      event.preventDefault();
      if(tool==='lasso'){
        const p=point(event);
        if(selectionContains(p.x,p.y)){
          snapshot();selectionMove={start:p,dx:0,dy:0};if(canvas.setPointerCapture){try{canvas.setPointerCapture(event.pointerId);}catch(_){}}
        }else{
          selectionMask=null;selectionBitmap=null;selectionBase=null;selectionBounds=null;lassoPoints=[p];lassoDrawing=true;drawSelectionOutline(false);
          if(canvas.setPointerCapture){try{canvas.setPointerCapture(event.pointerId);}catch(_){}}
        }
        return;
      }
      if(fatBitsMode&&(spaceHeld||event.button===1)){
        fatBitsPanning=true;fatBitsPanStart={x:event.clientX,y:event.clientY,offsetX:fatBitsOffsetX,offsetY:fatBitsOffsetY};
        if(canvas.setPointerCapture){try{canvas.setPointerCapture(event.pointerId);}catch(_){}}
        canvasWrap.style.cursor='grabbing';return;
      }
      if(fatBitsMode){snapshot();drawing=true;lastFatBit=null;drawFatBit(event);if(canvas.setPointerCapture){try{canvas.setPointerCapture(event.pointerId);}catch(_){}}return;}
      const p=point(event);
      $('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';
      if(tool==='text')return; // SVG text creation is handled by vectorDown so each label stays movable.
      if(tool==='eyedropper'){
        const d=ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;
        color='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
        $('colorInput').value=color;updateColorIndicator();toast('Color picked: '+color.toUpperCase());return;
      }
      if(tool==='bucket'){snapshot();floodFill(p.x,p.y);return;}
      if(tool==='hand'){
        panDragStart={x:event.clientX,y:event.clientY,panX,panY};
        if(canvas.setPointerCapture){try{canvas.setPointerCapture(event.pointerId);}catch(_){}}
        canvasWrap.style.cursor='grabbing';return;
      }
      drawing=true;startPoint=p;lastPoint=p;snapshot();retroSound('start');
      if(tool==='pencil'||tool==='eraser'||tool==='fingerpaint'){paintInputSegment(p,p,event,tool==='eraser');}
      if(canvas.setPointerCapture){try{canvas.setPointerCapture(event.pointerId);}catch(_){}}
    }
    function move(event) {
      if(panDragStart&&tool==='hand'){
        panX=panDragStart.panX+(event.clientX-panDragStart.x);panY=panDragStart.panY+(event.clientY-panDragStart.y);
        $('rulerLayout').style.transform=`translate(${panX}px, ${panY}px)`;return;
      }
      if(lassoDrawing&&tool==='lasso'){
        const p=point(event),last=lassoPoints[lassoPoints.length-1];
        if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=2){lassoPoints.push(p);drawSelectionOutline(false);}
        return;
      }
      if(selectionMove&&tool==='lasso'){
        const p=point(event);selectionMove.dx=Math.round(p.x-selectionMove.start.x);selectionMove.dy=Math.round(p.y-selectionMove.start.y);
        ctx.putImageData(selectionBase,0,0);ctx.drawImage(selectionBitmap,selectionMove.dx,selectionMove.dy);
        sctx.clearRect(0,0,W(),H());sctx.save();sctx.translate(selectionMove.dx,selectionMove.dy);sctx.strokeStyle='#111';sctx.lineWidth=1;sctx.setLineDash([4,3]);sctx.beginPath();sctx.moveTo(lassoPoints[0].x,lassoPoints[0].y);for(let i=1;i<lassoPoints.length;i++)sctx.lineTo(lassoPoints[i].x,lassoPoints[i].y);sctx.closePath();sctx.stroke();sctx.restore();return;
      }
      if(fatBitsPanning&&fatBitsPanStart){
        fatBitsOffsetX=fatBitsPanStart.offsetX+(event.clientX-fatBitsPanStart.x);
        fatBitsOffsetY=fatBitsPanStart.offsetY+(event.clientY-fatBitsPanStart.y);
        updateFatBitsView();return;
      }
      if(!drawing)return;
      if(fatBitsMode){drawFatBit(event);return;}
      const p=point(event);
      $('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';
      if(tool==='pencil'||tool==='eraser'||tool==='fingerpaint'){paintInputSegment(lastPoint,p,event,tool==='eraser');lastPoint=p;}
      else if(['line','rect','ellipse'].includes(tool)) shape(p);
    }
    function up(event) {
      if(panDragStart){panDragStart=null;canvasWrap.style.cursor='grab';if(event&&event.pointerId!==undefined&&canvas.releasePointerCapture){try{canvas.releasePointerCapture(event.pointerId);}catch(_){}}return;}
      if(lassoDrawing&&tool==='lasso'){
        lassoDrawing=false;makeLassoSelection();if(event&&event.pointerId!==undefined&&canvas.releasePointerCapture){try{canvas.releasePointerCapture(event.pointerId);}catch(_){}}
        return;
      }
      if(selectionMove&&tool==='lasso'){
        const moveState=selectionMove;selectionMove=null;
        ctx.putImageData(selectionBase,0,0);ctx.drawImage(selectionBitmap,moveState.dx,moveState.dy);
        const moved=new Uint8Array(W()*H());
        for(let y=0;y<H();y++)for(let x=0;x<W();x++){const nx=x+moveState.dx,ny=y+moveState.dy;if(selectionMask[y*W()+x]&&nx>=0&&ny>=0&&nx<W()&&ny<H())moved[ny*W()+nx]=1;}
        selectionMask=moved;lassoPoints=lassoPoints.map(p=>({x:p.x+moveState.dx,y:p.y+moveState.dy}));rebuildSelectionLayers();drawSelectionOutline(true);saveSoon();
        if(event&&event.pointerId!==undefined&&canvas.releasePointerCapture){try{canvas.releasePointerCapture(event.pointerId);}catch(_){}}
        return;
      }
      if(fatBitsPanning){
        fatBitsPanning=false;fatBitsPanStart=null;canvasWrap.style.cursor='crosshair';
        if(event&&event.pointerId!==undefined&&canvas.releasePointerCapture){try{canvas.releasePointerCapture(event.pointerId);}catch(_){}}
        return;
      }
      if(!drawing)return;
      if(event && event.pointerId!==undefined && canvas.releasePointerCapture){try{canvas.releasePointerCapture(event.pointerId);}catch(_){}}
      if(!fatBitsMode&&['line','rect','ellipse'].includes(tool)){ctx.drawImage(overlay,0,0);octx.clearRect(0,0,W(),H());}
      drawing=false;lastFatBit=null;saveSoon();retroSound('end');
      if(event){const p=point(event);$('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';}
    }
    document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>selectTool(b.dataset.tool, true)));
    $('fillSelectionBtn').addEventListener('click',fillSelection);
    $('clearSelectionBtn').addEventListener('click',clearSelection);
    vectorLayer.addEventListener('pointerdown',vectorDown);
    vectorLayer.addEventListener('pointermove',vectorMove);
    vectorLayer.addEventListener('pointerup',vectorUp);
    vectorLayer.addEventListener('pointercancel',vectorUp);
    vectorLayer.addEventListener('dblclick',event=>{if((tool==='pen'||tool==='bezier')&&activeVector){event.preventDefault();finishVector(false);}});
    document.addEventListener('keydown',event=>{
      if(event.key===' '&&fatBitsMode){spaceHeld=true;event.preventDefault();}
      if(event.key==='Enter'&&(tool==='pen'||tool==='bezier')&&activeVector)finishVector(false);
      if(event.key==='Escape'&&activeVector){activeVector=null;renderVectors();toast('Path cancelled');}
      const target=event.target,typing=target&&(target.matches('input,textarea,select')||target.isContentEditable);
      if(!typing&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){
        event.preventDefault();if(event.shiftKey)$('redoBtn').click();else $('undoBtn').click();
      }else if(!typing&&event.ctrlKey&&event.key.toLowerCase()==='y'){event.preventDefault();$('redoBtn').click();}
    });
    document.addEventListener('keyup',event=>{if(event.key===' ')spaceHeld=false;});
    document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{color=b.dataset.color;$('colorInput').value=color;updateColorIndicator();retroSound('color');toast('Color selected: '+color.toUpperCase());}));
    $('colorInput').addEventListener('input',e=>{color=e.target.value;updateColorIndicator();retroSound('color');});
    $('sizeInput').addEventListener('input',e=>{size=Number(e.target.value);$('sizeValue').textContent=size+'px';});
    $('shapeStrokeColor').addEventListener('input',e=>{const v=vectorPaths[selectedVector];if(!v)return;v.strokeColor=e.target.value;renderVectors();saveSoon();retroSound('color');});
    $('shapeStrokeWidth').addEventListener('input',e=>{const v=vectorPaths[selectedVector];$('shapeStrokeWidthValue').textContent=e.target.value+' px';if(!v)return;v.strokeWidth=Number(e.target.value);renderVectors();saveSoon();});
    $('bringShapeFrontBtn').addEventListener('click',()=>moveSelectedShape(true));$('sendShapeBackBtn').addEventListener('click',()=>moveSelectedShape(false));
    $('textSizeInput').addEventListener('input',e=>{textSize=Number(e.target.value);$('textSizeValue').textContent=textSize+'px';});
    renderPatternPreviews();
    document.querySelectorAll('.pattern-swatch').forEach(button => button.addEventListener('click', () => { selectedPattern = button.dataset.pattern; document.querySelectorAll('.pattern-swatch').forEach(swatch => { const active = swatch === button; swatch.classList.toggle('active', active); swatch.setAttribute('aria-pressed', String(active)); }); toast('Pattern: ' + (selectedPattern === 'solid' ? 'Solid ink' : button.title || selectedPattern)); saveSoon(); }));
    document.addEventListener('pointermove',()=>{if(drawing){const now=performance.now();if(now-lastDragSound>90){lastDragSound=now;retroSound('tick');}}});
    document.querySelectorAll('.brush-option').forEach(b=>b.addEventListener('click',()=>{selectedBrush=b.dataset.brush;document.querySelectorAll('.brush-option').forEach(x=>x.classList.toggle('active',x===b));toast('Brush: '+b.dataset.brush);}));
    function importLocalImage(file,kind){if(!file||!file.type||!file.type.startsWith('image/')){toast('Choose an image file');return;}const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{const max=kind==='brush'?128:64,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),tile=document.createElement('canvas');tile.width=Math.max(1,Math.round(image.naturalWidth*scale));tile.height=Math.max(1,Math.round(image.naturalHeight*scale));const t=tile.getContext('2d',{willReadFrequently:true});t.imageSmoothingEnabled=false;t.drawImage(image,0,0,tile.width,tile.height);URL.revokeObjectURL(url);try{const data=tile.toDataURL('image/png');if(kind==='brush'){customBrushCanvas=tile;localStorage.setItem('mpde-custom-brush',data);document.querySelector('.custom-brush-option').hidden=false;$('customBrushMark').style.backgroundImage='url("'+data+'")';$('customBrushMark').style.backgroundSize='contain';$('customBrushStatus').textContent=file.name+' · '+tile.width+' × '+tile.height;selectedBrush='custom';document.querySelectorAll('.brush-option').forEach(b=>b.classList.toggle('active',b.dataset.brush==='custom'));toast('Custom brush loaded');}else{customPatternCanvas=tile;customPatternPixels=t.getImageData(0,0,tile.width,tile.height).data;localStorage.setItem('mpde-custom-pattern',data);const sw=document.querySelector('.custom-pattern-swatch');sw.hidden=false;sw.title=file.name;selectedPattern='custom';document.querySelectorAll('.pattern-swatch').forEach(b=>{const a=b.dataset.pattern==='custom';b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));});$('customPatternStatus').textContent=file.name+' · repeat '+tile.width+' × '+tile.height;renderPatternPreviews();toast('Custom texture loaded');}saveSoon();}catch(err){toast('Could not save image; try a smaller file');console.warn(err);}};image.onerror=()=>{URL.revokeObjectURL(url);toast('Could not read image; try PNG or JPEG');};image.src=url;}
    // Import a scaled logo as a translucent reference layer; nothing is uploaded to a server.
    function loadTraceReference(file){
      if(!file||!file.type.startsWith('image/'))return toast('Choose an image file');
      if(file.size>8*1024*1024)return toast('Please choose an image smaller than 8 MB');
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{try{const scale=Math.min(1,W()/img.naturalWidth,H()/img.naturalHeight),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));const cctx=c.getContext('2d');if(!cctx)throw Error('Canvas unavailable');cctx.drawImage(img,0,0,c.width,c.height);traceReferenceData=c.toDataURL('image/png');try{localStorage.setItem('mpde-trace-reference',traceReferenceData);}catch(error){console.warn(error);}traceReferenceOpacity=Number($('traceOpacity').value)/100;$('traceReferenceStatus').textContent=file.name+' · guide loaded';renderVectors();toast('Logo guide loaded');}catch(error){toast('Could not import image');console.warn(error);}finally{URL.revokeObjectURL(url);}};
      img.onerror=()=>{URL.revokeObjectURL(url);toast('Could not read image; try PNG or JPEG');};img.src=url;
    }
    // Threshold-based contour tracing creates editable polygon paths for high-contrast sticker art.
    function traceLogo(){
      if(!traceReferenceData)return toast('Import a logo first');
      const img=new Image();img.onload=()=>{
        const scale=Math.min(1,320/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale)),c=document.createElement('canvas');c.width=w;c.height=h;
        const cc=c.getContext('2d',{willReadFrequently:true});if(!cc)return toast('Could not prepare image');cc.drawImage(img,0,0,w,h);
        const data=cc.getImageData(0,0,w,h).data,threshold=Number($('traceThreshold').value),invert=$('traceInvert').checked,mask=new Uint8Array(w*h);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,lum=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];mask[y*w+x]=data[i+3]>32&&(invert?lum>=threshold:lum<threshold)?1:0;}
        const on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x],edges=[];
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(on(x,y)){if(!on(x,y-1))edges.push({x,y,x2:x+1,y2:y});if(!on(x+1,y))edges.push({x:x+1,y,x2:x+1,y2:y+1});if(!on(x,y+1))edges.push({x:x+1,y:y+1,x2:x,y2:y+1});if(!on(x-1,y))edges.push({x,y:y+1,x2:x,y2:y});}
        if(!edges.length)return toast('No foreground found — adjust threshold or invert');
        const key=(x,y)=>x+','+y,nextMap=new Map();edges.forEach((e,i)=>{const k=key(e.x,e.y);if(!nextMap.has(k))nextMap.set(k,[]);nextMap.get(k).push(i);});
        const used=new Uint8Array(edges.length),contours=[];
        for(let start=0;start<edges.length;start++){if(used[start])continue;const pts=[];let cur=start,guard=0;while(!used[cur]&&guard++<=edges.length){const e=edges[cur];used[cur]=1;pts.push({x:e.x,y:e.y});if(e.x2===edges[start].x&&e.y2===edges[start].y)break;const n=(nextMap.get(key(e.x2,e.y2))||[]).find(i=>!used[i]);if(n===undefined)break;cur=n;}
          const simple=pts.filter((p,i)=>{if(pts.length<4)return true;const a=pts[(i+pts.length-1)%pts.length],b=pts[(i+1)%pts.length];return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x);});if(simple.length>=3)contours.push(simple);}
        if(!contours.length)return toast('Could not find a usable outline');
        const fit=Math.min(W()/img.naturalWidth,H()/img.naturalHeight),dw=img.naturalWidth*fit,dh=img.naturalHeight*fit,ox=(W()-dw)/2,oy=(H()-dh)/2,sx=dw/w,sy=dh/h;
        const traced=contours.map(points=>({points:points.map(p=>({x:ox+p.x*sx,y:oy+p.y*sy})),color,size:1,strokeColor:color,strokeWidth:1,fill:true,closed:true,curve:false,traced:true}));
        vectorPaths.push(...traced);selectedVector=vectorPaths.length-1;selectedVectors=[selectedVector];renderVectors();updateShapeInspector();saveSoon();toast('Traced '+traced.length+' editable outline(s)');
      };img.onerror=()=>toast('Could not read the guide image');img.src=traceReferenceData;
    }
    $('traceLogoUpload').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)loadTraceReference(f);e.target.value='';});
    $('traceOpacity').addEventListener('input',e=>{traceReferenceOpacity=Number(e.target.value)/100;$('traceOpacityValue').textContent=e.target.value+'%';renderVectors();});
    $('traceLogoBtn').addEventListener('click',traceLogo);
    $('clearTraceReferenceBtn').addEventListener('click',()=>{traceReferenceData='';try{localStorage.removeItem('mpde-trace-reference');}catch(error){console.warn(error);}$('traceReferenceStatus').textContent='No logo guide loaded';renderVectors();});
    $('convertShapeBtn').addEventListener('click',()=>convertSelectedShape($('convertShapeType').value));
    try{traceReferenceData=localStorage.getItem('mpde-trace-reference')||'';if(traceReferenceData)$('traceReferenceStatus').textContent='Saved logo guide restored';}catch(error){console.warn(error);}
    $('customBrushUpload').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)importLocalImage(f,'brush');e.target.value='';});$('customPatternUpload').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)importLocalImage(f,'pattern');e.target.value='';});
    function restoreLocalImage(key,kind){try{const data=localStorage.getItem(key);if(!data)return;const im=new Image();im.onload=()=>{const tile=document.createElement('canvas');tile.width=im.naturalWidth;tile.height=im.naturalHeight;const t=tile.getContext('2d',{willReadFrequently:true});t.drawImage(im,0,0);if(kind==='brush'){customBrushCanvas=tile;document.querySelector('.custom-brush-option').hidden=false;$('customBrushMark').style.backgroundImage='url("'+data+'")';$('customBrushStatus').textContent='Saved custom brush · '+tile.width+' × '+tile.height;}else{customPatternCanvas=tile;customPatternPixels=t.getImageData(0,0,tile.width,tile.height).data;document.querySelector('.custom-pattern-swatch').hidden=false;$('customPatternStatus').textContent='Saved custom texture · '+tile.width+' × '+tile.height;renderPatternPreviews();}};im.src=data;}catch(err){console.warn(err);}}restoreLocalImage('mpde-custom-brush','brush');restoreLocalImage('mpde-custom-pattern','pattern');
    const aiDialog=$('aiAssistantDialog'),aiPrompt=$('aiAssistantPrompt'),aiResponse=$('aiAssistantResponse');
    function localArtHelp(q){q=(q||'').toLowerCase();let title='Creative starting point',tips=['Start with one small goal and experiment with one tool at a time.','Limit your palette for a classic Macintosh look and leave some clean space.'];if(/pixel|fatbits|dither|1-bit/.test(q)){title='Pixel-art workflow';tips=['Turn on Pixel Mode / FatBits and zoom in until individual pixels are easy to place.','Use 2–4 colors and try checker, stipple, or gray patterns for extra value steps.','Zoom out often to check that the silhouette reads clearly.'];}else if(/pattern|texture|shade|grain|fabric|paper/.test(q)){title='Patterns and shading';tips=['Block in the silhouette with a solid color first.','Use sparse dots for light shadow and crosshatch for darker areas; try a custom tile for paper or fabric grain.','Keep texture consistent and leave clean areas.'];}else if(/brush|stamp|upload|custom/.test(q)){title='Custom brush tips';tips=['Transparent PNGs give the cleanest stamp edges.','Choose a simple high-contrast shape and adjust brush size.','Brushes stamp along your stroke; patterns repeat continuously.'];}else if(/ui|interface|tool|button|where/.test(q)){title='Finding tools';tips=['The left Toolbox chooses tools; the right Inspector controls brush, color, size, patterns, and text.','Use Pixel Mode for individual pixels and the navigator to recenter.','Use Undo to reverse a test mark.'];}else if(/retro|1980|80s|poster|idea|macintosh/.test(q)){title='Retro poster idea';tips=['Use a dark navy background, cyan grid, and one oversized geometric subject.','Try chunky pixel lettering, a 4-color palette, and a sparse halftone shadow.','Keep margins generous for a vintage-computer feel.'];}else if(/chrome|metal|sphere|gradient/.test(q)){title='Chrome shading recipe';tips=['Use four hard-edged bands: near-black, deep blue, cyan/white highlight, and dark reflection.','Keep highlights sharp rather than perfectly smooth for a low-res retro look.','Add a bright rim and offset dark shadow.'];}aiResponse.replaceChildren();const strong=document.createElement('strong');strong.textContent=title;aiResponse.appendChild(strong);const list=document.createElement('ol');tips.forEach(t=>{const li=document.createElement('li');li.textContent=t;list.appendChild(li);});aiResponse.appendChild(list);}
    $('aiAssistantBtn').addEventListener('click',()=>{aiDialog.hidden=false;aiPrompt.focus();});$('aiAssistantClose').addEventListener('click',()=>{aiDialog.hidden=true;});aiDialog.addEventListener('click',e=>{if(e.target===aiDialog)aiDialog.hidden=true;});
    document.querySelectorAll('[data-ai-prompt]').forEach(b=>b.addEventListener('click',()=>{aiPrompt.value=b.dataset.aiPrompt;localArtHelp(aiPrompt.value);}));$('aiGetHelpBtn').addEventListener('click',()=>{if(!aiPrompt.value.trim()){toast('Describe what you need help with');aiPrompt.focus();return;}localArtHelp(aiPrompt.value);});
    $('aiAskChatGPTBtn').addEventListener('click',()=>{const q=aiPrompt.value.trim()||'Suggest a beginner-friendly retro pixel-art technique.';const prompt='I am using Mac Paint Draw Enhanced, a classic Mac-inspired browser paint app with custom brushes, textures, FatBits pixel zoom, vector tools, and animation. Please give beginner-friendly steps for: '+q;window.open('https://chatgpt.com/?q='+encodeURIComponent(prompt),'_blank','noopener,noreferrer');});aiPrompt.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')$('aiGetHelpBtn').click();if(e.key==='Escape')aiDialog.hidden=true;});
    $('roughPaperToggle').addEventListener('change',e=>{roughPaper=e.target.checked;canvasWrap.classList.toggle('rough-paper',roughPaper);saveSoon();toast(roughPaper?'Rough paper texture on':'Rough paper texture off');});
    // 🟩 HOW IT WORKS — One CRT menu selects a single visual phosphor tint; artwork pixels stay unchanged.
    // 🟪 BEGINNER TIP — Add new CRT choices to the menu and this class map.
    function setCrtMode(mode, announce = true) {
      const allowed = ['off','blue','red','green','yellow'];
      crtMode = allowed.includes(mode) ? mode : 'off';
      ['blue','red','green','yellow'].forEach(name => canvasWrap.classList.toggle('crt-' + name, crtMode === name));
      // Tint the paper through the CSS multiply overlay. CSS color-blend leaves white paper white,
      // and a filter on the wrapper can distort the tint twice, so keep the wrapper itself unfiltered.
      canvasWrap.style.filter = 'none';
      canvasWrap.style.backgroundColor = ({off:'#ffffff',blue:'#a9cbf5',red:'#f3b5b5',green:'#b9e5bd',yellow:'#f3e69b'})[crtMode];
      document.querySelectorAll('[data-crt]').forEach(button => {
        const active = button.dataset.crt === crtMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      const menu = $('crtMenu');
      if (menu) menu.querySelector('summary').classList.toggle('primary', crtMode !== 'off');
      saveSoon();
      if (announce) toast(crtMode === 'off' ? 'CRT effect off' : crtMode[0].toUpperCase() + crtMode.slice(1) + ' CRT effect on');
    }
    document.querySelectorAll('[data-crt]').forEach(button => button.addEventListener('click', () => {
      setCrtMode(button.dataset.crt);
      $('crtMenu').open = false;
    }));
    $('fatBitsBtn').addEventListener('click',()=>{
      fatBitsMode=!fatBitsMode;
      if(fatBitsMode){
        zoomBeforeFatBits=zoomLevel;fatBitsOffsetX=0;fatBitsOffsetY=0;setZoom(12);updateFatBitsGrid();
        $('fatBitsGrid').classList.add('active');canvasWrap.classList.add('fatbits-active');
        toast('FatBits on — drag with Space, or use the arrow pad to move around the canvas');
      }else{
        $('fatBitsGrid').classList.remove('active');canvasWrap.classList.remove('fatbits-active');
        fatBitsOffsetX=0;fatBitsOffsetY=0;setZoom(zoomBeforeFatBits);toast('FatBits off — normal drawing restored');
      }
      setToggleButton('fatBitsBtn',fatBitsMode);
    });
    document.querySelectorAll('[data-fatpan]').forEach(button=>button.addEventListener('click',()=>{
      if(!fatBitsMode){toast('Turn on FatBits first to move the magnified view');return;}
      const direction=button.dataset.fatpan,step=Math.max(120,canvasWrap.clientWidth*.35);
      if(direction==='left')fatBitsOffsetX+=step;
      if(direction==='right')fatBitsOffsetX-=step;
      if(direction==='up')fatBitsOffsetY+=step;
      if(direction==='down')fatBitsOffsetY-=step;
      if(direction==='center'){fatBitsOffsetX=0;fatBitsOffsetY=0;}
      updateFatBitsView();
    }));
    $('fillToggle').addEventListener('change',e=>{fill=e.target.checked;saveSoon();toast(fill?'Shape fill on':'Shape fill off');});
    $('snapCheck').addEventListener('change', e => toast(e.target.checked ? 'Smart snapping on: visible guides, grid, and vector anchors' : 'Smart snapping off'));
    // Snap-to-guides is a native checkbox; drawing reads its checked state.
    $('guidesBtn').addEventListener('click',()=>{showGuides=!showGuides;if(showGuides&&guideX===null){guideX=Math.round(W()/2);guideY=Math.round(H()/2);}setToggleButton('guidesBtn',showGuides);drawGuides();saveSoon();toast(showGuides?'Guides on':'Guides off');});
    $('gridBtn').addEventListener('click',()=>{showGrid=!showGrid;setToggleButton('gridBtn',showGrid);drawGuides();saveSoon();toast(showGrid?'Grid on':'Grid off');});
    function clearAllArtwork(message) {
      snapshot();
      // Reset the raster context before painting white so no lingering composite/transform state can affect Clear.
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha=1;
      ctx.globalCompositeOperation='source-over';
      ctx.clearRect(0,0,W(),H());
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,W(),H());
      ctx.restore();
      // Clear every visible artwork layer, including in-progress and selected SVG paths.
      octx.clearRect(0,0,W(),H());
      onionCtx.clearRect(0,0,W(),H());
      vectorPaths=[];activeVector=null;selectedVector=-1;selectedVectors=[];draggingAnchor=null;draggingHandle=null;curveDragAnchor=null;
      selectionMask=null;selectionBitmap=null;selectionBase=null;selectionBounds=null;selectionMove=null;lassoPoints=[];lassoDrawing=false;sctx.clearRect(0,0,W(),H());
      vectorLayer.replaceChildren();
      renderVectors();
      // If Frame Studio is active, clear its current frame too so old vector art cannot return.
      if(currentFrame>=0 && frames[currentFrame]) {
        frames[currentFrame]=blankFrame();
        renderFrameStrip();
      }
      saveSoon();
      toast(message);
    }
    $('clearBtn').addEventListener('click',()=>{if(!confirm('Clear the whole canvas, including vector paths?'))return;retroSound('bomb');clearAllArtwork('Canvas cleared');});
    $('newBtn').addEventListener('click',()=>{if(!confirm('Start a new drawing?'))return;clearAllArtwork('New drawing');});
    $('undoBtn').addEventListener('click',()=>{if(!history.length)return;redoStack.push(ctx.getImageData(0,0,W(),H()));ctx.putImageData(history.pop(),0,0);updateButtons();saveSoon();toast('Undid action');});
    $('redoBtn').addEventListener('click',()=>{if(!redoStack.length)return;history.push(ctx.getImageData(0,0,W(),H()));ctx.putImageData(redoStack.pop(),0,0);updateButtons();saveSoon();toast('Redid action');});

    // 🟩 HOW IT WORKS — Frame Studio composites the pixel canvas and SVG artwork for previews/exports.
    // 🟪 BEGINNER TIP — Keep frame changes separate from ordinary paint tools to avoid breaking undo behavior.
    // FRAME STUDIO: compose raster and SVG layers for thumbnails, onion skin, and GIFs.
    function compositeDataURL(){
      return new Promise(resolve=>{
        const out=document.createElement('canvas');out.width=W();out.height=H();const ox=out.getContext('2d');ox.drawImage(canvas,0,0);
        const svg=vectorLayer.cloneNode(true);svg.querySelectorAll('.vector-anchor').forEach(n=>n.remove());svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',String(W()));svg.setAttribute('height',String(H()));
        const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));const img=new Image();
        img.onload=()=>{ox.drawImage(img,0,0,W(),H());URL.revokeObjectURL(url);resolve(out.toDataURL('image/png'));};img.onerror=()=>{URL.revokeObjectURL(url);resolve(out.toDataURL('image/png'));};img.src=url;
      });
    }
    async function captureFrame(){return {raster:canvas.toDataURL('image/png'),composite:await compositeDataURL(),vectors:JSON.parse(JSON.stringify(vectorPaths)),color,size};}
    async function saveCurrentFrame(){if(currentFrame>=0&&frames[currentFrame])frames[currentFrame]=await captureFrame();renderFrameStrip();}
    function blankFrame(){const c=document.createElement('canvas');c.width=W();c.height=H();const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W(),H());const data=c.toDataURL('image/png');return {raster:data,composite:data,vectors:[],color,size};}
    function loadFrame(index){
      if(!frames[index])return;currentFrame=index;const f=frames[index],img=new Image();
      img.onload=()=>{ctx.clearRect(0,0,W(),H());ctx.drawImage(img,0,0,W(),H());vectorPaths=JSON.parse(JSON.stringify(f.vectors||[]));activeVector=null;selectedVector=-1;color=f.color||color;size=f.size||size;$('colorInput').value=color;$('sizeInput').value=String(size);$('sizeValue').textContent=size+'px';renderVectors();renderFrameStrip();drawOnionSkin();};img.src=f.raster;
    }
    function renderFrameStrip(){
      const strip=$('frameStrip');strip.innerHTML='';
      if(!frames.length){const empty=document.createElement('span');empty.className='frame-empty';empty.textContent='No frames yet. Draw something, then press Add frame.';strip.appendChild(empty);return;}
      frames.forEach((f,i)=>{
        const card=document.createElement('div');card.className='frame-card';
        const b=document.createElement('button');b.type='button';b.className='frame-thumb'+(i===currentFrame?' active':'');b.setAttribute('aria-label','Edit frame '+(i+1));b.setAttribute('aria-pressed',String(i===currentFrame));
        const img=document.createElement('img');img.alt='';img.src=f.composite||f.raster;
        const label=document.createElement('span');label.textContent='FRAME '+(i+1);b.append(img,label);
        b.addEventListener('click',async()=>{if(frameBusy||i===currentFrame)return;frameBusy=true;await saveCurrentFrame();loadFrame(i);frameBusy=false;});
        const del=document.createElement('button');del.type='button';del.className='frame-delete';del.textContent='×';del.title='Delete frame '+(i+1);del.setAttribute('aria-label','Delete frame '+(i+1));
        del.addEventListener('click',async event=>{
          event.stopPropagation();if(frameBusy)return;
          if(!confirm('Delete frame '+(i+1)+'? This cannot be undone.'))return;
          frameBusy=true;
          if(currentFrame>=0&&frames[currentFrame])frames[currentFrame]=await captureFrame();
          const deletedCurrent=i===currentFrame, deletedBeforeCurrent=i<currentFrame;
          frames.splice(i,1);
          if(!frames.length){
            currentFrame=-1;ctx.clearRect(0,0,W(),H());ctx.fillStyle='#fff';ctx.fillRect(0,0,W(),H());
            vectorPaths=[];activeVector=null;selectedVector=-1;renderVectors();renderFrameStrip();drawOnionSkin();
          }else{
            if(deletedBeforeCurrent)currentFrame--;
            else if(deletedCurrent)currentFrame=Math.min(i,frames.length-1);
            if(deletedCurrent||deletedBeforeCurrent)loadFrame(currentFrame);
            else{renderFrameStrip();drawOnionSkin();}
          }
          frameBusy=false;toast('Frame deleted');
        });
        card.append(b,del);strip.appendChild(card);
      });
    }
    function drawOnionSkin(){
      onionCtx.clearRect(0,0,W(),H());if(!$('onionToggle').checked||currentFrame<=0||!frames[currentFrame-1])return;
      const img=new Image();img.onload=()=>{
        onionCtx.clearRect(0,0,W(),H());
        const ghost=document.createElement('canvas');ghost.width=W();ghost.height=H();const gx=ghost.getContext('2d');gx.drawImage(img,0,0,W(),H());
        const pixels=gx.getImageData(0,0,W(),H()),data=pixels.data;
        for(let i=0;i<data.length;i+=4){const brightness=(data[i]+data[i+1]+data[i+2])/3;if(brightness>242){data[i+3]=0;}else{data[i]=53;data[i+1]=168;data[i+2]=237;data[i+3]=Math.round(data[i+3]*ghostOpacity);}}
        gx.putImageData(pixels,0,0);onionCtx.drawImage(ghost,0,0);
      };img.src=frames[currentFrame-1].composite||frames[currentFrame-1].raster;
    }
    $('addFrameBtn').addEventListener('click',async()=>{
      if(frameBusy)return;frameBusy=true;if(currentFrame<0){frames.push(await captureFrame());currentFrame=0;}else frames[currentFrame]=await captureFrame();
      frames.push(blankFrame());currentFrame=frames.length-1;ctx.fillStyle='#fff';ctx.fillRect(0,0,W(),H());vectorPaths=[];activeVector=null;selectedVector=-1;renderVectors();renderFrameStrip();drawOnionSkin();frameBusy=false;toast('Frame '+(currentFrame+1)+' ready — draw the next pose');
    });
    $('onionToggle').addEventListener('change',drawOnionSkin);
    $('playAnimationBtn').addEventListener('click',async()=>{
      if(playbackTimer||frameBusy)return;if(currentFrame<0){toast('Add frames first');return;}frameBusy=true;await saveCurrentFrame();frameBusy=false;
      if(frames.length<2){toast('Add at least two frames');return;}$('playAnimationBtn').disabled=true;$('stopAnimationBtn').disabled=false;playbackIndex=currentFrame;
      playbackTimer=setInterval(()=>{playbackIndex=(playbackIndex+1)%frames.length;loadFrame(playbackIndex);},1000/Number($('animationFps').value));toast('Animation playing');
    });
    function stopPlayback(){if(playbackTimer){clearInterval(playbackTimer);playbackTimer=null;}$('playAnimationBtn').disabled=false;$('stopAnimationBtn').disabled=true;}
    $('stopAnimationBtn').addEventListener('click',()=>{stopPlayback();toast('Playback stopped');});
    $('animationFps').addEventListener('change',()=>{if(playbackTimer){stopPlayback();$('playAnimationBtn').click();}});
    $('exportGifBtn').addEventListener('click',async()=>{
      if(currentFrame<0){toast('Add frames before exporting');return;}if(typeof GIF==='undefined'){toast('GIF encoder failed to load — refresh with internet');return;}if(frameBusy)return;
      frameBusy=true;stopPlayback();await saveCurrentFrame();if(frames.length<2){frameBusy=false;toast('Add at least two frames');return;}toast('Building animated GIF…');
      const gif=new GIF({workers:2,quality:10,workerScript:'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js'}),delay=Math.round(1000/Number($('animationFps').value));
      try{for(const f of frames){const img=new Image();await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;img.src=f.composite||f.raster;});gif.addFrame(img,{delay,copy:true});}
        gif.on('finished',blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mac-paint-animation.gif';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);frameBusy=false;toast('GIF exported');});
        gif.on('abort',()=>{frameBusy=false;toast('GIF export stopped');});gif.render();
      }catch(error){frameBusy=false;console.error('GIF export failed:',error);toast('Could not export GIF');}
    });

    // Export editable vector paths as SVG cut outlines. Raster pencil marks are intentionally excluded.
    function exportVectorSvg() {
      if (!vectorPaths.length && !textObjects.length) {
        toast('Add a vector shape or text first');
        selectTool('pen');
        return;
      }
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('xmlns', ns);
      svg.setAttribute('width', String(W()));
      svg.setAttribute('height', String(H()));
      svg.setAttribute('viewBox', '0 0 ' + W() + ' ' + H());
      svg.setAttribute('version', '1.1');
      const title = document.createElementNS(ns, 'title');
      title.textContent = 'MacDraw Enhanced — vinyl cut outlines';
      svg.appendChild(title);
      vectorPaths.forEach(function (vector) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', pathData(vector.points, vector.closed));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#000000');
        path.setAttribute('stroke-width', String(vector.size || 1));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
      });
      // Include editable text in SVG exports too, not only the on-screen preview.
      textObjects.forEach(function (item) {
        const textNode = document.createElementNS(ns, 'text');
        textNode.setAttribute('x', String(item.x));textNode.setAttribute('y', String(item.y));
        textNode.setAttribute('font-family', item.font);textNode.setAttribute('font-size', String(item.size));
        textNode.setAttribute('fill', item.color);textNode.textContent = item.text;svg.appendChild(textNode);
      });
      const source = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'macdraw-vinyl-outlines.svg';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('SVG outlines exported');
    }
    $('exportSvgBtn').addEventListener('click', exportVectorSvg);

    $('exportBtn').addEventListener('click',()=>{
      const out=document.createElement('canvas');out.width=W();out.height=H();const ox=out.getContext('2d');
      ox.drawImage(canvas,0,0);
      const clone=vectorLayer.cloneNode(true);clone.querySelectorAll('.vector-anchor').forEach(n=>n.remove());
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',String(W()));clone.setAttribute('height',String(H()));
      const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'});const url=URL.createObjectURL(blob);const img=new Image();
      img.onload=()=>{ox.drawImage(img,0,0,W(),H());URL.revokeObjectURL(url);const a=document.createElement('a');a.download='drawing.png';a.href=out.toDataURL('image/png');a.click();toast('PNG exported');};
      img.onerror=()=>{URL.revokeObjectURL(url);const a=document.createElement('a');a.download='drawing.png';a.href=canvas.toDataURL('image/png');a.click();toast('PNG exported (raster layer)');};img.src=url;
    });
    $('fontSelect').addEventListener('change',e=>{currentFont=e.target.value;saveSoon();toast('Text font: '+e.target.options[e.target.selectedIndex].text);});
    $('ghostOpacity').addEventListener('input', e => { ghostOpacity = Number(e.target.value); $('ghostOpacityValue').textContent = Math.round(ghostOpacity * 100) + '%'; drawOnionSkin(); });
    $('animationFps').addEventListener('input', e => { $('animationFpsValue').textContent = e.target.value + ' FPS'; });
    canvas.addEventListener('pointerdown',down);
    canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',up);
    canvas.addEventListener('pointercancel',up);
    canvas.addEventListener('lostpointercapture',up);

    function restore() {
      try {
        const saved=JSON.parse(localStorage.getItem('mpde-art')||'null');
        if(!saved||!saved.image)return;
        const img=new Image();
        img.onload=()=>{ctx.clearRect(0,0,W(),H());ctx.drawImage(img,0,0,W(),H());color=saved.color||color;size=saved.size||size;textSize=saved.textSize||textSize;currentFont=saved.currentFont||currentFont;selectedPattern=saved.selectedPattern||selectedPattern;selectedBrush=saved.selectedBrush||selectedBrush;roughPaper=!!saved.roughPaper;crtMode=saved.crtMode||((saved.crtBlue)?'blue':(saved.crtGreen)?'green':'off');tool=saved.tool||tool;guideX=saved.guideX??null;guideY=saved.guideY??null;showGuides=!!saved.showGuides;showGrid=!!saved.showGrid;vectorPaths=Array.isArray(saved.vectors)?saved.vectors:[];textObjects=Array.isArray(saved.texts)?saved.texts:[];selectedText=-1;activeVector=null;selectedVectors=[];$('colorInput').value=color;updateColorIndicator();$('sizeInput').value=String(size);$('sizeValue').textContent=size+'px';$('textSizeInput').value=String(textSize);$('textSizeValue').textContent=textSize+'px';document.querySelectorAll('.pattern-swatch').forEach(b=>b.classList.toggle('active',b.dataset.pattern===selectedPattern));document.querySelectorAll('.brush-option').forEach(b=>b.classList.toggle('active',b.dataset.brush===selectedBrush));$('roughPaperToggle').checked=roughPaper;canvasWrap.classList.toggle('rough-paper',roughPaper);setCrtMode(crtMode,false);$('fontSelect').value=currentFont;selectTool(tool);setToggleButton('guidesBtn',showGuides);setToggleButton('gridBtn',showGrid);setToggleButton('rulersBtn',!$('rulerLayout').classList.contains('rulers-hidden'));drawGuides();renderVectors();updateShapeBuilderStatus();};
        img.src=saved.image;
      } catch(error) { console.warn('Could not restore drawing:',error); }
    }
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W(),H());
    updateButtons();status();drawGuides();renderRulerLabels();renderFrameStrip();updateColorIndicator();
    // Show the creator acknowledgment once per browser profile. Accepting it leaves a pixel-art thank-you on the canvas.
    const welcome=$('creatorWelcome');
    let creatorAcknowledged=false;
    try{creatorAcknowledged=localStorage.getItem('mpde-creator-tribute-ack')==='yes';}catch(_){}
    if(creatorAcknowledged)welcome.hidden=true;
    $('creatorWelcomeAck').addEventListener('click',()=>{
      try{localStorage.setItem('mpde-creator-tribute-ack','yes');}catch(_){}
      // Let the acknowledgment gently fade away instead of vanishing instantly.
      welcome.classList.add('is-closing');
      setTimeout(()=>{
        welcome.hidden=true;
        welcome.classList.remove('is-closing');
        snapshot();drawCreatorTribute();saveSoon();
        toast('Thank you, Bill Atkinson and Susan Kare');
      },1250);
    });
    setToggleButton('guidesBtn', showGuides);
    setToggleButton('gridBtn', showGrid);
    setToggleButton('rulersBtn', !$('rulerLayout').classList.contains('rulers-hidden'));
    updateShapeBuilderStatus();
    restore();
  })();