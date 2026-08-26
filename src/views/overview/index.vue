<script setup lang="ts">
import { ContentWrap } from '@/components/ContentWrap'
import { useI18n } from '@/hooks/web/useI18n'
import { useEasyTierStore } from '@/store/modules/easytier'
import {
  killProcess,
  listRunningCoreInstances,
  normalizeRpcPortal,
  runEasyTierCli,
  safeJsonParse
} from '@/utils/shellUtil'
import { sleep } from '@/utils/sysUtil'
import { error, info } from '@tauri-apps/plugin-log'
import dayjs from 'dayjs'
import { ElMessage, ElNotification } from 'element-plus'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
const easyTierStore = useEasyTierStore()

/** 顶部 Tab：运行实例 / 路由信息 */
const activeTab = ref<'instances' | 'routes'>('instances')
/** 总览页是否允许轮询 */
const overviewActive = ref(false)
/** 首次扫描是否完成（用于稳定空状态，避免轮询时闪烁） */
const initialLoaded = ref(false)
/** 路由信息首次加载完成 */
const routesInitialLoaded = ref(false)
/** 手动刷新时的按钮 loading */
const manualRefreshing = ref(false)
/** 后台静默刷新中 */
const silentRefreshing = ref(false)
const instances = ref<CoreProcessInstance[]>([])
/** 各配置 cli route 合并后的全量路由 */
const cliRoutes = ref<EasyTierCliRoute[]>([])
/** 路由按配置筛选 */
const routeFilterConfig = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null
/** 防止 onMounted + onActivated 重复启动轮询 */
let loopStarted = false

/**
 * 展示用卡片数据：进程实例 + 状态缓存
 */
const cards = computed(() => {
  return instances.value.map((inst) => {
    const cache = easyTierStore.multiNetworkCache[inst.configFileName]
    const peers = cache?.peerInfo || []
    const remotePeers = peers.filter((p) => p.ipv4 && p.cost !== 'Local' && p.cost !== '本机')
    const p2pPeers = remotePeers.filter(
      (p) => p.cost === 'p2p' || p.cost === '直连' || String(p.cost).toLowerCase() === 'p2p'
    )
    return {
      ...inst,
      nodeInfo: cache?.nodeInfo || {},
      peerInfo: peers,
      peerCount: remotePeers.length,
      p2pCount: p2pPeers.length,
      localIp: cache?.nodeInfo?.ipv4_addr || '-',
      lastError: cache?.lastError,
      loading: cache?.loading,
      updatedAt: cache?.updatedAt
    }
  })
})

/**
 * 是否展示实例空状态
 */
const showEmpty = computed(() => initialLoaded.value && cards.value.length === 0)

/**
 * 筛选后的 cli 路由
 */
const filteredRoutes = computed(() => {
  if (!routeFilterConfig.value) return cliRoutes.value
  return cliRoutes.value.filter((r) => r.configFileName === routeFilterConfig.value)
})

/**
 * 筛选下拉选项
 */
const routeFilterOptions = computed(() => {
  const names = new Set<string>()
  cliRoutes.value.forEach((r) => {
    if (r.configFileName) names.add(r.configFileName)
  })
  instances.value.forEach((c) => names.add(c.configFileName))
  return Array.from(names)
})

/**
 * 路由空状态
 */
const showRoutesEmpty = computed(
  () => routesInitialLoaded.value && filteredRoutes.value.length === 0
)

/**
 * 格式化更新时间
 */
const formatUpdated = (ts?: number) => {
  if (!ts) return '-'
  return dayjs(ts).format('HH:mm:ss')
}

/**
 * 格式化延迟数值
 */
const formatLat = (v: any) => {
  if (v === undefined || v === null || v === '') return '-'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return n.toFixed(3)
}

/**
 * 比较实例列表是否实质变化
 */
const isSameInstanceList = (a: CoreProcessInstance[], b: CoreProcessInstance[]) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].pid !== b[i].pid ||
      a[i].configFileName !== b[i].configFileName ||
      a[i].rpcPortal !== b[i].rpcPortal ||
      a[i].fileName !== b[i].fileName
    ) {
      return false
    }
  }
  return true
}

/**
 * 比较 cli 路由列表是否实质变化
 */
