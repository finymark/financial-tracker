import type { Language } from './settings'

export const csvHeaderKeys = [
  'csv.header.date',
  'csv.header.account',
  'csv.header.kind',
  'csv.header.payee',
  'csv.header.mainCategory',
  'csv.header.subcategory',
  'csv.header.amount',
  'csv.header.currency',
  'csv.header.note',
  'csv.header.tags',
  'csv.header.excluded',
] as const

type CsvKey =
  | (typeof csvHeaderKeys)[number]
  | 'csv.kind.expense'
  | 'csv.kind.income'
  | 'csv.yes'
  | 'csv.no'
  | 'csv.export'
  | 'csv.save'
  | 'csv.fileType'

export const csvMessages = {
  en: {
    'csv.export': 'Export CSV',
    'csv.save': 'Save CSV',
    'csv.fileType': 'CSV files',
    'csv.header.date': 'Date',
    'csv.header.account': 'Account',
    'csv.header.kind': 'Kind',
    'csv.header.payee': 'Payee',
    'csv.header.mainCategory': 'Main category',
    'csv.header.subcategory': 'Subcategory',
    'csv.header.amount': 'Amount',
    'csv.header.currency': 'Currency',
    'csv.header.note': 'Note',
    'csv.header.tags': 'Tags',
    'csv.header.excluded': 'Excluded',
    'csv.kind.expense': 'Expense',
    'csv.kind.income': 'Income',
    'csv.yes': 'Yes',
    'csv.no': 'No',
  },
  hu: {
    'csv.export': 'Exportálás CSV-be',
    'csv.save': 'Mentés',
    'csv.fileType': 'CSV-fájlok',
    'csv.header.date': 'Dátum',
    'csv.header.account': 'Számla',
    'csv.header.kind': 'Típus',
    'csv.header.payee': 'Bolt / partner',
    'csv.header.mainCategory': 'Főkategória',
    'csv.header.subcategory': 'Alkategória',
    'csv.header.amount': 'Összeg',
    'csv.header.currency': 'Pénznem',
    'csv.header.note': 'Megjegyzés',
    'csv.header.tags': 'Címkék',
    'csv.header.excluded': 'Kihagyva',
    'csv.kind.expense': 'Kiadás',
    'csv.kind.income': 'Bevétel',
    'csv.yes': 'Igen',
    'csv.no': 'Nem',
  },
  de: {
    'csv.export': 'CSV exportieren',
    'csv.save': 'CSV speichern',
    'csv.fileType': 'CSV-Dateien',
    'csv.header.date': 'Datum',
    'csv.header.account': 'Konto',
    'csv.header.kind': 'Art',
    'csv.header.payee': 'Zahlungspartner',
    'csv.header.mainCategory': 'Hauptkategorie',
    'csv.header.subcategory': 'Unterkategorie',
    'csv.header.amount': 'Betrag',
    'csv.header.currency': 'Währung',
    'csv.header.note': 'Notiz',
    'csv.header.tags': 'Tags',
    'csv.header.excluded': 'Ausgeschlossen',
    'csv.kind.expense': 'Ausgabe',
    'csv.kind.income': 'Einnahme',
    'csv.yes': 'Ja',
    'csv.no': 'Nein',
  },
} satisfies Record<Language, Record<CsvKey, string>>
