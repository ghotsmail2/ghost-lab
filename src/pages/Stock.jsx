import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Stock() {
  const { staff } = useAuth()
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const stockChangeKey = `ghostlab-stock-adjust:${staff?.id || 'guest'}`
  const [changes, setChanges] = useState(() => readStockChanges())
  const [savingChanges, setSavingChanges] = useState(false)
  const [saveError, setSaveError] = useState('')

  function readStockChanges() {
    try { return JSON.parse(localStorage.getItem(stockChangeKey) || 'null') || {} } catch { return {} }
  }

  useEffect(() => {
    try {
      if (Object.keys(changes).length) localStorage.setItem(stockChangeKey, JSON.stringify(changes))
      else localStorage.removeItem(stockChangeKey)
    } catch {}
  }, [changes, stockChangeKey])

  useEffect(() => {
    supabase.from('branches').select('*').then(({ data }) => setBranches(data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    supabase.from('stock_items').select('*, branches:branch_id(key,name)').order('category').order('name')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setItems(data || [])
        setLoading(false)
      })
  }, [refreshKey])

  const filtered = branchFilter === 'all' ? items : items.filter(i => i.branches?.key === branchFilter)
  const grouped = filtered.reduce((acc, i) => {
    (acc[i.category] = acc[i.category] || []).push(i)
    return acc
  }, {})
  const pendingChanges = Object.entries(changes)
    .map(([id, amount]) => ({ item: items.find(item => item.id === id), amount: Number(amount) }))
    .filter(({ item, amount }) => item && amount)

  function setItemChange(itemId, amount) {
    setSaveError('')
    setChanges(current => ({ ...current, [itemId]: Number(amount) || 0 }))
  }

  async function saveAllChanges() {
    if (!pendingChanges.length || savingChanges) return
    setSavingChanges(true)
    setSaveError('')
    try {
      for (const { item, amount } of pendingChanges) {
        const { error: updateError } = await supabase.from('stock_items').update({
          quantity: item.quantity + amount, updated_by: staff?.id, updated_at: new Date().toISOString(),
        }).eq('id', item.id)
        if (updateError) throw updateError

        const { error: movementError } = await supabase.from('stock_movements').insert({
          stock_item_id: item.id, staff_id: staff?.id, change: amount,
          reason: amount > 0 ? 'ปรับเพิ่มจากหน้าสต๊อก' : 'ปรับลดจากหน้าสต๊อก',
        })
        if (movementError) throw movementError
      }
      setChanges({})
      setRefreshKey(key => key + 1)
    } catch (error) {
      console.error(error)
      setSaveError(error.message || 'บันทึกการปรับสต๊อกไม่สำเร็จ')
    } finally {
      setSavingChanges(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600 }}>สต๊อก & เบิกจ่าย</div>
          <div style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>จัดการสต็อกวัตถุดิบและสินค้า</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={saveAllChanges} disabled={!pendingChanges.length || savingChanges} className="btn" style={{ background: pendingChanges.length ? 'rgba(63,185,80,.12)' : 'rgba(255,255,255,.02)', borderColor: pendingChanges.length ? '#3FB950' : 'var(--line)', color: pendingChanges.length ? '#84d6a8' : 'var(--ghost-gray)', opacity: savingChanges ? .6 : 1 }}>
            {savingChanges ? 'กำลังบันทึก…' : `✓ บันทึกการปรับสต๊อก${pendingChanges.length ? ` (${pendingChanges.length})` : ''}`}
          </button>
          <button type="button" onClick={() => setShowAdd(true)} className="btn btn-primary">+ เพิ่มวัตถุดิบ</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[['all', 'ทุกสาขา'], ...branches.map(b => [b.key, b.name])].map(([key, label]) => (
          <div key={key} onClick={() => setBranchFilter(key)} className="btn" style={{
            fontSize: 12,
            borderColor: branchFilter === key ? 'var(--blood)' : 'var(--line)',
            color: branchFilter === key ? 'var(--bone)' : 'var(--ghost-gray)',
            background: branchFilter === key ? 'rgba(196,30,42,0.14)' : 'rgba(255,255,255,0.02)',
          }}>
            {label}
          </div>
        ))}
      </div>
      {saveError && <div style={{ background: 'rgba(196,30,42,.12)', border: '1px solid var(--blood)', borderRadius: 6, color: '#f18b92', fontSize: 12, marginBottom: 14, padding: '10px 12px' }}>⚠ {saveError}</div>}

      {loading ? <div style={{ color: 'var(--ghost-gray)', fontSize: 12 }}>กำลังโหลด...</div> : (
        Object.keys(grouped).length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ghost-gray)', fontSize: 12 }}>
            ยังไม่มีวัตถุดิบ — กด "+ เพิ่มวัตถุดิบ" เพื่อเริ่มเพิ่ม
          </div>
        ) : Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} className="panel" style={{ marginBottom: 16 }}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{category}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr .65fr 1.45fr .65fr', gap: 10, padding: '0 0 8px', fontSize: 10, color: 'var(--ghost-gray)', textTransform: 'uppercase', letterSpacing: 1 }}>
              <div>รายการ</div><div>สาขา</div><div>คงเหลือ</div><div>ปรับจำนวน</div><div>หน่วย</div>
            </div>
            {catItems.map(item => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr .65fr 1.45fr .65fr', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>{item.branches?.name || '—'}</div>
                <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: item.quantity + Number(changes[item.id] || 0) > 0 ? '#3FB950' : 'var(--blood)' }}>
                  {item.quantity}{Number(changes[item.id] || 0) ? <small style={{ color: Number(changes[item.id]) > 0 ? '#84d6a8' : '#f18b92', fontSize: 10, marginLeft: 5 }}>{Number(changes[item.id]) > 0 ? '+' : ''}{changes[item.id]}</small> : null}
                </div>
                <StockQuantityControl item={item} change={changes[item.id] || 0} onChange={setItemChange} />
                <div style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>{item.unit || 'ชิ้น'}</div>
              </div>
            ))}
          </div>
        ))
      )}

      {showAdd && (
        <AddStockModal
          branches={branches}
          staff={staff}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

function StockQuantityControl({ item, change, onChange }) {
  function nudge(amount) { onChange(item.id, Number(change || 0) + amount) }

  return <div style={{ alignItems: 'center', display: 'flex', gap: 5 }}>
    <button type="button" onClick={() => nudge(-1)} aria-label={`ลด ${item.name}`} style={stepButtonStyle}>−</button>
    <input className="input font-mono" type="number" value={change || ''} onChange={event => onChange(item.id, event.target.value === '' ? 0 : Number(event.target.value))} placeholder="0" style={{ minWidth: 0, padding: '7px 6px', textAlign: 'center', width: 62 }} />
    <button type="button" onClick={() => nudge(1)} aria-label={`เพิ่ม ${item.name}`} style={stepButtonStyle}>+</button>
  </div>
}

const stepButtonStyle = { background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--bone)', cursor: 'pointer', fontSize: 15, height: 30, lineHeight: 1, width: 30 }

function AdjustModal({ item, staff, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const change = parseInt(amount)
    if (!change) return
    setSaving(true)
    const newQty = item.quantity + change
    const { error: updateErr } = await supabase.from('stock_items')
      .update({ quantity: newQty, updated_by: staff?.id, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (updateErr) { console.error(updateErr); setSaving(false); return }
    const { error: moveErr } = await supabase.from('stock_movements').insert({
      stock_item_id: item.id, staff_id: staff?.id, change, reason: reason || null,
    })
    if (moveErr) console.error(moveErr)
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 380, background: 'var(--static)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>ปรับสต็อก · {item.name}</div>
          <div onClick={onClose} style={{ cursor: 'pointer', color: 'var(--ghost-gray)', fontSize: 18 }}>✕</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ghost-gray)', marginBottom: 10 }}>คงเหลือปัจจุบัน: {item.quantity} {item.unit}</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>จำนวนที่ปรับ (+ รับเข้า / - เบิกออก)</label>
          <input className="input" type="number" placeholder="เช่น 10 หรือ -5" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>หมายเหตุ (optional)</label>
          <input className="input" value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <div onClick={onClose} className="btn btn-secondary">ยกเลิก</div>
          <div onClick={save} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</div>
        </div>
      </div>
    </div>
  )
}

function AddStockModal({ branches, staff, onClose, onSaved }) {
  const draftKey = `ghostlab-stock-add:${staff?.id || 'guest'}`
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey) || 'null') || {} } catch { return {} } }
  const draft = readDraft()
  const [name, setName] = useState(draft.name || '')
  const [category, setCategory] = useState(draft.category || 'วัตถุดิบ')
  const [unit, setUnit] = useState(draft.unit || 'ชิ้น')
  const [quantity, setQuantity] = useState(draft.quantity ?? '0')
  const [branchId, setBranchId] = useState(draft.branchId || branches[0]?.id || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ name, category, unit, quantity, branchId })) } catch {}
  }, [draftKey, name, category, unit, quantity, branchId])

  function clearDraft() {
    try { localStorage.removeItem(draftKey) } catch {}
  }

  function closeAndClearDraft() {
    clearDraft()
    onClose()
  }

  async function save() {
    if (!name.trim() || !branchId) return
    setSaving(true)
    const { error } = await supabase.from('stock_items').insert({
      branch_id: branchId, category, name: name.trim(), unit, quantity: parseInt(quantity) || 0,
    })
    setSaving(false)
    if (error) { console.error(error); return }
    clearDraft()
    onSaved()
  }

  return (
    <div onMouseDown={event => event.target === event.currentTarget && closeAndClearDraft()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 420, background: 'var(--static)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>เพิ่มวัตถุดิบ</div>
          <div onClick={closeAndClearDraft} style={{ cursor: 'pointer', color: 'var(--ghost-gray)', fontSize: 18 }}>✕</div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>ชื่อ</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>หมวดหมู่</label>
            <input className="input" value={category} onChange={e => setCategory(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>หน่วย</label>
            <input className="input" value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>จำนวนเริ่มต้น</label>
            <input className="input" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>สาขา</label>
            <select className="input" value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <div onClick={closeAndClearDraft} className="btn btn-secondary">ยกเลิก</div>
          <div onClick={save} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังเพิ่ม...' : 'เพิ่ม'}</div>
        </div>
      </div>
    </div>
  )
}
