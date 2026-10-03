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
digest.update('release-transform-20260926-auth-refresh-and-pos-draft-2')
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
    const newStaffLoader = 'async function a(f){let v=null,y=null;for(let g=0;g<3;g++){({data:v,error:y}=await Ne.from("staff").select("*, branches:primary_branch(*)").eq("auth_user_id",f).maybeSingle());if(!y)break;await new Promise(q=>setTimeout(q,250*(g+1)))}if(v){s(v);try{sessionStorage.setItem("ghostlab-staff-session",JSON.stringify(v))}catch{}}else if(y){console.error("[Ghost Lab] Failed to load staff row:",y);try{const g=JSON.parse(sessionStorage.getItem("ghostlab-staff-session")||"null");g?.auth_user_id===f&&s(g)}catch{}}else s(null);o(!1)}'
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
