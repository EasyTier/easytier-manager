<template>
  <div class="form">
    <el-form
      :model="formData"
      ref="formRef"
      :rules="rules"
      :scroll-to-error="true"
      label-position="right"
      label-width="160px"
      size="default"
      @submit.prevent
    >
      <el-divider direction="horizontal">主要参数</el-divider>
      <el-row>
        <el-col :md="12" :sm="12" :xs="12">
          <el-form-item :label="t('easytier.hostname')" prop="hostname">
            <el-input
              v-model="formData.hostname"
              type="text"
              maxlength="36"
              show-word-limit
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :md="12" :sm="12" :xs="12">
          <el-form-item :label="t('easytier.instance_name')" prop="instance_name">
            <el-input
              v-model="formData.instance_name"
              type="text"
              maxlength="36"
              show-word-limit
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="12" :sm="12" :xs="12">
          <el-form-item :label="t('easytier.network_name')" prop="network_identity.network_name">
            <el-input
              v-model="formData.network_identity.network_name"
              type="text"
              maxlength="36"
              show-word-limit
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :md="12" :sm="12" :xs="12">
          <el-form-item
            :label="t('easytier.network_secret')"
            prop="network_identity.network_secret"
          >
            <el-input
              v-model="formData.network_identity.network_secret"
              type="password"
              :show-password="true"
              maxlength="64"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="12" :sm="12" :xs="12">
          <el-form-item :label="t('easytier.dhcp')" prop="dhcp">
            <el-switch v-model="formData.dhcp" />
          </el-form-item>
        </el-col>
        <el-col :md="12" :sm="12" :xs="12">
          <el-form-item :label="t('easytier.ipv4Vir')" prop="ipv4">
            <el-input v-model="formData.ipv4" type="text" :disabled="ipv4Disabled" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="24" :sm="12" :xs="12">
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
                  :value="item.description"
                />
              </el-select>
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="24" :sm="12" :xs="12">
          <el-tooltip trigger="click" content="支持手动输入" placement="top">
            <el-form-item :label="t('easytier.listeners')" prop="listeners">
              <el-select
                v-model="formData.listeners"
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
                v-model="formData.mapped_listeners"
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
        <el-col :md="12" :sm="12" :xs="12">
          <el-tooltip trigger="click" content="支持手动输入" placement="top">
            <el-form-item :label="t('easytier.exit_nodes')" prop="exit_nodes">
              <el-select
                v-model="formData.exit_nodes"
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
              <el-switch v-model="formData.config_exit_nodes_route" />
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
              <el-input v-model="vpnPortalConfig.wireguard_listen" type="text" clearable />
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
              <el-input v-model="formData.rpc_portal" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12" v-if="consoleLoggerVisible">
          <el-form-item :label="t('easytier.console_log_level')" prop="console_logger.level">
            <el-select v-model="formData.console_logger.level" clearable filterable>
              <el-option
                v-for="(item, index) in file_logger_levelOptions"
                :key="index"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-divider direction="horizontal">日志设置</el-divider>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.file_log_level')" prop="file_logger.level">
            <el-select v-model="formData.file_logger.level" clearable>
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
            <el-input v-model="formData.file_logger.file" type="text" disabled clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :md="24" :sm="12" :xs="12">
          <el-form-item :label="t('easytier.file_log_dir')" prop="file_logger.dir">
            <el-input v-model="formData.file_logger.dir" :disabled="true" type="text" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-divider direction="horizontal">其他标志设置</el-divider>
      <el-row>
        <el-col :span="12">
          <el-tooltip trigger="click" content="连接到对等节点时使用的默认协议" placement="top">
            <el-form-item :label="t('easytier.default_protocol')" prop="flags.default_protocol">
              <el-radio-group v-model="formData.flags.default_protocol">
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
              <el-switch v-model="formData.flags.latency_first" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row :span="24">
        <el-col :span="12">
          <el-tooltip trigger="click" content="TUN接口名称，为空则随机生成" placement="top">
            <el-form-item :label="t('easytier.dev_name')" prop="flags.dev_name">
              <el-input
                v-model="formData.flags.dev_name"
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
              v-model="formData.flags.data_compress_algo"
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
            <el-switch v-model="formData.flags.enable_encryption" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('easytier.enable_ipv6')" prop="flags.enable_ipv6">
            <el-switch v-model="formData.flags.enable_ipv6" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.multi_thread')" prop="flags.multi_thread">
            <el-switch v-model="formData.flags.multi_thread" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="将连接器的套接字绑定到物理设备以避免路由问题。比如子网代理网段与某节点的网段冲突，绑定物理设备后可以与该节点正常通信"
            placement="top"
          >
            <el-form-item :label="t('easytier.bind_device')" prop="flags.bind_device">
              <el-switch v-model="formData.flags.bind_device" />
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
              <el-switch v-model="formData.flags.enable_kcp_proxy" />
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
              <el-switch v-model="formData.flags.disable_kcp_input" />
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
              <el-switch v-model="formData.flags.no_tun" />
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
              <el-switch v-model="formData.flags.use_smoltcp" />
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
              <el-switch v-model="formData.flags.disable_p2p" />
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
              <el-switch v-model="formData.flags.disable_udp_hole_punching" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.enable_exit_node')" prop="flags.enable_exit_node">
            <el-switch v-model="formData.flags.enable_exit_node" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="relay-all-peer-rpc,转发所有对等节点的RPC数据包，即使对等节点不在转发网络白名单中。这可以帮助白名单外网络中的对等节点建立P2P连接"
            placement="top"
          />
          <el-form-item :label="t('easytier.relay_all_peer_rpc')" prop="flags.relay_all_peer_rpc">
            <el-switch v-model="formData.flags.relay_all_peer_rpc" />
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
              <el-switch v-model="formData.flags.accept_dns" />
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
              <el-switch v-model="formData.flags.private_mode" />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip trigger="click" placement="top">
            <template #content>
              仅转发白名单网络的流量，支持通配符字符串。多个网络名称间可以使用英文空格间隔。<br />
              如果该参数为空，则禁用转发。默认允许所有网络。<br />
              例如：'*'（所有网络），'def*'（以def为前缀的网络），'net1 net2'（只允许net1和net2）"
            </template>
            <el-form-item
              :label="t('easytier.foreign_network_whitelist')"
              prop="flags.relay_network_whitelist"
            >
              <el-input v-model="formData.flags.relay_network_whitelist" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <!-- <el-divider direction="horizontal">以下尚未测试，建议使用编辑器添加(修改)</el-divider> -->
      <el-row>
        <el-col :md="24" :sm="12" :xs="12">
          <el-tooltip
            trigger="click"
            content="manual-routes,手动分配路由CIDR，将禁用子网代理和从对等节点传播的wireguard路由。例如：192.168.0.0/16"
            placement="top"
          >
            <el-form-item :label="t('easytier.manual_routes')" prop="flags.manual_routes">
              <el-input v-model="formData.flags.manual_routes" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="ipv6-listener,IPv6 监听器的URL，例如：tcp://[::]:11010，如果未设置，将在随机UDP端口上监听"
            placement="top"
          >
            <el-form-item :label="t('easytier.ipv6_listener')" prop="flags.ipv6_listener">
              <el-input v-model="formData.flags.ipv6_listener" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
        <el-col :span="12">
          <el-tooltip
            trigger="click"
            content="socks5,启用 socks5 服务器，允许 socks5 客户端访问虚拟网络. 格式: <端口>，例如：1080，例如：socks5://0.0.0.0:1080"
            placement="top"
          >
            <el-form-item :label="t('easytier.socks5')" prop="flags.socks5">
              <el-input v-model="formData.flags.socks5" type="text" clearable />
            </el-form-item>
          </el-tooltip>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from '@/hooks/web/useI18n'
