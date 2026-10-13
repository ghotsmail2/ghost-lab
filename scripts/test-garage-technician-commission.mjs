import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { calculateSabinagisaCommissionPool, classifyGarageCommissionClockIn, commissionPolicyForEmployee } from '../src/lib/commission-pool.js'

const migration = await readFile(new URL('../supabase/garage_technician_commission_policy.sql', import.meta.url), 'utf8')
const attendance = await readFile(new URL('../src/pages/Attendance.jsx', import.meta.url), 'utf8')
const commissionHistory = await readFile(new URL('../src/pages/CommissionPayouts.jsx', import.meta.url), 'utf8')
const pos = await readFile(new URL('../src/pages/POSPage.jsx', import.meta.url), 'utf8')

test('Garage commission clock-in boundaries use Bangkok time and end Peak exactly at midnight', () => {
  const at = time => classifyGarageCommissionClockIn(new Date(time))
  assert.deepEqual(at('2026-10-13T10:59:00Z'), { period: 'normal', amount: 10_000 }) // 17:59
  assert.deepEqual(at('2026-10-13T11:00:00Z'), { period: 'peak', amount: 15_000 }) // 18:00
  assert.deepEqual(at('2026-10-13T16:59:00Z'), { period: 'peak', amount: 15_000 }) // 23:59
  assert.deepEqual(at('2026-10-13T17:00:00Z'), { period: 'normal', amount: 10_000 }) // 00:00
})

test('business/role routing never sends SABINAGISA into Garage policy', () => {
  for (const role of ['head_mechanic', 'mechanic', 'mechanic_trainee']) {
    assert.equal(commissionPolicyForEmployee('garage', role), 'garage_technician_clock_in')
    assert.equal(commissionPolicyForEmployee('chill', role), 'sabinagisa_commission_pool')
  }
  assert.equal(commissionPolicyForEmployee('garage', 'chill_staff'), 'branch_individual')
  assert.equal(commissionPolicyForEmployee('chill', 'chill_staff'), 'sabinagisa_commission_pool')
  const unchangedRestaurantAmounts = [300, 375, 375, 375]
  for (const [index, at] of ['2026-10-13T10:59:00Z', '2026-10-13T11:00:00Z', '2026-10-13T16:59:00Z', '2026-10-13T17:00:00Z'].entries()) {
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

test('attendance and commission history show immutable Normal/Peak snapshots', () => {
  assert.match(attendance, /garage_commission_period/)
  assert.match(attendance, /garage_commission_amount/)
  assert.match(attendance, /staff\?\.branches\?\.key === 'garage'.*head_mechanic/s)
  assert.match(commissionHistory, /commission_policy,commission_period,commission_attendance_id/)
  assert.match(commissionHistory, /row\.commission_period === 'peak' \? 'Peak' : row\.commission_period === 'normal' \? 'Normal'/)
  assert.match(pos, /NORMAL — ¥10,000 · PEAK — ¥15,000 · Peak Time 18:00–00:00/)
})
