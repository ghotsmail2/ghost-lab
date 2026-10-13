import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import './generate-catalog-prices.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build as buildJsx, transform as transformJsx } from 'esbuild'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(projectRoot, 'recovered-production')
const outputRoot = path.join(projectRoot, 'dist')
const kitchenAssetRoot = path.join(projectRoot, 'public', 'assets', 'sabinagisa')

const sharedThemeCss = `
/* Owner view: tighter spacing, same live data and all existing panels. */
.page-enter>div:has(> .dashboard-widgets){gap:10px!important}.page-enter>div:has(> .dashboard-widgets)>*:not(.dashboard-widgets){margin-bottom:0!important}.page-enter>div:has(> .dashboard-widgets) .panel{padding:14px 16px!important}.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets{gap:10px!important;margin-bottom:0!important}.dashboard-widget__title{margin-bottom:10px!important}.dashboard-onwork__people{gap:7px!important}.dashboard-onwork__person{padding:8px 6px!important}.dashboard-donut{height:100px!important;width:100px!important}.dashboard-donut:after{height:66px!important;width:66px!important}.dashboard-hourly__chart{height:88px!important}
/* Shared keyboard focus and motion preferences across every production route. */
:root{--focus-ring-color:#ff8b68}html[data-theme="light"]{--focus-ring-color:#9b2b16}html[data-theme="dark"]{--focus-ring-color:#ff8b68}.btn:focus-visible,button:focus-visible,a:focus-visible,[role="button"]:focus-visible{outline:2px solid var(--focus-ring-color)!important;outline-offset:3px!important}.input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--focus-ring-color)!important;outline-offset:2px!important}.btn:disabled,button:disabled{cursor:not-allowed!important;opacity:.58!important}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
/* Shared theme switch for all roles and routes. */
html[data-theme="light"]{--void:#f5f0e8;--bone:#2d241d;--ghost-gray:#786f66;--static:#fffdfa;--static-raised:#fff;--line:rgba(92,68,46,.16);color-scheme:light}html[data-theme="light"] body{background:radial-gradient(ellipse 900px 480px at 12% -10%,rgba(233,87,45,.12),transparent 62%),#f5f0e8;color:var(--bone)}html[data-theme="light"] .sidebar{background:#eee6db!important;border-color:#dfd2c3!important;color:#33271e!important}html[data-theme="light"] .sidebar-brand,html[data-theme="light"] .sidebar-group{border-color:rgba(92,68,46,.14)!important}html[data-theme="light"] .sidebar-brand,html[data-theme="light"] .sidebar-brand *{color:#33271e!important}html[data-theme="light"] .sidebar-group__toggle,html[data-theme="light"] .sidebar-link{color:#65584b!important}html[data-theme="light"] .sidebar-link:hover{background:#dfd3c5!important;color:#30241a!important}html[data-theme="light"] .sidebar-link.is-active{background:linear-gradient(90deg,#e9572d25,#e9572d08)!important;color:#30241a!important}html[data-theme="light"] .app-header,html[data-theme="light"] .workspace-topline{color:#65584b}html[data-theme="light"] .panel{background:#fffdfa!important;border-color:#e8ddd1!important;color:#30251d!important;box-shadow:0 5px 17px rgba(68,42,23,.055)}html[data-theme="light"] .panel h1,html[data-theme="light"] .panel h2,html[data-theme="light"] .panel h3,html[data-theme="light"] .panel strong{color:#30251d}html[data-theme="light"] .btn,html[data-theme="light"] .input,html[data-theme="light"] select.input{background-color:#fffdfa;color:#30251d;border-color:#dfd2c3}html[data-theme="light"] .btn-primary{background:#cf3821!important;color:#fff!important;border-color:#cf3821!important}html[data-theme="light"] .table th{background:#f5efe7;color:#65584b}html[data-theme="light"] .table td{border-color:#eadfd3}html[data-theme="light"] .dashboard-onwork__person{background:#fff8f0;color:#30251d}html[data-theme="light"] .dashboard-donut:after{background:#fffdfa}html[data-theme="light"] .dashboard-live{background:linear-gradient(110deg,#fff5e9,#fffdfa)!important}html[data-theme="light"] .pos-hero{background:linear-gradient(100deg,rgba(12,8,6,.86),rgba(18,12,9,.52),rgba(18,12,9,.34)),url('./dashboard-sabinagisa-v1.png') center 46%/cover!important;border-color:rgba(255,255,255,.18)!important;color:#fffaf2!important}html[data-theme="light"] .pos-hero *:not(button){color:#fffaf2!important}html[data-theme="light"] .theme-toggle{background:#fffdfa;color:#6b4d31;border-color:#dfd2c3}
html[data-theme="light"] .dashboard-hero{background:linear-gradient(100deg,rgba(12,8,6,.88),rgba(18,12,9,.52),rgba(18,12,9,.34)),url('./dashboard-sabinagisa-v1.png') center 46%/cover!important;border-color:rgba(255,255,255,.18)!important;color:#fffaf2!important}html[data-theme="light"] .dashboard-hero__copy,html[data-theme="light"] .dashboard-hero__copy h2,html[data-theme="light"] .dashboard-hero__copy p,html[data-theme="light"] .dashboard-hero__copy small{color:#fffaf2!important}html[data-theme="light"] .dashboard-hero__eyebrow{color:#ffc06a!important}
/* Dark mode is a complete palette for the same existing screens and workflows. */
html[data-theme="dark"]{--void:#111315;--bone:#f2eee7;--ghost-gray:#aaa39b;--static:#202224;--static-raised:#292b2e;--line:rgba(242,238,231,.13);color-scheme:dark}
html[data-theme="dark"],html[data-theme="dark"] body,html[data-theme="dark"] #root{background:#111315!important;color:#f2eee7!important}
html[data-theme="dark"] body{background:radial-gradient(ellipse 900px 480px at 12% -10%,rgba(196,30,42,.2),transparent 62%),radial-gradient(ellipse 700px 500px at 100% 100%,rgba(92,43,21,.18),transparent 64%),#111315!important}
html[data-theme="dark"] .app-main{background:linear-gradient(90deg,rgba(17,19,21,.88),rgba(20,21,22,.94))!important}
html[data-theme="dark"] .app-main:before{background-image:linear-gradient(135deg,rgba(196,77,42,.035) 25%,transparent 25%),linear-gradient(225deg,rgba(196,77,42,.035) 25%,transparent 25%),linear-gradient(45deg,rgba(183,138,60,.025) 25%,transparent 25%),linear-gradient(315deg,rgba(183,138,60,.025) 25%,#111315 25%)!important;opacity:.2}
html[data-theme="dark"] .workspace-topline,html[data-theme="dark"] .app-header__utility{color:#b9b0a6!important}
html[data-theme="dark"] .app-header{background:linear-gradient(110deg,rgba(35,31,30,.96),rgba(28,29,30,.96))!important;border-color:rgba(242,238,231,.12)!important;box-shadow:0 12px 30px #0005!important}
html[data-theme="dark"] .app-header:before{background:linear-gradient(90deg,transparent,rgba(196,30,42,.12),rgba(182,138,50,.08))}
html[data-theme="dark"] .app-title,html[data-theme="dark"] .font-display{color:#f2eee7!important}
html[data-theme="dark"] .app-subtitle,html[data-theme="dark"] .app-header__eyebrow{color:#d0a98a!important}
html[data-theme="dark"] .app-header__utility .app-clock{color:#f2eee7!important}
html[data-theme="dark"] .panel,html[data-theme="dark"] .card,html[data-theme="dark"] .stat-card,html[data-theme="dark"] .summary-card,html[data-theme="dark"] .membership-plans,html[data-theme="dark"] .daily-summary-card,html[data-theme="dark"] .stock-card,html[data-theme="dark"] .expenses-card{background:linear-gradient(145deg,#292b2e,#202224)!important;border-color:rgba(242,238,231,.12)!important;box-shadow:0 10px 28px #0004!important;color:#f2eee7!important}
html[data-theme="dark"] .panel h1,html[data-theme="dark"] .panel h2,html[data-theme="dark"] .panel h3,html[data-theme="dark"] .panel strong,html[data-theme="dark"] .card h1,html[data-theme="dark"] .card h2,html[data-theme="dark"] .card h3,html[data-theme="dark"] .panel p,html[data-theme="dark"] .panel small,html[data-theme="dark"] .card p,html[data-theme="dark"] .card small{color:#f2eee7!important}
html[data-theme="dark"] .btn,html[data-theme="dark"] .input,html[data-theme="dark"] select,html[data-theme="dark"] textarea{background:#292b2e!important;border-color:#48494a!important;color:#f2eee7!important}
html[data-theme="dark"] .btn-secondary,html[data-theme="dark"] .tabs button,html[data-theme="dark"] .tab-button,html[data-theme="dark"] .filter-button{background:#292b2e!important;border-color:#48494a!important;color:#e7e0d7!important}
html[data-theme="dark"] .btn-primary,html[data-theme="dark"] .btn-danger,html[data-theme="dark"] button[type=submit]{background:linear-gradient(135deg,#e9572d,#c43c20)!important;border-color:#e9572d!important;color:#fff!important}
html[data-theme="dark"] table,html[data-theme="dark"] thead{background:#202224!important;border-color:#414244!important}
html[data-theme="dark"] th{background:#292b2e!important;color:#bcb3a9!important}
html[data-theme="dark"] td{border-color:#414244!important;color:#ece6de!important}
html[data-theme="dark"] tr:hover td{background:#303133!important}
html[data-theme="dark"] .kpi,html[data-theme="dark"] .kpi-card,html[data-theme="dark"] .metric-card,html[data-theme="dark"] .stat-card{background:#242628!important;border-color:#414244!important}
html[data-theme="dark"] .kpi [class*=label],html[data-theme="dark"] .kpi-card [class*=label],html[data-theme="dark"] .metric-card [class*=label]{color:#b7ada2!important}
html[data-theme="dark"] .kpi [class*=value],html[data-theme="dark"] .kpi-card [class*=value],html[data-theme="dark"] .metric-card [class*=value]{color:#f2eee7!important}
html[data-theme="dark"] [role=dialog],html[data-theme="dark"] .modal-content,html[data-theme="dark"] .modal__content{background:#242628!important;border-color:#4a4642!important;color:#f2eee7!important}
html[data-theme="dark"] [role=dialog] h1,html[data-theme="dark"] [role=dialog] h2,html[data-theme="dark"] [role=dialog] h3{color:#f2eee7!important}
html[data-theme="dark"] .dashboard-onwork__person,html[data-theme="dark"] .dashboard-live{background:#292b2e!important;border-color:#414244!important;color:#f2eee7!important}
html[data-theme="dark"] .dashboard-donut:after{background:#202224!important}
html[data-theme="dark"] .dashboard-hero{background:linear-gradient(100deg,rgba(8,7,7,.88),rgba(18,12,9,.5),rgba(18,12,9,.32)),url('./dashboard-sabinagisa-v1.png') center 46%/cover!important;border-color:rgba(255,255,255,.14)!important;color:#fffaf2!important}
html[data-theme="dark"] .dashboard-widget__title small,html[data-theme="dark"] .dashboard-legend__row span,html[data-theme="dark"] .dashboard-hourly__meta{color:#b7ada2!important}
html[data-theme="dark"] .pos-page,html[data-theme="dark"] .pos-layout,html[data-theme="dark"] .order-page,html[data-theme="dark"] .kitchen-board{color:#f2eee7!important}
html[data-theme="dark"] .pos-page .panel,html[data-theme="dark"] .pos-layout .panel,html[data-theme="dark"] .order-page .panel,html[data-theme="dark"] .kitchen-board .panel,html[data-theme="dark"] .pos-page [class*=product],html[data-theme="dark"] .pos-layout [class*=product],html[data-theme="dark"] .kitchen-board [class*=ticket],html[data-theme="dark"] .kitchen-board [class*=order-card]{background:#242628!important;border-color:#414244!important;color:#f2eee7!important}
html[data-theme="dark"] .pos-hero{background:linear-gradient(100deg,rgba(8,7,7,.9),rgba(18,12,9,.55),rgba(18,12,9,.35)),url('./dashboard-sabinagisa-v1.png') center 46%/cover!important;color:#fffaf2!important}
html[data-theme="dark"] .pos-hero *:not(button){color:#fffaf2!important}
html[data-theme="dark"] .login-shell{background:linear-gradient(90deg,rgba(9,8,8,.32) 0%,rgba(9,8,8,.32) 52%,rgba(22,23,24,.97) 52%,#171819 100%)!important}
html[data-theme="dark"] .login-card,html[data-theme="dark"] .login-card--pin{background:rgba(34,35,36,.97)!important;border-color:#48494a!important;color:#f2eee7!important}
html[data-theme="dark"] .login-card h1,html[data-theme="dark"] .login-card__header p,html[data-theme="dark"] .login-card .staff-group__header h2,html[data-theme="dark"] .login-card .staff-card{color:#f2eee7!important}
html[data-theme="dark"] .login-card .staff-group,html[data-theme="dark"] .login-card .staff-card,html[data-theme="dark"] .login-card .staff-search{background:#292b2e!important;border-color:#48494a!important}
html[data-theme="dark"] .login-card .staff-search input{color:#f2eee7!important}
html[data-theme="dark"] .theme-toggle{background:#292b2e!important;border-color:#48494a!important;color:#f2eee7!important}
html[data-theme="dark"] *{scrollbar-color:#625c55 #202224}
html[data-theme="light"] *{transition:background-color .18s ease,color .18s ease,border-color .18s ease}
.theme-toggle{align-items:center;background:#2a2927;border:1px solid var(--line);border-radius:999px;color:var(--bone);cursor:pointer;display:inline-flex;font:600 11px inherit;gap:6px;min-height:36px;padding:0 12px;white-space:nowrap}.theme-toggle:hover{border-color:#e9572d;color:#e9572d}.app-header__utility{gap:10px!important}@media(max-width:680px){.theme-toggle{min-height:32px;padding:0 9px}.page-enter>div:has(> .dashboard-widgets) .panel{padding:12px!important}}
`

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
        const isKitchenMascot = root === sourceRoot && target.includes(`${path.sep}sabinagisa${path.sep}`)
        if (isKitchenMascot) {
          try {
            await access(path.join(kitchenAssetRoot, path.basename(target)))
          } catch {
            missing.add(path.relative(root, target))
          }
        } else missing.add(path.relative(root, target))
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
  digest.update('release-transform-20261013-dual-brand-login-1-home-dark-consistency-2-sprint1-bom-atomic-sprint2-pos-keyboard-1-sprint3-weekly-preview-redaction-1-sprint4-dashboard-pagination-bangkok-hours-2-sprint4-cancelled-bill-exclusion-1-sprint5-shared-focus-reduced-motion-1-sprint1-pos-server-commission-1')
