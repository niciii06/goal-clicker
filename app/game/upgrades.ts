// The 27 club office upgrades, shared by single player and the co-op server.
// The five Liga 15 upgrades are cheap and strong on purpose: a new club gets its first pack within minutes.
import type { UpgradeDefinition } from "./types";

export const UPGRADES: UpgradeDefinition[] = [
  { id: "boots", icon: "boot", name: "Schnellere Stiefel", description: "+3 Tore pro Klick", baseCost: 10, scale: 1.22, gain: 3, kind: "click" },
  { id: "ballboy", icon: "worker", name: "Balljunge", description: "+3 Tore pro Sekunde", baseCost: 30, scale: 1.12, gain: 3, kind: "auto" },
  { id: "technique", icon: "ball", name: "Schusstechnik", description: "+9 Tore pro Klick", baseCost: 150, scale: 1.24, gain: 9, kind: "click" },
  { id: "instinct", icon: "scorer", name: "Torinstinkt", description: "+15 Tore pro Klick", baseCost: 750, scale: 1.26, gain: 15, kind: "click" },
  { id: "coach", icon: "board", name: "Taktiktafel", description: "+45 Tore pro Sekunde", baseCost: 800, scale: 1.138, gain: 45, kind: "auto" },
  { id: "striker", icon: "striker", name: "Killerstürmer", description: "+10 Tore pro Klick", baseCost: 1000, scale: 1.28, gain: 10, kind: "click", passiveShare: 0.0001, passiveShareMax: 0.002 },
  { id: "academy", icon: "board", name: "Nachwuchsakademie", description: "+60 Tore pro Sekunde", baseCost: 6000, scale: 1.15, gain: 60, kind: "auto" },
  { id: "floodlight", icon: "light", name: "Flutlichtanlage", description: "+300 Tore pro Sekunde", baseCost: 25000, scale: 1.162, gain: 300, kind: "auto" },
  { id: "longshot", icon: "flame", name: "Distanzschütze", description: "+25 Tore pro Klick", baseCost: 15000, scale: 1.3, gain: 25, kind: "click", passiveShare: 0.0002, passiveShareMax: 0.003 },
  { id: "scout", icon: "star", name: "Talent-Scouting", description: "+1.200 Tore pro Sekunde", baseCost: 100000, scale: 1.174, gain: 1200, kind: "auto" },
  { id: "var", icon: "screen", name: "VAR 2.0", description: "+1.950 Tore pro Sekunde", baseCost: 200000, scale: 1.18, gain: 1950, kind: "auto" },
  { id: "freekick", icon: "ball", name: "Freistoss-Spezialist", description: "+50 Tore pro Klick", baseCost: 50000, scale: 1.32, gain: 50, kind: "click", passiveShare: 0.0004, passiveShareMax: 0.004 },
  { id: "stadium", icon: "stadium", name: "Arena-Ausbau", description: "+8.250 Tore pro Sekunde", baseCost: 1000000, scale: 1.192, gain: 8250, kind: "auto" },
  { id: "worldclass", icon: "striker", name: "Weltklasse-Abschluss", description: "+100 Tore pro Klick", baseCost: 250000, scale: 1.34, gain: 100, kind: "click", passiveShare: 0.0006, passiveShareMax: 0.006 },
  { id: "broadcast", icon: "broadcast", name: "Weltweite Übertragung", description: "+28.500 Tore pro Sekunde", baseCost: 4000000, scale: 1.204, gain: 28500, kind: "auto" },
  { id: "sponsor", icon: "diamond", name: "Globaler Sponsor", description: "+102.000 Tore pro Sekunde", baseCost: 15000000, scale: 1.216, gain: 102000, kind: "auto" },
  { id: "ballondor", icon: "crown", name: "Ballon-d'Or-Angreifer", description: "+250 Tore pro Klick", baseCost: 4000000, scale: 1.38, gain: 250, kind: "click", passiveShare: 0.0011, passiveShareMax: 0.011 },
  { id: "superclub", icon: "crown", name: "Superclub-Netzwerk", description: "+450.000 Tore pro Sekunde", baseCost: 100000000, scale: 1.228, gain: 450000, kind: "auto" },
  { id: "captain", icon: "star", name: "Kapitänsbinde", description: "+500 Tore pro Klick", baseCost: 75000000, scale: 1.42, gain: 500, kind: "click", passiveShare: 0.003, passiveShareMax: 0.024 },
  { id: "rights", icon: "stadium", name: "Stadionrechte", description: "+300.000 Tore pro Sekunde", baseCost: 100000000, scale: 1.24, gain: 300000, kind: "auto" },
  { id: "merch", icon: "cards", name: "Fanshop", description: "+425.000 Tore pro Sekunde", baseCost: 150000000, scale: 1.25, gain: 425000, kind: "auto" },
  { id: "brand", icon: "broadcast", name: "Internationale Marke", description: "+500.000 Tore pro Sekunde", baseCost: 200000000, scale: 1.26, gain: 500000, kind: "auto" },
  { id: "campus", icon: "rookie", name: "Fussballcampus", description: "+700.000 Tore pro Sekunde", baseCost: 300000000, scale: 1.27, gain: 700000, kind: "auto" },
  { id: "franchise", icon: "shield", name: "Partnerclubs", description: "+900.000 Tore pro Sekunde", baseCost: 400000000, scale: 1.28, gain: 900000, kind: "auto" },
  { id: "empire", icon: "trophy", name: "Fussballimperium", description: "+1.300.000 Tore pro Sekunde", baseCost: 600000000, scale: 1.29, gain: 1300000, kind: "auto" },
  { id: "golden", icon: "crown", name: "Goldener Schuh", description: "+10% Klickpower", baseCost: 1000000000, scale: 1.58, gain: 0.1, kind: "multiplier" },
  { id: "legacy", icon: "diamond", name: "Vereins-Dynastie", description: "+5% auf alle Einnahmen", baseCost: 6000000000, scale: 1.68, gain: 0.05, kind: "multiplier" },
];

export function getUpgrade(id: string) {
  return UPGRADES.find((upgrade) => upgrade.id === id);
}
