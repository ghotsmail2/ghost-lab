import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const auth = await readFile(new URL('../src/context/AuthContext.jsx', import.meta.url), 'utf8')
const pos = await readFile(new URL('../src/pages/POSPage.jsx', import.meta.url), 'utf8')
const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261013000000_attendance_presence_heartbeat.sql', import.meta.url), 'utf8')
const builder = await readFile(new URL('./build-recovered.mjs', import.meta.url), 'utf8')
const recoveredPos = await readFile(new URL('../recovered-production/assets/POSPage-CxiIf3bD.js', import.meta.url), 'utf8')

test('authenticated app sends presence heartbeat and cleans it up on logout', () => {
  assert.match(auth, /rpc\('heartbeat_current_staff_attendance'\)/)
  assert.match(auth, /setInterval\(heartbeat, 30_000\)/)
  assert.match(auth, /clearInterval\(timer\)/)
  assert.match(builder, /heartbeat_current_staff_attendance/)
  assert.match(builder, /__ghostAttendanceHeartbeat/)
})

test('automatic clock-out defaults to two hours and records last-seen time', () => {
  assert.match(migration, /p_stale_after_seconds integer default 7200/)
  assert.match(migration, /make_interval\(secs => v_timeout_seconds\)/)
  assert.match(migration, /p_test_staff_id uuid default null/)
  assert.match(migration, /p_test_staff_id is not null and a\.staff_id = p_test_staff_id/)
  assert.match(migration, /clock_out = coalesce\(a\.last_seen_at, a\.clock_in\)/)
  assert.match(migration, /'\* \* \* \* \*'/)
  assert.match(migration, /auto_close_inactive_attendance\(\)/)
  assert.match(migration, /v_source = 'stale_timeout'[\s\S]*?coalesce\(a\.last_seen_at, a\.clock_in\)/)
})

test('60-second verification is supported while the final scheduled timeout stays at two hours', () => {
  assert.match(migration, /greatest\(coalesce\(p_stale_after_seconds, 7200\), 60\)/)
  assert.match(migration, /p_stale_after_seconds integer default 7200,[\s\S]*?p_test_staff_id uuid default null/)
  assert.match(migration, /select public\.auto_close_inactive_attendance\(\);/)
  assert.match(migration, /p_max_age_hours integer default 2/)
})

test('SABINAGISA confirms before an unclocked bill and still lets the cashier proceed intentionally', () => {
  const attendanceGuard = pos.indexOf("branch.key === 'chill' && !isOnShift && !confirmedWithoutAttendance")
  const emptyBillGuard = pos.indexOf('if (cart.length === 0)')
  assert.ok(attendanceGuard >= 0 && attendanceGuard < emptyBillGuard, 'attendance warning must appear before empty-cart validation')
  assert.match(pos, /อย่าลืมเข้างานนะ เดี๋ยวไม่ได้ค่าคอม/)
  assert.match(pos, /ถ้าบันทึกบิลตอนนี้ คุณจะไม่ได้รับค่าคอม Pool จากบิลนี้/)
  assert.match(pos, /confirmedWithoutAttendance = false/)
  assert.match(pos, /setShowAttendanceConfirm\(true\)/)
  assert.match(pos, /ยืนยันบิล · ไม่มีค่าคอม/)
  assert.match(pos, /disabled=\{submitting \|\| \(cart\.length === 0 && \(branch\.key !== 'chill' \|\| isOnShift\)\)\}/)
  assert.match(pos, /to="\/attendance" className="btn btn-secondary"/)
  assert.match(pos, /last_seen_at/)
  assert.match(pos, /commission: displayCommission/)
  assert.match(builder, /showAttendanceConfirm/)
  assert.match(builder, /confirmedUnclocked/)
  assert.match(builder, /อย่าลืมเข้างานนะ เดี๋ยวไม่ได้ค่าคอม/)
  assert.match(builder, /ยืนยันบิล · ไม่มีค่าคอม/)
  assert.match(builder, /n\.key !== "chill" \|\| isOnShift/)
  assert.match(builder, /last_seen_at/)
})

test('on-shift panel refreshes names and count while the dashboard remains open', () => {
  assert.match(auth, /setInterval\(heartbeat, 30_000\)/)
  assert.match(home, /setInterval\(refreshOnShiftStaff, 30_000\)/)
  assert.match(builder, /setInterval\(refresh,30000\)/)
})

test('dine-in order with no table number no longer triggers a blocking browser confirmation', () => {
  assert.doesNotMatch(recoveredPos, /ยังไม่ได้ระบุโต๊ะ/)
  assert.doesNotMatch(recoveredPos, /window\.confirm\("\\u0E22\\u0E31/)
})
