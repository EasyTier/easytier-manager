/**
 * 日志启动参数相关纯函数
 * 不依赖 Tauri 运行时，便于在 Node 环境做单元测试
 */

/**
 * 将配置值解析为正整数
 * 非数字、非正数和空值统一返回 undefined，交由内核使用默认值
 */
export function toPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined
}

/**
 * 追加日志滚动限制参数
 * 未配置时不追加，保持内核默认值（单个 100MB / 最多 10 个）
 */
export function appendFileLogLimitArgs(
  args: string[],
  logSize?: number,
  logCount?: number
): string[] {
  if (logSize) args.push('--file-log-size', String(logSize))
  if (logCount) args.push('--file-log-count', String(logCount))
  return args
}
