import type { EasyTierFormData, FormWebData } from '@/types/formTypes'

const defaultFormData: EasyTierFormData | any = {
  hostname: '',
  instance_name: '',
  machine_id: undefined, // 机器 ID，默认从系统获取
  network_identity: {
    network_name: '',
    network_secret: ''
  },
  dhcp: true,
  ipv4: undefined,
  ipv6: undefined,
  peer: [{ uri: undefined }],
  external_node: undefined, // 外部节点
  listeners: [],
  mapped_listeners: [],
  routes: undefined,
  proxy_network: [{ cidr: undefined }],
  exit_nodes: [],
  rpc_portal: '0.0.0.0:15888',
  rpc_portal_whitelist: undefined, // RPC 白名单
  socks5_proxy: undefined, // SOCKS5 代理（顶层）
  local_private_key: undefined, // 安全模式本地私钥
  local_public_key: undefined, // 安全模式本地公钥
  credential: undefined, // 临时入网凭据
  credential_file: undefined, // 凭据存储文件路径
  tcp_whitelist: [],
  udp_whitelist: [],
  stun_servers: undefined, // STUN 服务器列表
  stun_servers_v6: undefined, // IPv6 STUN 服务器列表
  console_logger: { level: undefined },
  file_logger: {
    level: 'error',
    file: 'easytier',
    dir: '',
    size: undefined, // 单个日志文件大小 MB，默认 100
    count: undefined // 最大日志文件数量，默认 10
  },
  vpn_portal_config: {
    client_cidr: '',
    wireguard_listen: ''
  },
  port_forward: [], // 端口转发
  flags: {
    default_protocol: 'tcp',
    dev_name: '',
    data_compress_algo: undefined,
    enable_encryption: true,
    encryption_algorithm: undefined, // 加密算法，默认 aes-gcm
    enable_ipv6: true,
    disable_ipv6: undefined, // 禁用 IPv6
    mtu: undefined, // MTU，默认 1380/1360
    latency_first: true,
    enable_exit_node: false,
    no_tun: false,
    use_smoltcp: false,
    disable_p2p: false,
    disable_udp_hole_punching: false,
    disable_tcp_hole_punching: undefined, // 禁用 TCP 打洞
    disable_sym_hole_punching: undefined, // 禁用对称 NAT 打洞
    multi_thread: true,
    multi_thread_count: undefined, // 线程数，默认 2
    relay_all_peer_rpc: false,
    ipv6_listener: undefined,
    socks5: undefined,
    relay_network_whitelist: '*',
    compression_algorithm: undefined,
    bind_device: true,
    disable_kcp_input: false,
    enable_kcp_proxy: false,
    enable_quic_proxy: undefined, // 启用 QUIC 代理
    disable_quic_input: undefined, // 禁用 QUIC 输入
    accept_dns: false,
    private_mode: false,
    proxy_forward_by_system: false,
    foreign_relay_bps_limit: undefined, // 外部中继带宽限制
    instance_recv_bps_limit: undefined, // 实例入站带宽限制
    p2p_only: undefined, // 仅 P2P 模式
    lazy_p2p: undefined, // 按需建立 P2P
    need_p2p: undefined, // 声明需要主动 P2P
    disable_upnp: undefined, // 禁用 UPnP/NAT-PMP 映射
    no_listener: undefined, // 不监听任何端口
    ipv6_public_addr_provider: undefined, // 共享公网 IPv6 子网
    ipv6_public_addr_auto: undefined, // 自动获取公网 IPv6 地址
    ipv6_public_addr_prefix: undefined, // 手动指定公网 IPv6 子网
    enable_udp_broadcast_relay: undefined, // 启用 UDP 广播中继
    secure_mode: undefined, // 启用安全模式
    disable_relay_kcp: undefined, // 禁止转发 KCP 数据包
    disable_relay_quic: undefined, // 禁止转发 QUIC 数据包
    enable_relay_foreign_network_kcp: undefined, // 允许转发外部网络 KCP
    enable_relay_foreign_network_quic: undefined, // 允许转发外部网络 QUIC
    tld_dns_zone: undefined // TLD DNS 区域
  }
}
const defaultFormWebData: FormWebData = {
  host: '',
  port: 22020,
  protocol: 'udp',
  userName: '',
  webStartMethod: 1,
  configFileName: '',
  webUrl: 'https://easytier.cn/web',
  status: '停止'
}
export default { defaultFormData, defaultFormWebData }
