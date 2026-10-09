// Puts the 2D layered/mesh-animated 八尺様 rig (hachi.js) into the 3D world as a camera-facing billboard.
// The rig's deformation code is reused unchanged; only the output goes to Three.js buffers.
(function(){
'use strict';
const T=THREE;
const S=0.00183;           // metres per source pixel -> about 3.4 m from feet to hat top (she towers over the child-height camera)
const CX=610,GROUND=1895,AX=683;
const VS=`precision highp float;
uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;
attribute vec3 position;attribute vec2 uv;attribute vec2 uv2;
varying vec2 vUv;varying vec2 vUv2;varying float vFog;
void main(){vUv=uv;vUv2=uv2;vec4 mv=modelViewMatrix*vec4(position,1.0);vFog=-mv.z;gl_Position=projectionMatrix*mv;}`;
const FS=`precision mediump float;
uniform sampler2D map;uniform vec3 tint;uniform float alpha;uniform float flash;uniform float mixAmt;uniform vec3 fogColor;uniform float fogDensity;
varying vec2 vUv;varying vec2 vUv2;varying float vFog;
void main(){vec4 c=texture2D(map,vUv);
 if(mixAmt>0.001){vec4 c2=texture2D(map,vUv2);c=mix(c,c2,mixAmt);}
 c.rgb=mix(c.rgb,vec3(c.a),clamp(flash,0.0,1.0));
 c*=vec4(tint,1.0)*alpha;
 float f=1.0-exp(-vFog*vFog*fogDensity*fogDensity);
 c.rgb=mix(c.rgb,fogColor*c.a,f);
 gl_FragColor=c;}`;

function texFrom(img){const t=new T.Texture(img);t.flipY=false;t.premultiplyAlpha=true;t.colorSpace=T.NoColorSpace;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.needsUpdate=true;return t;}

function Hachi3D(H,imgs,fogColor,fogDensity){
  this.H=H;this.S=S;
  this.group=new T.Group();
  this.fogU={value:fogDensity};
  this.tintU={value:new T.Vector3(0.9,0.92,1)};
  const tex={};for(const k of ['upper','belly','skirt','legL','legR','faces'])tex[k]=texFrom(imgs[k]);
  tex.hair=texFrom(H.tex.hair); // canvas made by the rig
  const m=H.m;
  const defs=[
    ['hair',m.hair,tex.hair,H.defHair,true],
    ['legL',m.legL,tex.legL,(mm,i,o)=>H.defLeg(mm,i,'L',o),false],
    ['legR',m.legR,tex.legR,(mm,i,o)=>H.defLeg(mm,i,'R',o),false],
    ['skirt',m.skirt,tex.skirt,H.defSkirt,false],
    ['belly',m.belly,tex.belly,H.defBelly,false],
    ['upper',m.upper,tex.upper,H.defUpper,true],
    ['face',m.face,tex.faces,H.defFace,true]];
  this.layers=defs.map((d,li)=>{
    const [name,mesh,tx,def,off]=d;
    const g=new T.BufferGeometry();
    const pos=new T.BufferAttribute(new Float32Array(mesh.n*3),3);pos.setUsage(T.DynamicDrawUsage);
    const uv=new T.BufferAttribute(new Float32Array(mesh.uv),2);
    const uv2=new T.BufferAttribute(new Float32Array(mesh.uv2||mesh.uv),2);
    if(name==='face'){uv.setUsage(T.DynamicDrawUsage);uv2.setUsage(T.DynamicDrawUsage);}
    g.setAttribute('position',pos);g.setAttribute('uv',uv);g.setAttribute('uv2',uv2);g.setIndex(new T.BufferAttribute(mesh.idx,1));
    const mat=new T.RawShaderMaterial({vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,premultipliedAlpha:true,blending:T.NormalBlending,side:T.DoubleSide,
      uniforms:{map:{value:tx},tint:this.tintU,alpha:{value:1},flash:{value:0},mixAmt:{value:0},fogColor:{value:fogColor},fogDensity:this.fogU}});
    const ms=new T.Mesh(g,mat);ms.frustumCulled=false;ms.renderOrder=20+li;
    this.group.add(ms);
    return {name:name,mesh:mesh,def:def,off:off,geo:g,mat:mat,obj:ms,z:li*0.004};
  });
  // blob shadow
  const sc=document.createElement('canvas');sc.width=sc.height=128;const x=sc.getContext('2d');
  const gr=x.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(0,0,0,0.75)');gr.addColorStop(0.6,'rgba(0,0,0,0.35)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,128,128);
  const st=new T.CanvasTexture(sc);st.colorSpace=T.NoColorSpace;
  this.shadow=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:st,transparent:true,depthWrite:false,color:0xffffff}));
  this.shadow.rotation.x=-Math.PI/2;this.shadow.renderOrder=3;
  this.tmp=[0,0];
}
Hachi3D.S=S;
// world-space helpers (call after placement)
Hachi3D.prototype.place=function(x,z,camX,camZ){
  this.group.position.set(x,0,z);
  this.group.rotation.set(0,Math.atan2(camX-x,camZ-z),0);
  this.group.updateMatrixWorld(true);
  const hw=this.H.bellyHalfW()*S*2.3;
  this.shadow.position.set(x,0.035,z);this.shadow.scale.set(hw,hw*0.75,1);
};
Hachi3D.prototype.update=function(opt){
  opt=opt||{};
  const H=this.H,off=H.upperOffset(),o=this.tmp,tl=H.p.tilt,c=Math.cos(tl),s=Math.sin(tl);
  const lowA=1-ss(1.75,2.5,H.b.g);
  // expressions
  const names=H.faceMeta.names,F=H.face;
  const ia=Math.max(0,names.indexOf(F.a)),ib=Math.max(0,names.indexOf(F.b));
  H.m.face.setAtlas(ia,ib,names.length);
  for(const L of this.layers){
    const m=L.mesh,P=L.geo.attributes.position.array;
    let a=opt.alpha==null?1:opt.alpha;
    if(L.name==='legL'||L.name==='legR'||L.name==='skirt'){a*=lowA;L.obj.visible=a>0.01;if(!L.obj.visible)continue;}
    for(let i=0;i<m.n;i++){
      L.def.call(H,m,i,o);
      if(L.off){o[0]+=off.x;o[1]+=off.y;}
      // body tilt around the ground anchor (same as the 2D renderer)
      const lx=o[0]-AX,ly=o[1]-GROUND,X=AX+lx*c-ly*s,Y=GROUND+lx*s+ly*c;
      P[i*3]=(X-CX)*S;P[i*3+1]=(GROUND-Y)*S;P[i*3+2]=L.z;
    }
    L.geo.attributes.position.needsUpdate=true;
    L.mat.uniforms.alpha.value=a;
    L.mat.uniforms.flash.value=(L.name==='belly'?H.b.flash:0)+(opt.flash||0);
    if(L.name==='face'){
      L.geo.attributes.uv.array.set(m.uvA);L.geo.attributes.uv2.array.set(m.uv2);
      L.geo.attributes.uv.needsUpdate=true;L.geo.attributes.uv2.needsUpdate=true;
      L.mat.uniforms.mixAmt.value=F.a===F.b?0:Math.max(0.0001,F.mix);
    }
  }
};
function ss(a,b,x){let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t);}
// source (upper body, unscaled art coords) -> world
Hachi3D.prototype.upperToWorld=function(x,y,out){
  const H=this.H,off=H.upperOffset(),u=H.uScale();
  const X=610+(x-610)*u+off.x,Y=470+(y-470)*u+off.y;
  out=out||new T.Vector3();out.set((X-CX)*S,(GROUND-Y)*S,0.03);return this.group.localToWorld(out);
};
Hachi3D.prototype.srcToWorld=function(X,Y,out){out=out||new T.Vector3();out.set((X-CX)*S,(GROUND-Y)*S,0.03);return this.group.localToWorld(out);};
Hachi3D.prototype.bellyCenterWorld=function(out){const b=this.H.bellyCenterS();return this.srcToWorld(b.x,b.y+this.H.bob,out);};
Hachi3D.prototype.heightM=function(){return (GROUND-this.H.topY())*S;};
Hachi3D.prototype.bellyHalfWM=function(){return this.H.bellyHalfW()*S;};
// ray (world) -> belly source coords for hit reactions
Hachi3D.prototype.rayToBelly=function(ray){
  const inv=new T.Matrix4().copy(this.group.matrixWorld).invert();
  const o=ray.origin.clone().applyMatrix4(inv),d=ray.direction.clone().transformDirection(inv);
  if(Math.abs(d.z)<1e-5)return null;const t=(0.016-o.z)/d.z;if(t<0)return null;
  const lx=o.x+d.x*t,ly=o.y+d.y*t;
  const X=lx/S+CX,Y=GROUND-ly/S,H=this.H,g=H.b.g;
  const x=610+(X-610)/g,y=445+(Y+H.lift-445)/g;
  return {x:x,y:y,inside:Math.pow((x-610)/470,2)+Math.pow((y-850)/420,2)<1,world:new T.Vector3(lx,ly,0.03).applyMatrix4(this.group.matrixWorld)};
};
window.Hachi3D=Hachi3D;
})();
