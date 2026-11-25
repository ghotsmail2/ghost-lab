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

const rowStyle = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }

function MoveButtons({ index, count, name, onMove }) {
  return <>
    <button type="button" className="btn" disabled={index === 0} aria-label={'เลื่อนขึ้น ' + name} onClick={() => onMove(index - 1)}>↑</button>
    <button type="button" className="btn" disabled={index === count - 1} aria-label={'เลื่อนลง ' + name} onClick={() => onMove(index + 1)}>↓</button>
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
  const byId = new Map(services.map(service => [service.id, service]))
  const items = services.filter(service => !isSet(service))
  const groups = menuGroups(services, layout)

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
  return <section aria-label="จัดลำดับเมนู ALL" style={{ padding: 12, marginBottom: 16, border: '1px solid var(--line)', borderRadius: 8 }}>
    <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
      <strong>จัดลำดับเมนู ALL</strong>
      <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>ปิด</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {(layout === null || conflict) && !busy && <button type="button" className="btn" onClick={load}>โหลดลำดับล่าสุด</button>}
    {busy && <p role="status">กำลังดำเนินการ…</p>}
    {layout !== null && <fieldset disabled={busy || conflict || loading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <p>ใช้ลูกศรเลื่อนเซตหรือเมนูในเซต เมนูที่ไม่ได้จัดเข้าเซตจะแสดงต่อท้าย</p>
      {groups.length === 0 && <p>เพิ่มรายการหมวด SET ใน Services ก่อน</p>}
      {groups.map(({ setId, itemIds }, groupIndex) => <div key={setId} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
        <div style={rowStyle}>
          <strong>{byId.get(setId).name}</strong>
          <MoveButtons index={groupIndex} count={groups.length} name={byId.get(setId).name}
            onMove={to => change(move(groups, groupIndex, to))} />
        </div>
        <ol style={{ margin: '8px 0' }}>
          {itemIds.map((id, itemIndex) => <li key={id} style={{ marginBottom: 6 }}>
            <div style={rowStyle}>
              <span>{byId.get(id).name}</span>
              <MoveButtons index={itemIndex} count={itemIds.length} name={byId.get(id).name}
                onMove={to => updateItems(groupIndex, move(itemIds, itemIndex, to))} />
              <button type="button" className="btn" onClick={() => updateItems(groupIndex, itemIds.filter(item => item !== id))}>เอาออกจากเซต</button>
            </div>
          </li>)}
        </ol>
        <select className="input" style={{ maxWidth: 360 }} value="" aria-label={'เพิ่มเมนูใน ' + byId.get(setId).name}
          onChange={event => updateItems(groupIndex, [...itemIds, event.target.value])}>
          <option value="" disabled>เพิ่มเมนูในเซต…</option>
          {items.filter(item => !itemIds.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>)}
      {groups.length > 0 && <button type="button" className="btn btn-primary" onClick={save}>บันทึกลำดับ</button>}
    </fieldset>}
  </section>
}