const isSameCliRouteList = (a: EasyTierCliRoute[], b: EasyTierCliRoute[]) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].configFileName !== b[i].configFileName ||
      a[i].ipv4 !== b[i].ipv4 ||
      a[i].hostname !== b[i].hostname ||
      a[i].proxy_cidrs !== b[i].proxy_cidrs ||
      a[i].next_hop_ipv4 !== b[i].next_hop_ipv4 ||
      a[i].next_hop_hostname !== b[i].next_hop_hostname ||
      a[i].path_len !== b[i].path_len ||
      a[i].path_latency !== b[i].path_latency ||
      a[i].version !== b[i].version
    ) {
      return false
    }
  }
  return true
}

/**
 * 同步 runningList 到 store
 */
const syncRunningList = (list: CoreProcessInstance[]) => {
  const newList: RunningItem[] = list.map((item) => ({
    configFileName: item.configFileName,
    fileName: item.fileName,
    pid: item.pid,
    rpcPortal: item.rpcPortal,
    commandLine: item.commandLine
  }))
  easyTierStore.setRunningList(newList)
}

/**
 * 查询单个实例的 node / peer
 */
const fetchInstanceStatus = async (inst: CoreProcessInstance, silent = true) => {
  const key = inst.configFileName
  if (!silent) {
    easyTierStore.setNetworkStatusCache(key, { loading: true })
  }
  const portal = normalizeRpcPortal(inst.rpcPortal)
  try {
    const [nodeRes, peerRes] = await Promise.all([
      runEasyTierCli(['-p', portal, '--output', 'json', 'node']),
      runEasyTierCli(['-p', portal, '--output', 'json', 'peer'])
    ])
    if (nodeRes?.code === 403 || peerRes?.code === 403) {
      easyTierStore.setNetworkStatusCache(key, {
        loading: false,
        lastError: t('workplace.queryFailed')
      })
      return
    }
    const nodeInfo = safeJsonParse(nodeRes, {})
    let peerInfo = safeJsonParse(peerRes, [])
    if (!Array.isArray(peerInfo)) peerInfo = []
    peerInfo = peerInfo.map((value: any) => {
      const row = { ...value }
      if (row.ipv4 && String(row.ipv4).includes('/')) {
        row.ipv4 = String(row.ipv4).split('/')[0]
      }
      if (row.hostname && String(row.hostname).includes('PublicServer_')) {
        row.hostname = String(row.hostname).replace('PublicServer_', '')
        row.ipv4 = '服务器'
      }
      return row
    })
    easyTierStore.setNetworkStatusCache(key, {
      nodeInfo,
      peerInfo,
      loading: false,
      lastError: undefined,
      updatedAt: Date.now()
    })
  } catch (e) {
    error(`总览查询失败 ${key}: ${String(e)}`)
    easyTierStore.setNetworkStatusCache(key, {
      loading: false,
      lastError: t('workplace.queryFailed')
    })
  }
}

/**
 * 拉取单个实例的 cli route 全量数据
 * 命令: easytier-cli -p <rpc> -o json route
 */
const fetchInstanceRoutes = async (inst: CoreProcessInstance): Promise<EasyTierCliRoute[]> => {
  const portal = normalizeRpcPortal(inst.rpcPortal)
  try {
    // 兼容 -o 与 --output
    let res = await runEasyTierCli(['-p', portal, '-o', 'json', 'route'])
    if (!res || res?.code === 403) {
      res = await runEasyTierCli(['-p', portal, '--output', 'json', 'route'])
    }
    if (!res || res?.code === 403) return []
    const parsed = safeJsonParse(res, [])
    const rows = Array.isArray(parsed) ? parsed : []
    return rows.map((row: any) => ({
      ipv4: row.ipv4 ?? '',
      hostname: row.hostname ?? '',
      proxy_cidrs: row.proxy_cidrs ?? '',
      next_hop_ipv4: row.next_hop_ipv4 ?? '',
      next_hop_hostname: row.next_hop_hostname ?? '',
      next_hop_lat: row.next_hop_lat,
      path_len: row.path_len,
      path_latency: row.path_latency,
      next_hop_ipv4_lat_first: row.next_hop_ipv4_lat_first ?? '',
      next_hop_hostname_lat_first: row.next_hop_hostname_lat_first ?? '',
      path_len_lat_first: row.path_len_lat_first,
      path_latency_lat_first: row.path_latency_lat_first,
      version: row.version ?? '',
      configFileName: inst.configFileName
    }))
  } catch (e) {
    error(`拉取路由失败 ${inst.configFileName}: ${String(e)}`)
    return []
  }
}

/**
 * 刷新全部运行实例的 cli route
 */
