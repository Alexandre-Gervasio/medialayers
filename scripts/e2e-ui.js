#!/usr/bin/env node
const path = require('path')
const http = require('http')
const { _electron: electron } = require('playwright-core')

const projectRoot = path.resolve(__dirname, '..')

function log(message) {
  process.stdout.write(`[e2e-ui] ${message}\n`)
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }))
    })

    req.on('error', reject)
    req.setTimeout(4000, () => req.destroy(new Error('timeout')))
  })
}

async function waitForRemoteHealth() {
  let lastError = null
  for (let i = 0; i < 20; i += 1) {
    try {
      const response = await httpGet('http://127.0.0.1:3900/health')
      if (response.statusCode === 200 && response.body.includes('medialayers-remote')) {
        return
      }
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw lastError || new Error('Servidor remoto não respondeu')
}

async function main() {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      MEDIALAYERS_UPDATE_URL: '',
      MEDIALAYERS_DISABLE_CLOSE_PROMPT: '1'
    }
  })

  try {
    let page = await electronApp.firstWindow()
    for (let i = 0; i < 20; i += 1) {
      const windows = electronApp.windows()
      const matchedWindow = windows.find((candidate) => /index-daw\.html/i.test(candidate.url() || ''))
      if (matchedWindow) {
        page = matchedWindow
        break
      }

      try {
        const title = await page.title()
        if (/Controle/i.test(title)) break
      } catch {}

      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    await page.waitForSelector('#golden-layout-toolbar', { timeout: 15000 })
    await page.waitForSelector('#preview-canvas', { timeout: 15000 })
    await page.waitForSelector('#program-canvas', { timeout: 15000 })

    await page.click('#open-media-modal')
    await page.waitForSelector('#global-media-overlay', { timeout: 5000 })
    await page.click('[data-overlay-action="bible"]')
    await page.waitForSelector('#bible-modal', { timeout: 5000 })
    await page.selectOption('#bible-book', 'João')
    await page.fill('#bible-chapter', '3')
    await page.fill('#bible-verse-start', '16')
    await page.fill('#bible-verse-end', '16')
    await page.click('#bible-search-reference')
    await page.waitForSelector('#bible-results .result-card', { timeout: 15000 })
    await page.click('#bible-results .result-card')
    await page.waitForTimeout(250)

    await page.waitForSelector('#global-media-overlay', { state: 'hidden', timeout: 10000 })
    await page.click('[data-column-head="0"]')
    await page.waitForTimeout(400)

    await page.click('#plugin-menu-toggle')
    await page.waitForSelector('#plugin-menu.is-open', { timeout: 5000 })

    const selectedLabel = await page.textContent('#selected-layer-label')
    if (!selectedLabel || !selectedLabel.includes('Layer ativa')) {
      throw new Error('Toolbar não exibiu a camada ativa')
    }

    const propName = await page.inputValue('#prop-name')
    if (!propName || !propName.includes('Layer')) {
      throw new Error('Inspector não exibiu a layer master selecionada')
    }

    const clipInfo = await page.textContent('#properties-panel .clip-editor p:nth-of-type(2)')
    if (!clipInfo || !clipInfo.includes('Bíblia')) {
      throw new Error('Versículo não foi carregado no clip selecionado')
    }

    await page.fill('#prop-opacity', '0.5')
    await page.fill('#prop-volume', '0.4')
    await page.selectOption('#prop-muted', 'true')

    const mutedValue = await page.inputValue('#prop-muted')
    if (mutedValue !== 'true') {
      throw new Error('Controles master da layer não foram aplicados no inspector')
    }

    await waitForRemoteHealth()
    log('UI Electron, toolbar e servidor remoto: OK')
  } finally {
    await electronApp.close()
  }
}

main().catch((error) => {
  process.stderr.write(`[e2e-ui] FAIL: ${error.stack || error.message}\n`)
  process.exit(1)
})