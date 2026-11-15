'use client';

import { goalLabel } from './match-goals';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { formatIncomeDuration, getStarXIPlayer, getStarXIPositions, getUnavailableStarXIPlayerIds, STAR_POSITIONS, STAR_XI_PLAYERS, TOURNAMENTS, TRANSFER_UNHAPPY_PENALTY, transferUnhappyMatches } from './feature-data';
import type { ChronicleMatchRecord } from './club-chronicle';
import type { GameFeatures, StarXIPlayer } from './feature-data';
import { albumGroupIncludes, nationGroupScope, CAREER_MILESTONES, GROWTH_POINTS_PER_LEVEL, getPlayerMilestones, getMilestoneStats, MILESTONE_METRIC_LABELS, emptyPlayerStats, getAlbumGroups, getCareerCard, getPlayerForm } from './career-data';
import type { AwardWinner, PlayerMatchReport } from './career-data';
import { formatNumber } from './game/format';
import { currentIntlTag, localizeText, t } from './i18n/runtime';
import { useLocale } from './i18n/use-locale';
import { PREF_KEYS, pickStringFields, readJsonPref, writeJsonPref } from './qol/prefs';
import { leagueForTier } from './season-progression';
import { getBans, suspensionLabel, yellowCardStatus } from './discipline';
import { dataText } from './i18n/data-text';

const name = (id: string) => getStarXIPlayer(id)?.name ?? t("career.unknownPlayer");
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
const nationName = (code: string) => { try { return new Intl.DisplayNames(['de-CH'], { type: 'region' }).of(code) || code; } catch { return code; } };

// Rendered for every card of the squad; pure in its props, so it skips App renders that change nothing here (audit P09).
export const CareerPlayerBadge = memo(function CareerPlayerBadge({ features, player, compact = false }: { features: GameFeatures; player: StarXIPlayer; compact?: boolean }) {
  useLocale(); // memo: follows a language switch on its own
  const form = getPlayerForm(features.career, player.id), card = getCareerCard(features.career, player), unhappy = transferUnhappyMatches(features, player.id);
  const unhappyLabel = t('career.unhappy', { penalty: TRANSFER_UNHAPPY_PENALTY, count: unhappy });
  if (compact) return <>{form.matches || card.milestone || unhappy ? <span className={`career-pitch-badge ${card.milestone ? 'special' : ''}${unhappy ? ' unhappy' : ''}`} title={`${card.milestone?.label ?? 'Basiskarte'} · ${form.label} · Form ${signed(form.bonus)} OVR${unhappy ? ` · ${unhappyLabel}` : ''}`} style={{ '--career-accent': card.milestone?.accent ?? '#edf3fa' } as CSSProperties}>{unhappy ? '😠 ' : ''}{card.milestone ? '★ ' : ''}{form.matches ? signed(form.bonus) : ''}</span> : null}<DisciplineTags features={features} playerId={player.id} compact /></>;
  return <span className="career-player-badges">
    {card.milestone && <span className="career-special-tag" style={{ '--career-accent': card.milestone.accent } as CSSProperties}>★ {card.milestone.label} · OVR {card.rating}</span>}
    {card.growth && <span className="career-form-tag up" title={t("career.growthRules", { points: GROWTH_POINTS_PER_LEVEL })}>{card.growth.nextLevelPoints === null ? t("career.potentialReached", { potential: card.growth.potential, rating: card.rating }) : t('career.growthProgress', { rating: card.rating, potential: card.growth.potential, count: card.growth.pointsToNext, next: card.rating + 1 })}</span>}
    {form.matches > 0 && <span className={`career-form-tag ${form.bonus >= .5 ? 'up' : form.bonus <= -.5 ? 'down' : ''}`}>{form.label} · {signed(form.bonus)}</span>}
    {unhappy > 0 && <span className="career-form-tag down">😠 {unhappyLabel}</span>}
    <DisciplineTags features={features} playerId={player.id} />
  </span>;
});

/** Suspensions and yellow card warnings, for example t("career.bannedOneMatch") or "2/3 Gelbe Karten". */
export function DisciplineTags({ features, playerId, compact = false }: { features: GameFeatures; playerId: string; compact?: boolean }) {
  const bans = getBans(features, playerId), yellows = yellowCardStatus(features, playerId);
  if (compact) {
    if (bans.length) return <span className="discipline-tag banned" title={bans.map(suspensionLabel).join(' · ')}>{t("career.banCaps")}</span>;
    const warning = yellows.find(y => y.count === y.limit - 1);
    return warning ? <span className="discipline-tag warning" title={t("career.yellowCards", { count: warning.count, limit: warning.limit, label: warning.label })}>{warning.count}/{warning.limit}</span> : null;
  }
  return <>{bans.map(ban => <span key={ban.id} className="discipline-tag banned">{suspensionLabel(ban)}</span>)}{yellows.map(y => <span key={y.competition} className={`discipline-tag ${y.count === y.limit - 1 ? 'warning' : 'info'}`}>{y.count}/{y.limit} Gelbe Karten · {y.label}</span>)}</>;
}

