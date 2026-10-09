// 八尺様から逃げろ！ — first-person 3D version
(function(){
'use strict';
const T=THREE;T.ColorManagement.enabled=false;
const $=(id)=>document.getElementById(id);
const clamp=(x,a,b)=>x<a?a:x>b?b:x,lerp=(a,b,t)=>a+(b-a)*t,rand=(a,b)=>a+Math.random()*(b-a);
const ease=(k,dt)=>1-Math.exp(-k*dt);
const angDiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;};
const BEST_KEY='hachishaku3d_best_v1';
const cGl=$('gl'),cFx=$('fx'),cMM=$('minimap');
const fx=cFx.getContext('2d'),mmx=cMM.getContext('2d');
const isTouch=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||('ontouchstart' in window);
let renderer,scene,camera,world,H,H3,pcam,telegraph;
let DPR=1,CW=0,CH=0,VWc=1,VHc=1,PR=1;
const EYE=1.05,P_SPEED=4.3,P_R=0.28,PITCH_MIN=-1.1,PITCH_MAX=1.38;

function showErr(e){const el=$('err');el.textContent='エラー: '+(e&&e.message||e);el.classList.remove('hidden');console.error(e);}
window.addEventListener('error',(e)=>showErr(e.error||e.message));

// ---------------------------------------------------------------- state
const G={mode:'title',t:0,time:0,best:0,stage:0,frust:0,escapes:0,shake:0,flash:0,flashCol:'255,40,60',paused:false,overReady:false,fade:0};
const P={x:0,z:0,yaw:0,pitch:0,vx:0,vz:0,inv:0,knock:0,kx:0,kz:0,bobPh:0,bob:0,roll:0};
const E={x:0,z:0,vx:0,vz:0,state:'chase',st:0,dashCd:6,tx:0,tz:0,chantCd:3,mood:'calm',eager:false,farT:0,dvx:0,dvz:0,dashDist:0,dashed:0,los:false,pathDist:0};
const grab={e:0,t:0,limit:5.5,squeezeT:0,hits:0,yaw:0,pitch:0};
const camS={blend:0,x:0,y:EYE,z:0,yaw:0,pitch:0};
const parts=[];
try{G.best=parseFloat(localStorage.getItem(BEST_KEY))||0;}catch(e){}
function growthFor(stage){return 1+0.22*stage;}
function reach(){return H3.bellyHalfWM()*0.82+0.35;}

// ---------------------------------------------------------------- resize
function fovFor(aspect){return aspect>=1?70:clamp(2*Math.atan(Math.tan(32*Math.PI/180)/aspect)*180/Math.PI,70,100);}
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  VWc=window.innerWidth;VHc=window.innerHeight;CW=Math.round(VWc*DPR);CH=Math.round(VHc*DPR);
  cFx.width=CW;cFx.height=CH;
  if(renderer){renderer.setSize(VWc,VHc,false);camera.aspect=VWc/VHc;camera.fov=fovFor(camera.aspect);camera.updateProjectionMatrix();}
  const mmS=Math.round(cMM.getBoundingClientRect().width*DPR)||120;cMM.width=cMM.height=mmS;
  portraitRect=null;
}
window.addEventListener('resize',resize);

// ---------------------------------------------------------------- input
const keys={};
const sticks={move:{el:$('stickL'),knob:$('knobL'),id:null,ox:0,oy:0,dx:0,dy:0},look:{el:$('stickR'),knob:$('knobR'),id:null,ox:0,oy:0,dx:0,dy:0}};
const mouse={drag:false,id:null,lx:0,ly:0};
let lockWanted=false;
window.addEventListener('keydown',(e)=>{
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(G.mode==='grab'&&(e.code==='Space'||e.code==='Enter'||e.code==='KeyZ'||e.code==='KeyX')&&!e.repeat)hitBelly(null);
  if((e.code==='Escape'||e.code==='KeyP')&&(G.mode==='play'||G.mode==='grab'))togglePause();
  if(G.mode==='title'&&(e.code==='Enter'||e.code==='Space')&&$('how').classList.contains('hidden'))startGame();
  else if(G.mode==='over'&&(e.code==='Enter'||e.code==='Space')&&G.overReady)startGame();
});
window.addEventListener('keyup',(e)=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
const app=$('app');
function stickStart(s,e){
  s.id=e.pointerId;s.ox=e.clientX;s.oy=e.clientY;s.dx=s.dy=0;
  s.el.style.left=e.clientX+'px';s.el.style.top=e.clientY+'px';s.el.classList.add('on');s.knob.style.transform='';
}
function stickMove(s,e){
  let dx=e.clientX-s.ox,dy=e.clientY-s.oy;const m=Math.hypot(dx,dy),R0=Math.min(56,VWc*0.12);
  if(m>R0){if(s===sticks.move){s.ox+=dx/m*(m-R0);s.oy+=dy/m*(m-R0);s.el.style.left=s.ox+'px';s.el.style.top=s.oy+'px';}dx=dx/m*R0;dy=dy/m*R0;}
  s.dx=dx/R0;s.dy=dy/R0;s.knob.style.transform=`translate(${dx}px,${dy}px)`;
}
function stickEnd(s){s.id=null;s.dx=s.dy=0;s.el.classList.remove('on');s.el.style.left='';s.el.style.top='';s.knob.style.transform='';}
app.addEventListener('pointerdown',(e)=>{
  if(e.target.closest('button,.card,#minimap'))return;
  Sfx.resume();
  if(G.paused)return;
  if(G.mode==='grab'){
    if(document.pointerLockElement)hitBelly([VWc/2,VHc/2]);else hitBelly([e.clientX,e.clientY]);
    return;
  }
  if(G.mode!=='play')return;
  if(e.pointerType==='mouse'){
    if(!document.pointerLockElement&&cGl.requestPointerLock&&!G.noLock){lockWanted=true;try{const r=cGl.requestPointerLock();if(r&&r.catch)r.catch(()=>{G.noLock=true;});}catch(_){G.noLock=true;}}
    mouse.drag=true;mouse.id=e.pointerId;mouse.lx=e.clientX;mouse.ly=e.clientY;
    try{app.setPointerCapture(e.pointerId);}catch(_){}
    return;
  }
  const left=e.clientX<VWc*0.5;
  const s=left?sticks.move:sticks.look;
  if(s.id===null){stickStart(s,e);try{app.setPointerCapture(e.pointerId);}catch(_){}}
});
app.addEventListener('pointermove',(e)=>{
  if(document.pointerLockElement===cGl&&e.pointerType==='mouse'){
    if(G.mode==='play'&&!G.paused){P.yaw-=e.movementX*0.0024;P.pitch=clamp(P.pitch-e.movementY*0.0024,PITCH_MIN,PITCH_MAX);}
    return;
  }
  if(mouse.drag&&e.pointerId===mouse.id){
    const dx=e.clientX-mouse.lx,dy=e.clientY-mouse.ly;mouse.lx=e.clientX;mouse.ly=e.clientY;
    if(G.mode==='play'&&!G.paused){P.yaw-=dx*0.0045;P.pitch=clamp(P.pitch-dy*0.0045,PITCH_MIN,PITCH_MAX);}
    return;
  }
  for(const k in sticks){const s=sticks[k];if(s.id===e.pointerId)stickMove(s,e);}
});
const endPtr=(e)=>{
  if(mouse.drag&&e.pointerId===mouse.id)mouse.drag=false;
  for(const k in sticks){const s=sticks[k];if(s.id===e.pointerId)stickEnd(s);}
};
app.addEventListener('pointerup',endPtr);app.addEventListener('pointercancel',endPtr);
app.addEventListener('contextmenu',(e)=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===cGl;$('xhair').classList.toggle('lock',locked);
  if(!locked&&lockWanted&&(G.mode==='play'||G.mode==='grab')&&!G.paused){lockWanted=false;togglePause();}
  if(locked)lockWanted=true;
});
document.addEventListener('pointerlockerror',()=>{G.noLock=true;lockWanted=false;});
function releaseLock(){lockWanted=false;if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();}
function moveInput(){
  let x=0,y=0;
  if(keys.ArrowLeft||keys.KeyA)x-=1;if(keys.ArrowRight||keys.KeyD)x+=1;
  if(keys.ArrowUp||keys.KeyW)y+=1;if(keys.ArrowDown||keys.KeyS)y-=1;
  if(x||y){const m=Math.hypot(x,y);return [x/m,y/m];}
  const s=sticks.move;if(s.id!==null){const m=Math.hypot(s.dx,s.dy);if(m<0.12)return [0,0];const k=Math.min(1,(m-0.12)/0.75)/m;return [s.dx*k,-s.dy*k];}
  return [0,0];
}
function lookInput(dt){
  const s=sticks.look;if(s.id===null)return;
  const dz=0.1,f=(v)=>{const a=Math.abs(v);if(a<dz)return 0;const t=(a-dz)/(1-dz);return Math.sign(v)*t*t*0.65+Math.sign(v)*t*0.35;};
  P.yaw-=f(s.dx)*2.7*dt;P.pitch=clamp(P.pitch-f(s.dy)*1.9*dt,PITCH_MIN,PITCH_MAX);
}

