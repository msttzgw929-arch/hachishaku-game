// 3D night-town: procedural map, baked vertex lighting, merged geometry, collision & navigation.
(function(){
'use strict';
const T=THREE;
const CELL=2,N=80,SIZE=N*CELL,CH=20; // CH = chunk size in cells
const FOG_COLOR=new T.Color(0x0b0d1a),FOG_DENS=0.034;
const B_FLOOR0=3.2,B_FLOOR=3.0;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;

// ---------------------------------------------------------------- shaders
const WORLD_VS=`precision highp float;
uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float time;
attribute vec3 position;attribute vec2 uv;attribute vec3 color;attribute float flick;
varying vec2 vUv;varying vec3 vCol;varying float vFog;varying float vFl;
void main(){vUv=uv;vCol=color;vec4 mv=modelViewMatrix*vec4(position,1.0);vFog=-mv.z;
 float fl=1.0;if(flick>0.0){float k=floor(time*13.0+flick*37.0);float r=fract(sin(k*12.9898+flick*78.233)*43758.5453);fl=r<0.1?0.12:(r<0.17?0.55:1.0);}vFl=fl;
 gl_Position=projectionMatrix*mv;}`;
const WORLD_FS=`precision mediump float;
uniform sampler2D map;uniform vec3 fogColor;uniform float fogDensity;uniform float emis;uniform float gain;
varying vec2 vUv;varying vec3 vCol;varying float vFog;varying float vFl;
void main(){vec4 t=texture2D(map,vUv);float e=clamp((1.0-t.a)*2.0,0.0,1.0)*vFl;vec3 c=t.rgb*(vCol*gain+e*emis);
 float f=1.0-exp(-vFog*vFog*fogDensity*fogDensity);f*=1.0-0.6*e;gl_FragColor=vec4(mix(c,fogColor,f),1.0);}`;
const DECAL_FS=`precision mediump float;
uniform sampler2D map;uniform vec3 fogColor;uniform float fogDensity;uniform float additive;
varying vec2 vUv;varying vec3 vCol;varying float vFog;varying float vFl;
void main(){vec4 t=texture2D(map,vUv);float f=1.0-exp(-vFog*vFog*fogDensity*fogDensity);
 if(additive>0.5){gl_FragColor=vec4(t.rgb*t.a*vCol*vFl*(1.0-f),1.0);}
 else{gl_FragColor=vec4(mix(t.rgb*vCol*1.7,fogColor,f),t.a);}}`;
const GLOW_VS=`precision highp float;
uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float time;
attribute vec3 position;attribute vec2 corner;attribute float size;attribute vec3 color;attribute float flick;
varying vec2 vC;varying vec3 vCol;varying float vFog;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vFog=-mv.z;mv.xy+=corner*size;vC=corner;
 float fl=1.0;if(flick>0.0){float k=floor(time*13.0+flick*37.0);float r=fract(sin(k*12.9898+flick*78.233)*43758.5453);fl=r<0.1?0.12:(r<0.17?0.55:1.0);}
 vCol=color*fl;gl_Position=projectionMatrix*mv;}`;
const GLOW_FS=`precision mediump float;uniform float fogDensity;varying vec2 vC;varying vec3 vCol;varying float vFog;
void main(){float r=length(vC);float a=pow(max(0.0,1.0-r),2.2)*0.55+exp(-r*r*40.0)*0.9;float f=exp(-vFog*vFog*fogDensity*fogDensity*0.45);
 gl_FragColor=vec4(vCol*a*f,1.0);}`;
const LINE_VS=`precision highp float;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;attribute vec3 position;varying float vFog;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vFog=-mv.z;gl_Position=projectionMatrix*mv;}`;
const LINE_FS=`precision mediump float;uniform vec3 col;uniform vec3 fogColor;uniform float fogDensity;varying float vFog;
void main(){float f=1.0-exp(-vFog*vFog*fogDensity*fogDensity);gl_FragColor=vec4(mix(col,fogColor,f),1.0);}`;
const SKY_VS=`precision highp float;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;attribute vec3 position;varying vec3 vD;
void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`;
const SKY_FS=`precision highp float;varying vec3 vD;uniform vec3 fogColor;uniform vec3 moonDir;
float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){vec3 d=normalize(vD);float y=d.y;
 vec3 top=vec3(0.006,0.008,0.025),mid=vec3(0.03,0.035,0.08);
 vec3 c=mix(fogColor,mid,smoothstep(-0.02,0.18,y));c=mix(c,top,smoothstep(0.18,0.8,y));
 float md=dot(d,moonDir);c+=vec3(0.55,0.6,0.8)*pow(max(md,0.0),220.0)*0.5+vec3(0.12,0.13,0.2)*pow(max(md,0.0),12.0)*0.35;
 if(md>0.9993)c=mix(c,vec3(0.93,0.9,0.8),smoothstep(0.9993,0.9996,md));
 vec3 q=floor(d*300.0);float s=h(q);if(s>0.9975&&y>0.12)c+=vec3(0.6)*(s-0.9975)*400.0*smoothstep(0.12,0.4,y);
 gl_FragColor=vec4(c,1.0);}`;

function rawMat(o){return new T.RawShaderMaterial(o);}
function mkTex(canvas,repeat,aniso){const t=new T.CanvasTexture(canvas);t.colorSpace=T.NoColorSpace;if(repeat){t.wrapS=t.wrapT=T.RepeatWrapping;}t.anisotropy=aniso||1;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.needsUpdate=true;return t;}

// ---------------------------------------------------------------- geometry builder
function GB(){this.p=[];this.u=[];this.c=[];this.f=[];this.i=[];this.n=0;}
GB.prototype.v=function(x,y,z,u,v,c,fl){this.p.push(x,y,z);this.u.push(u,v);this.c.push(c[0],c[1],c[2]);this.f.push(fl||0);return this.n++;};
GB.prototype.quad=function(P,UV,C,fl){const a=this.n;for(let k=0;k<4;k++)this.v(P[k][0],P[k][1],P[k][2],UV[k][0],UV[k][1],C[k],fl);this.i.push(a,a+1,a+2,a,a+2,a+3);};
GB.prototype.geo=function(){
  if(!this.n)return null;const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.u,2));
  g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setAttribute('flick',new T.Float32BufferAttribute(this.f,1));
  g.setIndex(this.n>65535?new T.BufferAttribute(new Uint32Array(this.i),1):new T.BufferAttribute(new Uint16Array(this.i),1));
  g.computeBoundingSphere();return g;
};

// ---------------------------------------------------------------- world
function World(renderer){
  this.renderer=renderer;
  this.R=Tex3D.rng(8818);
  this.grid=new Uint8Array(N*N).fill(1);   // 0 street,1 building,2 lot
  this.hmap=new Float32Array(N*N);         // building height per cell
  this.boxes=[];                           // small colliders [x0,z0,x1,z1]
  this.boxCells=new Map();
  this.lights=[];
  this.buildings=[];
  this.signs=[];this.poles=[];this.vends=[];this.lots=[];this.decalList=[];this.glows=[];this.wires=[];
  this.gen();
  this.placeProps();
  this.bucketLights();
  this.build();
  this.minimap=this.makeMinimap();
}
World.CELL=CELL;World.N=N;World.SIZE=SIZE;World.FOG_COLOR=FOG_COLOR;World.FOG_DENS=FOG_DENS;
const W=World.prototype;
W.idx=(cx,cz)=>cz*N+cx;
W.cellAt=function(x,z){return [Math.floor(x/CELL),Math.floor(z/CELL)];};
W.type=function(cx,cz){if(cx<0||cz<0||cx>=N||cz>=N)return 1;return this.grid[cz*N+cx];};
W.blockedCell=function(cx,cz){return this.type(cx,cz)===1;};
W.walkable=function(x,z){return !this.blockedCell(Math.floor(x/CELL),Math.floor(z/CELL));};
W.heightAt=function(cx,cz){if(cx<0||cz<0||cx>=N||cz>=N)return 60;return this.grid[cz*N+cx]===1?this.hmap[cz*N+cx]:0;};

