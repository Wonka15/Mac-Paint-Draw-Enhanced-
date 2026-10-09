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
    const vectorLayer = $('vectorLayer');
    if (!ctx || !octx || !gctx || !rctx) {
      alert('Mac Paint could not start: your browser could not create a canvas. Try refreshing or using a current browser.');
      return;
    }

    // APP STATE: selected tool, drawing style, and current interaction.
    let tool = 'pencil', color = '#20252b', size = 4, fill = false;
    let drawing = false, startPoint = null, lastPoint = null;
    let history = [], redoStack = [], showGuides = false, showGrid = false;
    let guideX = null, guideY = null, ghostOpacity = 0.35, currentFont = 'sans-serif';
    let vectorPaths = [], activeVector = null, selectedVector = -1, draggingAnchor = null;
    let saveTimer = null;

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
      const names = {pencil:'Pencil',eraser:'Eraser',line:'Line',rect:'Rectangle',ellipse:'Oval',text:'Text',eyedropper:'Pick color',hand:'Pan / guide',pen:'Vector pen',editpoints:'Edit points'};
      $('toolStatus').innerHTML = '<strong>Tool:</strong> ' + (names[tool] || tool);
      document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    }
    function selectTool(next) {
      tool = next;
      vectorLayer.classList.toggle('vector-active', tool === 'pen' || tool === 'editpoints');
      renderVectors();
      status();
      if (tool === 'pen') toast('Vector Pen: click to add points; click the first point to close');
      if (tool === 'editpoints') toast('Drag a blue anchor to reshape a vector');
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
            color, size, tool, guideX, guideY, showGuides, showGrid, vectors: vectorPaths
          }));
        } catch (error) { console.warn('Autosave unavailable:', error); }
      }, 300);
    }
    function point(event) {
      const rect = canvas.getBoundingClientRect();
      let x = (event.clientX - rect.left) * W() / rect.width;
      let y = (event.clientY - rect.top) * H() / rect.height;
      if ($('snapCheck').checked) {
        if (guideX !== null && Math.abs(x - guideX) < 14) x = guideX;
        if (guideY !== null && Math.abs(y - guideY) < 14) y = guideY;
      }
      return {x:Math.max(0,Math.min(W()-1,x)), y:Math.max(0,Math.min(H()-1,y))};
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
    }
    // VECTOR ENGINE: SVG paths are stored separately from the pixel paint canvas.
    function svgPoint(event) {
      const r = vectorLayer.getBoundingClientRect();
      return {x:Math.max(0,Math.min(W(),(event.clientX-r.left)*W()/r.width)),y:Math.max(0,Math.min(H(),(event.clientY-r.top)*H()/r.height))};
    }
    function pathData(points, closed) {
      if (!points.length) return '';
      return 'M ' + points.map(p => `${p.x} ${p.y}`).join(' L ') + (closed ? ' Z' : '');
    }
    function renderVectors() {
      vectorLayer.innerHTML = '';
      const ns = 'http://www.w3.org/2000/svg';
      const all = vectorPaths.map((v,i)=>({v,i}));
      if (activeVector) all.push({v:activeVector,i:-1});
      all.forEach(({v,i})=>{
        const path=document.createElementNS(ns,'path');
        path.setAttribute('d',pathData(v.points,v.closed));
        path.setAttribute('fill',v.closed && v.fill ? v.color : 'none');
        path.setAttribute('fill-opacity',v.closed && v.fill ? '0.35' : '1');
        path.setAttribute('stroke',v.color); path.setAttribute('stroke-width',String(v.size));
        path.setAttribute('class','vector-path'); path.setAttribute('data-vector',String(i));
        if (tool==='editpoints' && i===selectedVector) path.setAttribute('stroke-dasharray','5 4');
        vectorLayer.appendChild(path);
        if (tool==='editpoints' && i===selectedVector) v.points.forEach((p,j)=>{
          const c=document.createElementNS(ns,'circle'); c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r','6');
          c.setAttribute('class','vector-anchor'); c.setAttribute('data-anchor',`${i}:${j}`); c.setAttribute('aria-label',`Anchor point ${j+1}`); vectorLayer.appendChild(c);
        });
      });
    }
    // Commit the in-progress path to the vector object list.
    function finishVector(closed=false) {
      if (!activeVector || activeVector.points.length < 2) { activeVector=null; renderVectors(); return; }
      activeVector.closed=closed; vectorPaths.push(activeVector); selectedVector=vectorPaths.length-1; activeVector=null;
      renderVectors(); saveSoon(); toast(closed?'Vector shape closed':'Vector path finished');
    }
    function vectorDown(event) {
      if (tool!=='pen' && tool!=='editpoints') return;
      event.preventDefault(); event.stopPropagation();
      const p=svgPoint(event);
      if (tool==='pen') {
        if (activeVector && activeVector.points.length>=3) {
          const first=activeVector.points[0];
          if (Math.hypot(p.x-first.x,p.y-first.y)<16) { finishVector(true); return; }
        }
        if (!activeVector) activeVector={points:[],color,size,fill,closed:false};
        activeVector.points.push(p); renderVectors(); return;
      }
      const hit=event.target.closest ? event.target.closest('[data-anchor]') : null;
      if (hit) {
        const bits=hit.getAttribute('data-anchor').split(':').map(Number);
        selectedVector=bits[0]; draggingAnchor={vector:bits[0],point:bits[1]};
        if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}
        renderVectors(); return;
      }
      const pathHit=event.target.closest ? event.target.closest('[data-vector]') : null;
      if(pathHit){selectedVector=Number(pathHit.getAttribute('data-vector'));renderVectors();return;}
      selectedVector=-1; renderVectors();
    }
    function vectorMove(event) {
      if (!draggingAnchor || tool!=='editpoints') return;
      event.preventDefault(); const p=svgPoint(event); const v=vectorPaths[draggingAnchor.vector];
      if(v && v.points[draggingAnchor.point]){v.points[draggingAnchor.point]=p;renderVectors();}
    }
    function vectorUp(event) {
      if(!draggingAnchor)return;
      if(event && vectorLayer.releasePointerCapture){try{vectorLayer.releasePointerCapture(event.pointerId);}catch(_){}}
      draggingAnchor=null;saveSoon();
    }
    function shape(p) {
      octx.clearRect(0,0,W(),H()); octx.save();
      octx.strokeStyle=color; octx.fillStyle=color; octx.lineWidth=size;
      octx.lineCap='round'; octx.lineJoin='round';
      const x=Math.min(startPoint.x,p.x), y=Math.min(startPoint.y,p.y);
      const w=Math.abs(startPoint.x-p.x), h=Math.abs(startPoint.y-p.y);
      if(tool==='line'){octx.beginPath();octx.moveTo(startPoint.x,startPoint.y);octx.lineTo(p.x,p.y);octx.stroke();}
      if(tool==='rect'){if(fill)octx.fillRect(x,y,w,h);else octx.strokeRect(x,y,w,h);}
      if(tool==='ellipse'){octx.beginPath();octx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);if(fill)octx.fill();else octx.stroke();}
      octx.restore();
    }
    function down(event) {
      event.preventDefault();
      const p=point(event);
      $('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';
      if(tool==='text'){
        const text=prompt('What would you like to write?');
        if(text){snapshot();ctx.fillStyle=color;ctx.font=(size*2)+'px '+currentFont;ctx.fillText(text,p.x,p.y);saveSoon();}
        return;
      }
      if(tool==='eyedropper'){
        const d=ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;
        color='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
        $('colorInput').value=color;toast('Color picked');return;
      }
      if(tool==='hand'){
        guideX=p.x;guideY=p.y;showGuides=true;drawGuides();toast('Guide placed');return;
      }
      drawing=true;startPoint=p;lastPoint=p;snapshot();
      if(tool==='pencil'||tool==='eraser'){
        ctx.beginPath();ctx.arc(p.x,p.y,Math.max(0.5,size/2),0,Math.PI*2);
        ctx.fillStyle=tool==='eraser'?'#ffffff':color;ctx.fill();
      }
      if(canvas.setPointerCapture){try{canvas.setPointerCapture(event.pointerId);}catch(_){}}
    }
    function move(event) {
      if(!drawing)return;
      const p=point(event);
      $('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';
      if(tool==='pencil'||tool==='eraser'){
        ctx.beginPath();ctx.moveTo(lastPoint.x,lastPoint.y);ctx.lineTo(p.x,p.y);
        ctx.strokeStyle=tool==='eraser'?'#ffffff':color;ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();lastPoint=p;
      } else if(['line','rect','ellipse'].includes(tool)) shape(p);
    }
    function up(event) {
      if(!drawing)return;
      if(event && event.pointerId!==undefined && canvas.releasePointerCapture){try{canvas.releasePointerCapture(event.pointerId);}catch(_){}}
      if(['line','rect','ellipse'].includes(tool)){ctx.drawImage(overlay,0,0);octx.clearRect(0,0,W(),H());}
      drawing=false;saveSoon();
      if(event){const p=point(event);$('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';}
    }
    document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>selectTool(b.dataset.tool)));
    vectorLayer.addEventListener('pointerdown',vectorDown);
    vectorLayer.addEventListener('pointermove',vectorMove);
    vectorLayer.addEventListener('pointerup',vectorUp);
    vectorLayer.addEventListener('pointercancel',vectorUp);
    vectorLayer.addEventListener('dblclick',event=>{if(tool==='pen'&&activeVector){event.preventDefault();finishVector(false);}});
    document.addEventListener('keydown',event=>{if(event.key==='Enter'&&tool==='pen'&&activeVector)finishVector(false);if(event.key==='Escape'&&activeVector){activeVector=null;renderVectors();toast('Path cancelled');}});
    document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{color=b.dataset.color;$('colorInput').value=color;toast('Color selected');}));
    $('colorInput').addEventListener('input',e=>color=e.target.value);
    $('sizeInput').addEventListener('input',e=>{size=Number(e.target.value);$('sizeValue').textContent=size+'px';});
    $('fillToggle').addEventListener('change',e=>fill=e.target.checked);
    $('snapCheck').addEventListener('change',()=>{});
    $('guidesBtn').addEventListener('click',()=>{showGuides=!showGuides;if(showGuides&&guideX===null){guideX=Math.round(W()/2);guideY=Math.round(H()/2);}drawGuides();toast(showGuides?'Guides on':'Guides off');});
    $('gridBtn').addEventListener('click',()=>{showGrid=!showGrid;drawGuides();toast(showGrid?'Grid on':'Grid off');});
    $('clearBtn').addEventListener('click',()=>{if(!confirm('Clear the whole canvas?'))return;snapshot();ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W(),H());saveSoon();toast('Canvas cleared');});
    $('newBtn').addEventListener('click',()=>{if(!confirm('Start a new drawing?'))return;snapshot();ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W(),H());saveSoon();toast('New drawing');});
    $('undoBtn').addEventListener('click',()=>{if(!history.length)return;redoStack.push(ctx.getImageData(0,0,W(),H()));ctx.putImageData(history.pop(),0,0);updateButtons();saveSoon();toast('Undid action');});
    $('redoBtn').addEventListener('click',()=>{if(!redoStack.length)return;history.push(ctx.getImageData(0,0,W(),H()));ctx.putImageData(redoStack.pop(),0,0);updateButtons();saveSoon();toast('Redid action');});
    // Export editable vector paths as SVG cut outlines. Raster pencil marks are intentionally excluded.
    function exportVectorSvg() {
      if (!vectorPaths.length) {
        toast('Draw a vector path first');
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
    $('fontSelect').addEventListener('change',e=>currentFont=e.target.value);
    $('ghostOpacity').addEventListener('input',e=>ghostOpacity=Number(e.target.value));
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
        img.onload=()=>{ctx.clearRect(0,0,W(),H());ctx.drawImage(img,0,0,W(),H());color=saved.color||color;size=saved.size||size;tool=saved.tool||tool;guideX=saved.guideX??null;guideY=saved.guideY??null;showGuides=!!saved.showGuides;showGrid=!!saved.showGrid;vectorPaths=Array.isArray(saved.vectors)?saved.vectors:[];activeVector=null;$('colorInput').value=color;$('sizeInput').value=String(size);$('sizeValue').textContent=size+'px';selectTool(tool);drawGuides();renderVectors();};
        img.src=saved.image;
      } catch(error) { console.warn('Could not restore drawing:',error); }
    }
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W(),H());
    updateButtons();status();drawGuides();restore();
  })();