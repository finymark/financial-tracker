import { desktopMessages } from '../../../shared/desktop-translations'
import { csvMessages } from '../../../shared/csv-translations'
import { categoryNames } from '../../../shared/category-translations'
import type { MessageCatalog } from './en'

export const hu = {
  ...desktopMessages.hu,
  'privacy.toggle': 'Privát mód',
  'privacy.hiddenAmount': 'Rejtett összeg',
  'privacy.shortcutScope':
    'A privát mód gépelés közben is bárhol működik (Ctrl+Shift+H).',
  'quickAdd.title': 'Gyors rögzítés',
  'quickAdd.noProfiles':
    'Tranzakció rögzítése előtt hozz létre egy profilt a főablakban.',
  'quickAdd.noAccounts':
    'Tranzakció rögzítése előtt hozz létre egy számlát a főablakban.',
  'quickAdd.saved': 'Elmentve.',
  'quickAdd.loading': 'Gyors rögzítés előkészítése…',

  'shortcuts.closeHelp': 'Billentyűsúgó bezárása',
  'transactions.saveAndAddAnother': 'Mentés és újabb hozzáadása',
  'shortcuts.scope':
    'Nyitott profilban: az új tranzakció és a visszavonás szövegbevitelen kívül működik. A típusváltás és a mentés a tranzakcióablakban használható.',
  'shortcuts.navigation':
    'A Tab / Shift+Tab a mezők között lépked, és a nyitott párbeszédablakban marad.',
  'shortcuts.undo': 'Legutóbbi módosítás visszavonása (szövegbevitelen kívül)',
  'shortcuts.close': 'Mégse / tranzakcióablak vagy billentyűsúgó bezárása',
  'shortcuts.help': 'Billentyűparancsok',
  'shortcuts.save':
    'Mentés (többsoros jegyzetben nem; a gombok saját művelete megmarad)',
  'shortcuts.saveAndAddAnother':
    'Mentés és újabb hozzáadása (dátum, számlák és típus megtartása)',
  'shortcuts.newTransaction': 'Új tranzakció (szövegbevitelen kívül)',
  ...categoryNames.hu,
  ...csvMessages.hu,
  'csv.description':
    'Az alkalmazott szűrőknek megfelelő összes tranzakció exportálása, nem csak az aktuális oldalé. Minden felosztott rész külön sor. Az átvezetések és az egyenlegkorrekciók nem kerülnek az exportba.',
  'csv.decimalSeparator': 'Tizedesjel',
  'csv.profileDefault': 'A profil nyelvének alapértelmezése',
  'csv.dot': 'Pont (123.45) · vesszővel elválasztott mezők',
  'csv.comma': 'Vessző (123,45) · pontosvesszővel elválasztott mezők',
  'csv.saving': 'CSV mentése…',
  'csv.saved': 'CSV elmentve.',
  'csv.error': 'A CSV mentése nem sikerült. Próbáld újra.',
  'csv.error.separator': 'Válassz pontot vagy vesszőt tizedesjelként.',

  'rules.title': 'Kategorizálási szabályok',
  'rules.description':
    'A szabályokat sorrendben ellenőrizzük. Az első egyező szabály nyer, és a kedvezményezettet, a kategóriát, valamint a címkéket az utoljára használt értékek előtt töltheti ki.',
  'rules.loading': 'Szabályok betöltése…',
  'rules.empty': 'Még nincs kategorizálási szabály.',
  'rules.offer': 'Létrehozol egy szabályt ehhez a besoroláshoz?',
  'rules.offerDismiss': 'Elvetés',
  'rules.create': 'Szabály létrehozása',
  'rules.edit': 'Szerkesztés',
  'rules.delete': 'Törlés',
  'rules.save': 'Szabály mentése',
  'rules.enabled': 'Engedélyezve',
  'rules.disabled': 'Letiltva',
  'rules.up': 'Szabály feljebb',
  'rules.down': 'Szabály lejjebb',
  'rules.anyPayee': 'Bármely kedvezményezett',
  'rules.textContains': 'A jegyzet tartalmazza',
  'rules.account': 'Számlafeltétel',
  'rules.anyAccount': 'Bármely számla',
  'rules.minimum': 'Legkisebb összeg',
  'rules.maximum': 'Legnagyobb összeg',
  'rules.amountCurrency': 'Összeg pénzneme',
  'rules.amountCondition': 'Összegfeltétel',
  'rules.payeeAction': 'Kedvezményezett beállítása',
  'rules.noPayeeAction': 'Ne állítson be kedvezményezettet',
  'rules.noCategory': 'Ne állítson be kategóriát',
  'rules.noTags': 'Előbb hozzon létre címkét egy tranzakcióban.',
  'rules.action': 'Művelet',
  'rules.formHint':
    'Válasszon legalább egy feltételt és egy műveletet: kedvezményezettet, kategóriát vagy címkét.',
  'rules.amountHint':
    'Nem kötelező, zárt összeghatár a szabály kiválasztott pénznemében.',
  'rules.error': 'A szabályművelet nem hajtható végre. Próbálja újra.',
  'rules.error.notFound': 'A szabály nem található. Frissítse a listát.',
  'rules.error.condition': 'Válasszon legalább egy szabályfeltételt.',
  'rules.error.text': 'Legfeljebb 1000 karakter keresett szöveget adjon meg.',
  'rules.error.amount': 'Adjon meg érvényes, nem negatív összeget.',
  'rules.error.amountRange':
    'A legkisebb összeg nem lehet nagyobb a legnagyobb összegnél.',
  'rules.error.action':
    'Válasszon kedvezményezettet, kategóriát és/vagy legalább egy címkét.',
  'rules.error.reference':
    'Létező, aktív kedvezményezettet, számlát, kategóriát és címkét válasszon.',
  'rules.error.order': 'Válasszon érvényes szabálypozíciót.',
  'payees.title': 'Kedvezményezettek',
  'payees.description':
    'Az álnevek a nyers neveket egy kedvezményezetthez rendelik. Az egyezés nem tesz különbséget kis- és nagybetűk, illetve ékezetek között. Az összevonás a tranzakciókat és álneveket a megmaradó kedvezményezetthez helyezi át.',
  'payees.loading': 'Kedvezményezettek betöltése…',
  'payees.empty':
    'A kedvezményezettek egy tranzakció rögzítése után jelennek meg itt.',
  'payees.aliases': 'Álnevek',
  'payees.noAliases': 'Nincs álnév.',
  'payees.aliasName': 'Nyers kedvezményezettnév',
  'payees.addAlias': 'Álnév hozzáadása',
  'payees.removeAlias': 'Eltávolítás',
  'payees.mergeInto': 'Kedvezményezett összevonása ezzel:',
  'payees.chooseSurvivor': 'Válaszd ki a megmaradó kedvezményezettet',
  'payees.merge': 'Kedvezményezettek összevonása',
  'payees.mergeHint':
    'Minden tranzakció és álnév a megmaradó kedvezményezetthez kerül. A módosítás visszavonható.',
  'payees.refresh': 'Frissítés',
  'payees.error': 'A kedvezményezettművelet nem sikerült. Próbáld újra.',
  'payees.error.notFound':
    'A kedvezményezett nem található. Frissítsd a listát.',
  'payees.error.aliasNotFound': 'Az álnév nem található. Frissítsd a listát.',
  'payees.error.aliasName': 'Adj meg egy 1–100 karakter hosszú álnevet.',
  'payees.error.aliasConflict':
    'Ez a nyers név már egy kedvezményezetthez vagy álnévhez tartozik.',
  'payees.error.samePayee': 'Válassz másik megmaradó kedvezményezettet.',
  'payees.error.query': 'A kedvezményezett keresése érvénytelen.',
  'categories.title': 'Kategóriák',
  'categories.description':
    'A kiadási és bevételi kategóriák legfeljebb kétszintűek. Az alapértelmezett nevek követik a nyelvet; az egyéni nevek változatlanok maradnak. A főkategória archiválása az alkategóriáit is elrejti a választókból.',
  'categories.expense': 'Kiadás',
  'categories.income': 'Bevétel',
  'categories.loading': 'Kategóriák betöltése…',
  'categories.name': 'Kategória neve',
  'categories.kind': 'Kiadás vagy bevétel',
  'categories.parent': 'Főkategória',
  'categories.main': 'Nincs szülő (főkategória)',
  'categories.create': 'Kategória létrehozása',
  'categories.rename': 'Átnevezés',
  'categories.archive': 'Archiválás',
  'categories.unarchive': 'Visszaállítás',
  'categories.archived': 'Archivált — nem jelenik meg a kategóriaválasztókban',
  'categories.delete': 'Törlés',
  'categories.deleteConfirmation': 'Végleg törlöd ezt a kategóriát?',
  'categories.confirmDelete': 'Kategória végleges törlése',
  'categories.replacement': 'Helyettesítő kategória',
  'categories.chooseReplacement': 'Válassz helyettesítő kategóriát',
  'categories.noReplacement': 'Nincs helyettesítés (nem használt kategória)',
  'categories.save': 'Mentés',
  'categories.cancel': 'Mégse',
  'categories.refresh': 'Frissítés',
  'categories.up': 'Mozgatás felfelé',
  'categories.down': 'Mozgatás lefelé',
  'categories.error':
    'A kategóriaművelet nem sikerült. Frissíts és próbáld újra.',
  'categories.error.name': 'Adj meg egy 1–100 karakter hosszú kategórianevet.',
  'categories.error.kind': 'Válassz kiadást vagy bevételt.',
  'categories.error.notFound': 'A kategória nem található. Frissítsd a listát.',
  'categories.error.parent':
    'Válassz azonos típusú, aktív főkategóriát. A kategóriák legfeljebb kétszintűek.',
  'categories.error.order':
    'Válassz érvényes pozíciót az azonos szintű kategóriák között.',
  'categories.error.children':
    'A főkategória törlése előtt töröld az alkategóriáit.',
  'categories.error.replacementRequired':
    'Ehhez a kategóriához tranzakciók tartoznak. Válassz helyettesítőt a megőrzésükhöz.',
  'categories.error.replacement':
    'Válassz másik, azonos típusú, aktív helyettesítő kategóriát.',
  'updates.ready':
    'A frissítés letöltődött. A telepítéshez indítsa újra az alkalmazást.',
  'updates.restart': 'Újraindítás és frissítés',
  'updates.error': 'Nem sikerült újraindítani a frissítéshez. Próbálja újra.',
  'app.name': 'Financial Tracker',
  'app.tagline': 'Pénzügyeid a saját számítógépeden.',
  'rates.status.upToDate': 'Az árfolyamok naprakészek',
  'rates.status.stale': 'Az árfolyamok elavultak',
  'rates.status.missing': 'Hiányzik egy árfolyam',
  'rates.status.lastRefresh': 'Utolsó frissítés',
  'navigation.label': 'Fő navigáció',
  'navigation.overview': 'Áttekintés',
  'navigation.transactions': 'Tranzakciók',
  'navigation.receipts': 'Nyugta beérkezők',
  'navigation.recurring': 'Ismétlődő',
  'navigation.reports': 'Kimutatások',
  'navigation.accounts': 'Számlák',
  'navigation.settings': 'Beállítások',
  'receipts.title': 'Feldolgozásra váró nyugták',
  'receipts.description':
    'Ellenőrizd a behúzott nyugtafotókat, majd erősítsd meg őket tranzakcióként vagy vesd el őket.',
  'receipts.count': 'Nyugták a beérkezők között',
  'receipts.loading': 'Nyugta beérkezők betöltése…',
  'receipts.empty': 'Nincs feldolgozásra váró nyugtafotó.',
  'receipts.preview': 'Nyugtafotó előnézete',
  'receipts.back': 'Vissza a nyugta beérkezőkhöz',
  'receipts.confirm': 'Tranzakció megerősítése',
  'receipts.discard': 'Elvetés',
  'receipts.reading':
    'A nyugta olvasása folyamatban… Kézzel továbbra is kitölthető.',
  'receipts.ocrPrefilled': 'OCR-rel beolvasva',
  'receipts.ocrLowConfidence':
    'Az OCR bizonytalan. Ellenőrizd az összes előre kitöltött mezőt.',
  'receipts.currencyMismatch':
    'Nincs a felismert pénznemhez tartozó aktív számla:',
  'receipts.source.drop': 'Az alkalmazásba behúzva',
  'receipts.source.folder': 'Figyelt mappa',
  'receipts.source.phone': 'Telefonos feltöltés',
  'receipts.dropOverlay': 'Húzd ide a nyugtafotókat a beérkezőkhöz adáshoz',
  'receipts.dropProcessing': 'Nyugtafotók hozzáadása…',
  'receipts.error': 'A nyugtaművelet nem sikerült. Próbáld újra.',
  'receipts.error.type':
    'JPEG-, PNG- vagy WebP-képet húzz ide. PDF és más fájl nem adható a nyugta beérkezőkhöz.',
  'receipts.error.size': 'Egy nyugtafotó legfeljebb 25 MB lehet.',
  'receipts.error.path': 'A nyugtafotó nem olvasható.',
  'receipts.error.source': 'Válassz érvényes nyugtaforrást.',
  'receipts.error.notFound': 'A nyugta nem található. Frissítsd a listát.',
  'receipts.error.preview': 'A nyugta előnézete nem hozható létre.',
  'recurring.title': 'Ismétlődő tranzakciók',
  'recurring.definitions': 'Beállítások',
  'recurring.sections': 'Ismétlődő tranzakciók szakaszai',
  'recurring.fromTransaction': 'Ismétlődő tranzakció létrehozása',
  'recurring.fromTemplate': 'Ismétlődő létrehozása sablonból',
  'recurring.fromSplitHint':
    'Felosztott tranzakcióból nem hozható létre ismétlődő tranzakció.',
  'pending.title': 'Függőben',
  'pending.empty': 'Nincs függőben lévő tranzakció.',
  'pending.confirm': 'Megerősítés',
  'pending.editAndConfirm': 'Módosítás és megerősítés',
  'pending.skip': 'Kihagyás',
  'pending.overdue': 'Lejárt',
  'pending.dueCount': 'Esedékes függő tranzakciók',
  'pending.error.notFound':
    'A függő tranzakció nem található. Frissítsd a listát.',
  'pending.error.accountArchived':
    'Ez a számla archivált. Állítsd vissza a számlát az archívumból, vagy hagyd ki ezt az előfordulást.',
  'recurring.description':
    'Rendszeres kiadások és bevételek becslései. Az esedékes alkalmak függőben maradnak, és még nem módosítják a pénzügyi adatokat.',
  'recurring.create': 'Ismétlődő tranzakció létrehozása',
  'recurring.edit': 'Ismétlődő tranzakció szerkesztése',
  'recurring.save': 'Ismétlődő tranzakció mentése',
  'recurring.empty': 'Még nincs ismétlődő tranzakció.',
  'recurring.pause': 'Szüneteltetés',
  'recurring.resume': 'Folytatás',
  'recurring.paused': 'Szüneteltetve',
  'recurring.delete': 'Törlés',
  'recurring.deleteConfirmation':
    'Törli ezt az ismétlődő tranzakciót és minden függőben lévő alkalmát?',
  'recurring.nextDue': 'Következő esedékesség',
  'recurring.noNextDue': 'Nincs jövőbeli esedékesség',
  'recurring.creationHint':
    'A létrehozás előtti alkalmak nem jönnek létre. A folytatás kihagyja a szüneteltetés alatt elmúlt dátumokat.',
  'recurring.schedule.label': 'Ütemezés',
  'recurring.schedule.monthly': 'Havonta',
  'recurring.schedule.weekly': 'Hetente',
  'recurring.schedule.yearly': 'Évente',
  'recurring.every': 'minden',
  'recurring.months': 'hónap',
  'recurring.weeks': 'hét',
  'recurring.month': 'Hónap',
  'recurring.day': 'Nap',
  'recurring.weekday': 'A hét napja',
  'recurring.interval': 'Ismétlődési időköz',
  'recurring.startDate': 'Kezdő dátum',
  'recurring.endDate': 'Befejező dátum (nem kötelező)',
  'recurring.weekday.0': 'Vasárnap',
  'recurring.weekday.1': 'Hétfő',
  'recurring.weekday.2': 'Kedd',
  'recurring.weekday.3': 'Szerda',
  'recurring.weekday.4': 'Csütörtök',
  'recurring.weekday.5': 'Péntek',
  'recurring.weekday.6': 'Szombat',
  'recurring.error':
    'Az ismétlődő tranzakció nem menthető. Ellenőrizze az összes mezőt, majd próbálja újra.',
  'sidebar.collapse': 'Oldalsáv összecsukása',
  'sidebar.expand': 'Oldalsáv kinyitása',
  'sidebar.profile': 'Profilok',
  'sidebar.profileHint': 'A profilváltás később itt lesz elérhető.',
  'profilePicker.title': 'Válassz profilt',
  'profilePicker.description':
    'Minden profil pénzügyei külön helyi adatbázisban vannak.',
  'profilePicker.choose': 'Profilok',
  'profilePicker.empty': 'A kezdéshez hozd létre az első profilt.',
  'profile.loading': 'Profilok betöltése…',
  'profile.open': 'Profil megnyitása',
  'profile.create': 'Profil létrehozása',
  'profile.createDescription': 'Adj nevet ennek a külön pénzügyi profilnak.',
  'profile.name': 'Profil neve',
  'profile.rename': 'Átnevezés',
  'profile.renameLabel': 'Új profilnév',
  'profile.save': 'Név mentése',
  'profile.delete': 'Törlés',
  'profile.deleteDescription':
    'Ez végleg törli a profil adatbázisát és minden helyi adatát.',
  'profile.typeName': 'Megerősítésként írd be a profil nevét:',
  'profile.confirmDelete': 'Profil végleges törlése',
  'profile.cancel': 'Vissza a profilhoz',
  'profile.switch': 'Profilváltás',
  'profile.error': 'A profilműveletet nem sikerült végrehajtani.',
  'profiles.error.name': 'Adj meg egy 1–100 karakter hosszú profilnevet.',
  'profiles.error.notFound': 'A profil nem található. Frissítsd a listát.',
  'profiles.error.confirmation':
    'A törlés megerősítéséhez pontosan írd be a profil nevét.',
  'profiles.error.registryRead': 'A profillista nem olvasható.',
  'profiles.error.registryWrite': 'A profillista nem menthető.',
  'profiles.error.delete':
    'A profil biztonságos törlése nem sikerült; továbbra is elérhető.',
  'profiles.error.newerSchema':
    'Ezt a profilt újabb alkalmazásverzió nyitotta meg, ezért nem nyitható meg biztonságosan.',
  'profiles.error.migration':
    'A profil frissítése nem sikerült. A frissítés előtti adatbázis megmaradt.',
  'profiles.error.identity':
    'A profiladatbázis nem egyezik a kiválasztott profillal.',
  'overview.title': 'Pénzügyeid átláthatóan',
  'overview.description':
    'Az aktuális hónap eddigi összegei a teljes előző hónaphoz képest, az alapdevizában.',
  'overview.error': 'Az áttekintés betöltése nem sikerült.',
  'overview.expenses': 'Kiadások',
  'overview.incomes': 'Bevételek',
  'overview.net': 'Nettó',
  'overview.thisMonthToDate': 'Aktuális hónap a mai napig',
  'overview.fullLastMonth': 'Teljes előző hónap',
  'overview.change': 'Változás az előző hónaphoz képest',
  'overview.topCategories': 'A hónap 5 legnagyobb kiadási kategóriája',
  'overview.transactions': 'Tranzakciók megtekintése',
  'overview.reports': 'Kimutatások megtekintése',
  'overview.chartLabel': 'A hónap öt legnagyobb kiadási kategóriája',
  'overview.shareHint':
    'Az arányok az összes kategória átváltott kiadásain alapulnak, nem csak az első ötén. A nem átváltott összegek külön jelennek meg, és nem számítanak bele az arányokba.',
  'reports.trend.title': 'Havi trend',
  'reports.trend.description':
    'Kiadások, bevételek és egyenleg az alapdevizában.',
  'reports.trend.partial': 'részleges',
  'reports.trend.partialHint':
    'A részleges hónapok csak a kiválasztott tartomány napjait tartalmazzák.',
  'reports.trend.unconvertedHint':
    'Az árfolyam nélküli összegek nem szerepelnek a diagramon. Az alábbi táblázat havonta külön mutatja őket.',
  'reports.trend.chartLabel': 'Havi kiadások és bevételek egyenlegvonallal',
  'reports.trend.month': 'Hónap',
  'reports.trend.expenses': 'Kiadások',
  'reports.trend.incomes': 'Bevételek',
  'reports.trend.net': 'Egyenleg',
  'reports.pace.title': 'Költési ütem',
  'reports.pace.description':
    'Az eddigi havi kiadások összehasonlítása az előző három naptári hónap azonos napig számított átlagával, a hónap hosszához igazítva.',
  'reports.pace.current': 'Eddigi havi kiadások',
  'reports.pace.average': 'Háromhavi átlag',
  'reports.pace.difference': 'A szokásos költéshez képest',
  'reports.pace.ahead': 'Előrébb',
  'reports.pace.behind': 'Lemaradva',
  'reports.pace.onPace': 'Azonos ütemben',
  'reports.pace.noBaseline': 'Nincs alap a százalékhoz',
  'reports.pace.partial':
    'Részleges összehasonlítás: egyes összegek nem válthatók át. Az érintett hónapok alább láthatók.',
  'reports.pace.months': 'Összehasonlított hónapok',
  'reports.pace.refresh': 'Ütem frissítése',
  'reports.pace.chartLabel': 'Eddigi havi kiadások a háromhavi átlaghoz képest',
  'reports.title': 'Kiadások kategóriánként',
  'reports.description':
    'Hasonlítsa össze a kategóriák összegeit az alapdevizában, és tekintse meg a mögöttes tranzakciókat.',
  'reports.heading': 'Kimutatások az alapdevizában',
  'reports.introduction':
    'Kategóriák, havi trendek és pénzáramlás a választott dátumtartományban, vagy az aktuális hónap költési ütemének összehasonlítása.',
  'reports.view': 'Kimutatás nézete',
  'reports.cashFlow.title': 'Pénzáramlás',
  'reports.cashFlow.income': 'Bevétel',
  'reports.cashFlow.expense': 'Kiadások',
  'reports.cashFlow.uncategorizedIncome': 'Kategorizálatlan bevétel',
  'reports.cashFlow.uncategorizedExpense': 'Kategorizálatlan kiadás',
  'reports.cashFlow.deficit': 'Megtakarításból / hiány',
  'reports.cashFlow.surplus': 'Megtakarítva / többlet',
  'reports.cashFlow.empty':
    'Ebben a dátumtartományban nincs átváltott bevétel vagy kiadás.',
  'reports.cashFlow.description':
    'A bevételi kategóriák a Bevétel csomóponton át a kiadási kategóriákhoz áramlanak. A megtakarítás kiegyenlíti az átváltott összegeket; a nem átváltott összegek külön szerepelnek.',
  'reports.cashFlow.rounding':
    'Az áramlások kerekített kategóriaösszegeket használnak; összegük kissé eltérhet az egyszer kerekített teljes időszaki összegtől.',
  'reports.dateRange': 'Kimutatás dátumtartománya',
  'reports.period.thisMonth': 'Ez a hónap',
  'reports.period.lastMonth': 'Előző hónap',
  'reports.period.thisYear': 'Ez az év',
  'reports.period.last12Months': 'Utolsó 12 hónap',
  'reports.period.custom': 'Egyéni tartomány',
  'reports.apply': 'Tartomány alkalmazása',
  'reports.loading': 'Kimutatás betöltése…',
  'reports.error': 'A kimutatás nem tölthető be. Próbáld újra.',
  'reports.error.range':
    'Adj meg érvényes dátumtartományt: a kezdete nem lehet 1900-01-01 előtti, és legfeljebb 100 év lehet.',
  'reports.total': 'Összes kiadás',
  'reports.provisional': 'ideiglenes árfolyamok',
  'reports.chartType': 'Diagram típusa',
  'reports.pie': 'Kördiagram',
  'reports.bar': 'Oszlopdiagram',
  'reports.unconverted': 'Nem átváltott',
  'reports.empty': 'Ebben a dátumtartományban nincs beszámított kiadás.',
  'reports.chartLabel': 'Kiadások kategóriadiagramja',
  'reports.categories': 'Főkategóriák',
  'reports.subcategories': 'Alkategóriák',
  'reports.amount': 'Összeg',
  'reports.share': 'Arány',
  'reports.uncategorized': 'Kategorizálatlan',
  'reports.back': 'Vissza a főkategóriákhoz',
  'reports.drillHint':
    'Válasszon főkategóriát, majd alkategóriát a tranzakciók megnyitásához.',
  'reports.transactionFilter': 'Kimutatásból:',
  'reports.transactionFilter.expense': 'csak kiadások',
  'reports.transactionFilter.income': 'csak bevételek',
  'reports.transactionFilter.exactCategory': 'alkategóriák nélkül',
  'reports.transactionFilter.clear': 'Minden típus és alkategória mutatása',
  'transactions.title': 'Tranzakcióid egy helyen',
  'transactions.description':
    'Rögzítsd kiadásaidat, bevételeidet és átvezetéseidet, hogy a számlaegyenlegek naprakészek legyenek.',
  'transactions.listDescription':
    'Szűrd a tranzakciókat időszak, számla, kategória, partner, címke vagy megjegyzés szerint.',
  'adjustments.setRealBalance': 'Valós egyenleg beállítása',
  'adjustments.edit': 'Egyenlegkorrekció szerkesztése',
  'adjustments.save': 'Egyenlegkorrekció mentése',
  'adjustments.deleteConfirmation':
    'Végleg törlöd ezt az egyenlegkorrekciót? A számlaegyenleg frissülni fog.',
  'adjustments.confirmDelete': 'Egyenlegkorrekció törlése',
  'adjustments.rowType': 'Egyenlegkorrekció',
  'adjustments.observedBalance': 'Megfigyelt egyenleg',
  'adjustments.difference': 'Aktuális eltérés',
  'adjustments.zeroDifference': 'Nincs szükség korrekcióra',
  'adjustments.zeroDifferenceHint':
    'Ez a korrekció már semmit sem korrigál, ezért törölhető.',
  'adjustments.error.account': 'Válassz aktív számlát.',
  'adjustments.error.date': 'Adj meg érvényes naptári dátumot.',
  'adjustments.error.futureDate':
    'Az egyenleg megfigyelésének dátuma nem lehet jövőbeli.',
  'adjustments.error.balance':
    'Adj meg érvényes egyenleget ±90 071 992 547 409,91 határon belül.',
  'adjustments.error.note':
    'Legfeljebb 1000 karakter hosszú megjegyzést adj meg.',
  'adjustments.error.notFound':
    'Az egyenlegkorrekció nem található. Frissítsd a listát.',
  'transactions.excluded': 'Kizárt',
  'transactions.excludedHint':
    'A számla egyenlegébe beleszámít, de a kiadások és bevételek összesítéséből kimarad.',
  'transactions.exclusion': 'Kizárt tranzakciók',
  'transactions.exclusion.all': 'Minden tranzakció',
  'transactions.exclusion.onlyExcluded': 'Csak a kizártak',
  'transactions.exclusion.hideExcluded': 'Kizártak elrejtése',
  'transactions.error.excluded': 'Válaszd ki, hogy a tranzakció kizárt-e.',
  'transactions.filters': 'Tranzakciószűrők',
  'transactions.period': 'Időszak',
  'transactions.period.all': 'Összes dátum',
  'transactions.period.thisMonth': 'Ez a hónap',
  'transactions.period.lastMonth': 'Előző hónap',
  'transactions.period.thisYear': 'Ez az év',
  'transactions.period.custom': 'Egyéni időszak',
  'transactions.from': 'Kezdete',
  'transactions.to': 'Vége',
  'transactions.allAccounts': 'Összes számla',
  'transactions.allCategories': 'Összes kategória',
  'transactions.allPayees': 'Összes partner',
  'transactions.search': 'Partner vagy megjegyzés',
  'transactions.applyFilters': 'Szűrés',
  'transactions.filteredTotals': 'Szűrt összegek',
  'transactions.baseTotal': 'Összesen alapdevizában',
  'transactions.unconverted': 'Átváltatlan',
  'transactions.provisional': 'ideiglenes',
  'transactions.matches': 'tranzakció',
  'transactions.noMatches': 'Nincs a szűrőknek megfelelő tranzakció.',
  'transactions.previousPage': 'Előző oldal',
  'transactions.nextPage': 'Következő oldal',
  'transactions.actions': 'Műveletek',
  'transactions.error.filters':
    'Válassz érvényes szűrőket és helyes dátumtartományt.',
  'transactions.error.totals':
    'A szűrt összeg túl nagy a pontos megjelenítéshez.',
  'transactions.duplicate': 'Tranzakció másolása',
  'templates.title': 'Tranzakciós sablonok',
  'templates.choose': 'Válassz sablont',
  'templates.use': 'Sablon használata',
  'templates.create': 'Sablon létrehozása',
  'templates.edit': 'Sablon szerkesztése',
  'templates.delete': 'Sablon törlése',
  'templates.save': 'Sablon mentése',
  'templates.name': 'Sablon neve',
  'templates.saveTransaction': 'Mentés sablonként',
  'templates.savedTransactionHint':
    'A mentett tranzakciót használja, nem az űrlap nem mentett módosításait.',
  'templates.optionalHint':
    'Csak a név kötelező. A többi mezőt üresen hagyhatod, és a sablon használatakor töltheted ki.',
  'templates.tagsHint':
    'Soronként egy címkenév. A hiányzó címkék a sablon mentésekor jönnek létre.',
  'templates.deleteConfirmation': 'Törlöd ezt a tranzakciós sablont?',
  'templates.amountRequired':
    'A tranzakció mentése előtt adj meg egy összeget.',
  'templates.error.name': 'Adj meg egy 1–100 karakter hosszú sablonnevet.',
  'templates.error.split': 'Felosztott tranzakció nem menthető sablonként.',
  'templates.error.notFound':
    'A tranzakciós sablon nem található. Frissítsd a listát.',
  'transactions.create': 'Tranzakció rögzítése',
  'transactions.edit': 'Tranzakció szerkesztése',
  'transactions.delete': 'Törlés',
  'transactions.deleteConfirmation':
    'Végleg törlöd ezt a tranzakciót? A számla egyenlege frissülni fog.',
  'transactions.confirmDelete': 'Tranzakció törlése',
  'attachments.title': 'Mellékletek',
  'attachments.add': 'Hozzáadás',
  'attachments.drop': 'Húzz ide JPEG-, PNG-, WebP- vagy PDF-fájlokat.',
  'attachments.empty': 'Nincs melléklet.',
  'attachments.open': 'Megnyitás',
  'attachments.remove': 'Eltávolítás',
  'attachments.deleteWithTransaction': 'Tranzakció és mellékleteinek törlése',
  'attachments.saveCopiesAndDelete':
    'Mellékletmásolatok mentése mappába…, majd törlés',
  'attachments.error.type':
    'JPEG-, PNG-, WebP- vagy PDF-fájlt válassz. A fájltípust a tartalom alapján ellenőrizzük.',
  'attachments.error.size': 'Egy melléklet legfeljebb 25 MB lehet.',
  'attachments.error.path': 'A kiválasztott fájl nem olvasható.',
  'attachments.error.store': 'A melléklet nem másolható ebbe a profilba.',
  'attachments.error.staged': 'Az előkészített melléklet már nem érhető el.',
  'attachments.error.notFound':
    'A melléklet nem található. Frissítsd a tranzakciót.',
  'attachments.error.copy':
    'A mellékletmásolatok nem menthetők ebbe a mappába.',
  'attachments.error.open': 'A melléklet nem nyitható meg.',
  'transactions.cancel': 'Mégse',
  'transactions.close': 'Tranzakciós panel bezárása',
  'transactions.save': 'Tranzakció mentése',
  'transactions.loading': 'Tranzakciók betöltése…',
  'transactions.empty': 'Még nincs rögzített tranzakció.',
  'transactions.noAccounts':
    'Tranzakció rögzítése előtt hozz létre egy aktív számlát.',
  'transactions.refresh': 'Frissítés',
  'transactions.kind': 'Tranzakció típusa',
  'transactions.expense': 'Kiadás',
  'transactions.income': 'Bevétel',
  'transactions.transfer': 'Átvezetés',
  'transactions.date': 'Dátum',
  'transactions.amount': 'Összeg',
  'amount.result': 'Kiszámított összeg',
  'transactions.amountHint':
    'Használhatsz + - * / műveleteket, zárójeleket, pontot vagy vesszőt tizedesjelként és ezres tagolást (pl. 1 234,50). A mező elhagyása vagy Enter kiszámítja a századokra kerekített végeredményt.',
  'transactions.account': 'Számla',
  'transactions.fromAccount': 'Forrásszámla',
  'transactions.toAccount': 'Célszámla',
  'transactions.fromAmount': 'Küldött összeg',
  'transactions.toAmount': 'Fogadott összeg',
  'transactions.actualRate': 'Tényleges árfolyam',
  'transactions.fee': 'Díj összege',
  'transactions.feeCategory': 'Díj kategóriája',
  'transactions.optional': 'Nem kötelező',
  'transactions.chooseAccount': 'Válassz aktív számlát',
  'transactions.payee': 'Kedvezményezett',
  'transactions.payeeHint':
    'Válassz meglévő nevet, vagy új kedvezményezett létrehozásához írj be egy újat.',
  'transactions.category': 'Kategória',
  'transactions.note': 'Megjegyzés',
  'transactions.noPayee': 'Nincs kedvezményezett',
  'transactions.noCategory': 'Nincs kategória',
  'transactions.unknownAccount': 'Ismeretlen számla',
  'transactions.error':
    'A tranzakciós művelet nem sikerült. Frissíts, és próbáld újra.',
  'transactions.error.account': 'Válassz aktív számlát.',
  'transactions.error.kind': 'Válassz kiadást vagy bevételt.',
  'transactions.error.date': 'Adj meg érvényes naptári dátumot.',
  'transactions.error.futureDate': 'A tranzakció dátuma nem lehet jövőbeli.',
  'transactions.error.amount':
    'Adj meg érvényes kifejezést, amely pozitív összeget ad, legfeljebb 90 071 992 547 409,91 értékig. Nullával nem lehet osztani.',
  'transactions.error.payee':
    'Adj meg legfeljebb 100 karakter hosszú kedvezményezettnevet.',
  'transactions.error.category':
    'Válassz a kiadásnak vagy bevételnek megfelelő aktív kategóriát.',
  'transactions.error.note':
    'Adj meg legfeljebb 1000 karakter hosszú megjegyzést.',
  'transactions.error.notFound':
    'A tranzakció nem található. Frissítsd a listát.',
  'transactions.error.lines':
    'A tranzakció sorainak összege nem egyezik a végösszeggel.',
  'splits.split': 'Felosztás',
  'splits.unsplit': 'Vissza egy részre',
  'splits.remaining': 'Fennmaradó összeg',
  'splits.part': 'Rész',
  'splits.remove': 'Rész eltávolítása',
  'splits.addPart': 'Rész hozzáadása',
  'splits.indicator': 'Felosztott',
  'tags.title': 'Címkék',
  'tags.all': 'Minden címke',
  'tags.manage': 'Címkék kezelése',
  'tags.empty': 'Címkéket a tranzakció űrlapján hozhatsz létre.',
  'tags.name': 'Címke neve',
  'tags.rename': 'Átnevezés',
  'tags.delete': 'Címke törlése',
  'tags.save': 'Címke mentése',
  'tags.add': 'Címke hozzáadása',
  'tags.remove': 'Címke eltávolítása',
  'tags.hint':
    'Válassz meglévő címkét, vagy írj be újat. Nyomj Entert vagy kattints a hozzáadásra; az új címkék mentéskor jönnek létre.',
  'tags.deleteConfirmation':
    'Törlöd ezt a címkét, és eltávolítod minden tranzakcióról?',
  'tags.error.name': 'A címkék neve 1–100 karakter hosszú lehet.',
  'tags.error.notFound': 'A címke nem található. Frissítsd a listát.',
  'tags.error.duplicate': 'Már létezik ilyen nevű címke.',
  'undo.available': 'Módosítás mentve.',
  'transfers.error.accountsDiffer': 'Válassz két különböző számlát.',
  'transfers.error.equalAmounts':
    'Azonos pénznemű számláknál a két összegnek egyeznie kell.',
  'transfers.error.notFound': 'Az átvezetés nem található. Frissítsd a listát.',
  'transfers.error.linkedFee':
    'Ezt a díjat a hozzá tartozó átvezetésen keresztül módosítsd vagy töröld.',
  'undo.action': 'Visszavonás',
  'undo.error': 'A módosítást nem sikerült visszavonni.',
  'accounts.title': 'Minden számlának saját hely',
  'accounts.description':
    'Minden egyenleg a számla pénznemében rögzített, dátumozott pénzmozgásokat és egyenlegkorrekciókat összesíti.',
  'accounts.create': 'Számla létrehozása',
  'accounts.name': 'Számla neve',
  'accounts.currency': 'Pénznem',
  'accounts.openingBalance': 'Nyitó egyenleg',
  'accounts.openingDate': 'Nyitás dátuma',
  'accounts.balance': 'Egyenleg',
  'accounts.balanceHint':
    'Használhatsz + - * / műveleteket, zárójeleket, pontot vagy vesszőt tizedesjelként és ezres tagolást. A mező elhagyása vagy Enter századokra kerekíti a végeredményt. Negatív és nulla egyenleg is megadható.',
  'accounts.empty': 'Hozz létre egy számlát az egyenleg követéséhez.',
  'accounts.loading': 'Számlák betöltése…',
  'accounts.rename': 'Átnevezés',
  'accounts.changeCurrency': 'Pénznem módosítása',
  'accounts.archive': 'Archiválás',
  'accounts.unarchive': 'Visszaállítás az archívumból',
  'accounts.archived': 'Archivált — nem jelenik meg a számlaválasztókban',
  'accounts.delete': 'Törlés',
  'accounts.deleteConfirmation': 'Végleg törlöd ezt a számlát?',
  'accounts.confirmDelete': 'Számla végleges törlése',
  'accounts.save': 'Mentés',
  'accounts.cancel': 'Mégse',
  'accounts.refresh': 'Frissítés',
  'accounts.locked':
    'A tranzakciókkal rendelkező számla nem törölhető, és a pénzneme nem módosítható.',
  'accounts.error':
    'A számlaműveletet nem sikerült végrehajtani. Frissíts, és próbáld újra.',
  'accounts.error.name': 'Adj meg egy 1–100 karakter hosszú számlanevet.',
  'accounts.error.currency': 'Válaszd a HUF vagy CHF pénznemet.',
  'accounts.error.balance':
    'Adj meg érvényes kifejezést, amely ±90 071 992 547 409,91 határon belüli egyenleget ad. Nullával nem lehet osztani.',
  'accounts.error.date': 'Adj meg érvényes nyitási dátumot.',
  'accounts.error.notFound': 'A számla nem található. Frissítsd a listát.',
  'accounts.error.currencyLocked':
    'A pénznem nem módosítható, ha a számlán már vannak tranzakciók.',
  'accounts.error.notEmpty':
    'A számlán vannak tranzakciók, ezért nem törölhető. Archiváld helyette.',
  'settings.title': 'Érezd magad otthon',
  'settings.description':
    'A nyelv, a megjelenés, az alap pénznem és a nyugtaátvétel a profilhoz mentődik, és azonnal érvényesül.',
  'settings.baseCurrency': 'Alap pénznem',
  'settings.version': 'Alkalmazásverzió',
  'settings.error': 'A beállításokat nem sikerült menteni. Próbáld újra.',
  'watchedFolder.title': 'Figyelt mappa',
  'watchedFolder.hint':
    'A Financial Tracker adatmappáján kívül bármely helyi mappa használható, például a Google Drive asztali alkalmazással vagy a OneDrive-val szinkronizált mappa. A teljesen átmásolt nyugtafotók a feldolgozott almappába kerülnek.',
  'watchedFolder.error.userData':
    'Válassz a Financial Tracker adatmappáján kívüli mappát.',
  'watchedFolder.current': 'Jelenlegi mappa',
  'watchedFolder.none': 'Nincs kiválasztott mappa',
  'watchedFolder.status': 'Állapot',
  'watchedFolder.status.watching': 'Figyelés alatt',
  'watchedFolder.status.unavailable': 'A mappa nem érhető el',
  'watchedFolder.choose': 'Mappa kiválasztása',
  'watchedFolder.clear': 'Törlés',
  'watchedFolder.intakeFailure':
    'Egy figyelt nyugtafotót nem sikerült hozzáadni',
  'watchedFolder.dismissFailure': 'Bezárás',
  'backups.title': 'Biztonsági mentések',
  'backups.description':
    'A profil minden megnyitásakor adatbázismentés készül. Az utolsó 10 indítási mentés marad meg; a migráció előtti mentések külön tárolódnak.',
  'backups.loading': 'Mentések betöltése…',
  'backups.empty': 'Nincs elérhető indítási mentés.',
  'backups.choose': 'A mentés dátuma és időpontja',
  'backups.restore': 'Mentés visszaállítása',
  'backups.confirmDescription':
    'Visszaállítja ezt a mentést? Ez lecseréli a profil jelenlegi adatbázisát, és elveti a mentés óta végzett módosításokat.',
  'backups.confirmRestore': 'Visszaállítás megerősítése',
  'backups.cancel': 'Mégse',
  'backups.error':
    'A mentési művelet nem sikerült. Ha a helyreállítás is sikertelen volt, folytatás előtt indítsa újra az alkalmazást.',
  'backups.restored':
    'A mentés visszaállítva. A profil adatbázisa újra megnyílt.',
  'backups.error.confirmation':
    'A folytatás előtt erősítsd meg a visszaállítást.',
  'backups.error.notFound':
    'Ez a mentés már nem érhető el. Frissítsd a listát.',
  'backups.error.restore':
    'A mentés nem állítható vissza; az előző adatbázis újra megnyílt.',
  'backups.error.recovery':
    'A helyreállítás nem sikerült. Folytatás előtt indítsd újra az alkalmazást.',
  'backups.error.create':
    'Az indítási mentés nem hozható létre és nem ellenőrizhető.',
  'backups.error.invalid': 'A kiválasztott mentés sérült vagy érvénytelen.',
  'backups.error.foreign': 'A kiválasztott mentés másik profilhoz tartozik.',
  'backups.error.newerSchema':
    'A kiválasztott mentéshez újabb alkalmazásverzió szükséges.',
  'settings.language': 'Nyelv',
  'settings.theme': 'Megjelenés',
  'language.hu': 'Magyar',
  'language.en': 'Angol',
  'language.de': 'Német',
  'theme.light': 'Világos',
  'theme.dark': 'Sötét',
  'theme.system': 'Windows követése',
  'settings.preview': 'Formázási előnézet',
  'settings.date': 'Dátum',
  'settings.number': 'Szám',
  'phoneUpload.title': 'Feltöltés telefonról',
  'phoneUpload.starting': 'A privát hálózati feltöltés indítása…',
  'phoneUpload.noPrivateNetwork':
    'Nincs kapcsolat privát hálózattal. Csatlakoztasd ezt a számítógépet a privát Wi-Fi-hálózathoz, majd próbáld újra.',
  'phoneUpload.error': 'A telefonos feltöltés nem indítható el. Próbáld újra.',
  'phoneUpload.interface': 'Privát hálózati kapcsolat',
  'phoneUpload.qrAlt': 'QR-kód a telefonos feltöltési címhez',
  'phoneUpload.address': 'Vagy nyisd meg ezt a címet a telefonon',
  'phoneUpload.expiresIn': 'Automatikus leállítás ennyi idő múlva: {time}',
  'phoneUpload.expired': 'Ez a feltöltési munkamenet leállt.',
  'phoneUpload.uploaded': 'Feltöltve: {count}',
  'phoneUpload.firewallTitle': 'Windows tűzfal',
  'phoneUpload.firewallGuidance':
    'A Windows kérheti a „Financial Tracker” engedélyezését. Csak a privát hálózatokon engedélyezd. Ha a telefon nem tud kapcsolódni, mindkét eszköz ugyanazt a Wi-Fi-hálózatot használja, és a Windows hálózata legyen Privát beállítású.',
  'phoneUpload.close': 'Bezárás',
  'help.accessibleName': 'Súgó',
  'help.page.profilePicker':
    'A profil egy személy elkülönített pénzügyeit tartalmazza. Válassz meglévő profilt, vagy hozz létre újat; minden profil saját helyi adatbázisban tárolódik.',
  'help.profilePicker.profiles':
    'Nyiss meg egy profilt az elkülönített pénzügyei és beállításai használatához. Át is nevezheted, vagy végleg törölheted a helyi adataival együtt.',
  'help.profilePicker.create':
    'Hozz létre profilt egy másik, elkülönített pénzügyi adathalmazhoz ezen a számítógépen. Adj neki felismerhető nevet; ezt később módosíthatod.',
  'help.page.overview':
    'Itt az aktuális hónap kiadásait, bevételeit és nettó összegét hasonlíthatod össze az előző teljes hónappal; a kizárt tranzakciók kimaradnak. Az összegek az alap pénznemre váltva jelennek meg, ha van elérhető árfolyam.',
  'help.page.transactions':
    'Itt rögzítheted és tekintheted át a kiadásokat, bevételeket, átvezetéseket és egyenlegkorrekciókat. A szűrőkkel a listát és az összesítést is szűkítheted.',
  'help.page.receipts':
    'A nyugtafotók itt várnak, amíg tranzakcióként jóváhagyod vagy elveted őket. A szövegfelismerés helyben fut; mindig ellenőrizd az előre kitöltött adatokat.',
  'help.page.recurring':
    'Itt ütemezetten ismétlődő kiadásokat és bevételeket adhatsz meg. Az esedékes előfordulások függővé válnak, és csak a jóváhagyás után számítanak bele a pénzügyeidbe.',
  'help.page.reports':
    'Itt a kiadásokat és bevételeket elemezheted az alap pénznemben; a kizárt tranzakciók kimaradnak. Az árfolyam nélküli összegek külön jelennek meg, és nem kerülnek bele az átváltott diagramokba vagy összesítésekbe.',
  'help.page.accounts':
    'A számla egyetlen pénznemben tartott pénz helye. Egyenlegét a nyitóegyenleg, a dátumozott pénzmozgások és az egyenlegkorrekciók adják.',
  'help.page.settings':
    'A legtöbb beállítás az aktuális profilra vonatkozik. A Gyors rögzítés gyorsbillentyűje és az Indítás a Windows rendszerrel beállítás ezen a Windows-fiókon minden profilra érvényes.',
  'help.page.quickAdd':
    'A főablak megnyitása nélkül rögzíthetsz kiadást vagy bevételt az aktív profilban. Válaszd ki a számlát, ellenőrizd az adatokat, majd mentsd a tranzakciót.',
  'help.overview.expenses':
    'Az aktuális hónap eddigi kiadásai (kizárt tranzakciók nélkül), az előző teljes hónaphoz viszonyítva. A Tranzakciók megtekintése gombbal megnyithatod a megfelelő tranzakciókat.',
  'help.overview.incomes':
    'Az aktuális hónap eddigi bevételei (kizárt tranzakciók nélkül), az előző teljes hónaphoz viszonyítva. A Tranzakciók megtekintése gombbal megnyithatod a megfelelő tranzakciókat.',
  'help.overview.net':
    'A bevételek és kiadások különbsége az adott időszakban. Az átvezetések, egyenlegkorrekciók és kizárt tranzakciók nem módosítják.',
  'help.overview.topCategories':
    'Az aktuális hónap öt legnagyobb átváltott összegű kiadási kategóriája, a kizárt tranzakciók nélkül. Egy kategóriára kattintva megnyithatod a hozzá tartozó tranzakciókat.',
  'help.transactions.filters':
    'A szűrők módosítják a megjelenő tranzakciókat és a lista feletti összesítést. Exportálás előtt alkalmazd őket; a CSV az összes találatot tartalmazza, nem csak az aktuális oldalt.',
  'help.transactions.excluded':
    'A kizárt tranzakció módosítja a számlaegyenleget, de kimarad a kiadási és bevételi összesítésekből és a kimutatásokból. Ilyen lehet például egy később visszatérített kiadás.',
  'help.transactions.templates':
    'A tranzakciós sablon újra felhasználható, előre kitöltött adatokat tárol. Válassz egyet az űrlap kitöltéséhez, vagy készíts sablont a gyakran együtt megadott mezőkből.',
  'help.transactions.duplicate':
    'A másolás azonnal ment egy új, mai dátumú tranzakciót az eredeti adatokkal és címkékkel. Ha mégsem szeretnéd megtartani, használd a Visszavonást.',
  'help.transactions.balanceAdjustment':
    'Rögzítsd a számla adott nap végén megfigyelt valós egyenlegét. Az alkalmazás a számla előzményeiből újraszámítja a különbséget, amely nem számít kiadásnak vagy bevételnek.',
  'help.transactions.csvExport':
    'Az alkalmazott szűrőknek megfelelő kiadásokat és bevételeket exportálja. A felosztás részei külön sorokba kerülnek; az átvezetések és egyenlegkorrekciók kimaradnak.',
  'help.transactions.csvSeparator':
    'Válaszd ki, hogyan jelenjenek meg a tizedes törtek a táblázatkezelőben. Pont esetén vessző, vessző esetén pontosvessző választja el a mezőket, így nincs félreértés.',
  'help.transactions.amountCalculator':
    'A számításhoz a + - * / jeleket és zárójeleket használhatod. A mező elhagyásakor vagy Enter lenyomásakor az eredmény századokra kerekítve jelenik meg.',
  'help.transactions.split':
    'A felosztás egy tranzakciót külön összegű, kategóriájú, címkéjű és megjegyzésű részekre bont. A részek összege egyezzen meg a tranzakció teljes összegével.',
  'help.transactions.transfer':
    'Az átvezetés két számla között mozgat pénzt, és nem kiadás vagy bevétel. Eltérő pénznemeknél mindkét tényleges összeget add meg; az alkalmazás ezekből számítja az árfolyamot.',
  'help.transactions.transferFee':
    'Az átvezetési díj külön kiadásként kerül a forrásszámlára. Válassz hozzá kategóriát, és csak akkor zárd ki, ha a kimutatásokban sem szeretnéd látni.',
  'help.transactions.tags':
    'A címkékkel kategóriáktól függetlenül csoportosíthatod a tranzakciókat. Adj hozzá meglévő vagy új címkéket; a Címkék kezelése részen átnevezheted vagy törölheted őket.',
  'help.transactions.attachments':
    'A mellékletek a profilba másolva a tranzakcióval együtt maradnak. Nyugtafotót, képet vagy PDF-et adhatsz hozzá; az eltávolítás törli a profilban lévő másolatot.',
  'help.receipts.phoneUpload':
    'Ideiglenes feltöltőoldalt indít az azonos privát Wi-Fi-hálózaton lévő telefonhoz. A munkamenet alatt a címet ismerők hozzáférhetnek a feltöltésekhez, ezért csak megbízható privát hálózaton használd, és utána zárd be.',
  'help.recurring.pending':
    'A függő tranzakciók döntésre váró, esedékes előfordulások. Jóváhagyhatod őket, módosíthatod az összeget vagy dátumot jóváhagyás előtt, illetve kihagyhatod az adott előfordulást.',
  'help.recurring.definitions':
    'A definíciók az ismétlődő tranzakciók újrahasznált adatait és ütemezését tárolják. A szüneteltetés leállítja az új függő előfordulásokat; folytatáskor a közben elmúlt dátumok kimaradnak.',
  'help.recurring.editor':
    'Add meg a jövőbeli előfordulásokhoz használt tranzakcióadatokat és ütemezést. A definíció létrehozása előtti dátumokra nem jön létre előfordulás.',
  'help.recurring.schedule':
    'Válaszd ki az ismétlődés gyakoriságát és naptári napját. A nem kötelező záródátum után nem jön létre új előfordulás.',
  'help.reports.dateRange':
    'Válaszd ki a kategória-, havi trend- és pénzáramlási kimutatások dátumait. A költési ütem mindig az aktuális hónapot hasonlítja az előző három naptári hónaphoz.',
  'help.reports.category':
    'A kiadások főkategóriánként, az alap pénznemben jelennek meg; a kizárt tranzakciók kimaradnak. Válassz főkategóriát, majd alkategóriát a mögöttes tranzakciók megnyitásához.',
  'help.reports.trend':
    'Hasonlítsd össze a havi kiadásokat, bevételeket és nettó összeget; a kizárt tranzakciók kimaradnak. A részleges hónapok csak a kiválasztott tartomány napjait tartalmazzák.',
  'help.reports.pace':
    'Az aktuális havi eddigi kiadásokat (kizárt tranzakciók nélkül) az előző három naptári hónap azonos napjáig számolt átlagával hasonlítja össze. Rövidebb hónapoknál az utolsó napig számol.',
  'help.reports.cashFlow':
    'Megmutatja, hogyan áramlanak az átváltott bevételi kategóriák a kiadási kategóriákba. A bevételek és kiadások különbsége megtakarításként vagy hiányként jelenik meg; az át nem váltott összegek külön maradnak.',
  'help.reports.breakdown':
    'Válassz főkategóriát az alkategóriák megtekintéséhez. Egy alkategóriára kattintva megnyílnak az összeg mögötti kiadási tranzakciók; a kizárt tranzakciók kimaradnak.',
  'help.accounts.create':
    'Hozz létre külön számlát minden olyan helyhez és pénznemhez, ahol pénzt tartasz. Add meg az egyenleget és a dátumot, amelytől az előzmények kezdődnek.',
  'help.accounts.currency':
    'Minden számlának pontosan egy pénzneme van. Ezt csak addig módosíthatod, amíg nincs tranzakció a számlán.',
  'help.accounts.openingBalance':
    'A nyitóegyenleg a számla egyenlege az előzmények kezdetén, a nyitás dátumán. Lehet pozitív, nulla vagy negatív, és számítást is beírhatsz a mezőbe.',
  'help.accounts.archive':
    'Az archiválás elrejti a számlát az adatbeviteli listákból, de nem törli az előzményeit vagy az egyenlegét. Ha újra használnád, szüntesd meg az archiválást.',
  'help.settings.categories':
    'A kategóriák legfeljebb két szinten sorolják be a kiadásokat vagy bevételeket: főkategória és alkategória. Átrendezheted vagy archiválhatod őket a meglévő tranzakciók módosítása nélkül.',
  'help.settings.payees':
    'A kedvezményezett a tranzakciókon használt egységes név. A nyers vagy eltérő nevekhez álnevet adhatsz; egyesítéskor a tranzakciók és álnevek a megmaradó kedvezményezetthez kerülnek.',
  'help.settings.rules':
    'A szabályok egyezés esetén automatikusan előre kitöltik a kedvezményezettet, kategóriát vagy címkéket. Sorrendben futnak, és az első egyező szabály érvényesül.',
  'help.settings.ruleAmountCurrency':
    'Az összeghatárok összehasonlítása ebben a pénznemben történik. Ha a szabály számlafeltételt tartalmaz, automatikusan annak pénzneme érvényes.',
  'help.settings.backups':
    'A profil megnyitásakor helyi adatbázis-mentés készül, és a legutóbbi tíz indítási mentés marad meg. A visszaállítás az aktuális profiladatokat a kiválasztott mentésre cseréli.',
  'help.settings.watchedFolder':
    'A mappába kerülő új nyugtafotókat az alkalmazás beolvassa a Nyugta beérkezők közé. Sikeres átvétel után az eredeti fájlok a feldolgozott almappába kerülnek; szinkronizált helyi mappával másik eszközről is fogadhatsz fotókat.',
  'help.settings.shortcut':
    'Ez a rendszerszintű gyorsbillentyű akkor is megnyitja a Gyors rögzítést, ha a főablak rejtve van, és ezen a Windows-fiókon minden profilra érvényes. Fókuszáld a gyorsbillentyű mezőjét, majd nyomd le a kívánt billentyűkombinációt.',
  'help.settings.autostart':
    'Alapértelmezés szerint ki van kapcsolva. Bekapcsolva a Financial Tracker a Windowsba való bejelentkezéskor rejtve, az értesítési területen indul el. Ez a beállítás ezen a Windows-fiókon minden profilra érvényes.',
  'help.settings.baseCurrency':
    'A kimutatások a többi pénznemet az adott nap árfolyamával erre a pénznemre váltják. A módosítás a kimutatások megjelenítését változtatja, a számlákon tárolt összegeket nem.',
  'help.settings.exchangeRates':
    'Az alkalmazás letölti és helyben tárolja a hivatalos MNB-árfolyamokat a kimutatások átváltásához. Ha egy árfolyam hiányzik vagy elavult, az érintett összegek a frissítésig külön jelennek meg.',
  'help.settings.privacy':
    'A Privát mód elrejti a megjelenített összegeket és olvashatatlanná teszi a diagramértékeket, de a tárolt adatokat nem módosítja. Bárhol átkapcsolhatod a Ctrl+Shift+H billentyűkkel.',
  'help.settings.formattingPreview':
    'Az előnézet megmutatja, hogyan formázza a kiválasztott nyelv a dátumokat és számokat. A tárolt értékeket nem módosítja.',
} satisfies MessageCatalog
