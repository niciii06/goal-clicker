import type { CupState } from './feature-data';

export type PressContext = 'sieg' | 'hoher-sieg' | 'remis' | 'niederlage' | 'hohe-niederlage' | 'zu-null' | 'elfmeter' | 'turnier' | 'saison' | 'auswaerts' | 'heim' | 'torschuetze' | 'any';
export type PressAnswer = { text: string; mood: number };
export type PressQuestion = { id: string; contexts: PressContext[]; text: string; answers: [PressAnswer, PressAnswer, PressAnswer] };
export type PressState = { fanMood: number; answered: string[]; recentQuestions: string[]; last?: { matchId: string; questionId: string; answer: string; mood: number; at: number } };
export type PressConference = { matchId: string; question: PressQuestion; text: string; answers: { index: number; text: string; mood: number }[] };

export const DEFAULT_FAN_MOOD = 60;
const RECENT_LIMIT = 24;

const q = (id: string, contexts: PressContext[], text: string, a: [string, number], b: [string, number], c: [string, number]): PressQuestion => ({ id, contexts, text, answers: [{ text: a[0], mood: a[1] }, { text: b[0], mood: b[1] }, { text: c[0], mood: c[1] }] });

/** Each question has its own three answers. Placeholders: {gegner}, {club}, {torschuetze}, {resultat}. */
export const PRESS_QUESTIONS: readonly PressQuestion[] = [
  q('sieg-1', ['sieg'], 'Ein verdienter Sieg gegen {gegner}. Was war heute der Schlüssel?', ['Die Mannschaft hat 90 Minuten füreinander gearbeitet.', 6], ['Ehrlich gesagt hätten wir noch höher gewinnen müssen.', 4], ['Der Platzwart hat den Rasen perfekt gemäht. Danke, Heinz!', 3]),
  q('sieg-2', ['sieg'], '{resultat} gegen {gegner}. Wie fühlt sich das an?', ['Wie ein Freitagabend mit Pizza und Fussball.', 5], ['Normal. Wir erwarten das von uns.', 2], ['Ich gehe jetzt zuerst einmal duschen und dann feiern.', 4]),
  q('sieg-3', ['sieg'], 'Die Fans haben die ganze Partie gesungen. Hat das geholfen?', ['Unsere Fans sind der zwölfte Mann. Heute waren sie sogar der dreizehnte.', 9], ['Wir hätten auch im leeren Stadion gewonnen.', -6], ['Ich habe den Text von Lied Nummer vier immer noch nicht gelernt.', 5]),
  q('sieg-4', ['sieg'], 'Viele hatten {gegner} heute stärker eingeschätzt. Überrascht?', ['Nein. Wir wissen, was in dieser Kabine steckt.', 6], ['Ein bisschen. Ich hatte vorsichtshalber schon eine Ausrede vorbereitet.', 3], ['Wer hat {gegner} stärker eingeschätzt? Namen bitte.', 2]),
  q('sieg-5', ['sieg'], 'Drei Punkte oder Weiterkommen, egal wie. Hauptsache gewonnen?', ['Genau. Schön spielen können wir im Training.', 3], ['Nein, wir wollen auch begeistern. Heute war das nur halb gut.', 4], ['Ich nehme lieber hässliche Siege als schöne Niederlagen.', 5]),
  q('sieg-6', ['sieg'], 'Was sagen Sie den Kritikern, die Ihnen den Sieg nicht zugetraut haben?', ['Nichts. Die Tabelle spricht für uns.', 4], ['Die sind herzlich zum nächsten Heimspiel eingeladen.', 7], ['Danke für die Motivation. Ich habe die Artikel in die Kabine gehängt.', 5]),
  q('sieg-7', ['sieg', 'heim'], 'Das Heimstadion an der Bümplizstrasse war heute eine Festung. Woran liegt das?', ['An den Fans, die uns nach vorne peitschen.', 8], ['An der Bratwurst. Die gibt Kraft.', 5], ['An den kurzen Wegen in die Kabine.', 2]),
  q('sieg-8', ['sieg', 'auswaerts'], 'Ein Auswärtssieg in {gegner}s Stadion. Wie war die Reise?', ['Lang, aber jede Minute hat sich gelohnt.', 6], ['Der Bus hatte kein WLAN. Das hat uns fokussiert.', 4], ['Wir fahren gerne wieder hin. Die Gastgeber vermutlich weniger gerne.', 5]),
  q('hoch-1', ['hoher-sieg'], '{resultat}. War das die beste Leistung der Saison?', ['Sehr nahe dran. Aber wir können noch mehr.', 6], ['Die Konkurrenz soll das ruhig gesehen haben.', 5], ['Ich musste nach dem dritten Tor aufhören zu zählen.', 4]),
  q('hoch-2', ['hoher-sieg'], 'Hatten Sie nach dem klaren Vorsprung Mitleid mit {gegner}?', ['Respekt ja, Mitleid nein. Das ist Profifussball.', 3], ['Ein bisschen. Deshalb haben wir am Schluss etwas Gas rausgenommen.', 5], ['Mitleid gibt es nach dem Spiel bei einem Getränk.', 4]),
  q('hoch-3', ['hoher-sieg'], 'So viele Tore. Haben Sie das im Training geübt?', ['Jeden Tag. Abschluss, Abschluss, Abschluss.', 5], ['Nein, das war pure Improvisation.', 3], ['Wir haben im Training nur Schach gespielt. Offenbar hilft das.', 6]),
  q('hoch-4', ['hoher-sieg'], 'Nach so einem Kantersieg: Wird das Team nicht übermütig?', ['Nein. Am Montag beginnt alles wieder bei null.', 4], ['Ein bisschen Übermut schadet nie.', 2], ['Ich habe vorsichtshalber alle Spiegel aus der Kabine entfernt.', 6]),
  q('remis-1', ['remis'], '{resultat} gegen {gegner}. Ein Punkt gewonnen oder zwei verloren?', ['Ein Punkt gewonnen. Wir nehmen ihn mit.', 2], ['Zwei verloren. Das ärgert mich sehr.', 4], ['Ein halber Sieg und eine halbe Niederlage. Mathematisch perfekt.', 3]),
  q('remis-2', ['remis'], 'Am Schluss fehlte der Lucky Punch. Was hat gefehlt?', ['Ein bisschen Glück und ein bisschen Präzision.', 3], ['Ein Stürmer, der auch einmal das Tor trifft.', -3], ['Vielleicht einfach noch fünf Minuten Nachspielzeit.', 2]),
  q('remis-3', ['remis'], 'Ein Unentschieden mit vielen Chancen. Sind Sie zufrieden?', ['Mit der Leistung ja, mit dem Resultat nein.', 4], ['Zufrieden bin ich erst mit drei Punkten.', 3], ['Ich bin zufrieden, dass niemand verletzt ist.', 2]),
  q('remis-4', ['remis'], 'War das Remis gerecht?', ['Ja, es war ein Spiel auf Augenhöhe.', 2], ['Nein, wir waren klar besser.', 3], ['Gerecht ist im Fussball nur der Pausentee.', 3]),
  q('niederlage-1', ['niederlage'], '{resultat} gegen {gegner}. Was ist schiefgelaufen?', ['Wir waren heute nicht gut genug. Das nehme ich auf meine Kappe.', 5], ['Der Schiedsrichter hatte keinen guten Tag.', -4], ['Wir haben nur den Zuschauern Spannung bieten wollen.', -2]),
  q('niederlage-2', ['niederlage'], 'Die Fans haben nach dem Abpfiff gepfiffen. Verstehen Sie das?', ['Absolut. Sie haben mehr verdient. Wir kommen zurück.', 8], ['Nein. Wir haben alles gegeben.', -6], ['Ich habe es als Applaus in einer anderen Tonart verstanden.', -1]),
  q('niederlage-3', ['niederlage'], 'Wie wollen Sie das Team nach dieser Niederlage wieder aufrichten?', ['Mit harter Arbeit und viel Vertrauen.', 5], ['Mit einer sehr langen Videoanalyse.', 2], ['Mit Gipfeli. Gipfeli helfen immer.', 4]),
  q('niederlage-4', ['niederlage'], 'Ist die Niederlage gegen {gegner} ein Rückschlag?', ['Ein kleiner. Wir lernen daraus.', 4], ['Nein. Ein schlechter Tag passiert jedem.', 1], ['Ich nenne es lieber einen Anlauf für den nächsten Sprung.', 3]),
  q('niederlage-5', ['niederlage', 'heim'], 'Zuhause gegen {gegner} verloren. Was sagen Sie den Fans an der Bümplizstrasse?', ['Entschuldigung. Das nächste Heimspiel gehört euch.', 9], ['Kommt trotzdem wieder. Die Bratwurst bleibt gut.', 4], ['Wir haben heute Gastfreundschaft geübt.', -5]),
  q('niederlage-6', ['niederlage', 'auswaerts'], 'Weite Reise, keine Punkte. Hat die Fahrt Kraft gekostet?', ['Das darf keine Ausrede sein.', 5], ['Ja. Die Beine waren schwer wie Fondue.', 1], ['Auf der Rückfahrt gibt es keine Musik im Bus. Strafe muss sein.', 3]),
  q('tief-1', ['hohe-niederlage'], '{resultat}. Gibt es dafür eine Erklärung?', ['Nein. Das war nicht unser Niveau, Punkt.', 6], ['Wir hatten heute einfach keinen Zugriff auf das Spiel.', 2], ['Ich glaube, wir haben auf das falsche Tor gespielt.', -2]),
  q('tief-2', ['hohe-niederlage'], 'Nach so einer klaren Niederlage: Wackelt Ihr Stuhl?', ['Nein, der Stuhl steht stabil. Ich habe ihn gestern festgeschraubt.', 3], ['Darüber entscheidet der Vorstand, nicht ich.', 0], ['Mein Stuhl wackelt nie. Meine Abwehr heute schon.', 4]),
  q('tief-3', ['hohe-niederlage'], 'Was haben Sie in der Pause in der Kabine gesagt?', ['Das bleibt in der Kabine.', 2], ['Ich war so laut, dass der Gegner es auch gehört hat.', 4], ['Ich habe nur gefragt, wer den Bus fährt.', -2]),
  q('null-1', ['zu-null'], 'Kein Gegentor heute. Ein Sonderlob für die Abwehr?', ['Absolut. Die ganze Defensive war eine Wand.', 6], ['Das Lob geht an alle elf. Verteidigen beginnt vorne.', 5], ['Der Goalie hat sich bei mir schon dreimal bedankt, dass er nichts tun musste.', 4]),
  q('null-2', ['zu-null'], 'Die Null steht. Wie wichtig ist das für das Selbstvertrauen?', ['Enorm. Eine weisse Weste gibt Ruhe.', 4], ['Wichtig, aber Tore schiessen ist noch schöner.', 3], ['So wichtig, dass ich mir die Null tätowieren lasse. Vielleicht.', 5]),
  q('elfer-1', ['elfmeter'], 'Die Entscheidung fiel im Elfmeterschiessen. Hatten Sie Nerven?', ['Nein, ich habe meinen Spielern vertraut.', 5], ['Ich habe nicht hingeschaut. Ich habe nur gehört, was passiert.', 4], ['Meine Nerven sind jetzt im Kühlschrank zur Erholung.', 6]),
  q('elfer-2', ['elfmeter'], 'Elfmeterschiessen ist Lotterie. Stimmen Sie zu?', ['Nein. Elfmeter kann man trainieren.', 4], ['Ein bisschen schon. Heute hatten wir das richtige Los.', 3], ['Dann sollten wir auch Lotto spielen gehen.', 5]),
  q('elfer-3', ['elfmeter'], 'Wer hat bestimmt, wer schiesst?', ['Die Spieler, die sich gut gefühlt haben.', 4], ['Ich. Nach einer sehr genauen Statistik.', 2], ['Wir haben Schere, Stein, Papier gespielt.', 6]),
  q('turnier-1', ['turnier'], 'Wie wichtig ist dieses Turnier für den Club?', ['Jedes Turnier ist eine Chance auf einen Pokal. Wir wollen ihn.', 6], ['Wichtig, aber die Liga steht über allem.', 1], ['Der Pokalschrank hat noch Platz. Ich habe ihn ausgemessen.', 5]),
  q('turnier-2', ['turnier', 'sieg'], 'Eine Runde weiter. Träumen Sie schon vom Finale?', ['Träumen ja, aber wir denken nur an das nächste Spiel.', 5], ['Ich habe den Anzug für das Finale schon in die Reinigung gebracht.', 6], ['Ich träume vor allem von einer ruhigen Nacht.', 2]),
  q('turnier-3', ['turnier', 'niederlage'], 'Das Turnier ist für heute vorbei. Was bleibt?', ['Erfahrung. Beim nächsten Mal sind wir weiter.', 5], ['Enttäuschung, ganz klar.', 3], ['Viele schöne Fotos vom Teambus.', 2]),
  q('saison-1', ['saison'], 'Wie bewerten Sie die Saison bis hierhin?', ['Wir sind auf einem guten Weg, aber noch lange nicht am Ziel.', 4], ['Ehrlich gesagt erwarte ich noch deutlich mehr.', 3], ['Ich gebe uns eine Sechs. Die Fans geben sich selber eine Sieben.', 7]),
  q('saison-2', ['saison'], 'Aufstieg, Klassenerhalt oder Meistertitel. Was ist das Ziel?', ['Wir schauen von Spiel zu Spiel.', 1], ['Ganz nach oben. Alles andere wäre langweilig.', 6], ['Das Ziel ist, dass niemand vergisst, wer wir sind.', 5]),
  q('saison-3', ['saison', 'sieg'], 'Mit diesem Sieg klettern Sie in der Tabelle. Schauen Sie hin?', ['Nein, die Tabelle schaue ich erst am Schluss an.', 2], ['Jeden Abend vor dem Einschlafen.', 5], ['Ich habe sie als Bildschirmhintergrund.', 6]),
  q('tor-1', ['torschuetze'], '{torschuetze} hat heute getroffen. Ein Wort zu diesem Spieler?', ['Ein Vorbild im Training und auf dem Platz.', 5], ['Er kann noch viel mehr. Ich werde ihn weiter fordern.', 3], ['Ich habe ihm gesagt, er darf heute das Abendessen aussuchen.', 6]),
  q('tor-2', ['torschuetze'], 'Wie wichtig ist {torschuetze} für die Mannschaft?', ['Sehr wichtig, aber bei uns zählt das Team.', 4], ['Unverzichtbar. Sein Vertrag sollte ewig laufen.', 6], ['So wichtig, dass ich seinen Namen jetzt richtig schreiben kann.', 3]),
  q('tor-3', ['torschuetze'], 'Fabrizio Romario meldet Interesse von Topclubs an {torschuetze}. Bleibt er?', ['Er fühlt sich hier wohl. Mehr gibt es nicht zu sagen.', 6], ['Jeder Spieler hat seinen Preis. Aber der ist sehr hoch.', -3], ['Here we go? Nein. Here we stay.', 8]),
  q('tor-4', ['torschuetze', 'sieg'], 'Der Jubel von {torschuetze} war spektakulär. War der abgesprochen?', ['Das ist seine Sache. Hauptsache, er trifft.', 3], ['Ja, wir haben ihn eine Woche lang geprobt.', 5], ['Ich bin froh, dass er sich dabei nicht verletzt hat.', 4]),
  q('aus-1', ['auswaerts'], 'Die Stimmung im fremden Stadion war hitzig. Hat das beeindruckt?', ['Nein. Wir mögen solche Spiele.', 5], ['Ein bisschen. Die Heimfans waren wirklich laut.', 2], ['Unsere mitgereisten Fans waren lauter. Danke an alle!', 9]),
  q('aus-2', ['auswaerts'], 'Wie wichtig sind die mitgereisten Fans?', ['Unbezahlbar. Sie haben uns getragen.', 9], ['Wichtig, aber auf dem Platz stehen wir.', -2], ['Ich zahle allen ein Getränk. Okay, vielleicht nur die Hälfte.', 6]),
  q('heim-1', ['heim'], 'Wie wichtig ist der Heimvorteil für Ihr Team?', ['Riesig. Zuhause sind wir eine Macht.', 6], ['Er wird überschätzt. Ein Platz ist ein Platz.', -3], ['Wir kennen jedes Loch im Rasen. Das hilft.', 4]),
  q('any-1', ['any'], 'Was war Ihr persönlicher Moment des Spiels?', ['Der Moment, als die Mannschaft zusammen gejubelt hat.', 5], ['Die Pause. Ich hatte Durst.', 2], ['Als der Gegner gemerkt hat, dass wir nicht aufgeben.', 4]),
  q('any-2', ['any'], 'Wie geht es jetzt weiter?', ['Regenerieren, analysieren, angreifen.', 3], ['Zuerst einmal schlafen.', 2], ['Mit dem nächsten Spiel, so steht es zumindest im Kalender.', 3]),
  q('any-3', ['any'], 'Ein Wort zum Schiedsrichter?', ['Er hatte ein schwieriges Spiel und hat es gut geleitet.', 2], ['Kein Kommentar. Ich möchte keine Busse zahlen.', 3], ['Wir laden ihn gerne zum Videostudium ein.', 1]),
  q('any-4', ['any'], 'Welche Note geben Sie Ihrer Mannschaft heute?', ['Eine ehrliche Note gibt es nur intern.', 2], ['Eine glatte Sechs für den Einsatz.', 5], ['Eine Fünf. Mit Sternchen für die Frisuren.', 4]),
  q('any-5', ['any'], 'Ist das Team bereit für die nächsten Aufgaben?', ['Bereit wie nie.', 5], ['Wir arbeiten daran. Es gibt noch viel zu tun.', 3], ['Bereit ist ein grosses Wort. Sagen wir: motiviert.', 3]),
  q('any-6', ['any'], 'Gibt es Neuigkeiten vom Transfermarkt?', ['Wir konzentrieren uns auf unsere Spieler.', 3], ['Fragen Sie Fabrizio Romario. Der weiss es vor mir.', 5], ['Ja, wir haben einen neuen Kaffeeautomaten verpflichtet.', 4]),
  q('any-7', ['any'], 'Wie wichtig ist der Teamgeist in dieser Phase?', ['Er ist unser grösstes Kapital.', 5], ['Wichtig, aber Qualität gewinnt Spiele.', 1], ['So wichtig, dass wir jetzt einen Teamhund haben.', 7]),
  q('any-8', ['any'], 'Wenn Sie ein Wort für dieses Spiel wählen müssten?', ['Leidenschaft.', 5], ['Lehrreich.', 2], ['Wild.', 4]),
  q('any-9', ['any'], 'Hat die Taktik heute so funktioniert wie geplant?', ['Grösstenteils ja. Die Spieler haben sie super umgesetzt.', 4], ['Nur zur Hälfte. Die andere Hälfte war Improvisation.', 2], ['Welche Taktik? Wir spielen einfach Fussball.', 3]),
  q('any-10', ['any'], 'Was möchten Sie den Fans zu Hause sagen?', ['Danke für eure Unterstützung, jedes Spiel.', 8], ['Bleibt dran, es kommen noch grosse Momente.', 5], ['Bitte stellt den Fernseher etwas leiser, wir hören euch bis hierher.', 6]),
  q('any-11', ['any'], 'Wie wichtig sind die Stars im Team, verglichen mit der Mannschaft?', ['Die Mannschaft ist der Star.', 6], ['Ohne Stars gewinnt man keine Titel.', 1], ['Bei uns ist jeder ein Star. Manche halt mit mehr Followern.', 4]),
  q('any-12', ['any'], 'Was haben Sie heute über Ihr Team gelernt?', ['Dass es nie aufgibt.', 6], ['Dass wir noch an der Konzentration arbeiten müssen.', 2], ['Dass drei Spieler die gleichen Schuhe haben. Verwirrend.', 3]),
];

