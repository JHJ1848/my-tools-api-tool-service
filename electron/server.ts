import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const _currentFilename = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '')
const _currentDirname = _currentFilename ? path.dirname(_currentFilename) : process.cwd()

export interface WorkspaceConfig {
  configuredPath: string
  effectivePath: string
  exists: boolean
  fallbackToDesktop: boolean
  supportsDirectoryPicker: boolean
}

export interface ApiParamItem {
  name: string
  type: string
  required: string
  description: string
}

export interface ApiSectionItem {
  sectionType: 'requestParams' | 'requestBody'
  headingText: string
  headingId: string
  interfaceTitle: string
  interfaceHeadingText: string
  interfaceHeadingId: string
  path: string
  method: string
  pathParams: ApiParamItem[]
  params: ApiParamItem[]
  bodyExample: string
  sourceLine?: number
}

export interface TocItem {
  level: number
  text: string
  id: string
}

export interface SidebarData {
  sidebar: string
  scope: string
  files: string[]
  directories: string[]
  workspaceConfig: WorkspaceConfig
  cacheHit: boolean
}

export interface DocumentData {
  title: string
  content: string
  toc: string
  apiSections: ApiSectionItem[]
  apiSectionsVersion?: number
  path?: string
  cacheHit: boolean
  fileLastModified: number
  fileSize: number
}

export interface ServerStatus {
  running: boolean
  lanSharing?: boolean
  port: number
  lanIp: string
  lanUrl: string
  workspace: WorkspaceConfig
  timestamp: string
  uptime: number
}

// ---------------- Constants & SVGs ----------------

const WORKSPACE_CONFIG_KEY = 'markdown.workspace.path'
const DEFAULT_BASE_PATH = path.normalize(path.join(os.homedir(), 'Desktop'))
const SERVER_PORT = 9527

const FOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="none"></path></svg>`
const FILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`

const CHANGE_MARKER_REGEX = /^(.*?)(\s+\/change)\s*$/
const HEADING_REGEX = /^\s*(#{1,6})\s+(.+?)\s*$/
const API_NAME_REGEX = /^\s*-\s*(?:\*\*)?(?:接口名称|接口定义|名称)(?:\*\*)?\s*[:：]\s*`?(.+?)`?\s*$/
const API_PATH_REGEX = /^\s*-\s*(?:\*\*)?(?:接口路径|接口地址|请求路径|URL|Url|url)(?:\*\*)?\s*[:：]\s*`?(.+?)`?\s*$/
const API_METHOD_REGEX = /^\s*-\s*(?:\*\*)?(?:请求方式|请求方法|方法|Method|method)(?:\*\*)?\s*[:：]\s*`?([A-Za-z]+)`?\s*$/
const PATH_PARAM_PLACEHOLDER_REGEX = /\{([^{}]+)\}/g
const CODE_FENCE_REGEX = /^\s*```\s*(.*?)\s*$/

// ---------------- Network Helpers ----------------

export function getLanIpAddress(): string {
  const interfaces = os.networkInterfaces()
  const candidates: string[] = []

  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name]
    if (!list) continue
    for (const net of list) {
      const isV4 = net.family === 'IPv4' || (net as any).family === 4
      if (isV4 && !net.internal) {
        // Prioritize common private subnets
        if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.')) {
          return net.address
        }
        candidates.push(net.address)
      }
    }
  }

  if (candidates.length > 0) {
    return candidates[0]
  }

  return '127.0.0.1'
}

// ---------------- Workspace Config ----------------

function getWorkspaceConfigFile(): string {
  return path.join(os.homedir(), '.tool-service', 'markdown-preview.properties')
}

function getDesktopPath(): string {
  return path.normalize(path.join(os.homedir(), 'Desktop'))
}

function unescapeJavaPropertiesValue(val: string): string {
  if (!val) return ''
  // 1. Unescape \uXXXX
  let res = val.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16))
  })
  // 2. Unescape \:, \=, \ , etc.
  res = res.replace(/\\([:= ])/g, '$1')
  // 3. Unescape \t, \n, \r, \f
  res = res.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\f/g, '\f')
  // 4. Unescape \\
  res = res.replace(/\\\\/g, '\\')
  return res
}

function escapeJavaPropertiesValue(val: string): string {
  if (!val) return ''
  return val.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/=/g, '\\=')
}

function loadWorkspaceProperties(): Record<string, string> {
  const properties: Record<string, string> = {}
  const configFile = getWorkspaceConfigFile()
  if (!fs.existsSync(configFile)) {
    return properties
  }
  try {
    const content = fs.readFileSync(configFile, 'utf-8')
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        const rawValue = trimmed.slice(eqIdx + 1).trim()
        properties[key] = unescapeJavaPropertiesValue(rawValue)
      }
    }
  } catch (err) {
    console.warn('读取工作目录配置失败:', configFile, err)
  }
  return properties
}

export function saveWorkspacePath(workspacePath: string): void {
  const configFile = getWorkspaceConfigFile()
  const dir = path.dirname(configFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const properties = loadWorkspaceProperties()
  properties[WORKSPACE_CONFIG_KEY] = workspacePath
  const lines = [
    '# Markdown preview workspace config',
    `# Updated at ${new Date().toISOString()}`,
  ]
  for (const [k, v] of Object.entries(properties)) {
    lines.push(`${k}=${escapeJavaPropertiesValue(v)}`)
  }
  fs.writeFileSync(configFile, lines.join('\n'), 'utf-8')
}

function readConfiguredWorkspacePath(): string {
  const props = loadWorkspaceProperties()
  const configured = props[WORKSPACE_CONFIG_KEY]
  if (configured && configured.trim()) {
    return configured.trim()
  }
  return DEFAULT_BASE_PATH
}

function normalizeAbsoluteDirectory(rawPath: string | null | undefined): string | null {
  if (!rawPath || !rawPath.trim()) {
    return null
  }
  try {
    const candidate = path.normalize(path.resolve(rawPath.trim()))
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate
    }
  } catch (err) {
    console.warn('解析工作目录失败:', rawPath)
  }
  return null
}

export function getWorkspaceConfig(): WorkspaceConfig {
  const configuredPath = readConfiguredWorkspacePath()
  let effectivePath = normalizeAbsoluteDirectory(configuredPath)
  let fallbackToDesktop = false
  if (!effectivePath) {
    effectivePath = getDesktopPath()
    fallbackToDesktop = true
  }
  return {
    configuredPath,
    effectivePath,
    exists: normalizeAbsoluteDirectory(configuredPath) !== null,
    fallbackToDesktop,
    supportsDirectoryPicker: true,
  }
}

export function getEffectiveWorkspaceBase(): string {
  const config = getWorkspaceConfig()
  return path.normalize(path.resolve(config.effectivePath))
}

export function normalizeRelativePath(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') {
    return ''
  }
  let normalized = value.replace(/\\/g, '/').replace(/\/+/g, '/').trim()
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1)
  }
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  if (normalized.includes('..')) {
    return ''
  }
  return normalized
}