// ---------------------------------------------------------------- particles / fx
const tmpV=new T.Vector3();
function project(v){tmpV.copy(v).project(camera);if(tmpV.z>1||tmpV.z<-1)return null;return [(tmpV.x*0.5+0.5)*CW,(-tmpV.y*0.5+0.5)*CH];}
function addText(txt,o){o=o||{};parts.push({k:'text',w:o.w?o.w.clone():null,x:o.x||0,y:o.y||0,ox:0,oy:0,vx:o.vx!=null?o.vx:rand(-30,30)*DPR,vy:o.vy!=null?o.vy:-90*DPR,t:0,life:o.life||1.0,txt:txt,size:(o.size||26)*DPR,col:o.col||'#fff',stroke:o.stroke||'#400',rot:o.rot!=null?o.rot:rand(-0.2,0.2),grav:o.grav==null?60*DPR:o.grav});}
function burst(x,y,n,col,spd){for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),v=rand(0.3,1)*(spd||380)*DPR;parts.push({k:'spark',x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,life:rand(0.3,0.6),size:rand(3,7)*DPR,col:col||'#fff'});}}
function ring(x,y,col,r){parts.push({k:'ring',x:x,y:y,t:0,life:0.45,r:(r||90)*DPR,col:col||'255,255,255'});}
function banner(main,sub){const b=$('banner');b.innerHTML=main+(sub?`<span class="s">${sub}</span>`:'');b.classList.remove('show');void b.offsetWidth;b.classList.add('show');}
function shake(a){G.shake=Math.max(G.shake,a);}
function headWorld(){return H3.upperToWorld(607,150);}

// ---------------------------------------------------------------- flow
function placeStart(){
  // player in a street near the centre, 八尺様 far away along the street network
  const N=World.N,C=World.CELL;let best=null,bd=1e9;
  for(let cz=0;cz<N;cz++)for(let cx=0;cx<N;cx++){if(world.type(cx,cz)!==0)continue;const d=Math.hypot(cx-N*0.42,cz-N*0.55);if(d<bd){bd=d;best=[cx,cz];}}
  P.x=(best[0]+0.5)*C;P.z=(best[1]+0.5)*C;
  const D=world.flow(P.x,P.z);const cands=[];
  for(let k=0;k<N*N;k++)if(D[k]>=15&&D[k]<=19&&world.grid[k]===0)cands.push(k);
  const k=cands.length?cands[Math.floor(Math.random()*cands.length)]:0;
  E.x=(k%N+0.5)*C;E.z=(Math.floor(k/N)+0.5)*C;
  P.yaw=Math.atan2(-(E.x-P.x),-(E.z-P.z))+rand(-0.9,0.9);P.pitch=0.05;
}
function resetRun(){
  G.time=0;G.stage=0;G.frust=0;G.escapes=0;G.shake=0;G.flash=0;G.overReady=false;G.fade=0;
  Object.assign(P,{vx:0,vz:0,inv:1.5,knock:0,bobPh:0,bob:0,roll:0});
  Object.assign(E,{vx:0,vz:0,state:'intro',st:0,dashCd:7,chantCd:2,eager:false,mood:'calm',farT:0});
  placeStart();
  H.reset();H.setGrowth(1);H.b.g=1;wireRig();
  camS.blend=0;parts.length=0;
}
function startGame(){
  Sfx.resume();Sfx.click();Sfx.startAmbient();
  for(const id of ['title','over','how','pause'])$(id).classList.add('hidden');
  $('hud').classList.remove('hidden');$('grab').classList.add('hidden');$('sticks').classList.toggle('hidden',!isTouch);
  resetRun();G.mode='play';G.paused=false;
  banner('ぽ…ぽぽぽ…','どこかに八尺様がいる… 逃げろ！');
  setTimeout(()=>{if(G.mode==='play')H.startChant(3);},500);
  $('hint').style.opacity='0.85';setTimeout(()=>{$('hint').style.opacity='0';},7000);
}
function toTitle(){
  G.mode='title';G.paused=false;releaseLock();
  for(const id of ['pause','over','hud','grab','sticks'])$(id).classList.add('hidden');
  $('title').classList.remove('hidden');updateTitleBest();setupTitleScene();
}
function togglePause(){
  if(G.mode!=='play'&&G.mode!=='grab')return;
  G.paused=!G.paused;$('pause').classList.toggle('hidden',!G.paused);
  if(G.paused){releaseLock();for(const k in sticks)stickEnd(sticks[k]);}
  if(Sfx.ctx){if(G.paused)Sfx.ctx.suspend();else Sfx.ctx.resume();}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(G.mode==='play'||G.mode==='grab')&&!G.paused)togglePause();});
