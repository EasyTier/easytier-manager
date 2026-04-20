<script setup lang="tsx">
import { CodeEditor } from '@/components/CodeEditor'
import { ContentWrap } from '@/components/ContentWrap'
import { Descriptions, DescriptionsSchema } from '@/components/Descriptions'
import { Dialog } from '@/components/Dialog'
import { CONFIG_PATH, LOG_PATH } from '@/constants/easytier'
import { useI18n } from '@/hooks/web/useI18n'
import { useEasyTierStore } from '@/store/modules/easytier'
import { useTrayStore } from '@/store/modules/trayStore'
import { extractAllPublicIPs, readTextReverse } from '@/utils/easyTierUtil'
import { clearETLogs, listTomlFiles, readFileContent } from '@/utils/fileUtil'
import {
  checkRouteOnWindows,
  executeCmd,
  getRunningProcesses,
  killProcess,
  runEasyTierCli,
  runEasyTierCore,
  safeJsonParse
} from '@/utils/shellUtil'
import { notify, sleep } from '@/utils/sysUtil'
import { ArrowDown, CopyDocument, Link, Monitor, Platform, Setting } from '@element-plus/icons-vue'
import { invoke } from '@tauri-apps/api/core'
import { attachConsole, error, info } from '@tauri-apps/plugin-log'
import { Command } from '@tauri-apps/plugin-shell'
import { useClipboard } from '@vueuse/core'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox, ElNotification, ElOption, ElSelect, ElTree } from 'element-plus'
import * as toml from 'smol-toml'
import { computed, onActivated, onDeactivated, onMounted, reactive, ref, unref, watch } from 'vue'
// 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
attachConsole()
const { t } = useI18n()
const easyTierStore = useEasyTierStore()
const trayStore = useTrayStore()
const logDialogVisible = ref(false)
const descriptionCollapse = ref(false)
const isStarting = ref(false)
const isInitializing = ref(false)
const logData = ref('')
const disabledAutoMetricAdapter = ref<string | null>(null)
const MonacoEditRef = ref()
const wordWrap = ref('off')
const nodeInfo = ref<any>({})
const peerInfo = ref<PeerInfo[]>([])
const isNodeInfoLooping = ref(false)
const isPeerInfoLooping = ref(false)
const treeEl = ref<typeof ElTree>()
// const dialogTitle = ref('') // 未使用的变量，已注释
const currentNodeKey = ref<RunningItem>({
  configFileName: ''
})
const currentConfigCache = ref<EasyTierConfig | null>(null)
const currentDepartment = ref('')
const tableRowClassName = ({ rowIndex }: { row: any; rowIndex: number }) => {
  if (rowIndex === 1) {
    return 'warning-row'
  } else if (rowIndex === 3) {
    return 'success-row'
  }
  return ''
}

const nodeInfoSchema = reactive<DescriptionsSchema[]>([
  {
    field: 'hostname',
    label: t('easytier.hostname')
  },
  {
    field: 'ipv4_addr',
    label: t('easytier.ipv4Vir')
  },
  {
    field: 'stun_info.public_ip[0]',
    label: t('easytier.ipPublic')
  },
  {
    field: 'stun_info.udp_nat_type',
    label: t('easytier.nat_type')
  }
  // {
  //   field: 'proxy_cidrs',
  //   label: t('easytier.proxy_network')
  // },
  // {
  //   field: 'listeners',
  //   label: t('easytier.listeners')
  // }
])
const delayColorMap = [
  { index: 0, min: 0, max: 10, color: 'green' },
  { index: 1, min: 10, max: 80, color: '#45b458' },
  { index: 2, min: 80, max: 150, color: '#71d481' },
  { index: 3, min: 150, max: 250, color: '#fdc44d' },
  { index: 4, min: 250, max: 350, color: '#fd884d' },
  { index: 5, min: 350, max: Infinity, color: 'red' }
]

// 所有可选列配置（除固定列外）
const optionalColumns = ref([
  { prop: 'rx_bytes', label: 'easytier.rx_bytes' },
  { prop: 'tx_bytes', label: 'easytier.tx_bytes' },
  { prop: 'nat_type', label: 'easytier.nat_type' },
  { prop: 'loss_rate', label: 'easytier.loss_rate' },
  { prop: 'tunnel_proto', label: 'easytier.tunnel_proto' },
  { prop: 'version', label: 'easytier.version' }
])

// 计算实际显示的动态列
const visibleDynamicColumns = computed(() => {
  return optionalColumns.value.filter((col) => easyTierStore.selectedColumns.includes(col.prop))
})

watch(
  () => currentDepartment.value,
  (val) => {
    unref(treeEl)!.filter(val)
  }
)
watch(
  () => peerInfo.value,
  (val) => {
    if (val.length > 1 && !easyTierStore.stopSetRoute) {
      setExitRoute(val)
    }
  }
)
const getActiveNetworkAdapter = async () => {
  try {
    const res = await executeCmd(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        'Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq "Up" -and $_.NetAdapter.Name -notlike "et*" -and $_.NetAdapter.Name -notlike "easytier*"} | Sort-Object -Property InterfaceMetric | Select-Object -First 1 -ExpandProperty NetAdapter | Select-Object -ExpandProperty Name'
      ],
      { encoding: 'gbk' }
    )
    const adapterName = typeof res === 'string' ? res.trim() : ''
    return adapterName || null
  } catch (e) {
    error(`获取上网网卡失败:${String(e)}`)
    return null
  }
}

