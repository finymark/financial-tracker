import type { Language } from './settings'

type DesktopKey =
  | 'tray.tooltip'
  | 'tray.open'
  | 'tray.quickAdd'
  | 'tray.quit'
  | 'tray.notice'
  | 'tray.noticeOk'
  | 'settings.autostart'
  | 'settings.autostartDescription'
  | 'settings.autostartUnavailable'
  | 'settings.autostartError'

export const desktopMessages = {
  en: {
    'tray.tooltip': 'Financial Tracker — running in the tray',
    'tray.open': 'Open',
    'tray.quickAdd': 'Quick add',
    'tray.quit': 'Quit',
    'tray.notice':
      'Financial Tracker keeps running in the tray when you close the window. Use the tray icon to open it again, add a transaction, or quit.',
    'tray.noticeOk': 'OK',
    'settings.autostart': 'Start with Windows',
    'settings.autostartDescription':
      'Start hidden in the tray when you sign in. This setting applies to every profile on this Windows account; off by default.',
    'settings.autostartUnavailable':
      'Available only in the installed Windows app, not in development mode.',
    'settings.autostartError':
      'Could not read or change the Windows startup setting.',
  },
  hu: {
    'tray.tooltip': 'Financial Tracker — a tálcán fut',
    'tray.open': 'Megnyitás',
    'tray.quickAdd': 'Gyors rögzítés',
    'tray.quit': 'Kilépés',
    'tray.notice':
      'Az ablak bezárása után a Financial Tracker tovább fut a tálcán. A tálcaikonról újra megnyithatod, tranzakciót rögzíthetsz vagy kiléphetsz.',
    'tray.noticeOk': 'Rendben',
    'settings.autostart': 'Indítás a Windows rendszerrel',
    'settings.autostartDescription':
      'Bejelentkezéskor rejtve, a tálcán indul. Ez a beállítás a Windows-fiók minden profiljára érvényes; alapértelmezetten kikapcsolt.',
    'settings.autostartUnavailable':
      'Csak a telepített Windows-alkalmazásban érhető el, fejlesztői módban nem.',
    'settings.autostartError':
      'Nem sikerült lekérni vagy módosítani a Windows indítási beállítását.',
  },
  de: {
    'tray.tooltip': 'Financial Tracker — läuft im Infobereich',
    'tray.open': 'Öffnen',
    'tray.quickAdd': 'Schnell erfassen',
    'tray.quit': 'Beenden',
    'tray.notice':
      'Financial Tracker läuft nach dem Schließen des Fensters im Infobereich weiter. Über das Symbol kannst du es wieder öffnen, eine Transaktion erfassen oder die App beenden.',
    'tray.noticeOk': 'OK',
    'settings.autostart': 'Mit Windows starten',
    'settings.autostartDescription':
      'Bei der Anmeldung verborgen im Infobereich starten. Diese Einstellung gilt für alle Profile dieses Windows-Kontos; standardmäßig ausgeschaltet.',
    'settings.autostartUnavailable':
      'Nur in der installierten Windows-App verfügbar, nicht im Entwicklungsmodus.',
    'settings.autostartError':
      'Die Windows-Starteinstellung konnte nicht gelesen oder geändert werden.',
  },
} satisfies Record<Language, Record<DesktopKey, string>>