function updateTitleBest(){$('tBest').textContent=G.best>0?`ベスト記録：${G.best.toFixed(1)}秒`:'';}

function startGrab(){
  G.mode='grab';E.state='grab';E.st=0;
  grab.e=0.38;grab.t=0;grab.limit=Math.max(3.6,5.6-G.stage*0.12);grab.squeezeT=0.8;grab.hits=0;
  for(const k in sticks)stickEnd(sticks[k]);
  $('grab').classList.remove('hidden');$('hint').style.opacity='0';
  Sfx.grab();shake(0.5);G.flash=0.5;G.flashCol='255,30,60';
  addText('つかまえた♪',{x:CW/2,y:CH*0.22,size:40,col:'#ffd0e0',stroke:'#600',vy:-40*DPR,vx:0,life:1.4,grav:0,rot:0});
  H.startChant(4);
  if(navigator.vibrate)try{navigator.vibrate([40,30,60]);}catch(_){}
}
const ray=new T.Raycaster();
function hitBelly(pt){
  if(G.mode!=='grab'||G.paused)return;
  let bx,by,sx,sy;
  if(pt){
    ray.setFromCamera(new T.Vector2(pt[0]/VWc*2-1,-(pt[1]/VHc)*2+1),camera);
    const b=H3.rayToBelly(ray.ray);if(b&&b.inside){bx=b.x;by=b.y;sx=pt[0]*DPR;sy=pt[1]*DPR;}
  }
  if(bx===undefined){
    bx=610+rand(-280,280);by=850+rand(-180,220);
    const g=H.b.g,w=H3.srcToWorld(610+(bx-610)*g,445+(by-445)*g-H.lift);const s=project(w)||[CW/2,CH/2];sx=s[0];sy=s[1];
  }
  H.hit(bx,by,1);
  grab.e+=0.1/(1+0.04*G.stage);grab.hits++;
  Sfx.slap(1);shake(0.18);
  burst(sx,sy,8,'#fff6c8',420);ring(sx,sy,'255,240,200',70);
  const words=['ぺちっ','ぼよん','ぽよん♪','ばいん','ぺしっ','ぷるん'];
  addText(words[Math.floor(Math.random()*words.length)],{x:sx+rand(-30,30)*DPR,y:sy-20*DPR,size:rand(24,34),col:'#fff',stroke:'#b0205a',vy:-160*DPR});
  if(navigator.vibrate)try{navigator.vibrate(12);}catch(_){}
  if(grab.e>=1)escapeGrab();
}
function escapeGrab(){
  G.mode='play';E.state='stunned';E.st=0;
  $('grab').classList.add('hidden');
  G.escapes++;G.frust=Math.min(0.999,G.frust+0.22);
  Sfx.escape();Sfx.whoosh();shake(0.6);
  let dx=P.x-E.x,dz=P.z-E.z;const m=Math.hypot(dx,dz)||1;dx/=m;dz/=m;
  P.knock=0.55;P.kx=dx*7.5;P.kz=dz*7.5;P.inv=1.8;
  P.yaw=camS.yaw;P.pitch=clamp(camS.pitch,PITCH_MIN,PITCH_MAX);
  banner('脱出成功！','八尺様はさらにイライラ…');
  addText('えっ…!?',{w:headWorld(),size:36,col:'#cfe0ff',stroke:'#123',life:1.2,grav:0,vy:-40*DPR});
  burst(CW/2,CH/2,26,'#bfe6ff',700);
  H.hit(610,900,1.6);
}
function gameOverSeq(){
  G.mode='caught';E.state='win';E.st=0;$('grab').classList.add('hidden');
  Sfx.gameOver();H.startChant(6);releaseLock();
  addText('ぎゅ〜〜っ',{x:CW/2,y:CH*0.3,size:46,col:'#ffd0e0',stroke:'#600',life:1.8,grav:0,vy:-30*DPR,vx:0,rot:0});
}
function showOver(){
  G.mode='over';
  const t=G.time,isNew=t>G.best+1e-6;
  if(isNew){G.best=t;try{localStorage.setItem(BEST_KEY,String(t));}catch(e){}}
  $('oTime').textContent=t.toFixed(1)+'秒';$('oLv').textContent='Lv.'+G.stage;$('oEsc').textContent=G.escapes+'回';
  $('oSize').textContent='×'+H.b.gT.toFixed(2);
  $('oNew').classList.toggle('hidden',!isNew);$('oBest').textContent='ベスト記録：'+G.best.toFixed(1)+'秒';
  $('over').classList.remove('hidden');$('hud').classList.add('hidden');$('sticks').classList.add('hidden');
  setTimeout(()=>{G.overReady=true;},600);
}
function stageUp(){
  G.stage++;G.frust=0;E.state='stageup';E.st=0;
  H.setGrowth(growthFor(G.stage));
  Sfx.stageUp();H.startChant(5);shake(0.7);G.flash=0.6;G.flashCol='255,30,60';
  banner(`イライラ Lv.${G.stage}！`,'お腹がさらに膨らんだ！');
  ['ぷくぅ〜','むぎぎ…','ぽぽぽ!!'].forEach((s,i)=>setTimeout(()=>{if(G.mode==='play'||G.mode==='grab')addText(s,{w:H3.bellyCenterWorld(),size:30,col:'#ffb0c0',stroke:'#500',vy:-80*DPR,vx:rand(-90,90)*DPR});},i*250));
}

