import { extractConfigPath } from './coreProcess'
import { normalizeWinPath } from './servicePathUtil'

export type RunMode = 'direct' | 'service' | 'stopped' | 'unknown'
export interface WindowsProcess {
  pid: number
  parentPid: number
  name: string
  commandLine: string | null
  path?: string
  created?: string
}
export interface WindowsService {
  name: string
  pid: number
  state: string
  imagePath: string
  application?: string
  args?: string
  directory?: string
  configKnown: boolean
  nssm: boolean
}
export interface WindowsSnapshot {
  processes: WindowsProcess[]
  services: WindowsService[]
  processesKnown: boolean
  servicesKnown: boolean
}
export interface WindowsConfigRuntime {
  mode: RunMode
  registration: 'installed' | 'absent' | 'unknown'
  services: WindowsService[]
  processes: WindowsProcess[]
}

export function classifyProcess(snapshot: WindowsSnapshot, process: WindowsProcess): RunMode {
  if (!snapshot.processesKnown || !snapshot.servicesKnown) return 'unknown'
  let current: WindowsProcess | undefined = process
  const seen = new Set<number>()
  while (current && !seen.has(current.pid)) {
    seen.add(current.pid)
    if (snapshot.services.some((s) => s.pid > 0 && s.pid === current!.pid)) return 'service'
    // A wrapper without a matching SCM PID is not evidence of a direct launch.
    if (/^(nssm|services)(\.exe)?$/i.test(current.name)) return 'unknown'
    const parent: WindowsProcess | undefined = snapshot.processes.find(
      (p) => p.pid === current!.parentPid
    )
    if (parent?.created && current.created && parent.created > current.created) break // reused PID
    if (snapshot.services.some((s) => s.pid > 0 && s.pid === current!.parentPid)) return 'service'
    current = parent
  }
  return process.commandLine ? 'direct' : 'unknown'
}

function absoluteConfig(commandLine: string, directory?: string): string | undefined {
  const path = extractConfigPath(commandLine)
  if (!path) return undefined
  if (/^(?:[a-z]:[\\/]|\\\\)/i.test(path)) return normalizeWinPath(path)
  if (!directory) return undefined
  const combined = normalizeWinPath(`${directory}\\${path}`)
  const parts: string[] = []
  for (const part of combined.split('\\')) {
    if (part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('\\')
}

export function configRuntime(snapshot: WindowsSnapshot, configPath: string): WindowsConfigRuntime {
  const target = normalizeWinPath(configPath)
  const services = snapshot.services.filter((s) => {
    const command = s.nssm ? s.args || '' : s.imagePath
    return absoluteConfig(command, s.directory) === target
  })
  const uncertainService = snapshot.services.some(
    (s) =>
      !s.configKnown ||
      ((/easytier/i.test(s.name) ||
        /easytier/i.test(s.imagePath || '') ||
        /easytier/i.test(s.application || '')) &&
        !absoluteConfig(s.nssm ? s.args || '' : s.imagePath, s.directory))
  )
  const registration =
    !snapshot.servicesKnown || uncertainService
      ? 'unknown'
      : services.length
        ? 'installed'
        : 'absent'
  if (!snapshot.processesKnown || !snapshot.servicesKnown)
    return { mode: 'unknown', registration, services, processes: [] }
  const cores = snapshot.processes.filter((p) => p.name.toLowerCase() === 'easytier-core.exe')
  const matching = cores.filter((p) => absoluteConfig(p.commandLine || '') === target)
  // Missing/relative config paths cannot be safely assigned to another configuration.
  const unidentified = cores.some((p) => !absoluteConfig(p.commandLine || ''))
  const modes = matching.map((p) => classifyProcess(snapshot, p))
  const mode: RunMode =
    unidentified || modes.includes('unknown') || new Set(modes).size > 1
      ? 'unknown'
      : modes[0] || 'stopped'
  return { mode, registration, services, processes: matching }
}

export function directStartBlock(
  state: WindowsConfigRuntime,
  automatic = false
): string | undefined {
  if (state.mode === 'unknown' || state.registration === 'unknown') return 'runtime.unknownBlocked'
  if (automatic && state.registration === 'installed') return 'runtime.autoSkipped'
  if (state.mode === 'service' || state.services.some((s) => s.state !== 'Stopped'))
    return 'runtime.manageService'
  if (state.mode !== 'stopped') return 'runtime.alreadyRunning'
}

export function serviceActionBlock(
  state: WindowsConfigRuntime,
  action: 'start' | 'stop'
): string | undefined {
  if (state.registration !== 'installed' || state.services.length !== 1 || state.mode === 'unknown')
    return 'runtime.unknownBlocked'
  if (action === 'start' && state.mode === 'direct') return 'runtime.stopDirectFirst'
  if (
    action === 'start'
      ? state.services[0].state !== 'Stopped'
      : state.services[0].state !== 'Running'
  )
    return 'runtime.stateChanged'
}