export function hashText(text: string) {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}

export function normalizePress(value: unknown): PressState {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const strings = (v: unknown, limit: number) => (Array.isArray(v) ? v : []).filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 200)).slice(-limit);
  const last = source.last && typeof source.last === 'object' ? source.last as Record<string, unknown> : undefined;
  const mood = Number(source.fanMood);
  return {
    fanMood: Number.isFinite(mood) ? Math.max(0, Math.min(100, Math.round(mood))) : DEFAULT_FAN_MOOD,
    answered: strings(source.answered, 40),
    recentQuestions: strings(source.recentQuestions, RECENT_LIMIT),
    ...(last && typeof last.matchId === 'string' && typeof last.questionId === 'string' && typeof last.answer === 'string' ? { last: { matchId: last.matchId.slice(0, 200), questionId: last.questionId.slice(0, 40), answer: last.answer.slice(0, 200), mood: Math.max(-20, Math.min(20, Math.round(Number(last.mood) || 0))), at: Number(last.at) || 0 } } : {}),
  };
}

export function getPressContexts(cup: CupState): Set<PressContext> {
  const club = cup.homeScore, opponent = cup.awayScore, diff = club - opponent;
  const shootout = cup.penaltyEvents.length > 0;
  const won = diff > 0 || (shootout && cup.penaltyHomeScore > cup.penaltyAwayScore);
  const lost = diff < 0 || (shootout && cup.penaltyHomeScore < cup.penaltyAwayScore);
  const contexts = new Set<PressContext>(['any', cup.mode === 'season' ? 'saison' : 'turnier', cup.fixture?.away ? 'auswaerts' : 'heim']);
  if (won) contexts.add('sieg');
  if (diff >= 3) contexts.add('hoher-sieg');
  if (!won && !lost) contexts.add('remis');
  if (lost) contexts.add('niederlage');
  if (diff <= -3) contexts.add('hohe-niederlage');
  if (opponent === 0 && !lost) contexts.add('zu-null');
  if (shootout) contexts.add('elfmeter');
  if (cup.matchEvents.some((event) => event.side === 'home' && event.scorer)) contexts.add('torschuetze');
  return contexts;
}

