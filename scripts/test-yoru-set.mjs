import assert from 'node:assert/strict'
import test from 'node:test'
import { arrangeMenuCards, combineMenuMaterials, indexServiceMaterials, materialRows, menuGroups, menuPositions } from '../src/lib/sabinagisa-menu-layout.js'

const menu = (id, name, category = 'SET') => ({ id, name, category, price: category === 'SET' ? 2400 : 800 })
const without = menu('yoru-no', 'SABI YORU SET (NO ALCOHAL)')
const withAlcohol = menu('yoru-yes', 'SABI YORU SET (ALCOHAL)')
const another = menu('sun-a', 'SUN SET A')
const anotherOption = menu('sun-b', 'SUN SET B')
const unagi = menu('unagi', 'SABI UNAGI', 'Food')
const highball = menu('highball', 'SABI NAGI HIGHBALL', 'Drinks')
const aoba = menu('aoba', 'SABI AOBA', 'Dessert')
const ume = menu('ume', 'SABI YORU UME', 'Dessert')
const services = [without, withAlcohol, another, anotherOption, unagi, highball, aoba, ume]
const layout = [
  { setId: without.id, itemIds: [unagi.id, highball.id, aoba.id], variantGroup: 'SABI YORU SET', variantLabel: 'ไม่มีแอลกอฮอล์' },
  { setId: another.id, itemIds: [], variantGroup: 'SUN SET', variantLabel: 'A' },
  { setId: withAlcohol.id, itemIds: [unagi.id, highball.id, ume.id], variantGroup: 'SABI YORU SET', variantLabel: 'มีแอลกอฮอล์' },
  { setId: anotherOption.id, itemIds: [], variantGroup: 'SUN SET', variantLabel: 'B' },
]

test('Configured groups support independent options and keep original service records in the bill', () => {
  const defaultCards = arrangeMenuCards(services, layout)
  const selectedCards = arrangeMenuCards(services, layout, { 'sabi yoru set': withAlcohol.id, 'sun set': anotherOption.id })
  assert.equal(defaultCards[0].selected.service, without)
  assert.equal(selectedCards[0].selected.service, withAlcohol)
  assert.equal(defaultCards[0].menuCardKey, selectedCards[0].menuCardKey)
  assert.deepEqual(defaultCards.slice(1, 4).map(card => card.id), [unagi.id, highball.id, aoba.id])
  assert.deepEqual(selectedCards.slice(1, 4).map(card => card.id), [unagi.id, highball.id, ume.id])
  assert.equal(selectedCards[4].selected.service, anotherOption)
  assert.deepEqual(arrangeMenuCards([aoba, ume], layout).map(card => card.id), [aoba.id, ume.id])
})

test('Configured variants move together and old ungrouped settings still work', () => {
  const positions = menuPositions(menuGroups(services, layout))
  assert.deepEqual(positions.map(position => position.map(group => group.setId)), [[without.id, withAlcohol.id], [another.id, anotherOption.id]])
  const cards = arrangeMenuCards(services, [positions[1], positions[0]].flat())
  assert.equal(cards[0].selected.service, another)
  assert.equal(cards[1].selected.service, without)
  assert.equal(arrangeMenuCards([without, unagi], [{ setId: without.id, itemIds: [unagi.id] }])[0], without)
  assert.equal(arrangeMenuCards([without], layout)[0], without)
})

test('Set autofill adds shared materials once per selected menu and allows manual totals', () => {
  const sources = indexServiceMaterials([
    { service_id: unagi.id, stock_item_id: 'fish', qty_per_unit: 2 },
    { service_id: unagi.id, stock_item_id: 'sugar', qty_per_unit: 1 },
    { service_id: highball.id, stock_item_id: 'sugar', qty_per_unit: 3 },
    { service_id: highball.id, stock_item_id: 'ice', qty_per_unit: 2 },
    { service_id: ume.id, stock_item_id: 'ice', qty_per_unit: 1 },
  ])
  const total = combineMenuMaterials([unagi.id, highball.id, ume.id], sources)
  assert.deepEqual(total, { fish: 2, sugar: 4, ice: 3 })
  assert.deepEqual(materialRows({ ...total, sugar: 5, ice: 0 }), [
    { stock_item_id: 'fish', qty_per_unit: 2 },
    { stock_item_id: 'sugar', qty_per_unit: 5 },
  ])
  assert.deepEqual(sources.get(highball.id), { sugar: 3, ice: 2 })
  assert.deepEqual(combineMenuMaterials([aoba.id], sources), {})
})
