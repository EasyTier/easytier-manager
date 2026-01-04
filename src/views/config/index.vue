<script setup lang="tsx">
import { CodeEditor } from '@/components/CodeEditor'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import DefaultData from '@/constants/defaultData'
import { CONFIG_PATH, PREFIX_SVC } from '@/constants/easytier'
import { useI18n } from '@/hooks/web/useI18n'
import { useEasyTierStore } from '@/store/modules/easytier'
import type { EasyTierFormData } from '@/types/formTypes'
import {
  deleteFileOrDir,
  getLogsDir,
  listTomlFiles,
  readFileContent,
  writeFileContent
} from '@/utils/fileUtil'
import {
  checkServiceOnWindows,
  checkServiceWithOfficialCli,
  detectServiceInstallMethod,
  installServiceOnWindows,
  installServiceWithOfficialCli,
  runEasyTierCli,
  startServiceOnWindows,
  startServiceWithOfficialCli,
  stopServiceOnWindows,
  stopServiceWithOfficialCli,
  uninstallServiceOnWindows,
  uninstallServiceWithOfficialCli,
  buildCoreArgsWithLogConfig
} from '@/utils/shellUtil'
import {
  checkOfficialCliSupport,
  getServiceInstallConfig,
  saveServiceInstallConfig
} from '@/utils/serviceConfigUtil'
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
const formRef = ref()
const formData = ref<EasyTierFormData>(cloneDeep(DefaultData.defaultFormData))
const configFileName = ref<string | null>(null)
const errorMessage = ref('')
const logsDir = ref('')

// 服务安装对话框
const installServiceDialogVisible = ref(false)
const currentInstallRow = ref<any>(null)
const serviceInstallForm = ref({
  installMethod: 'nssm' as 'nssm' | 'official',
  description: '',
  displayName: '',
  enableAutostart: true
})

