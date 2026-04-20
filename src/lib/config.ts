export const config = {
  API_BASE: 'http://localhost:3001/api',
  BASE_PATH: 'D:\\adas\\项目',
  DEFAULT_THEME: 'system' as 'light' | 'dark' | 'system',
  MAX_RECENT_FILES: 10,
  AUTO_SAVE: true,
  SEARCH_DEBOUNCE: 300,
  EDITOR_FONT_SIZE: 14,
  PREVIEW_LINE_HEIGHT: 1.6,
}

export const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdtxt', '.mdtext']

export const FILE_ICON_COLORS: Record<string, string> = {
  '.md': 'text-blue-500',
  '.markdown': 'text-blue-500',
  default: 'text-gray-500',
}
