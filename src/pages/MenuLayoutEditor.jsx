import React from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPages } from '../lib/fetchAllPages.js'
import { combineMenuMaterials, indexServiceMaterials, isSet, materialRows, menuGroups, menuPositions } from '../lib/sabinagisa-menu-layout.js'

export { arrangeMenuCards } from '../lib/sabinagisa-menu-layout.js'

const menuMoney = value => `¥${Number(value).toLocaleString()}`

function MenuCardContent({ name, category, price, imageUrl }) {
  return <>
    <span className="pos-menu-card__image">
      {imageUrl && <img key={imageUrl} src={imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />}
    </span>
    <span className="pos-menu-card__body">
      <span className="pos-menu-card__category">{category}</span>
      <strong className="pos-menu-card__name" title={name}>{name}</strong>
      <span className="font-mono pos-menu-card__price">{price}</span>
    </span>
  </>
}

export function StandaloneMenuCard({ service, onAdd, disabled, imageUrl }) {
  const className = `panel pos-menu-card${service.startsStandaloneRow ? ' pos-menu-card--start-row' : ''}`
  return <button type="button" className={className} disabled={disabled} onClick={() => onAdd(service)} aria-label={`เพิ่ม ${service.name}`}>
    <MenuCardContent name={service.name} category={service.category} price={menuMoney(service.price)} imageUrl={imageUrl} />
    <span className="pos-menu-card__add" aria-hidden="true">+</span>
  </button>
}

export function SetVariantCard({ card, onAdd, disabled, imageUrl }) {
  const dialog = React.useRef(null)
  const headingId = React.useId()
  const [pickedId, setPickedId] = React.useState(null)
  const selected = card.variantOptions.find(({ service }) => service.id === pickedId)?.service
  const prices = card.variantOptions.map(({ service }) => Number(service.price))
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const price = minPrice === maxPrice ? menuMoney(minPrice) : `${menuMoney(minPrice)}–${menuMoney(maxPrice)}`

  return <article className="panel pos-menu-card">
    <MenuCardContent name={card.title} category="SET" price={price} imageUrl={imageUrl} />
    <button type="button" className="pos-menu-card__add" disabled={disabled} aria-haspopup="dialog" aria-label={`เลือกแบบ ${card.title}`}
      onClick={() => dialog.current.showModal()}>+</button>
    <dialog ref={dialog} className="pos-menu-chooser" aria-labelledby={headingId} onClose={() => setPickedId(null)}>
      <strong id={headingId}>{card.title}</strong>
      <div className="pos-menu-chooser__controls">
        {card.variantOptions.map(({ service, label }) => <button key={service.id} type="button" className="btn" disabled={disabled}
          aria-pressed={pickedId === service.id} onClick={() => setPickedId(service.id)}>
          {label}{minPrice !== maxPrice && ` · ${menuMoney(service.price)}`}
        </button>)}
        <button type="button" className="btn btn-primary" disabled={disabled || !selected} onClick={() => {
          onAdd(selected)
          dialog.current.close()
        }}>เพิ่มเซ็ต</button>
        <button type="button" className="btn" onClick={() => dialog.current.close()}>ปิด</button>
      </div>
    </dialog>
  </article>
}

function move(list, from, to) {
  const next = [...list]
  const [value] = next.splice(from, 1)
  next.splice(to, 0, value)
  return next
}

const editorStyle = {
  maxWidth: 640,
  marginBottom: 16,
  border: '1px solid var(--line)',
  borderRadius: 12,
  background: 'var(--static)',
  color: 'var(--bone)',
}
const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid var(--line)',
}
const pickerStyle = { width: '100%', minWidth: 0, minHeight: 38, fontSize: 13 }
const actionsStyle = { display: 'inline-flex', alignItems: 'center', gap: 4 }
const iconButtonStyle = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: 7,
  fontSize: 15,
  lineHeight: 1,
}

function IconButton({ label, disabled, onClick, children }) {
  return <button type="button" className="btn" style={iconButtonStyle}
    aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>
}

function MoveButtons({ index, count, name, onMove }) {
  return <>
    <IconButton disabled={index === 0} label={'เลื่อนขึ้น ' + name} onClick={() => onMove(index - 1)}>↑</IconButton>
    <IconButton disabled={index === count - 1} label={'เลื่อนลง ' + name} onClick={() => onMove(index + 1)}>↓</IconButton>
  </>
}

