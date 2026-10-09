# Financial Tracker

A local-first desktop expense tracker for a few people sharing one Windows PC. It records where money goes, by category, across accounts in multiple currencies.

## Language

_HU_ is the Hungarian UI term. The Hungarian UI uses the informal "te" form.

### People and settings

**Profile**:
One person's separate set of finances within the app; several profiles can exist on the same installation.
_HU_: Profil
_Avoid_: User, account (for a person)

**Base currency**:
The currency a profile chooses for its reports; amounts in other currencies are converted into it.
_HU_: Alappénznem
_Avoid_: Main currency, home currency

### Money and accounts

**Account**:
A place where money is held (e.g. a bank account, a Revolut currency pocket, cash), always in exactly one currency.
_HU_: Számla
_Avoid_: Wallet, pocket

**Transaction**:
A single movement of money into or out of one account, either an expense or an income.
_HU_: Tranzakció (kiadás vagy bevétel)
_Avoid_: Entry, record, item

**Transfer**:
A movement of money between two accounts of the same profile, including currency exchange; it is neither an expense nor an income.
_HU_: Átvezetés
_Avoid_: Internal transaction, exchange

**Exchange rate**:
The official MNB rate used to convert an amount into the base currency for a given day; a transfer between currencies may carry its own actual rate instead.
_HU_: Árfolyam (MNB-árfolyam)

**Balance adjustment**:
A recorded real balance of an account on a given date; the app absorbs any difference to it without counting as an expense or income.
_HU_: Egyenlegegyeztetés; the action is „Valós egyenleg rögzítése”
_Avoid_: Correction transaction, fake income

### Organization

**Category**:
A two-level classification of a transaction's purpose (main category → subcategory).
_HU_: Kategória (főkategória, alkategória)
_Avoid_: Type, group

**Split**:
A transaction divided into parts, each part with its own category and amount.
_HU_: Felosztás
_Avoid_: Sub-transaction

**Tag**:
A free-form label on a transaction, or on one part of a split, that cuts across categories (e.g. a trip or a project).
_HU_: Címke
_Avoid_: Label

**Payee**:
The normalized name of the counterparty of a transaction (e.g. "Lidl"), regardless of how the raw description reads.
_HU_: Bolt (expense), Forrás (income), Bolt / partner where the kind is unknown; the settings list is „Boltok és partnerek”
_Avoid_: Merchant, vendor, counterparty

**Payee alias**:
Another name for a payee, such as a raw bank description or a spelling variant, that resolves to that payee when entered.
_HU_: Egyéb név
_Avoid_: Synonym, mapping

**Excluded transaction**:
A transaction kept in its account but left out of expense and income totals, such as an expense that will be reimbursed.
_HU_: Kihagyott tranzakció; badge and checkbox „Kihagyva”

**Transaction template**:
A saved, pre-filled transaction that can be entered again in one step.
_HU_: Sablon
_Avoid_: Preset, favorite

**Attachment**:
A file, such as a receipt photo or an invoice PDF, kept with a transaction.
_HU_: Csatolmány

**Receipt**:
The printed proof of a purchase whose photo can be attached to a transaction and read to pre-fill it.
_HU_: Blokk
_Avoid_: Bill, invoice (an invoice is a different document)

**Receipt inbox**:
The queue of received receipt photos that have not yet been confirmed as transactions.
_HU_: Feldolgozandó blokkok (navigation: Blokkok)
_Avoid_: Upload queue, scans

**Rule**:
A condition-to-action mapping that assigns a payee, category, or tag to a matching transaction automatically.
_HU_: Automatikus kategorizálási szabály (section: Automatikus kategorizálás)
_Avoid_: Filter, automation

**Recurring transaction**:
A transaction that repeats on a regular schedule, such as a subscription or a monthly bill.
_HU_: Rendszeres tranzakció (navigation: Rendszeres, tab: Ütemezések)
_Avoid_: Subscription (as the general term), scheduled payment

**Pending transaction**:
An occurrence of a recurring transaction that has fallen due and awaits the profile owner's confirmation before it counts.
_HU_: Jóváhagyásra váró tranzakció
_Avoid_: Draft, reminder
