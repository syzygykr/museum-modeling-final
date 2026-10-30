/* baseline의 D.M4, D.upload, D.program, D.loop 재사용. PC 카메라는 MuseumControls.
 * 모델 생성·근거 기록은 layout.js/geometry.js에만 둔다. */
(()=>{
  'use strict';
  const canvas=document.querySelector('#cv'),error=document.querySelector('#error');
  try {
    const gl=canvas.getContext('webgl2',{antialias:true});
    if(!gl)throw new Error('WebGL2를 사용할 수 없습니다. WebGL2 지원 브라우저에서 열어 주세요.');
    const M=D.M4,model=MuseumGeometry.build(),collision=MuseumCollision(model,MuseumLayout);
    const initialEntry=MuseumGeometry.point([125,430]); // 사용자 체크 위치: 서측 입구 대기 공간
    let flight=null;
    function cancelFlight(){flight=null;controls.state.transitioning=false;}
    const controls=MuseumControls(canvas,{onHome:()=>home(),onInput:()=>{selected='free';sync();},onModeChange:()=>{cancelFlight();selected='free';sync();},initialInterior:{eye:[initialEntry[0],1.575,initialEntry[1]],yaw:Math.atan2(125-205,430-366.5)},move:collision.move,spawn:collision.spawn});
    const program=D.program(gl,`#version 300 es
      layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;
      uniform mat4 uModel,uVP;uniform mat3 uNormal;out vec3 vN;out vec3 vWorld;
      void main(){vN=uNormal*aNormal;vec4 world=uModel*vec4(aPos,1.);vWorld=world.xyz;gl_Position=uVP*world;}
    `,`#version 300 es
      precision highp float;in vec3 vN;in vec3 vWorld;uniform vec3 uColor,uEye;uniform float uAlpha;uniform int uSurface;uniform bool uFloorTexture;uniform sampler2D uWood;uniform vec4 uWoodBounds,uGrassBounds;uniform vec2 uWoodTile,uGrassNotch;out vec4 outColor;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      bool within(vec4 b){return vWorld.x>=b.x&&vWorld.z>=b.y&&vWorld.x<=b.z&&vWorld.z<=b.w;}
      void main(){
        vec3 n=normalize(vN),light=normalize(vec3(-.3,1.,.5));float l=.62+.38*max(dot(n,light),0.);vec3 color=uColor*l;
        if(uSurface==1){
          // 잔디 아래의 기존 바닥 픽셀을 생략해 얇은 받침면과의 깊이 충돌을 방지한다.
          if(within(uGrassBounds)&&(vWorld.x>=uGrassNotch.x||vWorld.z>=uGrassNotch.y))discard;
          float grain=hash(floor(vWorld*260.)),fleck=hash(floor(vWorld*115.));
          float aa=clamp(length(fwidth(vWorld.xz))*160.,0.,1.);
          color=(vec3(.43,.49,.52)+(grain-.5)*.095*(1.-aa)+step(.93,fleck)*.025*(1.-aa))*l;
          vec2 edge=min(fract(vWorld.xz/.60),1.-fract(vWorld.xz/.60));
          color*=1.-.035*(1.-smoothstep(0.,max(.002,fwidth(vWorld.x)*2.),min(edge.x,edge.y)));

        }
        if(uSurface==4){
          float fine=hash(floor(vWorld*190.)),patchNoise=hash(vec3(floor(vWorld.xz*5.),0.));
          float aa=clamp(length(fwidth(vWorld.xz))*110.,0.,1.);
          color=(vec3(.24,.39,.13)+(fine-.5)*.12*(1.-aa)+(patchNoise-.5)*.045)*l;
        }
        if(uSurface==2){float aa=clamp(length(fwidth(vWorld))*160.,0.,1.);color=vec3(.89,.885,.86)*(1.+(hash(floor(vWorld*210.))-.5)*.025*(1.-aa))*l;if(vWorld.y<.075&&abs(n.y)<.5)color=vec3(.065,.064,.062)*l;}
        if(uSurface==3){
          vec2 woodUV=abs(n.y)>.7?vWorld.xz:abs(n.x)>.7?vWorld.zy:vWorld.xy;
          float grain=sin(woodUV.x*190.+sin(woodUV.y*2.4)*2.+sin(woodUV.x*37.)*1.4);
          float aa=clamp(length(fwidth(woodUV))*60.,0.,1.);color=uColor*(.96+grain*.055*(1.-aa))*l;
        }
        if(uFloorTexture&&vWorld.x>=uWoodBounds.x&&vWorld.z>=uWoodBounds.y&&vWorld.x<=uWoodBounds.z&&vWorld.z<=uWoodBounds.w){
          vec2 uv=(vWorld.xz-uWoodBounds.xy)/uWoodTile;
          color=texture(uWood,uv).rgb*l;
          vec3 halfVector=normalize(light+normalize(uEye-vWorld));
          color+=vec3(1.,.94,.83)*.12*pow(max(dot(n,halfVector),0.),32.);
        }
        outColor=vec4(color,uAlpha);
      }
    `);
    const U=D.uniforms(gl,program,['uModel','uVP','uNormal','uColor','uAlpha','uEye','uFloorTexture','uWood','uWoodBounds','uWoodTile','uSurface','uGrassBounds','uGrassNotch']);
    const woodTexture=gl.createTexture(),woodImage=new Image();let woodReady=false;
    gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([180,125,60,255]));
    woodImage.onload=()=>{
      gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,woodImage);gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      woodReady=true;
    };
    woodImage.onerror=()=>{error.hidden=false;error.textContent='목재 바닥 텍스처를 불러오지 못했습니다.';};
    woodImage.src=MuseumTextureAssets[model.floors[0].woodRegion.asset];
    const woodRegion=model.floors[0].woodRegion,woodMin=MuseumGeometry.point(woodRegion.bounds.slice(0,2)),woodMax=MuseumGeometry.point(woodRegion.bounds.slice(2));
    const view=M.create(),projection=M.create(),vp=M.create(),identity=M.create();
    const points=MuseumLayout.floor.polygon.map(MuseumGeometry.point);
    const lo=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],hi=[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
    const center=[(lo[0]+hi[0])/2,.5,(lo[1]+hi[1])/2],radius=Math.hypot(hi[0]-lo[0],hi[1]-lo[1])/2;
    let selected='orbit',lastCamera=null;
    const fields=Object.fromEntries(['walls','frames','names','low','structure','glass','ceiling','details','displays'].map(id=>[id,{checked:!['low','ceiling'].includes(id)}]));
    const mobileControls=MuseumMobileControls(canvas,controls);
    const waypointControls=MuseumPointNavigation(canvas,controls,collision,model,destination=>{
      const start=lastCamera||controls.camera(),pose={yaw:controls.state.yaw,pitch:controls.state.pitch,fov:controls.state.fov};
      const path=MuseumPathfinding.find(controls.camera().eye,destination,collision);if(!path)return;
      const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(...path[i].map((v,k)=>v-path[i-1][k])));
      controls.setMode('interior',destination);Object.assign(controls.state,pose);controls.clear();mobileControls.reset();
      flight={start,end:controls.camera(),began:performance.now(),duration:Math.min(1600,Math.max(380,lengths.at(-1)*65)),path,lengths};controls.state.transitioning=true;
    });
    function sync(){const choice=controls.state.mode==='interior'?'interior':controls.state.orthographic?'plan':'orbit';document.querySelectorAll('[data-navigation]').forEach(b=>{const active=b.dataset.navigation===choice;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
    function home(){cancelFlight();lastCamera=null;const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight),fit=matchMedia('(pointer: coarse)').matches?Math.max(1,1.2/aspect):1;controls.setView({target:center,distance:radius*1.8*fit});selected='orbit';sync();}
    window.addEventListener('resize',()=>{if(matchMedia('(pointer: coarse)').matches&&selected==='orbit')home();});
    function preset(name){
      cancelFlight();
      lastCamera=null;
      if(name==='orbit'){home();return;}
      const poses={top:[0,1,0]};
      const v=poses[name];if(!v)return;
      let target=[...center],distance=radius*1.8;
      const aspect=Math.max(.1,canvas.clientWidth/Math.max(1,canvas.clientHeight));
      controls.setView({target,distance:distance*Math.hypot(...v),yaw:0,pitch:Math.PI/2,orthographic:true,halfHeight:Math.max(radius*.65,radius*1.08/aspect)});
      selected=name;sync();
    }
    document.querySelectorAll('[data-navigation]').forEach(b=>b.addEventListener('click',()=>{
      cancelFlight();
      if(b.dataset.navigation==='plan')preset('top');
      else if(b.dataset.navigation==='orbit')home();
      else controls.setMode('interior');
    }));
    const labels=MuseumLayout.rooms.map(room=>{
      const el=document.createElement('button');el.type='button';el.className='room-label';el.textContent=room.name;el.dataset.room=room.id;el.setAttribute('aria-label',room.name+'에서 1인칭으로 보기');document.querySelector('#labels').append(el);
      const pts=room.polygon.map(MuseumGeometry.point),p=[pts.reduce((s,v)=>s+v[0],0)/pts.length,.12,pts.reduce((s,v)=>s+v[1],0)/pts.length];
      el.addEventListener('click',()=>{
        if(controls.state.mode!=='exterior'||controls.state.orthographic)return;
        const start=lastCamera||controls.camera();
        const entry=room.entryAt?MuseumGeometry.point(room.entryAt):[p[0],p[2]];
        controls.setMode('interior',[entry[0],controls.state.minEyeHeight,entry[1]]);
        mobileControls.reset();controls.clear();
        flight={start,end:controls.camera(),began:performance.now(),duration:550};controls.state.transitioning=true;
      });
      return {el,p,room:room.id};
    });
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);home();
    function matrix(p){const m=M.create(),short=fields.low.checked&&p.group==='wall';M.translate(m,m,[p.position[0],short?p.position[1]*.25:p.position[1],p.position[2]]);M.rotateY(m,m,p.yaw||0);M.scale(m,m,[p.size[0],short?p.size[1]*.25:p.size[1],p.size[2]]);return m;}
    function draw(mesh,m,color,alpha=1,textured=false,surface=0){gl.uniformMatrix4fv(U.uModel,false,m);gl.uniformMatrix3fv(U.uNormal,false,M.normalFrom(m));gl.uniform3fv(U.uColor,color);gl.uniform1f(U.uAlpha,alpha);gl.uniform1i(U.uSurface,surface);gl.uniform1i(U.uFloorTexture,textured&&woodReady?1:0);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);}
    function visible(p){if(selected==='gallery'&&!['long','immersive'].includes(p.room))return false;return (p.group!=='wall'||fields.walls.checked)&&(p.group!=='frame'||fields.frames.checked)&&(p.group!=='structure'||fields.structure.checked)&&(p.group!=='glass'||fields.glass.checked)&&(p.group!=='details'||fields.details.checked)&&(!['displays','displayGlass'].includes(p.group)||fields.displays.checked)&&(p.group!=='displayGlass'||fields.glass.checked);}
    let surfaceKey='',surfaceStats=null;
    function prepareSurfaces(){
      const key=[selected==='gallery',...['walls','frames','structure','glass','details','displays','ceiling','low'].map(k=>fields[k].checked)].join('/');
      if(key===surfaceKey)return;
      const floors=model.floors.filter(p=>p.group!=='ceiling'||fields.ceiling.checked);
      const parts=model.parts.filter(visible).map(p=>fields.low.checked&&p.group==='wall'?{...p,position:p.position.map((v,i)=>i===1?v*.25:v),size:p.size.map((v,i)=>i===1?v*.25:v)}:p);
      const result=MuseumSurfaces.resolve([...floors,...parts]);
      for(const p of [...model.floors,...model.parts]){
        p.renderGpu?.dispose();p.renderGpu=null;
        const mesh=result.meshes.get(p.id);if(mesh)p.renderGpu=D.upload(gl,mesh);
      }
      surfaceStats={trimmed:result.trimmed,removedArea:result.removedArea};surfaceKey=key;
    }
    D.loop((now,dt)=>{
      controls.update(dt);
      mobileControls.update(dt);
      prepareSurfaces();
      const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clearColor(.91,.925,.90,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      let camera=controls.camera();
      if(flight){
        const t=Math.min(1,(performance.now()-flight.began)/flight.duration),s=t*t*(3-2*t),mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*s),normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
        const a=flight.start,b=flight.end,eye=mix(a.eye,b.eye),direction=normalize(mix(normalize(a.target.map((v,i)=>v-a.eye[i])),normalize(b.target.map((v,i)=>v-b.eye[i]))));
        camera={eye,target:eye.map((v,i)=>v+direction[i]),up:normalize(mix(a.up,b.up))};
        if(flight.path){const distance=s*flight.lengths.at(-1);let i=1;while(i<flight.lengths.length-1&&flight.lengths[i]<distance)i++;const fraction=(distance-flight.lengths[i-1])/Math.max(1e-9,flight.lengths[i]-flight.lengths[i-1]);camera.eye=flight.path[i-1].map((v,k)=>v+(flight.path[i][k]-v)*fraction);camera.target=camera.eye.map((v,k)=>v+direction[k]);}
        if(t===1){camera=b;cancelFlight();controls.clear();mobileControls.reset();}
      }
      lastCamera=camera;M.lookAt(view,camera.eye,camera.target,camera.up);
      if(controls.state.orthographic){const half=controls.state.halfHeight;M.ortho(projection,-half*w/h,half*w/h,-half,half,.02,250);}
      else M.perspective(projection,controls.state.fov*Math.PI/180,w/h,.02,250);
      M.multiply(vp,projection,view);gl.useProgram(program);gl.uniformMatrix4fv(U.uVP,false,vp);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.uniform1i(U.uWood,0);gl.uniform3fv(U.uEye,camera.eye);gl.uniform4fv(U.uWoodBounds,[...woodMin,...woodMax]);gl.uniform2fv(U.uWoodTile,woodRegion.tileSize);
      gl.uniform4fv(U.uGrassBounds,[...MuseumGeometry.point([492,480]),...MuseumGeometry.point([900,584])]);gl.uniform2fv(U.uGrassNotch,MuseumGeometry.point([552,496]));
      for(const f of model.floors){if(!f.renderGpu)continue;draw(f.renderGpu,identity,f.color,1,f.group==='floor',MuseumMaterials.classify(f));}
      for(const p of model.parts){if(['glass','displayGlass'].includes(p.group)||!visible(p))continue;draw(p.renderGpu,matrix(p),p.color,1,false,MuseumMaterials.classify(p));}
      // 얇은 유리판은 불투명 부재 뒤에, 카메라에서 먼 순서로 그린다.
      const distance=p=>p.position.reduce((s,v,i)=>s+(v-camera.eye[i])**2,0);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      for(const p of model.parts.filter(p=>['glass','displayGlass'].includes(p.group)&&visible(p)).sort((a,b)=>distance(b)-distance(a)))draw(p.renderGpu,matrix(p),p.color,p.alpha);
      gl.depthMask(true);gl.disable(gl.BLEND);
      waypointControls.update(vp,r);
      for(const {el,p,room} of labels){const anchor=controls.state.mode==='interior'?[p[0],1.85,p[2]]:p,clip=[0,1,2,3].map(i=>vp[i]*anchor[0]+vp[4+i]*anchor[1]+vp[8+i]*anchor[2]+vp[12+i]),x=clip[0]/clip[3],y=clip[1]/clip[3];el.hidden=(selected==='gallery'&&!['long','immersive'].includes(room))||!fields.names.checked||clip[3]<=0||Math.abs(x)>1||Math.abs(y)>1;el.disabled=controls.state.mode!=='exterior'||controls.state.orthographic;el.style.left=(x*.5+.5)*r.width+'px';el.style.top=(-y*.5+.5)*r.height+'px';}
    });
    window.MuseumViewer={gl,model,controls,home,groundNavigation:waypointControls,partMatrix:matrix,get camera(){return lastCamera;},get surfaceStats(){return surfaceStats;},get woodReady(){return woodReady;}};
  } catch(e){error.hidden=false;error.textContent=e.message;console.error(e);}
})();






