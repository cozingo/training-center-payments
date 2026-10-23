import { Router } from "express";
import type { DB } from "../db";
import { HttpError } from "../errors";
import { idParam, paymentCreate, studentCreate, studentUpdate } from "../validation";

type StudentRow = {
  id: number;
  name: string;
  phone: string;
  group_name: string;
  monthly_fee: number;
  created_at: string;
};

type PaymentRow = {
  id: number;
  student_id: number;
  amount: number;
  date: string;
  created_at: string;
};

export const toStudent = (r: StudentRow) => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  group: r.group_name,
  monthlyFee: r.monthly_fee,
  createdAt: r.created_at,
});

const toPayment = (r: PaymentRow) => ({
  id: r.id,
  studentId: r.student_id,
  amount: r.amount,
  date: r.date,
  createdAt: r.created_at,
});

export function studentsRouter(db: DB): Router {
  const router = Router();

  const findStudent = (id: number) => {
    const row = db.prepare("SELECT * FROM students WHERE id = ?").get(id) as StudentRow | undefined;
    if (!row) throw new HttpError(404, "Student not found");
    return row;
  };

  router.post("/", (req, res) => {
    const s = studentCreate.parse(req.body);
    const { lastInsertRowid } = db
      .prepare("INSERT INTO students (name, phone, group_name, monthly_fee) VALUES (?, ?, ?, ?)")
      .run(s.name, s.phone, s.group, s.monthlyFee);
    res.status(201).json(toStudent(findStudent(Number(lastInsertRowid))));
  });

  router.get("/", (req, res) => {
    const group = typeof req.query.group === "string" ? req.query.group : undefined;
    const rows = (
      group
        ? db.prepare("SELECT * FROM students WHERE group_name = ? ORDER BY id").all(group)
        : db.prepare("SELECT * FROM students ORDER BY id").all()
    ) as StudentRow[];
    res.json(rows.map(toStudent));
  });

  router.get("/:id", (req, res) => {
    res.json(toStudent(findStudent(idParam.parse(req.params.id))));
  });

  router.patch("/:id", (req, res) => {
    const id = idParam.parse(req.params.id);
    const current = toStudent(findStudent(id));
    const next = { ...current, ...studentUpdate.parse(req.body) };
    db.prepare(
      "UPDATE students SET name = ?, phone = ?, group_name = ?, monthly_fee = ? WHERE id = ?",
    ).run(next.name, next.phone, next.group, next.monthlyFee, id);
    res.json(toStudent(findStudent(id)));
  });

  router.delete("/:id", (req, res) => {
    const id = idParam.parse(req.params.id);
    const { changes } = db.prepare("DELETE FROM students WHERE id = ?").run(id);
    if (changes === 0) throw new HttpError(404, "Student not found");
    res.status(204).end();
  });

  router.post("/:id/payments", (req, res) => {
    const studentId = idParam.parse(req.params.id);
    findStudent(studentId);
    const p = paymentCreate.parse(req.body);
    const { lastInsertRowid } = db
      .prepare("INSERT INTO payments (student_id, amount, date) VALUES (?, ?, ?)")
      .run(studentId, p.amount, p.date);
    const row = db.prepare("SELECT * FROM payments WHERE id = ?").get(lastInsertRowid) as PaymentRow;
    res.status(201).json(toPayment(row));
  });

  router.get("/:id/payments", (req, res) => {
    const studentId = idParam.parse(req.params.id);
    findStudent(studentId);
    const rows = db
      .prepare("SELECT * FROM payments WHERE student_id = ? ORDER BY date, id")
      .all(studentId) as PaymentRow[];
    res.json(rows.map(toPayment));
  });

  return router;
}
