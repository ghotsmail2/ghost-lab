import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Boxes, ChevronRight, ClipboardCheck, Coins, ListFilter, Minus, PackageOpen, PackageX, Plus, Search, Trash2, TriangleAlert, X } from 'lucide-react'
import './Stock.css'

export default function Stock() {
  const { staff } = useAuth()
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const stockChangeKey = `ghostlab-stock-adjust:${staff?.id || 'guest'}`
  const stockRequestKey = `ghostlab-stock-adjust-request:${staff?.id || 'guest'}`
  const [changes, setChanges] = useState(() => readStockChanges())
  const [pendingRequest, setPendingRequest] = useState(() => readStockRequest())
  const [savingChanges, setSavingChanges] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingItemId, setDeletingItemId] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [movements, setMovements] = useState([])

  function readStockChanges() {
    try { return JSON.parse(localStorage.getItem(stockChangeKey) || 'null') || {} } catch { return {} }
  }

  function readStockRequest() {
    try { return JSON.parse(localStorage.getItem(stockRequestKey) || 'null') } catch { return null }
  }

  useEffect(() => {
    try {
      if (Object.keys(changes).length) localStorage.setItem(stockChangeKey, JSON.stringify(changes))
      else localStorage.removeItem(stockChangeKey)
    } catch {}
  }, [changes, stockChangeKey])

  useEffect(() => {
    try {
      if (pendingRequest) localStorage.setItem(stockRequestKey, JSON.stringify(pendingRequest))
      else localStorage.removeItem(stockRequestKey)
    } catch {}
  }, [pendingRequest, stockRequestKey])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    supabase.rpc('get_stock_workspace_for_current_staff').then(({ data, error }) => {
      if (!active) return
      if (error) throw error
      setItems(data?.items || [])
      setMovements(data?.movements || [])
      setBranches(data?.branches || [])
    }).catch(error => {
      if (!active) return
      console.error('Unable to load stock:', error)
      setLoadError(error.message || 'โหลดข้อมูลสต็อกไม่สำเร็จ')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
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
    if (pendingRequest || savingChanges) return
    setSaveError('')
    setChanges(current => ({ ...current, [itemId]: Number(amount) || 0 }))
  }

  async function saveAllChanges() {
    if ((!pendingChanges.length && !pendingRequest) || savingChanges) return
    setSavingChanges(true)
    setSaveError('')
    try {
      const request = pendingRequest || {
        requestId: globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
          const random = Math.random() * 16 | 0
          return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16)
        }),
        adjustments: pendingChanges
          .map(({ item, amount }) => ({ item_id: item.id, amount }))
          .sort((a, b) => a.item_id.localeCompare(b.item_id)),
      }
      if (!pendingRequest) {
        try { localStorage.setItem(stockRequestKey, JSON.stringify(request)) }
        catch { throw new Error('บันทึกคำขอสำรองในเบราว์เซอร์ไม่ได้ กรุณาเปิดพื้นที่จัดเก็บข้อมูลแล้วลองใหม่') }
        setPendingRequest(request)
      }
      const { error } = await supabase.rpc('adjust_stock_items_atomic', {
        p_request_id: request.requestId,
        p_adjustments: request.adjustments,
      })
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') {
          throw new Error('ฐานข้อมูลยังไม่รองรับการบันทึกสต็อกแบบปลอดภัย กรุณาแจ้งผู้ดูแลให้อัปเดตฐานข้อมูลก่อน แล้วลองบันทึกอีกครั้ง')
        }
        throw error
      }
      setPendingRequest(null)
      setChanges({})
      setRefreshKey(key => key + 1)
    } catch (error) {
      console.error(error)
      setSaveError(error.message || 'บันทึกการปรับสต๊อกไม่สำเร็จ')
    } finally {
      setSavingChanges(false)
    }
  }

  async function deleteUnusedItem(item) {
    if (!['owner', 'god'].includes(staff?.role)) return
    if (Number(item.quantity || 0) !== 0) {
      setSaveError('ลบไม่ได้: ต้องปรับยอดคงเหลือให้เป็น 0 ก่อน')
      return
    }
    if (pendingRequest || savingChanges || changes[item.id]) {
      setSaveError('บันทึกหรือยกเลิกการปรับสต็อกที่ค้างอยู่ก่อนลบรายการนี้')
      return
    }
    if (!window.confirm(`ลบวัตถุดิบ “${item.name}” ออกจากสาขา ${item.branches?.name || ''} ใช่ไหม?\n\nระบบจะลบได้เฉพาะรายการที่ไม่เคยถูกใช้ในสูตรหรือประวัติสต็อกเท่านั้น`)) return
    setDeletingItemId(item.id)
    setSaveError('')
    try {
      const { error } = await supabase.rpc('delete_unused_stock_item', { p_stock_item_id: item.id })
      if (error) throw error
      setRefreshKey(key => key + 1)
    } catch (error) {
      console.error('Unable to delete unused stock item:', error)
      setSaveError(error.message || 'ลบวัตถุดิบไม่สำเร็จ')
    } finally {
      setDeletingItemId(null)
    }
  }

  return (
    <main className="stock-page">
      <section className="stock-heading panel"><MetricIcon className="stock-heading__icon" icon={PackageOpen} tone="orange" size={25} /><div className="stock-heading__title"><span>OPERATIONS WORKSPACE</span><h1>สต็อก & เบิกจ่าย</h1><p>Stock & Prepay Management</p></div><div className="stock-heading__actions"><button type="button" className="btn" onClick={saveAllChanges} disabled={(!pendingChanges.length && !pendingRequest) || savingChanges}>{savingChanges ? 'กำลังบันทึก…' : <><ClipboardCheck size={16} strokeWidth={2} /> {pendingRequest ? 'ตรวจสอบ / ลองบันทึกซ้ำ' : 'บันทึกการปรับสต็อก'}{pendingChanges.length ? ` (${pendingChanges.length})` : ''}</>}</button><button type="button" onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={17} strokeWidth={2} /> เพิ่มวัตถุดิบ</button></div></section>
      {loadError && <div className="stock-error" role="alert"><TriangleAlert size={16} strokeWidth={2} /> <span>{loadError}</span><button type="button" className="btn btn-secondary" onClick={() => setRefreshKey(key => key + 1)}>ลองโหลดอีกครั้ง</button></div>}
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
            <div className="stock-table-scroll"><table className="stock-table"><thead><tr><th>รายการ</th><th>สาขา</th><th>คงเหลือ</th><th>ขั้นต่ำ</th><th>สถานะ</th><th>ปรับจำนวน</th><th>หน่วย</th><th>อัปเดตล่าสุด</th>{['owner', 'god'].includes(staff?.role) && <th>ลบ</th>}</tr></thead><tbody>
              {loading ? <tr><td colSpan={['owner', 'god'].includes(staff?.role) ? 9 : 8} className="stock-empty">กำลังโหลดสต็อก…</td></tr> : filtered.length === 0 ? <tr><td colSpan={['owner', 'god'].includes(staff?.role) ? 9 : 8} className="stock-empty">ไม่พบรายการตามตัวกรองนี้</td></tr> : filtered.map(item => { const qty = Number(item.quantity || 0), threshold = Number(item.low_stock_threshold || 0), status = qty <= 0 ? 'out' : qty <= threshold ? 'low' : 'normal'; return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.category || 'ไม่ระบุหมวดหมู่'}</small></td><td><span className={`stock-branch-pill ${item.branches?.key === 'chill' ? 'is-food' : ''}`}>{item.branches?.name || '—'}</span></td><td><strong className={`stock-qty ${qty <= 0 ? 'is-negative' : status === 'low' ? 'is-low' : ''}`}>{qty.toLocaleString()}</strong></td><td>{threshold.toLocaleString()}</td><td><span className={`stock-status is-${status}`}>{status === 'normal' ? 'ปกติ' : status === 'low' ? 'ใกล้หมด' : 'หมด'}</span></td><td><StockQuantityControl item={item} change={changes[item.id] || 0} onChange={setItemChange} disabled={Boolean(pendingRequest || savingChanges || deletingItemId)} /></td><td>{item.unit || 'ชิ้น'}</td><td>{item.updated_at ? <><span>{new Date(item.updated_at).toLocaleDateString('th-TH')}</span><small>{new Date(item.updated_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</small></> : '—'}</td>{['owner', 'god'].includes(staff?.role) && <td><button type="button" disabled={deletingItemId !== null || Boolean(pendingRequest || savingChanges || changes[item.id]) || qty !== 0} onClick={() => deleteUnusedItem(item)} title={qty !== 0 ? 'ลบได้เมื่อยอดคงเหลือเป็น 0' : 'ลบวัตถุดิบที่ยังไม่เคยใช้งาน'} aria-label={`ลบวัตถุดิบ ${item.name}`} className="stock-delete-button">{deletingItemId === item.id ? '…' : <Trash2 size={15} />}</button></td>}</tr> })}
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

function StockQuantityControl({ item, change, onChange, disabled = false }) {
  function nudge(amount) { onChange(item.id, Number(change || 0) + amount) }

  return <div style={{ alignItems: 'center', display: 'flex', gap: 5 }}>
    <button type="button" disabled={disabled} onClick={() => nudge(-1)} aria-label={`ลด ${item.name}`} style={stepButtonStyle}><Minus size={14} strokeWidth={2} /></button>
    <input className="input font-mono" type="number" disabled={disabled} value={change || ''} onChange={event => onChange(item.id, event.target.value === '' ? 0 : Number(event.target.value))} placeholder="0" style={{ minWidth: 0, padding: '7px 6px', textAlign: 'center', width: 62 }} />
    <button type="button" disabled={disabled} onClick={() => nudge(1)} aria-label={`เพิ่ม ${item.name}`} style={stepButtonStyle}><Plus size={14} strokeWidth={2} /></button>
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
  const requestKey = 'ghostlab-stock-adjust-single:' + (staff?.id || 'guest') + ':' + item.id
  const [pendingRequest, setPendingRequest] = useState(() => {
    try { return JSON.parse(localStorage.getItem(requestKey) || 'null') } catch { return null }
  })
  const [amount, setAmount] = useState(() => pendingRequest?.adjustments?.[0]?.amount?.toString() || '')
  const [reason, setReason] = useState(() => pendingRequest?.adjustments?.[0]?.reason || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (saving) return
    const change = Number(amount)
    if (!Number.isSafeInteger(change) || change === 0) {
      setError('กรุณาระบุจำนวนเต็มที่ไม่ใช่ 0')
      return
    }
    const request = pendingRequest || {
      requestId: globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
        const random = Math.random() * 16 | 0
        return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16)
      }),
      adjustments: [{ item_id: item.id, amount: change, reason: reason.trim() || null }],
    }
    if (pendingRequest && (pendingRequest.adjustments?.[0]?.amount !== change || (pendingRequest.adjustments?.[0]?.reason || null) !== (reason.trim() || null))) {
      setError('คำขอเดิมยังยืนยันผลไม่ได้ กรุณาส่งคำขอเดิมซ้ำก่อนแก้ไข')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (!pendingRequest) {
        try { localStorage.setItem(requestKey, JSON.stringify(request)) }
        catch { throw new Error('บันทึกคำขอสำรองไม่ได้ จึงยังไม่ส่งการปรับสต็อก') }
        setPendingRequest(request)
      }
      const { error: rpcError } = await supabase.rpc('adjust_stock_items_atomic', {
        p_request_id: request.requestId,
        p_adjustments: request.adjustments,
      })
      if (rpcError) {
        if (rpcError.code === 'PGRST202' || rpcError.code === '42883') {
          throw new Error('ฐานข้อมูลยังไม่รองรับการปรับสต็อกแบบปลอดภัย กรุณาอัปเดตฐานข้อมูลก่อน')
        }
        throw rpcError
      }
      localStorage.removeItem(requestKey)
      onSaved()
    } catch (saveError) {
      console.error(saveError)
      setError(saveError.message || 'ปรับสต็อกไม่สำเร็จ หากไม่แน่ใจว่ารายการบันทึกแล้วหรือยัง ให้ส่งคำขอเดิมซ้ำ')
    } finally {
      setSaving(false)
    }
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
          <input className="input" maxLength={500} disabled={Boolean(pendingRequest)} value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        {error && <div role="alert" className="stock-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" disabled={saving} onClick={onClose} className="btn btn-secondary">ปิด</button>
          <button type="button" disabled={saving} onClick={save} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังบันทึก…' : pendingRequest ? 'ตรวจสอบ / ส่งคำขอเดิมซ้ำ' : 'บันทึก'}</button>
        </div>
      </div>
    </div>
  )
}

