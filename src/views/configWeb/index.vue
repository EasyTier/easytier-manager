<script setup lang="tsx">
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import DefaultData from '@/constants/defaultData'
import { CONFIG_FILE_NAME, CONFIG_PATH, PREFIX_SVC_WEB } from '@/constants/easytier'
import { useI18n } from '@/hooks/web/useI18n'
import { useEasyTierStore } from '@/store/modules/easytier'
import type { FormWebData } from '@/types/formTypes'
import { openPath, readFileContent, writeFileContent } from '@/utils/fileUtil'
import {
  checkServiceOnWindows,
  getRunningProcesses,
  installServiceOnWindows,
  killProcess,
  runEasyTierCli,
  runEasyTierCoreWeb,
  startServiceOnWindows,
  stopServiceOnWindows,
  uninstallServiceOnWindows
} from '@/utils/shellUtil'
import { attachConsole, error, info } from '@tauri-apps/plugin-log'
import { ElMessageBox, ElNotification } from 'element-plus'
import { cloneDeep } from 'lodash-es'
import { onMounted, ref } from 'vue'
import FormWeb from './form-web.vue'

const { t } = useI18n()
const easyTierStore = useEasyTierStore()
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('')
const actionType = ref('')
const editType = ref('')
const saveLoading = ref(false)
const formWebRef = ref()
const formWebData = ref<FormWebData>(cloneDeep(DefaultData.defaultFormWebData))

const addWebServerConfig = async () => {
  dialogTitle.value = t('easytier.addWebServerConfig')
  formWebData.value = cloneDeep(DefaultData.defaultFormWebData)
  actionType.value = 'editWeb'
  editType.value = 'formWeb'
  dialogVisible.value = true
}
const editWeb = async (row: any) => {
  dialogTitle.value = t('exampleDemo.edit')
  actionType.value = 'editWeb'
  editType.value = 'formWeb'
  formWebData.value = row
  dialogVisible.value = true
}

