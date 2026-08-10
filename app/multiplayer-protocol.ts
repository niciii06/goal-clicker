export const MULTIPLAYER_PROTOCOL_VERSION = 2;

export const MULTIPLAYER_UPDATE_MESSAGE = "Eine neue Goal Clicker Version ist verfügbar. Lade die Seite einmal neu. Dein Raum und Spielstand bleiben vollständig erhalten.";

export function isSupportedMultiplayerProtocol(value: unknown) {
  return Number(value) === MULTIPLAYER_PROTOCOL_VERSION;
}
