<script setup lang="tsx">
import { BaseButton } from '@/components/Button'
import { CodeEditor } from '@/components/CodeEditor'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import DefaultData from '@/constants/defaultData'
import { CONFIG_PATH, PREFIX_SVC } from '@/constants/easytier'
import { useI18n } from '@/hooks/web/useI18n'
import { useEasyTierStore } from '@/store/modules/easytier'
import {
  deleteFileOrDir,
  getLogsDir,
  listTomlFiles,
  readFileContent,
  writeFileContent
} from '@/utils/fileUtil'
import {
  checkServiceOnWindows,
  installServiceOnWindows,
  runEasyTierCli,
  startServiceOnWindows,
  stopServiceOnWindows,
  testWMIC,
  uninstallServiceOnWindows
} from '@/utils/shellUtil'
import { getHostname, getOsType, sleep } from '@/utils/sysUtil'
import { join, resourceDir } from '@tauri-apps/api/path'
import { attachConsole, error, info } from '@tauri-apps/plugin-log'
import { ElMessageBox, ElNotification } from 'element-plus'
import { cloneDeep } from 'lodash-es'
import * as toml from 'smol-toml'
import { onMounted, ref, watch } from 'vue'
import Form from './Form.vue'

const { t } = useI18n()
const easyTierStore = useEasyTierStore()
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const dataConfig = ref('')
const dialogVisible = ref(false)
// const quickDialogVisible = ref(false)
const dialogTitle = ref('')
const actionType = ref('')
const editType = ref('')
const saveLoading = ref(false)
const noWMIC = ref(false)
const formRef = ref()
const formData = ref<FormData>(cloneDeep(DefaultData.defaultFormData))
const configFileName = ref<string | null>(null)
const errorMessage = ref('')
const logsDir = ref('')

const checkServiceStatus = async () => {
  await sleep(1000)
  for (const item of easyTierStore.configList) {
    const status = await checkServiceOnWindows(PREFIX_SVC + item.configFileName)
    item.serviceStatus = serviceStatusDict(status)
  }
}
const getConfigList = async () => {
  const fileList = await listTomlFiles()
  const tmpList: any = []
  for (const f of fileList) {
    const configName = f.replace('.toml', '')
    tmpList.push({
      configFileName: configName,
      fileName: f
    })
  }
  easyTierStore.setConfigList(tmpList)
  checkServiceStatus()
}
const serviceStatusDict = (status: string | boolean) => {
  if (!status) {
    return '未安装'
  }
  switch (status) {
    case 'SERVICE_STOPPED':
      return '停止'
    case 'SERVICE_RUNNING':
      return '运行中'
    case 'SERVICE_STOP_PENDING':
      return '停止中'
    case 'uninstalled':
      return '未安装'
    default:
      return '未知'
  }
}
const readFileData = async (fileName: string) => {
  dataConfig.value = (await readFileContent(CONFIG_PATH + '/' + fileName)) as string
}

const edit = async (row: any) => {
  dialogTitle.value = t('exampleDemo.edit')
  actionType.value = 'edit'
  editType.value = ''
  await readFileData(row.fileName)
  configFileName.value = row?.configFileName
  dialogVisible.value = true
}

