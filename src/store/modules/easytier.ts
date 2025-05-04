import { CORE_INFO_API, DEFAULT_VER_OPTIONS, MONITOR_LIST, USER_AGENT } from '@/constants/easytier'
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
    // 启动直接报错提示
    const errRunNotify = ref(true)
    const defaultFormData = ref()
    const os = ref('windows')
    const releaseInfo = ref([])
    const publicPeerList = ref([])
    const defaultStatus = JSON.stringify({
      status: 'true',
      date: dayjs().format('YYYYMMDD').toString()
    })
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
    const getPublicPeerList = async () => {
      const localRes = JSON.parse(localStorage.getItem('publicPeerList') || '[]')
      const isGet = JSON.parse(localStorage.getItem('publicPeerListIsGet') || defaultStatus)
      const date = dayjs().format('YYYYMMDD').toString()
      if ((isGet.data !== date && isGet.status === 'false') || publicPeerList.value.length === 0) {
        let res, response
        try {
          response = await fetch(MONITOR_LIST, {
            method: 'GET',
            headers: { 'User-Agent': USER_AGENT },
            connectTimeout: 5000
          })
          res = await response.json()
        } catch {
          response = await fetch(MONITOR_LIST, {
            method: 'GET',
            headers: { 'User-Agent': USER_AGENT },
            connectTimeout: 5000
          })
          res = await response.json()
        }
        if (res && res.code === 0) {
          publicPeerList.value = res.data.list
          localStorage.setItem('publicPeerList', JSON.stringify(publicPeerList.value))
          localStorage.setItem(
            'publicPeerListIsGet',
            JSON.stringify({
              status: 'true',
              date
            })
          )
          return publicPeerList.value
        }
      }
      publicPeerList.value = localRes
      return publicPeerList.value
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
      defaultFormData,
      errRunNotify,
      os,
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
      setDefaultFormData,
      setErrRunNotify,
      setOs,
      setConfigPath,
      getCoreReleaseInfo,
      getPublicPeerList
    }
  },
  {
    persist: {
      key: 'easytier',
      storage: localStorage
    }
  }
)
