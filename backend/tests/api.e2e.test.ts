import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { openDb, type DB } from "../src/db";

let db: DB;
let api: ReturnType<typeof request>;

beforeEach(() => {
  db = openDb(":memory:");
  api = request(createApp(db));
});

const alice = { name: "Alice", phone: "+998 90 123-45-67", group: "English A1", monthlyFee: 500000 };
const bob = { name: "Bob", phone: "+998901112233", group: "Math", monthlyFee: 400000 };

async function createStudent(body: object = alice) {
  const res = await api.post("/students").send(body).expect(201);
  return res.body as { id: number };
}

async function pay(studentId: number, amount: number, date: string) {
  return api.post(`/students/${studentId}/payments`).send({ amount, date }).expect(201);
}

/** Backdate enrollment so the student counts for earlier months. */
function enrolledSince(studentId: number, date: string) {
  db.prepare("UPDATE students SET created_at = ? WHERE id = ?").run(`${date} 00:00:00`, studentId);
}

describe("health & routing", () => {
  it("GET /health", async () => {
    await api.get("/health").expect(200, { ok: true });
  });

  it("unknown route → 404 JSON", async () => {
    const res = await api.get("/nope").expect(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("malformed JSON → 400", async () => {
    await api.post("/students").set("Content-Type", "application/json").send("{bad").expect(400);
  });
});

describe("students CRUD", () => {
  it("creates a student", async () => {
    const res = await api.post("/students").send(alice).expect(201);
    expect(res.body).toMatchObject({ id: expect.any(Number), ...alice });
    expect(res.body.createdAt).toEqual(expect.any(String));
  });

  it("trims string fields", async () => {
    const res = await api
      .post("/students")
      .send({ ...alice, name: "  Alice  ", group: " English A1 " })
      .expect(201);
    expect(res.body.name).toBe("Alice");
    expect(res.body.group).toBe("English A1");
  });

  it.each([
    ["missing name", { ...alice, name: undefined }],
    ["empty name", { ...alice, name: "   " }],
    ["bad phone", { ...alice, phone: "abc" }],
    ["missing group", { ...alice, group: undefined }],
    ["negative fee", { ...alice, monthlyFee: -1 }],
    ["fractional fee", { ...alice, monthlyFee: 10.5 }],
    ["string fee", { ...alice, monthlyFee: "500000" }],
  ])("rejects invalid input: %s", async (_label, body) => {
    const res = await api.post("/students").send(body).expect(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("lists students and filters by group", async () => {
    await createStudent(alice);
    await createStudent(bob);

    const all = await api.get("/students").expect(200);
    expect(all.body.map((s: { name: string }) => s.name)).toEqual(["Alice", "Bob"]);

    const math = await api.get("/students").query({ group: "Math" }).expect(200);
    expect(math.body).toHaveLength(1);
    expect(math.body[0].name).toBe("Bob");
  });

  it("gets a student by id", async () => {
    const { id } = await createStudent();
    const res = await api.get(`/students/${id}`).expect(200);
    expect(res.body).toMatchObject({ id, ...alice });
  });

  it("partially updates a student", async () => {
    const { id } = await createStudent();
    const res = await api.patch(`/students/${id}`).send({ monthlyFee: 600000, group: "English A2" }).expect(200);
    expect(res.body).toMatchObject({ ...alice, id, monthlyFee: 600000, group: "English A2" });

    const fetched = await api.get(`/students/${id}`).expect(200);
    expect(fetched.body.monthlyFee).toBe(600000);
  });

  it("rejects empty or invalid update", async () => {
    const { id } = await createStudent();
    await api.patch(`/students/${id}`).send({}).expect(400);
    await api.patch(`/students/${id}`).send({ phone: "x" }).expect(400);
  });

  it("deletes a student and cascades payments", async () => {
    const { id } = await createStudent();
    await pay(id, 100000, "2026-10-01");

    await api.delete(`/students/${id}`).expect(204);
    await api.get(`/students/${id}`).expect(404);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM payments").get() as { n: number };
    expect(n).toBe(0);
  });

  it("returns 404 for missing student on get/patch/delete", async () => {
    await api.get("/students/999").expect(404);
    await api.patch("/students/999").send({ name: "X" }).expect(404);
    await api.delete("/students/999").expect(404);
  });

  it("returns 400 for non-numeric id", async () => {
    await api.get("/students/abc").expect(400);
  });
});

describe("payments", () => {
  it("adds a payment and lists them sorted by date", async () => {
    const { id } = await createStudent();
    const created = await pay(id, 200000, "2026-10-15");
    expect(created.body).toMatchObject({ id: expect.any(Number), studentId: id, amount: 200000, date: "2026-10-15" });
    await pay(id, 300000, "2026-10-01");

    const res = await api.get(`/students/${id}/payments`).expect(200);
    expect(res.body.map((p: { date: string }) => p.date)).toEqual(["2026-10-01", "2026-10-15"]);
  });

  it("lists only the given student's payments", async () => {
    const a = await createStudent(alice);
    const b = await createStudent(bob);
    await pay(a.id, 100, "2026-10-01");
    await pay(b.id, 200, "2026-10-01");

    const res = await api.get(`/students/${a.id}/payments`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe(100);
  });

  it("returns empty list when no payments", async () => {
    const { id } = await createStudent();
    await api.get(`/students/${id}/payments`).expect(200, []);
  });

  it.each([
    ["zero amount", { amount: 0, date: "2026-10-01" }],
    ["negative amount", { amount: -5, date: "2026-10-01" }],
    ["missing date", { amount: 100 }],
    ["wrong date format", { amount: 100, date: "01.10.2026" }],
    ["impossible date", { amount: 100, date: "2026-02-30" }],
  ])("rejects invalid payment: %s", async (_label, body) => {
    const { id } = await createStudent();
    await api.post(`/students/${id}/payments`).send(body).expect(400);
  });

  it("returns 404 for payments of missing student", async () => {
    await api.post("/students/999/payments").send({ amount: 100, date: "2026-10-01" }).expect(404);
    await api.get("/students/999/payments").expect(404);
  });
});

describe("GET /debtors", () => {
  it("requires a valid month", async () => {
    await api.get("/debtors").expect(400);
    await api.get("/debtors").query({ month: "2026-13" }).expect(400);
    await api.get("/debtors").query({ month: "2026-1" }).expect(400);
    await api.get("/debtors").query({ month: "October" }).expect(400);
  });

  it("returns empty list when there are no students", async () => {
    const res = await api.get("/debtors").query({ month: "2026-10" }).expect(200);
    expect(res.body).toEqual({ month: "2026-10", debtors: [], totalDebt: 0 });
  });

  it("calculates debt per student for the month", async () => {
    const a = await createStudent(alice); // fee 500000
    const b = await createStudent(bob); // fee 400000
    const c = await createStudent({ ...bob, name: "Carol" }); // fee 400000
    for (const s of [a, b, c]) enrolledSince(s.id, "2026-01-01");

    // Alice: partial payment in two parts → owes 150000
    await pay(a.id, 200000, "2026-10-01");
    await pay(a.id, 150000, "2026-10-20");
    // Bob: nothing paid → owes 400000
    // Carol: paid in full (overpaid) → not a debtor
    await pay(c.id, 450000, "2026-10-05");

    const res = await api.get("/debtors").query({ month: "2026-10" }).expect(200);
    expect(res.body.month).toBe("2026-10");
    expect(res.body.debtors).toEqual([
      { studentId: b.id, name: "Bob", phone: bob.phone, group: "Math", monthlyFee: 400000, paid: 0, debt: 400000 },
      { studentId: a.id, name: "Alice", phone: alice.phone, group: "English A1", monthlyFee: 500000, paid: 350000, debt: 150000 },
    ]);
    expect(res.body.totalDebt).toBe(550000);
  });

  it("only counts payments dated within the requested month", async () => {
    const { id } = await createStudent(alice);
    enrolledSince(id, "2026-01-01");
    await pay(id, 500000, "2026-09-30");
    await pay(id, 500000, "2026-11-01");

    const oct = await api.get("/debtors").query({ month: "2026-10" }).expect(200);
    expect(oct.body.debtors).toHaveLength(1);
    expect(oct.body.debtors[0]).toMatchObject({ paid: 0, debt: 500000 });

    const sep = await api.get("/debtors").query({ month: "2026-09" }).expect(200);
    expect(sep.body.debtors).toHaveLength(0);
  });

  it("treats exact payment as fully paid", async () => {
    const { id } = await createStudent(alice);
    enrolledSince(id, "2026-01-01");
    await pay(id, 500000, "2026-10-10");
    const res = await api.get("/debtors").query({ month: "2026-10" }).expect(200);
    expect(res.body.debtors).toEqual([]);
  });

  it("ignores students with zero monthly fee", async () => {
    const { id } = await createStudent({ ...alice, monthlyFee: 0 });
    enrolledSince(id, "2026-01-01");
    const res = await api.get("/debtors").query({ month: "2026-10" }).expect(200);
    expect(res.body.debtors).toEqual([]);
  });

  it("does not count students enrolled after the month", async () => {
    const { id } = await createStudent(alice);
    enrolledSince(id, "2026-10-15");

    const sep = await api.get("/debtors").query({ month: "2026-09" }).expect(200);
    expect(sep.body.debtors).toEqual([]);

    const oct = await api.get("/debtors").query({ month: "2026-10" }).expect(200);
    expect(oct.body.debtors).toHaveLength(1);
  });

  it("uses the updated monthly fee", async () => {
    const { id } = await createStudent(alice);
    enrolledSince(id, "2026-01-01");
    await pay(id, 500000, "2026-10-10");
    await api.patch(`/students/${id}`).send({ monthlyFee: 700000 }).expect(200);

    const res = await api.get("/debtors").query({ month: "2026-10" }).expect(200);
    expect(res.body.debtors[0]).toMatchObject({ monthlyFee: 700000, paid: 500000, debt: 200000 });
  });
});
