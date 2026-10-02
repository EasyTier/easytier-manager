<script setup lang="ts">
import { ContentWrap } from '@/components/ContentWrap'
import { useI18n } from '@/hooks/web/useI18n'
import {
  cliJson,
  cliRun,
  joinPortList,
  splitPortList,
  updateTomlConfig
} from '@/utils/instanceCliUtil'
import { listRunningCoreInstances, normalizeRpcPortal } from '@/utils/shellUtil'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessageBox, ElNotification } from 'element-plus'
import { computed, onActivated, onMounted, ref, watch } from 'vue'

const { t } = useI18n()

// ===== 实例选择 =====
const instances = ref<CoreProcessInstance[]>([])
const selectedConfigName = ref('')
const activeTab = ref('whitelist')
const instancesLoading = ref(false)

const currentInstance = computed(() =>
  instances.value.find((item) => item.configFileName === selectedConfigName.value)
)
const currentPortal = computed(() => normalizeRpcPortal(currentInstance.value?.rpcPortal))
/** 实例对应的配置文件名（如 server.toml），用于手动回写 */
const currentFileName = computed(
  () => currentInstance.value?.fileName || (currentInstance.value?.configFileName ?? '') + '.toml'
)

const refreshInstances = async () => {
  instancesLoading.value = true
  try {
    instances.value = await listRunningCoreInstances()
    if (
      selectedConfigName.value &&
      !instances.value.some((item) => item.configFileName === selectedConfigName.value)
    ) {
      selectedConfigName.value = ''
    }
    if (!selectedConfigName.value && instances.value.length > 0) {
      selectedConfigName.value = instances.value[0].configFileName
    }
  } finally {
    instancesLoading.value = false
  }
}

const notifyCliError = (error?: string) => {
  ElNotification({
    title: t('common.reminder'),
    message: error || t('instance.cliError'),
    type: 'error',
    duration: 6000
  })
}

const writeBack = async (mutate: (config: any) => void) => {
  const okFlag = await updateTomlConfig(currentFileName.value, mutate)
  if (okFlag) {
    ElNotification({
      title: t('common.reminder'),
      message: t('instance.writeBackSuccess') + currentFileName.value,
      type: 'success',
      duration: 3000
    })
  } else {
    notifyCliError(t('instance.writeBackFailed'))
  }
}

// ===== 白名单 =====
const whitelistRaw = ref('')
const whitelistTcpInput = ref('')
const whitelistUdpInput = ref('')
const whitelistLoading = ref(false)

const loadWhitelist = async () => {
  whitelistLoading.value = true
  try {
    const res = await cliJson(['-p', currentPortal.value, '-o', 'json', 'whitelist', 'show'])
    if (!res.ok) {
      notifyCliError(res.error)
      return
    }
    const data = res.data
    if (data && typeof data === 'object') {
      const tcp = Array.isArray(data.tcp) ? joinPortList(data.tcp) : undefined
      const udp = Array.isArray(data.udp) ? joinPortList(data.udp) : undefined
      if (tcp !== undefined || udp !== undefined) {
        whitelistTcpInput.value = tcp ?? ''
        whitelistUdpInput.value = udp ?? ''
        whitelistRaw.value = ''
      } else {
        whitelistRaw.value = res.output
      }
    } else {
      whitelistRaw.value = res.output
    }
  } finally {
    whitelistLoading.value = false
  }
}

const setWhitelist = async (proto: 'tcp' | 'udp') => {
  const ports =
    proto === 'tcp'
      ? splitPortList(whitelistTcpInput.value)
      : splitPortList(whitelistUdpInput.value)
  if (ports.length === 0) {
    ElNotification({
      title: t('common.reminder'),
      message: t('instance.whitelistEmptyTip'),
      type: 'warning',
      duration: 3000
    })
    return
  }
  const res = await cliRun([
    '-p',
    currentPortal.value,
    'whitelist',
    `set-${proto}`,
    ports.join(',')
  ])
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  await loadWhitelist()
}

const clearWhitelist = async (proto: 'tcp' | 'udp') => {
  const res = await cliRun(['-p', currentPortal.value, 'whitelist', `clear-${proto}`])
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  await loadWhitelist()
}

