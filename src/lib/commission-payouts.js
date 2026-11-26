import { bangkokDateBounds } from './bangkokDate.js'
import { fetchAllPages } from './fetchAllPages.js'

export async function loadCommissionEntries(supabase, dateFrom, dateTo, staffId) {
  const { start, end } = bangkokDateBounds(dateFrom, dateTo)
  let distributionQuery = supabase.from('commission_distributions')
    .select('id,bill_id,user_id,user_name_snapshot,amount,commission_mode,commission_policy,commission_period,commission_attendance_id,created_at,paid_at,reversed_at,recipient:user_id(id,name_en,avatar_url),bill:bill_id(id,bill_number,total,branch_id,commission,commission_policy,commission_period,commission_attendance_id,created_at,status,branches:branch_id(id,key,name))')
    .is('reversed_at', null).gte('created_at', start).lt('created_at', end)
    .order('created_at', { ascending: false }).order('id', { ascending: true })
  let hourlyQuery = supabase.from('garage_technician_hourly_commissions')
    .select('id,staff_id,branch_id,amount,period_start,period_end,paid_at,payout_id,staff:staff_id(id,name_en,avatar_url),branches:branch_id(id,key,name)')
    .gte('period_end', start).lt('period_end', end)
    .order('period_end', { ascending: false }).order('id', { ascending: true })
  if (staffId) {
    distributionQuery = distributionQuery.eq('user_id', staffId)
    hourlyQuery = hourlyQuery.eq('staff_id', staffId)
  }
  const [distributions, hourlyCommissions] = await Promise.all([
    fetchAllPages(distributionQuery),
    fetchAllPages(hourlyQuery),
  ])
  return {
    distributions: distributions.filter(row => row.bill?.status !== 'rejected' && row.bill?.status !== 'cancelled'),
    hourlyCommissions,
  }
}

export function summarizePendingCommission(distributions, hourlyCommissions, branchKey = 'all') {
  const bills = distributions.filter(row => !row.paid_at && (branchKey === 'all' || branchKey === (row.bill?.branches?.key || 'shared')))
  const hours = hourlyCommissions.filter(row => !row.paid_at && (branchKey === 'all' || branchKey === (row.branches?.key || 'garage')))
  const sum = rows => rows.reduce((total, row) => total + Number(row.amount || 0), 0)
  return { bills: bills.length, hours: hours.length, amount: sum(bills) + sum(hours) }
}
