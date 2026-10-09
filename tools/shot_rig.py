import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':900,'height':1000})
        logs=[]
        pg.on('console',lambda m:logs.append(m.type+': '+m.text)); pg.on('pageerror',lambda e:logs.append('ERR '+str(e)))
        for i,qs in enumerate(sys.argv[1:]):
            await pg.goto('file:///workspace/hachishaku-game/tools/rigtest.html?'+qs)
            await pg.wait_for_function('window.done===true',timeout=15000)
            await pg.screenshot(path=f'/tmp/rig{i}.png')
        print('\n'.join(logs))
        await b.close()
asyncio.run(main())
