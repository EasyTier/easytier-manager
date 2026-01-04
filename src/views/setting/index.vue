<script setup lang="tsx">
import { ContentWrap } from '@/components/ContentWrap'
import {
  DEFAULT_VER_OPTIONS,
  EASYTIER_NAME,
  GITHUB_DOWN_URL,
  GITHUB_EASYTIER,
  GITHUB_MIRROR_URL,
  LOG_PATH,
  MANAGER_INFO_API,
  MANAGER_REPO_URL,
  RESOURCE_PATH,
  USER_AGENT
} from '@/constants/easytier'
import { useI18n } from '@/hooks/web/useI18n'
import { useStorage } from '@/hooks/web/useStorage'
import { useEasyTierStore } from '@/store/modules/easytier'
import {
  downloadFile,
  extractFile,
  getLogsDir,
  getResourceDir,
  listTomlFiles,
  openPath
} from '@/utils/fileUtil'
import { runEasyTierCli, stopAllNodes } from '@/utils/shellUtil'
import { getAppVersion, getArch, getOsType } from '@/utils/sysUtil'
import { appDataDir, appLogDir, join, resourceDir } from '@tauri-apps/api/path'
import { fetch } from '@tauri-apps/plugin-http'
import { useClipboard } from '@vueuse/core'
import {
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElNotification,
  ElOption,
  ElSelect
} from 'element-plus'
import { cloneDeep, template } from 'lodash-es'
import { onMounted, reactive, ref, unref } from 'vue'

const { t } = useI18n()
const { getStorage, setStorage, clear: storageClear } = useStorage('localStorage')

const minimizeOnStart = ref(false)
const autoRunNetwork = ref(false)
const autoRunConfigName = ref('')
const p2pNotify = ref(true)
const refreshInterval = ref(5)
const xshellPath = ref('')
const lockPassword = ref('')
const defaultServiceInstallMethod = ref<'nssm' | 'official'>('nssm')
const defaultEnableAutostart = ref(true)

const handleMinimizeChange = (value: boolean) => {
  setStorage('settings.minimizeOnStart', value.toString())
}

const handleAutoRunNetworkChange = (value: boolean) => {
  easyTierStore.setAutoRunNetworkSetting(value)
}

const handleAutoRunConfigChange = (value: string) => {
  easyTierStore.setAutoRunConfigName(value)
}

const handleP2pNotifyChange = (value: boolean) => {
  easyTierStore.setP2pNotifySetting(value)
}

const handleRefreshIntervalChange = (value: number) => {
  easyTierStore.refreshInterval = value
}

const handleXshellPathChange = (value: string) => {
  easyTierStore.xshellPath = value
}

const saveLockPassword = () => {
  easyTierStore.lockPassword = lockPassword.value
  ElMessage.success('锁定密码已保存')
}

const handleServiceInstallMethodChange = (value: 'nssm' | 'official') => {
  easyTierStore.setDefaultServiceInstallMethod(value)
}

const handleServiceAutostartChange = (value: boolean) => {
  easyTierStore.setDefaultEnableAutostart(value)
}

const easyTierStore = useEasyTierStore()
const fileName = ref('')
const checkCorePathSuccess = ref(false)
const form = reactive({
  corePath: '',
  coreVersion: '',
  logPath: '',
  logAppPath: '',
  appVersion: '',
  appLogLevel: ''
})

const verSelect = ref<string>('v2.4.5')
const verOptions = ref(cloneDeep(DEFAULT_VER_OPTIONS))
const mirrorUrlSelect = ref<string>('')

