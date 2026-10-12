import { addHistory, getCupPlayerMatchRating, getStarXIPlayerMatchRating, getStarXIPlayer, STAR_XI_PLAYERS } from './feature-data';
import type { CupState, GameFeatures, SeasonMatchHistoryEntry, StarXIPlayer } from './feature-data';

export type PlayerCareerStats = { appearances: number; minutes: number; goals: number; assists: number; ratingTotal: number; ratedMatches: number; motm: number; subAppearances: number; subRatingTotal: number; subMinutes: number; recent: number[] };
export type RatingReason = { label: string; value: number };
export type PlayerMatchReport = { playerId: string; rating: number; minutes: number; goals: number; assists: number; substitute: boolean; reasons: RatingReason[] };
export type CareerMatchReport = { id: string; opponent: string; homeScore: number; awayScore: number; mode: 'season' | 'tournament'; createdAt: number; motmId: string | null; derby: boolean; derbyReward: number; players: PlayerMatchReport[] };
export type AwardWinner = { playerId: string; value: string } | null;
export type SeasonAwards = { id: string; division: number; seasonNumber: number; matchesTracked: number; createdAt: number; best: AwardWinner; scorer: AwardWinner; joker: AwardWinner; disappointment: AwardWinner };
export type Rivalry = { opponent: string; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; closeGames: number; active: boolean; lastResults: string[]; lastPlayedAt: number };
export type CareerState = {
  version: number;
  players: Record<string, PlayerCareerStats>;
  seasonPlayers: Record<string, PlayerCareerStats>;
  seasonNumber: number;
  seasonMatches: number;
  awards: SeasonAwards[];
  reports: CareerMatchReport[];
  processedMatchIds: string[];
  rivals: Record<string, Rivalry>;
  collectedIds: string[];
  claimedAlbumRewards: string[];
  milestoneCards: Record<string, string[]>;
};
export const CAREER_MILESTONES = [
  { id: 'loyal', label: 'Vereinstreue', metric: 'appearances', target: 25, bonus: 1, accent: '#a3b9d6' },
  { id: 'scorer', label: 'Torjäger', metric: 'goals', target: 50, bonus: 2, accent: '#f2b44e' },
  { id: 'creator', label: 'Spielmacher', metric: 'assists', target: 30, bonus: 2, accent: '#80d1bf' },
  { id: 'hero', label: 'Clubheld', metric: 'motm', target: 10, bonus: 3, accent: '#c8a1fb' },
] as const;
export function emptyPlayerStats(): PlayerCareerStats { return { appearances: 0, minutes: 0, goals: 0, assists: 0, ratingTotal: 0, ratedMatches: 0, motm: 0, subAppearances: 0, subRatingTotal: 0, subMinutes: 0, recent: [] }; }
export function initialCareerState(): CareerState { return { version: 1, players: {}, seasonPlayers: {}, seasonNumber: 1, seasonMatches: 0, awards: [], reports: [], processedMatchIds: [], rivals: {}, collectedIds: [], claimedAlbumRewards: [], milestoneCards: {} }; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function number(value: unknown, max = 1e9) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; }
function integer(value: unknown, max = 1e9) { return Math.floor(number(value, max)); }
function text(value: unknown, max = 120) { return typeof value === 'string' ? value.slice(0, max) : ''; }
function validIds(value: unknown) { return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(getStarXIPlayer(id))))] : []; }
function normalizeStats(value: unknown): Record<string, PlayerCareerStats> {
  return Object.fromEntries(Object.entries(object(value)).filter(([id]) => getStarXIPlayer(id)).map(([id, raw]) => {
    const source = object(raw), next = emptyPlayerStats();
    for (const key of Object.keys(next).filter(key => key !== 'recent') as (Exclude<keyof PlayerCareerStats, 'recent'>)[]) next[key] = number(source[key]);
    next.recent = Array.isArray(source.recent) ? source.recent.filter(x => Number.isFinite(Number(x))).slice(-5).map(x => Math.max(4.5, Math.min(10, Number(x)))) : [];
    return [id, next];
  }));
}
export function rivalryKey(opponent: string) { return `rival:${opponent.trim().toLocaleLowerCase('de-CH').replace(/\s+/g, ' ')}`; }
export function normalizeCareerState(value: unknown, knownIds: readonly string[] = [], cup?: CupState): CareerState {
  const source = object(value), next = initialCareerState();
  next.players = normalizeStats(source.players);
  next.seasonPlayers = normalizeStats(source.seasonPlayers);
  next.seasonNumber = Math.max(1, integer(source.seasonNumber));
  next.seasonMatches = integer(source.seasonMatches, 10);
  next.collectedIds = [...new Set([...validIds(source.collectedIds), ...validIds(knownIds)])];
  next.processedMatchIds = Array.isArray(source.processedMatchIds) ? source.processedMatchIds.filter((id): id is string => typeof id === 'string').slice(-100).map(id => id.slice(0, 200)) : [];
  next.claimedAlbumRewards = Array.isArray(source.claimedAlbumRewards) ? [...new Set(source.claimedAlbumRewards.filter((id): id is string => typeof id === 'string').map(id => id.slice(0, 100)))] : [];
  if (!source.version && cup) {
    for (const id of new Set([...Object.keys(cup.allTimeScorers || {}), ...Object.keys(cup.allTimeAppearances || {})])) {
      if (!getStarXIPlayer(id)) continue;
      const stats = emptyPlayerStats();
      stats.goals = Math.max(0, integer(cup.allTimeScorers[id]) - (cup.active ? cup.matchEvents.filter(e => e.side === 'home' && e.scorerId === id).length : 0));
      stats.appearances = Math.max(0, integer(cup.allTimeAppearances[id]) - (cup.active && cup.playerEnteredAt[id] ? 1 : 0));
      next.players[id] = stats;
      if (!next.collectedIds.includes(id)) next.collectedIds.push(id);
    }
  }
  next.milestoneCards = Object.fromEntries(Object.entries(object(source.milestoneCards)).filter(([id]) => getStarXIPlayer(id)).map(([id, ids]) => [id, Array.isArray(ids) ? [...new Set(ids.filter((m): m is string => CAREER_MILESTONES.some(def => def.id === m)))] : []]));
  for (const [id, stats] of Object.entries(next.players)) {
    for (const milestone of CAREER_MILESTONES) if (stats[milestone.metric] >= milestone.target) next.milestoneCards[id] = [...new Set([...(next.milestoneCards[id] || []), milestone.id])];
  }
  for (const raw of Object.values(object(source.rivals)).slice(0, 300)) {
    const r = object(raw), opponent = text(r.opponent, 80); if (!opponent) continue;
    const wins = integer(r.wins), draws = integer(r.draws), losses = integer(r.losses), played = wins + draws + losses, closeGames = Math.min(played, integer(r.closeGames));
    next.rivals[rivalryKey(opponent)] = { opponent, played, wins, draws, losses, goalsFor: integer(r.goalsFor), goalsAgainst: integer(r.goalsAgainst), closeGames, active: r.active === true || (played >= 3 && closeGames >= 2) || played >= 5, lastResults: Array.isArray(r.lastResults) ? r.lastResults.filter((x): x is string => typeof x === 'string').slice(-5).map(x => x.slice(0, 30)) : [], lastPlayedAt: number(r.lastPlayedAt, 1e15) };
  }
  function winner(raw: unknown): AwardWinner { const w = object(raw); return typeof w.playerId === 'string' && getStarXIPlayer(w.playerId) ? { playerId: w.playerId, value: text(w.value, 100) } : null; }
  next.awards = (Array.isArray(source.awards) ? source.awards : []).slice(-20).map(raw => { const a = object(raw); return { id: text(a.id, 200), division: Math.max(1, integer(a.division, 20)), seasonNumber: Math.max(1, integer(a.seasonNumber)), matchesTracked: integer(a.matchesTracked, 10), createdAt: number(a.createdAt, 1e15), best: winner(a.best), scorer: winner(a.scorer), joker: winner(a.joker), disappointment: winner(a.disappointment) }; }).filter(a => a.id);
  next.reports = (Array.isArray(source.reports) ? source.reports : []).slice(-8).map(raw => {
    const r = object(raw);
    const players: PlayerMatchReport[] = (Array.isArray(r.players) ? r.players : []).slice(0, 16).map(rawPlayer => {
      const p = object(rawPlayer), playerId = text(p.playerId);
      return { playerId, rating: Math.max(4.5, number(p.rating, 10)), minutes: integer(p.minutes, 120), goals: integer(p.goals, 40), assists: integer(p.assists, 40), substitute: p.substitute === true, reasons: (Array.isArray(p.reasons) ? p.reasons : []).slice(0, 12).map(rawReason => { const reason = object(rawReason), n = Number(reason.value); return { label: text(reason.label, 100), value: Number.isFinite(n) ? Math.max(-10, Math.min(10, n)) : 0 }; }) };
    }).filter(p => getStarXIPlayer(p.playerId));
    return { id: text(r.id, 200), opponent: text(r.opponent, 80), homeScore: integer(r.homeScore, 40), awayScore: integer(r.awayScore, 40), mode: r.mode === 'season' ? 'season' as const : 'tournament' as const, createdAt: number(r.createdAt, 1e15), motmId: typeof r.motmId === 'string' && players.some(p => p.playerId === r.motmId) ? r.motmId : null, derby: r.derby === true, derbyReward: integer(r.derbyReward, 400), players };
  }).filter(r => r.id);
  return next;
}
export function getPlayerForm(career: CareerState, playerId: string) {
  const recent = career.players[playerId]?.recent ?? [];
  const average = recent.length ? recent.reduce((sum, n) => sum + n, 0) / recent.length : 6.5;
  const bonus = recent.length ? Math.round(Math.max(-2, Math.min(2, (average - 6.5) * 1.5)) * 10) / 10 : 0;
  return { average, bonus, matches: recent.length, label: bonus >= 0.5 ? 'In Form' : bonus <= -0.5 ? 'Formtief' : 'Stabil' };
}
export function getCareerCard(career: CareerState, player: StarXIPlayer) {
  const unlocked = career.milestoneCards[player.id] ?? [];
  const milestone = [...CAREER_MILESTONES].filter(m => unlocked.includes(m.id)).sort((a,b) => b.bonus - a.bonus)[0];
  return { milestone, bonus: milestone ? Math.min(milestone.bonus, 100 - player.rating) : 0, rating: Math.min(100, player.rating + (milestone?.bonus ?? 0)) };
}
export function prepareCareerMatch(features: GameFeatures) {
  const bonuses: Record<string, number> = {};
  for (const id of features.starXI.ownedIds) { const p = getStarXIPlayer(id); if (p) bonuses[id] = getPlayerForm(features.career, id).bonus + getCareerCard(features.career, p).bonus; }
  features.cup.careerBonuses = bonuses;
  features.cup.careerRatingSeed = features.cup.matchStartedAt;
  features.cup.careerMatchId = `career-${features.cup.matchStartedAt}-${features.cup.mode}-${features.cup.opponent}`;
  const rival = features.career.rivals[rivalryKey(features.cup.opponent)];
  if (rival?.active) addHistory(features, { title: `Derby gegen ${rival.opponent}`, detail: `${rival.wins} Siege · ${rival.draws} Remis · ${rival.losses} Niederlagen. Die Kurve fordert Revanche!`, tone: 'neutral' });
  return features;
}
export function getMatchRatingBreakdown(cup: CupState, playerId: string, minute: number): PlayerMatchReport | null {
  const entered = cup.playerEnteredAt[playerId], player = getStarXIPlayer(playerId);
  if (!entered || !player || entered > minute) return null;
  const end = Math.min(minute, cup.playerExitedAt[playerId] ?? minute);
  const events = cup.matchEvents.filter(e => e.minute >= entered && e.minute <= end);
  const goals = events.filter(e => e.side === 'home' && e.scorerId === playerId).length;
  // Assists are precisely the non-scorer positive contributions generated by the match engine.
  const assists = events.filter(e => e.side === 'home' && e.scorerId !== playerId && (e.ratingImpacts[playerId] ?? 0) > 0).length;
  const goalValue = events.filter(e => e.side === 'home' && e.scorerId === playerId).reduce((sum,e) => sum + (e.ratingImpacts[playerId] ?? 0),0);
  const assistValue = events.filter(e => e.side === 'home' && e.scorerId !== playerId).reduce((sum,e) => sum + Math.max(0,e.ratingImpacts[playerId] ?? 0),0);
  const faultValue = events.filter(e => e.side === 'away').reduce((sum,e) => sum + Math.min(0,e.ratingImpacts[playerId] ?? 0),0);
  const position = cup.playerMatchPositions[playerId] ?? player.position;
  const clean = !events.some(e => e.side === 'away');
  const cleanValue = clean ? Math.min(1,(end-entered+1)/90) * (position === 'TW' ? .42 : ['IV','LV','LAV','RV','RAV'].includes(position) ? .3 : position === 'ZDM' ? .14 : 0) : 0;
  const rating = getCupPlayerMatchRating(cup, playerId, minute) ?? 6.4;
  const base = getStarXIPlayerMatchRating(playerId, cup.careerRatingSeed ?? cup.matchStartedAt, end, 0, entered, 0, position);
  const reasons: RatingReason[] = [{ label: 'Grundleistung und Tagesform', value: base }];
  if (goals) reasons.push({ label: `${goals} ${goals === 1 ? 'Tor' : 'Tore'}`, value: goalValue });
  if (assists) reasons.push({ label: `${assists} ${assists === 1 ? 'Vorlage' : 'Vorlagen'}`, value: assistValue });
  if (faultValue) reasons.push({ label: 'Beteiligung an Gegentoren', value: faultValue });
  if (cleanValue) reasons.push({ label: 'Ohne Gegentor auf dem Platz', value: cleanValue });
  const rounding = rating - base - goalValue - assistValue - faultValue - cleanValue;
  if (Math.abs(rounding) > .00001) reasons.push({ label: 'Rundung und Notengrenzen (4.5 bis 10)', value: rounding });
  if (cup.cardEvents.some(e => e.playerId === playerId)) reasons.push({ label: 'Rote Karte: Team geschwächt, Einsatz beendet', value: 0 });
  if (cup.injuryEvents.some(e => e.playerId === playerId)) reasons.push({ label: 'Verletzungsbedingtes Einsatzende', value: 0 });
  return { playerId, rating, minutes: end - entered + 1, goals, assists, substitute: entered > 1, reasons };
}
function addStats(current: PlayerCareerStats | undefined, report: PlayerMatchReport, motm: boolean): PlayerCareerStats {
  const s = current ?? emptyPlayerStats();
  return { appearances: s.appearances+1, minutes: s.minutes+report.minutes, goals: s.goals+report.goals, assists: s.assists+report.assists, ratingTotal: s.ratingTotal+report.rating, ratedMatches: s.ratedMatches+1, motm: s.motm+Number(motm), subAppearances: s.subAppearances+Number(report.substitute), subRatingTotal: s.subRatingTotal+(report.substitute ? report.rating : 0), subMinutes: s.subMinutes+(report.substitute ? report.minutes : 0), recent: report.minutes >= 15 ? [...s.recent,report.rating].slice(-5) : s.recent };
}
export function recordCareerMatch(features: GameFeatures, now = Date.now(), seasonEntry?: SeasonMatchHistoryEntry | null) {
  const c = features.cup, career = features.career;
  if (c.active || !c.matchStartedAt) return features;
  const id = c.careerMatchId || `career-${c.matchStartedAt}-${c.mode}-${c.opponent}`;
  if (career.processedMatchIds.includes(id)) return features;
  const minute = c.penaltyEvents.length || c.matchEndsAt-c.matchStartedAt > 180000 ? 120 : 90;
  const players = Object.keys(c.playerEnteredAt).map(playerId => getMatchRatingBreakdown(c,playerId,minute)).filter((p): p is PlayerMatchReport => Boolean(p));
  const ranked = [...players].filter(p => p.minutes >= 15).sort((a,b) => b.rating-a.rating || b.goals-a.goals || b.assists-a.assists || a.playerId.localeCompare(b.playerId));
  const motmId = ranked[0]?.playerId ?? null;
  const key = rivalryKey(c.opponent);
  const old = career.rivals[key] ?? { opponent: c.opponent, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, closeGames: 0, active: false, lastResults: [], lastPlayedAt: 0 };
  const draw = c.homeScore === c.awayScore && !c.penaltyEvents.length;
  const won = c.homeScore > c.awayScore || (c.homeScore === c.awayScore && c.penaltyHomeScore > c.penaltyAwayScore);
  const derbyReward = old.active ? won ? 400 : draw ? 150 : 0 : 0;
  const played = old.played+1, closeGames = old.closeGames + Number(Math.abs(c.homeScore-c.awayScore) <= 1);
  const active = old.active || (played >= 3 && closeGames >= 2) || played >= 5;
  const resultLabel = `${c.homeScore}:${c.awayScore}${c.penaltyEvents.length ? ` (${c.penaltyHomeScore}:${c.penaltyAwayScore} i.E.)` : ''}`;
  career.rivals[key] = { ...old, played, closeGames, active, wins: old.wins+Number(won), draws: old.draws+Number(draw), losses: old.losses+Number(!won&&!draw), goalsFor: old.goalsFor+c.homeScore, goalsAgainst: old.goalsAgainst+c.awayScore, lastResults: [...old.lastResults,resultLabel].slice(-5), lastPlayedAt: now };
  if (active && !old.active) addHistory(features, { title: `Neue Rivalität: ${c.opponent}`, detail: 'Die Fans haben ihren Derbygegner gefunden. Künftige Derbys bringen bis zu 400 Fragmente.', tone: 'positive' });
  if (old.active) addHistory(features, { title: won ? 'Derbysieg! Die Kurve eskaliert.' : draw ? 'Derbyremis. Die Revanche wartet.' : 'Derbyniederlage. Das vergessen die Fans nicht.', detail: `${resultLabel} gegen ${c.opponent}${derbyReward ? ` · +${derbyReward} Fragmente` : ''}`, tone: won ? 'positive' : draw ? 'neutral' : 'negative' });
  features.starXI.fragments += derbyReward;
  for (const p of players) {
    career.players[p.playerId] = addStats(career.players[p.playerId],p,p.playerId===motmId);
    if (c.mode === 'season') career.seasonPlayers[p.playerId] = addStats(career.seasonPlayers[p.playerId],p,p.playerId===motmId);
    if (!career.collectedIds.includes(p.playerId)) career.collectedIds.push(p.playerId);
    for (const m of CAREER_MILESTONES) if (career.players[p.playerId][m.metric] >= m.target && !(career.milestoneCards[p.playerId] || []).includes(m.id)) {
      career.milestoneCards[p.playerId] = [...(career.milestoneCards[p.playerId] || []),m.id];
      addHistory(features, { title: `${m.label}-Karte freigeschaltet`, detail: `${getStarXIPlayer(p.playerId)?.name} · ${m.target} ${m.metric==='goals'?'Tore':m.metric==='assists'?'Vorlagen':m.metric==='motm'?'Spieler-des-Spiels-Titel':'Einsätze'}. Die stärkste Version ist automatisch aktiv.`, tone: 'positive' });
    }
  }
  career.reports = [...career.reports,{ id, opponent: c.opponent, homeScore: c.homeScore, awayScore: c.awayScore, mode: c.mode, createdAt: now, motmId, derby: old.active, derbyReward, players }].slice(-8);
  career.processedMatchIds = [...career.processedMatchIds,id].slice(-100);
  if (c.mode === 'season') {
    career.seasonMatches += 1;
    if (seasonEntry?.completedSeason) {
      const eligible = Object.entries(career.seasonPlayers).filter(([,s]) => s.ratedMatches >= 3 && s.minutes >= 90);
      const pick = (entries: typeof eligible, score: (s: PlayerCareerStats) => number, display: (s: PlayerCareerStats) => string, ascending = false): AwardWinner => {
        const sorted = [...entries].sort((a,b) => (ascending?1:-1)*(score(a[1])-score(b[1])) || b[1].minutes-a[1].minutes || a[0].localeCompare(b[0]));
        return sorted[0] ? { playerId: sorted[0][0], value: display(sorted[0][1]) } : null;
      };
      const avg = (s: PlayerCareerStats) => s.ratingTotal/Math.max(1,s.ratedMatches);
      career.awards = [...career.awards,{ id, division: seasonEntry.division, seasonNumber: career.seasonNumber, matchesTracked: career.seasonMatches, createdAt: now,
        best: pick(eligible,avg,s=>`Ø ${avg(s).toFixed(2)} · ${s.motm}× Spieler des Spiels`),
        scorer: pick(Object.entries(career.seasonPlayers).filter(([,s])=>s.goals>0),s=>s.goals,s=>`${s.goals} Tore`),
        joker: pick(Object.entries(career.seasonPlayers).filter(([,s])=>s.subAppearances>=2&&s.subMinutes>=30),s=>s.subRatingTotal/s.subAppearances,s=>`Ø ${(s.subRatingTotal/s.subAppearances).toFixed(2)} · ${s.subAppearances} Einwechslungen`),
        disappointment: pick(eligible.filter(([,s])=>avg(s)<6.5),avg,s=>`Ø ${avg(s).toFixed(2)} · unter der Erwartung 6.5`,true),
      }].slice(-20);
      addHistory(features,{title:`Saisonauszeichnungen · Saison ${career.seasonNumber}`,detail:`${career.seasonMatches} erfasste Ligaspiele. Die Gewinner stehen im Karrierebereich.`,tone:'positive'});
      career.seasonPlayers = {}; career.seasonMatches = 0; career.seasonNumber += 1;
    }
  }
  return features;
}
export type AlbumGroup = { id: string; label: string; total: number; collected: number; reward: number; claimed: boolean };
export function getAlbumGroups(career: CareerState): AlbumGroup[] {
  const owned = new Set(career.collectedIds), claimed = new Set(career.claimedAlbumRewards);
  const definitions = [
    { id:'base',label:'Alle Basiskarten',players:STAR_XI_PLAYERS.filter(p=>!p.isCustom&&p.cardType!=='icon'&&p.cardType!=='legendary'),reward:10000 },
    { id:'icons',label:'Alle Icons',players:STAR_XI_PLAYERS.filter(p=>p.cardType==='icon'),reward:5000 },
    { id:'custom',label:'Alle Custom-Karten',players:STAR_XI_PLAYERS.filter(p=>p.isCustom),reward:5000 },
    { id:'legendary',label:'Alle legendären Karten',players:STAR_XI_PLAYERS.filter(p=>p.cardType==='legendary'),reward:5000 },
    ...[...new Set(STAR_XI_PLAYERS.map(p=>p.countryCode).filter(Boolean))].sort().map(code=>({ id:`nation-${code}`,label:`Nation ${code}`,players:STAR_XI_PLAYERS.filter(p=>p.countryCode===code),reward:500 })),
  ];
  return definitions.filter(d=>d.players.length).map(d=>({id:d.id,label:d.label,total:d.players.length,collected:d.players.filter(p=>owned.has(p.id)).length,reward:d.reward,claimed:claimed.has(d.id)}));
}
export function claimAlbumReward(features: GameFeatures, groupId: string) {
  features.career.collectedIds = [...new Set([...features.career.collectedIds,...features.starXI.ownedIds])];
  const group = getAlbumGroups(features.career).find(g=>g.id===groupId);
  if (!group || group.claimed || group.collected < group.total) return false;
  features.career.claimedAlbumRewards.push(group.id); features.starXI.fragments += group.reward;
  addHistory(features,{title:`Sammelalbum: ${group.label} komplett`,detail:`+${group.reward} Fragmente. Einmalige Sammlungsprämie.`,tone:'positive'});
  return true;
}

export function claimAllAlbumRewards(features: GameFeatures) {
  features.career.collectedIds = [...new Set([...features.career.collectedIds, ...features.starXI.ownedIds])];
  const available = getAlbumGroups(features.career).filter(group => !group.claimed && group.collected === group.total);
  for (const group of available) claimAlbumReward(features, group.id);
  return available.length;
}
