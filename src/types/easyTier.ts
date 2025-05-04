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
  mtu: number
  latency_first: boolean
  enable_exit_node: boolean
  no_tun: boolean
  use_smoltcp: boolean
  foreign_network_whitelist: string
  disable_p2p: boolean
  relay_all_peer_rpc: boolean
  disable_udp_hole_punching: boolean
  ipv6_listener: string
}

interface EasyTierConfig {
  netns: string
  hostname: string
  instance_name: string
  instance_id: string
  ipv4: string
  dhcp: boolean
  network_identity: NetworkIdentity
  listeners: string
  exit_nodes: string[]
  config_exit_nodes_route: boolean
  peer: PeerConfig[]
  proxy_network: NetworkConfig[]
  file_logger: FileLoggerConfig
  console_logger: ConsoleLoggerConfig
  rpc_portal: string
  vpn_portal_config: VpnPortalConfig
  routes: string[]
  socks5_proxy: string
  flags: Flags
  flags_struct: Flags
  stun_server: string[]
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
