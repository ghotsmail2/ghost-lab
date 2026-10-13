import { catalogPrices, catalogVersion } from '../../recovered-production/assets/catalog-prices.js'

export { catalogVersion }
export const vehicleLabels = { standard: 'Standard', supercar: 'Super Car' }
export const normalizeServiceName = name => String(name || '').trim().replace(/^sport\s*:\s*/i, '').replace(/\s+/g, ' ').toLowerCase()

const byName = new Map()
for (const row of catalogPrices) for (const name of row.names) {
  const key = normalizeServiceName(name)
  if (byName.has(key) && byName.get(key) !== row) throw new Error(`Ambiguous catalog name: ${key}`)
  byName.set(key, row)
}
const aliases = {
  'high-flow fuel pump': 'high flow fuel pump',
  'iridium spark plug': 'iridium spark plugs',
  'comfort tires': 'comfort tire',
  'sport tires': 'sport tire',
  'slick tire (m)': 'slick tires (m)',
}
for (const [alias, name] of Object.entries(aliases)) byName.set(alias, byName.get(name))
for (const name of ['เหมา n/a (standard)', 'เหมา turbo set !!', 'เหมา handing']) byName.set(name, { status: 'priced' })

export const isRepairKit = service => ['engine repair kit', 'full repair kit'].includes(normalizeServiceName(service.name))
export const catalogEntry = service => byName.get(normalizeServiceName(service.name))
const validPrice = price => typeof price === 'number' && Number.isSafeInteger(price) && price >= 0

export function priceService(service, vehicleClass = 'standard', branchKey = 'garage') {
  let price = service.price
  let pricingSource = 'existing'
  let pricingError = ''
  if (branchKey === 'garage') {
    if (!Object.hasOwn(vehicleLabels, vehicleClass)) {
      price = null
      pricingError = 'กรุณาเลือกประเภทรถ'
    } else if (vehicleClass === 'standard' || (vehicleClass === 'supercar' && isRepairKit(service))) {
      // Each service row is authoritative; names and catalog classifications do not set its price.
      price = Number(service.price)
      pricingSource = 'service'
    } else if (service.supercar_price != null && service.supercar_price !== '') {
      price = Number(service.supercar_price)
      pricingSource = 'service'
      if (!validPrice(price) || price <= 0) {
        price = null
        pricingError = 'ราคา Super Car ไม่ถูกต้อง'
      }
    } else {
      price = null
      pricingError = catalogEntry(service)?.status === 'not_for_sale' ? 'แค็ตตาล็อกระบุห้ามจำหน่าย' : 'ยังไม่มีราคา Super Car'
    }
  }
  if (branchKey === 'chill' && price === 0) {
    price = null
    pricingError = 'กรุณาตั้งราคาใน Services ก่อนขาย'
  }
  if (!validPrice(price)) {
    price = null
    pricingError ||= 'ยังไม่มีราคาที่ถูกต้อง'
  }
  return { ...service, price, pricingSource, pricingError }
}

export const priceLabel = service => service.pricingError || `¥${service.price.toLocaleString()}`
export function repairKitDiscount(items, active, branchKey) {
  return active && branchKey === 'garage' ? items.reduce((sum, item) => sum + (isRepairKit(item) && validPrice(item.price) ? item.price : 0), 0) : 0
}
