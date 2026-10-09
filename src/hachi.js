// 八尺様 rig: layered mesh deformation of the original artwork.
(function(){
'use strict';
const ss=(a,b,x)=>{let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t);};
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const lerp=(a,b,t)=>a+(b-a)*t;
// --- source-space constants (pixels of the original 1206x1917 art)
const GROUND=1895, ANCHOR_X=683, PIV={x:610,y:445}, BELLY_H=817, BELLY_C={x:610,y:860};
const K=0.251; // world units per source px
const EYES=[[577.5,125],[620,119.5]], MOUTH=[603.5,150];

function spring(o,key,target,freq,damp,dt){
  const w=6.2832*freq,vk=key+'_v';
  let x=o[key],v=o[vk]||0;
  const n=Math.max(1,Math.ceil(dt/0.008)),h=dt/n;
  for(let i=0;i<n;i++){const a=-w*w*(x-target)-2*damp*w*v;v+=a*h;x+=v*h;}
  o[key]=x;o[vk]=v;
}

function Mesh(box,cols,rows,opt){
  opt=opt||{};
  const nv=(cols+1)*(rows+1);
  this.cols=cols;this.rows=rows;this.n=nv;
  this.sx=new Float32Array(nv);this.sy=new Float32Array(nv);
  this.uv=new Float32Array(nv*2);this.uv2=opt.atlas?new Float32Array(nv*2):null;
  this.P=new Float32Array(nv*2);this.box=box;this.opt=opt;
  let i=0;
  for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
    const x=box.x+box.w*c/cols,y=box.y+box.h*r/rows;
    this.sx[i]=x;this.sy[i]=y;
    this.uv[i*2]=c/cols;this.uv[i*2+1]=r/rows;i++;
  }
  const idx=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const a=r*(cols+1)+c,b=a+1,d=a+cols+1,e=d+1;
    if((r+c)%2){idx.push(a,b,e,a,e,d);}else idx.push(a,b,d,b,e,d);
  }
  this.idx=new Uint16Array(idx);
  this.w={}; // per-vertex static weights
}
Mesh.prototype.weight=function(name,fn){const w=new Float32Array(this.n);for(let i=0;i<this.n;i++)w[i]=fn(this.sx[i],this.sy[i]);this.w[name]=w;};
Mesh.prototype.setAtlas=function(ia,ib,count){ // vertical atlas of variants
  const u=this.uv,u2=this.uv2,b=this.box;
  for(let i=0;i<this.n;i++){
    const ry=(this.sy[i]-b.y)/b.h;
    this.uvA=this.uvA||new Float32Array(this.n*2);
    this.uvA[i*2]=u[i*2];this.uvA[i*2+1]=(ia+ry)/count;
    u2[i*2]=u[i*2];u2[i*2+1]=(ib+ry)/count;
  }
};

function rot(x,y,px,py,a,w,out){ // rotate (x,y) around pivot by a*w
  if(!w||!a){out[0]=x;out[1]=y;return;}
  const t=a*w,c=Math.cos(t),s=Math.sin(t),dx=x-px,dy=y-py;
  out[0]=px+dx*c-dy*s;out[1]=py+dx*s+dy*c;
}

