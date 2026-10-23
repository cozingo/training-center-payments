const BASE = import.meta.env.VITE_API_URL ?? '/api'

export type Student = {
  id: number
  name: string
  phone: string
  group: string
  monthlyFee: number
}

export type Debtor = {
  studentId: number
  name: string
  phone: string
  group: string
  monthlyFee: number
  paid: number
  debt: number
}

export type DebtorsReport = { month: string; debtors: Debtor[]; totalDebt: number }

export type Payment = { id: number; studentId: number; amount: number; date: string }

export class ApiError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте подключение и повторите.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(body?.details?.[0]?.message ?? body?.error ?? `Ошибка сервера (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  debtors: (month: string) => call<DebtorsReport>(`/debtors?month=${month}`),
  students: () => call<Student[]>('/students'),
  addPayment: (studentId: number, amount: number, date: string) =>
    call<Payment>(`/students/${studentId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amount, date }),
    }),
}