export function resolveScopePath(scope: string): string | null {
  try {
    const base = getEffectiveWorkspaceBase()
    if (!scope || !scope.trim()) {
      return base
    }
    const resolved = path.normalize(path.resolve(base, scope.replace(/\//g, path.sep)))
    if (!resolved.toLowerCase().startsWith(base.toLowerCase())) {
      return null
    }
    return resolved
  } catch (err) {
    console.warn('Scope 解析失败:', scope)
    return null
  }
}

export function resolveMarkdownPath(relativePath: string): string | null {
  return resolveScopePath(relativePath)
}

// ---------------- In-Memory Caching ----------------

interface CachedDocument {
  title: string
  content: string
  toc: string
  apiSections: ApiSectionItem[]
  mtime: number
  size: number
}

interface CachedSidebar {
  files: string[]
  directories: string[]
  timestamp: number
}

const documentCache = new Map<string, CachedDocument>()
const sidebarCache = new Map<string, CachedSidebar>()
const SIDEBAR_CACHE_TTL = 30000 // 30 seconds

export function clearAllCache(): void {
  documentCache.clear()
  sidebarCache.clear()
}

export function evictDocument(filePath: string): void {
  documentCache.delete(filePath)
}

// ---------------- File Scanning ----------------

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.idea',
  '.vscode',
  'target',
  'dist',
  'dist-electron',
  'build',
  '.next',
  '.cache',
  'out',
  'bin',
  'obj',
])

function listMdFilesRecursive(base: string, current: string, files: string[], maxDepth: number): void {
  if (maxDepth <= 0) return
  if (!fs.existsSync(current)) return
  const stat = fs.statSync(current)
  if (!stat.isDirectory()) return

  try {
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const entryName = entry.name
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entryName) && !entryName.startsWith('.')) {
          const subPath = path.join(current, entryName)
          listMdFilesRecursive(base, subPath, files, maxDepth - 1)
        }
      } else if (entryName.toLowerCase().endsWith('.md')) {
        const fullPath = path.join(current, entryName)
        const rel = path.relative(base, fullPath).replace(/\\/g, '/')
        files.push(rel)
      }
    }
  } catch (err) {
    console.warn('扫描目录失败:', current, err)
  }
}

export function scanMdFiles(scope: string): string[] {
  const base = resolveScopePath(scope)
  if (!base || !fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    return []
  }
  const files: string[] = []
  listMdFilesRecursive(base, base, files, 10)
  files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return files
}

export function computeDirectoriesFromFiles(files: string[]): string[] {
  const dirs = new Set<string>()
  dirs.add('')
  for (const file of files) {
    const lastSlash = file.lastIndexOf('/')
    if (lastSlash <= 0) continue
    let current = file.substring(0, lastSlash)
    while (current) {
      dirs.add(current)
      const slashIndex = current.lastIndexOf('/')
      current = slashIndex > -1 ? current.substring(0, slashIndex) : ''
    }
  }
  const sorted = Array.from(dirs)
  sorted.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  sorted.splice(sorted.indexOf(''), 1)
  sorted.unshift('')
  return sorted
}

// ---------------- Markdown Parsing & Utilities ----------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function processBackslashEscapes(text: string): string {
  return text
    .replace(/\\\\/g, '&#92;')
    .replace(/\\`/g, '&#96;')
    .replace(/\\\*/g, '&#42;')
    .replace(/\\_/g, '&#95;')
    .replace(/\\\{/g, '&#123;')
    .replace(/\\\}/g, '&#125;')
    .replace(/\\\[/g, '&#91;')
    .replace(/\\\]/g, '&#93;')
    .replace(/\\\(/g, '&#40;')
    .replace(/\\\)/g, '&#41;')
    .replace(/\\#/g, '&#35;')
    .replace(/\\\+/g, '&#43;')
    .replace(/\\-/g, '&#45;')
    .replace(/\\\./g, '&#46;')
    .replace(/\\!/g, '&#33;')
    .replace(/\\\|/g, '&#124;')
}

function processInline(text: string): string {
  if (!text) return ''

  // 1. 优先保护行内代码块 `...`，防止代码/URL 内部的下划线和特殊符号被误解析
  const codeSpans: string[] = []
  let res = text.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeSpans.length
    codeSpans.push(`<code>${escapeHtml(code)}</code>`)
    return `\x00CODE_${idx}\x00`
  })

  // 2. 保护 Markdown 链接 [text](url) 与图片 ![alt](url)，防止 URL 内部的下划线被转义
  const linkSpans: string[] = []
  res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const idx = linkSpans.length
    linkSpans.push(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`)
    return `\x00LINK_${idx}\x00`
  })
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const idx = linkSpans.length
    linkSpans.push(`<a href="${escapeHtml(url)}">${processInline(label)}</a>`)
    return `\x00LINK_${idx}\x00`
  })

  // 3. 自动保护所有 URL 与接口路径（含 / 或 http:// 等），彻底杜绝 URL 内部下划线误转斜体
  const urlSpans: string[] = []
  res = res.replace(/(?:https?:\/\/[^\s<]+|\/[a-zA-Z0-9_./-]+)/g, (url) => {
    const idx = urlSpans.length
    urlSpans.push(url)
    return `\x00URL_${idx}\x00`
  })

  // 4. 自动保护蛇形命名标识符（如 delete_by_name, is_deleted, user_id 等变量/字段名）
  const identSpans: string[] = []
  res = res.replace(/\b[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)+\b/g, (ident) => {
    const idx = identSpans.length
    identSpans.push(ident)
    return `\x00IDENT_${idx}\x00`
  })

  // 5. 处理反斜杠转义
  res = processBackslashEscapes(res)

  // 6. 粗体：**text** 以及严格独立的 __text__
  res = res.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  res = res.replace(/(?:^|\s)__([^_]+?)__(?=\s|$)/g, (match, p1) => {
    const leadSpace = match.startsWith(' ') ? ' ' : ''
    return `${leadSpace}<strong>${p1}</strong>`
  })

  // 7. 斜体：*text* 以及严格独立的 _text_（前后必须有空格或起止，不能是路径或单词的一部分）
  res = res.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
  res = res.replace(/(?:^|\s)_([^_]+?)_(?=\s|$)/g, (match, p1) => {
    const leadSpace = match.startsWith(' ') ? ' ' : ''
    return `${leadSpace}<em>${p1}</em>`
  })

  // 8. 将转义的下划线 &#95; 还原为字面量 _
  res = res.replace(/&#95;/g, '_')

  // 9. 还原所有受保护的 Token
  res = res.replace(/\x00IDENT_(\d+)\x00/g, (_, idx) => identSpans[parseInt(idx, 10)] || '')
  res = res.replace(/\x00URL_(\d+)\x00/g, (_, idx) => urlSpans[parseInt(idx, 10)] || '')
  res = res.replace(/\x00LINK_(\d+)\x00/g, (_, idx) => linkSpans[parseInt(idx, 10)] || '')
  res = res.replace(/\x00CODE_(\d+)\x00/g, (_, idx) => codeSpans[parseInt(idx, 10)] || '')

  return res
}

function isChangeMarked(line: string): boolean {
  return Boolean(line && CHANGE_MARKER_REGEX.test(line))
}

function stripChangeMarker(line: string): string {
  if (!line) return ''
  const m = CHANGE_MARKER_REGEX.exec(line)
  return m ? m[1] : line
}

function changeClass(changed: boolean): string {
  return changed ? ' class="md-change-line"' : ''
}

function generateAnchorId(headingText: string): string {
  return headingText
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .trim()
}

function generateUniqueAnchorId(headingText: string, anchorCounts: Map<string, number>): string {
  const base = generateAnchorId(headingText)
  const count = (anchorCounts.get(base) || 0) + 1
  anchorCounts.set(base, count)
  return count === 1 ? base : `${base}-${count}`
}

function handleFrontMatter(md: string): string {
  if (md.startsWith('---')) {
    const endIndex = md.indexOf('---', 3)
    if (endIndex > 0) {
      return (
        `<div class="front-matter"><pre><code>` +
        escapeHtml(md.substring(3, endIndex).trim()) +
        `</code></pre></div>\n` +
        md.substring(endIndex + 3)
      )
    }
  }
  return md
}

