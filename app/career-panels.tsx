'use client';

import { goalLabel } from './match-goals';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { formatIncomeDuration, getStarXIPlayer, getStarXIPositions, getUnavailableStarXIPlayerIds, STAR_POSITIONS, STAR_XI_PLAYERS, TOURNAMENTS, TRANSFER_UNHAPPY_PENALTY, transferUnhappyMatches } from './feature-data';
import type { ChronicleMatchRecord } from './club-chronicle';
import type { GameFeatures, StarXIPlayer } from './feature-data';
import { albumGroupIncludes, nationGroupScope, CAREER_MILESTONES, GROWTH_POINTS_PER_LEVEL, getPlayerMilestones, getMilestoneStats, MILESTONE_METRIC_LABELS, emptyPlayerStats, getAlbumGroups, getCareerCard, getPlayerForm } from './career-data';
import type { AwardWinner, PlayerMatchReport } from './career-data';
import { formatNumber } from './game/format';
import { PREF_KEYS, pickStringFields, readJsonPref, writeJsonPref } from './qol/prefs';
import { leagueForTier } from './season-progression';
import { getBans, suspensionLabel, yellowCardStatus } from './discipline';

const name = (id: string) => getStarXIPlayer(id)?.name ?? 'Unbekannter Spieler';
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
const nationName = (code: string) => { try { return new Intl.DisplayNames(['de-CH'], { type: 'region' }).of(code) || code; } catch { return code; } };

export function CareerPlayerBadge({ features, player, compact = false }: { features: GameFeatures; player: StarXIPlayer; compact?: boolean }) {
  const form = getPlayerForm(features.career, player.id), card = getCareerCard(features.career, player), unhappy = transferUnhappyMatches(features, player.id);
  const unhappyLabel = `Unzufrieden · −${TRANSFER_UNHAPPY_PENALTY} OVR · noch ${unhappy} ${unhappy === 1 ? 'Spiel' : 'Spiele'}`;
  if (compact) return <>{form.matches || card.milestone || unhappy ? <span className={`career-pitch-badge ${card.milestone ? 'special' : ''}${unhappy ? ' unhappy' : ''}`} title={`${card.milestone?.label ?? 'Basiskarte'} · ${form.label} · Form ${signed(form.bonus)} OVR${unhappy ? ` · ${unhappyLabel}` : ''}`} style={{ '--career-accent': card.milestone?.accent ?? '#edf3fa' } as CSSProperties}>{unhappy ? '😠 ' : ''}{card.milestone ? '★ ' : ''}{form.matches ? signed(form.bonus) : ''}</span> : null}<DisciplineTags features={features} playerId={player.id} compact /></>;
  return <span className="career-player-badges">
    {card.milestone && <span className="career-special-tag" style={{ '--career-accent': card.milestone.accent } as CSSProperties}>★ {card.milestone.label} · OVR {card.rating}</span>}
    {card.growth && <span className="career-form-tag up" title={`Special Cards wachsen mit den Punkten ihrer Partien: Sieg 3, Unentschieden 1, Niederlage 0, jeweils nach 90 Minuten (Verlängerung und Elfmeterschiessen zählen als Unentschieden). Alle ${GROWTH_POINTS_PER_LEVEL} Punkte +1 OVR bis zum Potenzial.`}>{card.growth.nextLevelPoints === null ? `★ Potenzial ${card.growth.potential} erreicht · OVR ${card.rating}` : `OVR ${card.rating} · Potenzial ${card.growth.potential} · noch ${card.growth.pointsToNext} ${card.growth.pointsToNext === 1 ? 'Punkt' : 'Punkte'} bis ${card.rating + 1}`}</span>}
    {form.matches > 0 && <span className={`career-form-tag ${form.bonus >= .5 ? 'up' : form.bonus <= -.5 ? 'down' : ''}`}>{form.label} · {signed(form.bonus)}</span>}
    {unhappy > 0 && <span className="career-form-tag down">😠 {unhappyLabel}</span>}
    <DisciplineTags features={features} playerId={player.id} />
  </span>;
}

/** Suspensions and yellow card warnings, for example "Gesperrt – 1 Spiel (3 Gelbe Karten)" or "2/3 Gelbe Karten". */
export function DisciplineTags({ features, playerId, compact = false }: { features: GameFeatures; playerId: string; compact?: boolean }) {
  const bans = getBans(features, playerId), yellows = yellowCardStatus(features, playerId);
  if (compact) {
    if (bans.length) return <span className="discipline-tag banned" title={bans.map(suspensionLabel).join(' · ')}>SPERRE</span>;
    const warning = yellows.find(y => y.count === y.limit - 1);
    return warning ? <span className="discipline-tag warning" title={`${warning.count}/${warning.limit} Gelbe Karten · ${warning.label}`}>{warning.count}/{warning.limit}</span> : null;
  }
  return <>{bans.map(ban => <span key={ban.id} className="discipline-tag banned">{suspensionLabel(ban)}</span>)}{yellows.map(y => <span key={y.competition} className={`discipline-tag ${y.count === y.limit - 1 ? 'warning' : 'info'}`}>{y.count}/{y.limit} Gelbe Karten · {y.label}</span>)}</>;
}

