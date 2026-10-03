import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MEMBERSHIP_PLAN_KEYS, addMembershipMonths, getMembershipPlan, formatDate, isMembershipActive, toDateInput } from '../lib/membership'
import './Members.css'

const TIER_CLASS = { regular: 'tier--regular', silver: 'tier--silver', gold: 'tier--gold' }
const formatAmount = amount => `¥${Number(amount || 0).toLocaleString()}`

function Avatar({ name }) {
  return <span className="member-avatar">{name?.slice(0, 2).toUpperCase() || 'GL'}</span>
}

export default function Members() {
  const [members, setMembers] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingMember, setEditingMember] = useState(null)
  const [couponCounts, setCouponCounts] = useState({})
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    const [branchResult, memberResult, rewardResult] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('members').select('*, branches:branch_id(key,name)').is('archived_at', null).order('created_at', { ascending: false }),
      supabase.from('member_rewards').select('member_id').eq('status', 'available'),
    ])

    if (branchResult.error || memberResult.error) {
      console.error(branchResult.error || memberResult.error)
      setError('โหลดข้อมูลสมาชิกไม่สำเร็จ ลองรีเฟรชอีกครั้ง')
    }
    setBranches(branchResult.data || [])
    setMembers(memberResult.data || [])
    if (!rewardResult.error) {
      const counts = {}
      rewardResult.data.forEach(reward => { counts[reward.member_id] = (counts[reward.member_id] || 0) + 1 })
      setCouponCounts(counts)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return members.filter(member => {
      const matchesBranch = branchFilter === 'all' || member.branches?.key === branchFilter
      const matchesQuery = !query
        || member.name?.toLowerCase().includes(query)
        || member.phone?.includes(query)
        || member.plate_or_note?.toLowerCase().includes(query)
      return matchesBranch && matchesQuery
    })
  }, [members, branchFilter, search])

  const stats = useMemo(() => ({
    total: members.length,
    spend: members.reduce((sum, member) => sum + Number(member.total_spent || 0), 0),
    rewards: Object.values(couponCounts).reduce((sum, count) => sum + count, 0),
    active: members.filter(isMembershipActive).length,
    // The current plan is the source of truth. `membership_fee` may be a
    // historical amount from before a member changed tier.
    fees: members.filter(isMembershipActive).reduce((sum, member) => sum + getMembershipPlan(member.tier).monthlyFee, 0),
  }), [members, couponCounts])

  const filters = [
    { key: 'all', label: 'ทั้งหมด', count: members.length },
    ...branches.map(branch => ({ key: branch.key, label: branch.name, count: members.filter(member => member.branches?.key === branch.key).length })),
  ]

  async function deleteMember(member) {
    if (!window.confirm(`ลบ “${member.name}” ออกจากรายชื่อสมาชิก?\n\nบิลและประวัติการเงินเก่าจะยังถูกเก็บไว้`)) return
    const { error: deleteError } = await supabase.from('members').update({ archived_at: new Date().toISOString() }).eq('id', member.id)
    if (deleteError) {
      console.error(deleteError)
      setError('ลบสมาชิกไม่สำเร็จ')
      return
    }
    setMembers(current => current.filter(item => item.id !== member.id))
  }

  return (
    <section className="members-page">
      <header className="members-hero">
        <div>
          <p className="members-kicker">LOYALTY DESK</p>
          <h1 className="font-display">Members <span>& Coupons</span></h1>
          <p className="members-subtitle">ดูแลข้อมูลลูกค้าประจำ ติดตามยอดสะสม และมอบรางวัลให้ตรงเวลา</p>
        </div>
        <button type="button" className="members-add" onClick={() => setEditingMember({})}>+ เพิ่มสมาชิก</button>
      </header>

      <div className="member-stats" aria-label="สรุปสมาชิก">
        <StatCard label="สมาชิกทั้งหมด" value={stats.total.toLocaleString()} note="ในฐานข้อมูลลูกค้า" icon="◎" />
        <StatCard label="ยอดสะสมรวม" value={formatAmount(stats.spend)} note="ยอดใช้จ่ายตลอดอายุสมาชิก" icon="¥" />
        <StatCard label="สมาชิก Active" value={stats.active.toLocaleString()} note="ยังไม่หมดอายุ" icon="✓" accent />
        <StatCard label="ค่าสมาชิกต่อเดือน" value={formatAmount(stats.fees)} note="มูลค่าแพ็กเกจที่กำลังใช้งาน" icon="◫" />
      </div>

      <MembershipPlans onAdd={tier => setEditingMember({ tier })} />

      <div className="members-workspace">
        <div className="members-toolbar">
          <label className="member-search">
            <span>⌕</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาชื่อ, เบอร์โทร หรือทะเบียน" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="ล้างคำค้น">×</button>}
          </label>
          <button type="button" className="members-refresh" onClick={loadData} disabled={loading}>↻ รีเฟรช</button>
        </div>

        <div className="member-filters" role="tablist" aria-label="กรองตามสาขา">
          {filters.map(filter => (
            <button key={filter.key} type="button" role="tab" aria-selected={branchFilter === filter.key} className={branchFilter === filter.key ? 'is-active' : ''} onClick={() => setBranchFilter(filter.key)}>
              {filter.label}<span>{filter.count}</span>
            </button>
          ))}
        </div>

        {error && <div className="members-error">⚠ {error}</div>}

        <div className="members-list">
          <div className="members-list__header">
            <span>สมาชิก</span><span>สาขา</span><span>สถานะสะสม</span><span>ยอดใช้จ่าย</span><span>รางวัล</span><span aria-label="จัดการ" />
          </div>
          {loading ? <LoadingRows /> : filtered.map(member => {
            const hasFreeRepairKits = isMembershipActive(member)
            return <article className="member-row" key={member.id}>
              <div className="member-identity"><Avatar name={member.name} /><div><strong>{member.name}</strong><small>{member.phone || 'ไม่ระบุเบอร์'}{member.plate_or_note && ` · ${member.plate_or_note}`}</small></div></div>
              <div className="member-branch">{member.branches?.name || 'ไม่ระบุสาขา'}</div>
              <div className="member-loyalty"><div><span className={`tier ${TIER_CLASS[member.tier] || 'tier--regular'}`}>{getMembershipPlan(member.tier).label}</span><b className={isMembershipActive(member) ? 'member-active' : 'member-expired'}>{isMembershipActive(member) ? 'ACTIVE' : 'หมดอายุ'}</b></div><small>ถึง {formatDate(member.membership_expires_at)}</small></div>
              <strong className="member-spend">{formatAmount(member.total_spent)}</strong>
              <div className={`member-reward ${hasFreeRepairKits ? 'member-reward--gold' : ''}`} title={hasFreeRepairKits ? 'Member: Engine Repair Kit และ Full Repair Kit ฟรี' : undefined}><b>{hasFreeRepairKits ? '2' : (couponCounts[member.id] || 0)}</b><span>{hasFreeRepairKits ? 'Repair Kits ฟรี' : 'ซ่อมฟรี'}</span></div>
              <div className="member-actions"><button type="button" onClick={() => setEditingMember(member)}>แก้ไข</button><button type="button" className="member-actions__delete" onClick={() => deleteMember(member)} aria-label={`ลบ ${member.name}`}>×</button></div>
            </article>
          })}
          {!loading && filtered.length === 0 && <EmptyState hasSearch={Boolean(search || branchFilter !== 'all')} onAdd={() => setEditingMember({})} />}
        </div>
      </div>

      {editingMember && <MemberModal member={editingMember} branches={branches} onClose={() => setEditingMember(null)} onSaved={() => { setEditingMember(null); loadData() }} />}
    </section>
  )
}

