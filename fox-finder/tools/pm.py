import urllib.request, functools, math, random, sys
from pmtiles.reader import Reader
URL='https://build.protomaps.com/20260926.pmtiles'
@functools.lru_cache(maxsize=4096)
def get_bytes(offset, length):
    for i in range(5):
        try:
            r=urllib.request.Request(URL,headers={'User-Agent':'fox-finder-extract/1.0','Range':f'bytes={offset}-{offset+length-1}'})
            return urllib.request.urlopen(r,timeout=60).read()
        except Exception as e: err=e
    raise err
R=Reader(get_bytes)
def tx(lon,z): return int((lon+180)/360*2**z)
def ty(lat,z): r=math.radians(lat); return int((1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**z)
if __name__=='__main__':
    print(R.header()['max_zoom'])
    for z in (10,12,13,14):
        xs=range(tx(4.0,z),tx(9.45,z)+1); ys=range(ty(63.85,z),ty(57.95,z)+1)
        s=[]
        for i in range(25):
            t=R.get(z,random.choice(xs),random.choice(ys)); s.append(len(t) if t else 0)
        n=len(xs)*len(ys); print(z,n,sum(s)/len(s), n*sum(s)/len(s)/1e6,'MB')
