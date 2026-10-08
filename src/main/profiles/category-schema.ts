// Migration 4: these seed definitions are immutable, like the migration SQL.
const defaults = [
  ['expense.food', 'food', null, 'expense', 0],
  ['expense.food.shop', 'shop', 'expense.food', 'expense', 0],
  ['expense.food.restaurant', 'restaurant', 'expense.food', 'expense', 1],
  ['expense.housing', 'housing', null, 'expense', 1],
  ['expense.housing.rent', 'rent', 'expense.housing', 'expense', 0],
  ['expense.housing.utilities', 'utilities', 'expense.housing', 'expense', 1],
  ['expense.transport', 'transport', null, 'expense', 2],
  [
    'expense.transport.public',
    'publicTransport',
    'expense.transport',
    'expense',
    0,
  ],
  ['expense.transport.car', 'car', 'expense.transport', 'expense', 1],
  ['expense.health', 'health', null, 'expense', 3],
  ['expense.entertainment', 'entertainment', null, 'expense', 4],
  ['expense.clothing', 'clothing', null, 'expense', 5],
  ['expense.subscriptions', 'subscriptions', null, 'expense', 6],
  ['expense.other', 'otherExpense', null, 'expense', 7],
  ['expense.fees', 'fees', null, 'expense', 8],
  ['income.salary', 'salary', null, 'income', 0],
  ['income.other', 'otherIncome', null, 'income', 1],
] as const

const uuidSql = `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
  '-4' || substr(lower(hex(randomblob(2))), 2) || '-a' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))`

export const CATEGORIES_SCHEMA_SQL = `
  CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    seed_key TEXT UNIQUE,
    translation_key TEXT,
    custom_name TEXT CHECK (custom_name IS NULL OR length(trim(custom_name)) BETWEEN 1 AND 100),
    parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
    sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    CHECK (custom_name IS NOT NULL OR translation_key IS NOT NULL),
    CHECK (seed_key IS NOT NULL OR custom_name IS NOT NULL)
  );
  CREATE INDEX categories_parent_order ON categories(kind, parent_id, sort_order);
  CREATE TRIGGER categories_seed_key_immutable BEFORE UPDATE OF seed_key ON categories
    WHEN NEW.seed_key IS NOT OLD.seed_key
    BEGIN SELECT RAISE(ABORT, 'Category seed key is immutable'); END;
  ${defaults
    .map(
      ([key, translation, parent, kind, order]) => `
    INSERT OR IGNORE INTO categories (id, kind, seed_key, translation_key, parent_id, sort_order)
    VALUES (${uuidSql}, '${kind}', '${key}', 'categories.default.${translation}',
      ${parent ? `(SELECT id FROM categories WHERE seed_key = '${parent}')` : 'NULL'}, ${order});
  `,
    )
    .join('')}
`
