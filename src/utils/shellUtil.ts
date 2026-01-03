import { CONFIG_PATH, NSSM_NAME } from '@/constants/easytier'
import { invoke } from '@tauri-apps/api/core'
import { join, resourceDir } from '@tauri-apps/api/path'
import { attachConsole, debug, error, info, warn } from '@tauri-apps/plugin-log'
import { Command, type SpawnOptions } from '@tauri-apps/plugin-shell'
import { getCliDir, getCoreDir, getResourceDir, readFileContent } from './fileUtil'
import { getPlatform, sleep } from './sysUtil'
import * as toml from 'smol-toml'

// 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
attachConsole()

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
  return `--file-log-dir ${logDir} --file-log-level ${logLevel} --config-file "${configPath}"`
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
      warn(`执行参数:${JSON.stringify(args)}`)
      warn(`执行程序失败:${stdout || stderr || '未知错误'}`)
      return {
        code: code || 403,
        msg: stderr.trim() || stdout.trim() || output
      }
    }
    return stdout.trim() || output
  } catch (e: any) {
    error(`执行程序失败:${JSON.stringify(e)}`)
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
    const configPath = await join(await resourceDir(), CONFIG_PATH, configFileName)
    const program = await getCoreDir()

    // 读取配置文件获取日志配置
    const { logDir, logLevel } = await getLogConfigFromFile(configFileName)

    const res = await invoke('run_command', {
      program,
      args: [
        '--file-log-dir',
        logDir,
        '--file-log-level',
        logLevel,
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
    error(`获取结果失败:${JSON.stringify(e)}`)
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
    error(`获取结果失败:${JSON.stringify(e)}`)
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

// Windows 结束所有 easytier-core 进程
export async function killAllEasyTierCoreProcessWin() {
  return await executeCmd('taskkill', ['/IM', 'easytier-core.exe', '/F'])
}

// Linux/macOS 结束所有 easytier-core 进程
export async function killAllEasyTierCoreProcessUnix() {
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
        res = JSON.parse(res || '[]')
        res = Array.isArray(res) ? res : []
        const result = res.filter((r) => !r.name.includes('powershell.exe'))
        if (result.length === 0) {
          resolve(processInfo)
          return
        }
        if (platform === 'windows') {
          // 解析JSON 输出
          result.forEach((p) => {
            if (p.commandLine && p.commandLine.includes(programName)) {
              const process = {
                name: p.name,
                commandLine: p.commandLine,
                path: p.path,
                pid: parseInt(p.pid, 10) || 0,
                memory: parseInt(p.memory, 10) || 0,
                fileName: programName
              }
              processInfo.push(process)
            }
          })
          // 解析 PowerShell 的 CSV 输出
          // const lines = result.trim().split('\n').slice(1) // 去掉标题行
          // lines.forEach((line: string) => {
          //   // "Caption","CommandLine","ExecutablePath","ProcessId","WorkingSetSize"
          //   const values = line
          //     .slice(1, -1)
          //     .split('","')
          //     .map((v) => v.trim())
          //
          //   if (values.length >= 5) {
          //     const [caption, commandLine, executablePath, processId, workingSetSize] = values
          //     if (commandLine && commandLine.includes(programName)) {
          //       const process = {
          //         name: caption,
          //         commandLine: commandLine,
          //         path: executablePath,
          //         pid: parseInt(processId, 10),
          //         memory: parseInt(workingSetSize, 10),
          //         fileName: programName
          //       }
          //       processInfo.push(process)
          //     }
          //   }
          // })
        } else if (platform === 'macos' || platform === 'linux') {
          // 解析 macOS 和 Linux 的 ps 输出
          const lines = result.trim().split('\n')
          lines.forEach((line: string) => {
            const parts = line.trim().split(/\s+/)
            if (parts.length >= 4) {
              const [comm, ...argsParts] = parts
              const pidIndex = argsParts.findIndex((p) => !isNaN(parseInt(p, 10)))
              if (pidIndex > -1) {
                const commandLine = argsParts.slice(0, pidIndex).join(' ')
                const pid = argsParts[pidIndex]
                const rss = argsParts[pidIndex + 1]

                if (commandLine.includes(programName)) {
                  const process = {
                    name: comm,
                    commandLine: commandLine,
                    path: comm, // ps 命令不直接提供可执行文件路径
                    pid: parseInt(pid, 10),
                    memory: parseInt(rss, 10) * 1024, // rss 单位是 KB
                    fileName: programName
                  }
                  processInfo.push(process)
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
 * @returns Promise<boolean> 是否成功
 */
export const installServiceOnWindows = async (serviceName: string, args: string) => {
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
      const args1 = ['install', serviceName, corePath]
      const args2 = ['set', serviceName, 'AppParameters', `${args}`]
      const args3 = ['set', serviceName, 'AppDirectory', appDirectory]
      const args4 = ['set', serviceName, 'AppExit', 'Default', 'Restart']
      const args5 = ['set', serviceName, 'Description', `EasyTier 组网,服务配置:${serviceName}`]
      const args6 = ['set', serviceName, 'DisplayName', `EasyTier 组网 ${serviceName}`]
      const args7 = ['set', serviceName, 'ObjectName', 'LocalSystem']
      const args8 = ['set', serviceName, 'Start', 'SERVICE_AUTO_START']
      const args9 = ['set', serviceName, 'Type', 'SERVICE_WIN32_OWN_PROCESS']
      // 重定向日志到文件
      // const args10 = ['set', serviceName, 'AppStdout', `${logsPath}\\service.log`]
      // const args11 = ['set', serviceName, 'AppStderr', `${logsPath}\\service.log`]
      // const args12 = ['set', serviceName, 'AppTimestampLog', '1']
      await executeCmd(NSSM_NAME, args1, { encoding: 'gbk' }).then(async (res) => {
        info(`安装服务结果:${JSON.stringify(res)}`)
        info(`安装服务结果:${res.code}`)
        info(`安装服务结果:${res}`)
        info(`安装服务结果:${res && res.code! === 0}`)
        info(
          `安装服务结果:${
            res &&
            (res.code! === 0 ||
              res.code! === 1 ||
              res.includes('success') ||
              res.includes('installed'))
          }`
        )
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
  serviceName: string,
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
      args.push('--core-path', corePath)
      args.push('--service-work-dir', appDirectory)

      // 读取配置文件获取日志配置
      const { logDir, logLevel } = await getLogConfigFromFile(configFileName)

      // 构建服务运行时的参数
      // 格式: easytier-core --file-log-dir ./log --file-log-level info --config-file config.toml
      args.push(
        '--',
        '--file-log-dir',
        logDir,
        '--file-log-level',
        logLevel,
        '--config-file',
        configPath
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
export const uninstallServiceWithOfficialCli = async (serviceName: string) => {
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
export const checkServiceWithOfficialCli = async (serviceName: string) => {
  return new Promise(async (resolve) => {
    try {
      const res: any = await executeCmd('easytier-cli', ['service', 'status'], { encoding: 'gbk' })

      info(`官方CLI检查服务状态: ${JSON.stringify(res)}`)

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
 * 自动检测服务安装方式
 */
export const detectServiceInstallMethod = async (
  serviceName: string
): Promise<'nssm' | 'official' | 'none'> => {
  // 从 serviceName 中提取 configFileName (移除 'easytier-' 前缀)
  const configFileName = serviceName.replace(/^easytier-/, '')

  // 优先从 localStorage 读取保存的安装方式
  const SERVICE_CONFIG_PREFIX = 'service-config:'
  const savedConfigStr = localStorage.getItem(SERVICE_CONFIG_PREFIX + configFileName)

  if (savedConfigStr) {
    try {
      const savedConfig = JSON.parse(savedConfigStr)
      const savedMethod = savedConfig.installMethod

      // 如果有保存的安装方式，直接检查该方式的状态
      if (savedMethod === 'nssm') {
        const status = await checkServiceOnWindows(serviceName)
        if (status && status !== false) {
          return 'nssm'
        }
        // 如果服务已卸载，返回 none
        return 'none'
      } else if (savedMethod === 'official') {
        const status = await checkServiceWithOfficialCli(serviceName)
        if (status && status !== false) {
          return 'official'
        }
        // 如果服务已卸载，返回 none
        return 'none'
      }
    } catch (e) {
      // 解析失败，继续使用自动检测
      error(`解析服务配置失败: ${e}`)
    }
  }

  // 没有保存的配置，使用自动检测（向后兼容旧版本安装的服务）
  // 先检查 NSSM
  const nssmStatus = await checkServiceOnWindows(serviceName)
  if (nssmStatus && nssmStatus !== false) {
    return 'nssm'
  }

  // 再检查官方 CLI
  const officialStatus = await checkServiceWithOfficialCli(serviceName)
  if (officialStatus && officialStatus !== false) {
    return 'official'
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
