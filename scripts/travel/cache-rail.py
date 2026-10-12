import json,math,heapq,sys
from pathlib import Path
root=str(Path(__file__).resolve().parents[2])+'/'
data=json.load(open(sys.argv[1]))
coords={};edges={}
def dist(a,b):
 r=math.pi/180;h=math.sin((b[0]-a[0])*r/2)**2+math.cos(a[0]*r)*math.cos(b[0]*r)*math.sin((b[1]-a[1])*r/2)**2
 return 6371*2*math.asin(min(1,math.sqrt(h)))
for w in data['elements']:
 if w.get('tags',{}).get('access')=='private':continue
 for n,p in zip(w['nodes'],w['geometry']):coords[n]=(p['lat'],p['lon'])
 for a,b in zip(w['nodes'],w['nodes'][1:]):
  d=dist(coords[a],coords[b]);edges.setdefault(a,[]).append((b,d));edges.setdefault(b,[]).append((a,d))
stations={'bern':(46.949,7.439),'zurich':(47.3782,8.5402),'geneva':(46.2102,6.1423),'lausanne':(46.5168,6.629),'basel':(47.547,7.59),'luzern':(47.05,8.31),'stgallen':(47.423,9.37),'winterthur':(47.5,8.724),'lugano':(46.005,8.947),'sion':(46.228,7.359),'thun':(46.755,7.63),'biel':(47.132,7.243)}
nearest={k:sorted(coords,key=lambda n:dist(p,coords[n]))[:30] for k,p in stations.items()}
start=nearest['bern'][0];cost={start:0};prev={};queue=[(0,start)]
while queue:
 d,n=heapq.heappop(queue)
 if d!=cost[n]:continue
 for m,delta in edges.get(n,[]):
  nd=d+delta
  if nd<cost.get(m,float('inf')):cost[m]=nd;prev[m]=n;heapq.heappush(queue,(nd,m))
cache={}
for name,p in stations.items():
 if name=='bern':continue
 candidates=[n for n in nearest[name] if n in cost and dist(coords[n],p)<.5]
 if not candidates:print(name,'disconnected');continue
 end=min(candidates,key=lambda n:dist(coords[n],p));path=[end]
 while path[-1]!=start:path.append(prev[path[-1]])
 path.reverse();pts=[{'lat':coords[n][0],'lon':coords[n][1]} for n in path]
 km=cost[end];key='train:%.5f,%.5f:%.5f,%.5f'%(*stations['bern'],*p)
 cache[key]={'points':[{'lat':stations['bern'][0],'lon':stations['bern'][1]}]+pts+[{'lat':p[0],'lon':p[1]}],'km':km,'seconds':km/95*3600+600,'geometry':'rail','source':'© OpenStreetMap contributors / Overpass, 2026-10-12. Shortest connected main/branch railway corridor; station approaches approximate, journey time estimated, not a verified passenger service.'}
 print(name,round(km),len(pts))
json.dump(cache,open(root+'app/travel-route-cache.json','w'),separators=(',',':'))
print('nodes',len(coords),'cached',len(cache))
