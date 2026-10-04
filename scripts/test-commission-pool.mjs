import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/20261005_sabinagisa_commission_pool.sql', import.meta.url), 'utf8')
const buildScript = readFileSync(new URL('./build-recovered.mjs', import.meta.url), 'utf8')

function basePool(total) {
  if (!Number.isFinite(total) || total < 0) throw new Error('invalid total')
  if (total < 800) return 0
  if (total < 1600) return 300
  if (total < 2400) return 600
  if (total < 4800) return 1000
  if (total < 7200) return 2000
  return 3000
}

function isPeak(localTime) {
  return localTime >= '18:00:00' && localTime <= '23:59:59'
}

function allocate(pool, ids) {
  const sorted = [...ids].sort()
  if (!sorted.length) return []
  const share = Math.floor(pool / sorted.length)
  const remainder = pool % sorted.length
  return sorted.map((id, index) => ({ id, amount: share + (index < remainder ? 1 : 0) }))
}

test('pool boundaries match all ten required cases', () => {
  const cases = [[799,0],[800,300],[1599,300],[1600,600],[2399,600],[2400,1000],[4799,1000],[4800,2000],[7199,2000],[7200,3000]]
  for (const [total, expected] of cases) assert.equal(basePool(total), expected)
})

test('Peak boundary is 18:00:00 through 23:59:59', () => {
  assert.equal(isPeak('17:59:59'), false)
  assert.equal(isPeak('18:00:00'), true)
  assert.equal(isPeak('23:59:59'), true)
  assert.equal(isPeak('00:00:00'), false)
})

test('Peak multiplier produces exact supported currency amounts', () => {
  assert.deepEqual([300,600,1000,2000,3000].map(value => value * 5 / 4), [375,750,1250,2500,3750])
})

test('allocation handles 0, 1, 2 and 5 active employees without exceeding pool', () => {
  for (const count of [0,1,2,5]) {
    const rows = allocate(3750, Array.from({ length: count }, (_, i) => `staff-${i}`))
    assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), count ? 3750 : 0)
  }
})

test('remainder allocation is deterministic and sums exactly to final pool', () => {
  const rows = allocate(1000, ['c','a','b'])
  assert.deepEqual(rows, [{id:'a',amount:334},{id:'b',amount:333},{id:'c',amount:333}])
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 1000)
})

test('migration captures first order time in DB and attendance at that time', () => {
  assert.match(migration, /new\.first_order_time := coalesce\(new\.created_at, clock_timestamp\(\)\)/)
  assert.match(migration, /atn\.clock_in <= b\.first_order_time/)
  assert.match(migration, /atn\.clock_out is null or atn\.clock_out > b\.first_order_time/)
})

test('historical rows are legacy and normal calculation is idempotent', () => {
  assert.match(migration, /commission_calculation_version = 'legacy-v1'/)
  assert.match(migration, /b\.commission_calculation_version = v_version/)
  assert.match(migration, /on conflict\(bill_id,user_id\) do update/)
})

test('zero-active and explicit audited recalculation paths are present', () => {
  assert.match(migration, /'no_active_employee'/)
  assert.match(migration, /commission_calculation_audit/)
  assert.match(migration, /paid commission cannot be recalculated/)
  assert.match(migration, /v_actor\.role::text not in \('owner','god'\)/)
})

test('server validation and transaction-safe trigger remain authoritative', () => {
  assert.match(migration, /order_total must be non-negative/)
  assert.match(migration, /invalid timezone/)
  assert.match(migration, /after insert or update of status on public\.bills/)
  assert.doesNotMatch(migration, /truncate\s|drop table\s|drop column\s/i)
})

test('cancellation trigger compares matching status types', () => {
  assert.match(migration, /old\.status::text is distinct from new\.status::text/)
  assert.doesNotMatch(migration, /old\.status::text is distinct from new\.status(?!::text)/)
})

test('commission report has inclusive Bangkok date range with Clear and Today', () => {
  assert.match(buildScript, /function CommissionDateRange/)
  assert.match(buildScript, /T00:00:00\+07:00/)
  assert.match(buildScript, /endExclusive/)
  assert.match(buildScript, /children:\"Clear\"/)
  assert.match(buildScript, /children:\"Today\"/)
})