export function MenuLayoutEditor({ branch, services, loading, onSaved }) {
  const [open, setOpen] = React.useState(false)
  const [layout, setLayout] = React.useState(null)
  const [base, setBase] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState('')
  const [error, setError] = React.useState('')
  const [conflict, setConflict] = React.useState(false)
  const [selectedSetId, setSelectedSetId] = React.useState('')
  const [stockItems, setStockItems] = React.useState([])
  const [savedMaterials, setSavedMaterials] = React.useState(() => new Map())
  const [drafts, setDrafts] = React.useState({})
  const byId = new Map(services.map(service => [service.id, service]))
  const items = services.filter(service => !isSet(service))
  const groups = menuGroups(services, layout)
  const positions = menuPositions(groups)
  const groupIndex = Math.max(0, groups.findIndex(group => group.setId === selectedSetId))
  const selectedGroup = groups[groupIndex]
  const selectedSet = byId.get(selectedGroup?.setId)
  const positionIndex = positions.findIndex(position => position.includes(selectedGroup))
  const paired = positions[positionIndex]?.length > 1
  const variantNames = [...new Set(groups.map(group => group.variantGroup.trim()).filter(Boolean))]
  const availableItems = selectedGroup ? items.filter(item => !selectedGroup.itemIds.includes(item.id)) : []
  const selectedDraft = drafts[selectedSet?.id]
  const quantities = selectedDraft?.quantities || savedMaterials.get(selectedSet?.id) || {}
  const missingFormulas = selectedGroup?.itemIds.filter(id => !materialRows(savedMaterials.get(id) || {}).length) || []

  async function load() {
    setOpen(true)
    setBusy(true)
    setLayout(null)
    setError('')
    setNotice('')
    try {
      const [branchResult, stock, materials] = await Promise.all([
        supabase.from('branches').select('menu_layout').eq('id', branch.id).single(),
        fetchAllPages(supabase.from('stock_items').select('id,name,unit').eq('branch_id', branch.id).order('name').order('id')),
        fetchAllPages(supabase.from('service_materials').select('service_id,stock_item_id,qty_per_unit,service:services!inner(branch_id)')
          .eq('service.branch_id', branch.id).order('id')),
      ])
      if (branchResult.error) throw branchResult.error
      setStockItems(stock)
      setSavedMaterials(indexServiceMaterials(materials))
      setDrafts({})
      setBase(branchResult.data.menu_layout)
      setLayout(branchResult.data.menu_layout)
      setConflict(false)
    } catch (problem) {
      console.error(problem)
      setError('โหลดข้อมูลเซ็ตและวัตถุดิบไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  function change(next) {
    setLayout(next)
    setNotice('')
    setError('')
  }

  function updateGroup(fields) {
    setSelectedSetId(selectedGroup.setId)
    change(groups.map(group => group === selectedGroup ? { ...group, ...fields } : group))
  }

  function fillMaterials(itemIds) {
    setDrafts(current => ({ ...current, [selectedSet.id]: { quantities: combineMenuMaterials(itemIds, savedMaterials), manual: false } }))
  }

  function updateItems(itemIds) {
    const membershipChanged = itemIds.length !== selectedGroup.itemIds.length
    updateGroup({ itemIds })
    if (membershipChanged && !selectedDraft?.manual) fillMaterials(itemIds)
  }

  function updateQuantity(stockId, value) {
    const parsed = value === '' ? 0 : Number(value)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2147483647) return
    setDrafts(current => ({ ...current, [selectedSet.id]: { quantities: { ...quantities, [stockId]: parsed }, manual: true } }))
    setNotice('')
  }

  function resetMaterials() {
    setDrafts(current => {
      const remaining = { ...current }
      delete remaining[selectedSet.id]
      return remaining
    })
    setNotice('')
  }

  function moveSet(to) {
    setSelectedSetId(selectedGroup.setId)
    change(move(positions, positionIndex, to).flat())
  }

  async function save() {
    if (busy || layout === null || conflict) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const nextLayout = groups.map(group => ({ ...group, variantGroup: group.variantGroup.trim(), variantLabel: group.variantLabel.trim() }))
      const changes = Object.entries(drafts).map(([serviceId, draft]) => ({
        serviceId,
        materials: materialRows(draft.quantities),
        expectedMaterials: savedMaterials.get(serviceId) || {},
      }))
      const { error: problem } = await supabase.rpc('save_sabinagisa_menu_settings', {
        p_branch_id: branch.id,
        p_layout: nextLayout,
        p_expected_layout: base,
        p_material_changes: changes,
      })
      if (problem) throw problem
      setBase(nextLayout)
      setLayout(nextLayout)
      setSavedMaterials(previous => {
        const next = new Map(previous)
        for (const { serviceId, materials } of changes) next.set(serviceId, Object.fromEntries(materials.map(row => [row.stock_item_id, row.qty_per_unit])))
        return next
      })
      setDrafts({})
      onSaved(nextLayout, changes)
      setNotice('บันทึกเซ็ตและวัตถุดิบแล้ว')
    } catch (problem) {
      console.error(problem)
      setConflict(problem.code === '40001')
      setError(problem.code === '40001'
        ? 'มีการแก้เซ็ตหรือวัตถุดิบจากอีกหน้าต่าง กรุณาโหลดข้อมูลล่าสุดก่อนแก้ต่อ'
        : 'บันทึกเซ็ตไม่สำเร็จ ' + (problem.message || 'กรุณาลองอีกครั้ง'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return <button type="button" className="btn" disabled={loading} style={{ marginBottom: 12 }} onClick={load}>จัดเซ็ตและลำดับเมนู ALL</button>
  return <section aria-label="จัดเซ็ตและลำดับเมนู ALL" style={editorStyle}>
    <div style={headerStyle}>
      <strong style={{ fontSize: 15 }}>จัดเซ็ตและลำดับเมนู ALL</strong>
      <IconButton label="ปิดตัวจัดลำดับเมนู" disabled={busy} onClick={() => setOpen(false)}>×</IconButton>
    </div>
    <div style={{ padding: 16 }}>
      {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 13 }}>{error}</p>}
      {(layout === null || conflict) && !busy && <button type="button" className="btn" onClick={load}>โหลดลำดับล่าสุด</button>}
      {busy && layout === null && <p role="status" style={{ margin: 0 }}>กำลังโหลดลำดับเมนู…</p>}
      {layout !== null && !selectedSet && <p style={{ margin: 0, color: 'var(--ghost-gray)', fontSize: 13 }}>เพิ่มรายการหมวด SET ใน Services ก่อน</p>}
      {layout !== null && selectedSet && <fieldset disabled={busy || conflict || loading}
        style={{ display: 'grid', gap: 12, border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="sabinagisa-menu-set" style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>เลือกเซต</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 8 }}>
            <select id="sabinagisa-menu-set" className="input" style={pickerStyle} value={selectedGroup.setId}
              onChange={event => setSelectedSetId(event.target.value)}>
              {positions.flatMap((position, index) => position.map(({ setId }) => <option key={setId} value={setId}>
                {index + 1}. {byId.get(setId).name}
              </option>))}
            </select>
            <div style={actionsStyle}>
              <MoveButtons index={positionIndex} count={positions.length} name={paired ? selectedGroup.variantGroup : selectedSet.name} onMove={moveSet} />
            </div>
          </div>
          <label style={{ fontSize: 12 }}>ชื่อกลุ่มบนการ์ด POS
            <input className="input" style={pickerStyle} list="sabinagisa-set-variant-groups" maxLength={100}
              value={selectedGroup.variantGroup} onChange={event => updateGroup({ variantGroup: event.target.value })} placeholder="เว้นว่างถ้าขายเป็นเซ็ตเดี่ยว" />
          </label>
          <datalist id="sabinagisa-set-variant-groups">{variantNames.map(name => <option key={name} value={name} />)}</datalist>
          {selectedGroup.variantGroup.trim() && <label style={{ fontSize: 12 }}>ชื่อตัวเลือก
            <input className="input" style={pickerStyle} maxLength={100} value={selectedGroup.variantLabel}
              onChange={event => updateGroup({ variantLabel: event.target.value })} placeholder={selectedSet.name} />
          </label>}
          <small style={{ color: 'var(--ghost-gray)' }}>ใส่ชื่อกลุ่มเดียวกันให้กับเซ็ตที่ต้องการให้เลือกจากการ์ดเดียว</small>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>เมนูในเซต</div>
          {selectedGroup.itemIds.length === 0 && <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--ghost-gray)' }}>ยังไม่มีเมนูในเซตนี้</p>}
          {selectedGroup.itemIds.length > 0 && <ol aria-label="เมนูในเซต" style={{
            display: 'grid', margin: 0, padding: 0, listStyle: 'none', border: '1px solid var(--line)', borderRadius: 8,
            background: 'var(--static-raised)',
          }}>
            {selectedGroup.itemIds.map((id, itemIndex) => <li key={id} style={{
              display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) auto', alignItems: 'center', gap: 6, padding: '6px 8px',
              borderTop: itemIndex === 0 ? undefined : '1px solid var(--line)',
            }}>
              <span aria-hidden="true" style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>{itemIndex + 1}</span>
              <span style={{ fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>{byId.get(id).name}</span>
              <div style={actionsStyle}>
                <MoveButtons index={itemIndex} count={selectedGroup.itemIds.length} name={byId.get(id).name}
                  onMove={to => updateItems(move(selectedGroup.itemIds, itemIndex, to))} />
                <IconButton label={'เอา ' + byId.get(id).name + ' ออกจากเซต'}
                  onClick={() => updateItems(selectedGroup.itemIds.filter(item => item !== id))}>×</IconButton>
              </div>
            </li>)}
          </ol>}
          <select className="input" style={pickerStyle} value="" aria-label={'เพิ่มเมนูใน ' + selectedSet.name}
            disabled={availableItems.length === 0}
            onChange={event => updateItems([...selectedGroup.itemIds, event.target.value])}>
            <option value="" disabled>{availableItems.length ? '+ เพิ่มเมนูในเซต' : 'เพิ่มเมนูครบแล้ว'}</option>
            {availableItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <strong style={{ fontSize: 13 }}>วัตถุดิบต่อ 1 เซ็ต</strong>
          <small style={{ color: 'var(--ghost-gray)' }}>เมื่อเพิ่มหรือเอาเมนูออก ระบบจะรวมสูตรของเมนูในเซ็ตให้ กรอกจำนวนเองได้ก่อนบันทึก</small>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className="btn" disabled={!selectedGroup.itemIds.length} onClick={() => fillMaterials(selectedGroup.itemIds)}>รวมสูตรจากเมนูในเซ็ต</button>
            {selectedDraft && <button type="button" className="btn" onClick={resetMaterials}>คืนสูตรที่บันทึกไว้</button>}
          </div>
          {selectedDraft && <small role="status">{selectedDraft.manual ? 'กำลังใช้จำนวนที่กรอกเอง' : 'รวมสูตรจากเมนูแล้ว ตรวจจำนวนก่อนบันทึก'}</small>}
          {missingFormulas.length > 0 && <small style={{ color: 'var(--ghost-gray)' }}>ยังไม่มีสูตรสำหรับ {missingFormulas.map(id => byId.get(id).name).join(', ')}</small>}
          {selectedDraft && !materialRows(quantities).length && <small role="status">เมื่อบันทึก เซ็ตนี้จะไม่มีวัตถุดิบให้ตัดสต๊อก</small>}
          {stockItems.filter(item => Object.hasOwn(quantities, item.id)).map(item => <label key={item.id}
            style={{ display: 'grid', gridTemplateColumns: '1fr 90px', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span>{item.name}{item.unit && ` (${item.unit})`}</span>
            <input className="input" type="number" min="0" step="1" max="2147483647" value={quantities[item.id]} onChange={event => updateQuantity(item.id, event.target.value)} />
          </label>)}
          <select className="input" style={pickerStyle} value="" aria-label="เพิ่มวัตถุดิบเอง" onChange={event => updateQuantity(event.target.value, 1)}>
            <option value="" disabled>+ เพิ่มวัตถุดิบเอง</option>
            {stockItems.filter(item => !Object.hasOwn(quantities, item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          {notice && <span role="status" style={{ color: 'var(--ghost-gray)', fontSize: 12 }}>{notice}</span>}
          <button type="button" className="btn btn-primary" onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกเซ็ต'}</button>
        </div>
      </fieldset>}
    </div>
  </section>
}