const writeBackWhitelist = () => {
  writeBack((config) => {
    const tcp = splitPortList(whitelistTcpInput.value)
    const udp = splitPortList(whitelistUdpInput.value)
    if (tcp.length > 0) config.tcp_whitelist = tcp.join(',')
    else delete config.tcp_whitelist
    if (udp.length > 0) config.udp_whitelist = udp.join(',')
    else delete config.udp_whitelist
  })
}

// ===== 端口转发 =====
interface PortForwardRow {
  protocol?: string
  bind_addr?: string
  dst_addr?: string
}
const portForwardRows = ref<PortForwardRow[]>([])
const portForwardRaw = ref('')
const portForwardLoading = ref(false)
const portForwardForm = ref({ proto: 'tcp', bind_addr: '', dst_addr: '' })

const loadPortForward = async () => {
  portForwardLoading.value = true
  try {
    const res = await cliJson(['-p', currentPortal.value, '-o', 'json', 'port-forward', 'list'])
    if (!res.ok) {
      notifyCliError(res.error)
      return
    }
    const data = res.data
    const rows: PortForwardRow[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.rules)
        ? data.rules
        : []
    if (rows.length > 0) {
      portForwardRows.value = rows
      portForwardRaw.value = ''
    } else {
      portForwardRows.value = []
      portForwardRaw.value = res.output
    }
  } finally {
    portForwardLoading.value = false
  }
}

const addPortForward = async () => {
  const form = portForwardForm.value
  if (!form.bind_addr || !form.dst_addr) {
    ElNotification({
      title: t('common.reminder'),
      message: t('instance.portForwardRequiredTip'),
      type: 'warning',
      duration: 3000
    })
    return
  }
  const res = await cliRun([
    '-p',
    currentPortal.value,
    'port-forward',
    'add',
    form.proto,
    form.bind_addr,
    form.dst_addr
  ])
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  form.bind_addr = ''
  form.dst_addr = ''
  await loadPortForward()
}

const removePortForwardRow = async (row: PortForwardRow) => {
  if (!row.protocol || !row.bind_addr) return
  const res = await cliRun(
    [
      '-p',
      currentPortal.value,
      'port-forward',
      'remove',
      row.protocol,
      row.bind_addr,
      row.dst_addr ?? ''
    ].filter((arg) => arg !== '')
  )
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  await loadPortForward()
}

const writeBackPortForward = () => {
  writeBack((config) => {
    if (portForwardRows.value.length > 0) {
      config.port_forward = portForwardRows.value.map((row) => ({
        proto: row.protocol ?? 'tcp',
        bind_addr: row.bind_addr ?? '',
        dst_addr: row.dst_addr ?? ''
      }))
    } else {
      delete config.port_forward
    }
  })
}

// ===== 连接器 =====
/** easytier-cli connector list 的连接器行；url 已在加载时拍平为字符串，status 为枚举数字 */
interface ConnectorRow {
  url?: string
  status?: number
}
const connectorRows = ref<ConnectorRow[]>([])
const connectorRaw = ref('')
const connectorLoading = ref(false)
const connectorUrlInput = ref('')

/** 连接器状态枚举（easytier proto ConnectorStatus）：0=已连接 1=已断开 2=连接中 */
const connectorStatusText = (status?: number) => {
  if (status === undefined || status === null) return '-'
  switch (Number(status)) {
    case 0:
      return t('instance.connectorStatusConnected')
    case 1:
      return t('instance.connectorStatusDisconnected')
    case 2:
      return t('instance.connectorStatusConnecting')
    default:
      return String(status)
  }
}
/** 连接器状态对应的标签颜色：已连接=绿 已断开=红 连接中=黄 未知=灰 */
const connectorStatusType = (status?: number): 'success' | 'warning' | 'danger' | 'info' => {
  switch (Number(status)) {
    case 0:
      return 'success'
    case 1:
      return 'danger'
    case 2:
      return 'warning'
    default:
      return 'info'
  }
}