W.gen=function(){
  const R=this.R,g=this.grid;
  const xs=[],zs=[];
  const lines=(arr)=>{let p=2+Math.floor(R()*2);while(p<N-7){const w=R()<0.45?4:3;arr.push([p,p+w]);p+=w+8+Math.floor(R()*5);}};
  lines(xs);lines(zs);this.xs=xs;this.zs=zs;
  const set=(x0,z0,x1,z1,v)=>{for(let z=Math.max(0,z0);z<Math.min(N,z1);z++)for(let x=Math.max(0,x0);x<Math.min(N,x1);x++)g[z*N+x]=v;};
  const lastX=xs[xs.length-1][1],lastZ=zs[zs.length-1][1],firstX=xs[0][0],firstZ=zs[0][0];
  for(const s of xs)set(s[0],firstZ,s[1],lastZ,0);
  for(const s of zs)set(firstX,s[0],lastX,s[1],0);
  // blocks
  const blocks=[];
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++)blocks.push({x0:xs[i][1],x1:xs[i+1][0],z0:zs[j][1],z1:zs[j+1][0]});
  // choose lots (not too many, spread out)
  const order=blocks.map((b,i)=>i).sort(()=>R()-0.5);
  const kinds=['shrine','parking','empty','parking','empty'];let li=0;
  const footprints=[];
  for(const bi of order){
    const b=blocks[bi];
    if(li<kinds.length&&b.x1-b.x0>=6&&b.z1-b.z0>=6&&!this.lots.some(l=>Math.abs(l.x0-b.x0)<14&&Math.abs(l.z0-b.z0)<14)){
      const kind=kinds[li++];
      // lot occupies part of the block (keep a row of buildings at the back)
      const lot={kind:kind,x0:b.x0,x1:b.x1,z0:b.z0,z1:b.z1};
      if(b.z1-b.z0>=9){lot.z1=b.z0+Math.max(5,Math.floor((b.z1-b.z0)*0.65));footprints.push(...this.split({x0:b.x0,x1:b.x1,z0:lot.z1,z1:b.z1}));}
      set(lot.x0,lot.z0,lot.x1,lot.z1,2);this.lots.push(lot);continue;
    }
    // alleys
    const rects=[];
    const wx=b.x1-b.x0,wz=b.z1-b.z0;
    if(R()<0.6&&(wx>=8||wz>=8)){
      const vertical=wx>=wz?true:false,aw=R()<0.55?1:2;
      if(vertical){
        const ax=b.x0+3+Math.floor(R()*(wx-6-aw+1));const dead=R()<0.4,am=dead?b.z0+Math.floor(wz*0.55):b.z1;
        set(ax,b.z0,ax+aw,am,0);
        rects.push({x0:b.x0,x1:ax,z0:b.z0,z1:b.z1},{x0:ax+aw,x1:b.x1,z0:b.z0,z1:b.z1});if(dead)rects.push({x0:ax,x1:ax+aw,z0:am,z1:b.z1});
      }else{
        const az=b.z0+3+Math.floor(R()*(wz-6-aw+1));const dead=R()<0.4,am=dead?b.x0+Math.floor(wx*0.55):b.x1;
        set(b.x0,az,am,az+aw,0);
        rects.push({x0:b.x0,x1:b.x1,z0:b.z0,z1:az},{x0:b.x0,x1:b.x1,z0:az+aw,z1:b.z1});if(dead)rects.push({x0:am,x1:b.x1,z0:az,z1:az+aw});
      }
    }else rects.push(b);
    for(const r of rects)if(r.x1>r.x0&&r.z1>r.z0)footprints.push(...this.split(r));
  }
  // border strips between map edge and first/last streets + outer ring
  footprints.push(...this.split({x0:0,x1:N,z0:0,z1:firstZ}),...this.split({x0:0,x1:N,z0:lastZ,z1:N}),
                  ...this.split({x0:0,x1:firstX,z0:firstZ,z1:lastZ}),...this.split({x0:lastX,x1:N,z0:firstZ,z1:lastZ}));
  for(const f of footprints){
    let edge=f.x0===0||f.z0===0||f.x1===N||f.z1===N;
    const floors=edge?3+Math.floor(R()*4):1+Math.floor(Math.pow(R(),1.4)*6);
    const h=B_FLOOR0+(floors-1)*B_FLOOR+(R()<0.3?0.6:0);
    const b={x0:f.x0,x1:f.x1,z0:f.z0,z1:f.z1,h:h,floors:floors,var:R()<0.55?0:1,tint:0.72+R()*0.4,hue:R(),ou:Math.floor(R()*8),ov:Math.floor(R()*8),os:Math.floor(R()*4)};
    this.buildings.push(b);
    for(let z=f.z0;z<f.z1;z++)for(let x=f.x0;x<f.x1;x++){g[z*N+x]=1;this.hmap[z*N+x]=h;}
  }
  // intersections list
  this.inters=[];for(const a of xs)for(const c of zs)this.inters.push({x0:a[0],x1:a[1],z0:c[0],z1:c[1]});
};
W.split=function(r){
  const R=this.R,out=[];
  const rec=(r)=>{const w=r.x1-r.x0,d=r.z1-r.z0;if(w<=0||d<=0)return;
    const big=Math.max(w,d);
    if(big>5||(big>=4&&R()<0.5)){
      if(w>=d){const s=r.x0+2+Math.floor(R()*(w-3));if(s<=r.x0||s>=r.x1){out.push(r);return;}rec({x0:r.x0,x1:s,z0:r.z0,z1:r.z1});rec({x0:s,x1:r.x1,z0:r.z0,z1:r.z1});}
      else{const s=r.z0+2+Math.floor(R()*(d-3));if(s<=r.z0||s>=r.z1){out.push(r);return;}rec({x0:r.x0,x1:r.x1,z0:r.z0,z1:s});rec({x0:r.x0,x1:r.x1,z0:s,z1:r.z1});}
    }else out.push(r);};
  rec(r);return out;
};
W.addBox=function(x0,z0,x1,z1){const b=[Math.min(x0,x1),Math.min(z0,z1),Math.max(x0,x1),Math.max(z0,z1)];this.boxes.push(b);
  for(let cz=Math.floor(b[1]/CELL);cz<=Math.floor(b[3]/CELL);cz++)for(let cx=Math.floor(b[0]/CELL);cx<=Math.floor(b[2]/CELL);cx++){const k=cz*N+cx;if(!this.boxCells.has(k))this.boxCells.set(k,[]);this.boxCells.get(k).push(b);}};
W.addLight=function(x,y,z,col,inten,r){this.lights.push({x:x,y:y,z:z,c:col,i:inten,r:r||12,r0:(r||12)*0.32});};

