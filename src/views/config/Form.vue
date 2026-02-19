<template>
  <div class="form">
    <el-form
      :model="localFormData"
      ref="formRef"
      :rules="rules"
      :scroll-to-error="true"
      label-position="right"
      label-width="140px"
      size="default"
      @submit.prevent
    >
      <el-divider direction="horizontal">
        <el-icon class="mr-4px">
          <Setting />
        </el-icon>
        主要参数
      </el-divider>
      <el-row>
        <el-col :md="24" :sm="24" :xs="24">
          <el-form-item :label="t('easytier.hostname')" prop="hostname">
            <el-input
              v-model="localFormData.hostname"
              type="text"
              maxlength="36"
              show-word-limit
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :md="24" :sm="24" :xs="24">
          <el-form-item :label="t('easytier.instance_name')" prop="instance_name">
            <el-input
              v-model="localFormData.instance_name"
              type="text"
              maxlength="36"
              show-word-limit
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="24" :sm="24" :xs="24">
          <el-form-item :label="t('easytier.network_name')" prop="network_identity.network_name">
            <el-input
              v-model="localFormData.network_identity.network_name"
              type="text"
              maxlength="36"
              show-word-limit
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :md="24" :sm="24" :xs="24">
          <el-form-item
            :label="t('easytier.network_secret')"
            prop="network_identity.network_secret"
          >
            <el-input
              v-model="localFormData.network_identity.network_secret"
              type="password"
              :show-password="true"
              maxlength="64"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="10">
        <el-col :md="21" :sm="21" :xs="21">
          <el-tooltip
            trigger="click"
            content="机器 ID，用于 Web 配置服务器识别机器，断线重连后恢复配置。默认从系统获取。"
            placement="top"
          >
            <el-form-item :label="t('easytier.machine_id')" prop="machine_id">
              <el-input
                v-model="localFormData.machine_id"
                type="text"
                placeholder="默认从系统获取，建议保持唯一"
                clearable
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :md="2" :sm="2" :xs="2">
          <el-button @click="generateMachineId" :icon="Refresh">生成</el-button>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="8" :sm="8" :xs="8">
          <el-form-item :label="t('easytier.dhcp')" prop="dhcp">
            <el-switch v-model="localFormData.dhcp" />
          </el-form-item>
        </el-col>
        <el-col :md="8" :sm="8" :xs="8">
          <el-form-item :label="t('easytier.ipv4Vir')" prop="ipv4" label-width="70">
            <el-input v-model="localFormData.ipv4" type="text" :disabled="ipv4Disabled" clearable />
          </el-form-item>
        </el-col>
        <el-col :md="8" :sm="8" :xs="8">
          <el-form-item :label="t('easytier.ipv6Vir')" prop="ipv4" label-width="70">
            <el-input v-model="localFormData.ipv6" type="text" :disabled="ipv4Disabled" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="24" :sm="24" :xs="24">
          <el-tooltip trigger="click" content="支持手动输入" placement="top">
            <el-form-item :label="t('easytier.peers')" prop="peer">
              <el-select
                v-model="peers"
                @change="peerChange"
                clearable
                filterable
                allow-create
                default-first-option
                multiple
              >
                <el-option
                  v-for="(item, index) in peersOptions"
                  :key="index"
                  :label="item.name"
                  :value="item.address"
                >
                  <span style="float: left">{{ item.name }}</span>
                  <span
                    style="float: right; font-size: 13px; color: var(--el-text-color-secondary)"
                  >
                    {{ item.version }}
                  </span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <!-- <el-row>
        <el-col :md="24" :sm="24" :xs="24">
          <el-tooltip
            trigger="click"
            content="使用公共共享节点来发现对等节点，例如：tcp://public.easytier.top:11010"
            placement="top"
          >
            <el-form-item :label="t('easytier.external_node')" prop="external_node">
              <el-input
                v-model="localFormData.external_node"
                type="text"
                placeholder="tcp://public.easytier.top:11010"
                clearable
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row> -->
      <el-row>
        <el-col :md="24" :sm="12" :xs="12">
          <el-tooltip trigger="click" content="支持手动输入" placement="top">
            <el-form-item :label="t('easytier.listeners')" prop="listeners">
              <el-select
                v-model="localFormData.listeners"
                clearable
                filterable
                allow-create
                default-first-option
                multiple
              >
                <el-option
                  v-for="(item, index) in listenersOptions"
                  :key="index"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="24" :sm="12" :xs="12">
          <el-tooltip
            trigger="click"
            content="手动指定监听器的公网地址，其他节点可以使用该地址连接到本节点。例如：tcp://123.123.123.123:11223，可以指定多个"
            placement="top"
          >
            <el-form-item :label="t('easytier.mapped_listeners')" prop="mapped_listeners">
              <el-select
                v-model="localFormData.mapped_listeners"
                clearable
                filterable
                allow-create
                default-first-option
                multiple
              >
                <el-option
                  v-for="(item, index) in mappedListenersOptions"
                  :key="index"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip trigger="click" content="支持手动输入" placement="top">
            <el-form-item :label="t('easytier.proxy_network')" prop="proxy_network.cidr">
              <el-select
                v-model="proxyNetwork"
                @change="proxyNetworkChange"
                clearable
                filterable
                allow-create
                default-first-option
                multiple
              >
                <el-option
                  v-for="(item, index) in proxy_network_cidrOptions"
                  :key="index"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="路由，将流量路由到指定的网络。例如：10.0.0.0/8,192.168.0.0/16"
            placement="top"
          >
            <el-form-item :label="t('easytier.routes')" prop="flags.routes">
              <el-input v-model="localFormData.flags.routes" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="12" :sm="12" :xs="12">
          <el-tooltip
            trigger="click"
            content="WireGuard客户端CIDR，例如：10.14.14.0/24"
            placement="top"
          >
            <el-form-item
              :label="t('easytier.vpn_client_cidr')"
              prop="vpn_portal_config.client_cidr"
            >
              <el-input v-model="vpnPortalConfig.client_cidr" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :md="12" :sm="12" :xs="12">
          <el-tooltip
            trigger="click"
            content="WireGuard监听地址，例如：0.0.0.0:11010"
            placement="top"
          >
            <el-form-item
              :label="t('easytier.vpn_wireguard_listen')"
              prop="vpn_portal_config.wireguard_listen"
            >
              <el-input
                v-model="localFormData.vpn_portal_config.wireguard_listen"
                type="text"
                clearable
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="IPv4 STUN 服务器列表，用于 NAT 穿透。支持手动输入，多个服务器。"
            placement="top"
          >
            <el-form-item :label="t('easytier.stun_servers')" prop="stun_servers">
              <div class="stun-select-wrapper">
                <el-select
                  v-model="localFormData.stun_servers"
                  clearable
                  filterable
                  :filter-method="filterStunServers"
                  allow-create
                  default-first-option
                  multiple
                  placeholder="例如：stun.nas.net:3478"
                  class="stun-select"
                >
                  <el-option
                    v-for="(item, index) in displayStunServers"
                    :key="index"
                    :label="item"
                    :value="item"
                  />
                </el-select>
                <el-button
                  :icon="Refresh"
                  :loading="stunRefreshing"
                  @click="handleRefreshStunServers"
                  title="刷新 STUN 服务器列表"
                  >刷新</el-button
                >
              </div>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="IPv6 STUN 服务器列表，用于 IPv6 NAT 穿透。"
            placement="top"
          >
            <el-form-item :label="t('easytier.stun_servers_v6')" prop="stun_servers_v6">
              <el-select
                v-model="localFormData.stun_servers_v6"
                clearable
                filterable
                allow-create
                default-first-option
                multiple
                placeholder="例如：stun.nextcloud.com:443"
              >
                <el-option
                  v-for="(item, index) in stunServersV6Options"
                  :key="index"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="RPC 门户白名单，限制哪些 IP 可以访问 RPC 接口。支持 IP 和 CIDR。例如：127.0.0.1,127.0.0.0/8"
            placement="top"
          >
            <el-form-item :label="t('easytier.rpc_portal_whitelist')" prop="rpc_portal_whitelist">
              <el-select
                v-model="localFormData.rpc_portal_whitelist"
                clearable
                filterable
                allow-create
                default-first-option
                multiple
                placeholder="127.0.0.1, 127.0.0.0/8"
              >
                <el-option
                  v-for="(item, index) in rpcWhitelistOptions"
                  :key="index"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="SOCKS5 代理地址。例如：socks5://0.0.0.0:1080"
            placement="top"
          >
            <el-form-item :label="t('easytier.socks5_proxy')" prop="socks5_proxy">
              <el-input
                v-model="localFormData.socks5_proxy"
                type="text"
                placeholder="socks5://0.0.0.0:1080"
                clearable
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="12" :sm="12" :xs="12">
          <el-tooltip trigger="click" content="支持手动输入" placement="top">
            <el-form-item :label="t('easytier.exit_nodes')" prop="exit_nodes">
              <el-select
                v-model="localFormData.exit_nodes"
                clearable
                filterable
                allow-create
                default-first-option
                multiple
              >
                <el-option
                  v-for="(item, index) in exit_nodesOptions"
                  :key="index"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :md="12" :sm="12" :xs="12">
          <el-tooltip trigger="click" content="自动设置出口路由，如果断网，请关闭" placement="top">
            <el-form-item
              :label="t('easytier.config_exit_nodes_route')"
              prop="config_exit_nodes_route"
            >
              <el-switch v-model="localFormData.config_exit_nodes_route" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="使用不同的 RPC 端口，可以在首页实时查看节点信息"
            placement="top"
          >
            <el-form-item :label="t('easytier.rpc_portal')" prop="rpc_portal">
              <el-input v-model="localFormData.rpc_portal" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-divider direction="horizontal">
        <el-icon class="mr-4px">
          <Document />
        </el-icon>
        日志设置
      </el-divider>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.file_log_level')" prop="file_logger.level">
            <el-select v-model="localFormData.file_logger.level" clearable>
              <el-option
                v-for="(item, index) in file_logger_levelOptions"
                :key="index"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('easytier.file_log_file')" prop="file_logger.file">
            <el-input v-model="localFormData.file_logger.file" type="text" disabled clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="24" :sm="12" :xs="12">
          <el-form-item :label="t('easytier.file_log_dir')" prop="file_logger.dir">
            <el-input
              v-model="localFormData.file_logger.dir"
              :disabled="true"
              type="text"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="单个日志文件大小，单位 MB，默认值为 100MB"
            placement="top"
          >
            <el-form-item :label="t('easytier.file_log_size')" prop="file_logger.size">
              <el-input-number
                v-model="localFormData.file_logger.size"
                :min="1"
                :max="1000"
                placeholder="100"
                controls-position="right"
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip trigger="click" content="最大日志文件数量，默认值为 10" placement="top">
            <el-form-item :label="t('easytier.file_log_count')" prop="file_logger.count">
              <el-input-number
                v-model="localFormData.file_logger.count"
                :min="1"
                :max="100"
                placeholder="10"
                controls-position="right"
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-divider direction="horizontal">
        <el-icon class="mr-4px">
          <Operation />
        </el-icon>
        其他标志设置
      </el-divider>
      <el-row>
        <el-col :span="12">
          <el-tooltip trigger="click" content="连接到对等节点时使用的默认协议" placement="top">
            <el-form-item :label="t('easytier.default_protocol')" prop="flags.default_protocol">
              <el-radio-group v-model="localFormData.flags.default_protocol">
                <el-radio
                  v-for="(item, index) in flags_default_protocolOptions"
                  :key="index"
                  :value="item.value"
                  style="display: inline"
                  >{{ item.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="延迟优先模式，将尝试使用最低延迟路径转发流量，关闭则使用最短路径"
            placement="top"
          >
            <el-form-item :label="t('easytier.latency_first')" prop="flags.latency_first">
              <el-switch v-model="localFormData.flags.latency_first" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row :span="24">
        <el-col :span="12">
          <el-tooltip trigger="click" content="TUN接口名称，为空则随机生成" placement="top">
            <el-form-item :label="t('easytier.dev_name')" prop="flags.dev_name">
              <el-input
                v-model="localFormData.flags.dev_name"
                type="text"
                maxlength="24"
                show-word-limit
                clearable
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-form-item
            :label="t('easytier.compression_algorithm')"
            prop="flags.data_compress_algo"
          >
            <el-select
              v-model="localFormData.flags.data_compress_algo"
              @change="compressChange"
              clearable
            >
              <el-option
                v-for="(item, index) in compressionAlgorithmOptions"
                :key="index"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.enable_encryption')" prop="flags.enable_encryption">
            <el-switch v-model="localFormData.flags.enable_encryption" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="选择加密算法：aes-gcm（默认）、aes-256-gcm、xor（最快）、chacha20"
            placement="top"
          >
            <el-form-item
              :label="t('easytier.encryption_algorithm')"
              prop="flags.encryption_algorithm"
            >
              <el-select
                v-model="localFormData.flags.encryption_algorithm"
                :disabled="!localFormData.flags.enable_encryption"
                clearable
              >
                <el-option
                  v-for="(item, index) in encryptionAlgorithmOptions"
                  :key="index"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.enable_ipv6')" prop="flags.enable_ipv6">
            <el-switch v-model="localFormData.flags.enable_ipv6" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="TUN 设备的 MTU 值。默认：非加密 1380，加密 1360"
            placement="top"
          >
            <el-form-item :label="t('easytier.mtu')" prop="flags.mtu">
              <el-input-number
                v-model="localFormData.flags.mtu"
                :min="1200"
                :max="1500"
                :step="10"
                placeholder="默认1380/1360"
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.multi_thread')" prop="flags.multi_thread">
            <el-switch v-model="localFormData.flags.multi_thread" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="多线程模式下使用的线程数，默认为 2。需要先启用多线程模式。"
            placement="top"
          >
            <el-form-item :label="t('easytier.multi_thread_count')" prop="flags.multi_thread_count">
              <el-input-number
                v-model="localFormData.flags.multi_thread_count"
                :min="2"
                :max="16"
                :disabled="!localFormData.flags.multi_thread"
                placeholder="默认2"
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="将连接器的套接字绑定到物理设备以避免路由问题。比如子网代理网段与某节点的网段冲突，绑定物理设备后可以与该节点正常通信"
            placement="top"
          >
            <el-form-item :label="t('easytier.bind_device')" prop="flags.bind_device">
              <el-switch v-model="localFormData.flags.bind_device" />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip trigger="click" content="禁用 TCP 打洞功能" placement="top">
            <el-form-item
              :label="t('easytier.disable_tcp_hole_punching')"
              prop="flags.disable_tcp_hole_punching"
            >
              <el-switch v-model="localFormData.flags.disable_tcp_hole_punching" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="启用KCP代理，提高在 UDP 丢包网络上的延迟和吞吐量"
            placement="top"
          >
            <el-form-item :label="t('easytier.enable_kcp_proxy')" prop="flags.enable_kcp_proxy">
              <el-switch v-model="localFormData.flags.enable_kcp_proxy" />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="不允许其他节点使用 KCP 代理 TCP 流到此节点。开启 KCP 代理的节点访问此节点时，依然使用原始 TCP 连接"
            placement="top"
          >
            <el-form-item :label="t('easytier.disable_kcp_input')" prop="flags.disable_kcp_input">
              <el-switch v-model="localFormData.flags.disable_kcp_input" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="启用 QUIC 协议代理，提供更好的性能和连接质量"
            placement="top"
          >
            <el-form-item :label="t('easytier.enable_quic_proxy')" prop="flags.enable_quic_proxy">
              <el-switch v-model="localFormData.flags.enable_quic_proxy" />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="禁用基于生日攻击的对称 NAT (NAT4) UDP 打洞功能。该功能可能被运营商封锁。"
            placement="top"
          >
            <el-form-item
              :label="t('easytier.disable_sym_hole_punching')"
              prop="flags.disable_sym_hole_punching"
            >
              <el-switch v-model="localFormData.flags.disable_sym_hole_punching" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="no-tun,不创建TUN设备，可以使用子网代理访问节点"
            placement="top"
          >
            <el-form-item :label="t('easytier.no_tun')" prop="flags.no_tun">
              <el-switch v-model="localFormData.flags.no_tun" />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="use-smoltcp,为子网代理启用smoltcp堆栈"
            placement="top"
          >
            <el-form-item :label="t('easytier.use_smoltcp')" prop="flags.use_smoltcp">
              <el-switch v-model="localFormData.flags.use_smoltcp" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="disable-p2p,禁用P2P通信，只通过--peers指定的节点转发数据包"
            placement="top"
          >
            <el-form-item :label="t('easytier.disable_p2p')" prop="flags.disable_p2p">
              <el-switch v-model="localFormData.flags.disable_p2p" />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="disable-udp-hole-punching,禁用UDP打洞功能"
            placement="top"
          >
            <el-form-item
              :label="t('easytier.disable_udp_hole_punching')"
              prop="flags.disable_udp_hole_punching"
            >
              <el-switch v-model="localFormData.flags.disable_udp_hole_punching" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="仅使用 P2P 直连模式，不使用中继节点。可能导致部分节点无法连接。"
            placement="top"
          >
            <el-form-item :label="t('easytier.p2p_only')" prop="flags.p2p_only">
              <el-switch v-model="localFormData.flags.p2p_only" />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip trigger="click" content="完全禁用 IPv6 功能" placement="top">
            <el-form-item :label="t('easytier.disable_ipv6')" prop="flags.disable_ipv6">
              <el-switch v-model="localFormData.flags.disable_ipv6" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.enable_exit_node')" prop="flags.enable_exit_node">
            <el-switch v-model="localFormData.flags.enable_exit_node" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="relay-all-peer-rpc,转发所有对等节点的RPC数据包，即使对等节点不在转发网络白名单中。这可以帮助白名单外网络中的对等节点建立P2P连接"
            placement="top"
          />
          <el-form-item :label="t('easytier.relay_all_peer_rpc')" prop="flags.relay_all_peer_rpc">
            <el-switch v-model="localFormData.flags.relay_all_peer_rpc" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="使用魔法DNS，您可以使用域名访问其他节点，例如：<hostname>.et.net。魔法DNS将修改您的系统DNS设置，请谨慎启用。 [env:ET_ACCEPT_DNS=] [possible values: true, false]"
            placement="top"
          >
            <el-form-item :label="t('easytier.accept_dns')" prop="flags.accept_dns">
              <el-switch v-model="localFormData.flags.accept_dns" />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="如果为true，则不允许使用了与本网络不相同的网络名称和密码的节点通过本节点进行握手或中转 [env: ET_PRIVATE_MODE=] [possible values: true, false]"
            placement="top"
          >
            <el-form-item :label="t('easytier.private_mode')" prop="flags.private_mode">
              <el-switch v-model="localFormData.flags.private_mode" />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="proxy-forward-by-system,通过系统路由转发代理流量，而不是通过smoltcp。这可以提高性能，但需要管理员权限。 [env: ET_PROXY_FORWARD_BY_SYSTEM=] [possible values: true, false]"
            placement="top"
          >
            <el-form-item
              :label="t('easytier.proxy_forward_by_system')"
              prop="flags.proxy_forward_by_system"
            >
              <el-switch v-model="localFormData.flags.proxy_forward_by_system" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip trigger="click" placement="top">
            <template #content>
              <div> 中继网络白名单，允许中继流量到这些网络。例如：10.0.0.0/8,192.168.0.0/16</div>
            </template>
            <el-form-item
              :label="t('easytier.relay_network_whitelist')"
              prop="flags.relay_network_whitelist"
            >
              <el-input
                v-model="localFormData.flags.relay_network_whitelist"
                type="text"
                clearable
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="外部中继带宽限制（字节/秒）。限制通过本节点中继的外部网络流量带宽。"
            placement="top"
          >
            <el-form-item
              :label="t('easytier.foreign_relay_bps_limit')"
              prop="flags.foreign_relay_bps_limit"
            >
              <el-input-number
                v-model="localFormData.flags.foreign_relay_bps_limit"
                :min="0"
                :step="10240"
                placeholder="字节/秒，0 表示不限制"
                style="width: 100%"
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="IPv6监听器，用于监听IPv6地址。例如：[::]:11010"
            placement="top"
          >
            <el-form-item :label="t('easytier.ipv6_listener')" prop="flags.ipv6_listener">
              <el-input v-model="localFormData.flags.ipv6_listener" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="SOCKS5代理，用于代理TCP流量。例如：127.0.0.1:1080"
            placement="top"
          >
            <el-form-item :label="t('easytier.socks5')" prop="flags.socks5">
              <el-input v-model="localFormData.flags.socks5" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip
            trigger="click"
            content="自定义顶级域名 DNS 区域。例如：net.et"
            placement="top"
          >
            <el-form-item :label="t('easytier.tld_dns_zone')" prop="flags.tld_dns_zone">
              <el-input
                v-model="localFormData.flags.tld_dns_zone"
                type="text"
                placeholder="net.et"
                clearable
              />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="TCP port whitelist. Supports single ports (80) and ranges (8000-9000) 2.4以上版本支持"
            placement="top"
          >
            <el-form-item :label="t('easytier.tcp_whitelist')" prop="tcp_whitelist">
              <el-input v-model="localFormData.tcp_whitelist" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="UDP port whitelist. Supports single ports (53) and ranges (5000-6000) 2.4以上版本支持"
            placement="top"
          >
            <el-form-item :label="t('easytier.udp_whitelist')" prop="udp_whitelist">
              <el-input v-model="localFormData.udp_whitelist" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-divider direction="horizontal">
        <el-icon class="mr-4px">
          <Connection />
        </el-icon>
        端口转发
      </el-divider>
      <el-row>
        <el-col :span="24">
          <el-form-item label-width="0">
            <div
              class="w-full bg-[var(--el-fill-color-blank)] rounded-8px border border-[var(--el-border-color-lighter)] overflow-hidden"
            >
              <el-table
                :data="localFormData.port_forward"
                style="width: 100%"
                :header-cell-style="{
                  background: 'var(--el-fill-color-light)',
                  color: 'var(--el-text-color-primary)'
                }"
              >
                <el-table-column prop="proto" :label="t('easytier.protocol')" width="120">
                  <template #default="scope">
                    <el-select v-model="scope.row.proto" placeholder="协议">
                      <el-option label="TCP" value="tcp" />
                      <el-option label="UDP" value="udp" />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column prop="bind_addr" :label="t('easytier.bind_addr')">
                  <template #default="scope">
                    <el-input
                      v-model="scope.row.bind_addr"
                      placeholder="例如: 0.0.0.0:12345"
                      clearable
                    />
                  </template>
                </el-table-column>
                <el-table-column prop="dst_addr" :label="t('easytier.dst_addr')">
                  <template #default="scope">
                    <el-input
                      v-model="scope.row.dst_addr"
                      placeholder="例如: 10.126.126.1:23456"
                      clearable
                    />
                  </template>
                </el-table-column>
                <el-table-column :label="t('common.action')" width="100" align="center">
                  <template #default="scope">
                    <el-button type="danger" link @click="removePortForward(scope.$index)">
                      <el-icon class="mr-2px">
                        <Delete />
                      </el-icon>
                      {{ t('common.delete') }}
                    </el-button>
                  </template>
                </el-table-column>
                <template #empty>
                  <div class="py-20px text-[var(--el-text-color-secondary)]">
                    暂无端口转发配置，点击下方按钮添加
                  </div>
                </template>
              </el-table>

              <div
                class="p-12px bg-[var(--el-fill-color-extra-light)] border-t border-[var(--el-border-color-lighter)] flex justify-center"
              >
                <el-button type="primary" plain @click="addPortForward">
                  <el-icon class="mr-4px">
                    <Plus />
                  </el-icon>
                  {{ t('easytier.add_port_forward') }}
                </el-button>
              </div>
            </div>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getHostname } from '@/utils/sysUtil'
