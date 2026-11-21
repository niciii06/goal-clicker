"use client";

import { useEffect, useState } from "react";
import { notificationPermission, notificationsSupported, requestNotificationPermission } from "./notifications";
import { t } from "../i18n/runtime";
import { useLocale } from "../i18n/use-locale";
import { LanguagePicker } from "../i18n/language-picker";

export type SoundPrefs = { effects: boolean; stadium: boolean };

/** Club tab: sounds split into effects and stadium, local notices, and the archive of the release notes. */
export function DeviceSettingsPanel({ sound, soundPrefs, onSound, onSoundPrefs, notifications, onNotifications, onWhatsNew, onMessage }: {
  sound: boolean; soundPrefs: SoundPrefs; onSound: () => void; onSoundPrefs: (next: SoundPrefs) => void;
  notifications: boolean; onNotifications: (on: boolean) => void; onWhatsNew: () => void; onMessage: (text: string) => void;
}) {
  useLocale();
  const [permission, setPermission] = useState<string>("unsupported");
  useEffect(() => { const timer = window.setTimeout(() => setPermission(notificationPermission()), 0); return () => window.clearTimeout(timer); }, []);
  async function toggleNotifications() {
    if (notifications) { onNotifications(false); onMessage(t("device.noticesOff")); return; }
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") { onNotifications(true); onMessage(t("device.noticesOn")); }
    else onMessage(result === "unsupported" ? t("device.noticesUnsupported") : t("device.noticesBlocked"));
  }
  return <section className="device-settings" aria-label={t("device.label")}>
    <div><p className="eyebrow">{t("device.eyebrow")}</p><strong>{t("device.title")}</strong></div>
    <LanguagePicker />
    <div className="device-settings-rows">
      <label className="device-toggle"><input type="checkbox" checked={sound} onChange={onSound} /><span><strong>{t("device.sound")}</strong><small>{t("device.soundHint")}</small></span></label>
      <label className="device-toggle"><input type="checkbox" checked={soundPrefs.effects} disabled={!sound} onChange={() => onSoundPrefs({ ...soundPrefs, effects: !soundPrefs.effects })} /><span><strong>{t("device.effects")}</strong><small>{t("device.effectsHint")}</small></span></label>
      <label className="device-toggle"><input type="checkbox" checked={soundPrefs.stadium} disabled={!sound} onChange={() => onSoundPrefs({ ...soundPrefs, stadium: !soundPrefs.stadium })} /><span><strong>{t("device.stadium")}</strong><small>{t("device.stadiumHint")}</small></span></label>
      {notificationsSupported() && <label className="device-toggle"><input type="checkbox" checked={notifications && permission === "granted"} onChange={() => void toggleNotifications()} /><span><strong>{t("device.notices")}</strong><small>{t("device.noticesHint")}</small></span></label>}
    </div>
    <button type="button" className="mode-secondary" onClick={onWhatsNew}>{t("device.news")}</button>
  </section>;
}
