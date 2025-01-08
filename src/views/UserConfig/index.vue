<script setup lang="tsx">
import { ContentWrap } from '@/components/ContentWrap'
import { useI18n } from '@/hooks/web/useI18n'
import { onMounted, ref } from 'vue'
import { ElMessageBox, ElNotification } from 'element-plus'
import Form from './components/Form.vue'
import { Dialog } from '@/components/Dialog'
import { BaseButton } from '@/components/Button'
import { BIN_PATH, CONFIG_PATH, LOG_PATH } from '@/constants/easytier'
import * as toml from 'smol-toml'
import { useEasyTierStore } from '@/store/modules/easytier'
import log from '@/utils/logger'
import path from 'path'
import MonacoEditor from '@/components/monaco-editor'
import DefaultData from './components/defaultData'
import { cloneDeep } from 'lodash-es'
import {
  deleteFile,
  getFilesByExtension,
  getUserDataPath,
  readFile,
  writeFile
} from '@/utils/fileUtil'
import {
  checkServiceOnWindows,
  execCli,
  getSysInfo,
  installService,
  startServiceOnWindows,
  stopServiceOnWindows,
  uninstallService
} from '@/utils/execUtil'

const { t } = useI18n()
const easyTierStore = useEasyTierStore()
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const tableData = ref()
const MonacoEditRef = ref<InstanceType<typeof MonacoEditor>>()
const dataConfig = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('')
const actionType = ref('')
const editType = ref('')
const saveLoading = ref(false)
const formRef = ref()
const formData = ref<FormData>(cloneDeep(DefaultData.defaultFormData))
const configFileName = ref('')
const prefixSvc = 'easytier-'
const getConfigList = async () => {
  const fileList = await getFilesByExtension('config', '.toml')
  easyTierStore.setFileList(fileList)
  let tmpList: any = []
  let tmpList2: any = []
  for (const f of fileList) {
    const fileName = f.replace('.toml', '')
    let status = await checkServiceOnWindows(prefixSvc + fileName)
    tmpList.push({ configFileName: fileName, serviceStatus: serviceStatusDict(status) })
    tmpList2.push(fileName)
  }
  easyTierStore.setConfigList(tmpList)
  easyTierStore.setFileListNoSuffix(tmpList2)
  tableData.value = tmpList
  return tmpList
}
const serviceStatusDict = (status: string) => {
  if (!status) {
    return '未安装'
  }
  switch (status) {
    case 'SERVICE_STOPPED':
      return '停止'
    case 'SERVICE_RUNNING':
      return '运行中'
    case 'uninstalled':
      return '未安装'
    default:
      return '停止'
  }
}
const readFileData = async (fileName: string) => {
  dataConfig.value = await readFile(fileName)
}

const edit = async (row: any) => {
  dialogTitle.value = t('exampleDemo.edit')
  actionType.value = 'edit'
  editType.value = ''
  await readFileData(CONFIG_PATH + '/' + row?.configFileName + '.toml')
  configFileName.value = row?.configFileName
  dialogVisible.value = true
}

const editForm = async (row: any) => {
  dialogTitle.value = t('exampleDemo.edit')
  actionType.value = 'edit'
  editType.value = 'form'
  await readFileData(CONFIG_PATH + '/' + row.configFileName + '.toml')
  let parse = Object.assign({}, formData.value, toml.parse(dataConfig.value))
  formData.value = parse as FormData
  configFileName.value = row?.configFileName
  dialogVisible.value = true
}

