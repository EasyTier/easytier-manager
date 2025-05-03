<script setup lang="tsx">
import { ContentWrap } from '@/components/ContentWrap'
import {
  BIN_PATH,
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
import { downloadFile, extractFile, getLogsDir, getResourceDir, openPath } from '@/utils/fileUtil'
import { runEasyTierCli, stopAllNodes } from '@/utils/shellUtil'
import { getAppVersion, getArch, getOsType } from '@/utils/sysUtil'
import { appDataDir, appLogDir, join, resourceDir } from '@tauri-apps/api/path'
import { fetch } from '@tauri-apps/plugin-http'
import { useClipboard } from '@vueuse/core'
import { ElInput, ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { template ,cloneDeep} from 'lodash-es'
import { onMounted, reactive, ref, unref } from 'vue'

const { t } = useI18n()
const { clear: storageClear } = useStorage('localStorage')
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

const verSelect = ref<string>('v2.1.1')
const verOptions = ref(cloneDeep(DEFAULT_VER_OPTIONS))
const mirrorUrlSelect = ref<string>('')

const downLoadCore = async () => {
  for (let i = 0; i < GITHUB_MIRROR_URL.length; i++) {
    ElNotification({
      title: '下载中',
      message: `使用加速源${i + 1}下载`,
      type: 'info',
      duration: 8000
    })
    let url =
      GITHUB_MIRROR_URL[i].value +
      GITHUB_EASYTIER +
      GITHUB_DOWN_URL +
      '/' +
      verSelect.value +
      fileName.value
    const res = await downloadFile(url)
    if (res) {
      return
    } else {
      // 如果所有加速链接都下载失败，则尝试直接下载
      if (i === GITHUB_MIRROR_URL.length - 1) {
        url = GITHUB_EASYTIER + GITHUB_DOWN_URL + '/' + verSelect.value + fileName.value
        const res = await downloadFile(url)
        if (res) {
          return
        } else {
          ElMessageBox.confirm('所有下载链接下载失败，请手动下载！', {
            cancelButtonText: '取消',
            confirmButtonText: '手动下载',
            type: 'error',
            // 点击确定则打开Github下载页面
            callback: async (value) => {
              if (value === 'confirm') {
                await openPath(GITHUB_EASYTIER)
              }
            }
          })
        }
      }
    }
  }
}
const installCore = async () => {
  ElMessageBox.confirm('安装将会停止所有正在运行的节点，请确认是否继续', t('common.delWarning'), {
    confirmButtonText: '继续安装',
    cancelButtonText: t('common.delCancel'),
    type: 'warning'
  }).then(async () => {
    // 停止所有节点
    await stopAllNodes()
    const zipPath = await join(RESOURCE_PATH, fileName.value.replace('/', ''))
    await extractFile(zipPath, RESOURCE_PATH)
  })
}
const verSelectChange = (val: string) => {
  const winUrlTemplate = template(EASYTIER_NAME)
  fileName.value = winUrlTemplate({
    osType: getOsType(),
    osArch: getArch(),
    version: val
  })
  console.log(fileName.value)
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
const copyCorePath = async () => {
  // 拷贝
  const { copy, copied, isSupported } = useClipboard({
    source: await join(await resourceDir(), BIN_PATH),
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
const openCorePath = async () => {
  const resourcePath = await join(await resourceDir(), RESOURCE_PATH)
  await openPath(resourcePath)
}
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
      connectTimeout: 30000
    })
    data = await response.json()
  } catch {
    console.log('获取新版本失败');
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
  const ver = await runEasyTierCli(['-V'])
  if (ver && ver !== 403) {
    form.coreVersion = ver
  }
  form.corePath = await getResourceDir()
  form.logPath = await getLogsDir()
  form.logAppPath = await appLogDir()
  form.appVersion = await getAppVersion()
  verOptions.value = await easyTierStore.getCoreReleaseInfo()
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
  <div class="flex w-100% h-100%">
    <ContentWrap class="flex-[3] ml-10px" :title="t('common.setting')">
      <el-descriptions class="margin-top" :column="1" border>
        <el-descriptions-item>
          <template #label>
            <div class="cell-item">
              <Icon icon="ci:info" style="color: #8c8c8c" />
              {{ t('easytier.coreVersion') }}
            </div>
          </template>
          {{
            form.coreVersion
              ? form.coreVersion
              : '内核不存在!!! &nbsp;&nbsp;请下载安装内核，然后检测内核是否存在'
          }}
        </el-descriptions-item>
        <el-descriptions-item>
          <template #label>
            <div class="cell-item">
              <Icon icon="heroicons:folder-solid" style="color: #8c8c8c" />
              {{ t('easytier.corePath') }}
            </div>
          </template>
          {{ form.corePath }}
          <Icon v-if="checkCorePathSuccess" icon="lets-icons:check-fill" style="color: #00bd16" />
          <br />
          <el-button type="warning" @click="checkCorePath">{{ t('easytier.checkCorePath') }}
          </el-button>
          <el-button type="primary" @click="openCorePath">{{ t('easytier.openCorePath') }}
          </el-button>
          <el-button type="info" @click="copyCorePath">{{ t('easytier.copyCorePath') }}</el-button>
        </el-descriptions-item>

        <el-descriptions-item>
          <template #label>
            <div class="cell-item">
              <Icon icon="lsicon:download-outline" />
              {{ t('easytier.downLoadCore') }}
            </div>
          </template>
          1.选择版本时可以手动输入，对应官方内核仓库的版本，例如：v2.1.1<br />
          2.Github加速链接为空默认随机加速链接，下载视网络情况而定，一般30秒以内<br />
          3.下载完后点击安装，安装成功后检测内核是否存在<br />
          版本
          <el-select v-model="verSelect" filterable allow-create default-first-option :reserve-keyword="false"
            placeholder="选择版本" style="width: 120px" @change="verSelectChange">
            <el-option v-for="item in verOptions" :key="item.name" :label="item.name" :value="item.tag_name" />
          </el-select>
          &emsp;Github加速链接
          <el-input type="text" placeholder="例如:https://ghproxy.cn" v-model="mirrorUrlSelect"
            style="width: 45%; margin-left: 2px" clearable />
          <br />
          <el-button class="mt-2" type="primary" @click="downLoadCore">{{ t('easytier.rx_bytes') }}
          </el-button>
          <el-button class="mt-2" type="primary" @click="installCore">{{ t('easytier.installCore') }}
          </el-button>
        </el-descriptions-item>

        <el-descriptions-item>
          <template #label>
            <div class="cell-item">
              <Icon icon="icon-park-solid:log" />
              {{ t('easytier.logPath') }}
            </div>
          </template>
          {{ form.logPath }}<br />
          <el-button type="primary" @click="openLogPath">{{ t('easytier.openLogPath') }}</el-button>
          <br />
          <!--  {{ form.logAppPath }}<br />
                    <el-button type="primary" @click="openLogPath2"
                      >{{ t('easytier.openAppLogPath') }}
                    </el-button>-->
          <!-- <el-button type="info" @click="copyLogPath">{{ t('easytier.copyLogPath') }}</el-button> -->
        </el-descriptions-item>

        <!-- <el-descriptions-item>
          <template #label>
            <div class="cell-item">
              <Icon icon="icon-park-solid:log" />
              {{ t('easytier.appLogLevel') }}
            </div>
          </template>
          <el-select v-model="form.appLogLevel" style="width: 100px">
            <el-option label="信息" value="info" />
            <el-option label="警告" value="warn" />
            <el-option label="调试" value="debug" />
            <el-option label="错误" value="error" />
            <el-option label="关闭" :value="false" />
          </el-select>
          <el-button type="primary" @click="changeAppLogLevel" class="ml-3"
            >{{ t('formDemo.change') }}
          </el-button>
          当软件重启时会恢复默认
        </el-descriptions-item> -->

        <el-descriptions-item>
          <template #label>
            <div class="cell-item">
              <Icon icon="skill-icons:github-light" />
              {{ t('easytier.github') }}
            </div>
          </template>
          {{ t('easytier.githubManage') }} :
          <el-text type="primary"
            @click="openPath('https://github.com/xlc520/easytier-manager')">https://github.com/xlc520/easytier-manager
          </el-text>
          <br />
          {{ t('easytier.githubCore') }} :
          <el-text type="primary" @click="openPath('https://github.com/EasyTier/EasyTier')">
            https://github.com/EasyTier/EasyTier
          </el-text>
        </el-descriptions-item>

        <el-descriptions-item>
          <template #label>
            <div class="cell-item">
              <Icon icon="bi:window" />
              {{ t('easytier.otherSetting') }}
            </div>
          </template>
          <el-tooltip trigger="click" content="恢复窗口长宽大小" placement="top">
            <el-button type="info" @click="restoreWinState">{{ t('easytier.restoreWinState') }}
            </el-button>
          </el-tooltip>
          <el-tooltip trigger="click" content="遇事不决，清除缓存" placement="top">
            <el-button type="danger" @click="clearCache">{{ t('easytier.clearCache') }}</el-button>
          </el-tooltip>
          <el-button type="primary" @click="openPath('https://github.com/xlc520/easytier-manager/issues')">
            {{ t('easytier.feedback') }}
          </el-button>
        </el-descriptions-item>

        <el-descriptions-item>
          <template #label>
            <div class="cell-item">
              <Icon icon="uil:info-circle" />
              {{ t('easytier.appVersion') }}
            </div>
          </template>
          {{ form.appVersion }}
          <el-button class="ml-5" type="info" @click="checkUpdate">{{ t('easytier.checkUpdate') }}(简易版)
          </el-button>
        </el-descriptions-item>
      </el-descriptions>
    </ContentWrap>
  </div>
</template>

<style scoped lang="less">
.cell-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
