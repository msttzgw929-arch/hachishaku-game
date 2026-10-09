import asyncio, sys, os
from playwright.async_api import async_playwright
URL='file:///workspace/hachishaku-game/'+(os.environ.get('PAGE','index.html'))
OUT=os.environ.get('OUT','/tmp/gs')
os.makedirs(OUT,exist_ok=True)
VW,VH=[int(v) for v in os.environ.get('VP','1280x720').split('x')]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(viewport={'width':VW,'height':VH},device_scale_factor=float(os.environ.get('DSF','1')),has_touch=os.environ.get('TOUCH')=='1')
        pg=await ctx.new_page()
        logs=[]
        pg.on('console',lambda m:logs.append(m.type+': '+m.text)); pg.on('pageerror',lambda e:logs.append('PAGEERROR '+str(e)))
        await pg.goto(URL)
        await pg.wait_for_function('window.__ready===true',timeout=30000)
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/01_title.png')
        await pg.click('#bStart')
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{OUT}/02_start.png')
        # run left/up for a while
        await pg.keyboard.down('ArrowLeft'); await pg.wait_for_timeout(900); await pg.keyboard.up('ArrowLeft')
        await pg.keyboard.down('ArrowUp'); await pg.wait_for_timeout(500); await pg.keyboard.up('ArrowUp')
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}/03_chase.png')
        st=await pg.evaluate('JSON.stringify({mode:__game.G.mode,t:__game.G.time,P:[__game.P.x,__game.P.z],E:[__game.E.x,__game.E.z,__game.E.state]})')
        print('state',st)
        # let her catch us: stand still
        for i in range(40):
            m=await pg.evaluate('__game.G.mode')
            if m=='grab': break
            await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(900)
        await pg.screenshot(path=f'{OUT}/04_grab.png')
        # mash
        for i in range(30):
            await pg.mouse.click(VW/2+ (i%5-2)*40, VH*0.5+(i%3-1)*40)
            await pg.wait_for_timeout(60)
            if i==10: await pg.screenshot(path=f'{OUT}/05_mash.png')
        await pg.wait_for_timeout(400)
        print('after mash',await pg.evaluate('__game.G.mode+" esc="+__game.G.escapes'))
        await pg.screenshot(path=f'{OUT}/06_escaped.png')
        # stage up a lot
        await pg.evaluate('__game.setStage(5)')
        await pg.evaluate('__game.G.frust=0.98')
        await pg.wait_for_timeout(1600)
        await pg.screenshot(path=f'{OUT}/07_stageup.png')
        await pg.evaluate('__game.setStage(11)')
        await pg.keyboard.down('ArrowRight'); await pg.wait_for_timeout(700); await pg.keyboard.up('ArrowRight')
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}/08_huge.png')
        # get caught and fail
        for i in range(60):
            m=await pg.evaluate('__game.G.mode')
            if m=='grab': break
            await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(1000)
        await pg.screenshot(path=f'{OUT}/09_grab_huge.png')
        for i in range(40):
            m=await pg.evaluate('__game.G.mode')
            if m=='over': break
            await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/10_over.png')
        fps=await pg.evaluate('''new Promise(r=>{let n=0,t0=performance.now();function f(){n++;if(performance.now()-t0<1000)requestAnimationFrame(f);else r(n);}requestAnimationFrame(f);})''')
        print('fps(swiftshader)',fps,'js ms/frame',await pg.evaluate('window.__ft'))
        print('\n'.join(logs[-30:]))
        await b.close()
asyncio.run(main())
