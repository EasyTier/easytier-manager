<script lang="ts" setup>
import { ConfigGlobal } from '@/components/ConfigGlobal'
import { useDesign } from '@/hooks/web/useDesign'
import { useAppStore } from '@/store/modules/app'
import { useEasyTierStore } from '@/store/modules/easytier'
import { useTrayStore } from '@/store/modules/trayStore'
import { checkDir, initDataDir, migrateDataIfNeeded } from '@/utils/fileUtil'
import { restoreStateCurrent, StateFlags } from '@tauri-apps/plugin-window-state'
import { computed, onBeforeMount, onMounted, ref } from 'vue'

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('app')

const appStore = useAppStore()
const currentSize = computed(() => appStore.getCurrentSize)

const greyMode = computed(() => appStore.getGreyMode)
const trayStore = useTrayStore()
const easytierStore = useEasyTierStore()

const isLocked = ref(false)
const inputPassword = ref('')
const isFirstLoad = ref(true)

const unlock = () => {
  if (inputPassword.value === easytierStore.lockPassword) {
    isLocked.value = false
    inputPassword.value = ''
    isFirstLoad.value = false
  } else {
    alert('密码错误')
  }
}

onBeforeMount(async () => {
  appStore.initTheme()
  trayStore.initTray()
  restoreStateCurrent(StateFlags.ALL)
  await initDataDir()
  await migrateDataIfNeeded()
  checkDir()
  easytierStore.setConfigPath()
})

import { emit } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

onMounted(async () => {
  // 显示窗口（配置文件中设置为初始不可见，现在前端已加载完成）
  getCurrentWindow()
    .show()
    .catch((e) => {
      console.error('Failed to show window:', e)
    })

  easytierStore.autorun().catch((e) => {
    console.error('Failed to autorun:', e)
  })

  // 发送事件通知后端，前端已准备就绪
  emit('frontend-ready').catch((e) => {
    console.error('Failed to emit frontend-ready event:', e)
  })

  // 检查是否需要锁定
  if (easytierStore.lockPassword && isFirstLoad.value) {
    isLocked.value = true
  }

  // 检查是否启动后最小化到托盘
  const minimizeOnStart = localStorage.getItem('settings.minimizeOnStart') === 'true'
  if (minimizeOnStart) {
    const window = getCurrentWindow()
    await window.hide().catch((e) => {
      console.error('Failed to hide window:', e)
    })
  }
})
</script>

<template>
  <ConfigGlobal :size="currentSize">
    <RouterView v-if="!isLocked" :class="greyMode ? `${prefixCls}-grey-mode` : ''" />
    <div v-else class="lock-screen">
      <div class="lock-container">
        <h2>软件已锁定</h2>
        <el-input
          v-model="inputPassword"
          type="password"
          placeholder="请输入解锁密码"
          show-password
          @keyup.enter="unlock"
          style="width: 250px; margin-bottom: 20px"
        />
        <br />
        <el-button type="primary" @click="unlock">解锁</el-button>
      </div>
    </div>
  </ConfigGlobal>
</template>

<style lang="less">
@prefix-cls: ~'@{adminNamespace}-app';

.size {
  width: 100%;
  height: 100%;
}

html,
body {
  padding: 0 !important;
  margin: 0;
  overflow: hidden;
  .size;

  #app {
    .size;
  }
}

.@{prefix-cls}-grey-mode {
  filter: grayscale(100%);
}

.lock-screen {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  display: flex;
  width: 100%;
  height: 100%;
  background-color: rgb(255 255 255 / 70%);
  backdrop-filter: blur(10px);
  justify-content: center;
  align-items: center;
}

.lock-container {
  width: 350px;
  padding: 50px;
  text-align: center;
  background: rgb(255 255 255 / 90%);
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 10%);

  h2 {
    margin-bottom: 30px;
    font-weight: 600;
    color: #333;
  }
}
</style>
