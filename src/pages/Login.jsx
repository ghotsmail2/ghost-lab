import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { publicSupabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Login.css'

function StaffAvatar({ staff, large = false }) {
  return <div className={`staff-avatar ${large ? 'staff-avatar--large' : ''}`} aria-hidden="true">{staff.name_en.slice(0, 2).toUpperCase()}</div>
}

export default function Login() {
  const [staffList, setStaffList] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState('profile')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeBrand, setActiveBrand] = useState(null)
  const [lockedBrand, setLockedBrand] = useState(null)
  const previewTimer = useRef(null)
  const { loginWithPin, session, staff, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Wait for AuthProvider to finish loading the matching staff row.  This
  // prevents navigating to a protected route in the short gap after PIN auth.
  useEffect(() => {
    if (session && staff && !loading) {
      const destination = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
        ? location.state.from
        : '/'
      navigate(destination, { replace: true })
    }
  }, [session, staff, loading, location.state, navigate])
  useEffect(() => {
    // This uses the isolated anonymous client, so it can load immediately even
    // while AuthProvider is refreshing or clearing an expired user session.
    publicSupabase.from('staff').select('id, name_en, name_th, role').eq('active', true).order('name_en').then(({ data, error: fetchError }) => {
      if (fetchError) { console.error(fetchError); return }
      setStaffList(data || [])
    })
  }, [])

  function chooseProfile(staff) {
    if (activeBrand) setLockedBrand(activeBrand)
    setSelected(staff)
    setPin('')
    setError('')
  }

  function continueProfile() {
    if (!selected) return
    setStep('pin')
  }

  const searchText = search.trim().toLowerCase()
  const visibleStaff = staffList.filter(member => !searchText
    || member.name_en?.toLowerCase().includes(searchText)
    || member.name_th?.toLowerCase().includes(searchText))

  const staffGroups = [
    { key: 'garage', label: 'Ghost Lab Garage', subtitle: 'Garage Team', icon: '⌁', members: visibleStaff.filter(member => !member.role?.startsWith('chill_')) },
    { key: 'chill', label: 'SABINAGISA', subtitle: 'Food & Drink Team', icon: '✦', members: visibleStaff.filter(member => member.role?.startsWith('chill_')) },
  ].filter(group => group.members.length > 0 && activeBrand && group.key === (activeBrand === 'sabinagisa' ? 'chill' : 'garage'))

  function previewBrand(brand) {
    if (lockedBrand || Date.now() < (window.__loginSuppressHoverUntil || 0)) return
    window.clearTimeout(previewTimer.current)
    setActiveBrand(brand)
  }

  function clearBrandPreview() {
    if (lockedBrand) return
    window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => setActiveBrand(null), 150)
  }

  function lockBrand(brand) {
    if (isSubmitting) return
    window.clearTimeout(previewTimer.current)
    setLockedBrand(brand)
    setActiveBrand(brand)
    setSelected(null)
    setStep('profile')
    setPin('')
    setError('')
    setSearch('')
  }

  function changeProfile() {
    if (isSubmitting) return
    setPin('')
    setError('')
    setStep('profile')
  }

  function press(key) {
    if (isSubmitting) return
    setError('')
    if (key === 'clear') setPin('')
    else if (key === 'back') setPin(current => current.slice(0, -1))
    else if (pin.length < 4) {
      const nextPin = pin + key
      setPin(nextPin)
      if (nextPin.length === 4) submit(nextPin)
    }
  }

  async function submit(fullPin) {
    if (!selected) return
    setIsSubmitting(true)
    const result = await loginWithPin(selected.name_en, fullPin)
    setIsSubmitting(false)
    if (!result.ok) {
      setError(result.message)
      setPin('')
    }
  }

  return (
    <main className="login-page" data-brand={activeBrand || 'default'}>
      <section className="login-shell" data-brand={activeBrand || 'default'} data-locked={lockedBrand ? 'true' : 'false'} aria-label="เข้าสู่ระบบ Ghost Lab" onMouseLeave={clearBrandPreview}>
        <div className="login-brand">
          <div className="login-brand__wordmark">GHOST·LAB × SABINAGISA</div>
          <div className="login-brand__kicker">TWO SOULS, ONE GARAGE</div>
          <div className="login-brand__kanji">技 · 味 · 心</div>
          <div className="login-brand__reading">わざ · あじ · こころ</div>
          <div className="login-brand__services">งานช่าง · บริการ · อาหาร · ประสบการณ์</div>
          <div className="login-brand__manifesto">
            <span>二つの世界、ひとつの美学。</span>
            <span>สองธุรกิจ หนึ่งมาตรฐาน</span>
          </div>
          <div className="login-brand__selectors" aria-label="เลือกทีม">
            <button type="button" className={`login-brand__zone login-brand__zone--sabinagisa${activeBrand === 'sabinagisa' ? ' is-active' : ''}`} aria-pressed={activeBrand === 'sabinagisa'} onMouseEnter={() => previewBrand('sabinagisa')} onFocus={() => previewBrand('sabinagisa')} onClick={() => lockBrand('sabinagisa')}>
              <span>FOOD &amp; DRINK</span><strong>SABINAGISA</strong><small>ร้านอาหารญี่ปุ่น</small>
            </button>
            <button type="button" className={`login-brand__zone login-brand__zone--garage${activeBrand === 'garage' ? ' is-active' : ''}`} aria-pressed={activeBrand === 'garage'} onMouseEnter={() => previewBrand('garage')} onFocus={() => previewBrand('garage')} onClick={() => lockBrand('garage')}>
              <span>GARAGE TEAM</span><strong>Ghost Lab Garage</strong><small>งานช่างและบริการ</small>
            </button>
          </div>
        </div>

        {step === 'profile' && activeBrand ? (
          <div className="login-card login-card--profiles">
            <div className="login-card__header">
              <span className="login-card__eyebrow">{activeBrand === 'sabinagisa' ? 'SABINAGISA · FOOD & DRINK TEAM' : 'GHOST LAB GARAGE · GARAGE TEAM'}</span>
              <h1>เลือกโปรไฟล์ของคุณ</h1>
              <p>เลือกชื่อก่อน แล้วจึงใส่ PIN เพื่อเข้าสู่ระบบ</p>
            </div>
            <div className="staff-picker__toolbar">
              <div className="staff-search">
                <span aria-hidden="true">⌕</span>
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาชื่อพนักงาน..." aria-label="ค้นหาพนักงาน" autoComplete="off" />
                {search && <button type="button" onClick={() => setSearch('')} aria-label="ล้างคำค้น">×</button>}
              </div>
              <span>{visibleStaff.length}/{staffList.length} คน</span>
            </div>
            <div className="staff-picker staff-picker--groups" role="list" aria-label="รายชื่อพนักงาน">
              {staffGroups.map(group => (
                <section key={group.key} className={`staff-picker__group staff-picker__group--${group.key}`}>
                  <div className="staff-picker__group-head"><span aria-hidden="true">{group.icon}</span><div><strong>{group.label}</strong><small>{group.subtitle}</small></div><b>{group.members.length} คน</b></div>
                  <div className="staff-picker__grid">
                    {group.members.map(staff => (
                      <button key={staff.id} type="button" className={`staff-card ${selected?.id === staff.id ? 'staff-card--selected' : ''}`} onClick={() => chooseProfile(staff)} role="listitem" aria-pressed={selected?.id === staff.id}>
                        <StaffAvatar staff={staff} />
                        <span className="staff-card__details"><strong>{staff.name_en}</strong>{staff.name_th && <small>{staff.name_th}</small>}</span>
                        {selected?.id === staff.id && <span className="staff-card__check" aria-label="เลือกแล้ว">✓</span>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              {staffList.length === 0 && <div className="staff-picker__empty">ยังไม่มีพนักงานในระบบ — เพิ่มผ่าน Supabase dashboard ก่อน</div>}
              {staffList.length > 0 && visibleStaff.length === 0 && <div className="staff-picker__empty">ไม่พบชื่อที่ค้นหา</div>}
            </div>
            <button type="button" className="login-continue" disabled={!selected} onClick={continueProfile}>ถัดไป (ใส่ PIN) <span aria-hidden="true">→</span></button>
          </div>
        ) : step === 'pin' ? (
          <div className="login-card login-card--pin">
            <button type="button" className="change-profile" onClick={changeProfile} disabled={isSubmitting}>← เปลี่ยนโปรไฟล์</button>
            <div className="selected-profile">
              <StaffAvatar staff={selected} large />
              <div><span className="selected-profile__label">กำลังเข้าสู่ระบบเป็น</span><h1>{selected.name_en}</h1>{selected.name_th && <p>{selected.name_th}</p>}</div>
            </div>
            <div className="pin-panel">
              <div className="pin-panel__label">ใส่ PIN 4 หลักเพื่อเข้าใช้งาน</div>
              <div className="pin-panel__error" role="alert">{error}</div>
              <div className="pin-dots" aria-label={`ใส่ PIN แล้ว ${pin.length} จาก 4 หลัก`}>
                {[0, 1, 2, 3].map(index => <span key={index} className={`pin-dot ${index < pin.length ? 'pin-dot--filled' : ''}`} />)}
              </div>
              <div className="pin-pad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map(key => (
                  <button key={key} type="button" onClick={() => press(key)} disabled={isSubmitting} className={`pin-pad__key ${key === 'clear' ? 'pin-pad__key--muted' : ''}`} aria-label={key === 'clear' ? 'ล้าง PIN' : key === 'back' ? 'ลบตัวเลขล่าสุด' : key}>{key === 'clear' ? 'ล้าง' : key === 'back' ? '⌫' : key}</button>
                ))}
              </div>
              {isSubmitting && <div className="pin-panel__status">กำลังตรวจสอบ PIN…</div>}
            </div>
          </div>
        ) : null}
        <footer className="login-footer">พนักงานใหม่? <Link to="/signup">สมัครสมาชิก</Link></footer>
      </section>
    </main>
  )
}
