import os, json, base64, glob, shutil
D='/home/user/hours-app/fox-finder/data'
for kind in ('osm','sat'):
    src='vt' if kind=='osm' else 'satw'
    packs={}
    for f in glob.glob(f'{src}/*/*/*'):
        z,x,y=map(int,f.split('/')[-3:])
        key='low' if z<8 else f'8/{x>>(z-8)}/{y>>(z-8)}'
        packs.setdefault(key,{})[f'{z}/{x}/{y}']=base64.b64encode(open(f,'rb').read()).decode()
    shutil.rmtree(f'{D}/{kind}',ignore_errors=True)
    tot=0; big=0
    for k,v in packs.items():
        p=f'{D}/{kind}/{k}.json'; os.makedirs(os.path.dirname(p),exist_ok=True)
        json.dump(v,open(p,'w'),separators=(',',':')); sz=os.path.getsize(p); tot+=sz; big=max(big,sz)
    print(kind,len(packs),'packs',round(tot/1e6,1),'MB, largest',round(big/1e6,1),'MB')
os.makedirs(f'{D}/map/sprites',exist_ok=True)
for f in glob.glob('assets/sprites/*'): shutil.copy(f,f'{D}/map/sprites/')
g={}
for f in glob.glob('assets/glyphs/*.pbf'):
    n=os.path.basename(f)[:-4]; font,r=n.rsplit('-',2)[0],'-'.join(n.rsplit('-',2)[1:])
    g[f'{font}/{r}']=base64.b64encode(open(f,'rb').read()).decode()
json.dump(g,open(f'{D}/map/glyphs.json','w'),separators=(',',':'))
print(sorted(g))
