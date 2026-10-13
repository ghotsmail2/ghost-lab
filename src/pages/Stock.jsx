import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Boxes, ChevronRight, ClipboardCheck, Coins, ListFilter, Minus, PackageOpen, PackageX, Plus, Search, TriangleAlert, X } from 'lucide-react'
import './Stock.css'

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [movements, setMovements] = useState([])

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
    Promise.all([
      supabase.from('stock_items').select('*, branches:branch_id(key,name)').order('category').order('name'),
      supabase.from('stock_movements').select('id,stock_item_id,staff_id,change,reason,created_at,staff:staff_id(name_en)').order('created_at', { ascending: false }).limit(30),
    ]).then(([{ data, error }, { data: movementData }]) => {
        if (error) console.error(error)
        setItems(data || [])
        setMovements(movementData || [])
        setLoading(false)
      })
  }, [refreshKey])

  const filtered = items.filter(item => {
    const branchMatch = branchFilter === 'all' || item.branches?.key === branchFilter
    const q = search.trim().toLocaleLowerCase()
    const searchMatch = !q || `${item.name} ${item.category} ${item.branches?.name || ''}`.toLocaleLowerCase().includes(q)
    const qty = Number(item.quantity || 0), threshold = Number(item.low_stock_threshold || 0)
    const statusMatch = statusFilter === 'all' || (statusFilter === 'normal' && qty > threshold) || (statusFilter === 'low' && qty > 0 && qty <= threshold) || (statusFilter === 'out' && qty <= 0)
    return branchMatch && searchMatch && statusMatch
  })
  const lowItems = items.filter(item => Number(item.quantity || 0) > 0 && Number(item.quantity || 0) <= Number(item.low_stock_threshold || 0))
  const outItems = items.filter(item => Number(item.quantity || 0) <= 0)
  const itemById = Object.fromEntries(items.map(item => [item.id, item]))
  const visibleMovements = movements.filter(move => {
    const item = itemById[move.stock_item_id]
    return item && (branchFilter === 'all' || item.branches?.key === branchFilter)
  }).slice(0, 8)
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
    <main className="stock-page">
      <section className="stock-heading panel"><MetricIcon className="stock-heading__icon" icon={PackageOpen} tone="orange" size={25} /><div className="stock-heading__title"><span>OPERATIONS WORKSPACE</span><h1>สต็อก & เบิกจ่าย</h1><p>Stock & Prepay Management</p></div><div className="stock-heading__actions"><button type="button" className="btn" onClick={saveAllChanges} disabled={!pendingChanges.length || savingChanges}>{savingChanges ? 'กำลังบันทึก…' : <><ClipboardCheck size={16} strokeWidth={2} /> บันทึกการปรับสต็อก{pendingChanges.length ? ` (${pendingChanges.length})` : ''}</>}</button><button type="button" onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={17} strokeWidth={2} /> เพิ่มวัตถุดิบ</button></div></section>
      {saveError && <div className="stock-error"><TriangleAlert size={16} strokeWidth={2} /> {saveError}</div>}
      <section className="stock-kpis">
        <StockMetric icon={Boxes} tone="blue" label="จำนวนวัตถุดิบทั้งหมด (SKUs)" value={items.length.toLocaleString()} supporting="รายการในระบบ" />
        <StockMetric icon={TriangleAlert} tone="amber" label="รายการใกล้หมด" value={lowItems.length.toLocaleString()} supporting="ต่ำกว่าระดับขั้นต่ำ" />
        <StockMetric icon={PackageX} tone="red" label="รายการหมด / ติดลบ" value={outItems.length.toLocaleString()} supporting="ควรตรวจสอบหรือเติมสต๊อก" />
        <StockMetric icon={Coins} tone="green" label="มูลค่าสต๊อก" value="—" supporting="ยังไม่มีต้นทุนต่อหน่วยในระบบ" />
      </section>
      <div className="stock-branch-filter">{[['all', 'ทุกสาขา'], ...branches.map(b => [b.key, b.name])].map(([key, label]) => <button type="button" key={key} className={branchFilter === key ? 'is-active' : ''} onClick={() => setBranchFilter(key)}>{label}</button>)}</div>
      <div className="stock-layout">
        <section className="stock-main">
          <div className="stock-toolbar panel"><label className="stock-search"><Search size={17} strokeWidth={2} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาวัตถุดิบ เช่น ปลา Steel, Rice" /></label><div className="stock-status-filter"><span className="stock-filter-label"><ListFilter size={15} strokeWidth={2} /> ตัวกรอง</span>{[['all','ทั้งหมด'],['normal','ปกติ'],['low','ใกล้หมด'],['out','หมด']].map(([key,label]) => <button type="button" key={key} className={statusFilter === key ? 'is-active' : ''} onClick={() => setStatusFilter(key)}>{label}</button>)}</div></div>
          <section className="stock-table-panel panel"><div className="stock-table-title"><div><h2>วัตถุดิบ / รายการ</h2><p>{filtered.length} รายการ · ปรับจำนวนได้จากตารางและบันทึกพร้อมกัน</p></div><span>{pendingChanges.length ? `${pendingChanges.length} รายการรอบันทึก` : 'LIVE STOCK'}</span></div>
            <div className="stock-table-scroll"><table className="stock-table"><thead><tr><th>รายการ</th><th>สาขา</th><th>คงเหลือ</th><th>ขั้นต่ำ</th><th>สถานะ</th><th>ปรับจำนวน</th><th>หน่วย</th><th>อัปเดตล่าสุด</th></tr></thead><tbody>
              {loading ? <tr><td colSpan="8" className="stock-empty">กำลังโหลดสต็อก…</td></tr> : filtered.length === 0 ? <tr><td colSpan="8" className="stock-empty">ไม่พบรายการตามตัวกรองนี้</td></tr> : filtered.map(item => { const qty = Number(item.quantity || 0), threshold = Number(item.low_stock_threshold || 0), status = qty <= 0 ? 'out' : qty <= threshold ? 'low' : 'normal'; return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.category || 'ไม่ระบุหมวดหมู่'}</small></td><td><span className={`stock-branch-pill ${item.branches?.key === 'chill' ? 'is-food' : ''}`}>{item.branches?.name || '—'}</span></td><td><strong className={`stock-qty ${qty <= 0 ? 'is-negative' : status === 'low' ? 'is-low' : ''}`}>{qty.toLocaleString()}</strong></td><td>{threshold.toLocaleString()}</td><td><span className={`stock-status is-${status}`}>{status === 'normal' ? 'ปกติ' : status === 'low' ? 'ใกล้หมด' : 'หมด'}</span></td><td><StockQuantityControl item={item} change={changes[item.id] || 0} onChange={setItemChange} /></td><td>{item.unit || 'ชิ้น'}</td><td>{item.updated_at ? <><span>{new Date(item.updated_at).toLocaleDateString('th-TH')}</span><small>{new Date(item.updated_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</small></> : '—'}</td></tr> })}
            </tbody></table></div>
          </section>
        </section>
        <aside className="stock-aside">
          <section className="stock-side-panel panel"><div className="stock-side-title"><span className="is-alert"><TriangleAlert size={18} strokeWidth={2} /></span><div><h2>แจ้งเตือนสต็อก</h2><small>รายการใกล้หมดและหมด</small></div><b>{lowItems.length + outItems.length}</b></div><div className="stock-alert-list">{[...outItems, ...lowItems].filter(item => branchFilter === 'all' || item.branches?.key === branchFilter).slice(0, 8).map(item => <button type="button" className="stock-alert-row" key={item.id} onClick={() => {setBranchFilter(item.branches?.key || 'all');setSearch(item.name);setStatusFilter('all')}}><span className="stock-alert-symbol">{item.quantity <= 0 ? <PackageX size={16} /> : <TriangleAlert size={16} />}</span><span><strong>{item.name}</strong><small>{item.branches?.name || '—'} · คงเหลือ {item.quantity} / ขั้นต่ำ {item.low_stock_threshold || 0} {item.unit}</small></span><i className={item.quantity <= 0 ? 'is-out' : ''}>{item.quantity <= 0 ? 'หมด' : 'ใกล้หมด'}</i><ChevronRight size={16} /></button>)}{lowItems.length + outItems.length === 0 && <div className="stock-side-empty">สต็อกทุกอย่างอยู่ในระดับปกติ</div>}</div></section>
          <section className="stock-side-panel panel"><div className="stock-side-title"><span className="is-history"><ClipboardCheck size={18} strokeWidth={2} /></span><div><h2>ประวัติการเคลื่อนไหว</h2><small>รับเข้า · เบิกออก · ปรับสต็อกล่าสุด</small></div><b>ล่าสุด</b></div><div className="stock-activity-list">{visibleMovements.map(move => {const item = itemById[move.stock_item_id];return <div className="stock-activity-row" key={move.id}><span className={`stock-activity-icon ${move.change > 0 ? 'is-in' : 'is-out'}`}>{move.change > 0 ? <Plus size={15} /> : <Minus size={15} />}</span><div><strong>{move.staff?.name_en || item?.name || 'รายการสต็อก'}</strong><small>{move.reason || `${item?.name || 'สต็อก'} · ${move.change > 0 ? 'รับเข้า' : 'เบิกออก'}`}</small></div><b className={move.change > 0 ? 'is-in' : 'is-out'}>{move.change > 0 ? '+' : ''}{move.change}</b><time>{new Date(move.created_at).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit'})}<small>{new Date(move.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</small></time></div>})}{visibleMovements.length === 0 && <div className="stock-side-empty">ยังไม่มีประวัติการเคลื่อนไหว</div>}</div></section>
        </aside>
      </div>

      {showAdd && (
        <AddStockModal
          branches={branches}
          staff={staff}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setRefreshKey(k => k + 1) }}
        />
      )}
    </main>
  )
}

function StockQuantityControl({ item, change, onChange }) {
  function nudge(amount) { onChange(item.id, Number(change || 0) + amount) }

  return <div style={{ alignItems: 'center', display: 'flex', gap: 5 }}>
    <button type="button" onClick={() => nudge(-1)} aria-label={`ลด ${item.name}`} style={stepButtonStyle}><Minus size={14} strokeWidth={2} /></button>
    <input className="input font-mono" type="number" value={change || ''} onChange={event => onChange(item.id, event.target.value === '' ? 0 : Number(event.target.value))} placeholder="0" style={{ minWidth: 0, padding: '7px 6px', textAlign: 'center', width: 62 }} />
    <button type="button" onClick={() => nudge(1)} aria-label={`เพิ่ม ${item.name}`} style={stepButtonStyle}><Plus size={14} strokeWidth={2} /></button>
  </div>
}

function MetricIcon({ icon: Icon, tone = 'blue', size = 24, className = '' }) {
  return <span className={`stock-metric-icon is-${tone} ${className}`} aria-hidden="true"><Icon size={size} strokeWidth={2} /></span>
}

function StockMetric({ icon: Icon, tone, label, value, supporting }) {
  return <article className="stock-kpi"><MetricIcon icon={Icon} tone={tone} size={24} /><div className="stock-kpi__content"><small>{label}</small><strong>{value}</strong><em>{supporting}</em></div></article>
}

const stepButtonStyle = { alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--bone)', cursor: 'pointer', display: 'inline-flex', height: 30, justifyContent: 'center', width: 30 }

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
          <button type="button" aria-label="ปิด" onClick={onClose} className="stock-modal-close"><X size={18} /></button>
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
          <button type="button" aria-label="ปิด" onClick={closeAndClearDraft} className="stock-modal-close"><X size={18} /></button>
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