const disableAutoMetric = async (adapterName: string) => {
  try {
    await executeCmd(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Set-NetIPInterface -InterfaceAlias "${adapterName}" -AutomaticMetric Disabled -InterfaceMetric 1`
      ],
      { encoding: 'gbk' }
    )
    return true
  } catch (e) {
    error(`关闭网卡自动跃点失败:${String(e)}`)
    return false
  }
}

const enableAutoMetric = async (adapterName: string) => {
  try {
    await executeCmd(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Set-NetIPInterface -InterfaceAlias "${adapterName}" -AutomaticMetric Enabled`
      ],
      { encoding: 'gbk' }
    )
    return true
  } catch (e) {
    error(`开启网卡自动跃点失败:${String(e)}`)
    return false
  }
}

const getCurrentConfig = async () => {
  if (currentConfigCache.value) return currentConfigCache.value
  try {
    if (!currentNodeKey.value.fileName) return null
    const dataConfig = (await readFileContent(
      `${CONFIG_PATH}/${currentNodeKey.value.fileName}`
    )) as string
    if (!dataConfig) return null
    const parsed = toml.parse(dataConfig) as unknown as EasyTierConfig
    currentConfigCache.value = parsed
    return parsed
  } catch (e) {
    error(`读取配置失败:${String(e)}`)
    return null
  }
}

const setExitRoute = async (val) => {
  const parseValue = await getCurrentConfig()
  if (!parseValue) {
    easyTierStore.stopSetRoute = true
    return
  }

  const retryGet = async (fn: () => Promise<string | boolean | undefined | null>) => {
    const maxRetry = 10
    for (let i = 0; i < maxRetry; i++) {
      const res = await fn()
      if (res) return res
      await sleep(2000)
    }
    return null
  }

  const getDefaultGateway = async () => {
    try {
      const res = await executeCmd('powershell', [
        '-NoProfile',
        '-Command',
        // '(Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -ne "Disconnected"} | Select-Object -First 1 -ExpandProperty IPv4DefaultGateway).NextHop'
        'Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq "Up" -and $_.NetAdapter.Name -notlike "et*" -and $_.NetAdapter.Name -notlike "easytier*"} | Sort-Object -Property InterfaceMetric | Select-Object -First 1 -ExpandProperty IPv4DefaultGateway | Select-Object -ExpandProperty NextHop'
      ])
      const match = typeof res === 'string' ? res.match(/\d+\.\d+\.\d+\.\d+/) : null
      return match ? match[0] : null
    } catch (e) {
      error(`获取网关失败:${String(e)}`)
      return null
    }
  }

  const getPublicIps = async () => {
    const maxRetry = 5
    for (let i = 1; i <= maxRetry; i++) {
      await getLog()
      const res = await extractAllPublicIPs(readTextReverse(logData.value, i * 200))
      if (res && res.length > 0) {
        logData.value = ''
        return res
      }
      await sleep(2000)
    }
    return null
  }

  const addRouteSeq = async (
    method: string,
    target: string,
    mask: string,
    gateway: string,
    metric: number
  ) => {
    const args = [method, target, 'mask', mask, gateway, 'metric', String(metric)]
    await executeCmd('route', args, { encoding: 'gbk' })
  }

  if (val && parseValue.config_exit_nodes_route && parseValue.exit_nodes.length > 0) {
    const localNode = peerInfo.value.find((value) => value.cost === '本机')
    if (localNode) {
      const exitNodeIp = parseValue.exit_nodes[0]?.split('/')?.[0]
      const gatewayResult = await retryGet(getDefaultGateway)
      const gateway = typeof gatewayResult === 'string' ? gatewayResult : null

      const waitHolePunching = async () => {
        const hp = parseValue.flags.disable_udp_hole_punching
        const exitNode = peerInfo.value.find((value) => value.ipv4 === exitNodeIp)
        if (!hp && exitNode?.cost == '直连') {
          // p2p
          return true
        }
        if (hp && exitNode?.cost == '中转') {
          // relay
          return true
        }
        return false
      }

      const waitHole = await retryGet(waitHolePunching)
      const publicIps = await getPublicIps()

      const canSet = Boolean(exitNodeIp && gateway && publicIps?.length && waitHole === true)

      if (
        canSet &&
        exitNodeIp &&
        gateway &&
        publicIps &&
        (await checkRouteOnWindows(localNode.ipv4))
      ) {
        await addRouteSeq('change', '0.0.0.0', '0.0.0.0', gateway, 30)
        // 按顺序依次添加路由，之间不跳过
        for (const publicIp of publicIps) {
          await addRouteSeq('add', publicIp, '255.255.255.255', gateway, 1)
        }
        await addRouteSeq('add', '0.0.0.0', '0.0.0.0', exitNodeIp, 5)
      }
    }
  }
  easyTierStore.stopSetRoute = true
}

// 从easyTierStore.runningList 同步 runningTag
const runningTag = computed(() => {
  return easyTierStore.runningList.some(
    (i) => i.configFileName === currentNodeKey.value.configFileName
  )
})
// 综合状态：loading = 正在启动或正在初始化
const isLoading = computed(() => isStarting.value || isInitializing.value)
const handlePing = async (ip: string) => {
  if (!ip || ip === '服务器') return
  // Windows: cmd /k ping <ip>
  await Command.create('cmd', ['/c', 'start', 'cmd', '/k', `ping ${ip}`]).spawn()
}

