import { Command } from '@tauri-apps/plugin-shell'
import { join } from '@tauri-apps/api/path'
import { getConfigDir } from './fileUtil'
import { extractConfigPath } from './coreProcess'
import {
  classifyProcess,
  configRuntime,
  directStartBlock,
  serviceActionBlock,
  type WindowsSnapshot,
  type WindowsConfigRuntime
} from './windowsRuntimeModel'

// Query failures are explicit. Never turn a denied CIM/registry query into an empty list.
export const WINDOWS_SNAPSHOT_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$processes = @(); $services = @(); $processesKnown = $false; $servicesKnown = $false
try {
  $processes = @(Get-CimInstance Win32_Process | ForEach-Object {
    [pscustomobject]@{pid=[int]$_.ProcessId; parentPid=[int]$_.ParentProcessId; name=$_.Name;
      commandLine=$(if ($_.Name -ieq 'easytier-core.exe') {$_.CommandLine} else {''});
      path=$_.ExecutablePath; created=$(if ($_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString('o')} else {''})}
  })
  $processesKnown = $true
} catch {}
try {
  $services = @(Get-CimInstance Win32_Service | ForEach-Object {
    $svc = $_; $params = $null; $configKnown = $true; $directory = $null
    $nssm = $svc.PathName -match '(?i)nssm(?:\.exe)?(?:"|\s|$)'
    if ($nssm) {
      try {
        $key = 'Registry::HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\' + $svc.Name + '\Parameters'
        if (Test-Path -LiteralPath $key) { $params = Get-ItemProperty -LiteralPath $key }
      } catch { $configKnown = $false }
    }
    if ($nssm) { $directory = $params.AppDirectory }
    elseif ($svc.PathName -match '(?i)easytier') {
      try {
        $key = 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\EasyTier\Service\WorkDir'
        if (Test-Path -LiteralPath $key) { $directory = (Get-ItemProperty -LiteralPath $key).($svc.Name) }
      } catch { $configKnown = $false }
    }
    [pscustomobject]@{name=$svc.Name; pid=[int]$svc.ProcessId; state=$svc.State;
      imagePath=$svc.PathName; application=$params.Application; args=$params.AppParameters;
      directory=$directory; configKnown=$configKnown; nssm=$nssm}
  })
  $servicesKnown = $true
} catch {}
@{processes=$processes; services=$services; processesKnown=$processesKnown; servicesKnown=$servicesKnown} | ConvertTo-Json -Depth 5 -Compress
`

export async function queryWindowsSnapshot(): Promise<WindowsSnapshot> {
  try {
    const output = await Command.create(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_SNAPSHOT_SCRIPT],
      { encoding: 'utf-8' }
    ).execute()
    if (output.code !== 0 || output.stderr.trim()) throw new Error('CIM query failed')
    const result = JSON.parse(output.stdout)
    if (
      !Array.isArray(result.processes) ||
      !Array.isArray(result.services) ||
      typeof result.processesKnown !== 'boolean' ||
      typeof result.servicesKnown !== 'boolean'
    ) {
      throw new Error('Invalid CIM response')
    }
    return result
  } catch {
    return { processes: [], services: [], processesKnown: false, servicesKnown: false }
  }
}

export async function getWindowsConfigRuntime(
  fileName: string,
  snapshot?: WindowsSnapshot
): Promise<WindowsConfigRuntime> {
  return configRuntime(
    snapshot || (await queryWindowsSnapshot()),
    await join(await getConfigDir(), fileName)
  )
}

export async function requireDirectStart(fileName: string, automatic = false) {
  const state = await getWindowsConfigRuntime(fileName)
  const reason = directStartBlock(state, automatic)
  if (reason) throw new Error(reason)
}

export async function requireDirectStop(
  pid: number,
  expectedCommandLine?: string,
  coreOnly = true
) {
  const snapshot = await queryWindowsSnapshot()
  const process = snapshot.processes.find((p) => p.pid === pid)
  if (
    !coreOnly &&
    snapshot.processesKnown &&
    process &&
    process.name.toLowerCase() !== 'easytier-core.exe'
  )
    return
  if (
    !snapshot.processesKnown ||
    !process ||
    process.name.toLowerCase() !== 'easytier-core.exe' ||
    !process.commandLine ||
    (expectedCommandLine && process.commandLine !== expectedCommandLine)
  ) {
    throw new Error('runtime.unknownBlocked')
  }
  const mode = classifyProcess(snapshot, process)
  if (mode !== 'direct')
    throw new Error(mode === 'service' ? 'runtime.manageService' : 'runtime.unknownBlocked')
}

// SCM targets the discovered service name, including services installed by the official CLI.
// The CLI's default/global service name must never be used for another configuration.
export async function changeWindowsService(fileName: string, action: 'start' | 'stop') {
  const state = await getWindowsConfigRuntime(fileName)
  const reason = serviceActionBlock(state, action)
  if (reason) throw new Error(reason)
  const service = state.services[0]
  const name = service.name.replace(/'/g, "''")
  const command = `$ErrorActionPreference='Stop'; ${action === 'start' ? 'Start' : 'Stop'}-Service -InputObject (Get-Service -Name '${name.replace(/[\[\]*?]/g, '`$&')}') -ErrorAction Stop`
  const output = await Command.create('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    command
  ]).execute()
  if (output.code !== 0 || output.stderr.trim()) throw new Error('runtime.serviceActionFailed')
}

export { classifyProcess, extractConfigPath }
