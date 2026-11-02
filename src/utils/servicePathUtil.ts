/**
 * Windows 服务(NSSM 注册)路径配置的解析与比对
 * 纯函数实现,不依赖 Tauri/浏览器 API,便于单元测试
 */

/** 服务当前路径配置 */
export interface ServicePathConfig {
  /** 服务 ImagePath,即实际执行的 nssm.exe 路径 */
  imagePath?: string
  /** 服务 Application,即被托管的目标程序路径 */
  application?: string
  /** 服务 AppDirectory,即服务工作目录 */
  appDirectory?: string
  /** 服务 AppParameters,即启动参数原始命令行 */
  appParameters?: string
}

/**
 * 归一化 Windows 路径用于比对:去首尾引号/空白、去扩展长度前缀、统一分隔符、去尾部斜杠、转小写
 * 仅用于「是否指向同一位置」的判定,不用于实际文件访问
 */
export function normalizeWinPath(value?: string | null): string {
  if (!value) return ''
  let normalized = value
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .trim()
  // UNC 扩展前缀 \\?\UNC\server\share 与 \\?\C:\... 都要还原成普通路径后再比较
  if (/^\\\\\?\\UNC\\/i.test(normalized)) {
    normalized = `\\\\${normalized.slice(8)}`
  } else {
    normalized = normalized.replace(/^\\\\\?\\/, '').replace(/^\\\\\.\\/, '')
  }
  const stripped = normalized.replace(/\//g, '\\').replace(/\\+$/, '')
  // Windows 根目录(如 D:\)去尾后需补回分隔符,否则与子路径拼接语义会变化
  return (/^[A-Za-z]:$/.test(stripped) ? `${stripped}\\` : stripped).toLowerCase()
}

/**
 * 构建读取服务当前路径配置的 PowerShell 命令
 * 服务名中的单引号按 PowerShell 规则转义,避免命令拼接出错或注入
 */
export function buildServiceConfigQueryCommand(serviceName: string): string {
  const name = serviceName.replace(/'/g, "''")
  return `\
    $n='${name}';\
    $s=Get-CimInstance Win32_Service -Filter "Name='$n'" -ErrorAction SilentlyContinue;\
    $p=Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\$n\\Parameters" -ErrorAction SilentlyContinue;\
    [pscustomobject]@{imagePath=$s.PathName;application=$p.Application;appDirectory=$p.AppDirectory;appParameters=$p.AppParameters} | ConvertTo-Json -Compress\
  `.trim()
}

/**
 * 把 PowerShell 返回的 JSON 对象转换为服务路径配置
 * 服务不存在(imagePath 为空)时返回 undefined
 */
export function toServicePathConfig(parsed: any): ServicePathConfig | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined
  const text = (value: any) => (value === undefined || value === null ? undefined : String(value))
  const config: ServicePathConfig = {
    imagePath: text(parsed.imagePath),
    application: text(parsed.application),
    appDirectory: text(parsed.appDirectory),
    appParameters: text(parsed.appParameters)
  }
  return config.imagePath ? config : undefined
}

/**
 * 判断服务当前配置是否与期望一致
 * 三个路径字段按 Windows 路径规则归一化比较,参数按原始命令行比较
 * 用途:避免复用指向旧安装目录的服务,并让重复安装保持幂等
 */
export function isServiceConfigMatched(
  actual: ServicePathConfig | undefined | null,
  expected: ServicePathConfig
): boolean {
  if (!actual || !actual.imagePath) return false
  const samePath = (a?: string, b?: string) =>
    !!normalizeWinPath(a) && normalizeWinPath(a) === normalizeWinPath(b)
  const sameText = (a?: string, b?: string) => (a ?? '').trim() === (b ?? '').trim()
  return (
    samePath(actual.imagePath, expected.imagePath) &&
    samePath(actual.application, expected.application) &&
    samePath(actual.appDirectory, expected.appDirectory) &&
    sameText(actual.appParameters, expected.appParameters)
  )
}