const loadConnectors = async () => {
  connectorLoading.value = true
  try {
    const res = await cliJson(['-p', currentPortal.value, '-o', 'json', 'connector', 'list'])
    if (!res.ok) {
      notifyCliError(res.error)
      return
    }
    const data = res.data
    // CLI 返回的 url 为嵌套结构 { url: { url: "tcp://..." } }，这里统一拍平为字符串，供展示/删除/回写使用
    const rawRows: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.connectors)
        ? data.connectors
        : []
    const rows: ConnectorRow[] = rawRows.map((row: any) => ({
      url: typeof row.url === 'string' ? row.url : String(row.url?.url ?? ''),
      status: row.status
    }))
    if (rows.length > 0) {
      connectorRows.value = rows
      connectorRaw.value = ''
    } else {
      connectorRows.value = []
      connectorRaw.value = res.output
    }
  } finally {
    connectorLoading.value = false
  }
}

const addConnector = async () => {
  const url = connectorUrlInput.value.trim()
  if (!url) return
  const res = await cliRun(['-p', currentPortal.value, 'connector', 'add', url])
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  connectorUrlInput.value = ''
  await loadConnectors()
}

const removeConnector = async (row: ConnectorRow) => {
  if (!row.url) return
  const res = await cliRun(['-p', currentPortal.value, 'connector', 'remove', row.url])
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  await loadConnectors()
}