function Hachi(R,imgs,meta){
  this.R=R;
  const L=meta.layers;this.L=L;
  this.tex={};
  for(const k of ['upper','belly','skirt','legL','legR','faces'])this.tex[k]=R.texture(imgs[k]);
  this.tex.hair=R.texture(makeBackHair());
  this.faceMeta=meta.faces;
  // meshes
  this.m={};
  this.m.hair=new Mesh({x:350,y:150,w:530,h:420},10,12);
  this.m.legL=new Mesh(L.legL,3,6);
  this.m.legR=new Mesh(L.legR,3,6);
  this.m.skirt=new Mesh(L.skirt,18,14);
  this.m.belly=new Mesh(L.belly,26,26);
  this.m.upper=new Mesh(L.upper,62,47); // 10px cells so arm weights can avoid the hat brim exactly
  const F=meta.faces;
  this.m.face=new Mesh({x:F.x,y:F.y,w:F.w,h:F.h},30,26,{atlas:true});
  // static weights for upper body / face / hair
  // arm/bust boundary traced from the art; weight is exactly 0 on every mesh vertex touching bust pixels (10px cells)
  const pl=(y,P)=>{if(y<=P[0][0])return P[0][1];for(let k=1;k<P.length;k++)if(y<=P[k][0]){const a=P[k-1],b=P[k];return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]);}return P[P.length-1][1];};
  const BL=[[200,450],[250,440],[285,432],[320,436],[345,446],[370,456],[400,462],[440,472]];
  const BR=[[200,770],[250,775],[280,779],[320,778],[345,771],[370,764],[400,760],[440,750]];
  const armL=(x,y)=>{const bx=pl(y,BL);return ss(bx-10,bx-35,x)*ss(470,415,y)*ss(338,278,y)*Math.max(ss(190,200,y),ss(410,400,x));};
  const armR=(x,y)=>{const bx=pl(y,BR);return ss(bx+10,bx+35,x)*ss(470,415,y)*ss(338,278,y)*Math.max(ss(170,180,y),ss(800,810,x));};
  const head=(x,y)=>ss(245,192,y)*lerp(1,ss(432,478,x)*ss(788,742,x),ss(130,180,y));
  const hat=(x,y)=>ss(196,168,y)*(1-ss(1.25,0.85,Math.pow((x-606)/66,2)+Math.pow((y-152)/58,2)));
  const hairF=(x,y)=>ss(195,330,y)*Math.max(ss(468,492,x)*ss(560,535,x),ss(655,680,x)*ss(752,728,x))*ss(360,320,y)+
                      ss(195,330,y)*Math.max(ss(468,492,x)*ss(560,535,x),ss(655,680,x)*ss(752,728,x))*ss(330,370,y)*0.6;
  const chest=(x,y)=>ss(470,360,y)*ss(215,270,y)*ss(430,470,x)*ss(790,750,x);
  for(const m of [this.m.upper,this.m.face]){
    m.weight('armL',armL);m.weight('armR',armR);m.weight('head',head);m.weight('hat',hat);m.weight('hairF',hairF);m.weight('chest',chest);
  }
  this.m.face.weight('eyeL',(x,y)=>Math.exp(-Math.pow((x-EYES[0][0])/10.5,2)-Math.pow((y-EYES[0][1])/6.5,2)));
  this.m.face.weight('eyeR',(x,y)=>Math.exp(-Math.pow((x-EYES[1][0])/10.5,2)-Math.pow((y-EYES[1][1])/6.5,2)));
  this.m.face.weight('mouth',(x,y)=>Math.exp(-Math.pow((x-MOUTH[0])/15,2)-Math.pow((y-MOUTH[1]-3)/10,2)));
  this.m.hair.weight('head',(x,y)=>ss(260,175,y));
  this.m.hair.weight('sway',(x,y)=>Math.pow(clamp((y-200)/360,0,1),1.4));
  this.m.belly.weight('roll',(x,y)=>Math.exp(-Math.pow((y-560)/120,2))*ss(700,640,y+0)+0.0);
  this.reset();
}
Hachi.prototype.reset=function(){
  this.t=0;this.phase=0;this.walkAmt=0;
  this.b={g:1,g_v:0,gT:1,by:0,bx:0,sq:0,roll:0,rollx:0,flash:0};
  this.prevBob=0;this.prevBobV=0;this.bob=0;
  this.p={ux:0,uy:0,lean:0,headRot:0,hatRot:0,armL:0,armR:0,hairSway:0,breath:0,hipSway:0,liftL:0,liftR:0,tilt:0,crouch:0,blink:0,mouthPulse:0};
  this.ripples=[];
  this.face={a:'base',b:'base',mix:0,target:'base'};
  this.mood='calm';this.chant=0;this.chantT=0;this.syll=9;this.blinkT=2;
  this.anger=0;this.glee=0;this.eyeGlow=0;
  this.lift=0;this.vx=0;this.vz=0;
  this.onSyllable=null;this.onStep=null;
  this.ghosts=[];
};
Hachi.prototype.setGrowth=function(g){this.b.gT=g;};
Hachi.prototype.uScale=function(){return 1+Math.max(0,this.b.g-1)*0.3;};
Hachi.prototype.hit=function(sx,sy,power){
  // sx,sy in source coords (unscaled belly frame)
  this.ripples.push({x:sx,y:sy,t:0,a:(power||1)});
  if(this.ripples.length>6)this.ripples.shift();
  const b=this.b;
  b.sq_v=(b.sq_v||0)+0.9*(power||1);
  b.bx_v=(b.bx_v||0)+(sx<610?1:-1)*140*(power||1);
  b.by_v=(b.by_v||0)+90*(power||1);
  b.roll_v=(b.roll_v||0)-120*(power||1);
  b.flash=0.55;
};
Hachi.prototype.startChant=function(n){this.chant=n||3;this.chantT=0.05;};
// size info (source px)
Hachi.prototype.bellyHalfW=function(){return 470*this.b.g;};
Hachi.prototype.topY=function(){return 470-(430)*this.uScale()-this.lift;};
Hachi.prototype.heightWorld=function(){return (GROUND-this.topY())*K;};
Hachi.prototype.bellyCenterS=function(){return {x:610,y:445+(BELLY_C.y-445)*this.b.g-this.lift};};