function StatCard({ label, value, note, icon, accent }) { return <div className={`member-stat ${accent ? 'member-stat--accent' : ''}`}><span className="member-stat__icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div> }
function MembershipPlans({ onAdd }) { return <section className="membership-plans" aria-label="แพ็กเกจสมาชิก">{MEMBERSHIP_PLAN_KEYS.map(key => { const plan = getMembershipPlan(key); return <article className={`membership-plan membership-plan--${key}`} key={key}><span>{plan.label} MEMBER</span><strong>{formatAmount(plan.monthlyFee)}<small>/ เดือน</small></strong><p>ยอดบิล ¥50,000 ลด {plan.discounts[50000]}%</p><p>ยอดบิล ¥100,000 ลด {plan.discounts[100000]}%</p><p className="membership-plan__reward">✦ ฟรี Engine Repair Kit และ Full Repair Kit</p><button type="button" className="membership-plan__add" onClick={() => onAdd(key)}>+ สมัคร {plan.label}</button></article> })}</section> }
function LoadingRows() { return <div className="members-loading"><i /><i /><i /><span>กำลังโหลดข้อมูลสมาชิก…</span></div> }
function EmptyState({ hasSearch, onAdd }) { return <div className="members-empty"><span>◎</span><h2>{hasSearch ? 'ไม่พบสมาชิกที่ค้นหา' : 'ยังไม่มีสมาชิกในระบบ'}</h2><p>{hasSearch ? 'ลองเปลี่ยนคำค้นหาหรือเลือกสาขาอื่น' : 'เริ่มสร้างฐานลูกค้าประจำและสะสมรางวัลให้พวกเขา'}</p>{!hasSearch && <button type="button" onClick={onAdd}>+ เพิ่มสมาชิกคนแรก</button>}</div> }

function MemberModal({ member, branches, onClose, onSaved }) {
  const isNew = !member.id
  const draftKey = 'ghostlab-member-new-draft'
  const readDraft = () => {
    if (!isNew) return {}
    try { return JSON.parse(localStorage.getItem(draftKey) || 'null') || {} } catch { return {} }
  }
  const draft = readDraft()
  const [name, setName] = useState(member.name || draft.name || '')
  const [phone, setPhone] = useState(member.phone || draft.phone || '')
  const [plate, setPlate] = useState(member.plate_or_note || draft.plate || '')
  const [branchId, setBranchId] = useState(member.branch_id || draft.branchId || branches[0]?.id || '')
  const [tier, setTier] = useState(MEMBERSHIP_PLAN_KEYS.includes(member.tier) ? member.tier : (draft.tier || 'regular'))
  const [renew, setRenew] = useState(isNew ? draft.renew !== false : false)
  const [tierChanged, setTierChanged] = useState(false)
  const [startDate, setStartDate] = useState(isNew ? (draft.startDate || toDateInput(new Date())) : toDateInput(isMembershipActive(member) ? member.membership_expires_at : new Date()))
  const [months, setMonths] = useState(isNew ? Number(draft.months) || 1 : 1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const plan = getMembershipPlan(tier)

  useEffect(() => {
    if (!isNew) return
    try { localStorage.setItem(draftKey, JSON.stringify({ name, phone, plate, branchId, tier, renew, startDate, months })) } catch {}
  }, [isNew, name, phone, plate, branchId, tier, renew, startDate, months])

  function clearDraft() {
    if (!isNew) return
    try { localStorage.removeItem(draftKey) } catch {}
  }

  function closeAndClearDraft() {
    clearDraft()
    onClose()
  }

  async function save(event) {
    event.preventDefault()
    if (!name.trim()) return setError('กรุณากรอกชื่อสมาชิก')
    setSaving(true); setError('')
    const adjustingActivePlan = !isNew && tierChanged && !renew && isMembershipActive(member)
    if (adjustingActivePlan) {
      const adjustment = await supabase.rpc('adjust_active_membership_plan', { p_member_id: member.id, p_tier: tier })
      if (adjustment.error) {
        setSaving(false)
        return setError(adjustment.error.message)
      }
    }

    const payload = { name: name.trim(), phone: phone.trim() || null, plate_or_note: plate.trim() || null, branch_id: branchId || null, tier }
    const startsAt = new Date(`${startDate}T00:00:00`).toISOString()
    const expiresAt = addMembershipMonths(startsAt, months)
    const totalPaid = plan.monthlyFee * months
    if (renew) Object.assign(payload, { membership_started_at: startsAt, membership_expires_at: expiresAt, membership_fee: plan.monthlyFee })
    const result = isNew ? await supabase.from('members').insert(payload).select().single() : await supabase.from('members').update(payload).eq('id', member.id).select().single()
    if (result.error) { setSaving(false); return setError(result.error.message) }
    if (renew && !adjustingActivePlan) {
      const subscription = await supabase.from('member_memberships').insert({
        member_id: result.data.id, tier: plan.key, monthly_fee: plan.monthlyFee,
        months, total_paid: totalPaid, started_at: startsAt, expires_at: expiresAt,
      })
      if (subscription.error) { setSaving(false); return setError(subscription.error.message) }
    }
    setSaving(false)
    clearDraft()
    onSaved()
  }

  return <div className="member-modal" role="dialog" aria-modal="true" aria-label={isNew ? 'เพิ่มสมาชิกใหม่' : 'แก้ไขสมาชิก'} onMouseDown={event => event.target === event.currentTarget && closeAndClearDraft()}><form className="member-modal__card" onSubmit={save}><header><div><span>{isNew ? 'NEW MEMBER' : 'MEMBER PROFILE'}</span><h2 className="font-display">{isNew ? 'สมัครสมาชิกใหม่' : 'จัดการสมาชิก'}</h2></div><button type="button" onClick={closeAndClearDraft} aria-label="ปิด">×</button></header><div className="member-modal__body"><label>ชื่อสมาชิก <em>*</em><input autoFocus className="input" value={name} onChange={event => setName(event.target.value)} placeholder="ชื่อลูกค้า" /></label><div className="member-modal__grid"><label>เบอร์โทร<input className="input" value={phone} onChange={event => setPhone(event.target.value)} placeholder="08x-xxx-xxxx" /></label><label>ทะเบียน / โน้ต<input className="input" value={plate} onChange={event => setPlate(event.target.value)} placeholder="เช่น กข 1234" /></label></div><div className="member-modal__grid"><label>สาขา<select className="input" value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">ยังไม่ระบุ</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label>ระดับสมาชิก<select className="input" value={tier} onChange={event => { const nextTier = event.target.value; setTier(nextTier); if (!isNew) { const changed = nextTier !== (member.tier || 'regular'); setTierChanged(changed); if (changed) setRenew(!isMembershipActive(member)) } }}>{MEMBERSHIP_PLAN_KEYS.map(item => <option key={item} value={item}>{getMembershipPlan(item).label}</option>)}</select></label></div><div className="member-modal__grid"><label>วันเริ่มสมาชิก<input className="input" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} disabled={!renew} /></label><label>จำนวนเดือน<select className="input" value={months} onChange={event => setMonths(Number(event.target.value))} disabled={!renew}>{[1,2,3,4,5,6,12].map(value => <option key={value} value={value}>{value} เดือน</option>)}</select></label></div><div className="membership-modal-plan"><strong>{plan.label} · {formatAmount(plan.monthlyFee)} / เดือน</strong><span>{tierChanged && !renew && isMembershipActive(member) ? 'ปรับยอดสมาชิกเดิมตามแพ็กเกจใหม่ โดยคิดเฉพาะส่วนต่าง' : `เริ่ม ${formatDate(startDate)} · หมดอายุ ${formatDate(addMembershipMonths(`${startDate}T00:00:00`, months))}`}</span><span>รวม {months} เดือน: {formatAmount(plan.monthlyFee * months)}</span><span className="membership-gold-repair">✦ ฟรี Engine Repair Kit และ Full Repair Kit</span></div>{!isNew && <label className="membership-renew"><input type="checkbox" checked={renew} onChange={event => setRenew(event.target.checked)} /> ต่ออายุเป็นรายการใหม่ (ถ้าไม่ติ๊ก จะปรับยอดแพ็กเกจเดิม)</label>}{error && <p className="member-modal__error">⚠ {error}</p>}</div><footer><button type="button" onClick={closeAndClearDraft}>ยกเลิก</button><button className="btn btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก…' : tierChanged && !renew ? `ปรับยอดเป็น ¥${(plan.monthlyFee * months).toLocaleString()}` : renew ? `บันทึกและเก็บ ¥${(plan.monthlyFee * months).toLocaleString()}` : 'บันทึกข้อมูล'}</button></footer></form></div>
}