for (const file of assetFiles) digest.update(path.relative(sourceRoot, file)).update(await readFile(file))
for (const file of (await listFiles(kitchenAssetRoot)).sort()) digest.update(path.relative(projectRoot, file)).update(await readFile(file))
const commissionPoolHelper = path.join(projectRoot, 'src', 'lib', 'commission-pool.js')
digest.update('commission-pool-helper').update(await readFile(commissionPoolHelper))
const loginStylesheet = path.join(projectRoot, 'src', 'pages', 'Login.css')
const loginArtwork = path.join(projectRoot, 'src', 'assets', 'login-courtyard-v1.png')
const garageArtwork = path.join(projectRoot, 'src', 'assets', 'dashboard-garage-v1.png')
digest.update('login-stylesheet').update(await readFile(loginStylesheet))
digest.update('login-artwork').update(await readFile(loginArtwork))
digest.update('garage-artwork').update(await readFile(garageArtwork))
const release = digest.digest('hex').slice(0, 16)
// A visual layer deliberately lives in the build transform instead of the
// recovered bundle.  That lets us modernize the presentation without touching
// a single route, permission check, Supabase query, or operational workflow.
const premiumHospitalityCss = `
/* Ghost Lab hospitality redesign — visual only */
:root{--void:#f3eee5;--bone:#231f1a;--ghost-gray:#82776d;--blood:#d84a24;--ember:#7e2819;--static:#fffdf9;--static-raised:#fff;--line:rgba(57,43,31,.14);--gold:#b68a32;--success:#27815a}
*{scrollbar-color:#bfb5aa transparent;scrollbar-width:thin}
html,body,#root{min-height:100%;background:#f3eee5!important;color:#231f1a!important}
body{background:radial-gradient(circle at 66% -12%,#fffdf9 0,#f6f1e9 31%,#ede5db 100%)!important}
.app-shell{min-height:100vh;background:transparent!important}
.app-main{background:linear-gradient(90deg,rgba(255,253,249,.74),rgba(247,242,235,.92))!important;min-height:100vh;padding:30px 36px 52px!important}
.app-main:before{background-image:linear-gradient(135deg,rgba(196,77,42,.05) 25%,transparent 25%),linear-gradient(225deg,rgba(196,77,42,.05) 25%,transparent 25%),linear-gradient(45deg,rgba(183,138,60,.04) 25%,transparent 25%),linear-gradient(315deg,rgba(183,138,60,.04) 25%,#f5f0e8 25%);background-position:12px 0,12px 0,0 0,0 0;background-size:24px 24px;content:"";inset:0;opacity:.32;pointer-events:none;position:fixed;z-index:-1}
.workspace-topline{align-items:center;color:#7d6e60;display:flex;font-size:10px;justify-content:space-between;letter-spacing:.1em;margin:0 auto 8px;max-width:1440px;text-transform:uppercase}
.workspace-topline__mark{align-items:center;color:#bd4a2b;display:flex;font-weight:800;gap:8px}.workspace-topline__mark:before{background:#d84a24;border-radius:50%;box-shadow:0 0 0 4px rgba(216,74,36,.12);content:"";height:6px;width:6px}
.app-header{align-items:center!important;background:rgba(255,253,249,.9)!important;border:1px solid rgba(58,42,28,.11)!important;border-radius:16px!important;box-shadow:0 11px 28px rgba(69,48,31,.06)!important;margin:0 auto 24px!important;max-width:1440px!important;min-height:84px!important;padding:17px 23px!important;position:relative!important;overflow:hidden!important}
.app-header:before{background:linear-gradient(90deg,transparent,rgba(216,74,36,.12),rgba(182,138,50,.1));content:"";height:100%;pointer-events:none;position:absolute;right:0;top:0;width:260px}
.app-header__titleblock{position:relative}.app-header__eyebrow{color:#b84023;font-size:9px;font-weight:800;letter-spacing:.17em;margin-bottom:4px;text-transform:uppercase}
.app-header__utility{align-items:center;color:#706358;display:flex;font-size:11px;gap:12px;position:relative}.app-header__date{border-right:1px solid #dfd4c8;padding-right:12px}.app-header__utility .app-clock{color:#292019;font-size:14px;font-weight:700}
.app-title,.font-display{color:#211c17!important;letter-spacing:-.025em!important}
.app-title{font-size:28px!important;font-weight:750!important}
.app-subtitle{color:#93745c!important;font-size:12px!important;margin-top:4px!important}
.sidebar{background:linear-gradient(180deg,rgba(27,21,18,.88),rgba(12,10,9,.97)),url('./dashboard-sabinagisa-v1.png') 57% center/cover!important;border-right:0!important;box-shadow:12px 0 36px rgba(37,26,17,.11)!important;color:#eee8df!important}
.sidebar{min-width:228px!important;width:228px!important}
.sidebar{flex:0 0 0!important;height:100dvh!important;max-height:100dvh!important;min-width:0!important;overflow:hidden!important;position:relative!important;transform:none!important;transition:flex-basis .22s ease,min-width .22s ease,width .22s ease!important;width:0!important;z-index:2!important}.sidebar.is-drawer-open{flex-basis:228px!important;min-width:228px!important;overflow:auto!important;width:228px!important}.sidebar-scrim{display:none!important}
.app-header__menu-toggle{align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:9px;color:var(--bone);cursor:pointer;display:flex;flex:0 0 40px;height:40px;justify-content:center;margin-right:13px;position:relative;width:40px}.app-header__menu-toggle span,.app-header__menu-toggle span:before,.app-header__menu-toggle span:after{background:currentColor;border-radius:2px;content:"";height:2px;position:absolute;width:17px}.app-header__menu-toggle span:before{top:-6px}.app-header__menu-toggle span:after{top:6px}
.sidebar:before{background:linear-gradient(180deg,rgba(216,74,36,.26),transparent 18%,transparent 75%,rgba(182,138,50,.16)),repeating-linear-gradient(135deg,transparent 0 18px,rgba(255,255,255,.025) 18px 19px)!important;content:"";inset:0;pointer-events:none;position:absolute}
.sidebar>*{position:relative}
.sidebar-brand{border-bottom:1px solid rgba(255,255,255,.1)!important;padding:27px 21px 22px!important}
.sidebar-brand__name,.sidebar .font-display{color:#fff9f0!important;font-size:18px!important;letter-spacing:.13em!important}
.sidebar-brand__sub{color:#c6ab90!important;letter-spacing:.12em!important}
.sidebar-section,.sidebar-group-title{color:#a69b8d!important;letter-spacing:.12em!important}
.sidebar-link{border-radius:9px!important;color:#d3cbc1!important;margin:3px 11px!important;padding:11px 13px!important;transition:background .18s ease,color .18s ease,transform .18s ease!important}
.sidebar-link:hover{background:rgba(255,255,255,.075)!important;color:#fff!important;transform:translateX(2px)}
.sidebar-link.active,.sidebar-link.is-active{background:linear-gradient(90deg,#e24a24,#b3321b)!important;box-shadow:0 8px 18px rgba(164,43,23,.28)!important;color:#fffaf5!important}
.sidebar-link.active:before,.sidebar-link.is-active:before{background:#ffd28c!important;box-shadow:0 0 14px #ffd28c!important}
.sidebar-nav{padding:8px 10px 12px!important}.sidebar-group{border-bottom:1px solid rgba(255,255,255,.085)!important;padding:7px 0 9px!important}.sidebar-group__toggle{color:#c9b8a7!important;font-size:9px!important;letter-spacing:.09em!important;padding:8px 8px!important;text-transform:none!important}.sidebar-group__toggle:hover,.sidebar-group__toggle.is-open{color:#ffd39b!important}.sidebar-group__toggle small{align-items:center;background:rgba(255,255,255,.1)!important;border-radius:99px!important;color:#e7d7c8!important;display:flex;height:19px;justify-content:center;min-width:19px;padding:0 5px}.sidebar-group__toggle b{color:#e45a31!important;font-size:14px!important}.sidebar-group__items{padding:2px 0 4px!important}.sidebar-link{font-size:12px!important;min-height:39px}
.sidebar.is-drawer-open{display:flex!important;flex-direction:column!important;height:100dvh!important;max-height:100dvh!important;min-height:100dvh!important;overflow:hidden!important}
.sidebar-nav{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-gutter:stable}
.sidebar-user,.sidebar-footer{border-top:1px solid rgba(255,255,255,.1)!important;flex:0 0 auto!important;margin-top:auto!important}
.panel,.card,.stat-card,.summary-card,.membership-plans,.daily-summary-card,.stock-card,.expenses-card{background:rgba(255,253,249,.94)!important;border:1px solid rgba(83,59,37,.13)!important;border-radius:15px!important;box-shadow:0 12px 26px rgba(64,43,26,.055)!important;color:#231f1a!important}
.panel:hover,.card:hover{box-shadow:0 16px 34px rgba(64,43,26,.09)!important}
.panel h1,.panel h2,.panel h3,.panel strong,.card h1,.card h2,.card h3{color:#211c17!important}
.panel small,.panel p,.card small,.card p{color:#776b60!important}
.input,select,textarea{background:#fffdf9!important;border:1px solid #d9cfc4!important;border-radius:9px!important;color:#28221d!important;box-shadow:inset 0 1px 1px rgba(44,29,13,.025)!important}
.input::placeholder,textarea::placeholder{color:#aa9f93!important}
.input:focus,select:focus,textarea:focus{border-color:#dd542b!important;box-shadow:0 0 0 3px rgba(216,74,36,.13)!important;outline:0!important}
.btn{background:#fffdfa!important;border:1px solid #d7cdc1!important;border-radius:9px!important;color:#42382f!important;font-weight:650!important;transition:all .18s ease!important}
.btn:hover{border-color:#b88f69!important;box-shadow:0 5px 15px rgba(82,50,25,.12)!important;transform:translateY(-1px)}
.btn-primary,.btn-danger,button[type=submit]{background:linear-gradient(135deg,#e9572d,#c43c20)!important;border-color:#c43c20!important;color:#fff!important;box-shadow:0 7px 15px rgba(196,60,32,.19)!important}
.btn-primary:hover,.btn-danger:hover,button[type=submit]:hover{background:linear-gradient(135deg,#f1663a,#d34626)!important}
.btn-secondary{background:#fffdfa!important;color:#41362d!important}
button{font-family:inherit!important}
table{background:#fffdfa!important;border-collapse:separate!important;border-spacing:0!important;border:1px solid rgba(83,59,37,.12)!important;border-radius:12px!important;overflow:hidden!important}
thead{background:#f6f0e8!important}th{color:#827468!important;font-size:10px!important;letter-spacing:.08em!important;text-transform:uppercase!important}td{border-color:rgba(83,59,37,.1)!important;color:#332a24!important}tr:hover td{background:#fff6ed!important}
.font-mono{color:inherit!important}.text-success,.success{color:#27815a!important}.text-danger,.danger{color:#bf3b31!important}
.kpi,.kpi-card,.metric-card,.stat-card{background:#fffdfa!important;border-color:rgba(83,59,37,.12)!important;min-height:112px!important}
.kpi:before,.kpi-card:before,.metric-card:before{background:linear-gradient(180deg,#e9572d,#f0b265)!important;border-radius:99px!important;content:"";height:31px;left:0;position:absolute;top:20px;width:3px}
.kpi [class*=label],.kpi-card [class*=label],.metric-card [class*=label]{color:#948478!important;letter-spacing:.08em!important}
.kpi [class*=value],.kpi-card [class*=value],.metric-card [class*=value]{color:#241d18!important}
[role=dialog],.modal-content,.modal__content{background:#fffdfa!important;border:1px solid rgba(83,59,37,.18)!important;border-radius:16px!important;box-shadow:0 28px 80px rgba(37,22,13,.28)!important;color:#272019!important}
[role=dialog] h1,[role=dialog] h2,[role=dialog] h3{color:#221c17!important}
.tabs button,.tab-button,.filter-button{background:#fffdf9!important;border:1px solid #ddd2c5!important;border-radius:999px!important;color:#6f6358!important}
.tabs button.is-active,.tabs button.active,.tab-button.active,.filter-button.active{background:#29231f!important;border-color:#29231f!important;color:#fff7ed!important}
.badge,.status-badge{border-radius:999px!important;font-weight:700!important;letter-spacing:.04em!important}
.page-enter{animation:premium-enter .34s ease-out!important}@keyframes premium-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
.page-enter{margin:0 auto;max-width:1440px!important}.page-enter>div:first-child{position:relative}
/* Existing inline grids become a calmer editorial dashboard instead of a dense
   dark operations console. No data or event handlers are changed. */
.page-enter>div>div[style*="gridTemplateColumns"]{gap:16px!important}
.page-enter>div>div[style*="marginBottom: 22px"]>div,.page-enter>div>div[style*="marginBottom: 22px"]>button{border-radius:14px!important;overflow:hidden!important}
.page-enter [style*="linear-gradient(120deg"]{background:linear-gradient(90deg,rgba(15,10,8,.88),rgba(23,14,9,.56),rgba(25,15,9,.33)),url('./dashboard-sabinagisa-v1.png') center 46%/cover!important;border:0!important;border-radius:17px!important;box-shadow:0 20px 38px rgba(70,39,22,.18)!important;color:#fffaf2!important;min-height:130px!important;position:relative!important}
.page-enter [style*="linear-gradient(120deg"] *:not(button){color:#fffaf2!important}
.page-enter [style*="linear-gradient(120deg"] .panel,.page-enter [style*="linear-gradient(120deg"] .panel *{color:#292019!important}
.pos-hero .pos-tabs .btn:not([style*="var(--bone)"]){background:rgba(255,253,249,.94)!important;color:#33291f!important}.pos-hero .pos-tabs .btn[style*="var(--bone)"]{background:linear-gradient(135deg,#e9572d,#c43c20)!important;border-color:#c43c20!important;color:#fff!important}
.page-enter [style*="linear-gradient(120deg"]:before{background:radial-gradient(circle at center,rgba(255,209,135,.56) 0 2px,transparent 3px) 0 0/24px 24px;content:"";inset:0;opacity:.18;pointer-events:none;position:absolute}
.page-enter [style*="linear-gradient(120deg"] .font-display,.page-enter [style*="linear-gradient(120deg"] div,.page-enter [style*="linear-gradient(120deg"] span{position:relative}
.page-enter [style*="linear-gradient(120deg"] .font-display:not([style*="color"]){color:#fffaf2!important}
.page-enter [style*="linear-gradient(120deg"] button.btn:not(.btn-primary){background:rgba(255,255,255,.11)!important;border-color:rgba(255,255,255,.33)!important;color:#fff!important}
.page-enter [style*="gridTemplateColumns: 'repeat(4, 1fr)'"]>div,.page-enter [style*="gridTemplateColumns: 'repeat(4, 1fr)'"]>button>div{background:#fffdfa!important;border:1px solid #e1d6ca!important;border-radius:14px!important;box-shadow:0 8px 20px rgba(72,49,29,.06)!important;min-height:118px!important}
.page-enter [style*="gridTemplateColumns: 'repeat(4, 1fr)'"]>div:first-child,.page-enter [style*="gridTemplateColumns: 'repeat(4, 1fr)'"]>button>div:first-child{border-top:3px solid #d84a24!important}
/* POS and kitchen retain their dense workflow, but gain a calm paper workspace. */
.pos-page,.pos-layout,.order-page,.kitchen-board{color:#26201a!important}.pos-page .panel,.pos-layout .panel,.order-page .panel,.kitchen-board .panel{background:#fffdfa!important}
.pos-page [class*=product],.pos-layout [class*=product]{background:#fffdfa!important;border-color:#e1d7cc!important;border-radius:12px!important}.pos-page [class*=product]:hover,.pos-layout [class*=product]:hover{border-color:#dd542b!important;box-shadow:0 9px 19px rgba(92,52,24,.1)!important}
.kitchen-board [class*=ticket],.kitchen-board [class*=order-card]{background:#fffdfa!important;border-color:#e2d4c7!important;color:#29221d!important}
@media(max-width:900px){.app-main{padding:22px 18px 40px!important}.app-header:after{display:none}.app-title{font-size:24px!important}.sidebar{box-shadow:8px 0 22px rgba(30,20,14,.18)!important}}
@media(min-width:701px) and (max-width:1120px){.page-enter>div>div[style*="gridTemplateColumns: 'repeat(4, 1fr)'"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
/* Live dashboard modules: all figures are derived from the currently loaded
   Supabase rows and attendance snapshot, never demo placeholders. */
.dashboard-widgets{display:grid;gap:14px;grid-template-columns:minmax(0,1fr) minmax(0,1fr);margin:0 0 20px}.dashboard-widget{min-width:0;padding:18px 20px!important}.dashboard-widget__title{align-items:center;display:flex;gap:9px;margin:0 0 14px}.dashboard-widget__title i{background:#e9572d;border-radius:50%;height:8px;width:8px}.dashboard-widget__title h3{font-size:14px;margin:0}.dashboard-widget__title small{color:#918478;margin-left:auto;font-size:10px}.dashboard-onwork__people{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(88px,1fr))}.dashboard-onwork__person{align-items:center;background:#fff8f0;border:1px solid #eee2d6;border-radius:11px;display:flex;flex-direction:column;gap:4px;min-width:0;padding:11px 7px;position:relative;text-align:center}.dashboard-onwork__avatar{align-items:center;background:linear-gradient(135deg,#f0aa70,#b92a2c);border:2px solid #fff;border-radius:13px;box-shadow:0 3px 9px #5f37221f;color:#fff;display:flex;font-size:11px;font-weight:800;height:42px;justify-content:center;width:42px}.dashboard-onwork__person strong{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%}.dashboard-onwork__person small{color:#918478;font-size:9px}.dashboard-onwork__person em{background:#26aa68;border:2px solid #fff;border-radius:50%;height:9px;position:absolute;right:13px;top:45px;width:9px}.dashboard-widget__empty{color:#918478;font-size:11px;padding:15px 5px;text-align:center}.dashboard-composition{align-items:center;display:grid;grid-template-columns:128px 1fr;gap:18px}.dashboard-donut{align-items:center;background:conic-gradient(#e9572d 0 var(--garage-pct),#e9ad53 var(--garage-pct) 100%);border-radius:50%;display:flex;height:120px;justify-content:center;position:relative;width:120px}.dashboard-donut:after{background:#fffdfa;border-radius:50%;content:"";height:79px;position:absolute;width:79px}.dashboard-donut__center{align-items:center;display:flex;flex-direction:column;font-size:9px;position:relative;text-align:center;z-index:1}.dashboard-donut__center strong{color:#2b211a;font-size:13px}.dashboard-legend{display:grid;gap:9px}.dashboard-legend__row{align-items:center;display:grid;font-size:10px;gap:7px;grid-template-columns:9px 1fr auto}.dashboard-legend__dot{border-radius:50%;height:8px;width:8px}.dashboard-legend__row strong{font-size:10px}.dashboard-hourly__chart{align-items:end;display:grid;gap:5px;grid-template-columns:repeat(24,minmax(0,1fr));height:106px;padding:8px 0 19px;position:relative}.dashboard-hourly__bar{align-self:end;background:linear-gradient(180deg,#f5a36e,#e9572d);border-radius:4px 4px 1px 1px;min-height:3px;position:relative}.dashboard-hourly__bar.is-peak{background:linear-gradient(180deg,#d84a24,#a92e1c)}.dashboard-hourly__bar label{bottom:-18px;color:#96887b;font-size:7px;left:50%;position:absolute;transform:translateX(-50%);white-space:nowrap}.dashboard-hourly__meta{color:#918478;font-size:9px;margin-top:5px}.dashboard-live{background:linear-gradient(110deg,#fff5e9,#fffdfa)!important;border-color:#f0d2b4!important;grid-column:1/-1}.dashboard-live__body{align-items:center;display:flex;flex-wrap:wrap;gap:12px}.dashboard-live__peak{background:#fff;border:1px solid #f0dfcc;border-radius:10px;color:#42352a;font-size:11px;padding:10px 13px}.dashboard-live__peak strong{color:#c64526;font-size:13px;margin:0 4px}.dashboard-live__text{color:#76695d;font-size:10px;line-height:1.65}
@media(max-width:850px){.dashboard-widgets{grid-template-columns:1fr}.dashboard-live{grid-column:auto}.dashboard-composition{grid-template-columns:110px 1fr}.dashboard-donut{height:104px;width:104px}.dashboard-donut:after{height:68px;width:68px}}
.dashboard-hero{align-items:center!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(360px,.95fr);gap:24px!important;min-height:150px!important;padding:24px 30px!important}.dashboard-hero__copy{max-width:540px}.dashboard-hero__eyebrow{color:#ffc06a;font-size:10px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase}.dashboard-hero__copy h2{font-size:clamp(25px,3vw,36px);letter-spacing:.06em;line-height:1.1;margin:8px 0;color:#fff8ed!important}.dashboard-hero__copy p{font-size:19px;font-weight:700;margin:0 0 5px;color:#fff8ed!important}.dashboard-hero__copy small{color:#eadaca!important;font-size:11px;letter-spacing:.8px}.dashboard-hero__status{align-items:center;background:rgba(14,12,11,.78);backdrop-filter:blur(8px);border:1px solid rgba(255,197,127,.28);border-radius:13px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));min-width:0;overflow:hidden;padding:10px 14px}.dashboard-hero__status>div{display:flex;flex-direction:column;gap:4px;padding:2px 12px;border-right:1px solid rgba(255,255,255,.16)}.dashboard-hero__status>div:first-child{padding-left:4px}.dashboard-hero__status>div:last-of-type{border:0}.dashboard-hero__status strong{color:#ffd18c!important;font-size:14px}.dashboard-hero__status small{color:#d7cbc0!important;font-size:9px;white-space:nowrap}.dashboard-hero__status button{grid-column:1/-1;justify-self:end;margin-top:8px;min-width:130px}
.sabinagisa-pos{position:relative}.sabinagisa-pos .pos-layout{grid-template-columns:minmax(0,1.55fr) minmax(340px,.9fr)!important;gap:14px!important}.sabinagisa-pos .pos-service-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:11px!important}.sabinagisa-pos .pos-service-grid>.panel{background:#fffdfa!important;border:1px solid #e6d9cc!important;border-radius:12px!important;color:#292019!important;box-shadow:0 6px 17px rgba(68,42,23,.07)!important;padding:12px!important;transition:transform .16s ease,box-shadow .16s ease}.sabinagisa-pos .pos-service-grid>.panel:hover{box-shadow:0 11px 24px rgba(68,42,23,.14)!important;transform:translateY(-2px)}.sabinagisa-pos .pos-service-grid>.panel>div:first-child{height:92px!important}.sabinagisa-pos .pos-cart{background:#fffdfa!important;border:1px solid #e6d9cc!important;border-radius:14px!important;color:#292019!important;box-shadow:0 10px 26px rgba(68,42,23,.09)!important;top:12px!important}.sabinagisa-pos .pos-cart .font-display{color:#33251c!important}.sabinagisa-pos .pos-tabs{display:flex;gap:8px;margin-bottom:14px;overflow:auto}.sabinagisa-pos .pos-tabs .btn{background:#fffdfa!important;border-color:#e6d9cc!important;color:#594a3d!important;border-radius:999px!important;padding:8px 15px!important}.sabinagisa-pos .pos-tabs .btn.btn-primary{background:#cf2d18!important;border-color:#cf2d18!important;color:#fff!important}
.sabinagisa-pos-inbox__trigger{align-items:center;background:#fffdfa;border:1px solid #e6d9cc;border-radius:9px;box-shadow:0 5px 15px #40241016;color:#33251c;cursor:pointer;display:flex;font:600 11px inherit;gap:9px;min-height:38px;padding:0 12px;position:fixed;right:26px;top:80px;z-index:10002}.sabinagisa-pos-inbox__trigger b{align-items:center;background:#d92d20;border-radius:999px;color:#fff;display:inline-flex;font-size:10px;height:20px;justify-content:center;min-width:20px;padding:0 5px}.sabinagisa-pos-inbox__drawer{background:linear-gradient(155deg,#242323,#151616);border:1px solid rgba(225,78,44,.5);border-radius:15px;box-shadow:0 24px 70px #0009;color:#f8f2e9;max-height:calc(100vh - 150px);overflow:auto;padding:15px;position:fixed;right:22px;top:126px;width:min(350px,calc(100vw - 28px));z-index:10001}.sabinagisa-pos-inbox__drawer>header{align-items:center;border-bottom:1px solid #ffffff18;display:flex;justify-content:space-between;margin:-1px 0 12px;padding:0 0 12px}.sabinagisa-pos-inbox__drawer>header span{color:#f28b55;font-size:9px;letter-spacing:1.3px}.sabinagisa-pos-inbox__drawer>header h2{font-size:15px;margin-top:2px}.sabinagisa-pos-inbox__drawer>header button{background:transparent;border:0;color:#c7bdb2;cursor:pointer;font-size:22px}.sabinagisa-pos-inbox__list{display:grid;gap:9px}.sabinagisa-pos-inbox__order{background:#ffffff0a;border:1px solid #ffffff16;border-radius:11px;padding:11px}.sabinagisa-pos-inbox__order-top{align-items:center;display:flex;gap:8px;justify-content:space-between}.sabinagisa-pos-inbox__order-top>b{font-size:12px}.sabinagisa-pos-inbox__order-top>span{border-radius:999px;font-size:9px;font-weight:800;padding:3px 8px}.sabinagisa-pos-inbox__order-top>span.new{background:#dd4923}.sabinagisa-pos-inbox__order-top>span.cooking{background:#b77a13}.sabinagisa-pos-inbox__order-top>span.ready{background:#2878bd}.sabinagisa-pos-inbox__order>small{color:#b9aea1;font-size:9px}.sabinagisa-pos-inbox__items{color:#cfc5b9;font-size:10px;line-height:1.6;margin:6px 0 9px}.sabinagisa-pos-inbox__order>a,.sabinagisa-pos-inbox__all{background:#d92d20;border:1px solid #d92d20;border-radius:7px;color:#fff;display:block;font-size:10px;font-weight:700;padding:8px;text-align:center;text-decoration:none}.sabinagisa-pos-inbox__all{background:transparent;border-color:#625b54;margin-top:10px}.sabinagisa-pos-inbox__empty{color:#c4b9ad;font-size:11px;padding:20px 5px;text-align:center}
.sabinagisa-pos .pos-service-grid>.panel{position:relative!important;padding-bottom:40px!important}.sabinagisa-pos .pos-service-grid>.panel:after{align-items:center;background:#d92d20;border-radius:50%;bottom:10px;color:#fff;content:"+";display:flex;font-size:20px;font-weight:500;height:27px;justify-content:center;position:absolute;right:11px;width:27px;box-shadow:0 3px 8px #d92d2040}
.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger{cursor:grab;position:absolute;right:0;top:0;touch-action:none}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger:active{cursor:grabbing}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__drawer{max-height:calc(100vh - 150px);position:absolute;right:0;top:46px;width:min(350px,calc(100vw - 28px))}
.sabinagisa-pos-inbox__action{background:#d92d20;border:1px solid #d92d20;border-radius:7px;color:#fff;cursor:pointer;display:block;font:700 10px inherit;padding:8px;text-align:center;width:100%}.sabinagisa-pos-inbox__action:disabled{cursor:wait;opacity:.55}.sabinagisa-pos-inbox__actions{display:flex;gap:6px;margin-top:7px}.sabinagisa-pos-inbox__actions button{background:#ffffff0c;border:1px solid #ffffff24;border-radius:6px;color:#ddd1c3;cursor:pointer;flex:1;font:600 9px inherit;padding:6px 3px}.sabinagisa-pos-inbox__actions button:last-child{color:#f18b92}.sabinagisa-pos-inbox__actions button:disabled{cursor:wait;opacity:.5}.sabinagisa-pos-inbox__error{background:#632b28;border-radius:8px;color:#ffd4ce;font-size:10px;margin:8px 0;padding:8px}.sabinagisa-pos-inbox__item{color:#eee3d6;font-size:11px;line-height:1.45}.sabinagisa-pos-inbox__item small{color:#e4bb68;display:block;font-size:9px;padding-left:8px}
.dashboard-hero{align-items:center!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(360px,.95fr);gap:24px!important;min-height:150px!important;padding:24px 30px!important}
.dashboard-hero__copy{max-width:540px}.dashboard-hero__eyebrow{color:#ffc06a;font-size:10px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase}.dashboard-hero__copy h2{font-size:clamp(25px,3vw,36px);letter-spacing:.06em;line-height:1.1;margin:8px 0;color:#fff8ed!important}.dashboard-hero__copy p{font-size:19px;font-weight:700;margin:0 0 5px;color:#fff8ed!important}.dashboard-hero__copy small{color:#eadaca!important;font-size:11px;letter-spacing:.8px}.dashboard-hero__status{align-items:center;background:rgba(14,12,11,.78);backdrop-filter:blur(8px);border:1px solid rgba(255,197,127,.28);border-radius:13px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));min-width:0;overflow:hidden;padding:10px 14px}.dashboard-hero__status>div{display:flex;flex-direction:column;gap:4px;padding:2px 12px;border-right:1px solid rgba(255,255,255,.16)}.dashboard-hero__status>div:first-child{padding-left:4px}.dashboard-hero__status>div:last-of-type{border:0}.dashboard-hero__status strong{color:#ffd18c!important;font-size:14px}.dashboard-hero__status small{color:#d7cbc0!important;font-size:9px;white-space:nowrap}.dashboard-hero__status button{grid-column:1/-1;justify-self:end;margin-top:8px;min-width:130px}
/* Pair real latest bills with live team status and trend modules. */
.page-enter>div:has(> .dashboard-widgets){display:grid;gap:14px;grid-template-columns:minmax(0,1.12fr) minmax(320px,.88fr);grid-auto-flow:row dense;align-items:start}
.page-enter>div:has(> .dashboard-widgets)>*:not(.dashboard-widgets){grid-column:1/-1}
.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets{grid-column:2;grid-row:auto;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0;align-self:stretch}
.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets+.panel{grid-column:1;grid-row:auto;margin:0!important;max-height:570px;overflow:auto;align-self:stretch}
.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets>.dashboard-widget:first-child,.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets>.dashboard-live{grid-column:1/-1}
@media(max-width:850px){.page-enter>div:has(> .dashboard-widgets){display:flex;flex-direction:column;gap:14px}.page-enter>div:has(> .dashboard-widgets)>*{width:100%;max-width:100%;margin:0!important}.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets{display:grid;grid-template-columns:1fr}.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets+.panel{max-height:480px}.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets>.dashboard-widget:first-child,.page-enter>div:has(> .dashboard-widgets)>.dashboard-widgets>.dashboard-live{grid-column:auto}}
@media(max-width:850px){.dashboard-hero{grid-template-columns:1fr;gap:14px!important}.dashboard-hero__status{width:100%}}
@media(max-width:1000px){.sabinagisa-pos .pos-layout{grid-template-columns:1fr!important}.sabinagisa-pos .pos-cart{position:relative!important;top:auto!important}.sabinagisa-pos .pos-service-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media(max-width:650px){.sabinagisa-pos .pos-service-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.sabinagisa-pos-inbox__trigger{right:12px;top:76px}.sabinagisa-pos-inbox__drawer{right:10px;top:120px;max-height:calc(100vh - 132px)}}
.sabinagisa-pos-inbox .sabinagisa-pos-inbox__drawer{background:radial-gradient(ellipse at 50% 65%,rgba(177,47,34,.18),transparent 48%),linear-gradient(155deg,#242323,#111212);border-color:#a9362b;box-shadow:0 24px 80px #000b;max-height:calc(100vh - 150px);padding:26px 30px;width:min(760px,calc(100vw - 32px))}.sabinagisa-pos-inbox__drawer>header{margin-bottom:14px;padding-bottom:16px}.sabinagisa-pos-inbox__drawer>header span{font-size:10px;letter-spacing:2px}.sabinagisa-pos-inbox__drawer>header h2{font-size:25px}.sabinagisa-pos-inbox__empty-state{align-items:center;display:flex;flex-direction:column;justify-content:center;min-height:330px;text-align:center}.sabinagisa-pos-inbox__chef-art{background-image:url('./kitchen-mini-empty-reference.png');background-position:-218px -244px;background-repeat:no-repeat;background-size:800px auto;height:220px;max-width:100%;width:340px}.sabinagisa-pos-inbox__empty-state strong{color:#fff8f2;font-size:clamp(21px,3vw,30px);line-height:1.25;margin-top:-2px}.sabinagisa-pos-inbox__empty-state p{color:#bcb2aa;font-size:16px;margin:8px 0 0}.sabinagisa-pos-inbox__trigger{background:linear-gradient(145deg,#262222,#141414);border-color:#a9362b;color:#fff8f2;font-size:14px;min-height:48px;padding:0 18px}.sabinagisa-pos-inbox__trigger b{height:26px;min-width:26px}.sabinagisa-pos-inbox__drawer .sabinagisa-pos-inbox__empty:not(.sabinagisa-pos-inbox__empty-state){padding:28px 5px}.sabinagisa-pos-inbox__list{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}@media(max-width:600px){.sabinagisa-pos-inbox .sabinagisa-pos-inbox__drawer{padding:18px 16px;width:calc(100vw - 28px)}.sabinagisa-pos-inbox__empty-state{min-height:280px}.sabinagisa-pos-inbox__chef-art{background-position:-218px -223px;background-size:720px auto;height:200px;width:300px}.sabinagisa-pos-inbox__empty-state strong{font-size:20px}.sabinagisa-pos-inbox__empty-state p{font-size:13px}}
.login-page{align-items:stretch!important;background:#120e0b url('./ghost-login-lakeside.png') center/cover no-repeat!important;display:grid!important;inset:0;min-height:100vh;overflow:auto;padding:0!important;position:fixed;width:100vw}.login-shell{align-items:stretch;background:linear-gradient(90deg,rgba(12,9,7,.14) 0%,rgba(12,9,7,.14) 52%,rgba(248,243,235,.97) 52%,#f8f3eb 100%);display:grid!important;grid-template-columns:minmax(0,1.1fr) minmax(390px,.9fr);inset:0;max-width:none!important;min-height:100vh;position:absolute;width:100%!important}.login-brand{align-items:flex-start;background:linear-gradient(90deg,rgba(8,6,5,.7),rgba(8,6,5,.2)),url('./ghost-login-lakeside.png') center/cover!important;display:flex;flex-direction:column;justify-content:flex-start;margin:0!important;padding:34px clamp(24px,4vw,64px)!important;text-align:left!important}.login-brand .login-brand__name{color:#fff8ed!important;font-size:clamp(22px,2.7vw,38px)!important;letter-spacing:.055em!important;line-height:1.2;max-width:100%;overflow-wrap:anywhere;text-shadow:0 2px 18px #000,0 1px 3px #000}.login-brand .login-brand__subtitle{color:#fff0dc!important;font-size:11px!important;letter-spacing:2px!important;margin-top:10px!important;text-shadow:0 1px 8px #000}.login-brand__dot{color:#ff6b43!important}.login-card{align-self:center;background:rgba(255,253,249,.97)!important;border:1px solid rgba(110,72,42,.18)!important;border-radius:20px!important;box-shadow:0 24px 58px rgba(23,15,9,.28)!important;color:#272019!important;margin:20px auto!important;max-height:calc(100vh - 40px);max-width:720px;overflow:auto;width:calc(100% - 40px)!important}.login-card h1,.login-card__header p{color:#272019!important}.login-card .staff-group{background:#fffaf5!important;border-color:#eadfd3!important}.login-card .staff-group__header h2,.login-card .staff-card{color:#30251d!important}.login-card .staff-card{background:#fffdf9!important;border-color:#eadfd3!important}.login-card .staff-card__details small,.login-card .staff-group__header span,.login-card .staff-picker__toolbar>span{color:#84766a!important}.login-card .staff-search{background:#fff!important;border-color:#e5d8ca!important}.login-card .staff-search input{color:#30251d!important}.login-card--pin{background:rgba(255,253,249,.98)!important}.login-card--pin .pin-panel__label,.login-card--pin .selected-profile p{color:#75675b!important}.login-card--pin .pin-pad__key{background:#f7efe7!important;border-color:#eadfd3!important;color:#30251d!important}.login-card--pin .change-profile{color:#75675b!important}@media(max-width:760px){.login-page{background-position:center!important}.login-shell{background:linear-gradient(180deg,rgba(8,6,5,.18) 0 170px,#f8f3eb 170px);grid-template-columns:1fr;grid-template-rows:170px 1fr;position:relative;min-height:100vh}.login-brand{background:linear-gradient(90deg,rgba(8,6,5,.65),rgba(8,6,5,.2)),url('./ghost-login-lakeside.png') center 44%/cover!important;min-height:170px;padding:20px 24px!important}.login-brand .login-brand__name{font-size:25px!important}.login-card{margin:12px auto!important;max-height:none;width:calc(100% - 24px)!important}}
@media(min-width:761px){.login-card__header{margin-bottom:15px!important}.login-card__header h1{margin-top:0!important}.login-card--profiles .staff-groups{max-height:calc(100vh - 360px)!important}}.login-footer{background:rgba(12,9,7,.58);border:1px solid rgba(255,240,220,.2);border-radius:10px;bottom:22px;color:#fff3e4!important;left:28px;padding:9px 13px;position:fixed!important;text-shadow:0 1px 8px #000;z-index:10}.login-footer a,.login-footer .link{color:#fff!important;font-weight:700;text-decoration:underline;text-underline-offset:3px}.login-footer a:hover,.login-footer .link:hover{color:#ffd18c!important}@media(max-width:760px){.login-card--profiles .staff-groups{max-height:none!important}.login-footer{bottom:10px;left:12px}}
`

const loginHeroSeamlessCss = `
/* Keep the hero as one continuous scene. A second copy of the same photo on
   the text column creates a visible rectangular crop against the page image. */
.login-brand{background:transparent!important}
@media(max-width:760px){.login-brand{background:transparent!important}}
/* Interactive dual-brand login: hover previews, a click locks the selected team. */
.login-page{isolation:isolate;overflow:hidden!important}
.login-page:after{background-position:center;background-size:cover;content:"";inset:0;opacity:0;pointer-events:none;position:fixed;transition:opacity .42s cubic-bezier(.22,1,.36,1);z-index:-1}
.login-page[data-brand="sabinagisa"]:after{background-image:linear-gradient(100deg,rgba(13,10,8,.42),rgba(18,12,9,.15)),url("./dashboard-sabinagisa-v1.png");opacity:.92}
.login-page[data-brand="garage"]:after{background-image:linear-gradient(100deg,rgba(10,8,8,.5),rgba(12,12,13,.18)),url("./dashboard-garage-v1.png");opacity:.92}
.login-shell{grid-template-columns:minmax(0,58fr) minmax(360px,42fr)!important;transition:grid-template-columns .42s cubic-bezier(.22,1,.36,1),column-gap .42s cubic-bezier(.22,1,.36,1);z-index:1}
.login-shell[data-brand="default"]{grid-template-columns:minmax(0,1fr)!important;column-gap:0!important}
.login-shell[data-brand="default"] .login-brand{align-items:center;grid-column:1;grid-row:1/3;justify-self:center;max-width:980px;text-align:center}
.login-shell[data-brand="default"] .login-brand__manifesto{justify-self:center;text-align:left}
.login-shell[data-brand="default"] .login-card{display:none}
.login-shell[data-brand="default"] .login-footer{grid-column:1;grid-row:2;justify-self:center;max-width:520px}
.login-brand__selectors{display:grid;gap:clamp(10px,1.2vw,18px);grid-template-columns:repeat(2,minmax(0,1fr));margin-top:clamp(24px,5vh,54px);max-width:780px;width:min(100%,780px)}
.login-brand__zone{align-items:flex-start;background:linear-gradient(130deg,rgba(25,24,23,.68),rgba(10,11,12,.48));backdrop-filter:blur(12px);border:1px solid rgba(255,239,216,.2);border-radius:14px;color:#fff5e8;cursor:pointer;display:flex;flex-direction:column;gap:5px;min-height:100px;padding:clamp(14px,1.7vw,23px);text-align:left;transition:background .35s cubic-bezier(.22,1,.36,1),border-color .35s cubic-bezier(.22,1,.36,1),transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s cubic-bezier(.22,1,.36,1)}
.login-brand__zone:hover,.login-brand__zone:focus-visible,.login-brand__zone.is-active{background:linear-gradient(130deg,rgba(51,35,26,.82),rgba(15,15,16,.68));border-color:rgba(243,183,122,.58);box-shadow:0 16px 45px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.12);outline:none;transform:translateY(-2px)}
.login-brand__zone>span{color:#e5b37f;font-size:9px;font-weight:700;letter-spacing:.2em}
.login-brand__zone>strong{font:500 clamp(19px,2vw,27px)/1.2 'Cormorant Garamond',Georgia,serif;letter-spacing:.025em}
.login-brand__zone>small{color:rgba(255,243,226,.68);font-size:11px}
.login-shell:not([data-brand="default"]) .login-brand{grid-column:1;grid-row:1/3;align-items:flex-start;justify-self:stretch;text-align:left}
.login-shell:not([data-brand="default"]) .login-brand__selectors{margin-top:clamp(18px,3vh,32px);width:100%}
.login-shell:not([data-brand="default"]) .login-brand__zone{min-height:76px;padding:12px 14px}
.login-shell:not([data-brand="default"]) .login-brand__zone:not(.login-brand__zone--active){opacity:.76}
.login-shell:not([data-brand="default"]) .login-card{animation:brand-panel-in .42s cubic-bezier(.22,1,.36,1) both;backdrop-filter:blur(24px) saturate(125%);background:linear-gradient(145deg,rgba(26,25,25,.9),rgba(13,14,15,.86))!important;border-color:rgba(255,239,216,.2)!important;color:#fff8ef!important;display:flex;flex-direction:column;max-height:calc(100dvh - 40px);min-height:0;overflow:hidden;position:relative}
.login-shell[data-brand="sabinagisa"] .login-card{box-shadow:0 28px 80px rgba(0,0,0,.48),0 0 34px rgba(210,149,71,.12)!important}
.login-shell[data-brand="garage"] .login-card{box-shadow:0 28px 80px rgba(0,0,0,.5),0 0 34px rgba(204,47,51,.12)!important}
.login-shell:not([data-brand="default"]) .staff-groups{flex:1 1 auto;min-height:0;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-gutter:stable}
.login-change-team{background:transparent;border:0;color:#e7b985;cursor:pointer;float:right;font:600 11px Inter,'Noto Sans Thai',sans-serif;padding:5px 0 5px 10px}
.login-change-team:hover{color:#fff4e7;text-decoration:underline;text-underline-offset:3px}
.login-shell[data-brand="sabinagisa"] .login-card__eyebrow{color:#e9bd75}
.login-shell[data-brand="garage"] .login-card__eyebrow{color:#f07866}
.login-shell:not([data-brand="default"]) .staff-group--chill{border-color:rgba(226,177,100,.28)}
.login-shell:not([data-brand="default"]) .staff-group--garage{border-color:rgba(216,77,69,.25)}
@keyframes brand-panel-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
@media(max-width:1050px){.login-shell,.login-shell[data-brand="default"]{align-items:center;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr);padding:clamp(14px,3vh,28px) clamp(14px,4vw,36px)!important}.login-shell[data-brand="default"] .login-brand{align-items:center;grid-row:1;text-align:center}.login-shell:not([data-brand="default"]) .login-brand{display:flex;grid-row:1;max-height:100%;overflow:hidden}.login-shell:not([data-brand="default"]) .login-brand__kanji{font-size:clamp(38px,7vw,66px);margin:clamp(8px,2vh,18px) 0 3px}.login-shell:not([data-brand="default"]) .login-brand__manifesto{display:none}.login-shell:not([data-brand="default"]) .login-brand__selectors{margin-top:clamp(14px,2vh,20px)}.login-shell:not([data-brand="default"]) .login-brand__zone{min-height:56px;padding:9px 11px}.login-shell:not([data-brand="default"]) .login-card{inset:12px;max-height:none!important;position:fixed;width:auto!important;z-index:5}.login-shell:not([data-brand="default"]) .login-footer{display:none}}
@media(max-width:600px){.login-shell,.login-shell[data-brand="default"]{padding:12px!important}.login-shell[data-brand="default"] .login-brand__kanji{font-size:clamp(40px,12vw,62px);margin:20px 0 4px}.login-brand__selectors{gap:9px;margin-top:22px;width:100%}.login-brand__zone{border-radius:12px;min-height:92px;padding:12px}.login-brand__zone>strong{font-size:clamp(17px,5vw,22px)}.login-brand__zone>small{font-size:10px}.login-shell:not([data-brand="default"]) .login-brand{display:none}.login-shell:not([data-brand="default"]) .login-card{inset:8px;max-height:none!important;padding:18px 14px;width:auto!important}.login-shell:not([data-brand="default"]) .login-card__header{margin-bottom:12px}.login-shell:not([data-brand="default"]) .staff-picker__toolbar{gap:8px}.login-shell:not([data-brand="default"]) .staff-groups{max-height:none!important}}
@media(max-width:1050px) and (max-height:520px){.login-shell,.login-shell[data-brand="default"]{padding:6px 18px!important}.login-brand__wordmark{font-size:9px}.login-brand__kicker{font-size:8px;margin-top:4px}.login-brand__kanji,.login-shell[data-brand="default"] .login-brand__kanji{font-size:clamp(34px,6vw,44px);margin:8px 0 0}.login-brand__reading{font-size:12px}.login-brand__services{font-size:10px;margin-top:5px;padding-top:5px}.login-brand__manifesto{gap:2px;margin-top:8px;padding-left:10px}.login-brand__manifesto span:first-child{font-size:14px}.login-brand__manifesto span:last-child{color:#fff4e8;font-size:14px;font-weight:650;letter-spacing:.02em}.login-brand__selectors{gap:7px;margin-top:9px}.login-brand__zone{min-height:54px;padding:8px 12px}.login-brand__zone>span{font-size:8px}.login-brand__zone>strong{font-size:18px}.login-brand__zone>small{font-size:9px}}
@media(prefers-reduced-motion:reduce){.login-page:after,.login-shell,.login-brand__zone,.login-shell:not([data-brand="default"]) .login-card{animation:none!important;transition:none!important}}
`