// ---------------------------------------------------------------- props placement
W.placeProps=function(){
  const R=this.R;
  const isWalk=(cx,cz)=>this.type(cx,cz)!==1;
  const occupied=[];const free=(x,z,r)=>!occupied.some(o=>Math.hypot(o[0]-x,o[1]-z)<r+o[2]);const occ=(x,z,r)=>occupied.push([x,z,r]);
  // utility poles + street lamps along streets
  const lineStreet=(span,vertical)=>{
    const side=R()<0.5?0:1;const fixed=side?span[1]*CELL-0.35:span[0]*CELL+0.35;
    const outCell=side?span[1]:span[0]-1;
    let prev=null,k=0;
    for(let t=2;t<N-2;t+=3+Math.floor(R()*2)){
      const cx=vertical?outCell:t,cz=vertical?t:outCell;
      const sc=vertical?(side?span[1]-1:span[0]):t,sz=vertical?t:(side?span[1]-1:span[0]);
      if(!(vertical?isWalk(sc,t):isWalk(t,sz)))continue;
      if(isWalk(cx,cz)){prev=null;continue;} // intersection gap: break wires
      const x=vertical?fixed:t*CELL+1,z=vertical?t*CELL+1:fixed;
      if(!free(x,z,1.2))continue;
      const lamp=(k++%2===0);const toC=side?-1:1;
      const p={x:x,z:z,lamp:lamp,ax:vertical?toC:0,az:vertical?0:toC};this.poles.push(p);occ(x,z,0.8);this.addBox(x-0.2,z-0.2,x+0.2,z+0.2);
      if(lamp){const lx=x+p.ax*1.1,lz=z+p.az*1.1;this.addLight(lx,5.3,lz,[0.78,0.92,1.0],1.25,13);this.glows.push({x:lx,y:5.15,z:lz,s:0.9,c:[0.55,0.7,0.85]});this.decalList.push({k:'pool',x:lx,z:lz,s:7,c:[0.22,0.3,0.36]});}
      if(prev)this.wires.push([prev,p]);prev=p;
    }
  };
  for(const s of this.xs)lineStreet(s,true);
  for(const s of this.zs)lineStreet(s,false);
  // wall-adjacent street spots: [x,z,nx,nz] where n points from wall into street
  const spots=[];
  for(let cz=1;cz<N-1;cz++)for(let cx=1;cx<N-1;cx++){
    if(this.type(cx,cz)!==0)continue;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      if(this.type(cx+dx,cz+dz)===1&&this.heightAt(cx+dx,cz+dz)>=B_FLOOR0){
        // spot on wall face, center of cell edge
        const x=(cx+0.5+dx*0.5)*CELL,z=(cz+0.5+dz*0.5)*CELL;spots.push([x,z,-dx,-dz,cx,cz]);
      }
    }
  }
  spots.sort(()=>R()-0.5);
  let nv=0,ns=0,nl=0;
  const vendRegions=['vendA','vendB','vendC'];
  for(const s of spots){
    const [x,z,nx,nz]=s;
    if(nv<22&&R()<0.5&&free(x,z,3)){ // vending machine pair
      const cnt=R()<0.5?2:1;
      for(let k=0;k<cnt;k++){const off=(k-(cnt-1)/2)*1.05;const px=x+(nz!==0?off:0)+nx*0.42,pz=z+(nx!==0?off:0)+nz*0.42;
        this.vends.push({x:px,z:pz,nx:nx,nz:nz,reg:vendRegions[Math.floor(R()*3)]});nv++;
        this.addBox(px-(nx?0.4:0.52),pz-(nz?0.4:0.52),px+(nx?0.4:0.52),pz+(nz?0.4:0.52));}
      const lx=x+nx*1.3,lz=z+nz*1.3;this.addLight(lx,1.2,lz,[0.85,0.95,1.05],1.5,9);this.glows.push({x:x+nx*0.9,y:1.3,z:z+nz*0.9,s:1.5,c:[0.35,0.42,0.5]});
      this.decalList.push({k:'pool',x:x+nx*1.6,z:z+nz*1.6,s:5,c:[0.3,0.36,0.42]});occ(x,z,2.5);continue;
    }
    if(ns<30&&R()<0.5&&free(x,z,2.5)){ // protruding neon sign
      const i=Math.floor(R()*8),y=3.8+R()*2.5;const cols=[[0.75,0.45,1],[1,0.37,0.75],[0.29,0.78,1],[0.49,1,0.81],[1,0.3,0.24],[0.9,0.9,1],[0.62,1,0.35],[1,0.83,0.42]];
      const fl=R()<0.3?(1+R()*9):0;
      this.signs.push({x:x+nx*0.75,z:z+nz*0.75,y:y,nx:nx,nz:nz,reg:'vsign'+i,fl:fl});ns++;
      const c=cols[i];this.addLight(x+nx*1.2,y+1,z+nz*1.2,c.map(v=>v*0.9),1.0,10);this.glows.push({x:x+nx*0.75,y:y+1.2,z:z+nz*0.75,s:2.4,c:c.map(v=>v*0.35),fl:fl});occ(x,z,1.5);continue;
    }
    if(nl<12&&R()<0.3&&free(x,z,2)){ // red lanterns
      this.signs.push({x:x+nx*0.35,z:z+nz*0.35,y:2.3,nx:nx,nz:nz,reg:'lantern',lantern:true});nl++;
      this.addLight(x+nx*0.8,2.2,z+nz*0.8,[1,0.35,0.22],1.0,7);this.glows.push({x:x+nx*0.4,y:2.3,z:z+nz*0.4,s:1.1,c:[0.6,0.18,0.1]});occ(x,z,1.5);
    }
  }
  // curve mirrors at some intersections
  for(const it of this.inters){
    if(R()<0.35){const cx=R()<0.5?it.x0:it.x1-1,cz=R()<0.5?it.z0:it.z1-1;const x=(cx+(cx===it.x0?0.15:0.85))*CELL,z=(cz+(cz===it.z0?0.15:0.85))*CELL;
      if(free(x,z,1)){this.mirrors=this.mirrors||[];const ang=Math.atan2((it.x0+it.x1)/2*CELL-x,(it.z0+it.z1)/2*CELL-z);this.mirrors.push({x:x,z:z,a:ang});occ(x,z,0.6);this.addBox(x-0.12,z-0.12,x+0.12,z+0.12);}}
    // road markings
    if(R()<0.5){const w=it.x1-it.x0;const z=it.z0*CELL-2.2,x=(it.x0+w/2)*CELL;if(this.type(it.x0,it.z0-1)===0&&this.type(it.x0,it.z0-2)===0)this.decalList.push({k:'tomare',x:x,z:z,s:Math.min(w*CELL*0.7,4.5),rot:0});}
  }
  // manholes
  for(let i=0;i<40;i++){const cx=Math.floor(R()*N),cz=Math.floor(R()*N);if(this.type(cx,cz)===0)this.decalList.push({k:'manhole',x:(cx+0.5)*CELL,z:(cz+0.5)*CELL,s:0.9});}
  // lots
  for(const L of this.lots)this.dressLot(L,free,occ);
};
W.dressLot=function(L,free,occ){
  const R=this.R,x0=L.x0*CELL,x1=L.x1*CELL,z0=L.z0*CELL,z1=L.z1*CELL,cx=(x0+x1)/2,cz=(z0+z1)/2;
  L.walls=[];
  // block walls on street-facing edges with an opening
  const edges=[['z0',x0,z0,x1,z0,0,-1],['z1',x0,z1,x1,z1,0,1],['x0',x0,z0,x0,z1,-1,0],['x1',x1,z0,x1,z1,1,0]];
  for(const e of edges){
    const [nm,ax,az,bx,bz,nx,nz]=e;const len=Math.hypot(bx-ax,bz-az),segs=Math.round(len/CELL);
    const outside=this.type(Math.floor((ax+bx)/2/CELL+nx*0.5),Math.floor((az+bz)/2/CELL+nz*0.5));
    if(outside===1)continue;
    const gapA=1+Math.floor(R()*(segs-3)),gapW=L.kind==='parking'?3:2;
    for(let s=0;s<segs;s++){
      if(s>=gapA&&s<gapA+gapW){if(L.kind==='shrine'&&s===gapA)L.gate={x:ax+(bx-ax)*(s+gapW/2)/segs,z:az+(bz-az)*(s+gapW/2)/segs,nx:nx,nz:nz};continue;}
      const px=ax+(bx-ax)*s/segs,pz=az+(bz-az)*s/segs,qx=ax+(bx-ax)*(s+1)/segs,qz=az+(bz-az)*(s+1)/segs;
      const t=0.075;L.walls.push([px,pz,qx,qz]);
      this.addBox(Math.min(px,qx)-(nx?t:0),Math.min(pz,qz)-(nz?t:0),Math.max(px,qx)+(nx?t:0),Math.max(pz,qz)+(nz?t:0));
    }
  }
  L.items=[];
  const sign=(reg,x,z,a)=>{L.items.push({k:'board',reg:reg,x:x,z:z,a:a});this.addBox(x-0.6,z-0.6,x+0.6,z+0.6);};
  if(L.kind==='shrine'){
    const g=L.gate||{x:cx,z:z0,nx:0,nz:-1};L.gate=g;
    const inx=-g.nx,inz=-g.nz;const tx=g.x+inx*1.2,tz=g.z+inz*1.2;
    L.items.push({k:'torii',x:tx,z:tz,a:Math.atan2(g.nx,g.nz)});
    const px=-inz,pz=inx;this.addBox(tx+px*1.6-0.2,tz+pz*1.6-0.2,tx+px*1.6+0.2,tz+pz*1.6+0.2);this.addBox(tx-px*1.6-0.2,tz-pz*1.6-0.2,tx-px*1.6+0.2,tz-pz*1.6+0.2);
    // hokora at far side
    const far=Math.max(4,Math.min((Math.abs(inx)?(x1-x0):(z1-z0))-3,9));const hx=tx+inx*far,hz=tz+inz*far;
    L.items.push({k:'hokora',x:hx,z:hz,a:Math.atan2(g.nx,g.nz)});this.addBox(hx-0.9,hz-0.9,hx+0.9,hz+0.9);
    for(const s of [-1,1]){const lx=hx-inx*2+px*s*1.7,lz=hz-inz*2+pz*s*1.7;L.items.push({k:'tourou',x:lx,z:lz});this.addBox(lx-0.3,lz-0.3,lx+0.3,lz+0.3);
      this.addLight(lx,1.3,lz,[1,0.6,0.3],0.9,6);this.glows.push({x:lx,y:1.25,z:lz,s:0.5,c:[0.6,0.35,0.12],fl:0});}
    for(let k=0;k<Math.ceil(far/1.1);k++)this.decalList.push({k:'stone',x:tx+inx*(0.8+k*1.1),z:tz+inz*(0.8+k*1.1),s:0.8});
    for(let i=0;i<5;i++){const a=R()*6.28,r=3+R()*3;const ex=clamp(hx+Math.cos(a)*r,x0+1.2,x1-1.2),ez=clamp(hz+Math.sin(a)*r,z0+1.2,z1-1.2);if(Math.hypot(ex-tx,ez-tz)>2&&Math.hypot(ex-hx,ez-hz)>2){L.items.push({k:'tree',x:ex,z:ez,s:0.8+R()*0.6});this.addBox(ex-0.25,ez-0.25,ex+0.25,ez+0.25);}}
    sign('hsign5',g.x+px*2.3+inx*0.3,g.z+pz*2.3+inz*0.3,Math.atan2(g.nx,g.nz));
  }else if(L.kind==='parking'){
    const n=Math.floor((x1-x0-2)/2.6);
    for(let i=0;i<n;i++){const x=x0+1.6+i*2.6;this.decalList.push({k:'line',x:x+1.3,z:z0+3,w:0.12,d:5});if(R()<0.55){const c=[[0.55,0.07,0.08],[0.85,0.85,0.88],[0.1,0.12,0.16],[0.2,0.3,0.55]][Math.floor(R()*4)];L.items.push({k:'car',x:x,z:z0+3,c:c,a:R()<0.5?0:Math.PI});this.addBox(x-0.9,z0+0.8,x+0.9,z0+5.2);}}
    const sx=x1-1.2,sz=z1-1.5;L.items.push({k:'psign',x:sx,z:sz});this.addBox(sx-0.2,sz-0.2,sx+0.2,sz+0.2);this.addLight(sx,3,sz,[1,0.9,0.4],0.9,9);this.glows.push({x:sx,y:3.1,z:sz,s:1.6,c:[0.5,0.45,0.15]});
  }else{
    for(let i=0;i<6;i++){const ex=x0+1.5+R()*(x1-x0-3),ez=z0+1.5+R()*(z1-z0-3);const k=R()<0.5?'drum':'tires';L.items.push({k:k,x:ex,z:ez});this.addBox(ex-0.4,ez-0.4,ex+0.4,ez+0.4);}
    sign(R()<0.5?'hsign3':'hsign4',cx,z0+1,0);
    for(let i=0;i<3;i++){const ex=x0+1.5+R()*(x1-x0-3),ez=z0+1.5+R()*(z1-z0-3);L.items.push({k:'tree',x:ex,z:ez,s:0.6+R()*0.5});this.addBox(ex-0.25,ez-0.25,ex+0.25,ez+0.25);}
  }
};