// ---------------------------------------------------------------- update
function update(dt){
  G.t+=dt;
  world.update(G.t,P.x,P.z);
  if(G.mode==='title'){updateTitleScene(dt);return;}
  if(G.paused)return;
  const playing=G.mode==='play';
  if(playing||G.mode==='grab')G.time+=dt;
  // ---- player
  if(playing){
    lookInput(dt);
    const mi=moveInput();
    const fx_=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
    const tvx=(fx_*mi[1]+rx*mi[0])*P_SPEED,tvz=(fz*mi[1]+rz*mi[0])*P_SPEED;
    P.vx=lerp(P.vx,tvx,ease(12,dt));P.vz=lerp(P.vz,tvz,ease(12,dt));
    if(P.knock>0){P.knock-=dt;const k=Math.max(0,P.knock/0.55);P.vx=P.kx*k+P.vx*(1-k);P.vz=P.kz*k+P.vz*(1-k);}
    const np=world.collide(P.x+P.vx*dt,P.z+P.vz*dt,P_R);
    P.vx=(np[0]-P.x)/Math.max(dt,1e-4)*0.5+P.vx*0.5;P.vz=(np[1]-P.z)/Math.max(dt,1e-4)*0.5+P.vz*0.5;
    P.x=np[0];P.z=np[1];
    const ps=Math.hypot(P.vx,P.vz);
    const prev=Math.sin(P.bobPh);P.bobPh+=dt*ps*2.1;const cur=Math.sin(P.bobPh);
    if(ps>1&&(prev<0)!==(cur<0))Sfx.patter();
    P.bob=lerp(P.bob,Math.abs(cur)*0.05*Math.min(1,ps/P_SPEED),ease(20,dt));
    P.roll=lerp(P.roll,-mi[0]*0.025,ease(6,dt));
    P.inv=Math.max(0,P.inv-dt);
  }
  // ---- 八尺様 AI
  const dx=P.x-E.x,dz=P.z-E.z,dist=Math.hypot(dx,dz)||0.001;
  E.st+=dt;
  E.los=world.los(E.x,E.z,P.x,P.z);
  let tvx=0,tvz=0;
  const base=Math.min(3.8,2.0+0.22*G.stage+0.7*G.frust);
  const steer=(spd)=>{
    if(E.los){E.pathDist=dist;return [dx/dist*spd,dz/dist*spd];}
    const D=world.flow(P.x,P.z),wp=world.nextWaypoint(E.x,E.z,D);
    if(!wp){E.pathDist=999;return [dx/dist*spd,dz/dist*spd];}
    E.pathDist=wp[2]*World.CELL;const wx=wp[0]-E.x,wz=wp[1]-E.z,m=Math.hypot(wx,wz)||1;return [wx/m*spd,wz/m*spd];
  };
  switch(E.state){
    case 'intro':{if(E.st>1.4)E.state='chase';const v=steer(1.2);tvx=v[0];tvz=v[1];break;}
    case 'chase':{
      const v=steer(base);tvx=v[0];tvz=v[1];
      E.dashCd-=dt;
      if(E.dashCd<=0&&E.los&&dist<16&&dist>4){E.state='windup';E.st=0;E.tx=P.x+P.vx*0.4;E.tz=P.z+P.vz*0.4;Sfx.dashWarn();H.startChant(3);}
      E.chantCd-=dt;if(E.chantCd<=0){E.chantCd=rand(4,8);H.startChant(3);}
      // too far away? she silently re-appears somewhere closer, out of sight
      if(playing&&E.pathDist>46){E.farT+=dt;if(E.farT>3.5){E.farT=0;warpCloser();}}else E.farT=0;
      break;}
    case 'windup': if(E.st>0.9){E.state='dash';E.st=0;Sfx.whoosh();const m=Math.hypot(E.tx-E.x,E.tz-E.z)||1;E.dvx=(E.tx-E.x)/m;E.dvz=(E.tz-E.z)/m;E.dashDist=Math.min(m+2.5,13);E.dashed=0;}break;
    case 'dash':{const sp=9.5;tvx=E.dvx*sp;tvz=E.dvz*sp;E.vx=tvx;E.vz=tvz;
      if(E.dashed>E.dashDist||E.st>1.6){E.state='recover';E.st=0;E.dashCd=Math.max(2.4,rand(4.5,7)*Math.pow(0.9,G.stage));G.frust=Math.min(0.999,G.frust+0.08);shake(0.35);}
      break;}
    case 'recover': if(E.st>0.8)E.state='chase';break;
    case 'stunned': tvx=-dx/dist*0.6;tvz=-dz/dist*0.6;if(E.st>1.5)E.state='chase';break;
    case 'stageup': if(E.st>1.4)E.state='chase';break;
    case 'grab': case 'win': break;
  }
  if(E.state!=='dash'){const k=E.state==='chase'?3.2:6;E.vx=lerp(E.vx,tvx,ease(k,dt));E.vz=lerp(E.vz,tvz,ease(k,dt));}
  if(G.mode==='play'||E.state==='intro'){
    const ox=E.x,oz=E.z;const np=world.collide(E.x+E.vx*dt,E.z+E.vz*dt,0.45,true);E.x=np[0];E.z=np[1];
    if(E.state==='dash'){const moved=Math.hypot(E.x-ox,E.z-oz);E.dashed+=moved;if(moved<9.5*dt*0.35)E.dashed=1e9;}
  }
  // ---- frustration
  if(playing&&['chase','recover','windup','dash'].includes(E.state)){
    G.frust+=dt/Math.max(8,12.5-G.stage*0.5);
    if(dist<4)G.frust+=dt*0.03;
    if(G.frust>=1)stageUp();
  }
  // ---- capture
  if(playing&&P.inv<=0&&['chase','dash','recover','windup','intro'].includes(E.state)&&dist<reach())startGrab();
  // ---- grab
  if(G.mode==='grab'){
    grab.t+=dt;grab.e-=dt*(0.14+0.018*G.stage);
    grab.squeezeT-=dt;
    if(grab.squeezeT<=0){grab.squeezeT=rand(0.8,1.2);grab.e-=0.04;Sfx.squeeze();addText('ぎゅっ',{x:CW/2+rand(-0.3,0.3)*CW,y:CH*rand(0.25,0.45),size:26,col:'#ffc0d0',stroke:'#600'});shake(0.22);}
    if(grab.e<=0||grab.t>=grab.limit){grab.e=Math.max(0,grab.e);gameOverSeq();}
  }
  if(G.mode==='caught'){G.fade=clamp((E.st-1.0)/1.2,0,1);if(E.st>2.3&&!G.overShown){G.overShown=true;showOver();}}
  else G.overShown=false;
  // ---- mood
  let mood='calm';
  if(E.state==='grab'||E.state==='win')mood='glee';
  else if(E.state==='stunned')mood='shock';
  else if(E.state==='stageup'||E.state==='windup'||E.state==='dash'||G.frust>0.62)mood='angry';
  else if(dist<8&&E.los)mood='eager';
  if(mood==='eager'&&!E.eager)H.startChant(3);
  E.eager=mood==='eager';E.mood=mood;
  const speedE=Math.hypot(E.vx,E.vz);
  // rig expects "world units" of the 2D game (~69 per metre) for speed/vx
  const rel=relVx();
  H.update(dt,{speed:(E.state==='grab'||E.state==='win')?0:speedE*69,vx:rel*69,mood:mood,state:E.state,grab:E.state==='grab'||E.state==='win',frust:G.frust});
  Sfx.setTension(clamp(1-dist/14,0,1)*0.8+(G.mode==='grab'?0.4:0)+(E.state==='windup'?0.3:0));Sfx.tick();
  updateParts(dt);
  G.shake=Math.max(0,G.shake-dt*1.6);G.flash=Math.max(0,G.flash-dt*1.6);
}
function relVx(){ // her sideways velocity as seen from the camera (for skirt/belly sway direction)
  const cx=camS.x-E.x,cz=camS.z-E.z,m=Math.hypot(cx,cz)||1;const rx=cz/m,rz=-cx/m;return E.vx*rx+E.vz*rz;
}
function warpCloser(){
  const D=world.flow(P.x,P.z),N=World.N,C=World.CELL,c=[];
  for(let k=0;k<N*N;k++){if(D[k]<11||D[k]>15)continue;const x=(k%N+0.5)*C,z=(Math.floor(k/N)+0.5)*C;if(!world.los(x,z,P.x,P.z))c.push([x,z]);}
  if(!c.length)return;const p=c[Math.floor(Math.random()*c.length)];E.x=p[0];E.z=p[1];E.vx=E.vz=0;H.startChant(2);
}
function updateParts(dt){
  for(const p of parts){p.t+=dt;
    if(p.k==='spark'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=0.9;p.vy=p.vy*0.9+500*DPR*dt;}
    else if(p.k==='text'){p.vy+=p.grav*dt;p.vx*=0.98;if(p.w){p.ox+=p.vx*dt;p.oy+=p.vy*dt;}else{p.x+=p.vx*dt;p.y+=p.vy*dt;}}}
  for(let i=parts.length-1;i>=0;i--)if(parts[i].t>parts[i].life)parts.splice(i,1);
}

