import { CONFIG_PATH, NSSM_NAME } from '@/constants/easytier'
import { invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { attachConsole, debug, error, info, warn } from '@tauri-apps/plugin-log'
import { Command, type SpawnOptions } from '@tauri-apps/plugin-shell'
import { getCliDir, getCoreDir, getDataDir, getResourceDir, readFileContent } from './fileUtil'
import { getPlatform, sleep } from './sysUtil'
import * as toml from 'smol-toml'

// 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
attachConsole()

/** 根据平台返回合适的编码 */
const platformEncoding = async () => ((await getPlatform()) === 'windows' ? 'gbk' : 'utf-8')

/**
 * 从配置文件中读取日志配置
 * @param configFileName 配置文件名
 * @returns 日志目录和日志级别
 */
async function getLogConfigFromFile(configFileName: string): Promise<{
  logDir: string
  logLevel: string
}> {
  try {
    // 读取配置文件内容
    const configContent = (await readFileContent(CONFIG_PATH + '/' + configFileName)) as string
    const config = toml.parse(configContent) as any

    // 获取日志配置，提供默认值
    const logDir = config.file_logger?.dir || './log'
    const logLevel = config.file_logger?.level || 'info'

    return { logDir, logLevel }
  } catch (e) {
    error(`读取配置文件日志配置失败:${JSON.stringify(e)}`)
    // 返回默认值
    return { logDir: './log', logLevel: 'info' }
  }
}

/**
 * 构建 easytier-core 启动参数（包含日志配置）
 * @param configFileName 配置文件名（如 server.toml）
 * @param configPath 配置文件完整路径
 * @returns 完整的启动参数字符串
 */
export async function buildCoreArgsWithLogConfig(
  configFileName: string,
  configPath: string
): Promise<string> {
  const { logDir, logLevel } = await getLogConfigFromFile(configFileName)
  return `--file-log-dir "${logDir}" --file-log-level ${logLevel} --config-file "${configPath}"`
}

/**
 * 执行外部程序并等待其完成
 * @param program 程序路径
 * @param args 程序参数数组
 * @param options 执行选项（可选）
 * @returns Promise<string> 程序输出
 *
 * 使用示例:
 * ```
 * // 示例：执行命令并等待结果
 * const output = await executeAndWait('git', ['status'])
 * info('命令输出:', output)
 * ```
 */
export async function executeCmd(
  program: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<any> {
  try {
    // debug('执行命令：' + program)
    // debug('执行参数：' + JSON.stringify(args))
    // 创建命令实例
    const command = Command.create(program, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: options.encoding
    })
    // 执行并等待完成
    const output = await command.execute()
    const code = output.code || 1
    const stderr = output.stderr || ''
    const stdout = output.stdout || ''
    // info(`执行结果code：${code}`)
    // info(`执行结果stdout：${stdout}`)
    // info(`执行结果stderr：${stderr}`)
    if (stderr || (code && code == 3)) {
      if (stderr.includes('由于目标计算机积极拒绝') || code === 3) {
        return {
          code: code || 403,
          msg: stderr.trim() || stdout.trim() || output
        }
      }
      warn(`执行命令失败: ${program} ${args.join(' ')}`)
      warn(`输出: ${stdout || stderr || '未知错误'}`)
      return {
        code: code || 403,
        msg: stderr.trim() || stdout.trim() || output
      }
    }
    return stdout.trim() || output
  } catch (e: any) {
    error(`执行命令失败: ${program} ${args.join(' ')}: ${JSON.stringify(e)}`)
    throw e
  }
}

/**
 * 在后台持续运行外部程序
 * @param program 程序路径
 * @param args 程序参数数组
 * @param options 执行选项（可选）
 * @returns Promise<number> 返回进程 PID
 *
 * 使用示例:
 * ```
 * // 示例1: 启动 Node.js 服务
 * const pid = await executeBack('node', ['server.js'])
 *
 * // 示例2: 启动 Python 脚本
 * const pid = await executeBack('python', ['script.py'], {
 *   cwd: '/path/to/project'
 * })
 *
 * // 示例3: 启动带环境变量的程序
 * const pid = await executeBack('myapp', [], {
 *   env: {
 *     'NODE_ENV': 'production'
 *   }
 * })
 * ```
 */
export async function executeBack(
  program: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<number> {
  try {
    // 根据操作系统选择不同的命令
    const platform = await getPlatform()
    const binPath = await join(await getResourceDir(), program)
    let finalProgram = program
    let finalArgs = args
    if (platform === 'windows') {
      // Windows 下使用 start 命令在后台运行
      // 注意：cmd /c 会将后面的参数拼接成字符串并通过 shell 解析
      // 所以需要将整个命令构建成一个字符串，并正确处理包含空格的路径
      // start 命令格式：start ["title"] [/d path] [options] command [parameters]
      // 第一个引号参数被当作窗口标题，所以我们用空字符串 "" 作为标题
      const quotedProgram = program.includes(' ') ? `"${program}"` : program
      // 为包含空格的参数添加引号
      const quotedArgs = args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')
      // 将整个命令拼接成一个字符串传递给 cmd /c
      const commandStr = `start "" /b ${quotedProgram} ${quotedArgs}`
      finalArgs = ['/c', commandStr]
      finalProgram = 'cmd'
    }
    if (platform === 'linux' || platform === 'macos') {
      // 使用 sudo 运行 nohup
      // Unix 系统使用数组参数，Tauri 会正确处理包含空格的参数，不需要手动添加引号
      finalArgs = ['nohup', binPath, ...args]
      finalProgram = 'sudo'
    }
    info(`执行命令：${finalProgram}`)
    info(`执行参数：${JSON.stringify(finalArgs)}`)
    // 创建命令对象
    const command = Command.create(finalProgram, finalArgs, options)

    // 监听输出(可选)
    command.stdout.on('data', (line) => {
      info(`[${program}] 输出:${line}`)
    })
    // command.stderr.on('data', (line) => {
    //   error(`[${program}] stderr:`, line)
    // })

    // // 监听关闭事件
    // command.on('close', (data) => {
    //   info(`[${program}] 进程退出, code: ${data.code}, signal: ${data.signal}`)
    // })

    // 监听错误
    command.on('error', (e: any) => {
      error(`[${program}] 错误:${e}`)
    })

    // 启动进程
    const child = await command.spawn()

    info(`[${program}] 后台进程已启动, PID: ${child.pid}`)
    return child.pid
  } catch (e: any) {
    error(`启动后台程序失败:${e}`)
    throw error
  }
}

// 运行 easytier-core 配置
export async function runEasyTierCore(configFileName: string): Promise<any> {
  try {
    const configPath = await join(getDataDir(), CONFIG_PATH, configFileName)
    const program = await getCoreDir()

    // 读取配置文件获取日志配置
    const { logDir, logLevel } = await getLogConfigFromFile(configFileName)

    const res = await invoke('run_command', {
      program,
      args: [
        '--file-log-dir',
        `${logDir}`,
        '--file-log-level',
        logLevel,
        '--file-log-size',
        '10',
        '--file-log-count',
        '10',
        '--config-file',
        `${configPath}`
      ]
    })
    info(`运行结果：${res}`)
    return res
  } catch (e) {
    error(`运行 easytier-core失败:${JSON.stringify(e)}`)
    return 403
  }
}

// 运行 easytier-core web配置
export async function runEasyTierCoreWeb(url: string): Promise<any> {
  try {
    const program = await getCoreDir()
    const res = await invoke('run_command', {
      program,
      args: ['--config-server', `${url}`]
    })
    info(`运行结果：${res}`)
    return res
  } catch (e) {
    error(`运行 easytier-core失败:${JSON.stringify(e)}`)
    return 403
  }
}

// 运行 easytier-cli 配置
export async function runEasyTierCli(args: string[]): Promise<any> {
  try {
    return await executeCmd('easytier-cli', args)
    // 使用rust api 会出现卡顿
    // const program = await getCliDir()
    // return await invoke('run_cli', {
    //   program,
    //   args
    // })
  } catch (e) {
    error(`执行 easytier-cli ${args.join(' ')} 失败: ${JSON.stringify(e)}`)
    return 403
  }
}

export async function runCmd(args: string[]): Promise<any> {
  try {
    const program = await getCliDir()
    return await invoke('run_cli', {
      program,
      args
    })
  } catch (e) {
    error(`执行 run_cli [${args.join(' ')}] 失败: ${JSON.stringify(e)}`)
    return 403
  }
}

/**
 * 根据PID终止进程
 * @param pid 进程ID
 * @param force 是否强制终止 (默认false)
 * @returns Promise<boolean> 是否成功终止
 *
 * 使用示例:
 * ```
 * // 正常终止进程
 * await killProcess(1234)
 *
 * // 强制终止进程
 * await killProcess(1234, true)
 * ```
 */
export async function killProcess(pid: number, force: boolean = true): Promise<boolean> {
  try {
    const platform = await getPlatform()
    // Windows 使用 taskkill 命令
    if (platform === 'windows') {
      const args = force ? ['/F', '/PID', pid.toString()] : ['/PID', pid.toString()]
      const result = await executeCmd('taskkill', args, { encoding: 'gbk' })
      debug(`强制终止进程 ${result}`)
    }
    // Unix-like 系统使用 kill 命令
    else {
      const signal = force ? '-9' : '-15' // SIGKILL vs SIGTERM
      const result = await executeCmd('kill', [signal, pid.toString()])
      debug(`强制终止进程 ${result}`)
    }
    info(`进程 ${pid} 已终止`)
    return true
  } catch (e: any) {
    error(`终止进程 ${pid} 失败:${e}`)
    return false
  }
}

// 停止所有节点
export async function stopAllNodes() {
  try {
    const processList = await getRunningProcesses('easytier-core')
    processList.forEach(async (process) => {
      await killProcess(process.pid)
    })
  } catch (e) {
    error(`停止所有节点失败:${e}`)
  }
}

// Linux/macOS 下使用 sudo 的示例
export async function killProcessWithSudo(pid: number, force: boolean = false): Promise<boolean> {
  try {
    const signal = force ? '-9' : '-15'
    await executeCmd('sudo', ['kill', signal, pid.toString()])
    return true
  } catch (e: any) {
    error(`使用 sudo 终止进程 ${pid} 失败:${e}`)
    return false
  }
}

// 跨平台结束所有 easytier-core 进程
export async function killAllEasyTierCoreProcess() {
  const platform = await getPlatform()
  if (platform === 'windows') {
    return await executeCmd('taskkill', ['/IM', 'easytier-core.exe', '/F'], { encoding: 'gbk' })
  }
  return await executeCmd('killall', ['easytier-core'])
}

// 测试是否有 wmic 命令
export const testWMIC = async () => {
  try {
    await executeCmd('wmic', ['os'], { encoding: 'gbk' })
    return true
  } catch (_e: any) {
    return false
  }
}

/**
 * 获取正在运行的程序信息
 * @param {string} [programName] - 可选的程序名，用于模糊查询
 * @returns {Promise<Array>} - 返回一个包含程序信息的数组对象
 */
export const getRunningProcesses = async (
  programName: string = 'easytier-core'
): Promise<Array<any>> => {
  return new Promise(async (resolve, reject) => {
    let args: string[] = []
    let program = ''
    let encoding = 'utf-8'
    const processInfo: any[] = []
    const platform = await getPlatform()

    if (platform === 'windows') {
      // 新的 PowerShell 命令
      const psCommand = `\
        Get-CimInstance -ClassName Win32_Process -Filter "CommandLine LIKE '%${programName}%'" |\
        Select-Object @{N='name';E={$_.Caption}},\
                      @{N='commandLine';E={$_.CommandLine}},\
                      @{N='path';E={$_.ExecutablePath}},\
                      @{N='pid';E={$_.ProcessId}},\
                      @{N='memory';E={$_.WorkingSetSize}} |\
        ConvertTo-Json -Compress\
      `.trim()

      program = 'powershell'
      // 可选 ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand]
      args = ['-NoProfile', '-Command', psCommand]
      encoding = 'gbk'
    } else if (platform === 'macos' || platform === 'linux') {
      // macOS 和 Linux 使用 ps 命令
      // 注意：管道符需要通过 shell 执行，所以使用 sh -c 包装整个命令
      const psCommand = `ps -eo comm,args,pid,rss | grep ${programName}`
      program = 'sh'
      args = ['-c', psCommand]
    } else {
      reject(new Error('Unsupported OS'))
      return
    }
    executeCmd(program, args, { encoding })
      .then((res) => {
        if (platform === 'windows') {
          // Windows: 解析 PowerShell JSON 输出
          let parsed = JSON.parse(res || '[]')
          parsed = Array.isArray(parsed) ? parsed : [parsed]
          const result = parsed.filter((r: any) => !r.name?.includes('powershell.exe'))
          result.forEach((p: any) => {
            if (p.commandLine && p.commandLine.includes(programName)) {
              processInfo.push({
                name: p.name,
                commandLine: p.commandLine,
                path: p.path,
                pid: parseInt(p.pid, 10) || 0,
                memory: parseInt(p.memory, 10) || 0,
                fileName: programName
              })
            }
          })
        } else if (platform === 'macos' || platform === 'linux') {
          // Unix: 解析 ps 文本输出
          const output = typeof res === 'string' ? res : res?.msg || ''
          if (!output.trim()) {
            resolve(processInfo)
            return
          }
          const lines = output.trim().split('\n')
          lines.forEach((line: string) => {
            // 跳过 grep 自身的进程
            if (line.includes('grep')) return
            const parts = line.trim().split(/\s+/)
            if (parts.length >= 4) {
              const [comm, ...argsParts] = parts
              const pidIndex = argsParts.findIndex((p: string) => !isNaN(parseInt(p, 10)))
              if (pidIndex > -1) {
                const commandLine = argsParts.slice(0, pidIndex).join(' ')
                const pid = argsParts[pidIndex]
                const rss = argsParts[pidIndex + 1]
                if (commandLine.includes(programName)) {
                  processInfo.push({
                    name: comm,
                    commandLine: commandLine,
                    path: comm,
                    pid: parseInt(pid, 10),
                    memory: parseInt(rss, 10) * 1024,
                    fileName: programName
                  })
                }
              }
            }
          })
        }
        resolve(processInfo)
      })
      .catch((error) => {
        reject(error)
      })
  })
}
/**
 * 检测服务是否存在
 * @param serviceName 服务名
 * @returns Promise<boolean> 是否存在
 */
export const checkServiceOnWindows = (serviceName: string): Promise<any> => {
  return new Promise(async (resolve) => {
    try {
      const args = ['status', serviceName]
      const res: any = await executeCmd(NSSM_NAME, args, { encoding: 'gbk' })
      // debug('检测服务:' + JSON.stringify(res))
      // Can't open service!\r\r\nOpenService(): The specified service does not exist as an installed service.
      if (res && (res.code! === 3 || res.includes('does not exist'))) {
        resolve(false)
        return
      }
      resolve(res)
    } catch (e: any) {
      // error('检测服务出错:' + JSON.stringify(e))
      resolve(false)
    }
  })
}
/*
# 无需确认移除服务：
nssm remove <servicename> confirm
# 管理服务：
nssm start <servicename>     # 启动服务
nssm stop <servicename>      # 停止服务
nssm restart <servicename>   # 重启服务
nssm status <servicename>    # 显示服务状态
nssm statuscode <servicename>   # 显示服务状态码
nssm rotate <servicename>    # 旋转服务日志
nssm processes <servicename> # 显示服务关联的进程
 */
/**
 * Windows 安装指定程序为系统服务
 * @param serviceName 服务名
 * @param args 程序参数
 * @param options 可选参数
 * @param options.username 运行服务的用户名（可选，不提供则使用 LocalSystem）
 * @param options.password 运行服务的用户密码（当提供 username 时必需）
 * @returns Promise<boolean> 是否成功
 */
export const installServiceOnWindows = async (
  serviceName: string,
  args: string,
  options?: { username?: string; password?: string }
) => {
  return new Promise(async (resolve) => {
    const appDirectory = await getResourceDir()
    // Windows 需要 .exe 扩展名
    const corePath = await join(appDirectory, 'easytier-core.exe')
    // const logsPath = await getLogsDir()
    try {
      // 服务是否存在
      const exist: any = await checkServiceOnWindows(serviceName)
      info(`服务是否存在:${JSON.stringify(exist)}`)
      if (exist) {
        resolve(true)
        return
      }
      // 检测文件是否存在
      // await fileExist(await join(LOG_PATH, 'service.log'))
      // 注意：Tauri Command.create 会将每个数组元素作为独立参数传递，不需要手动添加引号
      // 引号只在通过 shell 解析字符串时需要
      const args1 = ['install', serviceName, `${corePath}`]

      const args2 = ['set', serviceName, 'AppParameters', `${args}`]
      const args3 = ['set', serviceName, 'AppDirectory', appDirectory]
      const args4 = ['set', serviceName, 'AppExit', 'Default', 'Restart']
      const args5 = ['set', serviceName, 'Description', `EasyTier 组网,服务配置:${serviceName}`]
      const args6 = ['set', serviceName, 'DisplayName', `EasyTier 组网 ${serviceName}`]

      // 如果提供了用户名和密码，使用指定用户运行服务；否则使用 LocalSystem
      let args7: string[]
      if (options?.username && options?.password) {
        args7 = ['set', serviceName, 'ObjectName', `.\\${options.username}`, options.password]
        info(`使用用户 ${options.username} 运行服务`)
      } else {
        args7 = ['set', serviceName, 'ObjectName', 'LocalSystem']
        info('使用 LocalSystem 运行服务')
      }

      const args8 = ['set', serviceName, 'Start', 'SERVICE_AUTO_START']
      const args9 = ['set', serviceName, 'Type', 'SERVICE_WIN32_OWN_PROCESS']
      // 重定向日志到文件
      // const args10 = ['set', serviceName, 'AppStdout', `${logsPath}\\service.log`]
      // const args11 = ['set', serviceName, 'AppStderr', `${logsPath}\\service.log`]
      // const args12 = ['set', serviceName, 'AppTimestampLog', '1']
      await executeCmd(NSSM_NAME, args1, { encoding: 'gbk' }).then(async (res) => {
        info(`安装服务结果:${JSON.stringify(res)}`)
        if (
          res &&
          (res.code! === 0 ||
            res.code! === 1 ||
            res.includes('success') ||
            res.includes('installed'))
        ) {
          await executeCmd(NSSM_NAME, args2, { encoding: 'gbk' })
          await executeCmd(NSSM_NAME, args3, { encoding: 'gbk' })
          await executeCmd(NSSM_NAME, args4, { encoding: 'gbk' })
          await executeCmd(NSSM_NAME, args5, { encoding: 'gbk' })
          await executeCmd(NSSM_NAME, args6, { encoding: 'gbk' })
          await executeCmd(NSSM_NAME, args7, { encoding: 'gbk' })
          await executeCmd(NSSM_NAME, args8, { encoding: 'gbk' })
          await executeCmd(NSSM_NAME, args9, { encoding: 'gbk' })
          // await executeCmd(NSSM_NAME, args10, { encoding: 'gbk' })
          // await executeCmd(NSSM_NAME, args11, { encoding: 'gbk' })
          // await executeCmd(NSSM_NAME, args12, { encoding: 'gbk' })
          resolve(true)
          return
        }
        resolve(false)
      })
    } catch (e: any) {
      error(`安装服务失败:${e}`)
      resolve(false)
    }
  })
}
/**
 * Windows 删除服务
 * @param serviceName 服务名
 * @returns Promise<boolean> 是否成功
 */
export const uninstallServiceOnWindows = (serviceName: string) => {
  return new Promise(async (resolve) => {
    try {
      const args = ['remove', serviceName, 'confirm']
      const res: any = await executeCmd(NSSM_NAME, args, { encoding: 'gbk' })
      info(`删除服务:${JSON.stringify(res)}`)
      if (res && (res.code! === 0 || res.includes('success'))) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (e: any) {
      error(`删除服务出错:${e}`)
      resolve(false)
    }
  })
}
/**
 * Windows 启动服务
 * @param serviceName 服务名
 * @returns Promise<boolean> 是否成功
 */
export const startServiceOnWindows = (serviceName: string) => {
  return new Promise(async (resolve) => {
    try {
      const args = ['start', serviceName]
      await executeCmd(NSSM_NAME, args, { encoding: 'gbk' })
      await sleep(2000)
      const res = await checkServiceOnWindows(serviceName)
      info('启动服务:' + JSON.stringify(res))
      if (JSON.stringify(res).includes('SERVICE_STOPPED')) {
        resolve(false)
        return
      }
      resolve(true)
    } catch (e: any) {
      error('启动服务出错:', e)
      resolve(false)
    }
  })
}

/**
 * Windows 停止服务
 * @param serviceName 服务名
 * @returns Promise<boolean> 是否成功
 */
export const stopServiceOnWindows = (serviceName: string) => {
  return new Promise(async (resolve) => {
    try {
      const args = ['stop', serviceName]
      await executeCmd(NSSM_NAME, args, { encoding: 'gbk' })
      await sleep(2000)
      const res = await checkServiceOnWindows(serviceName)
      info('停止服务:' + JSON.stringify(res))
      if (JSON.stringify(res).includes('SERVICE_STOPPED')) {
        resolve(true)
        return
      }
      resolve(false)
    } catch (e: any) {
      error('停止服务出错:', e)
      resolve(false)
    }
  })
}

/**
 * 使用官方 easytier-cli 安装服务
 */
export const installServiceWithOfficialCli = async (
  _serviceName: string, // 注释：官方CLI不需要serviceName参数，但保留以兼容调用方
  configPath: string,
  configFileName: string,
  options: {
    description?: string
    displayName?: string
    disableAutostart?: boolean
  } = {}
) => {
  return new Promise(async (resolve) => {
    try {
      const appDirectory = await getResourceDir()
      const platform = await getPlatform()

      // Windows 需要 .exe 扩展名
      const coreFileName = platform === 'windows' ? 'easytier-core.exe' : 'easytier-core'
      const corePath = await join(appDirectory, coreFileName)

      // 构建命令参数
      const args = ['service', 'install']

      if (options.description) {
        args.push('--description', options.description)
      }

      if (options.displayName) {
        args.push('--display-name', options.displayName)
      }

      if (options.disableAutostart) {
        args.push('--disable-autostart')
      }

      // 注意：Tauri Command.create 会将每个数组元素作为独立参数传递，不需要手动添加引号
      args.push('--core-path', `${corePath}`)
      args.push('--service-work-dir', appDirectory)

      // 读取配置文件获取日志配置
      const { logDir, logLevel } = await getLogConfigFromFile(configFileName)

      // 构建服务运行时的参数
      // 格式: easytier-core --file-log-dir ./log --file-log-level info --config-file config.toml
      args.push(
        '--',
        '--file-log-dir',
        `${logDir}`,
        '--file-log-level',
        logLevel,
        '--config-file',
        `${configPath}`
      )

      // 执行安装
      const res: any = await executeCmd('easytier-cli', args, { encoding: 'gbk' })

      info(`官方CLI安装服务结果: ${JSON.stringify(res)}`)

      if (
        res &&
        (res.code === 0 ||
          res.code === undefined ||
          res.includes('success') ||
          res.includes('安装成功'))
      ) {
        resolve(true)
        return
      }
      resolve(false)
    } catch (e: any) {
      error(`官方CLI安装服务失败: ${e}`)
      resolve(false)
    }
  })
}

/**
 * 使用官方 easytier-cli 卸载服务
 */
export const uninstallServiceWithOfficialCli = async (_serviceName: string) => {
  return new Promise(async (resolve) => {
    try {
      const res: any = await executeCmd('easytier-cli', ['service', 'uninstall'], {
        encoding: 'gbk'
      })
      info(`官方CLI卸载服务结果: ${JSON.stringify(res)}`)

      if (
        res &&
        (res.code === 0 ||
          res.code === undefined ||
          res.includes('success') ||
          res.includes('卸载成功'))
      ) {
        resolve(true)
        return
      }
      resolve(false)
    } catch (e: any) {
      error(`官方CLI卸载服务失败: ${e}`)
      resolve(false)
    }
  })
}

/**
 * 使用官方 easytier-cli 检查服务状态
 */
export const checkServiceWithOfficialCli = async (_serviceName: string) => {
  return new Promise(async (resolve) => {
    try {
      const res: any = await executeCmd('easytier-cli', ['service', 'status'], { encoding: 'gbk' })

      // info(`官方CLI检查服务状态: ${JSON.stringify(res)}`)

      if (typeof res === 'string') {
        const lowerRes = res.toLowerCase()

        // 首先检查未安装状态（优先级最高）
        if (
          lowerRes.includes('not installed') ||
          lowerRes.includes('未安装') ||
          lowerRes.includes('does not exist') ||
          lowerRes.includes('不存在')
        ) {
          resolve(false) // 未安装
          return
        }

        // 检查运行状态
        if (
          lowerRes.includes('running') ||
          lowerRes.includes('运行') ||
          lowerRes.includes('started') ||
          lowerRes.includes('active')
        ) {
          resolve('SERVICE_RUNNING')
          return
        }

        // 检查停止状态
        if (
          lowerRes.includes('stopped') ||
          lowerRes.includes('停止') ||
          lowerRes.includes('inactive')
        ) {
          resolve('SERVICE_STOPPED')
          return
        }
      }

      // 检查返回对象的错误码
      if (res && typeof res === 'object') {
        // code 为 0 表示命令执行成功
        if (res.code === 0) {
          resolve('SERVICE_STOPPED')
          return
        }
        // 其他错误码表示服务不存在或命令失败
        if (res.code !== undefined && res.code !== 0) {
          resolve(false)
          return
        }
      }

      // 默认未安装
      resolve(false)
    } catch (e: any) {
      error(`官方CLI检查服务状态失败: ${e}`)
      resolve(false)
    }
  })
}

/**
 * 使用官方 easytier-cli 启动服务
 */
export const startServiceWithOfficialCli = async (serviceName: string) => {
  return new Promise(async (resolve) => {
    try {
      await executeCmd('easytier-cli', ['service', 'start'], { encoding: 'gbk' })
      await sleep(2000)

      const status = await checkServiceWithOfficialCli(serviceName)
      resolve(status === 'SERVICE_RUNNING')
    } catch (e: any) {
      error(`官方CLI启动服务失败: ${e}`)
      resolve(false)
    }
  })
}

/**
 * 使用官方 easytier-cli 停止服务
 */
export const stopServiceWithOfficialCli = async (serviceName: string) => {
  return new Promise(async (resolve) => {
    try {
      await executeCmd('easytier-cli', ['service', 'stop'], { encoding: 'gbk' })
      await sleep(2000)

      const status = await checkServiceWithOfficialCli(serviceName)
      resolve(status === 'SERVICE_STOPPED')
    } catch (e: any) {
      error(`官方CLI停止服务失败: ${e}`)
      resolve(false)
    }
  })
}

/**
 * 自动检测服务安装方式（跨平台）
 */
export const detectServiceInstallMethod = async (
  serviceName: string
): Promise<'native' | 'official' | 'none'> => {
  const configFileName = serviceName.replace(/^easytier-/, '')
  const SERVICE_CONFIG_PREFIX = 'service-config:'
  const savedConfigStr = localStorage.getItem(SERVICE_CONFIG_PREFIX + configFileName)
  const platform = await getPlatform()

  if (savedConfigStr) {
    try {
      const savedConfig = JSON.parse(savedConfigStr)
      const savedMethod = savedConfig.installMethod

      if (savedMethod === 'native' || savedMethod === 'nssm') {
        const status = await checkServiceNative(serviceName)
        return status && status !== false ? 'native' : 'none'
      } else if (savedMethod === 'official') {
        const status = await checkServiceWithOfficialCli(serviceName)
        return status && status !== false ? 'official' : 'none'
      }
    } catch (e) {
      error(`解析服务配置失败: ${e}`)
    }
  }

  // 没有保存的配置，使用自动检测
  // 先检查原生方式 (NSSM/systemd/launchd)
  const nativeStatus = await checkServiceNative(serviceName)
  if (nativeStatus && nativeStatus !== false) {
    return 'native'
  }

  // 再检查官方 CLI（仅 Windows 和 Linux 有意义）
  if (platform === 'windows' || platform === 'linux') {
    const officialStatus = await checkServiceWithOfficialCli(serviceName)
    if (officialStatus && officialStatus !== false) {
      return 'official'
    }
  }

  return 'none'
}

/**
 * Windows 检测路由是否存在
 * @param ip
 * @returns
 */
export const checkRouteOnWindows = async (ip: string) => {
  return new Promise(async (resolve) => {
    try {
      const res = await executeCmd('route', ['print', '-4', ip], { encoding: 'gbk' })
      if (res.includes(ip)) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (e: any) {
      error('检测路由失败:', e)
      resolve(false)
    }
  })
}

/**
 * Windows 添加路由
 * @param ip
 * @returns
 */
export const addRouteOnWindows = async (ip: string) => {
  return new Promise(async (resolve) => {
    try {
      const res = await executeCmd('route', ['add', ip, 'mask', '255.255.255.255', '0.0.0.0'], {
        encoding: 'gbk'
      })
      if (res.includes('OK!')) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (e: any) {
      error('添加路由失败:', e)
      resolve(false)
    }
  })
}

/**
 * Windows 删除路由
 * @param ip
 * @returns
 */
export const delRouteOnWindows = async (ip: string) => {
  return new Promise(async (resolve) => {
    try {
      const res = await executeCmd('route', ['delete', ip], { encoding: 'gbk' })
      if (res.includes('OK!')) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (e: any) {
      error('删除路由失败:', e)
      resolve(false)
    }
  })
}

// ==================== systemd 服务管理 (Linux) ====================

/** 获取 systemd 服务单元名 */
const systemdUnitName = (serviceName: string) => `${serviceName}.service`

/** Linux: 检测 systemd 服务状态 */
export const checkServiceSystemd = async (serviceName: string): Promise<any> => {
  try {
    const res = await executeCmd('systemctl', ['is-active', systemdUnitName(serviceName)])
    const output = typeof res === 'string' ? res.trim() : res?.msg?.trim() || ''
    if (output === 'active') return 'SERVICE_RUNNING'
    if (output === 'inactive' || output === 'failed') return 'SERVICE_STOPPED'
    return false
  } catch {
    return false
  }
}

/** Linux: 安装 systemd 服务 */
export const installServiceSystemd = async (
  serviceName: string,
  configPath: string,
  configFileName: string,
  options: { description?: string; disableAutostart?: boolean } = {}
): Promise<boolean> => {
  try {
    const appDirectory = await getResourceDir()
    const corePath = await join(appDirectory, 'easytier-core')
    const { logDir, logLevel } = await getLogConfigFromFile(configFileName)
    const desc = options.description || `EasyTier P2P Network - ${serviceName}`

    const unitContent = [
      '[Unit]',
      `Description=${desc}`,
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      `WorkingDirectory=${appDirectory}`,
      `ExecStart=${corePath} --file-log-dir "${logDir}" --file-log-level ${logLevel} --config-file "${configPath}"`,
      'Restart=on-failure',
      'RestartSec=5',
      '',
      '[Install]',
      'WantedBy=multi-user.target'
    ].join('\n')

    // 写入 unit 文件（需要 sudo）
    const unitPath = `/etc/systemd/system/${systemdUnitName(serviceName)}`
    await executeCmd('sudo', [
      'sh',
      '-c',
      `cat > ${unitPath} << 'EOFUNIT'\n${unitContent}\nEOFUNIT`
    ])
    await executeCmd('sudo', ['systemctl', 'daemon-reload'])

    if (!options.disableAutostart) {
      await executeCmd('sudo', ['systemctl', 'enable', systemdUnitName(serviceName)])
    }
    return true
  } catch (e: any) {
    error(`安装 systemd 服务失败: ${e}`)
    return false
  }
}

/** Linux: 卸载 systemd 服务 */
export const uninstallServiceSystemd = async (serviceName: string): Promise<boolean> => {
  try {
    await executeCmd('sudo', ['systemctl', 'stop', systemdUnitName(serviceName)])
    await executeCmd('sudo', ['systemctl', 'disable', systemdUnitName(serviceName)])
    await executeCmd('sudo', ['rm', '-f', `/etc/systemd/system/${systemdUnitName(serviceName)}`])
    await executeCmd('sudo', ['systemctl', 'daemon-reload'])
    return true
  } catch (e: any) {
    error(`卸载 systemd 服务失败: ${e}`)
    return false
  }
}

/** Linux: 启动 systemd 服务 */
export const startServiceSystemd = async (serviceName: string): Promise<boolean> => {
  try {
    await executeCmd('sudo', ['systemctl', 'start', systemdUnitName(serviceName)])
    await sleep(2000)
    const status = await checkServiceSystemd(serviceName)
    return status === 'SERVICE_RUNNING'
  } catch (e: any) {
    error(`启动 systemd 服务失败: ${e}`)
    return false
  }
}

/** Linux: 停止 systemd 服务 */
export const stopServiceSystemd = async (serviceName: string): Promise<boolean> => {
  try {
    await executeCmd('sudo', ['systemctl', 'stop', systemdUnitName(serviceName)])
    await sleep(2000)
    const status = await checkServiceSystemd(serviceName)
    return status === 'SERVICE_STOPPED' || status === false
  } catch (e: any) {
    error(`停止 systemd 服务失败: ${e}`)
    return false
  }
}

// ==================== launchd 服务管理 (macOS) ====================

/** 获取 launchd plist 标签 */
const launchdLabel = (serviceName: string) => `com.easytier.${serviceName}`
/** 获取 launchd plist 路径 */
const launchdPlistPath = (serviceName: string) =>
  `$HOME/Library/LaunchAgents/${launchdLabel(serviceName)}.plist`

/** macOS: 检测 launchd 服务状态 */
export const checkServiceLaunchd = async (serviceName: string): Promise<any> => {
  try {
    const res = await executeCmd('launchctl', ['list', launchdLabel(serviceName)])
    const output = typeof res === 'string' ? res : ''
    if (output.includes(launchdLabel(serviceName))) return 'SERVICE_RUNNING'
    return false
  } catch {
    // launchctl list 对不存在的服务会报错
    return false
  }
}

/** macOS: 安装 launchd 服务 */
export const installServiceLaunchd = async (
  serviceName: string,
  configPath: string,
  configFileName: string,
  options: { description?: string; disableAutostart?: boolean } = {}
): Promise<boolean> => {
  try {
    const appDirectory = await getResourceDir()
    const corePath = await join(appDirectory, 'easytier-core')
    const { logDir, logLevel } = await getLogConfigFromFile(configFileName)
    const label = launchdLabel(serviceName)

    const plistContent = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      `  <key>Label</key><string>${label}</string>`,
      '  <key>ProgramArguments</key>',
      '  <array>',
      `    <string>${corePath}</string>`,
      `    <string>--file-log-dir</string><string>${logDir}</string>`,
      `    <string>--file-log-level</string><string>${logLevel}</string>`,
      `    <string>--config-file</string><string>${configPath}</string>`,
      '  </array>',
      `  <key>WorkingDirectory</key><string>${appDirectory}</string>`,
      `  <key>RunAtLoad</key><${!options.disableAutostart}/>`,
      '  <key>KeepAlive</key><true/>',
      '</dict>',
      '</plist>'
    ].join('\n')

    const plistPath = launchdPlistPath(serviceName)
    // 展开 $HOME 并写入 plist
    await executeCmd('sh', ['-c', `cat > ${plistPath} << 'EOFPLIST'\n${plistContent}\nEOFPLIST`])
    await executeCmd('sh', ['-c', `launchctl load ${plistPath}`])
    return true
  } catch (e: any) {
    error(`安装 launchd 服务失败: ${e}`)
    return false
  }
}

/** macOS: 卸载 launchd 服务 */
export const uninstallServiceLaunchd = async (serviceName: string): Promise<boolean> => {
  try {
    const plistPath = launchdPlistPath(serviceName)
    await executeCmd('sh', ['-c', `launchctl unload ${plistPath}`])
    await executeCmd('sh', ['-c', `rm -f ${plistPath}`])
    return true
  } catch (e: any) {
    error(`卸载 launchd 服务失败: ${e}`)
    return false
  }
}

/** macOS: 启动 launchd 服务 */
export const startServiceLaunchd = async (serviceName: string): Promise<boolean> => {
  try {
    await executeCmd('launchctl', ['start', launchdLabel(serviceName)])
    await sleep(2000)
    const status = await checkServiceLaunchd(serviceName)
    return status === 'SERVICE_RUNNING'
  } catch (e: any) {
    error(`启动 launchd 服务失败: ${e}`)
    return false
  }
}

/** macOS: 停止 launchd 服务 */
export const stopServiceLaunchd = async (serviceName: string): Promise<boolean> => {
  try {
    await executeCmd('launchctl', ['stop', launchdLabel(serviceName)])
    await sleep(2000)
    const status = await checkServiceLaunchd(serviceName)
    return status === 'SERVICE_STOPPED' || status === false
  } catch (e: any) {
    error(`停止 launchd 服务失败: ${e}`)
    return false
  }
}

// ==================== 跨平台原生服务统一接口 ====================

/** 跨平台: 检测原生服务状态 (NSSM/systemd/launchd) */
export const checkServiceNative = async (serviceName: string): Promise<any> => {
  const platform = await getPlatform()
  if (platform === 'windows') return checkServiceOnWindows(serviceName)
  if (platform === 'linux') return checkServiceSystemd(serviceName)
  if (platform === 'macos') return checkServiceLaunchd(serviceName)
  return false
}

/** 跨平台: 安装原生服务 */
export const installServiceNative = async (
  serviceName: string,
  configPath: string,
  configFileName: string,
  options: {
    description?: string
    displayName?: string
    disableAutostart?: boolean
    username?: string
    password?: string
  } = {}
): Promise<boolean> => {
  const platform = await getPlatform()
  if (platform === 'windows') {
    const args = await buildCoreArgsWithLogConfig(configFileName, configPath)
    const installOptions =
      options.username && options.password
        ? { username: options.username, password: options.password }
        : undefined
    return (await installServiceOnWindows(serviceName, args, installOptions)) as boolean
  }
  if (platform === 'linux') {
    return installServiceSystemd(serviceName, configPath, configFileName, options)
  }
  if (platform === 'macos') {
    return installServiceLaunchd(serviceName, configPath, configFileName, options)
  }
  return false
}

/** 跨平台: 卸载原生服务 */
export const uninstallServiceNative = async (serviceName: string): Promise<boolean> => {
  const platform = await getPlatform()
  if (platform === 'windows') return (await uninstallServiceOnWindows(serviceName)) as boolean
  if (platform === 'linux') return uninstallServiceSystemd(serviceName)
  if (platform === 'macos') return uninstallServiceLaunchd(serviceName)
  return false
}

/** 跨平台: 启动原生服务 */
export const startServiceNative = async (serviceName: string): Promise<boolean> => {
  const platform = await getPlatform()
  if (platform === 'windows') return (await startServiceOnWindows(serviceName)) as boolean
  if (platform === 'linux') return startServiceSystemd(serviceName)
  if (platform === 'macos') return startServiceLaunchd(serviceName)
  return false
}

/** 跨平台: 停止原生服务 */
export const stopServiceNative = async (serviceName: string): Promise<boolean> => {
  const platform = await getPlatform()
  if (platform === 'windows') return (await stopServiceOnWindows(serviceName)) as boolean
  if (platform === 'linux') return stopServiceSystemd(serviceName)
  if (platform === 'macos') return stopServiceLaunchd(serviceName)
  return false
}

// ==================== 跨平台路由管理 ====================

/** 跨平台: 检测路由是否存在 */
export const checkRoute = async (ip: string): Promise<boolean> => {
  try {
    const platform = await getPlatform()
    const enc = await platformEncoding()
    if (platform === 'windows') {
      const res = await executeCmd('route', ['print', '-4', ip], { encoding: enc })
      return typeof res === 'string' && res.includes(ip)
    } else if (platform === 'linux') {
      const res = await executeCmd('ip', ['route', 'show', ip])
      return typeof res === 'string' && res.includes(ip)
    } else {
      // macOS
      const res = await executeCmd('sh', ['-c', `netstat -rn | grep ${ip}`])
      return typeof res === 'string' && res.includes(ip)
    }
  } catch {
    return false
  }
}

/** 跨平台: 添加路由 */
export const addRoute = async (ip: string): Promise<boolean> => {
  try {
    const platform = await getPlatform()
    const enc = await platformEncoding()
    if (platform === 'windows') {
      const res = await executeCmd('route', ['add', ip, 'mask', '255.255.255.255', '0.0.0.0'], {
        encoding: enc
      })
      return typeof res === 'string' && res.includes('OK!')
    } else if (platform === 'linux') {
      await executeCmd('sudo', ['ip', 'route', 'add', `${ip}/32`, 'dev', 'lo'])
      return true
    } else {
      await executeCmd('sudo', ['route', 'add', '-host', ip, '127.0.0.1'])
      return true
    }
  } catch (e: any) {
    error(`添加路由失败: ${e}`)
    return false
  }
}

/** 跨平台: 删除路由 */
export const delRoute = async (ip: string): Promise<boolean> => {
  try {
    const platform = await getPlatform()
    const enc = await platformEncoding()
    if (platform === 'windows') {
      const res = await executeCmd('route', ['delete', ip], { encoding: enc })
      return typeof res === 'string' && res.includes('OK!')
    } else if (platform === 'linux') {
      await executeCmd('sudo', ['ip', 'route', 'del', `${ip}/32`])
      return true
    } else {
      await executeCmd('sudo', ['route', 'delete', '-host', ip])
      return true
    }
  } catch (e: any) {
    error(`删除路由失败: ${e}`)
    return false
  }
}

export const safeJsonParse = (str: string, fallback: any = {}) => {
  try {
    return str && str.trim() ? JSON.parse(str) : fallback
  } catch (e) {
    return fallback
  }
}
