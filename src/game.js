// 八尺様から逃げろ！ main game
(function(){
'use strict';
const $=(id)=>document.getElementById(id);
const clamp=(x,a,b)=>x<a?a:x>b?b:x,lerp=(a,b,t)=>a+(b-a)*t,rand=(a,b)=>a+Math.random()*(b-a);
const ease=(k,dt)=>1-Math.exp(-k*dt);
const BEST_KEY='hachishaku_best_v1';
const cBg=$('bg'),cGl=$('gl'),cFx=$('fx');
const bg=cBg.getContext('2d'),fx=cFx.getContext('2d');
let R,H,stage,kid,kidTex,shadowTex,glowTex;
let DPR=1,CW=0,CH=0,PX=1,VW=1280;
const W=World.W,D=World.D;

function showErr(e){const el=$('err');el.textContent='エラー: '+(e&&e.message||e);el.classList.remove('hidden');console.error(e);}
window.addEventListener('error',(e)=>showErr(e.error||e.message));

function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  const w=window.innerWidth,h=window.innerHeight;
  CW=Math.round(w*DPR);CH=Math.round(h*DPR);
  for(const c of [cBg,cGl,cFx]){c.width=CW;c.height=CH;}
  PX=CH/720;VW=CW/PX;
}
window.addEventListener('resize',resize);

// ---------------------------------------------------------------- game state
const G={mode:'title',t:0,time:0,best:0,stage:0,frust:0,escapes:0,shake:0,flash:0,flashCol:'255,40,60',paused:false};
const P={x:0,z:0,vx:0,vz:0,face:1,anim:0,inv:0,knock:0,kx:0,kz:0};
const E={x:0,z:0,vx:0,vz:0,state:'chase',st:0,dashCd:6,tx:0,tz:0,chantCd:3,mood:'calm',ghosts:[],ghostT:0,eager:false};
const grab={e:0,t:0,limit:5.5,squeezeT:0,hits:0};
const cam={camX:W/2,zoom:1,F:{x:0,y:700},C:{x:0,y:700},VW:1280,px:1,blend:0,shx:0,shy:0};
const parts=[];
try{G.best=parseFloat(localStorage.getItem(BEST_KEY))||0;}catch(e){}

function bellyHalfW(){return H.bellyHalfW()*Hachi.K*0.9;}
function bellyHalfD(){return Math.max(52,bellyHalfW()*0.42);}
function growthFor(stage){return 1+0.22*stage;}

// ---------------------------------------------------------------- projection
function viewPt(x,z,h){const s=World.s(z);return [cam.VW/2+(x-cam.camX)*s,World.y(z)-(h||0)*s,s];}
function toScreen(vx,vy){return [((vx-cam.F.x)*cam.zoom+cam.C.x+cam.shx)*PX,((vy-cam.F.y)*cam.zoom+cam.C.y+cam.shy)*PX];}
function proj(x,z,h){const v=viewPt(x,z,h);const s=toScreen(v[0],v[1]);return [s[0],s[1],v[2]*cam.zoom*PX];}
function herView(){const p=proj(E.x,E.z,0);return {x:p[0],y:p[1],ppu:p[2]};}

// ---------------------------------------------------------------- input
const keys={};let joy={on:false,id:null,x0:0,y0:0,dx:0,dy:0};
const joyEl=$('joy'),knob=$('knob');
window.addEventListener('keydown',(e)=>{
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(G.mode==='grab'&&(e.code==='Space'||e.code==='Enter'||e.code==='KeyZ'||e.code==='KeyX')&&!e.repeat)hitBelly(null);
  if((e.code==='Escape'||e.code==='KeyP')&&(G.mode==='play'||G.mode==='grab'))togglePause();
  if(G.mode==='title'&&(e.code==='Enter'||e.code==='Space')&&$('how').classList.contains('hidden'))startGame();
  else if(G.mode==='over'&&(e.code==='Enter'||e.code==='Space')&&G.overReady)startGame();
});
window.addEventListener('keyup',(e)=>{keys[e.code]=false;});
const app=$('app');
app.addEventListener('pointerdown',(e)=>{
  if(e.target.closest('button,.card'))return;
  Sfx.resume();
  if(G.paused)return;
  if(G.mode==='grab'){hitBelly([e.clientX*DPR,e.clientY*DPR]);return;}
  if(G.mode==='play'&&!joy.on){
    joy={on:true,id:e.pointerId,x0:e.clientX,y0:e.clientY,dx:0,dy:0};
    joyEl.style.left=e.clientX+'px';joyEl.style.top=e.clientY+'px';joyEl.classList.remove('hidden');knob.style.transform='';
    try{app.setPointerCapture(e.pointerId);}catch(_){}
  }
});
app.addEventListener('pointermove',(e)=>{
  if(!joy.on||e.pointerId!==joy.id)return;
  let dx=e.clientX-joy.x0,dy=e.clientY-joy.y0;const m=Math.hypot(dx,dy),R0=50;
  if(m>R0){ // floating joystick follows the finger
    joy.x0+=dx/m*(m-R0);joy.y0+=dy/m*(m-R0);dx=dx/m*R0;dy=dy/m*R0;
    joyEl.style.left=joy.x0+'px';joyEl.style.top=joy.y0+'px';
  }
  joy.dx=dx/R0;joy.dy=dy/R0;knob.style.transform=`translate(${dx}px,${dy}px)`;
});
const endJoy=(e)=>{if(joy.on&&e.pointerId===joy.id){joy.on=false;joy.dx=joy.dy=0;joyEl.classList.add('hidden');}};
app.addEventListener('pointerup',endJoy);app.addEventListener('pointercancel',endJoy);
app.addEventListener('contextmenu',(e)=>e.preventDefault());
function inputDir(){
  let x=0,y=0;
  if(keys.ArrowLeft||keys.KeyA)x-=1;if(keys.ArrowRight||keys.KeyD)x+=1;
  if(keys.ArrowUp||keys.KeyW)y-=1;if(keys.ArrowDown||keys.KeyS)y+=1;
  if(x||y){const m=Math.hypot(x,y);return [x/m,y/m];}
  if(joy.on){const m=Math.hypot(joy.dx,joy.dy);if(m<0.12)return [0,0];const k=Math.min(1,m)/m;return [joy.dx*k,joy.dy*k];}
  return [0,0];
}

// ---------------------------------------------------------------- particles / fx
function addText(x,y,txt,o){o=o||{};parts.push({k:'text',x:x,y:y,vx:o.vx||rand(-30,30)*DPR,vy:o.vy||-90*DPR,t:0,life:o.life||1.0,txt:txt,size:(o.size||26)*DPR,col:o.col||'#fff',stroke:o.stroke||'#400',rot:o.rot||rand(-0.2,0.2),grav:o.grav==null?60*DPR:o.grav});}
function burst(x,y,n,col,spd){for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),v=rand(0.3,1)*(spd||380)*DPR;parts.push({k:'spark',x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,life:rand(0.3,0.6),size:rand(3,7)*DPR,col:col||'#fff'});}}
function ring(x,y,col,r){parts.push({k:'ring',x:x,y:y,t:0,life:0.45,r:(r||90)*DPR,col:col||'255,255,255'});}
function dust(x,y,s){for(let i=0;i<6;i++)parts.push({k:'dust',x:x+rand(-40,40)*s,y:y,vx:rand(-60,60)*s,vy:rand(-30,-5)*s,t:0,life:rand(0.5,0.9),size:rand(12,26)*s});}
function banner(main,sub){const b=$('banner');b.innerHTML=main+(sub?`<span class="s">${sub}</span>`:'');b.classList.remove('show');void b.offsetWidth;b.classList.add('show');}
function shake(a){G.shake=Math.max(G.shake,a);}

