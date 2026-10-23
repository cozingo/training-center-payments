const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const MONTHS_PREP = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
]

const money = new Intl.NumberFormat('ru-RU')

export const formatMoney = (n: number) => money.format(n)

/** "500000" → "500 000" while typing; non-digits are dropped. */
export const formatAmountInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  return digits ? money.format(Number(digits)) : ''
}
export const parseAmountInput = (s: string) => Number(s.replace(/\D/g, '')) || 0

const pad = (n: number) => String(n).padStart(2, '0')

export const toMonthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
export const toDateKey = (d: Date) => `${toMonthKey(d)}-${pad(d.getDate())}`

export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number)
  return toMonthKey(new Date(y, m - 1 + delta, 1))
}

export const monthTitle = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return { month: MONTHS[m - 1], year: y }
}

/** "в октябре 2026" */
export const inMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return `в ${MONTHS_PREP[m - 1]} ${y}`
}

export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
