// Procedurally drawn chibi kid (the player) -> sprite sheet texture.
(function(){
'use strict';
const CW=180,CH=220,GY=206,CX=90; // cell size, ground y, center x
const SKIN='#ffdcc4',SKIN_S='#e9b49a',HAIR='#1d1a22',HAT='#ffd21f',HAT_S='#e0a800',SHIRT='#f4f6ff',SHIRT_S='#c9cee6',SHORTS='#2b3a78',SHORTS_S='#1d2858',BAG='#c8203a',BAG_S='#8c1226',SHOE='#ff5a3c',SOCK='#ffffff',LINE='#2a1f2a';
function limb(x,ax,ay,ang,len,w,col,col2,end){
  x.save();x.translate(ax,ay);x.rotate(ang);
  x.lineCap='round';x.strokeStyle=LINE;x.lineWidth=w+3.5;x.beginPath();x.moveTo(0,0);x.lineTo(0,len);x.stroke();
  x.strokeStyle=col;x.lineWidth=w;x.beginPath();x.moveTo(0,0);x.lineTo(0,len);x.stroke();
  if(col2){x.strokeStyle=col2;x.lineWidth=w;x.beginPath();x.moveTo(0,len*0.55);x.lineTo(0,len);x.stroke();}
  if(end){end(x,len);}
  x.restore();
}
function shoe(x,len){x.fillStyle=LINE;x.beginPath();x.ellipse(5,len+3,13,8,0,0,7);x.fill();x.fillStyle=SHOE;x.beginPath();x.ellipse(5,len+2,10.5,6,0,0,7);x.fill();x.fillStyle='#fff';x.fillRect(-4,len+5,18,2.5);}
function hand(x,len){x.fillStyle=LINE;x.beginPath();x.arc(0,len+2,7.5,0,7);x.fill();x.fillStyle=SKIN;x.beginPath();x.arc(0,len+2,5.6,0,7);x.fill();}
function drawSide(x,o){
  // o: {legF,legB,armF,armB,bob,lean,face:'run'|'scared'}
  x.save();x.translate(CX,GY-o.bob);
  x.rotate(o.lean||0);
  const hipY=-52;
  // back limbs
  limb(x,-2,hipY-36,o.armB,26,9,SHIRT_S,SKIN_S,hand);
  limb(x,-4,hipY,o.legB,40,12,SHORTS_S,SOCK,shoe);
  // body
  x.fillStyle=LINE;x.beginPath();x.roundRect(-20,hipY-46,40,52,14);x.fill();
  x.fillStyle=SHIRT;x.beginPath();x.roundRect(-17.5,hipY-43.5,35,40,12);x.fill();
  x.fillStyle=SHORTS;x.beginPath();x.roundRect(-17.5,hipY-8,35,13,5);x.fill();
  x.fillStyle=SHIRT_S;x.fillRect(-17,hipY-14,34,5);
  // randoseru (on back = left)
  x.fillStyle=LINE;x.beginPath();x.roundRect(-38,hipY-50,24,44,8);x.fill();
  x.fillStyle=BAG;x.beginPath();x.roundRect(-35.5,hipY-47.5,19,39,6);x.fill();
  x.fillStyle=BAG_S;x.fillRect(-35.5,hipY-30,19,4);x.fillStyle='#ffd34d';x.fillRect(-27.5,hipY-28,4,5);
  x.strokeStyle=BAG_S;x.lineWidth=4;x.beginPath();x.moveTo(-18,hipY-44);x.quadraticCurveTo(-4,hipY-40,2,hipY-24);x.stroke();
  // front leg & arm
  limb(x,4,hipY,o.legF,40,12,SHORTS,SOCK,shoe);
  // head
  const hy=hipY-78;
  x.fillStyle=LINE;x.beginPath();x.ellipse(2,hy,37,35,0,0,7);x.fill();
  x.fillStyle=SKIN;x.beginPath();x.ellipse(2,hy,34,32,0,0,7);x.fill();
  // hair back
  x.fillStyle=HAIR;x.beginPath();x.ellipse(-8,hy-6,30,26,0,Math.PI*0.55,Math.PI*1.9);x.fill();
  x.beginPath();x.ellipse(-16,hy+4,18,24,0,0,7);x.fill();
  // ear
  x.fillStyle=SKIN;x.beginPath();x.ellipse(-6,hy+4,7,9,0,0,7);x.fill();x.strokeStyle=SKIN_S;x.lineWidth=2;x.beginPath();x.arc(-6,hy+4,4,0.5,2.6);x.stroke();
  // face
  const sc=o.face==='scared';
  x.fillStyle='rgba(255,120,130,0.45)';x.beginPath();x.ellipse(24,hy+12,7,4,0,0,7);x.fill();
  if(sc){
    x.strokeStyle=LINE;x.lineWidth=3;x.lineCap='round';
    x.beginPath();x.moveTo(14,hy-6);x.lineTo(22,hy-1);x.lineTo(14,hy+3);x.stroke();
    x.beginPath();x.moveTo(30,hy-6);x.lineTo(24,hy-1);x.lineTo(30,hy+3);x.stroke();
  }else{
    x.fillStyle=LINE;x.beginPath();x.ellipse(24,hy-2,4.6,7,0,0,7);x.fill();
    x.fillStyle='#fff';x.beginPath();x.arc(25.5,hy-4.5,1.8,0,7);x.fill();
    x.strokeStyle=LINE;x.lineWidth=2.4;x.beginPath();x.moveTo(17,hy-14);x.lineTo(30,hy-12);x.stroke();
  }
  x.fillStyle='#5a1e28';x.beginPath();x.ellipse(28,hy+16,4.5,sc?6:4.5,0,0,7);x.fill();
  // sweat
  x.fillStyle='#9fd8ff';x.beginPath();x.moveTo(37,hy-22);x.quadraticCurveTo(44,hy-10,37,hy-8);x.quadraticCurveTo(31,hy-10,37,hy-22);x.fill();
  // hat
  x.fillStyle=LINE;x.beginPath();x.ellipse(0,hy-16,39,24,-0.05,Math.PI,0);x.fill();
  x.fillStyle=HAT;x.beginPath();x.ellipse(0,hy-17,36,21.5,-0.05,Math.PI,0);x.fill();
  x.fillStyle=LINE;x.beginPath();x.ellipse(14,hy-15,30,7,-0.05,0,7);x.fill();
  x.fillStyle=HAT_S;x.beginPath();x.ellipse(14,hy-15.5,27.5,5,-0.05,0,7);x.fill();
  x.fillStyle='rgba(255,255,255,0.5)';x.beginPath();x.ellipse(-8,hy-30,10,4,-0.3,0,7);x.fill();
  // front arm on top
  limb(x,4,hipY-36,o.armF,26,9,SHIRT,SKIN,hand);
  x.restore();
}
function drawBack(x,o){
  // seen from behind, struggling against the belly
  x.save();x.translate(CX,GY-o.bob);
  const hipY=-52;
  limb(x,-9,hipY,o.legL,40,12,SHORTS,SOCK,shoe);
  limb(x,9,hipY,o.legR,40,12,SHORTS,SOCK,shoe);
  limb(x,-16,hipY-36,o.armL,28,9,SHIRT,SKIN,hand);
  limb(x,16,hipY-36,o.armR,28,9,SHIRT,SKIN,hand);
  x.fillStyle=LINE;x.beginPath();x.roundRect(-21,hipY-46,42,52,14);x.fill();
  x.fillStyle=SHIRT;x.beginPath();x.roundRect(-18.5,hipY-43.5,37,40,12);x.fill();
  x.fillStyle=SHORTS;x.beginPath();x.roundRect(-18.5,hipY-8,37,13,5);x.fill();
  // randoseru big
  x.fillStyle=LINE;x.beginPath();x.roundRect(-22,hipY-52,44,46,9);x.fill();
  x.fillStyle=BAG;x.beginPath();x.roundRect(-19.5,hipY-49.5,39,41,7);x.fill();
  x.fillStyle=BAG_S;x.beginPath();x.roundRect(-19.5,hipY-49.5,39,22,7);x.fill();
  x.fillStyle='#ffd34d';x.fillRect(-3,hipY-30,6,7);
  const hy=hipY-78;
  x.fillStyle=LINE;x.beginPath();x.ellipse(0,hy,36,34,0,0,7);x.fill();
  x.fillStyle=HAIR;x.beginPath();x.ellipse(0,hy,33,31,0,0,7);x.fill();
  x.fillStyle=SKIN;x.beginPath();x.ellipse(-34,hy+4,6,9,0,0,7);x.fill();x.beginPath();x.ellipse(34,hy+4,6,9,0,0,7);x.fill();
  x.fillStyle=LINE;x.beginPath();x.ellipse(0,hy-14,39,24,0,Math.PI,0);x.fill();
  x.fillStyle=HAT;x.beginPath();x.ellipse(0,hy-15,36,21.5,0,Math.PI,0);x.fill();
  x.fillStyle=HAT_S;x.fillRect(-36,hy-16,72,4);
  // sweat drops flying
  x.fillStyle='#9fd8ff';for(const [dx,dy] of [[-40,-30],[42,-24]]){x.beginPath();x.arc(dx,hy+dy,4,0,7);x.fill();}
  x.restore();
}
function buildSheet(){
  const frames=[];const N=8;
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2,s=Math.sin(a);
    frames.push({k:'side',legF:s*0.85,legB:-s*0.85,armF:-s*1.0-0.2,armB:s*1.0-0.2,bob:Math.abs(Math.cos(a))*7,lean:0.14,face:'run'});}
  frames.push({k:'side',legF:0.08,legB:-0.08,armF:0.15,armB:-0.1,bob:0,lean:0,face:'run'});
  frames.push({k:'side',legF:0.08,legB:-0.08,armF:0.2,armB:-0.05,bob:1.5,lean:0,face:'run'});
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2;
    frames.push({k:'back',legL:0.5*Math.sin(a)+0.2,legR:-0.5*Math.sin(a)-0.2,armL:2.6+0.5*Math.sin(a*1+1),armR:-2.6-0.5*Math.sin(a+2),bob:4+3*Math.sin(a*2)});}
  frames.push({k:'side',legF:0.6,legB:-0.5,armF:-2.4,armB:2.2,bob:10,lean:-0.2,face:'scared'});
  const cols=8,rows=Math.ceil(frames.length/cols);
  const c=document.createElement('canvas');c.width=CW*cols;c.height=CH*rows;const x=c.getContext('2d');
  frames.forEach((f,i)=>{x.save();x.translate((i%cols)*CW,Math.floor(i/cols)*CH);if(f.k==='side')drawSide(x,f);else drawBack(x,f);x.restore();});
  return {canvas:c,cols:cols,rows:rows,n:frames.length,CW:CW,CH:CH,GY:GY,CX:CX,RUN:0,IDLE:8,BACK:10,SCARED:14};
}
if(!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath();};
}
window.KidSheet=buildSheet;
})();
