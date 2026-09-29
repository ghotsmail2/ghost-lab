import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20260929_sabinagisa_on_work_commission.sql', import.meta.url), 'utf8')

test('ON_WORK_ALL snapshots every eligible on-shift recipient at full amount', () => {
  assert.match(migration, /commission_mode in \('INDIVIDUAL','ON_WORK_ALL','NONE'\)/)
  assert.match(migration, /unique \(bill_id,user_id\)/)
  assert.match(migration, /a\.clock_in<=completed_at_value/)
  assert.match(migration, /a\.clock_out is null or a\.clock_out>completed_at_value/)
  assert.match(migration, /s\.active and s\.commission_eligible/)
  assert.match(migration, /b\.commission,'ON_WORK_ALL'/)
  assert.doesNotMatch(migration, /commission\s*\/\s*eligible/i)
})

test('cancelled or rejected bills reverse unpaid distributions', () => {
  assert.match(migration, /new\.status::text in \('rejected','cancelled'\)/)
  assert.match(migration, /paid_at is null/)
  assert.match(migration, /reversed_at=coalesce\(reversed_at,now\(\)\)/)
})

test('Sabinagisa defaults to ON_WORK_ALL while preserving other branches', () => {
  assert.match(migration, /where key::text = 'chill'/)
  assert.match(migration, /set commission_mode = 'ON_WORK_ALL'/)
  assert.match(migration, /default 'INDIVIDUAL'/)
})