Hachi.prototype.update=function(dt,o){
  // o: {vx,vz,speed,mood,grab,frust,dist,state}
  this.t+=dt;const t=this.t,p=this.p,b=this.b;
  const spd=o.speed||0;
  this.walkAmt=lerp(this.walkAmt,clamp(spd/120,0,1.25),1-Math.exp(-dt*6));
  const stride=o.state==='dash'?150:95; // world units per full cycle
  const prevS=Math.sin(this.phase);
  this.phase+=Math.min(spd,260)/stride*Math.PI*dt;
  const s=Math.sin(this.phase),c=Math.cos(this.phase);
  if((prevS<0)!==(s<0)&&this.walkAmt>0.25){ // footfall
    b.sq_v=(b.sq_v||0)+0.42*Math.min(1,this.walkAmt)*(o.state==='dash'?1.6:1);
    b.roll_v=(b.roll_v||0)+70*this.walkAmt;
    if(this.onStep)this.onStep(prevS<0?'L':'R',this.walkAmt);
  }
  const wa=Math.min(1,this.walkAmt);
  // body bob (source px, negative=up)
  const bob=-Math.abs(s)*22*wa + p.crouch*40;
  const bobV=(bob-this.prevBob)/Math.max(dt,1e-3);
  const bobA=(bobV-this.prevBobV)/Math.max(dt,1e-3);
  this.prevBob=bob;this.prevBobV=bobV;this.bob=bob;
  // legs
  p.liftL=Math.max(0,s)*wa;p.liftR=Math.max(0,-s)*wa;
  p.hipSway=s*12*wa;
  p.ux=-s*5*wa;
  p.tilt=lerp(p.tilt,clamp(-(o.vx||0)*0.00011,-0.05,0.05)+s*0.008*wa,1-Math.exp(-dt*5));
  // belly springs
  b.by_v=(b.by_v||0)-clamp(bobA,-6000,6000)*0.55*dt;
  spring(b,'by',0,2.6,0.16,dt);
  const bxT=clamp(-(o.vx||0)*0.22,-70,70)+Math.cos(this.phase)*14*wa;
  spring(b,'bx',bxT,2.1,0.18,dt);
  let sqT=0;
  if(o.state==='windup')sqT=0.14;
  if(o.state==='dash')sqT=-0.06;
  if(o.grab)sqT=0.05+0.06*Math.max(0,Math.sin(t*7.5));
  if(o.state==='stageup')sqT=0.02;
  spring(b,'sq',sqT,3.4,0.15,dt);
  b.sq=clamp(b.sq,-0.35,0.45);
  spring(b,'roll',0,3.2,0.14,dt);
  spring(b,'rollx',-b.bx*0.25,2.8,0.2,dt);
  spring(b,'g',b.gT,2.2,0.28,dt);
  b.flash=Math.max(0,b.flash-dt*4);
  for(const r of this.ripples)r.t+=dt;
  this.ripples=this.ripples.filter(r=>r.t<1.6);
  // lift when belly reaches ground
  const bottom=445+BELLY_H*b.g*(1-0.3*b.sq);
  const want=Math.max(0,bottom-(GROUND-30))*0.92;
  this.lift=lerp(this.lift,want,1-Math.exp(-dt*12));
  // crouch
  spring(p,'crouch',o.state==='windup'?1:o.state==='stageup'?0.35:0,3,0.4,dt);
  // mood & expressions
  const mood=o.mood||'calm';this.mood=mood;
  this.anger=lerp(this.anger,mood==='angry'?1:clamp((o.frust||0)*1.4-0.5,0,0.6),1-Math.exp(-dt*3));
  this.glee=lerp(this.glee,mood==='glee'?1:0,1-Math.exp(-dt*4));
  // head
  let hr=Math.sin(t*0.9)*0.02;
  if(mood==='eager')hr+=0.07+Math.sin(t*2.2)*0.03;
  if(mood==='angry')hr+=Math.sin(t*41)*0.012*(0.4+this.anger)-0.03;
  if(mood==='glee')hr+=Math.sin(t*6)*0.07;
  if(mood==='shock')hr+=Math.sin(t*18)*0.025;
  hr+=s*0.015*wa;
  // head & hat are kept rigid (no tilt, no brim trailing) by request
  p.headRot=0;p.hatRot=0;
  // arms
  let al=Math.sin(t*2.1)*0.04,ar=Math.sin(t*2.1+1)*0.04;
  if(mood==='eager'){al=Math.sin(t*9)*0.09-0.04;ar=Math.sin(t*9+Math.PI)*0.09+0.04;}
  if(mood==='angry'){al=Math.sin(t*33)*0.04+0.08;ar=-Math.sin(t*31)*0.04-0.08;}
  if(mood==='glee'){al=Math.sin(t*11)*0.12-0.06;ar=Math.sin(t*11)*0.12*-1+0.06;}
  if(mood==='shock'){al=0.14;ar=-0.14;}
  if(o.state==='windup'){al=-0.15;ar=0.15;}
  if(o.state==='dash'){al=0.12;ar=-0.12;}
  al+=c*0.06*wa;ar+=c*0.06*wa;
  spring(p,'armL',al,3.5,0.35,dt);spring(p,'armR',ar,3.5,0.35,dt);
  spring(p,'hairSway',clamp(-(o.vx||0)*0.004,-1.4,1.4)+Math.sin(t*1.3)*0.15+ s*0.25*wa - p.headRot*4,1.4,0.18,dt);
  p.breath=Math.sin(t*1.7)*(mood==='angry'?0.02:0.011);
  // blink
  this.blinkT-=dt;
  if(this.blinkT<0){this.blinkT=2.2+Math.random()*3;this.blinkS=0;}
  if(this.blinkS!==undefined){this.blinkS+=dt;const q=this.blinkS/0.16;p.blink=q<1?Math.sin(q*Math.PI):0;if(q>=1)this.blinkS=undefined;}
  // chant ぽぽぽ
  if(this.chant>0){
    this.chantT-=dt;
    if(this.chantT<=0){this.chant--;this.syll=0;this.chantT=mood==='angry'?0.2:0.27;if(this.onSyllable)this.onSyllable();}
  }
  this.syll+=dt;
  const sylEnv=(this.chant>0||this.syll<0.25)?Math.max(0,Math.sin(clamp(this.syll/0.22,0,1)*Math.PI)):0;
  p.mouthPulse=sylEnv;
  // face target
  let base='base',open='oh';
  if(mood==='angry'||this.anger>0.55){base='angry';open='angryoh';}
  if(mood==='glee'){base='grin';open='grin';}
  if(mood==='shock'){base='shock';open='shock';}
  let target=base;
  if(mood==='eager')target='oh';
  const F=this.face;
  // chant overrides via mix envelope
  if(sylEnv>0&&mood!=='glee'&&mood!=='shock'){
    F.a=(mood==='eager')?'oh':base;F.b=open;F.mix=mood==='eager'?0:sylEnv;F.target=F.a;
    if(mood==='eager'){F.a='oh';F.b='oh';F.mix=0;}
  }else{
    if(F.target!==target){F.b=target;F.target=target;F.mix=Math.min(F.mix,0.0);}
    if(F.a!==F.b){F.mix+=dt/0.16;if(F.mix>=1){F.a=F.b;F.mix=0;}}
  }
  if(mood==='eager')p.mouthPulse=Math.max(p.mouthPulse,0.25+0.25*Math.sin(t*12));
  this.eyeGlow=lerp(this.eyeGlow,(mood==='angry'||this.anger>0.55)?1:0,1-Math.exp(-dt*4));
  // ghosts for dash
  this.vx=o.vx||0;
};

