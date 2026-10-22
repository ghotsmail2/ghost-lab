import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BranchFilter from '../components/BranchFilter'
import './Home.css'

function localDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Home() {
  const { staff } = useAuth()
  const [todayBills, setTodayBills] = useState([])
  const [onShiftCount, setOnShiftCount] = useState(0)
  const [onShiftStaff, setOnShiftStaff] = useState([])
  const [showOnShiftStaff, setShowOnShiftStaff] = useState(false)
  const [personalCommission, setPersonalCommission] = useState(0)
  const [personalCommissionBills, setPersonalCommissionBills] = useState(0)
  const [branchFilter, setBranchFilter] = useState('all')
  const [period, setPeriod] = useState('today')
  const [selectedDate, setSelectedDate] = useState(localDateValue)
  const [openAttendance, setOpenAttendance] = useState(null)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [payHistory, setPayHistory] = useState([])
  const [bonuses, setBonuses] = useState({})
  const [payingStaffId, setPayingStaffId] = useState(null)
  const hasOwnerOverview = staff?.role === 'owner' || staff?.role === 'god'

  const periodLabels = { today: 'วันนี้', week: '7 วันล่าสุด', month: 'เดือนนี้', all: 'ทั้งหมด' }
  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  const periodLabel = period === 'date' ? selectedDateLabel : periodLabels[period]

  useEffect(() => {
    const periodStart = new Date()
    let periodEnd = null
    if (period === 'today') periodStart.setHours(0, 0, 0, 0)
    if (period === 'week') { periodStart.setDate(periodStart.getDate() - 6); periodStart.setHours(0, 0, 0, 0) }
    if (period === 'month') { periodStart.setDate(1); periodStart.setHours(0, 0, 0, 0) }
    if (period === 'date') {
      const [year, month, day] = selectedDate.split('-').map(Number)
      periodStart.setFullYear(year, month - 1, day)
      periodStart.setHours(0, 0, 0, 0)
      periodEnd = new Date(periodStart)
      periodEnd.setDate(periodEnd.getDate() + 1)
    }

    let billsQuery = supabase
      .from('bills')
      .select('*, branches(key,name), staff:staff_id(name_en)')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (period !== 'all') billsQuery = billsQuery.gte('created_at', periodStart.toISOString())
    if (periodEnd) billsQuery = billsQuery.lt('created_at', periodEnd.toISOString())
    billsQuery.then(({ data, error }) => { if (!error) setTodayBills(data || []) })

    let attendanceRequestActive = true
    const refreshOnShiftStaff = async () => {
      const { data, error } = await supabase.rpc('list_on_shift_staff', {
        p_branch_id: hasOwnerOverview ? null : (staff?.primary_branch || null),
      })
      if (!attendanceRequestActive) return
      if (error) {
        console.error('[Ghost Lab] Failed to load on-shift staff:', error)
        return
      }
      const currentStaff = data || []
      setOnShiftStaff(currentStaff)
      setOnShiftCount(currentStaff.length)
    }
    refreshOnShiftStaff()
    const attendanceRefreshTimer = setInterval(refreshOnShiftStaff, 30_000)

    if (hasOwnerOverview || !staff?.id) {
      setPersonalCommission(0)
      setPersonalCommissionBills(0)
    } else {
      let commissionQuery = supabase
        .from('commission_distributions')
        .select('amount,created_at')
        .eq('user_id', staff.id)
        .is('reversed_at', null)
      if (period !== 'all') commissionQuery = commissionQuery.gte('created_at', periodStart.toISOString())
      if (periodEnd) commissionQuery = commissionQuery.lt('created_at', periodEnd.toISOString())
      commissionQuery.then(({ data, error }) => {
        if (error) console.error('[Ghost Lab] Failed to load personal commission:', error)
        else {
          setPersonalCommission((data || []).reduce((total, row) => total + Number(row.amount || 0), 0))
          setPersonalCommissionBills((data || []).length)
        }
      })
    }
    return () => {
      attendanceRequestActive = false
      clearInterval(attendanceRefreshTimer)
    }
  }, [period, selectedDate, staff?.id, staff?.primary_branch, hasOwnerOverview])

  useEffect(() => {
    if (!staff?.id) return
    supabase
      .from('attendance')
      .select('*')
      .eq('staff_id', staff.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error(error)
        setOpenAttendance(data || null)
      })
  }, [staff?.id])

  useEffect(() => {
    if (!hasOwnerOverview) return
    loadPayHistory()
  }, [hasOwnerOverview])

  async function loadPayHistory() {
    const { data, error } = await supabase
      .from('pay_periods')
      .select('*, staff:staff_id(name_en)')
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(10)
    if (error) console.error('[Ghost Lab] Failed to load payroll history:', error)
    else setPayHistory(data || [])
  }

  async function recordPayment(member) {
    if (payingStaffId) return
    const bonus = Number(bonuses[member.id] || 0)
    if (!Number.isInteger(bonus) || bonus < 0) return alert('กรุณากรอกโบนัสเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป')
    if (!window.confirm(`ยืนยันจ่ายให้ ${member.name}\nค่าคอมมิชชัน ¥${member.commission.toLocaleString()}${bonus ? `\nโบนัส ¥${bonus.toLocaleString()}` : ''}\nรวม ¥${(member.commission + bonus).toLocaleString()}`)) return

    setPayingStaffId(member.id)
    const { error } = await supabase.rpc('record_staff_payroll', {
      p_staff_id: member.id,
      p_bill_ids: member.billIds,
      p_bonus: bonus,
    })
    setPayingStaffId(null)

    if (error) {
      console.error('[Ghost Lab] Failed to record payroll:', error)
      alert(`บันทึกการจ่ายไม่สำเร็จ: ${error.message}`)
      return
    }

    setTodayBills(current => current.filter(bill => !member.billIds.includes(bill.id)))
    setBonuses(current => ({ ...current, [member.id]: '' }))
    await loadPayHistory()
    alert(`บันทึกการจ่ายให้ ${member.name} เรียบร้อยแล้ว`)
  }

  async function toggleAttendance() {
    if (!staff?.id || attendanceSaving) return
    if (!openAttendance && !staff.primary_branch) return alert('ยังไม่ได้กำหนดสาขาหลักให้พนักงานคนนี้')
    setAttendanceSaving(true)
    const { data, error } = openAttendance
      ? await supabase.from('attendance').update({ clock_out: new Date().toISOString(), clock_out_source: 'manual' }).eq('id', openAttendance.id)
      : await supabase.from('attendance').insert({ staff_id: staff.id, branch_id: staff.primary_branch }).select().single()

    if (error) {
      console.error(error)
      alert(`บันทึกเวลาไม่สำเร็จ: ${error.message}`)
      setAttendanceSaving(false)
      return
    }

    if (openAttendance) {
      setOpenAttendance(null)
      setOnShiftCount(count => Math.max(0, count - 1))
    } else {
      setOpenAttendance(data)
      setOnShiftCount(count => count + 1)
    }
    setAttendanceSaving(false)
  }

  const filteredBills = branchFilter === 'all'
    ? todayBills
    : todayBills.filter(b => b.branches?.key === branchFilter)

  const garageBills = todayBills.filter(b => b.branches?.key === 'garage')
  const chillBills = todayBills.filter(b => b.branches?.key === 'chill')
  const garageTotal = garageBills.reduce((a, b) => a + b.total, 0)
  const chillTotal = chillBills.reduce((a, b) => a + b.total, 0)
  const todayRevenue = todayBills.reduce((a, b) => a + b.total, 0)
  const unpaidBills = filteredBills.filter(bill => !bill.pay_period_id)
  const commissionPending = unpaidBills.reduce((a, b) => a + (b.commission || 0), 0)
  const commissionForHome = hasOwnerOverview ? commissionPending : personalCommission
  const teamSummary = Object.values(unpaidBills.reduce((summary, bill) => {
    const key = bill.staff_id || 'unknown'
    const current = summary[key] || { id: key, name: bill.staff?.name_en || 'ไม่ระบุพนักงาน', bills: 0, total: 0, commission: 0, billIds: [] }
    summary[key] = { ...current, bills: current.bills + 1, total: current.total + bill.total, commission: current.commission + Number(bill.commission || 0), billIds: [...current.billIds, bill.id] }
    return summary
  }, {})).sort((a, b) => b.total - a.total)

  return (
    <div className="home-dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero__shade" />
        <div className="dashboard-hero__copy">
          <span className="dashboard-hero__eyebrow">SABINAGISA · JAPAN HOSPITALITY</span>
          <h2>ค่ำคืนที่ทุกช่วงเวลา<br />มีความหมาย</h2>
          <p>Operations Desk · Ghost Group</p>
        </div>
        <div className="dashboard-hero__status">
          <div><b className={openAttendance ? 'is-online' : ''}>{openAttendance ? '● Open Now' : '○ Offline'}</b><span>{openAttendance ? 'กำลังปฏิบัติงาน' : 'ยังไม่ได้เข้างาน'}</span></div>
          <div><b>{onShiftCount}</b><span>Staff On Work</span></div>
          <div><b>{new Date().getHours() >= 18 || new Date().getHours() < 6 ? 'PEAK' : 'NORMAL'}</b><span>18:00 – 05:59</span></div>
        </div>
      </section>
      <div className="panel" style={{
        background: 'linear-gradient(120deg, rgba(196,30,42,0.14), transparent 60%), var(--static)',
        padding: '26px 30px', marginBottom: 20, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 14
      }}>
        <div>
          <div className="font-display" style={{ fontSize: 11, letterSpacing: 2, color: 'var(--blood)', textTransform: 'uppercase', marginBottom: 8 }}>
            GHOST LAB · 夢島 · 職人の誇り
          </div>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 600 }}>
            สวัสดี, {staff?.name_en} 👋
          </div>
        </div>
        <div style={{ alignItems: 'flex-end', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ color: openAttendance ? '#7ee2a5' : 'var(--ghost-gray)', fontSize: 11, fontWeight: 600, letterSpacing: .7 }}>
            {openAttendance ? '● ออนไลน์ · เข้างานแล้ว' : '○ ออฟไลน์ · ยังไม่เข้างาน'}
          </span>
          <button type="button" onClick={toggleAttendance} className={openAttendance ? 'btn' : 'btn btn-primary'} style={{ borderColor: openAttendance ? 'rgba(255,255,255,.22)' : undefined, fontSize: 12, minWidth: 125, opacity: attendanceSaving ? .6 : 1 }}>
            {attendanceSaving ? 'กำลังบันทึก...' : openAttendance ? '◼ เลิกงาน' : '● เข้างาน'}
          </button>
        </div>
      </div>

      <BranchFilter value={branchFilter} onChange={setBranchFilter} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 18px' }}>
        {Object.entries(periodLabels).map(([key, label]) => <button key={key} type="button" onClick={() => setPeriod(key)} className="btn" style={{ background: period === key ? 'rgba(196,30,42,.16)' : 'transparent', borderColor: period === key ? 'var(--blood)' : 'var(--line)', color: period === key ? 'var(--bone)' : 'var(--ghost-gray)', fontSize: 11 }}>{label}</button>)}
        <label className="btn" style={{ alignItems: 'center', background: period === 'date' ? 'rgba(196,30,42,.16)' : 'transparent', borderColor: period === 'date' ? 'var(--blood)' : 'var(--line)', color: period === 'date' ? 'var(--bone)' : 'var(--ghost-gray)', cursor: 'pointer', display: 'flex', fontSize: 11, gap: 7, padding: '0 10px' }}>
          เลือกวัน
          <input type="date" value={selectedDate} onChange={event => { setSelectedDate(event.target.value); setPeriod('date') }} style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', font: 'inherit', outline: 0, padding: '8px 0' }} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label={`ยอด${periodLabel} · GARAGE`} value={`¥${garageTotal.toLocaleString()}`} meta={`${garageBills.length} บิล`} dim={branchFilter === 'chill'} />
        <StatCard label={`ยอด${periodLabel} · GHOST CHILL`} value={`¥${chillTotal.toLocaleString()}`} meta={`${chillBills.length} บิล`} dim={branchFilter === 'garage'} />
        <StatCard label={hasOwnerOverview ? `COMMISSION ${periodLabel}` : `ค่าคอมของฉัน ${periodLabel}`} value={`¥${commissionForHome.toLocaleString()}`} meta={hasOwnerOverview ? undefined : `${personalCommissionBills} บิล`} accent />
        <button type="button" onClick={() => setShowOnShiftStaff(true)} aria-label="ดูรายชื่อพนักงานที่เข้างาน" style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <StatCard label="พนักงานเข้างาน" value={`${onShiftCount} คน`} meta="กดดูรายชื่อ" />
        </button>
      </div>

      <section className="home-onwork panel" aria-label="พนักงานที่กำลังทำงาน">
        <div className="home-onwork__header"><div><span>TEAM LIVE</span><h3>พนักงานที่ On Work อยู่ตอนนี้</h3></div><button type="button" className="btn" onClick={() => setShowOnShiftStaff(true)}>ดูทั้งหมด →</button></div>
        {onShiftStaff.length === 0
          ? <p className="home-onwork__empty">ยังไม่มีพนักงานเข้างานในตอนนี้</p>
          : <div className="home-onwork__list">{onShiftStaff.slice(0, 8).map(member => <div key={`${member.branch_id}-${member.id}`} className="home-onwork__person"><span>{member.name_en?.slice(0, 2).toUpperCase()}</span><strong>{member.name_en}</strong><small>{member.branch_name || 'Ghost Group'}</small><em>●</em></div>)}</div>}
      </section>

      {showOnShiftStaff && (
        <div role="presentation" onClick={event => { if (event.target === event.currentTarget) setShowOnShiftStaff(false) }} style={{ alignItems: 'center', background: 'rgba(0,0,0,.62)', display: 'flex', inset: 0, justifyContent: 'center', padding: 18, position: 'fixed', zIndex: 30 }}>
          <section role="dialog" aria-modal="true" aria-label="พนักงานที่เข้างานอยู่" className="panel" style={{ maxWidth: 430, width: '100%' }}>
            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>พนักงานที่เข้างานอยู่</div>
                <div style={{ color: 'var(--ghost-gray)', fontSize: 11, marginTop: 3 }}>{onShiftStaff.length} คน</div>
              </div>
              <button type="button" className="btn" onClick={() => setShowOnShiftStaff(false)} style={{ fontSize: 12 }}>ปิด</button>
            </div>
            {onShiftStaff.length === 0
              ? <div style={{ color: 'var(--ghost-gray)', fontSize: 12, padding: '14px 0', textAlign: 'center' }}>ยังไม่มีพนักงานเข้างาน</div>
              : onShiftStaff.map(member => (
                <div key={`${member.branch_id}-${member.id}`} style={{ alignItems: 'center', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                  <div><strong style={{ fontSize: 13 }}>{member.name_en}</strong><div style={{ color: 'var(--ghost-gray)', fontSize: 10, marginTop: 3 }}>{member.branch_name || 'ไม่ระบุสาขา'}</div></div>
                  <span className="font-mono" style={{ color: '#84d6a8', fontSize: 11 }}>{new Date(member.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
          </section>
        </div>
      )}

      {hasOwnerOverview && (
        <section style={{ marginBottom: 22 }}>
          <div className="font-display" style={{ color: 'var(--blood)', fontSize: 12, letterSpacing: 1.2, marginBottom: 10 }}>OWNER OVERVIEW · {periodLabel}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14 }}>
            <StatCard label={`รายได้รวม${periodLabel}`} value={`¥${todayRevenue.toLocaleString()}`} meta={`${todayBills.length} บิลจากทุกสาขา`} accent />
            <StatCard label="รายได้ Garage" value={`¥${garageTotal.toLocaleString()}`} meta={`${garageBills.length} บิล`} />
            <StatCard label="รายได้ Ghost Chill" value={`¥${chillTotal.toLocaleString()}`} meta={`${chillBills.length} บิล`} />
          </div>
        </section>
      )}

      {hasOwnerOverview && (
        <section className="panel" style={{ marginBottom: 22 }}>
          <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div><div className="font-display" style={{ fontSize: 14, fontWeight: 600 }}>บิลของทีม · {periodLabel}</div><div style={{ color: 'var(--ghost-gray)', fontSize: 11, marginTop: 3 }}>สรุปบิลที่พนักงานทุกคนเปิด แยกจากรายการล่าสุด</div></div>
            <span style={{ color: 'var(--ghost-gray)', fontSize: 11 }}>{teamSummary.length} คน</span>
          </div>
          {teamSummary.length === 0 ? <div style={{ color: 'var(--ghost-gray)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>ไม่มีค่าคอมมิชชันค้างจ่ายในช่วงเวลานี้</div> : teamSummary.map(member => {
            const bonus = Number(bonuses[member.id] || 0)
            return (
            <div key={member.id} style={{ alignItems: 'center', borderTop: '1px solid var(--line)', display: 'grid', gap: 14, gridTemplateColumns: 'minmax(150px, 1fr) auto 130px 125px', padding: '12px 0' }}>
              <div><strong style={{ fontSize: 13 }}>{member.name}</strong><span style={{ color: 'var(--ghost-gray)', fontSize: 11, marginLeft: 8 }}>{member.bills} บิล</span></div>
              <div style={{ textAlign: 'right' }}><div style={{ color: 'var(--ghost-gray)', fontSize: 9, letterSpacing: .7 }}>ค่าคอมมิชชัน</div><strong className="font-mono" style={{ color: '#e5c158', fontSize: 13 }}>¥{member.commission.toLocaleString()}</strong></div>
              <label style={{ display: 'grid', gap: 4 }}><span style={{ color: 'var(--ghost-gray)', fontSize: 9, letterSpacing: .7 }}>โบนัส</span><input type="number" min="0" step="1" value={bonuses[member.id] ?? ''} onChange={event => setBonuses(current => ({ ...current, [member.id]: event.target.value }))} placeholder="0" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--bone)', fontFamily: 'inherit', padding: '8px 10px', width: '100%' }} /></label>
              <button type="button" onClick={() => recordPayment(member)} disabled={Boolean(payingStaffId)} className="btn btn-primary" style={{ opacity: payingStaffId ? .6 : 1 }}>{payingStaffId === member.id ? 'กำลังบันทึก...' : `บันทึกจ่าย ¥${(member.commission + bonus).toLocaleString()}`}</button>
            </div>
          )})}
        </section>
      )}

      {hasOwnerOverview && payHistory.length > 0 && (
        <section className="panel" style={{ marginBottom: 22 }}>
          <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>ประวัติการจ่ายล่าสุด</div>
          {payHistory.map(payment => <div key={payment.id} style={{ alignItems: 'center', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}><div><strong style={{ fontSize: 12 }}>{payment.staff?.name_en}</strong><span style={{ color: 'var(--ghost-gray)', fontSize: 10, marginLeft: 8 }}>{payment.bill_count || 0} บิล · โบนัส ¥{Number(payment.bonus || 0).toLocaleString()}</span></div><div style={{ textAlign: 'right' }}><strong className="font-mono" style={{ color: '#84d6a8', fontSize: 13 }}>¥{Number(payment.amount || 0).toLocaleString()}</strong><div style={{ color: 'var(--ghost-gray)', fontSize: 9 }}>{payment.paid_at ? new Date(payment.paid_at).toLocaleString('th-TH') : ''}</div></div></div>)}
        </section>
      )}

      <div className="panel">
        <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>ออเดอร์ล่าสุด · {periodLabel}</div>
        {filteredBills.length === 0
          ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ghost-gray)', fontSize: 12 }}>ยังไม่มีออเดอร์ในช่วงเวลานี้</div>
          : filteredBills.slice(0, 10).map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <span className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>{b.bill_number}</span>
                <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--ghost-gray)' }}>{b.branches?.name}</span>
                <div style={{ color: 'var(--ghost-gray)', fontSize: 10, marginTop: 4 }}>
                  สร้างบิล {b.created_at ? new Date(b.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—'} น.
                </div>
              </div>
              <div className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>¥{b.total.toLocaleString()}</div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

function StatCard({ label, value, meta, accent, dim }) {
  return (
    <div className="panel" style={{ opacity: dim ? 0.4 : 1 }}>
      <div style={{ fontSize: 12, color: 'var(--ghost-gray)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: accent ? 'var(--blood)' : 'var(--bone)' }}>{value}</div>
      {meta && <div style={{ fontSize: 12, color: 'var(--ghost-gray)', marginTop: 6 }}>{meta}</div>}
    </div>
  )
}
