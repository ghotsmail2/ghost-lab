import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ArrowUpDown, CalendarDays, CalendarRange, ChartPie, CircleCheck, CircleMinus, CirclePlus, CircleX, Clock3, Download, Eye, ListFilter, PackageOpen, Pencil, Plus, ReceiptText, Search, Store, Tags, Trash2, Wallet, WalletCards, X } from 'lucide-react'
import './Expenses.css'
import sabinagisaHero from '../assets/dashboard-sabinagisa-v1.png'

const dateKey = date => {
  const value = new Date(date)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

const today = dateKey(new Date())
const monthStart = `${today.slice(0, 7)}-01`

export default function Expenses() {
  const { staff } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo, setDateTo] = useState(today)
  const [sortOrder, setSortOrder] = useState('latest')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [viewingExpense, setViewingExpense] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [cashLedger, setCashLedger] = useState([])
  const isOwner = staff?.role === 'owner' || staff?.role === 'god'
  const canMarkPaid = isOwner || staff?.role === 'accountant'

  useEffect(() => {
    let query = supabase.from('branches').select('*')
    if (!isOwner && staff?.primary_branch) query = query.eq('id', staff.primary_branch)
    query.then(({ data, error }) => {
      if (error) console.error('[Ghost Lab] Failed to load branches:', error)
      setBranches((data || []).filter(branch => branch?.id && branch?.key))
    })
  }, [isOwner, staff?.primary_branch])

  useEffect(() => {
    setLoading(true)
    let query = supabase.from('expenses').select('*, branches:branch_id(key,name), staff:staff_id(name_en)')
    if (!isOwner && staff?.primary_branch) query = query.eq('branch_id', staff.primary_branch)
    query.order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        setExpenses((data || []).filter(Boolean))
        setLoading(false)
      })
  }, [refreshKey, isOwner, staff?.primary_branch])

  useEffect(() => {
    if (!isOwner) { setCashLedger([]); return }
    supabase.from('cash_ledger').select('id, entry_type, amount, description, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        setCashLedger(data || [])
      })
  }, [isOwner, refreshKey])

  const filtered = expenses.filter(e => {
    const matchBranch = branchFilter === 'all' || e.branches?.key === branchFilter
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const matchCategory = categoryFilter === 'all' || e.category === categoryFilter
    const key = dateKey(e.created_at)
    const matchDate = (!dateFrom || key >= dateFrom) && (!dateTo || key <= dateTo)
    const query = search.trim().toLocaleLowerCase()
    const matchSearch = !query || `${e.description} ${e.category} ${e.branches?.name || ''} ${e.staff?.name_en || ''}`.toLocaleLowerCase().includes(query)
    return matchBranch && matchStatus && matchCategory && matchDate && matchSearch
  }).sort((a, b) => sortOrder === 'largest'
    ? Number(b.amount) - Number(a.amount)
    : new Date(b.created_at) - new Date(a.created_at))

  const inRange = expenses.filter(e => {
    const key = dateKey(e.created_at)
    return (branchFilter === 'all' || e.branches?.key === branchFilter)
      && (!dateFrom || key >= dateFrom) && (!dateTo || key <= dateTo)
  })
  const currentMonth = expenses.filter(e => dateKey(e.created_at).slice(0, 7) === today.slice(0, 7)
    && (branchFilter === 'all' || e.branches?.key === branchFilter))
  const todayExpenses = expenses.filter(e => dateKey(e.created_at) === today
    && (branchFilter === 'all' || e.branches?.key === branchFilter))
  const sumAmount = rows => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const monthTotal = sumAmount(currentMonth)
  const todayTotal = sumAmount(todayExpenses)
  const categoryTotals = Object.entries(inRange.reduce((acc, row) => {
    acc[row.category || 'อื่น ๆ'] = (acc[row.category || 'อื่น ๆ'] || 0) + Number(row.amount || 0)
    return acc
  }, {})).sort((a, b) => b[1] - a[1])
  const categorySum = categoryTotals.reduce((sum, [, amount]) => sum + amount, 0)
  const categoryStops = categoryTotals.reduce((acc, [, amount], index) => {
    const colors = ['#ed4531', '#e07848', '#dc9a59', '#9d6bb7', '#467eae', '#49a88a', '#777b82']
    const start = acc.end
    const end = start + (categorySum ? amount / categorySum * 100 : 0)
    acc.parts.push(`${colors[index % colors.length]} ${start}% ${end}%`)
    acc.end = end
    return acc
  }, { parts: [], end: 0 }).parts.join(', ')
  const weekBars = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - index))
    const key = dateKey(day)
    const rows = expenses.filter(e => dateKey(e.created_at) === key
      && (branchFilter === 'all' || e.branches?.key === branchFilter))
    return { key, label: day.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }), amount: sumAmount(rows) }
  })
  const maxWeekAmount = Math.max(1, ...weekBars.map(row => row.amount))
  const branchTotals = branches.map(branch => ({ ...branch, amount: sumAmount(currentMonth.filter(e => e.branches?.key === branch.key)) }))
    .sort((a, b) => b.amount - a.amount)
  const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'))

  const totals = branches.reduce((acc, b) => {
    acc[b.key] = expenses.filter(e => e.branches?.key === b.key).reduce((a, e) => a + e.amount, 0)
    return acc
  }, {})
  const pendingTotal = inRange.filter(e => e.status === 'pending').reduce((a, e) => a + Number(e.amount || 0), 0)
  const pendingCount = inRange.filter(e => e.status === 'pending').length
  const centralCash = cashLedger.reduce((sum, entry) => sum + entry.amount, 0)
  const purchaseTotal = Math.abs(cashLedger.filter(entry => entry.entry_type === 'purchase').reduce((sum, entry) => sum + entry.amount, 0))
  const billIncome = cashLedger.filter(entry => entry.entry_type === 'bill_income').reduce((sum, entry) => sum + entry.amount, 0)
  const membershipIncome = cashLedger.filter(entry => entry.entry_type === 'membership_income').reduce((sum, entry) => sum + entry.amount, 0)
  const manualAdjustments = cashLedger.filter(entry => entry.entry_type === 'manual_adjustment').reduce((sum, entry) => sum + entry.amount, 0)
  const openingBalance = cashLedger.filter(entry => entry.entry_type === 'opening_balance').reduce((sum, entry) => sum + entry.amount, 0)
  const recentLedger = [...cashLedger]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .reduce((entries, entry) => [...entries, { ...entry, runningBalance: (entries.at(-1)?.runningBalance || 0) + Number(entry.amount || 0) }], [])
    .slice(-8)
    .reverse()

  async function markPaid(id) {
    const { error } = await supabase.from('expenses').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error(error); return }
    setRefreshKey(k => k + 1)
  }

  async function markPending(id) {
    if (!window.confirm('ยกเลิกสถานะจ่ายแล้ว? รายการนี้จะไม่ถูกหักจากเงินกลาง')) return
    const { error } = await supabase.from('expenses').update({ status: 'pending', paid_at: null }).eq('id', id)
    if (error) { console.error(error); return }
    setRefreshKey(k => k + 1)
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`ลบค่าใช้จ่าย “${expense.description}” จำนวน ¥${Number(expense.amount).toLocaleString()} ?\n\nหากรายการนี้จ่ายแล้ว ยอดเงินกลางจะถูกคืนให้ด้วย`)) return
    const { error } = await supabase.rpc('delete_cash_expense', { target_expense_id: expense.id })
    if (error) { console.error(error); alert(`ลบไม่สำเร็จ: ${error.message}`); return }
    setRefreshKey(k => k + 1)
  }

  function exportCsv() {
    const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [
      ['วันที่', 'รายการ', 'หมวดหมู่', 'สาขา', 'ผู้บันทึก', 'จำนวนเงิน', 'สถานะ'],
      ...filtered.map(row => [
        new Date(row.created_at).toLocaleString('th-TH'), row.description, row.category,
        row.branches?.name || '', row.staff?.name_en || '', row.amount,
        row.status === 'paid' ? 'จ่ายแล้ว' : 'ค้างชำระ',
      ]),
    ]
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ghost-group-expenses-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="expenses-page">
      <section className="expenses-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(9,10,12,.96) 0%,rgba(9,10,12,.84) 42%,rgba(9,10,12,.48) 100%),url(${sabinagisaHero})` }}>
        <div className="expenses-hero__copy"><span>GHOST GROUP · PRIVATE DESK</span><h1><WalletCards size={26} strokeWidth={2} /> ค่าใช้จ่าย</h1><p>Expense Tracker · จัดการค่าใช้จ่ายและติดตามเงินทุกสาขา</p></div>
        <div className="expenses-hero__actions">
          <span className="expenses-clock">{new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {isOwner && <button type="button" className="btn btn-secondary" onClick={() => setShowAdjust(true)}><Pencil size={16} strokeWidth={2} /> ปรับยอดเงินกลาง</button>}
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={17} strokeWidth={2} /> เพิ่มค่าใช้จ่าย</button>
        </div>
      </section>

      <section className="expenses-kpis">
        <ExpenseMetric Icon={Wallet} label="ค่าใช้จ่ายวันนี้" value={`¥${todayTotal.toLocaleString()}`} meta={`${todayExpenses.length} รายการ`} tone="red" />
        <ExpenseMetric Icon={CalendarDays} label="ค่าใช้จ่ายเดือนนี้" value={`¥${monthTotal.toLocaleString()}`} meta={`${currentMonth.length} รายการ`} tone="orange" />
        <ExpenseMetric Icon={ReceiptText} label="รายการทั้งหมดในช่วง" value={inRange.length.toLocaleString()} meta={`ค้างชำระ ¥${pendingTotal.toLocaleString()}`} tone="blue" />
        <ExpenseMetric Icon={ChartPie} label="หมวดที่ใช้จ่ายสูงสุด" value={categoryTotals[0]?.[0] || '—'} meta={`¥${(categoryTotals[0]?.[1] || 0).toLocaleString()}`} tone="rose" />
        <ExpenseMetric Icon={Store} label="สาขาที่ใช้จ่ายสูงสุด" value={branchTotals[0]?.name || '—'} meta={`¥${(branchTotals[0]?.amount || 0).toLocaleString()} เดือนนี้`} tone="green" />
      </section>

      {isOwner && <section className="expenses-fund panel">
        <div className="expenses-fund__balance"><span>เงินกลางคงเหลือ</span><strong className="font-mono">¥{centralCash.toLocaleString()}</strong><small>ยอดเปลี่ยนเมื่อบันทึกรายรับหรือรายการจ่ายแล้ว</small></div>
        <div className="expenses-fund__flows">
          <CashFlow label="เงินตั้งต้น" value={openingBalance} color="var(--bone)" />
          <CashFlow label="รายรับจากบิล" value={billIncome} color="#64c992" prefix="+" />
          <CashFlow label="ค่าสมาชิก" value={membershipIncome} color="#64c992" prefix="+" />
          <CashFlow label="ปรับยอด Owner" value={manualAdjustments} color={manualAdjustments < 0 ? '#f18b92' : '#64c992'} prefix={manualAdjustments < 0 ? '−' : '+'} />
          <CashFlow label="ซื้อ / ค่าใช้จ่าย" value={purchaseTotal} color="#f18b92" prefix="−" emphasis />
        </div>
      </section>}

      <div className="expenses-filters panel">
        <label className="expenses-search"><Search size={17} strokeWidth={2} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารายการ หมวดหมู่ หรือผู้บันทึก..." /></label>
        <div className="expenses-filter-divider" />
        <label className="expenses-date"><CalendarRange size={17} strokeWidth={2} /><input aria-label="ตั้งแต่วันที่" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /><b>–</b><input aria-label="ถึงวันที่" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></label>
        <div className="expenses-filter-select"><Tags size={15} strokeWidth={2} /><select className="input" aria-label="หมวดหมู่" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">ทุกหมวดหมู่</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></div>
        <div className="expenses-filter-select"><ListFilter size={15} strokeWidth={2} /><select className="input" aria-label="สถานะ" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">ทุกสถานะ</option><option value="paid">จ่ายแล้ว</option><option value="pending">ค้างชำระ</option><option value="rejected">ไม่อนุมัติ</option></select></div>
        <div className="expenses-filter-select"><ArrowUpDown size={15} strokeWidth={2} /><select className="input" aria-label="เรียงลำดับ" value={sortOrder} onChange={event => setSortOrder(event.target.value)}><option value="latest">ล่าสุด</option><option value="largest">ยอดสูงสุด</option></select></div>
        <button type="button" onClick={exportCsv} className="btn btn-secondary expenses-export"><Download size={16} strokeWidth={2} /> <span>ส่งออกข้อมูล</span></button>
      </div>

      <div className="expenses-branch-tabs">
        {[['all', 'ทุกสาขา'], ...branches.map(branch => [branch.key, branch.name])].map(([key, label]) => <FilterBtn key={key} active={branchFilter === key} onClick={() => setBranchFilter(key)}>{label}</FilterBtn>)}
      </div>

      <section className="expenses-insights">
        <div className="panel expenses-chart">
          <div className="expenses-section-heading"><div><h2>ค่าใช้จ่าย 7 วันล่าสุด</h2><p>ยอดตามสาขาที่เลือก</p></div><span>¥{weekBars.reduce((sum, row) => sum + row.amount, 0).toLocaleString()}</span></div>
          <div className="expenses-bar-chart"><div className="expenses-y-axis"><span>¥{Math.round(maxWeekAmount / 1000).toLocaleString()}k</span><span>¥{Math.round(maxWeekAmount / 2000).toLocaleString()}k</span><span>¥0</span></div><div className="expenses-bars">{weekBars.map((day, index) => <div className="expenses-bar-column" key={day.key}><div className={`expenses-bar ${index === weekBars.length - 1 ? 'is-today' : ''}`} style={{ height: `${Math.max(3, day.amount / maxWeekAmount * 100)}%` }} title={`${day.label} · ¥${day.amount.toLocaleString()}`} /><small>{day.label}</small></div>)}</div></div>
        </div>
        <div className="panel expenses-chart expenses-category-chart">
          <div className="expenses-section-heading"><div><h2>สัดส่วนค่าใช้จ่ายตามหมวด</h2><p>{dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : 'ตามช่วงวันที่เลือก'}</p></div><span>¥{categorySum.toLocaleString()}</span></div>
          <div className="expenses-category-content"><div className="expenses-donut" style={{ background: categoryStops ? `conic-gradient(${categoryStops})` : 'conic-gradient(var(--line) 0 100%)' }}><div><strong>¥{categorySum.toLocaleString()}</strong><small>รวม</small></div></div><div className="expenses-category-legend">{categoryTotals.slice(0, 6).map(([category, amount], index) => <div key={category}><i style={{ '--legend-color': ['#ed4531', '#e07848', '#dc9a59', '#9d6bb7', '#467eae', '#49a88a'][index % 6] }} /><span>{category}</span><small>{categorySum ? Math.round(amount / categorySum * 100) : 0}%</small><b>¥{amount.toLocaleString()}</b></div>)}{categoryTotals.length === 0 && <p>ยังไม่มีรายการในช่วงนี้</p>}</div></div>
        </div>
        <div className="panel expenses-chart expenses-top-list">
          <div className="expenses-section-heading"><div><h2>รายการใช้จ่ายสูงสุด</h2><p>ตามหมวด · ในช่วงที่เลือก</p></div><span>TOP 5</span></div>
          {categoryTotals.slice(0, 5).map(([category, amount], index) => <div className="expenses-top-row" key={category}><b>{index + 1}</b><div><strong>{category}</strong><small>{inRange.filter(row => row.category === category).length} รายการ</small></div><strong className="font-mono">¥{amount.toLocaleString()}</strong></div>)}
          {categoryTotals.length === 0 && <div className="expenses-empty-inline">ไม่มีข้อมูลในช่วงนี้</div>}
        </div>
      </section>

      <section className="expenses-ledger-layout">
        <div className="panel expenses-table-panel">
          <div className="expenses-table-heading"><div><h2>รายการค่าใช้จ่าย</h2><p>แสดง {filtered.length} จาก {inRange.length} รายการ · รวม ¥{sumAmount(filtered).toLocaleString()}</p></div><div className="expenses-status-chips"><button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>ทั้งหมด</button><button className={statusFilter === 'pending' ? 'active' : ''} onClick={() => setStatusFilter('pending')}>ค้าง {pendingCount}</button><button className={statusFilter === 'paid' ? 'active' : ''} onClick={() => setStatusFilter('paid')}>จ่ายแล้ว</button></div></div>
          <div className="expenses-table-scroll"><table className="expenses-table"><thead><tr><th>วันที่</th><th>รายการ</th><th>หมวด</th><th>สาขา</th><th>ผู้บันทึก</th><th>จำนวนเงิน</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
            {loading ? <tr><td colSpan="8" className="expenses-table-empty">กำลังโหลดรายการ...</td></tr> : filtered.length === 0 ? <tr><td colSpan="8" className="expenses-table-empty">ไม่พบค่าใช้จ่ายตามตัวกรองนี้</td></tr> : filtered.map(row => <tr key={row.id}><td><span>{new Date(row.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })}</span><small>{new Date(row.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</small></td><td><strong className="expenses-item-title"><i>¥</i>{row.description}</strong></td><td><span className="expenses-category-pill">{row.category}</span></td><td><span className={`expenses-branch-pill ${row.branches?.key === 'chill' ? 'is-chill' : ''}`}>{row.branches?.name || 'ส่วนกลาง'}</span></td><td>{row.staff?.name_en || '—'}</td><td className="font-mono expenses-amount">¥{Number(row.amount || 0).toLocaleString()}</td><td><span className={`expenses-status ${row.status === 'paid' ? 'is-paid' : row.status === 'rejected' ? 'is-rejected' : 'is-pending'}`}>{row.status === 'paid' ? <><CircleCheck size={13} /> จ่ายแล้ว</> : row.status === 'rejected' ? <><CircleX size={13} /> ไม่อนุมัติ</> : <><Clock3 size={13} /> ค้างชำระ</>}</span></td><td><div className="expenses-row-actions"><button type="button" onClick={() => setViewingExpense(row)} title="ดูรายละเอียด"><Eye size={15} strokeWidth={2} /></button>{row.status === 'paid' ? canMarkPaid && <button type="button" onClick={() => markPending(row.id)} title="ยกเลิกสถานะจ่าย"><Clock3 size={15} strokeWidth={2} /></button> : canMarkPaid && <button type="button" onClick={() => markPaid(row.id)} title="ทำเครื่องหมายว่าจ่ายแล้ว"><CircleCheck size={15} strokeWidth={2} /></button>}{isOwner && <button type="button" className="is-delete" onClick={() => deleteExpense(row)} title="ลบรายการ"><Trash2 size={15} strokeWidth={2} /></button>}</div></td></tr>)}
          </tbody></table></div>
        </div>
        <aside className="expenses-activity-column">
          <section className="panel expenses-activity"><div className="expenses-section-heading"><div><h2>กิจกรรมล่าสุด</h2><p>รายการที่บันทึกล่าสุด</p></div><span>LIVE</span></div>{expenses.slice(0, 6).map(row => <div className="expenses-activity-row" key={row.id}><span className={`expenses-activity-icon ${row.status === 'paid' ? 'is-paid' : ''}`}>{row.status === 'paid' ? <CircleCheck size={15} /> : <Clock3 size={15} />}</span><div><strong>{row.staff?.name_en || 'พนักงาน'} <small>เพิ่มค่าใช้จ่าย</small></strong><span>{row.description}</span><b>¥{Number(row.amount || 0).toLocaleString()}</b></div><time>{new Date(row.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</time></div>)}{expenses.length === 0 && <div className="expenses-empty-inline">ยังไม่มีกิจกรรม</div>}</section>
          {isOwner && <section className="panel expenses-activity expenses-ledger-mini"><div className="expenses-section-heading"><div><h2>เงินกลาง · รายการล่าสุด</h2><p>ยอดคงเหลือ ¥{centralCash.toLocaleString()}</p></div></div>{recentLedger.slice(0, 4).map(entry => <div className="expenses-ledger-row" key={entry.id}><span className={entry.amount < 0 ? 'is-out' : 'is-in'}>{entry.amount < 0 ? <CircleMinus size={16} /> : <CirclePlus size={16} />}</span><div><strong>{entry.description}</strong><small>{new Date(entry.created_at).toLocaleDateString('th-TH')}</small></div><b className="font-mono">¥{Math.abs(entry.amount).toLocaleString()}</b></div>)}</section>}
        </aside>
      </section>

      {showAdd && (
        <AddExpenseModal
          branches={branches} staff={staff}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setRefreshKey(k => k + 1) }}
        />
      )}
      {showAdjust && <CashAdjustmentModal onClose={() => setShowAdjust(false)} onSaved={() => { setShowAdjust(false); setRefreshKey(k => k + 1) }} />}
      {viewingExpense && <ExpenseDetailsModal expense={viewingExpense} onClose={() => setViewingExpense(null)} />}
    </div>
  )
}

function ExpenseMetric({ Icon, label, value, meta, tone = 'red' }) {
  const colors = { red: '#ef4444', orange: '#f97316', blue: '#3b82f6', rose: '#ec4899', green: '#22c55e' }
  return (
    <article className="expenses-metric" style={{ '--metric-color': colors[tone] || colors.red }}>
      <span className="expenses-metric__icon" aria-hidden="true"><Icon size={24} strokeWidth={2} /></span>
      <div className="expenses-metric__copy">
        <span className="expenses-metric__label">{label}</span>
        <strong className="expenses-metric__value">{value}</strong>
        <span className="expenses-metric__meta">{meta}</span>
      </div>
    </article>
  )
}

function FinanceCard({ label, value, accent, prefix = '', signed = false, count = false }) {
  const color = accent === 'negative' ? 'var(--blood)' : accent === 'positive' ? '#84d6a8' : 'var(--bone)'
  const rendered = signed && value > 0 ? `+${value.toLocaleString()}` : `${prefix}${value.toLocaleString()}`
  return <div className="panel"><div style={{ fontSize: 11, color: 'var(--ghost-gray)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div><div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color }}>{count ? rendered : `¥${rendered}`}</div></div>
}

function CashFlow({ label, value, color, prefix = '', emphasis = false }) {
  return <div style={{ background: emphasis ? 'rgba(196,30,42,.09)' : 'rgba(255,255,255,.025)', border: `1px solid ${emphasis ? 'rgba(196,30,42,.34)' : 'var(--line)'}`, borderRadius: 7, minWidth: 0, padding: '10px 11px' }}><div style={{ color: 'var(--ghost-gray)', fontSize: 10, marginBottom: 5 }}>{label}</div><strong className="font-mono" style={{ color, fontSize: 15 }}>{prefix}¥{Math.abs(value).toLocaleString()}</strong></div>
}

function ExpenseDetailsModal({ expense, onClose }) {
  const status = expense.status === 'paid' ? 'จ่ายแล้ว' : expense.status === 'rejected' ? 'ไม่อนุมัติ' : 'ค้างชำระ'
  return <div className="expenses-detail-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="panel expenses-detail-modal" role="dialog" aria-modal="true" aria-labelledby="expense-detail-title"><header><div><span>EXPENSE DETAILS</span><h2 id="expense-detail-title">รายละเอียดค่าใช้จ่าย</h2></div><button type="button" aria-label="ปิด" onClick={onClose}><X size={19} /></button></header><dl><div><dt>รายการ</dt><dd>{expense.description || '—'}</dd></div><div><dt>หมวดหมู่</dt><dd>{expense.category || '—'}</dd></div><div><dt>สาขา</dt><dd>{expense.branches?.name || 'ส่วนกลาง'}</dd></div><div><dt>ผู้บันทึก</dt><dd>{expense.staff?.name_en || '—'}</dd></div><div><dt>วันที่</dt><dd>{new Date(expense.created_at).toLocaleString('th-TH')}</dd></div><div><dt>สถานะ</dt><dd>{status}</dd></div><div className="expenses-detail-amount"><dt>จำนวนเงิน</dt><dd>¥{Number(expense.amount || 0).toLocaleString()}</dd></div></dl></section></div>
}

function FilterBtn({ active, onClick, children }) {
  return (
    <div onClick={onClick} className="btn" style={{
      fontSize: 12,
      borderColor: active ? 'var(--blood)' : 'var(--line)',
      color: active ? 'var(--bone)' : 'var(--ghost-gray)',
      background: active ? 'rgba(196,30,42,0.14)' : 'rgba(255,255,255,0.02)',
    }}>
      {children}
    </div>
  )
}

function AddExpenseModal({ branches, staff, onClose, onSaved }) {
  const draftKey = `ghostlab-expense-add-draft:${staff?.id || 'guest'}`
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey) || 'null') || {} } catch { return {} } }
  const draft = readDraft()
  const [category, setCategory] = useState(draft.category || 'วัตถุดิบ')
  const [description, setDescription] = useState(draft.description || '')
  const [amount, setAmount] = useState(draft.amount ?? '')
  const availableBranches = staff?.role === 'owner' || staff?.role === 'god'
    ? branches
    : branches.filter(branch => branch.id === staff?.primary_branch)
  const [branchId, setBranchId] = useState(draft.branchId || staff?.primary_branch || branches[0]?.id || '')
  const [stockItems, setStockItems] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ category, description, amount, branchId })) } catch {}
  }, [draftKey, category, description, amount, branchId])

  function clearDraft() {
    try { localStorage.removeItem(draftKey) } catch {}
  }

  function closeAndClearDraft() {
    clearDraft()
    onClose()
  }

  useEffect(() => {
    if (!branchId) {
      setStockItems([])
      return
    }
    supabase.from('stock_items').select('id,name,quantity,unit,category').eq('branch_id', branchId).order('name')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setStockItems(data || [])
      })
  }, [branchId])

  async function save() {
    if (!description.trim() || !amount) return
    setSaving(true)
    const { error } = await supabase.rpc('record_pending_expense', {
      p_branch_id: branchId || null,
      p_category: category,
      p_description: description.trim(),
      p_amount: parseInt(amount) || 0,
    })
    setSaving(false)
    if (error) { console.error(error); return }
    clearDraft()
    onSaved()
  }

  return (
    <div onMouseDown={event => event.target === event.currentTarget && closeAndClearDraft()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="panel" style={{ width: 'calc(100% - 28px)', maxWidth: 560, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--static)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>เพิ่มค่าใช้จ่าย</div>
          <button type="button" aria-label="ปิด" onClick={closeAndClearDraft} className="expenses-modal-close"><X size={19} /></button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>รายละเอียด</label>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="เลือกวัสดุด้านล่าง หรือพิมพ์รายการเอง" />
          <div style={{ color: 'var(--ghost-gray)', fontSize: 10, letterSpacing: .7, margin: '14px 0 8px', textTransform: 'uppercase' }}>วัสดุในสต็อกสาขานี้ <span style={{ color: 'var(--dim)' }}>({stockItems.length})</span></div>
          {stockItems.length === 0
            ? <div style={{ color: 'var(--ghost-gray)', fontSize: 11, padding: '10px 12px', border: '1px dashed var(--line)', borderRadius: 8 }}>ยังไม่มีวัตถุดิบในสาขานี้ — พิมพ์รายการเองได้</div>
            : <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              {stockItems.map(item => <button type="button" key={item.id} onClick={() => setDescription(item.name)} style={{ alignItems: 'center', background: description === item.name ? 'rgba(196,30,42,.18)' : 'rgba(255,255,255,.035)', border: `1px solid ${description === item.name ? 'var(--blood)' : 'var(--line)'}`, borderRadius: 8, color: description === item.name ? 'var(--bone)' : 'var(--ghost-gray)', cursor: 'pointer', display: 'flex', font: 'inherit', gap: 10, justifyContent: 'space-between', minHeight: 46, padding: '9px 11px', textAlign: 'left', transition: 'all .15s' }}><span className="expenses-stock-suggestion"><PackageOpen size={15} strokeWidth={2} />{item.name}</span><span className="font-mono" style={{ color: description === item.name ? 'var(--bone)' : 'var(--ghost-gray)', flexShrink: 0, fontSize: 10 }}>{item.quantity ?? 0}{item.unit ? ` ${item.unit}` : ''}</span></button>)}
            </div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>หมวด</label>
            <input className="input" value={category} onChange={e => setCategory(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>ยอด (¥)</label>
            <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>สาขา</label>
          <select className="input" value={branchId} onChange={e => setBranchId(e.target.value)}>
            {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <div onClick={closeAndClearDraft} className="btn btn-secondary">ยกเลิก</div>
          <div onClick={save} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังบันทึก...' : 'บันทึกเป็นค้างชำระ'}</div>
        </div>
      </div>
    </div>
  )
}

function CashAdjustmentModal({ onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const value = parseInt(amount, 10)
    if (!value || !description.trim()) return setError('กรอกรายละเอียดและยอดเงิน (ใช้เครื่องหมาย - เพื่อลดยอด)')
    setSaving(true); setError('')
    const { error: rpcError } = await supabase.rpc('record_cash_adjustment', { p_amount: value, p_description: description.trim() })
    setSaving(false)
    if (rpcError) return setError(rpcError.message)
    onSaved()
  }

  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}><div className="panel" style={{ width: '100%', maxWidth: 420, background: 'var(--static)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>ปรับยอดเงินกลาง</div><button type="button" aria-label="ปิด" onClick={onClose} className="expenses-modal-close"><X size={19} /></button></div><p style={{ color: 'var(--ghost-gray)', fontSize: 11, margin: '0 0 12px' }}>ใส่เลขบวกเพื่อเพิ่มเงิน และเลขลบเพื่อลดเงิน ทุกครั้งจะเก็บประวัติไว้</p><div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>รายละเอียด</label><input className="input" value={description} onChange={event => setDescription(event.target.value)} placeholder="เช่น เติมเงินกลางจาก Owner" /></div><div style={{ marginBottom: 18 }}><label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>ยอดปรับ (¥)</label><input className="input" type="number" value={amount} onChange={event => setAmount(event.target.value)} placeholder="50000 หรือ -50000" /></div>{error && <p style={{ color: '#f18b92', fontSize: 12 }}>{error}</p>}<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><div onClick={onClose} className="btn btn-secondary">ยกเลิก</div><div onClick={save} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังบันทึก...' : 'บันทึกการปรับยอด'}</div></div></div></div>
}