import { ElMessageBox, FormInstance, FormRules } from 'element-plus'
import { useEasyTierStore } from '@/store/modules/easytier'
import {
  Connection,
  Delete,
  Document,
  Operation,
  Plus,
  Refresh,
  Setting
} from '@element-plus/icons-vue'

/**
 * 表单数据类型定义
 */
interface FormData {
  // 允许任意字符串类型的键
  [key: string]: any
}

const { t } = useI18n()
const easyTierStore = useEasyTierStore()
const props = defineProps<{
  formData: FormData
}>()

const emits = defineEmits(['update:formData'])

const localFormData = computed({
  get: () => props.formData,
  set: (value) => {
    emits('update:formData', value)
  }
})

const formRef = ref<FormInstance>()
const vpnPortalConfig = ref<any>({ client_cidr: '', wireguard_listen: '' })
const rules = ref<FormRules>({
  hostname: [
    { required: true, trigger: ['blur', 'change'], message: '请输入主机名' },
    {
      pattern: /^[^一-龥]+$/,
      trigger: ['blur', 'change'],
      message: '允许：字母 数字 _ -'
    }
  ],
  instance_name: [{ required: true, trigger: ['blur', 'change'], message: '请输入实例名' }],
  'network_identity.network_name': [
    {
      pattern: /^[^一-龥]+$/,
      trigger: ['blur', 'change'],
      message: '允许：字母 数字 _ -'
    }
  ],
  'network_identity.network_secret': [
    {
      pattern: /^[^一-龥]+$/,
      trigger: ['blur', 'change'],
      message: '允许：字母 数字 符号'
    }
  ]
  // 'file_logger.file': [
  //   { required: true, trigger: ['blur', 'change'], message: '请输入日志文件名' },
  //   {
  //     pattern: /^[^一-龥]+$/,
  //     trigger: ['blur', 'change'],
  //     message: '允许：字母 数字 _ -'
  //   }
  // ]
})
const peersOptions = ref([
  {
    name: '官方服务器',
    address: 'tcp://public.easytier.top:11010',
    version: 'latest'
  }
])
const listenersOptions = reactive([
  {
    label: 'tcp://0.0.0.0:11010',
    value: 'tcp://0.0.0.0:11010'
  },
  {
    label: 'udp://0.0.0.0:11010',
    value: 'udp://0.0.0.0:11010'
  },
  {
    label: 'wg://0.0.0.0:11011',
    value: 'wg://0.0.0.0:11011'
  },
  {
    value: 'ws://0.0.0.0:11011',
    label: 'ws://0.0.0.0:11011'
  },
  {
    value: 'wss://0.0.0.0:11012',
    label: 'wss://0.0.0.0:11012'
  },
  {
    value: 'faketcp://0.0.0.0:11013',
    label: 'faketcp://0.0.0.0:11013'
  },
  {
    value: 'tcp://[::]:11010',
    label: 'tcp://[::]:11010'
  },
  {
    value: 'udp://[::]:11010',
    label: 'udp://[::]:11010'
  },
  {
    value: 'wg://[::]:11011',
    label: 'wg://[::]:11011'
  },
  {
    value: 'ws://[::]:11011/',
    label: 'ws://[::]:11011/'
  },
  {
    value: 'wss://[::]:11012/',
    label: 'wss://[::]:11012/'
  }
])
const mappedListenersOptions = reactive([
  {
    label: 'tcp://123.123.123.123:11223',
    value: 'tcp://123.123.123.123:11223'
  }
])
const proxy_network_cidrOptions = reactive([
  {
    label: '192.168.0.0/24',
    value: '192.168.0.0/24'
  },
  {
    label: '192.168.1.0/24',
    value: '192.168.1.0/24'
  },
  {
    value: '192.168.2.0/24',
    label: '192.168.2.0/24'
  },
  {
    value: '192.168.5.0/24',
    label: '192.168.5.0/24'
  },
  {
    value: '192.168.6.0/24',
    label: '192.168.6.0/24'
  },
  {
    label: '192.168.31.0/24',
    value: '192.168.31.0/24'
  }
])
const exit_nodesOptions = reactive([
  {
    label: '10.144.144.1',
    value: '10.144.144.1'
  }
])
const file_logger_levelOptions = reactive([
  {
    label: '信息',
    value: 'info'
  },
  {
    label: '警告',
    value: 'warn'
  },
  {
    label: '错误',
    value: 'error'
  },
  {
    value: 'debug',
    label: '调试'
  },
  {
    value: 'off',
    label: '关闭'
  }
])
const flags_default_protocolOptions = reactive([
  {
    label: 'tcp',
    value: 'tcp'
  },
  {
    label: 'udp',
    value: 'udp'
  }
])
const compressionAlgorithmOptions = reactive([
  {
    label: 'none',
    value: 1
  },
  {
    label: 'zstd',
    value: 2
  }
])
// STUN 服务器选项
const stunServersOptions = ref<string[]>([])
const stunServersV6Options = reactive(['stun.nextcloud.com:443'])
// 用于显示的 STUN 服务器列表（限制20个）
const displayStunServers = ref<string[]>([])

