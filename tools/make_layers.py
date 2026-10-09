import numpy as np, json
from PIL import Image
from scipy.ndimage import gaussian_filter, label, binary_dilation
S=np.asarray(Image.open('tools/src.jpg').convert('RGB')).astype(np.float32)
A=np.asarray(Image.open('tools/cut_raw.png'))[...,3].astype(np.float32)/255
H,W=A.shape
yy,xx=np.mgrid[0:H,0:W]
R,G,B=S[...,0],S[...,1],S[...,2]
# --- cleanup: red sign & blue sign fringe
A[(xx>1030)&(yy>800)&(yy<1030)&(R>G+35)]=0
A[(xx<225)&(yy>900)&(yy<1060)&(B>R+45)]=0
A[A<0.04]=0
# keep main component
lab,n=label(A>0.3); sizes=np.bincount(lab.ravel()); sizes[0]=0
main=lab==sizes.argmax()
main=binary_dilation(main,iterations=3)
A=A*main
def ss(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
cx,cy=np.load('tools/crease.npy'); crease=np.full(W,1e9); crease[cx.astype(int)]=cy
crease[:180]=1000; crease[1041:]=975
CR=crease[None,:]
# hem/leg split
def skirt_bottom(x):
    col=A[1500:,x]; idx=np.where(col>0.5)[0]; return 1500+idx[-1]+1 if len(idx) else H
hem=np.array([skirt_bottom(x) for x in range(W)],float)
for a,b in [(496,610),(740,876)]:
    hem[a:b]=np.interp(np.arange(a,b),[a-1,b],[hem[a-1],hem[b]])
hem-=1
HEM=hem[None,:]
print('hem L',hem[500],hem[605],'R',hem[745],hem[870])
out={}
def save(name,rgb,alpha,box,q=92):
    x0,y0,x1,y1=box
    img=np.dstack([rgb[y0:y1,x0:x1],alpha[y0:y1,x0:x1]*255]).clip(0,255).astype(np.uint8)
    im=Image.fromarray(img,'RGBA'); im.save(f'assets/{name}.webp',quality=q,method=6); im.save(f'tools/{name}.png')
    out[name]=dict(x=x0,y=y0,w=x1-x0,h=y1-y0)
# UPPER
au=A*(1-ss(458,484,yy))
# drop translucent dark back-hair leftovers outside head
dark=(S.mean(2)<90)&(A<0.85)&(yy>260)&((xx<480)|(xx>745))
au[dark]=0
save('upper',S,au,(300,20,920,490))
# BELLY
ab=A*(yy>=425)*(1-ss(CR+1.5,CR+3.5,yy))
side=1-ss(505,522,xx)*ss(712,695,xx)
ab=ab*(1-side*(1-ss(448,466,yy)))
save('belly',S,ab,(140,420,1080,1275))
# SKIRT  (visible part + filled hidden part under belly)
sk_rgb=S.copy(); ask=A*ss(CR-8,CR-5,yy)*(yy<HEM+1.5)
ask=ask*(yy>=880)
def xl(y): return 190+(65-190)*(y-990)/(1650-990)
def xr(y): return 1045+(1160-1045)*(y-975)/(1650-975)
for x in range(200,1036):
    c=int(crease[x]) if crease[x]<1e8 else None
    if c is None: continue
    src_row=c+8
    col=S[src_row:src_row+6,x].mean(0)
    for y in range(880,c+8):
        if xl(y)+6<x<xr(y)-6:
            sk_rgb[y,x]=col; ask[y,x]=1
# soften fill side edges
ask[880:1000]=np.minimum(ask[880:1000],1)
save('skirt',sk_rgb,ask,(40,870,1180,1760))
# LEGS with upward extension
def leg(name,x0,x1,top,y1):
    rgb=S.copy(); al=A*(yy>HEM+6)
    rowy=int(hem[(x0+x1)//2]+10)
    for x in range(x0,x1):
        h=int(hem[x])
        ry=h+10
        if A[ry,x]>0.3:
            for y in range(top,h+10):
                rgb[y,x]=S[ry,x]; al[y,x]=A[ry,x]
    al[:, :x0]=0; al[:, x1:]=0
    save(name,rgb,al,(x0,top,x1,y1))
leg('legL',490,615,1660,1917)
leg('legR',735,880,1630,1865)
# FACE (fine mesh layer) feathered rect
fx0,fy0,fx1,fy1=540,88,672,206
af=np.zeros_like(A)
m=ss(fx0,fx0+14,xx)*ss(fx1,fx1-14,xx)*ss(fy0,fy0+14,yy)*ss(fy1,fy1-14,yy)
af=m*A
save('face',S,af,(fx0,fy0,fx1,fy1),q=95)
json.dump(out,open('assets/layers.json','w'),indent=1)
# title art
Image.open('tools/src.jpg').convert('RGB').save('assets/key.webp',quality=82,method=6)
print(out)
