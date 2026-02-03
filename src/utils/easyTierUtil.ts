export const parseNodeInfo = (content) => {
  const regex = /^\s*│\s*([^│]+)\s*│\s*([^│]+)\s*│\s*$/gm
  const result = {}
  let match
  while ((match = regex.exec(content)) !== null) {
    const key = match[1].trim()
    result[key] = match[2].trim()
  }
  return result
}
export const parsePeerInfo = (content) => {
  // 将表格字符串分割成行
  const lines = content.split('\n')

  // 提取表头（keys）
  const headers = lines[1]
    .split('│')
    .slice(1, -1)
    .map((h) => h.trim())

  // 初始化结果数组
  const result: any[] = []

  // 遍历数据行
  for (let i = 3; i < lines.length - 1; i += 2) {
    if (lines[i].trim() === '') continue // 跳过空行

    // 分割每一行的数据
    const values = lines[i]
      .split('│')
      .slice(1, -1)
      .map((v) => v.trim())

    // 创建对象并添加到结果数组
    const obj: any = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] === '-' || values[index] === '' ? null : values[index]
    })

    // 每行数据都作为一个新对象添加到结果数组中
    result.push(obj)
  }

  return result
}

export async function extractPublicIPTarget(logText) {
  // 策略1: 匹配 public_ipv4: Some(IP)
  const publicIPv4Match = logText.match(/public_ipv4:\s*Some\(([\d.]+)\)/)
  const publicIPv4 = publicIPv4Match ? publicIPv4Match[1] : null

  // 获取 mapped_addr 中的IP
  const mappedAddrMatch = logText.match(
    /mapped_addr=Some\(SocketAddr\s*\{[^}]*ip:\s*Some\(Ipv4\(([\d.]+)\)\)/
  )
  const mappedIP = mappedAddrMatch ? mappedAddrMatch[1] : null

  // 策略2: 匹配 dest_addr 中的 IPv4(目标IP)
  const destAddrMatch = logText.match(
    /dest_addr=Some\(SocketAddr\s*\{[^}]*ip:\s*Some\(Ipv4\(([\d.]+)\)\)/
  )
  const destIP = destAddrMatch ? destAddrMatch[1] : null

  // 策略1和策略2的IP相同，且与mapped_addr不同，则匹配成功
  if (publicIPv4 && destIP && publicIPv4 === destIP && publicIPv4 !== mappedIP) {
    return publicIPv4
  }

  // 策略3: 如果日志中包含 "got ip list"，提取第一个非私网IP
  if (logText.includes('got ip list')) {
    const allIPs =
      logText.match(
        /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
      ) || []
    // 过滤掉私网IP (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const publicIPs = allIPs.filter((ip) => {
      const parts = ip.split('.')
      return !(
        parts[0] === '10' ||
        (parts[0] === '172' && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === '192' && parts[1] === '168')
      )
    })
    if (publicIPs.length > 0) return publicIPs[0]
  }

  // 最后兜底：如果策略1和策略2相同，也返回匹配的IP
  if (publicIPv4 && destIP && publicIPv4 === destIP) {
    return publicIPv4
  }

  return null
}

/**
 * 倒着读取文本的指定行数
 * @param {string} text - 要读取的文本
 * @param {number} linesToRead - 要读取的行数
 * @returns {string} 倒着读取的结果，按换行符分隔
 */
export function readTextReverse(text, linesToRead) {
  // 参数校验
  if (typeof text !== 'string') {
    throw new Error('第一个参数必须是字符串')
  }
  if (typeof linesToRead !== 'number' || linesToRead < 0) {
    throw new Error('第二个参数必须是正整数')
  }

  // 按换行符分割文本（支持多种换行符格式）
  const lines = text.split(/\r?\n/)

  // 如果文本为空或行数不足，返回空字符串或全部行
  if (lines.length === 0) {
    return ''
  }

  // 计算实际需要读取的行数
  const actualLinesToRead = Math.min(linesToRead, lines.length)

  // 从后往前提取指定行数
  const reversedLines: string[] = []
  for (let i = 0; i < actualLinesToRead; i++) {
    reversedLines.push(lines[lines.length - 1 - i])
  }

  // 返回倒序后的结果
  return reversedLines.join('\n')
}
