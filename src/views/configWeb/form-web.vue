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
          <el-input
            v-model="formData.configFileName"
            type="text"
            clearable
          />
        </el-form-item>
      </el-col>
      </el-row>
      <el-row justify="center">
        <el-col :span="24">
          <el-form-item :label="t('easytier.webStartMethod')" prop="webStartMethod">
            <el-radio-group v-model="formData.webStartMethod" @change="webStartMethodChange">
              <el-radio
                v-for="(item, index) in webStartMethods"
                :key="index"
                :value="item.value"
                style="display: inline"
                >{{ item.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <div v-if="formData.webStartMethod === 1">
        <el-row>
          <el-form-item :label="t('easytier.userName')" prop="userName">
            <el-input
              v-model="formData.userName"
              type="text"
              maxlength="36"
              show-word-limitf
              clearable
            />
          </el-form-item>
        </el-row>
      </div>
      <div v-if="formData.webStartMethod === 2">
        <el-row>
          <el-col :span="16">
            <el-form-item :label="t('easytier.protocol')" prop="protocol">
              <el-select v-model="formData.protocol" default-first-option>
                <el-option
                  v-for="(item, index) in protocolOptions"
                  :key="index"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="16">
            <el-form-item :label="t('easytier.host')" prop="host">
              <el-input v-model="formData.host" placeholder="例如：127.0.0.1、example.com" type="text" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="16">
            <el-form-item :label="t('easytier.port')" prop="port">
              <el-input-number
                v-model="formData.port"
                placeholder="请输入端口,例如：22020"
                :min="1"
                :max="65535"
                :step="1"
                maxlength="5"
                show-word-limit
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="16">
            <el-form-item :label="t('easytier.userName')" prop="userName">
              <el-input
                v-model="formData.userName"
                type="text"
                maxlength="36"
                show-word-limitf
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>
      </div>
      <el-row>
          <el-col :span="16">
            <el-form-item :label="t('easytier.webUrl')" prop="webUrl">
              <el-input
                v-model="formData.webUrl"
                type="text"
                placeholder="用于快速跳转Web 控制台"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>
    </el-form>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from '@/hooks/web/useI18n'
import { onMounted, PropType, reactive, ref, toRefs } from 'vue'

const { t } = useI18n()
const props = defineProps({
  formData: {
    type: Object as PropType<FormWebData>,
    required: true,
  }
})
const { formData } = toRefs(props)
const formRef = ref()
const rules = reactive({
  host: [{ required: true, trigger: ['blur', 'change'], message: '请输入主机名' }],
  port: [
    { required: true, trigger: ['blur', 'change'], message: '请输入端口' },
    {
      pattern: /^[0-9]*$/,
      trigger: ['blur', 'change'],
      message: '请输入正确的端口'
    }
  ],
  userName: [
    { required: true, trigger: ['blur', 'change'], message: '请输入用户名' },
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
})

// WEB启动方式
const webStartMethods = reactive([
  {
    label: '官方服务器',
    value: 1
  },
  {
    label: '自建服务器',
    value: 2
  }
])
const protocolOptions = reactive([
  {
    label: 'udp',
    value: 'udp'
  },
  {
    label: 'tcp',
    value: 'tcp'
  }
])
const webStartMethodChange = (val: any) => {
  if (val === 1) {
    formData.value.webUrl = 'https://easytier.cn/web'
  } 
}
onMounted(() => {
  if (!formData.value.port) {
    formData.value.port = 22020
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
</style>
