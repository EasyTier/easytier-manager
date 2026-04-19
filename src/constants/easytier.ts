/**
 * 配置目录
 */
export const CONFIG_PATH = 'config'
export const RESOURCE_PATH = 'resource'
export const LOG_PATH = 'logs'
export const NSSM_NAME = 'nssm'
/**
 * 配置文件名
 */
export const CONFIG_FILE_NAME = 'data.json'
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
export const COOKIE_VALUE = '83077fe7-9171-43f9-906a-f7b95096db66'
// export const MONITOR_LIST = 'https://easytier.linch.eu.org/api/getMonitorList'
export const MONITOR_LIST = 'https://uptime.easytier.cn/api/nodes?page=1&per_page=50'
export const CORE_INFO_API = 'https://api.github.com/repos/EasyTier/EasyTier/releases'
export const MANAGER_REPO_URL = 'https://github.com/xlc520/easytier-manager/releases'
export const MANAGER_INFO_API = 'https://api.github.com/repos/xlc520/easytier-manager/releases'
export const GITHUB_EASYTIER = 'https://github.com/EasyTier/EasyTier'
export const GITHUB_DOWN_URL = '/releases/download'
export const VERSION_PREFIX = 'v'
export const EASYTIER_NAME = '/easytier-<%= osType %>-<%= osArch %>-<%= version %>.zip'
export const PREFIX_SVC = 'easytier-'
export const PREFIX_SVC_WEB = 'easytierweb-'
export const STUN_SERVER_URL =
  'https://ghproxy.vip/https://gist.githubusercontent.com/mondain/b0ec1cf5f60ae726202e/raw/2d2b96b4508a38d342e0228d46eab84dad2398a3/public-stun-list.txt'
export const GITHUB_MIRROR_URL = [
  {
    value: 'https://wget.la/',
    label: 'https://wget.la/',
    latency: null
  },
  {
    value: 'https://gh-proxy.com/',
    label: 'https://gh-proxy.com/',
    latency: null
  },
  {
    value: 'https://gh.monlor.com/',
    label: 'https://gh.monlor.com/',
    latency: null
  },
  {
    value: 'https://gh-proxy.com/',
    label: 'https://gh-proxy.com/',
    latency: null
  },
  {
    value: 'https://github.boki.moe/',
    label: 'https://github.boki.moe/',
    latency: null
  },
  {
    value: 'https://ghfast.top/',
    label: 'https://ghfast.top/',
    latency: null
  },
  {
    value: 'https://gh-proxy.org/',
    label: 'https://gh-proxy.org/',
    latency: null
  },
  {
    value: 'https://ghproxy.net/',
    label: 'https://ghproxy.net/',
    latency: null
  },
  {
    value: 'https://ghproxy.vip/',
    label: 'https://ghproxy.vip/',
    latency: null
  },
  {
    value: 'https://down.npee.cn/',
    label: 'https://down.npee.cn/',
    latency: null
  },
  {
    value: 'https://fastgit.cc/',
    label: 'https://fastgit.cc/',
    latency: null
  },
  {
    value: 'https://ghproxy.1888866.xyz/',
    label: 'https://ghproxy.1888866.xyz/',
    latency: null
  }
]

export const DEFAULT_VER_OPTIONS = [
  {
    name: 'v2.6.0',
    tag_name: 'v2.6.0'
  },
  {
    name: 'v2.6.0',
    tag_name: 'v2.6.0'
  },
  {
    name: 'v2.4.5',
    tag_name: 'v2.4.5'
  }
]

export const DEFAULT_STUN_SERVER = [
  'stun.nas.net:3478',
  'stun.qq.com:3478',
  'stun.miwifi.com:3478',
  'stun.stunprotocol.org:3478'
]
