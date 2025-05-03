import { CONFIG_PATH, LOG_PATH, NSSM_NAME, RESOURCE_PATH } from '@/constants/easytier'
import { invoke } from '@tauri-apps/api/core'
import { join, resourceDir } from '@tauri-apps/api/path'
import { attachConsole, error, info } from '@tauri-apps/plugin-log'
import { Command, type SpawnOptions } from '@tauri-apps/plugin-shell'
import { getCliDir, getCoreDir, getResourceDir, fileExist, getLogsDir } from './fileUtil'
import { getPlatform, sleep } from './sysUtil'

// 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
attachConsole()

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
    // info('执行命令：' + program)
    // info('执行参数：' + JSON.stringify(args))
    // 创建命令实例
    const command = Command.create(program, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: options.encoding
    })
    // 执行并等待完成
    const output = await command.execute()
    // info('执行命令输出:' + JSON.stringify(output))
    if (output.code && output.code !== 0 && output.code !== 1) {
      return output.stderr.trim() || output.stdout.trim() || output
    }
    return output.stdout.trim() || output
  } catch (e: any) {
    error('执行程序失败:' + JSON.stringify(e))
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
    // const resourcePath = await getResourceDir()
    let finalProgram = program
    let finalArgs = args
    if (platform === 'windows') {
      // start ["title"] [/d路径] [选项] 命令 [参数]
      // cmd /c start "easytier-core" /b /D "C:\Program Files\resource" easytier-core -c "C:\Program Files\config\c95f9383-6ead-4360-97bc-0ee3897d11cf.toml"
      // args = ['/c', 'start', `"${program}"`, '/b', '/d', `"${resourcePath}"`, program, ...args]
      // cmd /c start "easytier-core" /b "C:\Program Files\resource\easytier-core" -c "C:\Program Files\config\c95f9383-6ead-4360-97bc-0ee3897d11cf.toml"
      // args = ['/c', 'start', `"${program}"`, '/b', `"${binPath}"`, ...args]
      // Windows 下使用 start 命令在后台运行
      finalArgs = ['/c', 'start', '', '/b', program, ...args]
      finalProgram = 'cmd'
      // 使用 runas 提升权限
      // finalArgs = ['/user:Administrator', '/c', 'start', '', '/b', `${binPath}`, ...args]
      // finalProgram = 'runas'
    }
    if (platform === 'linux' || platform === 'macos') {
      // 使用 sudo 运行 nohup
      finalArgs = ['nohup', binPath, ...args]
      finalProgram = 'sudo'
    }
    info('执行命令：' + finalProgram)
    info('执行参数：' + JSON.stringify(finalArgs))
    // 创建命令对象
    const command = Command.create(finalProgram, finalArgs, options)

    // 监听输出(可选)
    command.stdout.on('data', (line) => {
      info(`[${program}] 输出:` + line)
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
      error(`[${program}] 错误:` + JSON.stringify(e))
    })

    // 启动进程
    const child = await command.spawn()

    info(`[${program}] 后台进程已启动, PID: ${child.pid}`)
    return child.pid
  } catch (e: any) {
    error('启动后台程序失败:' + JSON.stringify(e))
    throw error
  }
}

// 运行 easytier-core 配置
export async function runEasyTierCore(configFileName: string): Promise<any> {
  try {
    const configPath = await join(await resourceDir(), CONFIG_PATH, configFileName)
    const program = await getCoreDir()
    const res = await invoke('run_command', {
      program,
      args: ['-c', `${configPath}`]
    })
    info('运行结果：' + res)
    return res
  } catch (error) {
    console.error('运行 easytier-core失败:', error)
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
    info('运行结果：' + res)
    return res
  } catch (error) {
    console.error('运行 easytier-core失败:', error)
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
  } catch (error) {
    console.error('获取结果失败:', error)
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
  } catch (error) {
    console.error('获取结果失败:', error)
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
      const _result = await executeCmd('taskkill', args, { encoding: 'gbk' })
    }
    // Unix-like 系统使用 kill 命令
    else {
      const signal = force ? '-9' : '-15' // SIGKILL vs SIGTERM
      const _result = await executeCmd('kill', [signal, pid.toString()])
    }
    info(`进程 ${pid} 已终止`)
    return true
  } catch (e: any) {
    error(`终止进程 ${pid} 失败:` + JSON.stringify(e))
    return false
  }
}
// 停止所有节点
export async function stopAllNodes() {
  const processList = await getRunningProcesses('easytier-core')
  processList.forEach(async (process) => {
    await killProcess(process.pid)
  })
}

