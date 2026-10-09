import type { Language } from './settings'

type DesktopKey =
  | 'tray.tooltip'
  | 'tray.open'
  | 'tray.quickAdd'
  | 'tray.quit'
  | 'tray.notice'
  | 'tray.noticeOk'
  | 'quickAdd.openError'
  | 'settings.autostart'
  | 'settings.autostartDescription'
  | 'settings.autostartUnavailable'
  | 'settings.autostartError'
  | 'settings.shortcut'
  | 'settings.shortcutDescription'
  | 'settings.shortcutCapture'
  | 'settings.shortcutReset'
  | 'settings.shortcutConflict'
  | 'settings.shortcutConflictKept'
  | 'settings.shortcutError'

export const desktopMessages = {
  en: {
    'tray.tooltip': 'Financial Tracker — running in the tray',
    'tray.open': 'Open',
    'tray.quickAdd': 'Quick add',
    'tray.quit': 'Quit',
    'tray.notice':
      'Financial Tracker keeps running in the tray when you close the window. Use the tray icon to open it again, add a transaction, or quit.',
    'tray.noticeOk': 'OK',
    'quickAdd.openError':
      'Quick add could not open the last used profile. Open the main window and try again.',
    'settings.autostart': 'Start with Windows',
    'settings.autostartDescription':
      'Start hidden in the tray when you sign in. This setting applies to every profile on this Windows account; off by default.',
    'settings.autostartUnavailable':
      'Available only in the installed Windows app, not in development mode.',
    'settings.autostartError':
      'Could not read or change the Windows startup setting.',
    'settings.shortcut': 'Global quick-add shortcut',
    'settings.shortcutDescription':
      'Press a new shortcut. This app-level setting is shared by every profile on this Windows account.',
    'settings.shortcutCapture': 'Press the new shortcut',
    'settings.shortcutReset': 'Reset to Ctrl+Alt+N',
    'settings.shortcutConflict':
      'The shortcut {shortcut} is used by another program. Choose a different shortcut.',
    'settings.shortcutConflictKept':
      'The shortcut {shortcut} is used by another program. The previous shortcut is still active; choose a different one.',
    'settings.shortcutError': 'Could not change the global shortcut.',
  },
  hu: {
    'tray.tooltip': 'Financial Tracker — fut a háttérben',
    'tray.open': 'Megnyitás',
    'tray.quickAdd': 'Gyors rögzítés',
    'tray.quit': 'Kilépés',
    'tray.notice':
      'Az ablak bezárása után a Financial Tracker tovább fut a háttérben. A tálcaikonról újra megnyithatod, tranzakciót rögzíthetsz vagy kiléphetsz.',
    'tray.noticeOk': 'Rendben',
    'quickAdd.openError':
      'A gyors rögzítés nem tudta megnyitni a legutóbb használt profilt. Nyisd meg a főablakot, és próbáld újra.',
    'settings.autostart': 'Indítás a Windows rendszerrel',
    'settings.autostartDescription':
      'Bejelentkezéskor rejtve, a tálcán indul. A beállítás a Windows-fiók minden profiljára érvényes, és alapból ki van kapcsolva.',
    'settings.autostartUnavailable':
      'Csak a telepített Windows-alkalmazásban érhető el, fejlesztői módban nem.',
    'settings.autostartError':
      'Nem sikerült betölteni vagy módosítani az automatikus indítás beállítását.',
    'settings.shortcut': 'A Gyors rögzítés billentyűparancsa',
    'settings.shortcutDescription':
      'Nyomd le az új billentyűparancsot. Ez a beállítás a Windows-fiók minden profiljára érvényes.',
    'settings.shortcutCapture': 'Nyomd le az új billentyűparancsot',
    'settings.shortcutReset': 'Alapérték visszaállítása: Ctrl+Alt+N',
    'settings.shortcutConflict':
      'A(z) {shortcut} billentyűparancsot egy másik program használja. Válassz másik billentyűparancsot.',
    'settings.shortcutConflictKept':
      'A(z) {shortcut} billentyűparancsot egy másik program használja. Az előző billentyűparancs továbbra is aktív; válassz másikat.',
    'settings.shortcutError':
      'Nem sikerült módosítani a globális billentyűparancsot.',
  },
  de: {
    'tray.tooltip': 'Financial Tracker — läuft im Infobereich',
    'tray.open': 'Öffnen',
    'tray.quickAdd': 'Schnell erfassen',
    'tray.quit': 'Beenden',
    'tray.notice':
      'Financial Tracker läuft nach dem Schließen des Fensters im Infobereich weiter. Über das Symbol kannst du es wieder öffnen, eine Transaktion erfassen oder die App beenden.',
    'tray.noticeOk': 'OK',
    'quickAdd.openError':
      'Die Schnellerfassung konnte das zuletzt verwendete Profil nicht öffnen. Öffne das Hauptfenster und versuche es erneut.',
    'settings.autostart': 'Mit Windows starten',
    'settings.autostartDescription':
      'Bei der Anmeldung verborgen im Infobereich starten. Diese Einstellung gilt für alle Profile dieses Windows-Kontos; standardmäßig ausgeschaltet.',
    'settings.autostartUnavailable':
      'Nur in der installierten Windows-App verfügbar, nicht im Entwicklungsmodus.',
    'settings.autostartError':
      'Die Windows-Starteinstellung konnte nicht gelesen oder geändert werden.',
    'settings.shortcut': 'Globales Tastenkürzel für Schnellerfassung',
    'settings.shortcutDescription':
      'Drücke das neue Tastenkürzel. Diese App-Einstellung gilt für alle Profile dieses Windows-Kontos.',
    'settings.shortcutCapture': 'Neues Tastenkürzel drücken',
    'settings.shortcutReset': 'Auf Ctrl+Alt+N zurücksetzen',
    'settings.shortcutConflict':
      'Das Tastenkürzel {shortcut} wird von einem anderen Programm verwendet. Wähle ein anderes Tastenkürzel.',
    'settings.shortcutConflictKept':
      'Das Tastenkürzel {shortcut} wird von einem anderen Programm verwendet. Das bisherige Tastenkürzel bleibt aktiv; wähle ein anderes.',
    'settings.shortcutError':
      'Das globale Tastenkürzel konnte nicht geändert werden.',
  },
} satisfies Record<Language, Record<DesktopKey, string>>
