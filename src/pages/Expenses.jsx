import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Expenses() {
  const { staff } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [cashLedger, setCashLedger] = useState([])
  const isOwner = staff?.role === 'owner' || staff?.role === 'god'
  const canMarkPaid = isOwner || staff?.role === 'accountant'

  useEffect(() => {
    supabase.from('branches').select('*').then(({ data }) => setBranches(data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    supabase.from('expenses').select('*, branches:branch_id(key,name), staff:staff_id(name_en)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        setExpenses(data || [])
        setLoading(false)
      })
  }, [refreshKey])

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
    return matchBranch && matchStatus
  })

  const totals = branches.reduce((acc, b) => {
    acc[b.key] = expenses.filter(e => e.branches?.key === b.key).reduce((a, e) => a + e.amount, 0)
    return acc
  }, {})
  const pendingTotal = expenses.filter(e => e.status === 'pending').reduce((a, e) => a + e.amount, 0)
  const pendingCount = expenses.filter(e => e.status === 'pending').length
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600 }}>ค่าใช้จ่าย</div>
          <div style={{ fontSize: 12, color: 'var(--ghost-gray)' }}>บันทึกและติดตามค่าใช้จ่ายทุกสาขา</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{isOwner && <div onClick={() => setShowAdjust(true)} className="btn btn-secondary">± ปรับยอดเงินกลาง</div>}<div onClick={() => setShowAdd(true)} className="btn btn-primary">+ เพิ่มค่าใช้จ่าย</div></div>
      </div>

      {isOwner && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
          <FinanceCard label="เงินกลางคงเหลือ" value={centralCash} accent={centralCash < 0 ? 'negative' : 'neutral'} />
          <FinanceCard label="รายรับจากบิล" value={billIncome} accent="positive" />
          <FinanceCard label="ค่าสมาชิก" value={membershipIncome} accent="positive" />
          <FinanceCard label="ซื้อ / ค่าใช้จ่าย" value={purchaseTotal} accent="negative" prefix="−" />
          <FinanceCard label="ปรับยอดโดย Owner" value={manualAdjustments} accent={manualAdjustments < 0 ? 'negative' : 'positive'} signed />
          <FinanceCard label="จำนวนรายการการเงิน" value={cashLedger.length} accent="neutral" count />
        </div>
      )}

      {isOwner && <section className="panel" style={{ marginBottom: 18, padding: 18 }}>
        <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div><div className="font-display" style={{ fontSize: 14, fontWeight: 600 }}>เงินกลางคำนวณอย่างไร</div><div style={{ color: 'var(--ghost-gray)', fontSize: 11, marginTop: 3 }}>ค่าใช้จ่ายที่จ่ายแล้วจะหักจากยอดคงเหลือทันที</div></div>
          <strong className="font-mono" style={{ color: 'var(--bone)', fontSize: 18 }}>¥{centralCash.toLocaleString()}</strong>
        </div>
        <div style={{ alignItems: 'stretch', display: 'grid', gap: 8, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          <CashFlow label="เงินตั้งต้น" value={openingBalance} color="var(--bone)" />
          <CashFlow label="รายรับบิล" value={billIncome} color="#84d6a8" prefix="+" />
          <CashFlow label="ค่าสมาชิก" value={membershipIncome} color="#84d6a8" prefix="+" />
          <CashFlow label="ปรับยอด Owner" value={manualAdjustments} color={manualAdjustments < 0 ? '#f18b92' : '#84d6a8'} prefix={manualAdjustments < 0 ? '−' : '+'} />
          <CashFlow label="ซื้อ / ค่าใช้จ่าย" value={purchaseTotal} color="#f18b92" prefix="−" emphasis />
        </div>
        <div style={{ borderTop: '1px solid var(--line)', color: 'var(--ghost-gray)', fontSize: 11, marginTop: 14, paddingTop: 12 }}>รายการการเงินล่าสุด</div>
        {recentLedger.map(entry => <div key={entry.id} style={{ alignItems: 'center', borderTop: '1px solid rgba(255,255,255,.05)', display: 'grid', gap: 12, gridTemplateColumns: '1fr auto auto', padding: '9px 0' }}>
          <div><strong style={{ fontSize: 12 }}>{entry.description}</strong><span style={{ color: 'var(--ghost-gray)', fontSize: 10, marginLeft: 8 }}>{new Date(entry.created_at).toLocaleString('th-TH')}</span></div>
          <strong className="font-mono" style={{ color: entry.amount < 0 ? '#f18b92' : '#84d6a8', fontSize: 12 }}>{entry.amount < 0 ? '−' : '+'}¥{Math.abs(entry.amount).toLocaleString()}</strong>
          <span className="font-mono" style={{ color: 'var(--ghost-gray)', fontSize: 11 }}>คงเหลือ ¥{entry.runningBalance.toLocaleString()}</span>
        </div>)}
      </section>}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${branches.length + 1}, 1fr)`, gap: 14, marginBottom: 18 }}>
        <div className="panel">
          <div style={{ fontSize: 11, color: 'var(--ghost-gray)', textTransform: 'uppercase', marginBottom: 8 }}>ค้างชำระ</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--blood)' }}>¥{pendingTotal.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--ghost-gray)', marginTop: 6 }}>{pendingCount} รายการ</div>
        </div>
        {branches.map(b => (
          <div key={b.id} className="panel">
            <div style={{ fontSize: 11, color: 'var(--ghost-gray)', textTransform: 'uppercase', marginBottom: 8 }}>{b.name}</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 700 }}>¥{(totals[b.key] || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', 'ทุกสาขา'], ...branches.map(b => [b.key, b.name])].map(([key, label]) => (
          <FilterBtn key={key} active={branchFilter === key} onClick={() => setBranchFilter(key)}>{label}</FilterBtn>
        ))}
        <div style={{ width: 1, background: 'var(--line)', margin: '0 4px' }} />
        <FilterBtn active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>ทั้งหมด</FilterBtn>
        <FilterBtn active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>ค้างชำระ</FilterBtn>
        <FilterBtn active={statusFilter === 'paid'} onClick={() => setStatusFilter('paid')}>จ่ายแล้ว</FilterBtn>
      </div>

      <div className="panel">
        <div style={{ fontSize: 12, color: 'var(--ghost-gray)', marginBottom: 12 }}>
          {filtered.length} รายการ · รวม ¥{filtered.reduce((a, e) => a + e.amount, 0).toLocaleString()}
        </div>
        {loading ? <div style={{ color: 'var(--ghost-gray)', fontSize: 12 }}>กำลังโหลด...</div>
          : filtered.length === 0 ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ghost-gray)', fontSize: 12 }}>ไม่มีรายการ</div>
          : filtered.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(196,30,42,0.15)', color: '#ff8a8a', marginRight: 8 }}>{e.category}</span>
                  {e.description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ghost-gray)', marginTop: 3 }}>
                  {e.branches?.name || '—'} · {e.staff?.name_en || '—'} · {new Date(e.created_at).toLocaleDateString('th-TH')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="font-mono" style={{ fontSize: 14, fontWeight: 600 }}>¥{e.amount.toLocaleString()}</div>
                {e.status === 'paid'
                  ? <><span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, color: '#3FB950', border: '1px solid #3FB950' }}>✓ จ่ายแล้ว</span>{canMarkPaid && <button type="button" onClick={() => markPending(e.id)} className="btn" style={{ color: '#f18b92', fontSize: 10, padding: '4px 7px' }}>ยกเลิกจ่าย</button>}</>
                  : canMarkPaid
                    ? <div onClick={() => markPaid(e.id)} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }}>มาร์คจ่ายแล้ว</div>
                    : <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, color: 'var(--ghost-gray)', border: '1px solid var(--line)' }}>ค้างชำระ</span>
                }
                {isOwner && <button type="button" onClick={() => deleteExpense(e)} title="ลบค่าใช้จ่าย" style={{ background: 'transparent', border: '1px solid rgba(196,30,42,.55)', borderRadius: 5, color: '#f18b92', cursor: 'pointer', fontSize: 13, padding: '4px 8px' }}>🗑</button>}
              </div>
            </div>
          ))
        }
      </div>

      {showAdd && (
        <AddExpenseModal
          branches={branches} staff={staff}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setRefreshKey(k => k + 1) }}
        />
      )}
      {showAdjust && <CashAdjustmentModal onClose={() => setShowAdjust(false)} onSaved={() => { setShowAdjust(false); setRefreshKey(k => k + 1) }} />}
    </div>
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
  const [category, setCategory] = useState('วัตถุดิบ')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const availableBranches = staff?.role === 'owner' || staff?.role === 'god'
    ? branches
    : branches.filter(branch => branch.id === staff?.primary_branch)
  const [branchId, setBranchId] = useState(staff?.primary_branch || branches[0]?.id || '')
  const [stockItems, setStockItems] = useState([])
  const [saving, setSaving] = useState(false)

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
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="panel" style={{ width: 'calc(100% - 28px)', maxWidth: 560, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--static)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>เพิ่มค่าใช้จ่าย</div>
          <div onClick={onClose} style={{ cursor: 'pointer', color: 'var(--ghost-gray)', fontSize: 18 }}>✕</div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>รายละเอียด</label>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="เลือกวัสดุด้านล่าง หรือพิมพ์รายการเอง" />
          <div style={{ color: 'var(--ghost-gray)', fontSize: 10, letterSpacing: .7, margin: '14px 0 8px', textTransform: 'uppercase' }}>วัสดุในสต็อกสาขานี้ <span style={{ color: 'var(--dim)' }}>({stockItems.length})</span></div>
          {stockItems.length === 0
            ? <div style={{ color: 'var(--ghost-gray)', fontSize: 11, padding: '10px 12px', border: '1px dashed var(--line)', borderRadius: 8 }}>ยังไม่มีวัตถุดิบในสาขานี้ — พิมพ์รายการเองได้</div>
            : <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              {stockItems.map(item => <button type="button" key={item.id} onClick={() => setDescription(item.name)} style={{ alignItems: 'center', background: description === item.name ? 'rgba(196,30,42,.18)' : 'rgba(255,255,255,.035)', border: `1px solid ${description === item.name ? 'var(--blood)' : 'var(--line)'}`, borderRadius: 8, color: description === item.name ? 'var(--bone)' : 'var(--ghost-gray)', cursor: 'pointer', display: 'flex', font: 'inherit', gap: 10, justifyContent: 'space-between', minHeight: 46, padding: '9px 11px', textAlign: 'left', transition: 'all .15s' }}><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⌁ {item.name}</span><span className="font-mono" style={{ color: description === item.name ? 'var(--bone)' : 'var(--ghost-gray)', flexShrink: 0, fontSize: 10 }}>{item.quantity ?? 0}{item.unit ? ` ${item.unit}` : ''}</span></button>)}
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
          <div onClick={onClose} className="btn btn-secondary">ยกเลิก</div>
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

  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}><div className="panel" style={{ width: '100%', maxWidth: 420, background: 'var(--static)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>ปรับยอดเงินกลาง</div><div onClick={onClose} style={{ cursor: 'pointer', color: 'var(--ghost-gray)', fontSize: 18 }}>✕</div></div><p style={{ color: 'var(--ghost-gray)', fontSize: 11, margin: '0 0 12px' }}>ใส่เลขบวกเพื่อเพิ่มเงิน และเลขลบเพื่อลดเงิน ทุกครั้งจะเก็บประวัติไว้</p><div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>รายละเอียด</label><input className="input" value={description} onChange={event => setDescription(event.target.value)} placeholder="เช่น เติมเงินกลางจาก Owner" /></div><div style={{ marginBottom: 18 }}><label style={{ fontSize: 11, color: 'var(--ghost-gray)', display: 'block', marginBottom: 6 }}>ยอดปรับ (¥)</label><input className="input" type="number" value={amount} onChange={event => setAmount(event.target.value)} placeholder="50000 หรือ -50000" /></div>{error && <p style={{ color: '#f18b92', fontSize: 12 }}>{error}</p>}<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><div onClick={onClose} className="btn btn-secondary">ยกเลิก</div><div onClick={save} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังบันทึก...' : 'บันทึกการปรับยอด'}</div></div></div></div>
}
