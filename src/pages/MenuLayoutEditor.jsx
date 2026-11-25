import React from 'react'
import { supabase } from '../lib/supabase'

const isSet = service => service.category.trim().toLowerCase() === 'set'

function menuGroups(services, layout) {
  const sets = new Map(services.filter(isSet).map(service => [service.id, service]))
  const items = new Set(services.filter(service => !isSet(service)).map(service => service.id))
  const groups = []
  for (const group of layout ?? []) {
    if (!sets.delete(group.setId)) continue
    groups.push({ setId: group.setId, itemIds: group.itemIds.filter(id => items.has(id)) })
  }
  for (const setId of sets.keys()) groups.push({ setId, itemIds: [] })
  return groups
}

export function arrangeMenuCards(services, layout) {
  const byId = new Map(services.map(service => [service.id, service]))
  const grouped = new Set()
  const cards = []
  for (const { setId, itemIds } of menuGroups(services, layout)) {
    cards.push(byId.get(setId))
    grouped.add(setId)
    for (const id of itemIds) {
      cards.push({ ...byId.get(id), menuCardKey: setId + ':' + id })
      grouped.add(id)
    }
  }
  return [...cards, ...services.filter(service => !grouped.has(service.id))]
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
  const byId = new Map(services.map(service => [service.id, service]))
  const items = services.filter(service => !isSet(service))
  const groups = menuGroups(services, layout)
  const groupIndex = Math.max(0, groups.findIndex(group => group.setId === selectedSetId))
  const selectedGroup = groups[groupIndex]
  const selectedSet = byId.get(selectedGroup?.setId)
  const availableItems = selectedGroup ? items.filter(item => !selectedGroup.itemIds.includes(item.id)) : []

  async function load() {
    setOpen(true)
    setBusy(true)
    setLayout(null)
    setError('')
    setNotice('')
    try {
      const { data, error: problem } = await supabase.from('branches').select('menu_layout').eq('id', branch.id).single()
      if (problem) throw problem
      setBase(data.menu_layout)
      setLayout(data.menu_layout)
      setConflict(false)
    } catch (problem) {
      console.error(problem)
      setError('โหลดลำดับเมนูไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  function change(next) {
    setLayout(next)
    setNotice('')
    setError('')
  }

  function updateItems(index, itemIds) {
    change(groups.map((group, position) => position === index ? { ...group, itemIds } : group))
  }

  function moveSet(to) {
    setSelectedSetId(selectedGroup.setId)
    change(move(groups, groupIndex, to))
  }

  async function save() {
    if (busy || layout === null || conflict) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { error: problem } = await supabase.rpc('save_sabinagisa_menu_layout', {
        p_branch_id: branch.id,
        p_layout: groups,
        p_expected_layout: base,
      })
      if (problem) throw problem
      setBase(groups)
      setLayout(groups)
      onSaved(groups)
      setNotice('บันทึกลำดับเมนูแล้ว')
    } catch (problem) {
      console.error(problem)
      setConflict(problem.code === '40001')
      setError(problem.code === '40001'
        ? 'มีการบันทึกลำดับจากอีกหน้าต่าง กรุณาโหลดลำดับล่าสุดก่อนแก้ต่อ'
        : 'บันทึกลำดับเมนูไม่สำเร็จ ' + (problem.message || 'กรุณาลองอีกครั้ง'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return <button type="button" className="btn" disabled={loading} style={{ marginBottom: 12 }} onClick={load}>จัดลำดับเมนู ALL</button>
  return <section aria-label="จัดลำดับเมนู ALL" style={editorStyle}>
    <div style={headerStyle}>
      <strong style={{ fontSize: 15 }}>จัดลำดับเมนู ALL</strong>
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
              {groups.map(({ setId }, position) => <option key={setId} value={setId}>
                {position + 1}. {byId.get(setId).name}
              </option>)}
            </select>
            <div style={actionsStyle}>
              <MoveButtons index={groupIndex} count={groups.length} name={selectedSet.name} onMove={moveSet} />
            </div>
          </div>
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
                  onMove={to => updateItems(groupIndex, move(selectedGroup.itemIds, itemIndex, to))} />
                <IconButton label={'เอา ' + byId.get(id).name + ' ออกจากเซต'}
                  onClick={() => updateItems(groupIndex, selectedGroup.itemIds.filter(item => item !== id))}>×</IconButton>
              </div>
            </li>)}
          </ol>}
          <select className="input" style={pickerStyle} value="" aria-label={'เพิ่มเมนูใน ' + selectedSet.name}
            disabled={availableItems.length === 0}
            onChange={event => updateItems(groupIndex, [...selectedGroup.itemIds, event.target.value])}>
            <option value="" disabled>{availableItems.length ? '+ เพิ่มเมนูในเซต' : 'เพิ่มเมนูครบแล้ว'}</option>
            {availableItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          {notice && <span role="status" style={{ color: 'var(--ghost-gray)', fontSize: 12 }}>{notice}</span>}
          <button type="button" className="btn btn-primary" onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกลำดับ'}</button>
        </div>
      </fieldset>}
    </div>
  </section>
}
