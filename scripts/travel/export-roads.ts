// Local data only: this exports pairs for an offline graph calculation.
import { VENUES, SEASON_CLUBS, HOME_VENUE } from '../../app/travel-geography';
import { planJourney, routeKey, asHub, AIRPORTS } from '../../app/journey-routing';
const pairs=new Map();
for(const v of [...Object.values(VENUES),...SEASON_CLUBS.map(c=>c.venue)])for(const s of planJourney(v).segments)if(s.mode==='bus')pairs.set(s.id,{from:s.from,to:s.to,key:s.id});
for(const to of [AIRPORTS.ZRH,AIRPORTS.GVA]){const from=asHub(HOME_VENUE);pairs.set(routeKey(from,to,'bus'),{from,to,key:routeKey(from,to,'bus')});}
console.log(JSON.stringify([...pairs.values()]));
