import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stockPage = await readFile(new URL('../src/pages/Stock.jsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/delete_unused_stock_items.sql', import.meta.url), 'utf8')

test('stock page offers deletion only to Owner/GOD, with confirmation and RPC feedback', () => {
  assert.match(stockPage, /\['owner', 'god'\]\.includes\(staff\?\.role\)/)
  assert.match(stockPage, /window\.confirm\(`ลบวัตถุดิบ/)
  assert.match(stockPage, /rpc\('delete_unused_stock_item'/)
  assert.match(stockPage, /qty !== 0/)
  assert.match(stockPage, /setSaveError\(error\.message/)
})

test('database deletion RPC refuses stock still in inventory, a recipe, or movement history', () => {
  assert.match(migration, /actor\.role::text not in \('owner', 'god'\)/)
  assert.match(migration, /target\.quantity <> 0/)
  assert.match(migration, /from public\.service_materials where stock_item_id = target\.id/)
  assert.match(migration, /from public\.stock_movements where stock_item_id = target\.id/)
  assert.match(migration, /delete from public\.stock_items where id = target\.id/)
})
