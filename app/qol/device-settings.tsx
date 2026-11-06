"use client";

import { useEffect, useState } from "react";
import { notificationPermission, notificationsSupported, requestNotificationPermission } from "./notifications";

export type SoundPrefs = { effects: boolean; stadium: boolean };

/** Club tab: sounds split into effects and stadium, local notices, and the archive of the release notes. */
export function DeviceSettingsPanel({ sound, soundPrefs, onSound, onSoundPrefs, notifications, onNotifications, onWhatsNew, onMessage }: {
  sound: boolean; soundPrefs: SoundPrefs; onSound: () => void; onSoundPrefs: (next: SoundPrefs) => void;
  notifications: boolean; onNotifications: (on: boolean) => void; onWhatsNew: () => void; onMessage: (text: string) => void;
}) {
  const [permission, setPermission] = useState<string>("unsupported");
  useEffect(() => { const timer = window.setTimeout(() => setPermission(notificationPermission()), 0); return () => window.clearTimeout(timer); }, []);
  async function toggleNotifications() {
    if (notifications) { onNotifications(false); onMessage("Hinweise auf diesem Gerät aus"); return; }
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") { onNotifications(true); onMessage("Hinweise auf diesem Gerät an"); }
    else onMessage(result === "unsupported" ? "Dieser Browser zeigt keine Hinweise an." : "Der Browser hat Hinweise für Goal Clicker blockiert. Du kannst sie in den Website Einstellungen erlauben.");
  }
  return <section className="device-settings" aria-label="Einstellungen auf diesem Gerät">
    <div><p className="eyebrow">EINSTELLUNGEN / DIESES GERÄT</p><strong>Ton, Hinweise und Neuigkeiten.</strong></div>
    <div className="device-settings-rows">
      <label className="device-toggle"><input type="checkbox" checked={sound} onChange={onSound} /><span><strong>Ton</strong><small>Schaltet alle Töne gemeinsam ein oder aus.</small></span></label>
      <label className="device-toggle"><input type="checkbox" checked={soundPrefs.effects} disabled={!sound} onChange={() => onSoundPrefs({ ...soundPrefs, effects: !soundPrefs.effects })} /><span><strong>Effekte</strong><small>Klicks, Käufe, Packs und Prämien.</small></span></label>
      <label className="device-toggle"><input type="checkbox" checked={soundPrefs.stadium} disabled={!sound} onChange={() => onSoundPrefs({ ...soundPrefs, stadium: !soundPrefs.stadium })} /><span><strong>Stadion</strong><small>Fans, Pfiffe und Jubel während der Partie.</small></span></label>
      {notificationsSupported() && <label className="device-toggle"><input type="checkbox" checked={notifications && permission === "granted"} onChange={() => void toggleNotifications()} /><span><strong>Hinweise</strong><small>Solange Goal Clicker in einem Tab oder als App offen ist, meldet es Reiseankunft, Tagesprämie, Turnierpause und Angebote. Ohne Server, nichts wird verschickt.</small></span></label>}
    </div>
    <button type="button" className="mode-secondary" onClick={onWhatsNew}>Neuigkeiten lesen</button>
  </section>;
}
