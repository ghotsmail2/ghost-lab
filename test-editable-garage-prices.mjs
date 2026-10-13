import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { priceService } from './src/lib/garage-vehicle-pricing.js'

test('Garage Standard price uses the editable service row, even when catalog has a default', () => {
  const result = priceService({ name: 'Sport: Upgraded Valve Springs', price: 9100 }, 'standard')
  assert.equal(result.price, 9100)
  assert.equal(result.pricingSource, 'service')
})

test('Garage Super Car price is independently controlled by supercar_price', () => {
  const result = priceService({ name: 'Sport: Turbo Spec Cams', price: 9100, supercar_price: 19300 }, 'supercar')
  assert.equal(result.price, 19300)
  assert.equal(priceService({ name: 'Sport: Turbo Spec Cams', price: 9100 }, 'supercar').price, null)
})

test('Atomic server validator is patched to verify editable service-row prices', async () => {
  const migration = await readFile(new URL('./supabase/editable_garage_prices.sql', import.meta.url), 'utf8')
  assert.match(migration, /expected_price := service_row\.price/)
  assert.match(migration, /expected_price := service_row\.supercar_price/)
  assert.match(migration, /supercar_price is null/)
})

test('Garage Standard price commits automatically after typing and on Enter/blur', async () => {
  const build = await readFile(new URL('./scripts/build-recovered.mjs', import.meta.url), 'utf8')
  assert.match(build, /window\.__garagePriceSaveTimers\[s\.id\] = setTimeout\(\(\) => l\(s\.id, "price", value\), 650\)/)
  assert.match(build, /onBlur: r => \{ clearTimeout\(window\.__garagePriceSaveTimers\?\.\[s\.id\]\); l\(s\.id, "price", r\.target\.value\); \}/)
  assert.match(build, /if \(r\.key === "Enter"\) r\.currentTarget\.blur\(\)/)
})
