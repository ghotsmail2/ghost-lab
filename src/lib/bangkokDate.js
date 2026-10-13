const bangkokDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const bangkokHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  hourCycle: 'h23',
})

export function bangkokDateKey(value = new Date()) {
  const parts = Object.fromEntries(bangkokDateFormatter.formatToParts(new Date(value)).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function bangkokHour(value = new Date()) {
  return Number(bangkokHourFormatter.format(new Date(value)))
}

export function shiftBangkokDateKey(value, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isInteger(days)) throw new RangeError('Date and day offset must be valid')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day) + days * 86400000)
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== value) throw new RangeError('Date must be a valid YYYY-MM-DD value')
  return date.toISOString().slice(0, 10)
}

export function bangkokDateBounds(from, to = from) {
  const fromValid = /^\d{4}-\d{2}-\d{2}$/.test(from) && new Date(`${from}T12:00:00Z`).toISOString().slice(0, 10) === from
  const toValid = /^\d{4}-\d{2}-\d{2}$/.test(to) && new Date(`${to}T12:00:00Z`).toISOString().slice(0, 10) === to
  if (!fromValid || !toValid || to < from) throw new RangeError('Date range must be valid and end on or after start')
  return {
    start: new Date(`${from}T00:00:00+07:00`).toISOString(),
    end: new Date(`${shiftBangkokDateKey(to, 1)}T00:00:00+07:00`).toISOString(),
  }
}

export function previousDateRange(from, to = from) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new RangeError('Date range must use YYYY-MM-DD')
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const end = Date.UTC(toYear, toMonth - 1, toDay)
  const normalizedFrom = new Date(start).toISOString().slice(0, 10)
  const normalizedTo = new Date(end).toISOString().slice(0, 10)
  if (normalizedFrom !== from || normalizedTo !== to) throw new RangeError('Date range contains an invalid date')
  const days = Math.round((end - start) / 86400000) + 1
  if (!Number.isFinite(days) || days < 1) throw new RangeError('Date range must be valid and end on or after start')
  const previousEnd = new Date(start - 86400000).toISOString().slice(0, 10)
  const previousStart = new Date(start - days * 86400000).toISOString().slice(0, 10)
  return { from: previousStart, to: previousEnd }
}