// Linux/macOS 下使用 sudo 的示例
export async function killProcessWithSudo(pid: number, force: boolean = false): Promise<boolean> {
  try {
    const signal = force ? '-9' : '-15'
    await executeCmd('sudo', ['kill', signal, pid.toString()])
    return true
  } catch (e: any) {
    error(`使用 sudo 终止进程 ${pid} 失败:` + JSON.stringify(e))
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
  programName: string = 'easytier'
): Promise<Array<any>> => {
  return new Promise(async (resolve, reject) => {
    let args: string[] = []
    let program = ''
    let encoding = 'utf-8'
    const processInfo: any[] = []
    const platform = getPlatform()
    if (platform === 'windows') {
      // Windows 使用 WMIC 命令
      // wmic process where "name like '%easytier%'" get Caption,commandline,ExecutablePath,ProcessId,WorkingSetSize /format:csv
      // wmic process where "name like '%easytier-core%'" get Caption,commandline,ExecutablePath,ProcessId,WorkingSetSize /format:csv
      program = 'wmic'
      encoding = 'gbk'
      args = [
        'process',
        'where',
        `name like '%easytier%'`,
        'get',
        'Caption,commandline,ExecutablePath,ProcessId,WorkingSetSize',
        '/format:csv'
      ]
    } else if (platform === 'macos' || platform === 'linux') {
      // macOS 和 Linux 使用 ps 命令
      program = 'ps'
      args = ['-eo', 'comm,args,pid,rss', '|', 'grep', 'easytier']
    } else {
      reject(new Error('Unsupported OS'))
      return
    }
    executeCmd(program, args, { encoding })
      .then((result) => {
        if (platform === 'windows') {
          // 解析 Windows 的 CSV 输出
          const lines = result.trim().split('\n').slice(1) // 去掉第一行标题
          lines.forEach((line) => {
            const [_node, caption, commandline, executablePath, pid, workingSetSize] =
              line.split(',')
            if (commandline.includes(programName)) {
              const process = {
                name: caption,
                commandLine: commandline,
                path: executablePath,
                pid: parseInt(pid),
                memory: parseInt(workingSetSize),
                fileName: programName
              }
              processInfo.push(process)
            }
          })
        } else if (platform === 'macos' || platform === 'linux') {
          // 解析 macOS 和 Linux 的 ps 输出
          const lines = result.trim().split('\n').slice(1) // 去掉第一行标题
          lines.forEach((line) => {
            const [comm, args, pid, rss] = line.trim().split(/\s+/)
            if (args.includes(programName)) {
              const process = {
                name: comm,
                commandLine: args,
                path: args, // ps 命令不直接提供可执行文件路径
                pid: parseInt(pid),
                memory: parseInt(rss) * 1024, // rss 单位是 KB
                fileName: programName
              }
              processInfo.push(process)
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
  return new Promise(async (resolve, reject) => {
    try {
      const args = ['status', serviceName]
      const res: any = await executeCmd(NSSM_NAME, args, { encoding: 'gbk' })
      // debug('检测服务:' + res)
      // Can't open service!\r\r\nOpenService(): The specified service does not exist as an installed service.
      if (res && (res.code! === 3 || res.includes('does not exist'))) {
        resolve(false)
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
  return new Promise(async (resolve, reject) => {
    const appDirectory = await getResourceDir()
    const corePath = await join(appDirectory, 'easytier-core')
    // const logsPath = await getLogsDir()
    try {
      // 服务是否存在
      const exist: any = await checkServiceOnWindows(serviceName)
      info('服务是否存在:' + JSON.stringify(exist))
      if (exist) {
        resolve(true)
        return
      }
      // 检测文件是否存在
      // await fileExist(await join(LOG_PATH, 'service.log'))
      const args1 = ['install', serviceName, `${corePath}`]
      const args2 = ['set', serviceName, 'AppParameters', `-c "${args}"`]
      const args3 = ['set', serviceName, 'AppDirectory', `${appDirectory}`]
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
        info('安装服务结果:' + JSON.stringify(res))
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
      error('安装服务失败:' + JSON.stringify(e))
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
  return new Promise(async (resolve, reject) => {
    try {
      const args = ['remove', serviceName, 'confirm']
      const res: any = await executeCmd(NSSM_NAME, args, { encoding: 'gbk' })
      info('删除服务:' + JSON.stringify(res))
      if (res && (res.code! === 0 || res.includes('success'))) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (e: any) {
      error('删除服务出错:' + JSON.stringify(e))
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
  return new Promise(async (resolve, reject) => {
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
      if (res && (res.code! === 0 || res.includes('SERVICE'))) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (e: any) {
      error('启动服务出错:' + JSON.stringify(e))
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
  return new Promise(async (resolve, reject) => {
    try {
      const args = ['stop', serviceName]
      await executeCmd(NSSM_NAME, args, { encoding: 'gbk' })
      await sleep(1500)
      const res = await checkServiceOnWindows(serviceName)
      info('停止服务:' + JSON.stringify(res))
      if (JSON.stringify(res).includes('SERVICE_STOP_PENDING')) {
        // nssm processes easytier-Legion2222
        const processInfo = await executeCmd(NSSM_NAME, ['processes', serviceName], {
          encoding: 'gbk'
        })
        const processList = processInfo.split(' ')
        if (processList.length > 0) {
          await killProcess(parseInt(processList[0]))
          resolve(true)
          return
        }
      }
      if (res && (res.code! === 0 || res.includes('SERVICE'))) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (e: any) {
      error('停止服务出错:' + JSON.stringify(e))
      resolve(false)
    }
  })
}

/**
 * 判断Windows中是否已经添加过该路由
 */
export const checkRouteOnWindows = async (ip: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      const args = ['print','-4']
      const res: any = await executeCmd('route', args, { encoding: 'gbk' })
      info('检测路由:' + JSON.stringify(res))
      if (res && res.includes(ip)) {
        resolve(true)
      }
      resolve(false)
    }
    catch (e: any) {
      error('检测路由出错:' + JSON.stringify(e))
      resolve(false)
    }
  })
}

/**
 * 在Windows中添加路由
 */
export const addRouteOnWindows = async (ip: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      // route add 0.0.0.0 mask 0.0.0.0 192.168.1.1 
      const args = ['add', '0.0.0.0', 'mask','0.0.0.0',ip]
      console.log('添加路由:',args.join(' '));
      const res: any = await executeCmd('route', args, { encoding: 'gbk' })
      info('添加路由:' + JSON.stringify(res))
      if (res && res.includes('操作完成')) {
        resolve(true)
      }
      resolve(false)
    }
    catch (e: any) {
      error('添加路由出错:' + JSON.stringify(e))
      resolve(false)
    }
  })
}

/**
 * 在Windows中删除路由
 */
export const delRouteOnWindows = async (ip: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      // route delete 0.0.0.0 mask 0.0.0.0 192.168.1.1
      const args = ['delete', '0.0.0.0',ip]
      const res: any = await executeCmd('route', args, { encoding: 'gbk' })
      info('删除路由:' + JSON.stringify(res))
      if (res && res.includes('OK')) {
        resolve(true)
      }
      resolve(false)
    }
    catch (e: any) {
      error('删除路由出错:' + JSON.stringify(e))
      resolve(false)
    }
  })
}