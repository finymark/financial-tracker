# Ledger shape: lines, one-record transfers, target-based adjustments

- Every transaction has one or more lines (amount + category); an unsplit transaction has exactly one. Reports aggregate lines, so splits are not a special case.
- A transfer is one record holding both legs, not two linked transactions, so the sides cannot drift apart; for cross-currency transfers both amounts are authoritative and the rate is derived.
- A balance adjustment records the observed real balance on a date, not a fixed difference. The difference is recomputed from the account's history, so a forgotten transaction entered later before that date does not get counted twice. A fixed delta was rejected because it gives wrong balances in exactly that common case.
