import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const pos = await readFile(new URL('../src/pages/POSPage.jsx', import.meta.url), 'utf8')
const expenses = await readFile(new URL('../src/pages/Expenses.jsx', import.meta.url), 'utf8')
const expensesCss = await readFile(new URL('../src/pages/Expenses.css', import.meta.url), 'utf8')
const dailySummary = await readFile(new URL('../src/pages/DailySummary.jsx', import.meta.url), 'utf8')
const dailySummaryCss = await readFile(new URL('../src/pages/DailySummary.css', import.meta.url), 'utf8')
const stock = await readFile(new URL('../src/pages/Stock.jsx', import.meta.url), 'utf8')
const stockCss = await readFile(new URL('../src/pages/Stock.css', import.meta.url), 'utf8')
const commission = await readFile(new URL('../src/pages/CommissionPayouts.jsx', import.meta.url), 'utf8')
const commissionCss = await readFile(new URL('../src/pages/CommissionPayouts.css', import.meta.url), 'utf8')
const login = await readFile(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8')
const loginCss = await readFile(new URL('../src/pages/Login.css', import.meta.url), 'utf8')
const builder = await readFile(new URL('./build-recovered.mjs', import.meta.url), 'utf8')

test('restaurant POS shows personal commission only while the current staff member is clocked in', () => {
  assert.match(pos, /\.eq\('staff_id', staff\.id\).*\.is\('clock_out', null\)/s)
  assert.match(pos, /const myCommissionPreview = branch\.key === 'chill' && !isOnShift \? 0 : displayCommission/)
  assert.match(pos, /commission: displayCommission/)
  assert.match(pos, /ค่าคอมของฉัน/)
})

test('dashboard LIVE INSIGHT omits the requested verbose summary line', () => {
  assert.match(builder, /liveDashboardWidgets = liveDashboardWidgets\.replace\(/)
  assert.match(builder, /แสดงยอดจาก .*พนักงานกำลังทำงาน .*ทุกยอดอัปเดตตามตัวกรองสาขาและวันที่/)
})

test('Home dashboard hero uses the requested GHOST GROUP brand copy', () => {
  for (const phrase of ['GHOST GROUP · TWO SOULS, ONE GARAGE', '技 · 味 · 心', 'งานช่าง · รสชาติ · การบริการ', 'GHOST LAB × SABINAGISA']) {
    assert.ok(builder.includes(phrase), `missing home hero text: ${phrase}`)
  }
})

test('Login profile selection uses the editorial brand copy, cinematic glass panel and reduced-motion-safe details', () => {
  for (const phrase of ['GHOST·LAB × SABINAGISA', 'TWO SOULS, ONE GARAGE', '技 · 味 · 心', 'わざ · あじ · こころ', 'งานช่าง · บริการ · อาหาร · ประสบการณ์', '二つの世界、ひとつの美学。', 'สองธุรกิจ หนึ่งมาตรฐาน']) {
    assert.ok(login.includes(phrase) || builder.includes(phrase), `missing login brand text: ${phrase}`)
  }
  assert.match(login, /staff-picker--groups/)
  assert.match(loginCss, /backdrop-filter: blur\(24px\)/)
  assert.match(loginCss, /login-scene-drift/)
  assert.match(loginCss, /prefers-reduced-motion: reduce/)
  assert.match(builder, /login-courtyard-v1\.png/)
  assert.match(builder, /Cormorant\+Garamond/)
})

test('recovered Stock, Expenses, Daily Summary and Commission pages use React classic JSX factory', () => {
  assert.equal((builder.match(/jsxFactory: 'React\.createElement'/g) || []).length, 4)
  assert.doesNotMatch(builder, /jsxFactory: 'e\.jsx'/)
})

test('Daily Closing Console source is used by production and keeps close-day persistence disabled', () => {
  assert.match(builder, /DailyClosingConsole\.js/)
  assert.match(builder, /import\("\.\/DailyClosingConsole\.js"\)/)
  assert.match(builder, /dailyClosingSource\s*=\s*dailyClosingSource[\s\S]*\.replace\(\/\^import \\\{ supabase \\\} from/)
  assert.match(builder, /WeeklyClosingPanel range=\{\{ start: dateFrom, end: dateTo \|\| dateFrom \}\}/)
  assert.match(dailySummary, /className="daily-closing__hero"/)
  assert.match(dailySummary, /className="daily-closing__close" disabled/)
  assert.match(dailySummary, /ยังไม่บันทึกยอดนับจริงหรือสถานะปิดวัน/)
})

test('Commission payout page uses distribution snapshots and existing authorized payout/acknowledgement RPCs', () => {
  assert.match(commission, /from\('commission_distributions'\)/)
  assert.match(commission, /rpc\('pay_staff_commission'/)
  assert.match(commission, /rpc\('acknowledge_my_commission'/)
  assert.match(commission, /p_bill_ids: selected\.unpaidEntries\.map\(row => row\.bill_id\)/)
  assert.match(commission, /Top Pending/)
  assert.match(commission, /commission-console__history-row/)
  assert.match(commission, /commission-console__select/)
  assert.match(commission, /from 'lucide-react'/)
  assert.match(commissionCss, /commission-console__branch/)
  assert.match(commissionCss, /@media/)
  assert.match(builder, /CommissionPayouts-C8fCkOtW\.js/)
  assert.match(builder, /CommissionPayouts\.css/)
})

test('Stock dashboard uses Lucide-only icons with unified 48px KPI containers', () => {
  assert.match(stock, /function MetricIcon\(/)
  for (const icon of ['PackageOpen', 'Boxes', 'TriangleAlert', 'PackageX', 'Coins', 'ClipboardCheck', 'Plus', 'Search', 'ListFilter', 'Minus', 'ChevronRight']) {
    assert.match(stock, new RegExp(`\\b${icon}\\b`))
  }
  assert.match(stock, /ยังไม่มีต้นทุนต่อหน่วยในระบบ/)
  assert.match(stock, /value="—"/)
  assert.match(stockCss, /flex:0 0 48px;height:48px/)
  assert.match(stockCss, /rgba\(249,115,22,\.12\)/)
  assert.match(builder, /stockOutputFiles\[0\]\.text/)
})

test('Expenses uses consistent Lucide icon mapping and KPI styling', () => {
  assert.match(expenses, /function ExpenseMetric\(/)
  for (const icon of ['WalletCards', 'Wallet', 'CalendarDays', 'ReceiptText', 'ChartPie', 'Store', 'Search', 'CalendarRange', 'Tags', 'ListFilter', 'ArrowUpDown', 'Download', 'Plus', 'Eye', 'Pencil', 'Trash2', 'CircleCheck', 'Clock3', 'CircleX']) {
    assert.match(expenses, new RegExp(`\\b${icon}\\b`))
  }
  assert.match(expenses, /<ExpenseMetric Icon=\{Wallet\}/)
  assert.match(expenses, /<ExpenseMetric Icon=\{CalendarDays\}/)
  assert.match(expenses, /<ExpenseMetric Icon=\{ReceiptText\}/)
  assert.match(expenses, /<ExpenseMetric Icon=\{ChartPie\}/)
  assert.match(expenses, /<ExpenseMetric Icon=\{Store\}/)
  assert.match(expenses, /from 'lucide-react'/)
  assert.match(builder, /expenses-react-runtime\.js/)
  assert.match(builder, /bundle: true/)
  assert.match(expensesCss, /flex: 0 0 48px/)
  assert.match(expenses, /strokeWidth=\{2\}/)
})

test('Daily closing dashboard summarizes live operations and keeps close-day persistence disabled', () => {
  assert.match(dailySummary, /from 'lucide-react'/)
  assert.match(dailySummary, /from '\.\.\/lib\/supabase'/)
  for (const label of ['รายได้รวม', 'จำนวนบิล', 'ค่าใช้จ่าย', 'ค่าคอมมิชชัน', 'สุทธิวันนี้', 'กระทบยอดเงินสด', 'รายการเคลื่อนไหววันนี้', 'แจ้งเตือนสต็อก']) {
    assert.ok(dailySummary.includes(label), `missing dashboard section: ${label}`)
  }
  assert.match(dailySummary, /fetchLedgerBefore\(start\)/)
  assert.match(dailySummary, /disabled title="หน้าปิดวันยังไม่บันทึกลงระบบ"/)
  assert.match(builder, /DailySummary-OhyJk4lZ\.js/)
  assert.match(builder, /DailySummary\.css/)
  assert.match(dailySummaryCss, /daily-closing__equation/)
  assert.match(dailySummaryCss, /@media \(max-width: 680px\)/)
  assert.match(dailySummary, /daily-closing__calendar-popover/)
  assert.match(dailySummary, /calendarMonth\.toLocaleDateString\('th-TH'/)
  assert.match(dailySummary, /setDateFrom\(''\)/)
  assert.match(dailySummary, /dateFrom, dateTo, staff, isOwner/)
  assert.match(dailySummary, /is-in-range/)
  assert.match(dailySummaryCss, /daily-closing__calendar-grid/)
  assert.doesNotMatch(dailySummary, /<input type="date"/)
})

test('workspace navigation slides in and pushes page content without overlapping it', () => {
  assert.match(builder, /ghost:toggle-sidebar/)
  assert.match(builder, /sidebar-scrim/)
  assert.match(builder, /is-drawer-open/)
  assert.match(builder, /app-header__menu-toggle/)
  assert.match(builder, /flex:0 0 0!important/)
  assert.match(builder, /flex-basis:228px!important/)
  assert.match(builder, /\.sidebar-scrim\{display:none!important\}/)
})

test('workspace pages use full desktop width and scale key dashboard content for large screens', () => {
  assert.match(builder, /const fullWidthWorkspaceCss = `/)
  assert.match(builder, /\.workspace-topline,\.app-header,\.page-enter\{box-sizing:border-box;max-width:none!important;width:100%!important\}/)
  assert.match(builder, /\.page-enter\{margin:0!important\}/)
  assert.match(builder, /@media\(min-width:1500px\)/)
  for (const selector of ['.stock-layout', '.stock-table td', '.expenses-metric__value', '.expenses-table td', '.dashboard-hero']) {
    assert.ok(builder.includes(selector), `missing large-screen sizing for ${selector}`)
  }
  assert.match(builder, /fullWidthWorkspaceCss/)
})

test('Kitchen Mini empty state uses the illustrated chef design', () => {
  assert.match(builder, /sabinagisa-pos-inbox__chef-art/)
  assert.match(builder, /เมื่อมีออเดอร์ใหม่ ระบบจะแจ้งที่นี่/)
  assert.match(builder, /kitchen-mini-empty-reference\.png/)
})