// 过滤 STUN 服务器
const filterStunServers = (query: string) => {
  if (query) {
    const filtered = stunServersOptions.value.filter((item) =>
      item.toLowerCase().includes(query.toLowerCase())
    )
    displayStunServers.value = filtered.slice(0, 20)
  } else {
    displayStunServers.value = stunServersOptions.value.slice(0, 20)
  }
}

// 监听原始列表变化，同步更新显示列表
watch(stunServersOptions, (newList) => {
  displayStunServers.value = newList.slice(0, 20)
})

// RPC 白名单选项
const rpcWhitelistOptions = reactive(['127.0.0.1', '127.0.0.0/8', '0.0.0.0/0'])
// 加密算法选项
const encryptionAlgorithmOptions = reactive([
  {
    label: 'AES-GCM (默认)',
    value: 'aes-gcm'
  },
  {
    label: 'AES-256-GCM',
    value: 'aes-256-gcm'
  },
  {
    label: 'XOR (最快)',
    value: 'xor'
  },
  {
    label: 'ChaCha20',
    value: 'chacha20'
  }
])
const getStunServers = async () => {
  const data = await easyTierStore.getStunServers()
  if (data && data.length > 0) {
    stunServersOptions.value = data
  }
}

// 刷新 STUN 服务器列表
const stunRefreshing = ref(false)
const handleRefreshStunServers = async () => {
  stunRefreshing.value = true
  try {
    const data = await easyTierStore.refreshStunServers()
    if (data && data.length > 0) {
      stunServersOptions.value = data
    }
  } finally {
    stunRefreshing.value = false
  }
}

