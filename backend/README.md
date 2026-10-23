# Training center payments API

Express + TypeScript + SQLite (better-sqlite3).

```bash
npm install
npm run dev        # http://localhost:3000 (env: PORT, DB_PATH, default data.db)
npm test           # e2e API tests (in-memory SQLite)
npm run build && npm start
```

## Endpoints

| Method | Path | Body / query |
|---|---|---|
| POST | `/students` | `{ name, phone, group, monthlyFee }` |
| GET | `/students` | `?group=` (optional) |
| GET | `/students/:id` | |
| PATCH | `/students/:id` | any subset of the create fields |
| DELETE | `/students/:id` | also deletes the student's payments |
| POST | `/students/:id/payments` | `{ amount, date: "YYYY-MM-DD" }` |
| GET | `/students/:id/payments` | sorted by date |
| GET | `/debtors?month=YYYY-MM` | students who paid less than their fee that month |

Amounts are integers (e.g. UZS). Validation errors return `400` with `details`; unknown ids return `404`.

`/debtors` response:

```json
{
  "month": "2026-10",
  "debtors": [
    { "studentId": 1, "name": "Ali", "phone": "+998901234567", "group": "A1",
      "monthlyFee": 500000, "paid": 200000, "debt": 300000 }
  ],
  "totalDebt": 300000
}
```

Rules: a payment counts toward the month in its `date`. Students who enrolled (`createdAt`) after the requested month are skipped. Debtors are sorted by debt, largest first.
