import base64, json, os
os.chdir(os.path.dirname(os.path.abspath(__file__))+'/..')
L=json.load(open('assets/layers.json')); F=json.load(open('assets/faces.json'))
imgs={}
for n in ['upper','belly','skirt','legL','legR','faces','key']:
    imgs[n]='data:image/webp;base64,'+base64.b64encode(open(f'assets/{n}.webp','rb').read()).decode()
js='// 自動生成ファイル (tools/build_assets.py)。画像はfile://でもWebGLで使えるようdata URIで埋め込み。\nwindow.ASSETS='+json.dumps({'meta':{'layers':L,'faces':F},'img':imgs},ensure_ascii=False)+';\n'
open('src/assets.js','w').write(js)
print('assets.js',len(js)//1024,'KB')
