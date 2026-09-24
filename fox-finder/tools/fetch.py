import json, urllib.request, time
def get(url):
    for i in range(4):
        try:
            return json.load(urllib.request.urlopen(url, timeout=60))
        except Exception as e:
            print('retry', e); time.sleep(2**i)
def fetch(key, name):
    out=[]; off=0
    while True:
        d=get(f"https://api.gbif.org/v1/occurrence/search?taxonKey={key}&country=NO&decimalLatitude=58.3,63.3&decimalLongitude=4.4,9.2&hasCoordinate=true&hasGeospatialIssue=false&limit=300&offset={off}")
        for r in d['results']:
            out.append(dict(lat=r.get('decimalLatitude'),lon=r.get('decimalLongitude'),y=r.get('year'),m=r.get('month'),t=r.get('eventTime'),unc=r.get('coordinateUncertaintyInMeters'),basis=r.get('basisOfRecord'),ds=r.get('datasetName'),loc=r.get('locality'),muni=r.get('municipality'),county=r.get('stateProvince')))
        off+=300
        if d['endOfRecords'] or off>=d['count']: break
    json.dump(out,open(name,'w')); print(name,len(out))
fetch(5219243,'redfox.json'); fetch(5219303,'arcticfox.json')
