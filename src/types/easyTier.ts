interface PeerInfo {
  cost: string
  hostname: string
  id: string
  ipv4: string
  lat_ms: string
  loss_rate: string
  nat_type: string
  rx_bytes: string
  tunnel_proto: string
  tx_bytes: string
  version: string
  delayColor: string
}

interface NetworkIdentity {
  network_name: string
  network_secret: string
  network_secret_digest: string
}

interface PeerConfig {
  uri: string
}

interface NetworkConfig {
  cidr: string
  allow: string[]
}

interface FileLoggerConfig {
  level: string | null
  file: string | null
  dir: string | null
  size?: number // 单个日志文件大小，单位 MB，默认 100
  count?: number // 最大日志文件数量，默认 10
}

interface ConsoleLoggerConfig {
  level: string | null
}

interface VpnPortalConfig {
  client_cidr: string
  wireguard_listen: string
}

interface Flags {
  default_protocol: string
  dev_name: string
  enable_encryption: boolean
  encryption_algorithm?: string // 加密算法
  mtu?: number // MTU 大小
  latency_first: boolean
  enable_exit_node: boolean
  no_tun: boolean
  use_smoltcp: boolean
  foreign_network_whitelist: string
  disable_p2p: boolean
  relay_all_peer_rpc: boolean
  disable_udp_hole_punching: boolean
  disable_tcp_hole_punching?: boolean // 禁用 TCP 打洞
  disable_sym_hole_punching?: boolean // 禁用对称 NAT 打洞
  multi_thread?: boolean // 多线程
  multi_thread_count?: number // 线程数
  disable_ipv6?: boolean // 禁用 IPv6
  enable_kcp_proxy?: boolean // 启用 KCP 代理
  enable_quic_proxy?: boolean // 启用 QUIC 代理
  disable_quic_input?: boolean // 禁用 QUIC 输入
  foreign_relay_bps_limit?: number // 外部中继带宽限制
  instance_recv_bps_limit?: number // 实例入站带宽限制
  p2p_only?: boolean // 仅 P2P
  lazy_p2p?: boolean // 按需建立 P2P
  need_p2p?: boolean // 声明需要主动 P2P
  disable_upnp?: boolean // 禁用 UPnP/NAT-PMP 映射
  no_listener?: boolean // 不监听任何端口
  ipv6_public_addr_provider?: boolean // 共享公网 IPv6 子网
  ipv6_public_addr_auto?: boolean // 自动获取公网 IPv6 地址
  ipv6_public_addr_prefix?: string // 手动指定公网 IPv6 子网
  enable_udp_broadcast_relay?: boolean // 启用 UDP 广播中继
  secure_mode?: boolean // 启用安全模式
  disable_relay_kcp?: boolean // 禁止转发 KCP 数据包
  disable_relay_quic?: boolean // 禁止转发 QUIC 数据包
  enable_relay_foreign_network_kcp?: boolean // 允许转发外部网络 KCP
  enable_relay_foreign_network_quic?: boolean // 允许转发外部网络 QUIC
  tld_dns_zone?: string // TLD DNS 区域
  ipv6_listener: string
}

interface EasyTierConfig {
  netns: string
  hostname: string
  instance_name: string
  instance_id: string
  machine_id?: string // 机器 ID
  ipv4: string
  ipv6?: string // IPv6 地址
  dhcp: boolean
  network_identity: NetworkIdentity
  listeners: string
  exit_nodes: string[]
  external_node?: string // 外部节点
  config_exit_nodes_route: boolean
  clear_log_on_run?: boolean
  peer: PeerConfig[]
  proxy_network: NetworkConfig[]
  file_logger: FileLoggerConfig
  console_logger: ConsoleLoggerConfig
  rpc_portal: string
  rpc_portal_whitelist?: string[] // RPC 门户白名单
  vpn_portal_config: VpnPortalConfig
  routes: string[]
  socks5_proxy: string
  local_private_key?: string // 安全模式本地私钥
  local_public_key?: string // 安全模式本地公钥
  credential?: string // 临时入网凭据
  credential_file?: string // 凭据存储文件路径
  tcp_whitelist?: string // TCP 白名单
  udp_whitelist?: string // UDP 白名单
  stun_server: string[] // STUN 服务器列表（保留兼容）
  stun_servers?: string[] // STUN 服务器列表
  stun_servers_v6?: string[] // IPv6 STUN 服务器列表
  flags: Flags
  flags_struct: Flags
}

interface SysInfo {
  osType: string
  osArch: string
  osVersion: string
}

interface GithubVer {
  id: number
  tag_name: string
  name: string
  prerelease: boolean
  created_at: string
  published_at: string
}

interface RunningItem {
  configFileName: string
  fileName?: string
  pid?: number
  serviceStatus?: string
  installMethod?: 'nssm' | 'official' | 'none' // 服务安装方式
  /** RPC 门户地址，如 127.0.0.1:15888 */
  rpcPortal?: string
  /** 完整命令行（用于多实例识别） */
  commandLine?: string
}

/** 从 easytier-core 进程命令行解析出的运行实例 */
interface CoreProcessInstance {
  pid: number
  configFileName: string
  fileName: string
  configPath?: string
  rpcPortal?: string
  commandLine: string
  memory?: number
  path?: string
}

/** 运行总览中单个配置的状态缓存 */
interface NetworkStatusCache {
  nodeInfo: any
  peerInfo: PeerInfo[]
  lastError?: string
  updatedAt?: number
  loading?: boolean
}

/** easytier-cli route 单条记录（-o json route） */
interface EasyTierCliRoute {
  ipv4?: string
  hostname?: string
  proxy_cidrs?: string
  next_hop_ipv4?: string
  next_hop_hostname?: string
  next_hop_lat?: number
  path_len?: number
  path_latency?: number
  next_hop_ipv4_lat_first?: string
  next_hop_hostname_lat_first?: string
  path_len_lat_first?: number
  path_latency_lat_first?: number
  version?: string
  /** 来源配置（多实例合并时标注） */
  configFileName?: string
}

/** 系统中 EasyTier 注入的路由（如 metric 9005，备用） */
interface SystemEtRoute {
  destination: string
  nextHop: string
  metric: number
  interfaceAlias?: string
  interfaceIp?: string
  /** 反查到的配置名 */
  configFileName?: string
  source: 'system'
}

interface RunningWebItem {
  protocol: string
  host: string
  port: number
  userName: string
  webStartMethod: number
  configFileName: string
  status: string
}
