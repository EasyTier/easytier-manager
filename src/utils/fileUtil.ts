import { CONFIG_PATH, LOG_PATH, RESOURCE_PATH } from '@/constants/easytier'
// import { useI18n } from '@/hooks/web/useI18n'
import { t } from '@/utils/i18nUtil'
import { dirname, extname, join, resourceDir } from '@tauri-apps/api/path'
import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  writeFile,
  writeTextFile
} from '@tauri-apps/plugin-fs'
import { fetch } from '@tauri-apps/plugin-http'
import { attachConsole, error, info } from '@tauri-apps/plugin-log'
import { open } from '@tauri-apps/plugin-shell'
import { ElNotification } from 'element-plus'
import { unzipSync } from 'fflate'
import pkg from '../../package.json'

// 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
attachConsole()
// ts文件无法直接使用useI18n，所以使用t函数
// const { t } = useI18n()

// 程序启动时，判断是否存在resource目录，不存在则创建
export const checkDir = async (dirPath: string = RESOURCE_PATH) => {
  try {
    try {
      // @ts-ignore
      const _e = await extname(dirPath)
      dirPath = await dirname(dirPath)
    } catch (_error) {
      /* empty */
    }
    const dirExists = await exists(dirPath, { baseDir: BaseDirectory.Resource })
    if (!dirExists) {
      await mkdir(dirPath, { baseDir: BaseDirectory.Resource, recursive: true })
    }
  } catch (e: any) {
    error(`创建resource目录时出错:${JSON.stringify(e)}`)
    throw e
  }
}

// 检测文件是否存在，不存在则创建空文件
export const fileExist = async (filePath: string) => {
  const exist = await exists(filePath, { baseDir: BaseDirectory.Resource })
  if (!exist) {
    await writeFileContent(filePath, '', { baseDir: BaseDirectory.Resource })
  }
  return exist
}
// 获取resource目录，如果resource目录不存在，则调用checkResourceDir创建，最终返回带'resource'后缀的目录
export const getResourceDir = async () => {
  await checkDir()
  return await join(await resourceDir(), RESOURCE_PATH)
}
export const getCliDir = async () => {
  await checkDir()
  return await join(await resourceDir(), RESOURCE_PATH, 'easytier-cli')
}
export const getCoreDir = async () => {
  await checkDir()
  return await join(await resourceDir(), RESOURCE_PATH, 'easytier-core')
}
// 获取resource下的logs目录
export const getLogsDir = async () => {
  await checkDir(LOG_PATH)
  return await join(await resourceDir(), LOG_PATH)
}
// 获取 config目录， RESOURCE_PATH+CONFIG_PATH
// export const getConfigPath = async () => {
//   const configPath = await join(RESOURCE_PATH, CONFIG_PATH)
//   await checkDir(CONFIG_PATH)
//   return configPath
// }

/**
 * 写入内容到文件
 * 1.支持写入字符串或二进制数据 (Uint8Array)
 * 2.可以指定基础目录 (默认为 AppData)
 * 3.支持追加模式和创建新文件的选项
 * 4.包含完整的错误处理
 * @param filePath 文件路径
 * @param content 写入的内容
 * @param options 可选参数
 *
 * 使用示例:
 * ```
 *  await writeFileContent('config.json', '{"setting": "value"}');
 *   // 使用选项
 *   await writeFileContent('data.txt', 'content', {
 *     baseDir: BaseDirectory.AppConfig,
 *     append: true,
 *     createNew: false
 *   });
 *   // 写入二进制数据
 *   const binaryData = new Uint8Array([1, 2, 3]);
 *   await writeFileContent('data.bin', binaryData);
 * ```
 */
export async function writeFileContent(
  filePath: string,
  content: string | Uint8Array,
  options?: {
    baseDir?: BaseDirectory // 基础目录
    append?: boolean // 是否追加模式
    createNew?: boolean // 是否创建新文件
  }
): Promise<void> {
  try {
    const finalOptions = { baseDir: BaseDirectory.Resource, append: false, ...options }
    await checkDir(filePath)
    if (typeof content === 'string') {
      // 使用 writeTextFile 处理字符串内容
      await writeTextFile(filePath, content, finalOptions)
    } else {
      // 二进制内容继续使用 writeFile
      await writeFile(filePath, content, finalOptions)
    }
  } catch (e: any) {
    error(`写入文件时出错:${JSON.stringify(e)}`)
    throw e
  }
}

