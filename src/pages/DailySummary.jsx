import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Banknote, CalendarDays, ChartNoAxesColumnIncreasing, CheckCircle2, ChevronDown, Clock3, Coins, FileText, Package, Percent, ReceiptText, Store, Wallet, XCircle } from 'lucide-react'
import './DailySummary.css'

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dayBounds = (from, to = from) => ({ start: new Date(`${from}T00:00:00+07:00`).toISOString(), end: new Date(`${to}T23:59:59.999+07:00`).toISOString() })
const money = value => `¥${Number(value || 0).toLocaleString()}`
const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0)

export default function DailySummary() {
  const { staff } = useAuth()
  const [dateFrom, setDateFrom] = useState(dateKey(new Date()))
  const [dateTo, setDateTo] = useState(dateKey(new Date()))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => { const date = new Date(); return new Date(date.getFullYear(), date.getMonth(), 1) })
  const calendarRef = useRef(null)
  const [branches, setBranches] = useState([])
  const [bills, setBills] = useState([])
  const [expenses, setExpenses] = useState([])
  const [ledger, setLedger] = useState([])
  const [stockAlerts, setStockAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [countedCash, setCountedCash] = useState('')
  const [loadError, setLoadError] = useState('')
  const isOwner = staff?.role === 'owner' || staff?.role === 'god'

  useEffect(() => {
    let active = true
    async function load() {
      if (!staff) return
      if (!dateFrom) {
        setBills([]); setExpenses([]); setLedger([]); setStockAlerts([]); setLoading(false)
        return
      }
      setLoading(true)
      setLoadError('')
      const { start, end } = dayBounds(dateFrom, dateTo || dateFrom)
      let branchQuery = supabase.from('branches').select('id,key,name')
      let billQuery = supabase.from('bills').select('id,bill_number,total,commission,status,created_at,branch_id,branches:branch_id(key,name)').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false })
      let expenseQuery = supabase.from('expenses').select('id,description,amount,status,category,created_at,branch_id,branches:branch_id(key,name)').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false })
      let stockQuery = supabase.from('stock_items').select('id,name,quantity,unit,low_stock_threshold,expires_at,branch_id,branches:branch_id(key,name)').order('quantity')
      if (!isOwner && staff.primary_branch) {
        branchQuery = branchQuery.eq('id', staff.primary_branch)
        billQuery = billQuery.eq('branch_id', staff.primary_branch)
        expenseQuery = expenseQuery.eq('branch_id', staff.primary_branch)
        stockQuery = stockQuery.eq('branch_id', staff.primary_branch)
      }
      const [branchResult, billResult, expenseResult, stockResult] = await Promise.all([branchQuery, billQuery, expenseQuery, stockQuery])
      if (!active) return
      if (branchResult.error || billResult.error || expenseResult.error || stockResult.error) {
        console.error('[Ghost Lab] Daily summary could not load all data:', branchResult.error, billResult.error, expenseResult.error, stockResult.error)
        setLoadError('โหลดข้อมูลบางส่วนไม่สำเร็จ กรุณาลองใหม่')
        setLoading(false)
        return
      }
      const [ledgerBefore, ledgerToday] = isOwner ? await Promise.all([
        fetchLedgerBefore(start),
        supabase.from('cash_ledger').select('amount,entry_type,description,created_at').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }),
      ]) : [{ data: [] }, { data: [] }]
      if (!active) return
      setBranches(branchResult.data || [])
      setBills((billResult.data || []).filter(row => row.status !== 'rejected'))
      setExpenses((expenseResult.data || []).filter(row => row.status === 'paid'))
      setStockAlerts((stockResult.data || []).filter(item => Number(item.quantity) <= Number(item.low_stock_threshold || 0) || (item.expires_at && new Date(item.expires_at) <= new Date(Date.now() + 7 * 86400000))))
      setLedger([...(ledgerToday.data || []), ...(ledgerBefore.data || []).map(row => ({ ...row, _opening: true }))])
      if (ledgerBefore.error || ledgerToday.error) console.warn('[Ghost Lab] Cash reconciliation data unavailable:', ledgerBefore.error || ledgerToday.error)
      setLoading(false)
    }
    load().catch(error => {
      console.error('[Ghost Lab] Daily summary failed:', error)
      if (active) { setLoadError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่'); setLoading(false) }
    })
    return () => { active = false }
  }, [dateFrom, dateTo, staff, isOwner])

  useEffect(() => {
    if (!calendarOpen) return undefined
    function closeOutside(event) { if (!calendarRef.current?.contains(event.target)) setCalendarOpen(false) }
    function closeOnEscape(event) { if (event.key === 'Escape') setCalendarOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [calendarOpen])

  const branchRows = useMemo(() => branches.map(branch => {
    const branchBills = bills.filter(row => row.branch_id === branch.id)
    const branchExpenses = expenses.filter(row => row.branch_id === branch.id)
    const revenue = sum(branchBills, 'total')
    const cost = sum(branchExpenses, 'amount')
    const commission = sum(branchBills, 'commission')
    return { ...branch, revenue, count: branchBills.length, expenses: cost, commission, net: revenue - cost - commission }
  }).sort((a, b) => b.revenue - a.revenue), [branches, bills, expenses])
  const totals = useMemo(() => ({ revenue: sum(bills, 'total'), bills: bills.length, expenses: sum(expenses, 'amount'), commission: sum(bills, 'commission') }), [bills, expenses])
  const net = totals.revenue - totals.expenses - totals.commission
  const dayLedger = ledger.filter(row => !row._opening)
  const openingCash = sum(ledger.filter(row => row._opening), 'amount')
  const adjustment = sum(dayLedger.filter(row => row.entry_type === 'manual_adjustment'), 'amount')
  const expectedCash = openingCash + sum(dayLedger, 'amount')
  const cashDifference = countedCash === '' ? null : Number(countedCash || 0) - expectedCash
  const activity = [
    ...bills.map(row => ({ ...row, kind: 'bill', amount: Number(row.total || 0), title: 'รายได้ (บิล)' })),
    ...expenses.map(row => ({ ...row, kind: 'expense', amount: -Number(row.amount || 0), title: 'ค่าใช้จ่าย' })),
    ...dayLedger.filter(row => row.entry_type === 'payroll' || row.entry_type === 'manual_adjustment').map(row => ({ ...row, kind: row.entry_type === 'payroll' ? 'commission' : 'adjustment', title: row.entry_type === 'payroll' ? 'ค่าคอมมิชชัน' : 'รายการปรับปรุง' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 7)
  const formatDay = key => key ? new Date(`${key}T12:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const dateLabel = dateFrom ? (dateTo && dateTo !== dateFrom ? `${formatDay(dateFrom)} – ${formatDay(dateTo)}` : formatDay(dateFrom)) : 'ยังไม่ได้เลือกช่วงวันที่'
  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const gridStart = new Date(first.getFullYear(), first.getMonth(), -first.getDay() + 1)
    return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index))
  }, [calendarMonth])
  function chooseDate(date) {
    const key = dateKey(date)
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setCountedCash('')
    if (!dateFrom || dateTo) { setDateFrom(key); setDateTo(''); return }
    if (key < dateFrom) { setDateTo(dateFrom); setDateFrom(key) }
    else setDateTo(key)
    setCalendarOpen(false)
  }

  return <main className="daily-closing">
    <header className="daily-closing__hero">
      <div className="daily-closing__brand"><span className="daily-closing__seal"><ReceiptText size={26} /></span><div><small>GHOST GROUP · PRIVATE DESK</small><h1>สรุปปิดวัน</h1><p>Daily Closing Console · ตรวจสอบรายได้ ค่าใช้จ่าย และสรุปผลก่อนปิดวัน</p></div></div>
      <div className="daily-closing__controls"><div className="daily-closing__clock"><Clock3 size={15} />{new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}<span>{dateLabel}</span></div><div className="daily-closing__calendar" ref={calendarRef}><button type="button" className="daily-closing__date" aria-haspopup="dialog" aria-expanded={calendarOpen} onClick={() => { if (!calendarOpen && dateFrom) { const date = new Date(`${dateFrom}T12:00:00+07:00`); setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1)) } setCalendarOpen(value => !value) }}><CalendarDays size={17} /><span>{dateFrom ? `${formatDay(dateFrom)}${dateTo && dateTo !== dateFrom ? ` – ${formatDay(dateTo)}` : dateTo ? '' : ' – เลือกวันสิ้นสุด'}` : 'เลือกช่วงวันที่'}</span><ChevronDown size={14} /></button>{calendarOpen && <section className="daily-closing__calendar-popover" role="dialog" aria-label="เลือกช่วงวันที่"><header><button type="button" aria-label="เดือนก่อน" onClick={() => setCalendarMonth(date => new Date(date.getFullYear(), date.getMonth() - 1, 1))}><ArrowLeft size={15} /></button><strong>{calendarMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="เดือนถัดไป" onClick={() => setCalendarMonth(date => new Date(date.getFullYear(), date.getMonth() + 1, 1))}><ArrowRight size={15} /></button></header><div className="daily-closing__calendar-grid daily-closing__calendar-weekdays">{['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="daily-closing__calendar-grid">{calendarDays.map(date => { const key = dateKey(date); const isStart = key === dateFrom; const isEnd = key === dateTo; const isInRange = Boolean(dateFrom && dateTo && key > dateFrom && key < dateTo); const isToday = key === dateKey(new Date()); const isOutside = date.getMonth() !== calendarMonth.getMonth(); return <button type="button" key={key} className={`${isStart ? 'is-range-start ' : ''}${isEnd ? 'is-range-end ' : ''}${isInRange ? 'is-in-range ' : ''}${isToday ? 'is-today ' : ''}${isOutside ? 'is-outside' : ''}`} aria-pressed={isStart || isEnd} onClick={() => chooseDate(date)}>{date.getDate()}</button> })}</div><footer><button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setCountedCash(''); setCalendarOpen(false) }}>ล้าง</button><button type="button" onClick={() => { const today = new Date(); const key = dateKey(today); setDateFrom(key); setDateTo(key); setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setCountedCash(''); setCalendarOpen(false) }}>วันนี้</button></footer></section>}</div><div className="daily-closing__status"><span />ยังไม่บันทึกปิดวัน</div></div>
    </header>
    {loadError && <div className="daily-closing__error" role="alert">{loadError}</div>}
    <section className="daily-closing__metrics">
      <SummaryMetric Icon={Coins} label="รายได้รวม" subtitle="Revenue" value={money(totals.revenue)} foot={`${totals.bills} บิล`} tone="red" trend="up" />
      <SummaryMetric Icon={FileText} label="จำนวนบิล" subtitle="Bills" value={totals.bills.toLocaleString()} foot="บิลที่ไม่ถูกยกเลิก" tone="slate" trend="up" />
      <SummaryMetric Icon={Wallet} label="ค่าใช้จ่าย" subtitle="Expenses" value={money(totals.expenses)} foot="รายการที่จ่ายแล้ว" tone="slate" trend="down" />
      <SummaryMetric Icon={Percent} label="ค่าคอมมิชชัน" subtitle="Commission" value={money(totals.commission)} foot="รวมจากบิลวันนี้" tone="slate" trend="down" />
      <SummaryMetric Icon={ChartNoAxesColumnIncreasing} label="สุทธิวันนี้" subtitle="Net Today" value={money(net)} foot="รายได้ − ค่าใช้จ่าย − คอมมิชชัน" tone="gold" trend="up" />
    </section>
    <section className="daily-closing__branches" aria-label="สรุปแยกตามสาขา">{branchRows.map(branch => <article className={`daily-closing__branch daily-closing__branch--${branch.key}`} key={branch.id}><div className="daily-closing__branch-name"><Store size={21} /><div><strong>{branch.name}</strong><small>{branch.key === 'chill' ? 'JAPANESE HOSPITALITY' : 'TECHNICAL · CREATIVE'}</small></div></div><BranchValue icon={Coins} label="รายได้" value={money(branch.revenue)} /><BranchValue icon={FileText} label="จำนวนบิล" value={branch.count.toLocaleString()} /><BranchValue icon={Wallet} label="ค่าใช้จ่าย" value={money(branch.expenses)} /><BranchValue icon={Percent} label="ค่าคอมมิชชัน" value={money(branch.commission)} /><BranchValue icon={ChartNoAxesColumnIncreasing} label="สุทธิ" value={money(branch.net)} positive /></article>)}</section>
    {isOwner && <section className="daily-closing__reconcile">
      <div className="daily-closing__section-title"><span className="daily-closing__section-icon"><Banknote size={23} /></span><div><h2>กระทบยอดเงินสด (ปิดวัน)</h2><p>คำนวณจากบัญชีเงินกลางที่บันทึกไว้ · แสดงเพื่อให้ตรวจสอบก่อนปิดวัน</p></div><small>คำนวณตามรายการบัญชีจริง</small></div>
      <div className="daily-closing__equation"><ReconcileCell Icon={Banknote} label="เงินสดยกมา" subtitle="Opening Cash" value={money(openingCash)} /><b>+</b><ReconcileCell Icon={ChartNoAxesColumnIncreasing} label="รายรับวันนี้" subtitle="Ledger Income" value={money(sum(dayLedger.filter(row => row.amount > 0), 'amount'))} /><b>−</b><ReconcileCell Icon={Wallet} label="ค่าใช้จ่าย" subtitle="Expenses" value={money(Math.abs(sum(dayLedger.filter(row => row.entry_type === 'purchase'), 'amount')))} negative /><b>−</b><ReconcileCell Icon={Percent} label="ค่าคอมมิชชันที่จ่าย" subtitle="Commission Paid" value={money(Math.abs(sum(dayLedger.filter(row => row.entry_type === 'payroll'), 'amount')))} negative /><b>±</b><ReconcileCell Icon={ArrowUpRight} label="รายการปรับปรุง" subtitle="Adjustments" value={money(adjustment)} /><b>=</b><ReconcileCell Icon={ChartNoAxesColumnIncreasing} label="ยอดเงินที่ควรมี" subtitle="Expected Cash" value={money(expectedCash)} gold /></div>
      <div className="daily-closing__count-row"><label><span className="daily-closing__count-icon"><Banknote size={22} /></span><span><strong>ยอดเงินที่นับได้จริง</strong><small>Counted Cash</small></span><input inputMode="numeric" type="number" min="0" value={countedCash} onChange={event => setCountedCash(event.target.value)} placeholder="กรอกยอดที่นับได้" aria-label="ยอดเงินที่นับได้จริง" /></label><ArrowRight className="daily-closing__count-arrow" size={29} /><div className="daily-closing__difference"><span className="daily-closing__count-icon"><Clock3 size={22} /></span><span><strong>ส่วนต่าง</strong><small>Difference</small><b className={cashDifference === null ? '' : cashDifference === 0 ? 'is-balanced' : 'is-different'}>{cashDifference === null ? '—' : money(cashDifference)}</b></span>{cashDifference === 0 ? <div className="daily-closing__balanced"><CheckCircle2 size={22} /><span><strong>ยอดตรงกัน</strong><small>ตรวจสอบเรียบร้อย พร้อมสำหรับปิดวัน</small></span></div> : <div className="daily-closing__pending"><AlertTriangle size={19} /><span>{cashDifference === null ? 'กรอกยอดนับเงินจริงเพื่อดูส่วนต่าง' : 'ยอดยังไม่ตรง กรุณาตรวจสอบรายการ'}</span></div>}</div><button type="button" className="daily-closing__review" onClick={() => document.getElementById('daily-activity')?.scrollIntoView({ behavior: 'smooth' })}><ReceiptText size={17} /> ดูรายการ</button><button type="button" className="daily-closing__close" disabled title="หน้าปิดวันยังไม่บันทึกลงระบบ"><CheckCircle2 size={19} /> ปิดวัน <ArrowRight size={17} /></button></div>
      <p className="daily-closing__unavailable">ตอนนี้ระบบคำนวณส่วนต่างให้ตรวจสอบได้ แต่ยังไม่บันทึกยอดนับจริงหรือสถานะปิดวัน</p>
    </section>}
    <section className="daily-closing__lower">
      <article className="daily-closing__panel" id="daily-activity"><div className="daily-closing__panel-heading"><span><FileText size={19} /><span><strong>รายการเคลื่อนไหววันนี้</strong><small>Daily Activity · ล่าสุด</small></span></span><b>{activity.length} รายการ</b></div><div className="daily-closing__activity-head"><span>เวลา</span><span>สาขา</span><span>ประเภท</span><span>จำนวนเงิน</span><span>หมายเหตุ</span></div>{activity.map((row,index) => <div className="daily-closing__activity" key={`${row.kind}-${row.id || index}`}><time>{new Date(row.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</time><span>{row.branches?.name || 'ส่วนกลาง'}</span><span className={`daily-closing__activity-kind is-${row.kind}`}><ActivityIcon kind={row.kind} />{row.title}</span><b className={row.amount < 0 ? 'is-negative' : 'is-positive'}>{money(Math.abs(row.amount))}</b><span>{row.kind === 'bill' ? `บิล ${row.bill_number || ''}` : row.description || '—'}</span></div>)}{!loading && activity.length === 0 && <p className="daily-closing__empty">ไม่มีรายการในวันที่เลือก</p>}{loading && <p className="daily-closing__empty">กำลังโหลดข้อมูล…</p>}</article>
      <article className="daily-closing__panel daily-closing__stock"><div className="daily-closing__panel-heading"><span><Package size={19} /><span><strong>แจ้งเตือนสต็อก</strong><small>Stock Alerts · ใกล้หมด / ใกล้หมดอายุ</small></span></span><b className={stockAlerts.length ? 'has-alert' : ''}>{stockAlerts.length} รายการ</b></div><div className="daily-closing__stock-head"><span>สินค้า</span><span>สาขา</span><span>คงเหลือ</span><span>สถานะ</span></div>{stockAlerts.slice(0, 6).map(item => { const low = Number(item.quantity) <= Number(item.low_stock_threshold || 0); return <div className="daily-closing__stock-row" key={item.id}><span><Package size={15} />{item.name}</span><span>{item.branches?.name || '—'}</span><b>{item.quantity} {item.unit || ''}</b><span className={low ? 'is-low' : 'is-expiring'}>{low ? 'ใกล้หมด' : 'ใกล้หมดอายุ'}</span></div> })}{!stockAlerts.length && <p className="daily-closing__empty">ไม่มีรายการสต็อกที่ต้องจัดการ</p>}</article>
    </section>
  </main>
}

async function fetchLedgerBefore(start) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('cash_ledger').select('amount,entry_type,created_at').lt('created_at', start).order('created_at').range(offset, offset + 999)
    if (error) return { data: rows, error }
    rows.push(...(data || []))
    if (!data || data.length < 1000) return { data: rows, error: null }
  }
}

function SummaryMetric({ Icon, label, subtitle, value, foot, tone, trend }) { return <article className={`daily-closing__metric is-${tone}`}><span className="daily-closing__metric-icon"><Icon size={27} strokeWidth={2} /></span><div><span className="daily-closing__metric-label">{label}<small>{subtitle}</small></span><strong>{value}</strong><span className="daily-closing__metric-foot">{foot}</span></div>{trend && <span className={`daily-closing__trend is-${trend}`}>{trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}วันนี้</span>}</article> }
function BranchValue({ icon: Icon, label, value, positive }) { return <div className="daily-closing__branch-value"><Icon size={15} /><small>{label}</small><strong className={positive ? 'is-positive' : ''}>{value}</strong></div> }
function ReconcileCell({ Icon, label, subtitle, value, negative, gold }) { return <div className={`daily-closing__equation-cell${negative ? ' is-negative' : ''}${gold ? ' is-gold' : ''}`}><span><Icon size={21} strokeWidth={2} /></span><small>{label}<em>{subtitle}</em></small><strong>{value}</strong></div> }
function ActivityIcon({ kind }) { const Icon = kind === 'bill' ? Coins : kind === 'expense' ? Wallet : kind === 'commission' ? Percent : ArrowUpRight; return <Icon size={14} strokeWidth={2} /> }
