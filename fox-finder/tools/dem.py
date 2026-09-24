# download terrarium tiles z9 covering bbox, build mosaic as npy
import math, urllib.request, io, numpy as np, os, time
from PIL import Image
Z=9; W,E,S,N=4.0,9.5,57.9,63.9
def tx(lon): return (lon+180)/360*2**Z
def ty(lat): r=math.radians(lat); return (1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**Z
x0,x1=int(tx(W)),int(tx(E)); y0,y1=int(ty(N)),int(ty(S))
print(x0,x1,y0,y1,(x1-x0+1)*(y1-y0+1))
mos=np.zeros(((y1-y0+1)*256,(x1-x0+1)*256),np.float32)
os.makedirs('tiles',exist_ok=True)
for x in range(x0,x1+1):
  for y in range(y0,y1+1):
    p=f'tiles/{x}_{y}.png'
    if not os.path.exists(p):
      for i in range(4):
        try: open(p,'wb').write(urllib.request.urlopen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png',timeout=60).read()); break
        except Exception as e: time.sleep(2**i)
    a=np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    mos[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=a[...,0]*256+a[...,1]+a[...,2]/256-32768
np.save('dem.npy',mos); open('dem_meta.txt','w').write(f'{Z} {x0} {y0}')
print(mos.min(),mos.max())
