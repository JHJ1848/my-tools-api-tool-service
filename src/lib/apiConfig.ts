const API_HOST_KEY = 'tool-service-api-host'
const API_PORT_KEY = 'tool-service-api-port'

const DEFAULT_API_HOST = 'localhost'
const DEFAULT_API_PORT = '3001'

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(key)
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, value)
}

export function getApiHost(): string {
  const value = readStorage(API_HOST_KEY)?.trim()
  return value || DEFAULT_API_HOST
}

export function getApiPort(): string {
  const value = readStorage(API_PORT_KEY)?.trim()
  return value || DEFAULT_API_PORT
}

export function setApiHost(host: string) {
  writeStorage(API_HOST_KEY, host.trim() || DEFAULT_API_HOST)
}

export function setApiPort(port: string) {
  writeStorage(API_PORT_KEY, port.trim() || DEFAULT_API_PORT)
}

export function getApiBase(): string {
  return `http://${getApiHost()}:${getApiPort()}/api`
}