function topScorer(cup: CupState) {
  const counts = new Map<string, number>();
  for (const event of cup.matchEvents) if (event.side === 'home' && event.scorer) counts.set(event.scorer, (counts.get(event.scorer) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function fill(text: string, cup: CupState, clubName: string) {
  return text.replaceAll('{gegner}', cup.opponent || 'den Gegner').replaceAll('{club}', clubName).replaceAll('{torschuetze}', topScorer(cup)).replaceAll('{resultat}', `${cup.homeScore}:${cup.awayScore}`);
}

/** Deterministic per match, so every coop player sees the same question. Recent questions are skipped. */
export function getPressConference(press: PressState | undefined, cup: CupState, clubName: string): PressConference | null {
  const matchId = cup.careerMatchId;
  if (!matchId || cup.active || !cup.matchStartedAt) return null;
  const state = press ?? normalizePress(undefined);
  if (state.answered.includes(matchId)) return null;
  const contexts = getPressContexts(cup);
  const seed = hashText(matchId);
  const matching = PRESS_QUESTIONS.filter((question) => question.contexts.every((context) => context === 'any' || contexts.has(context)));
  const specific = matching.filter((question) => !question.contexts.includes('any'));
  const fresh = (list: readonly PressQuestion[]) => list.filter((question) => !state.recentQuestions.includes(question.id));
  // Prefer questions about this result; generic ones keep variety once the specific pool was used recently.
  const pool = (seed % 4 !== 0 && fresh(specific).length ? fresh(specific) : fresh(matching).length ? fresh(matching) : matching);
  const question = pool[seed % pool.length];
  const order = [0, 1, 2];
  for (let i = order.length - 1; i > 0; i--) { const j = (seed >>> (i * 3)) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  return { matchId, question, text: fill(question.text, cup, clubName), answers: order.map((index) => ({ index, text: fill(question.answers[index].text, cup, clubName), mood: question.answers[index].mood })) };
}

/** Pure answer step used by singleplayer and the shared world API. */
export function answerPressConference(press: PressState | undefined, cup: CupState, clubName: string, matchId: string, questionId: string, answerIndex: number, now = Date.now()) {
  const conference = getPressConference(press, cup, clubName);
  if (!conference || conference.matchId !== matchId || conference.question.id !== questionId) return null;
  const answer = conference.question.answers[answerIndex];
  if (!answer || !Number.isInteger(answerIndex)) return null;
  const state = press ?? normalizePress(undefined);
  const fanMood = Math.max(0, Math.min(100, state.fanMood + answer.mood));
  const next: PressState = {
    fanMood,
    answered: [...state.answered, matchId].slice(-40),
    recentQuestions: [...state.recentQuestions.filter((id) => id !== questionId), questionId].slice(-RECENT_LIMIT),
    last: { matchId, questionId, answer: fill(answer.text, cup, clubName), mood: answer.mood, at: now },
  };
  return { press: next, answer: fill(answer.text, cup, clubName), mood: answer.mood, fanMood };
}

export function getPressReward(passivePerSecond: number, clickPower: number) {
  return Math.max(250, Math.floor(Math.max(passivePerSecond * 90, clickPower * 60)));
}

export function fanMoodLabel(mood: number) {
  return mood >= 85 ? 'Euphorisch' : mood >= 70 ? 'Begeistert' : mood >= 50 ? 'Zufrieden' : mood >= 30 ? 'Skeptisch' : 'Gereizt';
}
