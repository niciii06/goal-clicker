# Realistic travel

New journeys store a version 2 itinerary, real duration, acceleration, each segment's
geometry/provenance, and authoritative start/arrival timestamps. Existing journeys
without an itinerary retain their exact original timing. New player Cup fixtures are always away; only the highest Cup final is neutral at Wembley and still requires travel. League scheduling, active/historical fixtures and player form remain unchanged.

Current source-release rules and QA: [Release verification](release-match-realism.md) and [Sites project knowledge](chatgpt-sites-knowledge.md).

## Time and transport

`TRAVEL_CONFIG.acceleration = 60`. Game seconds = real seconds / acceleration;
there is no geographical-tier duration or three-minute ceiling. All new estimates
include access to hubs, boarding/security, transfers, arrival procedures and final
stadium transport. A real 24-hour estimate becomes 24 game minutes.

Bus estimates use the stored road length and road-specific speeds (urban streets,
regional roads, motorways), with a bus adjustment and boarding/access allowance.
IC estimates use railway corridor length at 95 km/h plus intermediate-stop time.
Regional/high-speed schedules are not claimed or fetched. Air estimates use
700 km/h below 2,000 km or 850 km/h for long haul, plus 30 minutes for taxi/climb;
120 minutes before departure, 120 minutes for a Singapore connection to Sydney,
and 60 minutes for arrival. These are estimates, not published services or times.

Domestic road/rail and applicable European road/air alternatives compare their
estimated door-to-door times. Nearby destinations use a bus. Zurich is the
configured long-haul hub; European journeys compare Zurich and Geneva. Known
stadium IDs map to known destination airports; a renamed/generated ground may
reuse a nearby known airport. Sydney connects geographically via Singapore.

## Geographic data and privacy

`app/travel-route-cache.json` is a committed cache of derived OSM route geometries.
Runtime travel planning makes no external routing or geocoding requests, sends no
origin to a routing provider, and does not require a paid API or subscription.
Only map tiles load from OpenStreetMap, retaining the existing attribution.

Railway corridors are extracted locally from a public Swiss-region Overpass graph.
They follow connected main/branch railway tracks, not confirmed passenger
services. The Bern-area road graph and Swiss main road corridors are also routed
locally, retaining one-way directions and excluding private/no motor access.
Turn restrictions, vehicle dimensions and temporary closures are not modelled.

Additional public airport/station/stadium connections may use stored FOSSGIS OSRM
results. Those cache refreshes exclude the private origin and fictional grounds;
they must remain sequential and rate limited. No public demo router is used by
production gameplay. Endpoint approaches are approximate; larger gaps mark the
whole segment as approximate. Missing routes are explicitly dotted and labelled
"Ungefähre Route" and use mode/distance estimates. Flights are great-circle
approximations, not recorded aircraft tracks. OSM-derived geometry is attributed
to OpenStreetMap contributors (ODbL), FOSSGIS and Overpass in the UI.

The home origin uses the project's already stored coordinates. An additional
external address-geocoding check was blocked by automatic approval review and
was not retried. Consequently, exact building/entrance coordinates have not been
newly verified. Stadium identities and prior municipal/fictitious labels remain.

## Timeline, persistence and limitations

One shared segment timeline drives the countdown, active mode, stationary waits,
map position and progress. Movement interpolates by cumulative geographic
length, including longitude wrapping across the international date line. The
camera follows the active stage; manual pan/zoom and a full-route control remain.

Both existing solo server journey receipts and shared-game transactions continue
to protect departure/consumption. Arrival counting remains idempotent. Reloads,
background tabs, temporary offline periods and completed journeys use timestamps,
not frame counts. Offline travel does not require a new geographic service call.

Not every worldwide rail corridor is present: unsupported rail/ground geometry
is explicitly approximate. Swiss local graph routes are plausible road corridors,
not navigation-grade instructions. The flight hub graph is an estimate and does
not verify airline timetables or seasonal availability. There is no return-trip
feature in the existing game, so no extra journey or match was introduced.

## Verification

Dedicated routing tests cover 60x proportionality, no global duration cap, Sydney
transfers, local buses, active waiting stages, route continuity, uneven coordinate
spacing, date-line interpolation, legacy-save timing, malformed plans, reloads,
and single arrival counting. Existing travel API tests exercise both solo and
shared sessions, duplicate departures, consumption, match integration and
eligibility. Existing football regression tests remain in the full test suite.

Browser interaction QA is unavailable in this managed session because the required
control-browser capability is not present. Static React rendering tests and the
production build validate the UI structure; interactive camera behaviour has not
been manually browser-tested here.

## Refreshing cached geometry

The committed Python helpers operate on local, public OSM graph JSON only:

```text
python scripts/travel/cache-rail.py /tmp/public-rail-network.json
node --import tsx scripts/travel/export-roads.ts > /tmp/road-pairs.json
python scripts/travel/cache-local-roads.py /tmp/public-road-network.json /tmp/road-pairs.json
python scripts/travel/simplify-cache.py
```

Run the rail extraction before the road calculation when rebuilding from scratch;
the rail extractor creates a fresh cache. Its input covers Swiss main/branch tracks;
road input covers regional main roads plus local urban streets at public transport
hubs/stadiums. No private origin is included in an external OSM query. Derived
routes retain provenance and use a 4-metre simplification tolerance. Cache changes
require routing tests and a new production build.

## Departure locks and presentation

Departure freezes nominated XI/bench IDs and Fabrizio/event timer remainders. Injured or suspended nominations are rejected; reload preserves the lock and the exact remainder. Completion releases it once. The map loads on demand with a loading fallback and scrolls into view once per journey. All estimated road/rail connections remain dashed and labelled “Routenverlauf geschätzt”. The canonical cache is reconstructed from seven chunkable parts, with exact-equality regression coverage.