/**
 * 读取文件内容的通用方法
 * @param filePath 文件路径
 * @param options 可选参数
 * @returns Promise<string | Uint8Array> 返回文件内容，如果 asBinary 为 true 则返回 Uint8Array，否则返回字符串
 *
 * 使用示例:
 * ```typescript
 * // 读取文本文件
 * const textContent = await readFileContent('config.json');
 *
 * // 读取二进制文件
 * const binaryContent = await readFileContent('data.bin', { asBinary: true });
 *
 * // 从特定目录读取
 * const configContent = await readFileContent('settings.json', {
 *   baseDir: BaseDirectory.AppConfig
 * });
 * ```
 */
export async function readFileContent(
  filePath: string,
  options?: {
    baseDir?: BaseDirectory // 基础目录
    asBinary?: boolean // 是否以二进制方式读取
  }
): Promise<string | Uint8Array> {
  try {
    const { baseDir = BaseDirectory.Resource, asBinary = false } = options || {}
    await checkDir(filePath)
    if (asBinary) {
      const content = await readFile(filePath, { baseDir })
      return content
    } else {
      const content = await readTextFile(filePath, { baseDir })
      return content
    }
  } catch (e: any) {
    error(`Error reading file ${filePath}:${JSON.stringify(e)}`)
    return ''
  }
}

// 列出目录下的所有文件
export const listFiles = async (targetDir: string = RESOURCE_PATH) => {
  try {
    await checkDir(targetDir)
    const entries = await readDir(targetDir, { baseDir: BaseDirectory.Resource })
    return entries.map((entry) => entry.name)
  } catch (e: any) {
    error(`Error listing resource files:${JSON.stringify(e)}`)
    return []
  }
}

// 列出 resource 目录下的所有 .toml 文件
export const listTomlFiles = async (targetDir: string = CONFIG_PATH) => {
  try {
    // @ts-ignore
    const _ = await checkDir(targetDir)

    const entries = await readDir(targetDir, { baseDir: BaseDirectory.Resource })
    return entries.filter((entry) => entry.name.endsWith('.toml')).map((entry) => entry.name)
  } catch (e: any) {
    error(`Error listing resource files:${JSON.stringify(e)}`)
    return []
  }
}

// 写入 resource 目录下的 config.json 文件
export const writeConfigJsonObj = async (obj: any) => {
  const configJsonPath = await join(RESOURCE_PATH, 'config.json')
  await checkDir(configJsonPath)
  await writeFileContent(configJsonPath, JSON.stringify(obj), {
    baseDir: BaseDirectory.Resource
  })
}

// 读取 resource 目录下的 config.json 文件，并返回 JSON 对象
export const getConfigJsonObj = async () => {
  try {
    const configJsonPath = await join(RESOURCE_PATH, 'config.json')
    await checkDir(configJsonPath)
    const configJson = await readFileContent(configJsonPath, {
      baseDir: BaseDirectory.Resource
    })
    return JSON.parse(configJson as string)
  } catch (e: any) {
    error(`读取配置文件失败:${JSON.stringify(e)}`)
    await writeConfigJsonObj({})
    return {}
  }
}

/**
 * 强制删除指定路径的文件或目录
 * @param path 路径
 */
export const deleteFileOrDir = async (path: string) => {
  await remove(path, { baseDir: BaseDirectory.Resource, recursive: true })
}

/**
 * 下载文件
 * @param fileUrl 文件URL
 * @returns 下载是否成功
 * 使用示例：
 * ```typescript
 * const success = await downloadFile('https://example.com/file.zip');
 * ```
 */
export async function downloadFile(fileUrl: string): Promise<boolean> {
  try {
    info(`开始下载:${fileUrl}`)
    // 使用 Tauri 的 http plugin
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.95 Safari/537.36',
        Accept: '*/*',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1'
      },
      // 增加超时时间
      connectTimeout: 30000,
      maxRedirections: 2
      // responseType: ResponseType.Binary,
      // 添加下载进度监听
      // onDownloadProgress: (progress) => {
      //   if (progress.total) {
      //     const percentage = Math.floor((progress.loaded / progress.total) * 100)
      //     updateProgressBar(fileUrl, percentage)
      //   }
      // }
    })
    if (!response.ok) {
      ElNotification({
        title: t('common.reminder'),
        message: t('easytier.downLoadError'),
        type: 'error'
      })
      return false
    }

    // 获取文件名从 URL 中提取
    const filename = fileUrl.split('/').pop() || 'downloaded_file'

    // 构建保存路径
    const savePath = await join(RESOURCE_PATH, filename)

    // 确保目录存在
    await checkDir(RESOURCE_PATH)

    // 获取二进制数据
    const uint8Array = new Uint8Array(await response.arrayBuffer())
    info(`开始写入文件:${savePath}`)

    // 写入文件
    await writeFileContent(savePath, uint8Array, {
      baseDir: BaseDirectory.Resource
    })

    ElNotification({
      title: t('common.reminder'),
      message: t('easytier.downLoadSuccess'),
      type: 'success'
    })
    return true
  } catch (e: any) {
    error(`下载文件时出错:${JSON.stringify(e)}`)
    ElNotification({
      title: t('common.reminder'),
      message: t('easytier.downLoadError'),
      type: 'error'
    })
    return false
  }
}

