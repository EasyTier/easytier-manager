<script setup lang="tsx">
import { BaseButton } from '@/components/Button'
import { CodeEditor } from '@/components/CodeEditor'
import { ContentWrap } from '@/components/ContentWrap'
import { Descriptions, DescriptionsSchema } from '@/components/Descriptions'
import { Dialog } from '@/components/Dialog'
import { CONFIG_PATH, LOG_PATH } from '@/constants/easytier'
import { useI18n } from '@/hooks/web/useI18n'
import { useEasyTierStore } from '@/store/modules/easytier'
import { useTrayStore } from '@/store/modules/trayStore'
import { parseNodeInfo, parsePeerInfo } from '@/utils/easyTierUtil'
import { listTomlFiles, readFileContent } from '@/utils/fileUtil'
import {
  addRouteOnWindows,
  checkRouteOnWindows,
  getRunningProcesses,
  killProcess,
  runEasyTierCli,
  runEasyTierCore
} from '@/utils/shellUtil'
import { notify, sleep } from '@/utils/sysUtil'
import { CopyDocument } from '@element-plus/icons-vue'
import { attachConsole, error, info } from '@tauri-apps/plugin-log'
import { useClipboard } from '@vueuse/core'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox, ElNotification, ElOption, ElSelect, ElTree } from 'element-plus'
import * as toml from 'smol-toml'
import { computed, onMounted, reactive, ref, unref, watch } from 'vue'

