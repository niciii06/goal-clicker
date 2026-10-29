// The 21 club office upgrades, shared by single player and the co-op server.
import type { UpgradeDefinition } from "./types";

export const UPGRADES: UpgradeDefinition[] = [
  { id: "boots", icon: "boot", name: "Schnellere Stiefel", description: "+1 Tor pro Klick", baseCost: 25, scale: 1.22, gain: 1, kind: "click" },
  { id: "ballboy", icon: "worker", name: "Balljunge", description: "+1 Tor pro Sekunde", baseCost: 120, scale: 1.2, gain: 1, kind: "auto" },
  { id: "technique", icon: "ball", name: "Schusstechnik", description: "+3 Tore pro Klick", baseCost: 260, scale: 1.24, gain: 3, kind: "click" },
  { id: "instinct", icon: "scorer", name: "Torinstinkt", description: "+5 Tore pro Klick", baseCost: 1400, scale: 1.26, gain: 5, kind: "click" },
  { id: "coach", icon: "board", name: "Taktiktafel", description: "+15 Tore pro Sekunde", baseCost: 3500, scale: 1.23, gain: 15, kind: "auto" },
  { id: "striker", icon: "striker", name: "Killerstürmer", description: "+10 Tore pro Klick", baseCost: 7500, scale: 1.28, gain: 10, kind: "click" },
  { id: "academy", icon: "board", name: "Nachwuchsakademie", description: "+60 Tore pro Sekunde", baseCost: 12500, scale: 1.25, gain: 60, kind: "auto" },
  { id: "floodlight", icon: "light", name: "Flutlichtanlage", description: "+300 Tore pro Sekunde", baseCost: 55000, scale: 1.27, gain: 300, kind: "auto" },
  { id: "longshot", icon: "flame", name: "Distanzschütze", description: "+25 Tore pro Klick", baseCost: 75000, scale: 1.3, gain: 25, kind: "click" },
  { id: "scout", icon: "star", name: "Talent-Scouting", description: "+1.200 Tore pro Sekunde", baseCost: 200000, scale: 1.29, gain: 1200, kind: "auto" },
  { id: "var", icon: "screen", name: "VAR 2.0", description: "+1.950 Tore pro Sekunde", baseCost: 400000, scale: 1.3, gain: 1950, kind: "auto" },
  { id: "freekick", icon: "ball", name: "Freistoss-Spezialist", description: "+50 Tore pro Klick", baseCost: 750000, scale: 1.32, gain: 50, kind: "click" },
  { id: "stadium", icon: "stadium", name: "Arena-Ausbau", description: "+8.250 Tore pro Sekunde", baseCost: 2000000, scale: 1.32, gain: 8250, kind: "auto" },
  { id: "worldclass", icon: "striker", name: "Weltklasse-Abschluss", description: "+100 Tore pro Klick", baseCost: 7500000, scale: 1.34, gain: 100, kind: "click" },
  { id: "broadcast", icon: "broadcast", name: "Weltweite Übertragung", description: "+28.500 Tore pro Sekunde", baseCost: 8000000, scale: 1.34, gain: 28500, kind: "auto" },
  { id: "sponsor", icon: "diamond", name: "Globaler Sponsor", description: "+102.000 Tore pro Sekunde", baseCost: 35000000, scale: 1.36, gain: 102000, kind: "auto" },
  { id: "ballondor", icon: "crown", name: "Ballon-d'Or-Angreifer", description: "+250 Tore pro Klick", baseCost: 75000000, scale: 1.38, gain: 250, kind: "click" },
  { id: "superclub", icon: "crown", name: "Superclub-Netzwerk", description: "+450.000 Tore pro Sekunde", baseCost: 180000000, scale: 1.38, gain: 450000, kind: "auto" },
  { id: "captain", icon: "star", name: "Kapitänsbinde", description: "+500 Tore pro Klick", baseCost: 350000000, scale: 1.42, gain: 500, kind: "click" },
  { id: "golden", icon: "crown", name: "Goldener Schuh", description: "+10% Klickpower", baseCost: 900000000, scale: 1.58, gain: 0.1, kind: "multiplier" },
  { id: "legacy", icon: "diamond", name: "Vereins-Dynastie", description: "+5% auf alle Einnahmen", baseCost: 6000000000, scale: 1.68, gain: 0.05, kind: "multiplier" },
];

export function getUpgrade(id: string) {
  return UPGRADES.find((upgrade) => upgrade.id === id);
}