// ---------- deformations (source space) -------------
const tmp=[0,0];
Hachi.prototype.defUpper=function(m,i,out){
  const p=this.p;let x=m.sx[i],y=m.sy[i];
  const W=m.w;
  // breathing (chest)
  // chest/bust: rigid (no breathing / wobble deformation)
  // arms
  rot(x,y,476,446,p.armL,W.armL[i],tmp);x=tmp[0];y=tmp[1];
  rot(x,y,742,446,p.armR,W.armR[i],tmp);x=tmp[0];y=tmp[1];
  // head & hat
  // head/hat: rigid
  // front hair sway
  // front hair strands lie on top of the bust in the same layer, so they are not warped (keeps chest rigid)
  const u=this.uScale();
  out[0]=610+(x-610)*u;out[1]=470+(y-470)*u;
};
Hachi.prototype.upperOffset=function(){
  // upper body follows belly top + bob + lift
  const b=this.b;
  return {x:this.p.ux+b.bx*0.04,y:this.bob*1.0+b.by*0.12-this.lift+(b.g-1)*0-b.sq*25};
};
Hachi.prototype.defBelly=function(m,i,out){
  const b=this.b;let x=m.sx[i],y=m.sy[i];
  let ux=x-PIV.x,uy=y-PIV.y;
  // ripples
  for(const r of this.ripples){
    const dx=x-r.x,dy=y-r.y,d=Math.sqrt(dx*dx+dy*dy)+1e-3;
    const dent=-r.a*34*Math.exp(-(d*d)/(70*70))*Math.exp(-r.t*10);
    const wave=r.a*16*Math.sin(d*0.042-r.t*24)*Math.exp(-d/280)*Math.exp(-r.t*3.2)*ss(0,0.05,r.t);
    const cx=x-BELLY_C.x,cy=y-BELLY_C.y,cd=Math.sqrt(cx*cx+cy*cy)+1e-3;
    ux+=cx/cd*dent+dx/d*wave;uy+=cy/cd*dent+dy/d*wave;
  }
  // upper roll secondary jiggle
  const wr=m.w.roll[i];
  if(wr){uy+=b.roll*0.35*wr;ux+=b.rollx*wr*(ux/300);}
  const h=clamp(uy/BELLY_H,0,1.2);
  const u=this.uScale(),rr=Math.sqrt(ux*ux/2.6+uy*uy);
  const g=lerp(u,b.g,ss(10,170,rr));
  ux*=g*(1+b.sq*0.8*(0.35+0.65*h));
  uy*=g*(1-b.sq*(0.25+0.75*h));
  uy+=b.by*(0.12+0.88*h);
  ux+=b.bx*Math.pow(h,1.25);
  let X=PIV.x+ux+this.p.ux*0.3,Y=PIV.y+uy+this.bob*(1-h*0.5)-this.lift-b.sq*25;
  // soft ground contact
  const lim=GROUND-6,m0=46;
  if(Y>lim-m0){const e=Y-(lim-m0);const ny=lim-m0+m0*(1-Math.exp(-e/m0));X+=(X-PIV.x)*(e-(ny-(lim-m0)))*0.0012;Y=ny;}
  out[0]=X;out[1]=Y;
};
Hachi.prototype.defSkirt=function(m,i,out){
  const p=this.p,b=this.b;let x=m.sx[i],y=m.sy[i];
  const hy=clamp((y-880)/840,0,1);
  const sw=1+(b.g-1)*0.6;
  let X=610+(x-610)*sw*(1+b.sq*0.3*hy);
  X+=p.hipSway*hy+b.bx*0.25*(1-hy);
  let Y=y;
  const he=ss(0.62,1,hy);
  Y-=p.liftL*40*Math.exp(-Math.pow((x-552)/95,2))*he;
  Y-=p.liftR*40*Math.exp(-Math.pow((x-805)/95,2))*he;
  Y+=Math.sin(x*0.018+this.t*4.2)*3.5*ss(0.75,1,hy)*Math.min(1,this.walkAmt+0.3);
  X+=Math.sin(y*0.01+this.t*2.7)*3*hy;
  Y+=(this.bob+b.by*0.2)*(1-hy*0.9);
  out[0]=X;out[1]=Y;
};
Hachi.prototype.defLeg=function(m,i,side,out){
  const p=this.p,b=this.b;const x=m.sx[i],y=m.sy[i];
  const lift=side==='L'?p.liftL:p.liftR;
  const cx=side==='L'?552:805,ay=side==='L'?1860:1800;
  const spread=(cx-610)*(b.g-1)*0.35;
  const sc=1+lift*0.06;
  let X=cx+(x-cx)*sc+spread+p.hipSway*0.4,Y=ay+(y-ay)*sc-lift*54;
  const r=(side==='L'?-1:1)*lift*0.08;
  const dx=X-cx,dy=Y-ay;X=cx+dx*Math.cos(r)-dy*Math.sin(r);Y=ay+dx*Math.sin(r)+dy*Math.cos(r);
  out[0]=X;out[1]=Y;
};
Hachi.prototype.defHair=function(m,i,out){
  const p=this.p;let x=m.sx[i],y=m.sy[i];
  rot(x,y,607,222,p.headRot,m.w.head[i],tmp);x=tmp[0];y=tmp[1];
  const s=m.w.sway[i];x+=p.hairSway*26*s;y-=Math.abs(p.hairSway)*4*s;
  const u=this.uScale();
  out[0]=610+(x-610)*u;out[1]=470+(y-470)*u;
};
Hachi.prototype.defFace=function(m,i,out){
  const p=this.p;
  // local expression warps first
  let x=m.sx[i],y=m.sy[i];
  const bl=p.blink*(this.face.a==='grin'||this.face.a==='shock'?0:1);
  if(bl){
    let w=m.w.eyeL[i];if(w)y+=(EYES[0][1]+1.8-y)*w*bl*0.92;
    w=m.w.eyeR[i];if(w)y+=(EYES[1][1]+1.8-y)*w*bl*0.92;
  }
  const mp=p.mouthPulse;
  if(mp){const w=m.w.mouth[i];if(w)y+=(y-(MOUTH[1]-3))*w*mp*0.55;}
  m.sx2=m.sx2||new Float32Array(m.n);m.sy2=m.sy2||new Float32Array(m.n);
  // then the same upper-body transform
  const ox=m.sx[i],oy=m.sy[i];m.sx[i]=x;m.sy[i]=y;
  this.defUpper(m,i,out);
  m.sx[i]=ox;m.sy[i]=oy;
};

