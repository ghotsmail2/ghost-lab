import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { bangkokDateKey } from '../lib/bangkokDate'
import { fetchAllPages } from '../lib/fetchAllPages'
import { ArrowDownWideNarrow, ArrowUpDown, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, Clock3, Copy, Eye, FileText, History, ListFilter, Search, Store, Users, Wallet, X } from 'lucide-react'
import './CommissionPayouts.css'

const money = value => `¥${Number(value || 0).toLocaleString()}`
const dateKey = bangkokDateKey
const rangeBounds = (from, to) => ({ start: new Date(`${from}T00:00:00+07:00`).toISOString(), end: new Date(`${to}T23:59:59.999+07:00`).toISOString() })

export default function CommissionPayouts() {
  const { staff } = useAuth()
  const isOwner = staff?.role === 'owner' || staff?.role === 'god'
  const today = dateKey(new Date())
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 7)}-01`)
  const [dateTo, setDateTo] = useState(today)
  const [branches, setBranches] = useState([])
  const [staffDirectory, setStaffDirectory] = useState([])
  const [distributions, setDistributions] = useState([])
  const [hourlyCommissions, setHourlyCommissions] = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('largest')
  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState(null)
  const [bonus, setBonus] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [acknowledging, setAcknowledging] = useState('')
  const [copied, setCopied] = useState('')
  const [notice, setNotice] = useState('')
  const latestLoad = useRef(0)

  const load = useCallback(async () => {
    if (!staff?.id) return
    const requestNumber = ++latestLoad.current
    const bounds = rangeBounds(dateFrom, dateTo)
    setLoading(true)
    setError('')
    const distributionQuery = supabase.from('commission_distributions')
      .select('id,bill_id,user_id,user_name_snapshot,amount,commission_mode,commission_policy,commission_period,commission_attendance_id,created_at,paid_at,reversed_at,recipient:user_id(id,name_en,avatar_url),bill:bill_id(id,bill_number,total,branch_id,commission,commission_policy,commission_period,commission_attendance_id,created_at,status,branches:branch_id(id,key,name))')
      .is('reversed_at', null).gte('created_at', bounds.start).lte('created_at', bounds.end)
      .order('created_at', { ascending: false }).order('id', { ascending: true })
    const payoutQuery = supabase.from('commission_payouts')
      .select('*,staff:staff_id(id,name_en,avatar_url),branches:branch_id(id,key,name),payer:paid_by(name_en)')
      .gte('paid_at', bounds.start).lte('paid_at', bounds.end)
      .order('paid_at', { ascending: false }).order('id', { ascending: true })
    const hourlyQuery = supabase.from('garage_technician_hourly_commissions')
      .select('id,staff_id,branch_id,amount,period_start,period_end,paid_at,payout_id,staff:staff_id(id,name_en,avatar_url),branches:branch_id(id,key,name)')
      .gte('period_end', bounds.start).lte('period_end', bounds.end)
      .order('period_end', { ascending: false })
    const branchQuery = supabase.from('branches').select('id,key,name').order('name')
    try {
      const [distributionResult, payoutResult, branchResult, directoryResult, hourlyResult] = await Promise.all([
        fetchAllPages(isOwner ? distributionQuery : distributionQuery.eq('user_id', staff.id)),
        fetchAllPages(isOwner ? payoutQuery : payoutQuery.eq('staff_id', staff.id)),
        branchQuery,
        isOwner ? supabase.from('staff_admin_directory').select('id,phone,avatar_url') : Promise.resolve({ data: [], error: null }),
        fetchAllPages(isOwner ? hourlyQuery : hourlyQuery.eq('staff_id', staff.id)),
      ])
      if (requestNumber !== latestLoad.current) return
      if (branchResult.error) throw branchResult.error
      if (directoryResult.error) throw directoryResult.error
      if (hourlyResult?.error) throw hourlyResult.error
      setDistributions(distributionResult.filter(row => row.bill?.status !== 'rejected' && row.bill?.status !== 'cancelled'))
      setHourlyCommissions(hourlyResult || [])
      setPayouts(payoutResult)
      setBranches(branchResult.data || [])
      setStaffDirectory(directoryResult.data || [])
    } catch (error) {
      console.error('[Ghost Lab] Commission data failed to load:', error)
      if (requestNumber === latestLoad.current) setError(`โหลดข้อมูลค่าคอมไม่สำเร็จ: ${error.message || 'กรุณาลองอีกครั้ง'}`)
    } finally {
      if (requestNumber === latestLoad.current) setLoading(false)
    }
  }, [staff?.id, isOwner, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    const map = new Map()
    const privateDirectory = new Map(staffDirectory.map(employee => [employee.id, employee]))
    for (const row of distributions) {
      const employee = row.recipient || {}
      const privateEmployee = isOwner ? privateDirectory.get(row.user_id) : null
      const branch = row.bill?.branches || {}
      const groupKey = `${row.user_id || row.user_name_snapshot}-${row.bill?.branch_id || 'shared'}`
      if (!map.has(groupKey)) map.set(groupKey, {
        staffId: row.user_id, name: employee.name_en || row.user_name_snapshot || 'ไม่ทราบชื่อ',
        phone: privateEmployee?.phone || '', avatar: privateEmployee?.avatar_url || employee.avatar_url || '', branchId: row.bill?.branch_id,
        branch: branch.name || 'ส่วนกลาง', branchKey: branch.key || 'shared', entries: [], total: 0,
        outstanding: 0, paid: 0, sales: 0, hourlyOutstanding: 0, hourlyEntries: [],
      })
      const group = map.get(groupKey)
      group.entries.push(row)
      group.total += Number(row.amount || 0)
      group.sales += Number(row.bill?.total || 0)
      if (row.paid_at) group.paid += Number(row.amount || 0)
      else group.outstanding += Number(row.amount || 0)
    }
    for (const entry of hourlyCommissions) {
      const branch = entry.branches || {}
      // Keep bill and hourly commission rows together for the same person/branch.
      const groupKey = `${entry.staff_id}-${entry.branch_id}`
      if (!map.has(groupKey)) map.set(groupKey, {
        staffId: entry.staff_id, name: entry.staff?.name_en || 'ไม่ทราบชื่อ',
        phone: '', avatar: entry.staff?.avatar_url || '', branchId: entry.branch_id,
        branch: branch.name || 'Ghost Lab Garage', branchKey: branch.key || 'garage', entries: [], total: 0,
        outstanding: 0, paid: 0, sales: 0, hourlyOutstanding: 0, hourlyEntries: [],
      })
      const group = map.get(groupKey)
      group.hourlyEntries.push(entry)
      group.total += Number(entry.amount || 0)
      if (entry.paid_at) group.paid += Number(entry.amount || 0)
      else { group.outstanding += Number(entry.amount || 0); group.hourlyOutstanding += Number(entry.amount || 0) }
    }
    return [...map.values()].map(group => ({
      ...group,
      hourlyOnly: group.entries.length === 0 && group.hourlyEntries.length > 0,
      bills: group.entries.length,
      status: group.outstanding > 0 && group.paid > 0 ? 'partial' : group.outstanding > 0 ? 'pending' : 'paid',
      unpaidEntries: group.entries.filter(row => !row.paid_at),
      unpaidHourlyEntries: group.hourlyEntries.filter(row => !row.paid_at),
    }))
  }, [distributions, hourlyCommissions, staffDirectory, isOwner])

  const matching = grouped.filter(group => {
    const branchMatch = branchFilter === 'all' || group.branchKey === branchFilter
    const statusMatch = statusFilter === 'all' || group.status === statusFilter
    const query = search.trim().toLocaleLowerCase()
    const searchMatch = !query || `${group.name} ${group.phone} ${group.branch}`.toLocaleLowerCase().includes(query)
    return branchMatch && statusMatch && searchMatch
  }).sort((a, b) => sortOrder === 'smallest' ? a.outstanding - b.outstanding : sortOrder === 'name' ? a.name.localeCompare(b.name) : b.outstanding - a.outstanding)

  const scopedGroups = grouped.filter(group => branchFilter === 'all' || group.branchKey === branchFilter)
  const pendingGroups = scopedGroups.filter(group => group.outstanding > 0)
  const totals = {
    outstanding: scopedGroups.reduce((value, group) => value + group.outstanding, 0),
    paid: payouts.filter(payout => branchFilter === 'all' || payout.branches?.key === branchFilter).reduce((value, payout) => value + Number(payout.total_amount || 0), 0),
    people: pendingGroups.length,
    bills: new Set(pendingGroups.flatMap(group => group.unpaidEntries.map(row => row.bill_id))).size,
  }
  const topPending = [...pendingGroups].sort((a, b) => b.outstanding - a.outstanding).slice(0, 3)
  const branchGroups = branches.map(branch => ({ ...branch, rows: matching.filter(group => group.branchKey === branch.key) })).filter(branch => branch.rows.length)
  const nextPayout = [...pendingGroups].sort((a, b) => b.outstanding - a.outstanding)[0]

  async function copyPhone(phone) {
    if (!phone) return
    try { await navigator.clipboard.writeText(phone); setCopied(phone); window.setTimeout(() => setCopied(''), 1300) }
    catch { setNotice('คัดลอกไม่ได้ กรุณาคัดลอกเบอร์ IC ด้วยตนเอง'); window.setTimeout(() => setNotice(''), 2600) }
  }

  async function submitPayout() {
    if (!selected || saving) return
    const { group, type } = selected
    const amount = Number(bonus || 0)
    if (type === 'bills' && (!Number.isInteger(amount) || amount < 0)) return setError('กรุณากรอกโบนัสเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป')
    setSaving(true)
    setError('')
    const { error: payoutError } = type === 'hourly'
      ? await supabase.rpc('pay_garage_hourly_commission', {
        p_staff_id: group.staffId,
        p_hourly_commission_ids: group.unpaidHourlyEntries.map(row => row.id),
        p_reference: reference.trim() || null,
        p_note: note.trim() || null,
      })
      : await supabase.rpc('pay_staff_commission', {
        p_staff_id: group.staffId,
        p_bill_ids: group.unpaidEntries.map(row => row.bill_id),
        p_reference: reference.trim() || null,
        p_note: note.trim() || null,
        p_bonus: amount,
      })
    setSaving(false)
    if (payoutError) { setError(payoutError.message); return }
    setSelected(null); setBonus(''); setReference(''); setNote('')
    setNotice(`บันทึกการจ่าย${type === 'hourly' ? 'ค่าชั่วโมง' : 'ค่าบิล'}ให้ ${group.name} แล้ว`)
    window.setTimeout(() => setNotice(''), 3000)
    await load()
  }

  async function acknowledge(payoutId) {
    setAcknowledging(payoutId)
    const { error: ackError } = await supabase.rpc('acknowledge_my_commission', { p_payout_id: payoutId })
    setAcknowledging('')
    if (ackError) { setError(ackError.message); return }
    await load()
  }

  return <main className="commission-console">
    <header className="commission-console__hero"><div><span>OPERATIONS WORKSPACE</span><h1>ค่าคอม & การจ่าย</h1><p>Commission Payouts · ตรวจสอบยอดค้างและประวัติการจ่าย</p></div><div className="commission-console__hero-meta"><span>{dateFrom} — {dateTo}</span><strong><span /> ระบบปกติ</strong></div></header>
    {error && <div className="commission-console__error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="ปิด"><X size={15} /></button></div>}
    {notice && <div className="commission-console__notice" role="status"><CheckCircle2 size={16} />{notice}</div>}

    {isOwner && <>
      <section className="commission-console__metrics">
        <Metric Icon={CircleDollarSign} tone="orange" label="ยอดรอจ่ายทั้งหมด" value={money(totals.outstanding)} detail={`${scopedGroups.reduce((sum, group) => sum + group.bills, 0).toLocaleString()} รายการค่าคอม`} />
        <Metric Icon={Users} tone="orange" label="พนักงานรอรับ" value={`${totals.people.toLocaleString()} คน`} detail="จากผู้รับค่าคอมทั้งหมด" />
        <Metric Icon={FileText} tone="amber" label="บิลที่ยังไม่จ่ายค่าคอม" value={`${totals.bills.toLocaleString()} บิล`} detail="นับบิลที่มีค่าคอมค้าง" />
        <Metric Icon={CheckCircle2} tone="green" label="จ่ายแล้วในช่วงนี้" value={money(totals.paid)} detail={`${payouts.length.toLocaleString()} รายการจ่าย`} />
      </section>
      <section className="commission-console__filters">
        <label className="commission-console__search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาพนักงาน, รหัส IC, หรือสาขา..." /></label>
        <label className="commission-console__date"><CalendarDays size={16} /><input type="date" aria-label="วันที่เริ่ม" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /><span>—</span><input type="date" aria-label="วันที่สิ้นสุด" value={dateTo} onChange={event => setDateTo(event.target.value)} /></label>
        <label className="commission-console__select"><Store size={15} /><select aria-label="สาขา" value={branchFilter} onChange={event => setBranchFilter(event.target.value)}><option value="all">ทุกสาขา</option>{branches.map(branch => <option key={branch.id} value={branch.key}>{branch.name}</option>)}</select><ChevronDown size={14} /></label>
        <label className="commission-console__select"><ListFilter size={15} /><select aria-label="สถานะ" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">ทุกสถานะ</option><option value="pending">รอจ่าย</option><option value="partial">จ่ายบางส่วน</option><option value="paid">จ่ายแล้ว</option></select><ChevronDown size={14} /></label>
        <label className="commission-console__select commission-console__sort"><ArrowDownWideNarrow size={15} /><select aria-label="เรียงลำดับ" value={sortOrder} onChange={event => setSortOrder(event.target.value)}><option value="largest">ยอดค้างมาก → น้อย</option><option value="smallest">ยอดค้างน้อย → มาก</option><option value="name">ชื่อพนักงาน</option></select><ChevronDown size={14} /></label>
      </section>
      <section className="commission-console__workspace"><div className="commission-console__tables">{branchGroups.map(branch => <BranchTable key={branch.id} branch={branch} rows={branch.rows} loading={loading} onPay={(group, type) => { setSelected({ group, type }); setBonus(''); setReference(''); setNote(''); setError('') }} onDetails={setDetails} onCopy={copyPhone} copied={copied} />)}{!loading && !branchGroups.length && <div className="commission-console__empty panel"><CheckCircle2 size={28} /><strong>{grouped.length ? 'ไม่พบรายการตามตัวกรอง' : 'ไม่มีรายการค่าคอมในช่วงวันที่นี้'}</strong><span>ลองเปลี่ยนสาขา สถานะ หรือช่วงวันที่</span></div>}</div>
        <aside className="commission-console__side">
          <section className="commission-console__side-card"><div className="commission-console__side-head"><span><Users size={18} /><b>Top Pending</b></span><small>พนักงานที่มียอดรอจ่ายสูงสุด</small></div>{topPending.length ? topPending.map((row,index) => <div className="commission-console__top-row" key={`${row.staffId}-${row.branchKey}`}><span className="commission-console__rank">{index + 1}</span><Avatar name={row.name} src={row.avatar} /><span className="commission-console__top-name"><strong>{row.name}</strong><small>{row.branch}</small></span><b>{money(row.outstanding)}</b></div>) : <p className="commission-console__side-empty">ไม่มีค่าคอมค้างจ่าย</p>}</section>
          <section className="commission-console__next"><div className="commission-console__side-head"><span><CalendarDays size={18} /><b>รอบจ่ายถัดไป</b></span></div><div className="commission-console__next-inner"><span className="commission-console__next-icon"><Clock3 size={23} /></span><div><strong>{nextPayout ? 'ยอดที่รอจ่ายอยู่' : 'ไม่มีรายการรอจ่าย'}</strong><small>{nextPayout ? `${pendingGroups.length} คน · ${totals.bills} บิลที่ยังไม่จ่าย` : 'ค่าคอมในช่วงนี้ถูกจ่ายครบแล้ว'}</small><b>{money(totals.outstanding)}</b></div></div><p>การจ่ายจะเกิดขึ้นเมื่อ Owner บันทึกรายการจ่าย</p></section>
          <section className="commission-console__side-card"><div className="commission-console__side-head"><span><History size={18} /><b>ประวัติการจ่ายล่าสุด</b></span><small>{payouts.length} รายการ</small></div>{payouts.slice(0, 6).map(payout => <div className="commission-console__history-row" key={payout.id}><Avatar name={isOwner ? payout.staff?.name_en : payout.payer?.name_en} src={isOwner ? payout.staff?.avatar_url : ''} /><span><strong>{isOwner ? payout.staff?.name_en || 'พนักงาน' : `จ่ายโดย ${payout.payer?.name_en || 'Owner'}`}</strong><small>{payout.branches?.name || '—'} · {new Date(payout.paid_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}</small></span><b>{money(payout.total_amount)}</b></div>)}{!payouts.length && <p className="commission-console__side-empty">ยังไม่มีประวัติในช่วงวันที่นี้</p>}</section>
        </aside>
      </section>
      <footer className="commission-console__notice-bar"><CircleDollarSign size={17} /><span>สำหรับทีมการเงิน: กรุณาตรวจสอบยอดบิลและค่าคอมก่อนดำเนินการจ่าย ระบบบันทึกการจ่ายจากรายการผู้รับที่อยู่ใน snapshot ของแต่ละบิล</span></footer>
    </>}

    {!isOwner && <StaffCommissionView distributions={distributions} hourlyCommissions={hourlyCommissions} payouts={payouts} loading={loading} acknowledging={acknowledging} onAcknowledge={acknowledge} dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />}

    {selected && <PayoutModal group={selected.group} type={selected.type} bonus={bonus} setBonus={setBonus} reference={reference} setReference={setReference} note={note} setNote={setNote} saving={saving} error={error} onClose={() => { setSelected(null); setError('') }} onSubmit={submitPayout} />}
    {details && <DetailsModal group={details} onClose={() => setDetails(null)} />}
  </main>
}

function Metric({ Icon, tone, label, value, detail }) { return <article className={`commission-console__metric is-${tone}`}><span className="commission-console__metric-icon"><Icon size={24} strokeWidth={2} /></span><div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div></article> }

function BranchTable({ branch, rows, loading, onPay, onDetails, onCopy, copied }) {
  const totalPending = rows.reduce((sum, row) => sum + row.outstanding, 0)
  return <section className={`commission-console__branch commission-console__branch--${branch.key}`}><header><span><Store size={19} /><span><strong>{branch.name}</strong><small>{branch.key === 'chill' ? 'SABINAGISA · RESTAURANT' : branch.key === 'garage' ? 'GHOST LAB GARAGE' : 'GHOST GROUP'}</small></span></span><div><small>ยอดรวมที่รอจ่ายสาขานี้</small><b>{money(totalPending)}</b></div></header><div className="commission-console__table-scroll"><table><thead><tr><th>#</th><th>พนักงาน</th><th>รหัส IC</th><th>จำนวนงาน</th><th>ยอดขาย (¥)</th><th>ค่าคอมรวม (¥)</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{rows.map((row,index) => <tr key={`${row.staffId}-${row.branchKey}`}><td>{index + 1}</td><td><span className="commission-console__employee"><Avatar name={row.name} src={row.avatar} /><strong>{row.name}</strong></span></td><td>{row.phone ? <button type="button" className="commission-console__ic" onClick={() => onCopy(row.phone)} title="คัดลอกรหัส IC">{copied === row.phone ? <><Check size={12} /> คัดลอกแล้ว</> : row.phone}</button> : <small className="commission-console__no-ic">ยังไม่มีเบอร์ IC</small>}</td><td>{row.bills > 0 && <span>{row.bills.toLocaleString()} บิล</span>}{row.hourlyEntries.length > 0 && <small className="commission-console__outstanding">{row.bills > 0 ? ' · ' : ''}{row.hourlyEntries.length} ชม.</small>}</td><td>{money(row.sales)}</td><td><strong className="commission-console__amount">{money(row.total)}</strong>{row.outstanding > 0 && <small className="commission-console__outstanding">ค้าง {money(row.outstanding)}</small>}{row.entries.length > 0 && row.hourlyEntries.length > 0 && <small className="commission-console__outstanding">บิล {money(row.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0))} · ชม. {money(row.hourlyEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0))}</small>}</td><td><StatusBadge status={row.status} /></td><td><span className="commission-console__actions">{row.unpaidEntries.length > 0 && <button type="button" className="commission-console__pay-button" onClick={() => onPay(row, 'bills')}><Wallet size={14} /> จ่ายบิล</button>}{row.unpaidHourlyEntries.length > 0 && <button type="button" className="commission-console__pay-button" onClick={() => onPay(row, 'hourly')}><Wallet size={14} /> จ่ายชั่วโมง</button>}<button type="button" className="commission-console__details-button" onClick={() => onDetails(row)} title="ดูรายละเอียด"><Eye size={15} /><span>รายละเอียด</span></button></span></td></tr>)}</tbody></table>{loading && <div className="commission-console__loading">กำลังโหลดข้อมูลค่าคอม…</div>}</div></section>
}

function StatusBadge({ status }) {
  const config = status === 'paid' ? { label: 'จ่ายแล้ว', Icon: CheckCircle2 } : status === 'partial' ? { label: 'จ่ายบางส่วน', Icon: CircleDollarSign } : { label: 'รอจ่าย', Icon: Clock3 }
  const Icon = config.Icon
  return <span className={`commission-console__status is-${status}`}><Icon size={13} />{config.label}</span>
}

function Avatar({ name, src }) { return <span className="commission-console__avatar">{src ? <img src={src} alt="" /> : (name || '?').trim().slice(0, 1).toUpperCase()}</span> }

function PayoutModal({ group, type, bonus, setBonus, reference, setReference, note, setNote, saving, error, onClose, onSubmit }) {
  const hourly = type === 'hourly'
  const count = hourly ? group.unpaidHourlyEntries.length : group.unpaidEntries.length
  const outstanding = hourly ? group.hourlyOutstanding : group.outstanding - group.hourlyOutstanding
  return <div className="commission-console__overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="commission-console__modal" role="dialog" aria-modal="true" aria-labelledby="payout-title"><header><span><Wallet size={18} /> CONFIRM PAYOUT</span><button type="button" aria-label="ปิด" onClick={onClose}><X size={18} /></button></header><h2 id="payout-title">จ่าย{hourly ? 'ค่าชั่วโมง' : 'ค่าบิล'}ให้ {group.name}</h2><p>{group.branch} · {count} {hourly ? 'ชั่วโมง' : 'บิล'}ที่ยังไม่จ่าย</p><div className="commission-console__modal-total"><small>ยอดที่จะจ่าย{hourly ? 'ค่าชั่วโมง' : 'ค่าบิล'}</small><strong>{money(outstanding + (hourly ? 0 : Number(bonus || 0)))}</strong></div>{!hourly && <label>โบนัส (ถ้ามี)<input type="number" min="0" step="1" value={bonus} onChange={event => setBonus(event.target.value)} placeholder="0" /></label>}<label>เลขอ้างอิงการโอน<input value={reference} onChange={event => setReference(event.target.value)} placeholder="ไม่บังคับ" /></label><label>หมายเหตุ<textarea value={note} onChange={event => setNote(event.target.value)} rows="2" placeholder="ไม่บังคับ" /></label>{error && <div className="commission-console__error">{error}</div>}<footer><button type="button" className="commission-console__details-button" onClick={onClose}>กลับ</button><button type="button" className="commission-console__pay-button" disabled={saving} onClick={onSubmit}>{saving ? 'กำลังบันทึก…' : <><CheckCircle2 size={16} /> ยืนยันว่าจ่ายแล้ว</>}</button></footer></section></div>
}

function DetailsModal({ group, onClose }) {
  return <div className="commission-console__overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="commission-console__modal commission-console__details-modal" role="dialog" aria-modal="true" aria-labelledby="commission-detail-title"><header><span><FileText size={18} /> PAYOUT DETAILS</span><button type="button" aria-label="ปิด" onClick={onClose}><X size={18} /></button></header><h2 id="commission-detail-title">{group.name}</h2><p>{group.branch} · {group.bills} บิล · {group.hourlyEntries.length} ชั่วโมง</p><div className="commission-console__detail-list">{group.entries.map(row => <div key={row.id}><span><strong>{row.bill?.bill_number || 'บิล'}</strong><small>{new Date(row.created_at).toLocaleString('th-TH')} · {row.commission_policy === 'garage_technician_clock_in' ? `Ghost Lab Garage · ${row.commission_period === 'peak' ? 'Peak' : row.commission_period === 'normal' ? 'Normal' : 'ไม่พบ Clock In snapshot'}` : row.commission_policy === 'sabinagisa_commission_pool' || row.commission_mode === 'ON_WORK_ALL' ? 'SABINAGISA · Restaurant Pool' : row.commission_mode === 'ON_WORK_ALL' ? 'แบ่งตามผู้เข้างาน' : 'ผู้ทำบิล'}</small></span><span><b>{money(row.amount)}</b><small className={row.paid_at ? 'is-paid' : 'is-pending'}>{row.paid_at ? 'จ่ายแล้ว' : 'รอจ่าย'}</small></span></div>)}{group.hourlyEntries.map(row => <div key={row.id}><span><strong>ชั่วโมงครบ · {new Date(row.period_end).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false})}</strong><small>{new Date(row.period_start).toLocaleString('th-TH')} – {new Date(row.period_end).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false})} · ค่าคอมช่างรายชั่วโมง</small></span><span><b>{money(row.amount)}</b><small className={row.paid_at ? 'is-paid' : 'is-pending'}>{row.paid_at ? 'จ่ายแล้ว' : 'รอจ่าย'}</small></span></div>)}</div><footer><span>รวมค่าคอม</span><strong>{money(group.total)}</strong></footer></section></div>
}

function StaffCommissionView({ distributions, hourlyCommissions, payouts, loading, acknowledging, onAcknowledge, dateFrom, dateTo, setDateFrom, setDateTo }) {
  const pending = distributions.filter(row => !row.paid_at)
  const pendingHourly = hourlyCommissions.filter(row => !row.paid_at)
  return <><section className="commission-console__metrics"><Metric Icon={CircleDollarSign} tone="orange" label="ค่าคอมรอรับ" value={money(pending.reduce((sum,row) => sum + Number(row.amount || 0),0)+pendingHourly.reduce((sum,row) => sum+Number(row.amount||0),0))} detail={`${pending.length} บิล · ${pendingHourly.length} ชั่วโมง`} /><Metric Icon={CheckCircle2} tone="green" label="ได้รับแล้วในช่วงนี้" value={money(payouts.reduce((sum,row) => sum + Number(row.total_amount || 0),0))} detail={`${payouts.length} รายการจ่าย`} /></section><div className="commission-console__staff-filter"><CalendarDays size={16} /><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /><span>—</span><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></div><section className="commission-console__staff-list"><header><h2>ค่าคอมของฉัน</h2><span>{pending.length} บิล · {pendingHourly.length} ชั่วโมงรอจ่าย</span></header>{loading ? <p className="commission-console__side-empty">กำลังโหลด…</p> : <>{distributions.map(row => <div className="commission-console__staff-row" key={row.id}><span><strong>{row.bill?.bill_number || 'บิล'}</strong><small>{row.bill?.branches?.name || '—'} · {row.commission_policy === 'garage_technician_clock_in' ? 'Ghost Lab Garage · ค่าคอมต่อบิล' : row.commission_policy === 'sabinagisa_commission_pool' ? 'SABINAGISA · Pool เดิม' : new Date(row.created_at).toLocaleDateString('th-TH')}</small></span><b>{money(row.amount)}</b><StatusBadge status={row.paid_at ? 'paid' : 'pending'} /></div>)}{hourlyCommissions.map(row => <div className="commission-console__staff-row" key={row.id}><span><strong>ค่าคอมช่าง · ครบ 1 ชั่วโมง</strong><small>{new Date(row.period_start).toLocaleString('th-TH')} – {new Date(row.period_end).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false})} · {row.amount===15000?'Peak':'ปกติ'}</small></span><b>{money(row.amount)}</b><StatusBadge status={row.paid_at ? 'paid' : 'pending'} /></div>)}</> }<div className="commission-console__staff-history">{payouts.map(payout => <div key={payout.id}><span><strong>{money(payout.total_amount)}</strong><small>{payout.branches?.name || '—'} · {new Date(payout.paid_at).toLocaleDateString('th-TH')}</small></span>{!payout.acknowledged_at ? <button type="button" className="commission-console__pay-button" disabled={acknowledging === payout.id} onClick={() => onAcknowledge(payout.id)}><Check size={15} /> {acknowledging === payout.id ? 'กำลังบันทึก…' : 'ได้รับแล้ว'}</button> : <StatusBadge status="paid" />}</div>)}</div></section></>
}