// ---------------------------------------------------------------- flow
function resetRun(){
  G.time=0;G.stage=0;G.frust=0;G.escapes=0;G.shake=0;G.flash=0;G.overReady=false;
  Object.assign(P,{x:W/2-380,z:D*0.35,vx:0,vz:0,face:1,anim:0,inv:1.2,knock:0});
  Object.assign(E,{x:W/2+420,z:D*0.75,vx:0,vz:0,state:'intro',st:0,dashCd:5,chantCd:2,ghosts:[],eager:false,mood:'calm'});
  H.reset();H.setGrowth(1);H.b.g=1;
  cam.camX=W/2;cam.blend=0;parts.length=0;
}
function startGame(){
  Sfx.resume();Sfx.click();Sfx.startAmbient();
  $('title').classList.add('hidden');$('over').classList.add('hidden');$('how').classList.add('hidden');
  $('hud').classList.remove('hidden');$('grab').classList.add('hidden');
  resetRun();G.mode='play';G.paused=false;
  banner('ぽ…ぽぽぽ…','八尺様が現れた！ 逃げろ！');
  setTimeout(()=>{H.startChant(3);},400);
  $('hint').style.opacity='0.75';setTimeout(()=>{$('hint').style.opacity='0';},6000);
}
function toTitle(){
  G.mode='title';G.paused=false;$('pause').classList.add('hidden');$('over').classList.add('hidden');$('hud').classList.add('hidden');$('grab').classList.add('hidden');
  $('title').classList.remove('hidden');updateTitleBest();
}
function togglePause(){
  G.paused=!G.paused;$('pause').classList.toggle('hidden',!G.paused);
  if(Sfx.ctx){if(G.paused)Sfx.ctx.suspend();else Sfx.ctx.resume();}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(G.mode==='play'||G.mode==='grab')&&!G.paused)togglePause();});
function updateTitleBest(){$('tBest').textContent=G.best>0?`ベスト記録：${G.best.toFixed(1)}秒`:'';}

