import type { ServiceInstallConfig } from '@/types/formTypes'
import { runEasyTierCli } from './shellUtil'

const SERVICE_CONFIG_PREFIX = 'service-config:'

/**
 * 获取服务安装配置
 */
export const getServiceInstallConfig = (configFileName: string): ServiceInstallConfig => {
  const stored = localStorage.getItem(SERVICE_CONFIG_PREFIX + configFileName)
  if (stored) {
    return JSON.parse(stored)
  }

  // 返回默认值
  return {
    password: '',
    username: '',
    installMethod: 'native', // 默认原生方式: NSSM(Win)/systemd(Linux)/launchd(macOS)
    enableAutostart: true
  }
}

/**
 * 保存服务安装配置
 */
export const saveServiceInstallConfig = (configFileName: string, config: ServiceInstallConfig) => {
  localStorage.setItem(SERVICE_CONFIG_PREFIX + configFileName, JSON.stringify(config))
}

/**
 * 检测官方 CLI 是否支持 service 命令
 */
export const checkOfficialCliSupport = async (): Promise<boolean> => {
  try {
    const res = await runEasyTierCli(['service', '--help'])
    return res !== 403 && !String(res).toLowerCase().includes('error')
  } catch {
    return false
  }
}
