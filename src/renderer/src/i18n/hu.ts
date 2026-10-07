import type { MessageCatalog } from './en'

export const hu = {
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
    'A számláid és egyenlegeik később itt lesznek elérhetők.',
  'settings.title': 'Érezd magad otthon',
  'settings.description':
    'A nyelv és a megjelenés módosítása azonnal érvényesül. Ezek az ideiglenes beállítások az alkalmazás újraindításakor visszaállnak; a profilbeállítások később érkeznek.',
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