const handleRDP = async (ip: string) => {
  if (!ip) return
  // mstsc /v:<ip>
  await Command.create('mstsc', [`/v:${ip}`]).spawn()
}

const telnetDialogVisible = ref(false)
const telnetPort = ref('22')
const currentTelnetIp = ref('')

const handleTelnet = (ip: string) => {
  if (!ip || ip === '服务器') return
  currentTelnetIp.value = ip
  telnetPort.value = '22'
  telnetDialogVisible.value = true
}

const executeTelnet = async () => {
  const port = telnetPort.value.trim()
  if (!port) {
    ElMessage.warning('请输入端口号')
    return
  }
  telnetDialogVisible.value = false
  await Command.create('cmd', [
    '/c',
    'start',
    'cmd',
    '/k',
    `telnet ${currentTelnetIp.value} ${port}`
  ]).spawn()
}

const setQuickPort = (port: string) => {
  telnetPort.value = port
}

const handleSSH = async (ip: string) => {
  if (!ip || ip === '服务器') return
  // Windows: cmd /k ssh root@<ip>
  await Command.create('cmd', ['/c', 'start', 'cmd', '/k', `ssh root@${ip}`]).spawn()
}

const handleXshell = async (ip: string) => {
  if (!ip || ip === '服务器') return
  try {
    // 优先使用用户配置的路径
    const xshellPath = easyTierStore.xshellPath || 'xshell'
    // 使用 cmd /c start "" "路径" "参数" 的方式启动，可以规避 Tauri 的 Scoped command 限制
    // start 命令的第一个双引号参数会被视为窗口标题，所以路径中有空格时，前面必须加一个空的双引号
    await Command.create('cmd', ['/c', 'start', '', xshellPath, ip]).spawn()
  } catch (e) {
    ElMessage.error('无法启动 Xshell，请确保 Xshell 路径配置正确或已添加到系统 PATH 中。')
  }
}

watch(
  [() => runningTag.value, () => nodeInfo.value],
  ([running, info]) => {
    if (running && info && info.ipv4_addr) {
      trayStore.setTrayTooltip(
        `状态: 运行中\n配置: ${currentNodeKey.value.configFileName}\nIP: ${info.ipv4_addr}`
      )
    } else if (running) {
      trayStore.setTrayTooltip(`状态: 运行中\n配置: ${currentNodeKey.value.configFileName}`)
    } else {
      trayStore.setTrayTooltip('状态: 未运行')
    }
  },
  { immediate: true, deep: true }
)

const getConfigList = async () => {
  try {
    const fileList = await listTomlFiles()
    const tmpList: any = []
    for (const f of fileList) {
      const configName = f.replace('.toml', '')
      tmpList.push({ configFileName: configName, fileName: f })
    }
    easyTierStore.setConfigList(tmpList)
  } catch (e) {
    error(`获取配置异常${e}`)
  }
}

