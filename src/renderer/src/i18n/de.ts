import { categoryNames } from '../../../shared/category-translations'
import type { MessageCatalog } from './en'

export const de = {
  ...categoryNames.de,
  'categories.title': 'Kategorien',
  'categories.description':
    'Ausgaben- und Einnahmenkategorien haben höchstens zwei Ebenen. Standardnamen folgen der Sprache; eigene Namen bleiben unverändert. Das Archivieren einer Hauptkategorie blendet auch ihre Unterkategorien in Auswahllisten aus.',
  'categories.expense': 'Ausgabe',
  'categories.income': 'Einnahme',
  'categories.loading': 'Kategorien werden geladen…',
  'categories.name': 'Kategoriename',
  'categories.kind': 'Ausgabe oder Einnahme',
  'categories.parent': 'Hauptkategorie',
  'categories.main': 'Keine übergeordnete Kategorie (Hauptkategorie)',
  'categories.create': 'Kategorie erstellen',
  'categories.rename': 'Umbenennen',
  'categories.archive': 'Archivieren',
  'categories.archived': 'Archiviert — in Kategorieauswahllisten ausgeblendet',
  'categories.delete': 'Löschen',
  'categories.deleteConfirmation': 'Diese Kategorie endgültig löschen?',
  'categories.confirmDelete': 'Kategorie endgültig löschen',
  'categories.replacement': 'Ersatzkategorie',
  'categories.chooseReplacement': 'Ersatz auswählen',
  'categories.noReplacement': 'Kein Ersatz (unbenutzte Kategorie)',
  'categories.save': 'Speichern',
  'categories.cancel': 'Abbrechen',
  'categories.refresh': 'Aktualisieren',
  'categories.up': 'Nach oben',
  'categories.down': 'Nach unten',
  'categories.error':
    'Die Kategorieaktion konnte nicht abgeschlossen werden. Aktualisiere die Liste und versuche es erneut.',
  'categories.error.name':
    'Gib einen Kategorienamen mit 1 bis 100 Zeichen ein.',
  'categories.error.kind': 'Wähle Ausgabe oder Einnahme.',
  'categories.error.notFound':
    'Die Kategorie wurde nicht gefunden. Aktualisiere die Liste.',
  'categories.error.parent':
    'Wähle eine aktive Hauptkategorie derselben Art. Kategorien haben höchstens zwei Ebenen.',
  'categories.error.order':
    'Wähle eine gültige Position unter gleichgeordneten Kategorien.',
  'categories.error.children':
    'Lösche zuerst die Unterkategorien, bevor du ihre Hauptkategorie löschst.',
  'categories.error.replacementRequired':
    'Diese Kategorie hat Transaktionen. Wähle einen Ersatz, um sie zu erhalten.',
  'categories.error.replacement':
    'Wähle eine andere aktive Ersatzkategorie derselben Art.',
  'app.name': 'Financial Tracker',
  'app.tagline': 'Deine Finanzen auf deinem PC.',
  'navigation.label': 'Hauptnavigation',
  'navigation.overview': 'Übersicht',
  'navigation.transactions': 'Transaktionen',
  'navigation.accounts': 'Konten',
  'navigation.settings': 'Einstellungen',
  'sidebar.collapse': 'Seitenleiste einklappen',
  'sidebar.expand': 'Seitenleiste ausklappen',
  'sidebar.profile': 'Profile',
  'sidebar.profileHint': 'Der Profilwechsel wird später hier verfügbar sein.',
  'profilePicker.title': 'Profil auswählen',
  'profilePicker.description':
    'Jedes Profil speichert seine Finanzen in einer eigenen lokalen Datenbank.',
  'profilePicker.choose': 'Profile',
  'profilePicker.empty': 'Erstelle zuerst ein Profil.',
  'profile.loading': 'Profile werden geladen…',
  'profile.open': 'Profil öffnen',
  'profile.create': 'Profil erstellen',
  'profile.createDescription':
    'Gib diesem getrennten Finanzprofil einen Namen.',
  'profile.name': 'Profilname',
  'profile.rename': 'Umbenennen',
  'profile.renameLabel': 'Neuer Profilname',
  'profile.save': 'Namen speichern',
  'profile.delete': 'Löschen',
  'profile.deleteDescription':
    'Dadurch werden die Profildatenbank und alle lokalen Daten endgültig gelöscht.',
  'profile.typeName': 'Gib zur Bestätigung den Profilnamen ein:',
  'profile.confirmDelete': 'Profil endgültig löschen',
  'profile.cancel': 'Zurück zum Profil',
  'profile.switch': 'Profil wechseln',
  'profile.error': 'Der Profilvorgang konnte nicht abgeschlossen werden.',
  'overview.title': 'Deine Finanzen im Überblick',
  'overview.description':
    'Eine zusammengefasste Finanzübersicht wird später hier verfügbar sein.',
  'transactions.title': 'Deine Transaktionen an einem Ort',
  'transactions.description':
    'Erfasse Ausgaben und Einnahmen, damit deine Kontosalden aktuell bleiben.',
  'transactions.listDescription':
    'Hier erscheinen die letzten Transaktionen. Filter und Suche folgen später.',
  'transactions.create': 'Transaktion erfassen',
  'transactions.edit': 'Transaktion bearbeiten',
  'transactions.delete': 'Löschen',
  'transactions.deleteConfirmation':
    'Diese Transaktion endgültig löschen? Der Kontosaldo wird aktualisiert.',
  'transactions.confirmDelete': 'Transaktion löschen',
  'transactions.cancel': 'Abbrechen',
  'transactions.close': 'Transaktionsleiste schließen',
  'transactions.save': 'Transaktion speichern',
  'transactions.loading': 'Transaktionen werden geladen…',
  'transactions.empty': 'Noch keine Transaktionen erfasst.',
  'transactions.noAccounts':
    'Erstelle ein aktives Konto, bevor du eine Transaktion erfasst.',
  'transactions.refresh': 'Aktualisieren',
  'transactions.kind': 'Ausgabe oder Einnahme',
  'transactions.expense': 'Ausgabe',
  'transactions.income': 'Einnahme',
  'transactions.date': 'Datum',
  'transactions.amount': 'Betrag',
  'transactions.amountHint':
    'Gib einen positiven Betrag mit Punkt oder Komma und höchstens zwei Nachkommastellen ein.',
  'transactions.account': 'Konto',
  'transactions.chooseAccount': 'Aktives Konto auswählen',
  'transactions.payee': 'Zahlungspartner',
  'transactions.payeeHint':
    'Wähle einen vorhandenen Namen oder gib einen neuen Zahlungspartner ein.',
  'transactions.category': 'Kategorie',
  'transactions.note': 'Notiz',
  'transactions.noPayee': 'Kein Zahlungspartner',
  'transactions.noCategory': 'Keine Kategorie',
  'transactions.unknownAccount': 'Unbekanntes Konto',
  'transactions.error':
    'Der Transaktionsvorgang konnte nicht abgeschlossen werden. Aktualisiere die Liste und versuche es erneut.',
  'transactions.error.account': 'Wähle ein aktives Konto.',
  'transactions.error.kind': 'Wähle Ausgabe oder Einnahme.',
  'transactions.error.date': 'Gib ein gültiges Kalenderdatum ein.',
  'transactions.error.futureDate':
    'Das Transaktionsdatum darf nicht in der Zukunft liegen.',
  'transactions.error.amount':
    'Gib einen positiven Betrag mit höchstens zwei Nachkommastellen ein.',
  'transactions.error.payee':
    'Gib einen Zahlungspartner mit höchstens 100 Zeichen ein.',
  'transactions.error.category':
    'Wähle eine aktive Kategorie, die zu Ausgabe oder Einnahme passt.',
  'transactions.error.note': 'Gib eine Notiz mit höchstens 1.000 Zeichen ein.',
  'transactions.error.notFound':
    'Die Transaktion wurde nicht gefunden. Aktualisiere die Liste.',
  'transactions.error.lines':
    'Die Transaktionszeilen entsprechen nicht dem Gesamtbetrag.',
  'accounts.title': 'Ein Platz für jedes Konto',
  'accounts.description':
    'Jeder Saldo kombiniert Eröffnungssaldo, Einnahmen und Ausgaben in der Kontowährung.',
  'accounts.create': 'Konto erstellen',
  'accounts.name': 'Kontoname',
  'accounts.currency': 'Währung',
  'accounts.openingBalance': 'Eröffnungssaldo',
  'accounts.openingDate': 'Eröffnungsdatum',
  'accounts.balance': 'Saldo',
  'accounts.balanceHint':
    'Punkt oder Komma und höchstens zwei Nachkommastellen verwenden, ohne Tausendertrennzeichen. Negative Salden sind erlaubt.',
  'accounts.empty': 'Erstelle ein Konto, um seinen Saldo zu verfolgen.',
  'accounts.loading': 'Konten werden geladen…',
  'accounts.rename': 'Umbenennen',
  'accounts.changeCurrency': 'Währung ändern',
  'accounts.archive': 'Archivieren',
  'accounts.archived': 'Archiviert — in der Kontoauswahl ausgeblendet',
  'accounts.delete': 'Löschen',
  'accounts.deleteConfirmation': 'Dieses Konto endgültig löschen?',
  'accounts.confirmDelete': 'Konto endgültig löschen',
  'accounts.save': 'Speichern',
  'accounts.cancel': 'Abbrechen',
  'accounts.refresh': 'Aktualisieren',
  'accounts.locked':
    'Konten mit Transaktionen können weder gelöscht werden noch ihre Währung ändern.',
  'accounts.error':
    'Der Kontovorgang konnte nicht abgeschlossen werden. Aktualisiere die Liste und versuche es erneut.',
  'accounts.error.name': 'Gib einen Kontonamen mit 1 bis 100 Zeichen ein.',
  'accounts.error.currency': 'Wähle HUF oder CHF.',
  'accounts.error.balance':
    'Gib einen gültigen Saldo mit höchstens zwei Nachkommastellen ohne Gruppierung und innerhalb von ±90.071.992.547.409,91 ein.',
  'accounts.error.date': 'Gib ein gültiges Eröffnungsdatum ein.',
  'accounts.error.notFound':
    'Das Konto wurde nicht gefunden. Aktualisiere die Liste.',
  'accounts.error.currencyLocked':
    'Die Währung kann bei Konten mit Transaktionen nicht geändert werden.',
  'accounts.error.notEmpty':
    'Dieses Konto hat Transaktionen und kann nicht gelöscht werden. Archiviere es stattdessen.',
  'settings.title': 'Fühl dich wie zu Hause',
  'settings.description':
    'Sprache, Darstellung und Basiswährung werden für dieses Profil gespeichert und sofort übernommen.',
  'settings.baseCurrency': 'Basiswährung',
  'settings.error':
    'Die Einstellungen konnten nicht gespeichert werden. Bitte versuche es erneut.',
  'backups.title': 'Sicherungen',
  'backups.description':
    'Bei jedem Öffnen dieses Profils wird die Datenbank gesichert. Die letzten 10 Startsicherungen bleiben erhalten; Sicherungen vor Migrationen werden getrennt gespeichert.',
  'backups.loading': 'Sicherungen werden geladen…',
  'backups.empty': 'Keine Startsicherungen verfügbar.',
  'backups.choose': 'Datum und Uhrzeit der Sicherung',
  'backups.restore': 'Sicherung wiederherstellen',
  'backups.confirmDescription':
    'Diese Sicherung wiederherstellen? Die aktuelle Profildatenbank wird ersetzt. Änderungen seit der Sicherung gehen verloren.',
  'backups.confirmRestore': 'Wiederherstellung bestätigen',
  'backups.cancel': 'Abbrechen',
  'backups.error':
    'Der Sicherungsvorgang ist fehlgeschlagen. Falls auch die Wiederherstellung fehlgeschlagen ist, starten Sie die App vor dem Fortfahren neu.',
  'backups.restored':
    'Sicherung wiederhergestellt. Die Profildatenbank wurde erneut geöffnet.',
  'settings.language': 'Sprache',
  'settings.theme': 'Darstellung',
  'language.hu': 'Ungarisch',
  'language.en': 'Englisch',
  'language.de': 'Deutsch',
  'theme.light': 'Hell',
  'theme.dark': 'Dunkel',
  'theme.system': 'Windows folgen',
  'settings.preview': 'Formatierungsvorschau',
  'settings.date': 'Datum',
  'settings.number': 'Zahl',
} satisfies MessageCatalog