const addOrUpdateWebConfigAction = async () => {
  if (formWebRef.value && !(await formWebRef.value.validateForm())) {
    return
  }
  // 读取已有配置
  const configFileTxt = (await readFileContent(CONFIG_PATH + '/' + CONFIG_FILE_NAME)) as string
  if (!configFileTxt) {
    await writeFileContent(
      CONFIG_PATH + '/' + CONFIG_FILE_NAME,
      JSON.stringify([formWebData.value]),
      { createNew: true }
    )
    ElNotification({
      title: t('common.reminder'),
      message: t('common.accessSuccess'),
      type: 'success',
      duration: 2000
    })
    return
  }
  const configFileJson = JSON.parse(configFileTxt) || []
  const findIndex = configFileJson.findIndex(
    (item: any) => item.configFileName === formWebData.value.configFileName
  )
  if (findIndex === -1) {
    configFileJson.push(formWebData.value)
  } else {
    configFileJson[findIndex] = formWebData.value
  }
  await writeFileContent(CONFIG_PATH + '/' + CONFIG_FILE_NAME, JSON.stringify(configFileJson))
  getWebList()
    .then(() => {
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    })
    .finally(() => {
      dialogVisible.value = false
    })
}
const serviceStatusDict = (status: string | boolean) => {
  switch (status) {
    case 'SERVICE_STOPPED':
      return '停止[服务]'
    case 'SERVICE_RUNNING':
      return '运行中[服务]'
    case 'SERVICE_STOP_PENDING':
      return '停止中[服务]'
    case 'uninstalled':
      return '未安装[服务]'
    default:
      return null
  }
}
const getWebList = async () => {
  const configFileTxt = (await readFileContent(CONFIG_PATH + '/' + CONFIG_FILE_NAME)) as string
  if (!configFileTxt) {
    easyTierStore.setConfigWebList([])
    return
  }
  const configFileJson = JSON.parse(configFileTxt) || []
  const runList = await getRunningProcesses('config-server')
  for (const item of configFileJson) {
    const index = runList.findIndex((r: any) => r.pid.toString() === item.pid)
    if (index === -1) {
      item.status = '未运行'
    } else {
      item.status = '运行中'
    }
    const status = await checkServiceOnWindows(PREFIX_SVC_WEB + item.configFileName)
    const serviceStatus = serviceStatusDict(status)
    if (serviceStatus) {
      item.status = serviceStatus
    }
  }
  easyTierStore.setConfigWebList(configFileJson)
  return configFileJson
}
const delConfig = async (row?: any) => {
  ElMessageBox.confirm(t('common.delMessage'), t('common.delWarning'), {
    confirmButtonText: t('common.delOk'),
    cancelButtonText: t('common.delCancel'),
    type: 'warning'
  })
    .then(async () => {
      const configFileTxt = (await readFileContent(CONFIG_PATH + '/' + CONFIG_FILE_NAME)) as string
      if (!configFileTxt) {
        // 删除失败
        ElNotification({
          title: t('common.reminder'),
          message: t('common.delError'),
          type: 'error',
          duration: 2000
        })
        return
      }
      const configFileJson = JSON.parse(configFileTxt) || []
      const findIndex = configFileJson.findIndex(
        (item: any) => item.configFileName === row.configFileName
      )
      // 删除 findIndex 对应的配置
      configFileJson.splice(findIndex, 1)
      await writeFileContent(CONFIG_PATH + '/' + CONFIG_FILE_NAME, JSON.stringify(configFileJson))
      ElNotification({
        title: t('common.reminder'),
        message: t('common.delSuccess'),
        type: 'success',
        duration: 2000
      })
    })
    .catch(async () => {
      ElNotification({
        title: t('common.reminder'),
        message: t('common.delError'),
        type: 'error',
        duration: 2000
      })
    })
    .finally(async () => {
      await getWebList()
    })
}
const runWeb = async (row: any) => {
  let url
  if (row.webStartMethod === 1) {
    url = row.userName
  } else {
    url = `${row.protocol}://${row.host}:${row.port}/${row.userName}`
  }
  // 执行 命令 easytier-core --config-server udp://服务器IP:端口/用户名
  const pid = await runEasyTierCoreWeb(url)
  easyTierStore.configWebList.forEach((item: any) => {
    if (item.configFileName === row.configFileName) {
      item.pid = pid
    }
  })
  await writeFileContent(
    CONFIG_PATH + '/' + CONFIG_FILE_NAME,
    JSON.stringify(easyTierStore.configWebList)
  )
  ElNotification({
    title: t('common.reminder'),
    message: t('common.accessSuccess'),
    type: 'success'
  })
  await getWebList()
}
const stopWeb = async (row: any) => {
  if (!row.pid) {
    ElNotification({
      title: t('common.reminder'),
      message: t('easytier.stopError'),
      type: 'error',
      duration: 2000
    })
    return
  }
  await killProcess(row.pid, true)
    .then(() => {
      ElNotification({
        title: t('common.reminder'),
        message: t('easytier.stopSuccess'),
        type: 'success'
      })
    })
    .catch(() => {
      ElNotification({
        title: t('common.reminder'),
        message: t('easytier.stopError'),
        type: 'error',
        duration: 2000
      })
    })
    .finally(async () => {
      await getWebList()
    })
}
const handleCellClick = (row: any) => {
  openPath(row.webUrl)
}
// ---------- 服务相关 -------------------
const installServiceHandle = async (row: FormWebData) => {
  info(`安装服务:${JSON.stringify(row)}`)
  ElMessageBox.confirm(t('easytier.installServiceMessage'), t('common.reminder'), {
    confirmButtonText: t('common.ok'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  }).then(async () => {
    const res = await runEasyTierCli(['-V'])
    if (res === 403) {
      ElNotification({
        title: t('common.reminder'),
        message:
          'easytier-core 或 easytier-cli 不存在或无可执行权限，请到设置页下载安装，或授予可执行权限',
        type: 'error',
        duration: 6000
      })
      return
    }
    // easytier-core.exe --config-server udp://你的IP地址:22020/你注册的账号名
    const args = `--config-server ${row.protocol}://${row.host}:${row.port}/${row.userName}`
    installServiceOnWindows(PREFIX_SVC_WEB + row.configFileName, args)
      .then((res) => {
        info(`服务安装:${JSON.stringify(res)}`)
        if (res) {
          ElNotification({
            title: t('common.reminder'),
            message: '服务安装成功',
            type: 'success',
            duration: 3000
          })
        }
      })
      .catch((e) => {
        error(`服务安装失败:${JSON.stringify(e)}`)
        ElNotification({
          title: t('common.reminder'),
          message: '服务安装失败',
          type: 'error',
          duration: 3000
        })
      })
      .finally(async () => {
        await getWebList()
      })
  })
}
const uninstallServiceHandle = async (row: FormWebData) => {
  ElMessageBox.confirm(t('easytier.uninstallServiceMessage'), t('common.reminder'), {
    confirmButtonText: t('common.ok'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  })
    .then(async () => {
      const res = await uninstallServiceOnWindows(PREFIX_SVC_WEB + row.configFileName)
      if (res) {
        ElNotification({
          title: t('common.reminder'),
          message: t('common.accessSuccess'),
          type: 'success',
          duration: 2000
        })
      } else {
        ElNotification({
          title: t('common.reminder'),
          message: '服务删除失败',
          type: 'error',
          duration: 2000
        })
      }
    })
    .finally(async () => await getWebList())
}
const startServiceHandle = async (row: FormWebData) => {
  startServiceOnWindows(PREFIX_SVC_WEB + row.configFileName)
    .then((res: any) => {
      if (res) {
        ElNotification({
          title: t('common.reminder'),
          message: '服务运行成功',
          type: 'success',
          duration: 2000
        })
        return
      }
      ElNotification({
        title: t('common.reminder'),
        message: '运行失败，未安装服务/配置文件错误/内核不存在',
        type: 'error',
        duration: 8000
      })
    })
    .catch(() => {
      ElNotification({
        title: t('common.reminder'),
        message: '运行失败，未安装服务/配置文件错误/内核不存在',
        type: 'error',
        duration: 8000
      })
    })
    .finally(async () => await getWebList())
}
const stopServiceHandle = async (row: FormWebData) => {
  ElNotification({
    title: t('common.reminder'),
    message: '开始停止服务，请稍后(可能需要等待3-20秒)，如果显示停止中，再点击停止按钮',
    type: 'warning',
    duration: 10000
  })
  stopServiceOnWindows(PREFIX_SVC_WEB + row.configFileName)
    .then((res: any) => {
      if (res) {
        ElNotification({
          title: t('common.reminder'),
          message: '服务停止成功',
          type: 'success',
          duration: 2000
        })
        return
      }
      ElNotification({
        title: t('common.reminder'),
        message: '服务停止失败',
        type: 'error',
        duration: 3000
      })
    })
    .catch((e) => {
      ElNotification({
        title: t('common.reminder'),
        message: `服务停止失败 ${JSON.stringify(e)}`,
        type: 'error',
        duration: 8000
      })
    })
    .finally(async () => await getWebList())
}
// ---------- 服务相关 结束-------------------

onMounted(async () => {
  // 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
  attachConsole()
  getWebList()
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="flex-[3]">
      <div class="mb-10px">
        <el-button color="#4682B4" @click="addWebServerConfig" style="margin-left: 10px">
          {{ t('easytier.addWebServerConfig') }}
        </el-button>
        <BaseButton type="success" @click="getWebList">{{ t('common.refresh') }}</BaseButton>
      </div>
      <el-table
        :data="easyTierStore.configWebList"
        height="60vh"
        table-layout="fixed"
        empty-text="No Data"
        border
        stripe
      >
        <el-table-column
          type="index"
          label="序号"
          :index="1"
          width="70"
          header-align="center"
          align="center"
        />
        <el-table-column
          prop="configFileName"
          label="配置名称"
          header-align="center"
          align="center"
          show-overflow-tooltip
        />
        <el-table-column
          prop="status"
          label="状态"
          header-align="center"
          align="center"
          show-overflow-tooltip
          sortable
        >
          <template #default="{ row }">
            <el-text
              v-if="row.status === '运行中' || row.status === '运行中[服务]'"
              type="success"
              effect="dark"
            >
              {{ row.status }}
            </el-text>
            <el-text v-else>{{ row.status }}</el-text>
          </template>
        </el-table-column>
        <el-table-column
          prop="userName"
          label="用户名"
          header-align="center"
          align="center"
          show-overflow-tooltip
        />
        <!--        <el-table-column
                  prop="protocol"
                  label="协议"
                  header-align="center"
                  align="center"
                  show-overflow-tooltip
                />-->
        <el-table-column
          prop="host"
          label="主机"
          header-align="center"
          align="center"
          show-overflow-tooltip
        />
        <el-table-column
          prop="webUrl"
          label="控制台地址"
          header-align="center"
          align="center"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <!-- 绑定点击事件到内容 -->
            <span @click="handleCellClick(row)" style="color: blue; text-decoration: underline">{{
              row.webUrl
            }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" header-align="center" align="center">
          <template #default="{ row }">
            <el-row :gutter="3" justify="center">
              <el-button type="success" size="small" @click="runWeb(row)">
                {{ t('easytier.run') }}
              </el-button>
              <el-button type="warning" size="small" @click="stopWeb(row)">
                {{ t('easytier.stop') }}
              </el-button>
            </el-row>
            <el-row :gutter="3" justify="center" style="margin-top: 5px">
              <el-button type="primary" size="small" @click="editWeb(row)">
                {{ t('exampleDemo.edit') }}
              </el-button>
              <el-button type="danger" size="small" @click="delConfig(row)">
                {{ t('exampleDemo.del') }}
              </el-button>
            </el-row>
          </template>
        </el-table-column>
        <el-table-column
          label="服务操作"
          width="180"
          header-align="center"
          align="center"
          v-if="easyTierStore.os === 'windows'"
        >
          <template #default="{ row }">
            <el-row :gutter="3" justify="center">
              <BaseButton type="success" size="small" @click="startServiceHandle(row)">
                {{ t('easytier.startService') }}
              </BaseButton>
              <BaseButton type="warning" size="small" @click="stopServiceHandle(row)">
                {{ t('easytier.stopService') }}
              </BaseButton>
            </el-row>
            <el-row :gutter="3" justify="center" style="margin-top: 5px">
              <BaseButton type="primary" size="small" @click="installServiceHandle(row)">
                {{ t('easytier.installService') }}
              </BaseButton>
              <BaseButton type="danger" size="small" @click="uninstallServiceHandle(row)">
                {{ t('easytier.uninstallService') }}
              </BaseButton>
            </el-row>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-3">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 30, 40, 50, 100]"
          :background="false"
          layout="sizes, prev, pager, next, jumper, ->, total"
          :total="total"
        />
      </div>
    </ContentWrap>

    <Dialog v-model="dialogVisible" :title="dialogTitle" maxHeight="68vh">
      <FormWeb :form-data="formWebData" ref="formWebRef" />
      <template #footer>
        <BaseButton
          v-if="actionType === 'editWeb'"
          type="primary"
          :loading="saveLoading"
          @click="addOrUpdateWebConfigAction"
        >
          {{ t('exampleDemo.save') }}
        </BaseButton>
        <BaseButton @click="dialogVisible = false">{{ t('dialogDemo.close') }}</BaseButton>
      </template>
    </Dialog>
  </div>
</template>
<style lang="less">
.el-table__header {
  width: 100% !important;
  text-align: center;
}
</style>