// ---------------------------------------------------------------- title scene
let titleSpot=null;
function setupTitleScene(){
  if(!titleSpot){placeStart();titleSpot={px:P.x,pz:P.z};
    // put her ~9 m in front along a street with line of sight
    let best=null;for(let a=0;a<64;a++){const ang=a/64*Math.PI*2;for(const r of [9,8,7,10]){const x=P.x+Math.sin(ang)*r,z=P.z+Math.cos(ang)*r;if(world.walkable(x,z)&&world.los(P.x,P.z,x,z)){best=[x,z];break;}}if(best)break;}
    titleSpot.ex=best?best[0]:P.x+6;titleSpot.ez=best?best[1]:P.z;}
  P.x=titleSpot.px;P.z=titleSpot.pz;E.x=titleSpot.ex;E.z=titleSpot.ez;E.vx=E.vz=0;E.state='chase';E.mood='calm';
  H.reset();H.setGrowth(1.22);H.b.g=1.22;wireRig();G.stage=0;G.frust=0;G.fade=0;
  P.yaw=Math.atan2(-(E.x-P.x),-(E.z-P.z));P.pitch=0.32;camS.blend=0;
}
function updateTitleScene(dt){
  const sway=Math.sin(G.t*0.17)*0.18;
  P.yaw=Math.atan2(-(E.x-P.x),-(E.z-P.z))+sway+0.22;P.pitch=0.3+Math.sin(G.t*0.23)*0.06;P.bob=0;P.roll=0;
  H.update(dt,{speed:0,vx:0,mood:'calm',state:'chase',grab:false,frust:0});
  if(Math.floor(G.t/7)!==Math.floor((G.t-dt)/7))H.startChant(3);
}

