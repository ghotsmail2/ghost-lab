import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calculateMemberDiscount, formatDate, getMembershipPlan, nextMonthlyExpiry } from '../lib/membership'

const BILL_NOTE_SNAPSHOT_PREFIX = '[ghost-lab-bill]'
const MEMBER_FREE_REPAIR_SERVICES = new Set(['engine repair kit', 'full repair kit'])
const POS_DRAFT_PREFIX = 'ghostlab-pos-draft:'

function readPosDraft(key) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || 'null')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function makeBillNotes(note, cart) {
  const snapshot = cart.map(service => ({ name_snapshot: service.name, price_snapshot: service.price }))
  return BILL_NOTE_SNAPSHOT_PREFIX + JSON.stringify({ note: note.trim() || null, items: snapshot })
}

function readBillNotes(value) {
  if (!value?.startsWith(BILL_NOTE_SNAPSHOT_PREFIX)) return { note: value || '', items: [] }
  try {
    const parsed = JSON.parse(value.slice(BILL_NOTE_SNAPSHOT_PREFIX.length))
    return { note: parsed.note || '', items: Array.isArray(parsed.items) ? parsed.items : [] }
  } catch {
    return { note: '', items: [] }
  }
}

// Reusable branch page. Pass branchKey="garage" or branchKey="chill".
// Matches the Xkate pattern: one page per branch with 3 tabs —
// New Bill (POS), Bills (history), Services (catalog management).
export default function POSPage({ branchKey, title, leadRole }) {
  const { staff } = useAuth()
  const [branch, setBranch] = useState(null)
  const [tab, setTab] = useState('bill')
  const [billCount, setBillCount] = useState(0)
  const [serviceCount, setServiceCount] = useState(0)

  // Only the owner can change services or their material recipes. Staff still
  // use the POS normally, but cannot alter what a sale consumes from stock.
  const canManage = staff?.role === 'owner' || staff?.role === 'god'

  useEffect(() => {
    supabase.from('branches').select('*').eq('key', branchKey).single()
      .then(({ data, error }) => {
        if (error) console.error('[Ghost Lab] Failed to load branch:', error)
        setBranch(data)
      })
  }, [branchKey])

  useEffect(() => {
    if (!branch) return
    supabase.from('bills').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id)
      .then(({ count }) => setBillCount(count || 0))
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id).eq('active', true)
      .then(({ count }) => setServiceCount(count || 0))
  }, [branch, tab])

  if (!branch) return <div style={{ color: 'var(--ghost-gray)' }}>กำลังโหลด...</div>

  return (
    <div>
      <div className="panel" style={{
        background: 'linear-gradient(120deg, rgba(196,30,42,0.14), transparent 60%), var(--static)',
        padding: '20px 24px', marginBottom: 18, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div className="font-display" style={{ fontSize: 20, fontWeight: 600 }}>{branch.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ghost-gray)', marginTop: 2 }}>
            SERVICE BILL · COMMISSION ¥{branch.commission_flat.toLocaleString()} / BILL · {serviceCount} SERVICES
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabButton active={tab === 'bill'} onClick={() => setTab('bill')}>New Bill</TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>Bills ({billCount})</TabButton>
          {canManage && (
            <TabButton active={tab === 'services'} onClick={() => setTab('services')}>Services ({serviceCount})</TabButton>
          )}
        </div>
      </div>

      {tab === 'bill' && <NewBillTab branch={branch} title={title} staff={staff} />}
      {tab === 'history' && <BillsHistoryTab branch={branch} staff={staff} onBillDeleted={() => setBillCount(count => Math.max(0, count - 1))} />}
      {tab === 'services' && canManage && <ServicesTab branch={branch} />}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <div
      onClick={onClick}
      className="btn"
      style={{
        fontSize: 12,
        background: active ? 'var(--bone)' : 'rgba(255,255,255,0.03)',
        color: active ? 'var(--void)' : 'var(--ghost-gray)',
        borderColor: active ? 'var(--bone)' : 'var(--line)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </div>
  )
}

// ---------------- New Bill (POS) ----------------
function NewBillTab({ branch, title, staff }) {
  const draftStorageKey = `${POS_DRAFT_PREFIX}${branch.key}:${staff?.id || 'guest'}`
  const initialDraft = readPosDraft(draftStorageKey)
  const [services, setServices] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [serviceSearch, setServiceSearch] = useState('')
  const [cart, setCart] = useState(() => Array.isArray(initialDraft?.cart) ? initialDraft.cart : [])
  const [plate, setPlate] = useState(() => initialDraft?.plate || '')
  const [vehicle, setVehicle] = useState(() => initialDraft?.vehicle || '')
  const [notes, setNotes] = useState(() => initialDraft?.notes || '')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [selfService, setSelfService] = useState(() => Boolean(initialDraft?.selfService))
  const [memberEnabled, setMemberEnabled] = useState(() => Boolean(initialDraft?.memberEnabled))

  // Customer / member search
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [availableRewards, setAvailableRewards] = useState([])
  const [useFreeRepair, setUseFreeRepair] = useState(false)

  // Keep an unfinished bill in this browser tab so a background-tab reload or
  // auth refresh does not discard selected services and entered details.
  useEffect(() => {
    try {
      if (!cart.length && !plate && !vehicle && !notes && !selfService && !memberEnabled) {
        sessionStorage.removeItem(draftStorageKey)
        return
      }
      sessionStorage.setItem(draftStorageKey, JSON.stringify({ cart, plate, vehicle, notes, selfService, memberEnabled }))
    } catch {}
  }, [cart, plate, vehicle, notes, selfService, memberEnabled, draftStorageKey])

  useEffect(() => {
    supabase.from('services').select('*').eq('branch_id', branch.id).eq('active', true)
      .then(({ data, error }) => {
        if (error) console.error(error)
        setServices(data || [])
      })
  }, [branch])

  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('members').select('*').eq('branch_id', branch.id)
        .or(`name.ilike.%${customerQuery}%,plate_or_note.ilike.%${customerQuery}%,phone.ilike.%${customerQuery}%`)
        .limit(5)
      if (error) console.error(error)
      setCustomerResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [customerQuery, branch])

  useEffect(() => {
    setUseFreeRepair(false)
    if (!selectedMember) { setAvailableRewards([]); return }
    supabase.from('member_rewards').select('id').eq('member_id', selectedMember.id).eq('status', 'available').order('created_at')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setAvailableRewards(data || [])
      })
  }, [selectedMember])

  const categories = ['all', ...new Set(services.map(s => s.category))]
  const visible = (activeCat === 'all' ? services : services.filter(s => s.category === activeCat))
    .filter(service => {
      const query = serviceSearch.trim().toLowerCase()
      return !query || service.name.toLowerCase().includes(query) || service.category.toLowerCase().includes(query)
    })
  const cartTotal = cart.reduce((a, s) => a + s.price, 0)
  const cartLines = Object.values(cart.reduce((lines, service) => {
    const existing = lines[service.id]
    lines[service.id] = existing
      ? { ...existing, quantity: existing.quantity + 1, lineTotal: existing.lineTotal + service.price }
      : { ...service, quantity: 1, lineTotal: service.price }
    return lines
  }, {}))
  const memberStatus = selectedMember && memberEnabled
    ? calculateMemberDiscount(selectedMember, cartTotal)
    : { active: false, percentage: 0, amount: 0, total: cartTotal }
  const memberFreeRepairAmount = memberStatus.active
    ? cart.reduce((total, service) => total + (
      MEMBER_FREE_REPAIR_SERVICES.has(String(service.name || '').trim().toLowerCase()) ? service.price : 0
    ), 0)
    : 0
  const memberDiscountSubtotal = Math.max(0, cartTotal - memberFreeRepairAmount)
  const memberDiscount = selectedMember && memberEnabled
    ? calculateMemberDiscount(selectedMember, memberDiscountSubtotal)
    : { active: false, percentage: 0, amount: 0, total: memberDiscountSubtotal }
  const memberFreeRepairApplied = memberFreeRepairAmount > 0
  const couponFreeRepairApplied = Boolean(useFreeRepair && availableRewards[0])
  const displayTotal = selfService || couponFreeRepairApplied ? 0 : memberDiscount.total
  const displayCommission = selfService ? 0 : branch.commission_flat

  function addToCart(service) { setCart(c => [...c, service]) }
  function removeFromCart(idx) { setCart(c => c.filter((_, i) => i !== idx)) }
  function removeOneFromCart(serviceId) {
    setCart(current => {
      const index = current.findIndex(service => service.id === serviceId)
      return index === -1 ? current : current.filter((_, itemIndex) => itemIndex !== index)
    })
  }
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 1800) }

  function pickMember(m) {
    setSelectedMember(m)
    setCustomerQuery('')
    setCustomerResults([])
    if (m.plate_or_note) setPlate(m.plate_or_note)
  }

  function toggleMember() {
    setMemberEnabled(enabled => {
      if (enabled) {
        setSelectedMember(null)
        setCustomerQuery('')
        setCustomerResults([])
      }
      return !enabled
    })
  }

  async function submitBill() {
    if (cart.length === 0 || !staff) return
    if (memberEnabled && !selectedMember) { showToast('กรุณาเลือก Member ก่อนบันทึกบิล'); return }
    setSubmitting(true)
    const billNumber = `${branch.key.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

    const { data: bill, error: billError } = await supabase.from('bills').insert({
      bill_number: billNumber,
      branch_id: branch.id,
      staff_id: staff.id,
      member_id: selectedMember?.id || null,
      plate: plate || null,
      vehicle: vehicle || null,
      // Keep a snapshot in the bill itself as a reliable history fallback.
      // bill_items remains the source for stock/reward automation.
      notes: makeBillNotes(notes, cart),
      subtotal: cartTotal,
      discount_pct: selfService ? 0 : couponFreeRepairApplied ? 100 : memberDiscount.percentage,
      commission: displayCommission,
      commission_mode: branch.key === 'chill' ? 'ON_WORK_ALL' : 'INDIVIDUAL',
      total: displayTotal,
      // A successful checkout is a completed bill. The database trigger
      // snapshots ON_WORK_ALL recipients at this exact transition.
      status: 'paid',
    }).select().single()

    if (billError) { console.error(billError); showToast('เกิดข้อผิดพลาด: ' + billError.message); setSubmitting(false); return }

    const items = cart.map(s => ({ bill_id: bill.id, service_id: s.id, name_snapshot: s.name, price_snapshot: s.price }))
    const { error: itemsError } = await supabase.from('bill_items').insert(items)
    if (itemsError) {
      console.error(itemsError)
      showToast(`บันทึกเลขบิล ${billNumber} แล้ว แต่บันทึกรายการบริการไม่สำเร็จ: ${itemsError.message}`)
      setSubmitting(false)
      return
    }

    if (selectedMember) {
      await supabase.from('members').update({
        total_spent: (selectedMember.total_spent || 0) + displayTotal,
        visits: (selectedMember.visits || 0) + 1,
      }).eq('id', selectedMember.id)
    }
    if (couponFreeRepairApplied) {
      const { error: rewardError } = await supabase.from('member_rewards').update({
        status: 'redeemed', redeemed_bill_id: bill.id, redeemed_at: new Date().toISOString(),
      }).eq('id', availableRewards[0].id).eq('status', 'available')
      if (rewardError) console.error(rewardError)
    }

    setCart([]); setPlate(''); setVehicle(''); setNotes(''); setSelectedMember(null); setSelfService(false); setMemberEnabled(false); setUseFreeRepair(false)
    showToast('บันทึกบิลสำเร็จ ✓ ' + billNumber)
    setSubmitting(false)
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ alignItems: 'center', display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ alignItems: 'center', background: 'rgba(255,255,255,.035)', border: '1px solid var(--line)', borderRadius: 6, display: 'flex', flex: 1, padding: '0 10px' }}>
              <span style={{ color: 'var(--ghost-gray)', fontSize: 16 }}>⌕</span>
              <input className="input" value={serviceSearch} onChange={event => setServiceSearch(event.target.value)} placeholder="ค้นหาบริการ เช่น Tire, Repair, Bumper..." style={{ background: 'transparent', border: 0, padding: '10px 8px' }} />
              {serviceSearch && <button type="button" onClick={() => setServiceSearch('')} aria-label="ล้างคำค้น" style={{ background: 'transparent', border: 0, color: 'var(--ghost-gray)', cursor: 'pointer', fontSize: 17 }}>×</button>}
            </div>
            <span style={{ color: 'var(--ghost-gray)', fontSize: 11, whiteSpace: 'nowrap' }}>{visible.length} รายการ</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <div key={cat} onClick={() => setActiveCat(cat)} className="btn" style={{
                fontSize: 11, textTransform: 'uppercase',
                borderColor: activeCat === cat ? 'var(--blood)' : 'var(--line)',
                color: activeCat === cat ? 'var(--bone)' : 'var(--ghost-gray)',
                background: activeCat === cat ? 'rgba(196,30,42,0.14)' : 'rgba(255,255,255,0.02)',
              }}>
                {cat === 'all' ? 'ALL' : cat}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {visible.map(s => (
              <div key={s.id} onClick={() => addToCart(s)} className="panel" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 9, color: 'var(--ghost-gray)', textTransform: 'uppercase', marginBottom: 4 }}>{s.category}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{s.name}</div>
                <div className="font-mono" style={{ fontSize: 13, color: 'var(--blood)', fontWeight: 600 }}>¥{s.price.toLocaleString()}</div>
              </div>
            ))}
            {services.length === 0 && (
              <div style={{ gridColumn: '1/-1', color: 'var(--ghost-gray)', fontSize: 12 }}>
                ยังไม่มีบริการในสาขานี้ — เพิ่มได้ที่แท็บ "Services"
              </div>
            )}
            {services.length > 0 && visible.length === 0 && (
              <div style={{ color: 'var(--ghost-gray)', fontSize: 12, gridColumn: '1/-1', padding: '20px 0', textAlign: 'center' }}>ไม่พบบริการที่ค้นหา</div>
            )}
          </div>
        </div>

        <div className="panel" style={{ position: 'sticky', top: 0 }}>
          <div className="font-display" style={{ fontSize: 13, letterSpacing: 1, color: 'var(--blood)', marginBottom: 14 }}>
            ▸ NEW BILL — {title}
          </div>

          <input className="input" placeholder="ทะเบียน / Plate" value={plate} onChange={e => setPlate(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="รถ / รายละเอียด" value={vehicle} onChange={e => setVehicle(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="หมายเหตุ (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ marginBottom: 14 }} />

          <div style={{ minHeight: 60, borderBottom: '1px dashed var(--line)', paddingBottom: 10, marginBottom: 10 }}>
            {cart.length === 0
              ? <div style={{ color: 'var(--ghost-gray)', fontSize: 11, textAlign: 'center', padding: '16px 0' }}>// คลิกบริการเพื่อเพิ่ม</div>
              : cartLines.map(line => (
                <div key={line.id} style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 10, padding: '7px 0' }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{line.name}</div><div style={{ color: 'var(--ghost-gray)', fontSize: 10 }}>¥{line.price.toLocaleString()} / ชิ้น</div></div>
                  <div style={{ alignItems: 'center', display: 'flex', gap: 7, whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => removeOneFromCart(line.id)} aria-label={`ลดจำนวน ${line.name}`} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--bone)', cursor: 'pointer', height: 22, width: 22 }}>−</button>
                    <span className="font-mono" style={{ minWidth: 21, textAlign: 'center' }}>×{line.quantity}</span>
                    <button type="button" onClick={() => addToCart(line)} aria-label={`เพิ่มจำนวน ${line.name}`} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--bone)', cursor: 'pointer', height: 22, width: 22 }}>+</button>
                    <strong className="font-mono" style={{ minWidth: 60, textAlign: 'right' }}>¥{line.lineTotal.toLocaleString()}</strong>
                    <span onClick={() => setCart(current => current.filter(service => service.id !== line.id))} style={{ color: 'var(--ghost-gray)', cursor: 'pointer', fontSize: 14 }}>✕</span>
                  </div>
                </div>
              ))
            }
          </div>

          <div
            onClick={toggleMember}
            className="panel"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: memberEnabled ? 8 : 12, cursor: 'pointer' }}
          >
            <div style={{ width: 34, height: 18, borderRadius: 10, background: memberEnabled ? 'var(--blood)' : 'rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--bone)', position: 'absolute', top: 2, left: memberEnabled ? 18 : 2, transition: 'left .15s' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>★ มี MEMBER</div>
              <div style={{ fontSize: 10, color: 'var(--ghost-gray)' }}>เลือกสมาชิกเพื่อสะสมเป้าหมาย MT และคูปอง</div>
            </div>
          </div>

          {memberEnabled && (
            <div style={{ marginBottom: 12 }} onClick={event => event.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--ghost-gray)', fontSize: 10, letterSpacing: .8 }}>MEMBERS & COUPONS</span>
                <Link to="/members" style={{ color: 'var(--bone)', fontSize: 10, textDecoration: 'underline' }}>จัดการรายชื่อ Members ↗</Link>
              </div>
              {selectedMember ? (
                <div className="panel" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontSize: 13, fontWeight: 600 }}>{selectedMember.name}</div><div style={{ fontSize: 11, color: 'var(--ghost-gray)' }}>{memberDiscount.plan.label} · {memberDiscount.active ? `หมดอายุ ${formatDate(selectedMember.membership_expires_at)}` : 'สมาชิกหมดอายุ — ไม่ได้รับส่วนลด'}</div></div><div onClick={() => setSelectedMember(null)} style={{ color: 'var(--ghost-gray)', cursor: 'pointer', fontSize: 14 }}>✕</div></div>
                  {memberDiscount.active && <div style={{ color: '#e5c158', fontSize: 11, fontWeight: 600, marginTop: 10 }}>✦ MEMBER: Engine Repair Kit และ Full Repair Kit ฟรี</div>}
                  {availableRewards.length > 0 && <label style={{ alignItems: 'center', color: '#e5c158', cursor: 'pointer', display: 'flex', fontSize: 11, gap: 7, marginTop: 10 }}><input type="checkbox" checked={useFreeRepair} onChange={event => setUseFreeRepair(event.target.checked)} /> ใช้คูปองซ่อมฟรี 1 ครั้ง ({availableRewards.length} ใบ)</label>}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input className="input" autoFocus placeholder="ค้นหาทะเบียนรถ หรือชื่อ Member..." value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} />
                  {(customerResults.length > 0 || customerQuery.trim()) && (
                    <div className="panel" style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 10, padding: 8 }}>
                      {customerResults.map(m => <div key={m.id} onClick={() => pickMember(m)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px', cursor: 'pointer', borderRadius: 6 }}><div><span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span><span style={{ fontSize: 11, color: 'var(--ghost-gray)', marginLeft: 8 }}>{m.plate_or_note}</span></div><div style={{ fontSize: 11, color: 'var(--ghost-gray)' }}>{calculateMemberDiscount(m, cartTotal).active ? 'ACTIVE' : 'หมดอายุ'}</div></div>)}
                      <div onClick={() => setShowAddMember(true)} style={{ padding: '8px 6px', color: 'var(--blood)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ เพิ่ม Member ใหม่</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Self service toggle */}
          <div
            onClick={() => setSelfService(v => !v)}
            className="panel"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 12, cursor: 'pointer' }}
          >
            <div style={{
              width: 34, height: 18, borderRadius: 10, background: selfService ? 'var(--blood)' : 'rgba(255,255,255,0.15)',
              position: 'relative', flexShrink: 0, transition: 'background .15s'
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', background: 'var(--bone)', position: 'absolute', top: 2,
                left: selfService ? 18 : 2, transition: 'left .15s'
              }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>✏ SELF SERVICE</div>
              <div style={{ fontSize: 10, color: 'var(--ghost-gray)' }}>TOTAL & COMMISSION = 0 ¥</div>
            </div>
          </div>

          <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ghost-gray)', marginBottom: 6 }}>
            <span>COMMISSION (FLAT)</span><span>¥{displayCommission.toLocaleString()}</span>
          </div>
          {memberEnabled && selectedMember && !selfService && (
            <>
              <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ghost-gray)', marginBottom: 6 }}>
                <span>SUBTOTAL</span><span>¥{cartTotal.toLocaleString()}</span>
              </div>
              <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: memberDiscount.percentage ? '#84d6a8' : 'var(--ghost-gray)', marginBottom: 6 }}>
                <span>MEMBER DISCOUNT {memberDiscount.percentage ? `(${memberDiscount.percentage}%)` : ''}</span><span>−¥{memberDiscount.amount.toLocaleString()}</span>
              </div>
              {memberFreeRepairApplied && <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e5c158', marginBottom: 6 }}><span>MEMBER FREE REPAIR KITS</span><span>−¥{memberFreeRepairAmount.toLocaleString()}</span></div>}
              {couponFreeRepairApplied && <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e5c158', marginBottom: 6 }}><span>FREE REPAIR COUPON</span><span>−¥{memberDiscount.total.toLocaleString()}</span></div>}
            </>
          )}
          <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
            <span>TOTAL</span><span style={{ color: 'var(--blood)' }}>¥{displayTotal.toLocaleString()}</span>
          </div>

          <div onClick={submitBill} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: submitting || cart.length === 0 ? 0.5 : 1 }}>
            {submitting ? 'กำลังบันทึก...' : '▸ SUBMIT BILL'}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--static)', border: '1px solid var(--blood)', padding: '12px 18px', borderRadius: 6, fontSize: 12 }}>
          {toast}
        </div>
      )}

      {showAddMember && (
        <AddMemberModal
          branch={branch}
          initialQuery={customerQuery}
          onClose={() => setShowAddMember(false)}
          onCreated={(m) => { pickMember(m); setShowAddMember(false) }}
        />
      )}
    </div>
  )
}

// ---------------- Add customer modal ----------------
function AddMemberModal({ branch, initialQuery, onClose, onCreated }) {
  const [name, setName] = useState(initialQuery || '')
  const [phone, setPhone] = useState('')
  const [plate, setPlateNote] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const plan = getMembershipPlan('regular')
    const startsAt = new Date().toISOString()
    const expiresAt = nextMonthlyExpiry()
    const { data, error } = await supabase.from('members').insert({
      branch_id: branch.id,
      name: name.trim(),
      phone: phone || null,
      plate_or_note: plate || note || null,
      tier: 'regular',
      membership_started_at: startsAt,
      membership_expires_at: expiresAt,
      membership_fee: plan.monthlyFee,
    }).select().single()
    setSaving(false)
    if (error) { console.error(error); return }
    await supabase.from('member_memberships').insert({
      member_id: data.id, tier: plan.key, monthly_fee: plan.monthlyFee,
      months: 1, total_paid: plan.monthlyFee, started_at: startsAt, expires_at: expiresAt,
    })
    onCreated(data)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="panel" style={{ width: '100%', maxWidth: 420, background: 'var(--static)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>เพิ่มลูกค้าใหม่</div>
          <div onClick={onClose} style={{ cursor: 'pointer', color: 'var(--ghost-gray)', fontSize: 18 }}>✕</div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>ชื่อ</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>เบอร์</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>ทะเบียน</label>
            <input className="input" value={plate} onChange={e => setPlateNote(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>โน้ต</label>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <div onClick={onClose} className="btn btn-secondary">ยกเลิก</div>
          <div onClick={save} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังเพิ่ม...' : 'สมัคร Regular ¥30,000'}</div>
        </div>
      </div>
    </div>
  )
}

// ---------------- Bills history ----------------
function BillsHistoryTab({ branch, staff, onBillDeleted }) {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [itemsLoadError, setItemsLoadError] = useState('')
  const [expandedBillId, setExpandedBillId] = useState(null)

  async function deleteBill(bill) {
    if (!window.confirm(`ยกเลิกบิล ${bill.bill_number} ?\n\nยอดรายรับและ Commission ของบิลนี้จะถูกตัดออก และสต็อกที่ใช้จะถูกคืน`)) return
    const rpcName = staff?.role === 'god' ? 'delete_any_bill_as_god' : 'delete_own_bill'
    const { error } = await supabase.rpc(rpcName, { target_bill_id: bill.id })
    if (error) {
      console.error(error)
      alert(`ลบบิลไม่สำเร็จ: ${error.message}`)
      return
    }
    setBills(current => current.filter(item => item.id !== bill.id))
    setExpandedBillId(null)
    onBillDeleted?.()
  }

  useEffect(() => {
    let active = true

    async function loadBills() {
      setLoading(true)
      setItemsLoadError('')
      const { data: billRows, error: billsError } = await supabase
        .from('bills')
        .select('*, staff:staff_id(name_en)')
        .eq('branch_id', branch.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (billsError) console.error(billsError)
      const safeBills = billRows || []
      const billIds = safeBills.map(bill => bill.id)
      let itemsByBill = {}

      // Query bill_items directly instead of relying on PostgREST's embedded
      // relationship, which can leave the line-item list empty in some projects.
      if (billIds.length) {
        const { data: itemRows, error: itemError } = await supabase
          .from('bill_items')
          .select('bill_id, name_snapshot, price_snapshot')
          .in('bill_id', billIds)

        if (itemError) {
          console.error(itemError)
          if (active) setItemsLoadError(itemError.message)
        } else {
          itemsByBill = (itemRows || []).reduce((result, item) => {
            result[item.bill_id] = [...(result[item.bill_id] || []), item]
            return result
          }, {})
        }

        const { data: distributionRows, error: distributionError } = await supabase
          .from('commission_distributions')
          .select('bill_id, user_id, user_name_snapshot, amount, commission_mode, paid_at, reversed_at')
          .in('bill_id', billIds)
        if (distributionError) {
          // Older environments can deploy the UI before the migration; keep
          // bill history usable while the migration is being applied.
          console.warn('[Ghost Lab] Commission distributions unavailable:', distributionError.message)
        } else {
          const distributionsByBill = (distributionRows || []).reduce((result, item) => {
            result[item.bill_id] = [...(result[item.bill_id] || []), item]
            return result
          }, {})
          safeBills.forEach(bill => { bill.commission_distributions = distributionsByBill[bill.id] || [] })
        }
      }

      if (!active) return
      setBills(safeBills.map(bill => ({ ...bill, items: itemsByBill[bill.id] || [] })))
      setLoading(false)
    }

    loadBills()
    return () => { active = false }
  }, [branch])

  return (
    <div className="panel">
      <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>ประวัติบิล · Bills</div>
      {itemsLoadError && <div style={{ background: 'rgba(196,30,42,.1)', border: '1px solid rgba(196,30,42,.35)', color: '#ff9ea5', fontSize: 11, marginBottom: 12, padding: '9px 10px' }}>ดึงรายการในบิลไม่สำเร็จ: {itemsLoadError}</div>}
      {loading ? <div style={{ color: 'var(--ghost-gray)', fontSize: 12 }}>กำลังโหลด...</div>
        : bills.length === 0 ? <div style={{ color: 'var(--ghost-gray)', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>ยังไม่มีบิล</div>
        : bills.map(b => <BillHistoryRow key={b.id} bill={b} expanded={expandedBillId === b.id} onToggle={() => setExpandedBillId(current => current === b.id ? null : b.id)} canDelete={staff?.role === 'god' || (b.staff_id === staff?.id && (staff?.role === 'owner' || staff?.permissions?.includes('bill_delete_own')))} onDelete={() => deleteBill(b)} />)
      }
    </div>
  )
}

function BillHistoryRow({ bill, expanded, onToggle, canDelete, onDelete }) {
  const noteSnapshot = readBillNotes(bill.notes)
  const lineItems = (bill.items || []).length ? bill.items : noteSnapshot.items
  const groupedItems = Object.values(lineItems.reduce((items, item) => {
    const current = items[item.name_snapshot] || { name: item.name_snapshot, quantity: 0, total: 0 }
    items[item.name_snapshot] = { ...current, quantity: current.quantity + 1, total: current.total + Number(item.price_snapshot || 0) }
    return items
  }, {}))
  const discountAmount = Math.max(0, Number(bill.subtotal || 0) - Number(bill.total || 0))
  const distributions = (bill.commission_distributions || []).filter(item => !item.reversed_at)
  const modeLabel = bill.commission_mode === 'ON_WORK_ALL' ? 'ON WORK ALL' : bill.commission_mode === 'NONE' ? 'NONE' : 'INDIVIDUAL'
  const payoutTotal = distributions.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  return <div style={{ borderBottom: '1px solid var(--line)', fontSize: 12 }}>
    <div onClick={onToggle} style={{ alignItems: 'center', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '11px 0' }}>
      <div><span className="font-mono" style={{ fontWeight: 600 }}>{expanded ? '⌄' : '›'} {bill.bill_number}</span><span style={{ color: 'var(--ghost-gray)', marginLeft: 10 }}>{bill.plate || '—'} {bill.vehicle ? `· ${bill.vehicle}` : ''}</span><div style={{ color: 'var(--ghost-gray)', fontSize: 11, marginTop: 2 }}>{bill.staff?.name_en || '—'} · {new Date(bill.created_at).toLocaleString('th-TH')} · คลิกเพื่อดูรายการ</div></div>
      <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
        <div className="font-mono" style={{ fontWeight: 600 }}>¥{Number(bill.total || 0).toLocaleString()}</div>
        {canDelete && <button type="button" onClick={event => { event.stopPropagation(); onDelete() }} title="ยกเลิกบิลของฉัน" style={{ background: 'transparent', border: '1px solid rgba(196,30,42,.55)', borderRadius: 5, color: '#f18b92', cursor: 'pointer', fontSize: 11, padding: '4px 7px' }}>ลบบิล</button>}
      </div>
    </div>
    {expanded && <div style={{ background: 'rgba(255,255,255,.025)', borderTop: '1px solid var(--line)', margin: '0 -8px', padding: '12px 14px' }}>
      <div style={{ color: 'var(--ghost-gray)', fontSize: 10, letterSpacing: .8, marginBottom: 7 }}>รายการที่ทำ</div>
      {groupedItems.length === 0 ? <div style={{ color: 'var(--ghost-gray)', fontSize: 11 }}>ไม่มีรายละเอียดรายการในบิลนี้</div> : groupedItems.map(item => <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{item.name} <span style={{ color: 'var(--ghost-gray)' }}>×{item.quantity}</span></span><span className="font-mono">¥{item.total.toLocaleString()}</span></div>)}
      <div style={{ borderTop: '1px dashed var(--line)', display: 'grid', gap: 4, gridTemplateColumns: '1fr auto', marginTop: 9, paddingTop: 9 }}><span style={{ color: 'var(--ghost-gray)' }}>Subtotal</span><span className="font-mono">¥{Number(bill.subtotal || 0).toLocaleString()}</span>{discountAmount > 0 && <><span style={{ color: '#84d6a8' }}>ส่วนลด {bill.discount_pct ? `(${bill.discount_pct}%)` : ''}</span><span className="font-mono" style={{ color: '#84d6a8' }}>−¥{discountAmount.toLocaleString()}</span></>}<span style={{ color: 'var(--ghost-gray)' }}>Commission / Person</span><span className="font-mono" style={{ color: '#e5c158' }}>¥{Number(bill.commission || 0).toLocaleString()}</span><strong>TOTAL</strong><strong className="font-mono" style={{ color: 'var(--blood)' }}>¥{Number(bill.total || 0).toLocaleString()}</strong></div>
      {bill.commission_mode && <div style={{ borderTop: '1px dashed var(--line)', marginTop: 10, paddingTop: 9 }}><div style={{ color: '#e5c158', fontSize: 11, fontWeight: 600 }}>Commission Mode: {modeLabel}</div><div style={{ color: 'var(--ghost-gray)', fontSize: 11, marginTop: 4 }}>On Work Recipients: {distributions.length} คน · Total Commission Payout: ¥{payoutTotal.toLocaleString()}</div>{distributions.length > 0 && <div style={{ marginTop: 6 }}>{distributions.map(item => <div key={item.user_id || item.user_name_snapshot} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>{item.user_name_snapshot}</span><span className="font-mono">¥{Number(item.amount || 0).toLocaleString()}</span></div>)}</div>}</div>}
      {noteSnapshot.note && <div style={{ color: 'var(--ghost-gray)', fontSize: 11, marginTop: 10 }}>หมายเหตุ: {noteSnapshot.note}</div>}
    </div>}
  </div>
}

// ---------------- Services Catalog ----------------
function ServicesTab({ branch }) {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [materialCounts, setMaterialCounts] = useState({}) // { serviceId: count }

  useEffect(() => { load() }, [branch])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('services').select('*').eq('branch_id', branch.id).eq('active', true).order('category')
    if (error) console.error(error)
    setServices(data || [])
    setLoading(false)

    if (data && data.length) {
      const { data: counts } = await supabase
        .from('service_materials').select('service_id')
        .in('service_id', data.map(s => s.id))
      const tally = {}
      ;(counts || []).forEach(r => { tally[r.service_id] = (tally[r.service_id] || 0) + 1 })
      setMaterialCounts(tally)
    }
  }

  async function addService() {
    const { data, error } = await supabase.from('services').insert({
      branch_id: branch.id, category: 'ทั่วไป', name: 'บริการใหม่', price: 0, active: true,
    }).select().single()
    if (error) { console.error(error); return }
    setServices(s => [...s, data])
  }

  async function updateField(id, field, value) {
    setServices(s => s.map(x => x.id === id ? { ...x, [field]: value } : x))
  }

  async function saveField(id, field, value) {
    const payload = field === 'price' ? { price: parseInt(value) || 0 } : { [field]: value }
    const { error } = await supabase.from('services').update(payload).eq('id', id)
    if (error) console.error(error)
  }

  async function removeService(id) {
    if (!confirm('ลบบริการนี้?')) return
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) { console.error(error); return }
    setServices(s => s.filter(x => x.id !== id))
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--blood)' }}>SERVICES CATALOG</div>
          <div style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>{services.length} services available</div>
        </div>
        <div onClick={addService} className="btn btn-primary">+ ADD SERVICE</div>
      </div>

      {loading ? <div style={{ color: 'var(--ghost-gray)', fontSize: 12 }}>กำลังโหลด...</div> : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr auto', gap: 10, padding: '0 0 10px', fontSize: 10, color: 'var(--ghost-gray)', textTransform: 'uppercase', letterSpacing: 1 }}>
            <div>Name</div><div>Category</div><div>Price (¥)</div><div>Materials</div><div>MT Loyalty</div><div></div>
          </div>
          {services.map(s => (
            <div key={s.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr auto', gap: 10, padding: '6px 0', alignItems: 'center' }}>
                <input
                  className="input" value={s.name}
                  onChange={e => updateField(s.id, 'name', e.target.value)}
                  onBlur={e => saveField(s.id, 'name', e.target.value)}
                />
                <input
                  className="input" value={s.category}
                  onChange={e => updateField(s.id, 'category', e.target.value)}
                  onBlur={e => saveField(s.id, 'category', e.target.value)}
                />
                <input
                  className="input font-mono" value={s.price}
                  style={{ color: 'var(--blood)', fontWeight: 600 }}
                  onChange={e => updateField(s.id, 'price', e.target.value)}
                  onBlur={e => saveField(s.id, 'price', e.target.value)}
                />
                <div
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  style={{ fontSize: 12, cursor: 'pointer', color: materialCounts[s.id] ? 'var(--blood)' : 'var(--ghost-gray)' }}
                >
                  {materialCounts[s.id] ? `${materialCounts[s.id]} items` : '⚙ ตั้งค่า'}
                </div>
                <label style={{ alignItems: 'center', color: s.loyalty_eligible ? 'var(--bone)' : 'var(--ghost-gray)', cursor: 'pointer', display: 'flex', fontSize: 11, gap: 6 }}>
                  <input type="checkbox" checked={Boolean(s.loyalty_eligible)} onChange={event => { updateField(s.id, 'loyalty_eligible', event.target.checked); saveField(s.id, 'loyalty_eligible', event.target.checked) }} />
                  นับซ่อม
                </label>
                <div onClick={() => removeService(s.id)} className="btn" style={{ color: 'var(--blood)', borderColor: 'rgba(196,30,42,0.4)', padding: '10px 14px' }}>🗑</div>
              </div>

              {expandedId === s.id && (
                <MaterialsEditor
                  branch={branch}
                  service={s}
                  onSaved={(count) => { setMaterialCounts(m => ({ ...m, [s.id]: count })); setExpandedId(null) }}
                />
              )}
            </div>
          ))}
          {services.length === 0 && (
            <div style={{ color: 'var(--ghost-gray)', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
              ยังไม่มีบริการ — กด "+ ADD SERVICE" เพื่อเริ่มเพิ่ม
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------- Materials (BOM) editor — shown when a service row is expanded ----------------
function MaterialsEditor({ branch, service, onSaved }) {
  const [stockItems, setStockItems] = useState([])
  const [qtys, setQtys] = useState({}) // { stock_item_id: qty }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: items, error: itemsErr }, { data: existing, error: existErr }] = await Promise.all([
        supabase.from('stock_items').select('*').eq('branch_id', branch.id).order('name'),
        supabase.from('service_materials').select('stock_item_id, qty_per_unit').eq('service_id', service.id),
      ])
      if (itemsErr) console.error(itemsErr)
      if (existErr) console.error(existErr)
      setStockItems(items || [])
      const map = {}
      ;(existing || []).forEach(r => { map[r.stock_item_id] = r.qty_per_unit })
      setQtys(map)
      setLoading(false)
    }
    load()
  }, [branch, service])

  function setQty(stockItemId, value) {
    const n = parseInt(value) || 0
    setQtys(q => ({ ...q, [stockItemId]: n }))
  }

  async function save() {
    setSaving(true)
    // Simplest consistent approach: clear existing links for this service, then
    // re-insert only the ones with qty > 0.
    await supabase.from('service_materials').delete().eq('service_id', service.id)
    const toInsert = Object.entries(qtys)
      .filter(([, qty]) => qty > 0)
      .map(([stock_item_id, qty_per_unit]) => ({ service_id: service.id, stock_item_id, qty_per_unit }))
    if (toInsert.length) {
      const { error } = await supabase.from('service_materials').insert(toInsert)
      if (error) console.error(error)
    }
    setSaving(false)
    onSaved(toInsert.length)
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 16, margin: '4px 0 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--ghost-gray)', marginBottom: 12 }}>
        MATERIALS / PARTS USED — ใส่จำนวนที่ใช้ต่อ 1 งาน · จะหักจาก Stock อัตโนมัติเมื่อรับงาน
      </div>

      {loading ? <div style={{ color: 'var(--ghost-gray)', fontSize: 12 }}>กำลังโหลด...</div>
        : stockItems.length === 0 ? (
          <div style={{ color: 'var(--ghost-gray)', fontSize: 12 }}>
            ยังไม่มีวัตถุดิบในสาขานี้ — ไปเพิ่มที่หน้า "สต๊อก & เบิกจ่าย" ก่อน
          </div>
        ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            {stockItems.map(item => (
              <div key={item.id}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>{item.name}</div>
                <input
                  className="input" type="number" min="0"
                  value={qtys[item.id] || 0}
                  onChange={e => setQty(item.id, e.target.value)}
                  style={{ fontSize: 12 }}
                />
                <div style={{ fontSize: 10, color: 'var(--ghost-gray)', marginTop: 4 }}>เหลือ {item.quantity} {item.unit || 'ชิ้น'}</div>
              </div>
            ))}
          </div>
          <div onClick={save} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>
            {saving ? 'กำลังบันทึก...' : '💾 บันทึก Materials'}
          </div>
        </>
      )}
    </div>
  )
}
