import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20261011_weekly_closing_reconciliation.sql', import.meta.url),
  'utf8',
)
const buildScript = await readFile(new URL('./build-recovered.mjs', import.meta.url), 'utf8')

test('weekly preview reconciles sales, expenses, commissions and cash ledger', () => {
  for (const marker of [
    'get_weekly_closing_preview',
    "'sales_total'",
    "'cash_sales'",
    "'transfer_sales'",
    "'expense_total'",
    "'commission_generated'",
    "'commission_paid'",
    "'commission_pending'",
    "'opening_cash_balance'",
    "'closing_cash_balance'",
    "'unlinked_payout_total'",
  ]) {
    assert.match(migration, new RegExp(marker))
  }
  assert.match(migration, /at time zone 'Asia\/Bangkok'/)
})

test('closing snapshot is immutable and protects its source period', () => {
  assert.match(migration, /constraint weekly_closings_period_unique/)
  assert.match(migration, /create or replace function public\.close_weekly_period/)
  assert.match(migration, /p_counted_cash - coalesce\(\(preview->>'closing_cash_balance'\)::integer, 0\)/)
  assert.match(migration, /create trigger bills_protect_closed_period/)
  assert.match(migration, /create trigger expenses_protect_closed_period/)
  assert.match(migration, /create trigger cash_ledger_protect_closed_period/)
  assert.match(migration, /ช่วงวันที่นี้ปิดรอบแล้ว/)
})

test('legacy commission reconciliation is idempotent and owner-only', () => {
  assert.match(migration, /reconcile_unlinked_commission_payouts/)
  assert.match(migration, /not exists \(select 1 from public\.cash_ledger/)
  assert.match(migration, /on conflict \(commission_payout_id\).*do nothing/)
  assert.match(migration, /actor\.role::text not in \('owner', 'god'\)/)
})

test('daily summary keeps daily detail and adds a separate closing panel', () => {
  assert.match(buildScript, /รายละเอียดรายวัน/)
  assert.match(buildScript, /weekly-closing-panel/)
  assert.match(buildScript, /เลือก จันทร์–อาทิตย์/)
  assert.match(buildScript, /CEO ดูรายงานได้ · Owner เป็นผู้ปิดรอบ/)
  assert.match(buildScript, /ปรับยอดค่าคอมเก่า/)
})