const fullWidthWorkspaceCss = `
/* Use the available desktop canvas instead of pinning every page to 1440px. */
.app-main{min-width:0;padding:clamp(18px,2vw,36px) clamp(18px,2.2vw,42px) 52px!important}
.workspace-topline,.app-header,.page-enter{box-sizing:border-box;max-width:none!important;width:100%!important}
.workspace-topline,.app-header{margin-left:0!important;margin-right:0!important}
.page-enter{margin:0!important}
/* POS identity is branch-specific: workshop imagery for Garage, dining scene for SABINAGISA. */
.page-enter .pos-hero.pos-hero--garage{background:linear-gradient(100deg,rgba(8,7,7,.9),rgba(18,12,9,.57),rgba(18,12,9,.34)),url('./dashboard-garage-v1.png') center 52%/cover!important;border-color:rgba(255,255,255,.16)!important;color:#fffaf2!important}
.page-enter .pos-hero.pos-hero--sabinagisa{background:linear-gradient(100deg,rgba(8,7,7,.9),rgba(18,12,9,.55),rgba(18,12,9,.35)),url('./dashboard-sabinagisa-v1.png') center 46%/cover!important;border-color:rgba(255,255,255,.16)!important;color:#fffaf2!important}
.page-enter .pos-hero.pos-hero--garage *:not(button),.page-enter .pos-hero.pos-hero--sabinagisa *:not(button){color:#fffaf2!important}
/* Give page titles a clear reading order instead of floating in the middle of the header. */
.app-header{display:grid!important;grid-template-columns:40px minmax(0,1fr) auto!important;column-gap:18px!important}
.app-header__menu-toggle{grid-column:1;grid-row:1;margin-right:0!important}
.app-header__titleblock{grid-column:2;grid-row:1;justify-self:start;text-align:left!important}
.app-header__utility{grid-column:3;grid-row:1;justify-self:end}
/* The loyalty screen should use the same full desktop canvas as the rest of the console. */
.members-page{box-sizing:border-box;max-width:none!important;width:100%!important}
.members-hero{align-items:center!important;background:linear-gradient(115deg,rgba(216,74,36,.1),rgba(255,255,255,.018) 46%,rgba(182,138,50,.07)),linear-gradient(145deg,#202224,#17191b)!important;border:1px solid rgba(242,238,231,.12)!important;border-radius:16px!important;margin-bottom:18px!important;padding:22px 26px!important;position:relative}
.members-hero:after{background:linear-gradient(90deg,transparent,rgba(216,74,36,.45),rgba(182,138,50,.4),transparent);bottom:-1px;content:"";height:1px;left:26px;opacity:.7;position:absolute;right:26px}
.members-hero h1{font-size:clamp(28px,2.2vw,36px)!important;line-height:1.15!important}
.members-subtitle{font-size:13px!important;margin-top:7px}
.members-add{box-shadow:0 8px 20px rgba(216,74,36,.2);min-height:44px;padding:0 20px!important}
.member-stats{gap:14px!important;margin-bottom:16px!important}
.member-stat{align-items:center!important;border-radius:13px!important;min-height:98px;padding:17px 19px!important}
.member-stat__icon{border:1px solid rgba(234,98,108,.2);border-radius:10px!important;flex:0 0 42px;height:42px!important;width:42px!important}
.member-stat strong{font-size:22px!important}
.membership-plans{gap:14px!important;margin-bottom:18px!important}
.membership-plan{background:radial-gradient(ellipse at 100% 0,rgba(255,255,255,.045),transparent 54%),linear-gradient(145deg,#222426,#191b1d)!important;border-radius:14px!important;min-height:218px;padding:20px 22px!important;position:relative;overflow:hidden}
.membership-plan:before{background:linear-gradient(180deg,rgba(255,255,255,.035),transparent 60%);content:"";inset:0;pointer-events:none;position:absolute}
.membership-plan>*{position:relative}
.membership-plan>span{font-size:10px!important;letter-spacing:1.5px!important}
.membership-plan strong{font-size:26px!important;margin:10px 0 12px!important}
.membership-plan p{font-size:12px!important;line-height:1.55;margin:5px 0!important}
.membership-plan__add{border-radius:8px!important;margin-top:16px!important;min-height:38px}
.membership-workspace,.members-workspace{border-radius:14px!important}
.members-toolbar{padding:18px 20px 14px!important}
.member-search{max-width:560px!important}
.member-row{min-height:82px!important}
@media(max-width:760px){.app-header{grid-template-columns:40px minmax(0,1fr)!important;row-gap:9px!important}.app-header__titleblock{grid-column:2;grid-row:1}.app-header__utility{grid-column:2;grid-row:2;justify-self:start}.members-hero{align-items:flex-start!important;padding:18px!important}.membership-plan{min-height:0;padding:17px!important}}
@media(min-width:1500px){
  .stock-page{gap:20px}.stock-heading{min-height:118px;padding:22px 26px!important}.stock-heading__title h1{font-size:27px}.stock-heading__title p{font-size:14px}
  .stock-kpis{gap:14px}.stock-kpi{min-height:108px;padding:18px}.stock-kpi small{font-size:12px}.stock-kpi strong{font-size:27px}.stock-kpi em{font-size:11px}
  .stock-layout{gap:18px;grid-template-columns:minmax(0,1fr) minmax(330px,390px)}.stock-table{font-size:13px}.stock-table th{font-size:11px;padding:13px}.stock-table td{padding:12px 13px}.stock-table td:first-child strong{font-size:13px}.stock-table td small{font-size:10px}.stock-side-title h2{font-size:15px}.stock-alert-row strong{font-size:12px}.stock-alert-row small{font-size:10px}
  .expenses-page{gap:18px}.expenses-hero{min-height:150px;padding:26px 32px}.expenses-hero__copy>span{font-size:10px}.expenses-hero p{font-size:14px}
  .expenses-kpis{gap:14px}.expenses-metric{min-height:110px;padding:18px}.expenses-metric__label,.expenses-metric__meta{font-size:12px}.expenses-metric__value{font-size:clamp(20px,1.5vw,29px)}
  .expenses-filters{gap:12px;padding:14px}.expenses-search input{font-size:13px}.expenses-date input{font-size:12px;min-height:44px}.expenses-filters select.input{font-size:12px;min-height:43px}.expenses-branch-tabs .btn{font-size:12px;min-height:40px}
  .expenses-insights{gap:16px}.expenses-chart{min-height:240px;padding:18px}.expenses-section-heading h2,.expenses-table-heading h2{font-size:15px}.expenses-section-heading p,.expenses-table-heading p{font-size:11px}.expenses-bar-chart{height:155px}.expenses-ledger-layout{gap:16px;grid-template-columns:minmax(0,1fr) minmax(320px,.34fr)}.expenses-table th{font-size:11px;padding:12px}.expenses-table td{font-size:12px;padding:12px}.expenses-category-pill,.expenses-branch-pill{font-size:10px}
  .dashboard-hero{gap:32px!important;min-height:176px!important;padding:30px 38px!important}.dashboard-hero__copy h2{font-size:clamp(32px,2.2vw,42px)}.dashboard-hero__copy p{font-size:22px}.dashboard-hero__status strong{font-size:17px}.dashboard-hero__status small{font-size:11px}.dashboard-widgets{gap:16px}.dashboard-widget h3{font-size:16px}.dashboard-onwork__person strong{font-size:13px}.dashboard-onwork__person small{font-size:11px}
}
@media(max-width:900px){.app-main{padding:20px 18px 40px!important}}
`

const kitchenMascotCss = `
/* SABINAGISA Kitchen Mini — state-led mascot panel */
.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger{align-items:center!important;background:radial-gradient(circle at 50% 45%,rgba(255,164,82,.2),rgba(109,39,23,.12) 56%,transparent 72%)!important;border:1px solid rgba(238,116,70,.56)!important;border-radius:50%!important;box-shadow:0 8px 26px rgba(0,0,0,.36),0 0 22px rgba(226,74,41,.14)!important;color:#fff7ef!important;display:flex!important;height:92px!important;justify-content:center!important;min-height:92px!important;overflow:visible!important;padding:2px!important;transition:transform .2s ease,box-shadow .2s ease!important;width:92px!important}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger:hover{box-shadow:0 10px 30px rgba(0,0,0,.42),0 0 28px rgba(226,74,41,.24)!important;transform:translateY(-2px) scale(1.04)}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger:focus-visible{outline:2px solid #ffc17e;outline-offset:4px}
.sabinagisa-pos-inbox__trigger-brand{align-items:center;display:inline-flex;gap:9px;white-space:nowrap}.sabinagisa-pos-inbox__trigger-brand>span{display:none}.sabinagisa-pos-inbox__avatar{height:86px;object-fit:contain;width:86px;filter:drop-shadow(0 4px 10px rgba(255,145,65,.3))}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger b{align-items:center;background:#42201d!important;border:1px solid rgba(239,68,68,.4);border-radius:50%;bottom:auto;box-shadow:none!important;color:#ffd9cb!important;display:flex;height:25px!important;justify-content:center;min-width:25px!important;padding:0 4px!important;position:absolute;right:-4px;top:-4px}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger b.has-orders{animation:kitchen-count-pulse 2.8s ease-in-out infinite;background:#e52d24!important;border-color:#ff6650;box-shadow:0 0 12px rgba(239,68,68,.22)!important;color:white!important}
.sabinagisa-pos-inbox .sabinagisa-pos-inbox__drawer{background:radial-gradient(ellipse at 50% 44%,rgba(239,105,48,.12),transparent 42%),linear-gradient(155deg,rgba(29,27,26,.97),rgba(13,15,17,.98))!important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(224,68,43,.78)!important;border-radius:24px!important;box-shadow:0 28px 86px rgba(0,0,0,.56),0 0 34px rgba(240,126,52,.09)!important;color:#fff6ec!important;max-height:calc(100dvh - 150px)!important;padding:24px!important;width:min(760px,calc(100vw - 32px))!important}
.sabinagisa-pos-inbox__drawer>header{border-color:rgba(255,239,221,.16)!important;margin:0 0 14px!important;padding:0 0 15px!important}.sabinagisa-pos-inbox__drawer>header span{color:#f08b60!important;font-size:10px!important;letter-spacing:.18em!important}.sabinagisa-pos-inbox__drawer>header h2{color:#fff8f2!important;font-size:clamp(23px,2.1vw,30px)!important;letter-spacing:-.025em;margin:3px 0 0}.sabinagisa-pos-inbox__drawer>header button{align-items:center;background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.15)!important;border-radius:50%;display:flex;height:38px;justify-content:center;width:38px}
.sabinagisa-pos-inbox__state-banner,.sabinagisa-pos-inbox__empty-state{align-items:center;background:radial-gradient(circle at 50% 43%,rgba(255,140,60,.18),transparent 42%),radial-gradient(circle at 50% 47%,rgba(230,50,30,.12),transparent 62%),#111214;border:1px solid rgba(255,255,255,.045);border-radius:17px;display:flex;flex-direction:column;justify-content:center;min-height:330px;overflow:hidden;padding:18px 20px;position:relative;text-align:center;isolation:isolate}
.sabinagisa-pos-inbox__state-banner:before,.sabinagisa-pos-inbox__empty-state:before{background:radial-gradient(ellipse at center,transparent 48%,rgba(211,55,34,.62) 49%,rgba(211,55,34,.36) 51%,transparent 55%);border-radius:50%;content:"";height:280px;left:50%;opacity:.25;pointer-events:none;position:absolute;top:43%;transform:translate(-50%,-50%) rotate(-12deg);width:280px;z-index:-1}
.sabinagisa-pos-inbox__state-banner:after,.sabinagisa-pos-inbox__empty-state:after{background:radial-gradient(circle at 50% 100%,transparent 38%,rgba(239,210,181,.65) 39% 41%,transparent 42%) 0 0/34px 18px;content:"";inset:auto 0 0;height:62px;opacity:.06;pointer-events:none;position:absolute;z-index:-1}
.sabinagisa-pos-inbox__state-mascot{animation:kitchen-mascot-float 4.6s ease-in-out infinite;filter:drop-shadow(0 9px 20px rgba(244,125,54,.22));height:clamp(190px,24vw,240px);max-width:min(100%,360px);object-fit:contain;position:relative;width:clamp(190px,24vw,240px);z-index:1}.sabinagisa-pos-inbox__empty-state .sabinagisa-pos-inbox__state-mascot{height:240px;width:240px}.sabinagisa-pos-inbox__empty-state strong,.sabinagisa-pos-inbox__state-title{color:#fff8f2!important;font-size:clamp(21px,2.6vw,30px);line-height:1.25;margin:8px 0 0;position:relative}.sabinagisa-pos-inbox__empty-state p,.sabinagisa-pos-inbox__state-subtitle{color:#c4b9b0!important;font-size:clamp(14px,1.5vw,17px);line-height:1.5;margin:7px 0 0;position:relative}
.sabinagisa-pos-inbox__state-banner[data-kitchen-state="new"]{animation:kitchen-new-glow 3.2s ease-in-out infinite}.sabinagisa-pos-inbox__state-banner[data-kitchen-state="ready"]:before{opacity:.34}.sabinagisa-pos-inbox__list{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))!important;margin-top:14px}.sabinagisa-pos-inbox__order{background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:13px!important}.sabinagisa-pos-inbox__order-top>b{color:#fff4e9}.sabinagisa-pos-inbox__empty:not(.sabinagisa-pos-inbox__empty-state){padding:24px 5px!important}
@keyframes kitchen-mascot-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes kitchen-count-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.16)}50%{box-shadow:0 0 0 5px rgba(239,68,68,0)}}@keyframes kitchen-new-glow{0%,100%{box-shadow:inset 0 0 0 1px rgba(239,68,43,.08)}50%{box-shadow:inset 0 0 22px rgba(239,68,43,.12)}}
@media(max-width:900px){.sabinagisa-pos-inbox__state-banner,.sabinagisa-pos-inbox__empty-state{min-height:280px}.sabinagisa-pos-inbox__state-mascot{height:210px;width:210px}}
@media(max-width:650px){.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger{right:10px!important;top:78px!important}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__drawer{inset:auto 10px 10px!important;max-height:calc(100dvh - 142px)!important;padding:18px!important;position:fixed!important;width:auto!important}.sabinagisa-pos-inbox__state-banner,.sabinagisa-pos-inbox__empty-state{min-height:245px;padding:14px}.sabinagisa-pos-inbox__state-mascot,.sabinagisa-pos-inbox__empty-state .sabinagisa-pos-inbox__state-mascot{height:150px;width:150px}.sabinagisa-pos-inbox__list{grid-template-columns:1fr!important}}
@media(prefers-reduced-motion:reduce){.sabinagisa-pos-inbox__state-mascot,.sabinagisa-pos-inbox__state-banner[data-kitchen-state="new"],.sabinagisa-pos-inbox__trigger b.has-orders{animation:none!important}}
.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger,.sabinagisa-pos-inbox__avatar{-webkit-user-drag:none;-webkit-user-select:none;user-select:none}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger{cursor:grab!important;touch-action:none!important}.sabinagisa-pos-inbox .sabinagisa-pos-inbox__trigger:active{cursor:grabbing!important}.sabinagisa-pos-inbox__avatar{pointer-events:none}
.sabinagisa-pos-inbox__state-banner{column-gap:16px;display:grid;grid-template-columns:100px minmax(0,1fr);grid-template-rows:auto auto;justify-items:start;min-height:112px;padding:12px 18px;text-align:left}.sabinagisa-pos-inbox__state-banner:before{height:150px;left:58px;top:50%;width:150px}.sabinagisa-pos-inbox__state-banner .sabinagisa-pos-inbox__state-mascot{grid-column:1;grid-row:1/3;height:96px;width:96px}.sabinagisa-pos-inbox__state-banner .sabinagisa-pos-inbox__state-title{align-self:end;grid-column:2;grid-row:1;margin:0;font-size:clamp(18px,2vw,23px)}.sabinagisa-pos-inbox__state-banner .sabinagisa-pos-inbox__state-subtitle{align-self:start;grid-column:2;grid-row:2;margin:4px 0 0;font-size:clamp(12px,1.2vw,14px)}
.sabinagisa-pos-inbox__list{gap:10px;grid-template-columns:minmax(0,1fr)!important;margin-top:12px}.sabinagisa-pos-inbox__order{align-items:start;column-gap:16px;display:grid;grid-template-areas:"top primary" "meta primary" "items secondary";grid-template-columns:minmax(0,1fr) minmax(180px,210px);padding:13px 15px;row-gap:4px}.sabinagisa-pos-inbox__order-top{grid-area:top}.sabinagisa-pos-inbox__order-top>b{font-size:14px}.sabinagisa-pos-inbox__order-top>span{font-size:10px;padding:4px 9px}.sabinagisa-pos-inbox__order>small{color:#c9beb3;grid-area:meta;font-size:11px}.sabinagisa-pos-inbox__items{grid-area:items;line-height:1.55;margin:3px 0 0}.sabinagisa-pos-inbox__item{font-size:14px;line-height:1.5}.sabinagisa-pos-inbox__item small{font-size:11px}.sabinagisa-pos-inbox__item>b{color:#ffc17e;font-weight:750}.sabinagisa-pos-inbox__action{align-self:stretch;display:flex;grid-area:primary;align-items:center;justify-content:center;font-size:13px;min-height:42px}.sabinagisa-pos-inbox__actions{grid-area:secondary;gap:6px;margin:0}.sabinagisa-pos-inbox__actions button{font-size:10px;min-height:32px;padding:6px 4px}
@media(max-width:650px){.sabinagisa-pos-inbox__state-banner{column-gap:10px;grid-template-columns:76px minmax(0,1fr);min-height:92px;padding:10px 12px}.sabinagisa-pos-inbox__state-banner .sabinagisa-pos-inbox__state-mascot{height:74px;width:74px}.sabinagisa-pos-inbox__state-banner:before{height:118px;left:44px;width:118px}.sabinagisa-pos-inbox__order{grid-template-areas:"top" "meta" "items" "primary" "secondary";grid-template-columns:minmax(0,1fr);padding:12px;row-gap:5px}.sabinagisa-pos-inbox__order-top>b{font-size:13px}.sabinagisa-pos-inbox__item{font-size:13px}.sabinagisa-pos-inbox__action{min-height:40px}.sabinagisa-pos-inbox__actions{margin-top:2px}}
`

