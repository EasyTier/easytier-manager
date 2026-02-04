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

export async function extractAllPublicIPs(logText) {
  // 私网IP判断函数
  function isPrivateIP(ip) {
    const parts = ip.split('.')
    if (parts.length !== 4) return false
    return (
      parts[0] === '10' ||
      (parts[0] === '172' && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === '192' && parts[1] === '168') ||
      parts[0] === '127' || // 本地回环
      (parts[0] === '0' && parts[1] === '0' && parts[2] === '0') || // 全0地址
      ip === '0.0.0.0' ||
      ip.startsWith('169.254.')
    ) // 链路本地地址
  }

  // 按行分割日志
  const lines = logText.split('\n').filter((line) => line.trim())

  // 获取 mapped_addr 中的IP（排除用）
  const mappedAddrMatch = logText.match(
    /mapped_addr=Some\(SocketAddr\s*\{[^}]*ip:\s*Some\(Ipv4\(([\d.]+)\)\)/
  )
  const mappedIP = mappedAddrMatch ? mappedAddrMatch[1] : null

  // 收集所有候选IP，记录来源和出现次数
  const ipCandidates = new Map()

  lines.forEach((line, lineIndex) => {
    // 策略1: 提取 public_ipv4
    const publicMatch = line.match(/public_ipv4:\s*Some\(([\d.]+)\)/)
    if (publicMatch) {
      const ip = publicMatch[1]
      if (!isPrivateIP(ip)) {
        if (!ipCandidates.has(ip)) {
          ipCandidates.set(ip, {
            ip: ip,
            count: 0,
            sources: new Set(),
            lineNumbers: new Set(),
            lines: []
          })
        }
        const candidate = ipCandidates.get(ip)
        candidate.count++
        candidate.sources.add('public_ipv4')
        candidate.lineNumbers.add(lineIndex)
        candidate.lines.push(line.trim())
      }
    }

    // 策略2: 提取 dest_addr 中的IP（排除 mapped_addr）
    const destMatch = line.match(
      /dest_addr=Some\(SocketAddr\s*\{[^}]*ip:\s*Some\(Ipv4\(([\d.]+)\)\)/
    )
    if (destMatch) {
      const ip = destMatch[1]
      if (!isPrivateIP(ip) && ip !== mappedIP) {
        if (!ipCandidates.has(ip)) {
          ipCandidates.set(ip, {
            ip: ip,
            count: 0,
            sources: new Set(),
            lineNumbers: new Set(),
            lines: []
          })
        }
        const candidate = ipCandidates.get(ip)
        candidate.count++
        candidate.sources.add('dest_addr')
        candidate.lineNumbers.add(lineIndex)
        candidate.lines.push(line.trim())
      }
    }
  })

  // 策略3: 从 "got ip list" 中提取非私网IP
  const gotIpListLines = lines.filter((line) => line.includes('got ip list'))
  if (gotIpListLines.length > 0) {
    gotIpListLines.forEach((line, lineIndex) => {
      const allIPs =
        line.match(
          /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
        ) || []
      allIPs.forEach((ip) => {
        if (!isPrivateIP(ip)) {
          if (!ipCandidates.has(ip)) {
            ipCandidates.set(ip, {
              ip: ip,
              count: 0,
              sources: new Set(),
              lineNumbers: new Set(),
              lines: []
            })
          }
          const candidate = ipCandidates.get(ip)
          candidate.count++
          candidate.sources.add('got_ip_list')
          candidate.lineNumbers.add(lineIndex)
          candidate.lines.push(line.trim())
        }
      })
    })
  }

  // 转换为数组并排序
  const result = Array.from(ipCandidates.values()).map((candidate) => ({
    ...candidate,
    sources: Array.from(candidate.sources),
    lineNumbers: Array.from(candidate.lineNumbers)
  }))

  // 排序规则：
  // 1. 优先级高的来源在前（public_ipv4 > dest_addr > got_ip_list）
  // 2. 出现次数多的在前
  // 3. 出现的行数少的在前（更早出现）
  const sourcePriority = { public_ipv4: 3, dest_addr: 2, got_ip_list: 1 }

  result.sort((a, b) => {
    // 计算优先级分数
    const getPriorityScore = (sources) => {
      return Math.max(...sources.map((s) => sourcePriority[s] || 0))
    }

    const priorityCompare = getPriorityScore(b.sources) - getPriorityScore(a.sources)
    if (priorityCompare !== 0) return priorityCompare

    // 出现次数比较
    const countCompare = b.count - a.count
    if (countCompare !== 0) return countCompare

    // 出现行数比较（更早出现的在前）
    return Math.min(...a.lineNumbers) - Math.min(...b.lineNumbers)
  })

  // // 完整信息
  // const detailedResults = extractAllPublicIPs(logText);

  // // 仅IP数组
  // const ipArray = detailedResults.map(r => r.ip);

  // // 按来源分组
  // const publicIPv4s = detailedResults.filter(r => r.sources.includes('public_ipv4'));
  return result.map((r) => r.ip)
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
