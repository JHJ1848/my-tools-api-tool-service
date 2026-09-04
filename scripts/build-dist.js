import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// 1. 设置构建环境镜像，防止国内网络环境下 WiX / NSIS / Electron 下载超时
process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/'

// 2. 解析目标参数
const args = process.argv.slice(2)
let target = 'all' // 默认全部生成
for (const arg of args) {
  if (arg.startsWith('--target=')) {
    target = arg.split('=')[1].toLowerCase()
  } else if (['msi', 'nsis', 'portable', 'zip', 'all', 'dir'].includes(arg)) {
    target = arg
  }
}

console.log(`[BuildRelease] ========================================`)
console.log(`[BuildRelease] 开始构建 MD Preview Tool 发行包`)
console.log(`[BuildRelease] 目标格式: ${target.toUpperCase()}`)
console.log(`[BuildRelease] 镜像源: ${process.env.ELECTRON_MIRROR}`)
console.log(`[BuildRelease] ========================================`)

// 3. 执行 Vite 前端与 Electron TypeScript 编译
console.log(`[BuildRelease] [1/3] 执行 Vite 与 TypeScript 编译...`)
const buildResult = spawnSync('npx', ['vite', 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
})

if (buildResult.status !== 0) {
  console.error(`[BuildRelease] 编译失败，退出码: ${buildResult.status}`)
  process.exit(buildResult.status || 1)
}

// 4. 组装 electron-builder 参数
console.log(`[BuildRelease] [2/3] 正在调用 electron-builder 打包...`)
let builderArgs = []

if (target === 'msi') {
  builderArgs = ['electron-builder', '--win', 'msi', '--x64']
} else if (target === 'nsis') {
  builderArgs = ['electron-builder', '--win', 'nsis', '--x64']
} else if (target === 'portable') {
  builderArgs = ['electron-builder', '--win', 'portable', '--x64']
} else if (target === 'zip') {
  // 绿色目录版：zip 内为完整应用目录，解压后直接运行 exe，无需安装
  builderArgs = ['electron-builder', '--win', 'zip', '--x64']
} else if (target === 'dir') {
  builderArgs = ['electron-builder', '--dir', '--x64']
} else {
  // all: 标准安装器 (NSIS/MSI) + 单文件便携版 (Portable) + 绿色目录版 (Zip)
  builderArgs = ['electron-builder', '--win', 'msi', 'nsis', 'portable', 'zip', '--x64']
}

const builderResult = spawnSync('npx', builderArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
  },
})

if (builderResult.status !== 0) {
  console.error(`[BuildRelease] 打包失败，退出码: ${builderResult.status}`)
  process.exit(builderResult.status || 1)
}

// 5. 检查输出文件并生成发布报告
console.log(`[BuildRelease] [3/3] 检查并汇总生成发行物清单...`)
const releaseDir = path.join(projectRoot, 'release')
if (fs.existsSync(releaseDir)) {
  const files = fs.readdirSync(releaseDir)
  console.log(`[BuildRelease] 成功输出至目录: ${releaseDir}`)
  files.forEach((file) => {
    const filePath = path.join(releaseDir, file)
    const stat = fs.statSync(filePath)
    if (!stat.isDirectory()) {
      const sizeMb = (stat.size / (1024 * 1024)).toFixed(2)
      console.log(`  - 📦 ${file} (${sizeMb} MB)`)
    }
  })
}

console.log(`[BuildRelease] ========================================`)
console.log(`[BuildRelease] MD Preview Tool 发布包构建完成！`)
console.log(`[BuildRelease] ========================================`)