const { t } = useI18n()
const easyTierStore = useEasyTierStore()
const trayStore = useTrayStore()
const logDialogVisible = ref(false)
const descriptionCollapse = ref(false)
const runningTag2 = ref(false)
const logData = ref('')
const MonacoEditRef = ref()
const wordWrap = ref('off')
const nodeInfo = ref({})
const peerInfo = ref<PeerInfo[]>([])
const treeEl = ref<typeof ElTree>()
const dialogTitle = ref('')
const currentNodeKey = ref<RunningItem>({
  configFileName: ''
})
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
    field: 'Hostname',
    label: t('easytier.hostname')
  },
  {
    field: 'Virtual IP',
    label: t('easytier.ipv4Vir')
  },
  {
    field: 'Public IP',
    label: t('easytier.ipPublic')
  },
  {
    field: 'UDP Stun Type',
    label: t('easytier.nat_type')
  },
  {
    field: 'Peer ID',
    label: t('easytier.peerId')
  },
  {
    field: 'Proxy CIDRs',
    label: t('easytier.proxy_network')
  },
  {
    field: 'Listener 1',
    label: t('easytier.listener1')
  },
  {
    field: 'Listener 2',
    label: t('easytier.listener2')
  },
  {
    field: 'Listener 3',
    label: t('easytier.listener3')
  },
  {
    field: 'Listener 4',
    label: t('easytier.listener4')
  }
])
const delayColorMap = [
  { max: 10, color: 'green' },
  { min: 11, max: 80, color: '#45b558' },
  { min: 81, max: 150, color: '#72d582' },
  { min: 151, max: 250, color: '#ffc54d' },
  { min: 251, max: 350, color: '#ffc54d' },
  { min: 351, color: 'red' }
]
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
const setExitRoute = async (val) => {
  const dataConfig = (await readFileContent(
    CONFIG_PATH + '/' + currentNodeKey.value.fileName
  )) as string
  // @ts-ignore
  // @ts-nocheck
  const parseValue: EasyTierConfig = toml.parse(dataConfig)
  if (val && parseValue.config_exit_nodes_route && parseValue.exit_nodes.length > 0) {
    // 找出 peerInfo 中 cost 为 local的节点
    const localNode = peerInfo.value.find((value) => value.cost === '本机')
    if (localNode) {
      if (await checkRouteOnWindows(localNode.ipv4)) {
        // 设置出口节点的路由
        setTimeout(() => {
          addRouteOnWindows(parseValue.exit_nodes[0])
        }, 3000)
      }
    }
  }
  easyTierStore.stopSetRoute = true
  // else {
  //   // 取消出口节点的路由
  //   await delRouteOnWindows(parseValue.exit_nodes[0])
  // }
}

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
    error('获取配置异常' + e)
  }
}
// 从easyTierStore.runningList 同步 runningTag
const runningTag = computed(() => {
  return easyTierStore.runningList.some(
    (i) => i.configFileName === currentNodeKey.value.configFileName
  )
})
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
const getNatType = (natType: string) => {
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
    case 'FullCone':
      return t('easytier.fullCone')
    case 'Restricted':
      return t('easytier.restricted')
    case 'PortRestricted':
      return t('easytier.portRestricted')
    case 'Symmetric':
      return t('easytier.symmetric')
    case 'Unknown':
      return t('easytier.unknown')
    case 'OpenInternet':
      return t('easytier.openInternet')
    case 'NoPAT':
      return t('easytier.noPAT')
    default:
      return natType
  }
}
const getNodeInfo = async () => {
  await sleep(3000)
  const maxRetry = 10
  let retryTime = 1
  while (true) {
    if (easyTierStore.stopLoop || retryTime > maxRetry) {
      break
    }
    const res = await runEasyTierCli(['node'])
    if (res === 403) {
      easyTierStore.setStopLoop(true)
      runningTag2.value = false
    }
    if (!res) {
      retryTime++
      continue
    }
    if (
      nodeInfo.value['Virtual IP'] &&
      nodeInfo.value['Public IP'] &&
      nodeInfo.value['UDP Stun Type']
    ) {
      retryTime = maxRetry
    }
    nodeInfo.value = parseNodeInfo(res) as string
    runningTag2.value = true
    await sleep(10000)
  }
}
const getPeerInfo = async () => {
  await sleep(2000)
  let retryTime = 1
  while (true) {
    // todo 可配置retryTime
    if (easyTierStore.stopLoop || retryTime > 5) {
      break
    }
    const temp = (await readFileContent(
      CONFIG_PATH + '/' + currentNodeKey.value.configFileName + '.toml'
    )) as string
    const data = toml.parse(temp)
    const res = await runEasyTierCli([
      '-p',
      (data.rpc_portal as String).replace('0.0.0.0', '127.0.0.1'),
      'peer'
    ])
    if (res === 403) {
      easyTierStore.setStopLoop(true)
      easyTierStore.removeRunningList(currentNodeKey.value.configFileName)
      runningTag2.value = false
      continue
    }
    if (!res) {
      retryTime++
      continue
    } else {
      retryTime = 0
    }
    peerInfo.value = parsePeerInfo(res)
    const filter = peerInfo.value.filter((value) => value.ipv4 && value.cost !== 'Local')
    const filter1 = peerInfo.value.filter(
      (value) => value.ipv4 && value.cost !== 'Local' && value.cost === 'p2p'
    )
    peerInfo.value.forEach((value) => {
      if (value.ipv4 && value.ipv4.includes('/')) {
        value.ipv4 = value.ipv4.split('/')[0]
      } else {
        const suffixName = value.hostname ? value.hostname.split('_')[1] : ''
        value.ipv4 = '服务器' + suffixName
      }

      value.cost = routeCost(value.cost)
      value.nat_type = getNatType(value.nat_type)
      value.delayColor = getDelayColor(value.lat_ms)
    })
    runningTag2.value = true
    if (
      easyTierStore.p2pNotify &&
      filter.length > 0 &&
      filter1.length > 0 &&
      filter.length === filter1.length
    ) {
      notify('EasyTier 管理器', '恭喜你，全部节点建立 P2P 连接！🎉🎉')
      // 只通知一次
      easyTierStore.setP2pNotify(false)
    }
    // await getList()
    await sleep(5000)
  }
}
const updateRunningList = async (res?: any) => {
  if (!res) {
    res = await getRunningProcesses(currentNodeKey.value.fileName!)
  }
  // 先删除，再添加
  easyTierStore.setRunningList([])
  if (res.length > 0) {
    res.forEach((item) => {
      const configFileName = item.fileName.replace('.toml', '')
      easyTierStore.addRunningList(configFileName, item.pid)
    })
  }
  return res
}
const startAction = async () => {
  info('开始运行配置:' + currentNodeKey.value.fileName!)
  await runEasyTierCore(currentNodeKey.value.fileName!)
    .then((res) => {
      info('运行配置结果:' + JSON.stringify(res))
      easyTierStore.stopSetRoute = false
      getNodeInfo()
      getPeerInfo()
      updateRunningList()
      easyTierStore.setStopLoop(false)
      easyTierStore.setP2pNotify(true)
      easyTierStore.setLastRunConfigName(currentNodeKey.value)
      // 暂时不再自动展开
      // descriptionCollapse.value = true
      trayStore.setTrayTooltip('当前运行配置：' + currentNodeKey.value.configFileName)
      // runningTag.value = true
    })
    .catch(() => {
      runningTag2.value = false
      ElMessageBox({
        title: '哦豁，出错啦',
        message: '运行当前配置出错，请在设置检查是否有核心程序，或核心程序是否有可执行权限',
        type: 'error',
        draggable: true,
        confirmButtonText: t('common.ok')
      })
    })
    .finally(() => currentNodeKeyChange())
}
const stopAction = async () => {
  info('停止运行配置:' + currentNodeKey.value.configFileName)
  const item = easyTierStore.getRunningItem(currentNodeKey.value.configFileName)
  if (item && item.pid) {
    const res = await killProcess(item.pid)
    if (res) {
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
  trayStore.setTrayTooltip(undefined)
  easyTierStore.setStopLoop(true)
  runningTag2.value = false
  // currentNodeKeyChange()
}
const reset = async () => {
  nodeInfo.value = {}
  peerInfo.value.length = 0
  descriptionCollapse.value = false
  easyTierStore.removeRunningList(currentNodeKey.value.configFileName)
  await updateRunningList()
  runningTag2.value = false
  // await getList()
}
const viewLogAction = async () => {
  const date = dayjs(new Date()).format('YYYY-MM-DD')
  logData.value = (await readFileContent(
    LOG_PATH + '/' + currentNodeKey.value.configFileName + '.' + date
  )) as string
  if (!logData.value || logData.value === '') {
    logData.value = (await readFileContent(
      LOG_PATH + '/' + currentNodeKey.value.configFileName + '.' + date + '.log'
    )) as string
  }
  logDialogVisible.value = true
}
const currentNodeKeyChange = async () => {
  try {
    easyTierStore.setErrRunNotify(true)
    // const res = await getRunningProcesses(currentNodeKey.value.fileName!)
    const res = await updateRunningList()
    if (res.length > 0) {
      // await updateRunningList(res)
      easyTierStore.setStopLoop(false)
      getNodeInfo()
      getPeerInfo()
      return
    }
    nodeInfo.value = {}
    peerInfo.value.length = 0
    descriptionCollapse.value = false
    runningTag2.value = false
    easyTierStore.setStopLoop(true)
    await getConfigList()
  } catch (e: any) {
    error('异常:' + JSON.stringify(e))
  }
}

const wordWrapChange = (val: any) => {
  MonacoEditRef.value.updateOptions({ wordWrap: val })
}
const checkCore = async () => {
  const res = await runEasyTierCli(['-V'])
  if (res === 403) {
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
const getDelayColor = (delay) => {
  const value = parseFloat(delay) // 确保是数字
  for (const range of delayColorMap) {
    const { min, max } = range
    const isMinOk = min === undefined ? true : value > min
    const isMaxOk = max === undefined ? true : value <= max
    if (isMinOk && isMaxOk) {
      return range.color
    }
  }
  return 'gray' // 默认颜色
}
onMounted(async () => {
  // 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
  await attachConsole()
  await checkCore()
  await getConfigList()
  easyTierStore.loadRunningList()
  // getNodeInfo()
  // getPeerInfo()
  const configName = easyTierStore.getLastRunConfigName()
  if (configName) {
    currentNodeKey.value.configFileName = configName
    currentNodeKey.value.fileName = configName + '.toml'
    currentNodeKeyChange()
  }
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="flex-[3]">
      <Descriptions
        :title="t('easytier.peerInfo')"
        :data="nodeInfo"
        :schema="nodeInfoSchema"
        :show="descriptionCollapse"
      />
      <small
        >注：当前配置是否在运行，以<b>选择框后的状态或表格数据</b>为主；如果是精简魔改系统，运行状态可能不准确，有数据更新则为运行</small
      >
      <div class="mt-3 mb-10px">
        <ElSelect
          v-model="currentNodeKey"
          placeholder="选择配置"
          class="mr-10px"
          style="width: 240px"
          default-first-option
          value-key="configFileName"
          @change="currentNodeKeyChange"
        >
          <ElOption
            v-for="item in easyTierStore.configList"
            :key="item.configFileName"
            :label="item.configFileName"
            :value="item"
          />
          <!--<ElOptionGroup v-for="group in allConfigOptions" :key="group.label" :label="group.label">
          </ElOptionGroup>-->
        </ElSelect>
        <el-switch
          v-model="runningTag"
          class="mr-2 switch-color"
          size="large"
          inline-prompt
          :active-text="t('easytier.running')"
          :inactive-text="t('easytier.stopping')"
          disabled
        >
          <template #active-action>
            <span class="custom-active-action">v</span>
          </template>
          <template #inactive-action>
            <span class="custom-inactive-action">×</span>
          </template>
        </el-switch>
        <BaseButton type="success" @click="startAction" :disabled="runningTag || runningTag2"
          >{{ t('easytier.startNet') }}
        </BaseButton>
        <BaseButton type="danger" @click="stopAction" :disabled="!runningTag && !runningTag2"
          >{{ t('easytier.stopNet') }}
        </BaseButton>
        <BaseButton type="info" @click="viewLogAction">{{ t('easytier.view_log') }}</BaseButton>
        <!-- <BaseButton type="primary" @click="refreshAction">{{ t('common.refresh') }}</BaseButton> -->
      </div>
      <el-table
        :data="peerInfo"
        style="width: 100%; margin-top: 10px"
        height="53vh"
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
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ row.ipv4 }}&nbsp;</span>
            <el-icon v-if="row.ipv4" @click.stop="copyIp(row.ipv4)" size="14">
              <CopyDocument />
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column
          prop="hostname"
          :label="t('easytier.hostname')"
          min-width="90"
          show-overflow-tooltip
        />
        <el-table-column prop="cost" :label="t('easytier.cost')" show-overflow-tooltip>
          <!-- <template #default="{ row }">
            <span>{{ routeCost(row.cost) }}</span>
          </template> -->
        </el-table-column>
        <el-table-column prop="lat_ms" :label="t('easytier.lat_ms')" show-overflow-tooltip>
          <template #default="{ row }">
            <span :style="{ color: row.delayColor }">{{ row.lat_ms }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="rx_bytes" :label="t('easytier.rx_bytes')" show-overflow-tooltip>
          <!-- <template #default="{ row }">
            <span>{{ rxBytes(row.rx_bytes) }}</span>
          </template> -->
        </el-table-column>
        <el-table-column prop="tx_bytes" :label="t('easytier.tx_bytes')" show-overflow-tooltip>
          <!-- <template #default="{ row }">
            <span>{{ txBytes(row.tx_bytes) }}</span>
          </template> -->
        </el-table-column>
        <el-table-column prop="loss_rate" :label="t('easytier.loss_rate')" show-overflow-tooltip>
          <!-- <template #default="{ row }">
            <span>{{ lossRate(row.loss_rate) }}</span>
          </template> -->
        </el-table-column>
        <el-table-column prop="nat_type" :label="t('easytier.nat_type')" show-overflow-tooltip />
        <!-- <el-table-column
          prop="tunnel_proto"
          :label="t('easytier.tunnel_proto')"
          show-overflow-tooltip
        /> -->
        <el-table-column prop="version" :label="t('easytier.version')" show-overflow-tooltip />
      </el-table>
    </ContentWrap>

    <Dialog v-model="logDialogVisible" :title="dialogTitle" maxHeight="60vh">
      <div class="edit-container h-60vh">
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
        <BaseButton @click="logDialogVisible = false">{{ t('dialogDemo.close') }}</BaseButton>
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
</style>
