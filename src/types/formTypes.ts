interface NetworkIdentity {
  network_name: string
  network_secret: string
}

interface Peer {
  uri: string
}

interface ProxyNetwork {
  cidr: string
}

interface ConsoleLogger {
  level: string
}

interface FileLogger {
  level?: string | undefined
  file?: string | undefined | null
  dir?: string | undefined | null
}

interface Flags {
  default_protocol: string
  dev_name: string
  data_compress_algo: string
  enable_encryption: boolean
  enable_ipv6: boolean
  latency_first: boolean
  enable_exit_node: boolean
  no_tun: boolean
  use_smoltcp: boolean
  disable_p2p: boolean
  disable_udp_hole_punching: boolean
  multi_thread: boolean
  relay_all_peer_rpc: boolean
  manual_routes: string | undefined
  ipv6_listener: string
  socks5?: string | undefined
  relay_network_whitelist?: string | undefined
  bind_device: boolean
  disable_kcp_input: boolean
  enable_kcp_proxy: boolean
}

interface FormData {
  hostname?: string | undefined | null
  instance_name?: string | undefined
  network_identity: Partial<NetworkIdentity>
  dhcp?: boolean | undefined
  ipv4?: string | undefined
  peer: Partial<Peer>[] | undefined | null
  listeners: any[]
  mapped_listeners: any[]
  proxy_network: Partial<ProxyNetwork>[] | undefined | null
  exit_nodes: any[] | undefined
  config_exit_nodes_route: any | undefined
  rpc_portal: string
  console_logger: Partial<ConsoleLogger> | any
  file_logger: Partial<FileLogger>
  vpn_portal_config: Partial<VpnPortalConfig> | any
  flags: Partial<Flags>
}

interface FormWebData {
  protocol: Partial<string> | undefined
  host: Partial<string> | undefined
  port: Partial<number> | undefined
  userName: string
  webStartMethod: Partial<number>
  configFileName:  string
  webUrl: Partial<string> | undefined
  status?:  Partial<string> | undefined
  pid?:  Partial<number> | undefined
}