// ---------------------------------------------------------------- lighting
W.bucketLights=function(){
  this.lb=new Map();const B=8;
  for(const L of this.lights){const r=L.r;for(let bz=Math.floor((L.z-r)/B);bz<=Math.floor((L.z+r)/B);bz++)for(let bx=Math.floor((L.x-r)/B);bx<=Math.floor((L.x+r)/B);bx++){const k=bz*1000+bx;if(!this.lb.has(k))this.lb.set(k,[]);this.lb.get(k).push(L);}}
};
const MOON=(()=>{const v=[0.35,0.85,0.4];const l=Math.hypot(...v);return v.map(a=>a/l);})();
W.occluded=function(px,py,pz,L){
  const dx=L.x-px,dz=L.z-pz,d=Math.hypot(dx,dz);if(d<0.6)return false;
  const n=Math.ceil(d/0.7);
  for(let k=1;k<n;k++){const t=k/n,x=px+dx*t,z=pz+dz*t,y=py+(L.y-py)*t;const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);
    if(this.type(cx,cz)===1&&y<this.heightAt(cx,cz))return true;}
  return false;
};
W.lightAt=function(x,y,z,nx,ny,nz,noOcc){
  const md=Math.max(0,nx*MOON[0]+ny*MOON[1]+nz*MOON[2]);
  const hgt=clamp(y/18,0,1);
  let r=0.085+0.1*md+0.03*hgt,g=0.095+0.115*md+0.035*hgt,b=0.16+0.2*md+0.05*hgt;
  const list=this.lb.get(Math.floor(z/8)*1000+Math.floor(x/8));
  if(list){
    const ox=x+nx*0.35,oy=y+ny*0.35,oz=z+nz*0.35;
    for(const L of list){
      const dx=L.x-x,dy=L.y-y,dz=L.z-z,d2=dx*dx+dy*dy+dz*dz;if(d2>L.r*L.r)continue;
      const d=Math.sqrt(d2)+1e-4;let ndl=(dx*nx+dy*ny+dz*nz)/d;if(ndl<=0)continue;ndl=0.25+0.75*ndl;
      const q=1-d2/(L.r*L.r);const att=L.i/(1+d2/(L.r0*L.r0))*q*q;
      if(att<0.01)continue;
      if(!noOcc&&this.occluded(ox,oy,oz,L))continue;
      r+=L.c[0]*att*ndl;g+=L.c[1]*att*ndl;b+=L.c[2]*att*ndl;
    }
  }
  return [Math.min(r,1.6),Math.min(g,1.6),Math.min(b,1.6)];
};

