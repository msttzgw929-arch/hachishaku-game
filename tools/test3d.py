# 3D版の自動テスト＆スクリーンショット: python3 tools/test3d.py  (env: PAGE, OUT, VP=WxH, DSF, TOUCH=1)
import asyncio, os, json, time
from playwright.async_api import async_playwright
ROOT=os.path.dirname(os.path.abspath(__file__))+'/..'
URL=os.environ.get('URL') or 'file://'+os.path.abspath(ROOT)+'/'+os.environ.get('PAGE','index.html')
OUT=os.environ.get('OUT','/tmp/t3/shots'); os.makedirs(OUT,exist_ok=True)
VW,VH=[int(v) for v in os.environ.get('VP','1280x720').split('x')]
TOUCH=os.environ.get('TOUCH')=='1'
PFX=os.environ.get('PFX','')
# find a spot in front of the player with line of sight, put her there, face her
SETUP='''(d)=>{const g=__game,w=g.world(),P=g.P,E=g.E;
 for(let a=0;a<128;a++){const ang=P.yaw+a/128*6.283;const x=P.x-Math.sin(ang)*d,z=P.z-Math.cos(ang)*d;
  if(w.walkable(x,z)&&w.los(P.x,P.z,x,z)){P.yaw=ang;E.x=x;E.z=z;return true;}}return false;}'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(viewport={'width':VW,'height':VH},device_scale_factor=float(os.environ.get('DSF','1')),has_touch=TOUCH,is_mobile=TOUCH)
        pg=await ctx.new_page();logs=[]
        pg.on('console',lambda m:logs.append(m.type+': '+m.text)); pg.on('pageerror',lambda e:logs.append('PAGEERROR '+str(e)))
        t0=time.time();await pg.goto(URL);await pg.wait_for_function('window.__ready===true',timeout=90000)
        print('ready in %.1fs'%(time.time()-t0))
        async def shot(name,wait=0):
            if wait: await pg.wait_for_timeout(wait)
            await pg.evaluate('__game.renderNow()')
            await pg.screenshot(path=f'{OUT}/{PFX}{name}.png')
        await pg.wait_for_timeout(1500)
        await shot('1_title')
        await pg.click('#bStart')
        await pg.wait_for_timeout(1200)
        st=lambda: pg.evaluate('JSON.stringify({mode:__game.G.mode,P:[+__game.P.x.toFixed(2),+__game.P.z.toFixed(2),+__game.P.yaw.toFixed(3),+__game.P.pitch.toFixed(3)],E:[+__game.E.x.toFixed(1),+__game.E.z.toFixed(1),__game.E.state],pr:__game.pr()})')
        print('start',await st())
        # --- controls test
        if TOUCH:
            cdp=await ctx.new_cdp_session(pg)
            lx,ly,rx,ry=VW*0.2,VH*0.75,VW*0.8,VH*0.75
            s0=json.loads(await st())
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':lx,'y':ly,'id':1},{'x':rx,'y':ry,'id':2}]})
            for i in range(1,8):
                await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':lx,'y':ly-i*10,'id':1},{'x':rx,'y':ry-i*10,'id':2}]})
                await pg.wait_for_timeout(30)
            await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f'{OUT}/{PFX}sticks.png')
            s1=json.loads(await st())
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            moved=((s1['P'][0]-s0['P'][0])**2+(s1['P'][1]-s0['P'][1])**2)**0.5
            print('TOUCH sticks: moved %.2fm, pitch %.3f -> %.3f'%(moved,s0['P'][3],s1['P'][3]),'OK' if moved>0.5 and s1['P'][3]>s0['P'][3]+0.2 else 'FAIL')
            # look-only right stick sideways -> yaw change
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':rx,'y':ry,'id':3}]})
            for i in range(1,8):
                await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':rx+i*10,'y':ry,'id':3}]});await pg.wait_for_timeout(30)
            await pg.wait_for_timeout(600)
            s2=json.loads(await st())
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            print('TOUCH look stick yaw %.3f -> %.3f'%(s1['P'][2],s2['P'][2]),'OK' if abs(s2['P'][2]-s1['P'][2])>0.2 else 'FAIL')
        else:
            s0=json.loads(await st())
            await pg.keyboard.down('KeyW');await pg.wait_for_timeout(700);await pg.keyboard.up('KeyW')
            await pg.mouse.move(VW/2,VH/2);await pg.mouse.down();await pg.mouse.move(VW/2+60,VH/2-80,steps=6);await pg.mouse.up()
            s1=json.loads(await st())
            moved=((s1['P'][0]-s0['P'][0])**2+(s1['P'][1]-s0['P'][1])**2)**0.5
            print('KEY/MOUSE: moved %.2fm yaw %.3f->%.3f pitch %.3f->%.3f'%(moved,s0['P'][2],s1['P'][2],s0['P'][3],s1['P'][3]),'OK' if moved>0.5 and abs(s1['P'][2]-s0['P'][2])>0.1 and s1['P'][3]>s0['P'][3] else 'FAIL')
            if await pg.evaluate('__game.G.paused'): await pg.evaluate("document.getElementById('bResume').click()")
        # --- views of her
        await pg.evaluate('()=>{__game.E.state="stageup";__game.E.st=-1e9;__game.P.inv=1e9;__game.look(__game.P.yaw,0.12)}')
        await pg.evaluate(SETUP,11); await shot('2_chase',700)
        await pg.evaluate(SETUP,2.4); await pg.evaluate('__game.look(__game.P.yaw,0.95)'); await shot('3_look_up',500)
        # --- windup warning
        await pg.evaluate(SETUP,9); await pg.evaluate('()=>{__game.look(__game.P.yaw,0.15);const E=__game.E;E.state="windup";E.st=0;E.tx=__game.P.x;E.tz=__game.P.z;__game.P.inv=1e9;}')
        await shot('4_dash_warning',350)
        # --- capture & mash
        await pg.evaluate('()=>{__game.E.state="chase";__game.E.st=0;__game.P.inv=0;__game.E.dashCd=99;}')
        await pg.evaluate(SETUP,0.6)
        for i in range(40):
            if await pg.evaluate('__game.G.mode')=='grab': break
            await pg.wait_for_timeout(100)
        await shot('5_capture',1200)
        for i in range(30):
            x=VW/2+((i%5)-2)*VW*0.06; y=VH*0.5+((i%3)-1)*VH*0.06
            if TOUCH: await pg.touchscreen.tap(x,y)
            else: await pg.mouse.click(x,y)
            await pg.wait_for_timeout(50)
            if i==8: await shot('6_mash')
            if await pg.evaluate('__game.G.mode')!='grab': break
        print('after mash',await pg.evaluate('__game.G.mode+" escapes="+__game.G.escapes'))
        # --- huge belly
        await pg.evaluate('()=>{__game.setStage(9);__game.G.frust=0.2;__game.E.state="stageup";__game.E.st=-1e9;__game.P.inv=1e9;__game.look(__game.P.yaw,0.2)}')
        await pg.wait_for_timeout(300)
        await pg.evaluate(SETUP,9); await shot('7_huge_belly',900)
        await pg.evaluate(SETUP,4.5); await pg.evaluate('__game.look(__game.P.yaw,0.75)'); await shot('8_huge_look_up',500)
        # --- behind: indicator + minimap
        await pg.evaluate(SETUP,14); await pg.evaluate('()=>{__game.P.yaw+=2.6;__game.look(__game.P.yaw,0.05)}'); await shot('9_indicator',300)
        # --- caught at huge size -> game over
        await pg.evaluate('()=>{__game.E.state="chase";__game.E.st=0;__game.P.inv=0;}')
        await pg.evaluate(SETUP,1.0)
        for i in range(40):
            if await pg.evaluate('__game.G.mode')=='grab': break
            await pg.wait_for_timeout(100)
        await shot('10_capture_huge',1500)
        for i in range(80):
            if await pg.evaluate('__game.G.mode')=='over': break
            await pg.wait_for_timeout(200)
        await shot('11_gameover',800)
        fps=await pg.evaluate('''new Promise(r=>{let n=0,t0=performance.now();function f(){n++;if(performance.now()-t0<2000)requestAnimationFrame(f);else r(n/2);}requestAnimationFrame(f);})''')
        print('fps(swiftshader, software GPU)',fps,'js ms/frame %.2f'%(await pg.evaluate('window.__ft')))
        print('CONSOLE:',logs if logs else 'none')
        await b.close()
asyncio.run(main())