/**
 * 1.在资源管理器中打开指定目录
 * 2.在浏览器中打开指定网址
 * @param path 要打开的目录路径或网址
 */
export async function openPath(path: string) {
  try {
    await open(path)
  } catch (e: any) {
    error(`打开资源管理器失败:${JSON.stringify(e)}`)
  }
}

/**
 * 解压文件到指定目录，支持处理多层目录
 * @param zipPath 压缩文件路径（相对于 Resource 目录）
 * @param destPath 解压目标目录（相对于 Resource 目录）
 * @param keepDir   是否保留原路径
 * @returns Promise<boolean> 解压是否成功
 */
export async function extractFile(
  zipPath: string,
  destPath: string,
  keepDir: boolean = false
): Promise<boolean> {
  try {
    // 读取zip文件内容  resource\easytier-windows-x86_64-v2.0.3.zip
    const zipContent = (await readFileContent(zipPath, {
      baseDir: BaseDirectory.Resource,
      asBinary: true
    })) as Uint8Array

    // 使用 fflate 解压
    const files = unzipSync(zipContent)

    // 分析目录结构，找到最深的公共目录
    const paths = Object.keys(files)
    // easytier-windows-x86_64/
    const commonPrefix = await findCommonPrefix(paths)
    // 写入解压后的文件
    for (const [filePath, fileData] of Object.entries(files)) {
      try {
        // filePath:easytier-windows-x86_64/easytier-cli.exe
        // 如果文件在子目录中，去掉公共前缀  easytier-cli.exe
        const relativePath = commonPrefix ? filePath.replace(commonPrefix, '') : filePath
        // 跳过目录项
        if (relativePath.endsWith('/')) continue

        // 构建目标文件路径 resource\easytier-cli.exe
        let targetPath: string
        if (keepDir) {
          targetPath = await join(destPath, filePath)
        } else {
          targetPath = await join(destPath, relativePath)
        }
        // 确保目标目录存在
        await checkDir(await dirname(targetPath))

        // 写入文件
        await writeFileContent(targetPath, fileData, {
          baseDir: BaseDirectory.Resource
        })
      } catch (e: any) {
        error(`处理文件 ${filePath} 时出错:${JSON.stringify(e)}`)
      }
    }

    ElNotification({
      title: t('common.reminder'),
      message: t('easytier.extractSuccess'),
      type: 'success'
    })
    // 删除zip文件
    await deleteFileOrDir(zipPath)
    // 删除解压出来的目录
    // const dirPath = await join(RESOURCE_PATH, commonPrefix.replace('/', ''), '/')
    // info('dirPath', dirPath)
    // await deleteFileOrDir(dirPath)
    return true
  } catch (e: any) {
    error(`解压文件时出错:${JSON.stringify(e)}`)
    ElNotification({
      title: t('common.reminder'),
      message: t('easytier.extractError'),
      type: 'error',
      duration: 5000
    })
    return false
  }
}

/**
 * 查找所有路径的公共前缀目录
 * @param paths 路径数组
 * @returns 公共前缀
 */
async function findCommonPrefix(paths: string[]): Promise<string> {
  if (paths.length === 0) return ''
  if (paths.length === 1) return await dirname(paths[0])

  // 分割所有路径
  const parts = paths.map((p) => p.split('/').filter(Boolean))

  const prefix: string[] = []
  const firstParts = parts[0]

  for (let i = 0; i < firstParts.length; i++) {
    const part = firstParts[i]
    if (parts.every((p) => p[i] === part)) {
      prefix.push(part)
    } else {
      break
    }
  }

  return prefix.length > 0 ? `${prefix.join('/')}/` : ''
}

// 清空程序logs目录下 pkg name 的日志文件，以免日志文件过大
export const clearLogs = async () => {
  const logsFile = await join('logs', pkg.name + '.log')
  // 清空 logsFile 的内容
  await writeFileContent(logsFile, '', { baseDir: BaseDirectory.Resource })
}
