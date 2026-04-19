import { GITHUB_MIRROR_URL } from '@/constants/easytier'

/**
 *
 * @param component 需要注册的组件
 * @param alias 组件别名
 * @returns any
 */
export const withInstall = <T>(component: T, alias?: string) => {
  const comp = component as any
  comp.install = (app: any) => {
    app.component(comp.name || comp.displayName, component)
    if (alias) {
      app.config.globalProperties[alias] = component
    }
  }
  return component as T & Plugin
}

/**
 * @param str 需要转下划线的驼峰字符串
 * @returns 字符串下划线
 */
export const humpToUnderline = (str: string): string => {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/**
 * @param str 需要转驼峰的下划线字符串
 * @returns 字符串驼峰
 */
export const underlineToHump = (str: string): string => {
  if (!str) return ''
  return str.replace(/\-(\w)/g, (_, letter: string) => {
    return letter.toUpperCase()
  })
}

/**
 * 驼峰转横杠
 */
export const humpToDash = (str: string): string => {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}

export const setCssVar = (prop: string, val: any, dom = document.documentElement) => {
  dom.style.setProperty(prop, val)
}

export const getCssVar = (prop: string, dom = document.documentElement) => {
  return getComputedStyle(dom).getPropertyValue(prop)
}

/**
 * 查找数组对象的某个下标
 * @param {Array} ary 查找的数组
 * @param {Functon} fn 判断的方法
 */
export const findIndex = <T = Recordable>(ary: Array<T>, fn: Fn): number => {
  if (ary.findIndex) {
    return ary.findIndex(fn)
  }
  let index = -1
  ary.some((item: T, i: number, ary: Array<T>) => {
    const ret: T = fn(item, i, ary)
    if (ret) {
      index = i
      return ret
    }
  })
  return index
}

export const trim = (str: string) => {
  return str.replace(/(^\s*)|(\s*$)/g, '')
}

/**
 * @param {Date | number | string} time 需要转换的时间
 * @param {String} fmt 需要转换的格式 如 yyyy-MM-dd、yyyy-MM-dd HH:mm:ss
 */
export function formatTime(time: Date | number | string, fmt: string) {
  if (!time) return ''
  else {
    const date = new Date(time)
    const o = {
      'M+': date.getMonth() + 1,
      'd+': date.getDate(),
      'H+': date.getHours(),
      'm+': date.getMinutes(),
      's+': date.getSeconds(),
      'q+': Math.floor((date.getMonth() + 3) / 3),
      S: date.getMilliseconds()
    }
    if (/(y+)/.test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
    }
    for (const k in o) {
      if (new RegExp('(' + k + ')').test(fmt)) {
        fmt = fmt.replace(
          RegExp.$1,
          RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length)
        )
      }
    }
    return fmt
  }
}

/**
 * 生成随机字符串
 */
export function toAnyString() {
  const str: string = 'xxxxx-xxxxx-4xxxx-yxxxx-xxxxx'.replace(/[xy]/g, (c: string) => {
    const r: number = (Math.random() * 16) | 0
    const v: number = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString()
  })
  return str
}

/**
 * 首字母大写
 */
export function firstUpperCase(str: string) {
  return str.toLowerCase().replace(/( |^)[a-z]/g, (L) => L.toUpperCase())
}

/**
 * 把对象转为formData
 */
export function objToFormData(obj: Recordable) {
  const formData = new FormData()
  Object.keys(obj).forEach((key) => {
    formData.append(key, obj[key])
  })
  return formData
}

interface LatencyResult {
  total: number
}

/**
 * 测量单个镜像延迟
 * 使用浏览器 fetch + no-cors，performance.now() 直接计时
 * no-cors 模式下浏览器会建立 TCP 连接但不读取响应体，适合测连通延迟
 */
export async function measureLatency(
  url: string,
  timeoutMs: number = 2000
): Promise<LatencyResult | null> {
  const testUrl = `${url}?_t=${Date.now()}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const start = performance.now()
  try {
    await window.fetch(testUrl, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    })
    const total = Math.round(performance.now() - start)
    return { total }
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 并发测试所有镜像延迟
 * @param mirrors  镜像列表
 * @param timeout  单个镜像超时(ms)
 * @param concurrency 最大并发数，避免瞬间打爆连接池
 */
export async function measureMirrorLatency(
  mirrors: typeof GITHUB_MIRROR_URL,
  timeout: number = 2000,
  concurrency: number = 6
): Promise<typeof mirrors> {
  async function runBatch(items: any[]): Promise<any[]> {
    const results = await Promise.allSettled(
      items.map(async (item) => {
        const result = await measureLatency(item.value, timeout)
        const latency = result?.total
        return { ...item, latency: latency != null && latency > 0 ? latency : undefined }
      })
    )
    return results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { ...items[i], latency: undefined }
    )
  }

  // 分批并发：每批 concurrency 个
  const allResults: any[] = []
  for (let i = 0; i < mirrors.length; i += concurrency) {
    const batch = mirrors.slice(i, i + concurrency)
    const batchResults = await runBatch(batch)
    allResults.push(...batchResults)
  }

  // 按延迟升序排列，undefined(不可达) 排末尾
  allResults.sort((a, b) => {
    if (a.latency == null && b.latency == null) return 0
    if (a.latency == null) return 1
    if (b.latency == null) return -1
    return a.latency - b.latency
  })
  return allResults
}