// 生成机器ID（UUID v4 格式）
const generateMachineId = () => {
  const uuid = crypto.randomUUID()
  localFormData.value.machine_id = uuid
}

const ipv4Disabled = computed(() => {
  return localFormData.value.dhcp
})

// 注释：consoleLoggerVisible 未使用，保留以备将来使用
// const consoleLoggerVisible = computed(() => {
//   return localFormData.value.console_logger
// })

const peers = ref<string[]>([])
const proxyNetwork = ref<string[]>([])

watch(
  () => localFormData.value.hostname,
  (value) => {
    if (value) {
      localFormData.value.instance_name = value
    }
  }
)

watch(
  () => localFormData.value.dhcp,
  (value) => {
    if (value) {
      localFormData.value.ipv4 = undefined
    }
  }
)
watch(
  () => localFormData.value.socks5_proxy,
  (value) => {
    if (value === '') {
      localFormData.value.socks5_proxy = undefined
    }
  }
)
watch(
  () => localFormData.value.stun_servers,
  (value) => {
    if (value.length == 0 || value === '') {
      localFormData.value.stun_servers = undefined
    }
  }
)
watch(
  () => localFormData.value.stun_servers_v6,
  (value) => {
    if (value.length == 0 || value === '') {
      localFormData.value.stun_servers_v6 = undefined
    }
  }
)
watch(
  () => vpnPortalConfig.value.client_cidr,
  (value) => {
    if (value) {
      localFormData.value.vpn_portal_config.client_cidr = vpnPortalConfig.value.client_cidr
    }
  }
)
watch(
  () => vpnPortalConfig.value.wireguard_listen,
  (value) => {
    if (value) {
      localFormData.value.vpn_portal_config.wireguard_listen =
        vpnPortalConfig.value.wireguard_listen
    }
  }
)
watch(
  () => localFormData.value.config_exit_nodes_route,
  (value) => {
    if (value) {
      ElMessageBox.alert(
        '该功能不稳定，可能会导致断网，谨慎使用！如果要使用该功能，必须要修改日志级别为 信息（info），否则会断网，如果断网请立马关闭该功能！如果还是断网则关闭WIFI或拔网线重连。',
        '警告',
        {
          confirmButtonText: '确定',
          type: 'warning'
        }
      )
    }
  }
)
onMounted(async () => {
  if (
    localFormData.value.peer &&
    localFormData.value.peer.length > 0 &&
    localFormData.value.peer[0].uri
  ) {
    peers.value = localFormData.value.peer.map((p) => p.uri)
  }
  if (
    localFormData.value.proxy_network &&
    localFormData.value.proxy_network.length > 0 &&
    localFormData.value.proxy_network[0].cidr
  ) {
    proxyNetwork.value = localFormData.value.proxy_network.map((p) => p.cidr)
  }
  if (!localFormData.value.hostname) {
    localFormData.value.hostname = await getHostname()
  }
  if (!localFormData.value.file_logger.file) {
    localFormData.value.file_logger.file = 'easytier'
  }
  // await getPublicPeers()
  await getStunServers()
})

const peerChange = (value: string[]) => {
  localFormData.value.peer = value.map((v) => ({ uri: v }))
}

const compressChange = (value: string) => {
  if (value === 'none') {
    localFormData.value.flags.data_compress_algo = undefined
  }
}
const proxyNetworkChange = (value: string[]) => {
  localFormData.value.proxy_network = value.map((v) => ({ cidr: v }))
}

const addPortForward = () => {
  if (!localFormData.value.port_forward) {
    localFormData.value.port_forward = []
  }
  localFormData.value.port_forward.push({
    proto: 'tcp',
    bind_addr: '0.0.0.0:12345',
    dst_addr: '10.126.126.1:23456'
  })
}

const removePortForward = (index: number) => {
  localFormData.value.port_forward.splice(index, 1)
}

const validateForm = () => {
  return formRef.value?.validate()
}

defineExpose({
  validateForm
})
</script>

<style scoped>
.form {
  height: calc(100vh - 250px);
  padding: 10px;
  overflow-y: auto;
}

.stun-select-wrapper {
  display: flex;
  width: 100%;
  gap: 8px;
}

.stun-select-wrapper .stun-select {
  flex: 1;
}
</style>
