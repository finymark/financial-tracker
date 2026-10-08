# One SQLite database per profile

Several people share one Windows account and use separate in-app profiles, so each profile gets its own SQLite file and data folder instead of one database with a `profile_id` column. This keeps profiles fully isolated (no query can leak another profile's data), and makes backup, restore and deletion a per-file operation. The cost is that migrations run per file and cross-profile features are impossible; neither is wanted.