function PlayerReportRow({ report, motm }: { report: PlayerMatchReport; motm: boolean }) {
  return <details className={`career-rating-row ${motm ? 'motm' : ''}`}>
    <summary><span><strong>{name(report.playerId)}{motm && <em>★ Spieler des Spiels</em>}</strong><small>{report.minutes} Minuten · {report.goals} Tore · {report.assists} Vorlagen{report.substitute ? ' · Joker' : ''}</small></span><b className={report.rating >= 8 ? 'up' : report.rating < 6 ? 'down' : ''}>{report.rating.toFixed(1)} <span>⌄</span></b></summary>
    <div className="career-rating-details">{report.reasons.map((r,i) => <div key={i}><span>{r.label}</span><b>{r.value === 0 ? 'Hinweis' : signed(r.value)}</b></div>)}<p>Die Note zeigt die simulierte Leistung im Match. Form und Spezialkarte verändern die Spielstärke, nicht direkt diese Note.</p></div>
  </details>;
}
export function MatchRatingsPanel({ features }: { features: GameFeatures; minute?: number }) {
  if (features.cup.active) return null;
  const reports = [...features.career.reports].slice(-10).reverse();
  return <section className="career-section match-archive" aria-label="Matchbewertungen"><div className="career-heading"><div><p className="eyebrow">MATCHARCHIV</p><h4>Letzte 10 Spiele</h4></div><span>{reports.length} / 10</span></div>
    {!reports.length && <p className="career-empty">Nach dem ersten Abpfiff erscheinen hier deine Matchberichte.</p>}
    {reports.map(r=><details key={r.id} className="archive-match"><summary><span><strong>{r.opponent}</strong><small>{r.competition ?? (r.mode==='season'?'Saison':'Turnier')} · {new Date(r.createdAt).toLocaleDateString('de-CH')}{r.away === undefined ? '' : r.away ? ' · Auswärts' : ' · Heim'}</small></span><b>{r.homeScore}:{r.awayScore}{r.penaltyScore && <small> ({r.penaltyScore} i.E.)</small>}</b><span>{r.homeScore>r.awayScore?'Sieg':r.homeScore<r.awayScore?'Niederlage':r.penaltyScore?'i.E.':'Remis'} ⌄</span></summary>
    <div className="career-rating-list">{[...r.players].sort((a,b)=>b.rating-a.rating).map(p=><PlayerReportRow key={p.playerId} report={p} motm={r.motmId===p.playerId}/>)}</div>
    {r.startingIds && <p>Startelf: {r.startingIds.map(name).join(', ')}</p>}{r.benchIds && <p>Bank: {r.benchIds.map(name).join(', ')}</p>}
    {r.events?.length ? <ol className="archive-events">{r.events.map(e=><li key={e.id}>{e.minute}′ · {e.label}</li>)}</ol> : null}
    {r.opponentMotm&&<small>Spieler des Spiels: {r.opponentMotm.name} · {r.opponentMotm.rating.toFixed(1)} ({r.opponent})</small>}
    {r.tickets&&<small>Ticketeinnahmen: {r.tickets.attendance.toLocaleString('de-CH')} Zuschauer · +{formatNumber(r.tickets.income)} Tore</small>}
    {r.derbyReward>0&&<small>Derbyprämie: {r.derbyReward} Fragmente</small>}</details>)}
  </section>;
}
/** Appearances, goals and assists from the authoritative per-match career records. */
export function PlayerStatsSummary({ features, playerId, view, onView }: { features: GameFeatures; playerId: string; view: 'career' | 'season'; onView: (view: 'career' | 'season') => void }) {
  const stats = (view === 'season' ? features.career.seasonPlayers[playerId] : features.career.players[playerId]) ?? emptyPlayerStats();
  const cells: [string, number][] = [['Spiele', stats.appearances], ['Tore', stats.goals], ['Assists', stats.assists]];
  return <div className="player-stats-summary" aria-label="Spielerstatistik">
    <div className="player-stats-heading"><strong>Spielerstatistik</strong><div role="group" aria-label="Zeitraum">{([['career', 'Karriere'], ['season', `Saison ${features.career.seasonNumber}`]] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => onView(id)}>{label}</button>)}</div></div>
    <dl>{cells.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString('de-CH')}</dd></div>)}</dl>
    <small>{view === 'season' ? 'Ligaspiele der laufenden Saison.' : 'Alle erfassten Pflichtspiele: Liga und Turniere.'} Werte stammen aus den Matchberichten nach dem Abpfiff.</small>
  </div>;
}
/** Two cards side by side (Q43): rating, positions, form and career numbers; the better value is marked. */
export function PlayerCompare({ features, players }: { features: GameFeatures; players: readonly StarXIPlayer[] }) {
  const [first, setFirst] = useState(''), [second, setSecond] = useState('');
  const a = players.find((p) => p.id === first), b = players.find((p) => p.id === second);
  const rows = (player: StarXIPlayer) => { const stats = features.career.players[player.id] ?? emptyPlayerStats(); const form = getPlayerForm(features.career, player.id); return [
    ['OVR', getCareerCard(features.career, player).rating], ['Form', Math.round(form.average * 10) / 10], ['Spiele', stats.appearances], ['Tore', stats.goals], ['Vorlagen', stats.assists], ['Spieler des Spiels', stats.motm],
  ] as [string, number][]; };
  const left = a ? rows(a) : [], right = b ? rows(b) : [];
  const option = (p: StarXIPlayer) => <option key={p.id} value={p.id}>{p.name} · {getCareerCard(features.career, p).rating}{p.cardType === 'icon' ? ' · Icon' : p.isCustom ? ' · Spezial' : ''}</option>;
  return <section className="career-section player-compare" aria-label="Spieler vergleichen">
    <div className="career-heading"><div><p className="eyebrow">VERGLEICH / ZWEI KARTEN</p><h4>Wer passt besser?</h4></div></div>
    <div className="player-compare-pickers"><select aria-label="Erster Spieler" value={first} onChange={(e) => setFirst(e.target.value)}><option value="">Spieler wählen</option>{players.map(option)}</select><select aria-label="Zweiter Spieler" value={second} onChange={(e) => setSecond(e.target.value)}><option value="">Spieler wählen</option>{players.map(option)}</select></div>
    {a && b && <table className="player-compare-table"><thead><tr><th scope="col"></th><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead><tbody>
      <tr><th scope="row">Positionen</th><td>{getStarXIPositions(a).join(' / ')}</td><td>{getStarXIPositions(b).join(' / ')}</td></tr>
      {left.map(([label, value], index) => { const other = right[index][1]; return <tr key={label}><th scope="row">{label}</th><td className={value > other ? 'better' : undefined}>{value.toLocaleString('de-CH')}</td><td className={other > value ? 'better' : undefined}>{other.toLocaleString('de-CH')}</td></tr>; })}
    </tbody></table>}
  </section>;
}
function AwardCard({ label, winner, empty }: { label: string; winner: AwardWinner; empty: string }) { return <article className="career-award"><span>{label}</span><strong>{winner ? name(winner.playerId) : 'Kein Gewinner'}</strong><small>{winner?.value || empty}</small></article>; }
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
    <section className="career-section"><div className="career-heading"><div><p className="eyebrow">KARRIERE / SPIELERFORM</p><h3>Deine Spieler entwickeln Geschichte.</h3></div><span className="feature-stat">LETZTE 5 SPIELE</span></div><p className="career-note">Form entsteht aus den letzten fünf Einsätzen mit mindestens 15 Minuten und gibt maximal ±2 OVR. Sie verändert sich erst nach dem Abpfiff. Spezialkarten sind dauerhaft.</p><div className="career-toolbar"><input className="mode-input" aria-label="Spielerform suchen" placeholder="Spieler suchen …" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Karriere sortieren" value={sort} onChange={e=>changeSort(e.target.value)}>{[['name','Name A–Z'],['name-desc','Name Z–A'],['rating','Höchstes OVR'],['rating-asc','Tiefstes OVR'],['form','Beste Form'],['form-asc','Schlechteste Form'],['average','Beste Durchschnittsnote'],['appearances','Meiste Einsätze'],['goals','Meiste Tore'],['assists','Meiste Vorlagen'],['motm','Meiste Spieler des Spiels']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><details className="career-filters"><summary>Filter · {visible.length} Spieler</summary><div>
    <select aria-label="Position filtern" value={position} onChange={e=>setPosition(e.target.value)}><option value="all">Alle Positionen</option>{STAR_POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select>
    <select aria-label="Positionsart" value={positionMode} onChange={e=>setPositionMode(e.target.value)}><option value="any">Haupt- und Nebenposition</option><option value="primary">Hauptposition</option><option value="secondary">Nebenposition</option></select>
    <input type="number" min="0" max="100" aria-label="Minimales Rating" placeholder="OVR von" value={minRating} onChange={e=>setMinRating(e.target.value)}/><input type="number" min="0" max="100" aria-label="Maximales Rating" placeholder="OVR bis" value={maxRating} onChange={e=>setMaxRating(e.target.value)}/>
    <select aria-label="Kaderbereich" value={squad} onChange={e=>setSquad(e.target.value)}>{[['all','Ganzer Club'],['xi','Startelf'],['bench','Bank'],['reserve','Reserven']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
    <select aria-label="Verfügbarkeit" value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">Alle Spieler</option><option value="available">Verfügbar</option><option value="unavailable">Nicht verfügbar</option></select>
    <select aria-label="Form filtern" value={form} onChange={e=>setForm(e.target.value)}><option value="all">Jede Form</option><option value="good">Gute Form</option><option value="neutral">Neutrale Form</option><option value="poor">Schwache Form</option></select>
    <button type="button" onClick={()=>{setSearch('');changeSort('name');setPosition('all');setPositionMode('any');setSquad('all');setAvailability('all');setForm('all');setMinRating('');setMaxRating('');}}>Zurücksetzen</button></div></details></div><div className="career-form-list">{visible.length ? visible.map(p=>{ const f=getPlayerForm(features.career,p.id),s=features.career.players[p.id];return <button type="button" key={p.id} className={selectedPlayer?.id===p.id?'selected':''} onClick={()=>setPlayerId(p.id)}><span><strong>{p.name}</strong><small>{getStarXIPositions(p).join(' / ')} · {s?.appearances??0} Einsätze<CareerPlayerBadge features={features} player={p}/></small></span><span className="career-form-values"><b className={f.bonus>=.5?'up':f.bonus<=-.5?'down':''}>{signed(f.bonus)} OVR</b><small>{f.matches?`Ø ${f.average.toFixed(2)}`:'Noch keine Form'}</small></span></button>}) : <p className="career-empty">Keine passenden Spieler. Neue Karten findest du in den Packs.</p>}</div></section>
    <PlayerCompare features={features} players={players} />
    <section className="career-section"><div className="career-heading"><div><p className="eyebrow">MEILENSTEINE / SPEZIALKARTEN</p><h4>{selectedPlayer?.name ?? 'Deine nächste Clublegende.'}</h4></div>{selectedPlayer&&<select aria-label="Meilensteinspieler wählen" value={selectedPlayer.id} onChange={e=>setPlayerId(e.target.value)}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div>{selectedPlayer&&<PlayerStatsSummary features={features} playerId={selectedPlayer.id} view={statsView} onView={setStatsView}/>}<p className="career-note">Die stärkste freigeschaltete Version wird automatisch eingesetzt. Boni werden nicht addiert, OVR bleibt maximal 100. Du behältst deine Basis- und Meilensteinkarten auch nach einem Verkauf im Album.</p><div className="career-milestone-grid">{(selectedPlayer ? getPlayerMilestones(features.career, selectedPlayer) : []).map(m=>{const unlocked=selectedPlayer&&(features.career.milestoneCards[selectedPlayer.id]??[]).includes(m.id),progress=Math.min(m.target,stats[m.metric]);return <article key={m.id} className={`career-milestone-card ${unlocked?'unlocked':''}`} style={{'--career-accent':m.accent} as CSSProperties}><span>{unlocked?'★ FREIGESCHALTET':'MEILENSTEIN'}</span><strong>{m.label}</strong><b>{selectedPlayer?Math.min(100,selectedPlayer.rating+m.bonus):`+${m.bonus}`} <small>OVR</small></b><small>{m.target} {MILESTONE_METRIC_LABELS[m.metric]}</small><progress max={m.target} value={progress}/><small>{progress} / {m.target}{unlocked?' · im Album':` · Noch ${m.target-progress} ${MILESTONE_METRIC_LABELS[m.metric]}`}</small></article>})}</div></section>
    <section className="career-section"><div className="career-heading"><div><p className="eyebrow">SAISONABSCHLUSS / AUSZEICHNUNGEN</p><h4>{award?`Saison ${award.seasonNumber} · Liga ${leagueForTier(award.division)}`:'Die Bühne wartet auf ihre Stars.'}</h4></div>{awards.length>0&&<select aria-label="Saisonauszeichnungen wählen" value={award?.id} onChange={e=>setAwardId(e.target.value)}>{awards.map(a=><option key={a.id} value={a.id}>Saison {a.seasonNumber} · Liga {leagueForTier(a.division)}</option>)}</select>}</div>{award?<><p className="career-note">Aus {award.matchesTracked} erfassten Ligaspielen. Bester Spieler und Enttäuschung: mindestens 3 Einsätze und 90 Minuten. Joker: mindestens 2 Einwechslungen und 30 Minuten.</p><div className="career-award-grid"><AwardCard label="★ Bester Spieler" winner={award.best} empty="Zu wenige bewertete Einsätze."/><AwardCard label="⚽ Torschützenkönig" winner={award.scorer} empty="Keine Tore in dieser Saison."/><AwardCard label="↗ Bester Joker" winner={award.joker} empty="Zu wenige Einwechslungen."/><AwardCard label="↓ Grösste Enttäuschung" winner={award.disappointment} empty="Kein qualifizierter Spieler unter Note 6.5."/></div></>:<p className="career-empty">Die vier Auszeichnungen erscheinen nach dem letzten Ligaspiel. Aktuell sind {features.career.seasonMatches} Spiele dieser Saison erfasst. Frühere Leistungen werden nicht nachträglich erfunden.</p>}</section>
    <section className="career-section"><div className="career-heading"><div><p className="eyebrow">RIVALITÄTEN / DIREKTE BILANZ</p><h4>Manche Gegner vergisst die Kurve nie.</h4></div><span className="feature-stat">{rivals.filter(r=>r.active).length} RIVALEN</span></div><p className="career-note">Eine Rivalität entsteht nach drei Duellen mit mindestens zwei knappen Spielen oder nach fünf Duellen. Ab dem nächsten Derby: 400 Fragmente für einen Sieg, 150 für ein Remis.</p><div className="career-rival-list">{rivals.length?rivals.map(r=><article key={r.opponent} className={r.active?'active':''}><div><span>{r.active?'🔥 RIVALE':'BEGEGNUNGEN'}</span><strong>{r.opponent}</strong><small>{r.played} Duelle · {r.goalsFor}:{r.goalsAgainst} Tore</small></div><div className="career-rival-record"><b>{r.wins} S · {r.draws} U · {r.losses} N</b><small>{r.lastResults.join(' · ')}</small></div></article>):<p className="career-empty">Deine ersten Duelle eröffnen die direkte Bilanz.</p>}</div></section>
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
  return <div className="career-panel"><section className="career-section"><div className="career-heading"><div><p className="eyebrow">SAMMELALBUM / JEDE KARTE ZÄHLT</p><h3>{collected.size.toLocaleString('de-CH')} / {albumPlayers.length.toLocaleString('de-CH')} Karten</h3></div><span className="feature-stat">{milestoneCount} MEILENSTEINKARTEN</span></div><progress className="career-album-progress" max={albumPlayers.length} value={collected.size}/><p className="career-note">Einmal gesammelt, immer im Album. Verkäufe und Leihen entfernen keine Karte. Bestehende Karten und belegte frühere Einsätze werden übernommen.</p><div className="career-album-filters"><input className="mode-input" aria-label="Sammelalbum durchsuchen" placeholder="Name oder Position suchen …" value={search} onChange={e=>change(setSearch,e.target.value)}/><select aria-label="Album Nation" value={nation} onChange={e=>change(setNation,e.target.value)}><option value="all">Alle Nationen</option>{nations.map(n=><option key={n} value={n}>{nationName(n)}</option>)}</select><select aria-label="Album Kartentyp" value={type} onChange={e=>change(setType,e.target.value)}><option value="all">Alle Kartentypen</option><option value="base">Basis</option><option value="icon">Icons</option><option value="legendary">Legendär</option><option value="custom">Custom</option><option value="milestones">Meilensteine</option></select><select aria-label="Album Besitz" value={ownership} onChange={e=>change(setOwnership,e.target.value)}><option value="all">Alle Karten</option><option value="collected">Gesammelt</option><option value="missing">Fehlend</option></select><select aria-label="Album Rating" value={rating} onChange={e=>change(setRating,e.target.value)}><option value="all">Alle Ratings</option><option value="max70">bis 70 OVR</option><option value="71-79">71 bis 79 OVR</option>{[80,85,90,95,100].map(r=><option key={r} value={r}>{r}+ OVR</option>)}</select><select aria-label="Album sortieren" value={sort} onChange={e=>change(setSort,e.target.value)}><option value="ovr">Nach OVR</option><option value="name">Nach Name</option><option value="nation">Nach Nation</option></select><label className="career-album-switch"><input type="checkbox" role="switch" checked={showMilestones} onChange={e=>onShowMilestones(e.target.checked)}/><span><strong>Meilensteinboni</strong><small>{showMilestones?'Ratings mit Bonus':'Originalratings'}</small></span></label></div>{groupView&&<p className="album-group-view">Fehlende Karten: <strong>{groupView.startsWith('nation-')?nationName(groupView.slice(7)):groups.find(g=>g.id===groupView)?.label}</strong> <button type="button" className="mode-secondary" onClick={()=>{setGroupView('');setPage(0);}}>Alle Karten zeigen</button></p>}<div className="career-album-grid">{filtered.slice(safePage*48,(safePage+1)*48).map(p=>{const owned=collected.has(p.id),card=getCareerCard(features.career,p),milestone=showMilestones?card.milestone:undefined;return <article className={`career-album-card ${owned?'collected':'missing'} ${milestone?'milestone':''}`} key={p.id} style={{'--career-accent':milestone?.accent??p.accent} as CSSProperties}><span>{owned?'✓ GESAMMELT':'○ FEHLT'} · {p.isCustom?'CUSTOM':(p.cardType??'base').toUpperCase()}{p.retired?' · NICHT IN FC 27':''}</span><b>{milestone?card.rating:p.rating}</b><strong>{p.name}</strong><small>{getStarXIPositions(p).join(' / ')} · {p.countryCode? nationName(p.countryCode):'International'}</small>{milestone&&<em>★ {milestone.label}</em>}<small>{owned?(features.starXI.ownedIds.includes(p.id)?'Im Kader':'Nicht im Kader'):'Über Packs oder Spezialkarten-Zug erhältlich'}</small>{features.career.milestoneCards[p.id]?.length>0&&<small>{features.career.milestoneCards[p.id].map(id=>CAREER_MILESTONES.find(m=>m.id===id)?.label).join(' · ')}</small>}</article>})}</div>{!filtered.length&&<p className="career-empty">Keine Karten für diese Filter gefunden.</p>}<div className="career-pagination"><button type="button" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>Zurück</button><span>{filtered.length.toLocaleString('de-CH')} Treffer · Seite {safePage+1} / {totalPages}</span><button type="button" disabled={safePage>=totalPages-1} onClick={()=>setPage(safePage+1)}>Weiter</button></div></section><section className="career-section"><div className="career-heading"><div><p className="eyebrow">VOLLSTÄNDIGE SAMMLUNGEN / PRÄMIEN</p><h4>Jede volle Seite wird belohnt.</h4></div><span className="feature-stat">{features.starXI.fragments.toLocaleString('de-CH')} FRAGMENTE</span></div><button type="button" className="feature-buy-button" disabled={busy||availableGroups.length===0} onClick={()=>onClaim("all")}>{busy?"Wird abgeholt …":`Alle abholen (${availableGroups.length})`}</button><p className="career-note">{availableReward.toLocaleString('de-CH')} Fragmente{availableSeconds>0?` und ${formatIncomeDuration(availableSeconds)} Einkommen in Toren`:''} aus allen verfügbaren Sammlungen, unabhängig von den Filtern.</p><div className="career-album-rewards">{shownGroups.slice(0,groupCount).map(g=><article key={g.id}><div><strong>{g.id.startsWith('nation-')?nationName(g.id.slice(7)):g.label}{g.id.startsWith('nation-')&&nationGroupScope(g.id.slice(7))?`: ${nationGroupScope(g.id.slice(7))}`:''}</strong><small>{g.collected} / {g.total} Karten · {g.reward.toLocaleString('de-CH')} Fragmente · {formatIncomeDuration(g.rewardSeconds)} Einkommen</small><progress max={g.total} value={g.collected}/>{!g.id.startsWith('collect-')&&g.collected<g.total&&<button type="button" className="album-missing-link" onClick={()=>{setGroupView(g.id);setOwnership('all');setPage(0);document.querySelector('.career-album-grid')?.scrollIntoView({behavior:'smooth',block:'start'});}}>{g.total-g.collected} fehlende zeigen</button>}</div><button type="button" className="feature-buy-button" disabled={busy||g.claimed||g.collected<g.total} onClick={()=>onClaim(g.id)}>{g.claimed?'Abgeholt':g.collected===g.total?'Prämie abholen':'Noch offen'}</button></article>)}</div>{shownGroups.length>groupCount&&<button type="button" className="mode-secondary" onClick={()=>setGroupCount(n=>n+20)}>Weitere Sammlungen anzeigen</button>}</section></div>;
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
  return <section className="post-match-summary" aria-label="Matchabschluss"><p className="eyebrow">ABPFIFF · {report?.competition??(c.mode==='season'?'SAISON':'TURNIER')}</p><div className="summary-score"><strong>{away?opponent:features.club.name}</strong><b>{away?opponentScore:clubScore} : {away?clubScore:opponentScore}</b><strong>{away?features.club.name:opponent}</strong></div>
  <p>{c.lastResult}{c.penaltyEvents.length>0&&` · Elfmeterschiessen ${c.penaltyHomeScore}:${c.penaltyAwayScore}`}</p>
  {(c.simulation||c.interactiveResult)&&<div className="summary-match-stats"><span>Schüsse: {c.broadcast?.clubStats.shots??0} : {c.broadcast?.opponentStats.shots??0}</span><span>Aufs Tor: {c.broadcast?.clubStats.onTarget??0} : {c.broadcast?.opponentStats.onTarget??0}</span></div>}
  {report?.opponentMotm?<p className="summary-motm">Spieler des Spiels: <strong>{report.opponentMotm.name}</strong> · {report.opponentMotm.rating.toFixed(1)} ({opponent})</p>:report?.motmId?<p className="summary-motm">Spieler des Spiels: <strong>{name(report.motmId)}</strong> · {report.players.find(p=>p.playerId===report.motmId)?.rating.toFixed(1)}</p>:null}
  {report?.tickets&&<p className="summary-tickets">🎟️ {report.tickets.attendance.toLocaleString('de-CH')} Zuschauer · Ticketeinnahmen +{formatNumber(report.tickets.income)} Tore</p>}
  {c.matchEvents.length>0&&<div className="summary-goals">{c.matchEvents.map(e=><span key={e.id}>{goalLabel(e)}</span>)}</div>}
  <div className="summary-performances">{top.map(p=><span key={p.playerId}><strong>{name(p.playerId)}{report?.motmId===p.playerId?' ★':''}</strong><b>{p.rating.toFixed(1)}</b><small>{p.goals} Tore · {p.assists} Vorlagen</small></span>)}</div>
  {report?.events?.length ? <details><summary>Tore und wichtige Ereignisse</summary><ol className="archive-events">{report.events.map(e=><li key={e.id}>{e.minute}′ · {e.label}</li>)}</ol></details> : null}
  {rewards.length>0&&<details><summary>Prämien und Karrierefortschritt</summary>{rewards.map(e=><p key={e.id}><strong>{e.title}</strong> · {e.detail}</p>)}</details>}
  <div className="summary-actions">{next&&<button className="mode-primary" disabled={next.disabled} onClick={next.onClick}>{next.label}</button>}<button className={next?"mode-secondary":"mode-primary"} onClick={onContinue}>Weiter zum Kader</button><button className="mode-secondary" onClick={onCareer}>Matchbericht</button></div></section>;
}

const dateLabel = (at: number) => at ? new Date(at).toLocaleDateString('de-CH') : 'ohne Datum';
const runLabel = (prestige: number | null) => prestige === null ? '' : `Lauf ${prestige + 1}`;
const SEASON_OUTCOME_LABELS: Record<string, string> = { promoted: 'Aufstieg', relegated: 'Abstieg', stayed: 'Klassenerhalt', 'hall-of-fame': 'Hall of Fame' };
type AllTimeSort = 'name' | 'appearances' | 'minutes' | 'goals' | 'assists' | 'average' | 'motm' | 'points';
const ALL_TIME_COLUMNS: { id: Exclude<AllTimeSort, 'name'>; label: string; short: string }[] = [
  { id: 'appearances', label: 'Einsätze', short: 'Sp.' }, { id: 'minutes', label: 'Minuten', short: 'Min.' }, { id: 'goals', label: 'Tore', short: 'Tore' },
  { id: 'assists', label: 'Vorlagen', short: 'Vorl.' }, { id: 'average', label: 'Durchschnittsnote', short: 'Ø' }, { id: 'motm', label: 'Spieler des Spiels', short: 'SdS' }, { id: 'points', label: 'Punkte', short: 'Pkt.' },
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
  return <section className="career-section" aria-label="Ewige Spielertabelle"><div className="career-heading"><div><p className="eyebrow">EWIGE SPIELERTABELLE</p><h4>Alle, die je für den Club gespielt haben.</h4></div><span className="feature-stat">{rows.length} SPIELER</span></div>
    <p className="career-note">Alle erfassten Pflichtspiele aus Liga und Turnieren, über jedes Prestige hinweg. Tippe auf eine Spalte, um zu sortieren.</p>
    <label className="chronicle-toggle"><input type="checkbox" checked={squadOnly} onChange={(e) => setSquadOnly(e.target.checked)} /> Nur aktueller Kader</label>
    {visible.length ? <div className="chronicle-table-wrap"><table className="chronicle-table all-time-table"><thead><tr><th scope="col">#</th>{header('name', 'Spieler', 'Nach Name sortieren')}{ALL_TIME_COLUMNS.map((c) => header(c.id, c.short, `Nach ${c.label} sortieren`))}</tr></thead>
      <tbody>{visible.slice(0, shown).map((row, index) => <tr key={row.id} className={owned.has(row.id) ? 'in-squad' : ''}><td>{index + 1}</td><th scope="row"><span>{row.player.name}</span><small>{getStarXIPositions(row.player).join(' / ') || 'Bank'}{owned.has(row.id) ? ' · im Kader' : ''}</small></th><td>{row.stats.appearances}</td><td>{Math.round(row.stats.minutes).toLocaleString('de-CH')}</td><td>{row.stats.goals}</td><td>{row.stats.assists}</td><td>{row.average ? row.average.toFixed(2) : ''}</td><td>{row.stats.motm}</td><td>{row.stats.points}</td></tr>)}</tbody></table></div>
      : <p className="career-empty">Nach dem ersten Pflichtspiel stehen hier alle Einsätze deiner Spieler.</p>}
    {visible.length > shown && <button type="button" className="mode-secondary chronicle-more" onClick={() => setShown(shown + ALL_TIME_PAGE)}>Weitere {Math.min(ALL_TIME_PAGE, visible.length - shown)} Spieler zeigen</button>}
  </section>;
}

function RecordCard({ label, record, value, empty }: { label: string; record: ChronicleMatchRecord | null; value: (r: ChronicleMatchRecord) => string; empty: string }) {
  return <article className="career-award"><span>{label}</span><strong>{record ? value(record) : 'Noch offen'}</strong><small>{record ? `gegen ${record.opponent} · ${record.competition ? `${record.competition} · ` : ''}${dateLabel(record.at)}` : empty}</small></article>;
}

/** Club chronicle: totals, records, titles with dates, one row per finished season and the final Hall of Fame tables. */
export function ClubChroniclePanel({ features }: { features: GameFeatures }) {
  const { totals, records, seasons, titles, hallOfFame } = features.chronicle;
  const archive = [...seasons].reverse();
  const datedTournamentTitles = (id: string) => titles.filter((t) => t.kind === 'tournament' && t.tournamentId === id).length;
  const undatedTitles = TOURNAMENTS.map((t) => ({ label: t.trophyName, count: Math.max(0, (features.cup.trophies[t.id] ?? 0) - datedTournamentTitles(t.id)) })).filter((t) => t.count > 0);
  const totalCells: [string, string][] = [['Siege', totals.wins.toLocaleString('de-CH')], ['Remis', totals.draws.toLocaleString('de-CH')], ['Niederlagen', totals.losses.toLocaleString('de-CH')], ['Tore', `${totals.goalsFor}:${totals.goalsAgainst}`], ['Zu Null', totals.cleanSheets.toLocaleString('de-CH')], ['Derbysiege', totals.derbyWins.toLocaleString('de-CH')]];
  return <div className="career-panel">
    <section className="career-section" aria-label="Clubbilanz"><div className="career-heading"><div><p className="eyebrow">CLUBCHRONIK / BILANZ</p><h3>Die Geschichte von {features.club.name}.</h3></div><span className="feature-stat">{totals.matches} PFLICHTSPIELE</span></div>
      <p className="career-note">Die Bilanz zählt ab dem Update vom 6. November 2026. Rekorde aus den letzten Matchberichten und frühere Saisonauszeichnungen wurden übernommen.</p>
      <dl className="chronicle-totals">{totalCells.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    <section className="career-section" aria-label="Clubrekorde"><div className="career-heading"><div><p className="eyebrow">REKORDHALLE</p><h4>Die Bestmarken des Clubs.</h4></div></div>
      <div className="career-award-grid chronicle-records">
        <RecordCard label="Höchster Sieg" record={records.biggestWin} value={(r) => r.score} empty="Der erste Sieg setzt die Marke." />
        <RecordCard label="Meiste Tore in einem Spiel" record={records.mostGoals} value={(r) => `${r.value} ${r.value === 1 ? 'Tor' : 'Tore'} (${r.score})`} empty="Das erste Tor setzt die Marke." />
        <RecordCard label="Zuschauerrekord" record={records.recordCrowd} value={(r) => `${r.value.toLocaleString('de-CH')} Zuschauer`} empty="Zählt bei Heimspielen in der Liga." />
        <article className="career-award"><span>Serien</span><strong>{records.unbeaten.best} {records.unbeaten.best === 1 ? 'Spiel' : 'Spiele'} ungeschlagen</strong><small>Aktuell {records.unbeaten.current} ungeschlagen · längste Siegesserie {records.winning.best}, aktuell {records.winning.current}{records.unbeaten.bestAt ? ` · Rekord vom ${dateLabel(records.unbeaten.bestAt)}` : ''}</small></article>
      </div>
    </section>
    <section className="career-section" aria-label="Titel"><div className="career-heading"><div><p className="eyebrow">TITEL / MIT DATUM</p><h4>Jeder Pokal, jede Meisterschaft.</h4></div><span className="feature-stat">{titles.length + undatedTitles.reduce((n, t) => n + t.count, 0)} TITEL</span></div>
      {titles.length ? <ol className="chronicle-titles">{[...titles].reverse().map((t) => <li key={t.id}><span aria-hidden="true">{t.kind === 'hall-of-fame' ? '🏛️' : t.kind === 'league' ? '🏆' : '🥇'}</span><strong>{t.label}</strong><small>{dateLabel(t.at)} · {runLabel(t.prestige)}</small></li>)}</ol> : <p className="career-empty">Der erste Titel bekommt hier seinen Platz mit Datum.</p>}
      {undatedTitles.length > 0 && <p className="career-note">Frühere Turniersiege ohne Datum: {undatedTitles.map((t) => `${t.count}× ${t.label}`).join(', ')}.</p>}
    </section>
    <section className="career-section" aria-label="Saisonarchiv"><div className="career-heading"><div><p className="eyebrow">SAISONARCHIV</p><h4>Jede abgeschlossene Saison.</h4></div><span className="feature-stat">{seasons.length} SAISONS</span></div>
      {archive.length ? <div className="chronicle-table-wrap"><table className="chronicle-table"><thead><tr><th scope="col">Saison</th><th scope="col">Liga</th><th scope="col">Platz</th><th scope="col">Pkt.</th><th scope="col">S / U / N</th><th scope="col">Tore</th><th scope="col">Torschützenkönig</th><th scope="col">Bester Spieler</th><th scope="col">Ausgang</th></tr></thead>
        <tbody>{archive.map((row) => <tr key={row.id}><th scope="row"><span>Saison {row.season}</span><small>{[runLabel(row.prestige), dateLabel(row.at)].filter(Boolean).join(' · ')}</small></th><td>{leagueForTier(row.division)}</td><td>{row.place ?? ''}</td><td>{row.points ?? ''}</td><td>{row.wins === null ? '' : `${row.wins} / ${row.draws} / ${row.losses}`}</td><td>{row.goalsFor === null ? '' : `${row.goalsFor}:${row.goalsAgainst}`}</td><td>{row.topScorer ? `${name(row.topScorer.playerId)} (${row.topScorer.goals})` : ''}</td><td>{row.bestPlayerId ? name(row.bestPlayerId) : ''}</td><td>{row.outcome ? SEASON_OUTCOME_LABELS[row.outcome] : ''}</td></tr>)}</tbody></table></div>
        : <p className="career-empty">Nach dem letzten Spieltag einer Saison steht sie hier mit Platz, Punkten und Torschützenkönig.</p>}
      {archive.some((row) => row.place === null) && <p className="career-note">Saisons vor der Chronik zeigen nur, was die Saisonauszeichnungen festgehalten haben.</p>}
    </section>
    <section className="career-section" aria-label="Hall of Fame Tabellen"><div className="career-heading"><div><p className="eyebrow">HALL OF FAME / SCHLUSSTABELLEN</p><h4>Die Meistertabelle jedes Laufs.</h4></div><span className="feature-stat">{hallOfFame.length} LÄUFE</span></div>
      {hallOfFame.length ? [...hallOfFame].reverse().map((table) => <details key={`${table.prestige}-${table.at}`} className="archive-match chronicle-hof"><summary><span><strong>{runLabel(table.prestige)}</strong><small>{dateLabel(table.at)}</small></span><b>{table.rows.find((r) => r.club)?.points ?? 0} Pkt.</b><span>⌄</span></summary>
        <div className="chronicle-table-wrap"><table className="chronicle-table"><thead><tr><th scope="col">#</th><th scope="col">Club</th><th scope="col">S / U / N</th><th scope="col">Tore</th><th scope="col">Pkt.</th></tr></thead><tbody>{table.rows.map((r, index) => <tr key={`${r.name}-${index}`} className={r.club ? 'in-squad' : ''}><td>{index + 1}</td><th scope="row">{r.name}</th><td>{r.wins} / {r.draws} / {r.losses}</td><td>{r.goalsFor}:{r.goalsAgainst}</td><td>{r.points}</td></tr>)}</tbody></table></div></details>)
        : <p className="career-empty">Wer die Weltliga als Meister abschliesst, findet hier die Schlusstabelle, für jeden Prestige Lauf.</p>}
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
    <div className="career-view-switch" role="group" aria-label="Karrierebereich">{([['players', 'Spieler und Form'], ['chronicle', 'Chronik und Rekorde']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => change(id)}>{label}</button>)}</div>
    {view === 'players' ? <><CareerPanel features={features} /><MatchRatingsPanel features={features} /></> : <ClubChroniclePanel features={features} />}
  </>;
}
