import React from 'react'
import { supabase } from '../lib/supabase'

export function showsInNewBill(service) {
  return service.show_in_new_bill !== false
}

export function matchesMenuSearch(service, query) {
  const term = query.trim().toLowerCase()
  return service.name.toLowerCase().includes(term) || service.category.toLowerCase().includes(term)
}

export function MenuVisibilityCheckbox({ branchId, service, onSaved }) {
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  async function change(event) {
    const show = event.target.checked
    setSaving(true)
    setError('')
    try {
      const { data, error: saveError } = await supabase.from('services')
        .update({ show_in_new_bill: show })
        .eq('id', service.id).eq('branch_id', branchId)
        .select('show_in_new_bill').single()
      if (saveError) throw saveError
      onSaved(data.show_in_new_bill)
    } catch (problem) {
      console.error(problem)
      setError('บันทึกไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return <div>
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <input type="checkbox" checked={showsInNewBill(service)} disabled={saving}
        aria-label={`แสดง ${service.name} ใน New Bill`} onChange={change} />
      {saving ? 'กำลังบันทึก…' : showsInNewBill(service) ? 'แสดงใน New Bill' : 'ซ่อนจาก New Bill'}
    </label>
    {error && <div role="alert" style={{ color: 'var(--blood)', fontSize: 12 }}>{error}</div>}
  </div>
}
