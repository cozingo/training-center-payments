import { Router } from "express";
import type { DB } from "../db";
import { monthQuery } from "../validation";

type DebtorRow = {
  id: number;
  name: string;
  phone: string;
  group_name: string;
  monthly_fee: number;
  paid: number;
};

export function debtorsRouter(db: DB): Router {
  const router = Router();

  // A student is a debtor for a month if the sum of payments dated within that
  // month is below their monthly fee. Students created after the month ended
  // are not counted, since they weren't enrolled yet.
  const stmt = db.prepare(`
    SELECT s.id, s.name, s.phone, s.group_name, s.monthly_fee,
           COALESCE(SUM(p.amount), 0) AS paid
    FROM students s
    LEFT JOIN payments p
      ON p.student_id = s.id AND substr(p.date, 1, 7) = @month
    WHERE substr(s.created_at, 1, 7) <= @month
    GROUP BY s.id
    HAVING paid < s.monthly_fee
    ORDER BY (s.monthly_fee - paid) DESC, s.id
  `);

  router.get("/", (req, res) => {
    const { month } = monthQuery.parse(req.query);
    const rows = stmt.all({ month }) as DebtorRow[];
    res.json({
      month,
      debtors: rows.map((r) => ({
        studentId: r.id,
        name: r.name,
        phone: r.phone,
        group: r.group_name,
        monthlyFee: r.monthly_fee,
        paid: r.paid,
        debt: r.monthly_fee - r.paid,
      })),
      totalDebt: rows.reduce((sum, r) => sum + r.monthly_fee - r.paid, 0),
    });
  });

  return router;
}