function AddStockModal({ branches, staff, onClose, onSaved }) {
  const draftKey = `ghostlab-stock-add:${staff?.id || 'guest'}`
  const requestKey = 'ghostlab-stock-add-request:' + (staff?.id || 'guest')
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey) || 'null') || {} } catch { return {} } }
  const draft = readDraft()
  const [pendingRequest, setPendingRequest] = useState(() => {
    try { return JSON.parse(localStorage.getItem(requestKey) || 'null') } catch { return null }
  })
  const [name, setName] = useState(pendingRequest?.item?.name || draft.name || '')
  const [category, setCategory] = useState(pendingRequest?.item?.category || draft.category || 'วัตถุดิบ')
  const [unit, setUnit] = useState(pendingRequest?.item?.unit || draft.unit || 'ชิ้น')
  const [quantity, setQuantity] = useState(pendingRequest?.item?.quantity?.toString() ?? draft.quantity ?? '0')
  const [branchId, setBranchId] = useState(pendingRequest?.item?.branch_id || draft.branchId || branches[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (pendingRequest) return
    try { localStorage.setItem(draftKey, JSON.stringify({ name, category, unit, quantity, branchId })) } catch {}
  }, [draftKey, name, category, unit, quantity, branchId, pendingRequest])

  function clearDraft() {
    try { localStorage.removeItem(draftKey) } catch {}
  }

  function closeAndClearDraft() {
    clearDraft()
    onClose()
  }

  async function save() {
    if (saving) return
    const startingQuantity = Number(quantity)
    if (!name.trim() || !branchId || !Number.isSafeInteger(startingQuantity) || startingQuantity < 0) {
      setError('กรุณาตรวจชื่อ สาขา และจำนวนตั้งต้นให้ถูกต้อง')
      return
    }
    const request = pendingRequest || {
      requestId: globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
        const random = Math.random() * 16 | 0
        return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16)
      }),
      item: { branch_id: branchId, category: category.trim(), name: name.trim(), unit: unit.trim() || null, quantity: startingQuantity },
    }
    if (pendingRequest && JSON.stringify(request.item) !== JSON.stringify({
      branch_id: branchId, category: category.trim(), name: name.trim(), unit: unit.trim() || null, quantity: startingQuantity,
    })) {
      setError('คำขอเดิมยังยืนยันผลไม่ได้ กรุณาส่งคำขอเดิมซ้ำก่อนแก้ไข')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (!pendingRequest) {
        try { localStorage.setItem(requestKey, JSON.stringify(request)) }
        catch { throw new Error('บันทึกคำขอสำรองไม่ได้ จึงยังไม่ส่งการเพิ่มวัตถุดิบ') }
        setPendingRequest(request)
      }
      const { error: rpcError } = await supabase.rpc('create_stock_item_atomic', {
        p_request_id: request.requestId,
        p_item: request.item,
      })
      if (rpcError) {
        if (rpcError.code === 'PGRST202' || rpcError.code === '42883') {
          throw new Error('ฐานข้อมูลยังไม่รองรับการเพิ่มวัตถุดิบแบบปลอดภัย กรุณาอัปเดตฐานข้อมูลก่อน')
        }
        throw rpcError
      }
      localStorage.removeItem(requestKey)
      clearDraft()
      onSaved()
    } catch (saveError) {
      console.error(saveError)
      setError(saveError.message || 'เพิ่มวัตถุดิบไม่สำเร็จ หากไม่แน่ใจว่าบันทึกแล้วหรือยัง ให้ส่งคำขอเดิมซ้ำ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onMouseDown={event => event.target === event.currentTarget && closeAndClearDraft()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 420, background: 'var(--static)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>เพิ่มวัตถุดิบ</div>
          <button type="button" aria-label="ปิด" onClick={pendingRequest ? onClose : closeAndClearDraft} className="stock-modal-close"><X size={18} /></button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>ชื่อ</label>
          <input className="input" maxLength={120} disabled={Boolean(pendingRequest)} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>หมวดหมู่</label>
            <input className="input" maxLength={80} disabled={Boolean(pendingRequest)} value={category} onChange={e => setCategory(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>หน่วย</label>
            <input className="input" maxLength={40} disabled={Boolean(pendingRequest)} value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>จำนวนเริ่มต้น</label>
            <input className="input" type="number" min={0} disabled={Boolean(pendingRequest)} value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>สาขา</label>
            <select className="input" disabled={Boolean(pendingRequest)} value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        {error && <div role="alert" className="stock-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" disabled={saving} onClick={pendingRequest ? onClose : closeAndClearDraft} className="btn btn-secondary">{pendingRequest ? 'ปิด' : 'ยกเลิก'}</button>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังบันทึก…' : pendingRequest ? 'ตรวจสอบ / ส่งคำขอเดิมซ้ำ' : 'เพิ่ม'}</button>
        </div>
      </div>
    </div>
  )
}