const routeCost = (cost: string) => {
  switch (cost) {
    case 'p2p':
      return t('easytier.direct')
    case 'Local':
      return t('easytier.local')
    default:
      return t('easytier.relay')
  }
}
const getNatType = (natType: any) => {
  /*
  Unknown = 0;
  OpenInternet = 1;
  NoPAT = 2;
  FullCone = 3;
  Restricted = 4;
  PortRestricted = 5;
  Symmetric = 6;
  SymUdpFirewall = 7;
  SymmetricEasyInc = 8;
  SymmetricEasyDec = 9;
  */
  switch (natType) {
    case 3:
    case 'FullCone':
      return t('easytier.fullCone')
    case 4:
    case 'Restricted':
      return t('easytier.restricted')
    case 5:
    case 'PortRestricted':
      return t('easytier.portRestricted')
    case 6:
    case 'Symmetric':
      return t('easytier.symmetric')
    case 0:
    case 'Unknown':
      return t('easytier.unknown')
    case 1:
    case 'OpenInternet':
      return t('easytier.openInternet')
    case 2:
    case 'NoPAT':
      return t('easytier.noPAT')
    case 7:
    case 'SymUdpFirewall':
      return 'SymUdpFirewall'
    case 8:
    case 'SymmetricEasyInc':
      return 'SymmetricEasyInc'
    case 9:
    case 'SymmetricEasyDec':
      return 'SymmetricEasyDec'
    default:
      return natType
  }
}
const getNodeInfo = async () => {
  if (isNodeInfoLooping.value) return
  isNodeInfoLooping.value = true
  try {
    const maxRetry = 10
    let retryTime = 1
    let isFirstRun = true
    while (!easyTierStore.stopLoop || isFirstRun) {
      if (retryTime >= maxRetry) {
        break
      }
      if (!isFirstRun && !easyTierStore.stopLoop) {
        await sleep(10000)
      }
      if (easyTierStore.stopLoop && !isFirstRun) break
      isFirstRun = false

      const config = await getCurrentConfig()
      const rpcPortal = config?.rpc_portal
        ? (config.rpc_portal as string).replace('0.0.0.0', '127.0.0.1')
        : undefined
      const cliArgs = rpcPortal
        ? ['-p', rpcPortal, '--output', 'json', 'node']
        : ['--output', 'json', 'node']
      const res = await runEasyTierCli(cliArgs)
      if (res.code === 403) {
        easyTierStore.setStopLoop(true)
        break
      }
      if (!res) {
        retryTime++
        continue
      }
      nodeInfo.value = safeJsonParse(res)
      // 同步到 store 缓存
      easyTierStore.cachedNodeInfo = nodeInfo.value
      if (
        nodeInfo.value['ipv4_addr'] &&
        nodeInfo.value['stun_info'] &&
        nodeInfo.value['stun_info']['udp_nat_type'] &&
        nodeInfo.value['stun_info']['public_ip'] &&
        nodeInfo.value['stun_info']['public_ip'].length > 0
      ) {
        retryTime = maxRetry
      }
      if (nodeInfo.value['ipv4_addr']) {
        nodeInfo.value['stun_info']['udp_nat_type'] = getNatType(
          nodeInfo.value['stun_info']['udp_nat_type']
        )
      }
      // 获取节点信息成功后，尝试刷新节点列表
      getPeerInfo()
      if (easyTierStore.stopLoop) break
    }
  } finally {
    isNodeInfoLooping.value = false
  }
}
const getPeerInfo = async () => {
  if (isPeerInfoLooping.value) return
  isPeerInfoLooping.value = true
  try {
    let isFirstRun = true
    let retryTime = 1
    while (!easyTierStore.stopLoop || isFirstRun) {
      if (retryTime > 5) {
        break
      }
      // 如果不是第一次运行，则等待。第一次运行如果是启动后恢复状态，不需要等待太久
      if (!isFirstRun && !easyTierStore.stopLoop) {
        await sleep(easyTierStore.refreshInterval * 1000)
      } else if (!isFirstRun && easyTierStore.stopLoop) {
        // 如果已停止且不是第一次运行，直接退出
        break
      } else {
        // 第一次运行稍微等一下核心程序响应
        await sleep(1000)
      }
      if (easyTierStore.stopLoop && !isFirstRun) break
      isFirstRun = false

      if (!currentNodeKey.value.configFileName) {
        break
      }

      const data = await getCurrentConfig()
      if (!data) {
        break
      }
      const res = await runEasyTierCli([
        '-p',
        (data.rpc_portal as string).replace('0.0.0.0', '127.0.0.1'),
        '--output',
        'json',
        'peer'
      ])
      if (res.code === 403) {
        easyTierStore.setStopLoop(true)
        easyTierStore.removeRunningList(currentNodeKey.value.configFileName)
        break
      }
      if (!res) {
        retryTime++
        continue
      } else {
        retryTime = 0
      }
      // peerInfo.value = parsePeerInfo(res)
      peerInfo.value = safeJsonParse(res, [])
      const filter = peerInfo.value.filter((value) => value.ipv4 && value.cost !== 'Local')
      const filter1 = peerInfo.value.filter(
        (value) => value.ipv4 && value.cost !== 'Local' && value.cost === 'p2p'
      )
      peerInfo.value.forEach((value) => {
        if (value.ipv4 && value.ipv4.includes('/')) {
          value.ipv4 = value.ipv4.split('/')[0]
        }
        if (value.hostname && value.hostname.includes('PublicServer_')) {
          value.hostname = value.hostname.replace('PublicServer_', '')
          value.ipv4 = '服务器'
        }
        value.cost = routeCost(value.cost)
        value.nat_type = getNatType(value.nat_type)
        value.delayColor = getDelayColor(value.lat_ms)
      })
      // 同步到 store 缓存
      easyTierStore.cachedPeerInfo = [...peerInfo.value]
      if (
        easyTierStore.p2pNotifySetting &&
        easyTierStore.p2pNotify &&
        filter.length > 0 &&
        filter1.length > 0 &&
        filter.length === filter1.length
      ) {
        notify('EasyTier 管理器', '恭喜你，全部节点建立 P2P 连接！🎉🎉')
        // 只通知一次
        easyTierStore.setP2pNotify(false)
      }
      if (easyTierStore.stopLoop) break
    }
  } finally {
    isPeerInfoLooping.value = false
  }
}
const updateRunningList = async (res?: any) => {
  if (!res) {
    res = await getRunningProcesses(currentNodeKey.value.fileName!)
  }
  // 构建新的列表，然后一次性替换，避免先清空导致 runningTag 短暂为 false
  const newList: RunningItem[] = []
  if (res.length > 0) {
    res.forEach((item) => {
      const configFileName = item.fileName.replace('.toml', '')
      newList.push({ configFileName, pid: item.pid })
    })
  }
  easyTierStore.setRunningList(newList)
  return res
}
const startAction = async () => {
  info(`开始运行配置:${currentNodeKey.value.fileName!}`)
  isStarting.value = true
  try {
    const currentConfig = await getCurrentConfig()
    // 如果配置了运行前清空日志，则清空当前配置的日志文件
    if (currentConfig?.clear_log_on_run) {
      await clearETLogs(currentNodeKey.value.configFileName)
      info(`已清空日志: ${currentNodeKey.value.configFileName}`)
    }
    if (currentConfig?.config_exit_nodes_route) {
      ElNotification({
        title: '开始运行',
        message: '请稍等，正在启动并配置各项参数...',
        type: 'info',
        duration: 10000
      })
      const adapterName = await getActiveNetworkAdapter()
      if (adapterName) {
        const disabled = await disableAutoMetric(adapterName)
        if (disabled) {
          disabledAutoMetricAdapter.value = adapterName
        }
      }
    } else {
      ElNotification({
        title: '开始运行',
        message: '请稍等，正在启动配置...',
        type: 'info',
        duration: 4000
      })
    }
  } catch (e) {
    error(`启动前关闭自动跃点失败:${String(e)}`)
  }

  await runEasyTierCore(currentNodeKey.value.fileName!)
    .then(async (_res) => {
      // info(`运行配置结果:${JSON.stringify(res)}`)
      easyTierStore.stopSetRoute = false
      await updateRunningList()
      easyTierStore.setStopLoop(false)
      easyTierStore.setP2pNotify(true)
      easyTierStore.setLastRunConfigName(currentNodeKey.value)
      // 暂时不再自动展开
      // descriptionCollapse.value = true
      trayStore.setTrayTooltip('当前运行配置：' + currentNodeKey.value.configFileName)
    })
    .catch(async () => {
      isStarting.value = false
      ElMessageBox({
        title: '哦豁，出错啦',
        message: '运行当前配置出错，请在设置检查是否有核心程序，或核心程序是否有可执行权限',
        type: 'error',
        draggable: true,
        confirmButtonText: t('common.ok')
      })
      if (disabledAutoMetricAdapter.value) {
        try {
          await enableAutoMetric(disabledAutoMetricAdapter.value)
          disabledAutoMetricAdapter.value = null
        } catch (e) {
          error(`启动失败后恢复自动跃点失败:${String(e)}`)
        }
      }
    })
    .finally(() => {
      isStarting.value = false
      currentNodeKeyChange()
    })
}
const stopAction = async () => {
  info(`停止运行配置:${currentNodeKey.value.configFileName}`)
  const item = easyTierStore.getRunningItem(currentNodeKey.value.configFileName)
  if (item && item.pid) {
    const res = await killProcess(item.pid)
    if (res) {
      easyTierStore.setStopLoop(true)
      await reset()
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    }
  } else {
    easyTierStore.removeRunningList(currentNodeKey.value.configFileName)
    await updateRunningList()
    ElNotification({
      title: t('common.reminder'),
      message: '当前配置未运行',
      type: 'warning',
      duration: 2000
    })
  }

  if (disabledAutoMetricAdapter.value) {
    try {
      await enableAutoMetric(disabledAutoMetricAdapter.value)
      disabledAutoMetricAdapter.value = null
    } catch (e) {
      error(`停止后恢复自动跃点失败:${String(e)}`)
    }
  }

  trayStore.setTrayTooltip(undefined)
  easyTierStore.setStopLoop(true)
}
const reset = async () => {
  nodeInfo.value = {}
  peerInfo.value.length = 0
  descriptionCollapse.value = false
  // 清除 store 缓存
  easyTierStore.cachedNodeInfo = {}
  easyTierStore.cachedPeerInfo = []
  easyTierStore.removeRunningList(currentNodeKey.value.configFileName)
  await updateRunningList()
}
async function getLog() {
  const date = dayjs(new Date()).format('YYYY-MM-DD')
  logData.value = (await readFileContent(
    LOG_PATH + '/' + currentNodeKey.value.configFileName + '.' + date
  )) as string
  if (!logData.value || logData.value === '') {
    logData.value = (await readFileContent(
      LOG_PATH + '/' + currentNodeKey.value.configFileName + '.' + date + '.log'
    )) as string
  }
  if (!logData.value || logData.value === '') {
    logData.value = (await readFileContent(LOG_PATH + '/' + 'easytier.log')) as string
  }
}
const viewLogAction = async () => {
  await getLog()
  logDialogVisible.value = true
}
const wordWrapChange = (val: any) => {
  MonacoEditRef.value.updateOptions({ wordWrap: val })
}
const clearLog = async () => {
  await clearETLogs(currentNodeKey.value.configFileName)
  await getLog()
}
const currentNodeKeyChange = async () => {
  try {
    currentConfigCache.value = null
    easyTierStore.setErrRunNotify(true)
    easyTierStore.setLastSelectedConfig(currentNodeKey.value)
    const res = await updateRunningList()
    if (res.length > 0) {
      easyTierStore.setStopLoop(false)
      // 切换配置时，如果 store 中有该配置的缓存数据，先恢复显示
      if (easyTierStore.cachedNodeInfo && Object.keys(easyTierStore.cachedNodeInfo).length > 0) {
        nodeInfo.value = { ...easyTierStore.cachedNodeInfo }
      }
      if (easyTierStore.cachedPeerInfo && easyTierStore.cachedPeerInfo.length > 0) {
        peerInfo.value = [...easyTierStore.cachedPeerInfo]
      }
      getNodeInfo()
      getPeerInfo()
      return
    }
    nodeInfo.value = {}
    peerInfo.value.length = 0
    descriptionCollapse.value = false
    easyTierStore.cachedNodeInfo = {}
    easyTierStore.cachedPeerInfo = []
    easyTierStore.setStopLoop(true)
    // 即使未运行，也尝试查询一次
    getNodeInfo()
    await getConfigList()
  } catch (e: any) {
    error(`异常:${JSON.stringify(e)}`)
  }
}

