import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const pkgPath = path.join(projectRoot, 'package.json')
const changelogPath = path.join(projectRoot, 'CHANGELOG.md')
const releaseDir = path.join(projectRoot, 'release')

// 与国内网络环境保持一致的镜像设置（构建产物时下载 WiX/NSIS/Electron 二进制用）
process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/'

// ---------- 解析参数 ----------
const rawArgs = process.argv.slice(2)
const dryRun = rawArgs.includes('--dry-run')
const positional = rawArgs.filter((a) => !a.startsWith('--'))
const version = (positional[0] || '').replace(/^v/i, '')

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('[Release] 用法: npm run release -- <版本号> [发布备注] [--dry-run]')
  console.error('[Release] 示例: npm run release -- 1.1.0 "首个标准发行版"')
  process.exit(1)
}
const tag = `v${version}`
const noteFromArgs = positional[1]

function run(cmd, args, opts = {}) {
  console.log(`[Release] $ ${cmd} ${args.join(' ')}`)
  const result = spawnSync(cmd, args, { cwd: projectRoot, stdio: 'inherit', shell: true, ...opts })
  if (result.status !== 0) {
    console.error(`[Release] 命令失败 (退出码 ${result.status}): ${cmd} ${args.join(' ')}`)
    process.exit(result.status || 1)
  }
}

// ---------- 1. 前置校验 ----------
console.log(`[Release] ========================================`)
console.log(`[Release] 准备发布 ${tag}${dryRun ? ' (dry-run, 不会提交/推送/发布)' : ''}`)
console.log(`[Release] ========================================`)

const gitStatus = spawnSync('git', ['status', '--porcelain'], { cwd: projectRoot, shell: true, encoding: 'utf8' })
if (gitStatus.stdout && gitStatus.stdout.trim().length > 0) {
  console.error('[Release] 工作区不干净，请先提交或暂存 (stash) 全部变更后再发布。')
  console.error(gitStatus.stdout)
  process.exit(1)
}

const existingTag = spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
  cwd: projectRoot,
  shell: true,
  encoding: 'utf8',
})
if (existingTag.status === 0) {
  console.error(`[Release] 标签 ${tag} 已存在，请更换版本号或先删除旧标签。`)
  process.exit(1)
}

// ---------- 2. 更新 package.json 版本号 ----------
const pkgRaw = fs.readFileSync(pkgPath, 'utf8')
if (!new RegExp(`"version": "${version.replace(/\./g, '\\.')}"`).test(pkgRaw)) {
  fs.writeFileSync(pkgPath, pkgRaw.replace(/"version": "[^"]+"/, `"version": "${version}"`), 'utf8')
  console.log(`[Release] package.json 版本号已更新为 ${version}`)
} else {
  console.log(`[Release] package.json 版本号已是 ${version}`)
}

// ---------- 3. 从 CHANGELOG 提取发布说明 ----------
function extractNotes() {
  if (noteFromArgs) return noteFromArgs
  if (!fs.existsSync(changelogPath)) return `MD Preview Tool ${tag} 发行版`
  const content = fs.readFileSync(changelogPath, 'utf8')
  const sectionRegex = new RegExp(`## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`)
  const match = content.match(sectionRegex)
  return match ? match[1].trim() : `MD Preview Tool ${tag} 发行版`
}

// ---------- 4. 构建全部发行产物 (NSIS + MSI + Portable + Zip) ----------
run('npm', ['run', 'dist:all'], { env: { ...process.env } })

const artifacts = [
  `MD Preview Tool-Setup-${version}-x64.exe`,
  `MD Preview Tool-${version}-x64.msi`,
  `MD Preview Tool-${version}-x64-portable.exe`,
  `MD Preview Tool-${version}-x64-portable.zip`,
]
  .map((f) => path.join(releaseDir, f))
  .filter((p) => fs.existsSync(p))

if (artifacts.length < 4) {
  console.warn('[Release] 警告: 期望 4 个发行产物，实际仅找到:')
  artifacts.forEach((p) => console.warn(`  - ${path.basename(p)}`))
  if (artifacts.length === 0) {
    console.error('[Release] 未找到任何发行产物，中止发布。')
    process.exit(1)
  }
}

console.log(`[Release] ========================================`)
console.log(`[Release] 构建完成，发行产物:`)
artifacts.forEach((p) => {
  const sizeMb = (fs.statSync(p).size / (1024 * 1024)).toFixed(2)
  console.log(`[Release]  📦 ${path.basename(p)} (${sizeMb} MB)`)
})
console.log(`[Release] ========================================`)

if (dryRun) {
  console.log('[Release] dry-run 结束：未修改 git 历史，未推送，未创建 Release。')
  process.exit(0)
}

// ---------- 5. 提交版本号变更并打标签 ----------
run('git', ['add', 'package.json', 'package-lock.json', 'CHANGELOG.md'])
run('git', ['commit', '-m', `chore(release): ${tag}`])
run('git', ['tag', '-a', tag, '-m', `MD Preview Tool ${tag}`])
run('git', ['push', 'origin', 'main'])
run('git', ['push', 'origin', tag])

// ---------- 6. 创建 GitHub Release 并上传产物 ----------
const notesFile = path.join(projectRoot, 'tmp', `release-notes-${version}.md`)
fs.mkdirSync(path.dirname(notesFile), { recursive: true })
fs.writeFileSync(notesFile, extractNotes(), 'utf8')

run('gh', [
  'release',
  'create',
  tag,
  ...artifacts,
  '--title',
  `MD Preview Tool ${tag}`,
  '--notes-file',
  notesFile,
])

console.log(`[Release] ========================================`)
console.log(`[Release] 🎉 ${tag} 发布完成！`)
console.log(`[Release] 查看地址: https://github.com/JHJ1848/my-tools-api-tool-service/releases/tag/${tag}`)
console.log(`[Release] ========================================`)