const editForm = async (row: any) => {
  dialogTitle.value = t('exampleDemo.edit')
  actionType.value = 'edit'
  editType.value = 'form'
  await readFileData(row.fileName)
  const parse = Object.assign({}, formData.value, toml.parse(dataConfig.value))
  formData.value = parse as FormData
  if (!formData.value.vpn_portal_config) {
    formData.value.vpn_portal_config = {}
    formData.value.vpn_portal_config.client_cidr = ''
    formData.value.vpn_portal_config.wireguard_listen = ''
  }
  if (!formData.value.port_forward) {
    formData.value.port_forward = []
  }
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
const AddFormAction = async () => {
  dialogTitle.value = t('easytier.addNetConfigForm')
  formData.value = cloneDeep(DefaultData.defaultFormData)
  formData.value.flags.proxy_forward_by_system = false
  formData.value.port_forward = []
  configFileName.value = await getHostname()
  actionType.value = 'add'
  editType.value = 'form'
  dialogVisible.value = true
}
const refreshAction = async () => {
  await getConfigList()
}
/* const quickAction = async () => {
  dialogTitle.value = t('easytier.quickAction')
  quickDialogVisible.value = true
} */
const checkConfigFileName = async () => {
  const findItem = easyTierStore.configList.find(
    (item) => item.configFileName === configFileName.value
  )
  if (findItem) {
    errorMessage.value = '配置文件名已存在'
    return true
  }
  errorMessage.value = ''
  return false
}
const configFileNameChange = async () => {
  formData.value.file_logger.file = configFileName.value
}
const addConfigAction = async () => {
  if (await checkConfigFileName()) {
    await ElMessageBox.alert('配置文件名已存在', { type: 'error' })
    return
  }
  if (!configFileName.value) {
    await ElMessageBox.alert('请指定配置名称(配置文件名)', { type: 'error' })
    return
  }
  if (editType.value === 'form') {
    // 验证必填 formRef
    if (formRef.value && !(await formRef.value.validateForm())) {
      return
    }
    saveLoading.value = true
    try {
      formData.value.file_logger.dir = formData.value.file_logger.dir
        ? formData.value.file_logger.dir
        : logsDir.value
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
      if (
        formData.value.vpn_portal_config?.client_cidr === '' ||
        formData.value.vpn_portal_config?.wireguard_listen === ''
      ) {
        formData.value.vpn_portal_config = undefined
      }
      await writeFileContent(
        CONFIG_PATH + '/' + configFileName.value + '.toml',
        toml.stringify(formData.value)
      )
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    } catch (e: any) {
      error(`表单新增报错：${JSON.stringify(e)}`)
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
          dir: parseValue.file_logger?.dir ? parseValue.file_logger?.dir : logsDir.value,
          file: configFileName.value
        }
      }
      await writeFileContent(CONFIG_PATH + '/' + configFileName.value + '.toml', dataConfig.value)
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    } catch (e: any) {
      error(`Error writing file:${JSON.stringify(e)}`)
      ElNotification({
        title: t('common.reminder'),
        message: JSON.stringify(e),
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
  if (editType.value === 'form') {
    // 验证必填 formRef
    if (!(await formRef.value.validateForm())) {
      return
    }
    if (formData.value) {
      saveLoading.value = true
      try {
        formData.value.file_logger.dir = formData.value.file_logger.dir
          ? formData.value.file_logger.dir
          : logsDir.value
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
        if (
          formData.value.vpn_portal_config.client_cidr === '' ||
          formData.value.vpn_portal_config.wireguard_listen === ''
        ) {
          formData.value.vpn_portal_config = undefined
        }
        await writeFileContent(
          CONFIG_PATH + '/' + configFileName.value + '.toml',
          toml.stringify(formData.value)
        )
        ElNotification({
          title: t('common.reminder'),
          message: t('common.accessSuccess'),
          type: 'success',
          duration: 2000
        })
      } catch (e: any) {
        error(`表单保存报错：${JSON.stringify(e)}`)
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
          dir: parseValue.file_logger?.dir ? parseValue.file_logger?.dir : logsDir.value,
          file: configFileName.value
        }
      }
      await writeFileContent(CONFIG_PATH + '/' + configFileName.value + '.toml', dataConfig.value)
      configFileName.value = ''
      dialogVisible.value = false
      ElNotification({
        title: t('common.reminder'),
        message: t('common.accessSuccess'),
        type: 'success',
        duration: 2000
      })
    } catch (e: any) {
      error(`Error writing file:${JSON.stringify(e)}`)
      ElNotification({
        title: t('common.reminder'),
        message: JSON.stringify(e),
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
      const serviceStatus = await checkServiceOnWindows(PREFIX_SVC + row?.configFileName)
      if (serviceStatus) {
        await uninstallServiceOnWindows(PREFIX_SVC + row?.configFileName)
      }
      await deleteFileOrDir(CONFIG_PATH + '/' + row?.fileName)
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
      await getConfigList()
    })
}
const installServiceHandle = async (row: any) => {
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
    const configPath = await join(await resourceDir(), CONFIG_PATH, row.fileName)
    installServiceOnWindows(PREFIX_SVC + row.configFileName, '-c ' + configPath)
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
      const res = await uninstallServiceOnWindows(PREFIX_SVC + row.configFileName)
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
    .finally(async () => await getConfigList())
}
const startServiceHandle = async (row: any) => {
  startServiceOnWindows(PREFIX_SVC + row.configFileName)
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
  ElNotification({
    title: t('common.reminder'),
    message: '开始停止服务，请稍后(可能需要等待3-20秒)，如果显示停止中，再点击停止按钮',
    type: 'warning',
    duration: 10000
  })
  stopServiceOnWindows(PREFIX_SVC + row.configFileName)
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
        message: '服务停止失败 ' + JSON.stringify(e),
        type: 'error',
        duration: 8000
      })
    })
    .finally(async () => await getConfigList())
}
const createServerConfig = async () => {
  formData.value = cloneDeep(DefaultData.defaultFormData)
  const hostname = await getHostname()
  configFileName.value = hostname + '_server'
  if (await checkConfigFileName()) {
    configFileName.value = hostname + '_server' + Math.floor(Math.random() * 100)
  }
  editType.value = 'form'
  formData.value.network_identity.network_name = 'default'
  formData.value.hostname = hostname + '_server'
  formData.value.instance_name = hostname + '_server'
  formData.value.listeners = [
    'tcp://0.0.0.0:11010',
    'udp://0.0.0.0:11010',
    'wg://0.0.0.0:11011',
    'ws://0.0.0.0:11011/',
    'wss://0.0.0.0:11012/'
  ]
  await addConfigAction()
  // quickDialogVisible.value = false
}

