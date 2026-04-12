import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'budget.db');

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const database = db;

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      pay_cycle TEXT DEFAULT 'bi-weekly',
      last_paycheck_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      amount REAL NOT NULL,
      due_day INTEGER NOT NULL,
      is_autopay INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bill_payments (
      id INTEGER PRIMARY KEY,
      bill_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      status TEXT DEFAULT 'unpaid',
      amount_paid REAL,
      paid_at TEXT,
      UNIQUE(bill_id, year, month)
    );

    CREATE TABLE IF NOT EXISTS credit_cards (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      credit_limit REAL NOT NULL DEFAULT 0,
      minimum_payment REAL NOT NULL DEFAULT 0,
      apr REAL NOT NULL DEFAULT 0,
      due_day INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_card_transactions (
      id INTEGER PRIMARY KEY,
      card_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      transaction_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(card_id) REFERENCES credit_cards(id) ON DELETE CASCADE
    );
  `);

  // Safe migrations
  const migrations = [
    'ALTER TABLE users ADD COLUMN monthly_income REAL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN current_savings REAL DEFAULT 0',
    'ALTER TABLE bills ADD COLUMN frequency TEXT DEFAULT \'monthly\'',
    'ALTER TABLE bills ADD COLUMN due_date TEXT',
    'ALTER TABLE credit_cards ADD COLUMN last_four TEXT',
    'ALTER TABLE users ADD COLUMN extra_cc_payment REAL DEFAULT 0',
  ];
  for (const sql of migrations) {
    try { database.exec(sql); } catch { /* column already exists */ }
  }

  seedIfEmpty(database);
}

function seedIfEmpty(database: Database.Database) {
  const userCount = (database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount > 0) return;

  const passwordHash = bcrypt.hashSync('admin123', 10);
  const lastPaycheckDate = new Date();
  lastPaycheckDate.setDate(lastPaycheckDate.getDate() - 7);

  const insertUser = database.prepare(`
    INSERT INTO users (username, password_hash, pay_cycle, last_paycheck_date, monthly_income)
    VALUES (?, ?, ?, ?, ?)
  `);
  const userResult = insertUser.run('admin', passwordHash, 'bi-weekly', lastPaycheckDate.toISOString().split('T')[0], 4500);
  const userId = userResult.lastInsertRowid as number;

  const insertBill = database.prepare(`
    INSERT INTO bills (user_id, name, category, amount, due_day, is_autopay)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const bills = [
    ['Rent', 'Housing', 1500, 1, 0],
    ['Electric', 'Utilities', 120, 15, 1],
    ['Internet', 'Utilities', 65, 20, 1],
    ['Netflix', 'Subscriptions', 17, 8, 1],
    ['Spotify', 'Subscriptions', 11, 12, 1],
    ['Car Insurance', 'Insurance', 180, 3, 1],
    ['Gym', 'Subscriptions', 40, 1, 0],
    ['Phone', 'Utilities', 85, 22, 1],
  ];

  const billIds: number[] = [];
  for (const [name, category, amount, due_day, is_autopay] of bills) {
    const result = insertBill.run(userId, name, category, amount, due_day, is_autopay);
    billIds.push(result.lastInsertRowid as number);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const insertPayment = database.prepare(`
    INSERT OR IGNORE INTO bill_payments (bill_id, year, month, status, amount_paid, paid_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Rent - unpaid
  insertPayment.run(billIds[0], currentYear, currentMonth, 'unpaid', null, null);
  // Electric - paid
  insertPayment.run(billIds[1], currentYear, currentMonth, 'paid', 118.50, new Date().toISOString());
  // Internet - paid
  insertPayment.run(billIds[2], currentYear, currentMonth, 'paid', 65, new Date().toISOString());
  // Netflix - paid
  insertPayment.run(billIds[3], currentYear, currentMonth, 'paid', 17, new Date().toISOString());
  // Spotify - paid
  insertPayment.run(billIds[4], currentYear, currentMonth, 'paid', 11, new Date().toISOString());
  // Car Insurance - paid
  insertPayment.run(billIds[5], currentYear, currentMonth, 'paid', 180, new Date().toISOString());
  // Gym - pending
  insertPayment.run(billIds[6], currentYear, currentMonth, 'pending', null, null);
  // Phone - unpaid
  insertPayment.run(billIds[7], currentYear, currentMonth, 'unpaid', null, null);

  const insertCard = database.prepare(`
    INSERT INTO credit_cards (user_id, name, balance, credit_limit, minimum_payment, apr, due_day)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertCard.run(userId, 'Chase Sapphire', 3400, 8000, 85, 22.99, 15);
  insertCard.run(userId, 'Indigo Mastercard', 1200, 1500, 35, 29.99, 8);
  insertCard.run(userId, 'Discover', 650, 3000, 25, 17.99, 22);
}

export default getDb;