// ---------------------------------------------------------------- mesh building
W.build=function(){
  const R=this.R,ren=this.renderer,aniso=Math.min(4,ren.capabilities.getMaxAnisotropy());
  const uni=()=>({map:{value:null},fogColor:{value:FOG_COLOR},fogDensity:{value:FOG_DENS},emis:{value:1.25},gain:this.gainU,time:this.timeU});
  this.timeU={value:0};this.gainU={value:1.7};
  const T_=this.tex={asphalt:mkTex(Tex3D.asphalt(),true,aniso),dirt:mkTex(Tex3D.dirt(),true,aniso),facA:mkTex(Tex3D.facade(0),true,aniso),facB:mkTex(Tex3D.facade(1),true,aniso),
    shop:mkTex(Tex3D.shops(),true,aniso),atlas:mkTex(Tex3D.atlas(),false,aniso),decal:mkTex(Tex3D.decals(),false,aniso)};
  const mat=(tex)=>{const u=uni();u.map.value=tex;return rawMat({vertexShader:WORLD_VS,fragmentShader:WORLD_FS,uniforms:u});};
  this.mats={asphalt:mat(T_.asphalt),dirt:mat(T_.dirt),facA:mat(T_.facA),facB:mat(T_.facB),shop:mat(T_.shop),props:mat(T_.atlas)};
  this.scene=new T.Group();
  const NC=N/CH,chunks={};
  const gb=(name,x,z)=>{const k=name+':'+Math.min(NC-1,Math.max(0,Math.floor(x/(CH*CELL))))+','+Math.min(NC-1,Math.max(0,Math.floor(z/(CH*CELL))));if(!chunks[k])chunks[k]={name:name,g:new GB()};return chunks[k].g;};
  this._gb=gb;
  const AT=Tex3D.AT;
  // --- ground (1m quads)
  const LC=new Map();const lightG=(x,z)=>{const k=x*4096+z;let v=LC.get(k);if(!v){v=this.lightAt(x,0,z,0,1,0);LC.set(k,v);}return v;};
  for(let cz=0;cz<N;cz++)for(let cx=0;cx<N;cx++){
    const t=this.type(cx,cz);if(t===1)continue;
    const name=t===2&&!this.lots.some(L=>L.kind==='parking'&&cx>=L.x0&&cx<L.x1&&cz>=L.z0&&cz<L.z1)?'dirt':'asphalt';
    const g=gb(name,cx*CELL+1,cz*CELL+1);
    for(let sz=0;sz<2;sz++)for(let sx=0;sx<2;sx++){
      const x0=cx*CELL+sx,z0=cz*CELL+sz,x1=x0+1,z1=z0+1;
      g.quad([[x0,0,z1],[x1,0,z1],[x1,0,z0],[x0,0,z0]],[[x0/4,z1/4],[x1/4,z1/4],[x1/4,z0/4],[x0/4,z0/4]],[lightG(x0,z1),lightG(x1,z1),lightG(x1,z0),lightG(x0,z0)]);
    }
  }
  // --- buildings
  const sides=[[0,0,-1],[0,0,1],[-1,0,0],[1,0,0]];
  for(const b of this.buildings){
    const fac=b.var===0?'facA':'facB';
    const tint=[b.tint*(0.95+b.hue*0.1),b.tint,b.tint*(1.05-b.hue*0.1)];
    for(const [nx,,nz] of sides){
      // cells along this side
      const cells=[];
      if(nz!==0){const cz=nz<0?b.z0:b.z1-1;for(let cx=b.x0;cx<b.x1;cx++)cells.push([cx,cz]);}
      else{const cx=nx<0?b.x0:b.x1-1;for(let cz=b.z0;cz<b.z1;cz++)cells.push([cx,cz]);}
      const rx=-nz,rz=nx; // right vector seen from outside: (-n) x up
      // sort cells left->right
      cells.sort((a,c)=>((a[0]*rx+a[1]*rz)-(c[0]*rx+c[1]*rz)));
      for(const [cx,cz] of cells){
        const nh=this.heightAt(cx+nx,cz+nz);if(nh>=b.h-0.01)continue;
        // wall plane
        const px=nx>0?(cx+1)*CELL:nx<0?cx*CELL:null,pz=nz>0?(cz+1)*CELL:nz<0?cz*CELL:null;
        let ax,az,bx,bz; // left/right endpoints
        if(nz!==0){const l=rx>0?cx*CELL:(cx+1)*CELL;ax=l;bx=l+rx*CELL;az=bz=pz;}else{const l=rz>0?cz*CELL:(cz+1)*CELL;az=l;bz=l+rz*CELL;ax=bx=px;}
        const s0=ax*rx+az*rz,s1=s0+CELL;
        const ys=[];const y0=nh;
        if(y0<B_FLOOR0){ys.push(y0);if(y0<1.6)ys.push(1.6);ys.push(B_FLOOR0);}else ys.push(y0);
        for(let y=B_FLOOR0+B_FLOOR;y<b.h-0.3;y+=B_FLOOR)if(y>ys[ys.length-1]+0.2)ys.push(y);
        ys.push(b.h);
        for(let k=0;k<ys.length-1;k++){
          const ya=ys[k],yb=ys[k+1];if(yb-ya<0.05)continue;
          const shop=ya<B_FLOOR0-0.01&&nh<0.01;
          const name=shop?'shop':fac;const g=gb(name,(ax+bx)/2,(az+bz)/2);
          let U0,U1,V0,V1;
          if(shop){U0=s0/4+b.os;U1=s1/4+b.os;V0=ya/B_FLOOR0;V1=yb/B_FLOOR0;}
          else{U0=s0/3+b.ou;U1=s1/3+b.ou;V0=(ya-B_FLOOR0)/B_FLOOR+b.ov;V1=(yb-B_FLOOR0)/B_FLOOR+b.ov;}
          const L=(x,y,z)=>{const l=this.lightAt(x,y,z,nx,0,nz);return [l[0]*tint[0],l[1]*tint[1],l[2]*tint[2]];};
          g.quad([[ax,ya,az],[bx,ya,bz],[bx,yb,bz],[ax,yb,az]],[[U0,V0],[U1,V0],[U1,V1],[U0,V1]],[L(ax,ya,az),L(bx,ya,bz),L(bx,yb,bz),L(ax,yb,az)]);
        }
      }
    }
    // roof
    const g=gb('props',(b.x0+b.x1)*CELL/2,(b.z0+b.z1)*CELL/2),r=AT.roof,X0=b.x0*CELL,X1=b.x1*CELL,Z0=b.z0*CELL,Z1=b.z1*CELL,h=b.h;
    const uv=this.auv(r);const lc=this.lightAt((X0+X1)/2,h,(Z0+Z1)/2,0,1,0,true);
    g.quad([[X0,h,Z1],[X1,h,Z1],[X1,h,Z0],[X0,h,Z0]],uv,[lc,lc,lc,lc]);
    if(b.floors>=3&&R()<0.35){this.box('props',(X0+X1)/2+(R()-0.5)*2,h,(Z0+Z1)/2+(R()-0.5)*2,1.6,1.4,1.6,0,{all:'metal'},[0.7,0.72,0.75]);}
  }
  // --- props
  this.buildProps();
  // assemble meshes
  for(const k in chunks){const c=chunks[k];const geo=c.g.geo();if(!geo)continue;const m=new T.Mesh(geo,this.mats[c.name]);m.matrixAutoUpdate=false;this.scene.add(m);}
  // decals
  this.buildDecals();
  // glows
  this.buildGlows();
  // wires
  const wp=[];
  for(const [a,b] of this.wires){for(const [h,o] of [[8.0,0],[7.5,0.25],[7.1,-0.25]]){
    const ox=a.az!==0?o:0,oz=a.ax!==0?o:0;const n=6;
    for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n;const s=(t)=>0.6*4*t*(1-t);
      wp.push(a.x+ox+(b.x-a.x)*t0,h-s(t0),a.z+oz+(b.z-a.z)*t0,a.x+ox+(b.x-a.x)*t1,h-s(t1),a.z+oz+(b.z-a.z)*t1);}}}
  if(wp.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(wp,3));
    const l=new T.LineSegments(g,rawMat({vertexShader:LINE_VS,fragmentShader:LINE_FS,uniforms:{col:{value:new T.Color(0x05060a)},fogColor:{value:FOG_COLOR},fogDensity:{value:FOG_DENS}}}));l.matrixAutoUpdate=false;this.scene.add(l);(this.wireMeshes=this.wireMeshes||[]).push(l);}
  // sky
  const sky=new T.Mesh(new T.SphereGeometry(300,24,12),rawMat({vertexShader:SKY_VS,fragmentShader:SKY_FS,uniforms:{fogColor:{value:FOG_COLOR},moonDir:{value:new T.Vector3(0.45,0.42,-0.79).normalize()}},side:T.BackSide,depthWrite:false}));
  sky.renderOrder=-10;sky.frustumCulled=false;this.sky=sky;this.scene.add(sky);
  // fog wisps
  this.buildWisps();
};
W.auv=function(r,flip){const S=1024,u0=(r[0]+0.5)/S,u1=(r[0]+r[2]-0.5)/S,v0=1-(r[1]+r[3]-0.5)/S,v1=1-(r[1]+0.5)/S;
  return flip?[[u1,v0],[u0,v0],[u0,v1],[u1,v1]]:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];};
