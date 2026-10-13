import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Attendance() {
  const { staff } = useAuth()
  const [openEntry, setOpenEntry] = useState(null)
  const [todayLog, setTodayLog] = useState([])
  const [now, setNow] = useState(new Date())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { if (staff) loadToday() }, [staff])

  async function loadToday() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('staff_id', staff.id)
      .gte('clock_in', todayStart.toISOString())
      .order('clock_in', { ascending: false })
    setTodayLog(data || [])
    setOpenEntry((data || []).find(e => !e.clock_out) || null)
  }

  async function clockIn() {
    if (saving) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('clock_staff_attendance', { p_action: 'clock_in' })
      if (error) throw error
      await loadToday()
    } catch (error) { alert(`ลงเวลาเข้างานไม่สำเร็จ: ${error.message}`) }
    finally { setSaving(false) }
  }

  async function clockOut() {
    if (!openEntry) return
    if (saving) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('clock_staff_attendance', { p_action: 'clock_out' })
      if (error) throw error
      await loadToday()
    } catch (error) { alert(`ลงเวลาออกงานไม่สำเร็จ: ${error.message}`) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 30, marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 38, fontWeight: 700 }}>{now.toLocaleTimeString('th-TH', { hour12: false })}</div>
          <span style={{
            display: 'inline-block', marginTop: 8, fontSize: 12, padding: '3px 10px', borderRadius: 10,
            border: '1px solid var(--line)', color: openEntry ? '#3FB950' : 'var(--ghost-gray)',
            borderColor: openEntry ? '#3FB950' : 'var(--line)'
          }}>
            {openEntry ? '● ON SHIFT' : '○ OFF SHIFT'}
          </span>
        </div>
        <button type="button" onClick={openEntry ? clockOut : clockIn} className="btn btn-primary" disabled={saving} aria-busy={saving}>
          {saving ? 'กำลังบันทึก…' : openEntry ? '⏱ Clock Out' : '⏱ Clock In'}
        </button>
      </div>

      {staff?.branches?.key === 'garage' && ['head_mechanic', 'mechanic', 'mechanic_trainee'].includes(staff.role) && (
        <div className="panel" role="status" style={{ marginBottom: 16, color: 'var(--ghost-gray)', fontSize: 12 }}>
          NORMAL — ¥10,000 · PEAK — ¥15,000 · Peak Time 18:00–00:00
          {openEntry?.garage_commission_period && <strong style={{ color: 'var(--bone)', marginLeft: 10 }}>
            กะนี้: {openEntry.garage_commission_period === 'peak' ? 'Peak' : 'Normal'} · ¥{Number(openEntry.garage_commission_amount || 0).toLocaleString()}
          </strong>}
        </div>
      )}

      <div className="panel">
        <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>บันทึกเข้า/ออกงานวันนี้</div>
        {todayLog.length === 0
          ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ghost-gray)', fontSize: 11 }}>ยังไม่มีการลงเวลา</div>
          : todayLog.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
              <span>เข้า {new Date(e.clock_in).toLocaleTimeString('th-TH', { hour12: false })}{e.garage_commission_period && <small style={{ color: 'var(--ghost-gray)', display: 'block' }}>{e.garage_commission_period === 'peak' ? 'Peak' : 'Normal'} · ¥{Number(e.garage_commission_amount || 0).toLocaleString()}</small>}</span>
              <span>{e.clock_out ? `ออก ${new Date(e.clock_out).toLocaleTimeString('th-TH', { hour12: false })}` : '—'}</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}