// ---------- drawing --------------------------------------------------------
// view: {x,y,ppu} screen position of ground anchor, pixels per world unit; opts {alpha,tint,flash}
Hachi.prototype.makeXf=function(view){
  const sc=view.ppu*K,tl=this.p.tilt+(view.tilt||0),c=Math.cos(tl),s=Math.sin(tl);
  const ox=view.x,oy=view.y,sx=view.sx||1,sy=view.sy||1;
  return (X,Y,out)=>{const lx=(X-ANCHOR_X)*sc*sx,ly=(Y-GROUND)*sc*sy;out[0]=ox+lx*c-ly*s;out[1]=oy+lx*s+ly*c;};
};
Hachi.prototype.drawMesh=function(m,tex,xf,def,alpha,tint,flash,extra){
  const P=m.P,o=[0,0];
  const off=extra&&extra.off;
  for(let i=0;i<m.n;i++){
    def.call(this,m,i,o);
    if(off){o[0]+=off.x;o[1]+=off.y;}
    xf(o[0],o[1],o);P[i*2]=o[0];P[i*2+1]=o[1];
  }
  this.R.mesh(tex,P,m.uvA||m.uv,m.uv2,m.idx,tint[0],tint[1],tint[2],alpha,extra&&extra.mix||0,flash||0);
};
Hachi.prototype.draw=function(view,opt){
  opt=opt||{};
  const xf=this.makeXf(view),a=opt.alpha==null?1:opt.alpha,tint=opt.tint||[0.93,0.94,1.0];
  const off=this.upperOffset();
  const m=this.m,T=this.tex;
  this.drawMesh(m.hair,T.hair,xf,this.defHair,a,tint,0,{off:off});
  const lowA=a*(1-ss(1.75,2.5,this.b.g));
  if(lowA>0.01){
  this.drawMesh(m.legL,T.legL,xf,(mm,i,o)=>this.defLeg(mm,i,'L',o),lowA,tint,0);
  this.drawMesh(m.legR,T.legR,xf,(mm,i,o)=>this.defLeg(mm,i,'R',o),lowA,tint,0);
  this.drawMesh(m.skirt,T.skirt,xf,this.defSkirt,lowA,tint,0);}
  this.drawMesh(m.belly,T.belly,xf,this.defBelly,a,tint,this.b.flash+(opt.flash||0));
  this.drawMesh(m.upper,T.upper,xf,this.defUpper,a,tint,opt.flash||0,{off:off});
  // face with expression atlas crossfade
  const names=this.faceMeta.names,F=this.face;
  const ia=Math.max(0,names.indexOf(F.a)),ib=Math.max(0,names.indexOf(F.b));
  m.face.setAtlas(ia,ib,names.length);
  this.drawMesh(m.face,T.faces,xf,this.defFace,a,tint,opt.flash||0,{off:off,mix:F.a===F.b?0:Math.max(0.0001,F.mix)});
};
// screen positions of useful anchors (for effects)
Hachi.prototype.anchors=function(view){
  const off=this.upperOffset(),xf=this.makeXf(view),o=[0,0],r={};
  const up=(x,y)=>{
    // approximate head transform: rotate around neck
    rot(x,y,607,222,this.p.headRot,1,tmp);const u=this.uScale();const X=610+(tmp[0]-610)*u+off.x,Y=470+(tmp[1]-470)*u+off.y;xf(X,Y,o);return [o[0],o[1]];};
  r.eyeL=up(EYES[0][0]+1,EYES[0][1]);r.eyeR=up(EYES[1][0]-1,EYES[1][1]);
  r.mouth=up(MOUTH[0],MOUTH[1]);r.head=up(607,150);r.hatTop=up(607,40);r.hatSide=up(735,95);
  const bc=this.bellyCenterS();xf(bc.x,bc.y+this.bob,o);r.belly=[o[0],o[1]];
  xf(610+470*this.b.g,bc.y,o);r.bellyR=[o[0],o[1]];
  xf(610,445-this.lift,o);r.bellyTop=[o[0],o[1]];
  xf(ANCHOR_X,GROUND,o);r.feet=[o[0],o[1]];
  r.scale=view.ppu*K;
  return r;
};
// convert a screen point to belly source coords (inverse approx, ignoring jiggle)
Hachi.prototype.screenToBelly=function(view,px,py){
  const sc=view.ppu*K;const X=(px-view.x)/sc+ANCHOR_X,Y=(py-view.y)/sc+GROUND;
  const g=this.b.g;const x=PIV.x+(X-PIV.x)/g,y=PIV.y+(Y+this.lift-PIV.y)/g;
  return {x:x,y:y,inside:Math.pow((x-610)/470,2)+Math.pow((y-850)/420,2)<1};
};
Hachi.K=K;Hachi.GROUND=GROUND;

