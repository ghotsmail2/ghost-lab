import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { priceService } from './src/lib/garage-vehicle-pricing.js'

test('Garage Standard price uses the editable service row, even when catalog has a default', () => {
  const result = priceService({ name: 'Sport: Upgraded Valve Springs', price: 9100 }, 'standard')
  assert.equal(result.price, 9100)
  assert.equal(result.pricingSource, 'service')
})

test('Production POS imports the editable pricing helper from its versioned asset directory', async () => {
  const build = await readFile(new URL('./scripts/build-recovered.mjs', import.meta.url), 'utf8')
  const versionedCopy = build.indexOf("await cp(path.join(sourceRoot, 'assets'), versionedRoot, { recursive: true })")
  const helperWrite = build.indexOf("path.join(versionedRoot, 'vehicle-pricing.js')", versionedCopy)
  assert.ok(versionedCopy >= 0, 'production assets are copied into their versioned directory')
  assert.ok(helperWrite > versionedCopy, 'editable helper replaces the copied legacy helper after the copy')
  assert.match(build.slice(versionedCopy, helperWrite), /garage-vehicle-pricing\.js/)
  assert.doesNotMatch(build.slice(0, versionedCopy), /path\.join\(outputRoot, 'assets', 'vehicle-pricing\.js'\)/)
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
  assert.match(build, /if \(\/\^\\\\d\+\$\/\.test\(value\)\) window\.__garagePriceSaveTimers\[s\.id\] = setTimeout\(\(\) => l\(s\.id, "price", value\), 650\)/)
  assert.match(build, /onBlur: r => \{ clearTimeout\(window\.__garagePriceSaveTimers\?\.\[s\.id\]\); l\(s\.id, "price", r\.target\.value\); \}/)
  assert.match(build, /if \(r\.key === "Enter"\) r\.currentTarget\.blur\(\)/)
  assert.match(build, /if\(priceField&&!validInput\)\{await restoreRow\(\);return;\}/)
  assert.match(build, /notice\.setAttribute\("role","status"\)/)
  assert.doesNotMatch(build, /alert\("บันทึกราคาไม่สำเร็จ:/)
  assert.match(build, /await restoreRow\(\);const notice=document\.createElement\("div"\)/)
  assert.match(build, /digest\.update\('build-transform'\)\.update\(await readFile\(fileURLToPath\(import\.meta\.url\)\)\)/)
})

test('Garage price save uses a branch-scoped RPC with role validation', async () => {
  const build = await readFile(new URL('./scripts/build-recovered.mjs', import.meta.url), 'utf8')
  const migration = await readFile(new URL('./supabase/garage_service_price_rpc.sql', import.meta.url), 'utf8')
  assert.match(build, /x\.rpc\("update_garage_service_price"/)
  assert.match(migration, /branch\.key::text = 'garage'/)
  assert.match(migration, /actor\.role::text not in \('owner', 'god'\)/)
  assert.match(migration, /actor\.role::text = 'ceo' and actor\.primary_branch = target_service\.branch_id/)
  assert.match(migration, /grant execute on function public\.update_garage_service_price\(uuid, text, integer\) to authenticated/)
})

test('POS refreshes service prices without a page reload', async () => {
  const build = await readFile(new URL('./scripts/build-recovered.mjs', import.meta.url), 'utf8')
  assert.match(build, /setInterval\(refreshServices, 5000\)/)
  assert.match(build, /refusing to leave prices stale after catalog edits/)
})