// box: center x,z, base y, size w(x) h d(z), yaw a; faces {front,back,side,top,all}; front faces +z local
W.box=function(name,cx,y0,cz,w,h,d,a,faces,tint,emisFront,fl){
  const g=this._gb(name,cx,cz),AT=Tex3D.AT;
  const c=Math.cos(a),s=Math.sin(a);
  const P=(lx,ly,lz)=>[cx+lx*c+lz*s,y0+ly,cz-lx*s+lz*c];
  const hw=w/2,hd=d/2;
  const F=[ // [normal local, corners local bl,br,tr,tl, faceKey]
    [[0,0,1],[[-hw,0,hd],[hw,0,hd],[hw,h,hd],[-hw,h,hd]],'front'],
    [[0,0,-1],[[hw,0,-hd],[-hw,0,-hd],[-hw,h,-hd],[hw,h,-hd]],'back'],
    [[1,0,0],[[hw,0,hd],[hw,0,-hd],[hw,h,-hd],[hw,h,hd]],'side'],
    [[-1,0,0],[[-hw,0,-hd],[-hw,0,hd],[-hw,h,hd],[-hw,h,-hd]],'side'],
    [[0,1,0],[[-hw,h,hd],[hw,h,hd],[hw,h,-hd],[-hw,h,-hd]],'top']];
  for(const [n,cs,key] of F){
    const reg=faces[key]||faces.all;if(!reg)continue;
    const nw=[n[0]*c+n[2]*s,n[1],-n[0]*s+n[2]*c];
    const pts=cs.map(p=>P(...p));
    const cols=pts.map(p=>{const l=this.lightAt(p[0],p[1],p[2],nw[0],nw[1],nw[2]);return [l[0]*tint[0],l[1]*tint[1],l[2]*tint[2]];});
    g.quad(pts,this.auv(AT[reg]),cols,(key==='front'||faces.flAll)?(fl||0):0);
  }
};
W.cyl=function(name,cx,y0,cz,r,h,seg,reg,tint){
  const g=this._gb(name,cx,cz),uv=this.auv(Tex3D.AT[reg]);
  for(let i=0;i<seg;i++){const a0=i/seg*6.2832,a1=(i+1)/seg*6.2832,am=(a0+a1)/2;
    const p=(a,y)=>[cx+Math.sin(a)*r,y0+y,cz+Math.cos(a)*r];const n=[Math.sin(am),0,Math.cos(am)];
    const pts=[p(a0,0),p(a1,0),p(a1,h),p(a0,h)];const cols=pts.map(q=>{const l=this.lightAt(q[0],q[1],q[2],n[0],0,n[2]);return [l[0]*tint[0],l[1]*tint[1],l[2]*tint[2]];});
    const u0=uv[0][0]+(uv[1][0]-uv[0][0])*i/seg,u1=uv[0][0]+(uv[1][0]-uv[0][0])*(i+1)/seg;
    g.quad(pts,[[u0,uv[0][1]],[u1,uv[0][1]],[u1,uv[2][1]],[u0,uv[2][1]]],cols);}
};
W.buildProps=function(){
  const P='props',grey=[1,1,1];
  for(const p of this.poles){
    this.cyl(P,p.x,0,p.z,0.17,9.2,6,'pole',grey);
    if(this.R()<0.6)this.box(P,p.x+p.ax*0.18,1.4,p.z+p.az*0.18,0.34,0.5,0.03,Math.atan2(p.ax,p.az),{front:'plate',back:'metal',side:'metal'},grey);
    const cA=p.az!==0?0:Math.PI/2;
    this.box(P,p.x,8.0,p.z,2.2,0.12,0.12,cA,{all:'concrete'},[0.6,0.6,0.6]);this.box(P,p.x,7.4,p.z,1.6,0.1,0.1,cA,{all:'concrete'},[0.6,0.6,0.6]);
    if(this.R()<0.3)this.cyl(P,p.x+(p.az!==0?0.4:0),6.3,p.z+(p.ax!==0?0.4:0),0.25,0.8,6,'metal',[0.55,0.58,0.6]);
    if(p.lamp){const lx=p.x+p.ax*0.6,lz=p.z+p.az*0.6;const a=Math.atan2(p.ax,p.az);
      this.box(P,lx,5.45,lz,0.08,0.08,1.2,a,{all:'metal'},[0.5,0.5,0.5]);
      this.box(P,p.x+p.ax*1.1,5.2,p.z+p.az*1.1,0.25,0.12,0.6,a,{all:'metal',top:'metal'},[0.5,0.5,0.5]);
      this.box(P,p.x+p.ax*1.1,5.17,p.z+p.az*1.1,0.2,0.03,0.5,a,{all:'eCold'},grey);}
  }
  for(const v of this.vends){const a=Math.atan2(v.nx,v.nz);this.box(P,v.x,0,v.z,1.0,1.85,0.8,a,{front:v.reg,side:'vendSide',back:'vendSide',top:'metal'},[1,1,1]);}
  for(const s of this.signs){
    const a=Math.atan2(s.nx,s.nz)+Math.PI/2;
    if(s.lantern){this.cyl(P,s.x,s.y-0.45,s.z,0.24,0.75,8,'lantern',grey);continue;}
    this.box(P,s.x,s.y,s.z,0.9,2.6,0.16,a,{front:s.reg,back:s.reg,side:'metal',top:'metal'},grey,true,s.fl);
    // the back face must also flicker -> handled by fl on front only; acceptable
    this.box(P,s.x-s.nx*0.45,s.y+2.2,s.z-s.nz*0.45,0.06,0.06,0.9,a-Math.PI/2,{all:'metal'},[0.4,0.4,0.4]);
  }
  for(const m of this.mirrors||[]){this.cyl(P,m.x,0,m.z,0.05,2.6,5,'white',[0.95,0.45,0.1]);this.box(P,m.x,2.4,m.z,0.75,0.75,0.06,m.a,{front:'mirror',back:'white',side:'white'},[0.95,0.45,0.1]);}
  for(const L of this.lots){
    for(const w of L.walls){const cx=(w[0]+w[2])/2,cz=(w[1]+w[3])/2,len=Math.hypot(w[2]-w[0],w[3]-w[1]);const a=Math.atan2(w[2]-w[0],w[3]-w[1])+Math.PI/2;
      this.box(P,cx,0,cz,len,1.3,0.15,a,{front:'block',back:'block',side:'concrete',top:'concrete'},[1,1,1]);}
    for(const it of L.items){
      if(it.k==='torii'){const px=Math.cos(it.a),pz=-Math.sin(it.a);const red=[0.85,0.16,0.1];
        for(const s of [-1,1])this.cyl(P,it.x+px*1.6*s,0,it.z+pz*1.6*s,0.2,4.2,8,'white',red);
        this.box(P,it.x,4.2,it.z,4.9,0.32,0.4,it.a,{all:'white'},[0.12,0.1,0.1]);this.box(P,it.x,3.55,it.z,4.0,0.25,0.3,it.a,{all:'white'},red);this.box(P,it.x,3.55,it.z,0.25,0.7,0.3,it.a,{all:'white'},red);}
      else if(it.k==='hokora'){this.box(P,it.x,0,it.z,1.4,0.6,1.4,it.a,{all:'concrete'},[0.7,0.7,0.7]);this.box(P,it.x,0.6,it.z,0.9,1.0,0.9,it.a,{all:'wood'},[1,1,1]);this.box(P,it.x,1.6,it.z,1.3,0.18,1.3,it.a,{all:'white'},[0.25,0.22,0.2]);}
      else if(it.k==='tourou'){this.box(P,it.x,0,it.z,0.5,0.9,0.5,0,{all:'concrete'},[0.75,0.75,0.72]);this.box(P,it.x,0.9,it.z,0.4,0.5,0.4,0,{all:'eFlame',top:'concrete'},grey);this.box(P,it.x,1.4,it.z,0.7,0.2,0.7,0,{all:'concrete'},[0.75,0.75,0.72]);}
      else if(it.k==='tree'){this.cyl(P,it.x,0,it.z,0.18*it.s,2.4*it.s,6,'wood',[0.6,0.6,0.6]);
        for(let k=0;k<3;k++)this.box(P,it.x+(k-1)*0.4*it.s,2.0*it.s+k*0.5*it.s,it.z+((k%2)-0.5)*0.4*it.s,2.4*it.s-k*0.5,1.4*it.s,2.4*it.s-k*0.5,k*0.6,{all:'white'},[0.08,0.16,0.09]);}
      else if(it.k==='car'){const c=it.c;this.box(P,it.x,0.25,it.z+2.2,1.7,0.75,4.2,it.a,{all:'white'},c);this.box(P,it.x,1.0,it.z+2.2+(it.a?0.3:-0.3),1.5,0.6,2.2,it.a,{all:'carWin',top:'white'},[1,1,1]);
        for(const sx of [-0.75,0.75])for(const sz of [1.0,3.4])this.box(P,it.x+sx,0,it.z+sz,0.25,0.55,0.55,0,{all:'tire'},grey);}
      else if(it.k==='psign'){this.cyl(P,it.x,0,it.z,0.06,2.6,5,'metal',[0.6,0.6,0.6]);this.box(P,it.x,2.6,it.z,1.6,0.6,0.1,Math.PI,{front:'hsign2',back:'hsign2',side:'metal',top:'metal'},grey);}
      else if(it.k==='board'){for(const s of [-0.5,0.5])this.box(P,it.x+Math.cos(it.a)*s,0,it.z-Math.sin(it.a)*s,0.08,1.1,0.08,it.a,{all:'wood'},grey);this.box(P,it.x,1.1,it.z,1.5,0.5,0.06,it.a,{front:it.reg,back:it.reg,side:'wood',top:'wood'},[0.9,0.9,0.9]);}
      else if(it.k==='drum'){this.cyl(P,it.x,0,it.z,0.3,0.9,8,'white',[0.25,0.35,0.5]);}
      else if(it.k==='tires'){for(let k=0;k<3;k++)this.cyl(P,it.x,k*0.25,it.z,0.35,0.24,8,'tire',grey);}
    }
  }
};
W.buildDecals=function(){
  const DC=Tex3D.DC,g=new GB(),gp=new GB();
  const uvd=(r)=>{const S=512;return [[r[0]/S,1-(r[1]+r[3])/S],[(r[0]+r[2])/S,1-(r[1]+r[3])/S],[(r[0]+r[2])/S,1-r[1]/S],[r[0]/S,1-r[1]/S]];};
  const flat=(gg,x,z,w,d,a,uv,col,y)=>{const c=Math.cos(a),s=Math.sin(a),hw=w/2,hd=d/2;const P=(lx,lz)=>[x+lx*c+lz*s,y||0.02,z-lx*s+lz*c];
    gg.quad([P(-hw,hd),P(hw,hd),P(hw,-hd),P(-hw,-hd)],uv,[col,col,col,col]);};
  // side lines along streets (外側線)
  const lineCol=(x,z)=>{const l=this.lightAt(x,0,z,0,1,0,true);return l;};
  for(const s of this.xs){for(const xx of [s[0]*CELL+0.5,s[1]*CELL-0.5]){for(let cz=0;cz<N;cz++){if(this.type(s[0],cz)!==0)continue;const outL=this.type(s[0]-1,cz),outR=this.type(s[1],cz);if(outL!==1&&outR!==1)continue;const z=(cz+0.5)*CELL;flat(g,xx,z,0.12,CELL,0,uvd(DC.line),lineCol(xx,z));}}}
  for(const s of this.zs){for(const zz of [s[0]*CELL+0.5,s[1]*CELL-0.5]){for(let cx=0;cx<N;cx++){if(this.type(cx,s[0])!==0)continue;const outL=this.type(cx,s[0]-1),outR=this.type(cx,s[1]);if(outL!==1&&outR!==1)continue;const x=(cx+0.5)*CELL;flat(g,x,zz,CELL,0.12,0,uvd(DC.line),lineCol(x,zz));}}}
  for(const d of this.decalList){
    if(d.k==='pool'){flat(gp,d.x,d.z,d.s,d.s,0,uvd(DC.pool),d.c,0.03);continue;}
    const l=this.lightAt(d.x,0,d.z,0,1,0,true);
    if(d.k==='tomare')flat(g,d.x,d.z,d.s,d.s*0.45,d.rot||0,uvd(DC.tomare),l);
    else if(d.k==='manhole')flat(g,d.x,d.z,d.s,d.s,0,uvd(DC.manhole),l);
    else if(d.k==='stone')flat(g,d.x,d.z,d.s,d.s*0.6,0,uvd(DC.stone),l);
    else if(d.k==='line')flat(g,d.x,d.z,d.w,d.d,0,uvd(DC.line),l);
  }
  const mk=(gg,add)=>{const geo=gg.geo();if(!geo)return;const m=new T.Mesh(geo,rawMat({vertexShader:WORLD_VS,fragmentShader:DECAL_FS,transparent:true,depthWrite:false,
    blending:add?T.AdditiveBlending:T.NormalBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    uniforms:{map:{value:this.tex.decal},fogColor:{value:FOG_COLOR},fogDensity:{value:FOG_DENS},additive:{value:add?1:0},time:this.timeU}}));m.renderOrder=add?2:1;m.matrixAutoUpdate=false;this.scene.add(m);};
  mk(g,false);mk(gp,true);
};
W.buildGlows=function(){
  const p=[],c=[],s=[],col=[],f=[],idx=[];let n=0;
  for(const G of this.glows){for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){p.push(G.x,G.y,G.z);c.push(cx,cy);s.push(G.s);col.push(...G.c);f.push(G.fl||0);}idx.push(n,n+1,n+2,n,n+2,n+3);n+=4;}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('corner',new T.Float32BufferAttribute(c,2));
  g.setAttribute('size',new T.Float32BufferAttribute(s,1));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setAttribute('flick',new T.Float32BufferAttribute(f,1));g.setIndex(idx);
  const m=new T.Mesh(g,rawMat({vertexShader:GLOW_VS,fragmentShader:GLOW_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{fogDensity:{value:FOG_DENS},time:this.timeU}}));
  m.frustumCulled=false;m.renderOrder=5;this.scene.add(m);
};
W.buildWisps=function(){
  // low drifting fog sheets around the player (repositioned every frame)
  const n=14,p=[],c=[],s=[],col=[],f=[],idx=[];
  this.wisps=[];for(let i=0;i<n;i++){this.wisps.push({ox:(this.R()-0.5)*40,oz:(this.R()-0.5)*40,y:0.6+this.R()*1.4,s:5+this.R()*5,ph:this.R()*6.28});
    for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){p.push(0,0,0);c.push(cx,cy*0.45);s.push(1);col.push(0.05,0.055,0.08);f.push(0);}idx.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('corner',new T.Float32BufferAttribute(c,2));
  g.setAttribute('size',new T.Float32BufferAttribute(s,1));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setAttribute('flick',new T.Float32BufferAttribute(f,1));g.setIndex(idx);
  this.wispGeo=g;
  const m=new T.Mesh(g,rawMat({vertexShader:GLOW_VS,fragmentShader:GLOW_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{fogDensity:{value:FOG_DENS*0.6},time:this.timeU}}));
  m.frustumCulled=false;m.renderOrder=6;this.scene.add(m);
};
W.update=function(t,px,pz){
  this.timeU.value=t;
  const pa=this.wispGeo.attributes.position,sa=this.wispGeo.attributes.size;
  this.wisps.forEach((w,i)=>{const wrap=(v)=>((v%40)+60)%40-20;const x=px+wrap(w.ox+t*0.6-px),z=pz+wrap(w.oz+t*0.25-pz);
    for(let k=0;k<4;k++){pa.setXYZ(i*4+k,x,w.y+Math.sin(t*0.3+w.ph)*0.3,z);sa.setX(i*4+k,w.s);}});
  pa.needsUpdate=true;sa.needsUpdate=true;
  this.sky.position.set(px,0,pz);this.sky.updateMatrix();this.sky.matrixAutoUpdate=false;
};

