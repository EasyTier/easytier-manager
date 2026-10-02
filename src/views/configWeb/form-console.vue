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
      <el-row>
        <el-col :span="16">
          <el-form-item
            :label="t('easytier.configFileName')"
            prop="configFileName"
            :rules="[
              { required: true, message: '请输入配置名称', trigger: 'blur' },
              {
                pattern: /^[^一-龥]+$/,
                trigger: ['blur', 'change'],
                message: '允许：字母 数字 _ -'
              }
            ]"
          >
            <el-input v-model="formData.configFileName" type="text" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-form-item :label="t('easytier.programType')" prop="program">
            <el-radio-group v-model="formData.program">
              <el-radio value="easytier-web-embed" style="display: inline">
                easytier-web-embed（含前端，推荐）
              </el-radio>
              <el-radio value="easytier-web" style="display: inline">
                easytier-web（仅 API 后端）
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="16">
          <el-form-item :label="t('easytier.apiServerPort')" prop="apiServerPort">
            <el-input-number
              v-model="formData.apiServerPort"
              placeholder="请输入端口,例如：11211"
              :min="1"
              :max="65535"
              :step="1"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="16">
          <el-form-item :label="t('easytier.apiServerAddr')" prop="apiServerAddr">
            <el-input
              v-model="formData.apiServerAddr"
              placeholder="例如：0.0.0.0、127.0.0.1"
              type="text"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="16">
          <el-form-item :label="t('easytier.apiHost')" prop="apiHost">
            <el-input
              v-model="formData.apiHost"
              placeholder="例如：http://127.0.0.1:11211"
              type="text"
              clearable
            />
            <div class="form-tip">控制台前端连接后端的地址，设置错误会导致登录验证码刷不出</div>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="16">
          <el-form-item :label="t('easytier.configServerPort')" prop="configServerPort">
            <el-input-number
              v-model="formData.configServerPort"
              placeholder="请输入端口,例如：22020"
              :min="1"
              :max="65535"
              :step="1"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="16">
          <el-form-item :label="t('easytier.configServerProtocol')" prop="configServerProtocol">
            <el-select v-model="formData.configServerProtocol" default-first-option>
              <el-option
                v-for="(item, index) in protocolOptions"
                :key="index"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <div class="form-tip"
              >配置下发端的监听协议；如需 wss 请自行反向代理，接入端协议选 wss</div
            >
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="20">
          <el-collapse v-model="advancedOpen" class="advanced-collapse">
            <el-collapse-item name="advanced">
              <template #title>
                <span class="advanced-title">{{ t('easytier.advancedOptions') }}</span>
              </template>
              <el-form-item :label="t('easytier.dbPath')" prop="dbPath">
                <el-input
                  v-model="formData.dbPath"
                  placeholder="留空自动为 resource/web-console/配置名称/et.db"
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item :label="t('easytier.webServerPort')" prop="webServerPort">
                <el-input-number
                  v-model="formData.webServerPort"
                  placeholder="选填"
                  :min="1"
                  :max="65535"
                  :step="1"
                />
              </el-form-item>
              <el-form-item :label="t('easytier.noWeb')" prop="noWeb">
                <el-switch v-model="formData.noWeb" />
              </el-form-item>
              <el-form-item :label="t('easytier.disableRegistration')" prop="disableRegistration">
                <el-switch v-model="formData.disableRegistration" />
              </el-form-item>
              <el-form-item :label="t('easytier.allowAutoCreateUser')" prop="allowAutoCreateUser">
                <el-switch v-model="formData.allowAutoCreateUser" />
              </el-form-item>
              <el-form-item :label="t('easytier.fileLogDir')" prop="fileLogDir">
                <el-input
                  v-model="formData.fileLogDir"
                  placeholder="选填，留空不写日志文件"
                  type="text"
                  clearable
                />
              </el-form-item>
              <el-form-item :label="t('easytier.consoleLogLevel')" prop="consoleLogLevel">
                <el-select v-model="formData.consoleLogLevel" placeholder="选填" clearable>
                  <el-option v-for="lv in logLevels" :key="lv" :label="lv" :value="lv" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('easytier.fileLogLevel')" prop="fileLogLevel">
                <el-select v-model="formData.fileLogLevel" placeholder="选填" clearable>
                  <el-option v-for="lv in logLevels" :key="lv" :label="lv" :value="lv" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('easytier.extraArgs')" prop="extraArgs">
                <el-input
                  v-model="formData.extraArgs"
                  type="textarea"
                  :rows="2"
                  placeholder="选填，原样追加到启动命令末尾，如 --oidc-issuer-url https://..."
                />
              </el-form-item>
            </el-collapse-item>
          </el-collapse>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from '@/hooks/web/useI18n'
import type { FormConsoleData } from '@/types/formTypes'
import { onMounted, PropType, reactive, ref, toRefs, watch } from 'vue'

const { t } = useI18n()
const props = defineProps({
  formData: {
    type: Object as PropType<FormConsoleData>,
    required: true
  }
})
const { formData } = toRefs(props)
const formRef = ref()
const advancedOpen = ref<string[]>([])
const rules = reactive({
  apiServerAddr: [
    {
      pattern: /^[0-9a-fA-F.:]+$/,
      trigger: ['blur', 'change'],
      message: '请输入正确的监听地址'
    }
  ],
  apiHost: [
    {
      pattern: /^https?:\/\/.+/,
      trigger: ['blur', 'change'],
      message: '格式：http://或https://开头'
    }
  ]
})
const protocolOptions = reactive([
  { label: 'udp', value: 'udp' },
  { label: 'tcp', value: 'tcp' },
  { label: 'ws', value: 'ws' }
])
const logLevels = ['trace', 'debug', 'info', 'warn', 'error']

// API Host 留空或为自动生成值时，跟随 API 端口变化
watch(
  () => formData.value.apiServerPort,
  (val) => {
    if (!val) return
    if (!formData.value.apiHost || /^http:\/\/127\.0\.0\.1:\d+$/.test(formData.value.apiHost)) {
      formData.value.apiHost = `http://127.0.0.1:${val}`
    }
  }
)
onMounted(() => {
  if (!formData.value.apiHost && formData.value.apiServerPort) {
    formData.value.apiHost = `http://127.0.0.1:${formData.value.apiServerPort}`
  }
})
const validateForm = () => {
  return formRef.value.validate()
}
defineExpose({ validateForm })
</script>
<style scoped>
.form {
  margin-right: 20px;
}

.form-tip {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}

.advanced-collapse {
  width: 100%;
  border-top: none;
}

.advanced-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 10px;
}

.advanced-collapse :deep(.el-form-item) {
  margin-bottom: 18px;
}

.advanced-title {
  font-size: 14px;
  color: var(--el-color-primary);
}
</style>