// ---------------------------------------------------------------- camera & render
function updateCamera(dt){
  const grabbing=G.mode==='grab'||G.mode==='caught';
  camS.blend=lerp(camS.blend,grabbing?1:0,ease(grabbing?5:4,dt));
  const b=camS.blend;
  let x=P.x,y=EYE+P.bob,z=P.z,yaw=P.yaw,pitch=P.pitch;
  if(b>0.001){
    let dx=P.x-E.x,dz=P.z-E.z;const m=Math.hypot(dx,dz)||1;dx/=m;dz/=m;
    const bc=H3.bellyCenterWorld(new T.Vector3());
    let d=H3.bellyHalfWM()*0.95+0.5;
    if(G.mode==='caught')d*=1-0.62*clamp(E.st/1.8,0,1);
    // keep the hugged camera out of walls: shorten the distance (and swing sideways) if needed
    let best=null;
    for(const sw of [0,0.35,-0.35,0.7,-0.7,1.1,-1.1]){const c=Math.cos(sw),s=Math.sin(sw),ux=dx*c-dz*s,uz=dx*s+dz*c;
      let ok=d;for(let t=0.3;t<=d+0.35;t+=0.15){const qx=E.x+ux*t,qz=E.z+uz*t,cq=world.collide(qx,qz,0.22,false);if(!world.walkable(qx,qz)||Math.abs(cq[0]-qx)+Math.abs(cq[1]-qz)>0.01){ok=Math.max(0.3,t-0.4);break;}}
      if(ok>=d*0.8||!best||ok>best[2]){best=[ux,uz,ok];if(ok>=d*0.8)break;}}
    dx=best[0];dz=best[1];d=Math.min(d,best[2]);
    const gx=E.x+dx*d,gz=E.z+dz*d,gy=Math.max(EYE,bc.y*0.92);
    const aimY=bc.y+H3.bellyHalfWM()*0.28;
    const gyaw=Math.atan2(dx,dz),gpitch=Math.atan2(aimY-gy,d);
    grab.yaw=gyaw;grab.pitch=gpitch;
    x=lerp(x,gx,b);y=lerp(y,gy,b);z=lerp(z,gz,b);yaw=P.yaw+angDiff(P.yaw,gyaw)*b;pitch=lerp(pitch,gpitch,b);
    if(G.mode==='grab'){const sq=Math.max(0,Math.sin(G.t*7.5));y+=sq*0.02;}
  }
  camS.x=x;camS.y=y;camS.z=z;camS.yaw=yaw;camS.pitch=pitch;
  const sh=G.shake*0.12;
  camera.position.set(x+rand(-1,1)*sh,y+rand(-1,1)*sh,z+rand(-1,1)*sh);
  camera.rotation.set(pitch+rand(-1,1)*sh*0.15,yaw,P.roll+rand(-1,1)*sh*0.2,'YXZ');
  camera.updateMatrixWorld();
  const f=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  Sfx.setListener(x,y,z,f.x,f.y,f.z);
}
const baseTint=[0.9,0.92,1.0];
function render(dt){
  updateCamera(dt);
  // place her and update the rig mesh
  H3.place(E.x,E.z,camS.x,camS.z);
  const toCam=[camS.x-E.x,camS.z-E.z],m=Math.hypot(toCam[0],toCam[1])||1;
  const l=world.lightAt(E.x,1.6,E.z,toCam[0]/m,0,toCam[1]/m,true);const lum=(l[0]+l[1]+l[2])/3;
  const k=clamp(0.62+lum*1.1,0.66,1.18)+0.16*camS.blend;
  if(world.wireMeshes){const wv=camS.blend<0.5;if(world.wireMeshes[0].visible!==wv)for(const l of world.wireMeshes)l.visible=wv;}H3.tintU.value.set(baseTint[0]*k,baseTint[1]*k,baseTint[2]*k*1.02);
  H3.update({});
  Sfx.setHer(E.x,2.2,E.z);
  // dash telegraph on the ground
  if(E.state==='windup'){
    const ex=E.tx-E.x,ez=E.tz-E.z,len=Math.hypot(ex,ez)+2.5;telegraph.visible=true;
    telegraph.position.set(E.x+ex/(len-2.5||1)*len/2,0.05,E.z+ez/(len-2.5||1)*len/2);telegraph.rotation.set(-Math.PI/2,0,Math.atan2(ex,ez));
    telegraph.scale.set(H3.bellyHalfWM()*1.4,len,1);telegraph.material.opacity=0.35+0.3*Math.sin(G.t*30);
  }else telegraph.visible=false;
  renderer.setScissorTest(false);
  renderer.render(scene,camera);
  drawPortrait();
}
let portraitRect=null;
const portraitClear=new T.Color();
function drawPortrait(){
  if(G.mode==='title'||G.mode==='over'||window.__noPortrait)return;
  if(!portraitRect||G.t%1<0.02){const r=$('portrait').getBoundingClientRect();portraitRect={x:r.left,y:VHc-r.bottom,w:r.width,h:r.height};}
  const r=portraitRect;if(!r.w)return;
  const mad=E.mood==='angry';
  const u=H.uScale(),face=H3.upperToWorld(607,135,new T.Vector3());
  const th=H3.group.rotation.y;
  pcam.position.set(face.x+Math.sin(th)*3,face.y,face.z+Math.cos(th)*3);pcam.lookAt(face);
  const hh=118*u*Hachi3D.S*0.62,asp=r.w/r.h;pcam.left=-hh*asp;pcam.right=hh*asp;pcam.top=hh;pcam.bottom=-hh;pcam.updateProjectionMatrix();pcam.updateMatrixWorld();
  const fogSave=H3.fogU.value;H3.fogU.value=0;const ts=H3.tintU.value.clone();H3.tintU.value.set(1,1,1);
  renderer.setScissorTest(true);renderer.setScissor(r.x+2,r.y+2,r.w-4,r.h-4);renderer.setViewport(r.x+2,r.y+2,r.w-4,r.h-4);
  portraitClear.setRGB(mad?0.2:0.05,mad?0.02:0.06,mad?0.05:0.14);renderer.setClearColor(portraitClear,1);renderer.clear(true,true,false);
  renderer.render(H3.group,pcam);
  renderer.setClearColor(0x000000,1);renderer.setScissorTest(false);renderer.setViewport(0,0,VWc,VHc);
  H3.fogU.value=fogSave;H3.tintU.value.copy(ts);
}
function drawVein(ctx,x,y,s,a){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=a;ctx.strokeStyle='#ff2340';ctx.lineWidth=5;ctx.lineCap='round';
  ctx.shadowColor='#ff0030';ctx.shadowBlur=10;
  for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2+0.785);ctx.beginPath();ctx.moveTo(6,-9);ctx.quadraticCurveTo(4,-4,9,-3);ctx.stroke();ctx.restore();}
  ctx.restore();
}
function pxPerMeterAt(w){const d=w.clone().applyMatrix4(camera.matrixWorldInverse);const depth=-d.z;if(depth<=0.05)return 0;return CH/(2*Math.tan(camera.fov*Math.PI/360)*depth);}
let lastTense=-1,lastFlash=-1;
function renderFx(){
  const c=fx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,CW,CH);
  if(G.mode==='title')return;
  const visible=world.los(camS.x,camS.z,E.x,E.z);
  // eye glow & anger veins
  if(visible&&H.eyeGlow>0.02&&E.mood!=='glee'&&E.mood!=='shock'){
    c.globalCompositeOperation='lighter';
    for(const ex of [[578.5,125],[619,119.5]]){const w=H3.upperToWorld(ex[0],ex[1]);const s=project(w);if(!s)continue;const ppm=pxPerMeterAt(w);
      const r=Math.max(3*DPR,0.035*ppm)*(0.85+0.15*Math.sin(G.t*9));const g=c.createRadialGradient(s[0],s[1],0,s[0],s[1],r);g.addColorStop(0,`rgba(255,40,40,${0.85*H.eyeGlow})`);g.addColorStop(1,'rgba(255,0,0,0)');c.fillStyle=g;c.fillRect(s[0]-r,s[1]-r,r*2,r*2);}
    c.globalCompositeOperation='source-over';
  }
  if(visible&&(H.anger>0.3||E.mood==='angry')&&E.mood!=='glee'&&E.mood!=='shock'){
    const w=H3.upperToWorld(735,110),s=project(w);if(s){const ppm=pxPerMeterAt(w);const kk=Math.max(H.anger,E.mood==='angry'?1:0);drawVein(c,s[0],s[1],Math.max(0.4*DPR,ppm*0.006)*(1+0.12*Math.sin(G.t*12)),clamp(kk,0,1));}
  }
  // dash warning
  if(E.state==='windup'){
    const w=H3.upperToWorld(607,10),s=project(w);
    if(s){c.font=`900 ${Math.round(64*DPR)}px sans-serif`;c.textAlign='center';c.fillStyle='#ff2848';c.strokeStyle='#fff';c.lineWidth=5*DPR;c.strokeText('！',s[0],s[1]-10*DPR);c.fillText('！',s[0],s[1]-10*DPR);}
    c.font=`900 ${Math.round(22*DPR)}px sans-serif`;c.textAlign='center';c.fillStyle=`rgba(255,60,80,${0.6+0.4*Math.sin(G.t*25)})`;c.strokeStyle='#000';c.lineWidth=4*DPR;
    c.strokeText('突進が来る！ 横へよけろ！',CW/2,CH*0.78);c.fillText('突進が来る！ 横へよけろ！',CW/2,CH*0.78);
  }
  // off-screen indicator
  if(G.mode==='play'){
    const head=new T.Vector3(E.x,Math.min(2.2,H3.heightM()*0.6),E.z);
    const v=head.clone().applyMatrix4(camera.matrixWorldInverse);
    const ndc=head.clone().project(camera);
    const onScreen=v.z<0&&Math.abs(ndc.x)<0.95&&Math.abs(ndc.y)<1.0;
    if(!onScreen){
      let ax=v.x,ay=-v.y;if(v.z>0){ax=v.x;ay=Math.abs(ay)*0.2;} // behind: point sideways
      const a=Math.atan2(ay,ax);const m=50*DPR,cx=CW/2,cy=CH/2;
      const sx=Math.cos(a),sy=Math.sin(a);const tt=Math.min((CW/2-m)/Math.abs(sx||1e-3),(CH/2-m)/Math.abs(sy||1e-3));
      const x=cx+sx*tt,y=cy+sy*tt,pul=0.6+0.4*Math.sin(G.t*8);
      const dm=Math.round(Math.hypot(E.x-P.x,E.z-P.z));
      c.save();c.translate(x,y);c.globalAlpha=pul*(dm<25?1:0.6);c.rotate(a);c.fillStyle='#ff2848';c.beginPath();c.moveTo(22*DPR,0);c.lineTo(-10*DPR,-16*DPR);c.lineTo(-10*DPR,16*DPR);c.closePath();c.fill();c.restore();
      c.save();c.globalAlpha=1;c.font=`900 ${Math.round(13*DPR)}px sans-serif`;c.textAlign='center';c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=3*DPR;
      const tx=clamp(x-sx*40*DPR,40*DPR,CW-40*DPR),ty=clamp(y-sy*34*DPR,30*DPR,CH-20*DPR);c.strokeText(`八尺様 ${dm}m`,tx,ty);c.fillText(`八尺様 ${dm}m`,tx,ty);c.restore();
    }
  }
  // particles
  for(const p of parts){
    const k=p.t/p.life;
    if(p.k==='text'){
      let x=p.x,y=p.y;if(p.w){const s=project(p.w);if(!s)continue;x=s[0]+p.ox;y=s[1]+p.oy;}
      const sc=k<0.15?0.6+k/0.15*0.5:1.1-0.1*k;c.save();c.translate(x,y);c.rotate(p.rot);c.scale(sc,sc);c.globalAlpha=k>0.7?(1-k)/0.3:1;
      c.font=`900 ${Math.round(p.size)}px "Hiragino Sans","Yu Gothic","Noto Sans JP","Noto Sans CJK JP",sans-serif`;c.textAlign='center';c.textBaseline='middle';
      c.lineJoin='round';c.strokeStyle=p.stroke;c.lineWidth=p.size*0.22;c.strokeText(p.txt,0,0);c.fillStyle=p.col;c.fillText(p.txt,0,0);c.restore();
    }else if(p.k==='spark'){c.globalAlpha=1-k;c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,p.size*(1-k*0.5),0,7);c.fill();}
    else if(p.k==='ring'){c.globalAlpha=(1-k)*0.8;c.strokeStyle=`rgba(${p.col},1)`;c.lineWidth=(1-k)*8*DPR;c.beginPath();c.arc(p.x,p.y,p.r*(0.3+k),0,7);c.stroke();}
  }
  c.globalAlpha=1;
  // overlays (DOM, cheap)
  const dist=Math.hypot(E.x-P.x,E.z-P.z);
  const tense=clamp(G.frust*1.2-0.4,0,1)*0.45+(E.state==='windup'?0.45:0)+(G.mode==='grab'?0.35:0)+clamp(1-dist/10,0,1)*0.35;
  const tv=Math.round(clamp(tense,0,1)*(0.8+0.2*Math.sin(G.t*6))*100)/100;if(tv!==lastTense){$('tense').style.opacity=tv;lastTense=tv;}
  const fl=G.mode==='caught'?Math.max(G.fade,G.flash*0.45):G.flash*0.45;const fv=Math.round(fl*100)/100;
  if(fv!==lastFlash){const f=$('flash');f.style.opacity=fv;f.style.background=G.mode==='caught'?'#ffd6e4':`rgb(${G.flashCol})`;lastFlash=fv;}
}
// ---------------------------------------------------------------- minimap
function drawMinimap(){
  if(G.mode==='title'||G.mode==='over')return;
  const S=cMM.width,c=mmx,r=S/2,mm=world.minimap,zoom=S/58; // 58 m across
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,S,S);
  c.save();c.beginPath();c.arc(r,r,r-1,0,7);c.clip();
  c.fillStyle='#0d0f19';c.fillRect(0,0,S,S);
  const cs=Math.cos(P.yaw),sn=Math.sin(P.yaw);
  c.setTransform(cs*zoom,sn*zoom,-sn*zoom,cs*zoom,r,r);
  c.globalAlpha=0.92;c.imageSmoothingEnabled=false;
  c.drawImage(mm.canvas,-P.x,-P.z,World.SIZE,World.SIZE);
  c.globalAlpha=1;
  c.setTransform(1,0,0,1,0,0);
  // her
  const dx=E.x-P.x,dz=E.z-P.z;let sx=(cs*dx-sn*dz)*zoom,sy=(sn*dx+cs*dz)*zoom;const d=Math.hypot(sx,sy),lim=r-9*DPR;
  const pul=0.65+0.35*Math.sin(G.t*7);
  if(d>lim){sx*=lim/d;sy*=lim/d;}
  c.fillStyle=`rgba(255,40,72,${pul})`;c.beginPath();c.arc(r+sx,r+sy,(d>lim?5:6.5)*DPR*(1+H3.bellyHalfWM()*0.06),0,7);c.fill();
  c.strokeStyle='#fff';c.lineWidth=1.5*DPR;c.stroke();
  // reach circle
  if(d<=lim){c.strokeStyle='rgba(255,60,90,0.35)';c.beginPath();c.arc(r+sx,r+sy,reach()*zoom,0,7);c.stroke();}
  // me (arrow up = facing)
  c.fillStyle='#ffe14d';c.beginPath();c.moveTo(r,r-8*DPR);c.lineTo(r+5.5*DPR,r+6*DPR);c.lineTo(r,r+3*DPR);c.lineTo(r-5.5*DPR,r+6*DPR);c.closePath();c.fill();
  c.restore();
  c.strokeStyle='rgba(255,255,255,0.6)';c.lineWidth=2*DPR;c.beginPath();c.arc(r,r,r-1.5*DPR,0,7);c.stroke();
  c.fillStyle='rgba(255,255,255,0.7)';c.font=`900 ${Math.round(10*DPR)}px sans-serif`;c.textAlign='center';
  c.textBaseline='middle';c.fillText('北',r+sn*(r-9*DPR),r-cs*(r-9*DPR));c.textBaseline='alphabetic';
}
// ---------------------------------------------------------------- HUD
let hudT=0;const moodTxt={calm:'にこにこ',eager:'ぽぽぽ…♪',angry:'イライラ',glee:'つかまえた♪',shock:'びっくり!?'};
function updateHud(dt){
  hudT-=dt;if(hudT>0)return;hudT=0.05;
  if(G.mode==='play'||G.mode==='grab'||G.mode==='caught'){
    $('time').innerHTML=G.time.toFixed(1)+'<small>秒</small>';
    $('best').textContent='ベスト '+Math.max(G.best,0).toFixed(1)+'秒';
    $('frust').style.width=(G.frust*100).toFixed(1)+'%';
    $('lv').textContent='Lv.'+G.stage;$('bsize').textContent='×'+H.b.g.toFixed(2);
    const pm=$('portrait');pm.classList.toggle('mad',E.mood==='angry');$('moodTxt').textContent=moodTxt[E.mood]||'';
    $('dist').textContent=Math.round(Math.hypot(E.x-P.x,E.z-P.z))+'m';
    if(G.mode==='grab'){$('gfill').style.width=(clamp(grab.e,0,1)*100)+'%';$('gtime').style.width=(clamp(1-grab.t/grab.limit,0,1)*100)+'%';}
  }
}