const homeDashboardThemeCss = `
/* Keep the Home dashboard in the shared dark palette when dark mode is selected. */
html[data-theme="dark"] body:has(.home-dashboard),html[data-theme="dark"] #root:has(.home-dashboard),html[data-theme="dark"] .app-shell:has(.home-dashboard){background:#111315!important;color:#f2eee7!important}
html[data-theme="dark"] .app-main:has(.home-dashboard){background:radial-gradient(ellipse at 80% 0,rgba(196,30,42,.08),transparent 42%),#111315!important;color:#f2eee7!important}
html[data-theme="dark"] .app-main:has(.home-dashboard) .app-header{background:linear-gradient(110deg,#23201f,#1c1d1e)!important;border:1px solid rgba(242,238,231,.12)!important;border-radius:14px!important;box-shadow:0 10px 28px #0004!important;margin:0 0 18px!important;padding:18px 22px!important}
html[data-theme="dark"] .app-main:has(.home-dashboard) .app-title,html[data-theme="dark"] .app-main:has(.home-dashboard) .font-display,html[data-theme="dark"] .app-main:has(.home-dashboard) .app-clock{color:#f2eee7!important}
html[data-theme="dark"] .app-main:has(.home-dashboard) .app-subtitle{color:#c0a28d!important}
html[data-theme="dark"] .home-dashboard{--bone:#f2eee7;--ghost-gray:#aaa39b;--blood:#e9572d;--line:rgba(242,238,231,.13);color:#f2eee7!important}
html[data-theme="dark"] .home-dashboard .panel,html[data-theme="dark"] .home-dashboard>.panel:first-of-type,html[data-theme="dark"] .home-dashboard>.panel:last-child{background:linear-gradient(145deg,#292b2e,#202224)!important;border-color:rgba(242,238,231,.13)!important;box-shadow:0 10px 28px #0004!important;color:#f2eee7!important}
html[data-theme="dark"] .home-dashboard .panel strong,html[data-theme="dark"] .home-dashboard .panel h1,html[data-theme="dark"] .home-dashboard .panel h2,html[data-theme="dark"] .home-dashboard .panel h3,html[data-theme="dark"] .home-dashboard .panel p,html[data-theme="dark"] .home-dashboard .panel small,html[data-theme="dark"] .home-dashboard .panel .font-mono,html[data-theme="dark"] .home-dashboard [style*="var(--bone)"],html[data-theme="dark"] .home-dashboard [style*="var(--ghost-gray)"]{color:#f2eee7!important}
html[data-theme="dark"] .home-dashboard>div[style*="flexWrap"]{background:#202224!important;border-color:rgba(242,238,231,.13)!important}
html[data-theme="dark"] .home-dashboard .btn:not(.btn-primary),html[data-theme="dark"] .home-dashboard .input{background:#292b2e!important;border-color:#48494a!important;color:#f2eee7!important}
html[data-theme="dark"] .home-dashboard .btn-primary{background:linear-gradient(135deg,#e9572d,#c43c20)!important;border-color:#e9572d!important;color:#fff!important}
html[data-theme="dark"] .home-dashboard>.panel:last-child>div:not(.font-display){border-bottom-color:rgba(242,238,231,.12)!important}
html[data-theme="dark"] .home-dashboard>.panel:last-child>div:not(.font-display):hover{background:#303133!important}
html[data-theme="dark"] .home-onwork{background:linear-gradient(145deg,#292b2e,#202224)!important;border-color:rgba(242,238,231,.13)!important;color:#f2eee7!important}
html[data-theme="dark"] .home-onwork__person strong{color:#f2eee7!important}
html[data-theme="dark"] .home-onwork__person small,html[data-theme="dark"] .home-onwork__empty{color:#aaa39b!important}
.dashboard-onwork__avatar{overflow:hidden;position:relative}.dashboard-onwork__avatar img{height:100%;object-fit:cover;width:100%}
`
let liveDashboardWidgets = `function DashboardWidgets({bills,staff,garageTotal,chillTotal,periodLabel,onViewStaff}){const total=garageTotal+chillTotal,garagePct=total?Math.round(garageTotal/total*100):0,peakRows=bills.filter(b=>{const h=new Date(b.created_at).getHours();return h>=18||h<6}),peakTotal=peakRows.reduce((sum,b)=>sum+Number(b.total||0),0),hourly=Array.from({length:24},(_,hour)=>({hour,total:bills.filter(b=>new Date(b.created_at).getHours()===hour).reduce((sum,b)=>sum+Number(b.total||0),0)})),maxHour=Math.max(1,...hourly.map(item=>item.total));return e.jsxs("div",{className:"dashboard-widgets",children:[e.jsxs("section",{className:"panel dashboard-widget",children:[e.jsxs("div",{className:"dashboard-widget__title",children:[e.jsx("i",{}),e.jsx("h3",{children:"พนักงานที่ On Work อยู่ตอนนี้"}),e.jsxs("small",{children:[staff.length," คน"]}),e.jsx("button",{type:"button",className:"btn",onClick:onViewStaff,children:"ดูทั้งหมด →"})]}),staff.length?e.jsx("div",{className:"dashboard-onwork__people",children:staff.slice(0,8).map(member=>e.jsxs("div",{className:"dashboard-onwork__person",children:[e.jsx("span",{className:"dashboard-onwork__avatar",children:(member.name_en||"GL").slice(0,2).toUpperCase()}),e.jsx("strong",{children:member.name_en}),e.jsx("small",{children:member.branch_name||"Ghost Group"}),e.jsx("em",{})]},member.branch_id+member.id))}):e.jsx("div",{className:"dashboard-widget__empty",children:"ยังไม่มีพนักงานเข้างานในตอนนี้"})]}),e.jsxs("section",{className:"panel dashboard-widget dashboard-composition",children:[e.jsxs("div",{className:"dashboard-widget__title",style:{gridColumn:"1/-1",marginBottom:0},children:[e.jsx("i",{}),e.jsx("h3",{children:"สัดส่วนยอดขายตามสาขา"}),e.jsx("small",{children:periodLabel})]}),e.jsx("div",{className:"dashboard-donut",style:{"--garage-pct":garagePct+"%"},children:e.jsxs("div",{className:"dashboard-donut__center",children:[e.jsxs("strong",{children:["¥",total.toLocaleString()]}),e.jsx("span",{children:"ยอดรวม"})]})}),e.jsxs("div",{className:"dashboard-legend",children:[e.jsxs("div",{className:"dashboard-legend__row",children:[e.jsx("i",{className:"dashboard-legend__dot",style:{background:"#e9572d"}}),e.jsx("span",{children:"Ghost Lab Garage"}),e.jsxs("strong",{children:[garagePct,"%"]})]}),e.jsxs("div",{className:"dashboard-legend__row",children:[e.jsx("i",{className:"dashboard-legend__dot",style:{background:"#e9ad53"}}),e.jsx("span",{children:"SABINAGISA"}),e.jsxs("strong",{children:[100-garagePct,"%"]})]})]})]}),e.jsxs("section",{className:"panel dashboard-widget dashboard-hourly",children:[e.jsxs("div",{className:"dashboard-widget__title",children:[e.jsx("i",{}),e.jsx("h3",{children:"ยอดขายรายชั่วโมง"}),e.jsx("small",{children:periodLabel})]}),e.jsx("div",{className:"dashboard-hourly__chart",children:hourly.map(item=>e.jsxs("div",{className:"dashboard-hourly__bar"+(item.hour>=18||item.hour<6?" is-peak":""),style:{height:Math.max(3,item.total/maxHour*100)+"%"},title:String(item.hour).padStart(2,"0")+":00 · ¥"+item.total.toLocaleString(),children:[item.hour%3===0&&e.jsx("label",{children:String(item.hour).padStart(2,"0")})]},item.hour))}),e.jsx("div",{className:"dashboard-hourly__meta",children:"ยอดรวมตามเวลาเปิดบิล · สีเข้มคือช่วง Peak 18:00–05:59"})]}),e.jsxs("section",{className:"panel dashboard-widget dashboard-live",children:[e.jsxs("div",{className:"dashboard-widget__title",children:[e.jsx("i",{}),e.jsx("h3",{children:"LIVE INSIGHT"}),e.jsx("small",{children:"คำนวณจากข้อมูลช่วงที่เลือก"})]}),e.jsxs("div",{className:"dashboard-live__body",children:[e.jsxs("div",{className:"dashboard-live__peak",children:["ช่วง Peak 18:00–05:59 · ",e.jsx("strong",{children:"¥"+peakTotal.toLocaleString()})," · ",peakRows.length," บิล"]}),e.jsxs("div",{className:"dashboard-live__text",children:["แสดงยอดจาก ",bills.length," บิล · พนักงานกำลังทำงาน ",staff.length," คน · ทุกยอดอัปเดตตามตัวกรองสาขาและวันที่"]})]})]})]})}`
liveDashboardWidgets = liveDashboardWidgets.replace('children:(member.name_en||"GL").slice(0,2).toUpperCase()', 'children:member.avatar_url?e.jsx("img",{src:member.avatar_url,alt:"",loading:"lazy",onError:event=>{event.currentTarget.hidden=!0}}):(member.name_en||"GL").slice(0,2).toUpperCase()')
liveDashboardWidgets = liveDashboardWidgets.replace(',e.jsxs("div",{className:"dashboard-live__text",children:["แสดงยอดจาก ",bills.length," บิล · พนักงานกำลังทำงาน ",staff.length," คน · ทุกยอดอัปเดตตามตัวกรองสาขาและวันที่"]})', '')
liveDashboardWidgets = 'const dashboardHourFormatter=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Bangkok",hour:"2-digit",hourCycle:"h23"});function dashboardBangkokHour(value){return Number(dashboardHourFormatter.format(new Date(value)))}async function fetchDashboardRows(query){const rows=[];for(let from=0;;from+=500){const{data,error}=await query.range(from,from+499);if(error)throw error;if(!data||!data.length)return rows;rows.push(...data);if(data.length<500)return rows}}' + liveDashboardWidgets.replaceAll('new Date(b.created_at).getHours()', 'dashboardBangkokHour(b.created_at)')
const versionedRoot = path.join(outputRoot, 'assets', release)
await cp(path.join(sourceRoot, 'assets'), versionedRoot, { recursive: true })
await cp(path.join(projectRoot, 'src', 'assets', 'dashboard-sabinagisa-v1.png'), path.join(versionedRoot, 'dashboard-sabinagisa-v1.png'))
await cp(garageArtwork, path.join(versionedRoot, 'dashboard-garage-v1.png'))
await cp(kitchenAssetRoot, path.join(versionedRoot, 'sabinagisa'), { recursive: true })
await cp(loginArtwork, path.join(versionedRoot, 'login-courtyard-v1.png'))
await cp(commissionPoolHelper, path.join(versionedRoot, 'commission-pool.js'))
for (const file of (await listFiles(versionedRoot)).filter(file => /\.(js|css)$/.test(file))) {
  let content = await readFile(file, 'utf8')
  if (file.endsWith('index-C51IvSgf.css')) {
    content += premiumHospitalityCss + sharedThemeCss + await readFile(path.join(projectRoot, 'src', 'pages', 'Expenses.css'), 'utf8') + await readFile(path.join(projectRoot, 'src', 'pages', 'Stock.css'), 'utf8') + await readFile(path.join(projectRoot, 'src', 'pages', 'DailySummary.css'), 'utf8') + await readFile(path.join(projectRoot, 'src', 'pages', 'CommissionPayouts.css'), 'utf8') + fullWidthWorkspaceCss + kitchenMascotCss + await readFile(loginStylesheet, 'utf8') + loginHeroSeamlessCss + homeDashboardThemeCss
    content = content.replace(/\.sabinagisa-pos-inbox__chef-art\{[^}]*\}/g, '.sabinagisa-pos-inbox__chef-art{display:none!important;background-image:none!important}')
  }
  if (file.endsWith('.js')) {
    content = content
      .replaceAll('Ghost Chill Kitchen', 'SABINAGISA Kitchen')
      .replaceAll('GHOST CHILL', 'SABINAGISA')
      .replaceAll('Ghost Chill', 'SABINAGISA')
      .replaceAll('__SUPABASE_URL__', supabaseBrowserConfig.url)
      .replaceAll('__SUPABASE_ANON_KEY__', supabaseBrowserConfig.anonKey)

    if (file.endsWith('index-vaWnYKxf.js')) {
      const oldPublicStaffDirectory = 'Ne.from("staff").select("id, name_en, phone, avatar_url, role, primary_branch, branches:primary_branch(key, name)").eq("active",!0).order("name_en")'
      const safeLoginDirectory = 'Ne.from("login_profiles").select("id, name_en, name_th, role, primary_branch, branches, avatar_url").order("name_en")'
      if (!content.includes('from("login_profiles")')) {
        if (!content.includes(oldPublicStaffDirectory)) throw new Error('Recovered public login directory changed; refusing to expose staff records to anon.')
        content = content.replace(oldPublicStaffDirectory, safeLoginDirectory)
      }
      content = content.replace('ค้นหาชื่อ IC หรือเบอร์ IC...', 'ค้นหาชื่อพนักงาน...')
      if (!content.includes('from("login_profiles")') || !content.includes('avatar_url").order("name_en")') || content.includes('from("staff").select("id, name_en, phone, avatar_url, role, primary_branch')) throw new Error('Safe login directory with staff avatars is missing from production bundle.')
    }

    if (file.endsWith('Home-a48wstN-.js')) {
      const oldHomeAttendance = 'async function R(){if(!(n!=null&&n.id)||j)return;if(!d&&!n.primary_branch)return alert("ยังไม่ได้กำหนดสาขาหลักให้พนักงานคนนี้");_(!0);const{data:t,error:a}=d?await u.from("attendance").update({clock_out:new Date().toISOString()}).eq("id",d.id):await u.from("attendance").insert({staff_id:n.id,branch_id:n.primary_branch}).select().single();if(a){console.error(a),alert(`บันทึกเวลาไม่สำเร็จ: ${a.message}`),_(!1);return}d?(S(null),f(l=>Math.max(0,l-1))):(S(t),f(l=>l+1)),_(!1)}'
      const atomicHomeAttendance = 'async function R(){if(!(n!=null&&n.id)||j)return;if(!d&&!n.primary_branch)return alert("ยังไม่ได้กำหนดสาขาหลักให้พนักงานคนนี้");_(!0);const{data:t,error:a}=await u.rpc("clock_staff_attendance",{p_action:d?"clock_out":"clock_in"});if(a){console.error(a),alert(`บันทึกเวลาไม่สำเร็จ: ${a.message}`),_(!1);return}d?(S(null),f(l=>Math.max(0,l-1))):(S(t),f(l=>l+1)),_(!1)}'
      if (!content.includes('clock_staff_attendance')) {
        if (!content.includes(oldHomeAttendance)) throw new Error('Recovered Home attendance handler changed; refusing to leave non-atomic clock writes.')
        content = content.replace(oldHomeAttendance, atomicHomeAttendance)
      }
    }
    if (file.endsWith('Attendance-BQxNR9ze.js')) {
      const oldAttendanceClockIn = 'async function B(){await c.from("attendance").insert({staff_id:n.id,branch_id:n.primary_branch}),p()}'
      const atomicAttendanceClockIn = 'async function B(){const{error:s}=await c.rpc("clock_staff_attendance",{p_action:"clock_in"});if(s)return m(s.message);p()}'
      if (!content.includes('clock_staff_attendance')) {
        if (!content.includes(oldAttendanceClockIn)) throw new Error('Recovered Attendance clock-in handler changed; refusing to leave non-atomic clock writes.')
        content = content.replace(oldAttendanceClockIn, atomicAttendanceClockIn)
      }
      content = content.replace('e.jsx("div",{onClick:l?()=>f(!0):B,className:"btn btn-primary",children:l?"⏱ ปิดกะ & Clock Out":"⏱ Clock In"})', 'e.jsx("button",{type:"button",onClick:l?()=>f(!0):B,className:"btn btn-primary",children:l?"⏱ ปิดกะ & Clock Out":"⏱ Clock In"})')
      content = content.replace(']}),l&&e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}', ']}),["head_mechanic","mechanic","mechanic_trainee"].includes(n?.role)&&e.jsxs("div",{className:"panel",role:"status",style:{marginBottom:16,color:"var(--ghost-gray)",fontSize:12},children:["Ghost Lab Garage · NORMAL — ¥10,000 · PEAK — ¥15,000 · Peak Time 18:00–00:00",l?.garage_commission_period&&e.jsx("strong",{style:{color:"var(--bone)",marginLeft:10},children:(l.garage_commission_period==="peak"?"Peak":"Normal")+" · ¥"+Number(l.garage_commission_amount||0).toLocaleString()})]}),l&&e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}')
      content = content.replace('children:["เข้า"," ",new Date(s.clock_in).toLocaleTimeString("th-TH",{hour12:!1})]', 'children:["เข้า"," ",new Date(s.clock_in).toLocaleTimeString("th-TH",{hour12:!1}),s.garage_commission_period&&` · ${s.garage_commission_period==="peak"?"Peak":"Normal"} ¥${Number(s.garage_commission_amount||0).toLocaleString()}`]')
    }
    if (file.endsWith('Profile-Crf9iFsU.js')) {
      const oldProfileClock = 'async function E(){await i.from("attendance").insert({staff_id:a.id,branch_id:a.primary_branch}),m()}async function A(){o&&(await i.from("attendance").update({clock_out:new Date().toISOString()}).eq("id",o.id),m())}'
      const atomicProfileClock = 'async function E(){const{error:s}=await i.rpc("clock_staff_attendance",{p_action:"clock_in"});if(s)return alert(`ลงเวลาไม่สำเร็จ: ${s.message}`);m()}async function A(){if(!o)return;const{error:s}=await i.rpc("clock_staff_attendance",{p_action:"clock_out"});if(s)return alert(`ลงเวลาไม่สำเร็จ: ${s.message}`);m()}'
      if (!content.includes('clock_staff_attendance')) {
        if (!content.includes(oldProfileClock)) throw new Error('Recovered Profile clock handler changed; refusing to leave non-atomic clock writes.')
        content = content.replace(oldProfileClock, atomicProfileClock)
      }
      content = content.replace('e.jsx("div",{onClick:o?A:E,className:"btn btn-primary",children:o?"⏱ Clock Out":"⏱ Clock In"})', 'e.jsx("button",{type:"button",onClick:o?A:E,className:"btn btn-primary",children:o?"⏱ Clock Out":"⏱ Clock In"})')
    }

    if (file.endsWith('Home-a48wstN-.js')) {
      const cappedHomeQuery = '.order("created_at",{ascending:!1}).limit(1e3)'
      const cappedHomeLoad = 'l.then(({data:y,error:w})=>{w||g(y||[])})'
      if (!content.includes(cappedHomeQuery) || !content.includes(cappedHomeLoad)) throw new Error('Recovered Home bill query changed; refusing to ship a silently capped dashboard.')
      content = content
        .replace(cappedHomeQuery, '.order("created_at",{ascending:!1}).order("id",{ascending:!0})')
        .replace(cappedHomeLoad, 'fetchDashboardRows(l).then(y=>g(y.filter(t=>t.status!=="rejected"&&t.status!=="cancelled"))).catch(w=>console.error("[Ghost Lab] Dashboard bills failed to load:",w))')
      const moduleEnd = content.indexOf(';')
      if (moduleEnd < 0) throw new Error('Recovered Home module imports changed unexpectedly.')
      content = content.slice(0, moduleEnd + 1) + liveDashboardWidgets + content.slice(moduleEnd + 1)

      const recentOrdersMarker = 'e.jsxs("div",{className:"panel",children:[e.jsxs("div",{className:"font-display",style:{fontSize:14,fontWeight:600,marginBottom:14},children:["ออเดอร์ล่าสุด · ",h]})'
      if (!content.includes(recentOrdersMarker)) throw new Error('Recovered recent-orders panel changed; refusing to omit live dashboard widgets.')
      content = content.replace(recentOrdersMarker, 'e.jsx(DashboardWidgets,{bills:x,staff:onShiftStaff,garageTotal:x.filter(t=>t.branches?.key==="garage").reduce((sum,t)=>sum+t.total,0),chillTotal:x.filter(t=>t.branches?.key==="chill").reduce((sum,t)=>sum+t.total,0),periodLabel:h,onViewStaff:()=>setShowOnShiftStaff(!0)}),'+recentOrdersMarker)

      const oldOwnerMetrics = 'c?e.jsxs(e.Fragment,{children:[e.jsx(p,{label:`ยอด${h} · GARAGE`,value:`¥${T.toLocaleString()}`,meta:`${N.length} บิล`,dim:b==="chill"}),e.jsx(p,{label:`ยอด${h} · SABINAGISA`,value:`¥${D.toLocaleString()}`,meta:`${L.length} บิล`,dim:b==="garage"})]}):e.jsx(p,{label:`ยอด${h} · ${B.label}`,value:`¥${x.reduce((t,a)=>t+a.total,0).toLocaleString()}`,meta:`${x.length} บิล`}),e.jsx(p,{label:`COMMISSION ${h}`,value:`¥${M.toLocaleString()}`,accent:!0}),e.jsx(p,{label:"พนักงานเข้างาน",value:`${o} คน`})'
      const newOwnerMetrics = 'e.jsx(p,{label:`ยอดขาย${h}`,value:`¥${x.reduce((t,a)=>t+a.total,0).toLocaleString()}`,meta:`${x.length} บิล`}),e.jsx(p,{label:"จำนวนบิลทั้งหมด",value:x.length.toLocaleString(),meta:"บิลในช่วงที่เลือก"}),e.jsx(p,{label:"ค่าเฉลี่ยต่อบิล",value:`¥${Math.round(x.reduce((t,a)=>t+a.total,0)/(x.length||1)).toLocaleString()}`,meta:x.length?`${x.length} บิล`:"ไม่มีบิล"}),e.jsx(p,{label:c?`ค่าคอมมิชชัน · ${h}`:`ค่าคอมของฉัน · ${h}`,value:`¥${(c?M:personalCommission).toLocaleString()}`,meta:c?void 0:`${personalCommissionBills} บิล`,accent:!0})'
      if (!content.includes(oldOwnerMetrics)) throw new Error('Recovered Dashboard metric cards changed; refusing to omit the requested four-card summary.')
      content = content.replace(oldOwnerMetrics, newOwnerMetrics)
      content = content.replace('gridTemplateColumns:`repeat(${c?4:3}, 1fr)`', 'gridTemplateColumns:"repeat(4, 1fr)"')

      // Rebuild the greeting strip as the branded operations hero from the
      // reference while keeping the real clock-in/out control available.
      const oldHeroIntro = 'e.jsxs("div",{children:[e.jsx("div",{className:"font-display",style:{fontSize:11,letterSpacing:2,color:"var(--blood)",textTransform:"uppercase",marginBottom:8},children:c?"GHOST GROUP · OWNER OVERVIEW":B.eyebrow}),e.jsxs("div",{className:"font-display",style:{fontSize:24,fontWeight:600},children:["สวัสดี, ",n==null?void 0:n.name_en," 👋"]})]})'
      const newHeroIntro = 'e.jsxs("div",{className:"dashboard-hero__copy",children:[e.jsx("span",{className:"dashboard-hero__eyebrow",children:"GHOST GROUP · TWO SOULS, ONE GARAGE"}),e.jsx("h2",{children:"技 · 味 · 心"}),e.jsx("p",{children:"งานช่าง · รสชาติ · การบริการ"}),e.jsx("small",{children:"GHOST LAB × SABINAGISA"})]})'
      const oldHeroStatus = 'e.jsxs("div",{style:{alignItems:"flex-end",display:"flex",flexDirection:"column",gap:8},children:[e.jsx("span",{style:{color:d?"#7ee2a5":"var(--ghost-gray)",fontSize:11,fontWeight:600,letterSpacing:.7},children:d?"● ออนไลน์ · เข้างานแล้ว":"○ ออฟไลน์ · ยังไม่เข้างาน"}),e.jsx("button",{type:"button",onClick:R,className:d?"btn":"btn btn-primary",style:{borderColor:d?"rgba(255,255,255,.22)":void 0,fontSize:12,minWidth:125,opacity:j?.6:1},children:j?"กำลังบันทึก...":d?"◼ เลิกงาน":"● เข้างาน"})]})'
      const newHeroStatus = 'e.jsxs("div",{className:"dashboard-hero__status",children:[e.jsxs("div",{children:[e.jsx("strong",{children:d?"On Work":"Ready"}),e.jsx("small",{children:d?"กำลังปฏิบัติงาน":"ยังไม่ได้เข้างาน"})]}),e.jsxs("div",{children:[e.jsx("strong",{children:onShiftStaff.length}),e.jsx("small",{children:"Staff On Work"})]}),e.jsxs("div",{children:[e.jsx("strong",{children:"PEAK"}),e.jsx("small",{children:"18:00–05:59"})]}),e.jsx("button",{type:"button",onClick:R,className:d?"btn":"btn btn-primary",style:{borderColor:d?"rgba(255,255,255,.22)":void 0,fontSize:12,minWidth:125,opacity:j?.6:1},children:j?"กำลังบันทึก...":d?"◼ เลิกงาน":"● เข้างาน"})]})'
      if (!content.includes(oldHeroIntro) || !content.includes(oldHeroStatus)) throw new Error('Recovered Dashboard hero changed; refusing to omit the branded hero update.')
      content = content.replace(oldHeroIntro, newHeroIntro).replace(oldHeroStatus, newHeroStatus)
      content = content.replace('className:"panel",style:{background:"linear-gradient(120deg, rgba(196,30,42,0.14), transparent 60%), var(--static)"', 'className:"panel dashboard-hero",style:{background:"linear-gradient(120deg, rgba(196,30,42,0.14), transparent 60%), var(--static)"')
    }

    // The recovered bundle predates the source AuthContext hardening. Apply
    // the same retry/cache behavior to the deployed bundle so transient RLS or
    // network failures cannot make a valid staff account look deleted.
    const oldStaffLoader = 'async function a(f){const{data:v,error:y}=await Ne.from("staff").select("*, branches:primary_branch(*)").eq("auth_user_id",f).single();y&&console.error("[Ghost Lab] Failed to load staff row:",y),s(v||null),o(!1)}'
    const newStaffLoader = 'async function a(f){let v=null,y=null;for(let g=0;g<3;g++){({data:v,error:y}=await Ne.from("current_staff_profile").select("*").eq("auth_user_id",f).maybeSingle());if(!y)break;await new Promise(q=>setTimeout(q,250*(g+1)))}if(v){try{await Ne.rpc("auto_clock_out_current_staff",{p_source:"stale_timeout",p_max_age_hours:2})}catch{}clearInterval(window.__ghostAttendanceHeartbeat);const beat=()=>Ne.rpc("heartbeat_current_staff_attendance").then(({error})=>error&&console.warn("[Ghost Lab] Attendance heartbeat failed:",error));beat();window.__ghostAttendanceHeartbeat=setInterval(beat,30000);s(v);try{sessionStorage.setItem("ghostlab-staff-session",JSON.stringify(v))}catch{}}else if(y){console.error("[Ghost Lab] Failed to load staff row:",y);try{const g=JSON.parse(sessionStorage.getItem("ghostlab-staff-session")||"null");g?.auth_user_id===f&&s(g)}catch{}}else s(null);o(!1)}'
    if (file.endsWith('index-vaWnYKxf.js') && !content.includes(oldStaffLoader)) {
      throw new Error('Recovered auth loader changed unexpectedly; refusing to build without account-stability patch.')
    }
    content = content.replace(oldStaffLoader, newStaffLoader)

    if (file.endsWith('AdminStaff-BC-d2vNl.js')) {
      const oldAdminDirectory = 'd.from("staff").select("*").eq("active",!0).order("name_en")'
      const safeAdminDirectory = 'd.from("staff_admin_directory").select("id,name_en,name_th,role,primary_branch,active,phone,permissions").order("name_en")'
      if (!content.includes(safeAdminDirectory)) {
        if (!content.includes(oldAdminDirectory)) throw new Error('Recovered staff-admin directory changed; refusing to query private staff rows directly.')
        content = content.replace(oldAdminDirectory, safeAdminDirectory)
      }
      if (content.includes('from("staff").select("*")')) throw new Error('Staff-admin bundle still reads every staff column directly.')
    }

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
    const newLogout = 'async function u(){clearInterval(window.__ghostAttendanceHeartbeat);try{await Ne.rpc("auto_clock_out_current_staff",{p_source:"logout",p_max_age_hours:2})}catch{}await Ne.auth.signOut()}'
    if (file.endsWith('index-vaWnYKxf.js')) {
      content = content.replace(oldLogout, newLogout)

      // Keep every real destination and existing role filter, but organize the
      // current navigation around the actual teams and shared operations.
      const oldSidebarGroups = 'n=[{key:"operations",label:"งานหน้าร้าน",items:["home","garage","chill","chill-kitchen"]},{key:"management",label:"การเงินและจัดการ",items:["members","stock","expenses","daily-summary","commissions"]},{key:"personal",label:"บัญชีของฉัน",items:["attendance","profile"]},{key:"system",label:"ตั้งค่าระบบ",items:["admin-staff","audit-log"]}]'
      const newSidebarGroups = 'n=[{key:"overview",label:"ภาพรวม",items:["home"]},{key:"garage-team",label:"GHOST LAB GARAGE · ทีมช่าง",items:["garage"]},{key:"sabinagisa-team",label:"SABINAGISA · ทีมร้าน",items:["chill","chill-kitchen"]},{key:"shared-operations",label:"ระบบกลาง · ใช้ร่วมกัน",items:["members","stock","expenses","daily-summary","commissions"]},{key:"personal",label:"บัญชีของฉัน",items:["attendance","profile"]},{key:"system",label:"การจัดการ",items:["admin-staff","audit-log"]}]'
      if (!content.includes(oldSidebarGroups)) {
        throw new Error('Recovered sidebar navigation changed unexpectedly; refusing to build an incomplete team redesign.')
      }
      content = content.replace(oldSidebarGroups, newSidebarGroups)

      // The navigation is a drawer so the work surface keeps its full width.
      // Preserve the existing route/role filtering and close the drawer after
      // a user picks a destination or taps the scrim.
      const oldSidebarStart = 'function c_(){var u;const{staff:t,logout:e}=ou(),{pathname:r}=br(),n=['
      const newSidebarStart = 'function c_(){var u;const[drawerOpen,setDrawerOpen]=k.useState(false),{staff:t,logout:e}=ou(),{pathname:r}=br(),n=['
      if (!content.includes(oldSidebarStart)) throw new Error('Recovered sidebar component changed; refusing to omit the popup drawer interaction.')
      content = content.replace(oldSidebarStart, newSidebarStart)
      const oldSidebarEffect = 'if(k.useEffect(()=>o(s),[s]),!t)return null;const a=au(t)'
      const newSidebarEffect = 'if(k.useEffect(()=>o(s),[s]),k.useEffect(()=>{const toggle=()=>setDrawerOpen(value=>!value),close=()=>setDrawerOpen(false);window.addEventListener("ghost:toggle-sidebar",toggle);window.addEventListener("ghost:close-sidebar",close);return()=>{window.removeEventListener("ghost:toggle-sidebar",toggle);window.removeEventListener("ghost:close-sidebar",close)}},[]),!t)return null;const a=au(t)'
      if (!content.includes(oldSidebarEffect)) throw new Error('Recovered sidebar hooks changed; refusing to build a nonfunctional popup drawer.')
      content = content.replace(oldSidebarEffect, newSidebarEffect)
      const oldSidebarAside = 'return w.jsxs("aside",{className:"sidebar",children:['
      const newSidebarAside = 'return w.jsxs("aside",{className:`sidebar${drawerOpen?" is-drawer-open":""}`,children:[w.jsx("button",{type:"button",className:"sidebar-scrim","aria-label":"ปิดเมนู",onClick:()=>setDrawerOpen(false)}),'
      if (!content.includes(oldSidebarAside)) throw new Error('Recovered sidebar markup changed; refusing to omit the drawer close control.')
      content = content.replace(oldSidebarAside, newSidebarAside)
      content = content.replace('className:({isActive:v})=>`sidebar-link${v?" is-active":""}`,children:f.label', 'className:({isActive:v})=>`sidebar-link${v?" is-active":""}`,onClick:()=>setDrawerOpen(false),children:f.label')

      // Replace the recovered bare page heading with a genuine hospitality
      // workspace header.  This only changes the shell markup; pages still
      // receive the exact same title, child route and data as before.
      const oldWorkspaceShell = 'function Ae({title:t,sub:e,children:r}){return w.jsxs("div",{className:"app-shell",children:[w.jsx(c_,{}),w.jsxs("main",{className:"app-main",children:[w.jsxs("header",{className:"app-header",children:[w.jsxs("div",{children:[w.jsx("h1",{className:"app-title font-display",children:t}),w.jsx("div",{className:"app-subtitle",children:e})]}),w.jsx(d_,{})]}),w.jsx("div",{className:"page-enter",children:r})]})]})}'
      const newWorkspaceShell = 'function Ae({title:t,sub:e,children:r}){const n=new Date().toLocaleDateString("th-TH",{weekday:"short",day:"numeric",month:"short",year:"numeric"});return w.jsxs("div",{className:"app-shell",children:[w.jsx(c_,{}),w.jsxs("main",{className:"app-main",children:[w.jsxs("div",{className:"workspace-topline",children:[w.jsx("span",{className:"workspace-topline__mark",children:"GHOST GROUP · PRIVATE DESK"}),w.jsx("span",{children:"TWO SOULS, ONE GARAGE"})]}),w.jsxs("header",{className:"app-header",children:[w.jsx("button",{type:"button",className:"app-header__menu-toggle","aria-label":"เปิดเมนู","title":"เมนู",onClick:()=>window.dispatchEvent(new Event("ghost:toggle-sidebar")),children:w.jsx("span",{})}),w.jsxs("div",{className:"app-header__titleblock",children:[w.jsx("div",{className:"app-header__eyebrow",children:"Operations workspace"}),w.jsx("h1",{className:"app-title font-display",children:t}),w.jsx("div",{className:"app-subtitle",children:e})]}),w.jsxs("div",{className:"app-header__utility",children:[w.jsx("span",{className:"app-header__date",children:n}),w.jsx(d_,{}),w.jsx("button",{type:"button",className:"theme-toggle",title:"สลับโหมดสว่าง/มืด","aria-label":"สลับโหมดสว่าง/มืด","data-theme-toggle":!0,children:"◐ ธีม"})]})]}),w.jsx("div",{className:"page-enter",children:r})]})]})}'
      if (!content.includes(oldWorkspaceShell)) {
        throw new Error('Recovered workspace shell changed unexpectedly; refusing to build incomplete redesign.')
      }
      content = content.replace(oldWorkspaceShell, newWorkspaceShell)
    }

    // Ordinary staff may see the number of people currently working in their
    // own branch through a security-definer aggregate, without gaining access
    // to other employees' attendance rows.
    if (file.endsWith('Home-a48wstN-.js')) {
      // Use Bangkok time so every role can see whether a newly opened bill
      // will receive the overnight Peak multiplier, regardless of device time.
      content = content.replace(
        'function J(){const{staff:n}=q(),',
        'function isCommissionPeakNow(){const t=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",hour:"2-digit",hourCycle:"h23"}).format(new Date));return t>=18||t<6}function J(){const{staff:n}=q(),',
      )
      const oldAttendanceCount = 'let m=u.from("attendance").select("id",{count:"exact",head:!0}).is("clock_out",null);!c&&(n!=null&&n.primary_branch)&&(m=m.eq("branch_id",n.primary_branch)),m.then(({count:y})=>f(y||0))'
      const newAttendanceCount = ''
      content = content.replace(oldAttendanceCount, newAttendanceCount)

      // Show a compact, branch-safe list of the people currently on shift.
      const oldHomeState = ',[d,S]=i.useState(null),[j,_]=i.useState(!1),[z,W]=i.useState([]),c=G(n)'
      const newHomeState = ',[d,S]=i.useState(null),[j,_]=i.useState(!1),[z,W]=i.useState([]),[onShiftStaff,setOnShiftStaff]=i.useState([]),[showOnShiftStaff,setShowOnShiftStaff]=i.useState(!1),[personalCommission,setPersonalCommission]=i.useState(0),[personalCommissionBills,setPersonalCommissionBills]=i.useState(0),[peakNow,setPeakNow]=i.useState(isCommissionPeakNow),c=G(n)'
      content = content.replace(oldHomeState, newHomeState)

      const oldHomeEffectBoundary = '},[s,v,c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{n!=null&&n.id&&u.from("attendance")'
      const newHomeEffectBoundary = '},[s,v,c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{const t=()=>setPeakNow(isCommissionPeakNow());t();const a=setInterval(t,3e4);return()=>clearInterval(a)},[]),i.useEffect(()=>{if(c||!n?.id){setPersonalCommission(0),setPersonalCommissionBills(0);return}const t=new Date;let a=null;if(s==="today"&&t.setHours(0,0,0,0),s==="week"&&(t.setDate(t.getDate()-6),t.setHours(0,0,0,0)),s==="month"&&(t.setDate(1),t.setHours(0,0,0,0)),s==="date"){const[y,w,P]=v.split("-").map(Number);t.setFullYear(y,w-1,P),t.setHours(0,0,0,0),a=new Date(t),a.setDate(a.getDate()+1)}let l=u.from("commission_distributions").select("amount,created_at").eq("user_id",n.id).is("reversed_at",null);s!=="all"&&(l=l.gte("created_at",t.toISOString())),a&&(l=l.lt("created_at",a.toISOString())),l.then(({data:y,error:w})=>{w?console.error("[Ghost Lab] Failed to load personal commission:",w):(setPersonalCommission((y||[]).reduce((t,a)=>t+Number(a.amount||0),0)),setPersonalCommissionBills((y||[]).length))})},[c,n==null?void 0:n.id,s,v]),i.useEffect(()=>{u.rpc("list_on_shift_staff",{p_branch_id:c?null:n?.primary_branch||null}).then(({data:t,error:a})=>{a?console.error("[Ghost Lab] Failed to load on-shift staff:",a):setOnShiftStaff(t||[])})},[c,n==null?void 0:n.primary_branch]),i.useEffect(()=>{n!=null&&n.id&&u.from("attendance")'
      content = content.replace(oldHomeEffectBoundary, newHomeEffectBoundary)
      const oldLiveStaffLoader = 'i.useEffect(()=>{u.rpc("list_on_shift_staff",{p_branch_id:c?null:n?.primary_branch||null}).then(({data:t,error:a})=>{a?console.error("[Ghost Lab] Failed to load on-shift staff:",a):setOnShiftStaff(t||[])})},[c,n==null?void 0:n.primary_branch])'
      const newLiveStaffLoader = 'i.useEffect(()=>{let active=!0;async function refresh(){const{data:t,error:a}=await u.rpc("list_on_shift_staff",{p_branch_id:c?null:n?.primary_branch||null});if(!active)return;if(a){console.error("[Ghost Lab] Failed to load on-shift staff:",a);return}const rows=t||[];setOnShiftStaff(rows),f(rows.length)}refresh();const channel=u.channel("home-attendance").on("postgres_changes",{event:"*",schema:"public",table:"attendance"},refresh).subscribe();const timer=setInterval(refresh,10000);return()=>{active=!1,clearInterval(timer),u.removeChannel(channel)}},[c,n==null?void 0:n.primary_branch])'
      content = content.replace(oldLiveStaffLoader, newLiveStaffLoader)

      content = content.replace(
        'children:[e.jsx("span",{style:{color:d?"#7ee2a5":"var(--ghost-gray)",fontSize:11,fontWeight:600,letterSpacing:.7},children:d?"● ออนไลน์ · เข้างานแล้ว":"○ ออฟไลน์ · ยังไม่เข้างาน"}),e.jsx("button",{type:"button",onClick:R',
        'children:[e.jsxs("span",{style:{background:peakNow?"rgba(53,217,230,.14)":"rgba(255,255,255,.04)",border:`1px solid ${peakNow?"rgba(53,217,230,.68)":"var(--line)"}`,borderRadius:10,color:peakNow?"#35d9e6":"var(--ghost-gray)",display:"flex",flexDirection:"column",fontSize:9,fontWeight:700,gap:3,letterSpacing:.4,padding:"5px 9px"},children:[e.jsx("span",{children:peakNow?"SABINAGISA · PEAK":"SABINAGISA · NORMAL"}),e.jsx("span",{children:"18:00–05:59"}),e.jsx("span",{style:{borderTop:"1px solid var(--line)",paddingTop:3},children:"GHOST LAB · PEAK 18:00–00:00"})]}),e.jsx("span",{style:{color:d?"#7ee2a5":"var(--ghost-gray)",fontSize:11,fontWeight:600,letterSpacing:.7},children:d?"● ออนไลน์ · เข้างานแล้ว":"○ ออฟไลน์ · ยังไม่เข้างาน"}),e.jsx("button",{type:"button",onClick:R',
      )
      const oldHomePeakTime = 'e.jsxs("div",{children:[e.jsx("strong",{children:"PEAK"}),e.jsx("small",{children:"18:00–05:59"})]})'
      const newHomePeakTime = 'e.jsxs("div",{children:[e.jsx("strong",{children:"PEAK TIME"}),e.jsx("small",{children:"SABINAGISA · 18:00–05:59"}),e.jsx("small",{children:"GHOST LAB · 18:00–00:00"})]})'
      if (!content.includes(oldHomePeakTime)) throw new Error('Recovered Home Peak label changed; refusing to ship ambiguous commission hours.')
      content = content.replace(oldHomePeakTime, newHomePeakTime)

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
      content = content.replace(
        'function P(){const{staff:t}=q(),i=F(t),[f,B]',
        'function P(){const{staff:t}=q(),ownerFinance=F(t),i=ownerFinance||(t==null?void 0:t.role)==="ceo",[f,B]',
      )
      const commissionRangeComponent = `function commissionDateKey(e=new Date){const n=e.getFullYear(),r=String(e.getMonth()+1).padStart(2,"0"),t=String(e.getDate()).padStart(2,"0");return n+"-"+r+"-"+t}function commissionRangeBounds(e){if(!e.start)return{};const n=new Date(e.start+"T00:00:00+07:00").toISOString(),r=e.end||e.start,t=new Date(new Date(r+"T00:00:00+07:00").getTime()+864e5).toISOString();return{start:n,endExclusive:t}}function CommissionDateRange({value:e,onChange:n,open:r,setOpen:t}){const[o,s]=a.useState(()=>{const l=e.start?new Date(e.start+"T00:00:00"):new Date;return new Date(l.getFullYear(),l.getMonth(),1)}),i=o.getFullYear(),c=o.getMonth(),d=(new Date(i,c,1).getDay()+6)%7,p=Array.from({length:42},(l,m)=>new Date(i,c,m-d+1)),f=["จ","อ","พ","พฤ","ศ","ส","อา"],h=l=>{const m=commissionDateKey(l);!e.start||e.end||m<e.start?n({start:m,end:""}):(n({start:e.start,end:m}),t(!1))},b=l=>{if(!l)return"";const[m,g,y]=l.split("-");return y+"/"+g+"/"+m},v=e.start&&e.end?b(e.start)+" - "+b(e.end):e.start?b(e.start)+" - เลือกวันสิ้นสุด":"ทุกช่วงเวลา";return u.jsxs("div",{style:{position:"relative"},children:[u.jsxs("button",{type:"button",className:"input",onClick:()=>t(!r),style:{alignItems:"center",background:"#202226",borderColor:r||e.start?"var(--blood)":"var(--line)",color:"var(--bone)",cursor:"pointer",display:"flex",fontSize:12,gap:8,justifyContent:"space-between",minWidth:240},children:[u.jsx("span",{children:v}),u.jsx("span",{children:"▾"})]}),r&&u.jsxs("div",{className:"panel",style:{background:"#17191c",border:"1px solid rgba(196,30,42,.55)",boxShadow:"0 18px 55px rgba(0,0,0,.6)",padding:14,position:"absolute",right:0,top:"calc(100% + 8px)",width:304,zIndex:80},children:[u.jsxs("div",{style:{alignItems:"center",display:"flex",justifyContent:"space-between",marginBottom:12},children:[u.jsx("button",{type:"button",className:"btn",onClick:()=>s(new Date(i,c-1,1)),children:"‹"}),u.jsx("strong",{children:o.toLocaleDateString("th-TH",{month:"long",year:"numeric"})}),u.jsx("button",{type:"button",className:"btn",onClick:()=>s(new Date(i,c+1,1)),children:"›"})]}),u.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)"},children:f.map(l=>u.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,padding:"5px 0",textAlign:"center"},children:l},l))}),u.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3},children:p.map(l=>{const m=commissionDateKey(l),g=l.getMonth()===c,y=Boolean(e.start&&e.end&&m>=e.start&&m<=e.end),k=m===e.start||m===e.end;return u.jsx("button",{type:"button",onClick:()=>h(l),style:{background:k?"var(--blood)":y?"rgba(196,30,42,.30)":"transparent",border:k?"1px solid #f05a66":"1px solid transparent",borderRadius:6,color:g?"var(--bone)":"#555",cursor:"pointer",fontSize:11,height:32,padding:0},children:l.getDate()},m)})}),u.jsxs("div",{style:{borderTop:"1px solid var(--line)",display:"flex",justifyContent:"space-between",marginTop:10,paddingTop:10},children:[u.jsx("button",{type:"button",className:"btn",onClick:()=>{n({start:"",end:""}),t(!1)},children:"Clear"}),u.jsx("button",{type:"button",className:"btn btn-primary",onClick:()=>{const l=commissionDateKey();n({start:l,end:l}),t(!1)},children:"Today"})]})]})]})}`
      content = content.replace('const d=t=>`\\xA5${Number(t||0).toLocaleString()}`;function P(){', 'const d=t=>`\\xA5${Number(t||0).toLocaleString()}`;' + commissionRangeComponent + 'function P(){')
      content = content.replace(
        '[x,w]=a.useState("");async function j(){',
        '[x,w]=a.useState(""),[dateRange,setDateRange]=a.useState({start:"",end:""}),[rangeOpen,setRangeOpen]=a.useState(!1);async function j(){',
      )
      const oldCommissionQuery = 'c.from("bills").select("id,bill_number,staff_id,branch_id,commission,created_at,status,staff:staff_id(name_en,phone,avatar_url),branches:branch_id(name,key)").gt("commission",0).neq("status","rejected").order("created_at",{ascending:!1}).limit(500)'
      const newCommissionQuery = '(()=>{const R=commissionRangeBounds(dateRange);let Q=c.from("commission_distributions").select("id,bill_id,user_id,amount,created_at,paid_at,reversed_at,commission_mode,calculation_version,snapshot_index,remainder_amount,recipient:user_id(name_en,phone,avatar_url),bill:bill_id(bill_number,branch_id,commission,created_at,first_order_time,commission_is_peak,commission_base_pool,commission_final_pool,commission_active_count,commission_calculation_status,status,branches:branch_id(name,key))").is("paid_at",null).is("reversed_at",null).order("created_at",{ascending:!1}).limit(2000);R.start&&(Q=Q.gte("created_at",R.start)),R.endExclusive&&(Q=Q.lt("created_at",R.endExclusive));return Q})()'
      content = content.replace(oldCommissionQuery, newCommissionQuery)
      content = content.replace(
        'E.error&&r(E.error.message),B(E.data||[]),O((s.data||[]).map(n=>n.bill_id)),b(e.data||[])',
        'E.error&&r(E.error.message);const n=(E.data||[]).map(o=>({...o,id:o.id,bill_id:o.bill_id,staff_id:o.user_id,branch_id:o.bill?.branch_id,commission:o.amount,staff:o.recipient,branches:o.bill?.branches,bill_number:o.bill?.bill_number,status:o.bill?.status}));B(n),O((s.data||[]).map(o=>o.bill_id)),b(e.data||[])',
      )
      content = content.replace('p_bill_ids:l.bills.map(e=>e.id)', 'p_bill_ids:l.bills.map(e=>e.bill_id||e.id)')
      const oldAdminPayoutQuery = 'c.from("commission_payouts").select("*,staff:staff_id(name_en,phone,avatar_url),branches:branch_id(name,key),payer:paid_by(name_en)").order("paid_at",{ascending:!1}).limit(50)'
      const newAdminPayoutQuery = '(()=>{const R=commissionRangeBounds(dateRange);let Q=c.from("commission_payouts").select("*,staff:staff_id(name_en,phone,avatar_url),branches:branch_id(name,key),payer:paid_by(name_en)").order("paid_at",{ascending:!1}).limit(50);!ownerFinance&&t?.primary_branch&&(Q=Q.eq("branch_id",t.primary_branch)),R.start&&(Q=Q.gte("paid_at",R.start)),R.endExclusive&&(Q=Q.lt("paid_at",R.endExclusive));return Q})()'
      content = content.replace(oldAdminPayoutQuery, newAdminPayoutQuery)
      const oldOwnPayoutQuery = 'c.from("commission_payouts").select("*,branches:branch_id(name,key),payer:paid_by(name_en)").eq("staff_id",t.id).order("paid_at",{ascending:!1}).limit(50)'
      const newOwnPayoutQuery = '(()=>{const R=commissionRangeBounds(dateRange);let Q=c.from("commission_payouts").select("*,branches:branch_id(name,key),payer:paid_by(name_en)").eq("staff_id",t.id).order("paid_at",{ascending:!1}).limit(50);R.start&&(Q=Q.gte("paid_at",R.start)),R.endExclusive&&(Q=Q.lt("paid_at",R.endExclusive));return Q})()'
      content = content.replace(oldOwnPayoutQuery, newOwnPayoutQuery)
      content = content.replace('a.useEffect(()=>{t&&j()},[t]);', 'a.useEffect(()=>{t&&j()},[t,dateRange.start,dateRange.end]);')
      content = content.replace(
        'A&&u.jsxs("div",{className:"kitchen-error"',
        'u.jsxs("section",{className:"panel",style:{alignItems:"center",display:"flex",flexWrap:"wrap",gap:12,justifyContent:"space-between",marginBottom:14,padding:"12px 14px"},children:[u.jsxs("div",{children:[u.jsx("strong",{style:{fontSize:12},children:"ช่วงวันที่ค่าคอม"}),u.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,marginTop:3},children:"Pool ต่อบิล · Peak 18:00–05:59 +25% · Snapshot ตอนบิลเข้า"})]}),u.jsx(CommissionDateRange,{value:dateRange,onChange:setDateRange,open:rangeOpen,setOpen:setRangeOpen})]}),A&&u.jsxs("div",{className:"kitchen-error"',
      )
      content = content.replaceAll(
        'u.jsxs("span",{children:[e.bills.length," \\u0E1A\\u0E34\\u0E25"]})',
        'u.jsxs("span",{children:[e.bills.length," บิล",e.bills.some(n=>n.bill?.commission_is_peak)&&u.jsx("small",{style:{color:"#35d9e6",display:"block",fontSize:9},children:["PEAK ",e.bills.filter(n=>n.bill?.commission_is_peak).length," บิล"]})]})',
      )
      content = content.replace(
        'children:i?"OWNER FINANCE":"MY COMMISSION"',
        'children:ownerFinance?"OWNER FINANCE":i?"CEO OVERVIEW":"MY COMMISSION"',
      )
      content = content.replace(
        /className:"font-display",children:i\?"[^"]+":"[^"]+"/,
        'className:"font-display",children:ownerFinance?"จ่ายค่าคอมพนักงาน":i?"ภาพรวมค่าคอมพนักงาน":"ค่าคอมของฉัน"',
      )
      content = content.replace(
        /u\.jsx\("p",\{children:i\?"[^"]+":"[^"]+"\}\)/,
        'u.jsx("p",{children:ownerFinance?"ยอดค้างจ่าย แยกตามทีมและพนักงาน":i?"ดูยอดค่าคอมของพนักงานในสาขาของคุณ · สิทธิ์ดูอย่างเดียว":"รายการค่าคอมที่ Owner โอนให้คุณ"})',
      )
      content = content.replace(
        'u.jsx("button",{className:"btn btn-primary",onClick:()=>p(e),children:"\\u0E1A\\u0E31\\u0E19\\u0E17\\u0E36\\u0E01\\u0E01\\u0E32\\u0E23\\u0E08\\u0E48\\u0E32\\u0E22"})',
        'ownerFinance&&u.jsx("button",{className:"btn btn-primary",onClick:()=>p(e),children:"บันทึกการจ่าย"})',
      )
      content = content.replace('l&&u.jsx("div",{className:"commission-modal"', 'l&&ownerFinance&&u.jsx("div",{className:"commission-modal"')
      if (!content.includes('commissionRangeBounds(dateRange)') || !content.includes('ช่วงวันที่ค่าคอม') || !content.includes('CEO OVERVIEW') || !content.includes('ownerFinance&&u.jsx')) {
        throw new Error('Recovered Commission bundle changed unexpectedly; refusing to build without commission date range.')
      }
    }

    // In the in-app browser, window.prompt is unsupported and aborts bill cancellation
    // before the cancel_bill_safely RPC can run. Use a safe default audit reason.
    if (file.endsWith('POSPage-CxiIf3bD.js')) {
      content = content.replace(/\r\n/g, '\n')
      const posHeroMarker = 'className: "panel pos-hero",'
      const compactPosHeroMarker = 'className:"panel pos-hero",'
      if (content.includes(posHeroMarker)) content = content.replace(posHeroMarker, 'className: "panel pos-hero " + (n === "garage" ? "pos-hero--garage" : "pos-hero--sabinagisa"),')
      else if (content.includes(compactPosHeroMarker)) content = content.replace(compactPosHeroMarker, 'className:"panel pos-hero "+(n==="garage"?"pos-hero--garage":"pos-hero--sabinagisa"),')
      else throw new Error('Recovered POS hero markup changed; refusing to map branch-specific artwork.')
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
        '    Z = Y || de,\n    safeManualDiscountPct = Math.min(100, Math.max(0, Number(manualDiscountPct) || 0)),\n    manualDiscountAmount = Math.min(N.total, Math.round(N.total * safeManualDiscountPct / 100)),\n    O = M || de ? 0 : Math.max(0, N.total - manualDiscountAmount),\n    discountPctForBill = W > 0 ? Number((100 - O / W * 100).toFixed(2)) : 0,\n    pe = M || p.commission_eligible === false ? 0 : n.commission_flat;',
      )
      content = content.replace(
        'discount_pct: M ? 0 : de ? 100 : N.percentage,',
        'discount_pct: discountPctForBill,',
      )
      content = content.replace('pe = M || p.commission_eligible === false ? 0 : n.commission_flat;', 'restaurantCommission = calculateSabinagisaCommissionPool(n.key, O, new Date()),\n    garageTechnician = n.key === "garage" && ["head_mechanic","mechanic","mechanic_trainee"].includes(p?.role),\n    pe = M || p.commission_eligible === false ? 0 : n.key === "chill" ? restaurantCommission.amount : garageTechnician ? 0 : n.commission_flat;')
      const attendanceHookMarker = '  const initialDraft = readPosDraft(draftStorageKey);'
      const attendanceHook = `
  const [isOnShift, setIsOnShift] = i.useState(false);
  const [showAttendanceConfirm, setShowAttendanceConfirm] = i.useState(false);
  i.useEffect(() => {
    if (n.key !== "chill" || !p?.id) { setIsOnShift(false); return; }
    let active = true;
    const refreshShift = () => x.from("attendance").select("id").eq("staff_id", p.id).eq("branch_id", n.id).is("clock_out", null).gte("last_seen_at",new Date(Date.now()-2*60*60*1000).toISOString()).limit(1).then(({data, error}) => {
      if (!active) return;
      if (error) { console.warn("[SABINAGISA] Could not verify clock-in:", error); setIsOnShift(false); }
      else setIsOnShift(Boolean(data?.length));
    });
    refreshShift();
    const timer = setInterval(refreshShift, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [n, p?.id]);`
      if (!content.includes(attendanceHookMarker)) throw new Error('Recovered POS component changed; refusing to show personal commission without attendance verification.')
      content = content.replace(attendanceHookMarker, attendanceHookMarker + attendanceHook)
      content = content.replace('async function Se() {\n    if (u.length === 0', 'async function Se(confirmedUnclocked = false) {\n    if (n.key === "chill" && !isOnShift && !confirmedUnclocked) { setShowAttendanceConfirm(true); return; }\n    setShowAttendanceConfirm(false);\n    if (u.length === 0')
      const attendanceDialog = 'showAttendanceConfirm&&e.jsx("div",{role:"presentation",onClick:t=>{t.target===t.currentTarget&&setShowAttendanceConfirm(!1)},style:{position:"fixed",inset:0,zIndex:120,display:"grid",placeItems:"center",padding:16,background:"rgba(0,0,0,.72)"},children:e.jsxs("section",{role:"alertdialog","aria-modal":!0,"aria-labelledby":"attendance-warning-title",className:"panel",style:{width:"min(100%,440px)",padding:24,borderColor:"rgba(230,143,56,.65)"},children:[e.jsx("div",{style:{alignItems:"center",background:"rgba(230,143,56,.14)",border:"1px solid rgba(230,143,56,.3)",borderRadius:12,color:"#f2b45f",display:"flex",fontSize:24,height:48,justifyContent:"center",marginBottom:12,width:48},children:"!"}),e.jsx("div",{style:{color:"#d98332",fontSize:10,letterSpacing:1.2,fontWeight:800},children:"SABINAGISA · แจ้งเตือนการเข้างาน"}),e.jsx("h2",{id:"attendance-warning-title",style:{margin:"7px 0 9px",fontSize:21},children:"ยังไม่ได้เข้างานนะ"}),e.jsx("p",{style:{color:"var(--bone)",fontSize:14,lineHeight:1.75,margin:"0 0 8px"},children:"ถ้าบันทึกบิลตอนนี้ คุณจะไม่ได้รับค่าคอม Pool จากบิลนี้"}),e.jsx("p",{style:{color:"var(--ghost-gray)",fontSize:12,lineHeight:1.65,margin:"0 0 18px"},children:u.length?"ถ้ากำลังทำงานอยู่ ให้ไปเข้างานก่อนเพื่อรับสิทธิ์ค่าคอม หรือยืนยันบันทึกบิลต่อโดยไม่รับค่าคอม":"เพิ่มรายการในบิลก่อน แล้วค่อยกลับมากดยืนยันบันทึกต่อ"}),e.jsxs("div",{style:{display:"flex",justifyContent:"flex-end",flexWrap:"wrap",gap:8},children:[e.jsx(Ce,{to:"/attendance",className:"btn btn-secondary",children:"ไปหน้าเข้างาน"}),u.length?e.jsx("button",{type:"button",className:"btn btn-primary",onClick:()=>Se(!0),children:"ยืนยันบิล · ไม่มีค่าคอม"}):e.jsx("button",{type:"button",className:"btn btn-primary",onClick:()=>setShowAttendanceConfirm(!1),children:"เข้าใจแล้ว"})]})]})})'
      const attendanceDialogAnchor = '}), R && e.jsx("div", {\n      style: {\n        position: "fixed",\n        bottom: 24,'
      if (!content.includes(attendanceDialogAnchor)) throw new Error('Recovered POS toast anchor changed; cannot install unclocked bill confirmation.')
      const checkoutDialog = 'pendingCheckout&&e.jsx("div",{role:"presentation",onKeyDown:event=>{if(event.key==="Tab"){event.preventDefault();event.currentTarget.querySelector("button")?.focus()}},style:{position:"fixed",inset:0,zIndex:150,display:"grid",placeItems:"center",padding:20,background:"rgba(5,6,7,.84)",backdropFilter:"blur(8px)"},children:e.jsxs("section",{role:"alertdialog","aria-modal":!0,"aria-labelledby":"checkout-retry-title",className:"panel",style:{width:"min(100%,460px)",padding:24,borderColor:"rgba(214,66,39,.7)",boxShadow:"0 24px 80px rgba(0,0,0,.5)"},children:[e.jsx("span",{style:{color:"var(--blood)",fontSize:10,fontWeight:800,letterSpacing:1.2},children:"CHECKOUT · VERIFYING"}),e.jsx("h2",{id:"checkout-retry-title",style:{margin:"8px 0",fontSize:21},children:"กำลังตรวจสอบผลบิลเดิม"}),e.jsx("p",{style:{color:"var(--ghost-gray)",fontSize:13,lineHeight:1.7,marginBottom:16},children:"ระบบอาจบันทึกบิลสำเร็จแล้วแต่การตอบกลับขาดหาย เราจะส่งคำขอเดิมซ้ำด้วยรหัสเดิมเพื่อไม่ให้เกิดบิลซ้ำ กรุณาอย่าเริ่มบิลใหม่จนกว่าจะยืนยันผลได้"}),e.jsx("button",{type:"button",autoFocus:!0,className:"btn btn-primary",disabled:f,onClick:()=>Se(!0),children:f?"กำลังตรวจสอบ…":"ตรวจสอบ / ลองส่งคำขอเดิมซ้ำ"})]})})'
      content = content.replace(attendanceDialogAnchor, `}), ${attendanceDialog}, ${checkoutDialog}, R && e.jsx("div", {\n      style: {\n        position: "fixed",\n        bottom: 24,`)
      const discountMarker = `        }), e.jsxs("div", {\n          className: "font-mono",\n          style: {\n            display: "flex",\n            justifyContent: "space-between",\n            fontSize: 13,\n            color: "var(--ghost-gray)",\n            marginBottom: 6\n          },\n          children: [e.jsx("span", {\n            children: "COMMISSION (FLAT)"`
      const discountField = `        }), !M && e.jsxs("label", {style: {display: "grid", gap: 6, marginBottom: 12}, children: [e.jsx("span", {style: {color: "var(--ghost-gray)", fontSize: 10, letterSpacing: .8}, children: "ส่วนลด (%)"}), e.jsx("input", {className: "input", type: "number", min: 0, max: 100, step: "0.01", inputMode: "decimal", placeholder: "เช่น 10", value: safeManualDiscountPct || "", onChange: t => setManualDiscountPct(Math.min(100, Math.max(0, Number(t.target.value) || 0)))}), manualDiscountAmount > 0 && e.jsxs("span", {className: "font-mono", style: {color: "#84d6a8", fontSize: 11}, children: ["−¥", manualDiscountAmount.toLocaleString(), " จากยอดหลังส่วนลดสมาชิก"]})]}), e.jsxs("div", {\n          className: "font-mono",\n          style: {\n            display: "flex",\n            justifyContent: "space-between",\n            fontSize: 13,\n            color: "var(--ghost-gray)",\n            marginBottom: 6\n          },\n          children: [e.jsx("span", {\n            children: "COMMISSION (FLAT)"`
      content = content.replace(discountMarker, discountField)
      content = content.replace('children: "COMMISSION (FLAT)"', 'children: n.key === "chill" ? "ค่าคอมของฉัน" : "COMMISSION (FLAT)"')
      const unclockedReminderAnchor = '        }), E && C && !M && e.jsxs(e.Fragment, {'
      const unclockedReminder = '        }), n.key === "chill" && !isOnShift && e.jsx("div", {role: "status", style: {background: "rgba(236,164,76,.12)", border: "1px solid rgba(236,164,76,.35)", borderRadius: 8, color: "#f0bd78", fontSize: 11, lineHeight: 1.5, marginBottom: 10, padding: "9px 11px"}, children: "⚠️ อย่าลืมเข้างานนะ เดี๋ยวไม่ได้ค่าคอม"}), E && C && !M && e.jsxs(e.Fragment, {'
      if (!content.includes(unclockedReminderAnchor)) throw new Error('Recovered POS commission section changed; refusing to omit the unclocked reminder.')
      content = content.replace(unclockedReminderAnchor, unclockedReminder)
      content = content.replace('opacity: f || u.length === 0 || pricingBlocked ? 0.5 : 1', 'opacity: f || pricingBlocked || (u.length === 0 && (n.key !== "chill" || isOnShift)) ? 0.5 : 1')
      content = content.replace('children: ["\\xA5", pe.toLocaleString()]', 'children: ["\\xA5", (n.key === "chill" && !isOnShift ? 0 : pe).toLocaleString()]')
      if (!content.includes('restaurantCommission = calculateSabinagisaCommissionPool(n.key, O, new Date())')) {
        throw new Error('Recovered POS commission patch did not apply; refusing to ship a flat commission for SABINAGISA.')
      }
      content = content.replace('children: ["SERVICE BILL \\xB7 COMMISSION \\xA5", h.commission_flat.toLocaleString(), " ", "/ BILL \\xB7 ", m, " SERVICES"]', 'children: v ? ["SERVICE BILL · COMMISSION POOL / BILL · PEAK +25% 18:00–05:59 · ", m, " SERVICES"] : n.key === "garage" && ["head_mechanic","mechanic","mechanic_trainee"].includes(p?.role) ? ["NORMAL — ¥10,000 · PEAK — ¥15,000 · Peak Time 18:00–00:00 · ",m," SERVICES"] : ["SERVICE BILL · COMMISSION ¥", h.commission_flat.toLocaleString(), " / BILL · ", m, " SERVICES"]')
      content = 'import{calculateSabinagisaCommissionPool}from"./commission-pool.js";\n' + content

      const draftKeyAnchor = 'const draftStorageKey = `${POS_DRAFT_PREFIX}${n.key}:${(p == null ? void 0 : p.id) || "guest"}`;'
      const checkoutState = `${draftKeyAnchor}\n  const checkoutStorageKey = \`ghostlab-pos-checkout:\${n.key}:\${(p == null ? void 0 : p.id) || "guest"}\`;\n  const pendingCheckout = (() => { try { return JSON.parse(localStorage.getItem(checkoutStorageKey) || "null"); } catch { return null; } })();`
      if (!content.includes(draftKeyAnchor)) throw new Error('Recovered POS draft key changed; cannot add safe checkout retries.')
      content = content.replace(draftKeyAnchor, checkoutState)

      const submitStart = content.indexOf('async function Se(confirmedUnclocked = false) {')
      const submitEnd = content.indexOf('\n  return e.jsxs("div", {', submitStart)
      if (submitStart < 0 || submitEnd < 0) throw new Error('Recovered POS submit handler changed; cannot enforce atomic checkout.')
      const atomicSubmit = `async function Se(confirmedUnclocked = false) {
    if (!pendingCheckout && n.key === "chill" && !isOnShift && !confirmedUnclocked) { setShowAttendanceConfirm(true); return; }
    setShowAttendanceConfirm(false);
    if (!p || z.current) return;
    if (!pendingCheckout && u.length === 0) return V("เพิ่มรายการอย่างน้อย 1 รายการก่อนบันทึกบิล");
    if (!pendingCheckout && pricingBlocked) return V("มีรายการที่ยังไม่มีราคา กรุณาตรวจสอบตะกร้าก่อนบันทึก");
    if (!pendingCheckout && E && !C) return V("กรุณาเลือก Member ก่อนบันทึกบิล");
    z.current = true; w(true);
    try {
      const billNumber = \`\${n.key.slice(0, 3).toUpperCase()}-\${Date.now().toString().slice(-6)}\`;
      const request = pendingCheckout || {
        requestId: globalThis.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => { const random = Math.random() * 16 | 0; return (char === "x" ? random : (random & 0x3 | 0x8)).toString(16); }),
        billData: { bill_number: billNumber, branch_id: n.id, staff_id: p.id, member_id: (C == null ? void 0 : C.id) || null, plate: l || null, vehicle: s || null, notes: Be(c, u, n.key === "garage" ? vehicleClass : null), subtotal: W, discount_pct: discountPctForBill, commission: pe, commission_mode: n.key === "chill" ? "ON_WORK_ALL" : "INDIVIDUAL", total: O, status: "paid", order_type: v ? q : null, table_number: v && q === "dine_in" && H.trim() || null, kitchen_status: v ? "received" : null, payment_method: $, amount_received: $ === "cash" && I !== "" ? Number(I) : null, change_due: $ === "cash" && I !== "" ? Math.max(0, Number(I) - O) : 0 },
        items: u.map(item => ({ service_id: item.id, name_snapshot: item.name, price_snapshot: item.price, item_note: item.item_note || null })),
        rewardId: de && U[0] ? U[0].id : null
      };
      if (!pendingCheckout) localStorage.setItem(checkoutStorageKey, JSON.stringify(request));
      const { error } = await x.rpc("create_bill_with_items_atomic", { p_request_id: request.requestId, p_bill_data: request.billData, p_items: request.items, p_reward_id: request.rewardId });
      if (error) throw error;
      localStorage.removeItem(checkoutStorageKey);
      setVehicleClass("standard"); m([]); o(""); r(""); S(""); P(null); te(false); ne(false); J(false); ie(""); oe(""); V("บันทึกบิลสำเร็จ ✓ " + request.billData.bill_number);
    } catch (error) {
      console.error(error);
      V(\`ยังยืนยันผลบิลไม่ได้ — เก็บคำขอเดิมไว้แล้ว กดลองตรวจสอบ/ส่งซ้ำอีกครั้ง (\${error.message || "เครือข่ายขัดข้อง"})\`);
    } finally { z.current = false; w(false); }
  }`
      content = content.slice(0, submitStart) + atomicSubmit + content.slice(submitEnd)

      // Keep POS member signup in the production bundle on the same atomic,
      // retry-safe membership path used by the Members screen.
      const memberModalStart = content.indexOf('function Te({\n  branch: n,\n  initialQuery: a,\n  onClose: p,\n  onCreated: v\n}) {')
      const memberModalReturn = content.indexOf('  return e.jsx("div", {', memberModalStart)
      if (memberModalStart < 0 || memberModalReturn < 0) throw new Error('Recovered POS member modal changed; refusing to leave split signup writes.')
      const safePosMemberModal = `function Te({
  branch: n,
  initialQuery: a,
  onClose: p,
  onCreated: v
}) {
  const requestKey = "ghostlab-pos-member-request:" + n.id;
  const [pendingRequest, setPendingRequest] = i.useState(() => { try { return JSON.parse(localStorage.getItem(requestKey) || "null"); } catch { return null; } });
  const [g, h] = i.useState(() => (pendingRequest == null ? void 0 : pendingRequest.memberData.name) || a || "");
  const [b, y] = i.useState(() => (pendingRequest == null ? void 0 : pendingRequest.memberData.phone) || "");
  const [j, k] = i.useState(() => (pendingRequest == null ? void 0 : pendingRequest.memberData.plate_or_note) || "");
  const [u, m] = i.useState("");
  const [l, o] = i.useState(false);
  const s = ke("regular", n.key);
  async function r() {
    if (l) return;
    if (!g.trim()) { window.alert("กรุณากรอกชื่อลูกค้า"); return; }
    o(true);
    const memberData = {branch_id:n.id,name:g.trim(),phone:b.trim()||null,plate_or_note:j.trim()||u.trim()||null,tier:"regular"};
    let request = pendingRequest;
    if (request && JSON.stringify(request.memberData) !== JSON.stringify(memberData)) { o(false); window.alert("มีคำขอเดิมที่ยังยืนยันผลไม่ได้ กรุณาส่งคำขอเดิมซ้ำก่อนแก้ข้อมูล"); return; }
    if (!request) {
      const startedAt = (/* @__PURE__ */ new Date()).toISOString();
      request = {requestId:globalThis.crypto?.randomUUID?.()||"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,char=>{const random=Math.random()*16|0;return(char==="x"?random:(random&3|8)).toString(16)}),memberData,membershipData:{tier:s.key,monthly_fee:s.monthlyFee,months:1,total_paid:s.monthlyFee,started_at:startedAt,expires_at:Ne()}};
      try { localStorage.setItem(requestKey, JSON.stringify(request)); setPendingRequest(request); }
      catch { o(false); window.alert("บันทึกคำขอสำรองไม่ได้ จึงยังไม่ส่งข้อมูลสมาชิก"); return; }
    }
    const {data:memberId,error} = await x.rpc("save_member_with_membership_atomic",{p_request_id:request.requestId,p_member_id:null,p_member_data:request.memberData,p_membership_data:request.membershipData});
    if (error) { o(false); console.error(error); window.alert("ยังยืนยันผลสมัครสมาชิกไม่ได้ — เก็บคำขอเดิมไว้แล้ว กรุณากดส่งซ้ำอีกครั้ง"); return; }
    const {data:member, error:loadError} = await x.from("members").select("*").eq("id",memberId).single();
    if (loadError) { o(false); window.alert("บันทึกสมาชิกสำเร็จแล้ว แต่ยังโหลดข้อมูลไม่สำเร็จ กรุณากดส่งคำขอเดิมซ้ำ"); return; }
    try { localStorage.removeItem(requestKey); } catch {}
    o(false); v(member);
  }
`
      content = content.slice(0, memberModalStart) + safePosMemberModal + content.slice(memberModalReturn)
      content = content.replace('children: l ? "\\u0E01\\u0E33\\u0E25\\u0E31\\u0E07\\u0E40\\u0E1E\\u0E34\\u0E48\\u0E21..." : `\\u0E2A\\u0E21\\u0E31\\u0E04\\u0E23 ${s.label}', 'children: l ? "กำลังเพิ่ม..." : pendingRequest ? "ตรวจสอบ / ส่งคำขอเดิมซ้ำ" : `สมัคร ${s.label}')
      content = content.replace('e.jsx("div", {\n          onClick: r,\n          className: "btn btn-primary",\n          style: {\n            opacity: l ? 0.6 : 1\n          },', 'e.jsx("button", {\n          type: "button",\n          onClick: r,\n          disabled: l,\n          className: "btn btn-primary",\n          style: {\n            opacity: l ? 0.6 : 1\n          },')
      if (!content.includes('ghostlab-pos-member-request:') || !content.includes('save_member_with_membership_atomic')) throw new Error('Atomic POS member signup was not installed into the production bundle.')
      if (!content.includes('type: "button",\n          onClick: r,\n          disabled: l')) throw new Error('POS member signup is not keyboard-accessible or does not block duplicate clicks.')

      // Keep the source branch permissions aligned with the RLS policies:
      // CEOs may manage only their assigned branch; Owner/GOD are global.
      const oldServiceManagerCheck = 'o = ["owner", "god", "ceo"].includes(g == null ? void 0 : g.role);'
      const newServiceManagerCheck = 'o = ["owner", "god"].includes(g == null ? void 0 : g.role) || (g?.role === "ceo" && g?.primary_branch === (h == null ? void 0 : h.id));'
      if (!content.includes(oldServiceManagerCheck) && !content.includes(newServiceManagerCheck)) throw new Error('POS service manager role check changed; refusing to build with unverified branch permissions.')
      content = content.replace(oldServiceManagerCheck, newServiceManagerCheck)

      // Replace the legacy delete-then-insert BOM editor with a single atomic
      // RPC and fail closed if either the existing BOM or stock list cannot load.
      const materialsStart = content.indexOf('function Ae({')
      const materialsEnd = content.indexOf('\nexport { $e as P };', materialsStart)
      if (materialsStart < 0 || materialsEnd < 0) throw new Error('Recovered Materials editor changed; refusing to build without atomic BOM protection.')
      const atomicMaterialsEditor = `function Ae({branch:n,service:a,onSaved:p}) {
  const [items,g]=i.useState([]),[qtys,b]=i.useState({}),[loading,j]=i.useState(true),[loadError,setLoadError]=i.useState(""),[reload,setReload]=i.useState(0),[saving,u]=i.useState(false),[saveError,setSaveError]=i.useState("");
  i.useEffect(()=>{let active=true;async function load(){j(true);setLoadError("");try{const [stockResult,bomResult]=await Promise.all([x.from("stock_items").select("*").eq("branch_id",n.id).order("name"),x.from("service_materials").select("stock_item_id,qty_per_unit").eq("service_id",a.id)]);if(stockResult.error)throw stockResult.error;if(bomResult.error)throw bomResult.error;if(!active)return;g(stockResult.data||[]);const next={};(bomResult.data||[]).forEach(row=>{next[row.stock_item_id]=row.qty_per_unit});b(next)}catch(error){console.error(error);if(active)setLoadError("โหลด Materials ไม่สำเร็จ ปิดการบันทึกไว้เพื่อป้องกันรายการเดิมหาย")}finally{if(active)j(false)}}load();return()=>{active=false}},[n.id,a.id,reload]);
  function setQty(id,value){b(current=>({...current,[id]:parseInt(value)||0}))}
  async function save(){if(saving||loading||loadError)return;u(true);setSaveError("");const materials=Object.entries(qtys).filter(([,qty])=>qty>0).map(([stock_item_id,qty_per_unit])=>({stock_item_id,qty_per_unit}));try{const {error}=await x.rpc("replace_service_materials_atomic",{p_service_id:a.id,p_materials:materials});if(error)throw error;p(materials.length)}catch(error){console.error(error);setSaveError(error?.message||"บันทึก Materials ไม่สำเร็จ รายการเดิมยังไม่ถูกเปลี่ยน")}finally{u(false)}}
  return e.jsxs("div",{style:{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:16,margin:"4px 0 14px"},children:[e.jsx("div",{style:{fontSize:11,color:"var(--ghost-gray)",marginBottom:12},children:"MATERIALS / PARTS USED — ใส่จำนวนที่ใช้ต่อ 1 งาน · จะหักจาก Stock อัตโนมัติเมื่อรับงาน"}),loading?e.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:12},children:"กำลังโหลด..."}):loadError?e.jsxs("div",{role:"alert",style:{color:"#ff9a8c",fontSize:12},children:[e.jsx("p",{children:loadError}),e.jsx("button",{type:"button",className:"btn",onClick:()=>setReload(value=>value+1),children:"ลองโหลดอีกครั้ง"})]}):items.length===0?e.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:12},children:"ยังไม่มีวัตถุดิบในสาขานี้ — ไปเพิ่มที่หน้า สต๊อก & เบิกจ่าย ก่อน"}):e.jsxs(e.Fragment,{children:[e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14},children:items.map(item=>e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:11,fontWeight:600,marginBottom:6,textTransform:"uppercase"},children:item.name}),e.jsx("input",{className:"input",type:"number",min:0,value:qtys[item.id]||0,onChange:event=>setQty(item.id,event.target.value),style:{fontSize:12}}),e.jsxs("div",{style:{fontSize:10,color:"var(--ghost-gray)",marginTop:4},children:["เหลือ ",item.quantity," ",item.unit||"ชิ้น"]})]},item.id))}),saveError&&e.jsx("div",{role:"alert",style:{color:"#ff9a8c",fontSize:12,marginBottom:10},children:saveError}),e.jsx("button",{type:"button",onClick:save,disabled:saving,className:"btn btn-primary",style:{opacity:saving?0.6:1},children:saving?"กำลังบันทึก...":"บันทึก Materials"})]})]})
}`
      content = content.slice(0, materialsStart) + atomicMaterialsEditor + content.slice(materialsEnd)
      if (!content.includes('replace_service_materials_atomic') || !content.includes('g?.primary_branch === (h == null ? void 0 : h.id)')) throw new Error('Atomic BOM save or assigned-branch CEO access is missing from the production POS bundle.')

      const tabStart = content.indexOf('function K({')
      const tabEnd = content.indexOf('\nfunction Le(', tabStart)
      if (tabStart < 0 || tabEnd < 0) throw new Error('POS tab button component changed; refusing to build mouse-only navigation.')
      let tabButton = content.slice(tabStart, tabEnd)
      tabButton = tabButton.replace('return e.jsx("div", {', 'return e.jsx("button", {\n    type: "button",\n    "aria-pressed": n,')
      tabButton = tabButton.replace('fontSize: 12,', 'fontSize: 12,\n        fontFamily: "inherit",')
      if (!tabButton.includes('e.jsx("button"') || !tabButton.includes('aria-pressed')) throw new Error('POS tabs are not keyboard-operable in the production bundle.')
      content = content.slice(0, tabStart) + tabButton + content.slice(tabEnd)

      const supercarPriceLabel = 'children: `Super Car: ${priceLabel(priceService(s, "supercar"))}`'
      const supercarPriceField = 'children: e.jsx("input", {className: "input font-mono", type: "number", min: 1, step: 1, inputMode: "numeric", "aria-label": `ราคา Super Car ${s.name}`, placeholder: "กรอกราคา Super Car", value: s.supercar_price ?? catalogEntry(s)?.supercar ?? "", onChange: r => m(s.id, "supercar_price", r.target.value), onBlur: r => l(s.id, "supercar_price", r.target.value), style: {fontSize: 12, marginTop: 4}})'
      if (!content.includes(supercarPriceLabel) && !content.includes(supercarPriceField)) throw new Error('Super Car catalog price field anchor changed; refusing to build.')
      content = content.replace(supercarPriceLabel, supercarPriceField)
      content = content.replace('const S = r === "price" ? {\n        price: parseInt(c) || 0\n      } : {', 'const S = r === "price" ? {\n        price: parseInt(c) || 0\n      } : r === "supercar_price" ? {\n        supercar_price: c === "" ? null : parseInt(c) || null\n      } : {')
      if (!content.includes('aria-label": `ราคา Super Car ${s.name}`') || !content.includes('supercar_price: c === "" ? null')) throw new Error('Super Car price field is not wired to persistent service updates.')

      // Surface RLS/permission failures instead of silently leaving the edited
      // value in the field; verify that an update actually matched a service.
      const serviceSaveStart = content.indexOf('  async function l(s, r, c) {')
      const serviceSaveEnd = content.indexOf('  async function uploadServiceImage', serviceSaveStart)
      const verifiedServiceSave = `  async function l(s, r, c) {
    const S = r === "price" ? {
        price: c === "" ? 0 : Number(c)
      } : r === "supercar_price" ? {
        supercar_price: c === "" ? null : Number(c) || null
      } : {
        [r]: c
      };
    const {data,error}=await x.from("services").update(S).eq("id",s).select("id").maybeSingle();
    if(error||!data){console.error(error||new Error("No service row updated"));await k();alert("บันทึกราคาไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ฐานข้อมูลแล้วลองใหม่");}
  }`
      if (serviceSaveStart < 0 || serviceSaveEnd < 0) throw new Error('Service catalog save handler changed; refusing to build without verified update feedback.')
      content = content.slice(0, serviceSaveStart) + verifiedServiceSave + '\n' + content.slice(serviceSaveEnd)
      const standardPriceField = 'className: "input font-mono",\n            value: s.price'
      if (content.includes(standardPriceField)) content = content.replace(standardPriceField, 'className: "input font-mono",\n            type: "number",\n            min: 0,\n            step: 1,\n            inputMode: "numeric",\n            "aria-label": `ราคา Standard ${s.name}`,\n            value: s.price')
      if (!content.includes('"aria-label": `ราคา Standard ${s.name}`')) throw new Error('Standard service price field is not validated as numeric in production.')
    }

    // Kitchen tickets should be scannable at a glance. Merge identical menu
    // rows (but keep different special instructions separate) and show xN.
    if (file.endsWith('ChillPOS-BQLUwLf9.js')) {
      const oldChillPos = 'import{j as r}from"./index-vaWnYKxf.js";import{P as t}from"./POSPage-CxiIf3bD.js";import"./membership-BI3ZslQk.js";function o(){return r.jsx(t,{branchKey:"chill",title:"SABINAGISA",leadRole:"chill_manager",restaurantMode:!0})}export{o as default};'
      const newChillPos = `import{j as e,r as React,s as supabase}from"./index-vaWnYKxf.js";import{P as POSPage}from"./POSPage-CxiIf3bD.js";import"./membership-BI3ZslQk.js";function OrderInbox(){const[orders,setOrders]=React.useState([]),[open,setOpen]=React.useState(!1),[loading,setLoading]=React.useState(!0),[error,setError]=React.useState(""),[busy,setBusy]=React.useState("");React.useEffect(()=>{let alive=!0,initialized=!1,seen=new Set;async function refresh(){try{const{data:branch,error:branchError}=await supabase.from("branches").select("id").eq("key","chill").single();if(branchError||!branch)throw branchError||Error("ไม่พบสาขา SABINAGISA");const now=new Date,dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString();const{data,error:queryError}=await supabase.from("bills").select("id,bill_number,table_number,order_type,created_at,kitchen_status,bill_items(name_snapshot,item_note)").eq("branch_id",branch.id).not("kitchen_status","is",null).neq("kitchen_status","served").neq("kitchen_status","cancelled").gte("created_at",dayStart).order("created_at",{ascending:!1}).limit(12);if(queryError)throw queryError;if(!alive)return;const next=data||[],newIds=next.filter(order=>order.kitchen_status==="received"&&!seen.has(order.id));if(initialized&&newIds.length)setOpen(!0);seen=new Set(next.map(order=>order.id));initialized=!0;setOrders(next);setError("")}catch(problem){console.warn("[SABINAGISA] Unable to refresh Kitchen Mini:",problem);alive&&setError(problem.message||"โหลดออเดอร์ไม่สำเร็จ")}finally{alive&&setLoading(!1)}}refresh();const timer=setInterval(refresh,10000);return()=>{alive=!1;clearInterval(timer)}},[]);async function advance(order,next){setBusy(order.id);setError("");const{error:rpcError}=await supabase.rpc("update_chill_kitchen_status",{p_bill_id:order.id,p_status:next});if(rpcError){setError(rpcError.message||"เปลี่ยนสถานะไม่สำเร็จ")}else{setOrders(current=>next==="served"?current.filter(row=>row.id!==order.id):current.map(row=>row.id===order.id?{...row,kitchen_status:next}:row))}setBusy("")}const count=orders.length;return e.jsxs("div",{className:"sabinagisa-pos-inbox",children:[e.jsxs("button",{type:"button",className:"sabinagisa-pos-inbox__trigger",onClick:()=>setOpen(value=>!value),children:[e.jsx("span",{children:"♨ Kitchen Mini"}),e.jsx("b",{children:count})]}),open&&e.jsxs("aside",{className:"sabinagisa-pos-inbox__drawer",children:[e.jsxs("header",{children:[e.jsxs("div",{children:[e.jsx("span",{children:"SABINAGISA · RESTAURANT ONLY"}),e.jsx("h2",{children:"Kitchen Mini"})]}),e.jsx("button",{type:"button","aria-label":"ปิด",onClick:()=>setOpen(!1),children:"×"})]}),error&&e.jsx("div",{className:"sabinagisa-pos-inbox__error",children:error}),loading?e.jsx("div",{className:"sabinagisa-pos-inbox__empty",children:"กำลังโหลดออเดอร์..."}):count?e.jsx("div",{className:"sabinagisa-pos-inbox__list",children:orders.map(order=>{const status=({received:["NEW","new","preparing"],preparing:["COOKING","cooking","ready"],ready:["READY","ready","served"]})[order.kitchen_status]||["OPEN","new",""];const items=order.bill_items||[],elapsed=Math.max(0,Math.floor((Date.now()-new Date(order.created_at).getTime())/60000)),nextStatus=status[2],action=status[0]==="NEW"?"เริ่มทำ →":status[0]==="COOKING"?"พร้อมเสิร์ฟ →":"เสิร์ฟแล้ว ✓";return e.jsxs("article",{className:"sabinagisa-pos-inbox__order",children:[e.jsxs("div",{className:"sabinagisa-pos-inbox__order-top",children:[e.jsx("b",{children:order.order_type==="takeaway"?"🥡 กลับบ้าน":order.table_number?"🍽 โต๊ะ "+order.table_number:order.bill_number||"🍽 ออเดอร์"}),e.jsx("span",{className:status[1],children:status[0]})]}),e.jsxs("small",{children:[order.bill_number||"",order.bill_number?" · ":"",items.length," รายการ · ",elapsed?elapsed+" นาทีที่แล้ว":"เมื่อสักครู่"]}),e.jsx("div",{className:"sabinagisa-pos-inbox__items",children:items.length?items.map((item,index)=>e.jsxs("div",{className:"sabinagisa-pos-inbox__item",children:[item.name_snapshot,item.item_note&&e.jsx("small",{children:"↳ "+item.item_note})]},index)):"ไม่มีรายการสินค้า"}),e.jsx("button",{type:"button",className:"sabinagisa-pos-inbox__action",disabled:!nextStatus||busy===order.id,onClick:()=>advance(order,nextStatus),children:busy===order.id?"กำลังบันทึก...":action})]},order.id)})}):e.jsx("div",{className:"sabinagisa-pos-inbox__empty",children:"ไม่มีออเดอร์ค้างในครัว"})]})]})}function ChillPOS(){return e.jsxs("div",{className:"sabinagisa-pos",children:[e.jsx(OrderInbox,{}),e.jsx(POSPage,{branchKey:"chill",title:"SABINAGISA",leadRole:"chill_manager",restaurantMode:!0})]})}export{ChillPOS as default};`
      if (!content.includes(oldChillPos)) throw new Error('Recovered SABINAGISA POS wrapper changed; refusing to omit Kitchen Mini.')
      const kitchenMiniPos = newChillPos
        .replace('React.useEffect(()=>{let alive=!0,initialized=!1,seen=new Set;', 'const[services,setServices]=React.useState([]),[position,setPosition]=React.useState(()=>{try{const saved=JSON.parse(localStorage.getItem("sabinagisa-kitchen-mini-position"));if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))return saved}catch{}return{x:Math.max(8,window.innerWidth-370),y:100}});const dragRef=React.useRef(null),movedRef=React.useRef(!1);function dragStart(event){dragRef.current={dx:event.clientX-position.x,dy:event.clientY-position.y};movedRef.current=!1;event.currentTarget.setPointerCapture(event.pointerId)}function dragMove(event){if(!dragRef.current)return;const x=Math.max(8,Math.min(Math.max(8,window.innerWidth-358),event.clientX-dragRef.current.dx)),y=Math.max(8,Math.min(Math.max(8,window.innerHeight-100),event.clientY-dragRef.current.dy));if(Math.abs(x-position.x)>2||Math.abs(y-position.y)>2)movedRef.current=!0;setPosition({x,y})}function dragEnd(){if(!dragRef.current)return;dragRef.current=null;try{localStorage.setItem("sabinagisa-kitchen-mini-position",JSON.stringify(position))}catch{}}function toggleMini(){if(movedRef.current){movedRef.current=!1;return}setOpen(value=>!value)}React.useEffect(()=>{let alive=!0,initialized=!1,seen=new Set;')
        .replace('const dragRef=React.useRef(null),movedRef=React.useRef(!1);function dragStart(event){', 'const clampPosition=(point,width,height)=>({x:Math.max(8,Math.min(Math.max(8,width-358),point.x)),y:Math.max(8,Math.min(Math.max(8,height-100),point.y))});const viewportRef=React.useRef({width:window.innerWidth,height:window.innerHeight});React.useEffect(()=>{function keepPositionVisible(){const previous=viewportRef.current,nextViewport={width:window.innerWidth,height:window.innerHeight};viewportRef.current=nextViewport;setPosition(current=>{const rightAnchor=current.x>previous.width/2,bottomAnchor=current.y>previous.height/2;const desired={x:rightAnchor?nextViewport.width-358-(previous.width-358-current.x):current.x,y:bottomAnchor?nextViewport.height-100-(previous.height-100-current.y):current.y};return clampPosition(desired,nextViewport.width,nextViewport.height)})}setPosition(current=>clampPosition(current,window.innerWidth,window.innerHeight));window.addEventListener("resize",keepPositionVisible);return()=>window.removeEventListener("resize",keepPositionVisible)},[]);React.useEffect(()=>{try{localStorage.setItem("sabinagisa-kitchen-mini-position",JSON.stringify(position))}catch{}},[position]);const dragRef=React.useRef(null),movedRef=React.useRef(!1);function dragStart(event){')
        .replace('function dragStart(event){dragRef.current=', 'function dragStart(event){dragRef.current=')
        .replace('bill_items(name_snapshot,item_note)', 'notes,bill_items(service_id,name_snapshot,item_note)')
        .replace('},[]);async function advance(order,next)', '},[]);React.useEffect(()=>{supabase.from("branches").select("id").eq("key","chill").single().then(({data})=>data&&supabase.from("services").select("id,name").eq("branch_id",data.id).eq("active",!0).then(({data:rows})=>setServices(rows||[])))},[]);function noteText(value){if(!value)return"";if(!value.startsWith("[ghost-lab-bill]"))return value;try{return JSON.parse(value.slice(16)).note||""}catch{return""}}async function advance(order,next)')
        .replace('order.notes||""', 'noteText(order.notes)')
        .replace('}setBusy("")}const count=orders.length;', '}setBusy("")}async function editItems(order){if(order.kitchen_status!=="received")return;const input=window.prompt("แก้ไขรายการ · พิมพ์ชื่อเมนูทีละบรรทัด",(order.bill_items||[]).map(item=>item.name_snapshot).join("\\n"));if(input===null)return;const names=input.split(/\\r?\\n/).map(name=>name.trim()).filter(Boolean);if(!names.length)return setError("บิลต้องมีสินค้าอย่างน้อย 1 รายการ");const selected=names.map(name=>services.find(service=>service.name.toLowerCase()===name.toLowerCase()));if(selected.some(item=>!item))return setError("ชื่อเมนูบางรายการไม่ตรงกับเมนูที่เปิดขาย");setBusy(order.id);const{error:rpcError}=await supabase.rpc("replace_chill_order_items",{p_bill_id:order.id,p_items:selected.map(item=>({service_id:item.id,item_note:null}))});if(rpcError)setError(rpcError.message||"แก้รายการไม่สำเร็จ");else setOrders(current=>current.map(row=>row.id===order.id?{...row,bill_items:selected.map(item=>({service_id:item.id,name_snapshot:item.name,item_note:null}))}:row));setBusy("")}async function editDetails(order){const table=window.prompt("โต๊ะ / จุดรับออเดอร์",order.table_number||"");if(table===null)return;const note=window.prompt("หมายเหตุถึงครัว",order.notes||"");if(note===null)return;setBusy(order.id);const{error:rpcError}=await supabase.rpc("update_chill_order_details",{p_bill_id:order.id,p_table_number:table,p_note:note});if(rpcError)setError(rpcError.message||"บันทึกรายละเอียดไม่สำเร็จ");else setOrders(current=>current.map(row=>row.id===order.id?{...row,table_number:table,notes:note}:row));setBusy("")}async function cancelOrder(order){if(!window.confirm("ยืนยันยกเลิกบิล "+(order.bill_number||"")+" และคืนยอด/สต๊อกตามระบบเดิมหรือไม่?"))return;const reason=window.prompt("เหตุผลที่ยกเลิก","ยกเลิกจาก Kitchen Mini");if(reason===null)return;setBusy(order.id);const{error:rpcError}=await supabase.rpc("cancel_bill_safely",{p_bill_id:order.id,p_reason:reason});if(rpcError)setError(rpcError.message||"ยกเลิกบิลไม่สำเร็จ");else setOrders(current=>current.filter(row=>row.id!==order.id));setBusy("")}const count=orders.length;')
        .replace('const items=order.bill_items||[],elapsed=', 'const items=order.bill_items||[],groupedItems=[...items.reduce((map,item)=>{const key=item.name_snapshot+"::"+(item.item_note||"");const row=map.get(key);row?row.quantity++:map.set(key,{...item,quantity:1});return map},new Map).values()],elapsed=')
        .replace('children:items.length?items.map((item,index)=>e.jsxs("div",{className:"sabinagisa-pos-inbox__item",children:[item.name_snapshot,item.item_note&&e.jsx("small",{children:"↳ "+item.item_note})]},index)):"ไม่มีรายการสินค้า"', 'children:groupedItems.length?groupedItems.map((item,index)=>e.jsxs("div",{className:"sabinagisa-pos-inbox__item",children:[item.name_snapshot,item.quantity>1&&e.jsx("b",{children:" ×"+item.quantity}),item.item_note&&e.jsx("small",{children:"↳ "+item.item_note})]},index)):"ไม่มีรายการสินค้า"')
        .replace('children:busy===order.id?"กำลังบันทึก...":action})]},order.id)', 'children:busy===order.id?"กำลังบันทึก...":action}),e.jsxs("div",{className:"sabinagisa-pos-inbox__actions",children:[order.kitchen_status==="received"&&e.jsx("button",{type:"button",disabled:busy===order.id,onClick:()=>editItems(order),children:"แก้รายการ"}),e.jsx("button",{type:"button",disabled:busy===order.id,onClick:()=>editDetails(order),children:"รายละเอียด"}),e.jsx("button",{type:"button",disabled:busy===order.id,onClick:()=>cancelOrder(order),children:"ยกเลิก"})]})]},order.id)')
      const stateAwareKitchenMini = kitchenMiniPos
        .replace('const count=orders.length;return e.jsxs("div",{className:"sabinagisa-pos-inbox",children:[', 'const count=orders.length;const kitchenMascotByState={idle:"/assets/sabinagisa/kitchen-idle.webp",new:"/assets/sabinagisa/kitchen-new.webp",cooking:"/assets/sabinagisa/kitchen-cooking.webp",ready:"/assets/sabinagisa/kitchen-ready.webp"};const kitchenCopyByState={idle:{title:"ยังไม่มีออเดอร์เข้าครัว",subtitle:"เมื่อมีออเดอร์ใหม่ ระบบจะแจ้งที่นี่"},new:{title:"มีออเดอร์ใหม่เข้าครัว",subtitle:"กรุณาตรวจสอบรายการและเริ่มทำ"},cooking:{title:"กำลังทำอาหาร",subtitle:"ติดตามสถานะออเดอร์ที่กำลังดำเนินการ"},ready:{title:"ออเดอร์พร้อมเสิร์ฟ",subtitle:"กรุณานำออเดอร์ไปเสิร์ฟ"}};const kitchenState=orders.some(order=>order.kitchen_status==="received")?"new":orders.some(order=>order.kitchen_status==="ready")?"ready":orders.some(order=>order.kitchen_status==="preparing")?"cooking":"idle";return e.jsxs("div",{className:"sabinagisa-pos-inbox",children:[')
        .replace('className:"sabinagisa-pos-inbox__trigger",onClick:()=>setOpen(value=>!value)', 'className:"sabinagisa-pos-inbox__trigger","aria-label":"Kitchen Mini · "+count+" ออเดอร์",onClick:()=>setOpen(value=>!value)')
        .replace('className:"sabinagisa-pos-inbox__trigger",onClick:toggleMini', 'className:"sabinagisa-pos-inbox__trigger","aria-label":"Kitchen Mini · "+count+" ออเดอร์",onClick:toggleMini')
        .replace('loading?e.jsx("div",{className:"sabinagisa-pos-inbox__empty",children:"กำลังโหลดออเดอร์..."}):count?e.jsx("div",{className:"sabinagisa-pos-inbox__list",children:orders.map', 'loading?e.jsx("div",{className:"sabinagisa-pos-inbox__empty",children:"กำลังโหลดออเดอร์..."}):e.jsxs("div",{children:[e.jsxs("div",{className:count?"sabinagisa-pos-inbox__state-banner":"sabinagisa-pos-inbox__empty-state","data-kitchen-state":kitchenState,children:[e.jsx("img",{className:"sabinagisa-pos-inbox__state-mascot",src:kitchenMascotByState[kitchenState],alt:""}),e.jsx("strong",{className:"sabinagisa-pos-inbox__state-title",children:kitchenCopyByState[kitchenState].title}),e.jsx("p",{className:"sabinagisa-pos-inbox__state-subtitle",children:kitchenCopyByState[kitchenState].subtitle})]}),count?e.jsx("div",{className:"sabinagisa-pos-inbox__list",children:orders.map')
        .replace('}):e.jsx("div",{className:"sabinagisa-pos-inbox__empty",children:"ไม่มีออเดอร์ค้างในครัว"})]', '}):null]})]')
        .replace('children:[e.jsx("span",{children:"♨ Kitchen Mini"}),e.jsx("b",{children:count})]', 'children:[e.jsxs("span",{className:"sabinagisa-pos-inbox__trigger-brand",children:[e.jsx("img",{src:"/assets/sabinagisa/kitchen-idle.webp",alt:"",className:"sabinagisa-pos-inbox__avatar"}),e.jsx("span",{children:"Kitchen Mini"})]}),e.jsx("b",{className:count?"has-orders":"is-empty",children:count})]')
        .replace('className:"sabinagisa-pos-inbox__avatar"})', 'className:"sabinagisa-pos-inbox__avatar",draggable:!1})')
        .replace('order.order_type==="takeaway"?"🥡 กลับบ้าน":order.table_number?"🍽 โต๊ะ "+order.table_number:order.bill_number||"🍽 ออเดอร์"', 'order.order_type==="takeaway"?"กลับบ้าน":order.table_number?"โต๊ะ "+order.table_number:order.bill_number||"ออเดอร์"')
      for (const marker of ['kitchen-idle.webp', 'kitchen-new.webp', 'kitchen-cooking.webp', 'kitchen-ready.webp', 'มีออเดอร์ใหม่เข้าครัว', 'กำลังทำอาหาร', 'ออเดอร์พร้อมเสิร์ฟ', 'sabinagisa-pos-inbox__state-mascot']) {
        if (!stateAwareKitchenMini.includes(marker)) throw new Error(`Kitchen Mini mascot mapping missing: ${marker}`)
      }
      if (stateAwareKitchenMini.includes('♨ Kitchen Mini') || stateAwareKitchenMini.includes('sabinagisa-pos-inbox__chef-art') || stateAwareKitchenMini.includes('🥡') || stateAwareKitchenMini.includes('🍽')) throw new Error('Kitchen Mini still contains an emoji or generic mascot.')
      const draggableKitchenMini = stateAwareKitchenMini
        .replace('className:"sabinagisa-pos-inbox",children:[', 'className:"sabinagisa-pos-inbox",style:{left:position.x,top:position.y,position:"fixed",width:"min(350px,calc(100vw - 28px))",zIndex:10002},children:[')
        .replace('onClick:()=>setOpen(value=>!value),children:[e.jsxs("span",{className:"sabinagisa-pos-inbox__trigger-brand"', 'onClick:toggleMini,onPointerDown:dragStart,onPointerMove:dragMove,onPointerUp:dragEnd,onPointerCancel:dragEnd,children:[e.jsxs("span",{className:"sabinagisa-pos-inbox__trigger-brand"')
        .replace('onPointerCancel:dragEnd,children:', 'onPointerCancel:dragEnd,onDragStart:event=>event.preventDefault(),draggable:!1,children:')
      if (!draggableKitchenMini.includes('dragStart')) throw new Error('Kitchen Mini draggable pointer handlers were not applied.')
      if (!draggableKitchenMini.includes('const[services,setServices]=React.useState([]),[position,setPosition]') || !draggableKitchenMini.includes('const dragRef=React.useRef(null)')) throw new Error('Kitchen Mini drag state is missing from the component scope.')
      if (!draggableKitchenMini.includes('cancel_bill_safely') || !draggableKitchenMini.includes('replace_chill_order_items') || !draggableKitchenMini.includes(' ×')) throw new Error('Kitchen Mini lost a retained order-management capability during transformation.')
      content = draggableKitchenMini
    }

    // Kitchen Mini lives only inside the restaurant POS. Remove the separate
    // Kitchen Board route and navigation entry, leaving Garage navigation and
    // permissions untouched.
    if (file.endsWith('index-vaWnYKxf.js')) {
      const profileStepEyebrow = 'w.jsx("span",{className:"login-card__eyebrow",children:"STEP 01 · PROFILE"}),'
      if (!content.includes(profileStepEyebrow)) throw new Error('Login profile step label changed; refusing to remove unexpected markup.')
      content = content.replace(profileStepEyebrow, 'w.jsx("span",{className:"login-card__eyebrow",children:"GHOST·LAB × SABINAGISA · TEAM ACCESS"}),')
      const oldLoginBrand = 'w.jsxs("div",{className:"login-brand",children:[w.jsxs("div",{className:"font-display login-brand__name",children:["GHOST",w.jsx("span",{className:"login-brand__dot",children:"·"}),"LAB"]}),w.jsx("div",{className:"login-brand__subtitle",children:"ゴースト ラボ"})]})'
      const newLoginBrand = 'w.jsxs("div",{className:"login-brand",children:[w.jsx("div",{className:"login-brand__wordmark",children:"GHOST·LAB × SABINAGISA"}),w.jsx("div",{className:"login-brand__kicker",children:"TWO SOULS, ONE GARAGE"}),w.jsx("div",{className:"login-brand__kanji",children:"技 · 味 · 心"}),w.jsx("div",{className:"login-brand__reading",children:"わざ · あじ · こころ"}),w.jsx("div",{className:"login-brand__services",children:"งานช่าง · บริการ · อาหาร · ประสบการณ์"}),w.jsxs("div",{className:"login-brand__manifesto",children:[w.jsx("span",{children:"二つの世界、ひとつの美学。"}),w.jsx("span",{children:"สองธุรกิจ หนึ่งมาตรฐาน"})]}),w.jsxs("div",{className:"login-brand__selectors","aria-label":"เลือกทีม",children:[w.jsxs("button",{type:"button",className:"login-brand__zone login-brand__zone--sabinagisa",onMouseEnter:()=>previewBrand("sabinagisa"),onFocus:()=>previewBrand("sabinagisa"),onClick:()=>lockBrand("sabinagisa"),children:[w.jsx("span",{children:"FOOD & DRINK"}),w.jsx("strong",{children:"SABINAGISA"}),w.jsx("small",{children:"ร้านอาหารญี่ปุ่น"})]}),w.jsxs("button",{type:"button",className:"login-brand__zone login-brand__zone--garage",onMouseEnter:()=>previewBrand("garage"),onFocus:()=>previewBrand("garage"),onClick:()=>lockBrand("garage"),children:[w.jsx("span",{children:"GARAGE TEAM"}),w.jsx("strong",{children:"Ghost Lab Garage"}),w.jsx("small",{children:"งานช่างและบริการ"})]})]})]})'
      const interactiveLoginBrand = newLoginBrand
        .replace('className:"login-brand__zone login-brand__zone--sabinagisa",onMouseEnter', 'className:`login-brand__zone login-brand__zone--sabinagisa${activeBrand==="sabinagisa"?" is-active":""}`,"aria-pressed":activeBrand==="sabinagisa",onMouseEnter')
        .replace('className:"login-brand__zone login-brand__zone--garage",onMouseEnter', 'className:`login-brand__zone login-brand__zone--garage${activeBrand==="garage"?" is-active":""}`,"aria-pressed":activeBrand==="garage",onMouseEnter')
      if (!content.includes(oldLoginBrand)) throw new Error('Login brand markup changed; refusing to replace the bilingual brand text.')
      content = content.replace(oldLoginBrand, interactiveLoginBrand)

      // The login opens as a dual-brand landing page. The brand cards remain
      // active after selection so users can switch teams in place.
      const loginStateMarker = 'function p_(){const[t,e]=k.useState([]),[r,n]=k.useState(""),[s,i]=k.useState(null),[o,a]=k.useState("profile"),[l,u]=k.useState(""),[d,c]=k.useState(""),[h,f]=k.useState(!1),'
      if (!content.includes(loginStateMarker)) throw new Error('Login state changed; refusing to install dual-brand selection without matching auth flow.')
      content = content.replace(loginStateMarker, loginStateMarker + '[activeBrand,setActiveBrand]=k.useState(null),[lockedBrand,setLockedBrand]=k.useState(null),')
      const loginSearchMarker = 'function g(R){i(R),u(""),c(""),a("pin")}const _=r.trim().toLowerCase()'
      if (!content.includes(loginSearchMarker)) throw new Error('Login profile selection changed; refusing to alter the production auth workflow.')
      content = content.replace(loginSearchMarker, 'function previewBrand(R){if(lockedBrand||Date.now()<(window.__loginSuppressHoverUntil||0))return;window.clearTimeout(window.__loginBrandPreviewTimer),setActiveBrand(R)}function clearBrandPreview(){if(lockedBrand)return;window.clearTimeout(window.__loginBrandPreviewTimer),window.__loginBrandPreviewTimer=window.setTimeout(()=>setActiveBrand(null),150)}function lockBrand(R){if(h)return;window.clearTimeout(window.__loginBrandPreviewTimer),setLockedBrand(R),setActiveBrand(R),i(null),u(""),c(""),a("profile"),n("")}function g(R){if(activeBrand)setLockedBrand(activeBrand);i(R),u(""),c(""),a("pin")}const _=r.trim().toLowerCase()')
      content = content.replace('staff:b.filter(U=>f_(U)===R.key)', 'staff:b.filter(U=>(f_(U)===R.key||f_(U)==="shared")&&R.key===(activeBrand==="sabinagisa"?"chill":"garage"))')
      content = content.replace('children:[b.length,"/",t.length," คน"]', 'children:[E.reduce((R,U)=>R+U.staff.length,0)," คน"]')
      content = content.replace('const h_=[{key:"garage",title:"Ghost Lab",subtitle:"Garage Team"}', 'const h_=[{key:"garage",title:"GHOST LAB GARAGE",subtitle:"Garage Team"}')
      const loginRootMarker = 'w.jsx("main",{className:"login-page",children:w.jsxs("section",{className:"login-shell","aria-label":"เข้าสู่ระบบ Ghost Lab",children:['
      if (!content.includes(loginRootMarker)) throw new Error('Login shell changed; refusing to apply brand lock behavior to an unknown layout.')
      content = content.replace(loginRootMarker, 'w.jsx("main",{className:"login-page","data-brand":activeBrand||"default",children:w.jsxs("section",{className:"login-shell","data-brand":activeBrand||"default","data-locked":lockedBrand?"true":"false","aria-label":"เข้าสู่ระบบ Ghost Lab",onMouseLeave:clearBrandPreview,children:[')
      const brandPanelHeader = 'w.jsx("h1",{children:"เลือกโปรไฟล์ของคุณ"})'
      if (!content.includes(brandPanelHeader)) throw new Error('Login panel heading changed; refusing to build the profile selector without matching markup.')
      content = content.replace('children:"GHOST·LAB × SABINAGISA · TEAM ACCESS"', 'children:activeBrand==="sabinagisa"?"SABINAGISA · FOOD & DRINK TEAM":"GHOST LAB GARAGE · GARAGE TEAM"')
      content = content.replace('children:"← เปลี่ยนโปรไฟล์"', 'children:"← เปลี่ยนโปรไฟล์"')
      const oldKitchenNav = '{key:"chill-kitchen",permission:"chill_access",label:"Kitchen Board",path:"/chill/kitchen",allow:[I.OWNER,I.CEO,I.CHILL_MANAGER,I.CHILL_STAFF]},'
      const oldKitchenRoute = 'w.jsx(ge,{path:"/chill/kitchen",element:w.jsx(Oe,{branchKey:"chill",allow:[I.OWNER,I.CEO,I.CHILL_MANAGER,I.CHILL_STAFF],permission:"chill_access",children:w.jsx(Ae,{title:"SABINAGISA Kitchen",sub:"Kitchen Display System",children:w.jsx(S_,{})})})}),'
      if (!content.includes(oldKitchenNav) || !content.includes(oldKitchenRoute)) throw new Error('Recovered Kitchen Board route changed; refusing to remove the separate kitchen page.')
      content = content.replace(oldKitchenNav, '').replace(oldKitchenRoute, '')
      content += ';document.addEventListener("wheel",event=>{const list=event.target.closest?.(".login-card--profiles .staff-groups");if(!list||list.scrollHeight<=list.clientHeight)return;const unit=event.deltaMode===1?16:event.deltaMode===2?list.clientHeight:1;event.preventDefault();list.scrollTop+=event.deltaY*unit},{capture:true,passive:false});'
    }

    // Legacy order alerts now lead to the restaurant POS, where Kitchen Mini
    // opens itself for new tickets. Never point staff at the removed board.
    if (file.endsWith('order-notifications.js')) {
      const oldKitchenPath = "const KITCHEN_PATH = '/chill/kitchen'"
      if (!content.includes(oldKitchenPath)) throw new Error('Order notification destination changed; refusing to keep a dead Kitchen Board link.')
      content = content.replace(oldKitchenPath, "const KITCHEN_PATH = '/chill'")
    }

    if (file.endsWith('ChillKitchen-ctZhfUP1.js')) {
      const oldKitchenItems = 'e.jsx("ul",{children:(w=s.bill_items)==null?void 0:w.map((S,D)=>e.jsx("li",{children:e.jsxs("span",{children:[S.name_snapshot,S.item_note&&e.jsxs("small",{style:{display:"block",color:"#e5c158"},children:["↳ ",S.item_note]})]})},`${S.name_snapshot}-${D}`))})'
      const newKitchenItems = 'e.jsx("ul",{children:(()=>{const V=new Map;for(const I of s.bill_items||[]){const J=`${I.name_snapshot}::${I.item_note||""}`,K=V.get(J);K?K.quantity+=1:V.set(J,{...I,quantity:1})}return[...V.values()]})().map((S,D)=>e.jsx("li",{children:e.jsxs("span",{children:[S.name_snapshot,e.jsx("strong",{style:{color:"#e5c158",marginLeft:8},children:["x",S.quantity]}),S.item_note&&e.jsxs("small",{style:{display:"block",color:"#e5c158"},children:["↳ ",S.item_note]})]})},`${S.name_snapshot}-${S.item_note||""}-${D}`))})'
      if (!content.includes(oldKitchenItems)) {
        throw new Error('Recovered Kitchen bundle changed unexpectedly; refusing to build without item quantity grouping.')
      }
      content = content.replace(oldKitchenItems, newKitchenItems)
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
const themeControls = `<script>(()=>{const saved=localStorage.getItem('ghostlab-theme')||'dark';document.documentElement.dataset.theme=saved;const paint=()=>{document.querySelectorAll('[data-theme-toggle]').forEach(button=>{const light=document.documentElement.dataset.theme==='light';button.textContent=light?'☾ มืด':'☀ สว่าง';button.setAttribute('aria-label',light?'เปลี่ยนเป็นโหมดมืด':'เปลี่ยนเป็นโหมดสว่าง')})};document.addEventListener('DOMContentLoaded',paint);document.addEventListener('click',event=>{const button=event.target.closest('[data-theme-toggle]');if(!button)return;const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('ghostlab-theme',next);paint()})})()</script>`
const loginFontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&amp;family=Inter:wght@400;500;600;700&amp;family=Noto+Sans+Thai:wght@400;500;600;700&amp;family=Noto+Serif+JP:wght@400;500;600&amp;display=swap" rel="stylesheet">`
const themedIndex = index.replaceAll('/assets/', `/assets/${release}/`).replace('</head>', `${loginFontLinks}${themeControls}</head>`)
await writeFile(path.join(outputRoot, 'index.html'), themedIndex)
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
    '    Z = Y || de,\n    safeManualDiscountPct = Math.min(100, Math.max(0, Number(manualDiscountPct) || 0)),\n    manualDiscountAmount = Math.min(N.total, Math.round(N.total * safeManualDiscountPct / 100)),\n    O = M || de ? 0 : Math.max(0, N.total - manualDiscountAmount),\n    discountPctForBill = W > 0 ? Number((100 - O / W * 100).toFixed(2)) : 0,\n    pe = M || p.commission_eligible === false ? 0 : n.commission_flat;',
  )
  manualDiscountContent = manualDiscountContent.replace('discount_pct: M ? 0 : de ? 100 : N.percentage,', 'discount_pct: discountPctForBill,')
  const commissionMarker = '        }), e.jsxs("div", {\n          className: "font-mono",\n          style: {\n            display: "flex",\n            justifyContent: "space-between",\n            fontSize: 13,\n            color: "var(--ghost-gray)",\n            marginBottom: 6\n          },\n          children: [e.jsx("span", {\n            children: "COMMISSION (FLAT)"'
  const manualDiscountField = '        }), !M && e.jsxs("label", {style: {display: "grid", gap: 6, marginBottom: 12}, children: [e.jsx("span", {style: {color: "var(--ghost-gray)", fontSize: 10, letterSpacing: .8}, children: "ส่วนลด (%)"}), e.jsx("input", {className: "input", type: "number", min: 0, max: 100, step: "0.01", inputMode: "decimal", placeholder: "เช่น 10", value: safeManualDiscountPct || "", onChange: t => setManualDiscountPct(Math.min(100, Math.max(0, Number(t.target.value) || 0)))}), manualDiscountAmount > 0 && e.jsxs("span", {className: "font-mono", style: {color: "#84d6a8", fontSize: 11}, children: ["−¥", manualDiscountAmount.toLocaleString(), " จากยอดหลังส่วนลดสมาชิก"]})]}), e.jsxs("div", {\n          className: "font-mono",\n          style: {\n            display: "flex",\n            justifyContent: "space-between",\n            fontSize: 13,\n            color: "var(--ghost-gray)",\n            marginBottom: 6\n          },\n          children: [e.jsx("span", {\n            children: "COMMISSION (FLAT)"'
  manualDiscountContent = manualDiscountContent.replace(commissionMarker, manualDiscountField)
}
await writeFile(manualDiscountAsset, manualDiscountContent)