// procedural back hair (drawn behind the body), in source space box (350,150)-(880,570)
function makeBackHair(){
  const sc=0.6,W=530,H=420,c=document.createElement('canvas');c.width=Math.round(W*sc);c.height=Math.round(H*sc);
  const x=c.getContext('2d');x.scale(sc,sc);x.translate(-350,-150);
  function mass(side){
    const f=(px)=>side<0?px:1214-px;
    const grad=x.createLinearGradient(0,170,0,560);grad.addColorStop(0,'#0b0b13');grad.addColorStop(0.6,'#141625');grad.addColorStop(1,'#1d2033');
    x.fillStyle=grad;
    x.beginPath();x.moveTo(f(560),170);
    x.bezierCurveTo(f(500),220,f(420),300,f(392),400);
    x.bezierCurveTo(f(372),470,f(372),520,f(382),556);
    x.bezierCurveTo(f(410),540,f(440),520,f(458),505);
    x.bezierCurveTo(f(470),430,f(505),320,f(575),210);x.closePath();x.fill();
    // strands / sheen
    for(let k=0;k<16;k++){
      const t=k/15,sx=lerp(560,575,t),ex=lerp(380,458,t)+Math.sin(k*7.1)*6,ey=lerp(552,505,t)+Math.sin(k*3.3)*8;
      x.strokeStyle=k%3===0?'rgba(120,135,190,0.32)':'rgba(70,80,120,0.28)';x.lineWidth=k%3===0?2.2:1.4;
      x.beginPath();x.moveTo(f(sx),175+t*30);x.bezierCurveTo(f(lerp(470,520,t)),260,f(lerp(400,470,t)),380,f(ex),ey);x.stroke();
    }
  }
  mass(-1);mass(1);
  return c;
}
window.Hachi=Hachi;
})();
