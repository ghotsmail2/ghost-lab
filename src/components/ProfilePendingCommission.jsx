import React, { useEffect, useState } from 'react'
import { bangkokDateKey } from '../lib/bangkokDate.js'
import { loadCommissionEntries, summarizePendingCommission } from '../lib/commission-payouts.js'

export default function ProfilePendingCommission({ supabase, staffId, attendanceId }) {
  const today = bangkokDateKey()
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 7)}-01`)
  const [dateTo, setDateTo] = useState(today)
  const [branchKey, setBranchKey] = useState('all')
  const [result, setResult] = useState(null)
  const validRange = Boolean(dateFrom && dateTo && dateFrom <= dateTo)
  const scope = `${staffId}:${dateFrom}:${dateTo}:${attendanceId || ''}`

  useEffect(() => {
    if (!staffId || !validRange) return
    let active = true
    setResult(null)
    Promise.all([
      loadCommissionEntries(supabase, dateFrom, dateTo, staffId),
      supabase.from('branches').select('key,name').order('name'),
    ]).then(([entries, branches]) => {
      if (branches.error) throw branches.error
      if (active) setResult({ scope, entries, branches: branches.data || [] })
    }).catch(error => {
      console.error('[Ghost Lab] Profile commission data failed to load:', error)
      if (active) setResult({ scope, error: true })
    })
    return () => { active = false }
  }, [supabase, staffId, dateFrom, dateTo, validRange, scope])

  const current = result?.scope === scope ? result : null
  const summary = current?.entries && summarizePendingCommission(current.entries.distributions, current.entries.hourlyCommissions, branchKey)
  const selectedBranch = current?.branches?.some(branch => branch.key === branchKey)
  const status = !validRange ? 'เลือกช่วงวันที่ให้ถูกต้อง' : current?.error ? 'โหลดค่าคอมรอรับไม่สำเร็จ' : 'กำลังโหลด…'

  return (
    <div className="panel">
      <div style={{ fontSize: 11, color: 'var(--ghost-gray)', marginBottom: 8 }}>ค่าคอมรอรับ · PENDING</div>
      <div aria-live="polite">
        {summary ? <>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--blood)' }}>¥{summary.amount.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--ghost-gray)', marginTop: 6 }}>{summary.bills} บิล · {summary.hours} ชั่วโมง</div>
        </> : <div style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>{status}</div>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <label style={{ fontSize: 11 }}>จากวันที่ <input className="input" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></label>
        <label style={{ fontSize: 11 }}>ถึงวันที่ <input className="input" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></label>
        <label style={{ fontSize: 11 }}>สาขา <select className="input" value={branchKey} onChange={event => setBranchKey(event.target.value)} disabled={!current?.branches}>
          <option value="all">ทุกสาขา</option>
          {current?.branches?.map(branch => <option key={branch.key} value={branch.key}>{branch.name}</option>)}
          <option value="shared">ส่วนกลาง</option>
          {branchKey !== 'all' && branchKey !== 'shared' && !selectedBranch && <option value={branchKey}>{branchKey}</option>}
        </select></label>
      </div>
    </div>
  )
}