// Show the signed-in staff member's own commission in the bill composer.
// SABINAGISA is explicitly marked as an estimate because its final amount is
// frozen from the attendance snapshot when the bill is submitted.
const personalCommissionPosAsset = path.join(outputRoot, 'assets', release, 'POSPage-CxiIf3bD.js')
let personalCommissionPos = await readFile(personalCommissionPosAsset, 'utf8')
if (!personalCommissionPos.includes('preview_my_bill_commission')) {
  personalCommissionPos = personalCommissionPos.replace(
    '    [vehicleClass, setVehicleClass] = i.useState("standard");',
    '    [vehicleClass, setVehicleClass] = i.useState("standard"),\n    [commissionPreview, setCommissionPreview] = i.useState(null);',
  )
  personalCommissionPos = personalCommissionPos.replace(
    '    restaurantCommission = calculateSabinagisaCommissionPool(n.key, O, new Date()),\n    pe = M || p.commission_eligible === false ? 0 : n.key === "chill" ? restaurantCommission.amount : n.commission_flat;',
    '    restaurantCommission = calculateSabinagisaCommissionPool(n.key, O, new Date()),\n    garageTechnician = n.key === "garage" && ["head_mechanic","mechanic","mechanic_trainee"].includes(p?.role),\n    pe = M || p.commission_eligible === false ? 0 : n.key === "chill" ? restaurantCommission.amount : garageTechnician ? 0 : n.commission_flat;',
  )
  personalCommissionPos = personalCommissionPos.replace(
    '(n.key === "chill" ? 0 : pe)',
    '(n.key === "chill" || garageTechnician ? 0 : pe)',
  )
  personalCommissionPos = personalCommissionPos.replace(
    /    restaurantCommission = calculateSabinagisaCommissionPool\(n\.key, O, new Date\(\)\),\r?\n    garageTechnician = n\.key === "garage" && \["head_mechanic","mechanic","mechanic_trainee"\]\.includes\(p\?\.role\),\r?\n    pe = M \|\| p\.commission_eligible === false \? 0 : n\.key === "chill" \? restaurantCommission\.amount : garageTechnician \? 0 : n\.commission_flat;\r?\n  function me\(t\) \{/,
    '    restaurantCommission = calculateSabinagisaCommissionPool(n.key, O, new Date()),\n    garageTechnician = n.key === "garage" && ["head_mechanic","mechanic","mechanic_trainee"].includes(p?.role),\n    pe = M || p.commission_eligible === false ? 0 : n.key === "chill" ? restaurantCommission.amount : garageTechnician ? 0 : n.commission_flat;\n  i.useEffect(() => {\n    let active = true;\n    if (M || O <= 0) { setCommissionPreview({myAmount: 0, finalPool: 0, activeCount: 0, isPeak: false, mode: n.key === "chill" ? "ON_WORK_ALL" : "INDIVIDUAL"}); return () => { active = false; }; }\n    const timer = setTimeout(() => { x.rpc("preview_my_bill_commission", {p_branch_id: n.id, p_order_total: O}).then(({data, error}) => { if (!active) return; error ? console.error("[Ghost Lab] Failed to preview personal commission:", error) : setCommissionPreview(data); }); }, 180);\n    return () => { active = false; clearTimeout(timer); };\n  }, [n.id, n.key, O, M, p == null ? void 0 : p.id]);\n  const displayedPersonalCommission = M ? 0 : Number((commissionPreview == null ? void 0 : commissionPreview.myAmount) ?? (n.key === "chill" || garageTechnician ? 0 : pe));\n  function me(t) {',
  )
  personalCommissionPos = personalCommissionPos.replace(
    '          children: ["SERVICE BILL \\xB7 COMMISSION \\xA5", h.commission_flat.toLocaleString(), " ", "/ BILL \\xB7 ", m, " SERVICES"]',
    '          children: v ? ["SERVICE BILL · COMMISSION POOL · ACTIVE SNAPSHOT · ", m, " SERVICES"] : n.key === "garage" && ["head_mechanic","mechanic","mechanic_trainee"].includes(p?.role) ? ["NORMAL — ¥10,000 · PEAK — ¥15,000 · Peak Time 18:00–00:00 · ",m," SERVICES"] : ["SERVICE BILL · ค่าคอมของผู้เปิดบิล ¥", h.commission_flat.toLocaleString(), " / BILL · ", m, " SERVICES"]',
  )
  personalCommissionPos = personalCommissionPos.replace(
    '            children: "COMMISSION (FLAT)"',
    '            children: n.key === "chill" ? "ค่าคอมของฉัน (ประมาณ)" : "ค่าคอมของฉัน"',
  )
  personalCommissionPos = personalCommissionPos.replace(
    '            children: ["\\xA5", pe.toLocaleString()]',
    '            children: ["¥", displayedPersonalCommission.toLocaleString()]',
  )
  // The earlier POS patch already wraps the pool amount with the shift check;
  // replace that transformed expression too, otherwise the UI still shows the
  // full restaurant pool even though the per-staff preview RPC was injected.
  personalCommissionPos = personalCommissionPos.replace(
    '            children: ["\\xA5", (n.key === "chill" && !isOnShift ? 0 : pe).toLocaleString()]',
    '            children: ["\\xA5", displayedPersonalCommission.toLocaleString()]',
  )
  if (!personalCommissionPos.includes('preview_my_bill_commission') || !personalCommissionPos.includes('displayedPersonalCommission') || personalCommissionPos.includes('(n.key === "chill" && !isOnShift ? 0 : pe).toLocaleString()')) {
    throw new Error('Failed to inject the personal commission preview into the POS bundle.')
  }
}
await writeFile(personalCommissionPosAsset, personalCommissionPos)


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
  const weeklyClosingComponent = `function WeeklyClosingPanel({range:e,onRangeChange:n,staff:c}){const l=["owner","god","ceo","accountant"].includes(c?.role),o=["owner","god"].includes(c?.role),[h,m]=i.useState(null),[s,A]=i.useState(!1),[D,T]=i.useState(""),[F,M]=i.useState(""),[O,C]=i.useState(""),[B,I]=i.useState(!1);async function H(){if(!l||!e.start||!e.end)return;m(null),C(""),A(!0);const{data:a,error:R}=await p.rpc("get_weekly_closing_preview",{p_start:e.start,p_end:e.end});A(!1),R?C(R.message||"โหลดข้อมูลปิดรอบไม่สำเร็จ"):(m(a||null),T(String(a?.closing_cash_balance??"")))}i.useEffect(()=>{H()},[e.start,e.end,c?.role]);function L(){const a=new Date,R=(a.getDay()+6)%7,U=new Date(a);U.setDate(a.getDate()-R);const G=new Date(U);G.setDate(U.getDate()+6),n({start:dateKey(U),end:dateKey(G)})}async function $(){const a=Number(D);if(!Number.isFinite(a)||a<0){C("กรุณากรอกยอดกองกลางที่นับได้");return}if(!window.confirm("ยืนยันปิดรอบนี้? หลังปิดแล้ว บิล ค่าใช้จ่าย และรายการกองกลางในช่วงนี้จะแก้ไขไม่ได้"))return;I(!0),C("");const{error:R}=await p.rpc("close_weekly_period",{p_start:e.start,p_end:e.end,p_counted_cash:Math.round(a),p_note:F||null});I(!1),R?C(R.message||"ปิดรอบไม่สำเร็จ"):(M(""),await H())}async function q(){if(!window.confirm("ยืนยันหักค่าคอมเก่าที่ยังไม่ผูกกับกองกลางทั้งหมด? ระบบจะลงรายการปรับยอดเพียงครั้งเดียว"))return;I(!0),C("");const{data:a,error:R}=await p.rpc("reconcile_unlinked_commission_payouts",{p_note:"ปรับยอดจากหน้าปิดรอบ"});I(!1),R?C(R.message||"ปรับยอดไม่สำเร็จ"):(window.alert("ปรับยอดแล้ว "+Number(a?.count||0)+" รายการ รวม ¥"+Number(a?.total||0).toLocaleString()),await H())}const P=a=>"¥"+Number(a||0).toLocaleString(),W=h?.existing_closing,K=[["ยอดขาย",h?.sales_total],["เงินสด",h?.cash_sales],["เงินโอน",h?.transfer_sales],["ค่าใช้จ่าย",-Number(h?.expense_total||0)],["ค่าคอมที่เกิด",h?.commission_generated],["จ่ายค่าคอมแล้ว",-Number(h?.commission_paid||0)],["ค่าคอมค้างจ่าย",h?.commission_pending],["กองกลางคงเหลือ",h?.closing_cash_balance]];if(!l)return null;return t.jsxs("section",{id:"weekly-closing-panel",className:"panel",style:{borderColor:"rgba(196,30,42,.45)",marginTop:14,padding:18},children:[t.jsxs("div",{style:{alignItems:"center",display:"flex",flexWrap:"wrap",gap:10,justifyContent:"space-between"},children:[t.jsxs("div",{children:[t.jsx("strong",{style:{fontSize:14},children:"ตรวจยอดและปิดรอบ"}),t.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,marginTop:3},children:"ยอดขาย · ค่าใช้จ่าย · ค่าคอม · กองกลาง ในช่วงวันที่ด้านบน"})]}),t.jsx("button",{type:"button",className:"btn",onClick:L,children:"เลือก จันทร์–อาทิตย์"})]}),s?t.jsx("p",{style:{color:"var(--ghost-gray)",fontSize:12},children:"กำลังตรวจยอด..."}):h&&t.jsxs(t.Fragment,{children:[t.jsx("div",{style:{display:"grid",gap:8,gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",marginTop:14},children:K.map(([a,R])=>t.jsxs("div",{style:{background:"#191b1e",border:"1px solid var(--line)",borderRadius:8,padding:"11px 12px"},children:[t.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10},children:a}),t.jsx("b",{className:"font-mono",style:{color:Number(R)<0?"#f18b92":a==="กองกลางคงเหลือ"?"#84d6a8":"var(--bone)",display:"block",fontSize:17,marginTop:5},children:P(R)})]},a))}),t.jsxs("div",{style:{alignItems:"center",borderTop:"1px solid var(--line)",display:"flex",flexWrap:"wrap",gap:14,justifyContent:"space-between",marginTop:14,paddingTop:14},children:[t.jsxs("div",{style:{fontSize:11},children:[t.jsxs("span",{style:{color:"var(--ghost-gray)",children:["สุทธิจากการดำเนินงาน ",t.jsx("b",{style:{color:"#84d6a8"},children:P(h.operating_net)})]}),t.jsxs("span",{style:{color:"var(--ghost-gray)",marginLeft:16},children:["กองกลางเปลี่ยนแปลง ",t.jsx("b",{children:P(h.expected_net_change)})]})]}),W?t.jsxs("div",{style:{color:"#84d6a8",fontSize:12,textAlign:"right"},children:[t.jsx("b",{children:"✓ ปิดรอบแล้ว"}),t.jsxs("div",{style:{fontSize:10,marginTop:2},children:["นับได้ ",P(W.counted_cash)," · ส่วนต่าง ",P(W.discrepancy)]})]}):o?t.jsxs("div",{style:{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"flex-end"},children:[t.jsx("input",{className:"input",inputMode:"numeric",placeholder:"ยอดกองกลางที่นับได้",value:D,onChange:a=>T(a.target.value.replace(/[^0-9]/g,"")),style:{minWidth:190}}),t.jsx("input",{className:"input",placeholder:"หมายเหตุ (ถ้ามี)",value:F,onChange:a=>M(a.target.value),style:{minWidth:180}}),t.jsx("button",{type:"button",className:"btn btn-primary",disabled:B,onClick:$,children:B?"กำลังบันทึก...":"ยืนยันปิดรอบ"})]}):t.jsx("span",{style:{color:"var(--ghost-gray)",fontSize:11},children:"CEO ดูรายงานได้ · Owner เป็นผู้ปิดรอบ"})]}),Number(h.unlinked_payout_count||0)>0&&t.jsxs("div",{style:{alignItems:"center",background:"rgba(255,184,77,.08)",border:"1px solid rgba(255,184,77,.35)",borderRadius:8,display:"flex",flexWrap:"wrap",gap:10,justifyContent:"space-between",marginTop:12,padding:"10px 12px"},children:[t.jsxs("div",{style:{fontSize:11},children:[t.jsx("b",{style:{color:"#f0c96b"},children:"พบค่าคอมเก่าที่ยังไม่หักกองกลาง"}),t.jsxs("div",{style:{color:"var(--ghost-gray)",marginTop:2},children:[h.unlinked_payout_count," รายการ · ",P(h.unlinked_payout_total)]})]}),o&&t.jsx("button",{type:"button",className:"btn",disabled:B,onClick:q,children:"ปรับยอดค่าคอมเก่า"})]})]}),O&&t.jsx("div",{style:{background:"rgba(196,30,42,.12)",border:"1px solid rgba(196,30,42,.4)",borderRadius:7,color:"#f18b92",fontSize:11,marginTop:12,padding:"9px 11px"},children:O})]})}`
  const oldDailyStart = 'function N(){'
  const oldDailyState = '[d,b]=i.useState(new Date().toISOString().slice(0,10)),[u,y]'
  const oldDailyQuery = 'async function _(){const e=new Date(`${d}T00:00:00`),n=new Date(`${d}T23:59:59.999`);let c=p.from("bills").select("total,payment_method,status,branch_id,branches:branch_id(name,key)").gte("created_at",e.toISOString()).lte("created_at",n.toISOString()),l=p.from("expenses").select("amount,status,branch_id,branches:branch_id(name,key)").gte("created_at",e.toISOString()).lte("created_at",n.toISOString()),o=p.from("stock_items")'
  const newDailyQuery = 'async function _(){let c=p.from("bills").select("total,payment_method,status,branch_id,created_at,branches:branch_id(name,key)"),l=p.from("expenses").select("amount,status,branch_id,created_at,branches:branch_id(name,key)"),o=p.from("stock_items");if(d.start){const e=new Date(d.start+"T00:00:00");c=c.gte("created_at",e.toISOString()),l=l.gte("created_at",e.toISOString())}if(d.end||d.start){const[e,n,a]=(d.end||d.start).split("-").map(Number),B=new Date(e,n-1,a+1);B.setHours(0,0,0,0),c=c.lt("created_at",B.toISOString()),l=l.lt("created_at",B.toISOString())}o=o'
  const oldDailyInput = 't.jsx("input",{className:"input",type:"date",value:d,onChange:e=>b(e.target.value),style:{width:170}})'
  const newDailyInput = 't.jsx(SummaryDateRange,{value:d,onChange:b,open:rangeOpen,setOpen:setRangeOpen,onClear:()=>{b({start:"",end:""}),setRangeOpen(!1)},onToday:()=>{const e=dateKey();b({start:e,end:e}),setRangeOpen(!1)}})'
  const oldDailyAggregate = 'const S=[...new Set(u.map(e=>{var n;return(n=e.branches)==null?void 0:n.key}).filter(Boolean))].map(e=>{var h,m;const n=u.filter(s=>{var a;return((a=s.branches)==null?void 0:a.key)===e&&s.status!=="rejected"}),c=f.filter(s=>{var a;return((a=s.branches)==null?void 0:a.key)===e&&s.status==="paid"}),l=n.reduce((s,a)=>s+Number(a.total||0),0),o=c.reduce((s,a)=>s+Number(a.amount||0),0);return{key:e,name:((m=(h=n[0])==null?void 0:h.branches)==null?void 0:m.name)||e,count:n.length,sales:l,cash:n.filter(s=>s.payment_method!=="transfer").reduce((s,a)=>s+Number(a.total||0),0),transfer:n.filter(s=>s.payment_method==="transfer").reduce((s,a)=>s+Number(a.total||0),0),cost:o,net:l-o}});'
  const newDailyAggregate = 'const summaryLocalDay=e=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(e)),formatSummaryDate=e=>{if(!e)return"";const[n,c,l]=e.split("-");return l+"/"+c+"/"+n},dayKeys=d.start&&d.end?(()=>{const e=[],n=new Date(d.start+"T00:00:00"),c=new Date(d.end+"T00:00:00");for(;n<=c;)e.push(dateKey(n)),n.setDate(n.getDate()+1);return e.reverse()})():d.start?[d.start]:[...new Set([...u.filter(e=>e.status!=="rejected"),...f.filter(e=>e.status==="paid")].map(e=>summaryLocalDay(e.created_at)))].sort().reverse(),S=dayKeys.map(e=>{const n=u.filter(n=>n.status!=="rejected"&&summaryLocalDay(n.created_at)===e),c=f.filter(n=>n.status==="paid"&&summaryLocalDay(n.created_at)===e),l=[...new Set([...n,...c].map(e=>{var n;return(n=e.branches)==null?void 0:n.key}).filter(Boolean))].map(l=>{var h,m;const s=n.filter(e=>{var n;return((n=e.branches)==null?void 0:n.key)===l}),a=c.filter(e=>{var n;return((n=e.branches)==null?void 0:n.key)===l}),B=s.reduce((e,n)=>e+Number(n.total||0),0),I=a.reduce((e,n)=>e+Number(n.amount||0),0);return{key:l,name:((m=(h=s[0]||a[0])==null?void 0:h.branches)==null?void 0:m.name)||l,count:s.length,sales:B,cash:s.filter(e=>e.payment_method!=="transfer").reduce((e,n)=>e+Number(n.total||0),0),transfer:s.filter(e=>e.payment_method==="transfer").reduce((e,n)=>e+Number(n.total||0),0),cost:I,net:B-I}});return{date:e,summaries:l}}),periodTotals=[...new Set(S.flatMap(e=>e.summaries.map(e=>e.key)))].map(e=>{const n=S.flatMap(n=>n.summaries.filter(n=>n.key===e));return{key:e,name:n[0]?.name||e,count:n.reduce((e,n)=>e+n.count,0),sales:n.reduce((e,n)=>e+n.sales,0),cash:n.reduce((e,n)=>e+n.cash,0),transfer:n.reduce((e,n)=>e+n.transfer,0),cost:n.reduce((e,n)=>e+n.cost,0),net:n.reduce((e,n)=>e+n.net,0)}}),summaryRangeLabel=d.start?(formatSummaryDate(d.start)+" - "+formatSummaryDate(d.end||d.start)):"ทุกช่วงเวลา";'
  const oldDailyCards = 't.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12},children:S.map(e=>t.jsxs("section",{className:"panel",children:[t.jsx("strong",{children:e.name}),t.jsxs("div",{className:"font-mono",style:{fontSize:27,margin:"10px 0"},children:["¥",e.sales.toLocaleString()]}),t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:6,fontSize:12},children:[t.jsx("span",{children:"จำนวนบิล"}),t.jsx("b",{children:e.count}),t.jsx("span",{children:"เงินสด"}),t.jsxs("b",{children:["¥",e.cash.toLocaleString()]}),t.jsx("span",{children:"เงินโอน"}),t.jsxs("b",{children:["¥",e.transfer.toLocaleString()]}),t.jsx("span",{children:"ค่าใช้จ่าย"}),t.jsxs("b",{style:{color:"#f18b92"},children:["-¥",e.cost.toLocaleString()]}),t.jsx("span",{children:"สุทธิ"}),t.jsxs("b",{style:{color:e.net>=0?"#84d6a8":"#f18b92"},children:["¥",e.net.toLocaleString()]})]})]},e.key))})'
  const newDailyCards = 't.jsxs("div",{children:[t.jsxs("section",{children:[t.jsxs("div",{style:{alignItems:"end",display:"flex",justifyContent:"space-between",margin:"0 2px 8px"},children:[t.jsxs("div",{children:[t.jsx("strong",{style:{fontSize:14},children:"ผลรวมช่วงวันที่"}),t.jsx("div",{className:"font-mono",style:{color:"var(--ghost-gray)",fontSize:11,marginTop:3},children:summaryRangeLabel})]}),t.jsxs("small",{style:{color:"var(--ghost-gray)"},children:[periodTotals.reduce((e,n)=>e+n.count,0)," บิล"]})]}),periodTotals.length===0?t.jsx("div",{className:"panel",style:{color:"var(--ghost-gray)",fontSize:12,padding:18,textAlign:"center"},children:"ไม่มีบิลที่ใช้งานหรือค่าใช้จ่ายที่ชำระแล้วในช่วงนี้"}):t.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12},children:periodTotals.map(e=>t.jsxs("section",{className:"panel",children:[t.jsx("strong",{children:e.name}),t.jsxs("div",{className:"font-mono",style:{fontSize:27,margin:"10px 0"},children:["¥",e.sales.toLocaleString()]}),t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:6,fontSize:12},children:[t.jsx("span",{children:"จำนวนบิล"}),t.jsx("b",{children:e.count}),t.jsx("span",{children:"เงินสด"}),t.jsxs("b",{children:["¥",e.cash.toLocaleString()]}),t.jsx("span",{children:"เงินโอน"}),t.jsxs("b",{children:["¥",e.transfer.toLocaleString()]}),t.jsx("span",{children:"ค่าใช้จ่าย"}),t.jsxs("b",{style:{color:"#f18b92"},children:["-¥",e.cost.toLocaleString()]}),t.jsx("span",{children:"สุทธิ"}),t.jsxs("b",{style:{color:e.net>=0?"#84d6a8":"#f18b92"},children:["¥",e.net.toLocaleString()]})]})]},e.key))})]}),t.jsxs("section",{className:"panel",style:{marginTop:14,padding:"14px 18px"},children:[t.jsxs("div",{style:{alignItems:"center",display:"flex",justifyContent:"space-between",paddingBottom:8},children:[t.jsx("strong",{children:"รายละเอียดรายวัน"}),t.jsxs("small",{style:{color:"var(--ghost-gray)"},children:[S.length," วัน"]})]}),S.flatMap(e=>e.summaries.length?e.summaries.map(n=>t.jsxs("div",{style:{alignItems:"center",borderTop:"1px solid var(--line)",display:"flex",flexWrap:"wrap",gap:10,justifyContent:"space-between",padding:"10px 0"},children:[t.jsxs("div",{style:{minWidth:190},children:[t.jsx("strong",{style:{fontSize:12},children:new Date(e.date+"T00:00:00").toLocaleDateString("th-TH",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}),t.jsx("div",{style:{color:"var(--ghost-gray)",fontSize:10,marginTop:2},children:n.name})]}),t.jsxs("div",{style:{alignItems:"center",display:"flex",flexWrap:"wrap",gap:18,fontSize:11},children:[t.jsxs("span",{children:["บิล ",t.jsx("b",{children:n.count})]}),t.jsxs("span",{children:["ยอด ",t.jsxs("b",{className:"font-mono",children:["¥",n.sales.toLocaleString()]})]}),t.jsxs("span",{children:["ค่าใช้จ่าย ",t.jsxs("b",{className:"font-mono",style:{color:"#f18b92"},children:["-¥",n.cost.toLocaleString()]})]}),t.jsxs("span",{children:["สุทธิ ",t.jsxs("b",{className:"font-mono",style:{color:n.net>=0?"#84d6a8":"#f18b92"},children:["¥",n.net.toLocaleString()]})]})]})]},e.date+"-"+n.key)): [t.jsxs("div",{style:{borderTop:"1px solid var(--line)",color:"var(--ghost-gray)",display:"flex",fontSize:11,justifyContent:"space-between",padding:"10px 0"},children:[t.jsx("span",{children:new Date(e.date+"T00:00:00").toLocaleDateString("th-TH",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}),t.jsx("span",{children:"ไม่มีรายการ"})]},e.date)])]})]})'
  const redactedWeeklyClosingComponent = weeklyClosingComponent
    .replace('["ค่าคอมค้างจ่าย",h?.commission_pending],["กองกลางคงเหลือ",h?.closing_cash_balance]]', '["ค่าคอมค้างจ่าย",h?.commission_pending],...[o?[["กองกลางคงเหลือ",h?.closing_cash_balance]]:[]]]')
    .replace('t.jsxs("span",{style:{color:"var(--ghost-gray)",marginLeft:16},children:["กองกลางเปลี่ยนแปลง ",t.jsx("b",{children:P(h.expected_net_change)})]})', 'o?t.jsxs("span",{style:{color:"var(--ghost-gray)",marginLeft:16},children:["กองกลางเปลี่ยนแปลง ",t.jsx("b",{children:P(h.expected_net_change)})]}):t.jsx("span",{style:{color:"var(--ghost-gray)",marginLeft:16},children:"ข้อมูลกองกลางสำหรับ Owner/GOD เท่านั้น"})')
  if (!redactedWeeklyClosingComponent.includes('...[o?[["กองกลางคงเหลือ"') || !redactedWeeklyClosingComponent.includes('ข้อมูลกองกลางสำหรับ Owner/GOD เท่านั้น')) {
    throw new Error('Recovered Weekly Closing bundle changed unexpectedly; refusing to build with unredacted cash summary.')
  }
  const dailyMarkers = [oldDailyStart, oldDailyState, oldDailyQuery, oldDailyInput, oldDailyAggregate, oldDailyCards]
  if (dailyMarkers.some(marker => !dailySummaryContent.includes(marker))) {
    throw new Error('Recovered Daily Summary bundle changed unexpectedly; refusing to build without complete date-range filtering.')
  }
  dailySummaryContent = dailySummaryContent
    .replace(oldDailyStart, dailyRangeComponent + redactedWeeklyClosingComponent + oldDailyStart)
    .replace(oldDailyState, '[d,b]=i.useState(()=>{const e=dateKey();return{start:e,end:e}}),[rangeOpen,setRangeOpen]=i.useState(!1),[u,y]')
    .replace(oldDailyQuery, newDailyQuery)
    .replace(oldDailyInput, newDailyInput)
    .replace(oldDailyAggregate, newDailyAggregate)
    .replace(oldDailyCards, newDailyCards)
      // The first WeeklyClosingPanel span needs its style object closed before
      // JSX children. Without this normalization the emitted dynamic chunk is
      // syntactically invalid and the Daily Summary route cannot load.
      .replace(
        'style:{color:"var(--ghost-gray)",children:["สุทธิจากการดำเนินงาน "',
        'style:{color:"var(--ghost-gray)"},children:["สุทธิจากการดำเนินงาน "',
      )
  const stockWarningMarker = ',t.jsxs("section",{className:"panel",style:{marginTop:14},children:[t.jsx("strong",{children:"⚠ แจ้งเตือนสต๊อก / ใกล้หมดอายุ"})'
  if (!dailySummaryContent.includes(stockWarningMarker)) {
    throw new Error('Recovered Daily Summary bundle changed unexpectedly; weekly closing insertion point is missing.')
  }
  dailySummaryContent = dailySummaryContent.replace(
    stockWarningMarker,
    ',t.jsx(WeeklyClosingPanel,{range:d,onRangeChange:b,staff:r})' + stockWarningMarker,
  )
}
if (!dailySummaryContent.includes('function WeeklyClosingPanel(')) {
  throw new Error('Weekly closing preview is missing; refusing to replace the daily summary without preserving weekly closing.')
}
dailySummaryContent = dailySummaryContent.replace('export{N as default};', 'export{N as default,WeeklyClosingPanel};')
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

