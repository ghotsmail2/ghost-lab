import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import './generate-catalog-prices.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(projectRoot, 'recovered-production')
const outputRoot = path.join(projectRoot, 'dist')

async function readSupabaseBrowserConfig() {
  const bundle = await readFile(path.join(sourceRoot, 'assets', 'index-vaWnYKxf.js'), 'utf8')
  const url = process.env.VITE_SUPABASE_URL || bundle.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)?.[0]
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
    || bundle.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]
    || bundle.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]

  if (!url || !anonKey) throw new Error('Unable to locate the public Supabase browser configuration.')
  return { url, anonKey }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(entry => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  }))
  return files.flat()
}

async function verifyAssetReferences(root = sourceRoot) {
  const files = await listFiles(root)
  const missing = new Set()

  for (const file of files.filter(item => /\.(?:html|js|css)$/.test(item))) {
    const contents = await readFile(file, 'utf8')
    const references = [
      ...contents.matchAll(/["'(]\/?assets\/([^"')?]+)/g),
      ...contents.matchAll(/(?:from\s*|import\(\s*)["']\.\/([^"']+)/g),
    ]

    for (const match of references) {
      const target = match[0].includes('assets/')
        ? path.join(root, 'assets', match[1])
        : path.resolve(path.dirname(file), match[1])
      try {
        await access(target)
      } catch {
        missing.add(path.relative(root, target))
      }
    }
  }

  if (missing.size) {
    throw new Error(`Recovered production is missing referenced assets:\n${[...missing].sort().join('\n')}`)
  }
}

await verifyAssetReferences()

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })
await cp(path.join(sourceRoot, 'index.html'), path.join(outputRoot, 'index.html'))
await cp(path.join(sourceRoot, 'assets'), path.join(outputRoot, 'assets'), { recursive: true })

// A versioned asset directory prevents browsers from mixing restored bundles
// with changed files that still have the original recovered hash filenames.
const assetFiles = (await listFiles(path.join(sourceRoot, 'assets'))).sort()
const supabaseBrowserConfig = await readSupabaseBrowserConfig()
const digest = createHash('sha256')
digest.update('release-transform-20261004-home-and-summary-date-range-2')
for (const file of assetFiles) digest.update(path.relative(sourceRoot, file)).update(await readFile(file))
const release = digest.digest('hex').slice(0, 16)
const versionedRoot = path.join(outputRoot, 'assets', release)
await cp(path.join(sourceRoot, 'assets'), versionedRoot, { recursive: true })
for (const file of (await listFiles(versionedRoot)).filter(file => /\.(js|css)$/.test(file))) {
  let content = await readFile(file, 'utf8')
  if (file.endsWith('.js')) {
    content = content
      .replaceAll('Ghost Chill Kitchen', 'SABINAGISA Kitchen')
      .replaceAll('GHOST CHILL', 'SABINAGISA')
      .replaceAll('Ghost Chill', 'SABINAGISA')
      .replaceAll('__SUPABASE_URL__', supabaseBrowserConfig.url)
      .replaceAll('__SUPABASE_ANON_KEY__', supabaseBrowserConfig.anonKey)

    // The recovered bundle predates the source AuthContext hardening. Apply
    // the same retry/cache behavior to the deployed bundle so transient RLS or
    // network failures cannot make a valid staff account look deleted.
    const oldStaffLoader = 'async function a(f){const{data:v,error:y}=await Ne.from("staff").select("*, branches:primary_branch(*)").eq("auth_user_id",f).single();y&&console.error("[Ghost Lab] Failed to load staff row:",y),s(v||null),o(!1)}'
    const newStaffLoader = 'async function a(f){let v=null,y=null;for(let g=0;g<3;g++){({data:v,error:y}=await Ne.from("staff").select("*, branches:primary_branch(*)").eq("auth_user_id",f).maybeSingle());if(!y)break;await new Promise(q=>setTimeout(q,250*(g+1)))}if(v){try{await Ne.rpc("auto_clock_out_current_staff",{p_source:"stale_timeout",p_max_age_hours:16})}catch{}s(v);try{sessionStorage.setItem("ghostlab-staff-session",JSON.stringify(v))}catch{}}else if(y){console.error("[Ghost Lab] Failed to load staff row:",y);try{const g=JSON.parse(sessionStorage.getItem("ghostlab-staff-session")||"null");g?.auth_user_id===f&&s(g)}catch{}}else s(null);o(!1)}'
    if (file.endsWith('index-vaWnYKxf.js') && !content.includes(oldStaffLoader)) {
      throw new Error('Recovered auth loader changed unexpectedly; refusing to build without account-stability patch.')
    }
    content = content.replace(oldStaffLoader, newStaffLoader)

    // The recovered production bundle also needs to ignore Supabase's silent
    // token-refresh event. Otherwise every background-tab return toggles the
    // global loading state and remounts the current route.
    const oldAuthState = 'const[e,r]=k.useState(null),[n,s]=k.useState(null),[i,o]=k.useState(!0);k.useEffect(()=>{Ne.auth.getSession().then(({data:v})=>{r(v.session),v.session?a(v.session.user.id):o(!1)});const{data:f}=Ne.auth.onAuthStateChange((v,y)=>{o(!0),r(y),y?a(y.user.id):(s(null),o(!1))});return()=>f.subscription.unsubscribe()},[])'
    const newAuthState = 'const[e,r]=k.useState(null),[n,s]=k.useState(null),[i,o]=k.useState(!0),sessionRef=k.useRef(null);k.useEffect(()=>{Ne.auth.getSession().then(({data:v})=>{sessionRef.current=v.session,r(v.session),v.session?a(v.session.user.id):o(!1)});const{data:f}=Ne.auth.onAuthStateChange((v,y)=>{if((v==="TOKEN_REFRESHED"||v==="INITIAL_SESSION")&&y&&sessionRef.current?.user?.id===y.user.id){sessionRef.current=y,r(y);return}o(!0),sessionRef.current=y,r(y),y?a(y.user.id):(s(null),o(!1))});return()=>f.subscription.unsubscribe()},[])'
    if (file.endsWith('index-vaWnYKxf.js') && content.includes(oldAuthState)) {
      content = content.replace(oldAuthState, newAuthState)
    }

    // Close open attendance on explicit logout. A browser close cannot
    // reliably await a network request, so stale sessions are also handled by
    // the login-time cleanup in the staff loader above.
    const oldLogout = 'async function u(){await Ne.auth.signOut()}'
    const newLogout = 'async function u(){try{await Ne.rpc("auto_clock_out_current_staff",{p_source:"logout",p_max_age_hours:16})}catch{}await Ne.auth.signOut()}'
    if (file.endsWith('index-vaWnYKxf.js')) {
      content = content.replace(oldLogout, newLogout)
    }

    // Ordinary staff may see the number of people currently working in their
    // own branch through a security-definer aggregate, without gaining access
    // to other employees' attendance rows.
    if (file.endsWith('Home-a48wstN-.js')) {
      const oldAttendanceCount = 'let m=u.from("attendance").select("id",{count:"exact",head:!0}).is("clock_out",null);!c&&(n!=null&&n.primary_branch)&&(m=m.eq("branch_id",n.primary_branch)),m.then(({count:y})=>f(y||0))'
      const newAttendanceCount = 'let m=c?u.from("attendance").select("id",{count:"exact",head:!0}).is("clock_out",null):n?.primary_branch?u.rpc("count_on_shift_staff",{p_branch_id:n.primary_branch}):Promise.resolve({data:0,count:null,error:null});m.then(({count:y,data:P,error:w})=>{w||f(Number(c?y:P)||0)})'
      content = content.replace(oldAttendanceCount, newAttendanceCount)

      // Show a compact, branch-safe list of the people currently on shift.
      const oldHomeState = ',[d,S]=i.useState(null),[j,_]=i.useState(!1),[z,W]=i.useState([]),c=G(n)'
      const newHomeState = ',[d,S]=i.useState(null),[j,_]=i.useState(!1),[z,W]=i.useState([]),[onShiftStaff,setOnShiftStaff]=i.useState([]),[showOnShiftStaff,setShowOnShiftStaff]=i.useState(!1),[personalCommission,setPersonalCommission]=i.useState(0),[personalCommissionBills,setPersonalCommissionBills]=i.useState(0),c=G(n)'
      content = content.replace(oldHomeState, newHomeState)

      const oldHomeEffectBoundary = '},[s,v,c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{n!=null&&n.id&&u.from("attendance")'
      const newHomeEffectBoundary = '},[s,v,c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{if(c||!n?.id){setPersonalCommission(0),setPersonalCommissionBills(0);return}const t=new Date;let a=null;if(s==="today"&&t.setHours(0,0,0,0),s==="week"&&(t.setDate(t.getDate()-6),t.setHours(0,0,0,0)),s==="month"&&(t.setDate(1),t.setHours(0,0,0,0)),s==="date"){const[y,w,P]=v.split("-").map(Number);t.setFullYear(y,w-1,P),t.setHours(0,0,0,0),a=new Date(t),a.setDate(a.getDate()+1)}let l=u.from("commission_distributions").select("amount,created_at").eq("user_id",n.id).is("reversed_at",null);s!=="all"&&(l=l.gte("created_at",t.toISOString())),a&&(l=l.lt("created_at",a.toISOString())),l.then(({data:y,error:w})=>{w?console.error("[Ghost Lab] Failed to load personal commission:",w):(setPersonalCommission((y||[]).reduce((t,a)=>t+Number(a.amount||0),0)),setPersonalCommissionBills((y||[]).length))})},[c,n==null?void 0:n.id,s,v]),i.useEffect(()=>{u.rpc("list_on_shift_staff",{p_branch_id:c?null:n?.primary_branch||null}).then(({data:t,error:a})=>{a?console.error("[Ghost Lab] Failed to load on-shift staff:",a):setOnShiftStaff(t||[])})},[c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{n!=null&&n.id&&u.from("attendance")'
      content = content.replace(oldHomeEffectBoundary, newHomeEffectBoundary)

      const oldOnShiftCard = 'e.jsx(p,{label:"พนักงานเข้างาน",value:`${o} คน`})'
      const newOnShiftCard = 'e.jsx("button",{type:"button",onClick:()=>setShowOnShiftStaff(!0),ariaLabel:"ดูรายชื่อพนักงานที่เข้างาน",style:{background:"transparent",border:0,color:"inherit",cursor:"pointer",padding:0,textAlign:"left"},children:e.jsx(p,{label:"พนักงานเข้างาน",value:`${o} คน`,meta:"กดดูรายชื่อ"})})'
      content = content.replace(oldOnShiftCard, newOnShiftCard)

      // Ordinary staff should see their own earned commission on Home. Owner/GOD
      // keeps the existing team-wide aggregate card.
      const oldCommissionCard = 'e.jsx(p,{label:`COMMISSION ${h}`,value:`¥${M.toLocaleString()}`,accent:!0})'
      const newCommissionCard = 'e.jsx(p,{label:c?`COMMISSION ${h}`:`ค่าคอมของฉัน ${h}`,value:`¥${(c?M:personalCommission).toLocaleString()}`,meta:c?void 0:`${personalCommissionBills} บิล`,accent:!0})'
      content = content.replace(oldCommissionCard, newCommissionCard)

      const oldHomeRootClose = '})]})}function p({label:n'
      const onShiftModal = '}),showOnShiftStaff&&e.jsx("div",{role:"presentation",onClick:t=>{t.target===t.currentTarget&&setShowOnShiftStaff(!1)},style:{alignItems:"center",background:"rgba(0,0,0,.62)",display:"flex",inset:0,justifyContent:"center",padding:18,position:"fixed",zIndex:30},children:e.jsxs("section",{role:"dialog",className:"panel",style:{maxWidth:430,width:"100%"},children:[e.jsxs("div",{style:{alignItems:"center",display:"flex",justifyContent:"space-between",marginBottom:12},children:[e.jsxs("div",{children:[e.jsx("div",{className:"font-display",style:{fontSize:15,fontWeight:600},children:"พนักงานที่เข้างานอยู่"}),e.jsxs("div",{style:{color:"var(--ghost-gray)",fontSize:11,marginTop:3},children:[onShiftStaff.length," คน"]})]}),e.jsx("button",{type:"button",className:"btn",onClick:()=>setShowOnShiftStaff(!1),style:{fontSize:12},children:"ปิด"})]}),onShiftStaff.length===0?e.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:12,padding:"14px 0",textAlign:"center"},children:"ยังไม่มีพนักงานเข้างาน"}):onShiftStaff.map(t=>e.jsxs("div",{style:{alignItems:"center",borderTop:"1px solid var(--line)",display:"flex",justifyContent:"space-between",padding:"10px 0"},children:[e.jsxs("div",{children:[e.jsx("strong",{style:{fontSize:13},children:t.name_en}),e.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,marginTop:3},children:t.branch_name||"ไม่ระบุสาขา"})]}),e.jsx("span",{className:"font-mono",style:{color:"#84d6a8",fontSize:11},children:new Date(t.clock_in).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})})]},`${t.branch_id}-${t.id}`))]})})]})}function p({label:n'
      content = content.replace(oldHomeRootClose, onShiftModal)
    }

    // Keep inactive staff visible in Owner's admin list so deactivation is
    // reversible and cannot be mistaken for account deletion.
    content = content.replace(
      'd.from("staff").select("*").eq("active",!0).order("name_en")',
      'd.from("staff").select("*").order("active",{ascending:!1}).order("name_en")',
    )

    // Adapt the recovered Commission page to the immutable recipient snapshot.
    if (file.endsWith('CommissionPayouts-C8fCkOtW.js')) {
      const oldCommissionQuery = 'c.from("bills").select("id,bill_number,staff_id,branch_id,commission,created_at,status,staff:staff_id(name_en,phone,avatar_url),branches:branch_id(name,key)").gt("commission",0).neq("status","rejected").order("created_at",{ascending:!1}).limit(500)'
      const newCommissionQuery = 'c.from("commission_distributions").select("id,bill_id,user_id,amount,created_at,paid_at,reversed_at,commission_mode,recipient:user_id(name_en,phone,avatar_url),bill:bill_id(bill_number,branch_id,commission,created_at,status,branches:branch_id(name,key))").is("paid_at",null).is("reversed_at",null).order("created_at",{ascending:!1}).limit(2000)'
      content = content.replace(oldCommissionQuery, newCommissionQuery)
      content = content.replace(
        'E.error&&r(E.error.message),B(E.data||[]),O((s.data||[]).map(n=>n.bill_id)),b(e.data||[])',
        'E.error&&r(E.error.message);const n=(E.data||[]).map(o=>({...o,id:o.id,bill_id:o.bill_id,staff_id:o.user_id,branch_id:o.bill?.branch_id,commission:o.amount,staff:o.recipient,branches:o.bill?.branches,bill_number:o.bill?.bill_number,status:o.bill?.status}));B(n),O((s.data||[]).map(o=>o.bill_id)),b(e.data||[])',
      )
      content = content.replace('p_bill_ids:l.bills.map(e=>e.id)', 'p_bill_ids:l.bills.map(e=>e.bill_id||e.id)')
    }

    // In the in-app browser, window.prompt is unsupported and aborts bill cancellation
    // before the cancel_bill_safely RPC can run. Use a safe default audit reason.
    if (file.endsWith('POSPage-CxiIf3bD.js')) {
      content = content.replace(
        /const o = window\.prompt\([\s\S]*?\);\s*if \(!\(o != null && o\.trim\(\)\)\) return;/,
        'const o = "ยกเลิกโดยผู้ดูแลระบบ";'
      )

      // Allow a cashier to enter an explicit percentage discount for either
      // branch. It is applied after member/free-repair discounts and capped
      // at the remaining bill total so totals can never become negative.
      content = content.replace(
        '    [E, ne] = i.useState(() => Boolean(initialDraft == null ? void 0 : initialDraft.memberEnabled)),\n    [q, se]',
        '    [E, ne] = i.useState(() => Boolean(initialDraft == null ? void 0 : initialDraft.memberEnabled)),\n    [manualDiscountPct, setManualDiscountPct] = i.useState(() => Number(initialDraft == null ? void 0 : initialDraft.manualDiscountPct) || 0),\n    [q, se]',
      )
      content = content.replace(
        'paymentMethod: $, amountReceived: I }));',
        'paymentMethod: $, amountReceived: I, manualDiscountPct }));',
      )
      content = content.replace(
        '}, [cartSelection, l, s, c, M, E, q, H, $, I, draftStorageKey]);',
        '}, [cartSelection, l, s, c, M, E, manualDiscountPct, q, H, $, I, draftStorageKey]);',
      )
      content = content.replace(
        '    Z = Y || de,\n    O = M || de ? 0 : N.total,\n    pe = M ? 0 : n.commission_flat;',
        '    Z = Y || de,\n    safeManualDiscountPct = Math.min(100, Math.max(0, Number(manualDiscountPct) || 0)),\n    manualDiscountAmount = Math.min(N.total, Math.round(N.total * safeManualDiscountPct / 100)),\n    O = M || de ? 0 : Math.max(0, N.total - manualDiscountAmount),\n    discountPctForBill = M ? 0 : de ? 100 : W > 0 ? Number((100 - O / W * 100).toFixed(2)) : 0,\n    pe = M ? 0 : n.commission_flat;',
      )
      content = content.replace(
        'discount_pct: M ? 0 : de ? 100 : N.percentage,',
        'discount_pct: discountPctForBill,',
      )
      const discountMarker = `        }), e.jsxs("div", {\n          className: "font-mono",\n          style: {\n            display: "flex",\n            justifyContent: "space-between",\n            fontSize: 13,\n            color: "var(--ghost-gray)",\n            marginBottom: 6\n          },\n          children: [e.jsx("span", {\n            children: "COMMISSION (FLAT)"`
      const discountField = `        }), !M && e.jsxs("label", {style: {display: "grid", gap: 6, marginBottom: 12}, children: [e.jsx("span", {style: {color: "var(--ghost-gray)", fontSize: 10, letterSpacing: .8}, children: "ส่วนลด (%)"}), e.jsx("input", {className: "input", type: "number", min: 0, max: 100, step: "0.01", inputMode: "decimal", placeholder: "เช่น 10", value: safeManualDiscountPct || "", onChange: t => setManualDiscountPct(Math.min(100, Math.max(0, Number(t.target.value) || 0)))}), manualDiscountAmount > 0 && e.jsxs("span", {className: "font-mono", style: {color: "#84d6a8", fontSize: 11}, children: ["−¥", manualDiscountAmount.toLocaleString(), " จากยอดหลังส่วนลดสมาชิก"]})]}), e.jsxs("div", {\n          className: "font-mono",\n          style: {\n            display: "flex",\n            justifyContent: "space-between",\n            fontSize: 13,\n            color: "var(--ghost-gray)",\n            marginBottom: 6\n          },\n          children: [e.jsx("span", {\n            children: "COMMISSION (FLAT)"`
      content = content.replace(discountMarker, discountField)
    }

    // Membership is data-driven in the collaboration system. Keep the
    // recovered production bundle compatible with old member rows while
    // presenting the new fixed 3/5/7% tiers and cashback benefits.
    if (file.endsWith('membership-BI3ZslQk.js')) {
      const membershipModule = `const i={garage:{regular:{key:"regular",label:"Chill",monthlyFee:0,discounts:{0:3},discountPercent:3,cashbackPercent:0,benefit:"3% OFF · Member Event · Reward พื้นฐาน"},silver:{key:"silver",label:"Silver",monthlyFee:25000,discounts:{0:5},discountPercent:5,cashbackPercent:0,benefit:"5% OFF · Engine Repair Kit x1 · Priority Queue"},gold:{key:"gold",label:"Gold",monthlyFee:50000,discounts:{0:7},discountPercent:7,cashbackPercent:3,benefit:"7% OFF · Repair Kits x3 · Cashback 3% · VIP"}},chill:null};i.chill=i.garage;const h=i.garage,p=Object.keys(h);function d(e,t="garage"){const n=i[t]||i.garage;return n[e]||n.regular}function y(e){return[{minimum:0,percentage:Math.min(7,Number(e.discountPercent||0))}]}function M(e,t=new Date){if(!(e!=null&&e.membership_expires_at))return!1;const n=t instanceof Date?t.getTime():Date.now();return new Date(e.membership_expires_at).getTime()>=n}function D(e,t,n=(g=>(g=e==null?void 0:e.branches)==null?void 0:g.key)()||"garage",a=new Date){const o=Number(t||0),r=d(e==null?void 0:e.tier,n),l=M(e,a),c=l?y(r)[0].percentage:0,u=Math.round(o*c/100);return{active:l,plan:r,percentage:c,amount:u,total:o-u}}function w(e){return e?new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(e)):"ยังไม่เปิดใช้"}function S(e){const n=new Date,a=new Date(n);return a.setMonth(a.getMonth()+1),a.toISOString()}function b(e,t){const n=new Date(e),a=new Date(n);return a.setMonth(a.getMonth()+Math.max(1,Number(t)||1)),a.toISOString()}function m(e=new Date){const t=new Date(e),n=t.getTimezoneOffset()*6e4;return new Date(t.getTime()-n).toISOString().slice(0,10)}export{p as M,y as a,b,D as c,w as f,d as g,M as i,S as n,m as t};`;
      const detailedMembershipModule = membershipModule
        .replace('benefit:"3% OFF · Member Event · Reward พื้นฐาน"', 'benefit:"3% OFF · Member Event · Reward พื้นฐาน",benefits:["ส่วนลด 3% ทุกบริการที่ร่วมรายการ","เข้าร่วม Member Event","รับข่าวสารและโปรโมชั่น","รับ Reward พื้นฐาน","เข้าร่วม Campaign สำหรับ Chill"]')
        .replace('benefit:"5% OFF · Engine Repair Kit x1 · Priority Queue"', 'benefit:"5% OFF · Engine Repair Kit x1 · Priority Queue",benefits:["ส่วนลด 5% ทุกบริการที่ร่วมรายการ","Engine Repair Kit x1 ต่อเดือน","Priority Queue คิวพิเศษก่อนสมาชิกทั่วไป","เข้าร่วม Member Event","รับ Promotion สำหรับ Silver","ซื้อ Collaboration Item ที่ร่วมรายการ"]')
        .replace('benefit:"7% OFF · Repair Kits x3 · Cashback 3% · VIP"', 'benefit:"7% OFF · Repair Kits x3 · Cashback 3% · VIP",benefits:["ส่วนลด 7% ทุกบริการที่ร่วมรายการ","Engine Repair Kit x2 ต่อเดือน","Full Repair Kit x1 ต่อเดือน","เครดิตคืน 3% เข้า Wallet","VIP Priority Queue และ VIP Event","Birthday Reward และ Limited Item Access","Gold Exclusive Promotion และของขวัญ Campaign"]')
      content = detailedMembershipModule
    }

    // Add a compact Collaboration control surface to the existing Members
    // screen. Owners can create/disable promotions without a code deploy;
    // everyone can see the active campaign and its eligible benefits.
    if (file.endsWith('Members-Gwy05wzy.js')) {
      const oldPlans = 'e.jsx(ne,{branchKey:w,onAdd:s=>_({tier:s})})'
      const newPlans = 'e.jsxs(e.Fragment,{children:[e.jsx(ne,{branchKey:w,onAdd:s=>_({tier:s})}),e.jsx(ce,{staff:a})]})'
      content = content.replace(oldPlans, newPlans)
      content = content.replace('[h,O]=l.useState({}),[k,F]', '[h,O]=l.useState({}),[wallets,setWallets]=l.useState({}),[k,F]')
      content = content.replace('const[s,r,n]=await Promise.all([f.from("branches").select("*").order("name"),f.from("members").select("*, branches:branch_id(key,name)").is("archived_at",null).order("created_at",{ascending:!1}),f.from("member_rewards").select("member_id").eq("status","available")]);', 'const[s,r,n,walletResult]=await Promise.all([f.from("branches").select("*").order("name"),f.from("members").select("*, branches:branch_id(key,name)").is("archived_at",null).order("created_at",{ascending:!1}),f.from("member_rewards").select("member_id").eq("status","available"),f.from("member_wallets").select("member_id,balance")]);')
      content = content.replace('if(!n.error){const d={};n.data.forEach(v=>{d[v.member_id]=(d[v.member_id]||0)+1}),O(d)}T(!1)', 'if(!n.error){const d={};n.data.forEach(v=>{d[v.member_id]=(d[v.member_id]||0)+1}),O(d)}if(!walletResult.error){const d={};(walletResult.data||[]).forEach(v=>{d[v.member_id]=Number(v.balance||0)}),setWallets(d)}T(!1)')
      content = content.replace('e.jsx("strong",{className:"member-spend",children:C(s.total_spent)})', 'e.jsxs("div",{className:"member-spend",children:[e.jsx("strong",{children:C(s.total_spent)}),e.jsxs("small",{style:{color:"#84d6a8",display:"block",fontSize:10,marginTop:3},children:["Wallet ",C(wallets[s.id]||0)]})]})')
      const oldMemberName = 'e.jsx("strong",{children:s.name}),e.jsxs("small",{children:[s.phone||"ไม่ระบุเบอร์",s.plate_or_note&&` · ${s.plate_or_note}`]})'
      const newMemberName = 'e.jsx("strong",{children:s.name}),e.jsxs("small",{children:[s.phone||"ไม่ระบุเบอร์",s.plate_or_note&&` · ${s.plate_or_note}`,s.brand_source&&e.jsxs("span",{style:{color:"#d8b24c",marginLeft:6},children:["· ",s.brand_source]})]})'
      content = content.replace(oldMemberName, newMemberName)
      const oldBenefit = 'e.jsxs("p",{className:o==="gold"?"membership-plan__reward":"",children:["✦ ",i.benefit]})'
      const newBenefit = 'e.jsxs("div",{className:"membership-plan__benefits",style:{display:"grid",gap:3,marginTop:6},children:(i.benefits||[i.benefit]).map((t,c)=>e.jsxs("p",{className:o==="gold"?"membership-plan__reward":"",style:{margin:0},children:[c===0?"✦ ":"• ",t]},c))})'
      content = content.replace(oldBenefit, newBenefit)
      content = content.replace('[p,P]=l.useState("all"),[j,I]', '[p,P]=l.useState("all"),[brandFilter,setBrandFilter]=l.useState("all"),[j,I]')
      content = content.replace('return n&&x})},[i,p,j])', 'return n&&x&&(brandFilter==="all"||r.brand_source===brandFilter)})},[i,p,j,brandFilter])')
      content = content.replace('}),k&&e.jsxs("div",{className:"members-error"', '}),e.jsxs("div",{className:"member-filters",style:{marginTop:8},children:[e.jsx("span",{style:{color:"var(--ghost-gray)",fontSize:11,marginRight:8},children:"Brand Source"}),["all","GHOSTLAB","SABINAGISA","COLLAB"].map(t=>e.jsx("button",{type:"button",className:brandFilter===t?"is-active":"",onClick:()=>setBrandFilter(t),children:t==="all"?"ทั้งหมด":t},t))]}),k&&e.jsxs("div",{className:"members-error"')
      const insertBefore = 'export{de as default};'
      const adminPanel = "function ce({staff:a}){const[p,setP]=l.useState([]),[show,setShow]=l.useState(!1),[name,setName]=l.useState(\"\"),[disc,setDisc]=l.useState(0),[err,setErr]=l.useState(\"\");l.useEffect(()=>{f.from(\"promotions\").select(\"*\").in(\"status\",[\"ACTIVE\",\"DRAFT\"]).order(\"priority\",{ascending:!1}).then(({data:t})=>setP(t||[]))},[show]);const owner=a&&(a.role===\"owner\"||a.role===\"god\");async function save(t){t.preventDefault();const{error:n}=await f.from(\"promotions\").insert({promotion_name:name,description:\"\",discount_percent:Math.min(7,Math.max(0,Number(disc)||0)),cashback_percent:0,eligible_tier:[\"chill\",\"silver\",\"gold\"],status:\"ACTIVE\",badge:\"COLLAB\"});if(n){setErr(n.message);return}setName(\"\"),setDisc(0),setShow(!1)}async function toggle(t){await f.from(\"promotions\").update({status:t.status===\"ACTIVE\"?\"INACTIVE\":\"ACTIVE\"}).eq(\"id\",t.id);setShow(!show)}return e.jsxs(\"section\",{className:\"membership-plans\",style:{marginTop:18},children:[e.jsx(\"img\",{src:\"assets/collaboration-banner.png\",alt:\"TWO SOULS, ONE GARAGE\",style:{borderRadius:12,display:\"block\",height:\"auto\",marginBottom:14,maxHeight:260,objectFit:\"cover\",width:\"100%\"}}),e.jsxs(\"div\",{style:{display:\"flex\",justifyContent:\"space-between\",alignItems:\"center\"},children:[e.jsxs(\"div\",{children:[e.jsx(\"span\",{style:{color:\"#c51f2f\",fontSize:11,letterSpacing:2},children:\"TWO SOULS, ONE GARAGE\"}),e.jsx(\"h2\",{className:\"font-display\",children:\"GHOSTLAB × SABINAGISA\"})]}),owner&&e.jsx(\"button\",{type:\"button\",className:\"membership-plan__add\",onClick:()=>setShow(!show),children:\"+ Promotion\"})]}),e.jsx(\"p\",{style:{color:\"var(--ghost-gray)\",fontSize:12},children:\"Membership เดียวกัน · แบรนด์ต้นทาง GHOSTLAB / SABINAGISA / COLLAB\"}),e.jsx(\"div\",{style:{display:\"grid\",gap:8},children:p.map(t=>e.jsxs(\"div\",{style:{display:\"flex\",justifyContent:\"space-between\",borderTop:\"1px solid var(--line)\",padding:\"8px 0\"},children:[e.jsxs(\"span\",{children:[t.promotion_name,\" \",t.badge&&e.jsx(\"em\",{children:t.badge})]}),owner&&e.jsx(\"button\",{type:\"button\",onClick:()=>toggle(t),children:t.status===\"ACTIVE\"?\"ปิด\":\"เปิด\"})]},t.id))}),owner&&show&&e.jsxs(\"form\",{onSubmit:save,style:{display:\"grid\",gap:8,marginTop:10},children:[e.jsx(\"input\",{className:\"input\",placeholder:\"ชื่อ Promotion\",value:name,onChange:t=>setName(t.target.value),required:!0}),e.jsx(\"input\",{className:\"input\",type:\"number\",min:0,max:7,step:\"0.01\",placeholder:\"ส่วนลด % สูงสุด 7\",value:disc,onChange:t=>setDisc(t.target.value)}),e.jsxs(\"div\",{style:{display:\"flex\",gap:8},children:[e.jsx(\"button\",{type:\"submit\",className:\"btn btn-primary\",children:\"บันทึก\"}),err&&e.jsx(\"small\",{children:err})]})]})]})}"
      if (content.includes(insertBefore)) content = content.replace(insertBefore, adminPanel + insertBefore)
    }
  }
  // Vite's dynamic preload map uses assets/foo; relative module imports stay local.
  await writeFile(file, content.replaceAll('assets/', `assets/${release}/`))
}
const index = await readFile(path.join(outputRoot, 'index.html'), 'utf8')
await writeFile(path.join(outputRoot, 'index.html'), index.replaceAll('/assets/', `/assets/${release}/`))
await verifyAssetReferences(outputRoot)

console.log(`Built recovered Ghost Lab production UI (${release}) with all referenced assets present.`)
// Runtime safety follow-up patches for the deployed recovered bundles.
const authAsset = path.join(outputRoot, 'assets', release, 'index-vaWnYKxf.js')
let authAssetContent = await readFile(authAsset, 'utf8')
authAssetContent = authAssetContent.replace('if(v){s(v);','if(v){try{await Ne.rpc("auto_clock_out_current_staff",{p_source:"stale_timeout",p_max_age_hours:16})}catch{}s(v);')
authAssetContent = authAssetContent.replace('async function u(){await Ne.auth.signOut()}','async function u(){try{await Ne.rpc("auto_clock_out_current_staff",{p_source:"logout",p_max_age_hours:16})}catch{}await Ne.auth.signOut()}')
await writeFile(authAsset, authAssetContent)
const homeAsset = path.join(outputRoot, 'assets', release, 'Home-a48wstN-.js')
let homeAssetContent = await readFile(homeAsset, 'utf8')
homeAssetContent = homeAssetContent.replace('let m=u.from("attendance").select("id",{count:"exact",head:!0}).is("clock_out",null);!c&&(n!=null&&n.primary_branch)&&(m=m.eq("branch_id",n.primary_branch)),m.then(({count:y})=>f(y||0))','let m=c?u.from("attendance").select("id",{count:"exact",head:!0}).is("clock_out",null):n?.primary_branch?u.rpc("count_on_shift_staff",{p_branch_id:n.primary_branch}):Promise.resolve({data:0,count:null,error:null});m.then(({count:y,data:P,error:w})=>{w||f(Number(c?y:P)||0)})')
await writeFile(homeAsset, homeAssetContent)
// Add a compact on-shift roster to the recovered production Home bundle.
const onShiftHomeAsset = path.join(outputRoot, 'assets', release, 'Home-a48wstN-.js')
let onShiftHome = await readFile(onShiftHomeAsset, 'utf8')
if (!onShiftHome.includes('list_on_shift_staff')) {
  onShiftHome = onShiftHome.replace(
    ',[d,S]=i.useState(null),[j,_]=i.useState(!1),[z,W]=i.useState([]),c=G(n)',
    ',[d,S]=i.useState(null),[j,_]=i.useState(!1),[z,W]=i.useState([]),[onShiftStaff,setOnShiftStaff]=i.useState([]),[showOnShiftStaff,setShowOnShiftStaff]=i.useState(!1),c=G(n)',
  )
  onShiftHome = onShiftHome.replace(
    '},[s,v,c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{n!=null&&n.id&&u.from("attendance")',
    '},[s,v,c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{u.rpc("list_on_shift_staff",{p_branch_id:c?null:n?.primary_branch||null}).then(({data:t,error:a})=>{a?console.error("[Ghost Lab] Failed to load on-shift staff:",a):setOnShiftStaff(t||[])})},[c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{n!=null&&n.id&&u.from("attendance")',
  )
  const tick = String.fromCharCode(96)
  const oldOnShiftCard = 'e.jsx(p,{label:"พนักงานเข้างาน",value:' + tick + '$' + '{o} คน' + tick + '})'
  const newOnShiftCard = 'e.jsx("button",{type:"button",onClick:()=>setShowOnShiftStaff(!0),ariaLabel:"ดูรายชื่อพนักงานที่เข้างาน",style:{background:"transparent",border:0,color:"inherit",cursor:"pointer",padding:0,textAlign:"left"},children:e.jsx(p,{label:"พนักงานเข้างาน",value:' + tick + '$' + '{o} คน' + tick + ',meta:"กดดูรายชื่อ"})})'
  onShiftHome = onShiftHome.replace(oldOnShiftCard, newOnShiftCard)
  onShiftHome = onShiftHome.replace(
    '})]})}function p({label:n',
    '}),showOnShiftStaff&&e.jsx("div",{role:"presentation",onClick:t=>{t.target===t.currentTarget&&setShowOnShiftStaff(!1)},style:{alignItems:"center",background:"rgba(0,0,0,.62)",display:"flex",inset:0,justifyContent:"center",padding:18,position:"fixed",zIndex:30},children:e.jsxs("section",{role:"dialog",className:"panel",style:{maxWidth:430,width:"100%"},children:[e.jsxs("div",{style:{alignItems:"center",display:"flex",justifyContent:"space-between",marginBottom:12},children:[e.jsxs("div",{children:[e.jsx("div",{className:"font-display",style:{fontSize:15,fontWeight:600},children:"พนักงานที่เข้างานอยู่"}),e.jsxs("div",{style:{color:"var(--ghost-gray)",fontSize:11,marginTop:3},children:[onShiftStaff.length," คน"]})]}),e.jsx("button",{type:"button",className:"btn",onClick:()=>setShowOnShiftStaff(!1),style:{fontSize:12},children:"ปิด"})]}),onShiftStaff.length===0?e.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:12,padding:"14px 0",textAlign:"center"},children:"ยังไม่มีพนักงานเข้างาน"}):onShiftStaff.map(t=>e.jsxs("div",{style:{alignItems:"center",borderTop:"1px solid var(--line)",display:"flex",justifyContent:"space-between",padding:"10px 0"},children:[e.jsxs("div",{children:[e.jsx("strong",{style:{fontSize:13},children:t.name_en}),e.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,marginTop:3},children:t.branch_name||"ไม่ระบุสาขา"})]}),e.jsx("span",{className:"font-mono",style:{color:"#84d6a8",fontSize:11},children:new Date(t.clock_in).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})})]},t.id))]})})]})}function p({label:n',
  )
}

await writeFile(onShiftHomeAsset, onShiftHome)

// Allow cashiers to enter a manual percentage discount in both branch POS forms.
const manualDiscountAsset = path.join(outputRoot, 'assets', release, 'POSPage-CxiIf3bD.js')
let manualDiscountContent = await readFile(manualDiscountAsset, 'utf8')
if (!manualDiscountContent.includes('manualDiscountPct')) {
  manualDiscountContent = manualDiscountContent.replace(
    '    [E, ne] = i.useState(() => Boolean(initialDraft == null ? void 0 : initialDraft.memberEnabled)),\n    [q, se]',
    '    [E, ne] = i.useState(() => Boolean(initialDraft == null ? void 0 : initialDraft.memberEnabled)),\n    [manualDiscountPct, setManualDiscountPct] = i.useState(() => Number(initialDraft == null ? void 0 : initialDraft.manualDiscountPct) || 0),\n    [q, se]',
  )
  manualDiscountContent = manualDiscountContent.replace('paymentMethod: $, amountReceived: I }));', 'paymentMethod: $, amountReceived: I, manualDiscountPct }));')
  manualDiscountContent = manualDiscountContent.replace('}, [cartSelection, l, s, c, M, E, q, H, $, I, draftStorageKey]);', '}, [cartSelection, l, s, c, M, E, manualDiscountPct, q, H, $, I, draftStorageKey]);')
  manualDiscountContent = manualDiscountContent.replace(
    '    Z = Y || de,\n    O = M || de ? 0 : N.total,\n    pe = M ? 0 : n.commission_flat;',
    '    Z = Y || de,\n    safeManualDiscountPct = Math.min(100, Math.max(0, Number(manualDiscountPct) || 0)),\n    manualDiscountAmount = Math.min(N.total, Math.round(N.total * safeManualDiscountPct / 100)),\n    O = M || de ? 0 : Math.max(0, N.total - manualDiscountAmount),\n    discountPctForBill = M ? 0 : de ? 100 : W > 0 ? Number((100 - O / W * 100).toFixed(2)) : 0,\n    pe = M ? 0 : n.commission_flat;',
  )
  manualDiscountContent = manualDiscountContent.replace('discount_pct: M ? 0 : de ? 100 : N.percentage,', 'discount_pct: discountPctForBill,')
  const commissionMarker = '        }), e.jsxs("div", {\n          className: "font-mono",\n          style: {\n            display: "flex",\n            justifyContent: "space-between",\n            fontSize: 13,\n            color: "var(--ghost-gray)",\n            marginBottom: 6\n          },\n          children: [e.jsx("span", {\n            children: "COMMISSION (FLAT)"'
  const manualDiscountField = '        }), !M && e.jsxs("label", {style: {display: "grid", gap: 6, marginBottom: 12}, children: [e.jsx("span", {style: {color: "var(--ghost-gray)", fontSize: 10, letterSpacing: .8}, children: "ส่วนลด (%)"}), e.jsx("input", {className: "input", type: "number", min: 0, max: 100, step: "0.01", inputMode: "decimal", placeholder: "เช่น 10", value: safeManualDiscountPct || "", onChange: t => setManualDiscountPct(Math.min(100, Math.max(0, Number(t.target.value) || 0)))}), manualDiscountAmount > 0 && e.jsxs("span", {className: "font-mono", style: {color: "#84d6a8", fontSize: 11}, children: ["−¥", manualDiscountAmount.toLocaleString(), " จากยอดหลังส่วนลดสมาชิก"]})]}), e.jsxs("div", {\n          className: "font-mono",\n          style: {\n            display: "flex",\n            justifyContent: "space-between",\n            fontSize: 13,\n            color: "var(--ghost-gray)",\n            marginBottom: 6\n          },\n          children: [e.jsx("span", {\n            children: "COMMISSION (FLAT)"'
  manualDiscountContent = manualDiscountContent.replace(commissionMarker, manualDiscountField)
}
await writeFile(manualDiscountAsset, manualDiscountContent)


// Show each ordinary staff member their own earned commission on Home.
const personalCommissionAsset = path.join(outputRoot, 'assets', release, 'Home-a48wstN-.js')
let personalCommissionHome = await readFile(personalCommissionAsset, 'utf8')
if (!personalCommissionHome.includes('personalCommission')) {
  const personalTick = String.fromCharCode(96)
  personalCommissionHome = personalCommissionHome.replace(",[d,S]=i.useState(null),[j,_]=i.useState(!1),[z,W]=i.useState([]),[onShiftStaff,setOnShiftStaff]=i.useState([]),[showOnShiftStaff,setShowOnShiftStaff]=i.useState(!1),c=G(n)", ",[d,S]=i.useState(null),[j,_]=i.useState(!1),[z,W]=i.useState([]),[onShiftStaff,setOnShiftStaff]=i.useState([]),[showOnShiftStaff,setShowOnShiftStaff]=i.useState(!1),[personalCommission,setPersonalCommission]=i.useState(0),[personalCommissionBills,setPersonalCommissionBills]=i.useState(0),c=G(n)")
  personalCommissionHome = personalCommissionHome.replace(
    '},[s,v,c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{u.rpc("list_on_shift_staff",{p_branch_id:c?null:n?.primary_branch||null}).then(({data:t,error:a})=>{a?console.error("[Ghost Lab] Failed to load on-shift staff:",a):setOnShiftStaff(t||[])})},[c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{n!=null&&n.id&&u.from("attendance")',
    '},[s,v,c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{if(c||!n?.id){setPersonalCommission(0),setPersonalCommissionBills(0);return}const t=new Date;let a=null;if(s==="today"&&t.setHours(0,0,0,0),s==="week"&&(t.setDate(t.getDate()-6),t.setHours(0,0,0,0)),s==="month"&&(t.setDate(1),t.setHours(0,0,0,0)),s==="date"){const[y,w,P]=v.split("-").map(Number);t.setFullYear(y,w-1,P),t.setHours(0,0,0,0),a=new Date(t),a.setDate(a.getDate()+1)}let l=u.from("commission_distributions").select("amount,created_at").eq("user_id",n.id).is("reversed_at",null);s!=="all"&&(l=l.gte("created_at",t.toISOString())),a&&(l=l.lt("created_at",a.toISOString())),l.then(({data:y,error:w})=>{w?console.error("[Ghost Lab] Failed to load personal commission:",w):(setPersonalCommission((y||[]).reduce((t,a)=>t+Number(a.amount||0),0)),setPersonalCommissionBills((y||[]).length))})},[c,n==null?void 0:n.id,s,v]),i.useEffect(()=>{u.rpc("list_on_shift_staff",{p_branch_id:c?null:n?.primary_branch||null}).then(({data:t,error:a})=>{a?console.error("[Ghost Lab] Failed to load on-shift staff:",a):setOnShiftStaff(t||[])})},[c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{n!=null&&n.id&&u.from("attendance")'
  )
  const oldPersonalCommissionCard = 'e.jsx(p,{label:' + personalTick + 'COMMISSION ${h}' + personalTick + ',value:' + personalTick + '¥${M.toLocaleString()}' + personalTick + ',accent:!0})'
  const newPersonalCommissionCard = 'e.jsx(p,{label:c?' + personalTick + 'COMMISSION ${h}' + personalTick + ':' + personalTick + 'ค่าคอมของฉัน ${h}' + personalTick + ',value:' + personalTick + '¥${(c?M:personalCommission).toLocaleString()}' + personalTick + ',meta:c?void 0:' + personalTick + '${personalCommissionBills} บิล' + personalTick + ',accent:!0})'
  personalCommissionHome = personalCommissionHome.replace(oldPersonalCommissionCard, newPersonalCommissionCard)
}
await writeFile(personalCommissionAsset, personalCommissionHome)


// Replace the single-day Home filter with one dark-theme calendar that picks
// a start and end date. Every bill and personal-commission query uses the same
// inclusive range (the database upper bound is the day after End Date).
const dateRangeHomeAsset = path.join(outputRoot, 'assets', release, 'Home-a48wstN-.js')
let dateRangeHome = await readFile(dateRangeHomeAsset, 'utf8')
if (!dateRangeHome.includes('ghostlab-date-range-calendar')) {
  const dateRangeComponent = `function DateRangePicker({value:n,onChange:r,onToday:g,onClear:o,open:f,setOpen:b}){const[A,s]=i.useState(()=>{const t=n.start?new Date(n.start+"T00:00:00"):new Date;return new Date(t.getFullYear(),t.getMonth(),1)});i.useEffect(()=>{if(n.start){const t=new Date(n.start+"T00:00:00");s(new Date(t.getFullYear(),t.getMonth(),1))}},[n.start]);const k=["จ","อ","พ","พฤ","ศ","ส","อา"],v=A.getFullYear(),E=A.getMonth(),d=new Date(v,E,1),S=(d.getDay()+6)%7,j=Array.from({length:42},(t,a)=>new Date(v,E,a-S+1));function _(t){const a=Y(t);if(!n.start||n.end||a<n.start){r({start:a,end:""});return}r({start:n.start,end:a}),b(!1)}const z=t=>{if(!t)return"";const[a,l,m]=t.split("-");return m+"/"+l+"/"+a},W=n.start&&n.end?z(n.start)+" - "+z(n.end):n.start?z(n.start)+" - เลือกวันสิ้นสุด":"เลือกช่วงวันที่";return e.jsxs("div",{style:{position:"relative"},children:[e.jsxs("button",{type:"button",className:"btn",onClick:()=>b(!f),"aria-expanded":f,"aria-label":"เลือกช่วงวันที่",style:{alignItems:"center",background:f||n.start?"rgba(196,30,42,.16)":"transparent",borderColor:f||n.start?"var(--blood)":"var(--line)",color:"var(--bone)",display:"flex",fontSize:11,gap:8,minWidth:220,justifyContent:"space-between"},children:[e.jsx("span",{children:W}),e.jsx("span",{children:"▾"})]}),f&&e.jsxs("div",{id:"ghostlab-date-range-calendar",className:"panel",style:{background:"#17191c",border:"1px solid rgba(196,30,42,.55)",boxShadow:"0 18px 55px rgba(0,0,0,.6)",left:0,padding:14,position:"absolute",top:"calc(100% + 8px)",width:304,zIndex:80},children:[e.jsxs("div",{style:{alignItems:"center",display:"flex",justifyContent:"space-between",marginBottom:12},children:[e.jsx("button",{type:"button",className:"btn",onClick:()=>s(new Date(v,E-1,1)),style:{minWidth:34,padding:"7px 9px"},children:"‹"}),e.jsx("strong",{style:{fontSize:13},children:A.toLocaleDateString("th-TH",{month:"long",year:"numeric"})}),e.jsx("button",{type:"button",className:"btn",onClick:()=>s(new Date(v,E+1,1)),style:{minWidth:34,padding:"7px 9px"},children:"›"})]}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4},children:k.map(t=>e.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,padding:"5px 0",textAlign:"center"},children:t},t))}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3},children:j.map(t=>{const a=Y(t),l=t.getMonth()===E,m=Boolean(n.start&&n.end&&a>=n.start&&a<=n.end),P=a===n.start||a===n.end;return e.jsx("button",{type:"button",onClick:()=>_(t),"aria-label":t.toLocaleDateString("th-TH"),style:{background:P?"var(--blood)":m?"rgba(196,30,42,.30)":"transparent",border:P?"1px solid #f05a66":"1px solid transparent",borderRadius:6,color:l?"var(--bone)":"#555",cursor:"pointer",fontSize:11,height:32,padding:0},children:t.getDate()},a)})}),e.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,lineHeight:1.5,marginTop:10,minHeight:30},children:n.start&&!n.end?"เลือกวันสิ้นสุด · ถ้าคลิกวันก่อนหน้า ระบบจะเริ่มช่วงใหม่":"เลือกวันเริ่มต้น แล้วเลือกวันสิ้นสุด"}),e.jsxs("div",{style:{borderTop:"1px solid var(--line)",display:"flex",gap:8,justifyContent:"space-between",marginTop:10,paddingTop:10},children:[e.jsx("button",{type:"button",className:"btn",onClick:o,style:{fontSize:11},children:"Clear"}),e.jsx("button",{type:"button",className:"btn btn-primary",onClick:g,style:{fontSize:11},children:"Today"})]})]})]})}`
  const oldHomeFunction = 'function J(){'
  const oldRangeState = '[s,k]=i.useState("today"),[v,E]=i.useState(Y),[d,S]'
  const oldRangeLabel = 'H=new Date(`${v}T00:00:00`).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"}),h=s==="date"?H:I[s];'
  const newRangeLabel = 'H=t=>{if(!t)return"";const[a,l,m]=t.split("-");return m+"/"+l+"/"+a},h=s==="range"?v.start&&v.end?H(v.start)+" - "+H(v.end):v.start?H(v.start)+" - ...":"ช่วงวันที่":I[s];'
  const oldBillRange = 'const t=new Date;let a=null;if(s==="today"&&t.setHours(0,0,0,0),s==="week"&&(t.setDate(t.getDate()-6),t.setHours(0,0,0,0)),s==="month"&&(t.setDate(1),t.setHours(0,0,0,0)),s==="date"){const[y,w,P]=v.split("-").map(Number);t.setFullYear(y,w-1,P),t.setHours(0,0,0,0),a=new Date(t),a.setDate(a.getDate()+1)}let l=u.from("bills")'
  const newBillRange = 'const t=new Date;let a=null;if(s==="today"&&t.setHours(0,0,0,0),s==="week"&&(t.setDate(t.getDate()-6),t.setHours(0,0,0,0)),s==="month"&&(t.setDate(1),t.setHours(0,0,0,0)),s==="range"){if(!v.start){g([]);return}const[y,w,P]=v.start.split("-").map(Number);t.setFullYear(y,w-1,P),t.setHours(0,0,0,0);if(v.end){const[Y,W,D]=v.end.split("-").map(Number);a=new Date(Y,W-1,D+1),a.setHours(0,0,0,0)}}let l=u.from("bills")'
  const oldCommissionRange = 'const t=new Date;let a=null;if(s==="today"&&t.setHours(0,0,0,0),s==="week"&&(t.setDate(t.getDate()-6),t.setHours(0,0,0,0)),s==="month"&&(t.setDate(1),t.setHours(0,0,0,0)),s==="date"){const[y,w,P]=v.split("-").map(Number);t.setFullYear(y,w-1,P),t.setHours(0,0,0,0),a=new Date(t),a.setDate(a.getDate()+1)}let l=u.from("commission_distributions")'
  const newCommissionRange = 'const t=new Date;let a=null;if(s==="today"&&t.setHours(0,0,0,0),s==="week"&&(t.setDate(t.getDate()-6),t.setHours(0,0,0,0)),s==="month"&&(t.setDate(1),t.setHours(0,0,0,0)),s==="range"){if(!v.start){setPersonalCommission(0),setPersonalCommissionBills(0);return}const[y,w,P]=v.start.split("-").map(Number);t.setFullYear(y,w-1,P),t.setHours(0,0,0,0);if(v.end){const[Y,W,D]=v.end.split("-").map(Number);a=new Date(Y,W-1,D+1),a.setHours(0,0,0,0)}}let l=u.from("commission_distributions")'
  const oldDateControl = 'e.jsxs("label",{className:"btn",style:{alignItems:"center",background:s==="date"?"rgba(196,30,42,.16)":"transparent",borderColor:s==="date"?"var(--blood)":"var(--line)",color:s==="date"?"var(--bone)":"var(--ghost-gray)",cursor:"pointer",display:"flex",fontSize:11,gap:7,padding:"0 10px"},children:["เลือกวัน",e.jsx("input",{type:"date",value:v,onChange:t=>{E(t.target.value),k("date")},style:{background:"transparent",border:0,color:"inherit",cursor:"pointer",font:"inherit",outline:0,padding:"8px 0"}})]})'
  const newDateControl = 'e.jsx(DateRangePicker,{value:v,onChange:t=>{E(t),k("range")},open:rangeOpen,setOpen:setRangeOpen,onClear:()=>{E({start:"",end:""}),k("all"),setRangeOpen(!1)},onToday:()=>{const t=Y();E({start:t,end:t}),k("range"),setRangeOpen(!1)}})'

  const requiredMarkers = [oldHomeFunction, oldRangeState, oldRangeLabel, oldBillRange, oldCommissionRange, oldDateControl]
  if (requiredMarkers.some(marker => !dateRangeHome.includes(marker))) {
    throw new Error('Recovered Home bundle changed unexpectedly; refusing to build without complete date-range filtering.')
  }
  dateRangeHome = dateRangeHome
    .replace(oldHomeFunction, dateRangeComponent + oldHomeFunction)
    .replace(oldRangeState, '[s,k]=i.useState("today"),[v,E]=i.useState(()=>({start:Y(),end:Y()})),[rangeOpen,setRangeOpen]=i.useState(!1),[d,S]')
    .replace(oldRangeLabel, newRangeLabel)
    .replace(oldBillRange, newBillRange)
    .replace(oldCommissionRange, newCommissionRange)
    .replace(oldDateControl, newDateControl)
}
await writeFile(dateRangeHomeAsset, dateRangeHome)


// Daily Summary uses the same flexible range behavior as Home, while keeping
// the rest of its compact close-of-day layout unchanged.
const dailySummaryAsset = path.join(outputRoot, 'assets', release, 'DailySummary-OhyJk4lZ.js')
let dailySummaryContent = await readFile(dailySummaryAsset, 'utf8')
if (!dailySummaryContent.includes('ghostlab-summary-date-range-calendar')) {
  const dailyRangeComponent = `function dateKey(e=new Date){const n=e.getFullYear(),c=String(e.getMonth()+1).padStart(2,"0"),l=String(e.getDate()).padStart(2,"0");return n+"-"+c+"-"+l}function SummaryDateRange({value:e,onChange:n,onToday:c,onClear:l,open:o,setOpen:h}){const[m,s]=i.useState(()=>{const a=e.start?new Date(e.start+"T00:00:00"):new Date;return new Date(a.getFullYear(),a.getMonth(),1)});i.useEffect(()=>{if(e.start){const a=new Date(e.start+"T00:00:00");s(new Date(a.getFullYear(),a.getMonth(),1))}},[e.start]);const A=["จ","อ","พ","พฤ","ศ","ส","อา"],D=m.getFullYear(),T=m.getMonth(),F=new Date(D,T,1),M=(F.getDay()+6)%7,O=Array.from({length:42},(a,B)=>new Date(D,T,B-M+1));function C(a){const B=dateKey(a);if(!e.start||e.end||B<e.start){n({start:B,end:""});return}n({start:e.start,end:B}),h(!1)}const $=a=>{if(!a)return"";const[B,I,H]=a.split("-");return H+"/"+I+"/"+B},R=e.start&&e.end?$(e.start)+" - "+$(e.end):e.start?$(e.start)+" - เลือกวันสิ้นสุด":"เลือกช่วงวันที่";return t.jsxs("div",{style:{position:"relative"},children:[t.jsxs("button",{type:"button",className:"input",onClick:()=>h(!o),"aria-expanded":o,"aria-label":"เลือกช่วงวันที่",style:{alignItems:"center",background:"#202226",borderColor:o||e.start?"var(--blood)":"var(--line)",color:"var(--bone)",cursor:"pointer",display:"flex",fontSize:12,gap:8,justifyContent:"space-between",minWidth:240,width:"auto"},children:[t.jsx("span",{children:R}),t.jsx("span",{children:"▾"})]}),o&&t.jsxs("div",{id:"ghostlab-summary-date-range-calendar",className:"panel",style:{background:"#17191c",border:"1px solid rgba(196,30,42,.55)",boxShadow:"0 18px 55px rgba(0,0,0,.6)",padding:14,position:"absolute",right:0,top:"calc(100% + 8px)",width:304,zIndex:80},children:[t.jsxs("div",{style:{alignItems:"center",display:"flex",justifyContent:"space-between",marginBottom:12},children:[t.jsx("button",{type:"button",className:"btn",onClick:()=>s(new Date(D,T-1,1)),style:{minWidth:34,padding:"7px 9px"},children:"‹"}),t.jsx("strong",{style:{fontSize:13},children:m.toLocaleDateString("th-TH",{month:"long",year:"numeric"})}),t.jsx("button",{type:"button",className:"btn",onClick:()=>s(new Date(D,T+1,1)),style:{minWidth:34,padding:"7px 9px"},children:"›"})]}),t.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4},children:A.map(a=>t.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,padding:"5px 0",textAlign:"center"},children:a},a))}),t.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3},children:O.map(a=>{const B=dateKey(a),I=a.getMonth()===T,H=Boolean(e.start&&e.end&&B>=e.start&&B<=e.end),L=B===e.start||B===e.end;return t.jsx("button",{type:"button",onClick:()=>C(a),"aria-label":a.toLocaleDateString("th-TH"),style:{background:L?"var(--blood)":H?"rgba(196,30,42,.30)":"transparent",border:L?"1px solid #f05a66":"1px solid transparent",borderRadius:6,color:I?"var(--bone)":"#555",cursor:"pointer",fontSize:11,height:32,padding:0},children:a.getDate()},B)})}),t.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,lineHeight:1.5,marginTop:10,minHeight:30},children:e.start&&!e.end?"เลือกวันสิ้นสุด · เลือกวันเดิมได้สำหรับดู 1 วัน":"เลือกวันเริ่มต้น แล้วเลือกวันสิ้นสุด"}),t.jsxs("div",{style:{borderTop:"1px solid var(--line)",display:"flex",gap:8,justifyContent:"space-between",marginTop:10,paddingTop:10},children:[t.jsx("button",{type:"button",className:"btn",onClick:l,style:{fontSize:11},children:"Clear"}),t.jsx("button",{type:"button",className:"btn btn-primary",onClick:c,style:{fontSize:11},children:"Today"})]})]})]})}`
  const oldDailyStart = 'function N(){'
  const oldDailyState = '[d,b]=i.useState(new Date().toISOString().slice(0,10)),[u,y]'
  const oldDailyQuery = 'async function _(){const e=new Date(`${d}T00:00:00`),n=new Date(`${d}T23:59:59.999`);let c=p.from("bills").select("total,payment_method,status,branch_id,branches:branch_id(name,key)").gte("created_at",e.toISOString()).lte("created_at",n.toISOString()),l=p.from("expenses").select("amount,status,branch_id,branches:branch_id(name,key)").gte("created_at",e.toISOString()).lte("created_at",n.toISOString()),o=p.from("stock_items")'
  const newDailyQuery = 'async function _(){let c=p.from("bills").select("total,payment_method,status,branch_id,branches:branch_id(name,key)"),l=p.from("expenses").select("amount,status,branch_id,branches:branch_id(name,key)"),o=p.from("stock_items");if(d.start){const e=new Date(d.start+"T00:00:00");c=c.gte("created_at",e.toISOString()),l=l.gte("created_at",e.toISOString())}if(d.end){const[e,n,a]=d.end.split("-").map(Number),B=new Date(e,n-1,a+1);B.setHours(0,0,0,0),c=c.lt("created_at",B.toISOString()),l=l.lt("created_at",B.toISOString())}o=o'
  const oldDailyInput = 't.jsx("input",{className:"input",type:"date",value:d,onChange:e=>b(e.target.value),style:{width:170}})'
  const newDailyInput = 't.jsx(SummaryDateRange,{value:d,onChange:b,open:rangeOpen,setOpen:setRangeOpen,onClear:()=>{b({start:"",end:""}),setRangeOpen(!1)},onToday:()=>{const e=dateKey();b({start:e,end:e}),setRangeOpen(!1)}})'
  const dailyMarkers = [oldDailyStart, oldDailyState, oldDailyQuery, oldDailyInput]
  if (dailyMarkers.some(marker => !dailySummaryContent.includes(marker))) {
    throw new Error('Recovered Daily Summary bundle changed unexpectedly; refusing to build without complete date-range filtering.')
  }
  dailySummaryContent = dailySummaryContent
    .replace(oldDailyStart, dailyRangeComponent + oldDailyStart)
    .replace(oldDailyState, '[d,b]=i.useState(()=>{const e=dateKey();return{start:e,end:e}}),[rangeOpen,setRangeOpen]=i.useState(!1),[u,y]')
    .replace(oldDailyQuery, newDailyQuery)
    .replace(oldDailyInput, newDailyInput)
}
await writeFile(dailySummaryAsset, dailySummaryContent)


// Persist stock adjustment inputs and the Add Stock modal while navigating.
const stockDraftAsset = path.join(outputRoot, 'assets', release, 'Stock-CpMhahKC.js')
let stockDraftContent = await readFile(stockDraftAsset, 'utf8')
if (!stockDraftContent.includes('ghostlab-stock-add:')) {
  const stockTick = String.fromCharCode(96)
  const oldStockAdjustState = ',[v,z]=i.useState(0),[l,x]=i.useState({}),[y,b]=i.useState(!1),[a,B]=i.useState("")'
  const newStockAdjustState = ',[v,z]=i.useState(0),[l,x]=i.useState(()=>{try{return JSON.parse(localStorage.getItem(' + stockTick + 'ghostlab-stock-adjust:${n?.id||"guest"}' + stockTick + ')||"{}")||{}}catch{return{}}}),[y,b]=i.useState(!1),[a,B]=i.useState("")'
  stockDraftContent = stockDraftContent.replace(oldStockAdjustState, newStockAdjustState)
  stockDraftContent = stockDraftContent.replace(
    '},[m,n==null?void 0:n.primary_branch]),i.useEffect(()=>{k(!0);',
    '},[m,n==null?void 0:n.primary_branch]),i.useEffect(()=>{try{const t=' + stockTick + 'ghostlab-stock-adjust:${n?.id||"guest"}' + stockTick + ';Object.keys(l).length?localStorage.setItem(t,JSON.stringify(l)):localStorage.removeItem(t)}catch{}},[l,n==null?void 0:n.id]),i.useEffect(()=>{k(!0);',
  )
  stockDraftContent = stockDraftContent.replace(
    'e.jsx(A,{branches:o,onClose:()=>p(!1),onSaved:()=>{p(!1),z(t=>t+1)}})',
    'e.jsx(A,{branches:o,staff:n,onClose:()=>p(!1),onSaved:()=>{p(!1),z(t=>t+1)}})',
  )
  const oldAddModalStart = 'function A({branches:n,onClose:d,onSaved:u}){var b;const[o,c]=i.useState(""),[g,S]=i.useState("วัตถุดิบ"),[C,k]=i.useState("ชิ้น"),[N,p]=i.useState("0"),[v,z]=i.useState(((b=n[0])==null?void 0:b.id)||""),[l,x]=i.useState(!1);async function y(){'
  const newAddModalStart = 'function A({branches:n,onClose:d,onSaved:u,staff:staff}){var b;const draftKey=' + stockTick + 'ghostlab-stock-add:${staff?.id||"guest"}' + stockTick + ',readDraft=()=>{try{return JSON.parse(localStorage.getItem(draftKey)||"{}")}catch{return{}}},draft=readDraft(),[o,c]=i.useState(draft.name||""),[g,S]=i.useState(draft.category||"วัตถุดิบ"),[C,k]=i.useState(draft.unit||"ชิ้น"),[N,p]=i.useState(draft.quantity??"0"),[v,z]=i.useState(draft.branchId||((b=n[0])==null?void 0:b.id)||""),[l,x]=i.useState(!1);i.useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify({name:o,category:g,unit:C,quantity:N,branchId:v}))}catch{}},[o,g,C,N,v]);function clearDraft(){try{localStorage.removeItem(draftKey)}catch{}}async function y(){'
  stockDraftContent = stockDraftContent.replace(oldAddModalStart, newAddModalStart)
  stockDraftContent = stockDraftContent.replace('if(x(!1),a){console.error(a);return}u()', 'if(x(!1),a){console.error(a);return}clearDraft(),u()')
  stockDraftContent = stockDraftContent.replace('onClick:d,style:{cursor:"pointer",color:"var(--ghost-gray)",fontSize:18},children:"✕"', 'onClick:()=>{clearDraft(),d()},style:{cursor:"pointer",color:"var(--ghost-gray)",fontSize:18},children:"✕"')
  stockDraftContent = stockDraftContent.replace('onClick:d,className:"btn btn-secondary",children:"ยกเลิก"', 'onClick:()=>{clearDraft(),d()},className:"btn btn-secondary",children:"ยกเลิก"')
}
await writeFile(stockDraftAsset, stockDraftContent)
{

// Persist stock-page inputs while staff navigate between routes. Drafts are
// scoped to the signed-in staff member and are cleared only after a successful
// save or an explicit cancel.
const stockAsset = path.join(outputRoot, 'assets', release, 'Stock-CpMhahKC.js')
let stockContent = await readFile(stockAsset, 'utf8')
const oldStockAdjustState = ',[v,z]=i.useState(0),[l,x]=i.useState({}),[y,b]=i.useState(!1),[a,B]=i.useState("")'
const newStockAdjustState = ',[v,z]=i.useState(0),[l,x]=i.useState(()=>{try{return JSON.parse(localStorage.getItem(`ghostlab-stock-adjust:${n?.id||"guest"}`)||"{}")||{}}catch{return{}}}),[y,b]=i.useState(!1),[a,B]=i.useState("")'
stockContent = stockContent.replace(oldStockAdjustState, newStockAdjustState)
stockContent = stockContent.replace(
  '},[m,n==null?void 0:n.primary_branch]),i.useEffect(()=>{k(!0);',
  '},[m,n==null?void 0:n.primary_branch]),i.useEffect(()=>{try{const t=`ghostlab-stock-adjust:${n?.id||"guest"}`;Object.keys(l).length?localStorage.setItem(t,JSON.stringify(l)):localStorage.removeItem(t)}catch{}},[l,n==null?void 0:n.id]),i.useEffect(()=>{k(!0);',
)
stockContent = stockContent.replace(
  'e.jsx(A,{branches:o,onClose:()=>p(!1),onSaved:()=>{p(!1),z(t=>t+1)}})',
  'e.jsx(A,{branches:o,staff:n,onClose:()=>p(!1),onSaved:()=>{p(!1),z(t=>t+1)}})',
)
const oldAddModalStart = 'function A({branches:n,onClose:d,onSaved:u}){var b;const[o,c]=i.useState(""),[g,S]=i.useState("วัตถุดิบ"),[C,k]=i.useState("ชิ้น"),[N,p]=i.useState("0"),[v,z]=i.useState(((b=n[0])==null?void 0:b.id)||""),[l,x]=i.useState(!1);async function y(){'
const newAddModalStart = 'function A({branches:n,onClose:d,onSaved:u,staff:staff}){var b;const draftKey=`ghostlab-stock-add:${staff?.id||"guest"}`,readDraft=()=>{try{return JSON.parse(localStorage.getItem(draftKey)||"{}")}catch{return{}}},draft=readDraft(),[o,c]=i.useState(draft.name||""),[g,S]=i.useState(draft.category||"วัตถุดิบ"),[C,k]=i.useState(draft.unit||"ชิ้น"),[N,p]=i.useState(draft.quantity??"0"),[v,z]=i.useState(draft.branchId||((b=n[0])==null?void 0:b.id)||""),[l,x]=i.useState(!1);i.useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify({name:o,category:g,unit:C,quantity:N,branchId:v}))}catch{}},[o,g,C,N,v]);function clearDraft(){try{localStorage.removeItem(draftKey)}catch{}}async function y(){'
stockContent = stockContent.replace(oldAddModalStart, newAddModalStart)
stockContent = stockContent.replace('if(x(!1),a){console.error(a);return}u()', 'if(x(!1),a){console.error(a);return}clearDraft(),u()')
stockContent = stockContent.replace('onClick:d,style:{cursor:"pointer",color:"var(--ghost-gray)",fontSize:18},children:"✕"', 'onClick:()=>{clearDraft(),d()},style:{cursor:"pointer",color:"var(--ghost-gray)",fontSize:18},children:"✕"')
stockContent = stockContent.replace('onClick:d,className:"btn btn-secondary",children:"ยกเลิก"', 'onClick:()=>{clearDraft(),d()},className:"btn btn-secondary",children:"ยกเลิก"')
await writeFile(stockAsset, stockContent)
}

// Keep expense material suggestions scoped to the branch selected in the
// expense form. The recovered bundle used a shared garage-only list, which
// made SABINAGISA staff see unrelated materials and could record the wrong
// branch's stock usage.
const expenseAsset = path.join(outputRoot, 'assets', release, 'Expenses-6l8wjlXM.js')
let expenseContent = await readFile(expenseAsset, 'utf8')
if (!expenseContent.includes('stockItems')) {
  expenseContent = expenseContent.replace(
    'style:{width:"100%",maxWidth:420,background:"var(--static)"}',
    'style:{width:"calc(100% - 28px)",maxWidth:560,maxHeight:"calc(100vh - 32px)",overflowY:"auto",background:"var(--static)",padding:"20px 22px"}',
  )
  expenseContent = expenseContent.replace('children:"วัสดุที่ใช้บ่อย"', 'children:"วัสดุในสต็อกสาขานี้"')
  expenseContent = expenseContent.replace(
    ',[j,b]=l.useState(!1);async function k(){',
    ',[j,b]=l.useState(!1),[stockItems,setStockItems]=l.useState([]);l.useEffect(()=>{if(!y){setStockItems([]);return}f.from("stock_items").select("id,name,quantity,unit,category").eq("branch_id",y).order("name").then(({data:t,error:n})=>{n?console.error("[Ghost Lab] Failed to load branch stock:",n):setStockItems(t||[])})},[y]);async function k(){',
  )
  const suggestionStart = 'children:U.map(a=>'
  const suggestionEnd = '})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}'
  const start = expenseContent.indexOf(suggestionStart)
  const end = expenseContent.indexOf(suggestionEnd, start)
  if (start >= 0 && end > start) {
    const branchSuggestions = 'children:stockItems.length===0?e.jsx("div",{style:{border:"1px dashed var(--line)",borderRadius:8,color:"var(--ghost-gray)",fontSize:11,padding:"10px 12px"},children:"ยังไม่มีวัตถุดิบในสาขานี้ — พิมพ์รายการเองได้"}):stockItems.map(a=>e.jsxs("button",{type:"button",onClick:()=>u(a.name),style:{alignItems:"center",background:d===a.name?"rgba(196,30,42,.18)":"rgba(255,255,255,.035)",border:"1px solid "+(d===a.name?"var(--blood)":"var(--line)"),borderRadius:8,color:d===a.name?"var(--bone)":"var(--ghost-gray)",cursor:"pointer",display:"flex",font:"inherit",gap:10,justifyContent:"space-between",minHeight:46,padding:"9px 11px",textAlign:"left",transition:"all .15s"},children:[e.jsx("span",{style:{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:["⌁ ",a.name]}),e.jsx("span",{className:"font-mono",style:{color:d===a.name?"var(--bone)":"var(--ghost-gray)",flexShrink:0,fontSize:10},children:[a.quantity??0,a.unit?" "+a.unit:""]})]},a.id))'
    expenseContent = expenseContent.slice(0, start) + branchSuggestions + expenseContent.slice(end)
  } else {
    console.warn('Recovered Expenses bundle suggestion block changed; branch stock filter was not applied.')
  }
}
await writeFile(expenseAsset, expenseContent)
// Keep unfinished member and expense forms when a background tab or route is
// recreated. Drafts are browser-local and are cleared on save or cancel.
const memberDraftAsset = path.join(outputRoot, 'assets', release, 'Members-Gwy05wzy.js')
let memberDraftContent = await readFile(memberDraftAsset, 'utf8')
if (!memberDraftContent.includes('ghostlab-member-new-draft')) {
  const oldMemberState = 'function ie({member:a,branches:m,onClose:o,onSaved:i}){var d,v,B;const c=!a.id,[N,q]=l.useState(a.name||""),[p,P]=l.useState(a.phone||""),[j,I]=l.useState(a.plate_or_note||""),[y,T]=l.useState(a.branch_id||((d=m[0])==null?void 0:d.id)||""),[g,_]=l.useState(Q.includes(a.tier)?a.tier:"regular"),[h,O]=l.useState(c),[k,F]=l.useState(!1),[w,L]=l.useState(se(c?new Date:b(a)?a.membership_expires_at:new Date)),[u,E]=l.useState(1)'
  const newMemberState = 'function ie({member:a,branches:m,onClose:o,onSaved:i}){var d,v,B;const c=!a.id,draftKey="ghostlab-member-new-draft",readDraft=()=>{if(!c)return{};try{return JSON.parse(localStorage.getItem(draftKey)||"null")||{}}catch{return{}}},draft=readDraft(),[N,q]=l.useState(a.name||draft.name||""),[p,P]=l.useState(a.phone||draft.phone||""),[j,I]=l.useState(a.plate_or_note||draft.plate||""),[y,T]=l.useState(a.branch_id||draft.branchId||((d=m[0])==null?void 0:d.id)||""),[g,_]=l.useState(Q.includes(a.tier)?a.tier:draft.tier||"regular"),[h,O]=l.useState(c?draft.renew!==!1:!1),[k,F]=l.useState(!1),[w,L]=l.useState(c?draft.startDate||se(new Date):se(b(a)?a.membership_expires_at:new Date)),[u,E]=l.useState(c?Number(draft.months)||1:1)'
  memberDraftContent = memberDraftContent.replace(oldMemberState, newMemberState)
  memberDraftContent = memberDraftContent.replace(
    ',n=D(g,r);async function x(t){',
    ',n=D(g,r);l.useEffect(()=>{if(!c)return;try{localStorage.setItem(draftKey,JSON.stringify({name:N,phone:p,plate:j,branchId:y,tier:g,renew:h,startDate:w,months:u}))}catch{}},[c,N,p,j,y,g,h,w,u]);function clearDraft(){if(!c)return;try{localStorage.removeItem(draftKey)}catch{}}function closeAndClear(){clearDraft(),o()};async function x(t){',
  )
  memberDraftContent = memberDraftContent.replace('S(!1),i()}return e.jsx("div",{className:"member-modal"', 'S(!1),clearDraft(),i()}return e.jsx("div",{className:"member-modal"')
  memberDraftContent = memberDraftContent.replace('onMouseDown:t=>t.target===t.currentTarget&&o()', 'onMouseDown:t=>t.target===t.currentTarget&&closeAndClear()')
  memberDraftContent = memberDraftContent.replace('onClick:o,"aria-label":"ปิด"', 'onClick:closeAndClear,"aria-label":"ปิด"')
  memberDraftContent = memberDraftContent.replace('onClick:o,children:"ยกเลิก"', 'onClick:closeAndClear,children:"ยกเลิก"')
}
await writeFile(memberDraftAsset, memberDraftContent)

const expenseDraftAsset = path.join(outputRoot, 'assets', release, 'Expenses-6l8wjlXM.js')
let expenseDraftContent = await readFile(expenseDraftAsset, 'utf8')
if (!expenseDraftContent.includes('ghostlab-expense-add-draft')) {
  expenseDraftContent = expenseDraftContent.replace(
    'function V({branches:r,staff:s,onClose:m,onSaved:c}){var i;const[h,p]=l.useState("วัตถุดิบ"),[d,u]=l.useState(""),[x,C]=l.useState("")',
    'function V({branches:r,staff:s,onClose:m,onSaved:c}){var i;const draftKey=`ghostlab-expense-add:${s?.id||"guest"}`,readDraft=()=>{try{return JSON.parse(localStorage.getItem(draftKey)||"null")||{}}catch{return{}}},draft=readDraft(),[h,p]=l.useState(draft.category||"วัตถุดิบ"),[d,u]=l.useState(draft.description||""),[x,C]=l.useState(draft.amount??"")',
  )
  expenseDraftContent = expenseDraftContent.replace(
    ';async function k(){',
    ';l.useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify({category:h,description:d,amount:x,branchId:y}))}catch{}},[draftKey,h,d,x,y]);function clearDraft(){try{localStorage.removeItem(draftKey)}catch{}}function closeAndClear(){clearDraft(),m()};async function k(){',
  )
  expenseDraftContent = expenseDraftContent.replace('if(b(!1),a){console.error(a);return}c()', 'if(b(!1),a){console.error(a);return}clearDraft(),c()')
  expenseDraftContent = expenseDraftContent.replace('return e.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)"', 'return e.jsx("div",{onMouseDown:t=>t.target===t.currentTarget&&closeAndClear,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)"')
  expenseDraftContent = expenseDraftContent.replace('onClick:m,style:{cursor:"pointer",color:"var(--ghost-gray)",fontSize:18}', 'onClick:closeAndClear,style:{cursor:"pointer",color:"var(--ghost-gray)",fontSize:18}')
  expenseDraftContent = expenseDraftContent.replace('onClick:m,className:"btn btn-secondary"', 'onClick:closeAndClear,className:"btn btn-secondary"')
}
await writeFile(expenseDraftAsset, expenseDraftContent)
