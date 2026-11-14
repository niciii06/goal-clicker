"use client";

// Home city choice (stadium Phase 1, app/home-cities.ts). One list of four cities as radio choices: each row names the
// city, its home ground and its first local league, the chosen one is marked with border, tint and "Gewählt" (never by
// colour alone), and every row is at least 44 pt high. The note below says when the city can change.
import { HOME_CITIES, HOME_CITY_IDS, homeCityOf } from "./home-cities";
import type { HomeCityId } from "./home-cities";
import { t } from "./i18n/runtime";

export function HomeCityPicker({ value, onChange, disabled = false, name = "home-city", legend = t("homeCity.label") }: { value: unknown; onChange: (city: HomeCityId) => void; disabled?: boolean; name?: string; legend?: string }) {
  const current = homeCityOf(value).id;
  return <fieldset className="home-city-choices" disabled={disabled}>
    <legend>{legend}</legend>
    {HOME_CITY_IDS.map((id) => {
      const city = HOME_CITIES[id];
      const selected = id === current;
      return <label key={id} className={selected ? "selected" : ""}>
        <input type="radio" name={name} value={id} checked={selected} onChange={() => onChange(id)} />
        <span><strong>{city.name}</strong><small>{city.homeVenue.stadium} · {city.leagueLabels[1]}</small></span>
        {selected && <em aria-hidden="true">{t("homeCity.chosen")}</em>}
      </label>;
    })}
  </fieldset>;
}

/**
 * The home city card before the first league match of a new game: the choice applies at once and can still be
 * changed until kick-off. `readOnly`: a co-op member who is not the host sees the choice of the world.
 */
export function HomeCityCard({ value, onChange, busy, readOnly }: { value: unknown; onChange: (city: HomeCityId) => void; busy: boolean; readOnly: boolean }) {
  return <section className="home-city-card" aria-labelledby="home-city-title">
    <p className="eyebrow">{t("homeCity.eyebrow")}</p>
    <h4 id="home-city-title">{t("homeCity.question")}</h4>
    <p>{t("homeCity.body")}</p>
    <HomeCityPicker value={value} onChange={onChange} disabled={busy || readOnly} />
    {readOnly && <small className="home-city-note">{t("homeCity.hostChooses")}</small>}
  </section>;
}