function PlayerReportRow({ report, motm }: { report: PlayerMatchReport; motm: boolean }) {
  return <details className={`career-rating-row ${motm ? 'motm' : ''}`}>
    <summary><span><strong>{name(report.playerId)}{motm && <em>{t("career.motmStar")}</em>}</strong><small>{t("career.reportMinutes", { count: report.minutes })} · {t("career.reportGoals", { count: report.goals })} · {report.assists} {t("career.assistsWord")}{report.substitute ? t("career.jokerSuffix") : ''}</small></span><b className={report.rating >= 8 ? 'up' : report.rating < 6 ? 'down' : ''}>{report.rating.toFixed(1)} <span>⌄</span></b></summary>
    <div className="career-rating-details">{report.reasons.map((r,i) => <div key={i}><span>{r.label}</span><b>{r.value === 0 ? t("career.note") : signed(r.value)}</b></div>)}<p>{t("career.ratingNote")}</p></div>
  </details>;
}
export function MatchRatingsPanel({ features }: { features: GameFeatures; minute?: number }) {
  if (features.cup.active) return null;
  const reports = [...features.career.reports].slice(-10).reverse();
  return <section className="career-section match-archive" aria-label={t("career.matchRatings")}><div className="career-heading"><div><p className="eyebrow">{t("career.matchArchive")}</p><h4>{t("career.last10")}</h4></div><span>{reports.length} / 10</span></div>
    {!reports.length && <p className="career-empty">{t("career.reportsEmpty")}</p>}
    {reports.map(r=><details key={r.id} className="archive-match"><summary><span><strong>{r.opponent}</strong><small>{r.competition ? dataText(r.competition) : (r.mode==='season'?t("career.season"):t("career.tournament"))} · {dateLabel(r.createdAt)}{r.away === undefined ? '' : r.away ? t("career.awaySuffix") : t("career.homeSuffix")}</small></span><b>{r.homeScore}:{r.awayScore}{r.penaltyScore && <small> ({r.penaltyScore} {t("career.afterPenalties")})</small>}</b><span>{r.homeScore>r.awayScore?t("career.win"):r.homeScore<r.awayScore?t("career.loss"):r.penaltyScore?t("career.afterPenalties"):t("career.draw")} ⌄</span></summary>
    <div className="career-rating-list">{[...r.players].sort((a,b)=>b.rating-a.rating).map(p=><PlayerReportRow key={p.playerId} report={p} motm={r.motmId===p.playerId}/>)}</div>
    {r.startingIds && <p>{t("career.startingXIColon")} {r.startingIds.map(name).join(', ')}</p>}{r.benchIds && <p>{t("career.benchColon")} {r.benchIds.map(name).join(', ')}</p>}
    {r.events?.length ? <ol className="archive-events">{r.events.map(e=><li key={e.id}>{e.minute}′ · {e.label}</li>)}</ol> : null}
    {r.opponentMotm&&<small>{t("career.motmPrefix")} {r.opponentMotm.name} · {r.opponentMotm.rating.toFixed(1)} ({r.opponent})</small>}
    {r.tickets&&<small>{t("career.ticketIncome")} {t("career.spectators", { count: r.tickets.attendance })} · +{formatNumber(r.tickets.income)} {t("career.goals")}</small>}
    {r.derbyReward>0&&<small>{t("career.derbyPrize")} {r.derbyReward} {t("career.fragments")}</small>}</details>)}
  </section>;
}
/** Appearances, goals and assists from the authoritative per-match career records. */
export function PlayerStatsSummary({ features, playerId, view, onView }: { features: GameFeatures; playerId: string; view: 'career' | 'season'; onView: (view: 'career' | 'season') => void }) {
  const stats = (view === 'season' ? features.career.seasonPlayers[playerId] : features.career.players[playerId]) ?? emptyPlayerStats();
  const cells: [string, number][] = [[t("career.matches"), stats.appearances], [t("career.goals"), stats.goals], [t("career.assists"), stats.assists]];
  return <div className="player-stats-summary" aria-label={t("career.playerStats")}>
    <div className="player-stats-heading"><strong>{t("career.playerStats")}</strong><div role="group" aria-label={t("career.period")}>{([['career', t("career.career")], ['season', t("career.seasonNumber", { seasonNumber: features.career.seasonNumber })]] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => onView(id)}>{label}</button>)}</div></div>
    <dl>{cells.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString('de-CH')}</dd></div>)}</dl>
    <small>{view === 'season' ? t("career.leagueMatchesThisSeason") : t("career.allCompetitive")} {t("career.fromReports")}</small>
  </div>;
}
/** Two cards side by side (Q43): rating, positions, form and career numbers; the better value is marked. */
export function PlayerCompare({ features, players }: { features: GameFeatures; players: readonly StarXIPlayer[] }) {
  const [first, setFirst] = useState(''), [second, setSecond] = useState('');
  const a = players.find((p) => p.id === first), b = players.find((p) => p.id === second);
  const rows = (player: StarXIPlayer) => { const stats = features.career.players[player.id] ?? emptyPlayerStats(); const form = getPlayerForm(features.career, player.id); return [
    ['OVR', getCareerCard(features.career, player).rating], [t("career.form"), Math.round(form.average * 10) / 10], [t("career.matches"), stats.appearances], [t("career.goals"), stats.goals], [t("career.assistsWord"), stats.assists], [t("career.motm"), stats.motm],
  ] as [string, number][]; };
  const left = a ? rows(a) : [], right = b ? rows(b) : [];
  const option = (p: StarXIPlayer) => <option key={p.id} value={p.id}>{p.name} · {getCareerCard(features.career, p).rating}{p.cardType === 'icon' ? t("career.iconSuffix") : p.isCustom ? t("career.specialSuffix") : ''}</option>;
  return <section className="career-section player-compare" aria-label={t("career.comparePlayers")}>
    <div className="career-heading"><div><p className="eyebrow">{t("career.compareEyebrow")}</p><h4>{t("career.whoFits")}</h4></div></div>
    <div className="player-compare-pickers"><select aria-label={t("career.firstPlayer")} value={first} onChange={(e) => setFirst(e.target.value)}><option value="">{t("career.choosePlayer")}</option>{players.map(option)}</select><select aria-label={t("career.secondPlayer")} value={second} onChange={(e) => setSecond(e.target.value)}><option value="">{t("career.choosePlayer")}</option>{players.map(option)}</select></div>
    {a && b && <table className="player-compare-table"><thead><tr><th scope="col"></th><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead><tbody>
      <tr><th scope="row">{t("career.positions")}</th><td>{getStarXIPositions(a).join(' / ')}</td><td>{getStarXIPositions(b).join(' / ')}</td></tr>
      {left.map(([label, value], index) => { const other = right[index][1]; return <tr key={label}><th scope="row">{label}</th><td className={value > other ? 'better' : undefined}>{value.toLocaleString('de-CH')}</td><td className={other > value ? 'better' : undefined}>{other.toLocaleString('de-CH')}</td></tr>; })}
    </tbody></table>}
  </section>;
}
function AwardCard({ label, winner, empty }: { label: string; winner: AwardWinner; empty: string }) { return <article className="career-award"><span>{label}</span><strong>{winner ? name(winner.playerId) : t("career.noWinner")}</strong><small>{winner?.value || empty}</small></article>; }
export function CareerPanel({ features }: { features: GameFeatures }) {
  const [search,setSearch] = useState(''), [playerId,setPlayerId] = useState(''), [awardId,setAwardId] = useState(''), [statsView,setStatsView] = useState<'career'|'season'>('career');
  const [sort,setSort] = useState('name'), [position,setPosition] = useState('all'), [positionMode,setPositionMode] = useState('any'), [squad,setSquad] = useState('all'), [availability,setAvailability] = useState('all'), [form,setForm] = useState('all'), [minRating,setMinRating] = useState(''), [maxRating,setMaxRating] = useState('');
  useEffect(()=>{const timer=window.setTimeout(()=>{try {const saved=localStorage.getItem('gc-career-sort');if(saved && ['name','name-desc','rating','rating-asc','form','form-asc','average','appearances','goals','assists','motm'].includes(saved))setSort(saved);} catch {}},0);return ()=>window.clearTimeout(timer);},[]);
  const changeSort=(value:string)=>{setSort(value);try {localStorage.setItem('gc-career-sort',value);} catch {}};
  const unavailable=new Set(getUnavailableStarXIPlayerIds(features));
  const ids = [...new Set([...features.starXI.ownedIds,...Object.keys(features.career.players)])];
  const players = ids.map(getStarXIPlayer).filter((p): p is StarXIPlayer=>!!p).sort((a,b)=>a.name.localeCompare(b.name));
  const selectedPlayer = players.find(p=>p.id===playerId) ?? players[0];
  // Milestone progress of the current Prestige run; the full history stays in the statistics above.
  const stats = selectedPlayer ? getMilestoneStats(features.career, selectedPlayer.id) : getMilestoneStats(features.career, '');
  const awards = [...features.career.awards].reverse();
  const award = awards.find(a=>a.id===awardId) ?? awards[0];
  const rivals = Object.values(features.career.rivals).sort((a,b)=>Number(b.active)-Number(a.active)||b.played-a.played||b.lastPlayedAt-a.lastPlayedAt);
  const visible = players.filter(p=>p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
    && (position==='all'||(positionMode==='primary'?[p.position]:positionMode==='secondary'?getStarXIPositions(p).filter(x=>x!==p.position):getStarXIPositions(p)).includes(position as typeof p.position))
    && (!minRating||getCareerCard(features.career,p).rating>=Number(minRating)) && (!maxRating||getCareerCard(features.career,p).rating<=Number(maxRating))
    && (squad==='all'||squad==='xi'&&features.starXI.lineupIds.includes(p.id)||squad==='bench'&&features.starXI.benchIds.includes(p.id)||squad==='reserve'&&features.starXI.ownedIds.includes(p.id)&&!features.starXI.lineupIds.includes(p.id)&&!features.starXI.benchIds.includes(p.id))
    && (availability==='all'||(availability==='available'?!unavailable.has(p.id):unavailable.has(p.id)))
    && (form==='all'||(form==='good'?getPlayerForm(features.career,p.id).bonus>=.5:form==='poor'?getPlayerForm(features.career,p.id).bonus<=-.5:Math.abs(getPlayerForm(features.career,p.id).bonus)<.5)))
    .sort((a,b)=>{const sa=features.career.players[a.id]??emptyPlayerStats(),sb=features.career.players[b.id]??emptyPlayerStats();
      const delta=sort==='name-desc'?b.name.localeCompare(a.name):sort==='rating'?getCareerCard(features.career,b).rating-getCareerCard(features.career,a).rating:sort==='rating-asc'?getCareerCard(features.career,a).rating-getCareerCard(features.career,b).rating:sort==='form'?getPlayerForm(features.career,b.id).bonus-getPlayerForm(features.career,a.id).bonus:sort==='form-asc'?getPlayerForm(features.career,a.id).bonus-getPlayerForm(features.career,b.id).bonus:sort==='average'?(sb.ratedMatches?sb.ratingTotal/sb.ratedMatches:0)-(sa.ratedMatches?sa.ratingTotal/sa.ratedMatches:0):sort==='name'?0:sb[sort as 'appearances'|'goals'|'assists'|'motm']-sa[sort as 'appearances'|'goals'|'assists'|'motm'];return delta||a.name.localeCompare(b.name);});
  return <div className="career-panel">
    <section className="career-section"><div className="career-heading"><div><p className="eyebrow">{t("career.formEyebrow")}</p><h3>{t("career.playersMakeHistory")}</h3></div><span className="feature-stat">{t("career.last5")}</span></div><p className="career-note">{t("career.formRules")}</p><div className="career-toolbar"><input className="mode-input" aria-label={t("career.searchForm")} placeholder={t("career.searchPlayers")} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label={t("career.sortCareer")} value={sort} onChange={e=>changeSort(e.target.value)}>{[['name',t("career.nameAZ")],['name-desc',t("career.nameZA")],['rating',t("career.highestOvr")],['rating-asc',t("career.lowestOvr")],['form',t("career.bestForm")],['form-asc',t("career.worstForm")],['average',t("career.bestAverage")],['appearances',t("career.mostApps")],['goals',t("career.mostGoals")],['assists',t("career.mostAssists")],['motm',t("career.mostMotm")]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><details className="career-filters"><summary>{t("career.filterDot")} {visible.length} {t("career.player")}</summary><div>
    <select aria-label={t("career.filterPosition")} value={position} onChange={e=>setPosition(e.target.value)}><option value="all">{t("career.allPositions")}</option>{STAR_POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select>
    <select aria-label={t("career.positionType")} value={positionMode} onChange={e=>setPositionMode(e.target.value)}><option value="any">{t("career.mainAndSecondary")}</option><option value="primary">{t("career.mainPosition")}</option><option value="secondary">{t("career.secondaryPosition")}</option></select>
    <input type="number" min="0" max="100" aria-label={t("career.minRating")} placeholder={t("career.ovrFrom")} value={minRating} onChange={e=>setMinRating(e.target.value)}/><input type="number" min="0" max="100" aria-label={t("career.maxRating")} placeholder={t("career.ovrTo")} value={maxRating} onChange={e=>setMaxRating(e.target.value)}/>
    <select aria-label={t("career.squadArea")} value={squad} onChange={e=>setSquad(e.target.value)}>{[['all',t("career.wholeClub")],['xi',t("career.startingXI")],['bench',t("career.bench")],['reserve',t("career.reserves")]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
    <select aria-label={t("career.availability")} value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">{t("career.allPlayers")}</option><option value="available">{t("career.available")}</option><option value="unavailable">{t("career.notAvailable")}</option></select>
    <select aria-label={t("career.filterForm")} value={form} onChange={e=>setForm(e.target.value)}><option value="all">{t("career.anyForm")}</option><option value="good">{t("career.goodForm")}</option><option value="neutral">{t("career.neutralForm")}</option><option value="poor">{t("career.weakForm")}</option></select>
    <button type="button" onClick={()=>{setSearch('');changeSort('name');setPosition('all');setPositionMode('any');setSquad('all');setAvailability('all');setForm('all');setMinRating('');setMaxRating('');}}>{t("career.reset")}</button></div></details></div><div className="career-form-list">{visible.length ? visible.map(p=>{ const f=getPlayerForm(features.career,p.id),s=features.career.players[p.id];return <button type="button" key={p.id} className={selectedPlayer?.id===p.id?'selected':''} onClick={()=>setPlayerId(p.id)}><span><strong>{p.name}</strong><small>{getStarXIPositions(p).join(' / ')} · {s?.appearances??0} {t("career.appearances")}<CareerPlayerBadge features={features} player={p}/></small></span><span className="career-form-values"><b className={f.bonus>=.5?'up':f.bonus<=-.5?'down':''}>{signed(f.bonus)} OVR</b><small>{f.matches?`Ø ${f.average.toFixed(2)}`:t("career.noForm")}</small></span></button>}) : <p className="career-empty">{t("career.noMatchingPlayers")}</p>}</div></section>
    <PlayerCompare features={features} players={players} />
    <section className="career-section"><div className="career-heading"><div><p className="eyebrow">{t("career.milestonesEyebrow")}</p><h4>{selectedPlayer?.name ?? t("career.nextLegend")}</h4></div>{selectedPlayer&&<select aria-label={t("career.chooseMilestonePlayer")} value={selectedPlayer.id} onChange={e=>setPlayerId(e.target.value)}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div>{selectedPlayer&&<PlayerStatsSummary features={features} playerId={selectedPlayer.id} view={statsView} onView={setStatsView}/>}<p className="career-note">{t("career.milestoneRules")}</p><div className="career-milestone-grid">{(selectedPlayer ? getPlayerMilestones(features.career, selectedPlayer) : []).map(m=>{const unlocked=selectedPlayer&&(features.career.milestoneCards[selectedPlayer.id]??[]).includes(m.id),progress=Math.min(m.target,stats[m.metric]);return <article key={m.id} className={`career-milestone-card ${unlocked?'unlocked':''}`} style={{'--career-accent':m.accent} as CSSProperties}><span>{unlocked?t("career.unlockedCaps"):t("career.milestoneCaps")}</span><strong>{m.label}</strong><b>{selectedPlayer?Math.min(100,selectedPlayer.rating+m.bonus):`+${m.bonus}`} <small>OVR</small></b><small>{m.target} {MILESTONE_METRIC_LABELS[m.metric]}</small><progress max={m.target} value={progress}/><small>{progress} / {m.target}{unlocked?t("career.inAlbumSuffix"):t('career.milestoneToGo', { amount: m.target-progress, metric: localizeText(MILESTONE_METRIC_LABELS[m.metric]) })}</small></article>})}</div></section>
    <section className="career-section"><div className="career-heading"><div><p className="eyebrow">{t("career.awardsEyebrow")}</p><h4>{award?t("career.seasonLeague", { seasonNumber: award.seasonNumber, league: leagueForTier(award.division) }):t("career.stageWaits")}</h4></div>{awards.length>0&&<select aria-label={t("career.chooseAwards")} value={award?.id} onChange={e=>setAwardId(e.target.value)}>{awards.map(a=><option key={a.id} value={a.id}>{t("career.season")} {a.seasonNumber} · Liga {leagueForTier(a.division)}</option>)}</select>}</div>{award?<><p className="career-note">{t("career.out")} {award.matchesTracked} {t("career.awardRules")}</p><div className="career-award-grid"><AwardCard label={t("career.bestPlayerLabel")} winner={award.best} empty={t("career.tooFewRated")}/><AwardCard label={t("career.topScorerLabel")} winner={award.scorer} empty={t("career.noGoalsSeason")}/><AwardCard label={t("career.bestJoker")} winner={award.joker} empty={t("career.tooFewSubs")}/><AwardCard label={t("career.disappointment")} winner={award.disappointment} empty={t("career.noneUnder65")}/></div></>:<p className="career-empty">{t("career.awardsPending")} {features.career.seasonMatches} {t("career.seasonsRecorded")}</p>}</section>
    <section className="career-section"><div className="career-heading"><div><p className="eyebrow">{t("career.rivalriesEyebrow")}</p><h4>{t("career.rivalsNeverForget")}</h4></div><span className="feature-stat">{rivals.filter(r=>r.active).length} {t("career.rivalsCaps")}</span></div><p className="career-note">{t("career.rivalryRules")}</p><div className="career-rival-list">{rivals.length?rivals.map(r=><article key={r.opponent} className={r.active?'active':''}><div><span>{r.active?t("career.rival"):t("career.meetings")}</span><strong>{r.opponent}</strong><small>{r.played} Duelle · {r.goalsFor}:{r.goalsAgainst} {t("career.goals")}</small></div><div className="career-rival-record"><b>{r.wins} S · {r.draws} U · {r.losses} N</b><small>{r.lastResults.join(' · ')}</small></div></article>):<p className="career-empty">{t("career.firstDuels")}</p>}</div></section>
  </div>;
}
export function AlbumPanel({ features, busy, onClaim, showMilestones, onShowMilestones }: { features: GameFeatures; busy: boolean; onClaim: (id:string)=>void; showMilestones: boolean; onShowMilestones: (show:boolean)=>void }) {
  const [search,setSearch]=useState(''),[nation,setNation]=useState('all'),[type,setType]=useState('all'),[ownership,setOwnership]=useState('all'),[rating,setRating]=useState('all'),[page,setPage]=useState(0),[groupCount,setGroupCount]=useState(12);
  // Missing cards of one group (Q39) and the sort order (Q40); the filters stay on this device (Q35).
  const [groupView,setGroupView]=useState(''),[sort,setSort]=useState('ovr');
  useEffect(()=>{const saved=readJsonPref(PREF_KEYS.albumFilters,value=>pickStringFields(value,{nation:'all',type:'all',ownership:'all',rating:'all',sort:'ovr'},{type:['all','base','icon','legendary','custom','milestones'],ownership:['all','collected','missing'],rating:['all','max70','71-79','80','85','90','95','100'],sort:['ovr','name','nation']}));const timer=window.setTimeout(()=>{setNation(saved.nation);setType(saved.type);setOwnership(saved.ownership);setRating(saved.rating);setSort(saved.sort);},0);return()=>window.clearTimeout(timer);},[]);
  useEffect(()=>{writeJsonPref(PREF_KEYS.albumFilters,{nation,type,ownership,rating,sort});},[nation,type,ownership,rating,sort]);
  const collected=useMemo(()=>new Set([...features.career.collectedIds,...features.starXI.ownedIds]),[features.career.collectedIds,features.starXI.ownedIds]);
  // Cards missing from FC 27 only stay in the album for players who already collected them.
  const albumPlayers=useMemo(()=>STAR_XI_PLAYERS.filter(p=>!p.retired||collected.has(p.id)),[collected]);
  const nations=useMemo(()=>[...new Set(albumPlayers.map(p=>p.countryCode).filter((n):n is string=>!!n))].sort((a,b)=>nationName(a).localeCompare(nationName(b))),[albumPlayers]);
  // With the milestone bonus switched off every card shows its original rating; filter and sort follow what is shown.
  const albumRating=useCallback((p:StarXIPlayer)=>showMilestones?getCareerCard(features.career,p).rating:p.rating,[showMilestones,features.career]);
  const filtered=useMemo(()=>albumPlayers.filter(p=>(!search||`${p.name} ${getStarXIPositions(p).join(' ')} ${p.countryCode}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))&&(nation==='all'||p.countryCode===nation)&&(type==='all'||(type==='custom'?p.isCustom:type==='milestones'?!!features.career.milestoneCards[p.id]?.length:(p.cardType??'base')===type))&&(ownership==='all'||(ownership==='collected'?collected.has(p.id):!collected.has(p.id)))&&(rating==='all'||(rating==='max70'?albumRating(p)<=70:rating==='71-79'?albumRating(p)>=71&&albumRating(p)<=79:albumRating(p)>=Number(rating)))&&(!groupView||(albumGroupIncludes(groupView,p)&&!collected.has(p.id)))).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'de-CH')||albumRating(b)-albumRating(a):sort==='nation'?nationName(a.countryCode??'').localeCompare(nationName(b.countryCode??''))||albumRating(b)-albumRating(a):albumRating(b)-albumRating(a)||a.name.localeCompare(b.name)),[albumPlayers,search,nation,type,ownership,rating,collected,features.career.milestoneCards,albumRating,groupView,sort]);
  const groups=useMemo(()=>getAlbumGroups({...features.career,collectedIds:[...collected]}),[features.career,collected]);
  const availableGroups=groups.filter(g=>!g.claimed&&g.collected===g.total);
  const availableReward=availableGroups.reduce((sum,g)=>sum+g.reward,0),availableSeconds=availableGroups.reduce((sum,g)=>sum+g.rewardSeconds,0);
  const shownGroups=groups.filter(g=>nation==='all'||!g.id.startsWith('nation-')||g.id===`nation-${nation}`).sort((a,b)=>Number(b.collected===b.total&&!b.claimed)-Number(a.collected===a.total&&!a.claimed)||Number(a.id.startsWith('nation-'))-Number(b.id.startsWith('nation-'))||b.collected/b.total-a.collected/a.total);
  const totalPages=Math.max(1,Math.ceil(filtered.length/48)),safePage=Math.min(page,totalPages-1);
  const change=(setter:(v:string)=>void,value:string)=>{setter(value);setPage(0)};
  const milestoneCount=Object.values(features.career.milestoneCards).reduce((n,ids)=>n+ids.length,0);
  return <div className="career-panel"><section className="career-section"><div className="career-heading"><div><p className="eyebrow">{t("career.albumEyebrow")}</p><h3>{collected.size.toLocaleString('de-CH')} / {albumPlayers.length.toLocaleString('de-CH')} {t("career.cards")}</h3></div><span className="feature-stat">{milestoneCount} {t("career.milestoneCardsCaps")}</span></div><progress className="career-album-progress" max={albumPlayers.length} value={collected.size}/><p className="career-note">{t("career.albumRules")}</p><div className="career-album-filters"><input className="mode-input" aria-label={t("career.searchAlbum")} placeholder={t("career.searchNamePos")} value={search} onChange={e=>change(setSearch,e.target.value)}/><select aria-label={t("career.albumNation")} value={nation} onChange={e=>change(setNation,e.target.value)}><option value="all">{t("career.allNations")}</option>{nations.map(n=><option key={n} value={n}>{nationName(n)}</option>)}</select><select aria-label={t("career.albumCardType")} value={type} onChange={e=>change(setType,e.target.value)}><option value="all">{t("career.allCardTypes")}</option><option value="base">{t("career.base")}</option><option value="icon">{t("career.icons")}</option><option value="legendary">{t("career.legendary")}</option><option value="custom">{t("career.customLabel")}</option><option value="milestones">{t("career.milestones")}</option></select><select aria-label={t("career.albumOwned")} value={ownership} onChange={e=>change(setOwnership,e.target.value)}><option value="all">{t("career.allCards")}</option><option value="collected">{t("career.collectedLabel")}</option><option value="missing">{t("career.missing")}</option></select><select aria-label={t("career.albumRating")} value={rating} onChange={e=>change(setRating,e.target.value)}><option value="all">{t("career.allRatings")}</option><option value="max70">{t("career.upTo70")}</option><option value="71-79">{t("career.from71to79")}</option>{[80,85,90,95,100].map(r=><option key={r} value={r}>{r}+ OVR</option>)}</select><select aria-label={t("career.sortAlbum")} value={sort} onChange={e=>change(setSort,e.target.value)}><option value="ovr">{t("career.byOvr")}</option><option value="name">{t("career.byName")}</option><option value="nation">{t("career.byNation")}</option></select><label className="career-album-switch"><input type="checkbox" role="switch" checked={showMilestones} onChange={e=>onShowMilestones(e.target.checked)}/><span><strong>{t("career.milestoneBonuses")}</strong><small>{showMilestones?t("career.ratingsWithBonus"):t("career.originalRatings")}</small></span></label></div>{groupView&&<p className="album-group-view">{t("career.missingCards")} <strong>{groupView.startsWith('nation-')?nationName(groupView.slice(7)):groups.find(g=>g.id===groupView)?.label}</strong> <button type="button" className="mode-secondary" onClick={()=>{setGroupView('');setPage(0);}}>{t("career.showAllCards")}</button></p>}<div className="career-album-grid">{filtered.slice(safePage*48,(safePage+1)*48).map(p=>{const owned=collected.has(p.id),card=getCareerCard(features.career,p),milestone=showMilestones?card.milestone:undefined;return <article className={`career-album-card ${owned?'collected':'missing'} ${milestone?'milestone':''}`} key={p.id} style={{'--career-accent':milestone?.accent??p.accent} as CSSProperties}><span>{owned?t("career.collectedCaps"):t("career.missingCaps")} · {p.isCustom?t("career.custom"):(p.cardType??'base').toUpperCase()}{p.retired?t("career.notInFc27"):''}</span><b>{milestone?card.rating:p.rating}</b><strong>{p.name}</strong><small>{getStarXIPositions(p).join(' / ')} · {p.countryCode? nationName(p.countryCode):t("career.international")}</small>{milestone&&<em>★ {dataText(milestone.label)}</em>}<small>{owned?(features.starXI.ownedIds.includes(p.id)?t("career.inSquad"):t("career.notInSquad")):t("career.viaPacks")}</small>{features.career.milestoneCards[p.id]?.length>0&&<small>{features.career.milestoneCards[p.id].map(id=>CAREER_MILESTONES.find(m=>m.id===id)?.label).join(' · ')}</small>}</article>})}</div>{!filtered.length&&<p className="career-empty">{t("career.noCardsFilter")}</p>}<div className="career-pagination"><button type="button" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>{t("career.back")}</button><span>{filtered.length.toLocaleString('de-CH')} Treffer · Seite {safePage+1} / {totalPages}</span><button type="button" disabled={safePage>=totalPages-1} onClick={()=>setPage(safePage+1)}>{t("career.next")}</button></div></section><section className="career-section"><div className="career-heading"><div><p className="eyebrow">{t("career.collectionsEyebrow")}</p><h4>{t("career.everyPage")}</h4></div><span className="feature-stat">{features.starXI.fragments.toLocaleString('de-CH')} {t("career.fragmentsCaps")}</span></div><button type="button" className="feature-buy-button" disabled={busy||availableGroups.length===0} onClick={()=>onClaim("all")}>{busy?t("career.collecting"):t("career.claimAll", { count: availableGroups.length })}</button><p className="career-note">{availableReward.toLocaleString('de-CH')} {t("career.fragments")}{availableSeconds>0?t("career.incomeInGoals", { duration: formatIncomeDuration(availableSeconds) }):''} aus allen verfügbaren Sammlungen, unabhängig von den Filtern.</p><div className="career-album-rewards">{shownGroups.slice(0,groupCount).map(g=><article key={g.id}><div><strong>{g.id.startsWith('nation-')?nationName(g.id.slice(7)):g.label}{g.id.startsWith('nation-')&&nationGroupScope(g.id.slice(7))?`: ${nationGroupScope(g.id.slice(7))}`:''}</strong><small>{g.collected} / {g.total} Karten · {g.reward.toLocaleString('de-CH')} Fragmente · {formatIncomeDuration(g.rewardSeconds)} {t("career.income")}</small><progress max={g.total} value={g.collected}/>{!g.id.startsWith('collect-')&&g.collected<g.total&&<button type="button" className="album-missing-link" onClick={()=>{setGroupView(g.id);setOwnership('all');setPage(0);document.querySelector('.career-album-grid')?.scrollIntoView({behavior:'smooth',block:'start'});}}>{g.total-g.collected} {t("career.showMissing")}</button>}</div><button type="button" className="feature-buy-button" disabled={busy||g.claimed||g.collected<g.total} onClick={()=>onClaim(g.id)}>{g.claimed?t("career.collected"):g.collected===g.total?t("career.claimReward"):t("career.stillOpen")}</button></article>)}</div>{shownGroups.length>groupCount&&<button type="button" className="mode-secondary" onClick={()=>setGroupCount(n=>n+20)}>{t("career.moreCollections")}</button>}</section></div>;
}

/** `next` (Q44): the next match of the club in one tap (league matchday, cup round or the journey to it). */
export function PostMatchSummary({features,onCareer,onContinue,next}:{features:GameFeatures;onCareer:()=>void;onContinue:()=>void;next?:{label:string;disabled?:boolean;onClick:()=>void}}) {
  const c=features.cup;
  const report=features.career.reports.find(r=>r.id===c.careerMatchId) ?? features.career.reports.findLast(r=>r.opponent===c.opponent && r.homeScore===c.homeScore && r.awayScore===c.awayScore) ?? features.career.reports.findLast(r=>r.createdAt>=c.matchStartedAt);
  if(c.active||!c.matchStartedAt)return null;
  // Once the match is over the cup already points at the next fixture (opponent, venue, maybe a journey);
  // the summary shows the match that was played, as the report recorded it.
  const opponent=report?.opponent??c.opponent,away=report?.away??Boolean(c.fixture?.away),clubScore=report?.homeScore??c.homeScore,opponentScore=report?.awayScore??c.awayScore;
  const top=[...(report?.players??[])].sort((a,b)=>b.rating-a.rating).slice(0,3);
  const rewards=features.history.filter(e=>e.timestamp>= (report?.createdAt??c.lastTickAt)-1000 && /prämie|einnahmen|freigeschaltet|gewonnen|aufstieg|turnieraus|derby/i.test(e.title)).slice(-6);
  return <section className="post-match-summary" aria-label={t("career.matchEnd")}><p className="eyebrow">{t("career.fullTime")} {report?.competition??(c.mode==='season'?t("career.seasonCaps"):t("career.tournamentCaps"))}</p><div className="summary-score"><strong>{away?opponent:features.club.name}</strong><b>{away?opponentScore:clubScore} : {away?clubScore:opponentScore}</b><strong>{away?features.club.name:opponent}</strong></div>
  <p>{c.lastResult}{c.penaltyEvents.length>0&&t("career.shootoutScore", { home: c.penaltyHomeScore, away: c.penaltyAwayScore })}</p>
  {(c.simulation||c.interactiveResult)&&<div className="summary-match-stats"><span>{t("career.shots")} {c.broadcast?.clubStats.shots??0} : {c.broadcast?.opponentStats.shots??0}</span><span>{t("career.onTarget")} {c.broadcast?.clubStats.onTarget??0} : {c.broadcast?.opponentStats.onTarget??0}</span></div>}
  {report?.opponentMotm?<p className="summary-motm">{t("career.motmPrefix")} <strong>{report.opponentMotm.name}</strong> · {report.opponentMotm.rating.toFixed(1)} ({opponent})</p>:report?.motmId?<p className="summary-motm">{t("career.motmPrefix")} <strong>{name(report.motmId)}</strong> · {report.players.find(p=>p.playerId===report.motmId)?.rating.toFixed(1)}</p>:null}
  {report?.tickets&&<p className="summary-tickets">🎟️ {report.tickets.attendance.toLocaleString('de-CH')} Zuschauer · Ticketeinnahmen +{formatNumber(report.tickets.income)} {t("career.goals")}</p>}
  {c.matchEvents.length>0&&<div className="summary-goals">{c.matchEvents.map(e=><span key={e.id}>{goalLabel(e)}</span>)}</div>}
  <div className="summary-performances">{top.map(p=><span key={p.playerId}><strong>{name(p.playerId)}{report?.motmId===p.playerId?' ★':''}</strong><b>{p.rating.toFixed(1)}</b><small>{p.goals} Tore · {p.assists} {t("career.assistsWord")}</small></span>)}</div>
  {report?.events?.length ? <details><summary>{t("career.goalsAndEvents")}</summary><ol className="archive-events">{report.events.map(e=><li key={e.id}>{e.minute}′ · {e.label}</li>)}</ol></details> : null}
  {rewards.length>0&&<details><summary>{t("career.rewardsProgress")}</summary>{rewards.map(e=><p key={e.id}><strong>{e.title}</strong> · {e.detail}</p>)}</details>}
  <div className="summary-actions">{next&&<button className="mode-primary" disabled={next.disabled} onClick={next.onClick}>{next.label}</button>}<button className={next?"mode-secondary":"mode-primary"} onClick={onContinue}>{t("career.toSquad")}</button><button className="mode-secondary" onClick={onCareer}>{t("career.matchReport")}</button></div></section>;
}

const dateLabel = (at: number) => at ? new Date(at).toLocaleDateString(currentIntlTag()) : t("career.noDate");
const runLabel = (prestige: number | null) => prestige === null ? '' : t("career.run", { run: prestige + 1 });
// Built when shown (not at import), so the labels follow the current language.
const seasonOutcomeLabel = (outcome: string) => ({ promoted: t("career.promotion"), relegated: t("career.relegation"), stayed: t("career.survival"), 'hall-of-fame': t("career.hallOfFame") } as Record<string, string>)[outcome] ?? '';
type AllTimeSort = 'name' | 'appearances' | 'minutes' | 'goals' | 'assists' | 'average' | 'motm' | 'points';
const allTimeColumns = (): { id: Exclude<AllTimeSort, 'name'>; label: string; short: string }[] => [
  { id: 'appearances', label: t("career.appearances"), short: t("career.appearancesShort") }, { id: 'minutes', label: t("career.minutes"), short: t("career.minutesShort") }, { id: 'goals', label: t("career.goals"), short: t("career.goals") },
  { id: 'assists', label: t("career.assistsWord"), short: t("career.assistsShort") }, { id: 'average', label: t("career.averageRating"), short: t("career.averageShort") }, { id: 'motm', label: t("career.motm"), short: t("career.motmShort") }, { id: 'points', label: t("career.points"), short: t("career.pointsShort") },
];
const ALL_TIME_PAGE = 50;

/** Every card that ever played for the club, from the lifetime statistics (career.players), sortable by every column. */
export function AllTimePlayerTable({ features }: { features: GameFeatures }) {
  const [sort, setSort] = useState<AllTimeSort>('goals'), [ascending, setAscending] = useState(false), [squadOnly, setSquadOnly] = useState(false), [shown, setShown] = useState(ALL_TIME_PAGE);
  const owned = useMemo(() => new Set(features.starXI.ownedIds), [features.starXI.ownedIds]);
  const rows = useMemo(() => Object.entries(features.career.players).flatMap(([id, stats]) => {
    const player = getStarXIPlayer(id);
    return player && stats.appearances > 0 ? [{ id, player, stats, average: stats.ratedMatches ? stats.ratingTotal / stats.ratedMatches : 0 }] : [];
  }), [features.career.players]);
  const visible = useMemo(() => rows.filter((row) => !squadOnly || owned.has(row.id)).sort((a, b) => {
    const delta = sort === 'name' ? a.player.name.localeCompare(b.player.name) : sort === 'average' ? a.average - b.average : a.stats[sort] - b.stats[sort];
    return (ascending ? delta : -delta) || a.player.name.localeCompare(b.player.name);
  }), [rows, squadOnly, owned, sort, ascending]);
  const choose = (id: AllTimeSort) => { if (id === sort) setAscending(!ascending); else { setSort(id); setAscending(id === 'name'); } };
  const header = (id: AllTimeSort, label: string, title: string) => <th scope="col" key={id} aria-sort={sort === id ? (ascending ? 'ascending' : 'descending') : 'none'}><button type="button" title={title} aria-label={title} onClick={() => choose(id)}>{label}{sort === id ? (ascending ? ' ▲' : ' ▼') : ''}</button></th>;
  return <section className="career-section" aria-label={t("career.allTimeLabel")}><div className="career-heading"><div><p className="eyebrow">{t("career.allTimeTable")}</p><h4>{t("career.everyoneWhoPlayed")}</h4></div><span className="feature-stat">{rows.length} {t("career.playerCaps")}</span></div>
    <p className="career-note">{t("career.allTimeIntro")}</p>
    <label className="chronicle-toggle"><input type="checkbox" checked={squadOnly} onChange={(e) => setSquadOnly(e.target.checked)} /> {t("career.onlySquad")}</label>
    {visible.length ? <div className="chronicle-table-wrap"><table className="chronicle-table all-time-table"><thead><tr><th scope="col">#</th>{header('name', t("career.player"), t("career.sortByName"))}{allTimeColumns().map((c) => header(c.id, c.short, t("career.sortBy", { label: c.label })))}</tr></thead>
      <tbody>{visible.slice(0, shown).map((row, index) => <tr key={row.id} className={owned.has(row.id) ? 'in-squad' : ''}><td>{index + 1}</td><th scope="row"><span>{row.player.name}</span><small>{getStarXIPositions(row.player).join(' / ') || t("career.bench")}{owned.has(row.id) ? t("career.inSquadSuffix") : ''}</small></th><td>{row.stats.appearances}</td><td>{Math.round(row.stats.minutes).toLocaleString('de-CH')}</td><td>{row.stats.goals}</td><td>{row.stats.assists}</td><td>{row.average ? row.average.toFixed(2) : ''}</td><td>{row.stats.motm}</td><td>{row.stats.points}</td></tr>)}</tbody></table></div>
      : <p className="career-empty">{t("career.statsEmpty")}</p>}
    {visible.length > shown && <button type="button" className="mode-secondary chronicle-more" onClick={() => setShown(shown + ALL_TIME_PAGE)}>{t("career.more")} {Math.min(ALL_TIME_PAGE, visible.length - shown)} {t("career.showPlayers")}</button>}
  </section>;
}

function RecordCard({ label, record, value, empty }: { label: string; record: ChronicleMatchRecord | null; value: (r: ChronicleMatchRecord) => string; empty: string }) {
  return <article className="career-award"><span>{label}</span><strong>{record ? value(record) : t("career.stillOpen")}</strong><small>{record ? `${t("career.against", { opponent: record.opponent })} · ${record.competition ? `${dataText(record.competition)} · ` : ''}${dateLabel(record.at)}` : empty}</small></article>;
}

/** Club chronicle: totals, records, titles with dates, one row per finished season and the final Hall of Fame tables. */
export function ClubChroniclePanel({ features }: { features: GameFeatures }) {
  const { totals, records, seasons, titles, hallOfFame } = features.chronicle;
  const archive = [...seasons].reverse();
  const datedTournamentTitles = (id: string) => titles.filter((t) => t.kind === 'tournament' && t.tournamentId === id).length;
  const undatedTitles = TOURNAMENTS.map((t) => ({ label: t.trophyName, count: Math.max(0, (features.cup.trophies[t.id] ?? 0) - datedTournamentTitles(t.id)) })).filter((t) => t.count > 0);
  const totalCells: [string, string][] = [[t("career.wins"), totals.wins.toLocaleString('de-CH')], [t("career.draw"), totals.draws.toLocaleString('de-CH')], [t("career.losses"), totals.losses.toLocaleString('de-CH')], [t("career.goals"), `${totals.goalsFor}:${totals.goalsAgainst}`], [t("career.cleanSheets"), totals.cleanSheets.toLocaleString('de-CH')], [t("career.derbyWins"), totals.derbyWins.toLocaleString('de-CH')]];
  return <div className="career-panel">
    <section className="career-section" aria-label={t("career.clubBalance")}><div className="career-heading"><div><p className="eyebrow">{t("career.chronicleEyebrow")}</p><h3>{t("career.historyOf")} {features.club.name}.</h3></div><span className="feature-stat">{totals.matches} {t("career.competitiveCaps")}</span></div>
      <p className="career-note">{t("career.balanceSince")}</p>
      <dl className="chronicle-totals">{totalCells.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    <section className="career-section" aria-label={t("career.clubRecords")}><div className="career-heading"><div><p className="eyebrow">{t("career.recordHall")}</p><h4>{t("career.clubBests")}</h4></div></div>
      <div className="career-award-grid chronicle-records">
        <RecordCard label={t("career.biggestWin")} record={records.biggestWin} value={(r) => r.score} empty={t("career.firstWinMark")} />
        <RecordCard label={t("career.mostGoalsMatch")} record={records.mostGoals} value={(r) => `${r.value} ${r.value === 1 ? t('career.goalWord') : t('career.goalsWord')} (${r.score})`} empty={t("career.firstGoalMark")} />
        <RecordCard label={t("career.attendanceRecord")} record={records.recordCrowd} value={(r) => t("career.spectators", { count: r.value })} empty={t("career.homeLeagueOnly")} />
        <article className="career-award"><span>{t("career.streaks")}</span><strong>{t("career.unbeatenRun", { count: records.unbeaten.best })}</strong><small>{t("career.streakDetail", { unbeaten: records.unbeaten.current, bestWins: records.winning.best, currentWins: records.winning.current })}{records.unbeaten.bestAt ? t("career.recordSince", { date: dateLabel(records.unbeaten.bestAt) }) : ''}</small></article>
      </div>
    </section>
    <section className="career-section" aria-label={t("career.titles")}><div className="career-heading"><div><p className="eyebrow">{t("career.titlesDated")}</p><h4>{t("career.everyTrophy")}</h4></div><span className="feature-stat">{titles.length + undatedTitles.reduce((n, t) => n + t.count, 0)} {t("career.titlesCaps")}</span></div>
      {titles.length ? <ol className="chronicle-titles">{[...titles].reverse().map((t) => <li key={t.id}><span aria-hidden="true">{t.kind === 'hall-of-fame' ? '🏛️' : t.kind === 'league' ? '🏆' : '🥇'}</span><strong>{t.label}</strong><small>{dateLabel(t.at)} · {runLabel(t.prestige)}</small></li>)}</ol> : <p className="career-empty">{t("career.firstTitle")}</p>}
      {undatedTitles.length > 0 && <p className="career-note">{t("career.undatedWins")} {undatedTitles.map((t) => `${t.count}× ${t.label}`).join(', ')}.</p>}
    </section>
    <section className="career-section" aria-label={t("career.seasonArchive")}><div className="career-heading"><div><p className="eyebrow">{t("career.seasonArchiveCaps")}</p><h4>{t("career.everySeason")}</h4></div><span className="feature-stat">{seasons.length} {t("career.seasonsCaps")}</span></div>
      {archive.length ? <div className="chronicle-table-wrap"><table className="chronicle-table season-archive-table"><thead><tr><th scope="col">{t("career.season")}</th><th scope="col">{t("career.league")}</th><th scope="col">{t("career.place")}</th><th scope="col">{t("career.pointsShort")}</th><th scope="col">{t("career.winsDrawsLosses")}</th><th scope="col">{t("career.goals")}</th><th scope="col">{t("career.topScorer")}</th><th scope="col">{t("career.bestPlayer")}</th><th scope="col">{t("career.outcome")}</th></tr></thead>
        <tbody>{archive.map((row) => <tr key={row.id}><th scope="row"><span>{t("career.season")} {row.season}</span><small>{[runLabel(row.prestige), dateLabel(row.at)].filter(Boolean).join(' · ')}</small></th><td data-label={t("career.league")}>{leagueForTier(row.division)}</td><td data-label={t("career.place")}>{row.place ?? ''}</td><td data-label={t("career.pointsShort")}>{row.points ?? ''}</td><td data-label={t("career.winsDrawsLosses")}>{row.wins === null ? '' : `${row.wins} / ${row.draws} / ${row.losses}`}</td><td data-label={t("career.goals")}>{row.goalsFor === null ? '' : `${row.goalsFor}:${row.goalsAgainst}`}</td><td className="wide" data-label={t("career.topScorer")}>{row.topScorer ? `${name(row.topScorer.playerId)} (${row.topScorer.goals})` : ''}</td><td className="wide" data-label={t("career.bestPlayer")}>{row.bestPlayerId ? name(row.bestPlayerId) : ''}</td><td className="wide" data-label={t("career.outcome")}>{row.outcome ? seasonOutcomeLabel(row.outcome) : ''}</td></tr>)}</tbody></table></div>
        : <p className="career-empty">{t("career.archiveEmpty")}</p>}
      {archive.some((row) => row.place === null) && <p className="career-note">{t("career.preChronicle")}</p>}
    </section>
    <section className="career-section" aria-label={t("career.hofTables")}><div className="career-heading"><div><p className="eyebrow">{t("career.hofEyebrow")}</p><h4>{t("career.championTables")}</h4></div><span className="feature-stat">{hallOfFame.length} {t("career.runsCaps")}</span></div>
      {hallOfFame.length ? [...hallOfFame].reverse().map((table) => <details key={`${table.prestige}-${table.at}`} className="archive-match chronicle-hof"><summary><span><strong>{runLabel(table.prestige)}</strong><small>{dateLabel(table.at)}</small></span><b>{table.rows.find((r) => r.club)?.points ?? 0} {t("career.pointsShort")}</b><span>⌄</span></summary>
        <div className="chronicle-table-wrap"><table className="chronicle-table"><thead><tr><th scope="col">#</th><th scope="col">{t("career.club")}</th><th scope="col">{t("career.winsDrawsLosses")}</th><th scope="col">{t("career.goals")}</th><th scope="col">{t("career.pointsShort")}</th></tr></thead><tbody>{table.rows.map((r, index) => <tr key={`${r.name}-${index}`} className={r.club ? 'in-squad' : ''}><td>{index + 1}</td><th scope="row">{r.name}</th><td>{r.wins} / {r.draws} / {r.losses}</td><td>{r.goalsFor}:{r.goalsAgainst}</td><td>{r.points}</td></tr>)}</tbody></table></div></details>)
        : <p className="career-empty">{t("career.hofIntro")}</p>}
    </section>
    <AllTimePlayerTable features={features} />
  </div>;
}

const CAREER_VIEW_KEY = 'gc-career-view';
/** The Karriere tab: players, form and match reports, or the club chronicle with its records. */
export function CareerArea({ features }: { features: GameFeatures }) {
  const [view, setView] = useState<'players' | 'chronicle'>('players');
  useEffect(() => { const timer = window.setTimeout(() => { try { if (localStorage.getItem(CAREER_VIEW_KEY) === 'chronicle') setView('chronicle'); } catch {} }, 0); return () => window.clearTimeout(timer); }, []);
  const change = (next: 'players' | 'chronicle') => { setView(next); try { localStorage.setItem(CAREER_VIEW_KEY, next); } catch {} };
  return <>
    <div className="career-view-switch" role="group" aria-label={t("career.careerArea")}>{([['players', t("career.playersAndForm")], ['chronicle', t("career.chronicleRecords")]] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => change(id)}>{label}</button>)}</div>
    {view === 'players' ? <><CareerPanel features={features} /><MatchRatingsPanel features={features} /></> : <ClubChroniclePanel features={features} />}
  </>;
}
