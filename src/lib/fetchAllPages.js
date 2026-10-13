// Supabase/PostgREST may cap a response below the requested total. Read stable
// pages so dashboards and exports don't silently omit older records.
export async function fetchAllPages(query, pageSize = 500) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new TypeError('pageSize must be a positive integer')
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