const refreshCliRoutes = async (list?: CoreProcessInstance[]) => {
  const targets = list || instances.value
  try {
    if (targets.length === 0) {
      if (cliRoutes.value.length > 0) {
        cliRoutes.value = []
      }
      return
    }
    const parts = await Promise.all(targets.map((inst) => fetchInstanceRoutes(inst)))
    const merged = parts.flat()
    if (!isSameCliRouteList(cliRoutes.value, merged)) {
      cliRoutes.value = merged
    }
  } catch (e) {
    error(`刷新 cli 路由失败: ${String(e)}`)
  } finally {
    routesInitialLoaded.value = true
  }
}

/**
 * 刷新全部：运行实例 + cli route
 */
const refreshAll = async (options: { manual?: boolean; silent?: boolean } = {}) => {
  const manual = options.manual === true
  const silent = options.silent !== false

  if (!manual && silentRefreshing.value) return
  if (manual && manualRefreshing.value) return

  if (manual) {
    manualRefreshing.value = true
  } else {
    silentRefreshing.value = true
  }

  try {
    const list = await listRunningCoreInstances()
    if (!isSameInstanceList(instances.value, list)) {
      instances.value = list
    }
    syncRunningList(list)

    const keys = new Set(list.map((i) => i.configFileName))
    Object.keys(easyTierStore.multiNetworkCache).forEach((k) => {
      if (!keys.has(k)) {
        easyTierStore.removeNetworkStatusCache(k)
      }
    })

    // 并行：node/peer + route
    const tasks: Promise<any>[] = [refreshCliRoutes(list)]
    if (list.length > 0) {
      const fetchSilent = silent && initialLoaded.value && !manual
      tasks.push(...list.map((inst) => fetchInstanceStatus(inst, fetchSilent)))
    }
    await Promise.all(tasks)
  } catch (e) {
    error(`运行总览刷新失败: ${String(e)}`)
  } finally {
    initialLoaded.value = true
    routesInitialLoaded.value = true
    if (manual) {
      manualRefreshing.value = false
    } else {
      silentRefreshing.value = false
    }
  }
}

/**
 * 轮询调度
 */
const scheduleNext = () => {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  if (!overviewActive.value) return
  const interval = Math.max(2, easyTierStore.refreshInterval || 3) * 1000
  pollTimer = setTimeout(async () => {
    if (!overviewActive.value) return
    await refreshAll({ silent: true, manual: false })
    if (overviewActive.value) {
      scheduleNext()
    }
  }, interval)
}

/**
 * 启动总览轮询（幂等）
 */
const startOverviewLoop = async () => {
  overviewActive.value = true
  if (loopStarted) {
    await refreshAll({ silent: true, manual: false })
    return
  }
  loopStarted = true
  await refreshAll({ silent: false, manual: false })
  scheduleNext()
}

/**
 * 停止总览轮询
 */