function startGrab(){
  G.mode='grab';E.state='grab';E.st=0;
  grab.e=0.38;grab.t=0;grab.limit=Math.max(3.6,5.6-G.stage*0.12);grab.squeezeT=0.8;grab.hits=0;
  joy.on=false;joyEl.classList.add('hidden');
  $('grab').classList.remove('hidden');$('hint').style.opacity='0';
  Sfx.grab();shake(10);G.flash=0.5;G.flashCol='255,30,60';
  const v=herView();addText(v.x,v.y-200*DPR,'つかまえた♪',{size:40,col:'#ffd0e0',stroke:'#600',vy:-60*DPR,life:1.4,grav:0});
  H.startChant(4);
}
function hitBelly(pt){
  if(G.mode!=='grab'||G.paused)return;
  const view=herView();
  let bx,by,sx,sy;
  if(pt){const b=H.screenToBelly(view,pt[0],pt[1]);if(b.inside){bx=b.x;by=b.y;sx=pt[0];sy=pt[1];}}
  if(bx===undefined){bx=610+rand(-300,300);by=850+rand(-200,250);const sc=view.ppu*Hachi.K;sx=view.x+(610+(bx-610)*H.b.g-683)*sc;sy=view.y+(445+(by-445)*H.b.g-H.lift-1895)*sc;}
  H.hit(bx,by,1);
  grab.e+=0.1/(1+0.04*G.stage);grab.hits++;
  Sfx.slap(1);shake(4);
  burst(sx,sy,8,'#fff6c8',420);ring(sx,sy,'255,240,200',70);
  const words=['ぺちっ','ぼよん','ぽよん♪','ばいん','ぺしっ','ぷるん'];
  addText(sx+rand(-30,30)*DPR,sy-20*DPR,words[Math.floor(Math.random()*words.length)],{size:rand(22,32),col:'#fff',stroke:'#b0205a',vy:-160*DPR});
  if(navigator.vibrate)try{navigator.vibrate(12);}catch(_){}
  if(grab.e>=1)escapeGrab();
}
function escapeGrab(){
  G.mode='play';E.state='stunned';E.st=0;
  $('grab').classList.add('hidden');
  G.escapes++;G.frust=Math.min(0.999,G.frust+0.22);
  Sfx.escape();Sfx.whoosh();shake(12);
  // knock player away
  let dx=P.x-E.x;if(Math.abs(dx)<1)dx=(P.x<W/2?1:-1);
  const dir=Math.sign(dx)||1;P.knock=0.55;P.kx=dir*720;P.kz=(P.z<D/2?1:-1)*140;P.z=E.z-bellyHalfD()-30;P.z=clamp(P.z,8,D-8);
  P.inv=1.8;
  const v=herView();banner('脱出成功！','八尺様はさらにイライラ…');
  addText(v.x,v.y-260*DPR,'えっ…!?',{size:36,col:'#cfe0ff',stroke:'#123',life:1.2,grav:0,vy:-40*DPR});
  burst(v.x,v.y-150*DPR,26,'#bfe6ff',700);
  H.hit(610,900,1.6);
}
function gameOverSeq(){
  G.mode='caught';E.state='win';E.st=0;$('grab').classList.add('hidden');
  Sfx.gameOver();H.startChant(6);
  const v=herView();addText(v.x,v.y-230*DPR,'ぎゅ〜〜っ',{size:44,col:'#ffd0e0',stroke:'#600',life:1.8,grav:0,vy:-30*DPR});
}
function showOver(){
  G.mode='over';
  const t=G.time,isNew=t>G.best+1e-6;
  if(isNew){G.best=t;try{localStorage.setItem(BEST_KEY,String(t));}catch(e){}}
  $('oTime').textContent=t.toFixed(1)+'秒';$('oLv').textContent='Lv.'+G.stage;$('oEsc').textContent=G.escapes+'回';
  $('oSize').textContent='×'+H.b.gT.toFixed(2);
  $('oNew').classList.toggle('hidden',!isNew);$('oBest').textContent='ベスト記録：'+G.best.toFixed(1)+'秒';
  $('over').classList.remove('hidden');$('hud').classList.add('hidden');
  setTimeout(()=>{G.overReady=true;},600);
}
function stageUp(){
  G.stage++;G.frust=0;E.state='stageup';E.st=0;
  H.setGrowth(growthFor(G.stage));
  Sfx.stageUp();H.startChant(5);shake(16);G.flash=0.6;G.flashCol='255,30,60';
  banner(`イライラ Lv.${G.stage}！`,'お腹がさらに膨らんだ！');
  const v=herView();
  for(let i=0;i<3;i++)setTimeout(()=>{const vv=herView();addText(vv.x+rand(-120,120)*DPR,vv.y-rand(80,200)*DPR,['ぷくぅ〜','むぎぎ…','ぽぽぽ!!'][i],{size:30,col:'#ffb0c0',stroke:'#500',vy:-80*DPR});},i*250);
  ring(v.x,v.y-120*DPR,'255,60,90',260*DPR/DPR);
}

