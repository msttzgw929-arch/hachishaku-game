import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, median_filter
src=np.asarray(Image.open('tools/src.jpg').convert('RGB')).astype(np.float32)
lum=src.mean(2); L=gaussian_filter(lum,1.2)
# approximate crease polyline
pts=[(180,997),(300,1110),(433,1217),(607,1257),(767,1237),(900,1163),(1020,1010),(1040,975)]
xs=np.arange(180,1041)
pred=np.interp(xs,[p[0] for p in pts],[p[1] for p in pts])
ys=[]
for x,p in zip(xs,pred):
    a=int(p-35);b=int(p+35)
    col=L[a:b,x]; ys.append(a+int(np.argmin(col)))
ys=np.array(ys,float)
ys=median_filter(ys,31); ys=gaussian_filter(ys,6)
np.save('tools/crease.npy',np.stack([xs,ys]))
for x in range(180,1041,40): print(x,int(ys[x-180]),int(np.interp(x,xs,pred)))
m=(xs>=225)&(xs<=1030)
c=np.polyfit(xs[m],ys[m],7)
yf=np.polyval(c,xs)
# left end blend toward (178,1000)
yl=np.polyval(c,225); 
yf[xs<225]=np.interp(xs[xs<225],[178,225],[1000,yl])
np.save('tools/crease.npy',np.stack([xs,yf]))
print('resid',np.abs(yf[m]-ys[m]).max())