// Rebuild the stock screen from the maintained source page so the recovered
// production bundle gets the same stock dashboard and real adjustment flows.
const stockSourcePath = path.join(projectRoot, 'src', 'pages', 'Stock.jsx')
const stockSource = (await readFile(stockSourcePath, 'utf8'))
  .replace(/^import \{ useEffect, useState \} from ['"]react['"];?\r?\n/m, '')
  .replace(/^import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?\r?\n/m, '')
  .replace(/^import \{ useAuth \} from ['"]\.\.\/context\/AuthContext['"];?\r?\n/m, '')
  .replace(/^import ['"]\.\/Stock\.css['"];?\r?\n/m, '')
const { outputFiles: stockOutputFiles } = await buildJsx({
  stdin: { contents: stockSource, sourcefile: 'Stock.jsx', resolveDir: path.dirname(stockSourcePath), loader: 'jsx' },
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  // React.createElement is the classic JSX factory expected by the bundled
  // React export. Using the jsx-runtime helper here misroutes children into
  // its key argument and crashes pages when props are null.
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  plugins: [{ name: 'ghost-react-runtime', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: './expenses-react-runtime.js', external: true }))
  } }],
})
await writeFile(path.join(outputRoot, 'assets', release, 'Stock-CpMhahKC.js'), `import{u as useAuth,r as React,s as supabase,j as e}from"./index-vaWnYKxf.js";const{useEffect,useState}=React;${stockOutputFiles[0].text}`)

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
  const oldMemberSave = 'const U=c?await f.from("members").insert(M).select().single():await f.from("members").update(M).eq("id",a.id).select().single();if(U.error)return S(!1),s(U.error.message);if(h&&!$){const A=await f.from("member_memberships").insert({member_id:U.data.id,tier:n.key,monthly_fee:n.monthlyFee,months:u,total_paid:z,started_at:Y,expires_at:V});if(A.error)return S(!1),s(A.error.message)}'
  const atomicMemberSave = 'const K="ghostlab-member-save:"+(a.id||"new");let R;try{R=JSON.parse(localStorage.getItem(K)||"null");if(!R){R={requestId:globalThis.crypto?.randomUUID?.()||"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,char=>{const random=Math.random()*16|0;return(char==="x"?random:(random&3|8)).toString(16)}),memberId:c?null:a.id,memberData:M,membershipData:h&&!$?{tier:n.key,monthly_fee:n.monthlyFee,months:u,total_paid:z,started_at:Y,expires_at:V}:null};localStorage.setItem(K,JSON.stringify(R))}}catch{return S(!1),s("บันทึกคำขอสำรองไม่ได้ จึงยังไม่ส่งข้อมูลสมาชิก")}let U;try{U=await f.rpc("save_member_with_membership_atomic",{p_request_id:R.requestId,p_member_id:R.memberId,p_member_data:R.memberData,p_membership_data:R.membershipData})}catch(E){console.error("[Ghost Lab] Member save failed:",E);return S(!1),s(E?.message||"บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง")}if(U.error)return S(!1),s(U.error.message);try{localStorage.removeItem(K)}catch{}'
  if (memberDraftContent.includes(oldMemberSave)) {
    memberDraftContent = memberDraftContent.replace(oldMemberSave, atomicMemberSave)
  } else if (!memberDraftContent.includes('save_member_with_membership_atomic')) {
    throw new Error('Recovered Member save flow changed; refusing to leave split member/membership writes.')
  }
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

const expensesSourcePath = path.join(projectRoot, 'src', 'pages', 'Expenses.jsx')
const expensesSource = (await readFile(expensesSourcePath, 'utf8'))
  .replace(/^import \{ useEffect, useState \} from ['"]react['"];?\r?\n/m, '')
  .replace(/^import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?\r?\n/m, '')
  .replace(/^import \{ useAuth \} from ['"]\.\.\/context\/AuthContext['"];?\r?\n/m, '')
  .replace(/^import ['"]\.\/Expenses\.css['"];?\r?\n/m, '')
  .replace(/^import sabinagisaHero from ['"]\.\.\/assets\/dashboard-sabinagisa-v1\.png['"];?\r?\n/m, '')
await writeFile(path.join(outputRoot, 'assets', release, 'expenses-react-runtime.js'), 'import{r as React}from"./index-vaWnYKxf.js";export default React;export const{createElement,forwardRef,createContext,useContext,useMemo}=React;')
const { outputFiles: expenseOutputFiles } = await buildJsx({
  stdin: { contents: expensesSource, sourcefile: 'Expenses.jsx', resolveDir: path.dirname(expensesSourcePath), loader: 'jsx' },
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  plugins: [{ name: 'ghost-react-runtime', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: './expenses-react-runtime.js', external: true }))
  } }],
})
const expenseBindings = 'import{u as useAuth,r as React,s as supabase,j as e}from"./index-vaWnYKxf.js";const{useEffect,useState}=React;const sabinagisaHero="./dashboard-sabinagisa-v1.png";'
await writeFile(expenseAsset, `${expenseBindings}${expenseOutputFiles[0].text}`)

// Render commission payouts from the maintained React page while sharing the
// running app's React/Supabase/Auth instances and existing payout RPCs.
const commissionAsset = path.join(outputRoot, 'assets', release, 'CommissionPayouts-C8fCkOtW.js')
const commissionSourcePath = path.join(projectRoot, 'src', 'pages', 'CommissionPayouts.jsx')
const commissionSource = (await readFile(commissionSourcePath, 'utf8'))
  .replace(/^import\s+\{[^}]+\}\s+from\s+['"]react['"];?\r?\n/m, '')
  .replace(/^import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?\r?\n/m, '')
  .replace(/^import \{ useAuth \} from ['"]\.\.\/context\/AuthContext['"];?\r?\n/m, '')
  .replace(/^import ['"]\.\/CommissionPayouts\.css['"];?\r?\n/m, '')
const { outputFiles: commissionOutputFiles } = await buildJsx({
  stdin: { contents: commissionSource, sourcefile: 'CommissionPayouts.jsx', resolveDir: path.dirname(commissionSourcePath), loader: 'jsx' },
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  plugins: [{ name: 'ghost-react-runtime', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: './expenses-react-runtime.js', external: true }))
  } }],
})
const commissionBindings = 'import{u as useAuth,r as React,s as supabase}from"./index-vaWnYKxf.js";const{useCallback,useEffect,useMemo,useRef,useState}=React;'
await writeFile(commissionAsset, `${commissionBindings}${commissionOutputFiles[0].text}`)

// Replace the legacy daily summary route with the maintained Daily Closing
// Console while keeping the existing weekly-close workflow available below it.
const dailyClosingSourcePath = path.join(projectRoot, 'src', 'pages', 'DailySummary.jsx')
let dailyClosingSource = await readFile(dailyClosingSourcePath, 'utf8')
dailyClosingSource = dailyClosingSource
  .replace(/^import \{ useEffect, useMemo, useRef, useState \} from ['"]react['"];?\r?\n/m, '')
  .replace(/^import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?\r?\n/m, '')
  .replace(/^import \{ useAuth \} from ['"]\.\.\/context\/AuthContext['"];?\r?\n/m, '')
  .replace(/^import ['"]\.\/DailySummary\.css['"];?\r?\n/m, '')
  .replace(
    'export default function DailySummary() {',
    'import { WeeklyClosingPanel } from "./DailySummary-OhyJk4lZ.js"\nexport default function DailySummary() {',
  )
  .replace(
    '    <section className="daily-closing__lower">',
    '    <WeeklyClosingPanel range={{ start: dateFrom, end: dateTo || dateFrom }} onRangeChange={({ start, end }) => { setDateFrom(start); setDateTo(end) }} staff={staff} />\n    <section className="daily-closing__lower">',
  )
if (!dailyClosingSource.includes('<WeeklyClosingPanel range={{ start: dateFrom')) {
  throw new Error('Maintained Daily Closing Console could not preserve the weekly closing workflow.')
}
const dailyClosingAsset = path.join(outputRoot, 'assets', release, 'DailyClosingConsole.js')
const { outputFiles: dailyClosingOutputFiles } = await buildJsx({
  stdin: { contents: dailyClosingSource, sourcefile: 'DailyClosingConsole.jsx', resolveDir: path.dirname(dailyClosingSourcePath), loader: 'jsx' },
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  plugins: [{ name: 'ghost-react-runtime', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: './expenses-react-runtime.js', external: true }))
    build.onResolve({ filter: /^\.\/DailySummary-OhyJk4lZ\.js$/ }, () => ({ path: './DailySummary-OhyJk4lZ.js', external: true }))
  } }],
})
const dailyClosingBindings = 'import{u as useAuth,r as React,s as supabase}from"./index-vaWnYKxf.js";const{useEffect,useMemo,useRef,useState}=React;'
await writeFile(dailyClosingAsset, `${dailyClosingBindings}${dailyClosingOutputFiles[0].text}`)

const appAsset = path.join(outputRoot, 'assets', release, 'index-vaWnYKxf.js')
let appContent = await readFile(appAsset, 'utf8')
const oldDailyRoute = 'import("./DailySummary-OhyJk4lZ.js")'
if (!appContent.includes(oldDailyRoute)) {
  throw new Error('Daily Summary route marker is missing; refusing to ship the old page.')
}
appContent = appContent.replace(oldDailyRoute, 'import("./DailyClosingConsole.js")')
await writeFile(appAsset, appContent)
await verifyAssetReferences(outputRoot)
