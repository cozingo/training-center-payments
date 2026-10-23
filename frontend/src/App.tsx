import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, type Debtor, type DebtorsReport } from './api'
import { formatMoney, monthTitle, plural, shiftMonth, telHref, toMonthKey } from './format'
import { PaymentSheet } from './PaymentSheet'

type SheetState = { open: false } | { open: true; debtor?: Debtor }

export default function App() {
  const currentMonth = toMonthKey(new Date())
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState<DebtorsReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState<SheetState>({ open: false })
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError(null)
    try {
      setReport(await api.debtors(m))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить список.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(month)
  }, [month, load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const shown = useMemo(() => {
    const list = report?.month === month ? report.debtors : []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((d) => `${d.name} ${d.group} ${d.phone}`.toLowerCase().includes(q))
  }, [report, month, query])

  const { month: monthName, year } = monthTitle(month)
  const count = report?.debtors.length ?? 0
  const isLatest = month >= currentMonth

  return (
    <div className="page">
      <header className="top">
        <nav className="month" aria-label="Выбор месяца">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Предыдущий месяц"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 className="month__title" aria-live="polite">
            {monthName} <span className="month__year">{year}</span>
          </h1>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Следующий месяц"
            disabled={isLatest}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </nav>

        {report && report.month === month && !error && (
          <p className="total">
            <span className="total__sum">{formatMoney(report.totalDebt)}</span>
            <span className="total__unit"> сум долга</span>
            <span className="total__count">
              {count} {plural(count, 'ученик не доплатил', 'ученика не доплатили', 'учеников не доплатили')}
            </span>
          </p>
        )}

        {count > 5 && (
          <input
            type="search"
            className="search"
            placeholder="Поиск по имени, группе, телефону"
            aria-label="Поиск должника"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </header>

      <main className="ledger" aria-busy={loading}>
        {error ? (
          <div className="notice">
            <p>{error}</p>
            <button type="button" className="btn" onClick={() => load(month)}>
              Повторить
            </button>
          </div>
        ) : loading && report?.month !== month ? (
          <ul className="rows" aria-label="Загрузка">
            {[0, 1, 2].map((i) => (
              <li key={i} className="row row--skeleton" />
            ))}
          </ul>
        ) : count === 0 ? (
          <div className="notice">
            <p>
              Все ученики оплатили {monthName.toLowerCase()} {year}.
            </p>
          </div>
        ) : shown.length === 0 ? (
          <div className="notice">
            <p>Никого не нашли по запросу «{query}».</p>
          </div>
        ) : (
          <ul className="rows">
            {shown.map((d) => (
              <DebtorRow key={d.studentId} debtor={d} onPay={() => setSheet({ open: true, debtor: d })} />
            ))}
          </ul>
        )}
      </main>

      <div className="dock">
        <button type="button" className="btn btn--primary" onClick={() => setSheet({ open: true })}>
          Добавить оплату
        </button>
      </div>

      {sheet.open && (
        <PaymentSheet
          month={month}
          initialStudentId={sheet.debtor?.studentId}
          debt={sheet.debtor?.debt}
          onClose={() => setSheet({ open: false })}
          onSaved={(payment, student) => {
            setSheet({ open: false })
            setToast(`Оплата записана: ${student.name}, ${formatMoney(payment.amount)} сум`)
            load(month)
          }}
        />
      )}

      <div className="toast" role="status" aria-live="polite" data-show={!!toast}>
        {toast}
      </div>
    </div>
  )
}

function DebtorRow({ debtor: d, onPay }: { debtor: Debtor; onPay: () => void }) {
  const paidShare = d.monthlyFee ? Math.min(1, d.paid / d.monthlyFee) : 0
  return (
    <li className="row">
      <button type="button" className="row__main" onClick={onPay} aria-label={`Добавить оплату: ${d.name}`}>
        <span className="row__name">{d.name}</span>
        <span className="row__group">{d.group}</span>
        <span className="row__debt">
          {formatMoney(d.debt)}
          <span className="row__of">из {formatMoney(d.monthlyFee)}</span>
        </span>
        <span className="row__bar" aria-hidden="true">
          <span style={{ width: `${paidShare * 100}%` }} />
        </span>
        {d.paid > 0 && <span className="row__paid">Оплачено {formatMoney(d.paid)}</span>}
      </button>
      <a className="row__call" href={telHref(d.phone)} aria-label={`Позвонить: ${d.name}, ${d.phone}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
        </svg>
      </a>
    </li>
  )
}
