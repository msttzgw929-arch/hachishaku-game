// All sounds are synthesized with WebAudio (no external audio files).
(function(){
'use strict';
const A={ctx:null,master:null,muted:false,started:false};
function C(){return A.ctx;}
A.init=function(){
  if(A.ctx)return;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const c=new AC();A.ctx=c;
  A.master=c.createGain();A.master.gain.value=A.muted?0:0.9;
  const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;
  A.master.connect(comp);comp.connect(c.destination);
  // reverb
  A.rev=c.createConvolver();A.rev.buffer=impulse(c,2.8,2.2);A.revGain=c.createGain();A.revGain.gain.value=0.5;A.rev.connect(A.revGain);A.revGain.connect(A.master);
  A.sfx=c.createGain();A.sfx.gain.value=1;A.sfx.connect(A.master);
  A.sfxRev=c.createGain();A.sfxRev.gain.value=0.35;A.sfx.connect(A.sfxRev);A.sfxRev.connect(A.rev);
  A.noise=noiseBuf(c,2);
};
A.resume=function(){A.init();if(A.ctx&&A.ctx.state!=='running')A.ctx.resume();};
A.setMuted=function(m){A.muted=m;if(A.master)A.master.gain.setTargetAtTime(m?0:0.9,A.ctx.currentTime,0.05);};
function impulse(c,dur,decay){const n=c.sampleRate*dur,b=c.createBuffer(2,n,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay);}return b;}
function noiseBuf(c,dur){const n=c.sampleRate*dur,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b;}
function env(g,t,a,peak,d,sus,rel){g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(Math.max(sus,0.0001),t+a+d);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d+rel);}
function noise(t,dur,filt,freq,q,gain,dest){
  const c=C(),s=c.createBufferSource();s.buffer=A.noise;const f=c.createBiquadFilter();f.type=filt;f.frequency.value=freq;f.Q.value=q||1;
  const g=c.createGain();env(g,t,0.003,gain,dur*0.3,gain*0.3,dur*0.7);s.connect(f);f.connect(g);g.connect(dest||A.sfx);s.start(t,Math.random()*1.5);s.stop(t+dur+0.1);return f;
}
// ぽ syllable: plosive + formant-filtered glottal tone, deep & breathy
A.po=function(pitch,angry,vol){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime+0.01;pitch=pitch||1;vol=vol==null?1:vol;
  noise(t,0.05,'bandpass',1400,1.2,0.25*vol);
  const o=c.createOscillator();o.type='sawtooth';const f0=(angry?150:118)*pitch;
  o.frequency.setValueAtTime(f0*1.12,t);o.frequency.exponentialRampToValueAtTime(f0*0.86,t+0.22);
  const vib=c.createOscillator();vib.frequency.value=5.5;const vg=c.createGain();vg.gain.value=3;vib.connect(vg);vg.connect(o.frequency);
  const g=c.createGain();env(g,t+0.015,0.02,0.5*vol,0.08,0.25*vol,0.16);
  const out=c.createGain();out.gain.value=1;
  // formants for "o"
  for(const [fr,q,a] of [[470,6,1],[880,8,0.55],[2500,10,0.12]]){
    const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=fr*(angry?1.05:1);bp.Q.value=q;const ga=c.createGain();ga.gain.value=a*2.4;
    o.connect(bp);bp.connect(ga);ga.connect(g);
  }
  // breathy noise through formant
  const s=c.createBufferSource();s.buffer=A.noise;const nb=c.createBiquadFilter();nb.type='bandpass';nb.frequency.value=600;nb.Q.value=3;const ng=c.createGain();ng.gain.value=0.25;
  s.connect(nb);nb.connect(ng);ng.connect(g);s.start(t,Math.random());s.stop(t+0.4);
  g.connect(out);out.connect(A.sfx);
  const sg=c.createGain();sg.gain.value=0.6;g.connect(sg);sg.connect(A.rev);
  o.start(t);o.stop(t+0.45);vib.start(t);vib.stop(t+0.45);
};
// heavy footstep with belly "boyon"
A.step=function(vol){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime+0.005;vol=vol||1;
  const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(38,t+0.18);
  const g=c.createGain();env(g,t,0.004,0.55*vol,0.08,0.1,0.15);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+0.35);
  noise(t,0.08,'lowpass',400,0.7,0.2*vol);
  // jiggle
  const o2=c.createOscillator();o2.type='sine';o2.frequency.setValueAtTime(70,t+0.05);o2.frequency.linearRampToValueAtTime(120,t+0.12);o2.frequency.linearRampToValueAtTime(80,t+0.24);
  const g2=c.createGain();env(g2,t+0.05,0.02,0.18*vol,0.1,0.05,0.12);o2.connect(g2);g2.connect(A.sfx);o2.start(t+0.05);o2.stop(t+0.4);
};
A.patter=function(){if(!A.ctx||A.muted)return;const t=C().currentTime;noise(t,0.03,'highpass',2500,0.8,0.05);};
// slap on belly
A.slap=function(power){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime+0.003;power=power||1;
  noise(t,0.07,'bandpass',1800+Math.random()*600,0.9,0.7*power);
  const o=c.createOscillator();o.type='sine';const b=95+Math.random()*30;
  o.frequency.setValueAtTime(b*1.9,t);o.frequency.exponentialRampToValueAtTime(b,t+0.06);o.frequency.linearRampToValueAtTime(b*1.35,t+0.15);o.frequency.linearRampToValueAtTime(b*0.9,t+0.3);
  const g=c.createGain();env(g,t,0.003,0.6*power,0.12,0.1,0.2);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+0.45);
};
A.grab=function(){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime+0.01;
  for(const [f,d] of [[110,0],[116.5,0],[155.6,0.02],[233,0.04]]){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=f;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(3000,t);lp.frequency.exponentialRampToValueAtTime(300,t+1.2);
    const g=c.createGain();env(g,t+d,0.01,0.22,0.3,0.08,0.9);o.connect(lp);lp.connect(g);g.connect(A.sfx);o.start(t+d);o.stop(t+2);}
  noise(t,0.5,'lowpass',800,0.5,0.4);
};
A.squeeze=function(){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime;
  const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(60,t);o.frequency.linearRampToValueAtTime(95,t+0.25);
  const g=c.createGain();env(g,t,0.05,0.12,0.15,0.05,0.15);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+0.5);
};
A.escape=function(){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime+0.01;
  const f=noise(t,0.5,'bandpass',600,1.5,0.5);f.frequency.exponentialRampToValueAtTime(5000,t+0.4);
  [523,659,784,1046].forEach((fr,i)=>{const o=c.createOscillator();o.type='triangle';o.frequency.value=fr;const g=c.createGain();env(g,t+i*0.06,0.005,0.2,0.1,0.05,0.3);o.connect(g);g.connect(A.sfx);o.start(t+i*0.06);o.stop(t+i*0.06+0.6);});
};
A.stageUp=function(){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime+0.01;
  const o=c.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(40,t);o.frequency.exponentialRampToValueAtTime(28,t+1.4);
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=220;const g=c.createGain();env(g,t,0.05,0.6,0.5,0.2,0.9);o.connect(lp);lp.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+2);
  // inflate: rising filtered noise + rubbery stretch
  const f=noise(t+0.1,1.1,'bandpass',200,4,0.35);f.frequency.exponentialRampToValueAtTime(1600,t+1.1);
  const o2=c.createOscillator();o2.type='triangle';o2.frequency.setValueAtTime(70,t+0.2);o2.frequency.exponentialRampToValueAtTime(260,t+1.0);o2.frequency.exponentialRampToValueAtTime(140,t+1.25);
  const g2=c.createGain();env(g2,t+0.2,0.1,0.22,0.7,0.1,0.3);o2.connect(g2);g2.connect(A.sfx);o2.start(t+0.2);o2.stop(t+1.8);
};
A.dashWarn=function(){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime;
  [0,0.14].forEach(d=>{const o=c.createOscillator();o.type='square';o.frequency.value=880;const g=c.createGain();env(g,t+d,0.005,0.08,0.05,0.02,0.05);o.connect(g);g.connect(A.sfx);o.start(t+d);o.stop(t+d+0.15);});
};
A.whoosh=function(){if(!A.ctx||A.muted)return;const t=C().currentTime;const f=noise(t,0.45,'bandpass',300,2,0.45);f.frequency.exponentialRampToValueAtTime(2200,t+0.35);};
A.gameOver=function(){
  if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime+0.05;
  [220,207.6,196,174.6,146.8].forEach((f,i)=>{const o=c.createOscillator();o.type='triangle';o.frequency.value=f;const g=c.createGain();env(g,t+i*0.22,0.01,0.22,0.2,0.08,0.5);o.connect(g);g.connect(A.sfx);o.start(t+i*0.22);o.stop(t+i*0.22+1);});
};
A.click=function(){if(!A.ctx||A.muted)return;const c=C(),t=c.currentTime;const o=c.createOscillator();o.frequency.setValueAtTime(900,t);o.frequency.exponentialRampToValueAtTime(500,t+0.06);const g=c.createGain();env(g,t,0.003,0.12,0.04,0.01,0.04);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+0.15);};
// ---- ambient & music
A.startAmbient=function(){
  if(!A.ctx||A.amb)return;const c=C(),t=c.currentTime;
  const out=c.createGain();out.gain.value=0;out.gain.linearRampToValueAtTime(1,t+2);out.connect(A.master);A.amb={out:out};
  // wind
  const s=c.createBufferSource();s.buffer=A.noise;s.loop=true;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=380;lp.Q.value=0.8;
  const wg=c.createGain();wg.gain.value=0.06;s.connect(lp);lp.connect(wg);wg.connect(out);s.start();
  const lfo=c.createOscillator();lfo.frequency.value=0.07;const lg=c.createGain();lg.gain.value=180;lfo.connect(lg);lg.connect(lp.frequency);lfo.start();
  // drone
  const dg=c.createGain();dg.gain.value=0.05;dg.connect(out);dg.connect(A.rev);
  for(const f of [55,82.4,110.3,58.3]){const o=c.createOscillator();o.type='sine';o.frequency.value=f;o.detune.value=(Math.random()-0.5)*14;o.connect(dg);o.start();}
  // neon hum
  const h=c.createOscillator();h.type='sawtooth';h.frequency.value=60;const hb=c.createBiquadFilter();hb.type='bandpass';hb.frequency.value=120;hb.Q.value=10;const hg=c.createGain();hg.gain.value=0.012;h.connect(hb);hb.connect(hg);hg.connect(out);h.start();
  A.amb.heartG=c.createGain();A.amb.heartG.gain.value=0;A.amb.heartG.connect(out);
  A.musicT=c.currentTime+0.5;A.beat=0;A.tension=0;
};
A.setTension=function(x){A.tension=x;};
// simple generative eerie music + heartbeat; call every frame
const SCALE=[0,1,5,7,8]; // in-sen-ish
A.tick=function(){
  if(!A.ctx||!A.amb||A.muted)return;const c=C();
  const tempo=0.42-0.18*A.tension;
  while(A.musicT<c.currentTime+0.2){
    const t=A.musicT;A.beat++;
    // music box note
    if(A.beat%2===0||Math.random()<0.25){
      const deg=SCALE[Math.floor(Math.random()*SCALE.length)],oct=Math.random()<0.3?2:1;
      const f=220*Math.pow(2,(deg+12*oct)/12)*(1);
      const o=c.createOscillator();o.type='sine';o.frequency.value=f;const o2=c.createOscillator();o2.type='sine';o2.frequency.value=f*4.01;
      const g=c.createGain();env(g,t,0.004,0.05,0.25,0.01,0.8);const g2=c.createGain();g2.gain.value=0.25;
      o.connect(g);o2.connect(g2);g2.connect(g);g.connect(A.amb.out);g.connect(A.rev);o.start(t);o2.start(t);o.stop(t+1.3);o2.stop(t+1.3);
    }
    // heartbeat when tense
    if(A.tension>0.25&&A.beat%2===0){
      for(const d of [0,0.16]){const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(70,t+d);o.frequency.exponentialRampToValueAtTime(40,t+d+0.12);
        const g=c.createGain();env(g,t+d,0.005,0.35*A.tension*(d?0.7:1),0.06,0.02,0.1);o.connect(g);g.connect(A.amb.out);o.start(t+d);o.stop(t+d+0.3);}
    }
    A.musicT+=tempo;
  }
};
window.Sfx=A;
})();
