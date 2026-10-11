/* Macintosh SE radio: Lo-fi + classical stations, animated CRT spectrum */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),root=$('seRadio');
 if(!root)return;
 const launch=$('seRadioLaunch'),panel=$('seRadioPanel'),power=$('seRadioPower'),powerText=$('seRadioPowerText'),status=$('seRadioStatus'),player=$('seRadioPlayer'),drag=$('seRadioDrag'),track=$('seRadioTrack');
 const stations=[
  {name:'LO-FI GIRL • CHILL BEATS',short:'LO-FI GIRL',frequency:'88.6',id:'aQkPcPqTq4M'},
  {name:'CLASSICAL STUDY • HALIDONMUSIC',short:'CLASSICAL',frequency:'101.2',id:'LIg6KxXvc1Q'}
 ];
 let stationIndex=0,playing=false,dragState=null;
 function open(v){panel.hidden=!v;launch.setAttribute('aria-expanded',String(v))}
 function renderStation(){const s=stations[stationIndex];track.textContent=s.name;const freq=root.querySelector('.se-radio-frequency strong');if(freq)freq.textContent=s.frequency;}
 function tune(on){
  playing=on;root.classList.toggle('is-playing',on);power.setAttribute('aria-pressed',String(on));powerText.textContent=on?'POWER ON':'POWER OFF';status.textContent=on?'ON AIR · '+stations[stationIndex].short:'STANDBY';
  if(on){const f=document.createElement('iframe');f.title=stations[stationIndex].name+' YouTube music player';f.allow='autoplay; encrypted-media; picture-in-picture; web-share';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';f.src='https://www.youtube-nocookie.com/embed/'+stations[stationIndex].id+'?autoplay=1&playsinline=1&rel=0&modestbranding=1';player.replaceChildren(f);player.hidden=false;}
  else{player.replaceChildren();player.hidden=true;}
 }
 function changeStation(delta){stationIndex=(stationIndex+delta+stations.length)%stations.length;renderStation();if(playing)tune(true);else status.textContent='STANDBY';}
 launch.addEventListener('click',()=>open(panel.hidden));$('seRadioClose').addEventListener('click',()=>open(false));
 power.addEventListener('click',()=>{open(true);tune(!playing)});
 $('seRadioPrev').addEventListener('click',()=>changeStation(-1));$('seRadioNext').addEventListener('click',()=>changeStation(1));
 drag.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const r=root.getBoundingClientRect();dragState={x:e.clientX,y:e.clientY,left:r.left,top:r.top};if(drag.setPointerCapture)drag.setPointerCapture(e.pointerId);e.preventDefault()});
 drag.addEventListener('pointermove',e=>{if(!dragState)return;root.style.left=Math.max(0,Math.min(innerWidth-root.offsetWidth,dragState.left+e.clientX-dragState.x))+'px';root.style.top=Math.max(0,Math.min(innerHeight-root.offsetHeight,dragState.top+e.clientY-dragState.y))+'px';root.style.right='auto';root.style.bottom='auto'});
 const stop=()=>dragState=null;drag.addEventListener('pointerup',stop);drag.addEventListener('pointercancel',stop);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false)});
 renderStation();open(false);tune(false);
})();