// ---------------------------------------------------------------- update
function update(dt){
  G.t+=dt;
  if(G.mode==='title'){updateTitleScene(dt);return;}
  if(G.paused)return;
  const playing=G.mode==='play';
  if(playing||G.mode==='grab')G.time+=dt;
  // ---- player
  if(playing){
    const d=inputDir(),spd=290;
    let tvx=d[0]*spd,tvz=-d[1]*spd*0.85;
    P.vx=lerp(P.vx,tvx,ease(14,dt));P.vz=lerp(P.vz,tvz,ease(14,dt));
    if(P.knock>0){P.knock-=dt;P.vx=P.kx*(P.knock/0.55)+P.vx*0.3;P.vz=P.kz*(P.knock/0.55);}
    P.x=clamp(P.x+P.vx*dt,30,W-30);P.z=clamp(P.z+P.vz*dt,6,D-6);
    if(Math.abs(P.vx)>20)P.face=P.vx>0?1:-1;
    const ps=Math.hypot(P.vx,P.vz);P.anim+=dt*ps/34;
    if(ps>120&&Math.floor(P.anim*2)!==Math.floor((P.anim-dt*ps/34)*2))Sfx.patter();
    P.inv=Math.max(0,P.inv-dt);
  }
  // ---- hachishaku AI
  const dx=P.x-E.x,dz=P.z-E.z,dist=Math.hypot(dx,dz*1.6);
  E.st+=dt;
  let tvx=0,tvz=0;
  const base=Math.min(240,112+14*G.stage+40*G.frust);
  switch(E.state){
    case 'intro': if(E.st>1.2)E.state='chase';tvx=dx/dist*60;tvz=dz/dist*60;break;
    case 'chase':{
      const m=Math.hypot(dx,dz)||1;tvx=dx/m*base;tvz=dz/m*base*0.9;
      E.dashCd-=dt;
      if(E.dashCd<=0&&dist<700&&dist>140){E.state='windup';E.st=0;E.tx=P.x+P.vx*0.35;E.tz=clamp(P.z+P.vz*0.35,0,D);Sfx.dashWarn();H.startChant(3);}
      E.chantCd-=dt;if(E.chantCd<=0){E.chantCd=rand(4,8);H.startChant(3);}
      break;}
    case 'windup': if(E.st>0.8){E.state='dash';E.st=0;Sfx.whoosh();const m=Math.hypot(E.tx-E.x,E.tz-E.z)||1;E.dvx=(E.tx-E.x)/m;E.dvz=(E.tz-E.z)/m;E.dashDist=Math.min(m+160,760);}break;
    case 'dash':{const sp=640;tvx=E.dvx*sp;tvz=E.dvz*sp;E.vx=tvx;E.vz=tvz;if(E.st*sp>E.dashDist||E.st>1.3){E.state='recover';E.st=0;E.dashCd=Math.max(2.2,rand(4,6.5)*Math.pow(0.9,G.stage));G.frust=Math.min(0.999,G.frust+0.08);shake(7);}
      E.ghostT-=dt;if(E.ghostT<=0){E.ghostT=0.05;E.ghosts.push({x:E.x,z:E.z,a:0.35});}break;}
    case 'recover': tvx=0;tvz=0;if(E.st>0.75)E.state='chase';break;
    case 'stunned': tvx=-dx/(Math.abs(dx)+1)*40;if(E.st>1.4)E.state='chase';break;
    case 'stageup': if(E.st>1.4)E.state='chase';break;
    case 'grab': case 'win': break;
  }
  if(E.state!=='dash'){const k=E.state==='chase'?3.2:6;E.vx=lerp(E.vx,tvx,ease(k,dt));E.vz=lerp(E.vz,tvz,ease(k,dt));}
  if(G.mode==='play'||E.state==='intro'){
    const hw=bellyHalfW();
    E.x=clamp(E.x+E.vx*dt,Math.min(W/2,hw*0.55),Math.max(W/2,W-hw*0.55));E.z=clamp(E.z+E.vz*dt,0,D);
  }
  for(const g of E.ghosts)g.a-=dt*1.4;E.ghosts=E.ghosts.filter(g=>g.a>0);
  // ---- frustration
  if(playing&&['chase','recover','windup','dash'].includes(E.state)){
    G.frust+=dt/Math.max(8,12.5-G.stage*0.5);
    if(dist<200)G.frust+=dt*0.03;
    if(G.frust>=1)stageUp();
  }
  // ---- capture check
  if(playing&&P.inv<=0&&['chase','dash','recover','windup','intro'].includes(E.state)){
    const hw=bellyHalfW()+16,hd=bellyHalfD()+12;
    if((dx*dx)/(hw*hw)+(dz*dz)/(hd*hd)<1)startGrab();
  }
  // ---- grab
  if(G.mode==='grab'){
    grab.t+=dt;grab.e-=dt*(0.14+0.018*G.stage);
    grab.squeezeT-=dt;
    if(grab.squeezeT<=0){grab.squeezeT=rand(0.8,1.2);grab.e-=0.04;Sfx.squeeze();const v=herView();addText(v.x+rand(-80,80)*DPR,v.y-rand(150,260)*DPR*(v.ppu/DPR/1.5),'ぎゅっ',{size:24,col:'#ffc0d0',stroke:'#600'});shake(3);}
    // player stuck to the belly front
    P.x=lerp(P.x,E.x+(P.x<E.x?-1:1)*Math.min(Math.abs(P.x-E.x),bellyHalfW()*0.25),ease(8,dt));P.z=lerp(P.z,E.z-bellyHalfD()*0.6,ease(8,dt));
    if(grab.e<=0||grab.t>=grab.limit){grab.e=Math.max(0,grab.e);gameOverSeq();}
  }
  if(G.mode==='caught'){if(E.st>2.3&&!G.overShown){G.overShown=true;showOver();}}
  else G.overShown=false;
  // ---- mood
  let mood='calm';
  if(E.state==='grab'||E.state==='win')mood='glee';
  else if(E.state==='stunned')mood='shock';
  else if(E.state==='stageup'||E.state==='windup'||E.state==='dash'||G.frust>0.62)mood='angry';
  else if(dist<360)mood='eager';
  if(mood==='eager'&&!E.eager){H.startChant(3);}
  E.eager=mood==='eager';E.mood=mood;
  const speedE=Math.hypot(E.vx,E.vz);
  H.update(dt,{speed:(E.state==='grab'||E.state==='win')?0:speedE,vx:E.vx,mood:mood,state:E.state,grab:E.state==='grab'||E.state==='win',frust:G.frust});
  Sfx.setTension(clamp(1-dist/700,0,1)*0.8+(G.mode==='grab'?0.4:0));Sfx.tick();
  updateCamera(dt,dist);
  updateParts(dt);
  G.shake=Math.max(0,G.shake-dt*30);G.flash=Math.max(0,G.flash-dt*1.6);
}
function updateTitleScene(dt){
  // gentle idle so the renderer stays warm behind the title
}
function updateCamera(dt,dist){
  cam.VW=VW;cam.px=PX;
  const Hw=H.heightWorld();
  // normal framing
  let z=VW<560?clamp(VW/500,0.62,0.8):clamp(VW/880,0.5,1.0);
  const need=Math.abs(P.x-E.x)/2+bellyHalfW()*1.05+70,zFit=(VW/2)/need,zMin=VW<560?0.42:0.45;
  z=Math.min(z,Math.max(zFit,zMin));const fits=zFit>=z-1e-3;
  const topV=World.y(E.z)-Hw*World.s(E.z);
  for(let i=0;i<3;i++){const cy=700-(1-z)*210;z=Math.min(z,(cy-78)/Math.max(100,700-topV));}
  z=Math.max(0.28,z);
  const cyN=700-(1-z)*210;
  const halfView=VW/2/z;
  let cx=fits?(P.x+E.x)/2:lerp(P.x,E.x,0.3);
  if(halfView*2<W+260)cx=clamp(cx,halfView-130,W-halfView+130);else cx=W/2;
  const grabbing=G.mode==='grab'||G.mode==='caught';
  cam.blend=lerp(cam.blend,grabbing?1:0,ease(grabbing?5:3,dt));
  // grab framing (focus on her)
  const s=World.s(E.z),Hs=Hw*s;
  const zg=Math.min(2.4,Math.min(720*0.78/Hs,VW*0.95/(bellyHalfW()*2*s)));
  const fv=viewPt(E.x,E.z,Hw*0.5);
  cam.camX=lerp(cam.camX,grabbing?E.x:cx,ease(grabbing?6:3.5,dt));
  const b=cam.blend;
  cam.zoom=lerp(cam.zoom,lerp(z,zg,b),ease(4,dt));
  const Fx=lerp(VW/2,fv[0],b),Fy=lerp(700,fv[1],b);
  cam.F.x=Fx;cam.F.y=Fy;cam.C.x=VW/2;cam.C.y=lerp(cyN,720*0.5,b);
  const sh=G.shake;cam.shx=rand(-1,1)*sh;cam.shy=rand(-1,1)*sh;
}
function updateParts(dt){
  for(const p of parts){p.t+=dt;if(p.vx!==undefined){p.x+=p.vx*dt;p.y+=p.vy*dt;}
    if(p.k==='spark'){p.vx*=0.9;p.vy=p.vy*0.9+500*DPR*dt;}
    if(p.k==='text'){p.vy+=p.grav*dt;p.vx*=0.98;}
    if(p.k==='dust'){p.vx*=0.95;p.vy*=0.95;}}
  for(let i=parts.length-1;i>=0;i--)if(parts[i].t>parts[i].life)parts.splice(i,1);
}

