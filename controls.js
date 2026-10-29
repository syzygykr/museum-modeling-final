/* 명시적 mode: exterior=주시점 회전/충돌 없음, interior=제자리 회전/수평 이동/충돌. */
window.MuseumControls=function(canvas,options={}){
 const state={mode:'exterior',target:[0,.5,0],distance:30,yaw:.6,pitch:.44,fov:45,actions:0,orthographic:false,halfHeight:15,minEyeHeight:window.MuseumLayout?.eyeHeight||1.575,revision:0};
 let eye=null,savedInterior=null,savedExterior=null,drag=null;const keys=new Set(),arrows=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
 const supported=new Set([...arrows,'KeyW','KeyA','KeyS','KeyD','Home','Equal','Minus','NumpadAdd','NumpadSubtract']);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),pc=()=>!matchMedia('(pointer: coarse)').matches;
 const clear=()=>{keys.clear();drag=null;},rotating=()=>arrows.some(k=>keys.has(k));
 const unlock=()=>{if(document.pointerLockElement===canvas)document.exitPointerLock?.();};
 const lock=()=>{try{canvas.requestPointerLock?.()?.catch?.(()=>{});}catch{}};
 function syncProjection(){if(state.mode==='interior'){state.orthographic=false;return;}const top=state.pitch===Math.PI/2;if(top===state.orthographic)return;const t=Math.tan(state.fov*Math.PI/360);if(top)state.halfHeight=state.distance*t;else if(state.mode==='exterior')state.distance=state.halfHeight/t;state.orthographic=top;}
 function camera(){const s=Math.sin(state.yaw),c=Math.cos(state.yaw),sp=Math.sin(state.pitch),cp=Math.cos(state.pitch),offset=[state.distance*cp*s,state.distance*sp,state.distance*cp*c],up=[-s*sp,cp,-c*sp];
  if(state.mode==='interior')return {eye:[...eye],target:eye.map((v,i)=>v-offset[i]),up};
  return {eye:state.target.map((v,i)=>v+offset[i]),target:[...state.target],up};
 }
 function rememberInterior(){if(state.mode==='interior')savedInterior={eye:[...eye],yaw:state.yaw,pitch:state.pitch,fov:state.fov,distance:state.distance};}
 function setView({target,distance=30,yaw=.6,pitch=.44,orthographic=false,halfHeight=15}){rememberInterior();unlock();clear();state.pointMode=false;state.revision++;eye=null;Object.assign(state,{mode:'exterior',target:[...target],distance,yaw,pitch:clamp(pitch,0,Math.PI/2),orthographic,halfHeight,fov:45});if(state.pitch!==Math.PI/2)state.orthographic=false;else if(!orthographic)syncProjection();}
 function setMode(mode,position){
  if(!['interior','exterior'].includes(mode))throw Error('Unknown camera mode');if(mode===state.mode&&!position)return;
  clear();
  state.revision++;
  if(mode==='interior'){
   if(state.mode==='exterior')savedExterior={target:[...state.target],distance:state.distance,yaw:state.yaw,pitch:state.pitch,orthographic:state.orthographic,halfHeight:state.halfHeight};
   const initial=options.initialInterior||{eye:[0,state.minEyeHeight,0],yaw:0};
   const pose=position?{eye:position,yaw:state.yaw,pitch:0,fov:45,distance:3}:savedInterior||{...initial,pitch:0,fov:45,distance:3};
   eye=[...pose.eye];eye[1]=state.minEyeHeight;eye=options.spawn?options.spawn(eye):eye;
   Object.assign(state,{mode,yaw:pose.yaw,pitch:clamp(pose.pitch,-Math.PI/4,Math.PI/4),distance:pose.distance,fov:pose.fov,orthographic:false});
   if(pc()&&!state.pointMode){canvas.focus({preventScroll:true});lock();}
  }else{
   rememberInterior();const current=camera();
   if(savedExterior)setView(savedExterior);else setView({target:current.target,yaw:state.yaw,pitch:Math.max(0,state.pitch),distance:state.distance});
  }
  options.onModeChange?.(mode);
 }
 function toggleMode(){setMode(state.mode==='interior'?'exterior':'interior');}
 function zoom(delta){if(state.mode==='interior'){state.fov=clamp(state.fov*Math.exp(delta),25,75);if(state.orthographic)state.halfHeight=state.distance*Math.tan(state.fov*Math.PI/360);return;}
  const old=state.distance;state.distance=clamp(old*Math.exp(delta),.12,150);state.halfHeight*=state.distance/old;
 }
 function home(){setView({target:[0,.5,0]});options.onModeChange?.('exterior');}
 // PC 미니어처 관찰: 상단에서도 수직 드래그로 다시 기울일 수 있다.
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='mouse')return;canvas.focus({preventScroll:true});
  if(!pc()||e.button!==0)return;
  if(state.mode==='interior'){e.preventDefault();if(!state.pointMode)lock();return;}
  e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  canvas.setPointerCapture?.(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id||state.mode!=='exterior')return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(!dx&&!dy)return;e.preventDefault();
  const unit=Math.PI/Math.max(1,canvas.clientHeight);
  state.yaw-=dx*unit;
  state.pitch=clamp(state.pitch+dy*unit,0,Math.PI/2);
  syncProjection();options.onInput?.();state.actions++;
 });
 const endDrag=e=>{if(drag&&e.pointerId===drag.id){drag=null;if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);}};
 canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',()=>{drag=null;});
 document.addEventListener('mousemove',e=>{
  if(state.pointMode||state.transitioning||!pc()||state.mode!=='interior'||document.pointerLockElement!==canvas)return;
  const dx=e.movementX||0,dy=e.movementY||0;if(!dx&&!dy)return;
  const unit=Math.PI/Math.max(1,canvas.clientHeight)*.5;
  state.yaw-=dx*unit;state.pitch=clamp(state.pitch+dy*unit,-Math.PI/4,Math.PI/4);
  options.onInput?.();state.actions++;
 });
 document.addEventListener('pointerlockchange',()=>{clear();});
 window.addEventListener('blur',unlock);
 canvas.addEventListener('wheel',e=>{if(!pc()||e.ctrlKey||e.metaKey)return;e.preventDefault();if(state.transitioning||rotating())return;options.onInput?.();zoom(clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1)*.001,-1,1));state.actions++;},{passive:false});
 canvas.addEventListener('keydown',e=>{if(!pc()||e.ctrlKey||e.metaKey||e.altKey||!supported.has(e.code))return;e.preventDefault();if(e.code==='Home'){clear();options.onHome?.();return;}keys.add(e.code);options.onInput?.();if(!e.repeat)state.actions++;});
 window.addEventListener('keydown',e=>{
  if(e.code!=='Space'||!pc()||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
  e.preventDefault();if(e.repeat)return;toggleMode();canvas.focus({preventScroll:true});
 },true);
 window.addEventListener('keydown',e=>{if(e.code!=='ShiftLeft'||!pc()||state.mode!=='interior')return;e.preventDefault();if(e.repeat)return;state.pointMode=true;clear();unlock();},true);
 window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='ShiftLeft'&&state.pointMode){e.preventDefault();state.pointMode=false;clear();if(state.mode==='interior'){canvas.focus({preventScroll:true});lock();}}},true);
 const dropPoints=()=>{state.pointMode=false;clear();};
 window.addEventListener('blur',dropPoints);canvas.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)dropPoints();});
 function update(dt){syncProjection();if(state.pointMode||state.transitioning||!pc()){clear();return;}dt=clamp(dt,0,.05);
  if(rotating()){const inside=state.mode==='interior',sign=inside?-1:1;state.yaw+=sign*((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*1.25*dt;state.pitch=clamp(state.pitch+sign*((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*1.05*dt,inside?-Math.PI/4:0,inside?Math.PI/4:Math.PI/2);syncProjection();if(!inside)return;}
  if(keys.has('Equal')||keys.has('NumpadAdd'))zoom(-dt*1.3);if(keys.has('Minus')||keys.has('NumpadSubtract'))zoom(dt*1.3);
  let f=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),n=Math.hypot(f,side);if(!n)return;f/=n;side/=n;
  const speed=(state.mode==='interior'?3:clamp(state.distance*.45,1,30)*1.5)*dt,s=Math.sin(state.yaw),c=Math.cos(state.yaw),delta=[(-s*f+c*side)*speed,0,(-c*f-s*side)*speed];
  if(state.mode==='interior'){const dest=eye.map((v,i)=>v+delta[i]);eye=options.move?options.move(eye,dest):dest;}
  else state.target=state.target.map((v,i)=>v+delta[i]);
 }
 // 입력 장치에 독립적인 카메라 API. 터치 이벤트는 mobile-controls.js에만 둔다.
 const notify=()=>{options.onInput?.();state.actions++;};
 function rotate(yaw,pitch){if(state.transitioning)return;state.yaw+=yaw;state.pitch=clamp(state.pitch+pitch,state.mode==='interior'?-Math.PI/4:0,state.mode==='interior'?Math.PI/4:Math.PI/2);syncProjection();notify();}
 function pan(dx,dy){
  if(state.mode!=='exterior')return;
  const s=Math.sin(state.yaw),c=Math.cos(state.yaw),up=camera().up,unit=2*(state.orthographic?state.halfHeight:state.distance*Math.tan(state.fov*Math.PI/360))/Math.max(1,canvas.clientHeight),right=[c,0,-s];
  state.target=state.target.map((v,i)=>v+(-dx*right[i]+dy*up[i])*unit);notify();
 }
 function moveAxes(forward,side,dt){
  if(state.transitioning||state.mode!=='interior')return;
  const n=Math.max(1,Math.hypot(forward,side)),s=Math.sin(state.yaw),c=Math.cos(state.yaw),speed=3*clamp(dt,0,.05),delta=[(-s*forward+c*side)/n*speed,0,(-c*forward-s*side)/n*speed];
  if(!forward&&!side)return;const dest=eye.map((v,i)=>v+delta[i]);eye=options.move?options.move(eye,dest):dest;notify();
 }
 return {state,setView,setMode,toggleMode,home,camera,update,clear,input:{rotate,pan,moveAxes,zoom:delta=>{if(state.transitioning)return;zoom(delta);notify();}}};
};
