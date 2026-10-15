import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { calculateSabinagisaCommissionPool, classifyGarageCommissionClockIn, commissionPolicyForEmployee } from '../src/lib/commission-pool.js'

const migration = await readFile(new URL('../supabase/garage_technician_commission_policy.sql', import.meta.url), 'utf8')
const hourlyMigration = await readFile(new URL('../supabase/migrations/20261014120000_garage_technician_hourly_commission.sql', import.meta.url), 'utf8')
const garageCheckoutHotfix = await readFile(new URL('../supabase/migrations/20261014150000_garage_pos_commission_mismatch_hotfix.sql', import.meta.url), 'utf8')
const attendance = await readFile(new URL('../src/pages/Attendance.jsx', import.meta.url), 'utf8')
const commissionHistory = await readFile(new URL('../src/pages/CommissionPayouts.jsx', import.meta.url), 'utf8')
const productionBuilder = await readFile(new URL('./build-recovered.mjs', import.meta.url), 'utf8')

test('Garage commission clock-in boundaries use Bangkok time and end Peak exactly at 23:00', () => {
  const at = time => classifyGarageCommissionClockIn(new Date(time))
  assert.deepEqual(at('2026-10-13T10:59:00Z'), { period: 'normal', amount: 10_000 }) // 17:59
  assert.deepEqual(at('2026-10-13T11:00:00Z'), { period: 'peak', amount: 15_000 }) // 18:00
  assert.deepEqual(at('2026-10-13T15:59:00Z'), { period: 'peak', amount: 15_000 }) // 22:59
  assert.deepEqual(at('2026-10-13T16:00:00Z'), { period: 'normal', amount: 10_000 }) // 23:00
})

test('business/role routing never sends SABINAGISA into Garage policy', () => {
  for (const role of ['head_mechanic', 'mechanic', 'mechanic_trainee']) {
    assert.equal(commissionPolicyForEmployee('garage', role), 'garage_technician_clock_in')
    assert.equal(commissionPolicyForEmployee('chill', role), 'sabinagisa_commission_pool')
  }
  assert.equal(commissionPolicyForEmployee('garage', 'chill_staff'), 'branch_individual')
  assert.equal(commissionPolicyForEmployee('chill', 'chill_staff'), 'sabinagisa_commission_pool')
  const unchangedRestaurantAmounts = [300, 375, 375, 375]
  for (const [index, at] of ['2026-10-13T10:59:00Z', '2026-10-13T11:00:00Z', '2026-10-13T15:59:00Z', '2026-10-13T16:00:00Z'].entries()) {
    assert.equal(calculateSabinagisaCommissionPool('chill', 800, new Date(at)).amount, unchangedRestaurantAmounts[index])
  }
})

test('database snapshots Garage policy only for Garage mechanics and preserves Restaurant pool routing', () => {
  assert.match(migration, /branch_key_value = 'garage'[\s\S]*staff_role_value in \('head_mechanic', 'mechanic', 'mechanic_trainee'\)/)
  assert.match(migration, /commission_mode := 'INDIVIDUAL'/)
  assert.match(migration, /commission_policy := 'garage_technician_clock_in'/)
  assert.match(migration, /branch_key_value = 'chill'[\s\S]*commission_policy := 'sabinagisa_commission_pool'/)
  assert.match(migration, /clock_in <= clock_timestamp\(\) and a\.clock_out is null/)
  assert.match(migration, /expected_commission := case[\s\S]*then 15000 else 10000/)
  assert.match(migration, /garage_commission_period\(attendance_row\.clock_in\)/)
  const restaurantPreview = migration.slice(migration.indexOf("if v_mode = 'ON_WORK_ALL'"), migration.indexOf("elsif branch_row.key::text = 'garage'"))
  assert.match(restaurantPreview, /commission_pool_base/)
  assert.doesNotMatch(restaurantPreview, /garage_technician|garage_commission/)
})

test('Garage keeps ¥3,000 per bill and records each full hour separately with idempotent Peak rates', () => {
  assert.match(hourlyMigration, /amount integer not null check \(amount in \(10000,15000\)\)/)
  assert.match(hourlyMigration, /unique \(attendance_id,hour_index\)/)
  assert.match(hourlyMigration, /floor\(extract\(epoch from\(cutoff_value-a\.clock_in\)\)\/3600\)/)
  assert.match(hourlyMigration, /period_hour>=18 and period_hour<23 then 15000 else 10000/)
  assert.match(hourlyMigration, /on conflict\(attendance_id,hour_index\) do nothing/)
  assert.match(hourlyMigration, /coalesce\(branch_row\.commission_flat, 3000\)::integer/)
  assert.match(hourlyMigration, /pay_garage_hourly_commission/)
  assert.match(hourlyMigration, /commission_pool_base/)
  assert.match(attendance, /ค่าคอมรายชั่วโมง: ¥10,000\/ชม\. · Peak ¥15,000\/ชม\./)
  assert.match(commissionHistory, /garage_technician_hourly_commissions/)
  assert.match(commissionHistory, /pay_garage_hourly_commission/)
  const hourlyMerge = commissionHistory.indexOf('for (const entry of hourlyCommissions)')
  const finalGroupingReturn = commissionHistory.indexOf('return [...map.values()].map(group => ({', hourlyMerge)
  assert.notEqual(hourlyMerge, -1, 'hourly earnings must be merged into the payout rows')
  assert.notEqual(finalGroupingReturn, -1, 'grouping must return only after hourly earnings are merged')
  assert.equal(commissionHistory.indexOf('return [...map.values()].map(group => ({'), finalGroupingReturn,
    'no early return may bypass hourly earnings')
  assert.match(commissionHistory, /row\.hourlyOnly \? `\$\{row\.hourlyEntries\.length\} ชม\.`/)
  assert.match(productionBuilder, /BILL ¥3,000 · HOURLY ¥10,000 · PEAK ¥15,000/)
})

test('Garage checkout uses the server rate for mechanics and does not classify a definite commission rejection as an unknown bill', () => {
  assert.match(garageCheckoutHotfix, /branch_row\.key::text = 'garage'[\s\S]*actor\.role::text in \('head_mechanic','mechanic','mechanic_trainee'\)/)
  assert.match(garageCheckoutHotfix, /bill_input\.commission := expected_commission/)
  assert.match(garageCheckoutHotfix, /Individual commission differs from the active branch rate/)
  assert.match(productionBuilder, /const commissionRejected = error\?\.code === "22023"/)
  assert.match(productionBuilder, /localStorage\.removeItem\(checkoutStorageKey\);[\s\S]*บิลยังไม่ถูกบันทึก/)
})