// ---------------------------------------------------------------- render
function drawShadow(x,z,hw,alpha){
  const p=proj(x,z,0),w=hw*2*p[2],h=w*0.22;
  R.quad(shadowTex,p[0],p[1],w,h,0,0,0,1,1,1,1,1,alpha,0);
}
function drawKid(alphaMul,xray){
  const grabbing=G.mode==='grab'||G.mode==='caught';
  let p=proj(P.x,P.z,0),ppu=p[2];
  let frame,flip=P.face<0;
  const ps=Math.hypot(P.vx,P.vz);
  let ox=0,oy=0,sx=1,sy=1;
  if(grabbing){
    const v=herView(),a=H.anchors(v);
    frame=kid.BACK+Math.floor(G.t*14)%4;flip=false;
    p=[a.belly[0]+Math.sin(G.t*30)*3*DPR,a.belly[1]+ (H.bellyCenterS().y*0+0)+ (1895-H.bellyCenterS().y)*a.scale*0.5,0];
    ppu=v.ppu*1.02;
    if(G.mode==='caught'){const k=clamp(E.st/1.6,0,1);sy=1-0.35*k;sx=1+0.2*k;alphaMul*=1-clamp((E.st-1.2)/0.8,0,1);}
  }else if(P.knock>0){frame=kid.SCARED;}
  else if(ps>25){frame=kid.RUN+Math.floor(P.anim)%8;}
  else frame=kid.IDLE+Math.floor(G.t*2)%2;
  const sc=118/200*ppu,cw=kid.CW*sc*sx,ch=kid.CH*sc*sy;
  const u0=(frame%kid.cols)*kid.CW/kidTex.w,v0=Math.floor(frame/kid.cols)*kid.CH/kidTex.h,u1=u0+kid.CW/kidTex.w,v1=v0+kid.CH/kidTex.h;
  const blink=P.inv>0&&!grabbing&&Math.floor(G.t*16)%2===0?0.35:1;
  const cx=p[0]+ox,cy=p[1]-(kid.GY-kid.CH/2)*sc*sy+oy;
  const a=alphaMul*blink;
  if(xray)R.quad(kidTex,cx,cy,flip?-cw:cw,ch,0,u0,v0,u1,v1,0.7,0.85,1,a,0.6);
  else R.quad(kidTex,cx,cy,flip?-cw:cw,ch,0,u0,v0,u1,v1,1,1,1,a,0);
}
function render(){
  cam.VW=VW;cam.px=PX;
  stage.draw(bg,cam,G.t);
  R.begin(CW,CH);
  // shadows
  drawShadow(E.x,E.z,bellyHalfW()*1.05,0.55);
  if(G.mode!=='grab'&&G.mode!=='caught')drawShadow(P.x,P.z,26,0.5);
  const view=herView();
  const kidBehind=P.z>E.z&&G.mode==='play';
  if(kidBehind)drawKid(1,false);
  // dash ghosts
  for(const g of E.ghosts){const p=proj(g.x,g.z,0);H.draw({x:p[0],y:p[1],ppu:p[2]},{alpha:g.a*0.6,tint:[1,0.5,0.6]});}
  H.draw(view,{tint:[0.86,0.88,0.99]});
  if(!kidBehind&&G.mode!=='title')drawKid(1,false);
  else if(kidBehind){ // x-ray silhouette when hidden behind her
    const hw=bellyHalfW()*1.1;if(Math.abs(P.x-E.x)<hw)drawKid(0.45,true);
  }
  // portrait
  drawPortrait();
  R.end();
  renderFx(view);
}
let portraitRect=null;
function drawPortrait(){
  if(G.mode==='title'||G.mode==='over')return;
  if(!portraitRect||G.t%1<0.02){const r=$('portrait').getBoundingClientRect();portraitRect={x:r.left*DPR,y:r.top*DPR,w:r.width*DPR,h:r.height*DPR};}
  const r=portraitRect;if(!r.w)return;
  const gl=R.gl;R.flush();
  gl.enable(gl.SCISSOR_TEST);gl.scissor(Math.round(r.x+2*DPR),Math.round(CH-(r.y+r.h)+2*DPR),Math.round(r.w-4*DPR),Math.round(r.h-4*DPR));
  const mad=E.mood==='angry';
  R.quad(R.white,r.x+r.w/2,r.y+r.h/2,r.w,r.h,0,0,0,1,1,mad?0.18:0.06,mad?0.02:0.06,mad?0.05:0.14,1,0);
  const off=H.upperOffset(),u=H.uScale(),sc=r.w/(118*u),K=Hachi.K;
  const fxS=610+(607-610)*u+off.x,fyS=470+(140-470)*u+off.y;
  const view={x:r.x+r.w/2-(fxS-683)*sc,y:r.y+r.h*0.56-(fyS-1895)*sc,ppu:sc/K,tilt:-H.p.tilt};
  H.draw(view,{tint:[1,1,1]});
  R.flush();gl.disable(gl.SCISSOR_TEST);
}
function drawVein(ctx,x,y,s,a){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=a;ctx.strokeStyle='#ff2340';ctx.lineWidth=5;ctx.lineCap='round';
  ctx.shadowColor='#ff0030';ctx.shadowBlur=10;
  for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2+0.785);ctx.beginPath();ctx.moveTo(6,-9);ctx.quadraticCurveTo(4,-4,9,-3);ctx.stroke();ctx.restore();}
  ctx.restore();
}
function renderFx(view){
  const c=fx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,CW,CH);
  if(G.mode==='title')return;
  const a=H.anchors(view);
  // eye glow when angry
  if(H.eyeGlow>0.02&&E.mood!=='glee'&&E.mood!=='shock'){
    c.globalCompositeOperation='lighter';
    for(const e of [a.eyeL,a.eyeR]){const r=Math.max(3*DPR,16*a.scale)*(0.85+0.15*Math.sin(G.t*9));
      const g=c.createRadialGradient(e[0],e[1],0,e[0],e[1],r);g.addColorStop(0,`rgba(255,40,40,${0.85*H.eyeGlow})`);g.addColorStop(1,'rgba(255,0,0,0)');c.fillStyle=g;c.fillRect(e[0]-r,e[1]-r,r*2,r*2);}
    c.globalCompositeOperation='source-over';
  }
  if((H.anger>0.3||E.mood==='angry')&&E.mood!=='glee'&&E.mood!=='shock'){
    const k=Math.max(H.anger,E.mood==='angry'?1:0);drawVein(c,a.hatSide[0],a.hatSide[1]+20*a.scale,Math.max(0.45*DPR,a.scale*2.6)*(1+0.12*Math.sin(G.t*12)),clamp(k,0,1));
  }
  // dash telegraph
  if(E.state==='windup'){
    const p0=proj(E.x,E.z,0),p1=proj(E.tx,E.tz,0);
    c.strokeStyle=`rgba(255,40,60,${0.4+0.4*Math.sin(G.t*30)})`;c.lineWidth=6*DPR;c.setLineDash([16*DPR,12*DPR]);
    c.beginPath();c.moveTo(p0[0],p0[1]);c.lineTo(p1[0],p1[1]);c.stroke();c.setLineDash([]);
    c.beginPath();c.ellipse(p1[0],p1[1],40*p1[2],12*p1[2],0,0,7);c.stroke();
    const tp=a.hatTop;c.font=`900 ${Math.round(56*DPR)}px sans-serif`;c.textAlign='center';c.fillStyle='#ff2848';c.strokeStyle='#fff';c.lineWidth=5*DPR;
    c.strokeText('！',tp[0],tp[1]-10*DPR);c.fillText('！',tp[0],tp[1]-10*DPR);
  }
  // off-screen indicator for her
  if(G.mode==='play'){
    const fp=proj(E.x,E.z,0),m=40*DPR;
    const hw=bellyHalfW()*fp[2];
    if(fp[0]+hw<0||fp[0]-hw>CW){
      const left=fp[0]<0,x=left?m:CW-m,y=clamp(fp[1]-80*DPR,120*DPR,CH-80*DPR),pul=0.6+0.4*Math.sin(G.t*8);
      c.save();c.translate(x,y);c.globalAlpha=pul;c.fillStyle='#ff2848';c.beginPath();
      if(left){c.moveTo(-22*DPR,0);c.lineTo(8*DPR,-18*DPR);c.lineTo(8*DPR,18*DPR);}else{c.moveTo(22*DPR,0);c.lineTo(-8*DPR,-18*DPR);c.lineTo(-8*DPR,18*DPR);}
      c.closePath();c.fill();c.globalAlpha=1;c.font=`900 ${Math.round(13*DPR)}px sans-serif`;c.textAlign='center';c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=3*DPR;
      const dm=Math.round(Math.abs(E.x-P.x)/50);c.strokeText(`八尺様 ${dm}m`,left?30*DPR:-30*DPR,32*DPR);c.fillText(`八尺様 ${dm}m`,left?30*DPR:-30*DPR,32*DPR);c.restore();
    }
  }
  // particles
  for(const p of parts){
    const k=p.t/p.life;
    if(p.k==='text'){
      const s=k<0.15?0.6+k/0.15*0.5:1.1-0.1*k;c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.scale(s,s);c.globalAlpha=k>0.7?(1-k)/0.3:1;
      c.font=`900 ${Math.round(p.size)}px "Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif`;c.textAlign='center';c.textBaseline='middle';
      c.lineJoin='round';c.strokeStyle=p.stroke;c.lineWidth=p.size*0.22;c.strokeText(p.txt,0,0);c.fillStyle=p.col;c.fillText(p.txt,0,0);c.restore();
    }else if(p.k==='spark'){c.globalAlpha=1-k;c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,p.size*(1-k*0.5),0,7);c.fill();}
    else if(p.k==='ring'){c.globalAlpha=(1-k)*0.8;c.strokeStyle=`rgba(${p.col},1)`;c.lineWidth=(1-k)*8*DPR;c.beginPath();c.arc(p.x,p.y,p.r*(0.3+k),0,7);c.stroke();}
    else if(p.k==='dust'){c.globalAlpha=(1-k)*0.35;c.fillStyle='#8890a8';c.beginPath();c.arc(p.x,p.y,p.size*(0.6+k)*DPR,0,7);c.fill();}
  }
  c.globalAlpha=1;
  // fog drifting along the floor
  const fy=toScreen(VW/2,World.y(D*0.3))[1];
  for(let i=0;i<4;i++){const x=((G.t*18*(i+1)+i*400)%(CW+800))-400,y=fy+(i-1.5)*40*DPR*cam.zoom;
    const g=c.createRadialGradient(x,y,0,x,y,380*DPR*cam.zoom);g.addColorStop(0,'rgba(150,160,210,0.07)');g.addColorStop(1,'rgba(150,160,210,0)');c.fillStyle=g;c.fillRect(x-400*DPR,y-400*DPR,800*DPR,800*DPR);}
  // vignette (+ red when tense)
  const tense=clamp(G.frust*1.2-0.4,0,1)*0.5+(E.state==='windup'?0.4:0)+(G.mode==='grab'?0.3:0);
  const vg=c.createRadialGradient(CW/2,CH*0.55,Math.min(CW,CH)*0.3,CW/2,CH*0.55,Math.max(CW,CH)*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(${Math.round(60*tense)},0,${Math.round(12*(1-tense))},${0.72+0.12*tense*(0.6+0.4*Math.sin(G.t*6))})`);
  c.fillStyle=vg;c.fillRect(0,0,CW,CH);
  if(G.flash>0){c.fillStyle=`rgba(${G.flashCol},${G.flash*0.45})`;c.fillRect(0,0,CW,CH);}
  if(portraitRect&&G.mode!=='over'){const r=portraitRect;c.clearRect(r.x,r.y,r.w,r.h);}
  // film grain-ish scanline flicker
  if(Math.random()<0.04){c.fillStyle='rgba(255,255,255,0.03)';c.fillRect(0,Math.random()*CH,CW,2*DPR);}
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
    if(G.mode==='grab'){$('gfill').style.width=(clamp(grab.e,0,1)*100)+'%';$('gtime').style.width=(clamp(1-grab.t/grab.limit,0,1)*100)+'%';}
  }
}

// ---------------------------------------------------------------- main loop
let last=0;
function frame(ts){
  const t=ts/1000;let dt=last?t-last:0.016;last=t;dt=Math.min(dt,0.05);
  const t0=performance.now();
  try{update(dt);if(G.mode!=='title')render();updateHud(dt);}catch(e){showErr(e);return;}
  window.__ft=(window.__ft||0)*0.95+(performance.now()-t0)*0.05;
  requestAnimationFrame(frame);
}
// test hook for automated verification
window.__game={update:(dt)=>update(dt),G:G,P:P,E:E,grab:grab,start:()=>startGame(),hit:()=>hitBelly(null),stageUp:()=>stageUp(),keys:keys,
  setStage:(n)=>{G.stage=n;H.setGrowth(growthFor(n));H.b.g=growthFor(n);},H:()=>H};

// ---------------------------------------------------------------- boot
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('画像の読み込みに失敗'));i.src=src;});}
async function boot(){
  resize();
  $('titleArt').style.backgroundImage=`url(${ASSETS.img.key})`;
  updateTitleBest();
  const imgs={};for(const k of ['upper','belly','skirt','legL','legR','faces'])imgs[k]=await loadImg(ASSETS.img[k]);
  R=new Renderer(cGl);
  cGl.addEventListener('webglcontextlost',(e)=>{e.preventDefault();showErr('描画が中断されました。ページを再読み込みしてください。');});
  H=new Hachi(R,imgs,ASSETS.meta);
  H.onSyllable=()=>{
    const angry=E.mood==='angry'||E.state==='stageup';
    Sfx.po(rand(0.94,1.06)*(angry?1.08:1),angry,G.mode==='title'?0:1);
    if(G.mode==='title')return;
    const v=herView(),a=H.anchors(v);
    addText(a.mouth[0]+rand(-20,20)*DPR,a.mouth[1]-10*DPR,'ぽ',{size:angry?34:26,col:angry?'#ff8899':'#fff',stroke:angry?'#500':'#223',vx:rand(-90,90)*DPR,vy:-110*DPR,grav:-10*DPR,life:1.1});
  };
  H.onStep=(side,amt)=>{
    if(G.mode==='title')return;
    const v=herView(),a=H.anchors(v);const d=Math.hypot(P.x-E.x,P.z-E.z);
    Sfx.step(clamp(1.1-d/1400,0.25,1)*(E.state==='dash'?1.4:1));
    dust(a.feet[0]+(side==='L'?-25:25)*a.scale*4,a.feet[1],DPR*Math.max(0.6,a.scale*4));
    if(E.state==='dash'||G.stage>=4)shake(E.state==='dash'?5:1.5+G.stage*0.3);
  };
  kid=KidSheet();kidTex=R.texture(kid.canvas);
  const sc=document.createElement('canvas');sc.width=sc.height=128;const sx=sc.getContext('2d');
  const sg=sx.createRadialGradient(64,64,0,64,64,64);sg.addColorStop(0,'rgba(0,0,0,0.9)');sg.addColorStop(0.6,'rgba(0,0,0,0.45)');sg.addColorStop(1,'rgba(0,0,0,0)');sx.fillStyle=sg;sx.fillRect(0,0,128,128);
  shadowTex=R.texture(sc);
  stage=new Stage();
  $('loading').classList.add('hidden');
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
