import re
import json, math, numpy as np
from shapely.geometry import shape, Point
from shapely.ops import unary_union
import shapely
counties={}
for f in ['11','46','15']:
    d=json.load(open(f'fylke{f}.json')); counties[d['fylkesnavn']]=shape(d['omrade'])
region=unary_union(list(counties.values()))
W,E,S,N=4.0,9.45,57.95,63.85
def my(lat): r=math.radians(lat); return math.log(math.tan(math.pi/4+r/2))
def inv(y): return math.degrees(2*math.atan(math.exp(y))-math.pi/2)
NC=240
cw=(E-W)/NC
ys,yn=my(S),my(N); NR=round((yn-ys)/math.radians(cw)); dy=(yn-ys)/NR
print('grid',NC,NR)
lons=W+cw*(np.arange(NC)+.5)
latc=np.array([inv(yn-dy*(r+.5)) for r in range(NR)])  # row 0 = north
latedges=np.array([inv(yn-dy*r) for r in range(NR+1)])
LON,LAT=np.meshgrid(lons,latc)
inreg=shapely.contains_xy(region,LON,LAT)
county=np.zeros(LON.shape,np.uint8)
for i,(nm,g) in enumerate(counties.items()): county[shapely.contains_xy(g,LON,LAT)]=i+1
# DEM
dem=np.load('dem.npy'); Z,x0,y0=map(int,open('dem_meta.txt').read().split())
dem=np.clip(dem,-500,2500)
def px(lon): return (lon+180)/360*2**Z*256 - x0*256
def py(lat): r=math.radians(lat); return (1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**Z*256 - y0*256
gy,gx=np.gradient(dem)
ELEV=np.zeros(LON.shape); LAND=np.zeros(LON.shape); SLOPE=np.zeros(LON.shape); EMAX=np.zeros(LON.shape)
for r in range(NR):
    ya,yb=int(py(latedges[r])),int(py(latedges[r+1]))+1
    pxm=305.7*math.cos(math.radians(latc[r]))
    for c in range(NC):
        xa,xb=int(px(W+cw*c)),int(px(W+cw*(c+1)))+1
        b=dem[ya:yb,xa:xb]; land=b>1
        LAND[r,c]=land.mean()
        if land.any():
            ELEV[r,c]=b[land].mean(); EMAX[r,c]=b[land].max()
            s=np.degrees(np.arctan(np.hypot(gx[ya:yb,xa:xb],gy[ya:yb,xa:xb])/pxm))
            SLOPE[r,c]=s[land].mean()
# habitat
def elevf(e):
    return np.interp(e,[0,250,500,800,1100,1400,1650],[1,1,.85,.6,.3,.1,0])
H=elevf(ELEV)*np.interp(SLOPE,[0,15,25,35,45],[1,1,.8,.45,.2])*np.sqrt(np.clip(LAND,0,1))
H[LAND<0.03]=0
reason=np.zeros(LON.shape,np.uint8)  # 0 outside
reason[inreg]=3
reason[inreg&(LAND<0.03)]=1          # sea / fjord
reason[inreg&(LAND>=0.03)&(ELEV>=1650)]=2  # ice/bare high mountain
# sightings
rf=json.load(open('redfox.json'))
seen=set(); pts=[]
for r in rf:
    if r['lat'] is None or r['m'] is None: continue
    k=(round(r['lat'],4),round(r['lon'],4),r['y'],r['m'])
    if k in seen: continue
    seen.add(k)
    if (r['unc'] or 0)>5000: continue
    hr=None
    t=r['t'] or ''
    mm=re.match(r'^(\d{1,2})[:.](\d{2})',t)
    if mm and not (int(mm.group(1))==0 and int(mm.group(2))==0):
        hr=int(mm.group(1))%24
    pts.append((r['lon'],r['lat'],r['y'] or 0,r['m'],hr))
P=np.array([(p[0],p[1],p[3]) for p in pts])
reg_buf=region.buffer(0.15)
near=shapely.contains_xy(reg_buf,P[:,0],P[:,1])
print('pts',len(pts),'near region',near.sum())
# KDE per month in km space
sig=3.5
kx=(LON*111.32*np.cos(np.radians(LAT))); ky=LAT*110.57
px_=P[near]; mon=px_[:,2]
ptx=px_[:,0]*111.32*np.cos(np.radians(px_[:,1])); pty=px_[:,1]*110.57
monthly_counts=np.bincount(P[near][:,2].astype(int),minlength=13)[1:]
Ev=[]
flatx=kx.ravel(); flaty=ky.ravel()
def kde(w):
    out=np.zeros(flatx.shape)
    for i in range(len(ptx)):
        if w[i]<1e-3: continue
        d2=(flatx-ptx[i])**2+(flaty-pty[i])**2
        m=d2<(4*sig)**2
        out[m]+=w[i]*np.exp(-d2[m]/(2*sig*sig))
    return out.reshape(LON.shape)
allk=kde(np.ones(len(ptx)))
for m in range(1,13):
    dm=np.minimum(abs(mon-m),12-abs(mon-m))
    w=np.exp(-dm**2/(2*1.3**2))
    km=kde(w)
    Ev.append(km)
# normalize evidence: blend month-specific and all-year (robustness), log scale
def norm(a):
    v=a[(reason==3)&(a>0)]; k=np.percentile(v,50) if len(v) else 1
    x=np.log1p(a/k); return np.clip(x/np.percentile(x[reason==3],99.5),0,1)
Eall=norm(allk)
mc=monthly_counts/monthly_counts.max()
# seasonal modifiers
scores=[]
for m in range(1,13):
    Em=np.clip(0.5*norm(Ev[m-1])+0.5*Eall,0,1)
    winter = m in (12,1,2,3); summer = m in (6,7,8,9)
    em=np.ones(LON.shape)
    if winter: em=np.interp(ELEV,[0,400,700,1000,1300],[1,1,.6,.3,.12])
    elif m in (4,5,10,11): em=np.interp(ELEV,[0,600,900,1200],[1,1,.75,.5])
    elif summer: em=np.interp(ELEV,[0,500,800,1200,1500],[1,1,1.25,1.15,.8])
    # month visibility: biology (mating Jan-Mar, cubs Jun-Jul) blended with sighting counts
    bio=[.95,1,.9,.7,.75,.95,1,.8,.75,.7,.65,.7][m-1]
    vis=.6*bio+.4*mc[m-1]
    s=H*em*(0.3+0.7*Em)*(0.7+0.3*vis)
    s[reason!=3]=0
    scores.append(s)
scores=np.array(scores)
ref=np.percentile(scores[:, reason==3],99.3)
S=np.clip(np.round(scores/ref*100),0,100).astype(np.uint8)
S[:, reason==3]=np.maximum(S[:, reason==3], (H[reason==3]>0)*1)  # land with habitat >=1
S[:, (reason==3)&(H==0)]=0
print('mean score', S[:,reason==3].mean(axis=1))
elevb=np.clip(ELEV/10,0,255).astype(np.uint8)
blob=np.concatenate([reason.ravel(),county.ravel(),elevb.ravel(),S.reshape(12,-1).ravel()]).astype(np.uint8)
blob.tofile('out/grid.bin')
# sightings compact (in-region+buffer)
sp=[[round(p[0],4),round(p[1],4),p[2],p[3],p[4] if p[4] is not None else -1] for p,ok in zip(pts,near) if ok]
hours=np.bincount([p[4] for p in pts if p[4] is not None],minlength=24).tolist()
# arctic fox coarse zones
af=json.load(open('arcticfox.json')); cells={}
for r in af:
    if r['lat'] is None: continue
    if not reg_buf.contains(Point(r['lon'],r['lat'])): continue
    k=(math.floor(r['lon']/0.2),math.floor(r['lat']/0.1)); cells[k]=cells.get(k,0)+1
feats=[{'type':'Feature','properties':{'n':n},'geometry':{'type':'Polygon','coordinates':[[[a*0.2,b*0.1],[(a+1)*0.2,b*0.1],[(a+1)*0.2,(b+1)*0.1],[a*0.2,(b+1)*0.1],[a*0.2,b*0.1]]]}} for (a,b),n in cells.items() if n>=2]
print('arctic cells',len(feats))
meta=dict(W=W,E=E,N=N,S=57.95,ncols=NC,nrows=NR,latEdges=[round(x,5) for x in latedges.tolist()],counties=list(counties.keys()),
          monthly=monthly_counts.tolist(),hours=hours,nSightings=len(sp),source='GBIF.org occurrence data (Vulpes vulpes), downloaded 2026-09-24')
json.dump(meta,open('out/meta.json','w'),separators=(',',':'))
json.dump(sp,open('out/sightings.json','w'),separators=(',',':'))
json.dump({'type':'FeatureCollection','features':feats},open('out/arctic.json','w'),separators=(',',':'))
# region outline simplified
simp=region.simplify(0.004)
json.dump({'type':'Feature','properties':{},'geometry':shapely.geometry.mapping(simp)},open('out/region.json','w'),separators=(',',':'))
cf=[{'type':'Feature','properties':{'name':nm},'geometry':shapely.geometry.mapping(g.simplify(0.004).boundary)} for nm,g in counties.items()]
json.dump({'type':'FeatureCollection','features':cf},open('out/counties.json','w'),separators=(',',':'))
print('hours',hours); print('monthly',monthly_counts.tolist())
