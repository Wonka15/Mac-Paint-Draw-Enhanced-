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
    const canvasWrap = $('canvasWrap');
    if (!ctx || !octx || !gctx || !rctx) {
      alert('Mac Paint could not start: your browser could not create a canvas. Try refreshing or using a current browser.');
      return;
    }

    // APP STATE: selected tool, drawing style, and current interaction.
    let tool = 'pencil', color = '#20252b', size = 4, fill = false, selectedPattern = 'solid', textSize = 24, selectedBrush = 'round', roughPaper = false;
    let drawing = false, startPoint = null, lastPoint = null;
    let history = [], redoStack = [], showGuides = false, showGrid = false;
    let guideX = null, guideY = null, ghostOpacity = 0.35, currentFont = 'sans-serif';
    let vectorPaths = [], activeVector = null, selectedVector = -1, selectedVectors = [], draggingAnchor = null, curveDragAnchor = null;
    let zoomLevel = 1, rulerDrag = null, vectorShapeStart = null, vectorShapeDragging = false;
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
      const names = {pencil:'Pencil',eraser:'Eraser',bucket:'Paint bucket',line:'Line',rect:'Rectangle',ellipse:'Oval',text:'Text',eyedropper:'Pick color',hand:'Pan / guide',pen:'Vector pen',bezier:'Bezier curve',vectorrect:'Vector rectangle',vectoroval:'Vector oval',editpoints:'Edit points'};
      $('toolStatus').innerHTML = '<strong>Tool:</strong> ' + (names[tool] || tool);
      document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    }
    function selectTool(next) {
      tool = next;
      vectorLayer.classList.toggle('vector-active', tool === 'pen' || tool === 'bezier' || tool === 'vectorrect' || tool === 'vectoroval' || tool === 'editpoints');
      renderVectors();
      status();
      if (tool === 'pen') toast('Vector Pen: click to add straight points; Enter finishes');
      if (tool === 'bezier') toast('Bezier: click-drag to shape handles; Enter finishes');
      if (tool === 'editpoints') toast('Drag a blue anchor to reshape a vector');
      if (tool === 'bucket') toast('Paint bucket: click a bounded area to fill it');
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
            color, size, textSize, selectedPattern, selectedBrush, roughPaper, tool, guideX, guideY, showGuides, showGrid, vectors: vectorPaths
          }));
        } catch (error) { console.warn('Autosave unavailable:', error); }
      }, 300);
    }

    function makePattern(){
      if(selectedPattern==='solid')return color;
      const tile=document.createElement('canvas');tile.width=tile.height=12;
      const t=tile.getContext('2d');t.fillStyle='#fff';t.fillRect(0,0,12,12);t.fillStyle=color;t.strokeStyle=color;
      if(selectedPattern==='checker'){t.fillRect(0,0,6,6);t.fillRect(6,6,6,6);}
      else if(selectedPattern==='dots'){t.beginPath();t.arc(3,3,1.5,0,Math.PI*2);t.arc(9,9,1.5,0,Math.PI*2);t.fill();}
      else if(selectedPattern==='diagonal'){t.lineWidth=1;for(let x=-12;x<24;x+=4){t.beginPath();t.moveTo(x,0);t.lineTo(x+12,12);t.stroke();}}
      else if(selectedPattern==='cross'){t.lineWidth=1;for(let x=-12;x<24;x+=6){t.beginPath();t.moveTo(x,0);t.lineTo(x+12,12);t.moveTo(x+12,0);t.lineTo(x,12);t.stroke();}}
      else if(selectedPattern==='horizontal'){for(let y=0;y<12;y+=4)t.fillRect(0,y,12,1);}
      else if(selectedPattern==='vertical'){for(let x=0;x<12;x+=4)t.fillRect(x,0,1,12);}
      else if(selectedPattern==='brick'){t.lineWidth=1;t.strokeRect(0,0,12,6);t.beginPath();t.moveTo(6,0);t.lineTo(6,6);t.moveTo(0,6);t.lineTo(12,6);t.moveTo(3,6);t.lineTo(3,12);t.moveTo(9,6);t.lineTo(9,12);t.stroke();}
      return ctx.createPattern(tile,'repeat');
    }
    function drawingStyle(){return selectedPattern==='solid'?color:makePattern();}
    function retroSound(kind){
      if(!$('soundToggle')||!$('soundToggle').checked)return;
      try{
        const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)return;
        if(!audioContext)audioContext=new AudioCtor();if(audioContext.state==='suspended')audioContext.resume();
        const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
        osc.type='square';osc.frequency.setValueAtTime(kind==='start'?660:kind==='fill'?520:kind==='end'?440:740,now);
        osc.frequency.exponentialRampToValueAtTime(kind==='end'?330:kind==='fill'?390:560,now+0.045);
        gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(0.025,now+0.004);gain.gain.exponentialRampToValueAtTime(0.0001,now+0.055);
        osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+0.06);
      }catch(_){}
    }
    function hexRgb(hex){return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}
    function floodFill(seedX,seedY){
      const w=W(),h=H(),image=ctx.getImageData(0,0,w,h),data=image.data,original=new Uint8ClampedArray(data);
      const sx=Math.max(0,Math.min(w-1,Math.floor(seedX))),sy=Math.max(0,Math.min(h-1,Math.floor(seedY))),seed=(sy*w+sx)*4;
      const target=[original[seed],original[seed+1],original[seed+2],original[seed+3]],rgb=hexRgb(color),solid=selectedPattern==='solid';
      if(solid&&target[0]===rgb[0]&&target[1]===rgb[1]&&target[2]===rgb[2]&&target[3]===255)return;
      const count=w*h,seen=new Uint8Array(count),stack=new Uint32Array(count);let top=0,first=sy*w+sx;stack[top++]=first;seen[first]=1;
      const tol=22;
      while(top){
        const idx=stack[--top],px=idx%w,py=(idx/w)|0,di=idx*4;
        if(Math.abs(original[di]-target[0])>tol||Math.abs(original[di+1]-target[1])>tol||Math.abs(original[di+2]-target[2])>tol||Math.abs(original[di+3]-target[3])>tol)continue;
        let ink=true;
        if(!solid){
          if(selectedPattern==='checker')ink=(Math.floor(px/6)+Math.floor(py/6))%2===0;
          else if(selectedPattern==='dots')ink=px%8<2&&py%8<2;
          else if(selectedPattern==='horizontal')ink=py%4===0;
          else if(selectedPattern==='vertical')ink=px%4===0;
          else if(selectedPattern==='diagonal')ink=(px+py)%5===0;
          else if(selectedPattern==='cross')ink=(px+py)%6===0||(px-py+1200)%6===0;
          else ink=px%12<1||py%6<1||((Math.floor(py/6)%2===0?px%12:px+6)%12<1);
        }
        data[di]=ink?rgb[0]:255;data[di+1]=ink?rgb[1]:255;data[di+2]=ink?rgb[2]:255;data[di+3]=255;
        const neighbors=[px>0?idx-1:-1,px<w-1?idx+1:-1,py>0?idx-w:-1,py<h-1?idx+w:-1];
        for(const n of neighbors)if(n>=0&&!seen[n]){seen[n]=1;if(top<count)stack[top++]=n;}
      }
      ctx.putImageData(image,0,0);saveSoon();retroSound('fill');
    }


    function brushStamp(x,y,angle,erase=false){
      const ink=erase?'#ffffff':color, radius=Math.max(1,size/2);
      if(selectedBrush==='round'){ctx.fillStyle=ink;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();return;}
      if(selectedBrush==='calligraphy'){
        ctx.save();ctx.translate(x,y);ctx.rotate(angle-0.45);ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(0,0,Math.max(1,radius*1.3),Math.max(.6,radius*.24),0,0,Math.PI*2);ctx.fill();ctx.restore();return;
      }
      if(selectedBrush==='watercolor'){
        ctx.save();
        for(let i=3;i>=1;i--){const rr=radius*(.45+i*.28);ctx.globalAlpha=erase?.25:.055+i*.018;ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(x+(Math.random()-.5)*radius*.3,y+(Math.random()-.5)*radius*.3,rr,rr*(.78+Math.random()*.3),angle,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=erase?1:.11;ctx.strokeStyle=ink;ctx.lineWidth=Math.max(.5,radius*.12);ctx.beginPath();ctx.arc(x,y,radius*.85,0,Math.PI*2);ctx.stroke();ctx.restore();return;
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
      renderRulerLabels();
    }
    // VECTOR ENGINE: SVG paths are stored separately from the pixel paint canvas.
    function svgPoint(event) {
      const r = vectorLayer.getBoundingClientRect();
      let x=(event.clientX-r.left)*W()/r.width, y=(event.clientY-r.top)*H()/r.height;
      if($('snapCheck').checked){if(guideX!==null&&Math.abs(x-guideX)<14)x=guideX;if(guideY!==null&&Math.abs(y-guideY)<14)y=guideY;}
      return {x:Math.max(0,Math.min(W(),x)),y:Math.max(0,Math.min(H(),y))};
    }

    // RULERS + ZOOM: ruler coordinates always map to the original 1200 × 800 artboard.
    function renderRulerLabels(){
      const top=$('rulerTop'),left=$('rulerLeft');if(!top||!left)return;
      top.innerHTML='';left.innerHTML='';
      for(let x=0;x<=W();x+=100){const label=document.createElement('span');label.className='ruler-label';label.textContent=String(x);label.style.left=(x/W()*100)+'%';top.appendChild(label);}
      for(let y=0;y<=H();y+=100){const label=document.createElement('span');label.className='ruler-label';label.textContent=String(y);label.style.top=(y/H()*100)+'%';left.appendChild(label);}
    }
    function setZoom(next){
      zoomLevel=Math.max(.25,Math.min(3,next));canvasWrap.style.zoom=String(zoomLevel);$('zoomReadout').textContent=Math.round(zoomLevel*100)+'%';
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
      const availableWidth=Math.max(240,stage.clientWidth-70);
      const availableHeight=Math.max(240,stage.clientHeight-70);
      const fit=Math.min(1,availableWidth/Math.max(1,canvasWrap.offsetWidth),availableHeight/Math.max(1,canvasWrap.offsetHeight));
      setZoom(fit);
    });
    $('rulersBtn').addEventListener('click',()=>{
      const layout=$('rulerLayout'),hidden=layout.classList.toggle('rulers-hidden');
      $('rulersBtn').setAttribute('aria-pressed',String(!hidden));$('rulersBtn').classList.toggle('primary',!hidden);
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
        if (tool==='editpoints' && (i===selectedVector || selectedVectors.includes(i))) { path.setAttribute('stroke-dasharray','5 4'); path.setAttribute('stroke','#315cdb'); }
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
      activeVector.closed=closed; vectorPaths.push(activeVector); selectedVector=vectorPaths.length-1; selectedVectors=[selectedVector]; activeVector=null;
      renderVectors(); saveSoon(); toast(closed?'Vector shape closed':'Vector path finished');
    }
    function vectorDown(event) {
      if (tool!=='pen' && tool!=='bezier' && tool!=='vectorrect' && tool!=='vectoroval' && tool!=='editpoints') return;
      event.preventDefault(); event.stopPropagation();
      const p=svgPoint(event);
      if(tool==='vectorrect'||tool==='vectoroval'){
        vectorShapeStart=p;vectorShapeDragging=true;
        activeVector={points:vectorShapePoints(p,p,tool),color,size,fill,closed:true,curve:true};
        if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}
        renderVectors();return;
      }
      if (tool==='bezier') {
        if (activeVector && activeVector.points.length>=3) {
          const first=activeVector.points[0];
          if (Math.hypot(p.x-first.x,p.y-first.y)<16) { finishVector(true); return; }
        }
        if (!activeVector) activeVector={points:[],color,size,fill,closed:false,curve:true};
        activeVector.points.push({x:p.x,y:p.y,in:null,out:null});
        curveDragAnchor=activeVector.points.length-1;
        if(vectorLayer.setPointerCapture){try{vectorLayer.setPointerCapture(event.pointerId);}catch(_){}}
        renderVectors(); return;
      }
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
      if(pathHit){const hitIndex=Number(pathHit.getAttribute('data-vector'));if(event.shiftKey){if(selectedVectors.includes(hitIndex))selectedVectors=selectedVectors.filter(i=>i!==hitIndex);else selectedVectors.push(hitIndex);}else selectedVectors=[hitIndex];selectedVector=hitIndex;renderVectors();return;}
      selectedVector=-1;selectedVectors=[];renderVectors();
    }
    function vectorShapePoints(start,end,kind){
      const x1=Math.min(start.x,end.x),y1=Math.min(start.y,end.y),x2=Math.max(start.x,end.x),y2=Math.max(start.y,end.y);
      if(kind==='vectorrect')return [{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}];
      const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.max(0.5,(x2-x1)/2),ry=Math.max(0.5,(y2-y1)/2),points=[];
      for(let i=0;i<48;i++){const angle=i*Math.PI*2/48;points.push({x:cx+Math.cos(angle)*rx,y:cy+Math.sin(angle)*ry});}
      return points;
    }
    function vectorMove(event) {
      if(vectorShapeDragging&&vectorShapeStart&&activeVector&&(tool==='vectorrect'||tool==='vectoroval')){
        event.preventDefault();activeVector.points=vectorShapePoints(vectorShapeStart,svgPoint(event),tool);renderVectors();return;
      }
      if (tool==='bezier' && curveDragAnchor!==null && activeVector) {
        event.preventDefault();
        const p=svgPoint(event), anchor=activeVector.points[curveDragAnchor];
        if (anchor) {
          const dx=p.x-anchor.x, dy=p.y-anchor.y;
          anchor.out={x:p.x,y:p.y}; anchor.in={x:anchor.x-dx,y:anchor.y-dy};
          renderVectors();
        }
        return;
      }
      if (!draggingAnchor || tool!=='editpoints') return;
      event.preventDefault(); const p=svgPoint(event); const v=vectorPaths[draggingAnchor.vector];
      if(v && v.points[draggingAnchor.point]){v.points[draggingAnchor.point]=p;renderVectors();}
    }
    function vectorUp(event) {
      if(vectorShapeDragging){
        if(event&&vectorLayer.releasePointerCapture){try{vectorLayer.releasePointerCapture(event.pointerId);}catch(_){}}
        if(event&&activeVector)activeVector.points=vectorShapePoints(vectorShapeStart,svgPoint(event),tool);
        if(activeVector){vectorPaths.push(activeVector);selectedVector=vectorPaths.length-1;selectedVectors=[selectedVector];}
        activeVector=null;vectorShapeStart=null;vectorShapeDragging=false;renderVectors();saveSoon();return;
      }
      if(curveDragAnchor!==null){
        if(event && vectorLayer.releasePointerCapture){try{vectorLayer.releasePointerCapture(event.pointerId);}catch(_){}}
        curveDragAnchor=null;renderVectors();saveSoon();return;
      }
      if(!draggingAnchor)return;
      if(event && vectorLayer.releasePointerCapture){try{vectorLayer.releasePointerCapture(event.pointerId);}catch(_){}}
      draggingAnchor=null;saveSoon();
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
    function down(event) {
      event.preventDefault();
      const p=point(event);
      $('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';
      if(tool==='text'){
        const text=prompt('What would you like to write?');
        if(text){snapshot();ctx.fillStyle=color;ctx.font=textSize+'px '+currentFont;ctx.fillText(text,p.x,p.y);saveSoon();retroSound('tick');}
        return;
      }
      if(tool==='eyedropper'){
        const d=ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;
        color='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
        $('colorInput').value=color;toast('Color picked');return;
      }
      if(tool==='bucket'){snapshot();floodFill(p.x,p.y);return;}
      if(tool==='hand'){
        guideX=p.x;guideY=p.y;showGuides=true;drawGuides();toast('Guide placed');return;
      }
      drawing=true;startPoint=p;lastPoint=p;snapshot();retroSound('start');
      if(tool==='pencil'||tool==='eraser'){paintBrushSegment(p,p,tool==='eraser');}
      if(canvas.setPointerCapture){try{canvas.setPointerCapture(event.pointerId);}catch(_){}}
    }
    function move(event) {
      if(!drawing)return;
      const p=point(event);
      $('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';
      if(tool==='pencil'||tool==='eraser'){paintBrushSegment(lastPoint,p,tool==='eraser');lastPoint=p;}
      else if(['line','rect','ellipse'].includes(tool)) shape(p);
    }
    function up(event) {
      if(!drawing)return;
      if(event && event.pointerId!==undefined && canvas.releasePointerCapture){try{canvas.releasePointerCapture(event.pointerId);}catch(_){}}
      if(['line','rect','ellipse'].includes(tool)){ctx.drawImage(overlay,0,0);octx.clearRect(0,0,W(),H());}
      drawing=false;saveSoon();retroSound('end');
      if(event){const p=point(event);$('coordStatus').textContent=Math.round(p.x)+' × '+Math.round(p.y)+' px';}
    }
    document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>selectTool(b.dataset.tool)));
    vectorLayer.addEventListener('pointerdown',vectorDown);
    vectorLayer.addEventListener('pointermove',vectorMove);
    vectorLayer.addEventListener('pointerup',vectorUp);
    vectorLayer.addEventListener('pointercancel',vectorUp);
    vectorLayer.addEventListener('dblclick',event=>{if((tool==='pen'||tool==='bezier')&&activeVector){event.preventDefault();finishVector(false);}});
    document.addEventListener('keydown',event=>{if(event.key==='Enter'&&(tool==='pen'||tool==='bezier')&&activeVector)finishVector(false);if(event.key==='Escape'&&activeVector){activeVector=null;renderVectors();toast('Path cancelled');}});
    document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{color=b.dataset.color;$('colorInput').value=color;toast('Color selected');}));
    $('colorInput').addEventListener('input',e=>color=e.target.value);
    $('sizeInput').addEventListener('input',e=>{size=Number(e.target.value);$('sizeValue').textContent=size+'px';});
    $('textSizeInput').addEventListener('input',e=>{textSize=Number(e.target.value);$('textSizeValue').textContent=textSize+'px';});
    document.querySelectorAll('.pattern-swatch').forEach(b=>b.addEventListener('click',()=>{selectedPattern=b.dataset.pattern;document.querySelectorAll('.pattern-swatch').forEach(s=>s.classList.toggle('active',s===b));toast('Pattern: '+(selectedPattern==='solid'?'Solid ink':selectedPattern));}));
    document.addEventListener('pointermove',()=>{if(drawing){const now=performance.now();if(now-lastDragSound>90){lastDragSound=now;retroSound('tick');}}});
    document.querySelectorAll('.brush-option').forEach(b=>b.addEventListener('click',()=>{selectedBrush=b.dataset.brush;document.querySelectorAll('.brush-option').forEach(x=>x.classList.toggle('active',x===b));toast('Brush: '+b.dataset.brush);}));
    $('roughPaperToggle').addEventListener('change',e=>{roughPaper=e.target.checked;canvasWrap.classList.toggle('rough-paper',roughPaper);toast(roughPaper?'Rough paper texture on':'Rough paper texture off');});
    $('fillToggle').addEventListener('change',e=>fill=e.target.checked);
    $('snapCheck').addEventListener('change',()=>{});
    $('guidesBtn').addEventListener('click',()=>{showGuides=!showGuides;if(showGuides&&guideX===null){guideX=Math.round(W()/2);guideY=Math.round(H()/2);}drawGuides();toast(showGuides?'Guides on':'Guides off');});
    $('gridBtn').addEventListener('click',()=>{showGrid=!showGrid;drawGuides();toast(showGrid?'Grid on':'Grid off');});
    $('clearBtn').addEventListener('click',()=>{if(!confirm('Clear the whole canvas?'))return;snapshot();ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W(),H());saveSoon();toast('Canvas cleared');});
    $('newBtn').addEventListener('click',()=>{if(!confirm('Start a new drawing?'))return;snapshot();ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W(),H());saveSoon();toast('New drawing');});
    $('undoBtn').addEventListener('click',()=>{if(!history.length)return;redoStack.push(ctx.getImageData(0,0,W(),H()));ctx.putImageData(history.pop(),0,0);updateButtons();saveSoon();toast('Undid action');});
    $('redoBtn').addEventListener('click',()=>{if(!redoStack.length)return;history.push(ctx.getImageData(0,0,W(),H()));ctx.putImageData(redoStack.pop(),0,0);updateButtons();saveSoon();toast('Redid action');});

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
      if(!frames.length){const empty=document.createElement('span');empty.className='frame-empty';empty.textContent='Draw something, then press Add frame.';strip.appendChild(empty);return;}
      frames.forEach((f,i)=>{const b=document.createElement('button');b.type='button';b.className='frame-thumb'+(i===currentFrame?' active':'');b.setAttribute('aria-label','Edit frame '+(i+1));const img=document.createElement('img');img.alt='';img.src=f.composite||f.raster;const label=document.createElement('span');label.textContent='FRAME '+(i+1);b.append(img,label);b.addEventListener('click',async()=>{if(frameBusy||i===currentFrame)return;frameBusy=true;await saveCurrentFrame();loadFrame(i);frameBusy=false;});strip.appendChild(b);});
    }
    function drawOnionSkin(){
      onionCtx.clearRect(0,0,W(),H());if(!$('onionToggle').checked||currentFrame<=0||!frames[currentFrame-1])return;
      const img=new Image();img.onload=()=>{
        onionCtx.clearRect(0,0,W(),H());
        const ghost=document.createElement('canvas');ghost.width=W();ghost.height=H();const gx=ghost.getContext('2d');gx.drawImage(img,0,0,W(),H());
        const pixels=gx.getImageData(0,0,W(),H()),data=pixels.data;
        for(let i=0;i<data.length;i+=4){const brightness=(data[i]+data[i+1]+data[i+2])/3;if(brightness>242){data[i+3]=0;}else{data[i]=53;data[i+1]=168;data[i+2]=237;data[i+3]=Math.round(data[i+3]*.38);}}
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
        img.onload=()=>{ctx.clearRect(0,0,W(),H());ctx.drawImage(img,0,0,W(),H());color=saved.color||color;size=saved.size||size;textSize=saved.textSize||textSize;selectedPattern=saved.selectedPattern||selectedPattern;selectedBrush=saved.selectedBrush||selectedBrush;roughPaper=!!saved.roughPaper;tool=saved.tool||tool;guideX=saved.guideX??null;guideY=saved.guideY??null;showGuides=!!saved.showGuides;showGrid=!!saved.showGrid;vectorPaths=Array.isArray(saved.vectors)?saved.vectors:[];activeVector=null;selectedVectors=[];$('colorInput').value=color;$('sizeInput').value=String(size);$('sizeValue').textContent=size+'px';$('textSizeInput').value=String(textSize);$('textSizeValue').textContent=textSize+'px';document.querySelectorAll('.pattern-swatch').forEach(b=>b.classList.toggle('active',b.dataset.pattern===selectedPattern));document.querySelectorAll('.brush-option').forEach(b=>b.classList.toggle('active',b.dataset.brush===selectedBrush));$('roughPaperToggle').checked=roughPaper;canvasWrap.classList.toggle('rough-paper',roughPaper);selectTool(tool);drawGuides();renderVectors();};
        img.src=saved.image;
      } catch(error) { console.warn('Could not restore drawing:',error); }
    }
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W(),H());
    updateButtons();status();drawGuides();renderRulerLabels();renderFrameStrip();restore();
  })();