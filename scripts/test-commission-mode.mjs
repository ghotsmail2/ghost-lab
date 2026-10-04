import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const legacyMigration = await readFile(new URL('../supabase/migrations/20260929_sabinagisa_on_work_commission.sql', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261005_sabinagisa_commission_pool.sql', import.meta.url), 'utf8')

test('ON_WORK_ALL snapshots eligible staff and splits one pool', () => {
  assert.match(legacyMigration, /commission_mode in \('INDIVIDUAL','ON_WORK_ALL','NONE'\)/)
  assert.match(legacyMigration, /unique \(bill_id,user_id\)/)
  assert.match(migration, /atn\.clock_in <= b\.first_order_time/)
  assert.match(migration, /atn\.clock_out is null or atn\.clock_out > b\.first_order_time/)
  assert.match(migration, /v_share := case when v_count > 0 then v_final \/ v_count else 0 end/)
  assert.match(migration, /v_remainder := case when v_count > 0 then mod\(v_final, v_count\) else 0 end/)
  assert.doesNotMatch(migration, /select b\.id,s\.id,s\.name_en,b\.commission,'ON_WORK_ALL'/)
})

test('cancelled or rejected bills reverse unpaid distributions', () => {
  assert.match(migration, /new\.status::text in \('rejected','cancelled'\)/)
  assert.match(migration, /paid_at is null/)
  assert.match(migration, /reversed_at=coalesce\(reversed_at,clock_timestamp\(\)\)/)
})

test('Sabinagisa defaults to ON_WORK_ALL while preserving other branches', () => {
  assert.match(legacyMigration, /where key::text = 'chill'/)
  assert.match(legacyMigration, /set commission_mode = 'ON_WORK_ALL'/)
  assert.match(legacyMigration, /default 'INDIVIDUAL'/)
})
