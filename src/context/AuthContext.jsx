import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toAuthPassword } from '../lib/pin'

const AuthContext = createContext(null)
const STAFF_CACHE_KEY = 'ghostlab-staff-session'

// Staff PIN-login pattern:
// Each staff member gets a real Supabase Auth user under the hood, with
// email = `${name_en.toLowerCase()}@ghostlab-staff.com` and password = their PIN.
// This lets Supabase Auth handle the hashing/session (no need to manage
// pin_hash ourselves) while the UI only ever shows a PIN pad, not an email form.
// See /supabase/seed.sql for how these auth users + matching `staff` rows are created.

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)
  const authRequest = useRef(0)
  const sessionRef = useRef(null)

  useEffect(() => {
    let active = true

    const applySession = async (nextSession) => {
      const request = ++authRequest.current
      setLoading(true)

      if (!nextSession) {
        sessionRef.current = null
        setSession(null)
        setStaff(null)
        setLoading(false)
        return
      }

      sessionRef.current = nextSession
      setSession(nextSession)
      await loadStaff(nextSession.user.id, request)
    }

    // getSession() only reads the locally cached token. Refresh it first when it
    // has expired so the first PostgREST request is not sent with a stale JWT.
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return

      let initialSession = error ? null : data.session
      if (initialSession?.expires_at && initialSession.expires_at <= Math.floor(Date.now() / 1000)) {
        const refreshed = await supabase.auth.refreshSession()
        initialSession = refreshed.error ? null : refreshed.data.session
      }

      if (active) await applySession(initialSession)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Supabase refreshes the JWT when a background tab becomes active again.
      // Keep the current route and staff data intact; reloading the profile here
      // causes a visible page reset every time the user returns to this tab.
      if ((event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')
        && newSession
        && sessionRef.current?.user?.id === newSession.user.id) {
        sessionRef.current = newSession
        setSession(newSession)
        return
      }

      // Set the loading state before exposing a new session.  Without this,
      // a successful sign-in can render a protected route while its staff row
      // is still being fetched, which sends the user back to Login until a refresh.
      // Run outside the auth callback. Awaiting another Supabase operation from
      // inside this callback can contend with the auth client's internal lock.
      setTimeout(() => {
        if (active) applySession(newSession)
      }, 0)
    })

    return () => {
      active = false
      authRequest.current += 1
      listener.subscription.unsubscribe()
    }
  }, [])

  // Keep a server-side presence timestamp while the staff app is open. A
  // browser close cannot reliably send clock-out, so the database sweep uses
  // this heartbeat to close abandoned shifts after the configured grace time.
  useEffect(() => {
    if (!session?.user?.id || !staff?.id) return undefined

    let active = true
    const heartbeat = async () => {
      if (!active) return
      const { error } = await supabase.rpc('heartbeat_current_staff_attendance')
      if (active && error && error.code !== 'PGRST202') {
        console.warn('[Ghost Lab] Attendance heartbeat failed:', error)
      }
    }

    heartbeat()
    const timer = setInterval(heartbeat, 30_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [session?.user?.id, staff?.id])

  async function loadStaff(authUserId, request = ++authRequest.current, allowRefresh = true) {
    let data = null
    let error = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      ({ data, error } = await supabase
        .from('staff')
        .select('*, branches:primary_branch(*)')
        .eq('auth_user_id', authUserId)
        .maybeSingle())
      if (!error) break
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
    }

    if (error?.code === 'PGRST303' && allowRefresh) {
      const refreshed = await supabase.auth.refreshSession()
      if (!refreshed.error && refreshed.data.session) {
        setSession(refreshed.data.session)
        ;({ data, error } = await supabase
          .from('staff')
          .select('*, branches:primary_branch(*)')
          .eq('auth_user_id', authUserId)
          .maybeSingle())
      } else {
        await supabase.auth.signOut({ scope: 'local' })
      }
    }

    if (request !== authRequest.current) return
    if (data) {
      // A browser can be closed without a chance to run an async clock-out.
      // Close only genuinely stale shifts when the staff member returns; the
      // server function is scoped to the currently authenticated user.
      const { error: staleAttendanceError } = await supabase.rpc('auto_clock_out_current_staff', {
        p_source: 'stale_timeout',
      p_max_age_hours: 2,
      })
      if (staleAttendanceError) {
        // Keep login usable while an older database has not received the
        // attendance migration yet.
        console.warn('[Ghost Lab] Could not auto-close stale attendance:', staleAttendanceError)
      }
      setStaff(data)
      try { sessionStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(data)) } catch {}
    } else if (error) {
      // A transient network/RLS failure must not make a valid account appear
      // to vanish and redirect the user to Login. Keep the last known profile
      // for this browser session until the database can be read again.
      let cached = null
      try { cached = JSON.parse(sessionStorage.getItem(STAFF_CACHE_KEY) || 'null') } catch {}
      if (cached?.auth_user_id === authUserId) setStaff(cached)
      else setStaff(null)
      console.error('[Ghost Lab] Failed to load staff row:', error)
    } else {
      setStaff(null)
    }
    setLoading(false)
  }

  async function loginWithPin(nameEn, pin) {
    const email = `${nameEn.toLowerCase()}@ghostlab-staff.com`
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: toAuthPassword(pin) })
    if (error) return { ok: false, message: 'PIN ไม่ถูกต้อง' }
    return { ok: true }
  }

  async function logout() {
    // Explicit logout is the reliable path: close every open shift for this
    // authenticated staff member before ending the Supabase session.
    const { error: clockOutError } = await supabase.rpc('auto_clock_out_current_staff', {
      p_source: 'logout',
      p_max_age_hours: 2,
    })
    if (clockOutError) {
      console.warn('[Ghost Lab] Could not auto-clock-out on logout:', clockOutError)
    }
    await supabase.auth.signOut()
  }

  const value = { session, staff, loading, loginWithPin, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