// ---------------------------------------------------------------- collision
W.collide=function(x,z,r,noProps){ // push circle out of buildings (& props), returns [x,z]
  for(let it=0;it<2;it++){
    const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const X=cx+dx,Z=cz+dz;
      if(this.blockedCell(X,Z)){const o=pushOut(x,z,r,X*CELL,Z*CELL,(X+1)*CELL,(Z+1)*CELL);x=o[0];z=o[1];}
      const bl=noProps?null:this.boxCells.get(Z*N+X);if(bl)for(const b of bl){const o=pushOut(x,z,r,b[0],b[1],b[2],b[3]);x=o[0];z=o[1];}
    }
  }
  return [clamp(x,r,SIZE-r),clamp(z,r,SIZE-r)];
};
function pushOut(x,z,r,x0,z0,x1,z1){
  const qx=clamp(x,x0,x1),qz=clamp(z,z0,z1);let dx=x-qx,dz=z-qz;const d2=dx*dx+dz*dz;
  if(d2>=r*r)return [x,z];
  if(d2<1e-8){ // center inside: push along smallest axis
    const l=x-x0,rr=x1-x,t=z-z0,b=z1-z,m=Math.min(l,rr,t,b);
    if(m===l)return [x0-r,z];if(m===rr)return [x1+r,z];if(m===t)return [x,z0-r];return [x,z1+r];}
  const d=Math.sqrt(d2);return [qx+dx/d*r,qz+dz/d*r];
}
// grid line of sight (buildings only)
W.los=function(ax,az,bx,bz){
  const dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz),n=Math.ceil(d/0.6);
  for(let k=1;k<n;k++){const t=k/n;if(this.blockedCell(Math.floor((ax+dx*t)/CELL),Math.floor((az+dz*t)/CELL)))return false;}
  return true;
};
// BFS distance field from target cell (4-neighbour)
W.flow=function(tx,tz){
  const c0=Math.floor(tx/CELL),r0=Math.floor(tz/CELL);
  if(this._fk===r0*N+c0)return this._fd;
  const D=this._fd||(this._fd=new Int16Array(N*N));D.fill(-1);
  const q=this._fq||(this._fq=new Int32Array(N*N));let h=0,t=0;
  if(this.blockedCell(c0,r0))return D;
  D[r0*N+c0]=0;q[t++]=r0*N+c0;
  while(h<t){const k=q[h++],cx=k%N,cz=(k/N)|0,d=D[k]+1;
    if(cx>0&&D[k-1]<0&&this.grid[k-1]!==1){D[k-1]=d;q[t++]=k-1;}
    if(cx<N-1&&D[k+1]<0&&this.grid[k+1]!==1){D[k+1]=d;q[t++]=k+1;}
    if(cz>0&&D[k-N]<0&&this.grid[k-N]!==1){D[k-N]=d;q[t++]=k-N;}
    if(cz<N-1&&D[k+N]<0&&this.grid[k+N]!==1){D[k+N]=d;q[t++]=k+N;}}
  this._fk=r0*N+c0;return D;
};
// next waypoint for a chaser at (x,z) towards the flow target: string-pulled along descending cells
W.nextWaypoint=function(x,z,D){
  let cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);
  if(D[cz*N+cx]<0){ // off-grid: head to nearest walkable neighbour
    let best=null,bd=1e9;for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const k=(cz+dz)*N+cx+dx;if(cz+dz<0||cz+dz>=N||cx+dx<0||cx+dx>=N)continue;if(D[k]>=0&&D[k]<bd){bd=D[k];best=[cx+dx,cz+dz];}}
    return best?[(best[0]+0.5)*CELL,(best[1]+0.5)*CELL,bd]:null;}
  let wp=null;const d0=D[cz*N+cx];
  for(let step=0;step<10;step++){
    const d=D[cz*N+cx];if(d===0)break;let nb=null;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=cx+dx,Z=cz+dz;if(X<0||Z<0||X>=N||Z>=N)continue;const v=D[Z*N+X];if(v>=0&&v<d){nb=[X,Z];break;}}
    if(!nb)break;cx=nb[0];cz=nb[1];
    const px=(cx+0.5)*CELL,pz=(cz+0.5)*CELL;
    if(step===0||this.los(x,z,px,pz))wp=[px,pz,d0];else break;
  }
  return wp;
};
W.randomStreetCell=function(R){for(let i=0;i<500;i++){const cx=Math.floor(R()*N),cz=Math.floor(R()*N);if(this.type(cx,cz)===0)return [cx,cz];}return [this.xs[0][0],this.zs[0][0]];};

// ---------------------------------------------------------------- minimap
W.makeMinimap=function(){
  const S=4,c=document.createElement('canvas');c.width=c.height=N*S;const x=c.getContext('2d');
  x.fillStyle='#0d0f19';x.fillRect(0,0,N*S,N*S);
  for(let cz=0;cz<N;cz++)for(let cx=0;cx<N;cx++){const t=this.type(cx,cz);if(t===1){const h=this.hmap[cz*N+cx];const v=Math.round(26+h*1.6);x.fillStyle=`rgb(${v},${v+2},${v+14})`;}else x.fillStyle=t===2?'#3d4836':'#6a7090';x.fillRect(cx*S,cz*S,S,S);}
  for(const L of this.lots)if(L.kind==='shrine'&&L.gate){x.fillStyle='#e0402a';x.fillRect(L.gate.x/CELL*S-3,L.gate.z/CELL*S-3,6,6);}
  return {canvas:c,scale:S/CELL};
};
window.World=World;
})();