const checkCore = async () => {
  const res = await runEasyTierCli(['-V'])
  if (res.code === 403) {
    ElMessageBox.alert(
      'easytier-core 或 easytier-cli 不存在或无可执行权限，请到设置页下载安装，或授予可执行权限<br><b>使用：</b><br>1.先到设置检测内核是否存在；<br>2.配置页新建组网配置；<br>3.工作台运行配置',
      t('common.reminder'),
      {
        confirmButtonText: t('common.ok'),
        type: 'warning',
        dangerouslyUseHTMLString: true
      }
    )
  }
}
const copyIp = async (data) => {
  // 拷贝
  const { copy, copied, isSupported } = useClipboard({
    source: data,
    legacy: true
  })
  if (!isSupported) {
    ElMessage.error(t('setting.copyFailed'))
  } else {
    await copy(data)
    if (unref(copied)) {
      ElMessage.success(t('setting.copySuccess'))
    }
  }
}
/**
 * 根据延迟值获取对应的颜色
 * @param {number | string} delay - 延迟时间
 * @returns {string} 对应的颜色字符串
 */
const getDelayColor = (delay) => {
  // 1. 转换输入为浮点数，兼容各种数字和字符串形式
  const value = parseFloat(delay)
  // 2. 优先处理无效数字的情况，增加代码健壮性
  if (isNaN(value)) {
    return 'gray' // 如果输入无法转换为有效数字，直接返回默认色
  }
  // 3. 使用 Array.prototype.find() 查找匹配的区间，代码更简洁
  // find 会返回第一个满足条件的元素，如果找不到则返回 undefined
  const matchedRange = delayColorMap.find((range) => value >= range.min && value < range.max)
  // 4. 返回匹配到的颜色，否则返回默认颜色（比如 value 为负数时）
  return matchedRange ? matchedRange.color : 'gray'
}

