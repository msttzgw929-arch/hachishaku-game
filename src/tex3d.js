// Procedural canvas textures for the 3D night town (no image files needed).
// Convention for world textures: alpha channel = emissive mask (a=1 normal, a=0.5 fully self-lit).
(function(){
'use strict';
const JP='"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","Noto Sans CJK JP","Noto Sans JP",sans-serif';
const JPM='"Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP","Noto Serif JP",serif';
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function cv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
// Pair of canvases: colour + emissive mask; finish() merges mask into alpha.
function Pair(w,h){this.c=cv(w,h);this.x=this.c.getContext('2d');this.m=cv(w,h);this.mx=this.m.getContext('2d');this.mx.fillStyle='#000';this.mx.fillRect(0,0,w,h);}
Pair.prototype.glow=function(x,y,w,h,amt){this.mx.fillStyle=`rgba(255,255,255,${amt==null?1:amt})`;this.mx.fillRect(x,y,w,h);};
Pair.prototype.finish=function(){
  const w=this.c.width,h=this.c.height,a=this.x.getImageData(0,0,w,h),m=this.mx.getImageData(0,0,w,h).data,d=a.data;
  for(let i=0;i<d.length;i+=4)d[i+3]=255-(m[i]>>1);
  this.x.putImageData(a,0,0);return this.c;
};
function noise(x,w,h,amt,R,size){
  const n=Math.floor(w*h/(size*size)*0.5);
  for(let i=0;i<n;i++){const v=R()<0.5?0:255;x.fillStyle=`rgba(${v},${v},${v},${R()*amt})`;const s=size*(0.5+R());x.fillRect(R()*w,R()*h,s,s);}
}
function stains(x,w,h,R,n,col){
  for(let i=0;i<n;i++){const sx=R()*w,sy=R()*h*0.3,len=h*(0.2+R()*0.8),ww=4+R()*14;
    const g=x.createLinearGradient(0,sy,0,sy+len);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(sx,sy,ww,len);}
}

// ---- ground
function asphalt(){
  const R=rng(11),S=512,c=cv(S,S),x=c.getContext('2d');
  x.fillStyle='#3a3c44';x.fillRect(0,0,S,S);
  noise(x,S,S,0.25,R,3);noise(x,S,S,0.12,R,9);
  // patches
  for(let i=0;i<5;i++){x.fillStyle=`rgba(${R()<0.5?20:70},${R()<0.5?22:72},${R()<0.5?28:80},0.25)`;const w=60+R()*160,h=40+R()*120;x.fillRect(R()*S,R()*S,w,h);}
  // cracks
  x.strokeStyle='rgba(10,10,14,0.55)';x.lineWidth=1.5;
  for(let i=0;i<9;i++){x.beginPath();let px=R()*S,py=R()*S;x.moveTo(px,py);for(let k=0;k<8;k++){px+=(R()-0.5)*50;py+=(R()-0.5)*50;x.lineTo(px,py);}x.stroke();}
  // wet sheen
  for(let i=0;i<4;i++){const gx=R()*S,gy=R()*S,r=50+R()*90,g=x.createRadialGradient(gx,gy,0,gx,gy,r);g.addColorStop(0,'rgba(120,130,170,0.16)');g.addColorStop(1,'rgba(120,130,170,0)');x.fillStyle=g;x.fillRect(gx-r,gy-r,r*2,r*2);}
  return c;
}
function dirt(){
  const R=rng(12),S=512,c=cv(S,S),x=c.getContext('2d');
  x.fillStyle='#4a4436';x.fillRect(0,0,S,S);noise(x,S,S,0.3,R,4);
  for(let i=0;i<260;i++){ // weeds
    const gx=R()*S,gy=R()*S;x.strokeStyle=`rgba(${40+R()*40|0},${70+R()*50|0},${30+R()*20|0},0.8)`;x.lineWidth=1+R()*1.5;
    for(let k=0;k<5;k++){x.beginPath();x.moveTo(gx,gy);x.lineTo(gx+(R()-0.5)*14,gy-6-R()*14);x.stroke();}
  }
  for(let i=0;i<40;i++){x.fillStyle=`rgba(150,150,140,${0.3+R()*0.3})`;x.beginPath();x.arc(R()*S,R()*S,1+R()*3,0,7);x.fill();}
  return c;
}

// ---- building facades: 8 bays x 8 floors, each 128px = 3m
function facade(variant){
  const R=rng(100+variant),S=1024,B=128,P=new Pair(S,S),x=P.x;
  const base=variant===0?['#5d6068','#53565e','#666870']:['#6e6658','#625a4f','#776e60'];
  x.fillStyle=base[0];x.fillRect(0,0,S,S);
  noise(x,S,S,0.15,R,4);
  for(let f=0;f<8;f++){ // floor bands
    x.fillStyle='rgba(0,0,0,0.18)';x.fillRect(0,f*B+B-10,S,6);
    x.fillStyle='rgba(255,255,255,0.05)';x.fillRect(0,f*B+B-12,S,2);
  }
  if(variant===1){x.strokeStyle='rgba(0,0,0,0.08)';x.lineWidth=1;for(let yy=0;yy<S;yy+=8){x.beginPath();x.moveTo(0,yy);x.lineTo(S,yy);x.stroke();}}
  for(let f=0;f<8;f++)for(let b=0;b<8;b++){
    const ox=b*B,oy=f*B,kind=R();
    if(kind<0.12){ // blank wall with AC unit / pipe
      if(R()<0.6){x.fillStyle='#b9bcc0';x.fillRect(ox+30,oy+76,56,40);x.fillStyle='#4a4d52';x.beginPath();x.arc(ox+58,oy+96,15,0,7);x.fill();}
      continue;
    }
    const ww=kind<0.55?70:96,wh=kind<0.55?62:70,wx=ox+(B-ww)/2,wy=oy+18;
    x.fillStyle='#22252c';x.fillRect(wx-4,wy-4,ww+8,wh+8); // frame
    const lit=R();
    if(lit<0.22){ // warm lit
      const g=x.createLinearGradient(0,wy,0,wy+wh);g.addColorStop(0,'#ffd99a');g.addColorStop(1,'#d9934e');x.fillStyle=g;x.fillRect(wx,wy,ww,wh);
      if(R()<0.6){x.fillStyle='rgba(120,60,40,0.75)';x.fillRect(wx,wy,ww*0.35,wh);x.fillRect(wx+ww*0.7,wy,ww*0.3,wh);} // curtains
      P.glow(wx,wy,ww,wh,0.85);
    }else if(lit<0.3){ // cold TV light
      x.fillStyle='#6f9fd8';x.fillRect(wx,wy,ww,wh);x.fillStyle='rgba(20,30,60,0.5)';x.fillRect(wx,wy+wh*0.5,ww,wh*0.5);P.glow(wx,wy,ww,wh,0.7);
    }else{
      const g=x.createLinearGradient(wx,wy,wx+ww,wy+wh);g.addColorStop(0,'#2b3442');g.addColorStop(0.5,'#141820');g.addColorStop(1,'#20262f');x.fillStyle=g;x.fillRect(wx,wy,ww,wh);
      x.fillStyle='rgba(150,170,210,0.10)';x.beginPath();x.moveTo(wx,wy+wh);x.lineTo(wx+ww*0.4,wy);x.lineTo(wx+ww*0.55,wy);x.lineTo(wx+ww*0.15,wy+wh);x.fill();
    }
    x.fillStyle='#22252c';x.fillRect(wx+ww/2-2,wy,4,wh);
    if(R()<0.35){ // balcony rail
      x.fillStyle='rgba(30,32,38,0.95)';x.fillRect(ox+4,oy+wh+20,B-8,6);
      for(let k=ox+8;k<ox+B-6;k+=9)x.fillRect(k,oy+wh+24,3,22);x.fillRect(ox+4,oy+wh+44,B-8,4);
    }
  }
  stains(x,S,S,R,40,'rgba(20,18,16,0.25)');
  return P.finish();
}
// ground floor shop fronts: 4 bays x (4m x 3.2m) -> 256x256 each
function shops(){
  const R=rng(200),W=1024,H=256,P=new Pair(W,H),x=P.x;
  x.fillStyle='#45474d';x.fillRect(0,0,W,H);noise(x,W,H,0.15,R,4);
  for(let b=0;b<4;b++){
    const ox=b*256;
    x.fillStyle='#2a2c31';x.fillRect(ox,0,256,34); // fascia
    if(b===0||b===2){ // shutter
      x.fillStyle=b===0?'#8a8e94':'#7a7f86';x.fillRect(ox+14,44,228,212);
      for(let y=48;y<256;y+=7){x.fillStyle='rgba(0,0,0,0.22)';x.fillRect(ox+14,y,228,2);x.fillStyle='rgba(255,255,255,0.07)';x.fillRect(ox+14,y+2,228,1);}
      stains(x,256,256,R,3,'rgba(30,25,20,0.3)');
      x.fillStyle='rgba(255,255,255,0.75)';x.font=`900 22px ${JP}`;x.textAlign='center';x.fillText(b===0?'本日休業':'テナント募集',ox+128,26);
    }else if(b===1){ // lit glass door shop (snack)
      x.fillStyle='#1b1d22';x.fillRect(ox+14,44,228,212);
      const g=x.createLinearGradient(0,60,0,256);g.addColorStop(0,'#ffcf8a');g.addColorStop(1,'#a85a2a');x.fillStyle=g;x.fillRect(ox+30,64,90,192);x.fillRect(ox+136,64,90,120);
      P.glow(ox+30,64,90,192,0.8);P.glow(ox+136,64,90,120,0.8);
      x.fillStyle='rgba(60,20,20,0.8)';x.fillRect(ox+136,64,90,40);// noren
      x.fillStyle='#f5e6c8';x.font=`900 20px ${JPM}`;x.textAlign='center';x.fillText('営業中',ox+181,92);
      x.fillStyle='#ff6fae';x.font=`900 24px ${JP}`;x.fillText('スナック 夜霧',ox+128,26);P.glow(ox+40,4,176,28,0.9);
    }else{ // dark house door + window
      x.fillStyle='#3b3a38';x.fillRect(ox+20,60,80,196);x.fillStyle='#55504a';x.fillRect(ox+26,66,68,190);
      x.fillStyle='#1a1d24';x.fillRect(ox+130,80,100,80);x.fillStyle='#e9e2c8';x.fillRect(ox+132,82,96,6);
      x.fillStyle='rgba(255,255,255,0.6)';x.font=`700 18px ${JPM}`;x.textAlign='center';x.fillText('田 中',ox+180,26);
      x.fillStyle='#ffe9b0';x.fillRect(ox+102,96,10,14);P.glow(ox+102,96,10,14,1); // door light
    }
  }
  return P.finish();
}
// ---- props atlas 1024x1024
const AT={};
function region(n,x,y,w,h){AT[n]=[x,y,w,h];}
function atlas(){
  const R=rng(300),S=1024,P=new Pair(S,S),x=P.x;
  x.fillStyle='#808080';x.fillRect(0,0,S,S);
  region('white',0,0,32,32);x.fillStyle='#fff';x.fillRect(0,0,32,32);
  const emis=[['eWarm','#ffe2a8'],['eCold','#dff6ff'],['eRed','#ff3b3b'],['ePink','#ff6fd0'],['eYellow','#ffe14d'],['eCyan','#4df0ff'],['eFlame','#ffb347'],['eWhite','#ffffff']];
  emis.forEach((e,i)=>{const X=32+i*32;region(e[0],X,0,32,32);x.fillStyle=e[1];x.fillRect(X,0,32,32);P.glow(X,0,32,32,1);});
  // roof concrete
  region('roof',300,0,128,128);x.fillStyle='#2c2e33';x.fillRect(300,0,128,128);noise(x.canvas.getContext('2d'),0,0,0,R,1);
  for(let i=0;i<300;i++){x.fillStyle=`rgba(0,0,0,${R()*0.2})`;x.fillRect(300+R()*128,R()*128,3,3);}
  // metal & concrete
  region('metal',440,0,64,64);x.fillStyle='#9aa0a8';x.fillRect(440,0,64,64);for(let i=0;i<64;i+=4){x.fillStyle='rgba(0,0,0,0.08)';x.fillRect(440,i,64,1);}
  region('concrete',520,0,64,64);x.fillStyle='#8b8b86';x.fillRect(520,0,64,64);for(let i=0;i<200;i++){x.fillStyle=`rgba(0,0,0,${R()*0.15})`;x.fillRect(520+R()*64,R()*64,2,2);}
  region('wood',600,0,64,64);x.fillStyle='#5a4130';x.fillRect(600,0,64,64);for(let i=0;i<64;i+=5){x.fillStyle='rgba(0,0,0,0.2)';x.fillRect(600,i,64,1);}
  region('glassDark',680,0,64,64);x.fillStyle='#14181f';x.fillRect(680,0,64,64);x.fillStyle='rgba(160,180,220,0.18)';x.fillRect(684,4,20,56);
  // vending machines (front 128x256)
  function vend(X,Y,body,accent){
    x.fillStyle=body;x.fillRect(X,Y,128,256);
    x.fillStyle='#e8f6ff';x.fillRect(X+8,Y+10,112,120);P.glow(X+8,Y+10,112,120,1);
    const cols=['#e33','#36c','#fc3','#3a5','#f80','#c3c','#6cf','#fff'];
    for(let r=0;r<3;r++)for(let k=0;k<6;k++){const cx=X+14+k*18,cy=Y+18+r*38;x.fillStyle=cols[(r*6+k*3+X)%cols.length];x.fillRect(cx,cy,12,24);x.fillStyle='#222';x.fillRect(cx,cy+27,12,5);x.fillStyle='#4f4';x.fillRect(cx+4,cy+28,4,3);}
    P.glow(X+8,Y+10,112,120,1);
    x.fillStyle=accent;x.fillRect(X+8,Y+136,112,40);P.glow(X+8,Y+136,112,40,0.9);
    x.fillStyle='#fff';x.font=`900 20px ${JP}`;x.textAlign='center';x.fillText('つめた〜い',X+64,Y+163);
    x.fillStyle='#111';x.fillRect(X+86,Y+184,22,36);x.fillStyle='#ff4040';x.fillRect(X+90,Y+190,14,6);P.glow(X+90,Y+190,14,6,1);
    x.fillStyle='#0c0c10';x.fillRect(X+16,Y+222,96,26);
  }
  region('vendA',0,40,128,256);vend(0,40,'#c8102e','#1e5bd8');
  region('vendB',136,40,128,256);vend(136,40,'#f0f0f0','#e03030');
  region('vendC',272,140,128,256);vend(272,140,'#1f63c9','#ff8a00');
  region('vendSide',410,140,48,256);x.fillStyle='#d8d8d8';x.fillRect(410,140,48,256);x.fillStyle='rgba(0,0,0,0.15)';x.fillRect(410,140,4,256);
  // block wall (2m x 1.2m)
  region('block',470,140,256,154);x.fillStyle='#8e8c84';x.fillRect(470,140,256,154);
  for(let r=0;r<6;r++)for(let k=0;k<6;k++){const bx=470+k*44+(r%2?22:0)-22,by=140+r*25;x.strokeStyle='rgba(40,40,36,0.55)';x.lineWidth=2;x.strokeRect(bx,by,44,25);}
  stains(x,256,154,R,0,'#000');for(let i=0;i<10;i++){const sx=470+R()*250;const g=x.createLinearGradient(0,140,0,294);g.addColorStop(0,'rgba(30,40,30,0.35)');g.addColorStop(1,'rgba(30,40,30,0)');x.fillStyle=g;x.fillRect(sx,140,6+R()*10,154);}
  x.fillStyle='#6d6c66';x.fillRect(470,140,256,8);
  // utility pole
  region('pole',740,140,64,256);x.fillStyle='#8d8c88';x.fillRect(740,140,64,256);for(let i=0;i<40;i++){x.fillStyle=`rgba(0,0,0,${R()*0.15})`;x.fillRect(740+R()*64,140+R()*256,3,8);}
  region('plate',820,250,64,96);x.fillStyle='#e8e8e0';x.fillRect(820,250,64,96);x.fillStyle='#163a8a';x.font=`900 17px ${JP}`;x.textAlign='center';x.fillText('八尺町',852,280);x.fillText('四丁目',852,306);x.fillStyle='#c01818';x.font=`900 13px ${JP}`;x.fillText('夜道注意',852,334);
  // lantern
  region('lantern',820,140,64,96);{const g=x.createRadialGradient(852,188,4,852,188,44);g.addColorStop(0,'#ff9a6a');g.addColorStop(1,'#c4161c');x.fillStyle=g;x.fillRect(820,140,64,96);
    for(let y=146;y<236;y+=8){x.fillStyle='rgba(80,0,0,0.35)';x.fillRect(820,y,64,2);}x.fillStyle='#111';x.fillRect(820,140,64,8);x.fillRect(820,228,64,8);
    x.fillStyle='#1a0000';x.font=`900 34px ${JPM}`;x.textAlign='center';x.fillText('酒',852,202);P.glow(820,148,64,80,0.95);}
  region('mirror',890,140,64,64);x.fillStyle='#ff7a1a';x.fillRect(890,140,64,64);{const g=x.createRadialGradient(916,166,2,922,172,28);g.addColorStop(0,'#cfd8e8');g.addColorStop(1,'#3a4558');x.fillStyle=g;x.beginPath();x.arc(922,172,26,0,7);x.fill();P.mx.fillStyle='rgba(255,255,255,0.35)';P.mx.beginPath();P.mx.arc(922,172,24,0,7);P.mx.fill();}
  // vertical neon signs 96x320
  const vs=[['占','い','#c070ff','#1a0830'],['ス','ナ','ッ','ク','#ff5fbf','#220818'],['ク','リ','ー','ニ','ン','グ','#49c6ff','#061826'],['質','#7dffcf','#062018'],['居','酒','屋','#ff4d3d','#200606'],['理','容','#ffffff','#101830'],['麻','雀','#9dff5a','#0a1a06'],['旅','館','#ffd36b','#201606']];
  vs.forEach((s,i)=>{const X=i*104,Y=420;region('vsign'+i,X,Y,96,320);const txt=s.slice(0,s.length-2),col=s[s.length-2],bg=s[s.length-1];
    x.fillStyle=bg;x.fillRect(X,Y,96,320);x.strokeStyle=col;x.lineWidth=5;x.strokeRect(X+6,Y+6,84,308);
    const fs=Math.min(70,290/txt.length);x.font=`900 ${fs}px ${JP}`;x.textAlign='center';x.textBaseline='middle';
    x.shadowColor=col;x.shadowBlur=14;x.fillStyle='#fff';txt.forEach((t,k)=>x.fillText(t,X+48,Y+20+fs*0.55+k*(300-fs*0.1)/txt.length));x.shadowBlur=0;
    x.fillStyle=col;x.globalAlpha=0.35;txt.forEach((t,k)=>x.fillText(t,X+48,Y+20+fs*0.55+k*(300-fs*0.1)/txt.length));x.globalAlpha=1;
    P.glow(X,Y,96,320,0.85);x.textBaseline='alphabetic';});
  // horizontal signs 320x96
  const hs=[['たばこ','#ff3030','#fff',1],['コインランドリー','#30c0ff','#032',1],['P 駐車場','#ffe14d','#123',1],['売地','#f2f2ea','#c01010',0],['立入禁止','#ffe14d','#111',0],['八尺神社','#efe6d0','#200',0],['24H','#7dff6a','#031',1],['質・買取','#4df0ff','#022',1]];
  hs.forEach((s,i)=>{const X=(i%3)*330,Y=750+Math.floor(i/3)*100;region('hsign'+i,X,Y,320,96);
    x.fillStyle=s[1];x.fillRect(X,Y,320,96);x.fillStyle=s[2];x.font=`900 ${s[0].length>5?40:58}px ${JP}`;x.textAlign='center';x.textBaseline='middle';x.fillText(s[0],X+160,Y+50);x.textBaseline='alphabetic';
    x.strokeStyle='rgba(0,0,0,0.4)';x.lineWidth=4;x.strokeRect(X+2,Y+2,316,92);if(s[3])P.glow(X,Y,320,96,0.8);});
  // car paint / misc
  region('carWin',1000,0,24,24);x.fillStyle='#0d1016';x.fillRect(1000,0,24,24);
  region('tire',1000,40,24,24);x.fillStyle='#16161a';x.fillRect(1000,40,24,24);
  return P.finish();
}
// decals with real alpha: 0 止まれ 1 manhole
const DC={};
function decals(){
  const S=512,c=cv(S,S),x=c.getContext('2d');
  DC.line=[0,0,16,16];x.fillStyle='rgba(235,235,225,0.85)';x.fillRect(0,0,16,16);
  DC.tomare=[0,32,512,200];x.fillStyle='rgba(240,240,230,0.85)';x.font=`900 150px ${JP}`;x.textAlign='center';x.textBaseline='middle';
  x.save();x.translate(256,132);x.scale(1,1.35);x.fillText('止まれ',0,0);x.restore();
  DC.manhole=[0,256,200,200];{const cx=100,cy=356;x.fillStyle='#2b2c30';x.beginPath();x.arc(cx,cy,96,0,7);x.fill();x.strokeStyle='#55575d';x.lineWidth=6;x.beginPath();x.arc(cx,cy,90,0,7);x.stroke();
    x.lineWidth=3;for(let r=20;r<90;r+=14){x.beginPath();x.arc(cx,cy,r,0,7);x.stroke();}for(let a=0;a<12;a++){x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a/12*6.283)*88,cy+Math.sin(a/12*6.283)*88);x.stroke();}}
  DC.pool=[256,256,256,256];{const g=x.createRadialGradient(384,384,0,384,384,128);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.5,'rgba(255,255,255,0.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(256,256,256,256);}
  DC.stone=[220,256,32,32];x.fillStyle='rgba(150,148,140,0.9)';x.fillRect(220,256,32,32);
  return c;
}
function glowTex(){const S=64,c=cv(S,S),x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.25,'rgba(255,255,255,0.45)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,S,S);return c;}
function fogTex(){const R=rng(5),S=256,c=cv(S,S),x=c.getContext('2d');for(let i=0;i<40;i++){const gx=S/2+(R()-0.5)*S*0.5,gy=S/2+(R()-0.5)*S*0.3,r=30+R()*60,g=x.createRadialGradient(gx,gy,0,gx,gy,r);g.addColorStop(0,'rgba(255,255,255,0.12)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,S,S);}return c;}
window.Tex3D={asphalt,dirt,facade,shops,atlas,decals,glowTex,fogTex,AT,DC,rng};
})();
