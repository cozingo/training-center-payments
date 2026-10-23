import Database from "better-sqlite3";

export type DB = Database.Database;

export function openDb(filename: string): DB {
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      phone       TEXT    NOT NULL,
      group_name  TEXT    NOT NULL,
      monthly_fee INTEGER NOT NULL CHECK (monthly_fee >= 0),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      amount     INTEGER NOT NULL CHECK (amount > 0),
      date       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_payments_student_date ON payments(student_id, date);
  `);

  return db;
}
