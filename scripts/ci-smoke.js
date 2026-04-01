#!/usr/bin/env node
const { existsSync } = require('fs')
const { spawnSync, spawn } = require('child_process')
const path = require('path')
const http = require('http')

const projectRoot = path.resolve(__dirname, '..')

function log(msg) {
  process.stdout.write(`[ci-smoke] ${msg}\n`)
}

function fail(msg) {
  process.stderr.write(`[ci-smoke] FAIL: ${msg}\n`)
  process.exit(1)
}

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    ...options
  })

  if (res.status !== 0) {
    fail(`${cmd} ${args.join(' ')}\n${res.stderr || res.stdout}`)
  }
}

function checkFiles() {
  const required = [
    'main.js',
    'preload.js',
    'webrtc-server.js',
    'src/controller/index-daw.html',
    'src/controller/app-daw.js',
    'src/output/index.html',
    'src/output/renderer.js',
    'src/ndi/ndi-manager.js',
    'scripts/e2e-ui.js',
    'assets/icon.ico'
  ]

  const missing = required.filter((p) => !existsSync(path.join(projectRoot, p)))
  if (missing.length) {
    fail(`Arquivos obrigatorios ausentes: ${missing.join(', ')}`)
  }

  log('Arquivos obrigatorios: OK')
}

function checkSyntax() {
  const files = [
    'main.js',
    'preload.js',
    'webrtc-server.js',
    'src/controller/app-daw.js',
    'src/output/renderer.js',
    'src/ndi/ndi-manager.js',
    'scripts/e2e-ui.js'
  ]

  files.forEach((file) => {
    run(process.execPath, ['--check', file])
  })

  log('Sintaxe Node/Electron: OK')
}

function checkNdiApi() {
  const ndi = require(path.join(projectRoot, 'src/ndi/ndi-manager.js'))
  const requiredFns = [
    'isAvailable',
    'findSources',
    'startReceiver',
    'stopReceiver',
    'stopAllReceivers',
    'startSender',
    'stopSender',
    'sendFrame'
  ]

  const missingFns = requiredFns.filter((fn) => typeof ndi[fn] !== 'function')
  if (missingFns.length) {
    fail(`API NDI incompleta: ${missingFns.join(', ')}`)
  }

  log('API NDI: OK')
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (err) {
          reject(err)
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(2500, () => {
      req.destroy(new Error('timeout'))
    })
  })
}

async function checkWebrtcServer() {
  const child = spawn(process.execPath, ['webrtc-server.js'], {
    cwd: projectRoot,
    stdio: 'ignore'
  })

  let lastErr = null
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 300))
    try {
      const status = await httpGetJson('http://127.0.0.1:3001/status')
      if (status && status.status === 'running') {
        child.kill('SIGINT')
        log('WebRTC signaling server: OK')
        return
      }
    } catch (err) {
      lastErr = err
    }
  }

  child.kill('SIGINT')
  fail(`WebRTC server nao respondeu /status (${lastErr ? lastErr.message : 'erro desconhecido'})`)
}

function checkRemoteControlWiring() {
  const mainJs = require('fs').readFileSync(path.join(projectRoot, 'main.js'), 'utf8')
  const markers = [
    'startRemoteControlServer',
    "remoteApp.get('/health'",
    "remote:command",
    "remote-control-command"
  ]

  const missing = markers.filter((m) => !mainJs.includes(m))
  if (missing.length) {
    fail(`Controle remoto incompleto em main.js: ${missing.join(', ')}`)
  }

  log('Controle remoto (wiring): OK')
}

function checkAutoUpdateWiring() {
  const mainJs = require('fs').readFileSync(path.join(projectRoot, 'main.js'), 'utf8')
  const preloadJs = require('fs').readFileSync(path.join(projectRoot, 'preload.js'), 'utf8')
  const mainMarkers = [
    'electron-updater',
    'checkForAppUpdates',
    "app-update-check",
    "app-update-install",
    "app-update-status"
  ]
  const preloadMarkers = [
    'appUpdateGetConfig',
    'appUpdateSetConfig',
    'appUpdateCheck',
    'appUpdateInstall',
    'onAppUpdateStatus'
  ]

  const missingMain = mainMarkers.filter((marker) => !mainJs.includes(marker))
  const missingPreload = preloadMarkers.filter((marker) => !preloadJs.includes(marker))

  if (missingMain.length || missingPreload.length) {
    fail(`Auto-update incompleto: ${[...missingMain, ...missingPreload].join(', ')}`)
  }

  log('Auto-update (wiring): OK')
}

async function main() {
  log('Iniciando smoke test automatizado')
  checkFiles()
  checkSyntax()
  checkNdiApi()
  checkRemoteControlWiring()
  checkAutoUpdateWiring()
  await checkWebrtcServer()
  log('SMOKE TEST PASS')
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err))
})
