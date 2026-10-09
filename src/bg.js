// Procedural night back-alley stage (pre-rendered to offscreen canvases).
(function(){
'use strict';
const W=2400,D=430,MARGIN=1000,FS=1.25;      // world width/depth, facade margin, texture px per unit
const Y_NEAR=700,Y_FAR=432,S_FAR=0.66,ZF=D*S_FAR/(1-S_FAR),H0=(Y_FAR-Y_NEAR*S_FAR)/(1-S_FAR);
const ZMIN=-200; // floor rendered in front of play area
const World={W:W,D:D,Y_NEAR:Y_NEAR,Y_FAR:Y_FAR,
  s:(z)=>ZF/(ZF+z),
  y:(z)=>H0+(Y_NEAR-H0)*(ZF/(ZF+z))};
function rng(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const FACADE_H=820,FZ=D+12; // facade plane depth
const lights=[]; // {x, color, r, kind}
function makeFacade(){
  const r=rng(8),cw=Math.round((W+2*MARGIN)*FS),ch=Math.round(FACADE_H*FS);
  const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');
  x.scale(FS,FS);x.translate(MARGIN,0);
  const base=FACADE_H;
  // buildings
  let px=-MARGIN;const segs=[];
  const types=['apt','shop','snack','apt','vend','shop','gap','apt','cleaning','shop','apt','snack','vend','gap'];
  let ti=0;
  while(px<W+MARGIN){
    const t=types[ti++%types.length];const w=t==='gap'?70+r()*40:t==='vend'?200:230+r()*190;
    segs.push({x:px,w:w,t:t,h:t==='gap'?FACADE_H:430+r()*330});px+=w;
  }
  for(const s of segs){
    const top=base-s.h;
    if(s.t==='gap'){
      const g=x.createLinearGradient(s.x,0,s.x+s.w,0);g.addColorStop(0,'#04040a');g.addColorStop(0.5,'#090a14');g.addColorStop(1,'#04040a');
      x.fillStyle=g;x.fillRect(s.x,0,s.w,base);
      const lg=x.createRadialGradient(s.x+s.w/2,base-90,2,s.x+s.w/2,base-90,90);lg.addColorStop(0,'rgba(120,140,255,0.22)');lg.addColorStop(1,'rgba(0,0,0,0)');
      x.fillStyle=lg;x.fillRect(s.x,base-200,s.w,200);continue;
    }
    const hue=220+r()*30,l=9+r()*6;
    const g=x.createLinearGradient(0,top,0,base);g.addColorStop(0,`hsl(${hue},18%,${l+3}%)`);g.addColorStop(1,`hsl(${hue},20%,${l-3}%)`);
    x.fillStyle=g;x.fillRect(s.x,top,s.w,s.h);
    // concrete texture
    for(let i=0;i<s.w*s.h/260;i++){x.fillStyle=`rgba(${r()<.5?0:255},${r()<.5?0:255},255,${r()*0.035})`;x.fillRect(s.x+r()*s.w,top+r()*s.h,1+r()*3,1+r()*3);}
    for(let yy=top+40;yy<base-10;yy+=46+r()*10){x.fillStyle='rgba(0,0,0,0.18)';x.fillRect(s.x,yy,s.w,1.2);}
    // roof edge
    x.fillStyle='rgba(255,255,255,0.05)';x.fillRect(s.x,top,s.w,4);
    x.fillStyle='rgba(0,0,0,0.5)';x.fillRect(s.x+s.w-3,top,3,s.h);
    // windows (upper floors)
    const groundTop=base-170;
    const cols=Math.max(1,Math.floor(s.w/95)),rows=Math.max(1,Math.floor((groundTop-top-30)/95));
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      const ww=48,wh=56,wx=s.x+(s.w/cols)*(i+0.5)-ww/2,wy=top+30+j*95;
      const lit=r()<0.18;
      if(lit){
        const wg=x.createLinearGradient(0,wy,0,wy+wh);wg.addColorStop(0,'#ffcf86');wg.addColorStop(1,'#e8984a');x.fillStyle=wg;
        x.shadowColor='rgba(255,180,90,0.8)';x.shadowBlur=18;x.fillRect(wx,wy,ww,wh);x.shadowBlur=0;
        x.fillStyle='rgba(120,60,30,0.55)';x.fillRect(wx,wy,ww*0.3,wh);x.fillRect(wx+ww*0.7,wy,ww*0.3,wh);
        if(r()<0.3){x.fillStyle='rgba(30,10,10,0.7)';x.beginPath();x.ellipse(wx+ww*0.5,wy+wh*0.62,7,12,0,0,7);x.fill();x.fillRect(wx+ww*0.5-9,wy+wh*0.75,18,wh*0.25);} // silhouette
      }else{x.fillStyle='#0a0c16';x.fillRect(wx,wy,ww,wh);x.fillStyle='rgba(120,140,200,0.08)';x.fillRect(wx+3,wy+3,ww-6,6);}
      x.strokeStyle='rgba(160,170,210,0.18)';x.lineWidth=2;x.strokeRect(wx,wy,ww,wh);
      if(s.t==='apt'&&r()<0.5){ // balcony rail
        x.fillStyle='rgba(150,160,200,0.15)';x.fillRect(wx-12,wy+wh-14,ww+24,3);for(let k=0;k<8;k++)x.fillRect(wx-12+k*(ww+24)/7,wy+wh-14,2,18);
      }
      if(r()<0.22){ // AC unit
        const ax=wx+ww+8,ay=wy+wh-30;x.fillStyle='#c9ccd6';x.fillRect(ax,ay,34,26);x.fillStyle='#8a8f9e';x.beginPath();x.arc(ax+17,ay+13,9,0,7);x.fill();
        x.fillStyle='rgba(0,0,0,0.35)';x.fillRect(ax,ay+24,34,3);
      }
    }
    // pipes
    if(r()<0.7){const pxx=s.x+8+r()*(s.w-16);x.fillStyle='#2d3242';x.fillRect(pxx,top+10,7,s.h-10);x.fillStyle='rgba(255,255,255,0.06)';x.fillRect(pxx+1,top+10,2,s.h-10);}
    // ground floor
    const gy=base-150;
    if(s.t==='shop'||s.t==='cleaning'){
      // shutter
      const sx=s.x+20,sw=s.w-40;x.fillStyle='#2b3040';x.fillRect(sx,gy,sw,150);
      for(let yy=gy;yy<base;yy+=7){x.fillStyle='rgba(0,0,0,0.35)';x.fillRect(sx,yy,sw,1.5);x.fillStyle='rgba(255,255,255,0.04)';x.fillRect(sx,yy+2,sw,1);}
      x.fillStyle='#1a1d28';x.fillRect(sx-6,gy-16,sw+12,16);
      // sign board
      const names=s.t==='cleaning'?['クリーニング']:['居酒屋 よるの','たばこ','やきとり','質 ・ 買取','理容 ナカムラ','コインランドリー'];
      const nm=names[Math.floor(r()*names.length)];
      const col=s.t==='cleaning'?'#4aa8ff':['#ffd36a','#7fe0ff','#ff8d6a','#b9ff8a'][Math.floor(r()*4)];
      x.fillStyle='#0d0f18';x.fillRect(sx,gy-60,sw,40);
      x.fillStyle=col;x.globalAlpha=0.16;x.fillRect(sx,gy-60,sw,40);x.globalAlpha=1;
      x.font='bold 26px "Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.shadowColor=col;x.shadowBlur=16;x.fillStyle=col;x.fillText(nm,sx+sw/2,gy-40,sw-16);x.shadowBlur=0;
      lights.push({x:s.x+s.w/2,color:col,r:150,k:0.18});
      // vertical neon
      if(r()<0.75||s.t==='cleaning'){
        const vx=s.x+s.w-34,vy=top+40>gy-330?top+40:gy-330,vt=s.t==='cleaning'?'クリーニング':['スナック','ホテル','BAR','カラオケ','麻雀','占い'][Math.floor(r()*6)];
        const vc=s.t==='cleaning'?'#3d9bff':['#ff4f8b','#ff3b3b','#58e1ff','#c46bff'][Math.floor(r()*4)];
        const hh=vt.length*30+20;x.fillStyle='#0a0b12';x.fillRect(vx-18,vy,36,hh);
        x.strokeStyle=vc;x.lineWidth=2.5;x.shadowColor=vc;x.shadowBlur=20;x.strokeRect(vx-18,vy,36,hh);
        x.fillStyle='#fff';x.font='bold 24px "Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';
        for(let k=0;k<vt.length;k++){x.fillStyle=vc;x.fillText(vt[k],vx,vy+24+k*30);}
        x.shadowBlur=0;lights.push({x:vx,color:vc,r:120,k:0.22});
      }
    }else if(s.t==='snack'){
      const dx=s.x+s.w/2-40;x.fillStyle='#120a0c';x.fillRect(dx,gy+10,80,140);
      const dg=x.createLinearGradient(0,gy+10,0,base);dg.addColorStop(0,'rgba(255,160,90,0.55)');dg.addColorStop(1,'rgba(255,90,60,0.25)');
      x.fillStyle=dg;x.fillRect(dx+8,gy+20,64,120);x.fillStyle='#3b2412';x.fillRect(dx+38,gy+20,4,120);
      x.font='bold 30px "Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';x.textAlign='center';
      x.shadowColor='#ff4fb0';x.shadowBlur=22;x.fillStyle='#ff7fd0';x.fillText('スナック ぽぽぽ',s.x+s.w/2,gy-40,s.w-20);
      x.shadowBlur=0;lights.push({x:s.x+s.w/2,color:'#ff5fbf',r:170,k:0.25});
      // standing sign
      x.fillStyle='#fff3e0';x.shadowColor='#ffd9a0';x.shadowBlur=18;x.fillRect(dx+95,base-70,34,60);x.shadowBlur=0;
      x.fillStyle='#b0306a';x.font='bold 14px sans-serif';x.fillText('営',dx+112,base-50);x.fillText('業',dx+112,base-30);
    }else if(s.t==='vend'){
      for(let k=0;k<2;k++){
        const vx=s.x+25+k*82,vy=base-175;
        x.fillStyle='#d8dde8';x.fillRect(vx,vy,74,175);
        const pg=x.createLinearGradient(0,vy,0,vy+110);pg.addColorStop(0,'#f4fbff');pg.addColorStop(1,'#bfe0ff');
        x.shadowColor='#bfe6ff';x.shadowBlur=30;x.fillStyle=pg;x.fillRect(vx+6,vy+8,62,100);x.shadowBlur=0;
        const cols=['#e33','#36f','#fc3','#3c6','#f80','#a3f','#eee','#c22'];
        for(let rr=0;rr<3;rr++)for(let cc=0;cc<5;cc++){x.fillStyle=cols[Math.floor(r()*cols.length)];x.fillRect(vx+10+cc*12,vy+14+rr*32,8,20);x.fillStyle='#223';x.fillRect(vx+10+cc*12,vy+36+rr*32,8,3);}
        x.fillStyle='#2b2f3a';x.fillRect(vx+10,vy+128,54,22);x.fillStyle=k?'#e23a3a':'#2a6be0';x.fillRect(vx,vy,74,6);
      }
      lights.push({x:s.x+105,color:'#cfeaff',r:190,k:0.3});
    }else{
      // apt entrance
      const dx=s.x+s.w*0.3;x.fillStyle='#0b0d15';x.fillRect(dx,gy+20,70,130);
      x.fillStyle='rgba(170,200,255,0.18)';x.fillRect(dx+6,gy+28,58,60);
      x.fillStyle='#e8eeff';x.shadowColor='#bcd0ff';x.shadowBlur=14;x.fillRect(dx+20,gy+4,30,8);x.shadowBlur=0;
      // mailboxes
      x.fillStyle='#3a4050';for(let k=0;k<6;k++)x.fillRect(dx+90+(k%3)*22,gy+50+Math.floor(k/3)*18,18,14);
    }
  }
  // utility poles + wires + lamps
  const poles=[];for(let p=-MARGIN+200;p<W+MARGIN;p+=560+r()*120)poles.push(p);
  x.strokeStyle='rgba(10,10,16,0.9)';x.lineWidth=2;
  for(let i=0;i<poles.length-1;i++)for(let k=0;k<3;k++){
    const a=poles[i],b=poles[i+1],ya=150+k*22,sag=30+k*8;x.beginPath();x.moveTo(a,ya);x.quadraticCurveTo((a+b)/2,ya+sag*2,b,ya);x.stroke();
  }
  for(const p of poles){
    const pg=x.createLinearGradient(p-9,0,p+9,0);pg.addColorStop(0,'#1a1c24');pg.addColorStop(0.4,'#4a4f5e');pg.addColorStop(1,'#15171e');
    x.fillStyle=pg;x.fillRect(p-9,120,18,base-120);
    x.fillStyle='#22252f';x.fillRect(p-50,145,100,7);x.fillRect(p-40,190,80,6);
    x.fillStyle='#2a2e3a';x.fillRect(p+10,240,30,40); // transformer
    for(let k=0;k<5;k++){x.fillStyle='#e8d36a';x.fillRect(p-8,330+k*70,16,3);} // step bolts
    // number plate
    x.fillStyle='#d8e0f0';x.fillRect(p-7,base-260,14,46);x.fillStyle='#223';x.font='9px sans-serif';x.textAlign='center';x.fillText('八',p,base-245);x.fillText('尺',p,base-232);
    // lamp arm
    x.strokeStyle='#2a2d38';x.lineWidth=5;x.beginPath();x.moveTo(p,300);x.quadraticCurveTo(p+40,285,p+70,300);x.stroke();
    x.fillStyle='#1b1d25';x.fillRect(p+55,298,34,9);
    x.shadowColor='#ffeebb';x.shadowBlur=30;x.fillStyle='#fff6d8';x.fillRect(p+58,306,28,4);x.shadowBlur=0;
    lights.push({x:p+72,color:'#ffe9b0',r:230,k:0.42,lamp:true,ly:306});
  }
  return c;
}
function makeSkyline(){
  const r=rng(3),w=2400,h=500,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  for(let i=0;i<70;i++){const bx=r()*w,bw=60+r()*160,bh=120+r()*330;x.fillStyle=`hsl(232,25%,${6+r()*4}%)`;x.fillRect(bx,h-bh,bw,bh);
    for(let k=0;k<bw*bh/1800;k++)if(r()<0.25){x.fillStyle=r()<0.5?'rgba(255,200,120,0.5)':'rgba(170,190,255,0.35)';x.fillRect(bx+r()*bw,h-bh+r()*bh,3,4);}
    if(r()<0.1){x.fillStyle='#ff2a2a';x.beginPath();x.arc(bx+bw/2,h-bh-4,2.5,0,7);x.fill();}}
  return c;
}
function makeFloor(){
  const r=rng(11),cw=Math.round((W+2*MARGIN)*FS),zr=D-ZMIN,ch=Math.round(zr*FS);
  const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');
  x.scale(FS,FS);x.translate(MARGIN,0);
  // row 0 = far (z=D); y coord = D - z
  const g=x.createLinearGradient(0,0,0,zr);g.addColorStop(0,'#1a1c26');g.addColorStop(0.5,'#14151d');g.addColorStop(1,'#101118');
  x.fillStyle=g;x.fillRect(-MARGIN,0,W+2*MARGIN,zr);
  // speckle noise
  for(let i=0;i<(W+2*MARGIN)*zr/22;i++){const v=r();x.fillStyle=v<0.5?`rgba(0,0,0,${r()*0.25})`:`rgba(180,190,230,${r()*0.07})`;x.fillRect(-MARGIN+r()*(W+2*MARGIN),r()*zr,1+r()*2,1+r()*2);}
  // patches
  for(let i=0;i<40;i++){x.fillStyle=`rgba(${r()<0.5?0:60},${r()<0.5?0:60},${r()<0.5?10:80},0.12)`;const px=-MARGIN+r()*(W+2*MARGIN),py=20+r()*(zr-40);x.beginPath();x.ellipse(px,py,60+r()*160,20+r()*40,0,0,7);x.fill();}
  // gutter / curb at the back
  x.fillStyle='#262938';x.fillRect(-MARGIN,0,W+2*MARGIN,14);x.fillStyle='#0c0d13';x.fillRect(-MARGIN,14,W+2*MARGIN,4);
  for(let gx=-MARGIN;gx<W+MARGIN;gx+=120){x.fillStyle='#0a0b10';x.fillRect(gx,2,36,10);for(let k=0;k<6;k++){x.fillStyle='#30344a';x.fillRect(gx+3+k*6,3,2,8);}}
  // cracks
  x.strokeStyle='rgba(0,0,0,0.55)';x.lineWidth=1.2;
  for(let i=0;i<55;i++){let px=-MARGIN+r()*(W+2*MARGIN),py=20+r()*(zr-30);x.beginPath();x.moveTo(px,py);for(let k=0;k<6;k++){px+=(r()-0.5)*60;py+=(r()-0.5)*16;x.lineTo(px,py);}x.stroke();}
  // manholes
  for(const mx of [380,1500,2250]){const my=D-160+(mx%3)*20;
    x.fillStyle='#0c0d12';x.beginPath();x.arc(mx,my,37,0,7);x.fill();
    x.fillStyle='#24262f';x.beginPath();x.arc(mx,my,34,0,7);x.fill();
    x.save();x.beginPath();x.arc(mx,my,30,0,7);x.clip();x.fillStyle='rgba(0,0,0,0.35)';
    for(let gx=-30;gx<30;gx+=7)for(let gy=-30;gy<30;gy+=7)if(((gx+gy)/7)%2===0)x.fillRect(mx+gx,my+gy,4,4);x.restore();
    x.strokeStyle='rgba(120,128,160,0.25)';x.lineWidth=1.5;x.beginPath();x.arc(mx,my,30,0,7);x.stroke();}
  // road marking とまれ
  x.save();x.translate(1150,D-110);x.scale(1,0.85);x.fillStyle='rgba(215,215,230,0.2)';x.font='bold 110px "Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('とまれ',0,0);x.restore();
  x.fillStyle='rgba(215,215,230,0.18)';x.fillRect(900,D-30,500,8);
  // puddles reflecting neon
  for(const L of lights){
    if(L.lamp)continue;
    if(r()<0.55){const px=L.x+(r()-0.5)*80,py=40+r()*90,pw=70+r()*90;
      x.fillStyle='rgba(8,9,16,0.85)';x.beginPath();x.ellipse(px,py,pw,18+r()*10,0,0,7);x.fill();
      const pg=x.createRadialGradient(px,py,2,px,py,pw);pg.addColorStop(0,hexA(L.color,0.55));pg.addColorStop(1,hexA(L.color,0));
      x.fillStyle=pg;x.beginPath();x.ellipse(px,py,pw,16,0,0,7);x.fill();}
  }
  // light pools
  x.globalCompositeOperation='lighter';
  for(const L of lights){
    const py=L.lamp?60:12,rr=L.lamp?L.r*1.25:L.r;
    const lg=x.createRadialGradient(L.x,py,4,L.x,py,rr);lg.addColorStop(0,hexA(L.color,L.k*(L.lamp?0.9:0.8)));lg.addColorStop(1,hexA(L.color,0));
    x.fillStyle=lg;x.save();x.translate(L.x,py);x.scale(1,L.lamp?0.75:0.5);x.translate(-L.x,-py);x.beginPath();x.arc(L.x,py,rr,0,7);x.fill();x.restore();
  }
  x.globalCompositeOperation='source-over';
  // fallen leaves / litter
  for(let i=0;i<70;i++){x.fillStyle=`hsla(${20+r()*30},50%,${20+r()*15}%,0.7)`;x.beginPath();x.ellipse(-MARGIN+r()*(W+2*MARGIN),r()*zr,3+r()*3,1.5+r()*1.5,r()*3,0,7);x.fill();}
  return c;
}
function hexA(h,a){const n=parseInt(h.slice(1),16);let rr,gg,bb;if(h.length===4){rr=((n>>8)&15)*17;gg=((n>>4)&15)*17;bb=(n&15)*17;}else{rr=n>>16&255;gg=n>>8&255;bb=n&255;}return `rgba(${rr},${gg},${bb},${a})`;}
function makeWallTex(){
  const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
  x.fillStyle='#3a3d48';x.fillRect(0,0,256,128);
  for(let yy=0;yy<128;yy+=21)for(let xx=(yy/21)%2?-24:0;xx<256;xx+=48){x.fillStyle=`hsl(225,8%,${22+Math.random()*7}%)`;x.fillRect(xx+1,yy+1,46,19);}
  x.fillStyle='rgba(0,0,0,0.25)';x.fillRect(0,0,256,6);
  return c;
}
function Stage(){
  lights.length=0;
  this.facade=makeFacade();this.floor=makeFloor();this.sky=makeSkyline();this.wall=makeWallTex();this.lights=lights.slice();
}
// cam: {VW, toScreen params: F (view focus), C (screen center), zoom, camX, px (pixels per view unit)}
Stage.prototype.draw=function(ctx,cam,t){
  const px=cam.px,Wc=ctx.canvas.width,Hc=ctx.canvas.height;
  ctx.setTransform(1,0,0,1,0,0);
  // sky
  const sg=ctx.createLinearGradient(0,0,0,Hc);sg.addColorStop(0,'#03030a');sg.addColorStop(0.55,'#0b0d22');sg.addColorStop(1,'#141634');
  ctx.fillStyle=sg;ctx.fillRect(0,0,Wc,Hc);
  // set view transform: screen = ((v-F)*zoom + C)*px
  const z=cam.zoom;
  ctx.setTransform(z*px,0,0,z*px,(cam.C.x-cam.F.x*z)*px,(cam.C.y-cam.F.y*z)*px);
  const VW=cam.VW,sb=World.s(FZ),yb=World.y(FZ);
  // moon
  const mx=VW*0.78-(cam.camX-W/2)*0.05,my=yb-560;
  const mg=ctx.createRadialGradient(mx,my,10,mx,my,160);mg.addColorStop(0,'rgba(220,225,255,0.35)');mg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=mg;ctx.fillRect(mx-160,my-160,320,320);
  ctx.fillStyle='#e9ecff';ctx.beginPath();ctx.arc(mx,my,22,0,7);ctx.fill();ctx.fillStyle='rgba(20,22,50,0.9)';ctx.beginPath();ctx.arc(mx+9,my-6,20,0,7);ctx.fill();
  // skyline (parallax)
  const ps=sb*0.75,skW=this.sky.width;
  let sx0=VW/2-(cam.camX*0.35)%skW-skW;
  for(let k=0;k<4;k++)ctx.drawImage(this.sky,sx0+k*skW*ps/ps*1,yb-FACADE_H*sb*0.9-0,skW,500*0.9);
  // facade
  // visible view-x range
  const vx0=cam.F.x+(0-cam.C.x)/z-cam.shx/z,vx1=cam.F.x+(VW-cam.C.x)/z+40/z;
  const wx=(vx,s)=>cam.camX+(vx-VW/2)/s;
  const fy=yb-FACADE_H*sb;
  {let a=Math.max(-MARGIN,wx(vx0,sb)-4),b=Math.min(W+MARGIN,wx(vx1,sb)+4);
   if(b>a)ctx.drawImage(this.facade,(a+MARGIN)*FS,0,(b-a)*FS,this.facade.height,VW/2+(a-cam.camX)*sb,fy,(b-a)*sb,FACADE_H*sb);}
  // floor strips (far -> near)
  const N=56,zr=D-ZMIN,fw=this.floor.width,fh=this.floor.height;
  for(let i=0;i<N;i++){
    const z1=D-zr*i/N,z0=D-zr*(i+1)/N; // far->near
    const zm=(z0+z1)/2,s=World.s(zm);
    const y1=World.y(z1),y0=World.y(z0);
    const tr=(D-z1)*FS,th=(z1-z0)*FS;
    const a=Math.max(-MARGIN,wx(vx0,s)-4),b=Math.min(W+MARGIN,wx(vx1,s)+4);if(b<=a)continue;
    ctx.drawImage(this.floor,(a+MARGIN)*FS,tr,(b-a)*FS,Math.min(th,fh-tr),VW/2+(a-cam.camX)*s,y1,(b-a)*s,(y0-y1)+0.8);
  }
  // dead-end block walls at both ends
  for(const wx of [0,W]){
    const wh=150,M=14;
    for(let i=0;i<M;i++){
      const z1=D-(D+40)*i/M,z0=D-(D+40)*(i+1)/M;
      const s1=World.s(z1),s0=World.s(z0);
      const x1=VW/2+(wx-cam.camX)*s1,x0=VW/2+(wx-cam.camX)*s0;
      const yb1=World.y(z1),yb0=World.y(z0);
      ctx.fillStyle=`hsl(225,9%,${15+i*0.6}%)`;
      ctx.beginPath();ctx.moveTo(x1,yb1);ctx.lineTo(x0,yb0);ctx.lineTo(x0,yb0-wh*s0);ctx.lineTo(x1,yb1-wh*s1);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1;ctx.stroke();
      ctx.strokeStyle='rgba(200,210,240,0.12)';ctx.beginPath();ctx.moveTo(x1,yb1-wh*s1);ctx.lineTo(x0,yb0-wh*s0);ctx.stroke();
    }
    // sign
    const zs=D*0.55,s=World.s(zs),sxp=VW/2+(wx-cam.camX)*s,syp=World.y(zs)-wh*s*0.62;
    ctx.save();ctx.translate(sxp,syp);ctx.scale(s,s);
    ctx.fillStyle='#e9d54a';ctx.fillRect(-48,-20,96,40);ctx.fillStyle='#111';ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('行き止まり',0,1);
    ctx.restore();
  }
};
Stage.prototype.lampFlicker=function(t,i){const v=Math.sin(t*13.7+i*5)*Math.sin(t*3.1+i);return v>0.93?0.3:1;};
window.World=World;window.Stage=Stage;window.hexA=hexA;
})();
