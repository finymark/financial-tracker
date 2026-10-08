import { categoryNames } from '../../../shared/category-translations'
import type { MessageCatalog } from './en'

export const hu = {
  ...categoryNames.hu,
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
  'categories.error.transactionIntegration':
    'A tranzakciók átsorolása ebben a verzióban még nem érhető el. A kategória nem lett törölve.',

  'updates.ready':
    'A frissítés letöltődött. A telepítéshez indítsa újra az alkalmazást.',
  'updates.restart': 'Újraindítás és frissítés',
  'updates.error': 'Nem sikerült újraindítani a frissítéshez. Próbálja újra.',
  'app.name': 'Financial Tracker',
  'app.tagline': 'Pénzügyeid a saját számítógépeden.',
  'navigation.label': 'Fő navigáció',
  'navigation.overview': 'Áttekintés',
  'navigation.transactions': 'Tranzakciók',
  'navigation.accounts': 'Számlák',
  'navigation.settings': 'Beállítások',
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
  'overview.title': 'Pénzügyeid átláthatóan',
  'overview.description':
    'A pénzügyi áttekintés itt jelenik majd meg, amikor a számlák és a tranzakciók elérhetővé válnak.',
  'transactions.title': 'Tranzakcióid egy helyen',
  'transactions.description':
    'A kiadások és bevételek rögzítése és áttekintése később itt lesz elérhető.',
  'accounts.title': 'Minden számlának saját hely',
  'accounts.description':
    'Minden egyenleg a számla pénznemében látható. Az egyenlegek jelenleg a nyitó egyenlegekkel egyeznek meg.',
  'accounts.create': 'Számla létrehozása',
  'accounts.name': 'Számla neve',
  'accounts.currency': 'Pénznem',
  'accounts.openingBalance': 'Nyitó egyenleg',
  'accounts.openingDate': 'Nyitás dátuma',
  'accounts.balance': 'Egyenleg',
  'accounts.balanceHint':
    'Pontot vagy vesszőt és legfeljebb két tizedesjegyet használj, ezres tagolás nélkül. Negatív egyenleg is megadható.',
  'accounts.empty': 'Hozz létre egy számlát az egyenleg követéséhez.',
  'accounts.loading': 'Számlák betöltése…',
  'accounts.rename': 'Átnevezés',
  'accounts.changeCurrency': 'Pénznem módosítása',
  'accounts.archive': 'Archiválás',
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
    'Adj meg érvényes egyenleget legfeljebb két tizedesjeggyel, tagolás nélkül, ±90 071 992 547 409,91 határon belül.',
  'accounts.error.date': 'Adj meg érvényes nyitási dátumot.',
  'accounts.error.notFound': 'A számla nem található. Frissítsd a listát.',
  'accounts.error.currencyLocked':
    'A pénznem nem módosítható, ha a számlán már vannak tranzakciók.',
  'accounts.error.notEmpty':
    'A számlán vannak tranzakciók, ezért nem törölhető. Archiváld helyette.',
  'settings.title': 'Érezd magad otthon',
  'settings.description':
    'A nyelv, a megjelenés és az alap pénznem a profilhoz mentődik, és azonnal érvényesül.',
  'settings.baseCurrency': 'Alap pénznem',
  'settings.error': 'A beállításokat nem sikerült menteni. Próbáld újra.',
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
} satisfies MessageCatalog
