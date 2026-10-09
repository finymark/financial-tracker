import { desktopMessages } from '../../../shared/desktop-translations'
import { csvMessages } from '../../../shared/csv-translations'
import { categoryNames } from '../../../shared/category-translations'
import type { MessageCatalog } from './en'

export const de = {
  ...desktopMessages.de,
  'privacy.toggle': 'Privatmodus',
  'privacy.hiddenAmount': 'Verborgener Betrag',
  'privacy.shortcutScope':
    'Der Privatmodus funktioniert überall, auch beim Tippen (Ctrl+Shift+H).',
  'quickAdd.title': 'Schnellerfassung',
  'quickAdd.noProfiles':
    'Erstelle im Hauptfenster ein Profil, bevor du eine Transaktion erfasst.',
  'quickAdd.noAccounts':
    'Erstelle im Hauptfenster ein Konto, bevor du eine Transaktion erfasst.',
  'quickAdd.saved': 'Gespeichert.',
  'quickAdd.loading': 'Schnellerfassung wird vorbereitet…',

  'shortcuts.closeHelp': 'Tastaturhilfe schließen',
  'transactions.saveAndAddAnother': 'Speichern und weitere hinzufügen',
  'shortcuts.scope':
    'Bei geöffnetem Profil: Neue Transaktion und Rückgängig funktionieren außerhalb von Eingabefeldern. Typ- und Speicherkürzel gelten im Transaktionsfenster.',
  'shortcuts.navigation':
    'Tab / Shift+Tab wechseln zwischen Feldern und bleiben im geöffneten Dialog.',
  'shortcuts.undo':
    'Letzte Änderung rückgängig machen (außerhalb von Eingabefeldern)',
  'shortcuts.close':
    'Abbrechen / Transaktionsfenster oder Tastaturhilfe schließen',
  'shortcuts.help': 'Tastenkürzel',
  'shortcuts.save':
    'Speichern (nicht in mehrzeiligen Notizen; Schaltflächen behalten ihre eigene Aktion)',
  'shortcuts.saveAndAddAnother':
    'Speichern und weitere hinzufügen (Datum, Konten und Typ behalten)',
  'shortcuts.newTransaction': 'Neue Transaktion (außerhalb von Eingabefeldern)',
  ...categoryNames.de,
  ...csvMessages.de,
  'csv.description':
    'Alle Transaktionen mit den angewendeten Filtern exportieren, nicht nur diese Seite. Jeder Split-Teil erhält eine eigene Zeile. Umbuchungen und Saldoanpassungen werden nicht exportiert.',
  'csv.decimalSeparator': 'Dezimaltrennzeichen',
  'csv.profileDefault': 'Standard der Profilsprache',
  'csv.dot': 'Punkt (123.45) · kommagetrennte Felder',
  'csv.comma': 'Komma (123,45) · semikolongetrennte Felder',
  'csv.saving': 'CSV wird gespeichert…',
  'csv.saved': 'CSV gespeichert.',
  'csv.error':
    'Die CSV konnte nicht gespeichert werden. Bitte erneut versuchen.',
  'csv.error.separator': 'Punkt oder Komma als Dezimaltrennzeichen wählen.',

  'rules.title': 'Kategorisierungsregeln',
  'rules.description':
    'Regeln werden der Reihe nach geprüft. Die erste passende Regel gewinnt und kann Zahlungspartner, Kategorie und Tags vor den zuletzt verwendeten Werten ausfüllen.',
  'rules.loading': 'Regeln werden geladen…',
  'rules.empty': 'Noch keine Kategorisierungsregeln.',
  'rules.offer': 'Eine Regel für diese Kategorisierung erstellen?',
  'rules.offerDismiss': 'Verwerfen',
  'rules.create': 'Regel erstellen',
  'rules.edit': 'Bearbeiten',
  'rules.delete': 'Löschen',
  'rules.save': 'Regel speichern',
  'rules.enabled': 'Aktiviert',
  'rules.disabled': 'Deaktiviert',
  'rules.up': 'Regel nach oben',
  'rules.down': 'Regel nach unten',
  'rules.anyPayee': 'Beliebiger Zahlungspartner',
  'rules.textContains': 'Notiz enthält',
  'rules.account': 'Kontobedingung',
  'rules.anyAccount': 'Beliebiges Konto',
  'rules.minimum': 'Mindestbetrag',
  'rules.maximum': 'Höchstbetrag',
  'rules.amountCurrency': 'Betragswährung',
  'rules.amountCondition': 'Betragsbedingung',
  'rules.payeeAction': 'Zahlungspartner setzen',
  'rules.noPayeeAction': 'Keinen Zahlungspartner setzen',
  'rules.noCategory': 'Keine Kategorie setzen',
  'rules.noTags': 'Erstellen Sie zuerst in einer Transaktion einen Tag.',
  'rules.action': 'Aktion',
  'rules.formHint':
    'Wählen Sie mindestens eine Bedingung und eine Aktion: Zahlungspartner, Kategorie oder Tags.',
  'rules.amountHint':
    'Optionale inklusive Betragsgrenze in der ausgewählten Regelwährung.',
  'rules.error': 'Die Regelaktion konnte nicht abgeschlossen werden.',
  'rules.error.notFound':
    'Die Regel wurde nicht gefunden. Liste aktualisieren.',
  'rules.error.condition': 'Mindestens eine Regelbedingung angeben.',
  'rules.error.text': 'Höchstens 1.000 Zeichen Suchtext eingeben.',
  'rules.error.amount': 'Einen gültigen, nicht negativen Betrag eingeben.',
  'rules.error.amountRange':
    'Der Mindestbetrag darf den Höchstbetrag nicht überschreiten.',
  'rules.error.action':
    'Zahlungspartner, Kategorie und/oder mindestens einen Tag wählen.',
  'rules.error.reference':
    'Vorhandene aktive Zahlungspartner, Konten, Kategorien und Tags wählen.',
  'rules.error.order': 'Eine gültige Regelposition wählen.',
  'payees.title': 'Zahlungspartner',
  'payees.description':
    'Aliasse ordnen Rohbezeichnungen einem Zahlungspartner zu. Groß-/Kleinschreibung und Akzente werden beim Abgleich ignoriert. Beim Zusammenführen wechseln Transaktionen und Aliasse zum ausgewählten verbleibenden Zahlungspartner.',
  'payees.loading': 'Zahlungspartner werden geladen…',
  'payees.empty':
    'Zahlungspartner erscheinen hier nach dem Erfassen einer Transaktion.',
  'payees.aliases': 'Aliasse',
  'payees.noAliases': 'Keine Aliasse.',
  'payees.aliasName': 'Rohe Zahlungspartnerbezeichnung',
  'payees.addAlias': 'Alias hinzufügen',
  'payees.removeAlias': 'Entfernen',
  'payees.mergeInto': 'Diesen Zahlungspartner zusammenführen mit',
  'payees.chooseSurvivor': 'Verbleibenden Zahlungspartner auswählen',
  'payees.merge': 'Zahlungspartner zusammenführen',
  'payees.mergeHint':
    'Alle Transaktionen und Aliasse wechseln zum verbleibenden Zahlungspartner. Diese Änderung kann rückgängig gemacht werden.',
  'payees.refresh': 'Aktualisieren',
  'payees.error':
    'Der Zahlungspartnervorgang konnte nicht abgeschlossen werden. Versuche es erneut.',
  'payees.error.notFound':
    'Der Zahlungspartner wurde nicht gefunden. Aktualisiere die Liste.',
  'payees.error.aliasNotFound':
    'Der Alias wurde nicht gefunden. Aktualisiere die Liste.',
  'payees.error.aliasName': 'Gib einen Alias mit 1 bis 100 Zeichen ein.',
  'payees.error.aliasConflict':
    'Diese Rohbezeichnung gehört bereits zu einem Zahlungspartner oder Alias.',
  'payees.error.samePayee':
    'Wähle einen anderen verbleibenden Zahlungspartner.',
  'payees.error.query': 'Die Zahlungspartnersuche ist ungültig.',
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
  'categories.unarchive': 'Dearchivieren',
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
  'updates.ready':
    'Ein Update wurde heruntergeladen. Starten Sie zur Installation neu.',
  'updates.restart': 'Neustarten und aktualisieren',
  'updates.error':
    'Neustart für das Update fehlgeschlagen. Bitte versuchen Sie es erneut.',
  'app.name': 'Financial Tracker',
  'app.tagline': 'Deine Finanzen auf deinem PC.',
  'rates.status.upToDate': 'Wechselkurse sind aktuell',
  'rates.status.stale': 'Wechselkurse sind veraltet',
  'rates.status.missing': 'Ein Wechselkurs fehlt',
  'rates.status.lastRefresh': 'Letzte Aktualisierung',
  'navigation.label': 'Hauptnavigation',
  'navigation.overview': 'Übersicht',
  'navigation.transactions': 'Transaktionen',
  'navigation.receipts': 'Belegeingang',
  'navigation.recurring': 'Wiederkehrend',
  'navigation.reports': 'Berichte',
  'navigation.accounts': 'Konten',
  'navigation.settings': 'Einstellungen',
  'receipts.title': 'Belege zur Bearbeitung',
  'receipts.description':
    'Prüfe abgelegte Belegfotos und bestätige sie als Transaktion oder verwirf sie.',
  'receipts.count': 'Belege im Eingang',
  'receipts.loading': 'Belegeingang wird geladen…',
  'receipts.empty': 'Keine Belegfotos warten auf Bearbeitung.',
  'receipts.preview': 'Vorschau des Belegfotos',
  'receipts.back': 'Zurück zum Belegeingang',
  'receipts.confirm': 'Transaktion bestätigen',
  'receipts.discard': 'Verwerfen',
  'receipts.reading':
    'Beleg wird gelesen… Manuelle Eingabe ist weiterhin möglich.',
  'receipts.ocrPrefilled': 'durch OCR gelesen',
  'receipts.ocrLowConfidence':
    'Die OCR-Sicherheit ist niedrig. Bitte alle vorausgefüllten Felder prüfen.',
  'receipts.currencyMismatch':
    'Kein aktives Konto entspricht der erkannten Währung:',
  'receipts.source.drop': 'In die App gezogen',
  'receipts.source.folder': 'Überwachter Ordner',
  'receipts.source.phone': 'Vom Telefon hochgeladen',
  'receipts.dropOverlay': 'Belegfotos ablegen, um sie zum Eingang hinzuzufügen',
  'receipts.dropProcessing': 'Belegfotos werden hinzugefügt…',
  'receipts.error':
    'Der Belegvorgang konnte nicht abgeschlossen werden. Versuche es erneut.',
  'receipts.error.type':
    'Lege ein JPEG-, PNG- oder WebP-Bild ab. PDF- und andere Dateien werden im Belegeingang nicht angenommen.',
  'receipts.error.size': 'Jedes Belegfoto darf höchstens 25 MB groß sein.',
  'receipts.error.path': 'Das Belegfoto konnte nicht gelesen werden.',
  'receipts.error.source': 'Wähle eine gültige Eingangsquelle.',
  'receipts.error.notFound':
    'Der Beleg wurde nicht gefunden. Aktualisiere den Eingang.',
  'receipts.error.preview': 'Die Belegvorschau konnte nicht erstellt werden.',
  'recurring.title': 'Wiederkehrende Transaktionen',
  'recurring.definitions': 'Definitionen',
  'recurring.sections': 'Bereiche für wiederkehrende Transaktionen',
  'recurring.fromTransaction': 'Wiederkehrende Transaktion erstellen',
  'recurring.fromTemplate': 'Wiederkehrende Transaktion aus Vorlage',
  'recurring.fromSplitHint':
    'Geteilte Transaktionen können nicht als wiederkehrende Transaktion verwendet werden.',
  'pending.title': 'Ausstehend',
  'pending.empty': 'Keine ausstehenden Transaktionen.',
  'pending.confirm': 'Bestätigen',
  'pending.editAndConfirm': 'Bearbeiten & bestätigen',
  'pending.skip': 'Überspringen',
  'pending.overdue': 'Überfällig',
  'pending.dueCount': 'Fällige ausstehende Transaktionen',
  'pending.error.notFound':
    'Die ausstehende Transaktion wurde nicht gefunden. Aktualisiere die Liste.',
  'pending.error.accountArchived':
    'Dieses Konto ist archiviert. Hebe die Archivierung des Kontos auf oder überspringe dieses Vorkommen.',
  'recurring.description':
    'Regelmäßige Ausgaben und Einnahmen als Schätzung anlegen. Fällige Vorkommen bleiben ausstehend und wirken sich noch nicht auf die Finanzen aus.',
  'recurring.create': 'Wiederkehrende Transaktion erstellen',
  'recurring.edit': 'Wiederkehrende Transaktion bearbeiten',
  'recurring.save': 'Wiederkehrende Transaktion speichern',
  'recurring.empty': 'Noch keine wiederkehrenden Transaktionen.',
  'recurring.pause': 'Pausieren',
  'recurring.resume': 'Fortsetzen',
  'recurring.paused': 'Pausiert',
  'recurring.delete': 'Löschen',
  'recurring.deleteConfirmation':
    'Diese wiederkehrende Transaktion und alle ausstehenden Vorkommen löschen?',
  'recurring.nextDue': 'Nächste Fälligkeit',
  'recurring.noNextDue': 'Kein zukünftiger Fälligkeitstermin',
  'recurring.creationHint':
    'Vorkommen vor der Erstellung werden nicht erzeugt. Beim Fortsetzen werden Termine während der Pause übersprungen.',
  'recurring.schedule.label': 'Zeitplan',
  'recurring.schedule.monthly': 'Monatlich',
  'recurring.schedule.weekly': 'Wöchentlich',
  'recurring.schedule.yearly': 'Jährlich',
  'recurring.every': 'alle',
  'recurring.months': 'Monat(e)',
  'recurring.weeks': 'Woche(n)',
  'recurring.month': 'Monat',
  'recurring.day': 'Tag',
  'recurring.weekday': 'Wochentag',
  'recurring.interval': 'Wiederholungsintervall',
  'recurring.startDate': 'Startdatum',
  'recurring.endDate': 'Enddatum (optional)',
  'recurring.weekday.0': 'Sonntag',
  'recurring.weekday.1': 'Montag',
  'recurring.weekday.2': 'Dienstag',
  'recurring.weekday.3': 'Mittwoch',
  'recurring.weekday.4': 'Donnerstag',
  'recurring.weekday.5': 'Freitag',
  'recurring.weekday.6': 'Samstag',
  'recurring.error':
    'Die wiederkehrende Transaktion konnte nicht gespeichert werden. Prüfen Sie alle Felder und versuchen Sie es erneut.',
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
  'profiles.error.name': 'Gib einen Profilnamen mit 1 bis 100 Zeichen ein.',
  'profiles.error.notFound':
    'Das Profil wurde nicht gefunden. Aktualisiere die Liste.',
  'profiles.error.confirmation':
    'Gib den Profilnamen zur Löschbestätigung exakt ein.',
  'profiles.error.registryRead': 'Die Profilliste konnte nicht gelesen werden.',
  'profiles.error.registryWrite':
    'Die Profilliste konnte nicht gespeichert werden.',
  'profiles.error.delete':
    'Das Profil konnte nicht sicher gelöscht werden und bleibt verfügbar.',
  'profiles.error.newerSchema':
    'Dieses Profil wurde mit einer neueren App-Version geöffnet und kann nicht sicher geöffnet werden.',
  'profiles.error.migration':
    'Das Profil-Upgrade ist fehlgeschlagen. Die vorherige Datenbank wurde erhalten.',
  'profiles.error.identity':
    'Die Profildatenbank stimmt nicht mit dem ausgewählten Profil überein.',
  'overview.title': 'Deine Finanzen im Überblick',
  'overview.description':
    'Dieser Monat bis heute im Vergleich zum vollständigen letzten Monat, in Ihrer Basiswährung.',
  'overview.error': 'Die Übersicht konnte nicht geladen werden.',
  'overview.expenses': 'Ausgaben',
  'overview.incomes': 'Einnahmen',
  'overview.net': 'Saldo',
  'overview.thisMonthToDate': 'Dieser Monat bis heute',
  'overview.fullLastMonth': 'Vollständiger letzter Monat',
  'overview.change': 'Änderung zum letzten Monat',
  'overview.topCategories': 'Top 5 Ausgabenkategorien dieses Monats',
  'overview.transactions': 'Transaktionen anzeigen',
  'overview.reports': 'Berichte anzeigen',
  'overview.chartLabel': 'Die fünf größten Ausgabenkategorien dieses Monats',
  'overview.shareHint':
    'Anteile beziehen sich auf umgerechnete Ausgaben aller Kategorien, nicht nur der ersten fünf. Nicht umgerechnete Beträge werden separat angezeigt und sind nicht in den Anteilen enthalten.',
  'reports.trend.title': 'Monatlicher Trend',
  'reports.trend.description':
    'Ausgaben, Einnahmen und Saldo in der Basiswährung.',
  'reports.trend.partial': 'Teilmonat',
  'reports.trend.partialHint':
    'Teilmonate enthalten nur Tage innerhalb des gewählten Zeitraums.',
  'reports.trend.unconvertedHint':
    'Beträge ohne Wechselkurs fehlen im Diagramm. Die Tabelle zeigt sie für jeden Monat separat.',
  'reports.trend.chartLabel':
    'Monatliche Ausgaben und Einnahmen mit Saldolinie',
  'reports.trend.month': 'Monat',
  'reports.trend.expenses': 'Ausgaben',
  'reports.trend.incomes': 'Einnahmen',
  'reports.trend.net': 'Saldo',
  'reports.pace.title': 'Ausgabentempo',
  'reports.pace.description':
    'Bisherige Ausgaben dieses Monats im Vergleich zum Durchschnitt der drei vorherigen Kalendermonate bis zum gleichen Tag, begrenzt auf die jeweilige Monatslänge.',
  'reports.pace.current': 'Dieser Monat bisher',
  'reports.pace.average': 'Dreimonatsdurchschnitt',
  'reports.pace.difference': 'Im Vergleich zu den üblichen Ausgaben',
  'reports.pace.ahead': 'Voraus',
  'reports.pace.behind': 'Zurück',
  'reports.pace.onPace': 'Im üblichen Tempo',
  'reports.pace.noBaseline': 'Keine Basis für einen Prozentsatz',
  'reports.pace.partial':
    'Teilweiser Vergleich: Einige Beträge konnten nicht umgerechnet werden. Die betroffenen Monate stehen unten.',
  'reports.pace.months': 'Vergleichsmonate',
  'reports.pace.refresh': 'Tempo aktualisieren',
  'reports.pace.chartLabel':
    'Bisherige Monatsausgaben im Vergleich zum Dreimonatsdurchschnitt',
  'reports.title': 'Ausgaben nach Kategorie',
  'reports.description':
    'Vergleichen Sie Kategoriesummen in Ihrer Basiswährung und öffnen Sie die zugehörigen Transaktionen.',
  'reports.heading': 'Berichte in Ihrer Basiswährung',
  'reports.introduction':
    'Kategorien, monatliche Trends und Geldflüsse für den gewählten Zeitraum erkunden oder das Ausgabentempo dieses Monats vergleichen.',
  'reports.view': 'Berichtsansicht',
  'reports.cashFlow.title': 'Geldfluss',
  'reports.cashFlow.income': 'Einnahmen',
  'reports.cashFlow.expense': 'Ausgaben',
  'reports.cashFlow.uncategorizedIncome': 'Nicht kategorisierte Einnahmen',
  'reports.cashFlow.uncategorizedExpense': 'Nicht kategorisierte Ausgaben',
  'reports.cashFlow.deficit': 'Aus Ersparnissen / Defizit',
  'reports.cashFlow.surplus': 'Gespart / Überschuss',
  'reports.cashFlow.empty':
    'Keine umgerechneten Einnahmen oder Ausgaben in diesem Zeitraum.',
  'reports.cashFlow.description':
    'Einnahmenkategorien fließen über Einnahmen zu Ausgabenkategorien. Ersparnisse gleichen die umgerechneten Flüsse aus; nicht umgerechnete Beträge bleiben separat.',
  'reports.cashFlow.rounding':
    'Die Flüsse verwenden gerundete Kategoriesummen; ihre Summe kann leicht vom einmal gerundeten Gesamtbetrag des Zeitraums abweichen.',
  'reports.dateRange': 'Berichtszeitraum',
  'reports.period.thisMonth': 'Dieser Monat',
  'reports.period.lastMonth': 'Letzter Monat',
  'reports.period.thisYear': 'Dieses Jahr',
  'reports.period.last12Months': 'Letzte 12 Monate',
  'reports.period.custom': 'Benutzerdefinierter Zeitraum',
  'reports.apply': 'Zeitraum anwenden',
  'reports.loading': 'Bericht wird geladen…',
  'reports.error':
    'Der Bericht konnte nicht geladen werden. Bitte erneut versuchen.',
  'reports.error.range':
    'Geben Sie einen gültigen Zeitraum ab dem 01.01.1900 ein, der höchstens 100 Jahre umfasst.',
  'reports.total': 'Gesamtausgaben',
  'reports.provisional': 'vorläufige Kurse',
  'reports.chartType': 'Diagrammtyp',
  'reports.pie': 'Kreis',
  'reports.bar': 'Balken',
  'reports.unconverted': 'Nicht umgerechnet',
  'reports.empty': 'Keine einbezogenen Ausgaben in diesem Zeitraum.',
  'reports.chartLabel': 'Diagramm der Ausgabenkategorien',
  'reports.categories': 'Hauptkategorien',
  'reports.subcategories': 'Unterkategorien',
  'reports.amount': 'Betrag',
  'reports.share': 'Anteil',
  'reports.uncategorized': 'Nicht kategorisiert',
  'reports.back': 'Zurück zu den Hauptkategorien',
  'reports.drillHint':
    'Wählen Sie eine Hauptkategorie und dann eine Unterkategorie, um deren Transaktionen zu öffnen.',
  'reports.transactionFilter': 'Aus Bericht:',
  'reports.transactionFilter.expense': 'nur Ausgaben',
  'reports.transactionFilter.income': 'nur Einnahmen',
  'reports.transactionFilter.exactCategory': 'ohne Unterkategorien',
  'reports.transactionFilter.clear': 'Alle Arten und Unterkategorien anzeigen',
  'transactions.title': 'Deine Transaktionen an einem Ort',
  'transactions.description':
    'Erfasse Ausgaben, Einnahmen und Umbuchungen, damit deine Kontosalden aktuell bleiben.',
  'transactions.listDescription':
    'Transaktionen nach Zeitraum, Konto, Kategorie, Zahlungspartner, Tag oder Notiz filtern.',
  'adjustments.setRealBalance': 'Tatsächlichen Saldo setzen',
  'adjustments.edit': 'Saldoabgleich bearbeiten',
  'adjustments.save': 'Saldoabgleich speichern',
  'adjustments.deleteConfirmation':
    'Diesen Saldoabgleich dauerhaft löschen? Der Kontosaldo wird aktualisiert.',
  'adjustments.confirmDelete': 'Saldoabgleich löschen',
  'adjustments.rowType': 'Saldoabgleich',
  'adjustments.observedBalance': 'Beobachteter Saldo',
  'adjustments.difference': 'Aktuelle Differenz',
  'adjustments.zeroDifference': 'Keine Korrektur nötig',
  'adjustments.zeroDifferenceHint':
    'Dieser Abgleich korrigiert nichts mehr und kann gelöscht werden.',
  'adjustments.error.account': 'Wähle ein aktives Konto.',
  'adjustments.error.date': 'Gib ein gültiges Kalenderdatum ein.',
  'adjustments.error.futureDate':
    'Das Datum der Saldo-Beobachtung darf nicht in der Zukunft liegen.',
  'adjustments.error.balance':
    'Gib einen gültigen Saldo innerhalb von ±90.071.992.547.409,91 ein.',
  'adjustments.error.note': 'Gib eine Notiz mit höchstens 1.000 Zeichen ein.',
  'adjustments.error.notFound':
    'Der Saldoabgleich wurde nicht gefunden. Aktualisiere die Liste.',
  'transactions.excluded': 'Ausgeschlossen',
  'transactions.excludedHint':
    'Im Kontostand enthalten, aber nicht in den Ausgaben- und Einnahmensummen.',
  'transactions.exclusion': 'Ausgeschlossene Transaktionen',
  'transactions.exclusion.all': 'Alle Transaktionen',
  'transactions.exclusion.onlyExcluded': 'Nur ausgeschlossene',
  'transactions.exclusion.hideExcluded': 'Ausgeschlossene ausblenden',
  'transactions.error.excluded':
    'Wähle, ob die Transaktion ausgeschlossen ist.',
  'transactions.filters': 'Transaktionsfilter',
  'transactions.period': 'Zeitraum',
  'transactions.period.all': 'Alle Daten',
  'transactions.period.thisMonth': 'Dieser Monat',
  'transactions.period.lastMonth': 'Letzter Monat',
  'transactions.period.thisYear': 'Dieses Jahr',
  'transactions.period.custom': 'Eigener Zeitraum',
  'transactions.from': 'Von',
  'transactions.to': 'Bis',
  'transactions.allAccounts': 'Alle Konten',
  'transactions.allCategories': 'Alle Kategorien',
  'transactions.allPayees': 'Alle Zahlungspartner',
  'transactions.search': 'Zahlungspartner oder Notiz',
  'transactions.applyFilters': 'Filter anwenden',
  'transactions.filteredTotals': 'Gefilterte Summen',
  'transactions.baseTotal': 'Summe in Basiswährung',
  'transactions.unconverted': 'Nicht umgerechnet',
  'transactions.provisional': 'vorläufig',
  'transactions.matches': 'Transaktionen',
  'transactions.noMatches': 'Keine Transaktionen entsprechen diesen Filtern.',
  'transactions.previousPage': 'Vorherige Seite',
  'transactions.nextPage': 'Nächste Seite',
  'transactions.actions': 'Aktionen',
  'transactions.error.filters':
    'Wähle gültige Filter und einen geordneten Datumsbereich.',
  'transactions.error.totals':
    'Die gefilterte Summe ist zu groß für eine exakte Darstellung.',
  'transactions.duplicate': 'Transaktion duplizieren',
  'templates.title': 'Transaktionsvorlagen',
  'templates.choose': 'Vorlage auswählen',
  'templates.use': 'Vorlage verwenden',
  'templates.create': 'Vorlage erstellen',
  'templates.edit': 'Vorlage bearbeiten',
  'templates.delete': 'Vorlage löschen',
  'templates.save': 'Vorlage speichern',
  'templates.name': 'Vorlagenname',
  'templates.saveTransaction': 'Als Vorlage speichern',
  'templates.savedTransactionHint':
    'Verwendet die gespeicherte Transaktion, nicht ungespeicherte Änderungen im Formular.',
  'templates.optionalHint':
    'Nur der Name ist erforderlich. Andere Felder können leer bleiben und beim Verwenden ausgefüllt werden.',
  'templates.tagsHint':
    'Ein Tag-Name pro Zeile. Fehlende Tags werden beim Speichern der Vorlage erstellt.',
  'templates.deleteConfirmation': 'Diese Transaktionsvorlage löschen?',
  'templates.amountRequired':
    'Gib vor dem Speichern dieser Transaktion einen Betrag ein.',
  'templates.error.name': 'Gib einen Vorlagennamen mit 1 bis 100 Zeichen ein.',
  'templates.error.split':
    'Aufgeteilte Transaktionen können nicht als Vorlagen gespeichert werden.',
  'templates.error.notFound':
    'Die Transaktionsvorlage wurde nicht gefunden. Aktualisiere die Liste.',
  'transactions.create': 'Transaktion erfassen',
  'transactions.edit': 'Transaktion bearbeiten',
  'transactions.delete': 'Löschen',
  'transactions.deleteConfirmation':
    'Diese Transaktion endgültig löschen? Der Kontosaldo wird aktualisiert.',
  'transactions.confirmDelete': 'Transaktion löschen',
  'attachments.title': 'Anhänge',
  'attachments.add': 'Hinzufügen',
  'attachments.drop': 'JPEG-, PNG-, WebP- oder PDF-Dateien hier ablegen.',
  'attachments.empty': 'Keine Anhänge.',
  'attachments.open': 'Öffnen',
  'attachments.remove': 'Entfernen',
  'attachments.deleteWithTransaction': 'Transaktion und ihre Anhänge löschen',
  'attachments.saveCopiesAndDelete':
    'Anhangkopien in einem Ordner speichern…, dann löschen',
  'attachments.error.type':
    'Wähle eine JPEG-, PNG-, WebP- oder PDF-Datei. Der Dateityp wird anhand des Inhalts geprüft.',
  'attachments.error.size': 'Jeder Anhang darf höchstens 25 MB groß sein.',
  'attachments.error.path':
    'Die ausgewählte Datei konnte nicht gelesen werden.',
  'attachments.error.store':
    'Der Anhang konnte nicht in dieses Profil kopiert werden.',
  'attachments.error.staged':
    'Der vorbereitete Anhang ist nicht mehr verfügbar.',
  'attachments.error.notFound':
    'Der Anhang wurde nicht gefunden. Aktualisiere die Transaktion.',
  'attachments.error.copy':
    'Die Anhangkopien konnten nicht in diesem Ordner gespeichert werden.',
  'attachments.error.open': 'Der Anhang konnte nicht geöffnet werden.',
  'transactions.cancel': 'Abbrechen',
  'transactions.close': 'Transaktionsleiste schließen',
  'transactions.save': 'Transaktion speichern',
  'transactions.loading': 'Transaktionen werden geladen…',
  'transactions.empty': 'Noch keine Transaktionen erfasst.',
  'transactions.noAccounts':
    'Erstelle ein aktives Konto, bevor du eine Transaktion erfasst.',
  'transactions.refresh': 'Aktualisieren',
  'transactions.kind': 'Transaktionstyp',
  'transactions.expense': 'Ausgabe',
  'transactions.income': 'Einnahme',
  'transactions.transfer': 'Umbuchung',
  'transactions.date': 'Datum',
  'transactions.amount': 'Betrag',
  'amount.result': 'Berechneter Betrag',
  'transactions.amountHint':
    'Verwende + - * /, Klammern, Punkt oder Komma als Dezimalzeichen und Tausendertrennzeichen (z. B. 1 234,50). Verlassen des Feldes oder Enter berechnet das auf Hundertstel gerundete Endergebnis.',
  'transactions.account': 'Konto',
  'transactions.fromAccount': 'Quellkonto',
  'transactions.toAccount': 'Zielkonto',
  'transactions.fromAmount': 'Gesendeter Betrag',
  'transactions.toAmount': 'Empfangener Betrag',
  'transactions.actualRate': 'Tatsächlicher Kurs',
  'transactions.fee': 'Gebühr',
  'transactions.feeCategory': 'Gebührenkategorie',
  'transactions.optional': 'Optional',
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
    'Gib einen gültigen Ausdruck ein, der einen positiven Betrag bis 90.071.992.547.409,91 ergibt. Division durch null ist nicht erlaubt.',
  'transactions.error.payee':
    'Gib einen Zahlungspartner mit höchstens 100 Zeichen ein.',
  'transactions.error.category':
    'Wähle eine aktive Kategorie, die zu Ausgabe oder Einnahme passt.',
  'transactions.error.note': 'Gib eine Notiz mit höchstens 1.000 Zeichen ein.',
  'transactions.error.notFound':
    'Die Transaktion wurde nicht gefunden. Aktualisiere die Liste.',
  'transactions.error.lines':
    'Die Transaktionszeilen entsprechen nicht dem Gesamtbetrag.',
  'splits.split': 'Aufteilen',
  'splits.unsplit': 'Auf einen Teil zurücksetzen',
  'splits.remaining': 'Verbleibender Betrag',
  'splits.part': 'Teil',
  'splits.remove': 'Teil entfernen',
  'splits.addPart': 'Teil hinzufügen',
  'splits.indicator': 'Aufgeteilt',
  'tags.title': 'Tags',
  'tags.all': 'Alle Tags',
  'tags.manage': 'Tags verwalten',
  'tags.empty': 'Erstelle Tags im Transaktionsformular.',
  'tags.name': 'Tag-Name',
  'tags.rename': 'Umbenennen',
  'tags.delete': 'Tag löschen',
  'tags.save': 'Tag speichern',
  'tags.add': 'Tag hinzufügen',
  'tags.remove': 'Tag entfernen',
  'tags.hint':
    'Wähle ein vorhandenes Tag oder gib ein neues ein. Drücke Enter oder Tag hinzufügen; neue Tags werden beim Speichern erstellt.',
  'tags.deleteConfirmation':
    'Dieses Tag löschen und von allen Transaktionen entfernen?',
  'tags.error.name': 'Tag-Namen müssen zwischen 1 und 100 Zeichen lang sein.',
  'tags.error.notFound':
    'Das Tag wurde nicht gefunden. Aktualisiere die Liste.',
  'tags.error.duplicate': 'Ein Tag mit diesem Namen existiert bereits.',
  'undo.available': 'Änderung gespeichert.',
  'transfers.error.accountsDiffer': 'Wähle zwei verschiedene Konten.',
  'transfers.error.equalAmounts':
    'Bei gleicher Währung müssen beide Beträge gleich sein.',
  'transfers.error.notFound':
    'Die Umbuchung wurde nicht gefunden. Aktualisiere die Liste.',
  'transfers.error.linkedFee':
    'Bearbeite oder lösche diese Gebühr über die zugehörige Umbuchung.',
  'undo.action': 'Rückgängig',
  'undo.error': 'Die Änderung konnte nicht rückgängig gemacht werden.',
  'accounts.title': 'Ein Platz für jedes Konto',
  'accounts.description':
    'Jeder Saldo kombiniert datierte Kontobewegungen und beobachtete Saldoabgleiche in der Kontowährung.',
  'accounts.create': 'Konto erstellen',
  'accounts.name': 'Kontoname',
  'accounts.currency': 'Währung',
  'accounts.openingBalance': 'Eröffnungssaldo',
  'accounts.openingDate': 'Eröffnungsdatum',
  'accounts.balance': 'Saldo',
  'accounts.balanceHint':
    'Verwende + - * /, Klammern, Punkt oder Komma als Dezimalzeichen und Tausendertrennzeichen. Verlassen des Feldes oder Enter berechnet das auf Hundertstel gerundete Endergebnis. Negative Salden und null sind erlaubt.',
  'accounts.empty': 'Erstelle ein Konto, um seinen Saldo zu verfolgen.',
  'accounts.loading': 'Konten werden geladen…',
  'accounts.rename': 'Umbenennen',
  'accounts.changeCurrency': 'Währung ändern',
  'accounts.archive': 'Archivieren',
  'accounts.unarchive': 'Dearchivieren',
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
    'Gib einen gültigen Ausdruck ein, der einen Saldo innerhalb von ±90.071.992.547.409,91 ergibt. Division durch null ist nicht erlaubt.',
  'accounts.error.date': 'Gib ein gültiges Eröffnungsdatum ein.',
  'accounts.error.notFound':
    'Das Konto wurde nicht gefunden. Aktualisiere die Liste.',
  'accounts.error.currencyLocked':
    'Die Währung kann bei Konten mit Transaktionen nicht geändert werden.',
  'accounts.error.notEmpty':
    'Dieses Konto hat Transaktionen und kann nicht gelöscht werden. Archiviere es stattdessen.',
  'settings.title': 'Fühl dich wie zu Hause',
  'settings.description':
    'Sprache, Darstellung, Basiswährung und Belegeingang werden für dieses Profil gespeichert und sofort übernommen.',
  'settings.baseCurrency': 'Basiswährung',
  'settings.version': 'App-Version',
  'settings.error':
    'Die Einstellungen konnten nicht gespeichert werden. Bitte versuche es erneut.',
  'watchedFolder.title': 'Überwachter Ordner',
  'watchedFolder.hint':
    'Jeder lokale Ordner außerhalb der Financial-Tracker-Daten funktioniert, auch ein mit Google Drive für Desktop oder OneDrive synchronisierter Ordner. Vollständig übertragene Belegfotos werden in den Unterordner feldolgozott verschoben.',
  'watchedFolder.error.userData':
    'Wähle einen Ordner außerhalb des Financial-Tracker-Datenordners.',
  'watchedFolder.current': 'Aktueller Ordner',
  'watchedFolder.none': 'Kein Ordner ausgewählt',
  'watchedFolder.status': 'Status',
  'watchedFolder.status.watching': 'Wird überwacht',
  'watchedFolder.status.unavailable': 'Ordner nicht verfügbar',
  'watchedFolder.choose': 'Ordner auswählen',
  'watchedFolder.clear': 'Entfernen',
  'watchedFolder.intakeFailure':
    'Ein überwachtes Belegfoto konnte nicht hinzugefügt werden',
  'watchedFolder.dismissFailure': 'Schließen',
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
  'backups.error.confirmation':
    'Bestätige die Wiederherstellung, bevor du fortfährst.',
  'backups.error.notFound':
    'Diese Sicherung ist nicht mehr verfügbar. Aktualisiere die Liste.',
  'backups.error.restore':
    'Die Sicherung konnte nicht wiederhergestellt werden; die vorherige Datenbank wurde erneut geöffnet.',
  'backups.error.recovery':
    'Die Wiederherstellung ist fehlgeschlagen. Starte die App neu.',
  'backups.error.create':
    'Die Startsicherung konnte nicht erstellt und geprüft werden.',
  'backups.error.invalid':
    'Die ausgewählte Sicherung ist beschädigt oder ungültig.',
  'backups.error.foreign':
    'Die ausgewählte Sicherung gehört zu einem anderen Profil.',
  'backups.error.newerSchema':
    'Die ausgewählte Sicherung benötigt eine neuere App-Version.',
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
  'phoneUpload.title': 'Vom Handy hochladen',
  'phoneUpload.starting': 'Privater Netzwerk-Upload wird gestartet…',
  'phoneUpload.noPrivateNetwork':
    'Keine Verbindung mit einem privaten Netzwerk. Verbinde diesen PC mit deinem privaten WLAN und versuche es erneut.',
  'phoneUpload.error':
    'Der Handy-Upload konnte nicht gestartet werden. Versuche es erneut.',
  'phoneUpload.interface': 'Private Netzwerkverbindung',
  'phoneUpload.qrAlt': 'QR-Code für die Handy-Upload-Adresse',
  'phoneUpload.address': 'Oder öffne diese Adresse auf dem Handy',
  'phoneUpload.expiresIn': 'Automatischer Stopp in {time}',
  'phoneUpload.expired': 'Diese Upload-Sitzung wurde beendet.',
  'phoneUpload.uploaded': '{count} hochgeladen',
  'phoneUpload.firewallTitle': 'Windows-Firewall',
  'phoneUpload.firewallGuidance':
    'Windows fragt möglicherweise nach einer Freigabe für „Financial Tracker“. Erlaube sie nur in privaten Netzwerken. Wenn das Handy keine Verbindung herstellen kann, müssen beide Geräte dasselbe WLAN verwenden und das Windows-Netzwerk muss auf Privat eingestellt sein.',
  'phoneUpload.close': 'Schließen',
  'help.accessibleName': 'Hilfe',
  'help.page.profilePicker':
    'Ein Profil enthält die getrennten Finanzen einer Person. Wähle ein vorhandenes Profil oder erstelle ein neues; jedes Profil wird lokal in einer eigenen Datenbank gespeichert.',
  'help.profilePicker.profiles':
    'Öffne ein Profil, um seine getrennten Finanzen und Einstellungen zu verwenden. Du kannst es auch umbenennen oder seine lokalen Daten dauerhaft löschen.',
  'help.profilePicker.create':
    'Erstelle auf diesem PC ein Profil für einen weiteren getrennten Finanzbestand. Gib ihm einen erkennbaren Namen; du kannst ihn später ändern.',
  'help.page.overview':
    'Vergleiche Ausgaben, Einnahmen und Netto des laufenden Monats mit dem vollständigen Vormonat; ausgeschlossene Transaktionen bleiben außen vor. Beträge werden in deine Basiswährung umgerechnet, wenn ein Wechselkurs verfügbar ist.',
  'help.page.transactions':
    'Erfasse und prüfe Ausgaben, Einnahmen, Umbuchungen und Saldoabgleiche. Mit Filtern grenzt du die Liste und ihre Summen ein.',
  'help.page.receipts':
    'Belegfotos warten hier, bis du sie als Transaktionen bestätigst oder verwirfst. Die Texterkennung läuft lokal; prüfe vorausgefüllte Angaben immer.',
  'help.page.recurring':
    'Lege Ausgaben oder Einnahmen fest, die sich nach einem Zeitplan wiederholen. Fällige Vorkommen werden ausstehend und wirken sich erst nach deiner Bestätigung auf die Finanzen aus.',
  'help.page.reports':
    'Untersuche Ausgaben und Einnahmen in deiner Basiswährung; ausgeschlossene Transaktionen bleiben außen vor. Beträge ohne Wechselkurs bleiben separat und fließen nicht in umgerechnete Diagramme oder Summen ein.',
  'help.page.accounts':
    'Ein Konto ist ein Ort, an dem Geld in genau einer Währung gehalten wird. Sein Saldo ergibt sich aus Anfangssaldo, datierten Bewegungen und Saldoabgleichen.',
  'help.page.settings':
    'Die meisten Einstellungen gelten für das aktuelle Profil. Das Tastenkürzel für Schnellerfassung und die Einstellung Mit Windows starten gelten für alle Profile dieses Windows-Kontos.',
  'help.page.quickAdd':
    'Erfasse eine Ausgabe oder Einnahme im aktiven Profil, ohne das Hauptfenster zu öffnen. Wähle das Konto, prüfe die Angaben und speichere.',
  'help.overview.expenses':
    'Bisherige Ausgaben dieses Monats ohne ausgeschlossene Transaktionen, verglichen mit dem vollständigen Vormonat. Über Transaktionen anzeigen öffnest du die passenden Transaktionen.',
  'help.overview.incomes':
    'Bisherige Einnahmen dieses Monats ohne ausgeschlossene Transaktionen, verglichen mit dem vollständigen Vormonat. Über Transaktionen anzeigen öffnest du die passenden Transaktionen.',
  'help.overview.net':
    'Einnahmen minus Ausgaben für den jeweiligen Zeitraum. Umbuchungen, Saldoabgleiche und ausgeschlossene Transaktionen ändern diesen Betrag nicht.',
  'help.overview.topCategories':
    'Die fünf Ausgabenkategorien mit den höchsten umgerechneten Summen in diesem Monat, ohne ausgeschlossene Transaktionen. Wähle eine Kategorie, um ihre Transaktionen zu öffnen.',
  'help.transactions.filters':
    'Filter ändern die angezeigten Transaktionen und die Summen über der Liste. Wende sie vor dem Export an; der CSV-Export verwendet alle Treffer, nicht nur die aktuelle Seite.',
  'help.transactions.excluded':
    'Eine ausgeschlossene Transaktion ändert weiterhin den Kontosaldo, bleibt aber aus Einnahmen-, Ausgabensummen und Berichten heraus. Nutze dies etwa für später erstattete Ausgaben.',
  'help.transactions.templates':
    'Eine Transaktionsvorlage speichert wiederverwendbare vorausgefüllte Angaben. Wähle eine zum Ausfüllen oder erstelle eine Vorlage für häufig gemeinsam eingegebene Felder.',
  'help.transactions.duplicate':
    'Duplizieren speichert sofort eine neue, auf heute datierte Transaktion mit den ursprünglichen Angaben und Tags. Nutze Rückgängig, wenn du die Kopie nicht behalten möchtest.',
  'help.transactions.balanceAdjustment':
    'Erfasse den tatsächlich beobachteten Kontosaldo am Ende eines Tages. Die App berechnet die Differenz aus dem Kontoverlauf neu, ohne sie als Ausgabe oder Einnahme zu zählen.',
  'help.transactions.csvExport':
    'Exportiert Ausgaben und Einnahmen, die den angewendeten Filtern entsprechen. Teile einer Aufteilung werden eigene Zeilen; Umbuchungen und Saldoabgleiche werden nicht exportiert.',
  'help.transactions.csvSeparator':
    'Wähle, wie Dezimalstellen für dein Tabellenprogramm geschrieben werden. Beim Punkt trennen Kommas die Felder, beim Komma Semikolons, damit es eindeutig bleibt.',
  'help.transactions.amountCalculator':
    'Du kannst eine Rechnung mit + - * / und Klammern eingeben. Beim Verlassen des Feldes oder mit Enter wird sie berechnet und das Endergebnis auf Hundertstel gerundet.',
  'help.transactions.split':
    'Eine Aufteilung teilt eine Transaktion in Teile mit eigenen Beträgen, Kategorien, Tags und Notizen. Die Teile müssen zusammen den Gesamtbetrag ergeben.',
  'help.transactions.transfer':
    'Eine Umbuchung verschiebt Geld zwischen zwei Konten und ist weder Ausgabe noch Einnahme. Bei verschiedenen Währungen gibst du beide tatsächlichen Beträge ein; die App leitet den Kurs daraus ab.',
  'help.transactions.transferFee':
    'Eine Umbuchungsgebühr wird als eigene Ausgabe im Quellkonto erfasst. Wähle ihre Kategorie und schließe sie nur aus, wenn sie nicht in Berichte einfließen soll.',
  'help.transactions.tags':
    'Tags gruppieren Transaktionen unabhängig von ihren Kategorien. Füge vorhandene oder neue Tags hinzu; unter Tags verwalten kannst du sie umbenennen oder löschen.',
  'help.transactions.tagsBasic':
    'Tags gruppieren Transaktionen unabhängig von ihren Kategorien. Wähle ein vorhandenes Tag oder gib ein neues ein.',
  'help.transactions.attachments':
    'Anhänge werden in dieses Profil kopiert und bei der Transaktion aufbewahrt. Entfernen trennt die Datei ab; Rückgängig stellt sie wieder her. Eine nicht mehr referenzierte Datei kann später bereinigt werden.',
  'help.transactions.drawer':
    'Erfasse oder bearbeite hier eine Ausgabe, Einnahme oder Umbuchung. Enter speichert in einem einzeiligen Feld; Strg+Enter speichert und öffnet ein neues Formular.',
  'help.receipts.phoneUpload':
    'Startet vorübergehend eine Upload-Seite für ein Handy im selben privaten WLAN. Während der Sitzung kann jeder mit der Adresse auf Uploads zugreifen; nutze daher nur ein vertrauenswürdiges privates Netzwerk und schließe sie danach.',
  'help.recurring.pending':
    'Ausstehende Transaktionen sind fällige Vorkommen, die auf deine Entscheidung warten. Bestätige sie, ändere zuvor Betrag oder Datum oder überspringe dieses Vorkommen.',
  'help.recurring.definitions':
    'Definitionen enthalten die wiederverwendeten Angaben und den Zeitplan wiederkehrender Transaktionen. Pausieren verhindert neue ausstehende Vorkommen; beim Fortsetzen werden inzwischen vergangene Termine übersprungen.',
  'help.recurring.editor':
    'Lege Transaktionsangaben und Zeitplan für künftige Vorkommen fest. Für Daten vor der Erstellung der Definition wird kein Vorkommen erzeugt.',
  'help.recurring.schedule':
    'Wähle Wiederholungsabstand und Kalendertag. Ein optionales Enddatum verhindert weitere Vorkommen nach diesem Datum.',
  'help.reports.dateRange':
    'Wähle die Daten für Kategorie-, Monatstrend- und Geldflussberichte. Das Ausgabentempo vergleicht immer diesen Monat mit den drei vorherigen Kalendermonaten.',
  'help.reports.category':
    'Ausgaben werden nach Hauptkategorie in deiner Basiswährung gruppiert; ausgeschlossene Transaktionen bleiben außen vor. Wähle erst eine Haupt- und dann eine Unterkategorie, um die passenden Transaktionen zu öffnen.',
  'help.reports.trend':
    'Vergleiche monatliche Ausgaben, Einnahmen und Netto; ausgeschlossene Transaktionen bleiben außen vor. Teilmonate enthalten nur Tage innerhalb des gewählten Zeitraums.',
  'help.reports.pace':
    'Vergleicht die bisherigen Ausgaben dieses Monats ohne ausgeschlossene Transaktionen mit dem Durchschnitt der drei vorherigen Kalendermonate bis zum gleichen Tag. Kürzere Monate werden bis zu ihrem letzten Tag verglichen.',
  'help.reports.cashFlow':
    'Zeigt, wie umgerechnete Einnahmekategorien in Ausgabenkategorien fließen. Die Differenz zwischen Einnahmen und Ausgaben erscheint als Ersparnis oder Defizit; nicht umgerechnete Beträge bleiben separat.',
  'help.reports.breakdown':
    'Wähle eine Hauptkategorie, um ihre Unterkategorien zu sehen. Eine Unterkategorie öffnet die Ausgabentransaktionen hinter dieser Summe; ausgeschlossene Transaktionen bleiben außen vor.',
  'help.accounts.create':
    'Erstelle für jeden Ort und jede Währung, an dem du Geld hältst, ein Konto. Lege Saldo und Datum fest, ab dem sein Verlauf beginnen soll.',
  'help.accounts.currency':
    'Jedes Konto hat genau eine Währung. Du kannst sie nur ändern, solange das Konto keine Transaktionen, Umbuchungen oder Saldoabgleiche hat.',
  'help.accounts.openingBalance':
    'Der Anfangssaldo ist der Kontosaldo zu Beginn seines Verlaufs am Eröffnungsdatum. Er darf positiv, null oder negativ sein; du kannst auch eine Rechnung in das Feld eingeben.',
  'help.accounts.archive':
    'Archivieren blendet ein Konto aus Eingabelisten aus, ohne Verlauf oder Saldo zu löschen. Hebe die Archivierung auf, wenn du es wieder verwenden möchtest.',
  'help.settings.categories':
    'Kategorien ordnen Ausgaben oder Einnahmen auf höchstens zwei Ebenen: Haupt- und Unterkategorie. Sortiere oder archiviere sie, ohne bestehende Transaktionsverläufe zu ändern.',
  'help.settings.payees':
    'Ein Zahlungspartner ist der vereinheitlichte Name einer Transaktion. Füge Aliasse für rohe oder alternative Namen hinzu; beim Zusammenführen wechseln Transaktionen und Aliasse zum verbleibenden Zahlungspartner.',
  'help.settings.rules':
    'Regeln füllen bei passenden Transaktionen Zahlungspartner, Kategorie oder Tags automatisch vor. Sie laufen der Reihe nach; die erste passende Regel gewinnt.',
  'help.settings.ruleAmountCurrency':
    'Betragsgrenzen werden in dieser Währung verglichen. Hat die Regel eine Kontobedingung, wird automatisch dessen Währung verwendet.',
  'help.settings.backups':
    'Wiederherstellen ersetzt die aktuellen Profildaten durch die gewählte Sicherung; Änderungen seit dieser Sicherung gehen verloren.',
  'help.settings.watchedFolder':
    'Nachdem ein Foto vollständig kopiert wurde, verschiebt die App es zuerst in den Unterordner feldolgozott und importiert es dann in den Belegeingang. Schlägt der Import fehl, bleibt die Datei dort und ein Hinweis erscheint.',
  'help.settings.shortcut':
    'Dieses systemweite Tastenkürzel öffnet Schnellerfassung auch bei ausgeblendetem Hauptfenster und gilt für alle Profile dieses Windows-Kontos. Fokussiere das Kürzelfeld und drücke die gewünschte Tastenkombination.',
  'help.settings.autostart':
    'Diese Einstellung ist standardmäßig aus. Wenn sie aktiv ist, startet Financial Tracker bei der Windows-Anmeldung ausgeblendet im Infobereich. Sie gilt für alle Profile dieses Windows-Kontos.',
  'help.settings.baseCurrency':
    'Berichte rechnen andere Währungen mit dem Kurs des jeweiligen Tages in diese Währung um. Eine Änderung betrifft die Berichtsanzeige, nicht gespeicherte Kontobeträge.',
  'help.settings.exchangeRates':
    'Die App lädt offizielle MNB-Kurse herunter und speichert sie lokal. Daten nach dem gespeicherten Abdeckungszeitraum verwenden den letzten gespeicherten Kurs und werden als vorläufig markiert. Nur Beträge ohne früher veröffentlichten Kurs bleiben unumgerechnet.',
  'help.settings.privacy':
    'Der Privatmodus verbirgt angezeigte Beträge und verschleiert Diagrammwerte, ohne gespeicherte Daten zu ändern. Schalte ihn überall mit Strg+Umschalt+H um.',
  'help.settings.formattingPreview':
    'Diese Vorschau zeigt, wie die gewählte Sprache Daten und Zahlen formatiert. Gespeicherte Werte ändern sich nicht.',
} satisfies MessageCatalog