const writeBackConnectors = async () => {
  const urls = connectorRows.value.map((row) => row.url).filter(Boolean) as string[]
  await ElMessageBox.confirm(
    t('instance.connectorWriteBackConfirm') + `\n${urls.join('\n') || '-'}`,
    t('common.reminder'),
    {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  )
  writeBack((config) => {
    if (urls.length > 0) {
      config.peer = urls.map((uri) => ({ uri }))
    } else {
      delete config.peer
    }
  })
}

// ===== 临时凭据 =====
const credentialRaw = ref('')
const credentialLoading = ref(false)
const credentialForm = ref({
  ttl: 3600,
  groups: '',
  reusable: true,
  allowRelay: false,
  allowedProxyCidrs: ''
})
const revokeIdInput = ref('')

const loadCredentials = async () => {
  credentialLoading.value = true
  try {
    const res = await cliJson(['-p', currentPortal.value, '-o', 'json', 'credential', 'list'])
    if (!res.ok) {
      notifyCliError(res.error)
      return
    }
    credentialRaw.value = res.data !== undefined ? JSON.stringify(res.data, null, 2) : res.output
  } finally {
    credentialLoading.value = false
  }
}

const generateCredential = async () => {
  const form = credentialForm.value
  if (!form.ttl || form.ttl <= 0) {
    ElNotification({
      title: t('common.reminder'),
      message: t('instance.credentialTtlTip'),
      type: 'warning',
      duration: 3000
    })
    return
  }
  const args = ['-p', currentPortal.value, 'credential', 'generate', '--ttl', String(form.ttl)]
  const groups = form.groups
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (groups.length > 0) args.push('--groups', groups.join(','))
  args.push('--reusable', form.reusable ? 'true' : 'false')
  if (form.allowRelay) args.push('--allow-relay')
  const cidrs = form.allowedProxyCidrs
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (cidrs.length > 0) args.push('--allowed-proxy-cidrs', cidrs.join(','))

  const res = await cliRun(args)
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  await loadCredentials()
}

const revokeCredential = async () => {
  const id = revokeIdInput.value.trim()
  if (!id) return
  const res = await cliRun(['-p', currentPortal.value, 'credential', 'revoke', id])
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  revokeIdInput.value = ''
  await loadCredentials()
}

// ===== 日志级别 =====
const loggerRaw = ref('')
const loggerLoading = ref(false)
const loggerLevel = ref('')
/** 日志级别名称，顺序与 easytier-cli 的 LogLevel 枚举一致（0=disabled … 5=trace） */
const loggerLevels = ['disabled', 'error', 'warning', 'info', 'debug', 'trace']

/**
 * 将 logger get 返回的级别规范化为级别名称：
 * CLI 实际返回数字（如 3），需按枚举序号映射为名称；也兼容字符串（如 "info"/"warn"）
 * @param raw 原始级别值
 * @returns 可匹配下拉选项的级别名称，无法识别时返回空串
 */
const normalizeLoggerLevel = (raw: any): string => {
  if (raw === undefined || raw === null) return ''
  const str = String(raw).trim().toLowerCase()
  if (!str) return ''
  // 数字：按枚举序号映射（0=disabled 1=error 2=warning 3=info 4=debug 5=trace）
  if (/^\d+$/.test(str)) {
    return loggerLevels[parseInt(str, 10)] ?? ''
  }
  // 字符串：兼容 warn 等变体
  if (str === 'warn') return 'warning'
  return loggerLevels.includes(str) ? str : ''
}

const loadLogger = async () => {
  loggerLoading.value = true
  try {
    const res = await cliJson(['-p', currentPortal.value, '-o', 'json', 'logger', 'get'])
    if (!res.ok) {
      notifyCliError(res.error)
      return
    }
    if (res.data && typeof res.data === 'object') {
      const level =
        res.data.level ?? res.data.file_level ?? res.data.logger_level ?? res.data.console_level
      const normalized = normalizeLoggerLevel(level)
      if (normalized) {
        loggerLevel.value = normalized
        loggerRaw.value = ''
      } else {
        // 无法识别的级别，清空下拉并展示原始输出，避免显示原始数字
        loggerLevel.value = ''
        loggerRaw.value = res.output
      }
    } else {
      loggerRaw.value = res.output
    }
  } finally {
    loggerLoading.value = false
  }
}

const setLogger = async () => {
  if (!loggerLevel.value) return
  const res = await cliRun(['-p', currentPortal.value, 'logger', 'set', loggerLevel.value])
  if (!res.ok) {
    notifyCliError(res.error)
    return
  }
  await loadLogger()
}

const writeBackLogger = () => {
  if (!loggerLevel.value) return
  writeBack((config) => {
    if (!config.file_logger) config.file_logger = {}
    config.file_logger.level = loggerLevel.value
  })
}

// ===== 诊断 =====
const stunRaw = ref('')
const stunLoading = ref(false)
const statsRaw = ref('')
const statsLoading = ref(false)
const proxyRaw = ref('')
const proxyLoading = ref(false)

const runStun = async () => {
  stunLoading.value = true
  try {
    const res = await cliRun(['-p', currentPortal.value, '-o', 'json', 'stun'])
    stunRaw.value = res.ok
      ? res.data !== undefined
        ? JSON.stringify(res.data, null, 2)
        : res.output
      : `ERROR: ${res.error}`
  } finally {
    stunLoading.value = false
  }
}

const runStats = async () => {
  statsLoading.value = true
  try {
    const res = await cliJson(['-p', currentPortal.value, '-o', 'json', 'stats', 'show'])
    statsRaw.value = res.ok
      ? res.data !== undefined
        ? JSON.stringify(res.data, null, 2)
        : res.output
      : `ERROR: ${res.error}`
  } finally {
    statsLoading.value = false
  }
}

const runProxy = async () => {
  proxyLoading.value = true
  try {
    const res = await cliRun(['-p', currentPortal.value, '-o', 'json', 'proxy'])
    proxyRaw.value = res.ok
      ? res.data !== undefined
        ? JSON.stringify(res.data, null, 2)
        : res.output
      : `ERROR: ${res.error}`
  } finally {
    proxyLoading.value = false
  }
}

// ===== Tab 懒加载 =====
const loadedTabs = ref<string[]>([])

const loadTabData = async (tab: string) => {
  if (!currentInstance.value || loadedTabs.value.includes(tab)) return
  loadedTabs.value.push(tab)
  if (tab === 'whitelist') await loadWhitelist()
  else if (tab === 'portForward') await loadPortForward()
  else if (tab === 'connector') await loadConnectors()
  else if (tab === 'credential') await loadCredentials()
  else if (tab === 'logger') await loadLogger()
}

watch(activeTab, (tab) => loadTabData(tab))
watch(selectedConfigName, () => {
  loadedTabs.value = []
  whitelistRaw.value = ''
  portForwardRows.value = []
  portForwardRaw.value = ''
  connectorRows.value = []
  connectorRaw.value = ''
  credentialRaw.value = ''
  loggerRaw.value = ''
  if (currentInstance.value) loadTabData(activeTab.value)
})

onMounted(async () => {
  await refreshInstances()
  if (currentInstance.value) await loadTabData(activeTab.value)
})

onActivated(async () => {
  await refreshInstances()
})

const refreshCurrentTab = async () => {
  loadedTabs.value = loadedTabs.value.filter((tab) => tab !== activeTab.value)
  await loadTabData(activeTab.value)
}
</script>

<template>
  <ContentWrap>
    <div class="mb-12px flex items-center gap-12px flex-wrap">
      <el-select
        v-model="selectedConfigName"
        :placeholder="t('instance.selectInstance')"
        :loading="instancesLoading"
        style="width: 280px"
        clearable
      >
        <el-option
          v-for="item in instances"
          :key="item.configFileName"
          :label="`${item.configFileName} (${normalizeRpcPortal(item.rpcPortal)})`"
          :value="item.configFileName"
        />
      </el-select>
      <el-button :icon="Refresh" :loading="instancesLoading" @click="refreshInstances">
        {{ t('common.reload') }}
      </el-button>
      <el-button v-if="currentInstance" plain type="primary" @click="refreshCurrentTab">
        {{ t('instance.refreshTab') }}
      </el-button>
      <span v-if="currentInstance" class="text-[var(--el-text-color-secondary)] text-13px">
        {{ t('workplace.rpcPortal') }}: {{ currentPortal }}
      </span>
    </div>

    <el-empty v-if="!currentInstance" :description="t('instance.noRunningInstance')" />

    <el-tabs v-else v-model="activeTab" class="instance-tabs">
      <el-tab-pane :label="t('instance.tabWhitelist')" name="whitelist">
        <div class="mb-12px" v-loading="whitelistLoading">
          <el-row :gutter="12">
            <el-col :span="12">
              <div class="mb-4px font-bold">TCP</div>
              <div class="flex gap-8px">
                <el-input
                  v-model="whitelistTcpInput"
                  :placeholder="t('instance.whitelistPlaceholder')"
                  clearable
                />
                <el-button type="primary" @click="setWhitelist('tcp')">
                  {{ t('common.ok') }}
                </el-button>
                <el-button @click="clearWhitelist('tcp')">
                  {{ t('instance.clear') }}
                </el-button>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="mb-4px font-bold">UDP</div>
              <div class="flex gap-8px">
                <el-input
                  v-model="whitelistUdpInput"
                  :placeholder="t('instance.whitelistPlaceholder')"
                  clearable
                />
                <el-button type="primary" @click="setWhitelist('udp')">
                  {{ t('common.ok') }}
                </el-button>
                <el-button @click="clearWhitelist('udp')">
                  {{ t('instance.clear') }}
                </el-button>
              </div>
            </el-col>
          </el-row>
          <div class="mt-12px flex gap-8px">
            <el-button type="success" plain @click="writeBackWhitelist">
              {{ t('instance.writeBack') }}
            </el-button>
          </div>
          <pre v-if="whitelistRaw" class="cli-output">{{ whitelistRaw }}</pre>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('instance.tabPortForward')" name="portForward">
        <div v-loading="portForwardLoading">
          <div class="mb-12px flex gap-8px flex-wrap">
            <el-select v-model="portForwardForm.proto" style="width: 100px">
              <el-option label="TCP" value="tcp" />
              <el-option label="UDP" value="udp" />
            </el-select>
            <el-input
              v-model="portForwardForm.bind_addr"
              :placeholder="t('instance.bindAddrPlaceholder')"
              style="width: 220px"
              clearable
            />
            <el-input
              v-model="portForwardForm.dst_addr"
              :placeholder="t('instance.dstAddrPlaceholder')"
              style="width: 220px"
              clearable
            />
            <el-button type="primary" @click="addPortForward">
              {{ t('instance.add') }}
            </el-button>
            <el-button type="success" plain @click="writeBackPortForward">
              {{ t('instance.writeBack') }}
            </el-button>
          </div>
          <el-table :data="portForwardRows" style="width: 100%">
            <el-table-column prop="protocol" label="Protocol" width="100" />
            <el-table-column prop="bind_addr" label="Bind" min-width="160" />
            <el-table-column prop="dst_addr" label="Destination" min-width="160" />
            <el-table-column :label="t('common.action')" width="100" align="center">
              <template #default="scope">
                <el-button type="danger" link @click="removePortForwardRow(scope.row)">
                  {{ t('common.delete') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <pre v-if="portForwardRaw" class="cli-output">{{ portForwardRaw }}</pre>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('instance.tabConnector')" name="connector">
        <div v-loading="connectorLoading">
          <div class="mb-12px flex gap-8px">
            <el-input
              v-model="connectorUrlInput"
              :placeholder="t('instance.connectorUrlPlaceholder')"
              style="width: 320px"
              clearable
            />
            <el-button type="primary" @click="addConnector">
              {{ t('instance.add') }}
            </el-button>
            <el-button type="success" plain @click="writeBackConnectors">
              {{ t('instance.writeBack') }}
            </el-button>
          </div>
          <el-table :data="connectorRows" style="width: 100%">
            <el-table-column label="URL" min-width="240" show-overflow-tooltip>
              <template #default="scope">
                {{ scope.row.url || '-' }}
              </template>
            </el-table-column>
            <el-table-column :label="t('instance.connectorStatus')" width="110" align="center">
              <template #default="scope">
                <el-tag :type="connectorStatusType(scope.row.status)" size="small">
                  {{ connectorStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('common.action')" width="100" align="center">
              <template #default="scope">
                <el-button type="danger" link @click="removeConnector(scope.row)">
                  {{ t('common.delete') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <pre v-if="connectorRaw" class="cli-output">{{ connectorRaw }}</pre>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('instance.tabCredential')" name="credential">
        <div v-loading="credentialLoading">
          <div class="mb-12px flex gap-8px flex-wrap items-center">
            <span class="text-13px">TTL(s)</span>
            <el-input-number v-model="credentialForm.ttl" :min="1" :step="60" />
            <el-input
              v-model="credentialForm.groups"
              :placeholder="t('instance.credentialGroupsPlaceholder')"
              style="width: 200px"
              clearable
            />
            <el-checkbox v-model="credentialForm.reusable">
              {{ t('instance.credentialReusable') }}
            </el-checkbox>
            <el-checkbox v-model="credentialForm.allowRelay">
              {{ t('instance.credentialAllowRelay') }}
            </el-checkbox>
            <el-button type="primary" @click="generateCredential">
              {{ t('instance.credentialGenerate') }}
            </el-button>
          </div>
          <div class="mb-12px flex gap-8px">
            <el-input
              v-model="revokeIdInput"
              :placeholder="t('instance.credentialRevokePlaceholder')"
              style="width: 320px"
              clearable
            />
            <el-button type="danger" plain @click="revokeCredential">
              {{ t('instance.credentialRevoke') }}
            </el-button>
          </div>
          <pre class="cli-output">{{ credentialRaw || t('instance.emptyOutput') }}</pre>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('instance.tabLogger')" name="logger">
        <div v-loading="loggerLoading">
          <div class="mb-12px flex gap-8px items-center">
            <el-select v-model="loggerLevel" style="width: 160px">
              <el-option v-for="level in loggerLevels" :key="level" :label="level" :value="level" />
            </el-select>
            <el-button type="primary" @click="setLogger">
              {{ t('common.ok') }}
            </el-button>
            <el-button type="success" plain @click="writeBackLogger">
              {{ t('instance.writeBack') }}
            </el-button>
            <span class="text-12px text-[var(--el-text-color-secondary)]">
              {{ t('instance.loggerWriteBackTip') }}
            </span>
          </div>
          <pre v-if="loggerRaw" class="cli-output">{{ loggerRaw }}</pre>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('instance.tabDiagnostics')" name="diagnostics">
        <div>
          <div class="mb-12px flex gap-8px flex-wrap">
            <el-button :loading="stunLoading" @click="runStun">STUN</el-button>
            <el-button :loading="statsLoading" @click="runStats">Stats</el-button>
            <el-button :loading="proxyLoading" @click="runProxy">Proxy</el-button>
          </div>
          <pre v-if="stunRaw" class="cli-output">{{ stunRaw }}</pre>
          <pre v-if="statsRaw" class="cli-output">{{ statsRaw }}</pre>
          <pre v-if="proxyRaw" class="cli-output">{{ proxyRaw }}</pre>
        </div>
      </el-tab-pane>
    </el-tabs>
  </ContentWrap>
</template>

<style scoped>
.cli-output {
  max-height: 360px;
  padding: 12px;
  margin: 8px 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
</style>
