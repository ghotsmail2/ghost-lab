const POOL_TIERS = [
  { minimum: 7_200, pool: 3_000 },
  { minimum: 4_800, pool: 2_000 },
  { minimum: 2_400, pool: 1_000 },
  { minimum: 1_600, pool: 600 },
  { minimum: 800, pool: 300 },
]

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