import { useEasyTierStore } from '@/store/modules/easytier'
import { getHostname } from '@/utils/sysUtil'
import { ElMessageBox } from 'element-plus'
import { onBeforeMount, PropType, reactive, ref, toRefs, watch } from 'vue'

const { t } = useI18n()
const easyTierStore = useEasyTierStore()
const props = defineProps({
  formData: {
    type: Object as PropType<FormData>,
    required: true
  }
})
const { formData } = toRefs(props)
const formRef = ref()
const ipv4Disabled = ref(false)
const consoleLoggerVisible = ref(false)
const peers = ref<Array<any>>([])
const proxyNetwork = ref<Array<any>>([])
const vpnPortalConfig = ref<any>({ client_cidr: '', wireguard_listen: '' })
const rules = reactive({
  hostname: [
    { required: true, trigger: ['blur', 'change'], message: '请输入主机名' },
    {
      pattern: /^[^一-龥]+$/,
      trigger: ['blur', 'change'],
      message: '允许：字母 数字 _ -'
    }
  ],
  instance_name: [
    { required: true, trigger: ['blur', 'change'], message: '请输入实例名' },
    {
      pattern: /^[^一-龥]+$/,
      trigger: ['blur', 'change'],
      message: '允许：字母 数字 _ -'
    }
  ],
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
    description: 'tcp://public.easytier.top:11010'
  },
  {
    name: '群友提供',
    description: 'tcp://c.oee.icu:60006'
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
  }
])
const mappedListenersOptions = reactive([
  {
    label: '例如：tcp://123.123.123.123:11223',
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
const getPublicPeers = async () => {
  const data = await easyTierStore.getPublicPeerList()
  if (data && data.length > 0) {
    peersOptions.value = data
  }
}
watch(
  () => formData.value.hostname,
  (value) => {
    if (value) {
      formData.value.instance_name = value
    }
  }
)
watch(
  () => formData.value.dhcp,
  (value) => {
    if (value) {
      ipv4Disabled.value = true
      formData.value.ipv4 = undefined
    } else {
      ipv4Disabled.value = false
    }
  }
)
watch(
  () => vpnPortalConfig.value.client_cidr,
  (value) => {
    if (value) {
      formData.value.vpn_portal_config.client_cidr = vpnPortalConfig.value.client_cidr
    }
  }
)
watch(
  () => vpnPortalConfig.value.wireguard_listen,
  (value) => {
    if (value) {
      formData.value.vpn_portal_config.wireguard_listen = vpnPortalConfig.value.wireguard_listen
    }
  }
)
watch(
  () => formData.value.config_exit_nodes_route,
  (value) => {
    if (value) {
      ElMessageBox.alert('该功能暂不稳定，可能会导致断网，谨慎使用', '警告', {
        confirmButtonText: '确定',
        type: 'warning'
      })
    }
  }
)
onBeforeMount(async () => {
  if (formData.value.dhcp) {
    ipv4Disabled.value = true
  }
  if (formData.value.peer && formData.value.peer!.length > 0 && formData.value.peer[0].uri) {
    formData.value.peer!.forEach((p) => peers.value.push(p.uri))
  }
  if (
    formData.value.proxy_network &&
    formData.value.proxy_network!.length > 0 &&
    formData.value.proxy_network[0].cidr
  ) {
    formData.value.proxy_network!.forEach((p) => proxyNetwork.value.push(p.cidr))
  }
  if (!formData.value.hostname || formData.value.hostname === '') {
    formData.value.hostname = await getHostname()
  }
  if (!formData.value.file_logger.file || formData.value.file_logger.file === '') {
    formData.value.file_logger.file = 'easytier'
  }
  if (
    !formData.value.vpn_portal_config.client_cidr ||
    formData.value.vpn_portal_config.client_cidr === ''
  ) {
    vpnPortalConfig.value.client_cidr = formData.value.vpn_portal_config.client_cidr
  } else {
    vpnPortalConfig.value.client_cidr = ''
  }
  if (
    !formData.value.vpn_portal_config.wireguard_listen ||
    formData.value.vpn_portal_config.wireguard_listen === ''
  ) {
    vpnPortalConfig.value.wireguard_listen = formData.value.vpn_portal_config.wireguard_listen
  } else {
    vpnPortalConfig.value.wireguard_listen = ''
  }
  await getPublicPeers()
})
const peerChange = (value: any) => {
  formData.value.peer = []
  value.forEach((v) => formData.value.peer?.push({ uri: v }))
}
const compressChange = (value: any) => {
  if (value === 1) {
    formData.value.flags.data_compress_algo = undefined
  }
}
const proxyNetworkChange = (value: any) => {
  formData.value.proxy_network = []
  value.forEach((v) => formData.value.proxy_network?.push({ cidr: v }))
}
const validateForm = () => {
  return formRef.value.validate()
}
defineExpose({ validateForm })
</script>
<style scoped>
.form {
  margin-right: 20px;
}
</style>
