# MNB exchange rates are fetched over plain HTTP

The MNB SOAP webservice only answers at `http://www.mnb.hu/arfolyamok.asmx`; a POST to the HTTPS address returns 404 (checked 2026-10-08). We fetch over plain HTTP and accept that someone on the network path could alter the rates. The damage is limited: the ledger stores amounts in their own currency, and fetched rates only affect converted report totals, which can be rebuilt by deleting the cached rates. Rates are public data, so nothing confidential is sent. Switch to HTTPS as soon as MNB serves the webservice over it.
