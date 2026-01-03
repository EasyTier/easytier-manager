import {
  CORE_INFO_API,
  DEFAULT_STUN_SERVER,
  DEFAULT_VER_OPTIONS,
  MONITOR_LIST,
  PREFIX_SVC,
  STUN_SERVER_URL,
  USER_AGENT
} from '@/constants/easytier'
import { listTomlFiles } from '@/utils/fileUtil'
import { startServiceOnWindows } from '@/utils/shellUtil'
import { resourceDir } from '@tauri-apps/api/path'
import { fetch } from '@tauri-apps/plugin-http'
import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEasyTierStore = defineStore(
  'easytier',
  () => {
    const configPath = ref('resource')
    const configList = ref<RunningItem[]>([])
    const configWebList = ref<RunningWebItem[]>([])
    const fileList = ref([])
    const runningList = ref<RunningItem[]>([])
    const lastRunConfig = ref<RunningItem>()
    const allConfigOptions = ref([])
    // 带有文件后缀
    const fileListNoSuffix = ref([])
    const stopLoop = ref(false)
    const stopSetRoute = ref(false)
    // 是否 通知 全部节点建立 P2P 连接  true:通知  false:不同值
    const p2pNotify = ref(true)
    // P2P 通知设置 true:开启  false:关闭
    const p2pNotifySetting = ref(true)
    // 启动后自动运行网络 true:开启  false:关闭
    const autoRunNetworkSetting = ref(false)
    // 启动后自动运行的网络配置名称
    const autoRunConfigName = ref('')
    // 刷新频率（秒）
    const refreshInterval = ref(5)
    // 锁定密码
    const lockPassword = ref('')
    // 启动直接报错提示
    const errRunNotify = ref(true)
    const defaultFormData = ref()
    const os = ref('windows')
    const releaseInfo = ref([])
    const publicPeerList = ref([])
    const stunServerList = ref([])
    const defaultStatus = JSON.stringify({
      status: 'true',
      date: dayjs().format('YYYYMMDD').toString()
    })
    // 当前选择的列（存储prop值）
    const selectedColumns = ref(['rx_bytes', 'tx_bytes', 'nat_type'])
    // 默认服务安装方式
    const defaultServiceInstallMethod = ref<'nssm' | 'official'>('nssm')
    // 默认开机自启动
    const defaultEnableAutostart = ref(true)
    const setConfigList = (list) => {
      configList.value = list
    }
    const setConfigWebList = (list) => {
      configWebList.value = list
    }
    const setFileList = (list) => {
      fileList.value = list
    }
    const setFileListNoSuffix = (list) => {
      fileListNoSuffix.value = list
    }
    const loadRunningList = () => {
      const runningListStr = localStorage.getItem('runningList')
      runningList.value = JSON.parse(runningListStr || '[]')
    }
    const getRunningItem = (configFileName: string) => {
      return runningList.value.find((i) => i.configFileName === configFileName)
    }
    const setRunningList = (list: RunningItem[]) => {
      runningList.value = list
      localStorage.setItem('runningList', JSON.stringify(runningList.value))
    }
    const addRunningList = (configFileName: string, pid: number) => {
      runningList.value.push({ configFileName, pid })
      localStorage.setItem('runningList', JSON.stringify(runningList.value))
    }
    const removeRunningList = (configFileName: string) => {
      runningList.value = runningList.value.filter((i) => i.configFileName !== configFileName)
      localStorage.setItem('runningList', JSON.stringify(runningList.value))
    }
    const setLastRunConfigName = (config: any) => {
      lastRunConfig.value = config
      localStorage.setItem('lastRunConfigName', JSON.stringify(config))
    }
    const getLastRunConfigName = () => {
      if (lastRunConfig.value) {
        return lastRunConfig.value.configFileName
      }
      const storageConfigName = JSON.parse(localStorage.getItem('lastRunConfigName') || '{}')
      if (Object.keys(storageConfigName).length !== 0) {
        return storageConfigName
      }
      if (configList.value.length > 0) {
        return configList.value[0].configFileName
      }
      return ''
    }
    const setAllConfigOptions = (list) => {
      allConfigOptions.value = list
    }
    const setStopLoop = (flag) => {
      stopLoop.value = flag
    }
    const setP2pNotify = (flag) => {
      p2pNotify.value = flag
    }
    const setP2pNotifySetting = (flag) => {
      p2pNotifySetting.value = flag
    }
    const setAutoRunNetworkSetting = (flag) => {
      autoRunNetworkSetting.value = flag
    }
    const setAutoRunConfigName = (name) => {
      autoRunConfigName.value = name
    }
    const setDefaultFormData = (data) => {
      defaultFormData.value = data
    }
    const setErrRunNotify = (data) => {
      errRunNotify.value = data
    }
    const setOs = (data) => {
      os.value = data
    }
    const setConfigPath = async (path?: string) => {
      if (path) {
        configPath.value = path
        return
      }
      // 读取 resource 目录下的 config.json 文件，并返回 JSON 对象
      // const configJsonObj = await getConfigJsonObj()
      // if (configJsonObj.configPath) {
      //   configPath.value = configJsonObj.configPath
      //   return
      // }
      // 如果 configJsonObj 中存在 path 键，则设置 configPath 为 path 键的值，如果不存在则判断 path 是否为空，为空则设置为 resource 目录，否则设置为 path 键的值
      configPath.value = await resourceDir()
      // configJsonObj.configPath = RESOURCE_PATH
      // await writeConfigJsonObj(configJsonObj)
    }
    const getCoreReleaseInfo = async () => {
      const localRes = JSON.parse(localStorage.getItem('releaseInfo') || '[]')
      const isGet = JSON.parse(localStorage.getItem('releaseInfoIsGet') || defaultStatus)
      const date = dayjs().format('YYYYMMDD').toString()

      if ((isGet.data !== date && isGet.status === 'false') || releaseInfo.value.length === 0) {
        try {
          const response = await fetch(CORE_INFO_API, {
            method: 'GET',
            headers: { 'User-Agent': USER_AGENT },
            connectTimeout: 6000
          })
          releaseInfo.value = await response.json()
          // 如果成功获取到新数据，更新本地存储
          localStorage.setItem('releaseInfo', JSON.stringify(releaseInfo.value))
          localStorage.setItem(
            'releaseInfoIsGet',
            JSON.stringify({
              status: 'true',
              date
            })
          )
        } catch (error) {
          console.error('获取发布信息失败:', error)
          console.error('DEFAULT_VER_OPTIONS:', DEFAULT_VER_OPTIONS)
          releaseInfo.value = localRes.length > 0 ? localRes : DEFAULT_VER_OPTIONS
          return releaseInfo.value
        }
      } else {
        releaseInfo.value = localRes
      }

      return releaseInfo.value
    }

    // 强制刷新版本信息（供按钮调用）
    const refreshCoreReleaseInfo = async () => {
      try {
        const response = await fetch(CORE_INFO_API, {
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT },
          connectTimeout: 10000
        })
        releaseInfo.value = await response.json()
        const date = dayjs().format('YYYYMMDD').toString()
        localStorage.setItem('releaseInfo', JSON.stringify(releaseInfo.value))
        localStorage.setItem(
          'releaseInfoIsGet',
          JSON.stringify({
            status: 'true',
            date
          })
        )
        return releaseInfo.value
      } catch (error) {
        console.error('刷新版本信息失败:', error)
        return releaseInfo.value.length > 0 ? releaseInfo.value : DEFAULT_VER_OPTIONS
      }
    }

    const getPublicPeerList = async () => {
      const response = await fetch(MONITOR_LIST, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          accept: 'application/json, text/plain, */*',
          Referer: 'https://uptime.easytier.cn/'
        },
        connectTimeout: 10000
      })
      const res = await response.json()
      if (res && res.success) {
        publicPeerList.value = res.data.items
        localStorage.setItem('publicPeerList', JSON.stringify(publicPeerList.value))
        return publicPeerList.value
      }
      publicPeerList.value = JSON.parse(localStorage.getItem('publicPeerList') || '[]')
      return publicPeerList.value
    }
    const getStunServers = async () => {
      // 优先从缓存读取
      const cachedList = localStorage.getItem('stunServerList')
      if (cachedList) {
        try {
          const parsed = JSON.parse(cachedList)
          if (Array.isArray(parsed) && parsed.length > 0) {
            // @ts-ignore
            stunServerList.value = parsed
            // 后台静默更新（不阻塞返回）
            fetchStunServersFromApi()
            return stunServerList.value
          }
        } catch (e) {
          console.error('解析 STUN 缓存失败:', e)
        }
      }

      // 无缓存时，尝试从 API 获取
      await fetchStunServersFromApi()
      if (stunServerList.value.length === 0) {
        // @ts-ignore
        stunServerList.value = DEFAULT_STUN_SERVER
      }
      return stunServerList.value
    }

    // 从 API 获取 STUN 服务器列表
    const fetchStunServersFromApi = async () => {
      try {
        const response = await fetch(STUN_SERVER_URL, {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/plain'
          },
          connectTimeout: 10000
        })

        const res = await response.text()
        if (res && res.trim()) {
          const newList = res
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#'))

          if (newList.length > 0) {
            // @ts-ignore
            stunServerList.value = newList
            localStorage.setItem('stunServerList', JSON.stringify(newList))
            return newList
          }
        }
      } catch (error) {
        console.error('获取 STUN 服务器列表失败:', error)
      }
      return []
    }

    // 强制刷新 STUN 服务器列表（供按钮调用）
    const refreshStunServers = async () => {
      const result = await fetchStunServersFromApi()
      if (result.length === 0) {
        // 如果获取失败，使用默认列表
        // @ts-ignore
        stunServerList.value = DEFAULT_STUN_SERVER
      }
      return stunServerList.value
    }

    const setSelectedColumns = (list) => {
      selectedColumns.value = list
    }
    const setDefaultServiceInstallMethod = (method: 'nssm' | 'official') => {
      defaultServiceInstallMethod.value = method
    }
    const setDefaultEnableAutostart = (enable: boolean) => {
      defaultEnableAutostart.value = enable
    }
    const autorun = async () => {
      const autoRun = localStorage.getItem('settings.autoRun')
      if (autoRun === 'true') {
        const fileList = await listTomlFiles()
        for (const f of fileList) {
          const configName = f.replace('.toml', '')
          await startServiceOnWindows(PREFIX_SVC + configName)
        }
      }
    }
    return {
      configPath,
      configList,
      configWebList,
      fileList,
      fileListNoSuffix,
      runningList,
      allConfigOptions,
      lastRunConfig,
      stopLoop,
      stopSetRoute,
      p2pNotify,
      p2pNotifySetting,
      autoRunNetworkSetting,
      autoRunConfigName,
      refreshInterval,
      lockPassword,
      defaultFormData,
      errRunNotify,
      os,
      selectedColumns,
      defaultServiceInstallMethod,
      defaultEnableAutostart,
      setConfigList,
      setConfigWebList,
      setFileList,
      setFileListNoSuffix,
      loadRunningList,
      getRunningItem,
      setRunningList,
      addRunningList,
      removeRunningList,
      setAllConfigOptions,
      setLastRunConfigName,
      getLastRunConfigName,
      setStopLoop,
      setP2pNotify,
      setP2pNotifySetting,
      setAutoRunNetworkSetting,
      setAutoRunConfigName,
      setDefaultFormData,
      setErrRunNotify,
      setOs,
      setConfigPath,
      getCoreReleaseInfo,
      refreshCoreReleaseInfo,
      getPublicPeerList,
      getStunServers,
      refreshStunServers,
      setSelectedColumns,
      setDefaultServiceInstallMethod,
      setDefaultEnableAutostart,
      autorun
    }
  },
  {
    persist: {
      key: 'easytier',
      storage: localStorage
    }
  }
)