// 列选择器相关方法
const selectAllColumns = () => {
  easyTierStore.setSelectedColumns(optionalColumns.value.map((col) => col.prop))
}

const clearAllColumns = () => {
  easyTierStore.setSelectedColumns([])
}
const selectedColumnsChange = (val) => {
  easyTierStore.setSelectedColumns(val)
}
onMounted(async () => {
  try {
    // 1. 先检查是否为冷启动
    const isColdStart = await invoke<boolean>('check_cold_start')

    // 2. 并行执行初始化任务（无论是否冷启动都需要执行）
    await Promise.all([checkCore(), getConfigList()])

    // 注意：不再先调用 loadRunningList()，避免从 localStorage 恢复旧状态导致 UI 跳动
    // 而是直接通过 updateRunningList 从实际进程获取运行状态

    // 3. 计算要加载的配置名称（冷启动与否都需要设置 UI 选中）
    let configName = ''
    if (easyTierStore.autoRunNetworkSetting && easyTierStore.autoRunConfigName) {
      configName = easyTierStore.autoRunConfigName
    } else {
      configName = easyTierStore.getLastRunConfigName()
    }

    if (!configName) {
      return
    }

    currentNodeKey.value.configFileName = configName
    currentNodeKey.value.fileName = `${configName}.toml`

    // 检查是否正在运行，保持 UI 运行态同步
    const res = await updateRunningList()
    const isRunning = res.some((item) => item.fileName === currentNodeKey.value.fileName)

    if (isRunning) {
      easyTierStore.setStopLoop(false)
      // 如果 store 中有缓存数据，先恢复显示，再静默更新
      if (easyTierStore.cachedNodeInfo && Object.keys(easyTierStore.cachedNodeInfo).length > 0) {
        nodeInfo.value = { ...easyTierStore.cachedNodeInfo }
      }
      if (easyTierStore.cachedPeerInfo && easyTierStore.cachedPeerInfo.length > 0) {
        peerInfo.value = [...easyTierStore.cachedPeerInfo]
      }
      getNodeInfo()
      getPeerInfo()
    } else if (isColdStart && easyTierStore.autoRunNetworkSetting) {
      // 4. 仅在冷启动且开启自动运行时执行自动运行
      startAction()
    } else {
      // 未运行时清除缓存
      easyTierStore.cachedNodeInfo = {}
      easyTierStore.cachedPeerInfo = []
    }
  } catch (e) {
    error(`初始化异常:${String(e)}`)
  }
})

// 页面被 keep-alive 激活时，恢复缓存数据并静默刷新
onActivated(async () => {
  // 如果正在运行，先恢复缓存数据让用户立刻看到内容，再静默刷新
  const isRunning = easyTierStore.runningList.some(
    (i) => i.configFileName === currentNodeKey.value.configFileName
  )
  if (isRunning) {
    // 先恢复缓存数据
    if (easyTierStore.cachedNodeInfo && Object.keys(easyTierStore.cachedNodeInfo).length > 0) {
      nodeInfo.value = { ...easyTierStore.cachedNodeInfo }
    }
    if (easyTierStore.cachedPeerInfo && easyTierStore.cachedPeerInfo.length > 0) {
      peerInfo.value = [...easyTierStore.cachedPeerInfo]
    }
    // 静默刷新最新数据
    easyTierStore.setStopLoop(false)
    getNodeInfo()
    getPeerInfo()
  }
})

