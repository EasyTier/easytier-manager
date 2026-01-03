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
  foreign_relay_bps_limit?: number // 外部中继带宽限制
  p2p_only?: boolean // 仅 P2P
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
  peer: PeerConfig[]
  proxy_network: NetworkConfig[]
  file_logger: FileLoggerConfig
  console_logger: ConsoleLoggerConfig
  rpc_portal: string
  rpc_portal_whitelist?: string[] // RPC 门户白名单
  vpn_portal_config: VpnPortalConfig
  routes: string[]
  socks5_proxy: string
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