const downLoadCore = async () => {
  const mirrors = [...GITHUB_MIRROR_URL]
  if (mirrorUrlSelect.value) {
    mirrors.unshift({ label: '自定义', value: mirrorUrlSelect.value })
  }

  const maxRetriesPerMirror = 3
  for (let i = 0; i < mirrors.length; i++) {
    for (let attempt = 1; attempt <= maxRetriesPerMirror; attempt++) {
      const notification = ElNotification({
        title: '下载中',
        message: `使用加速源 ${mirrors[i].label} (尝试 ${attempt}/${maxRetriesPerMirror})...`,
        type: 'info',
        duration: 0
      })
      try {
        let baseUrl = mirrors[i].value
        if (!baseUrl.endsWith('/')) {
          baseUrl += '/'
        }
        const url =
          baseUrl + GITHUB_EASYTIER + GITHUB_DOWN_URL + '/' + verSelect.value + fileName.value
        const res = await downloadFile(url)
        if (res) {
          notification.close()
          ElNotification({
            title: '下载成功',
            message: '内核文件下载完成',
            type: 'success',
            duration: 3000
          })
          return
        }
      } catch (error) {
        console.error(`下载失败 (源 ${mirrors[i].label}, 尝试 ${attempt}):`, error)
      } finally {
        notification.close()
      }
      if (attempt < maxRetriesPerMirror) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // 如果所有镜像和重试都失败，则尝试直接从 GitHub 下载
  try {
    const notification = ElNotification({
      title: '下载中',
      message: '正在尝试从 GitHub 直接下载...',
      type: 'info',
      duration: 0
    })
    const url = GITHUB_EASYTIER + GITHUB_DOWN_URL + '/' + verSelect.value + fileName.value
    const res = await downloadFile(url)
    notification.close()
    if (res) {
      ElNotification({
        title: '下载成功',
        message: '内核文件下载完成',
        type: 'success',
        duration: 3000
      })
      return
    }
  } catch (error) {
    console.error('GitHub 直接下载失败:', error)
  }

  ElMessageBox.confirm('所有下载方式均失败，请检查网络连接或手动下载！', {
    cancelButtonText: '取消',
    confirmButtonText: '手动下载',
    type: 'error',
    callback: async (value) => {
      if (value === 'confirm') {
        await openPath(GITHUB_EASYTIER)
      }
    }
  })
}
const installCore = async () => {
  ElMessageBox.confirm('安装将会停止所有正在运行的节点，请确认是否继续', t('common.delWarning'), {
    confirmButtonText: '继续安装',
    cancelButtonText: t('common.delCancel'),
    type: 'warning'
  }).then(async () => {
    try {
      // 停止所有节点
      await stopAllNodes()
      const zipPath = await join(RESOURCE_PATH, fileName.value.replace('/', ''))
      await extractFile(zipPath, RESOURCE_PATH)
      ElNotification({
        title: '安装成功',
        message: '内核安装完成',
        type: 'success',
        duration: 3000
      })
    } catch (e: any) {
      console.error('安装失败:', e)
      ElNotification({
        title: '安装失败',
        message: `提取文件时发生错误: ${e.message || e}`,
        type: 'error',
        duration: 8000
      })
    }
  })
}
const verSelectChange = (val: string) => {
  const winUrlTemplate = template(EASYTIER_NAME)
  fileName.value = winUrlTemplate({
    osType: getOsType(),
    osArch: getArch(),
    version: val
  })
}

// 刷新版本列表
const verRefreshing = ref(false)
const handleRefreshVersions = async () => {
  verRefreshing.value = true
  try {
    const data = await easyTierStore.refreshCoreReleaseInfo()
    if (data && data.length > 0) {
      verOptions.value = data
      verSelect.value = data[0].tag_name
      verSelectChange(verSelect.value)
      ElMessage.success('版本列表已更新')
    }
  } catch (error) {
    ElMessage.error('获取版本列表失败')
  } finally {
    verRefreshing.value = false
  }
}

const checkCorePath = async () => {
  const res = await runEasyTierCli(['-V'])
  if (res && res !== 403) {
    form.coreVersion = res
    checkCorePathSuccess.value = true
  } else {
    form.coreVersion = ''
    checkCorePathSuccess.value = false
    ElNotification({
      title: t('common.reminder'),
      message: t('easytier.coreEror'),
      type: 'error',
      duration: 4000
    })
  }
}
const openConfigPath = async () => {
  const configPath = await join(await resourceDir(), 'config')
  await openPath(configPath)
}
const openCorePath = async () => {
  const resourcePath = await join(await resourceDir(), RESOURCE_PATH)
  await openPath(resourcePath)
}
// @ts-ignore
// @ts-nocheck
const copyLogPath = async () => {
  // 拷贝
  const { copy, copied, isSupported } = useClipboard({
    source: await join(await resourceDir(), LOG_PATH),
    legacy: true
  })
  if (!isSupported) {
    ElMessage.error(t('setting.copyFailed'))
  } else {
    await copy()
    if (unref(copied)) {
      ElMessage.success(t('setting.copySuccess'))
    }
  }
}
const openLogPath = async () => {
  const resourcePath = await join(await resourceDir(), LOG_PATH)
  await openPath(resourcePath)
}
// const openLogPath2 = async () => {
//   const resourcePath = await appLogDir()
//   await openPath(resourcePath)
// }
const restoreWinState = async () => {
  ElMessageBox.confirm(
    '要恢复窗口状态，需要退出软件后删除目录下的 .windowState.json 文件，重新启动软件',
    t('common.delWarning'),
    {
      confirmButtonText: '打开目录',
      cancelButtonText: t('common.delCancel'),
      type: 'warning'
    }
  ).then(async () => {
    await openPath(await appDataDir())
  })
}
const clearCache = async () => {
  storageClear()
  ElNotification({
    title: t('common.reminder'),
    message: '清除缓存成功',
    type: 'success',
    duration: 2000
  })
}
const checkUpdate = async () => {
  ElNotification({
    title: t('common.reminder'),
    message: '开始检测新版本',
    type: 'info',
    duration: 2000
  })
  let data, response
  try {
    response = await fetch(MANAGER_INFO_API, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      connectTimeout: 5000
    })
    data = await response.json()
  } catch {
    ElNotification({
      title: t('common.reminder'),
      message: '获取新版本失败',
      type: 'warning',
      duration: 2000
    })
    return
  }
  if (data && data.length > 0 && data[0].tag_name !== 'v' + form.appVersion) {
    ElMessageBox.confirm('是否去官网下载更新？', t('common.reminder'), {
      confirmButtonText: t('common.delOk'),
      cancelButtonText: t('common.delCancel'),
      type: 'warning'
    })
      .then(() => {
        openPath(MANAGER_REPO_URL)
      })
      .catch(() => {
        ElNotification({
          title: t('common.reminder'),
          message: t('common.accessError'),
          type: 'error',
          duration: 2000
        })
      })
  } else {
    ElNotification({
      title: t('common.reminder'),
      message: '暂无更新',
      type: 'warning',
      duration: 3000
    })
  }
}
// const changeAppLogLevel = async () => {
//   // await setLogLevel(form.appLogLevel)
// }

onMounted(async () => {
  // 加载配置列表，供自动运行选择使用
  if (easyTierStore.configList.length === 0) {
    try {
      const fileList = await listTomlFiles()
      const tmpList: any = []
      for (const f of fileList) {
        const configName = f.replace('.toml', '')
        tmpList.push({ configFileName: configName, fileName: f })
      }
      easyTierStore.setConfigList(tmpList)
    } catch (e) {
      console.error('获取配置异常', e)
    }
  }

  // init settings
  minimizeOnStart.value = getStorage('settings.minimizeOnStart') === 'true'
  autoRunNetwork.value = easyTierStore.autoRunNetworkSetting
  autoRunConfigName.value = easyTierStore.autoRunConfigName
  p2pNotify.value = easyTierStore.p2pNotifySetting
  refreshInterval.value = easyTierStore.refreshInterval
  xshellPath.value = easyTierStore.xshellPath
  lockPassword.value = easyTierStore.lockPassword
  defaultServiceInstallMethod.value = easyTierStore.defaultServiceInstallMethod
  defaultEnableAutostart.value = easyTierStore.defaultEnableAutostart

  const ver = await runEasyTierCli(['-V'])
  if (ver && ver !== 403) {
    form.coreVersion = ver
  }
  form.corePath = await getResourceDir()
  form.logPath = await getLogsDir()
  form.logAppPath = await appLogDir()
  form.appVersion = await getAppVersion()
  const newVar = await easyTierStore.getCoreReleaseInfo()
  if (newVar && newVar.length > 0) {
    verOptions.value = newVar
  }
  verSelect.value = verOptions.value[0].tag_name
  // form.appLogLevel = await getLogLevel()
  const winUrlTemplate = template(EASYTIER_NAME)
  // easytier-windows-x86_64-v2.0.3.zip
  // easytier-win32-x64-v2.0.3.zip
  fileName.value = winUrlTemplate({
    osType: getOsType(),
    osArch: getArch(),
    version: verSelect.value
  })
})
</script>

<template>
  <div class="setting-container p-20px h-100% overflow-y-auto">
    <ContentWrap :title="t('common.setting')">
      <!-- 核心信息 -->
      <el-card class="mb-20px shadow-sm">
        <template #header>
          <div class="flex items-center gap-8px font-600">
            <Icon icon="ep:info-filled" class="text-primary" />
            <span>核心程序信息</span>
          </div>
        </template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="内核版本">
            <template #default>
              <div class="flex items-center gap-10px">
                <el-tag :type="form.coreVersion ? 'success' : 'danger'" effect="light">
                  {{ form.coreVersion || '内核未安装' }}
                </el-tag>
                <el-button
                  v-if="!form.coreVersion"
                  type="primary"
                  size="small"
                  @click="checkCorePath"
                >
                  重新检测
                </el-button>
              </div>
            </template>
          </el-descriptions-item>
          <el-descriptions-item label="核心路径">
            <div class="flex flex-col gap-10px">
              <div class="flex items-center gap-5px text-13px text-[var(--el-text-color-regular)]">
                <Icon icon="heroicons:folder-solid" />
                <span>{{ form.corePath }}</span>
                <Icon
                  v-if="checkCorePathSuccess"
                  icon="lets-icons:check-fill"
                  class="text-success"
                />
              </div>
              <div class="flex gap-10px">
                <el-button type="primary" size="small" plain @click="openCorePath">
                  打开核心目录
                </el-button>
                <el-button type="info" size="small" plain @click="openConfigPath">
                  打开配置目录
                </el-button>
              </div>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 下载安装 -->
      <el-card class="mb-20px shadow-sm">
        <template #header>
          <div class="flex items-center gap-8px font-600">
            <Icon icon="ep:download" class="text-primary" />
            <span>内核下载与安装</span>
          </div>
        </template>
        <div class="flex flex-col gap-15px">
          <div class="text-13px text-[var(--el-text-color-secondary)] leading-22px">
            <p>1. 选择或输入官方内核仓库的版本 (如: v2.1.1)</p>
            <p>2. 加速链接为空时使用内置源，下载视网络情况而定</p>
            <p>3. 下载完成后点击安装，安装成功后检测内核是否存在</p>
          </div>
          <div class="flex items-center gap-15px flex-wrap">
            <div class="flex items-center gap-8px">
              <span class="text-14px">版本:</span>
              <el-select
                v-model="verSelect"
                filterable
                allow-create
                default-first-option
                placeholder="选择版本"
                style="width: 140px"
                @change="verSelectChange"
              >
                <el-option
                  v-for="item in verOptions"
                  :key="item.name"
                  :label="item.name"
                  :value="item.tag_name"
                />
              </el-select>
              <el-button
                :loading="verRefreshing"
                @click="handleRefreshVersions"
                title="获取最新版本列表"
              >
                <Icon icon="ep:refresh" class="mr-4px" />
                刷新
              </el-button>
            </div>
            <div class="flex items-center gap-8px flex-1 min-w-300px">
              <span class="text-14px">Github 加速链接:</span>
              <el-input
                v-model="mirrorUrlSelect"
                placeholder="例如: https://ghproxy.cn"
                clearable
                class="flex-1"
              />
            </div>
          </div>
          <div class="flex gap-10px">
            <el-button type="primary" @click="downLoadCore">
              <Icon icon="ep:download" class="mr-4px" />
              下载内核
            </el-button>
            <el-button type="success" @click="installCore">
              <Icon icon="ep:box" class="mr-4px" />
              安装内核
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- 启动与安全设置 -->
      <el-card class="mb-20px shadow-sm">
        <template #header>
          <div class="flex items-center gap-8px font-600">
            <Icon icon="ep:operation" class="text-primary" />
            <span>启动与安全设置</span>
          </div>
        </template>
        <el-form label-width="180px" label-position="left">
          <el-form-item label="启动后最小化到托盘">
            <el-switch v-model="minimizeOnStart" @change="handleMinimizeChange" />
            <span class="ml-10px text-12px text-[var(--el-text-color-secondary)]"
              >开启后，启动程序将自动隐藏到系统托盘</span
            >
          </el-form-item>
          <el-form-item label="启动后自动运行网络">
            <div class="flex flex-col gap-10px w-100%">
              <div class="flex items-center">
                <el-switch v-model="autoRunNetwork" @change="handleAutoRunNetworkChange" />
                <span class="ml-10px text-12px text-[var(--el-text-color-secondary)]"
                  >开启后，启动程序将自动运行指定的或上次的网络配置</span
                >
              </div>
              <div v-if="autoRunNetwork" class="flex items-center gap-10px">
                <span class="text-12px text-[var(--el-text-color-regular)]">指定运行配置:</span>
                <el-select
                  v-model="autoRunConfigName"
                  placeholder="默认运行上次配置"
                  clearable
                  style="width: 200px"
                  @change="handleAutoRunConfigChange"
                >
                  <el-option
                    v-for="item in easyTierStore.configList"
                    :key="item.configFileName"
                    :label="item.configFileName"
                    :value="item.configFileName"
                  />
                </el-select>
                <span class="text-12px text-[var(--el-text-color-secondary)]"
                  >留空则自动运行上次未停止的网络</span
                >
              </div>
            </div>
          </el-form-item>
          <el-form-item label="P2P打洞成功通知">
            <el-switch v-model="p2pNotify" @change="handleP2pNotifyChange" />
            <span class="ml-10px text-12px text-[var(--el-text-color-secondary)]"
              >是否显示 P2P 打洞成功的弹窗提醒</span
            >
          </el-form-item>
          <el-form-item label="工作台刷新频率">
            <el-input-number
              v-model="refreshInterval"
              :min="2"
              :max="60"
              @change="handleRefreshIntervalChange"
            />
            <span class="ml-10px text-12px text-[var(--el-text-color-secondary)]"
              >工作台节点列表刷新间隔（秒），最低2秒</span
            >
          </el-form-item>
          <el-form-item label="Xshell 路径">
            <el-input
              v-model="xshellPath"
              placeholder="例如: C:\Program Files (x86)\NetSarang\Xshell 7\Xshell.exe"
              clearable
              @change="handleXshellPathChange"
            />
            <span class="ml-10px text-12px text-[var(--el-text-color-secondary)]"
              >配置 Xshell 的完整执行路径，用于快速连接</span
            >
          </el-form-item>
          <el-form-item label="访问锁定密码">
            <div class="flex items-center gap-10px">
              <el-input
                v-model="lockPassword"
                placeholder="留空表示不锁定"
                show-password
                style="width: 220px"
              >
                <template #prefix>
                  <Icon icon="ep:lock" />
                </template>
              </el-input>
              <el-button type="primary" @click="saveLockPassword">保存</el-button>
              <span class="text-12px text-[var(--el-text-color-secondary)]"
                >设置后，打开程序需要输入此密码</span
              >
            </div>
          </el-form-item>

          <!-- 服务管理设置 -->
          <el-divider content-position="left">服务管理设置</el-divider>

          <el-form-item label="默认服务安装方式">
            <div class="flex flex-col gap-10px w-100%">
              <div class="flex items-center">
                <el-select
                  v-model="defaultServiceInstallMethod"
                  style="width: 280px"
                  @change="handleServiceInstallMethodChange"
                >
                  <el-option label="NSSM (推荐，兼容性好)" value="nssm" />
                  <el-option label="官方 easytier-cli (v1.2.0+)" value="official" />
                </el-select>
                <span class="ml-10px text-12px text-[var(--el-text-color-secondary)]"
                  >新配置安装服务时的默认方式</span
                >
              </div>
            </div>
          </el-form-item>

          <el-form-item label="默认开机自启动">
            <el-switch v-model="defaultEnableAutostart" @change="handleServiceAutostartChange" />
            <span class="ml-10px text-12px text-[var(--el-text-color-secondary)]"
              >安装服务时是否默认开机自启</span
            >
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 日志与维护 -->
      <el-card class="mb-20px shadow-sm">
        <template #header>
          <div class="flex items-center gap-8px font-600">
            <Icon icon="ep:tools" class="text-primary" />
            <span>日志与维护</span>
          </div>
        </template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="日志路径">
            <div class="flex flex-col gap-10px">
              <span class="text-13px text-[var(--el-text-color-regular)]">{{ form.logPath }}</span>
            </div>
            <el-button type="primary" size="small" plain @click="openLogPath">
              打开日志目录
            </el-button>
          </el-descriptions-item>
          <el-descriptions-item label="维护操作">
            <div class="flex gap-10px">
              <el-button type="info" size="small" @click="restoreWinState">
                恢复窗口大小
              </el-button>
              <el-button type="danger" size="small" @click="clearCache"> 清除所有缓存</el-button>
              <el-button type="primary" size="small" @click="checkUpdate"> 检查更新</el-button>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 关于 -->
      <el-card class="shadow-sm">
        <template #header>
          <div class="flex items-center gap-8px font-600">
            <Icon icon="ep:link" class="text-primary" />
            <span>关于与反馈</span>
          </div>
        </template>
        <div class="flex flex-col gap-10px text-14px">
          <div class="flex items-center gap-10px">
            <span class="font-600">软件版本:</span>
            <el-tag size="small">{{ form.appVersion }}</el-tag>
          </div>
          <div class="flex items-center gap-10px">
            <span class="font-600">管理端开源:</span>
            <el-link
              type="primary"
              :underline="false"
              @click="openPath('https://github.com/xlc520/easytier-manager')"
            >
              https://github.com/xlc520/easytier-manager
            </el-link>
          </div>
          <div class="flex items-center gap-10px">
            <span class="font-600">EasyTier 内核:</span>
            <el-link
              type="primary"
              :underline="false"
              @click="openPath('https://github.com/EasyTier/EasyTier')"
            >
              https://github.com/EasyTier/EasyTier
            </el-link>
          </div>
          <div class="mt-5px">
            <el-button
              type="primary"
              link
              @click="openPath('https://github.com/xlc520/easytier-manager/issues')"
            >
              提交反馈与建议
            </el-button>
          </div>
        </div>
      </el-card>
    </ContentWrap>
  </div>
</template>

<style scoped lang="less">
.setting-container {
  background-color: var(--el-fill-color-blank);

  :deep(.el-card__header) {
    padding: 12px 20px;
    background-color: var(--el-fill-color-light);
  }

  :deep(.el-descriptions__label) {
    width: 150px;
    font-weight: 600;
  }
}
</style>
