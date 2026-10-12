"""Simplify stored OSM geometry within 4 metres; endpoints are retained."""
import json,math,os
from pathlib import Path
path=Path(__file__).resolve().parents[2]/'app/travel-route-cache.json'
def simplify(points):
 if len(points)<3:return points
 result={0,len(points)-1};queue=[(0,len(points)-1)];lat=sum(p['lat'] for p in points)/len(points);sx=111320*math.cos(lat*math.pi/180);sy=111320
 while queue:
  a,b=queue.pop();ax,ay=points[a]['lon']*sx,points[a]['lat']*sy;bx,by=points[b]['lon']*sx,points[b]['lat']*sy;dx,dy=bx-ax,by-ay;den=dx*dx+dy*dy;maximum=16;index=None
  for i in range(a+1,b):
   px,py=points[i]['lon']*sx,points[i]['lat']*sy;t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/den)) if den else 0;d=(px-ax-t*dx)**2+(py-ay-t*dy)**2
   if d>maximum:maximum=d;index=i
  if index is not None:result.add(index);queue.extend([(a,index),(index,b)])
 return [{'lat':round(points[i]['lat'],6),'lon':round(points[i]['lon'],6)} for i in sorted(result)]
cache=json.load(open(path));before=sum(len(v['points']) for v in cache.values())
for v in cache.values():v['points']=simplify(v['points'])
tmp=str(path)+'.tmp';json.dump(cache,open(tmp,'w'),separators=(',',':'));os.replace(tmp,path)
print('Stored route vertices',before,'→',sum(len(v['points']) for v in cache.values()),'bytes',path.stat().st_size)
