/* PC·모바일 공용 방향키. 화면의 앞/뒤/좌/우를 수평면에 투영한다. */
window.MuseumDirectionalNavigation=function(canvas,controls,collision,points,onTravel){
 const pad=document.createElement('nav');pad.className='direction-pad';pad.setAttribute('aria-label','이동 방향');canvas.parentElement.append(pad);
 const buttons=new Map();
 function destination(direction){
  const origin=controls.camera().eye,yaw=controls.state.yaw;
  const forward=[-Math.sin(yaw),-Math.cos(yaw)],right=[Math.cos(yaw),-Math.sin(yaw)];
  const axis=direction==='forward'?forward:direction==='back'?forward.map(v=>-v):direction==='right'?right:right.map(v=>-v);
  let best=null,score=Infinity;
  for(const point of points){
   const dx=point.eye[0]-origin[0],dz=point.eye[2]-origin[2],distance=Math.hypot(dx,dz);
   if(distance<.45)continue;
   const cosine=(dx*axis[0]+dz*axis[1])/distance;
   if(cosine<Math.SQRT1_2-1e-8)continue;
   // 옆방의 점을 향해 벽을 돌아가는 대신, 그 방향으로 곧바로 갈 수 있는 다음 점을 고른다.
   if(!collision.move(origin,point.eye).every((v,i)=>Math.abs(v-point.eye[i])<.005))continue;
   const rank=distance/(cosine*cosine);
   if(rank<score){score=rank;best=point;}
  }
  return best;
 }
 for(const [direction,label,symbol] of [['forward','앞으로 이동','↑'],['left','왼쪽으로 이동','←'],['back','뒤로 이동','↓'],['right','오른쪽으로 이동','→']]){
  const button=document.createElement('button');button.type='button';button.dataset.direction=direction;button.setAttribute('aria-label',label);button.textContent=symbol;
  button.addEventListener('click',()=>{if(controls.state.mode!=='interior'||controls.state.transitioning)return;const point=destination(direction);if(point)onTravel(point.eye);});
  pad.append(button);buttons.set(direction,button);
 }
 let lastKey='',nextPoints=[];
 function update(){
  const interior=controls.state.mode==='interior';pad.hidden=!interior;
  if(!interior){nextPoints=[];lastKey='';return;}
  const key=[...controls.camera().eye,controls.state.yaw,!!controls.state.transitioning].join(',');
  if(key===lastKey)return;lastKey=key;
  nextPoints=[];
  for(const [direction,button] of buttons){const point=controls.state.transitioning?null:destination(direction);button.disabled=!point;button.title=point?point.name+'으로 이동':'이 방향으로 이동할 수 없습니다';if(point&&!nextPoints.includes(point))nextPoints.push(point);}
 }
 return {update,destination,get nextPoints(){return nextPoints;}};
};