// 页面被 keep-alive 停用时，停止轮询（保持缓存数据）
onDeactivated(() => {
  easyTierStore.setStopLoop(true)
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="flex-[3]">
      <Descriptions
        :title="t('workplace.overview')"
        :data="nodeInfo"
        :schema="nodeInfoSchema"
        :show="descriptionCollapse"
        border
        class="mb-10px"
      />
      <div
        class="status-bar p-10px bg-[var(--el-bg-color-overlay)] border-rd-8px border-1px border-solid border-[var(--el-border-color-light)]"
      >
        <div class="flex items-center justify-between w-100% flex-wrap gap-15px">
          <div class="flex items-center flex-wrap gap-12px">
            <div class="flex items-center gap-8px">
              <span class="text-14px font-600 text-[var(--el-text-color-regular)]">选择配置:</span>
              <ElSelect
                v-model="currentNodeKey"
                placeholder="请选择配置"
                style="width: 180px"
                value-key="configFileName"
                @change="currentNodeKeyChange"
              >
                <ElOption
                  v-for="item in easyTierStore.configList"
                  :key="item.configFileName"
                  :label="item.configFileName"
                  :value="item"
                />
              </ElSelect>
            </div>
            <div class="flex items-center gap-8px">
              <span class="text-14px font-600 text-[var(--el-text-color-regular)]">运行状态:</span>
              <div
                class="flex items-center px-10px py-4px border-rd-6px transition-all duration-300 bg-[var(--el-fill-color-light)] border-1px border-solid border-[var(--el-border-color-lighter)]"
              >
                <span
                  class="w-8px h-8px border-rd-50% mr-8px"
                  :class="
                    isLoading
                      ? 'bg-[var(--el-color-warning)] shadow-[0_0_6px_var(--el-color-warning)] animate-pulse'
                      : runningTag
                        ? 'bg-[var(--el-color-success)] shadow-[0_0_6px_var(--el-color-success)] animate-pulse'
                        : 'bg-[var(--el-color-info)]'
                  "
                ></span>
                <span
                  class="text-13px font-600 select-none"
                  :class="
                    isLoading
                      ? 'text-[var(--el-color-warning)]'
                      : runningTag
                        ? 'text-[var(--el-color-success)]'
                        : 'text-[var(--el-color-info)]'
                  "
                >
                  {{
                    isLoading
                      ? '加载中...'
                      : runningTag
                        ? t('easytier.running')
                        : t('easytier.stopping')
                  }}
                </span>
              </div>
            </div>
            <el-button
              type="success"
              @click="startAction"
              :disabled="runningTag || isStarting || isInitializing"
            >
              {{ t('easytier.run') }}
            </el-button>
            <el-button
              type="danger"
              @click="stopAction"
              :disabled="!runningTag || isStarting || isInitializing"
            >
              {{ t('easytier.stop') }}
            </el-button>
            <el-button type="info" plain @click="viewLogAction">
              {{ t('easytier.view_log') }}
            </el-button>
          </div>

          <div class="flex items-center">
            <el-popover
              placement="bottom-end"
              :width="260"
              trigger="click"
              popper-class="column-selector-popover"
            >
              <template #reference>
                <el-button type="primary" :icon="Setting" size="small">
                  {{ t('common.setting') }}
                </el-button>
              </template>
              <div class="column-config-panel">
                <div class="panel-header">
                  <span class="panel-title">显示列设置</span>
                  <div class="panel-actions">
                    <el-button size="small" text @click="selectAllColumns"> 全选</el-button>
                    <el-button size="small" text @click="clearAllColumns"> 清空</el-button>
                  </div>
                </div>
                <div class="column-list">
                  <el-checkbox-group
                    v-model="easyTierStore.selectedColumns"
                    class="column-checkbox-group"
                    @change="selectedColumnsChange"
                  >
                    <el-checkbox
                      v-for="item in optionalColumns"
                      :key="item.prop"
                      :value="item.prop"
                      :label="item.prop"
                      class="column-checkbox"
                    >
                      {{ t(item.label) }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
                <div class="panel-footer">
                  <span class="selected-count">
                    已选择 {{ easyTierStore.selectedColumns.length }} /
                    {{ optionalColumns.length }} 列
                  </span>
                </div>
              </div>
            </el-popover>
          </div>
        </div>
      </div>
      <!-- 列选择器 -->

      <el-table
        :data="peerInfo"
        style="width: 100%; margin-top: 10px"
        height="60vh"
        :default-sort="{ prop: 'ipv4_addr', order: 'ascending' }"
        table-layout="fixed"
        :row-class-name="tableRowClassName"
        stripe
        border
      >
        <el-table-column
          prop="ipv4"
          :label="t('easytier.ipv4Vir')"
          width="125"
          align="center"
          header-align="center"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ row.ipv4 }}&nbsp;</span>
            <el-icon
              v-if="row.ipv4 && row.ipv4 !== '服务器'"
              @click.stop="copyIp(row.ipv4)"
              size="14"
            >
              <CopyDocument />
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column
          prop="hostname"
          :label="t('easytier.hostname')"
          min-width="90"
          align="center"
          header-align="center"
          show-overflow-tooltip
        />
        <el-table-column
          prop="cost"
          :label="t('easytier.cost')"
          align="center"
          header-align="center"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-tag v-if="row.cost === '本机'" type="primary">{{ row.cost }}</el-tag>
            <el-tag v-else :type="row.cost === '直连' ? 'success' : 'info'">{{ row.cost }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="lat_ms"
          :label="t('easytier.lat_ms')"
          align="center"
          header-align="center"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span :style="{ color: row.delayColor }">{{ row.lat_ms }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-for="col in visibleDynamicColumns"
          :key="col.prop"
          :prop="col.prop"
          :label="t(col.label)"
          align="center"
          header-align="center"
          show-overflow-tooltip
        />
        <el-table-column :label="t('common.action')" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-dropdown
              v-if="row.ipv4 && row.ipv4 !== '服务器' && row.cost !== '本机'"
              trigger="click"
              @command="(cmd) => cmd(row.ipv4)"
            >
              <el-button type="primary" size="small">
                {{ t('common.action') }}
                <el-icon class="el-icon--right">
                  <arrow-down />
                </el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="handlePing">
                    <el-icon>
                      <Platform />
                    </el-icon>
                    Ping 节点
                  </el-dropdown-item>
                  <el-dropdown-item :command="handleTelnet">
                    <el-icon>
                      <Platform />
                    </el-icon>
                    Telnet 端口
                  </el-dropdown-item>
                  <el-dropdown-item :command="handleSSH">
                    <el-icon>
                      <Link />
                    </el-icon>
                    Windows SSH
                  </el-dropdown-item>
                  <el-dropdown-item :command="handleRDP">
                    <el-icon>
                      <Monitor />
                    </el-icon>
                    远程桌面 (RDP)
                  </el-dropdown-item>
                  <el-dropdown-item :command="handleXshell">
                    <el-icon>
                      <Link />
                    </el-icon>
                    Xshell 连接
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <!-- <el-table-column prop="rx_bytes" :label="t('easytier.rx_bytes')" show-overflow-tooltip>
        </el-table-column>
        <el-table-column prop="tx_bytes" :label="t('easytier.tx_bytes')" show-overflow-tooltip>
        </el-table-column>
        <el-table-column prop="loss_rate" :label="t('easytier.loss_rate')" show-overflow-tooltip>
        </el-table-column>
        <el-table-column
          prop="tunnel_proto"
          :label="t('easytier.tunnel_proto')"
          show-overflow-tooltip
        />
        <el-table-column prop="nat_type" :label="t('easytier.nat_type')" show-overflow-tooltip />
        <el-table-column prop="version" :label="t('easytier.version')" show-overflow-tooltip /> -->
      </el-table>
    </ContentWrap>

    <Dialog
      :title="'日志-' + currentNodeKey.configFileName"
      v-model="logDialogVisible"
      maxHeight="70vh"
      width="85%"
    >
      <div class="edit-container h-62vh">
        <el-form-item label="日志换行">
          <el-select
            v-model="wordWrap"
            style="width: 240px"
            @change="wordWrapChange"
            default-first-option
          >
            <el-option label="不换行" value="off" />
            <el-option label="换行" value="on" />
          </el-select>
          <el-button type="info" @click="clearLog"> 清空</el-button>
        </el-form-item>
        <CodeEditor
          ref="MonacoEditRef"
          v-model="logData"
          language="log"
          theme="log"
          :readOnly="true"
          :languageSelector="false"
          :themeSelector="false"
          :wordWrap="wordWrap"
        />
      </div>
      <template #footer>
        <el-button @click="logDialogVisible = false">{{ t('dialogDemo.close') }}</el-button>
      </template>
    </Dialog>

    <Dialog title="Telnet 端口" v-model="telnetDialogVisible" width="400px" max-height="200px">
      <el-form label-width="80px">
        <el-form-item label="IP 地址">
          <el-input v-model="currentTelnetIp" />
        </el-form-item>
        <el-form-item label="端口号">
          <el-input v-model="telnetPort" placeholder="请输入端口号" />
          <div style=" display: flex;margin-top: 8px; gap: 8px; flex-wrap: wrap">
            <el-button size="small" @click="setQuickPort('22')">22 (SSH)</el-button>
            <el-button size="small" @click="setQuickPort('80')">80 (HTTP)</el-button>
            <el-button size="small" @click="setQuickPort('443')">443 (HTTPS)</el-button>
            <el-button size="small" @click="setQuickPort('3389')">3389 (RDP)</el-button>
            <el-button size="small" @click="setQuickPort('3306')">3306 (MySQL)</el-button>
            <el-button size="small" @click="setQuickPort('8080')">8080 (Proxy)</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="telnetDialogVisible = false">{{ t('dialogDemo.close') }}</el-button>
        <el-button type="primary" @click="executeTelnet">{{ t('common.ok') }}</el-button>
      </template>
    </Dialog>
  </div>
</template>
<style lang="less">
// .@{elNamespace}-dialog {
//   --el-dialog-width: 70%;
// }

.switch-color {
  --el-switch-on-color: #05b900;
  --el-switch-off-color: #ec2323;
}

.column-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;

  .selector-label {
    font-size: 14px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .column-select {
    max-width: 300px;
    min-width: 200px;
  }

  .column-config-btn {
    margin-left: 8px;
  }
}

// 弹出式列选择器样式
.column-selector-popover {
  .column-config-panel {
    .panel-header {
      display: flex;
      padding-bottom: 8px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--el-border-color-light);
      justify-content: space-between;
      align-items: center;

      .panel-title {
        font-weight: 500;
        color: var(--el-text-color-primary);
      }

      .panel-actions {
        display: flex;
        gap: 8px;
      }
    }

    .column-list {
      max-height: 200px;
      overflow-y: auto;

      .column-checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .column-checkbox {
          margin: 0;

          .el-checkbox__label {
            font-size: 13px;
          }
        }
      }
    }

    .panel-footer {
      padding-top: 8px;
      margin-top: 12px;
      border-top: 1px solid var(--el-border-color-light);

      .selected-count {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}
</style>
