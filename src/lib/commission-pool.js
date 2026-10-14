const POOL_TIERS = [
  { minimum: 7_200, pool: 3_000 },
  { minimum: 4_800, pool: 2_000 },
  { minimum: 2_400, pool: 1_000 },
  { minimum: 1_600, pool: 600 },
  { minimum: 800, pool: 300 },
]

export const GARAGE_TECHNICIAN_ROLES = new Set(['head_mechanic', 'mechanic', 'mechanic_trainee'])
export const GARAGE_HOURLY_COMMISSION_ROLES = new Set([...GARAGE_TECHNICIAN_ROLES, 'ceo'])

export function classifyGarageCommissionClockIn(clockIn) {
  const at = clockIn instanceof Date ? clockIn : new Date(clockIn)
  if (Number.isNaN(at.getTime())) throw new TypeError('clockIn must be a valid timestamp')
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', hourCycle: 'h23',
  }).format(at))
  const period = hour >= 18 && hour < 23 ? 'peak' : 'normal'
  return { period, amount: period === 'peak' ? 15_000 : 10_000 }
}

// Explicitly route policies by business and role. SABINAGISA retains its
// original pool and 18:00–06:00 peak behavior.
export function commissionPolicyForEmployee(branchKey, role) {
  if (branchKey === 'chill') return 'sabinagisa_commission_pool'
  if (branchKey === 'garage' && GARAGE_TECHNICIAN_ROLES.has(role)) return 'garage_technician_clock_in'
  return 'branch_individual'
}

export function calculateSabinagisaCommissionPool(branchKey, billTotal, at = new Date()) {
  if (branchKey !== 'chill') return { base: 0, amount: 0, isPeak: false }

  const total = Math.max(0, Number(billTotal) || 0)
  const base = POOL_TIERS.find(tier => total >= tier.minimum)?.pool || 0
  const bangkokHour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(at))
  const isPeak = bangkokHour >= 18 || bangkokHour < 6

  return { base, amount: isPeak ? Math.round(base * 1.25) : base, isPeak }
}
