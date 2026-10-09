import asyncio, os
from playwright.async_api import async_playwright
OUT='/workspace/hachishaku-game/screenshots'
os.makedirs(OUT,exist_ok=True)
STEP='''(n)=>{for(let i=0;i<n;i++)__game.update(1/60);}'''
async def run(p,vp,dsf,prefix,touch=False):
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx=await b.new_context(viewport=vp,device_scale_factor=dsf,has_touch=touch,is_mobile=touch)
    pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    await pg.goto('file:///workspace/hachishaku-game/index.html')
    await pg.wait_for_function('window.__ready===true'); await pg.wait_for_timeout(700)
    await pg.screenshot(path=f'{OUT}/{prefix}1_title.png')
    await pg.evaluate('__game.start()')
    # chase: put her near the player and let things settle
    await pg.evaluate('''()=>{const g=__game;g.P.x=1000;g.P.z=170;g.E.x=1330;g.E.z=230;g.E.state='chase';g.G.frust=0.3;g.P.inv=99;}''')
    await pg.evaluate('''()=>{const g=__game;for(let i=0;i<150;i++){g.keys.ArrowLeft=true;g.update(1/60);}g.keys.ArrowLeft=false;}''')
    await pg.evaluate('__game.H().startChant(3)')
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{OUT}/{prefix}2_chase.png')
    # restraint
    await pg.evaluate('''()=>{const g=__game;g.P.inv=0;g.P.x=g.E.x-60;g.P.z=g.E.z;for(let i=0;i<5;i++)g.update(1/60);}''')
    await pg.evaluate('''()=>{const g=__game;for(let i=0;i<70;i++){g.update(1/60);}g.grab.e=0.55;}''')
    for i in range(4):
        await pg.evaluate('__game.hit()'); await pg.evaluate(STEP,2)
    await pg.wait_for_timeout(150)
    await pg.screenshot(path=f'{OUT}/{prefix}3_restraint.png')
    # escape
    for i in range(10): await pg.evaluate('__game.hit()')
    await pg.evaluate(STEP,90)
    # stage-up moment
    await pg.evaluate('''()=>{const g=__game;g.setStage(3);g.G.frust=0.999;g.P.inv=99;g.P.x=g.E.x-420;g.P.z=120;}''')
    await pg.evaluate(STEP,40)
    await pg.wait_for_timeout(200)
    await pg.screenshot(path=f'{OUT}/{prefix}4_stageup.png')
    # large belly
    await pg.evaluate('''()=>{const g=__game;g.setStage(9);g.G.frust=0.75;g.E.state='chase';g.P.x=g.E.x-520;g.P.z=90;}''')
    await pg.evaluate('''()=>{const g=__game;for(let i=0;i<150;i++){g.keys.ArrowLeft=i<40;g.update(1/60);}g.keys.ArrowLeft=false;}''')
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=f'{OUT}/{prefix}5_huge_belly.png')
    # dash warning
    await pg.evaluate('''()=>{const g=__game;g.setStage(2);g.G.frust=0.2;g.E.state='chase';g.E.dashCd=0;g.P.x=g.E.x-450;g.P.z=200;for(let i=0;i<25;i++)g.update(1/60);}''')
    await pg.wait_for_timeout(200)
    await pg.screenshot(path=f'{OUT}/{prefix}6_dash_warning.png')
    # game over
    await pg.evaluate('''()=>{const g=__game;g.P.inv=0;g.E.state='chase';g.P.x=g.E.x;g.P.z=g.E.z;for(let i=0;i<10;i++)g.update(1/60);for(let i=0;i<500&&g.G.mode!=='over';i++)g.update(1/60);}''')
    await pg.wait_for_timeout(900)
    await pg.screenshot(path=f'{OUT}/{prefix}7_gameover.png')
    print(prefix,'errors:',errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p,{'width':1280,'height':720},1,'pc_')
        await run(p,{'width':390,'height':844},2,'sp_',True)
asyncio.run(main())
