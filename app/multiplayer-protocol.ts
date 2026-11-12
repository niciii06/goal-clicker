import { SOURCE_LOCALE } from "./i18n/locales";
import { translate } from "./i18n/translate";
export const MULTIPLAYER_PROTOCOL_VERSION = 15;

export const MULTIPLAYER_UPDATE_MESSAGE = translate(SOURCE_LOCALE, "update.multiplayer");

export function isSupportedMultiplayerProtocol(value: unknown) {
  return Number(value) === MULTIPLAYER_PROTOCOL_VERSION;
}