watch(configFileName, (value) => {
  formData.value.file_logger.file = value
})
onMounted(async () => {
  // 启用 TargetKind::Webview 后，这个函数将把日志打印到浏览器控制台
  attachConsole()
  getConfigList()
  logsDir.value = await getLogsDir()
  easyTierStore.setOs(await getOsType())
  noWMIC.value = !(await testWMIC())
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="flex-[3]">
      <div class="mb-10px">
        <el-button type="primary" @click="AddAction">{{ t('easytier.addNetConfig') }}</el-button>
        <el-button color="#48D1CC" @click="AddFormAction"
          >{{ t('easytier.addNetConfigForm') }}
        </el-button>
        <el-button type="info" @click="createServerConfig" style="margin-left: 10px">
          {{ t('easytier.createServerConfig') }}
        </el-button>
        <!-- <BaseButton type="info" @click="quickAction">{{ t('easytier.quickAction') }}</BaseButton> -->
        <BaseButton type="success" @click="refreshAction">{{ t('common.refresh') }}</BaseButton>
      </div>
      <el-text v-if="noWMIC" type="warning" effect="dark"
        >当前系统没有 wmic
        命令，建议安装服务，使用配置页面的服务启动停止组网，工作台的状态可能不准，或者忽略工作台的状态显示，只要表格有数据更新出来就是运行成功。<br
      /></el-text>
      <el-text v-if="easyTierStore.os === 'windows'" type="info" effect="dark"
        >安装服务前检查程序尽量不要放在含有空格、中文路径的目录下；如果组网是由服务启动的，则只能使用启动服务和停止服务，无法使用首页的启动和停止
      </el-text>
      <el-table
        :data="easyTierStore.configList"
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
          v-if="easyTierStore.os === 'windows'"
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
        <el-table-column label="操作" width="200" header-align="center" align="center">
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
        <el-table-column
          label="服务操作"
          width="240"
          header-align="center"
          align="center"
          v-if="easyTierStore.os === 'windows'"
        >
          <template #default="{ row }">
            <el-row justify="center" class="mb-1">
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
    </ContentWrap>

    <Dialog v-model="dialogVisible" :title="dialogTitle" maxHeight="68vh">
      <div style="display: inline; text-align: center; justify-content: center">
        <el-form-item
          label="配置名称"
          prop="configFileName"
          class="ml-20 mr-10"
          :validate-status="errorMessage ? 'error' : ''"
          :error="errorMessage"
        >
          <el-tooltip
            trigger="click"
            content="将作为配置文件名、服务名，最好使用字母、数字、-、_"
            placement="top"
          >
            <Icon icon="memory:tooltip-start-alert" />
          </el-tooltip>
          <el-input
            v-model="configFileName"
            type="text"
            style="width: 80%"
            :disabled="actionType === 'edit'"
            @blur="checkConfigFileName"
            @change="configFileNameChange"
            clearable
          />
        </el-form-item>
      </div>
      <Form v-if="editType === 'form'" v-model:form-data="formData" ref="formRef" />
      <div class="edit-container h-60vh" v-if="editType !== 'form'">
        <CodeEditor
          ref="MonacoEditRef"
          v-model="dataConfig"
          language="toml"
          :languageSelector="false"
          :themeSelector="false"
        />
      </div>
      <template #footer>
        <div style="text-align: left">
          <span style="font-size: 10px; color: gray">部分字段点击名称或者输入选择会有提示</span>
        </div>
        <!-- <el-text v-if="editType === 'form'">请注意：如果使用表单编辑，会导致注释丢失 </el-text> -->
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
    <!-- <Dialog v-model="quickDialogVisible" :title="dialogTitle">
      <div class="flex justify-center items-center">
        <el-button type="primary" size="large" @click="createServerConfig">{{
          t('easytier.createServerConfig')
        }}</el-button>
      </div>
    </Dialog> -->
  </div>
</template>
<style lang="less">
// .@{elNamespace}-dialog {
//   --el-dialog-width: 70%;
// }

.el-table__header {
  width: 100% !important;
  text-align: center;
}
</style>
