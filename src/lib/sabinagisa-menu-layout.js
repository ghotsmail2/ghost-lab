export const isSet = service => service.category.trim().toLowerCase() === 'set'

const groupKey = group => group.variantGroup.trim().toLowerCase()

export function menuGroups(services, layout) {
  const sets = new Set(services.filter(isSet).map(service => service.id))
  const items = new Set(services.filter(service => !isSet(service)).map(service => service.id))
  const groups = []
  for (const group of layout ?? []) {
    if (!sets.delete(group.setId)) continue
    groups.push({
      setId: group.setId,
      itemIds: group.itemIds.filter(id => items.has(id)),
      variantGroup: typeof group.variantGroup === 'string' ? group.variantGroup : '',
      variantLabel: typeof group.variantLabel === 'string' ? group.variantLabel : '',
    })
  }
  for (const setId of sets) groups.push({ setId, itemIds: [], variantGroup: '', variantLabel: '' })
  return groups
}

export function menuPositions(groups) {
  const positions = []
  const variants = new Map()
  for (const group of groups) {
    const key = groupKey(group)
    if (key && variants.has(key)) {
      variants.get(key).push(group)
    } else {
      const position = [group]
      positions.push(position)
      if (key) variants.set(key, position)
    }
  }
  return positions
}

export function arrangeMenuCards(services, layout) {
  const byId = new Map(services.map(service => [service.id, service]))
  const cards = []
  const grouped = new Set()
  for (const position of menuPositions(menuGroups(services, layout))) {
    for (const { setId } of position) grouped.add(setId)
    const first = position[0]
    let cardKey = first.setId
    if (position.length > 1) {
      cardKey = `set-group:${groupKey(first)}`
      const variantOptions = position.map(group => ({
        service: byId.get(group.setId),
        label: group.variantLabel.trim() || byId.get(group.setId).name,
      }))
      cards.push({ title: first.variantGroup.trim(), menuCardKey: cardKey, variantOptions })
    } else {
      cards.push(byId.get(first.setId))
    }
    for (const id of new Set(position.flatMap(group => group.itemIds))) {
      grouped.add(id)
      cards.push({ ...byId.get(id), menuCardKey: `${cardKey}:${id}` })
    }
  }
  return [...cards, ...services.filter(service => !grouped.has(service.id))]
}

export function indexServiceMaterials(rows) {
  const materials = new Map()
  for (const { service_id, stock_item_id, qty_per_unit } of rows) {
    if (!materials.has(service_id)) materials.set(service_id, {})
    materials.get(service_id)[stock_item_id] = qty_per_unit
  }
  return materials
}

export function combineMenuMaterials(itemIds, materialsByService) {
  const totals = {}
  for (const id of itemIds) {
    for (const [stockId, quantity] of Object.entries(materialsByService.get(id) || {})) {
      totals[stockId] = (totals[stockId] || 0) + quantity
    }
  }
  return totals
}

export function materialRows(quantities) {
  return Object.entries(quantities).filter(([, quantity]) => quantity > 0)
    .map(([stock_item_id, qty_per_unit]) => ({ stock_item_id, qty_per_unit }))
}
