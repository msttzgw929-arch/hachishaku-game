import asyncio, json
from playwright.async_api import async_playwright
BOT='''
(async(cfg)=>{
 const g=__game; g.start(); const res=[];
 for(let run=0;run<cfg.runs;run++){
  g.start(); let t=0, mashAcc=0;
  while(t<400){
   const P=g.P,E=g.E,G=g.G; const k=g.keys;
   for(const c of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])k[c]=false;
   if(G.mode==='play'){
     // flee: move away from her, steer away from walls
     let dx=P.x-E.x, dz=P.z-E.z; let m=Math.hypot(dx,dz)||1; let ax=dx/m, az=dz/m;
     if(P.x<300) ax+=1.5*(1-P.x/300); if(P.x>2100) ax-=1.5*((P.x-2100)/300);
     if(P.z<80) az+=1; if(P.z>350) az-=1;
     // when cornered, run along z past her
     if((P.x<250||P.x>2150)&&Math.abs(dx)<500){ az = (P.z<215?-1:1)*-1; ax=(P.x<1200?1:-1)*0.6; az = P.z< E.z ? -1 : 1; ax=(P.x<1200?1:-1); }
     if(E.state==='windup'){ az+= (P.z>E.z?1:-1)*1.5; }
     if(Math.abs(ax)>0.3) k[ax<0?'ArrowLeft':'ArrowRight']=true;
     if(Math.abs(az)>0.3) k[az>0?'ArrowUp':'ArrowDown']=true;
   } else if(G.mode==='grab'){
     mashAcc+=cfg.tps/60; while(mashAcc>=1){g.hit();mashAcc--;}
   } else if(G.mode==='over'||G.mode==='caught'){ if(G.mode==='caught'){g.update(1/60);t+=1/60;continue;} break; }
   g.update(1/60); t+=1/60;
  }
  res.push({time:+g.G.time.toFixed(1),stage:g.G.stage,esc:g.G.escapes,g:+g.H().b.g.toFixed(2)});
 }
 return res;
})
'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':800,'height':450})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///workspace/hachishaku-game/index.html')
        await pg.wait_for_function('window.__ready===true')
        for tps in [4,6,8]:
            r=await pg.evaluate(BOT+'({runs:3,tps:%d})'%tps)
            print('tps',tps,r)
        print(errs)
        await b.close()
asyncio.run(main())
