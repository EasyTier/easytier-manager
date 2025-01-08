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
              maxlength="32"
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
              maxlength="32"
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
              maxlength="32"
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
          <el-tooltip content="支持手动输入" placement="top">
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
          <el-tooltip content="支持手动输入" placement="top">
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
        <el-col :span="24">
          <el-tooltip content="支持手动输入" placement="top">
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
        <el-col :md="24" :sm="12" :xs="12">
          <el-tooltip content="支持手动输入" placement="top">
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
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.rpc_portal')" prop="rpc_portal">
            <el-input v-model="formData.rpc_portal" type="text" clearable />
          </el-form-item>
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
            <el-input v-model="formData.file_logger.file" type="text" clearable />
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
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('easytier.dev_name')" prop="flags.dev_name">
            <el-input
              v-model="formData.flags.dev_name"
              type="text"
              maxlength="16"
              show-word-limit
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.disable_encryption')" prop="flags.disable_encryption">
            <el-switch v-model="formData.flags.disable_encryption" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('easytier.disable_ipv6')" prop="flags.disable_ipv6">
            <el-switch v-model="formData.flags.disable_ipv6" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.latency_first')" prop="flags.latency_first">
            <el-switch v-model="formData.flags.latency_first" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('easytier.enable_exit_node')" prop="flags.enable_exit_node">
            <el-switch v-model="formData.flags.enable_exit_node" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.no_tun')" prop="flags.no_tun">
            <el-switch v-model="formData.flags.no_tun" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('easytier.use_smoltcp')" prop="flags.use_smoltcp">
            <el-switch v-model="formData.flags.use_smoltcp" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.disable_p2p')" prop="flags.disable_p2p">
            <el-switch v-model="formData.flags.disable_p2p" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            :label="t('easytier.disable_udp_hole_punching')"
            prop="flags.disable_udp_hole_punching"
          >
            <el-switch v-model="formData.flags.disable_udp_hole_punching" />
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
          <el-form-item :label="t('easytier.relay_all_peer_rpc')" prop="flags.relay_all_peer_rpc">
            <el-switch v-model="formData.flags.relay_all_peer_rpc" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-tooltip placement="top">
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
      <el-divider direction="horizontal">以下尚未测试，建议使用编辑器添加(修改)</el-divider>
      <el-row>
        <el-col :md="24" :sm="12" :xs="12">
          <el-form-item :label="t('easytier.manual_routes')" prop="flags.manual_routes">
            <el-input v-model="formData.flags.manual_routes" type="text" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item :label="t('easytier.ipv6_listener')" prop="flags.ipv6_listener">
            <el-input v-model="formData.flags.ipv6_listener" type="text" clearable />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('easytier.socks5')" prop="flags.socks5">
            <el-input v-model="formData.flags.socks5" type="text" clearable />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>
<script setup lang="ts">
import { onMounted, PropType, reactive, ref, toRefs, watch } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'

const { t } = useI18n()
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
  ],
  'file_logger.file': [
    { required: true, trigger: ['blur', 'change'], message: '请输入日志文件名' },
    {
      pattern: /^[^一-龥]+$/,
      trigger: ['blur', 'change'],
      message: '允许：字母 数字 _ -'
    }
  ]
})
const peersOptions = reactive([
  {
    label: 'tcp://public.easytier.top:11010',
    value: 'tcp://public.easytier.top:11010'
  },
  {
    label: 'tcp://c.oee.icu:60006',
    value: 'tcp://c.oee.icu:60006'
  },
  {
    label: 'tcp://ah.nkbpal.cn:11010',
    value: 'tcp://ah.nkbpal.cn:11010'
  },
  {
    label: 'tcp://s1.ct8.pl:11010',
    value: 'tcp://s1.ct8.pl:11010'
  },
  {
    label: 'tcp://et.ie12vps.xyz:11010',
    value: 'tcp://et.ie12vps.xyz:11010'
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
watch(
  () => formData.value.hostname,
  (value) => {
    if (value) {
      formData.value.instance_name = value
      formData.value.file_logger.file = value
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

onMounted(() => {
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
})
const peerChange = (value: any) => {
  formData.value.peer = []
  value.forEach((v) => formData.value.peer?.push({ uri: v }))
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
