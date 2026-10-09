// Minimal batched WebGL renderer for deformable textured meshes.
(function(){
'use strict';
const VS=`
attribute vec2 a_pos;attribute vec2 a_uv;attribute vec2 a_uv2;attribute vec4 a_col;attribute vec2 a_ex;
uniform vec2 u_res;
varying vec2 v_uv;varying vec2 v_uv2;varying vec4 v_col;varying vec2 v_ex;
void main(){vec2 p=a_pos/u_res*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.0,1.0);v_uv=a_uv;v_uv2=a_uv2;v_col=a_col;v_ex=a_ex;}`;
const FS=`
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;varying vec2 v_uv2;varying vec4 v_col;varying vec2 v_ex;
void main(){
  vec4 c=texture2D(u_tex,v_uv);
  if(v_ex.x>0.001){vec4 c2=texture2D(u_tex,v_uv2);c=mix(c,c2,v_ex.x);}
  c.rgb=mix(c.rgb,vec3(c.a),clamp(v_ex.y,0.0,1.0));   // flash toward white (premultiplied)
  gl_FragColor=c*v_col;
}`;
const STRIDE=12;
function Renderer(canvas){
  const opts={alpha:true,premultipliedAlpha:true,antialias:true,preserveDrawingBuffer:false};
  let gl=canvas.getContext('webgl2',opts),isGL2=!!gl;
  if(!gl) gl=canvas.getContext('webgl',opts)||canvas.getContext('experimental-webgl',opts);
  if(!gl) throw new Error('WebGLが使えません');
  this.gl=gl;this.isGL2=isGL2;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);this.pr=pr;
  this.uRes=gl.getUniformLocation(pr,'u_res');
  this.buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);
  this.cap=65536;this.data=new Float32Array(this.cap*STRIDE);this.n=0;
  gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
  const at=(name,size,off)=>{const l=gl.getAttribLocation(pr,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,STRIDE*4,off*4);};
  at('a_pos',2,0);at('a_uv',2,2);at('a_uv2',2,4);at('a_col',4,6);at('a_ex',2,10);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  this.tex=null;this.blend='normal';
  // white texture
  const c=document.createElement('canvas');c.width=c.height=4;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,4,4);
  this.white=this.texture(c);
}
Renderer.prototype.texture=function(img,mip){
  const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  const pot=(v)=>(v&(v-1))===0;
  const canMip=mip!==false&&(this.isGL2||(pot(img.width)&&pot(img.height)));
  if(canMip){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
  else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.tex=null;
  return {t:t,w:img.width,h:img.height};
};
Renderer.prototype.updateTexture=function(T,img){
  const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,T.t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  if(this.isGL2)gl.generateMipmap(gl.TEXTURE_2D);this.tex=null;
};
Renderer.prototype.begin=function(w,h){
  const gl=this.gl;gl.viewport(0,0,w,h);gl.uniform2f(this.uRes,w,h);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);this.n=0;this.tex=null;this.W=w;this.H=h;
  this.setBlend('normal');
};
Renderer.prototype.flush=function(){
  if(!this.n)return;const gl=this.gl;
  gl.bindTexture(gl.TEXTURE_2D,this.tex.t);
  gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,this.n*STRIDE));
  gl.drawArrays(gl.TRIANGLES,0,this.n);this.n=0;
};
Renderer.prototype.use=function(T){if(this.tex!==T){this.flush();this.tex=T;}};
Renderer.prototype.setBlend=function(b){
  if(this.blend===b)return;this.flush();this.blend=b;const gl=this.gl;
  if(b==='add')gl.blendFunc(gl.ONE,gl.ONE);else gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
};
Renderer.prototype.ensure=function(k){if(this.n+k>this.cap)this.flush();};
// push vertex
Renderer.prototype.v=function(x,y,u,v,u2,v2,r,g,b,a,mix,flash){
  const d=this.data,o=this.n*STRIDE;
  d[o]=x;d[o+1]=y;d[o+2]=u;d[o+3]=v;d[o+4]=u2;d[o+5]=v2;
  d[o+6]=r*a;d[o+7]=g*a;d[o+8]=b*a;d[o+9]=a;d[o+10]=mix;d[o+11]=flash;this.n++;
};
// quad (axis-aligned/rotated) using texture sub-rect
Renderer.prototype.quad=function(T,cx,cy,w,h,rot,u0,v0,u1,v1,r,g,b,a,flash){
  this.use(T);this.ensure(6);
  const c=Math.cos(rot||0),s=Math.sin(rot||0),hw=w/2,hh=h/2;
  const px=[-hw,hw,hw,-hw],py=[-hh,-hh,hh,hh],uu=[u0,u1,u1,u0],vv=[v0,v0,v1,v1];
  const X=[],Y=[];for(let i=0;i<4;i++){X[i]=cx+px[i]*c-py[i]*s;Y[i]=cy+px[i]*s+py[i]*c;}
  const idx=[0,1,2,0,2,3];
  for(const i of idx)this.v(X[i],Y[i],uu[i],vv[i],0,0,r,g,b,a,0,flash||0);
};
// mesh: positions (Float32Array xy screen), uvs, uv2s(optional), indices, color/alpha, mix, flash
Renderer.prototype.mesh=function(T,P,UV,UV2,IDX,r,g,b,a,mix,flash){
  this.use(T);
  const n=IDX.length;
  for(let k=0;k<n;k+=3){
    this.ensure(3);
    for(let j=0;j<3;j++){
      const i=IDX[k+j];
      this.v(P[i*2],P[i*2+1],UV[i*2],UV[i*2+1],UV2?UV2[i*2]:0,UV2?UV2[i*2+1]:0,r,g,b,a,mix||0,flash||0);
    }
  }
};
Renderer.prototype.end=function(){this.flush();};
window.Renderer=Renderer;
})();
