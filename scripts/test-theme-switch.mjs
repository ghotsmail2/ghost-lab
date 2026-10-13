import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const buildScript = await readFile(new URL('./build-recovered.mjs', import.meta.url), 'utf8')

test('light and dark palettes cover the same global workspace surfaces', () => {
  for (const mode of ['light', 'dark']) {
    assert.match(buildScript, new RegExp(`html\\[data-theme="${mode}"\\]`))
    for (const surface of ['.app-header', '.panel', '.input', '.pos-hero', '.dashboard-hero']) {
      assert.ok(buildScript.includes(`html[data-theme="${mode}"] ${surface}`), `${mode} palette should style ${surface}`)
    }
    assert.ok(buildScript.includes(`html[data-theme="${mode}"] ${mode === 'light' ? '.table th' : 'table'}`), `${mode} palette should style tables`)
  }
  assert.ok(buildScript.includes('html[data-theme="dark"] .login-card'), 'dark palette should style login screens')
})

test('theme choice persists in the browser and can be changed from any workspace route', () => {
  assert.match(buildScript, /localStorage\.getItem\('ghostlab-theme'\)/)
  assert.match(buildScript, /localStorage\.getItem\('ghostlab-theme'\)\|\|'dark'/, 'dark mode should be the default when no preference exists')
  assert.match(buildScript, /localStorage\.setItem\('ghostlab-theme',next\)/)
  assert.match(buildScript, /document\.addEventListener\('click',event=>\{const button=event\.target\.closest\('\[data-theme-toggle\]'\)/)
})