function normalizeLooseListSyntax(md: string): string {
  const lines = md.split(/\r?\n/)
  const result: string[] = []
  let inCodeFence = false
  let inFrontMatter = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (/^```\s*.*$/.test(trimmed)) {
      inCodeFence = !inCodeFence
      result.push(rawLine)
      continue
    }

    if (trimmed.startsWith('<div class="front-matter">')) {
      inFrontMatter = true
    }

    let line = rawLine
    if (!inCodeFence && !inFrontMatter) {
      line = line
        .replace(/^(\s*[-*+])(?![-*+\s])(\S.*)$/, '$1 $2')
        .replace(/^(\s*\d+\.)(?!\s)(\S.*)$/, '$1 $2')
    }

    result.push(line)

    if (trimmed.endsWith('</div>')) {
      inFrontMatter = false
    }
  }

  return result.join('\n')
}

interface ListContext {
  indent: number
  ordered: boolean
  itemOpen: boolean
}

function isHorizontalRule(line: string): boolean {
  const trimmed = line ? line.trim() : ''
  if (!trimmed) return false
  return /^(?:-{3,}|\*{3,}|_{3,}|(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(trimmed)
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim()
  return (
    trimmed.startsWith('|') &&
    trimmed.endsWith('|') &&
    (trimmed.substring(1, trimmed.length - 1).includes('|') || trimmed.trim().length > 2)
  )
}

function isTableAlignmentLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return false
  const parts = trimmed.split('|')
  for (const part of parts) {
    const p = part.trim()
    if (p && !/^[:\-]+$/.test(p)) return false
  }
  return true
}

function renderTable(rows: string[][], align: string[] | null, changedRows: boolean[]): string {
  if (rows.length === 0) return ''
  let sb = '<table>\n'
  if (rows.length > 0) {
    const isHeadChanged = changedRows.length > 0 && changedRows[0]
    sb += `<thead>\n<tr${isHeadChanged ? ' class="md-change-line"' : ''}>`
    const header = rows[0]
    for (let i = 0; i < header.length; i++) {
      const cellAlign = align && i < align.length ? align[i] : 'left'
      sb += `<th align="${cellAlign}">${processInline(header[i])}</th>`
    }
    sb += '</tr>\n</thead>\n'
  }
  if (rows.length > 1) {
    sb += '<tbody>\n'
    for (let i = 1; i < rows.length; i++) {
      const isRowChanged = i < changedRows.length && changedRows[i]
      sb += `<tr${isRowChanged ? ' class="md-change-line"' : ''}>`
      for (let j = 0; j < rows[i].length; j++) {
        const cellAlign = align && j < align.length ? align[j] : 'left'
        sb += `<td align="${cellAlign}">${processInline(rows[i][j])}</td>`
      }
      sb += '</tr>\n'
    }
    sb += '</tbody>\n'
  }
  sb += '</table>\n'
  return sb
}

function processBlockquote(content: string): string {
  if (!content || !content.trim()) return ''
  const lines = content.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return ''

  // Check for GitHub Alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
  const firstLine = lines[0].trim()
  const alertMatch = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(firstLine)
  if (alertMatch) {
    const type = alertMatch[1].toLowerCase()
    const titleMap: Record<string, { title: string; icon: string }> = {
      note: {
        title: 'Note',
        icon: '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
      },
      tip: {
        title: 'Tip',
        icon: '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.09-.1-.18-.2-.26-.297C3.12 7.75 2.5 6.781 2.5 5.25 2.5 2.31 4.97 0 8 0s5.5 2.31 5.5 5.25c0 1.531-.62 2.5-1.336 3.282-.08.097-.17.197-.26.297-.162.18-.344.38-.542.68-.207.3-.33.565-.37.847a.75.75 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Zm1 3h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1 0-1.5Z"></path></svg>',
      },
      important: {
        title: 'Important',
        icon: '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
      },
      warning: {
        title: 'Warning',
        icon: '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
      },
      caution: {
        title: 'Caution',
        icon: '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
      },
    }
    const alertInfo = titleMap[type] || {
      title: type.toUpperCase(),
      icon: '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
    }
    let bodyHtml = ''
    for (let i = 1; i < lines.length; i++) {
      bodyHtml += `<p>${processInline(lines[i])}</p>\n`
    }
    return (
      `<div class="md-alert md-alert-${type}">` +
      `<div class="md-alert-title"><span class="md-alert-icon">${alertInfo.icon}</span> ${alertInfo.title}</div>` +
      bodyHtml +
      `</div>\n`
    )
  }

  let result = '<blockquote>\n'
  for (const line of lines) {
    result += `<p>${processInline(line)}</p>\n`
  }
  result += '</blockquote>\n'
  return result
}

function getIndentWidth(text: string): number {
  let indent = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (ch === ' ') indent++
    else if (ch === '\t') indent += 4
    else break
  }
  return indent
}

export function convertMarkdownToHtml(rawMd: string): string {
  const md = normalizeLooseListSyntax(handleFrontMatter(rawMd))
  let html = ''
  const lines = md.split(/\r?\n/)
  let inCodeBlock = false
  let inBlockquote = false
  let pendingListBreak = false
  let blockquoteContent = ''
  const listStack: ListContext[] = []
  const tableBuffer: string[][] = []
  const tableChanged: boolean[] = []
  let tableAlign: string[] | null = null
  let inTable = false

  const codeBlockPattern = /^\s*```\s*(.*?)\s*$/
  const unorderedListPattern = /^(\s*)([-*+])(?:\s+(.*)|((?![-*+])\S.*))$/
  const orderedListPattern = /^(\s*)(\d+)\.\s+(.*)$/
  const taskListPattern = /^(\s*)([-*+])\s*\[([ xX])\]\s+(.*)$/
  const headingPattern = /^\s*(#{1,6})\s+(.+?)\s*$/
  const blockquotePattern = /^>\s*(.*)$/

  const anchorCounts = new Map<string, number>()

  const openList = (indent: number, ordered: boolean) => {
    html += ordered ? '<ol>\n' : '<ul>\n'
    listStack.push({ indent, ordered, itemOpen: false })
  }

  const closeTopList = () => {
    if (listStack.length === 0) return
    const ctx = listStack.pop()!
    if (ctx.itemOpen) {
      html += '</li>\n'
    }
    html += ctx.ordered ? '</ol>\n' : '</ul>\n'
  }

  const closeAllLists = () => {
    while (listStack.length > 0) {
      closeTopList()
    }
  }

  const closeOpenListItem = () => {
    const current = listStack[listStack.length - 1]
    if (current && current.itemOpen) {
      html += '</li>\n'
      current.itemOpen = false
    }
  }

  const ensureListContext = (indent: number, ordered: boolean) => {
    while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
      closeTopList()
    }
    if (listStack.length > 0 && indent === listStack[listStack.length - 1].indent) {
      if (listStack[listStack.length - 1].ordered !== ordered) {
        closeTopList()
      } else {
        closeOpenListItem()
      }
    }
    if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent) {
      openList(indent, ordered)
    }
  }

  const appendListItem = (content: string, changed: boolean, taskItem: boolean, checked: boolean) => {
    html += '<li'
    if (taskItem) {
      html += ` class="task-list-item${changed ? ' md-change-line' : ''}">`
      html += `<input type="checkbox" ${checked ? 'checked ' : ''}disabled>`
    } else if (changed) {
      html += ' class="md-change-line">'
    } else {
      html += '>'
    }
    html += content
    const current = listStack[listStack.length - 1]
    if (current) {
      current.itemOpen = true
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const changed = isChangeMarked(rawLine)
    const line = stripChangeMarker(rawLine)

    if (line.startsWith('<table>')) {
      html += line + '\n'
      continue
    }

    const codeBlockMatch = codeBlockPattern.exec(line)
    if (codeBlockMatch) {
      closeOpenListItem()
      if (inTable) {
        html += renderTable(tableBuffer, tableAlign, tableChanged)
        tableBuffer.length = 0
        tableChanged.length = 0
        inTable = false
      }
      if (!inCodeBlock) {
        closeAllLists()
        if (inBlockquote) {
          html += processBlockquote(blockquoteContent)
          blockquoteContent = ''
          inBlockquote = false
        }
        const lang = (codeBlockMatch[1] || '').trim()
        html += `<pre${changeClass(changed)}><code class="language-${lang}">`
        inCodeBlock = true
      } else {
        html += '</code></pre>\n'
        inCodeBlock = false
      }
      continue
    }

    if (inCodeBlock) {
      html += escapeHtml(line) + '\n'
      continue
    }

    const isTableAlignRow = isTableAlignmentLine(line)
    if (isTableRow(line) && !isTableAlignRow) {
      closeOpenListItem()
      closeAllLists()
      if (!inTable) {
        inTable = true
        tableBuffer.length = 0
      }
      const rawCells = line.split('|')
      const cellList: string[] = []
      for (const c of rawCells) {
        const t = c.trim()
        if (t || cellList.length > 0) cellList.push(t)
      }
      if (cellList.length > 0) {
        tableBuffer.push(cellList)
        tableChanged.push(changed)
      }
      continue
    }

    if (isTableAlignRow && inTable) {
      const parts = line.split('|')
      tableAlign = parts.map((p) => {
        const t = p.trim()
        if (t.startsWith(':') && t.endsWith(':')) return 'center'
        if (t.endsWith(':')) return 'right'
        return 'left'
      })
      continue
    }

    if (!line.startsWith('|') && inTable) {
      html += renderTable(tableBuffer, tableAlign, tableChanged)
      tableBuffer.length = 0
      tableChanged.length = 0
      inTable = false
    }

    if (isHorizontalRule(line)) {
      closeOpenListItem()
      closeAllLists()
      if (inBlockquote) {
        html += processBlockquote(blockquoteContent)
        blockquoteContent = ''
        inBlockquote = false
      }
      html += `<hr${changeClass(changed)}>\n`
      continue
    }

    const blockquoteMatch = blockquotePattern.exec(line)
    if (blockquoteMatch) {
      closeOpenListItem()
      closeAllLists()
      if (!inBlockquote) inBlockquote = true
      blockquoteContent += blockquoteMatch[1] + '\n'
      continue
    } else if (inBlockquote && line.trim()) {
      html += processBlockquote(blockquoteContent)
      blockquoteContent = ''
      inBlockquote = false
    }

    const taskMatch = taskListPattern.exec(line)
    if (taskMatch) {
      const indent = getIndentWidth(taskMatch[1])
      ensureListContext(indent, false)
      appendListItem(processInline(taskMatch[4]), changed, true, taskMatch[3].toLowerCase() === 'x')
      pendingListBreak = false
      continue
    }

    const unorderedMatch = unorderedListPattern.exec(line)
    if (unorderedMatch) {
      const indent = getIndentWidth(unorderedMatch[1])
      const content = unorderedMatch[3] !== undefined ? unorderedMatch[3] : unorderedMatch[4]
      ensureListContext(indent, false)
      appendListItem(processInline((content || '').trim()), changed, false, false)
      pendingListBreak = false
      continue
    }

    const orderedMatch = orderedListPattern.exec(line)
    if (orderedMatch) {
      const indent = getIndentWidth(orderedMatch[1])
      ensureListContext(indent, true)
      appendListItem(processInline((orderedMatch[3] || '').trim()), changed, false, false)
      pendingListBreak = false
      continue
    }

    if (listStack.length > 0 && listStack[listStack.length - 1].itemOpen && line.trim() && !pendingListBreak) {
      html += '<br>' + processInline(line.trim())
      pendingListBreak = false
      continue
    }

    const headingMatch = headingPattern.exec(line)
    if (headingMatch) {
      closeOpenListItem()
      closeAllLists()
      if (inBlockquote) {
        html += processBlockquote(blockquoteContent)
        blockquoteContent = ''
        inBlockquote = false
      }
      if (inTable) {
        html += renderTable(tableBuffer, tableAlign, tableChanged)
        tableBuffer.length = 0
        tableChanged.length = 0
        inTable = false
      }
      const level = headingMatch[1].length
      const headingText = headingMatch[2]
      const anchorId = generateUniqueAnchorId(headingText, anchorCounts)
      html += `<h${level}${changed ? ' class="md-change-line"' : ''} id="${anchorId}">${processInline(headingText)}</h${level}>\n`
      continue
    }

    if (!line.trim()) {
      if (listStack.length > 0) {
        closeOpenListItem()
        pendingListBreak = true
        continue
      }
      if (inBlockquote) {
        html += processBlockquote(blockquoteContent)
        blockquoteContent = ''
        inBlockquote = false
      }
      if (inTable) {
        html += renderTable(tableBuffer, tableAlign, tableChanged)
        tableBuffer.length = 0
        tableChanged.length = 0
        inTable = false
      }
      html += '<br>\n'
    } else {
      if (pendingListBreak) {
        closeAllLists()
        pendingListBreak = false
      }
      closeOpenListItem()
      closeAllLists()
      if (inBlockquote) {
        html += processBlockquote(blockquoteContent)
        blockquoteContent = ''
        inBlockquote = false
      }
      if (inTable) {
        html += renderTable(tableBuffer, tableAlign, tableChanged)
        tableBuffer.length = 0
        tableChanged.length = 0
        inTable = false
      }
      html += `<p${changeClass(changed)}>${processInline(line)}</p>\n`
    }
  }

  closeOpenListItem()
  if (inTable && tableBuffer.length > 0) {
    html += renderTable(tableBuffer, tableAlign, tableChanged)
  }
  closeAllLists()
  if (inBlockquote) {
    html += processBlockquote(blockquoteContent)
  }

  return html
}

export function extractTableOfContents(md: string): TocItem[] {
  const toc: TocItem[] = []
  const anchorCounts = new Map<string, number>()
  const lines = md.split(/\r?\n/)

  for (const line of lines) {
    const match = HEADING_REGEX.exec(line)
    if (match) {
      const level = match[1].length
      const text = stripChangeMarker(match[2]).trim()
      const id = generateUniqueAnchorId(text, anchorCounts)
      toc.push({ level, text, id })
    }
  }
  return toc
}

export function renderTocHtml(toc: TocItem[]): string {
  if (!toc || toc.length === 0) {
    return '<div class="toc-empty">暂无标题目录</div>'
  }
  let html = '<div class="toc-header"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; vertical-align:-2px;"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>目录</div><div class="toc-list">'
  let currentLevel = 0

  for (const heading of toc) {
    const level = heading.level
    const text = heading.text
    const id = heading.id

    let circleClass = ''
    if (level === 1) circleClass = ' toc-circle-h1'
    else if (level === 2) circleClass = ' toc-circle-h2'
    else if (level === 3) circleClass = ' toc-circle-h3'

    if (level > currentLevel) {
      for (let i = currentLevel; i < level; i++) {
        html += '<div class="toc-item-container">'
      }
    } else if (level < currentLevel) {
      for (let i = currentLevel; i > level; i--) {
        html += '</div>'
      }
    }

    html += `<a href="#${id}" class="toc-item toc-level-${level}${circleClass}" data-id="${id}"><span class="toc-toggle-btn"></span><span class="toc-label">${escapeHtml(text)}</span></a>`
    currentLevel = level
  }

  for (let i = 0; i < currentLevel; i++) {
    html += '</div>'
  }
  html += '</div>'
  return html
}

// ---------------- API Sections Extraction ----------------

function normalizeApiPath(p: string): string {
  if (!p || !p.trim()) return ''
  let v = p.trim()
  // 去除可能包裹的反引号、引号以及 HTML 标签
  v = v.replace(/^[`"']+|[`"']+$/g, '')
  v = v.replace(/<[^>]+>/g, '')
  // 正确还原转义的下划线与实体
  v = v.replace(/\\_/g, '_').replace(/&#95;/g, '_').replace(/&amp;/g, '&')
  if (!v.startsWith('/')) v = '/' + v
  return v.replace(/\/+/g, '/')
}

function parseTableCells(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map((c) => c.trim())
}

function cleanTableRows(rows: string[][]): string[][] {
  const cleaned: string[][] = []
  for (const row of rows) {
    if (row.length === 0) continue
    let allAlignChars = true
    for (const cell of row) {
      const val = cell.trim()
      if (!val) continue
      if (!/^[:\-]+$/.test(val)) {
        allAlignChars = false
        break
      }
    }
    if (!allAlignChars) {
      cleaned.push(row)
    }
  }
  return cleaned
}

function readColumnValue(header: string[], row: string[], colName: string, fallbackIdx: number): string {
  let idx = header.indexOf(colName)
  if (idx < 0) idx = fallbackIdx
  return idx >= 0 && idx < row.length ? row[idx].trim() : ''
}

function parseTableParams(rows: string[][]): ApiParamItem[] {
  const values: ApiParamItem[] = []
  if (!rows || rows.length <= 1) return values
  const header = rows[0]
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const name = readColumnValue(header, row, '参数名', 0)
    if (!name) continue
    values.push({
      name,
      required: readColumnValue(header, row, '必选', 1),
      type: readColumnValue(header, row, '类型', 2),
      description: readColumnValue(header, row, '说明', 3),
    })
  }
  return values
}

function extractPathParams(apiPath: string, params: ApiParamItem[]): ApiParamItem[] {
  const values: ApiParamItem[] = []
  if (!apiPath) return values
  const paramsByName = new Map<string, ApiParamItem>()
  for (const row of params) {
    if (row.name) paramsByName.set(row.name, row)
  }

  const re = /\{([^{}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(apiPath)) !== null) {
    const key = match[1].trim()
    const detail = paramsByName.get(key) || {
      name: key,
      type: 'string',
      required: '是',
      description: '',
    }
    values.push({
      name: key,
      type: detail.type || 'string',
      required: detail.required || '是',
      description: detail.description || '',
    })
  }
  return values
}

function parseSectionBlock(lines: string[], startIndex: number): { tableRows: string[][]; jsonExample: string } {
  let tableRows: string[][] = []
  let jsonExample = ''
  let inCodeBlock = false
  let codeLang = ''
  let codeBuffer: string[] = []

  for (let i = startIndex; i < lines.length; i++) {
    const line = stripChangeMarker(lines[i])
    const headingMatch = HEADING_REGEX.exec(line)
    if (headingMatch && headingMatch[1].length <= 4 && !inCodeBlock) {
      break
    }

    const codeMatch = CODE_FENCE_REGEX.exec(line)
    if (codeMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLang = (codeMatch[1] || '').trim().toLowerCase()
        codeBuffer = []
      } else {
        inCodeBlock = false
        if (codeLang === 'json' && !jsonExample) {
          jsonExample = codeBuffer.join('\n').trim()
        }
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableRows.push(parseTableCells(line))
    } else if (tableRows.length > 0 && line.trim()) {
      // End of table
      break
    }
  }

  return {
    tableRows: cleanTableRows(tableRows),
    jsonExample,
  }
}

export function extractApiSections(md: string): ApiSectionItem[] {
  const sections: ApiSectionItem[] = []
  if (!md || !md.trim()) return sections

  const lines = md.split(/\r?\n/)
  const anchorCounts = new Map<string, number>()
  let currentH3Text = ''
  let currentH3Id = ''
  let currentApiName = ''
  let currentApiPath = ''
  let currentApiMethod = ''

  for (let i = 0; i < lines.length; i++) {
    const line = stripChangeMarker(lines[i])

    const nameMatch = API_NAME_REGEX.exec(line)
    if (nameMatch) {
      currentApiName = nameMatch[1].trim()
    }

    const pathMatch = API_PATH_REGEX.exec(line)
    if (pathMatch) {
      currentApiPath = normalizeApiPath(pathMatch[1].trim())
    }

    const methodMatch = API_METHOD_REGEX.exec(line)
    if (methodMatch) {
      currentApiMethod = methodMatch[1].trim().toUpperCase()
    }

    const headingMatch = HEADING_REGEX.exec(line)
    if (!headingMatch) continue

    const level = headingMatch[1].length
    const headingText = stripChangeMarker(headingMatch[2]).trim()
    const headingId = generateUniqueAnchorId(headingText, anchorCounts)

    if (level <= 2) {
      currentH3Text = ''
      currentH3Id = ''
      currentApiName = ''
      currentApiPath = ''
      currentApiMethod = ''
      continue
    }

    if (level === 3) {
      currentH3Text = headingText
      currentH3Id = headingId
      currentApiName = ''
      currentApiPath = ''
      currentApiMethod = ''
      continue
    }

    if (level !== 4) continue

    let sectionType: 'requestParams' | 'requestBody' | null = null
    if (headingText === '请求参数') {
      sectionType = 'requestParams'
    } else if (headingText === '请求体') {
      sectionType = 'requestBody'
    }
    if (!sectionType) continue

    const parsed = parseSectionBlock(lines, i + 1)
    const params = parseTableParams(parsed.tableRows)

    sections.push({
      sectionType,
      headingText,
      headingId,
      interfaceTitle: currentApiName || currentH3Text,
      interfaceHeadingText: currentH3Text,
      interfaceHeadingId: currentH3Id,
      path: currentApiPath,
      method: currentApiMethod,
      pathParams: extractPathParams(currentApiPath, params),
      params,
      bodyExample: sectionType === 'requestBody' ? parsed.jsonExample : '',
      sourceLine: i + 1,
    })
  }

  return sections
}

// ---------------- Sidebar & Document Builders ----------------

/**
 * 递归构建左侧树 HTML 结构（目录优先展示，同类型按名称排序）
 */
function buildTreeHtmlRecursive(node: Record<string, any>, pathStr: string, currentPath: string): string {
  const keys = Object.keys(node)
  // 优先展示目录（值为对象），后展示文件（值为字符串）；各自内部按字母升序排序
  keys.sort((a, b) => {
    const isDirA = typeof node[a] === 'object' && node[a] !== null
    const isDirB = typeof node[b] === 'object' && node[b] !== null
    if (isDirA !== isDirB) {
      return isDirA ? -1 : 1
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
  let sb = ''

  for (const key of keys) {
    const value = node[key]
    const currentFilePath = pathStr ? `${pathStr}/${key}` : key

    if (typeof value === 'object' && value !== null) {
      sb += `<div class="tree-folder" data-path="${escapeHtml(currentFilePath)}">`
      sb += `<span class="tree-toggle">▶</span><span class="tree-icon folder-icon">${FOLDER_SVG}</span>`
      sb += `${escapeHtml(key)}</div><div class="tree-children" data-path="${escapeHtml(currentFilePath)}">`
      sb += buildTreeHtmlRecursive(value, currentFilePath, currentPath)
      sb += `</div>`
    } else {
      const filePath = String(value)
      const normalizedFilePath = filePath.replace(/\\/g, '/')
      const normalizedCurrentPath = (currentPath || '').replace(/\\/g, '/')
      const activeClass = normalizedFilePath.toLowerCase() === normalizedCurrentPath.toLowerCase() ? ' active' : ''
      const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/')

      sb += `<div class="tree-file-row${activeClass}" data-path="${escapeHtml(filePath)}" data-name="${escapeHtml(key)}">`
      sb += `<a href="/md-view?path=${encodedPath}" class="tree-file${activeClass}" data-path="${escapeHtml(filePath)}" data-name="${escapeHtml(key)}">`
      sb += `<span class="tree-icon file-icon">${FILE_SVG}</span><span class="tree-file-name">${escapeHtml(key)}</span></a>`
      sb += `<div class="tree-file-actions">`
      sb += `<button type="button" class="tree-file-action tree-copy-name" data-path="${escapeHtml(filePath)}" data-name="${escapeHtml(key)}" title="复制文件名到剪贴板" aria-label="复制文件名到剪贴板"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="2.5" width="8.5" height="10.5" rx="1.8"></rect><path d="M3.5 11.5H3A1.5 1.5 0 0 1 1.5 10V4A1.5 1.5 0 0 1 3 2.5h5"></path></svg></button>`
      sb += `<button type="button" class="tree-file-action tree-copy-url" data-path="${escapeHtml(filePath)}" data-name="${escapeHtml(key)}" title="复制文件链接到剪贴板" aria-label="复制文件链接到剪贴板"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 9.8 9.8 6.2"></path><path d="M6 12.5H4.3A2.8 2.8 0 0 1 1.5 9.7 2.8 2.8 0 0 1 4.3 6.9H6"></path><path d="M10 9.1h1.7a2.8 2.8 0 0 0 2.8-2.8 2.8 2.8 0 0 0-2.8-2.8H10"></path></svg></button>`
      sb += `</div></div>`
    }
  }

  return sb
}

export function buildTreeHtml(files: string[], currentPath: string, currentScope: string): string {
  const tree: Record<string, any> = {}

  for (const file of files) {
    const parts = file.split('/')
    let current = tree
    for (let i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        current[parts[i]] = file
      } else {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
          current[parts[i]] = {}
        }
        current = current[parts[i]]
      }
    }
  }

  const lanIp = getLanIpAddress()
  const lanPort = currentPort || SERVER_PORT

  let sb = ''
  sb += `<div class="sidebar-header"><div class="directory-switcher" id="directory-switcher" data-scope="${escapeHtml(currentScope)}"></div>`
  sb += `<div class="sidebar-header-row">`
  sb += `<span class="sidebar-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; vertical-align:-2px;"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>Markdown 文件列表</span>`
  sb += `<div class="sidebar-lan-badge" id="sidebar-lan-badge" title="局域网内网地址: http://${escapeHtml(lanIp)}:${lanPort}/md-view&#10;点击直接复制完整内网访问链接" onclick="copyLanShareUrl()">`
  sb += `<svg class="lan-badge-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
  sb += `<span class="lan-label">IP:</span>`
  sb += `<span class="lan-address" id="sidebar-lan-address">${escapeHtml(lanIp)}:${lanPort}</span>`
  sb += `</div>`
  sb += `</div></div>`
  sb += `<div class="search-box"><input type="text" class="search-input" id="search-input" placeholder="搜索..."><button class="locate-btn" id="locate-btn" title="定位到当前文件"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></button></div>`
  sb += `<div class="file-list">`
  sb += buildTreeHtmlRecursive(tree, '', currentPath)
  sb += `</div>`
  return sb
}

export function buildSidebarData(normalizedScope: string, currentPath: string): SidebarData {
  const workspaceKey = getEffectiveWorkspaceBase()
  const cacheKey = `${workspaceKey}:${normalizedScope}`
  const now = Date.now()

  let files: string[]
  let directories: string[]
  let cacheHit = false

  const cached = sidebarCache.get(cacheKey)
  if (cached && now - cached.timestamp < SIDEBAR_CACHE_TTL) {
    files = cached.files
    directories = cached.directories
    cacheHit = true
  } else {
    files = scanMdFiles(normalizedScope)
    directories = computeDirectoriesFromFiles(scanMdFiles(''))
    sidebarCache.set(cacheKey, { files, directories, timestamp: now })
  }

  const sidebarHtml = buildTreeHtml(files, currentPath, normalizedScope)
  return {
    sidebar: sidebarHtml,
    scope: normalizedScope,
    files,
    directories,
    workspaceConfig: getWorkspaceConfig(),
    cacheHit,
  }
}

export function buildDocumentData(decodedPath: string): DocumentData {
  let title = 'Markdown 预览'
  let content = ''
  let toc = renderTocHtml([])
  let apiSections: ApiSectionItem[] = []
  let cacheHit = false
  let fileLastModified = 0
  let fileSize = 0

  if (decodedPath && decodedPath.trim()) {
    const fullPath = resolveMarkdownPath(decodedPath)
    if (!fullPath || !fs.existsSync(fullPath)) {
      throw new Error(`Markdown 文件不存在: ${decodedPath}`)
    }
    const stat = fs.statSync(fullPath)
    fileLastModified = stat.mtimeMs
    fileSize = stat.size

    const cached = documentCache.get(fullPath)
    if (cached && cached.mtime === fileLastModified && cached.size === fileSize) {
      title = cached.title
      content = cached.content
      toc = cached.toc
      apiSections = cached.apiSections
      cacheHit = true
    } else {
      const markdown = fs.readFileSync(fullPath, 'utf-8')
      title = escapeHtml(decodedPath)
      content = convertMarkdownToHtml(markdown)
      toc = renderTocHtml(extractTableOfContents(markdown))
      apiSections = extractApiSections(markdown)

      documentCache.set(fullPath, {
        title,
        content,
        toc,
        apiSections,
        mtime: fileLastModified,
        size: fileSize,
      })
    }
  }

  return {
    title,
    content,
    toc,
    apiSections,
    apiSectionsVersion: 1,
    path: decodedPath,
    cacheHit,
    fileLastModified,
    fileSize,
  }
}

// ---------------- Resource File Resolver ----------------

function findResourceFile(relativePath: string): string | null {
  const resourcesPath = (process as any).resourcesPath || ''
  const candidates = [
    path.join(_currentDirname, '..', relativePath),
    path.join(_currentDirname, relativePath),
    path.join(process.cwd(), relativePath),
    path.join(_currentDirname, '../../', relativePath),
    path.join(resourcesPath, relativePath),
    path.join(resourcesPath, 'app', relativePath),
  ]
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function loadTemplateHtml(): string {
  const filePath =
    findResourceFile('resources/templates/md-preview.html') ||
    findResourceFile('templates/md-preview.html')
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8')
  }
  return '<!DOCTYPE html><html><body><h1>Template Error: md-preview.html not found</h1></body></html>'
}

function loadSearchJs(): string {
  const filePath =
    findResourceFile('resources/static/md-search.js') ||
    findResourceFile('static/md-search.js')
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8')
  }
  return '// md-search.js not found'
}

// ---------------- HTTP Server Implementation ----------------

export interface ServerOptions {
  port?: number
  onDirectoryPick?: () => Promise<string | null>
  onMinimize?: () => void
  onMaximize?: () => boolean
  onClose?: (action?: 'minimize-to-tray' | 'exit', remember?: boolean) => void
  getClosePreference?: () => string | null
  isMaximized?: () => boolean
  onNewWindow?: (path?: string) => void
  onRestart?: () => void
}

let runningServer: http.Server | null = null
let currentPort = SERVER_PORT
let serverStartTime = 0
let savedOptions: ServerOptions = {}
let isLanSharingState = true

/**
 * 检查远程请求地址是否为本地环回 (127.0.0.1 / localhost / ::1)
 */
export function isLocalIp(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return true
  const cleanIp = remoteAddress.replace(/^.*:/, '')
  return cleanIp === '127.0.0.1' || cleanIp === 'localhost' || remoteAddress === '::1'
}

/**
 * 检查内网共享服务是否允许外部局域网访问
 */
export function isLanSharingEnabled(): boolean {
  return isLanSharingState
}

/**
 * 设置内网局域网共享开关
 */
export function setLanSharing(enabled: boolean): void {
  isLanSharingState = Boolean(enabled)
}

/**
 * 检查底层 HTTP 服务是否正在运行
 */
export function isHttpServerRunning(): boolean {
  return Boolean(runningServer && runningServer.listening)
}

/**
 * 获取内网 HTTP 服务运行状态详情
 */
export function getServerStatus(): ServerStatus {
  const serverRunning = isHttpServerRunning()
  const running = serverRunning && isLanSharingState
  const port = currentPort || SERVER_PORT
  const lanIp = getLanIpAddress()
  return {
    running,
    lanSharing: isLanSharingState,
    port,
    lanIp,
    lanUrl: `http://${lanIp}:${port}/md-view`,
    workspace: getWorkspaceConfig(),
    timestamp: new Date().toISOString(),
    uptime: serverRunning && serverStartTime > 0 ? Math.floor((Date.now() - serverStartTime) / 1000) : 0,
  }
}

/**
 * 配置服务启动参数（如选择目录的回调等）
 */
export function setServerOptions(options: ServerOptions): void {
  savedOptions = { ...savedOptions, ...options }
  if (options.port) {
    currentPort = options.port
  }
}

/**
 * 启动内网 HTTP 共享服务 (端口 9527)
 */
export function startHttpServer(options: ServerOptions = {}): Promise<http.Server> {
  if (options && (options.port || options.onDirectoryPick)) {
    savedOptions = { ...savedOptions, ...options }
  }
  if (savedOptions.port) {
    currentPort = savedOptions.port
  }

  if (runningServer && runningServer.listening) {
    return Promise.resolve(runningServer)
  }

  const port = currentPort || SERVER_PORT
  const lanIp = getLanIpAddress()

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      // CORS Headers
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
      const pathname = parsedUrl.pathname || '/'
      const query: Record<string, string> = {}
      parsedUrl.searchParams.forEach((val, key) => {
        query[key] = val
      })

      const sendJson = (statusCode: number, data: any) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(data))
      }

      const sendHtml = (statusCode: number, htmlContent: string) => {
        res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(htmlContent)
      }

      const sendText = (statusCode: number, textContent: string) => {
        res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end(textContent)
      }

      const parseBodyJson = (): Promise<any> => {
        return new Promise((resolve, reject) => {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk
            if (body.length > 50 * 1024 * 1024) {
              // 50MB limit
              reject(new Error('Payload too large'))
            }
          })
          req.on('end', () => {
            if (!body.trim()) {
              resolve({})
              return
            }
            try {
              resolve(JSON.parse(body))
            } catch (err) {
              resolve({ rawBody: body })
            }
          })
          req.on('error', reject)
        })
      }

      try {
        const clientIp = req.socket.remoteAddress
        const isLocal = isLocalIp(clientIp)

        // 局域网访问控制：若关闭了内网共享且请求来自外部非本机 IP
        if (!isLanSharingState && !isLocal) {
          if (pathname === '/api/health') {
            sendJson(200, {
              status: 'ok',
              running: false,
              lanSharing: false,
              message: '内网共享服务已由主机管理员暂停',
              port,
              timestamp: new Date().toISOString(),
            })
            return
          }

          if (pathname.startsWith('/api/')) {
            sendJson(403, {
              success: false,
              error: 'Forbidden',
              message: '内网共享服务已由主机管理员暂停。如需访问，请联系主机管理员开启共享。',
              lanSharing: false,
            })
            return
          }

          sendHtml(403, `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>内网共享已暂停 - MD Preview Tool</title>
<style>
  * { box-sizing: border-box; }
  body { background: #121316; color: #d4d4d4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
  .card { background: #1e1e24; border: 1px solid #33343d; border-radius: 12px; padding: 40px 36px; text-align: center; max-width: 480px; width: 100%; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4); }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h2 { color: #f59e0b; margin: 0 0 12px 0; font-size: 20px; }
  p { line-height: 1.6; color: #9ca3af; font-size: 14px; margin: 0 0 20px 0; }
  .tip { font-size: 12px; color: #6b7280; border-top: 1px solid #2d2e37; padding-top: 16px; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
    </div>
    <h2>内网共享已暂停</h2>
    <p>当前主机管理员已关闭 Markdown 服务的局域网共享访问权限。<br>如需查看文档，请联系主机管理员在工作台顶部重新开启「内网服务」。</p>
    <div class="tip">主机本机 (127.0.0.1) 仍可正常访问与管理</div>
  </div>
</body>
</html>`)
          return
        }

        // 1. Root / Page Routes
        if (pathname === '/' || pathname === '/md-view') {
          const html = loadTemplateHtml()
          sendHtml(200, html)
          return
        }

        // 2. Static Scripts
        if (pathname === '/md-search.js' || pathname === '/static/md-search.js') {
          const script = loadSearchJs()
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
          res.end(script)
          return
        }

        // 3. Workspace Config API
        if (pathname === '/api/md/workspace-config') {
          if (req.method === 'GET') {
            sendJson(200, getWorkspaceConfig())
            return
          }
          if (req.method === 'POST') {
            if (!isLocalIp(clientIp)) {
              sendJson(403, { success: false, message: '权限不足：仅本机管理员可修改工作区路径' })
              return
            }
            const body = await parseBodyJson()
            const workspacePath = String(body.path || '').trim()
            const directory = normalizeAbsoluteDirectory(workspacePath)
            if (!directory) {
              sendJson(400, { success: false, message: '目录不存在或不是有效文件夹' })
              return
            }
            saveWorkspacePath(directory)
            clearAllCache()
            sendJson(200, { success: true, message: '工作目录已更新', config: getWorkspaceConfig() })
            return
          }
        }

        // 4. Directory Picker API
        if (pathname === '/api/md/workspace-config/pick-directory' && req.method === 'POST') {
          if (!isLocalIp(clientIp)) {
            sendJson(403, { success: false, message: '权限不足：仅本机管理员可调起目录选择器' })
            return
          }
          const picker = savedOptions.onDirectoryPick || options.onDirectoryPick
          if (picker) {
            try {
              const selected = await picker()
              if (!selected) {
                sendJson(200, { success: false, cancelled: true, config: getWorkspaceConfig() })
                return
              }
              const directory = normalizeAbsoluteDirectory(selected)
              if (!directory) {
                sendJson(400, { success: false, message: '所选目录无效' })
                return
              }
              saveWorkspacePath(directory)
              clearAllCache()
              sendJson(200, { success: true, config: getWorkspaceConfig() })
              return
            } catch (err: any) {
              sendJson(500, { success: false, message: err.message || '选择工作目录失败' })
              return
            }
          } else {
            sendJson(200, {
              success: false,
              unsupported: true,
              message: '当前运行环境不支持弹出目录选择框',
              config: getWorkspaceConfig(),
            })
            return
          }
        }

        // 5. Sidebar Data API
        if (pathname === '/api/md/sidebar-data') {
          const scope = normalizeRelativePath(query.scope as string)
          const currentPath = normalizeRelativePath(query.currentPath as string)
          const data = buildSidebarData(scope, currentPath)
          sendJson(200, data)
          return
        }

        // 6. Document Data API
        if (pathname === '/api/md/document-data') {
          const rawPath = query.path as string
          const decodedPath = normalizeRelativePath(rawPath)
          if (!decodedPath) {
            sendJson(400, { message: 'path 不能为空' })
            return
          }
          const fullPath = resolveMarkdownPath(decodedPath)
          if (!fullPath || !fs.existsSync(fullPath)) {
            sendJson(404, { message: 'Markdown 文件不存在' })
            return
          }
          const data = buildDocumentData(decodedPath)
          sendJson(200, data)
          return
        }

        // 7. Preview Aggregation API
        if (pathname === '/api/md/preview-data') {
          const decodedPath = normalizeRelativePath(query.path as string)
          const scope = normalizeRelativePath(query.scope as string)
          if (decodedPath) {
            const fullPath = resolveMarkdownPath(decodedPath)
            if (!fullPath || !fs.existsSync(fullPath)) {
              sendJson(404, { message: 'Markdown 文件不存在' })
              return
            }
          }
          const sidebarData = buildSidebarData(scope, decodedPath)
          const documentData = buildDocumentData(decodedPath)
          sendJson(200, {
            ...sidebarData,
            ...documentData,
            apiSectionsVersion: 1,
          })
          return
        }

        // 8. Raw Content API
        if (pathname === '/md-content') {
          const decodedPath = normalizeRelativePath(query.path as string)
          const fullPath = resolveMarkdownPath(decodedPath)
          if (!fullPath || !fs.existsSync(fullPath)) {
            sendText(404, 'Markdown 文件不存在')
            return
          }
          const content = fs.readFileSync(fullPath, 'utf-8')
          sendText(200, content)
          return
        }

        // 9. File Download API
        if (pathname === '/md-download') {
          const decodedPath = normalizeRelativePath(query.path as string)
          const fullPath = resolveMarkdownPath(decodedPath)
          if (!fullPath || !fs.existsSync(fullPath)) {
            sendText(404, 'Markdown 文件不存在')
            return
          }
          const filename = path.basename(fullPath)
          const encodedFilename = encodeURIComponent(filename).replace(/%20/g, '+')
          const fileStream = fs.createReadStream(fullPath)
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
          })
          fileStream.pipe(res)
          return
        }

        // 10. File List API
        if (pathname === '/md-list') {
          const scope = normalizeRelativePath(query.scope as string)
          const files = scanMdFiles(scope)
          sendJson(200, files)
          return
        }

        // 11. Directories List API
        if (pathname === '/api/md/directories') {
          const files = scanMdFiles('')
          const dirs = computeDirectoriesFromFiles(files)
          sendJson(200, dirs)
          return
        }

        // 12. Save Content API
        if (pathname === '/api/md/save-content' && req.method === 'POST') {
          const decodedPath = normalizeRelativePath(query.path as string)
          if (!decodedPath) {
            sendJson(400, { success: false, message: 'path 不能为空' })
            return
          }
          const fullPath = resolveMarkdownPath(decodedPath)
          if (!fullPath) {
            sendJson(400, { success: false, message: '无效的文件路径' })
            return
          }
          const dir = path.dirname(fullPath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          const body = await parseBodyJson()
          const content = typeof body.content === 'string' ? body.content : ''
          fs.writeFileSync(fullPath, content, 'utf-8')
          evictDocument(fullPath)
          sendJson(200, { success: true, path: decodedPath })
          return
        }

        // 13. Health Check & LAN IP Reporting API
        if (pathname === '/api/health') {
          sendJson(200, {
            status: 'ok',
            running: isLanSharingState,
            lanSharing: isLanSharingState,
            serverRunning: isHttpServerRunning(),
            lanIp,
            port,
            lanUrl: `http://${lanIp}:${port}/md-view`,
            workspace: getWorkspaceConfig(),
            timestamp: new Date().toISOString(),
            uptime: serverStartTime > 0 ? (Date.now() - serverStartTime) / 1000 : process.uptime(),
          })
          return
        }

        // 14. Server Status API (GET /api/server/status)
        if (pathname === '/api/server/status') {
          sendJson(200, getServerStatus())
          return
        }

        // 15. Server Toggle / Start / Stop API (POST /api/server/toggle, /start, /stop)
        if (
          (pathname === '/api/server/toggle' || pathname === '/api/server/start' || pathname === '/api/server/stop') &&
          req.method === 'POST'
        ) {
          // 仅允许本地请求操作启停，防止外部局域网访客恶意控制主机服务
          if (!isLocalIp(req.socket.remoteAddress)) {
            sendJson(403, {
              success: false,
              message: '仅允许主机本机 (127.0.0.1) 或桌面端控制服务启停',
            })
            return
          }

          const body = await parseBodyJson()
          let targetRunning: boolean
          if (pathname === '/api/server/start') {
            targetRunning = true
          } else if (pathname === '/api/server/stop') {
            targetRunning = false
          } else {
            targetRunning = typeof body.enable === 'boolean' ? body.enable : !isLanSharingState
          }

          setLanSharing(targetRunning)
          if (targetRunning) {
            clearAllCache()
          }

          sendJson(200, {
            success: true,
            running: isLanSharingState,
            lanSharing: isLanSharingState,
            reloaded: targetRunning,
            message: isLanSharingState ? '内网共享服务已开启（缓存已重载）' : '内网共享已暂停（仅限本机访问）',
            status: getServerStatus(),
          })
          return
        }

        // 15.1 Window Controls HTTP API Fallback
        if (pathname === '/api/window/minimize' && req.method === 'POST') {
          if (!isLocalIp(clientIp)) {
            sendJson(403, { success: false, message: '权限不足：仅本机窗口可控制窗口状态' })
            return
          }
          savedOptions.onMinimize?.()
          sendJson(200, { success: true })
          return
        }

        if (pathname === '/api/window/maximize' && req.method === 'POST') {
          if (!isLocalIp(clientIp)) {
            sendJson(403, { success: false, message: '权限不足：仅本机窗口可控制窗口状态' })
            return
          }
          const isMax = savedOptions.onMaximize ? savedOptions.onMaximize() : false
          sendJson(200, { success: true, isMaximized: isMax })
          return
        }

        if (pathname === '/api/window/is-maximized' && req.method === 'GET') {
          const isMax = savedOptions.isMaximized ? savedOptions.isMaximized() : false
          sendJson(200, { isMaximized: isMax })
          return
        }

        if (pathname === '/api/window/close-preference' && req.method === 'GET') {
          const pref = savedOptions.getClosePreference ? savedOptions.getClosePreference() : null
          sendJson(200, { pref })
          return
        }

        if (pathname === '/api/window/perform-close' && req.method === 'POST') {
          if (!isLocalIp(clientIp)) {
            sendJson(403, { success: false, message: '权限不足：仅本机窗口可控制窗口状态' })
            return
          }
          const body = await parseBodyJson()
          savedOptions.onClose?.(body.action, body.remember)
          sendJson(200, { success: true })
          return
        }

        if (pathname === '/api/window/close' && req.method === 'POST') {
          if (!isLocalIp(clientIp)) {
            sendJson(403, { success: false, message: '权限不足：仅本机窗口可控制窗口状态' })
            return
          }
          savedOptions.onClose?.()
          sendJson(200, { success: true })
          return
        }

        if (pathname === '/api/window/new' && req.method === 'POST') {
          if (!isLocalIp(clientIp)) {
            sendJson(403, { success: false, message: '权限不足：仅本机管理员可新建窗口' })
            return
          }
          const body = await parseBodyJson()
          savedOptions.onNewWindow?.(body.path)
          sendJson(200, { success: true })
          return
        }

        if (pathname === '/api/app/restart' && req.method === 'POST') {
          if (!isLocalIp(clientIp)) {
            sendJson(403, { success: false, message: '权限不足：仅本机管理员可重启应用' })
            return
          }
          sendJson(200, { success: true, message: 'Restarting...' })
          setTimeout(() => {
            savedOptions.onRestart?.()
          }, 100)
          return
        }

        // 16. Static Workspace Image Asset Serving (e.g. ./images/foo.png)
        const baseDir = getEffectiveWorkspaceBase()
        const candidateAssetPath = path.resolve(baseDir, pathname.replace(/^\//, ''))
        const relativePath = path.relative(baseDir, candidateAssetPath)
        const isContained = !relativePath.startsWith('..') && !path.isAbsolute(relativePath)

        if (isContained && fs.existsSync(candidateAssetPath) && fs.statSync(candidateAssetPath).isFile()) {
          const ext = path.extname(candidateAssetPath).toLowerCase()
          const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.ico': 'image/x-icon',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.txt': 'text/plain; charset=utf-8',
          }
          const contentType = mimeTypes[ext] || 'application/octet-stream'
          res.writeHead(200, { 'Content-Type': contentType })
          fs.createReadStream(candidateAssetPath).pipe(res)
          return
        }

        // 17. 404 Fallback
        sendJson(404, { error: 'Not Found', pathname })
      } catch (err: any) {
        console.error('Server error on', pathname, err)
        sendJson(500, { error: 'Internal Server Error', message: err.message || String(err) })
      }
    })

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[HTTP Server] Port ${port} is already in use. Retrying or sharing service.`)
      } else {
        console.error('[HTTP Server] Error:', err)
      }
      reject(err)
    })

    server.listen(port, '0.0.0.0', () => {
      serverStartTime = Date.now()
      runningServer = server
      console.log(`[HTTP Server] Markdown Preview service is running at:`)
      console.log(`  > Local:   http://127.0.0.1:${port}/md-view`)
      console.log(`  > Network: http://${lanIp}:${port}/md-view`)
      resolve(server)
    })
  })
}

/**
 * 停止内网 HTTP 共享服务并释放端口
 */
export function stopHttpServer(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!runningServer) {
      resolve(true)
      return
    }
    const s = runningServer
    runningServer = null
    serverStartTime = 0

    try {
      if (typeof (s as any).closeAllConnections === 'function') {
        (s as any).closeAllConnections()
      }
    } catch (e) {
      console.warn('[HTTP Server] closeAllConnections error:', e)
    }

    s.close((err) => {
      if (err) {
        console.warn('[HTTP Server] Error closing server:', err)
      } else {
        console.log('[HTTP Server] Stopped successfully.')
      }
      resolve(true)
    })
  })
}