const stopOverviewLoop = () => {
  overviewActive.value = false
  loopStarted = false
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

/**
 * 打开工作台并选中配置
 */
const openWorkbench = (inst: {
  configFileName: string
  fileName?: string
  pid?: number
  rpcPortal?: string
}) => {
  const cfg: RunningItem = {
    configFileName: inst.configFileName,
    fileName: inst.fileName || `${inst.configFileName}.toml`,
    pid: inst.pid,
    rpcPortal: inst.rpcPortal
  }
  easyTierStore.setPendingWorkbenchConfig(cfg)
  easyTierStore.setLastSelectedConfig(cfg)
  easyTierStore.setLastRunConfigName(cfg)
  info(`跳转工作台: ${inst.configFileName}`)
  router.push('/')
}

/**
 * 从路由表点击所属配置 → 打开工作台
 */
const openWorkbenchByConfigName = (configFileName?: string) => {
  if (!configFileName) return
  const inst = instances.value.find((i) => i.configFileName === configFileName)
  if (inst) {
    openWorkbench(inst)
    return
  }
  openWorkbench({ configFileName, fileName: `${configFileName}.toml` })
}

/**
 * 停止指定实例
 */
const stopInstance = async (inst: CoreProcessInstance) => {
  if (!inst.pid) {
    ElMessage.warning(t('easytier.stopping'))
    return
  }
  const ok = await killProcess(inst.pid)
  if (ok) {
    ElNotification({
      title: t('common.reminder'),
      message: t('common.accessSuccess'),
      type: 'success',
      duration: 2000
    })
    instances.value = instances.value.filter((i) => i.pid !== inst.pid)
    easyTierStore.removeNetworkStatusCache(inst.configFileName)
    await sleep(300)
    await refreshAll({ manual: true, silent: false })
  } else {
    ElMessage.error(t('workplace.queryFailed'))
  }
}

/**
 * 手动刷新
 */
const handleManualRefresh = async () => {
  await refreshAll({ manual: true, silent: false })
}

/** 切换到路由 Tab 时若尚未加载过，补一次 */
watch(activeTab, (tab) => {
  if (tab === 'routes' && !routesInitialLoaded.value) {
    refreshCliRoutes()
  }
})

onMounted(() => {
  startOverviewLoop()
})

onActivated(() => {
  startOverviewLoop()
})

onDeactivated(() => {
  stopOverviewLoop()
})

onUnmounted(() => {
  stopOverviewLoop()
})
</script>

<template>
  <div class="w-100% h-100% overflow-auto p-10px box-border">
    <ContentWrap>
      <div class="flex items-center justify-between mb-12px flex-wrap gap-10px">
        <div class="flex items-center gap-12px flex-wrap">
          <span class="text-16px font-600">{{ t('workplace.networkOverview') }}</span>
          <el-tag type="info" size="small"> {{ cards.length }} {{ t('easytier.running') }} </el-tag>
          <el-tag type="warning" size="small" effect="plain">
            {{ cliRoutes.length }} {{ t('workplace.tabSystemRoutes') }}
          </el-tag>
          <span class="text-12px text-[var(--el-text-color-secondary)]">
            {{ t('common.refresh') }} {{ easyTierStore.refreshInterval }}s
          </span>
        </div>
        <el-button type="primary" :loading="manualRefreshing" @click="handleManualRefresh">
          {{ t('workplace.refreshNow') }}
        </el-button>
      </div>

      <el-tabs v-model="activeTab" class="overview-tabs">
        <!-- 运行实例 -->
        <el-tab-pane :label="t('workplace.tabInstances')" name="instances">
          <div
            v-if="!initialLoaded"
            class="flex items-center justify-center min-h-220px text-14px text-[var(--el-text-color-secondary)]"
          >
            {{ t('common.loading') }}
          </div>

          <div
            v-else-if="showEmpty"
            class="flex flex-col items-center justify-center min-h-220px border-1px border-dashed border-[var(--el-border-color)] border-rd-8px bg-[var(--el-fill-color-blank)]"
          >
            <el-empty :description="t('workplace.noRunningInstance')" :image-size="96" />
            <div class="text-12px text-[var(--el-text-color-secondary)] -mt-10px mb-16px">
              {{ t('workplace.overviewEmptyHint') }}
            </div>
          </div>

          <div v-else class="flex flex-col gap-14px">
            <div
              v-for="card in cards"
              :key="card.configFileName"
              class="border-1px border-solid border-[var(--el-border-color-light)] border-rd-8px p-14px bg-[var(--el-bg-color-overlay)]"
            >
              <div class="flex items-start justify-between flex-wrap gap-10px mb-10px">
                <div class="flex flex-col gap-6px">
                  <div class="flex items-center gap-8px flex-wrap">
                    <span class="text-15px font-600">{{ card.configFileName }}</span>
                    <el-tag type="success" size="small" effect="dark">
                      {{ t('easytier.running') }}
                    </el-tag>
                    <el-tag v-if="card.loading" type="warning" size="small">loading</el-tag>
                    <el-tag v-if="card.lastError" type="danger" size="small">
                      {{ card.lastError }}
                    </el-tag>
                  </div>
                  <div
                    class="flex flex-wrap gap-12px text-13px text-[var(--el-text-color-regular)]"
                  >
                    <span>{{ t('workplace.pid') }}: {{ card.pid }}</span>
                    <span>{{ t('workplace.rpcPortal') }}: {{ card.rpcPortal || '-' }}</span>
                    <span>{{ t('workplace.localIp') }}: {{ card.localIp }}</span>
                    <span>{{ t('workplace.peerCount') }}: {{ card.peerCount }}</span>
                    <span>{{ t('workplace.p2pCount') }}: {{ card.p2pCount }}</span>
                    <span>
                      {{ t('workplace.lastUpdated') }}: {{ formatUpdated(card.updatedAt) }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-8px">
                  <el-button type="primary" size="small" @click="openWorkbench(card)">
                    {{ t('workplace.openWorkbench') }}
                  </el-button>
                  <el-button type="danger" size="small" plain @click="stopInstance(card)">
                    {{ t('easytier.stop') }}
                  </el-button>
                </div>
              </div>

              <el-table
                :data="card.peerInfo"
                size="small"
                stripe
                border
                max-height="260"
                table-layout="fixed"
                empty-text="-"
              >
                <el-table-column
                  prop="ipv4"
                  :label="t('easytier.ipv4Vir')"
                  width="130"
                  align="center"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="hostname"
                  :label="t('easytier.hostname')"
                  min-width="100"
                  align="center"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="cost"
                  :label="t('easytier.cost')"
                  width="90"
                  align="center"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="lat_ms"
                  :label="t('easytier.lat_ms')"
                  width="90"
                  align="center"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="tunnel_proto"
                  :label="t('easytier.tunnel_proto')"
                  width="100"
                  align="center"
                  show-overflow-tooltip
                />
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <!-- 路由信息：easytier-cli -o json route 全量字段 -->
        <el-tab-pane :label="t('workplace.tabSystemRoutes')" name="routes">
          <div class="mb-12px flex items-center justify-between flex-wrap gap-10px">
            <div class="text-13px text-[var(--el-text-color-secondary)] max-w-780px">
              {{ t('workplace.systemRoutesHint') }}
            </div>
            <div class="flex items-center gap-8px">
              <span class="text-13px text-[var(--el-text-color-regular)]">
                {{ t('workplace.filterByConfig') }}
              </span>
              <el-select
                v-model="routeFilterConfig"
                clearable
                :placeholder="t('workplace.allConfigs')"
                style="width: 180px"
                size="small"
              >
                <el-option :label="t('workplace.allConfigs')" value="" />
                <el-option
                  v-for="name in routeFilterOptions"
                  :key="name"
                  :label="name"
                  :value="name"
                />
              </el-select>
            </div>
          </div>

          <div
            v-if="!routesInitialLoaded"
            class="flex items-center justify-center min-h-220px text-14px text-[var(--el-text-color-secondary)]"
          >
            {{ t('common.loading') }}
          </div>

          <div
            v-else-if="showRoutesEmpty"
            class="flex flex-col items-center justify-center min-h-220px border-1px border-dashed border-[var(--el-border-color)] border-rd-8px bg-[var(--el-fill-color-blank)]"
          >
            <el-empty :description="t('workplace.noSystemRoutes')" :image-size="96" />
          </div>

          <el-table
            v-else
            :data="filteredRoutes"
            size="small"
            stripe
            border
            table-layout="fixed"
            max-height="62vh"
          >
            <el-table-column
              :label="t('workplace.ownedConfig')"
              width="120"
              align="center"
              fixed="left"
            >
              <template #default="{ row }">
                <el-tag
                  v-if="row.configFileName"
                  type="success"
                  size="small"
                  class="cursor-pointer"
                  @click="openWorkbenchByConfigName(row.configFileName)"
                >
                  {{ row.configFileName }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="ipv4"
              :label="t('workplace.routeIpv4')"
              min-width="130"
              align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="hostname"
              :label="t('workplace.routeHostname')"
              min-width="120"
              align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="proxy_cidrs"
              :label="t('workplace.proxyCidrs')"
              min-width="140"
              align="center"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-tag v-if="row.proxy_cidrs" type="warning" size="small">
                  {{ row.proxy_cidrs }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="next_hop_ipv4"
              :label="t('workplace.nextHopIpv4')"
              min-width="110"
              align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="next_hop_hostname"
              :label="t('workplace.nextHopHostname')"
              min-width="110"
              align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="next_hop_lat"
              :label="t('workplace.nextHopLat')"
              width="100"
              align="center"
            >
              <template #default="{ row }">
                {{ formatLat(row.next_hop_lat) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="path_len"
              :label="t('workplace.pathLen')"
              width="90"
              align="center"
            />
            <el-table-column
              prop="path_latency"
              :label="t('workplace.pathLatency')"
              width="90"
              align="center"
            />
            <el-table-column
              prop="next_hop_ipv4_lat_first"
              :label="t('workplace.nextHopIpv4LatFirst')"
              min-width="130"
              align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="next_hop_hostname_lat_first"
              :label="t('workplace.nextHopHostnameLatFirst')"
              min-width="140"
              align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="path_len_lat_first"
              :label="t('workplace.pathLenLatFirst')"
              width="120"
              align="center"
            />
            <el-table-column
              prop="path_latency_lat_first"
              :label="t('workplace.pathLatencyLatFirst')"
              width="120"
              align="center"
            />
            <el-table-column
              prop="version"
              :label="t('workplace.routeVersion')"
              min-width="140"
              align="center"
              show-overflow-tooltip
            />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </ContentWrap>
  </div>
</template>
