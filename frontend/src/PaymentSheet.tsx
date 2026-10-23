import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, type Payment, type Student } from './api'
import {
  formatAmountInput,
  formatMoney,
  inMonth,
  parseAmountInput,
  toDateKey,
} from './format'

/** Mount only while open; each mount starts a fresh form. */
type Props = {
  /** Month currently shown in the list, used to warn when the date falls elsewhere. */
  month: string
  initialStudentId?: number
  /** Amount still owed by the preselected student, offered as a one-tap fill. */
  debt?: number
  onClose: () => void
  onSaved: (payment: Payment, student: Student) => void
}

export function PaymentSheet({ month, initialStudentId, debt, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const ids = { student: useId(), amount: useId(), date: useId(), error: useId() }

  const [students, setStudents] = useState<Student[] | null>(null)
  const [studentId, setStudentId] = useState<number | ''>(initialStudentId ?? '')
  const [amount, setAmount] = useState(debt ? formatMoney(debt) : '')
  const [date, setDate] = useState(() => defaultDate(month))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
    if (initialStudentId) amountRef.current?.focus()
    // initialStudentId is fixed for this mount
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .students()
      .then((list) => !cancelled && setStudents(list))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : 'Не удалось загрузить учеников.'))
    return () => {
      cancelled = true
    }
  }, [])

  const student = students?.find((s) => s.id === studentId)
  const amountValue = parseAmountInput(amount)
  const outsideMonth = date && !date.startsWith(month)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!student) return setError('Выберите ученика.')
    if (amountValue <= 0) return setError('Введите сумму больше нуля.')
    if (!date) return setError('Укажите дату оплаты.')

    setSaving(true)
    setError(null)
    try {
      const payment = await api.addPayment(student.id, amountValue, date)
      onSaved(payment, student)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить оплату.')
    } finally {
      setSaving(false)
    }
  }

  const groups = groupStudents(students ?? [])

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="sheet__body" onSubmit={submit} noValidate>
        <div className="sheet__head">
          <h2 id="sheet-title">Новая оплата</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <label className="field" htmlFor={ids.student}>
          <span className="field__label">Ученик</span>
          <select
            id={ids.student}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : '')}
            disabled={!students}
            required
          >
            <option value="">{students ? 'Выберите ученика' : 'Загрузка…'}</option>
            {groups.map(([group, list]) => (
              <optgroup key={group} label={group}>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {student && (
            <span className="field__hint">
              {student.group}, в месяц {formatMoney(student.monthlyFee)} сум
            </span>
          )}
        </label>

        <label className="field" htmlFor={ids.amount}>
          <span className="field__label">Сумма, сум</span>
          <input
            ref={amountRef}
            id={ids.amount}
            className="field__amount"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            aria-describedby={error ? ids.error : undefined}
            required
          />
        </label>
        {student && (
          <div className="chips" role="group" aria-label="Подставить сумму">
            {debt !== undefined && student.id === initialStudentId && debt !== student.monthlyFee && (
              <button type="button" className="chip" onClick={() => setAmount(formatMoney(debt))}>
                Остаток долга {formatMoney(debt)}
              </button>
            )}
            <button type="button" className="chip" onClick={() => setAmount(formatMoney(student.monthlyFee))}>
              За месяц {formatMoney(student.monthlyFee)}
            </button>
          </div>
        )}

        <label className="field" htmlFor={ids.date}>
          <span className="field__label">Дата оплаты</span>
          <input
            id={ids.date}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          {outsideMonth && (
            <span className="field__hint field__hint--warn">
              Оплата засчитается {inMonth(date.slice(0, 7))}, а не в выбранном месяце.
            </span>
          )}
        </label>

        {error && (
          <p id={ids.error} className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={saving || !students}>
          {saving ? 'Сохраняем…' : amountValue > 0 ? `Записать ${formatMoney(amountValue)} сум` : 'Записать оплату'}
        </button>
      </form>
    </dialog>
  )
}

/** Today if viewing the current month, otherwise the 1st of the viewed month. */
function defaultDate(month: string) {
  const today = toDateKey(new Date())
  return today.startsWith(month) ? today : `${month}-01`
}

function groupStudents(students: Student[]) {
  const byGroup = new Map<string, Student[]>()
  for (const s of [...students].sort((a, b) => a.name.localeCompare(b.name, 'ru'))) {
    byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s])
  }
  return [...byGroup].sort(([a], [b]) => a.localeCompare(b, 'ru'))
}