const AddAction = () => {
  dialogTitle.value = t('easytier.addNetConfig')
  actionType.value = 'add'
  configFileName.value = ''
  editType.value = ''
  dataConfig.value = ''
  dialogVisible.value = true
}
const AddFormAction = () => {
  dialogTitle.value = t('easytier.addNetConfigForm')
  formData.value = cloneDeep(DefaultData.defaultFormData)
  configFileName.value = ''
  actionType.value = 'add'
  editType.value = 'form'
  dialogVisible.value = true
}
const refreshAction = async () => {
  await getConfigList()
}
const addConfigAction = async () => {
  // todo 如果已经存在文件名则提示
  if (!configFileName.value) {
    await ElMessageBox.alert('请指定配置名称(配置文件名)', { type: 'error' })
    return
  }
  if (editType.value === 'form') {
    // 验证必填 formRef
    if (!(await formRef.value.validateForm())) {
      return
    }
    saveLoading.value = true
    try {
      formData.value.file_logger.dir = path.join(await getUserDataPath(), LOG_PATH)
      formData.value.file_logger.file = configFileName.value
      if (
        formData.value.proxy_network?.length === 0 ||
        formData.value.proxy_network![0].cidr === undefined
      ) {
        formData.value.proxy_network = undefined
      }
      if (formData.value.peer?.length === 0 || formData.value.peer![0].uri === undefined) {
        formData.value.peer = undefined
      }
      if (formData.value.console_logger?.level === undefined) {
        formData.value.console_logger = undefined
      }
      await writeFile(
        CONFIG_PATH + '/' + configFileName.value + '.toml',
        toml.stringify(formData.value)
      )
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    } catch (error) {
      log.log('表单新增报错：' + error)
      ElNotification({
        title: t('common.reminder'),
        message: '表单新增报错',
        type: 'error',
        duration: 2000
      })
    } finally {
      configFileName.value = ''
      saveLoading.value = false
      dialogVisible.value = false
    }
  } else {
    try {
      saveLoading.value = true
      // @ts-ignore
      // @ts-nocheck
      let parseValue: EasyTierConfig = toml.parse(dataConfig.value)
      parseValue = {
        ...parseValue,
        file_logger: {
          level: parseValue.file_logger?.level ? parseValue.file_logger?.level : 'error',
          dir: path.join(await getUserDataPath(), LOG_PATH),
          file: configFileName.value
        }
      }
      await writeFile(
        CONFIG_PATH + '/' + configFileName.value + '.toml',
        toml.stringify(parseValue)
      )
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    } catch (error: any) {
      log.error('Error writing file:', error)
      ElNotification({
        title: t('common.reminder'),
        message: error.message,
        type: 'error',
        duration: 5000
      })
    } finally {
      configFileName.value = ''
      saveLoading.value = false
      dialogVisible.value = false
    }
  }
  await getConfigList()
}
const saveConfigAction = async () => {
  // todo 如果已经存在文件名则提示
  if (!configFileName.value) {
    await ElMessageBox.alert('请指定配置名称(配置文件名)', { type: 'error' })
    return
  }
  if (editType.value === 'form') {
    // 验证必填 formRef
    if (!(await formRef.value.validateForm())) {
      return
    }
    if (formData.value) {
      saveLoading.value = true
      try {
        formData.value.file_logger.dir = path.join(await getUserDataPath(), LOG_PATH)
        formData.value.file_logger.file = configFileName.value
        if (
          !formData.value.proxy_network ||
          formData.value.proxy_network?.length === 0 ||
          formData.value.proxy_network![0].cidr === undefined
        ) {
          formData.value.proxy_network = undefined
        }
        if (
          !formData.value.peer ||
          formData.value.peer?.length === 0 ||
          formData.value.peer![0].uri === undefined
        ) {
          formData.value.peer = undefined
        }
        if (!formData.value.console_logger || formData.value.console_logger?.level === undefined) {
          formData.value.console_logger = undefined
        }
        await writeFile(
          CONFIG_PATH + '/' + configFileName.value + '.toml',
          toml.stringify(formData.value)
        )
        ElNotification({
          title: t('common.reminder'),
          message: t('common.accessSuccess'),
          type: 'success',
          duration: 2000
        })
      } catch (error) {
        log.log('表单保存报错：' + error)
        ElNotification({
          title: t('common.reminder'),
          message: '表单保存报错',
          type: 'success',
          duration: 2000
        })
      } finally {
        configFileName.value = ''
        saveLoading.value = false
        dialogVisible.value = false
      }
    }
  } else {
    try {
      // @ts-ignore
      // @ts-nocheck
      let parseValue: EasyTierConfig = toml.parse(dataConfig.value)
      parseValue = {
        ...parseValue,
        file_logger: {
          level: parseValue.file_logger?.level ? parseValue.file_logger?.level : 'error',
          dir: path.join(await getUserDataPath(), LOG_PATH),
          file: configFileName.value
        }
      }
      await writeFile(
        CONFIG_PATH + '/' + configFileName.value + '.toml',
        toml.stringify(parseValue)
      )
      configFileName.value = ''
      dialogVisible.value = false
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    } catch (error: any) {
      log.error('Error writing file:', error.message)
      ElNotification({
        title: t('common.reminder'),
        message: error.message,
        type: 'error',
        duration: 5000
      })
    }
  }
  await getConfigList()
}
const delConfig = async (row?: any) => {
  ElMessageBox.confirm(t('common.delMessage'), t('common.delWarning'), {
    confirmButtonText: t('common.delOk'),
    cancelButtonText: t('common.delCancel'),
    type: 'warning'
  })
    .then(async () => {
      log.log('删除服务', row)
      await uninstallService(prefixSvc + row?.configFileName)
      log.log('删除配置', row)
      await deleteFile(CONFIG_PATH + '/' + row?.configFileName + '.toml')
      ElNotification({
        title: t('common.reminder'),
        message: t('common.delSuccess'),
        type: 'success',
        duration: 2000
      })
    })
    .finally(async () => {
      await getConfigList()
    })
}
const installServiceHandle = async (row: any) => {
  ElMessageBox.confirm(t('easytier.installServiceMessage'), t('common.reminder'), {
    confirmButtonText: t('common.ok'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  }).then(async () => {
    const res = await execCli('peer')
    if (res === 403) {
      ElNotification({
        title: t('common.reminder'),
        message:
          'easytier-core 或 easytier-cli 不存在或无可执行权限，请到设置页下载安装，或授予可执行权限',
        type: 'error',
        duration: 8000
      })
      return
    }
    const binPath = path.join(await getUserDataPath(), BIN_PATH, 'easytier-core')
    const configPath = path.join(await getUserDataPath(), CONFIG_PATH, row.configFileName + '.toml')
    installService(prefixSvc + row.configFileName, binPath, configPath)
      .then((res) => {
        log.info('res', res)
        if (res) {
          ElNotification({
            title: t('common.reminder'),
            message: '服务安装成功',
            type: 'success',
            duration: 3000
          })
        }
      })
      .finally(() => {
        getConfigList()
      })
  })
}

const uninstallServiceHandle = async (row: any) => {
  ElMessageBox.confirm(t('easytier.uninstallServiceMessage'), t('common.reminder'), {
    confirmButtonText: t('common.ok'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  })
    .then(async () => {
      await uninstallService(prefixSvc + row.configFileName)
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    })
    .finally(async () => await getConfigList())
}
const startServiceHandle = async (row: any) => {
  startServiceOnWindows(prefixSvc + row.configFileName)
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
    .finally(async () => await getConfigList())
}
const stopServiceHandle = async (row: any) => {
  stopServiceOnWindows(prefixSvc + row.configFileName)
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
        message: '服务停止失败 ' + e.message,
        type: 'error',
        duration: 8000
      })
    })
    .finally(async () => await getConfigList())
}
onMounted(async () => {
  await getConfigList()
  easyTierStore.setDefaultFormData(DefaultData.defaultFormData)
  let sysInfo = await getSysInfo()
  easyTierStore.setOs(sysInfo.osType)
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="flex-[3] ml-10px">
      <div class="mb-10px">
        <BaseButton type="primary" @click="AddAction">{{ t('easytier.addNetConfig') }}</BaseButton>
        <BaseButton type="primary" @click="AddFormAction"
          >{{ t('easytier.addNetConfigForm') }}
        </BaseButton>
        <BaseButton type="success" @click="refreshAction"
          >{{ t('easytier.reloadNetConfig') }}
        </BaseButton>
      </div>
      <el-table
        :data="tableData"
        height="55vh"
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
          label="网络名称"
          header-align="center"
          align="center"
          show-overflow-tooltip
          sortable
        />
        <el-table-column
          prop="serviceStatus"
          label="服务状态"
          header-align="center"
          align="center"
          show-overflow-tooltip
          sortable
        >
          <template #default="{ row }">
            <el-text v-if="row.serviceStatus === '运行中'" type="success" effect="dark">
              {{ row.serviceStatus }}
            </el-text>
            <el-text v-else-if="row.serviceStatus === '停止'" type="info" effect="dark">
              {{ row.serviceStatus }}
            </el-text>
            <el-text v-else>{{ row.serviceStatus }}</el-text>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" header-align="center" align="center">
          <template #default="{ row }">
            <BaseButton type="primary" size="small" @click="edit(row)">
              {{ t('easytier.editNetConfig') }}
            </BaseButton>
            <BaseButton type="primary" size="small" @click="editForm(row)">
              {{ t('easytier.editNetConfigForm') }}
            </BaseButton>
            <BaseButton type="danger" size="small" @click="delConfig(row)">
              {{ t('exampleDemo.del') }}
            </BaseButton>
          </template>
        </el-table-column>
        <el-table-column label="服务操作" width="240" header-align="center" align="center">
          <template #default="{ row }">
            <el-row justify="center" class="mb-1" v-if="easyTierStore.os === 'windows'">
              <BaseButton type="success" size="small" @click="startServiceHandle(row)">
                {{ t('easytier.startService') }}
              </BaseButton>
              <BaseButton type="warning" size="small" @click="stopServiceHandle(row)">
                {{ t('easytier.stopService') }}
              </BaseButton>
            </el-row>
            <el-row justify="center">
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
      <!--<Table
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :columns="allSchemas.tableColumns"
        :data="dataList"
        :loading="loading"
        @register="tableRegister"
        :pagination="{
          total
        }"
      />-->
    </ContentWrap>

    <Dialog v-model="dialogVisible" :title="dialogTitle" maxHeight="68vh">
      <div style="display: inline; text-align: center; justify-content: center">
        <el-form-item label="配置名称" prop="configFileName" class="ml-20 mr-10">
          <el-tooltip content="将作为配置文件名、服务名，最好使用字母、数字、-、_" placement="top">
            <Icon icon="memory:tooltip-start-alert" />
          </el-tooltip>
          <el-input
            v-model="configFileName"
            type="text"
            style="width: 80%"
            :disabled="actionType === 'edit' ? true : false"
            clearable
          />
        </el-form-item>
      </div>
      <Form v-if="editType === 'form'" :form-data="formData" ref="formRef" />
      <div class="edit-container h-60vh" v-if="editType !== 'form'">
        <MonacoEditor
          ref="MonacoEditRef"
          v-model="dataConfig"
          language="toml"
          :languageSelector="false"
          :themeSelector="false"
        />
      </div>
      <template #footer>
        <BaseButton
          v-if="actionType === 'add'"
          type="primary"
          :loading="saveLoading"
          @click="addConfigAction"
        >
          {{ t('exampleDemo.add') }}
        </BaseButton>
        <BaseButton
          v-if="actionType === 'edit'"
          type="primary"
          :loading="saveLoading"
          @click="saveConfigAction"
        >
          {{ t('exampleDemo.save') }}
        </BaseButton>
        <BaseButton @click="dialogVisible = false">{{ t('dialogDemo.close') }}</BaseButton>
      </template>
    </Dialog>
  </div>
</template>
<style lang="less">
.@{elNamespace}-dialog {
  --el-dialog-width: 70%;
}

.el-table__header {
  width: 100% !important;
  text-align: center;
}
</style>