// ---------------------------------------------------------------- main loop
let last=0,perfAcc=0,perfN=0,perfT=0;
function frame(ts){
  const t=ts/1000;let dt=last?t-last:0.016;last=t;dt=Math.min(dt,0.05);
  const t0=performance.now();
  try{update(dt);render(dt);renderFx();drawMinimap();updateHud(dt);}catch(e){showErr(e);return;}
  window.__ft=(window.__ft||0)*0.95+(performance.now()-t0)*0.05;
  // adaptive resolution for slow phones
  perfAcc+=dt;perfN++;perfT+=dt;
  if(perfT>2.5){const avg=perfAcc/perfN;if(avg>1/36&&PR>0.75){PR=Math.max(0.75,PR-0.2);renderer.setPixelRatio(PR);renderer.setSize(VWc,VHc,false);}perfAcc=0;perfN=0;perfT=0;}
  requestAnimationFrame(frame);
}
window.__game={update:(dt)=>update(dt),G:G,P:P,E:E,grab:grab,start:()=>startGame(),hit:(x,y)=>hitBelly(x==null?null:[x,y]),stageUp:()=>stageUp(),keys:keys,
  setStage:(n)=>{G.stage=n;H.setGrowth(growthFor(n));H.b.g=growthFor(n);},H:()=>H,world:()=>world,
  look:(yaw,pitch)=>{P.yaw=yaw;P.pitch=pitch;},faceHer:()=>{P.yaw=Math.atan2(-(E.x-P.x),-(E.z-P.z));},
  putHer:(d)=>{const a=P.yaw;E.x=P.x-Math.sin(a)*d;E.z=P.z-Math.cos(a)*d;},pr:()=>PR,sticks:sticks,H3:()=>H3,cam:()=>camera,renderNow:()=>{render(0.016);renderFx();}};

