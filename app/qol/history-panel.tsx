"use client";
// The «Verlauf» tab (Q62, Q69), moved out of game-app.tsx (Notion: Monolithische UI schrittweise modularisieren,
// step 1). The panel keeps its own topic and member filter, so changing a filter renders this list, not the whole
// game screen. Topic labels and entries follow the chosen language; a member's name appears once (historyLine).
import { memo, useMemo, useState } from "react";
import type { MatchHistoryEntry } from "../feature-data";
import { formatHistoryTime } from "../game/format";
import { Icon } from "../game/ui";
import { localizeText, t } from "../i18n/runtime";
import { HISTORY_TOPICS, filterHistory, historyActors, historyLine } from "./history-filter";
import type { HistoryTopic } from "./history-filter";

export const HistoryPanel = memo(function HistoryPanel({ history }: { history: readonly MatchHistoryEntry[] }) {
  const [topic, setTopic] = useState<HistoryTopic>("all");
  const [actor, setActor] = useState("");
  const all = useMemo(() => [...history].reverse(), [history]);
  const actors = useMemo(() => historyActors(all), [all]);
  const entries = useMemo(() => filterHistory(all, topic, actors.includes(actor) ? actor : ""), [all, topic, actor, actors]);
  return <div className="feature-panel">
    <div className="feature-panel-heading"><div><p className="eyebrow">{t("club.matchCenterEyebrow")}</p><h3>{t("club.whatHappens")}</h3></div><span className="feature-stat">{entries.length} {t("club.entries")}</span></div>
    <div className="history-filters">
      <div className="starxi-filter-row" role="group" aria-label={t("club.historyFilter")}>{HISTORY_TOPICS.map((item) => <button type="button" key={item.id} className={topic === item.id ? "active" : ""} aria-pressed={topic === item.id} onClick={() => setTopic(item.id)}>{localizeText(item.label)}</button>)}</div>
      {actors.length > 0 && <select className="starxi-position-filter" value={actor} onChange={(event) => setActor(event.target.value)} aria-label={t("club.historyByPlayer")}><option value="">{t("club.allTeammates")}</option>{actors.map((name) => <option key={name} value={name}>{name}</option>)}</select>}
    </div>
    <div className="history-list">{entries.length ? entries.map((entry) => <div className={`history-row ${entry.tone}`} key={entry.id}>
      <span><Icon name={entry.tone === "negative" ? "screen" : entry.title.includes("Pokal") ? "crown" : "star"} size={15} /></span>
      <div><strong>{localizeText(entry.title)}</strong><small>{historyLine(entry.actor, localizeText(entry.detail))}</small></div>
      <em>{formatHistoryTime(entry.timestamp)}</em>
    </div>) : <div className="feature-empty"><Icon name="broadcast" size={25} /><p>{t("club.noEntries")}</p></div>}</div>
  </div>;
});
