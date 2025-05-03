<script setup lang="tsx">
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import DefaultData from '@/constants/defaultData'
import { CONFIG_FILE_NAME, CONFIG_PATH } from '@/constants/easytier'
import { useI18n } from '@/hooks/web/useI18n'
import { useEasyTierStore } from '@/store/modules/easytier'
import { openPath, readFileContent, writeFileContent } from '@/utils/fileUtil'
import { getRunningProcesses, killProcess, runEasyTierCoreWeb } from '@/utils/shellUtil'
import { attachConsole } from '@tauri-apps/plugin-log'
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
  ElNotification({
    title: t('common.reminder'),
    message: t('common.accessSuccess'),
    type: 'success',
    duration: 2000
  })
  await readWebList()
  dialogVisible.value = false
}
const readWebList = async () => {
  const configFileTxt = (await readFileContent(CONFIG_PATH + '/' + CONFIG_FILE_NAME)) as string
  if (!configFileTxt) {
    return []
  }
  const configFileJson = JSON.parse(configFileTxt) || []
  let runList = await getRunningProcesses('config-server')
  configFileJson.forEach((item: any) => {
    let index = runList.findIndex((r: any) => r.pid.toString() === item.pid)
    if (index === -1) {
      item.status = '未运行'
    } else {
      item.status = '运行中'
    }
  })
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
      await readWebList()
    })
}
const runWeb = async (row: any) => {
  let url
  if (row.webStartMethod === 1) {
    url = row.userName
  } else {
    url = `udp://${row.host}:${row.port}/${row.userName}`
  }
  // 执行 命令 easytier-core --config-server udp://服务器IP:端口/用户名
  let pid = await runEasyTierCoreWeb(url)
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
  await readWebList()
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
    }).finally(async () => {
      await readWebList()
    })
}
const handleCellClick = (row: any) => {
  openPath(row.webUrl)
}
onMounted(async () => {
  // 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
  attachConsole()
  readWebList()
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="flex-[3] ml-10px">
      <div class="mb-10px">
        <el-button color="#4682B4" @click="addWebServerConfig" style="margin-left: 10px">
          {{ t('easytier.addWebServerConfig') }}
        </el-button>
        <BaseButton type="success" @click="readWebList">{{ t('common.refresh') }}</BaseButton>
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
          sortable
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
            <el-text v-if="row.status === '运行中'" type="success" effect="dark">
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
          sortable
        />
        <el-table-column
          prop="host"
          label="主机"
          header-align="center"
          align="center"
          show-overflow-tooltip
          sortable
        />
        <el-table-column
          prop="webUrl"
          label="控制台地址"
          header-align="center"
          align="center"
          show-overflow-tooltip
          sortable
        >
        <template #default="{row}">
        <!-- 绑定点击事件到内容 -->
        <span @click="handleCellClick(row)" style="color: blue;text-decoration: underline;">{{row.webUrl}}</span>
      </template>
      </el-table-column>
        <el-table-column label="操作" width="150" header-align="center" align="center">
          <template #default="{ row }">
            <el-button type="success" size="small" @click="runWeb(row)">
              {{ t('easytier.run') }}
            </el-button>
            <el-button type="warning" size="small" @click="stopWeb(row)">
              {{ t('easytier.stop') }}
            </el-button>
            <el-button type="primary" size="small" @click="editWeb(row)">
              {{ t('exampleDemo.edit') }}
            </el-button>
            <el-button type="danger" size="small" @click="delConfig(row)">
              {{ t('exampleDemo.del') }}
            </el-button>
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
