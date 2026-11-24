import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifests = ['package.json', 'package-lock.json']
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const [requestedVersion, customNotes] = args.filter(arg => arg !== '--dry-run')
const current = readJson(root, 'package.json').version
const [major, minor, patch] = current.split(/[.-]/).map(Number)
const version = (requestedVersion ?? (dryRun ? `${major}.${minor}.${patch + 1}` : '')).replace(/^v/i, '')
const tag = `v${version}`

function readJson(directory, name) {
  return JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))
}

function run(command, arguments_, options = {}) {
  // Only static npm commands need the Windows shell to resolve npm.cmd.
  const result = spawnSync(command, arguments_, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32' && command === 'npm',
    ...options
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${arguments_.join(' ')} 失败`)
  return result.stdout
}

function setVersion(directory) {
  const pkg = readJson(directory, 'package.json')
  const lock = readJson(directory, 'package-lock.json')
  if (pkg.version === version && lock.version === version && lock.packages[''].version === version) return
  pkg.version = version
  lock.version = version
  lock.packages[''].version = version
  for (const [name, contents] of [['package.json', pkg], ['package-lock.json', lock]]) {
    fs.writeFileSync(path.join(directory, name), JSON.stringify(contents, null, 2) + '\n', 'utf8')
  }
}

function getNotes() {
  if (customNotes) return customNotes
  const sections = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').split(/^## /m)
  const entry = sections.find(section => section.startsWith(`[${version}]`))
  const notes = entry?.slice(entry.indexOf('\n') + 1).split(/^\[[^\]]+\]:/m)[0].trim()
  if (!notes && !dryRun) throw new Error(`CHANGELOG.md 缺少 ${version} 的发布说明`)
  return notes || `MD Preview Tool ${tag}`
}

function buildCandidate(candidate) {
  const files = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { stdio: 'pipe' })
  for (const file of new Set(files.split('\0').filter(Boolean))) {
    const source = path.join(root, file)
    if (!fs.statSync(source, { throwIfNoEntry: false })?.isFile()) continue
    const destination = path.join(candidate, file)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source, destination)
  }
  setVersion(candidate)

  run('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], { cwd: candidate })
  run('npm', ['run', 'lint'], { cwd: candidate })
  run('npm', ['run', 'dist:all'], { cwd: candidate })

  for (const name of [
    `MD Preview Tool-Setup-${version}-x64.exe`,
    `MD Preview Tool-${version}-x64.msi`,
    `MD Preview Tool-${version}-x64-portable.exe`,
    `MD Preview Tool-${version}-x64.zip`
  ]) {
    const artifact = fs.statSync(path.join(candidate, 'release', name), { throwIfNoEntry: false })
    if (!artifact?.isFile() || artifact.size === 0) throw new Error(`缺少发行包 ${name}`)
    console.log(`[Release] ${name} ${(artifact.size / (1024 * 1024)).toFixed(1)} MiB`)
  }
}

function validateRelease() {
  if (run('git', ['status', '--porcelain'], { stdio: 'pipe' }).trim()) {
    throw new Error('请先提交发版改动，确保工作区干净')
  }
  if (run('git', ['branch', '--show-current'], { stdio: 'pipe' }).trim() !== 'main') {
    throw new Error('正式发布须在 main 分支执行')
  }
  if (run('git', ['tag', '--list', tag], { stdio: 'pipe' }).trim()
    || run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], { stdio: 'pipe' }).trim()) {
    throw new Error(`标签 ${tag} 已存在`)
  }
}

try {
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
    throw new Error('用法: npm run release -- <版本号> [发布备注]，或 npm run release:dry -- [版本号]')
  }
  if (!dryRun) validateRelease()
  const notes = getNotes()
  const candidate = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'md-preview-release-'))
  try {
    console.log(`[Release] ${tag} 发版预检`)
    buildCandidate(candidate)
    if (dryRun) {
      console.log('[Release] 预检完成，工作区和远端保持原样。')
    } else {
      setVersion(root)
      run('git', ['add', ...manifests])
      if (run('git', ['diff', '--cached', '--name-only'], { stdio: 'pipe' }).trim()) {
        run('git', ['commit', '-m', `chore(release): ${tag}`])
      }
      const notesFile = path.join(candidate, 'release-notes.md')
      fs.writeFileSync(notesFile, notes + '\n', 'utf8')
      run('git', ['tag', '-a', tag, '--cleanup=verbatim', '-F', notesFile])
      run('git', ['push', '--atomic', 'origin', 'main', `refs/tags/${tag}`])
      console.log(`[Release] ${tag} 已推送，GitHub Actions 将构建并发布发行包。`)
    }
  } finally {
    fs.rmSync(candidate, { recursive: true, force: true, maxRetries: 3 })
  }
} catch (error) {
  console.error(`[Release] ${error.message}`)
  process.exitCode = 1
}
