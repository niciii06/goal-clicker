# Match realism implementation

## Phase 1: repository audit

Baseline: a8ab9a2 (origin/main). Clean checkout on feature branch
`feat/match-realism-cup-travel`. No AGENTS.md files are present.

The application uses React 19 with Vinext/Vite and a Cloudflare worker, rather
than a standard Next.js production build. `app/feature-data.ts` owns gameplay;
`app/api/multiplayer/route.ts` advances shared authoritative state. Solo travel
has a separate server ledger in `app/api/travel/route.ts`.

Inspected match viewer, broadcast, canvas, goals, substitutions, player card
configuration, transfer timers, normalization, travel geography/routing/cache,
travel panel, page/CSS and multiplayer/travel API handlers.

### Existing systems to preserve

- Fifteen leagues, three cups, saved fixture identity and legacy normalization.
- Attribute-aware scoring, deterministic broadcast events, canvas acceleration.
- Five substitutions, secondary-position validation, drag and tap selection.
- Special-card fragment draw and persisted collection IDs.
- Timestamp-based travel, cached road/rail segments, explicit approximate geometry.
- Real travel duration divided by 60, without the historical tier caps.
- Multiplayer optimistic revision checks and solo travel consumption ledger.

### Observed gaps

- Cup venue alternates by round; no neutral Wembley final.
- Pfuschi and Di Certo absent; primary card position currently mandatory.
- Only the club receives red cards; at most one dismissal.
- No persisted departure squad snapshot or frozen transfer deadline.
- Substitutions apply individually and immediately; windows are not tracked.
- Six-minute regular clock; goal burst is visual only and very short.
- Halftime is a visual transition; no authoritative ten-second pause.
- Strategy selectors still influence scoring and fitness.
- Several grounds explicitly use municipality/fictional coordinates.
- Travel panel does not scroll into view on departure.

### Subsequent phases

2. Cup venue/card/discipline/departure persistence rules.
3. Staged, queued substitutions and windows.
4. Dynamic clock, persistent timed overlays, colours and tactics removal.
5. Causal viewer/possession/offside/restart improvements.
6. Source-backed stadium audit and route/map improvements.
7. Full regression, build/typecheck and desktop/mobile visual QA.

No production deployment or main-branch merge is authorized by this prompt.

### Baseline verification

`npm run install:ci`: completed, 524 packages installed.
`npm test`: production build/artifact validation succeeded; 158 TypeScript
behaviour/API tests and 41 JavaScript regression tests passed (199 total).
`npm run typecheck`: passed with no diagnostics.

No gameplay changes in this phase. Existing legacy fixture/save tests passed.

## Phase 2

Implemented away-only Cup fixtures and configuration-ranked neutral Wembley
final. Added positionless bench-only Pfuschi and 100 ZM/ZDM Di Certo through
existing collection/custom draws. Both sides can incur multiple dismissals;
opponent roster IDs survive normalization and dismissed actors/actions are
removed. Second cautions produce a dismissal. Added persisted departure
allowlist and frozen scheduler remainders, enforced in squad setters and
multiplayer/solo travel handlers. Completion restores the stored remainders
once. No cancellation UI exists, so no new cancellation action was invented.

Validation: targeted travel/master/viewer tests passed; the updated
balance/session rerun passed 49/49 tests. Typecheck passed. Production build
completed and artifact validator reported:
`Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.`
No paid providers or deployment used. Historical journey endpoints are retained.
Remaining: queued batch substitutions/windows, timed overlays/clock/tactics,
viewer realism, source-backed venue audit, visual QA.
