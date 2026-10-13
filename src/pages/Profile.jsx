import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../lib/roles'

export default function Profile() {
  const { staff } = useAuth()
  const [now, setNow] = useState(new Date())
  const [openEntry, setOpenEntry] = useState(null)
  const [attendLog, setAttendLog] = useState([])
  const [todayBills, setTodayBills] = useState([])
  const [allBills, setAllBills] = useState([])
  const [payPeriods, setPayPeriods] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { if (staff) loadAll() }, [staff])

  async function loadAll() {
    setLoading(true)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [{ data: attendance }, { data: bills }, { data: periods }] = await Promise.all([
      supabase.from('attendance').select('*').eq('staff_id', staff.id).order('clock_in', { ascending: false }).limit(10),
      supabase.from('bills').select('*').eq('staff_id', staff.id).order('created_at', { ascending: false }),
      supabase.from('pay_periods').select('*').eq('staff_id', staff.id).order('period_start', { ascending: false }).limit(5),
    ])

    setAttendLog(attendance || [])
    setOpenEntry((attendance || []).find(e => !e.clock_out) || null)
    setAllBills(bills || [])
    setTodayBills((bills || []).filter(b => new Date(b.created_at) >= todayStart))
    setPayPeriods(periods || [])
    setLoading(false)
  }

  async function clockIn() {
    await supabase.from('attendance').insert({ staff_id: staff.id, branch_id: staff.primary_branch })
    loadAll()
  }
  async function clockOut() {
    if (!openEntry) return
    await supabase.from('attendance').update({ clock_out: new Date().toISOString(), clock_out_source: 'manual' }).eq('id', openEntry.id)
    loadAll()
  }

  const totalEarned = allBills.reduce((a, b) => a + (b.commission || 0), 0)
  const pendingPeriods = payPeriods.filter(p => p.status === 'pending')
  const pendingAmount = pendingPeriods.reduce((a, p) => a + p.amount, 0)

  if (!staff) return null

  return (
    <div>
      <div className="panel" style={{ padding: 26, marginBottom: 16 }}>
        <div className="font-display" style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>My Profile · {staff.name_en}</div>
        <div style={{ fontSize: 12, color: 'var(--ghost-gray)', marginBottom: 20 }}>{ROLE_LABELS[staff.role]}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="font-mono" style={{ fontSize: 32, fontWeight: 700 }}>{now.toLocaleTimeString('th-TH', { hour12: false })}</div>
            <span style={{
              display: 'inline-block', marginTop: 6, fontSize: 10, padding: '3px 10px', borderRadius: 10,
              border: '1px solid var(--line)', color: openEntry ? '#3FB950' : 'var(--ghost-gray)',
              borderColor: openEntry ? '#3FB950' : 'var(--line)'
            }}>
              {openEntry ? '● ON SHIFT' : '○ OFF SHIFT'}
            </span>
          </div>
          <div onClick={openEntry ? clockOut : clockIn} className="btn btn-primary">
            {openEntry ? '⏱ Clock Out' : '⏱ Clock In'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
        <div className="panel">
          <div style={{ fontSize: 11, color: 'var(--ghost-gray)', textTransform: 'uppercase', marginBottom: 8 }}>ค้างจ่าย · PENDING</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--blood)' }}>¥{pendingAmount.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--ghost-gray)', marginTop: 6 }}>{pendingPeriods.length} งวด</div>
        </div>
        <div className="panel">
          <div style={{ fontSize: 11, color: 'var(--ghost-gray)', textTransform: 'uppercase', marginBottom: 8 }}>TOTAL EARNED</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700 }}>¥{totalEarned.toLocaleString()}</div>
        </div>
        <div className="panel">
          <div style={{ fontSize: 11, color: 'var(--ghost-gray)', textTransform: 'uppercase', marginBottom: 8 }}>BILLS (ALL-TIME)</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700 }}>{allBills.length}</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>งวดจ่ายเงินของฉัน · My Pay Periods</div>
        {payPeriods.length === 0 ? (
          <div style={{ color: 'var(--ghost-gray)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
            ยังไม่มีงวดจ่าย — บัญชี/Owner จะเป็นคนสร้างงวดจ่ายให้ในหน้าค่าใช้จ่าย
          </div>
        ) : payPeriods.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: 12 }}>
              {new Date(p.period_start).toLocaleDateString('th-TH')} – {new Date(p.period_end).toLocaleDateString('th-TH')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>¥{p.amount.toLocaleString()}</span>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--line)',
                color: p.status === 'paid' ? '#3FB950' : p.status === 'pending' ? 'var(--blood)' : 'var(--ghost-gray)'
              }}>
                {p.status === 'paid' ? '✓ จ่ายแล้ว' : p.status === 'pending' ? 'ค้างจ่าย' : 'เปิด'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="panel">
          <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>บิลของวันนี้</div>
          {todayBills.length === 0 ? (
            <div style={{ color: 'var(--ghost-gray)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>ยังไม่มีบิลวันนี้</div>
          ) : todayBills.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span className="font-mono">{b.bill_number}</span>
              <span className="font-mono">¥{b.total.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>ประวัติเข้า/ออกงาน</div>
          {attendLog.length === 0 ? (
            <div style={{ color: 'var(--ghost-gray)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>ยังไม่มีประวัติ</div>
          ) : attendLog.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span>{new Date(e.clock_in).toLocaleDateString('th-TH')}</span>
              <span>
                {new Date(e.clock_in).toLocaleTimeString('th-TH', { hour12: false })}
                {' – '}
                {e.clock_out ? new Date(e.clock_out).toLocaleTimeString('th-TH', { hour12: false }) : 'ยังไม่ออก'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
