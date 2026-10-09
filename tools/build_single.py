# index.html + src/*.css/js を1つのHTMLにまとめる（画像はassets.js内でbase64埋め込み済み）
import re, os, zipfile
os.chdir(os.path.dirname(os.path.abspath(__file__))+'/..')
html=open('index.html',encoding='utf-8').read()
css=open('src/style.css',encoding='utf-8').read()
html=html.replace('<link rel="stylesheet" href="src/style.css">','<style>\n'+css+'\n</style>')
def js(m):
    src=m.group(1); code=open(src,encoding='utf-8').read().replace('</script','<\\/script')
    return '<script>/* '+src+' */\n'+code+'\n</script>'
html=re.sub(r'<script src="([^"]+)"></script>',js,html)
open('hachishaku.html','w',encoding='utf-8').write(html)
print('hachishaku.html',os.path.getsize('hachishaku.html')//1024,'KB')
# zip
keep=['index.html','hachishaku.html','README.md','.nojekyll']
with zipfile.ZipFile('/workspace/hachishaku-game.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in keep: z.write(f,'hachishaku-game/'+f)
    for d in ['src','assets','screenshots','vendor']:
        for fn in sorted(os.listdir(d)): z.write(os.path.join(d,fn),'hachishaku-game/'+d+'/'+fn)
    for fn in sorted(os.listdir('tools')):
        if fn.endswith(('.py','.sh')) or fn in ('rigtest.html','three_entry.js'): z.write('tools/'+fn,'hachishaku-game/tools/'+fn)
print('zip',os.path.getsize('/workspace/hachishaku-game.zip')//1024,'KB')
