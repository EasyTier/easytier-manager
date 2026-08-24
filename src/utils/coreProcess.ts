import { normalizeRpcPortal } from './rpcPortal'

/** 从命令行参数中提取指定 flag 的值。 */
export function extractArgValue(commandLine: string, flag: string): string | undefined {
  if (!commandLine || !flag) return undefined
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = commandLine.match(
    new RegExp(`${escaped}(?:=|\\s+)(?:"([^"]+)"|'([^']+)'|(\\S+))`, 'i')
  )
  return (match?.[1] || match?.[2] || match?.[3] || '').trim() || undefined
}

/** 提取配置文件路径。macOS 的 ps 会移除 argv 引号，因此路径可能包含空格。 */
export function extractConfigPath(commandLine: string): string | undefined {
  if (!commandLine) return undefined
  const match = commandLine.match(
    /(?:--config-file|-c)(?:=|\s+)(?:"([^"]+\.toml)"|'([^']+\.toml)'|(.+?\.toml))(?=\s+(?:--[\w-]+|-[a-zA-Z](?:\s|=))|$)/i
  )
  return (match?.[1] || match?.[2] || match?.[3] || '').trim() || undefined
}

export function extractConfigNameFromPath(configPath: string): {
  configFileName: string
  fileName: string
} {
  const normalized = configPath.replace(/\\/g, '/')
  const base = normalized.split('/').pop() || configPath
  const fileName = base.endsWith('.toml') ? base : `${base}.toml`
  const configFileName = fileName.replace(/\.toml$/i, '')
  return { configFileName, fileName }
}

export function parseCoreCommandLine(commandLine: string): {
  configPath?: string
  configFileName?: string
  fileName?: string
  rpcPortal?: string
} {
  if (!commandLine) return {}
  const configPath = extractConfigPath(commandLine)
  const rpcRaw = extractArgValue(commandLine, '--rpc-portal') || extractArgValue(commandLine, '-r')
  const rpcPortal = rpcRaw ? normalizeRpcPortal(rpcRaw) : undefined
  if (!configPath) return { rpcPortal }
  const { configFileName, fileName } = extractConfigNameFromPath(configPath)
  return { configPath, configFileName, fileName, rpcPortal }
}
