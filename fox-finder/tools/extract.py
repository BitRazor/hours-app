import json, math, os, sys, urllib.request, concurrent.futures as cf
from shapely.geometry import shape, box
from shapely.prepared import prep
from pm import R, tx, ty
KIND=sys.argv[1]; MAXZ=int(sys.argv[2])
reg=shape(json.load(open('/home/user/hours-app/fox-finder/data/region.json'))['geometry']).buffer(0.08)
P=prep(reg)
def lon(x,z): return x/2**z*360-180
def lat(y,z): n=math.pi-2*math.pi*y/2**z; return math.degrees(math.atan(math.sinh(n)))
def tiles(z):
    for x in range(tx(4.0,z),tx(9.45,z)+1):
        for y in range(ty(63.85,z),ty(57.95,z)+1):
            if z<=7 or P.intersects(box(lon(x,z),lat(y+1,z),lon(x+1,z),lat(y,z))): yield (z,x,y)
def fetch_sat(z,x,y):
    u=f'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'
    for i in range(5):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'fox-finder-extract/1.0'}),timeout=60).read()
        except Exception as e: err=e
    raise err
out=f'{KIND}'; n=0; size=0
def job(t):
    z,x,y=t; p=f'{out}/{z}/{x}/{y}'
    if os.path.exists(p): return os.path.getsize(p)
    d=R.get(z,x,y) if KIND=='vt' else fetch_sat(z,x,y)
    if not d: return 0
    os.makedirs(os.path.dirname(p),exist_ok=True); open(p,'wb').write(d); return len(d)
all_t=[t for z in range(0 if KIND=='vt' else 5, MAXZ+1) for t in tiles(z)]
print(KIND,len(all_t),'tiles',flush=True)
with cf.ThreadPoolExecutor(16) as ex:
    for s in ex.map(job, all_t):
        n+=1; size+=s
        if n%1000==0: print(n,round(size/1e6,1),'MB',flush=True)
print('done',n,round(size/1e6,1),'MB')