const checkServiceStatus = async () => {
  await sleep(1000)
  for (const item of easyTierStore.configList) {
    const serviceName = PREFIX_SVC + item.configFileName

    // 检测安装方式
    const installMethod = await detectServiceInstallMethod(serviceName)

    if (installMethod === 'nssm') {
      const status = await checkServiceOnWindows(serviceName)
      item.serviceStatus = serviceStatusDict(status as string | boolean)
      item.installMethod = 'nssm'
    } else if (installMethod === 'official') {
      const status = await checkServiceWithOfficialCli(serviceName)
      item.serviceStatus = serviceStatusDict(status as string | boolean)
      item.installMethod = 'official'
    } else {
      item.serviceStatus = '未安装'
      item.installMethod = 'none'
    }
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
  formData.value = parse as EasyTierFormData
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
  info(`准备安装服务:${JSON.stringify(row)}`)

  // 验证 CLI 可用性
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

  // 加载配置或使用默认值
  const savedConfig = getServiceInstallConfig(row.configFileName)
  serviceInstallForm.value = {
    installMethod: savedConfig.installMethod || easyTierStore.defaultServiceInstallMethod,
    description: savedConfig.description || `EasyTier 组网,服务配置:${row.configFileName}`,
    displayName: savedConfig.displayName || `EasyTier 组网 ${row.configFileName}`,
    enableAutostart: savedConfig.enableAutostart ?? easyTierStore.defaultEnableAutostart
  }

  currentInstallRow.value = row
  installServiceDialogVisible.value = true
}

const confirmInstallService = async () => {
  const row = currentInstallRow.value
  if (!row) return

  installServiceDialogVisible.value = false

  // 保存配置
  saveServiceInstallConfig(row.configFileName, serviceInstallForm.value)

  const configPath = await join(await resourceDir(), CONFIG_PATH, row.fileName)
  const serviceName = PREFIX_SVC + row.configFileName

  let result = false

  if (serviceInstallForm.value.installMethod === 'official') {
    // 检查官方 CLI 支持
    const supported = await checkOfficialCliSupport()
    if (!supported) {
      ElMessageBox.confirm(
        '当前版本不支持官方服务管理功能，是否使用 NSSM 方式安装？',
        t('common.reminder'),
        {
          confirmButtonText: t('common.ok'),
          cancelButtonText: t('common.cancel'),
          type: 'warning'
        }
      ).then(async () => {
        serviceInstallForm.value.installMethod = 'nssm'
        const args = await buildCoreArgsWithLogConfig(row.fileName, configPath)
        result = (await installServiceOnWindows(serviceName, args)) as boolean
        handleInstallResult(result)
      })
      return
    }

    result = (await installServiceWithOfficialCli(serviceName, configPath, row.fileName, {
      description: serviceInstallForm.value.description,
      displayName: serviceInstallForm.value.displayName,
      disableAutostart: !serviceInstallForm.value.enableAutostart
    })) as boolean
  } else {
    const args = await buildCoreArgsWithLogConfig(row.fileName, configPath)
    result = (await installServiceOnWindows(serviceName, args)) as boolean
  }

  handleInstallResult(result)
}

const handleInstallResult = (result: boolean) => {
  if (result) {
    ElNotification({
      title: t('common.reminder'),
      message: '服务安装成功',
      type: 'success',
      duration: 3000
    })
  } else {
    ElNotification({
      title: t('common.reminder'),
      message: '服务安装失败',
      type: 'error',
      duration: 3000
    })
  }
  getConfigList()
}

const uninstallServiceHandle = async (row: any) => {
  ElMessageBox.confirm(t('easytier.uninstallServiceMessage'), t('common.reminder'), {
    confirmButtonText: t('common.ok'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  }).then(async () => {
    const serviceName = PREFIX_SVC + row.configFileName
    const installMethod = await detectServiceInstallMethod(serviceName)

    let res = false
    if (installMethod === 'official') {
      res = (await uninstallServiceWithOfficialCli(serviceName)) as boolean
    } else {
      res = (await uninstallServiceOnWindows(serviceName)) as boolean
    }

    info(`卸载服务:${JSON.stringify(res)}`)
    if (res) {
      ElNotification({
        title: t('common.reminder'),
        message: '服务卸载成功',
        type: 'success',
        duration: 3000
      })
    }
    getConfigList()
  })
}
const startServiceHandle = async (row: any) => {
  const serviceName = PREFIX_SVC + row.configFileName
  const installMethod = await detectServiceInstallMethod(serviceName)

  let res = false
  if (installMethod === 'official') {
    res = (await startServiceWithOfficialCli(serviceName)) as boolean
  } else {
    res = (await startServiceOnWindows(serviceName)) as boolean
  }

  info(`启动服务:${JSON.stringify(res)}`)
  if (res) {
    ElNotification({
      title: t('common.reminder'),
      message: '服务启动成功',
      type: 'success',
      duration: 3000
    })
  } else {
    ElNotification({
      title: t('common.reminder'),
      message: '服务启动失败',
      type: 'error',
      duration: 3000
    })
  }
  getConfigList()
}
const stopServiceHandle = async (row: any) => {
  const serviceName = PREFIX_SVC + row.configFileName
  const installMethod = await detectServiceInstallMethod(serviceName)

  let res = false
  if (installMethod === 'official') {
    res = (await stopServiceWithOfficialCli(serviceName)) as boolean
  } else {
    res = (await stopServiceOnWindows(serviceName)) as boolean
  }

  info(`停止服务:${JSON.stringify(res)}`)
  ElNotification({
    title: t('common.reminder'),
    message: '服务停止可能需要等待 3-20 秒，请稍后刷新查看服务状态',
    type: 'info',
    duration: 6000
  })
  getConfigList()
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
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="flex-[3]">
      <div class="flex items-center justify-between gap-12px mb-15px">
        <div class="flex">
          <el-button-group>
            <el-button type="primary" @click="AddAction">
              <Icon icon="ep:plus" class="mr-4px" />
              {{ t('easytier.addNetConfig') }}
            </el-button>
            <el-button color="#48D1CC" @click="AddFormAction">
              <Icon icon="ep:document" class="mr-4px" />
              {{ t('easytier.addNetConfigForm') }}
            </el-button>
            <el-button type="info" @click="createServerConfig">
              <Icon icon="ep:set-up" class="mr-4px" />
              {{ t('easytier.createServerConfig') }}
            </el-button>
          </el-button-group>
        </div>
        <div class="flex">
          <el-button type="success" plain @click="refreshAction">
            <Icon icon="ep:refresh" class="mr-4px" />
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </div>

      <div>
        <el-text v-if="easyTierStore.os === 'windows'" type="info" effect="dark"
          >安装服务前检查程序尽量不要放在含有空格、中文路径的目录下；如果组网是由服务启动的，则只能使用启动服务和停止服务，无法使用首页的启动和停止
        </el-text>
      </div>

      <el-table
        :data="easyTierStore.configList"
        height="calc(100vh - 280px)"
        table-layout="fixed"
        empty-text="No Data"
        border
        stripe
        class="config-table"
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
        >
          <template #default="{ row }">
            <span class="font-600">{{ row.configFileName }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="serviceStatus"
          label="服务状态"
          header-align="center"
          align="center"
          width="120"
          v-if="easyTierStore.os === 'windows'"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.serviceStatus === '运行中'"
              type="success"
              effect="dark"
              round
              size="small"
            >
              {{ row.serviceStatus }}
            </el-tag>
            <el-tag
              v-else-if="row.serviceStatus === '停止'"
              type="info"
              effect="plain"
              round
              size="small"
            >
              {{ row.serviceStatus }}
            </el-tag>
            <el-tag v-else type="warning" effect="light" round size="small">
              {{ row.serviceStatus || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="配置管理" width="240" header-align="center" align="center">
          <template #default="{ row }">
            <div class="flex justify-center">
              <el-button type="primary" size="small" @click="edit(row)">
                <Icon icon="ep:edit" class="mr-2px" />
                {{ t('easytier.editNetConfig') }}
              </el-button>
              <el-button type="success" size="small" @click="editForm(row)">
                <Icon icon="ep:document" class="mr-2px" />
                {{ t('easytier.editNetConfigForm') }}
              </el-button>
              <el-button type="danger" size="small" @click="delConfig(row)">
                <Icon icon="ep:delete" class="mr-2px" />
                {{ t('exampleDemo.del') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          label="服务操作"
          width="150"
          header-align="center"
          align="center"
          v-if="easyTierStore.os === 'windows'"
        >
          <template #default="{ row }">
            <div class="flex flex-col gap-5px">
              <div class="flex justify-center gap-5px">
                <el-button
                  type="success"
                  size="small"
                  plain
                  @click="startServiceHandle(row)"
                  :disabled="row.serviceStatus === '运行中' || row.serviceStatus === '未安装'"
                >
                  启动
                </el-button>
                <el-button
                  type="warning"
                  size="small"
                  plain
                  @click="stopServiceHandle(row)"
                  :disabled="row.serviceStatus === '停止' || row.serviceStatus === '未安装'"
                >
                  停止
                </el-button>
              </div>
              <div class="flex justify-center gap-5px">
                <el-button
                  type="primary"
                  size="small"
                  link
                  @click="installServiceHandle(row)"
                  :disabled="row.serviceStatus !== '未安装'"
                >
                  安装服务
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  link
                  @click="uninstallServiceHandle(row)"
                  :disabled="row.serviceStatus === '未安装'"
                >
                  卸载服务
                </el-button>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-20px flex justify-end">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 30, 40, 50, 100]"
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
        />
      </div>
    </ContentWrap>

    <Dialog v-model="dialogVisible" :title="dialogTitle" width="80%" maxHeight="70vh">
      <div>
        <el-form-item
          label="配置名称"
          :validate-status="errorMessage ? 'error' : ''"
          :error="errorMessage"
        >
          <el-input
            v-model="configFileName"
            placeholder="请输入配置名称 (字母、数字、-、_)"
            style="width: 100%"
            :disabled="actionType === 'edit'"
            @blur="checkConfigFileName"
            @change="configFileNameChange"
            clearable
          >
            <template #prefix>
              <Icon icon="ep:collection-tag" />
            </template>
            <template #append>
              <el-tooltip content="将作为配置文件名和服务名" placement="top">
                <Icon icon="ep:info-filled" class="cursor-pointer" />
              </el-tooltip>
            </template>
          </el-input>
        </el-form-item>
      </div>

      <div class="dialog-content">
        <Form v-if="editType === 'form'" v-model:form-data="formData" ref="formRef" />
        <div
          class="edit-container h-60vh border-1px border-solid border-[var(--el-border-color)]"
          v-else
        >
          <CodeEditor
            ref="MonacoEditRef"
            v-model="dataConfig"
            language="toml"
            :languageSelector="false"
            :themeSelector="false"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center w-100%">
          <div class="text-12px text-[var(--el-text-color-secondary)]">
            <Icon icon="ep:info-filled" class="mr-4px" />
            部分字段点击名称或输入时会有提示
          </div>
          <div class="flex gap-10px">
            <el-button @click="dialogVisible = false">{{ t('dialogDemo.close') }}</el-button>
            <el-button
              v-if="actionType === 'add'"
              type="primary"
              :loading="saveLoading"
              @click="addConfigAction"
            >
              {{ t('exampleDemo.add') }}
            </el-button>
            <el-button
              v-if="actionType === 'edit'"
              type="primary"
              :loading="saveLoading"
              @click="saveConfigAction"
            >
              {{ t('exampleDemo.save') }}
            </el-button>
          </div>
        </div>
      </template>
    </Dialog>

    <!-- 服务安装配置对话框 -->
    <ElDialog
      v-model="installServiceDialogVisible"
      :title="
        t('easytier.installServiceDialogTitle', { configName: currentInstallRow?.configFileName })
      "
      width="600px"
    >
      <ElForm :model="serviceInstallForm" label-width="120px">
        <ElFormItem :label="t('easytier.serviceInstallMethod')">
          <ElRadioGroup v-model="serviceInstallForm.installMethod">
            <ElRadio label="nssm">{{ t('easytier.installMethodNssm') }}</ElRadio>
            <ElRadio label="official">{{ t('easytier.installMethodOfficial') }}</ElRadio>
          </ElRadioGroup>
        </ElFormItem>

        <template v-if="serviceInstallForm.installMethod === 'official'">
          <ElFormItem :label="t('easytier.serviceDisplayName')">
            <ElInput v-model="serviceInstallForm.displayName" />
          </ElFormItem>

          <ElFormItem :label="t('easytier.serviceDescription')">
            <ElInput v-model="serviceInstallForm.description" type="textarea" :rows="2" />
          </ElFormItem>

          <ElFormItem :label="t('easytier.serviceAutostart')">
            <ElSwitch v-model="serviceInstallForm.enableAutostart" />
          </ElFormItem>
          <el-text
            >注意：如果使用官方安装方法则无法识别多个配置文件，一旦安装成功，所有配置都会显示安装，暂时没有找到较好的解决方法</el-text
          >
        </template>
      </ElForm>

      <template #footer>
        <ElButton @click="installServiceDialogVisible = false">{{ t('common.cancel') }}</ElButton>
        <ElButton type="primary" @click="confirmInstallService">{{ t('common.ok') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style lang="less" scoped>
.config-table {
  :deep(.el-table__header) {
    th {
      font-weight: 700;
      background-color: var(--el-fill-color-light);
    }
  }
}
</style>