// ---------------------------------------------------------------- boot
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('画像の読み込みに失敗'));i.src=src;});}
function wireRig(){
  H.onSyllable=()=>{
    const angry=E.mood==='angry'||E.state==='stageup';
    Sfx.po(rand(0.94,1.06)*(angry?1.08:1),angry,1,true);
    if(G.mode==='title')return;
    addText('ぽ',{w:H3.upperToWorld(603,150),size:angry?34:26,col:angry?'#ff8899':'#fff',stroke:angry?'#500':'#223',vx:rand(-90,90)*DPR,vy:-110*DPR,grav:-10*DPR,life:1.1});
  };
  H.onStep=(side,amt)=>{
    if(G.mode==='title')return;
    const d=Math.hypot(P.x-E.x,P.z-E.z);
    Sfx.step((E.state==='dash'?1.4:1)*(1+G.stage*0.05),true);
    const near=clamp(1-d/18,0,1);
    if(near>0)shake((E.state==='dash'?0.5:0.12+G.stage*0.03)*near);
  };
}
async function boot(){
  $('titleArt').style.backgroundImage=`url(${ASSETS.img.key})`;
  updateTitleBest();
  const imgs={};for(const k of ['upper','belly','skirt','legL','legR','faces'])imgs[k]=await loadImg(ASSETS.img[k]);
  renderer=new T.WebGLRenderer({canvas:cGl,antialias:!isTouch,powerPreference:'high-performance',stencil:false});
  renderer.outputColorSpace=T.LinearSRGBColorSpace;
  PR=Math.min(window.devicePixelRatio||1,isTouch?1.5:2);renderer.setPixelRatio(PR);
  renderer.setClearColor(0x000000,1);
  cGl.addEventListener('webglcontextlost',(e)=>{e.preventDefault();showErr('描画が中断されました。ページを再読み込みしてください。');});
  camera=new T.PerspectiveCamera(70,1,0.05,170);
  pcam=new T.OrthographicCamera(-1,1,1,-1,0.1,10);
  resize();
  scene=new T.Scene();
  world=new World(renderer);scene.add(world.scene);
  H=new Hachi({texture:(img)=>img},imgs,ASSETS.meta);
  H3=new Hachi3D(H,imgs,World.FOG_COLOR,World.FOG_DENS);
  scene.add(H3.group);scene.add(H3.shadow);
  telegraph=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0xff2040,transparent:true,opacity:0.5,depthWrite:false,blending:T.AdditiveBlending}));
  telegraph.renderOrder=4;telegraph.visible=false;scene.add(telegraph);
  wireRig();
  setupTitleScene();
  // warm up (compile shaders)
  update(0.016);render(0.016);
  $('loading').classList.add('hidden');
  $('hint').textContent=isTouch?'左スティック：移動　右スティック：視点（上を見上げられます）':'WASD／矢印：移動　マウス：視点（クリックで視点ロック・Escで解除）';
  $('bStart').onclick=startGame;
  $('bHow').onclick=()=>{Sfx.resume();Sfx.click();$('how').classList.remove('hidden');};
  $('bHowClose').onclick=()=>{Sfx.click();$('how').classList.add('hidden');};
  $('bPause').onclick=()=>{Sfx.click();togglePause();};
  $('bResume').onclick=()=>{togglePause();Sfx.click();};
  $('bQuit').onclick=()=>{toTitle();};
  $('bRetry').onclick=()=>{startGame();};
  $('bTitle').onclick=()=>{Sfx.click();toTitle();};
  $('bMute').onclick=()=>{Sfx.resume();Sfx.setMuted(!Sfx.muted);$('bMute').textContent=Sfx.muted?'🔇':'🔊';};
  requestAnimationFrame(frame);
  window.__ready=true;
}
boot().catch(showErr);
})();
