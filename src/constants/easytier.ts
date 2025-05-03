/**
 * 配置目录
 */
export const CONFIG_PATH = 'config'
export const RESOURCE_PATH = 'resource'
export const LOG_PATH = 'logs'
export const BIN_PATH = 'bin'
export const NSSM_NAME = 'nssm'
/**
 * 配置文件名
 */
export const CONFIG_FILE_NAME = 'data.json'
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.95 Safari/537.36'
export const PROXY_URL = 'http://web-proxy.cheng.us.kg/'
export const COOKIE_VALUE = '83077fe7-9171-43f9-906a-f7b95096db66'
export const MONITOR_LIST = 'https://easytier.linch.eu.org/api/getMonitorList'
export const CORE_INFO_API = 'https://api.github.com/repos/EasyTier/EasyTier/releases'
export const MANAGER_REPO_URL = 'https://github.com/xlc520/easytier-manager/releases'
export const MANAGER_INFO_API = 'https://api.github.com/repos/xlc520/easytier-manager/releases'
export const GITHUB_EASYTIER = 'https://github.com/EasyTier/EasyTier'
export const GITHUB_DOWN_URL = '/releases/download'
export const VERSION_PREFIX = 'v'
export const EASYTIER_NAME = '/easytier-<%= osType %>-<%= osArch %>-<%= version %>.zip'

export const GITHUB_MIRROR_URL = [
  {
    value: 'https://gh-proxy.com/',
    label: 'https://gh-proxy.com/'
  },
  {
    value: 'https://ghproxy.cfd/',
    label: 'https://ghproxy.cfd/'
  },
  {
    value: 'https://ghproxy.net/',
    label: 'https://ghproxy.net/'
  },
  {
    value: 'https://github.boki.moe/',
    label: 'https://github.boki.moe/'
  },
  {
    value: 'https://ghproxy.1888866.xyz/',
    label: 'https://ghproxy.1888866.xyz/'
  },
  {
    value: 'https://hub.gitmirror.com/',
    label: 'https://hub.gitmirror.com/'
  }
]

export const DEFAULT_VER_OPTIONS = [
  {
    name: 'v2.2.4',
    tag_name: 'v2.2.4'
  },
  {
    name: 'v2.2.2',
    tag_name: 'v2.2.2'
  },
  {
    name: 'v1.2.3',
    tag_name: 'v1.2.3'
  }
]
