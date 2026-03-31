#!/usr/bin/env node
const { existsSync, readdirSync, readFileSync } = require('fs')
const { spawnSync } = require('child_process')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8'
  })

  return {
    ok: res.status === 0,
    stdout: res.stdout || '',
    stderr: res.stderr || ''
  }
}

function checkBuildConfig() {
  const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))

  const checks = []
  checks.push({
    name: 'build.win.target = nsis',
    ok: pkg.build && pkg.build.win && (pkg.build.win.target === 'nsis' || (Array.isArray(pkg.build.win.target) && pkg.build.win.target.includes('nsis')))
  })

  checks.push({
    name: 'icon Windows configurado',
    ok: pkg.build && pkg.build.win && typeof pkg.build.win.icon === 'string' && existsSync(path.join(projectRoot, pkg.build.win.icon))
  })

  checks.push({
    name: 'script build:win:docker presente',
    ok: pkg.scripts && typeof pkg.scripts['build:win:docker'] === 'string'
  })

  checks.push({
    name: 'script ci:smoke presente',
    ok: pkg.scripts && typeof pkg.scripts['ci:smoke'] === 'string'
  })

  return checks
}

function checkArtifacts() {
  const distDir = path.join(projectRoot, 'dist')
  if (!existsSync(distDir)) {
    return [{ name: 'pasta dist existe', ok: false }]
  }

  const files = readdirSync(distDir)
  const hasExe = files.some((f) => f.toLowerCase().endsWith('.exe'))
  const hasYml = files.some((f) => f.toLowerCase() === 'latest.yml')

  return [
    { name: 'artefato .exe gerado', ok: hasExe },
    { name: 'latest.yml gerado', ok: hasYml }
  ]
}

function formatLine(item) {
  return `${item.ok ? 'PASS' : 'FAIL'} - ${item.name}`
}

function main() {
  const all = []

  all.push(...checkBuildConfig())

  const smoke = run('npm', ['run', '-s', 'ci:smoke'])
  all.push({ name: 'smoke test automatico', ok: smoke.ok })

  all.push(...checkArtifacts())

  process.stdout.write('=== MediaLayers Release Check ===\n')
  all.forEach((item) => process.stdout.write(`${formatLine(item)}\n`))

  if (!smoke.ok) {
    process.stdout.write('\n--- Smoke test output ---\n')
    process.stdout.write((smoke.stdout + '\n' + smoke.stderr).trim() + '\n')
  }

  const failed = all.filter((i) => !i.ok)
  process.exit(failed.length ? 1 : 0)
}

main()
