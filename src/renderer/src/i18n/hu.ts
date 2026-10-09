import { desktopMessages } from '../../../shared/desktop-translations'
import { csvMessages } from '../../../shared/csv-translations'
import { categoryNames } from '../../../shared/category-translations'
import type { MessageCatalog } from './en'

export const hu = {
  ...desktopMessages.hu,
  'privacy.toggle': 'Privát mód',
  'privacy.hiddenAmount': 'Rejtett összeg',
  'privacy.shortcutScope':
    'A Privát módot gépelés közben is bármikor bekapcsolhatod (Ctrl+Shift+H).',
  'quickAdd.title': 'Gyors rögzítés',
  'quickAdd.noProfiles':
    'A tranzakció rögzítéséhez előbb hozz létre profilt a főablakban.',
  'quickAdd.noAccounts':
    'A tranzakció rögzítéséhez előbb hozz létre számlát a főablakban.',
  'quickAdd.saved': 'Mentve.',
  'quickAdd.loading': 'Gyors rögzítés betöltése…',

  'shortcuts.closeHelp': 'Billentyűparancsok bezárása',
  'transactions.saveAndAddAnother': 'Mentés és új tranzakció',
  'shortcuts.scope':
    'Megnyitott profilnál az új tranzakció és a visszavonás szövegbevitelen kívül működik. A típust a tranzakciós panelen válthatod, és ott menthetsz is billentyűparanccsal.',
  'shortcuts.navigation':
    'A Tab / Shift+Tab a mezők között léptet, és a megnyitott ablakon belül tart.',
  'shortcuts.undo': 'Legutóbbi módosítás visszavonása (szövegbevitelen kívül)',
  'shortcuts.close':
    'Mégse / a tranzakciós panel vagy a billentyűparancsok bezárása',
  'shortcuts.help': 'Billentyűparancsok',
  'shortcuts.save':
    'Mentés (többsoros megjegyzésben nem; a gombok saját művelete változatlan)',
  'shortcuts.saveAndAddAnother':
    'Mentés és új tranzakció (a dátum, a számlák és a típus maradnak)',
  'shortcuts.newTransaction': 'Új tranzakció (szövegbevitelen kívül)',
  ...categoryNames.hu,
  ...csvMessages.hu,
  'csv.description':
    'Az alkalmazott szűrők összes találatát exportálja, nemcsak az aktuális oldalt. A felosztás minden része külön sorban jelenik meg. Az átvezetések és az egyenlegegyeztetések kimaradnak.',
  'csv.decimalSeparator': 'Tizedesjel',
  'csv.profileDefault': 'A profil nyelve szerint',
  'csv.dot': 'Pont (123.45) · vesszővel elválasztott mezők',
  'csv.comma': 'Vessző (123,45) · pontosvesszővel elválasztott mezők',
  'csv.saving': 'CSV mentése…',
  'csv.saved': 'A CSV-fájl elmentve.',
  'csv.error': 'Nem sikerült menteni a CSV-t. Próbáld újra.',
  'csv.error.separator': 'Tizedesjelként pontot vagy vesszőt válassz.',

  'rules.title': 'Automatikus kategorizálás',
  'rules.description':
    'A szabályok fentről lefelé futnak. Az első illeszkedő szabály kitölti a Bolt / partner, a kategória és a címkék mezőjét, és elsőbbséget élvez a legutóbb használt értékekkel szemben.',
  'rules.loading': 'Szabályok betöltése…',
  'rules.empty': 'Még nincs automatikus kategorizálási szabály.',
  'rules.offer': 'Készítesz szabályt ehhez a kategorizáláshoz?',
  'rules.offerDismiss': 'Most nem',
  'rules.create': 'Új szabály',
  'rules.edit': 'Szerkesztés',
  'rules.delete': 'Törlés',
  'rules.save': 'Mentés',
  'rules.enabled': 'Bekapcsolva',
  'rules.disabled': 'Kikapcsolva',
  'rules.up': 'Feljebb',
  'rules.down': 'Lejjebb',
  'rules.anyPayee': 'Bármely bolt vagy partner',
  'rules.textContains': 'Szöveg a megjegyzésben',
  'rules.account': 'Számla',
  'rules.anyAccount': 'Bármely számla',
  'rules.minimum': 'Minimum',
  'rules.maximum': 'Maximum',
  'rules.amountCurrency': 'Pénznem',
  'rules.amountCondition': 'Összeghatár',
  'rules.payeeAction': 'Bolt / partner megadása',
  'rules.noPayeeAction': 'Ne adj meg boltot vagy partnert',
  'rules.noCategory': 'Ne adj meg kategóriát',
  'rules.noTags':
    'Mielőtt szabályban használnád, hozz létre címkét egy tranzakció rögzítésekor.',
  'rules.action': 'Művelet',
  'rules.formHint':
    'Válassz legalább egy feltételt és egy kitöltendő mezőt: Bolt / partner, kategória vagy címke.',
  'rules.amountHint':
    'Nem kötelező. Az összeghatár mindkét széle beleszámít, és a szabály pénznemében értendő.',
  'rules.error':
    'Nem sikerült módosítani a szabályt. Frissíts, és próbáld újra.',
  'rules.error.notFound': 'A szabály nem található. Frissítsd a listát.',
  'rules.error.condition': 'Válassz legalább egy feltételt.',
  'rules.error.text': 'A keresett szöveg legfeljebb 1000 karakter lehet.',
  'rules.error.amount': 'Adj meg érvényes, nem negatív összeget.',
  'rules.error.amountRange':
    'A legkisebb összeg nem lehet nagyobb a legnagyobb összegnél.',
  'rules.error.action':
    'Válassz boltot vagy partnert, kategóriát és/vagy legalább egy címkét.',
  'rules.error.reference':
    'Meglévő, aktív boltot vagy partnert, számlát, kategóriát és címkét válassz.',
  'rules.error.order': 'Válassz érvényes helyet a szabálynak.',
  'payees.title': 'Boltok és partnerek',
  'payees.description':
    'Az egyéb nevek összekötik a bankszámlakivonaton szereplő neveket egy bolttal vagy partnerrel. A keresés nem különbözteti meg a kis- és nagybetűket, illetve az ékezeteket. Összevonáskor minden tranzakció és egyéb név a kiválasztott névhez tartozik majd.',
  'payees.loading': 'Boltok és partnerek betöltése…',
  'payees.empty':
    'A tranzakcióknál megadott boltok és partnerek itt jelennek meg.',
  'payees.aliases': 'Egyéb nevek',
  'payees.noAliases': 'Nincs egyéb név.',
  'payees.aliasName': 'Egyéb név',
  'payees.addAlias': 'Hozzáadás',
  'payees.removeAlias': 'Eltávolítás',
  'payees.mergeInto': 'Összevonás ezzel:',
  'payees.chooseSurvivor': 'Válaszd ki a megtartandó nevet',
  'payees.merge': 'Összevonás',
  'payees.mergeHint':
    'Minden tranzakció és egyéb név a megtartott névhez fog tartozni. A módosítást visszavonhatod.',
  'payees.refresh': 'Frissítés',
  'payees.error':
    'Nem sikerült módosítani a boltot vagy partnert. Próbáld újra.',
  'payees.error.notFound':
    'A bolt vagy partner nem található. Frissítsd a listát.',
  'payees.error.aliasNotFound':
    'Az egyéb név nem található. Frissítsd a listát.',
  'payees.error.aliasName': 'Adj meg egy 1–100 karakteres egyéb nevet.',
  'payees.error.aliasConflict':
    'Ez a név már egy bolthoz, partnerhez vagy egyéb névhez tartozik.',
  'payees.error.samePayee': 'Másik megtartandó nevet válassz.',
  'payees.error.query': 'A bolt vagy partner keresése érvénytelen.',
  'categories.title': 'Kategóriák',
  'categories.description':
    'A kiadási és bevételi kategóriák két szintből állhatnak: főkategóriából és alkategóriából. Az alapértelmezett nevek a választott nyelvet követik, az általad megadott nevek nem változnak. Ha archiválsz egy főkategóriát, az alkategóriái sem jelennek meg a választókban.',
  'categories.expense': 'Kiadás',
  'categories.income': 'Bevétel',
  'categories.loading': 'Kategóriák betöltése…',
  'categories.name': 'Név',
  'categories.kind': 'Típus',
  'categories.parent': 'Főkategória',
  'categories.main': 'Nincs (ez lesz a főkategória)',
  'categories.create': 'Új kategória',
  'categories.rename': 'Átnevezés',
  'categories.archive': 'Archiválás',
  'categories.unarchive': 'Újraaktiválás',
  'categories.archived': 'Archiválva — nem jelenik meg a kategóriaválasztókban',
  'categories.delete': 'Törlés',
  'categories.deleteConfirmation': 'Végleg törlöd ezt a kategóriát?',
  'categories.confirmDelete': 'Végleges törlés',
  'categories.replacement': 'Helyettesítő kategória',
  'categories.chooseReplacement': 'Válassz másik kategóriát',
  'categories.noReplacement': 'Nem szükséges (a kategória nincs használatban)',
  'categories.save': 'Mentés',
  'categories.cancel': 'Mégse',
  'categories.refresh': 'Frissítés',
  'categories.up': 'Feljebb',
  'categories.down': 'Lejjebb',
  'categories.error':
    'Nem sikerült módosítani a kategóriát. Frissíts, és próbáld újra.',
  'categories.error.name': 'Adj meg egy 1–100 karakteres kategórianevet.',
  'categories.error.kind': 'Válassz kiadást vagy bevételt.',
  'categories.error.notFound': 'A kategória nem található. Frissítsd a listát.',
  'categories.error.parent':
    'Azonos típusú, aktív főkategóriát válassz. Harmadik szint nem hozható létre.',
  'categories.error.order':
    'Válassz érvényes helyet az azonos szintű kategóriák között.',
  'categories.error.children':
    'A főkategória törlése előtt töröld az alkategóriáit.',
  'categories.error.replacementRequired':
    'Ehhez a kategóriához tranzakciók tartoznak. A megőrzésükhöz válassz másik kategóriát.',
  'categories.error.replacement':
    'Másik, azonos típusú, aktív kategóriát válassz.',
  'updates.downloading': 'Frissítés letöltése… {percent}%',
  'updates.downloadingStarted': 'A frissítés letöltése elkezdődött.',
  'updates.ready': 'Az új verzió ({version}) letöltődött. Telepíted most?',
  'updates.later': 'Később',
  'updates.restart': 'Újraindítás és frissítés',
  'updates.restarting': 'Újraindítás…',
  'updates.updated': 'Az alkalmazás frissült: {version}.',
  'updates.error':
    'Nem sikerült újraindítani az alkalmazást a frissítéshez. Próbáld újra.',
  'app.name': 'Financial Tracker',
  'app.tagline': 'Pénzügyeid a saját számítógépeden.',
  'rates.status.upToDate': 'Az árfolyamok naprakészek',
  'rates.status.stale': 'Az árfolyamok frissítésre várnak',
  'rates.status.missing': 'Hiányzó árfolyam',
  'rates.status.lastRefresh': 'Utolsó frissítés',
  'navigation.label': 'Fő navigáció',
  'navigation.overview': 'Áttekintés',
  'navigation.transactions': 'Tranzakciók',
  'navigation.receipts': 'Blokkok',
  'navigation.recurring': 'Rendszeres',
  'navigation.reports': 'Kimutatások',
  'navigation.accounts': 'Számlák',
  'navigation.settings': 'Beállítások',
  'receipts.title': 'Feldolgozandó blokkok',
  'receipts.description':
    'Ellenőrizd a beérkezett blokkfotókat, majd hagyd jóvá őket tranzakcióként, vagy töröld őket.',
  'receipts.count': 'Feldolgozandó blokkok',
  'receipts.loading': 'Blokkok betöltése…',
  'receipts.empty': 'Nincs feldolgozandó blokk.',
  'receipts.preview': 'Blokk előnézete',
  'receipts.back': 'Vissza a blokkokhoz',
  'receipts.confirm': 'Jóváhagyás',
  'receipts.discard': 'Törlés',
  'receipts.reading':
    'A blokk beolvasása folyamatban… Közben kézzel is kitöltheted a mezőket.',
  'receipts.ocrPrefilled': 'a blokkról beolvasva',
  'receipts.ocrLowConfidence':
    'A beolvasás bizonytalan. Ellenőrizd az összes előre kitöltött mezőt.',
  'receipts.currencyMismatch': 'Nincs aktív számla a felismert pénznemben:',
  'receipts.source.drop': 'Behúzva',
  'receipts.source.folder': 'Figyelt mappából',
  'receipts.source.phone': 'Telefonról',
  'receipts.dropOverlay': 'Húzd ide a blokkfotókat',
  'receipts.dropProcessing': 'Blokkfotók hozzáadása…',
  'receipts.error': 'Nem sikerült feldolgozni a blokkot. Próbáld újra.',
  'receipts.error.type':
    'JPEG-, PNG- vagy WebP-képet húzz ide. PDF-et és más fájlt nem adhatsz a blokkokhoz.',
  'receipts.error.size': 'Egy blokkfotó legfeljebb 25 MB lehet.',
  'receipts.error.path': 'A blokkfotó nem olvasható.',
  'receipts.error.source': 'Válassz érvényes forrást a blokkhoz.',
  'receipts.error.notFound': 'A blokk nem található. Frissítsd a listát.',
  'receipts.error.preview': 'Nem sikerült elkészíteni a blokk előnézetét.',
  'recurring.title': 'Rendszeres tranzakciók',
  'recurring.definitions': 'Ütemezések',
  'recurring.sections': 'Rendszeres tranzakciók',
  'recurring.fromTransaction': 'Rendszeres tranzakció létrehozása',
  'recurring.fromTemplate': 'Létrehozás sablonból',
  'recurring.fromSplitHint':
    'Felosztott tranzakcióból nem hozhatsz létre rendszeres tranzakciót.',
  'pending.title': 'Jóváhagyásra vár',
  'pending.empty': 'Nincs jóváhagyásra váró tranzakció.',
  'pending.confirm': 'Jóváhagyás',
  'pending.editAndConfirm': 'Szerkesztés és jóváhagyás',
  'pending.skip': 'Kihagyás',
  'pending.overdue': 'Késésben',
  'pending.dueCount': 'Jóváhagyásra váró tranzakciók',
  'pending.error.notFound':
    'A jóváhagyásra váró tranzakció nem található. Frissítsd a listát.',
  'pending.error.accountArchived':
    'Ez a számla archiválva van. Aktiváld újra, vagy hagyd ki ezt az alkalmat.',
  'recurring.description':
    'Add meg a rendszeres kiadásaid és bevételeid várható összegét. Az esedékes tranzakciók jóváhagyásig nem módosítják az egyenlegeket és a kimutatásokat.',
  'recurring.create': 'Új rendszeres tranzakció',
  'recurring.edit': 'Rendszeres tranzakció szerkesztése',
  'recurring.save': 'Mentés',
  'recurring.empty': 'Még nincs rendszeres tranzakció.',
  'recurring.pause': 'Szüneteltetés',
  'recurring.resume': 'Folytatás',
  'recurring.paused': 'Szüneteltetve',
  'recurring.delete': 'Törlés',
  'recurring.deleteConfirmation':
    'Törlöd ezt a rendszeres tranzakciót és minden jóváhagyásra váró alkalmát?',
  'recurring.nextDue': 'Következő esedékesség',
  'recurring.noNextDue': 'Nincs következő esedékesség',
  'recurring.creationHint':
    'A létrehozás előtti alkalmak nem jelennek meg. Folytatáskor a szüneteltetés alatt elmúlt dátumok kimaradnak.',
  'recurring.schedule.label': 'Ütemezés',
  'recurring.schedule.monthly': 'Havonta',
  'recurring.schedule.weekly': 'Hetente',
  'recurring.schedule.yearly': 'Évente',
  'recurring.interval.months': '{n} havonta',
  'recurring.interval.weeks': '{n} hetente',
  'recurring.month': 'Hónap',
  'recurring.day': 'Nap',
  'recurring.weekday': 'A hét napja',
  'recurring.interval': 'Ismétlés',
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
    'Nem sikerült menteni a rendszeres tranzakciót. Ellenőrizd a mezőket, és próbáld újra.',
  'sidebar.collapse': 'Oldalsáv összecsukása',
  'sidebar.expand': 'Oldalsáv kibontása',
  'sidebar.profile': 'Profilok',
  'sidebar.profileHint': 'A profilváltás később itt lesz elérhető.',
  'profilePicker.title': 'Válassz profilt',
  'profilePicker.description':
    'Minden profil külön, helyi adatbázisban tárolja a pénzügyeket.',
  'profilePicker.choose': 'Profilok',
  'profilePicker.empty': 'Első lépésként hozz létre egy profilt.',
  'profile.loading': 'Profilok betöltése…',
  'profile.open': 'Megnyitás',
  'profile.create': 'Új profil',
  'profile.createDescription':
    'Adj nevet ennek a különálló pénzügyi profilnak.',
  'profile.name': 'Profil neve',
  'profile.rename': 'Átnevezés',
  'profile.renameLabel': 'Új profilnév',
  'profile.save': 'Mentés',
  'profile.delete': 'Törlés',
  'profile.deleteDescription':
    'Ezzel végleg törlöd a profil adatbázisát és minden helyben tárolt adatát.',
  'profile.typeName': 'Megerősítésként írd be a profil nevét:',
  'profile.confirmDelete': 'Végleges törlés',
  'profile.cancel': 'Mégse',
  'profile.switch': 'Profilváltás',
  'profile.error': 'Nem sikerült módosítani a profilt.',
  'profiles.error.name': 'Adj meg egy 1–100 karakteres profilnevet.',
  'profiles.error.notFound': 'A profil nem található. Frissítsd a listát.',
  'profiles.error.confirmation':
    'A törlés megerősítéséhez pontosan írd be a profil nevét.',
  'profiles.error.registryRead': 'A profillista nem olvasható.',
  'profiles.error.registryWrite': 'A profillista nem menthető.',
  'profiles.error.delete':
    'Nem sikerült biztonságosan törölni a profilt, ezért továbbra is elérhető.',
  'profiles.error.newerSchema':
    'Ezt a profilt egy újabb alkalmazásverzióval nyitották meg, ezért itt nem nyitható meg biztonságosan.',
  'profiles.error.migration':
    'Nem sikerült frissíteni a profilt. A frissítés előtti adatbázis megmaradt.',
  'profiles.error.identity':
    'A profiladatbázis nem egyezik a kiválasztott profillal.',
  'overview.title': 'Pénzügyeid egy helyen',
  'overview.description':
    'Az aktuális hónap eddigi eredményei a teljes előző hónaphoz képest, az alappénznemben.',
  'overview.error': 'Nem sikerült betölteni az áttekintést.',
  'overview.expenses': 'Kiadások',
  'overview.incomes': 'Bevételek',
  'overview.net': 'Nettó',
  'overview.thisMonthToDate': 'Ebben a hónapban eddig',
  'overview.fullLastMonth': 'Előző teljes hónap',
  'overview.change': 'Változás az előző hónaphoz képest',
  'overview.topCategories':
    'Az 5 legnagyobb kiadási kategória ebben a hónapban',
  'overview.transactions': 'Tranzakciók',
  'overview.reports': 'Kimutatások',
  'overview.chartLabel': 'A hónap öt legnagyobb kiadási kategóriája',
  'overview.shareHint':
    'Az arányok az összes kategória átváltott kiadásából számolódnak, nemcsak az első ötből. Az át nem váltott összegek külön jelennek meg, és nem számítanak bele az arányokba.',
  'reports.trend.title': 'Havi trend',
  'reports.trend.description':
    'Kiadások, bevételek és nettó összeg az alappénznemben.',
  'reports.trend.partial': 'tört hónap',
  'reports.trend.partialHint':
    'A tört hónapokból csak a kiválasztott időszak napjai számítanak.',
  'reports.trend.unconvertedHint':
    'Az árfolyam nélküli összegek nem jelennek meg a diagramon. Az alábbi táblázat hónaponként külön mutatja őket.',
  'reports.trend.chartLabel': 'Havi kiadások és bevételek, nettó eredménnyel',
  'reports.trend.month': 'Hónap',
  'reports.trend.expenses': 'Kiadások',
  'reports.trend.incomes': 'Bevételek',
  'reports.trend.net': 'Nettó',
  'reports.pace.title': 'Költési ütem',
  'reports.pace.description':
    'Az e havi kiadásaidat az előző három naptári hónap azonos napjáig számított átlagával hasonlítja össze, a rövidebb hónapokhoz igazítva.',
  'reports.pace.current': 'Ebben a hónapban eddig',
  'reports.pace.average': 'Háromhavi átlag',
  'reports.pace.difference': 'Eltérés a megszokottól',
  'reports.pace.ahead': 'Több',
  'reports.pace.behind': 'Kevesebb',
  'reports.pace.onPace': 'A megszokott ütemben',
  'reports.pace.noBaseline': 'Nincs összehasonlítási alap',
  'reports.pace.partial':
    'Részleges összehasonlítás: néhány összeget nem lehet átváltani. Az érintett hónapokat lent láthatod.',
  'reports.pace.months': 'Összehasonlítás alapja',
  'reports.pace.refresh': 'Frissítés',
  'reports.pace.chartLabel': 'Eddigi havi kiadások a háromhavi átlaghoz képest',
  'reports.title': 'Kiadások kategóriánként',
  'reports.description':
    'Hasonlítsd össze a kategóriák összegét az alappénznemben, és nézd meg a hozzájuk tartozó tranzakciókat.',
  'reports.heading': 'Kimutatások az alappénznemben',
  'reports.introduction':
    'Nézd meg a választott időszak kategóriáit, havi trendjeit és pénzáramlását, vagy hasonlítsd össze az aktuális hónap költési ütemét.',
  'reports.view': 'Nézet',
  'reports.cashFlow.title': 'Pénzáramlás',
  'reports.cashFlow.income': 'Bevétel',
  'reports.cashFlow.expense': 'Kiadások',
  'reports.cashFlow.uncategorizedIncome': 'Kategória nélküli bevétel',
  'reports.cashFlow.uncategorizedExpense': 'Kategória nélküli kiadás',
  'reports.cashFlow.deficit': 'Megtakarításból fedezve / hiány',
  'reports.cashFlow.surplus': 'Megtakarítás / többlet',
  'reports.cashFlow.empty':
    'Ebben az időszakban nincs átváltott bevétel vagy kiadás.',
  'reports.cashFlow.description':
    'A bevételi kategóriáktól a Bevételen át vezet az út a kiadási kategóriákhoz. A megtakarítás vagy a hiány kiegyenlíti az átváltott összegeket; az át nem váltott összegek külön szerepelnek.',
  'reports.cashFlow.rounding':
    'A diagram kerekített kategóriaösszegeket használ, ezért az összegük kissé eltérhet az egész időszak egyszer kerekített végösszegétől.',
  'reports.dateRange': 'Időszak',
  'reports.period.thisMonth': 'Ez a hónap',
  'reports.period.lastMonth': 'Előző hónap',
  'reports.period.thisYear': 'Ez az év',
  'reports.period.last12Months': 'Utolsó 12 hónap',
  'reports.period.custom': 'Egyéni időszak',
  'reports.apply': 'Alkalmaz',
  'reports.loading': 'Kimutatás betöltése…',
  'reports.error': 'Nem sikerült betölteni a kimutatást. Próbáld újra.',
  'reports.error.range':
    'Adj meg érvényes időszakot, amely 1900-01-01 napján vagy utána kezdődik, és legfeljebb 100 év hosszú.',
  'reports.total': 'Összes kiadás',
  'reports.provisional': 'ideiglenes árfolyam',
  'reports.chartType': 'Diagram típusa',
  'reports.pie': 'Kördiagram',
  'reports.bar': 'Oszlopdiagram',
  'reports.unconverted': 'Át nem váltott',
  'reports.empty': 'Ebben az időszakban nincs figyelembe vett kiadás.',
  'reports.chartLabel': 'Kiadások kategóriák szerint',
  'reports.categories': 'Főkategóriák',
  'reports.subcategories': 'Alkategóriák',
  'reports.amount': 'Összeg',
  'reports.share': 'Arány',
  'reports.uncategorized': 'Kategória nélkül',
  'reports.back': 'Vissza a főkategóriákhoz',
  'reports.drillHint':
    'Válassz főkategóriát, majd alkategóriát a tranzakciók megnyitásához.',
  'reports.transactionFilter': 'A kimutatás alapján:',
  'reports.transactionFilter.expense': 'csak kiadások',
  'reports.transactionFilter.income': 'csak bevételek',
  'reports.transactionFilter.exactCategory': 'alkategóriák nélkül',
  'reports.transactionFilter.clear': 'Minden típus és alkategória mutatása',
  'transactions.title': 'Tranzakcióid egy helyen',
  'transactions.description':
    'Rögzítsd a kiadásaidat, bevételeidet és átvezetéseidet, hogy mindig naprakészek legyenek a számlaegyenlegeid.',
  'transactions.listDescription':
    'Szűrj időszakra, számlára, kategóriára, boltra vagy partnerre, címkére és megjegyzésre.',
  'adjustments.setRealBalance': 'Valós egyenleg rögzítése',
  'adjustments.edit': 'Egyenlegegyeztetés szerkesztése',
  'adjustments.save': 'Mentés',
  'adjustments.deleteConfirmation':
    'Végleg törlöd ezt az egyenlegegyeztetést? A számlaegyenleg frissül.',
  'adjustments.confirmDelete': 'Törlés',
  'adjustments.rowType': 'Egyenlegegyeztetés',
  'adjustments.observedBalance': 'Valós egyenleg',
  'adjustments.difference': 'Eltérés',
  'adjustments.zeroDifference': 'Az egyenleg pontos',
  'adjustments.zeroDifferenceHint':
    'Ez az egyeztetés már nem módosítja az egyenleget, ezért törölheted.',
  'adjustments.error.account': 'Válassz aktív számlát.',
  'adjustments.error.date': 'Adj meg érvényes naptári dátumot.',
  'adjustments.error.futureDate': 'Az egyenleg dátuma nem lehet jövőbeli.',
  'adjustments.error.balance':
    'Adj meg érvényes egyenleget ±90 071 992 547 409,91 között.',
  'adjustments.error.note': 'A megjegyzés legfeljebb 1000 karakter lehet.',
  'adjustments.error.notFound':
    'Az egyenlegegyeztetés nem található. Frissítsd a listát.',
  'transactions.excluded': 'Kihagyva',
  'transactions.excludedHint':
    'A számlaegyenlegbe beleszámít, de a kiadási és bevételi összesítésekből, valamint a kimutatásokból kimarad.',
  'transactions.exclusion': 'Kihagyott tranzakciók',
  'transactions.exclusion.all': 'Minden tranzakció',
  'transactions.exclusion.onlyExcluded': 'Csak a kihagyottak',
  'transactions.exclusion.hideExcluded': 'Kihagyottak elrejtése',
  'transactions.error.excluded':
    'Add meg, hogy a tranzakció kimaradjon-e a kimutatásokból.',
  'transactions.filters': 'Szűrők',
  'transactions.period': 'Időszak',
  'transactions.period.all': 'Teljes időszak',
  'transactions.period.thisMonth': 'Ez a hónap',
  'transactions.period.lastMonth': 'Előző hónap',
  'transactions.period.thisYear': 'Ez az év',
  'transactions.period.custom': 'Egyéni időszak',
  'transactions.from': 'Ettől',
  'transactions.to': 'Eddig',
  'transactions.allAccounts': 'Összes számla',
  'transactions.allCategories': 'Összes kategória',
  'transactions.allPayees': 'Összes bolt és partner',
  'transactions.search': 'Bolt / partner vagy megjegyzés',
  'transactions.applyFilters': 'Szűrés',
  'transactions.filteredTotals': 'Szűrt összesítés',
  'transactions.baseTotal': 'Összesen az alappénznemben',
  'transactions.unconverted': 'Át nem váltott',
  'transactions.provisional': 'ideiglenes',
  'transactions.matches': 'találat',
  'transactions.noMatches': 'Nincs találat.',
  'transactions.previousPage': 'Előző oldal',
  'transactions.nextPage': 'Következő oldal',
  'transactions.actions': 'Műveletek',
  'transactions.error.filters':
    'Válassz érvényes szűrőket és helyes időszakot.',
  'transactions.error.totals':
    'A szűrt végösszeg túl nagy a pontos megjelenítéshez.',
  'transactions.duplicate': 'Másolat készítése',
  'templates.title': 'Sablonok',
  'templates.choose': 'Válassz sablont',
  'templates.use': 'Sablon betöltése',
  'templates.create': 'Új sablon',
  'templates.edit': 'Sablon szerkesztése',
  'templates.delete': 'Törlés',
  'templates.save': 'Mentés',
  'templates.name': 'Sablon neve',
  'templates.saveTransaction': 'Mentés sablonként',
  'templates.savedTransactionHint':
    'A mentett tranzakció adatait használja; a panel még nem mentett módosításait nem.',
  'templates.optionalHint':
    'Csak a név kötelező. A többi mezőt üresen hagyhatod, és a sablon használatakor töltheted ki.',
  'templates.tagsHint':
    'Soronként egy címkenevet adj meg. A még nem létező címkék a sablonnal együtt létrejönnek.',
  'templates.deleteConfirmation': 'Törlöd ezt a sablont?',
  'templates.amountRequired':
    'A tranzakció mentése előtt adj meg egy összeget.',
  'templates.error.name': 'Adj meg egy 1–100 karakteres sablonnevet.',
  'templates.error.split': 'Felosztott tranzakciót nem menthetsz sablonként.',
  'templates.error.notFound': 'A sablon nem található. Frissítsd a listát.',
  'transactions.create': 'Új tranzakció',
  'transactions.edit': 'Tranzakció szerkesztése',
  'transactions.delete': 'Törlés',
  'transactions.deleteConfirmation':
    'Végleg törlöd ezt a tranzakciót? A számlaegyenleg frissül.',
  'transactions.confirmDelete': 'Törlés',
  'attachments.title': 'Csatolmányok',
  'attachments.add': 'Hozzáadás',
  'attachments.drop': 'Húzz ide JPEG-, PNG-, WebP- vagy PDF-fájlokat.',
  'attachments.empty': 'Nincs csatolmány.',
  'attachments.open': 'Megnyitás',
  'attachments.remove': 'Eltávolítás',
  'attachments.deleteWithTransaction': 'Tranzakció és csatolmányok törlése',
  'attachments.saveCopiesAndDelete':
    'Csatolmányok mentése mappába…, majd törlés',
  'attachments.error.type':
    'JPEG-, PNG-, WebP- vagy PDF-fájlt válassz. A fájltípust a tartalma alapján ellenőrizzük.',
  'attachments.error.size': 'Egy csatolmány legfeljebb 25 MB lehet.',
  'attachments.error.path': 'A kiválasztott fájl nem olvasható.',
  'attachments.error.store': 'Nem sikerült a csatolmányt a profilba másolni.',
  'attachments.error.staged': 'Az előkészített csatolmány már nem érhető el.',
  'attachments.error.notFound':
    'A csatolmány nem található. Frissítsd a tranzakciót.',
  'attachments.error.copy':
    'Nem sikerült a csatolmányokat ebbe a mappába menteni.',
  'attachments.error.open': 'Nem sikerült megnyitni a csatolmányt.',
  'transactions.cancel': 'Mégse',
  'transactions.close': 'Tranzakciós panel bezárása',
  'transactions.save': 'Mentés',
  'transactions.loading': 'Tranzakciók betöltése…',
  'transactions.empty': 'Még nincs tranzakció.',
  'transactions.noAccounts':
    'A tranzakció rögzítéséhez előbb hozz létre egy aktív számlát.',
  'transactions.refresh': 'Frissítés',
  'transactions.kind': 'Tranzakció típusa',
  'transactions.expense': 'Kiadás',
  'transactions.income': 'Bevétel',
  'transactions.transfer': 'Átvezetés',
  'transactions.date': 'Dátum',
  'transactions.amount': 'Összeg',
  'amount.result': 'Kiszámított összeg',
  'transactions.amountHint':
    'A + - * / jelekkel és zárójelekkel számítást is megadhatsz. Tizedesjelként pontot vagy vesszőt használhatsz, az ezreseket pedig tagolhatod (pl. 1 234,50). Ha kilépsz a mezőből vagy megnyomod az Entert, az eredményt századra kerekítjük.',
  'transactions.account': 'Számla',
  'transactions.fromAccount': 'Honnan',
  'transactions.toAccount': 'Hová',
  'transactions.fromAmount': 'Elküldött összeg',
  'transactions.toAmount': 'Megérkezett összeg',
  'transactions.actualRate': 'Alkalmazott árfolyam',
  'transactions.fee': 'Díj',
  'transactions.feeCategory': 'Díj kategóriája',
  'transactions.optional': 'Nem kötelező',
  'transactions.chooseAccount': 'Válassz számlát',
  'transactions.payee': 'Bolt / partner',
  'transactions.payee.expense': 'Bolt',
  'transactions.payee.income': 'Forrás',
  'transactions.payeeHint': 'Válassz a meglévő nevek közül, vagy írj be újat.',
  'transactions.category': 'Kategória',
  'transactions.note': 'Megjegyzés',
  'transactions.noPayee': 'Nincs megadva',
  'transactions.noCategory': 'Nincs kategória',
  'transactions.unknownAccount': 'Ismeretlen számla',
  'transactions.error':
    'Nem sikerült módosítani a tranzakciót. Frissíts, és próbáld újra.',
  'transactions.error.account': 'Válassz aktív számlát.',
  'transactions.error.kind': 'Válassz kiadást vagy bevételt.',
  'transactions.error.date': 'Adj meg érvényes naptári dátumot.',
  'transactions.error.futureDate': 'A tranzakció dátuma nem lehet jövőbeli.',
  'transactions.error.amount':
    'Adj meg érvényes számítást, amelynek eredménye pozitív és legfeljebb 90 071 992 547 409,91. Nullával nem lehet osztani.',
  'transactions.error.payee': 'A név legfeljebb 100 karakter lehet.',
  'transactions.error.category':
    'A kiadásnak vagy bevételnek megfelelő aktív kategóriát válassz.',
  'transactions.error.note': 'A megjegyzés legfeljebb 1000 karakter lehet.',
  'transactions.error.notFound':
    'A tranzakció nem található. Frissítsd a listát.',
  'transactions.error.lines':
    'A részek összege nem egyezik a tranzakció végösszegével.',
  'splits.split': 'Felosztás',
  'splits.unsplit': 'Felosztás megszüntetése',
  'splits.remaining': 'Még felosztandó',
  'splits.part': 'Rész',
  'splits.remove': 'Eltávolítás',
  'splits.addPart': 'Új rész',
  'splits.indicator': 'Felosztott',
  'tags.title': 'Címkék',
  'tags.all': 'Minden címke',
  'tags.manage': 'Címkék kezelése',
  'tags.empty': 'A tranzakciós panelen hozhatsz létre címkéket.',
  'tags.name': 'Címke neve',
  'tags.rename': 'Átnevezés',
  'tags.delete': 'Törlés',
  'tags.save': 'Mentés',
  'tags.add': 'Hozzáadás',
  'tags.remove': 'Eltávolítás',
  'tags.hint':
    'Válassz meglévő címkét, vagy írj be újat. Nyomd meg az Entert, vagy válaszd a Hozzáadást; az új címkék mentéskor jönnek létre.',
  'tags.deleteConfirmation':
    'Törlöd ezt a címkét, és eltávolítod minden tranzakcióról?',
  'tags.error.name': 'A címke neve 1–100 karakter lehet.',
  'tags.error.notFound': 'A címke nem található. Frissítsd a listát.',
  'tags.error.duplicate': 'Már létezik ilyen nevű címke.',
  'undo.available': 'Módosítás mentve.',
  'transfers.error.accountsDiffer': 'Válassz két különböző számlát.',
  'transfers.error.equalAmounts':
    'Azonos pénznemű számláknál a két összegnek egyeznie kell.',
  'transfers.error.notFound': 'Az átvezetés nem található. Frissítsd a listát.',
  'transfers.error.linkedFee':
    'Ezt a díjat a hozzá tartozó átvezetésnél módosítsd vagy töröld.',
  'undo.action': 'Visszavonás',
  'undo.error': 'Nem sikerült visszavonni a módosítást.',
  'accounts.title': 'Számláid egy helyen',
  'accounts.description':
    'A számlaegyenleg a nyitóegyenlegből, a dátummal rögzített pénzmozgásokból és az egyenlegegyeztetésekből áll össze, a számla saját pénznemében.',
  'accounts.create': 'Új számla',
  'accounts.name': 'Számla neve',
  'accounts.currency': 'Pénznem',
  'accounts.openingBalance': 'Nyitóegyenleg',
  'accounts.openingDate': 'Nyitóegyenleg dátuma',
  'accounts.balance': 'Egyenleg',
  'accounts.balanceHint':
    'Használhatsz + - * / műveleteket, zárójeleket, tizedesjelként pontot vagy vesszőt, valamint ezres tagolást. A mező elhagyásakor vagy az Enter megnyomásakor az eredményt századra kerekítjük. Negatív és nulla egyenleget is megadhatsz.',
  'accounts.empty': 'Hozd létre az első számlát az egyenleg követéséhez.',
  'accounts.loading': 'Számlák betöltése…',
  'accounts.rename': 'Átnevezés',
  'accounts.changeCurrency': 'Pénznem módosítása',
  'accounts.archive': 'Archiválás',
  'accounts.unarchive': 'Újraaktiválás',
  'accounts.archived': 'Archiválva — nem jelenik meg a számlaválasztókban',
  'accounts.delete': 'Törlés',
  'accounts.deleteConfirmation': 'Végleg törlöd ezt a számlát?',
  'accounts.confirmDelete': 'Végleges törlés',
  'accounts.save': 'Mentés',
  'accounts.cancel': 'Mégse',
  'accounts.refresh': 'Frissítés',
  'accounts.locked':
    'Ha a számlán már van tranzakció, nem törölheted és a pénznemét sem módosíthatod.',
  'accounts.error':
    'Nem sikerült módosítani a számlát. Frissíts, és próbáld újra.',
  'accounts.error.name': 'Adj meg egy 1–100 karakteres számlanevet.',
  'accounts.error.currency': 'HUF vagy CHF pénznemet válassz.',
  'accounts.error.balance':
    'Adj meg érvényes számítást, amelynek eredménye ±90 071 992 547 409,91 között van. Nullával nem lehet osztani.',
  'accounts.error.date': 'Adj meg érvényes nyitási dátumot.',
  'accounts.error.notFound': 'A számla nem található. Frissítsd a listát.',
  'accounts.error.currencyLocked':
    'A pénznem nem módosítható, ha a számlán már van tranzakció.',
  'accounts.error.notEmpty':
    'A számlán vannak tranzakciók, ezért nem törölhető. Archiváld helyette.',
  'settings.title': 'Beállítások',
  'settings.description':
    'A nyelv, a megjelenés, az alappénznem és a blokkok fogadása ehhez a profilhoz tartozik, és a módosítások azonnal életbe lépnek.',
  'settings.baseCurrency': 'Alappénznem',
  'settings.version': 'Alkalmazásverzió',
  'settings.error': 'Nem sikerült menteni a beállításokat. Próbáld újra.',
  'watchedFolder.title': 'Figyelt mappa',
  'watchedFolder.hint':
    'A Financial Tracker adatmappáján kívül bármely helyi mappát választhatsz, akár Google Drive-val vagy OneDrive-val szinkronizált mappát is. A teljesen bemásolt blokkfotók a „feldolgozott” nevű almappába kerülnek.',
  'watchedFolder.error.userData':
    'Válassz a Financial Tracker adatmappáján kívüli mappát.',
  'watchedFolder.current': 'Kiválasztott mappa',
  'watchedFolder.none': 'Nincs kiválasztva mappa',
  'watchedFolder.status': 'Állapot',
  'watchedFolder.status.watching': 'Aktív',
  'watchedFolder.status.unavailable': 'Nem érhető el',
  'watchedFolder.choose': 'Mappa kiválasztása',
  'watchedFolder.clear': 'Figyelés kikapcsolása',
  'watchedFolder.intakeFailure':
    'Nem sikerült hozzáadni egy blokkfotót a figyelt mappából',
  'watchedFolder.dismissFailure': 'Bezárás',
  'backups.title': 'Biztonsági mentések',
  'backups.description':
    'A profil minden megnyitásakor biztonsági mentés készül az adatbázisról. Az utolsó 10 indítási mentést őrizzük meg; a frissítések előtti mentéseket külön tároljuk.',
  'backups.loading': 'Biztonsági mentések betöltése…',
  'backups.empty': 'Nincs indításkor készült biztonsági mentés.',
  'backups.choose': 'Dátum és időpont',
  'backups.restore': 'Visszaállítás',
  'backups.confirmDescription':
    'Visszaállítod ezt a biztonsági mentést? A profil jelenlegi adatbázisa és a mentés óta végzett módosítások elvesznek.',
  'backups.confirmRestore': 'Visszaállítás',
  'backups.cancel': 'Mégse',
  'backups.error':
    'Nem sikerült elvégezni a műveletet. Ha a helyreállítás sem sikerült, indítsd újra az alkalmazást a folytatás előtt.',
  'backups.restored':
    'A biztonsági mentés visszaállt, a profil adatbázisa újra megnyílt.',
  'backups.error.confirmation':
    'A folytatás előtt erősítsd meg a visszaállítást.',
  'backups.error.notFound':
    'Ez a biztonsági mentés már nem érhető el. Frissítsd a listát.',
  'backups.error.restore':
    'Nem sikerült visszaállítani a mentést; az előző adatbázis újra megnyílt.',
  'backups.error.recovery':
    'A helyreállítás nem sikerült. Folytatás előtt indítsd újra az alkalmazást.',
  'backups.error.create':
    'Nem sikerült létrehozni és ellenőrizni az indítási mentést.',
  'backups.error.invalid': 'A kiválasztott mentés sérült vagy érvénytelen.',
  'backups.error.foreign':
    'A kiválasztott mentés egy másik profilhoz tartozik.',
  'backups.error.newerSchema':
    'A kiválasztott mentéshez újabb alkalmazásverzió szükséges.',
  'settings.language': 'Nyelv',
  'settings.theme': 'Megjelenés',
  'language.hu': 'Magyar',
  'language.en': 'Angol',
  'language.de': 'Német',
  'theme.light': 'Világos',
  'theme.dark': 'Sötét',
  'theme.system': 'A Windows beállítása szerint',
  'settings.preview': 'Formázási előnézet',
  'settings.date': 'Dátum',
  'settings.number': 'Szám',
  'phoneUpload.title': 'Blokk feltöltése telefonról',
  'phoneUpload.starting': 'Telefonos feltöltés indítása a magánhálózaton…',
  'phoneUpload.noPrivateNetwork':
    'Nincs kapcsolat magánhálózattal. Csatlakoztasd a számítógépet egy Wi-Fi-magánhálózathoz, majd próbáld újra.',
  'phoneUpload.error':
    'Nem sikerült elindítani a telefonos feltöltést. Próbáld újra.',
  'phoneUpload.interface': 'Magánhálózat',
  'phoneUpload.qrAlt': 'A telefonos feltöltés címét tartalmazó QR-kód',
  'phoneUpload.address': 'Ezt a címet is megnyithatod a telefonon',
  'phoneUpload.expiresIn': 'Automatikusan leáll {time} múlva',
  'phoneUpload.expired': 'A feltöltés leállt.',
  'phoneUpload.uploaded': 'Feltöltött blokkok: {count}',
  'phoneUpload.firewallTitle': 'Windows tűzfal',
  'phoneUpload.firewallGuidance':
    'A Windows engedélyt kérhet a „Financial Tracker” számára. Csak magánhálózatokon engedélyezd. Ha a telefon nem tud csatlakozni, ellenőrizd, hogy mindkét eszköz ugyanazt a Wi-Fi-hálózatot használja, és a Windowsban „Magánhálózat” legyen a hálózati profil.',
  'phoneUpload.close': 'Bezárás',
  'help.accessibleName': 'Súgó',
  'help.page.profilePicker':
    'Egy profil egy személy elkülönített pénzügyeit tartalmazza. Válassz meglévő profilt, vagy hozz létre újat; mindegyiket külön helyi adatbázisban tároljuk.',
  'help.profilePicker.profiles':
    'Nyiss meg egy profilt a hozzá tartozó pénzügyek és beállítások használatához. Át is nevezheted, vagy a helyi adataival együtt végleg törölheted.',
  'help.profilePicker.create':
    'Hozz létre profilt egy másik személy vagy elkülönített pénzügyek számára ezen a számítógépen. Adj neki könnyen felismerhető nevet; később is átnevezheted.',
  'help.page.overview':
    'Hasonlítsd össze az aktuális hónap eddigi kiadásait, bevételeit és nettó eredményét az előző teljes hónappal. A kimutatásokból kihagyott tranzakciók nem számítanak bele. Az összegeket az alappénznemre váltva láthatod, ha van hozzájuk árfolyam.',
  'help.page.transactions':
    'Itt rögzítheted és nézheted át a kiadásokat, bevételeket, átvezetéseket és egyenlegegyeztetéseket. A szűrők a listát és az összesítést is szűkítik.',
  'help.page.receipts':
    'A blokkfotók itt várnak, amíg tranzakcióként jóváhagyod vagy törlöd őket. A szövegfelismerés csak ezen a számítógépen fut; mindig ellenőrizd az előre kitöltött adatokat.',
  'help.page.recurring':
    'Itt adhatod meg a rendszeres kiadásokat és bevételeket. Az esedékes alkalmak jóváhagyásra várnak, és csak a jóváhagyás után számítanak bele a pénzügyeidbe.',
  'help.page.reports':
    'Itt az alappénznemben elemezheted a kiadásaidat és bevételeidet. A kihagyott tranzakciók nem számítanak bele. Az árfolyam nélküli összegek külön jelennek meg, és kimaradnak az átváltott diagramokból és összesítésekből.',
  'help.page.accounts':
    'A számla egy hely, ahol egyetlen pénznemben tartasz pénzt. Egyenlege a nyitóegyenlegből, a dátummal rögzített pénzmozgásokból és az egyenlegegyeztetésekből áll össze.',
  'help.page.settings':
    'A legtöbb beállítás az aktuális profilra vonatkozik. A Gyors rögzítés billentyűparancsa és az Indítás a Windows rendszerrel beállítás a Windows-fiók összes profiljára érvényes.',
  'help.page.quickAdd':
    'A főablak megnyitása nélkül rögzíthetsz kiadást vagy bevételt az aktív profilban. Válassz számlát, ellenőrizd az adatokat, majd mentsd a tranzakciót.',
  'help.overview.expenses':
    'Az aktuális hónap eddigi kiadásai az előző teljes hónaphoz képest, a kimutatásokból kihagyott tranzakciók nélkül. A Tranzakciók gombbal megnyithatod a hozzájuk tartozó tranzakciókat.',
  'help.overview.incomes':
    'Az aktuális hónap eddigi bevételei az előző teljes hónaphoz képest, a kimutatásokból kihagyott tranzakciók nélkül. A Tranzakciók gombbal megnyithatod a hozzájuk tartozó tranzakciókat.',
  'help.overview.net':
    'A bevételek és kiadások különbsége az adott időszakban. Az átvezetések, az egyenlegegyeztetések és a kihagyott tranzakciók nem módosítják.',
  'help.overview.topCategories':
    'Az aktuális hónap öt legnagyobb, átváltott összegű kiadási kategóriája, a kimutatásokból kihagyott tranzakciók nélkül. Kattints egy kategóriára a hozzá tartozó tranzakciók megnyitásához.',
  'help.transactions.filters':
    'A szűrők módosítják a megjelenő tranzakciókat és a lista feletti összesítést. Exportálás előtt alkalmazd őket; a CSV az összes találatot tartalmazza, nemcsak az aktuális oldalt.',
  'help.transactions.excluded':
    'A kimutatásokból kihagyott tranzakció módosítja a számlaegyenleget, de nem számít bele a kiadási és bevételi összesítésekbe. Ilyen lehet például egy később visszatérített kiadás.',
  'help.transactions.templates':
    'A sablon újra felhasználható, előre kitöltött tranzakcióadatokat tárol. Válassz egyet a panel kitöltéséhez, vagy készíts sablont a gyakran együtt megadott adatokból.',
  'help.transactions.duplicate':
    'A másolat azonnal, mai dátummal menti az eredeti tranzakció adatait és címkéit. Ha mégsem szeretnéd megtartani, válaszd a Visszavonást.',
  'help.transactions.balanceAdjustment':
    'Rögzítsd a számla valós egyenlegét az adott nap végén. Az alkalmazás az előzményekből újraszámítja az eltérést, amely nem számít kiadásnak vagy bevételnek.',
  'help.transactions.csvExport':
    'Az alkalmazott szűrőknek megfelelő kiadásokat és bevételeket exportálja. A felosztás részei külön sorban jelennek meg; az átvezetések és az egyenlegegyeztetések kimaradnak.',
  'help.transactions.csvSeparator':
    'Válaszd ki, hogyan jelenjenek meg a tizedes törtek a táblázatkezelőben. Pont esetén vessző, vessző esetén pontosvessző választja el a mezőket.',
  'help.transactions.amountCalculator':
    'A + - * / jelekkel és zárójelekkel számítást is megadhatsz. A végeredményt századra kerekítjük; a HUF-előnézet egész forintot mutat.',
  'help.transactions.split':
    'A felosztás egy tranzakciót különböző összegű, kategóriájú, címkéjű és megjegyzésű részekre bont. A részek összege egyezzen meg a tranzakció végösszegével.',
  'help.transactions.transfer':
    'Az átvezetés két számla között mozgat pénzt; nem kiadás és nem bevétel. Eltérő pénznemeknél mindkét tényleges összeget add meg, az árfolyamot ezekből számítjuk.',
  'help.transactions.transferFee':
    'Az átvezetési díjat külön kiadásként rögzítjük a forrásszámlán. Válassz hozzá kategóriát. A Kihagyva jelölőt csak akkor kapcsold be, ha a díjat a kimutatásokban sem szeretnéd látni.',
  'help.transactions.tags':
    'A címkékkel a kategóriáktól függetlenül csoportosíthatod a tranzakciókat. Adj hozzá meglévő vagy új címkéket; a Címkék kezelésénél átnevezheted vagy törölheted őket.',
  'help.transactions.tagsBasic':
    'A címkékkel a kategóriáktól függetlenül csoportosíthatod a tranzakciókat. Válassz meglévő címkét, vagy írj be újat.',
  'help.transactions.attachments':
    'A csatolmányokat a profilba másoljuk, és a tranzakcióval együtt őrizzük meg. Az eltávolítás leválasztja a fájlt; a Visszavonás újra csatolja. A már nem használt fájlt az alkalmazás később törölheti.',
  'help.transactions.drawer':
    'Itt kiadást, bevételt vagy átvezetést rögzíthetsz és szerkeszthetsz. Egysoros mezőben az Enter ment, a Ctrl+Enter mentés után új űrlapot nyit.',
  'help.receipts.phoneUpload':
    'Ideiglenes feltöltőoldalt indít, amelyet az ugyanarra a Wi-Fi-magánhálózatra csatlakozó telefonodon nyithatsz meg. A munkamenet alatt bárki hozzáférhet a feltöltésekhez, aki ismeri a címet, ezért csak megbízható magánhálózaton használd, és utána zárd be.',
  'help.recurring.pending':
    'A jóváhagyásra váró tranzakciók esedékes alkalmak. Jóváhagyhatod őket, előtte módosíthatod az összeget vagy a dátumot, illetve kihagyhatod az adott alkalmat.',
  'help.recurring.definitions':
    'Az Ütemezések lapon a rendszeres tranzakciók közös adatait és ismétlődését kezelheted. Szüneteltetéskor nem jön létre új jóváhagyásra váró alkalom; folytatáskor a közben elmúlt dátumok kimaradnak.',
  'help.recurring.editor':
    'Add meg a jövőbeli alkalmak tranzakcióadatait és ütemezését. Az ütemezés létrehozása előtti dátumokra nem készül tranzakció.',
  'help.recurring.schedule':
    'Válaszd ki, milyen gyakran és melyik naptári napon ismétlődjön a tranzakció. A nem kötelező befejező dátum után már nem jön létre új alkalom.',
  'help.reports.dateRange':
    'Válaszd ki a kategória-, havi trend- és pénzáramlási kimutatások időszakát. A költési ütem mindig az aktuális hónapot hasonlítja össze az előző három naptári hónappal.',
  'help.reports.category':
    'A kiadások főkategóriánként, az alappénznemben jelennek meg; a kihagyott tranzakciók nem számítanak bele. Válassz főkategóriát, majd alkategóriát a hozzájuk tartozó tranzakciók megnyitásához.',
  'help.reports.trend':
    'Hasonlítsd össze a havi kiadásokat, bevételeket és nettó összeget; a kihagyott tranzakciók nem számítanak bele. A tört hónapokból csak a kiválasztott időszak napjai jelennek meg.',
  'help.reports.pace':
    'Az aktuális hónap eddigi kiadásait az előző három naptári hónap azonos napjáig számított átlagával hasonlítja össze, a kihagyott tranzakciók nélkül. Rövidebb hónapoknál az utolsó napig számol.',
  'help.reports.cashFlow':
    'Megmutatja, hogyan oszlanak meg az átváltott bevételek a kiadási kategóriák között. A bevételek és kiadások különbsége megtakarításként vagy hiányként jelenik meg; az át nem váltott összegek külön maradnak.',
  'help.reports.breakdown':
    'Válassz főkategóriát az alkategóriák megtekintéséhez. Egy alkategóriára kattintva megnyílnak az összeghez tartozó kiadási tranzakciók; a kihagyott tranzakciók nem számítanak bele.',
  'help.accounts.create':
    'Hozz létre külön számlát minden olyan helyhez és pénznemhez, ahol pénzt tartasz. Add meg a nyitóegyenleget és azt a dátumot, amelytől az előzményeket vezetni szeretnéd.',
  'help.accounts.currency':
    'Minden számlának pontosan egy pénzneme van. Csak akkor módosíthatod, ha a számlán nincs tranzakció, átvezetés vagy egyenlegegyeztetés.',
  'help.accounts.openingBalance':
    'A nyitóegyenleg a számla egyenlege az előzmények kezdőnapján. Lehet pozitív, nulla vagy negatív, és számítást is beírhatsz a mezőbe.',
  'help.accounts.archive':
    'Az archiválás elrejti a számlát az adatbeviteli listákból, de az előzményeit és az egyenlegét megtartja. Ha újra használnád, aktiváld újra.',
  'help.settings.categories':
    'A kategóriák legfeljebb két szinten sorolják be a kiadásokat és bevételeket: főkategória és alkategória. A meglévő tranzakciók módosítása nélkül rendezheted át vagy archiválhatod őket.',
  'help.settings.rules':
    'Az automatikus kategorizálás egyezés esetén kitölti a Bolt / partner, a kategória vagy a címkék mezőjét. A szabályok fentről lefelé futnak, és az első találat érvényesül.',
  'help.settings.ruleAmountCurrency':
    'Az összeghatárokat ebben a pénznemben vizsgáljuk. Ha számlát is választasz feltételként, automatikusan annak pénznemét használjuk.',
  'help.settings.backups':
    'A visszaállítás a kiválasztott biztonsági mentésre cseréli a profil jelenlegi adatait, ezért a mentés óta végzett módosítások elvesznek.',
  'help.settings.watchedFolder':
    'A teljesen bemásolt fotót először a „feldolgozott” nevű almappába helyezzük, majd onnan importáljuk a blokkok közé. Ha az importálás nem sikerül, a fájl ott marad, és értesítést kapsz.',
  'help.settings.baseCurrency':
    'A kimutatások a többi pénznemet az adott nap árfolyamával erre a pénznemre váltják. A módosítás a kimutatások megjelenítését változtatja, a számlákon tárolt összegeket nem.',
  'help.settings.exchangeRates':
    'Az alkalmazás letölti és helyben tárolja a hivatalos MNB-árfolyamokat. A tárolt időszak utáni dátumoknál a legutóbbi árfolyamot használja, és ideiglenesként jelöli. Csak az az összeg marad átváltatlan, amelynek dátumához nincs korábbi közzétett árfolyam.',
  'help.settings.privacy':
    'A Privát mód elrejti az összegeket, és olvashatatlanná teszi a diagramértékeket, de a tárolt adatokat nem módosítja. Bárhol be- és kikapcsolhatod a Ctrl+Shift+H billentyűkkel.',
  'help.settings.formattingPreview':
    'Az előnézet megmutatja, hogyan formázza a választott nyelv a dátumokat és számokat. A tárolt értékek nem változnak.',
} satisfies MessageCatalog
