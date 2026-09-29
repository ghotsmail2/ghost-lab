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
