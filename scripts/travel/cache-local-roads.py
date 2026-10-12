# Local-only routing: private origins never leave this process.
import json,math,heapq,os,sys
from pathlib import Path
root=str(Path(__file__).resolve().parents[2])+'/';data=json.load(open(sys.argv[1]))
coords={};edges={}
def dist(a,b):
 r=math.pi/180;h=math.sin((b[0]-a[0])*r/2)**2+math.cos(a[0]*r)*math.cos(b[0]*r)*math.sin((b[1]-a[1])*r/2)**2
 return 6371*2*math.asin(min(1,math.sqrt(h)))
speeds={'motorway':85,'trunk':75,'primary':60,'secondary':50,'tertiary':40,'residential':25,'living_street':10,'service':15,'unclassified':35}
for w in data['elements']:
 tags=w.get('tags',{})
 if tags.get('access') in ('private','no') or tags.get('motor_vehicle') in ('private','no') or tags.get('motorcar') in ('private','no'):continue
 hw=tags.get('highway','');speed=speeds.get(hw.replace('_link',''),35)
 try:speed=min(speed,float(tags.get('maxspeed','999').split(';')[0]))
 except:pass
 speed=max(5,speed);oneway=tags.get('oneway','yes' if hw=='motorway' or tags.get('junction')=='roundabout' else 'no')
 for n,p in zip(w['nodes'],w['geometry']):coords[n]=(p['lat'],p['lon'])
 for a,b in zip(w['nodes'],w['nodes'][1:]):
  d=dist(coords[a],coords[b]);seconds=d/speed*3600
  if oneway!='-1':edges.setdefault(a,[]).append((b,seconds,d))
  if oneway not in ('yes','1','true'):edges.setdefault(b,[]).append((a,seconds,d))
cache=json.load(open(root+'app/travel-route-cache.json'));pairs=json.load(open(sys.argv[2]))
origins={}
for p in pairs:
 if p['key'] in cache and cache[p['key']]['geometry']!='approximate':continue
 a,b=p['from'],p['to']
 if not(45.8<=a['lat']<=47.9 and 5.9<=a['lon']<=10.6 and 45.8<=b['lat']<=47.9 and 5.9<=b['lon']<=10.6):continue
 origins.setdefault((a['lat'],a['lon']),[]).append(p)
for origin,targets in origins.items():
 start=min(edges,key=lambda n:dist(origin,coords[n]));cost={start:0};length={start:0};prev={};queue=[(0,start)]
 while queue:
  d,n=heapq.heappop(queue)
  if d!=cost[n]:continue
  for m,seconds,km in edges.get(n,[]):
   nd=d+seconds
   if nd<cost.get(m,float('inf')):cost[m]=nd;length[m]=length[n]+km;prev[m]=n;heapq.heappush(queue,(nd,m))
 for p in targets:
  a,b=p['from'],p['to'];target=(b['lat'],b['lon'])
  candidates=sorted(coords,key=lambda n:(coords[n][0]-target[0])**2+(coords[n][1]-target[1])**2)[:40]
  candidates=[n for n in candidates if n in cost]
  if not candidates:continue
  end=min(candidates,key=lambda n:dist(target,coords[n]));path=[end]
  while path[-1]!=start:path.append(prev[path[-1]])
  path.reverse();approach=dist(origin,coords[start])+dist(target,coords[end])
  if approach>4:continue
  pts=[{'lat':a['lat'],'lon':a['lon']}]+[{'lat':coords[n][0],'lon':coords[n][1]} for n in path]+[{'lat':b['lat'],'lon':b['lon']}]
  cache[p['key']]={'points':pts,'km':length[end]+approach,'seconds':cost[end]+approach/20*3600,'geometry':'road' if approach<.3 else 'approximate','source':'© OpenStreetMap contributors / Overpass, 2026-10-12; locally computed directed road corridor, approximate endpoint approaches; estimated bus time. No origin sent to a routing service.'}
 print('Local origin:',len(targets),'destinations processed',flush=True)
tmp=root+'app/travel-route-cache.json.tmp';json.dump(cache,open(tmp,'w'),separators=(',',':'));os.replace(tmp,root+'app/travel-route-cache.json')
print('Local road cache',len(cache),'entries',flush=True)
