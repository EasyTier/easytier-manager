import 'vue/jsx'

// 引入windi css
import '@/plugins/unocss'

// 导入全局的svg图标
import '@/plugins/svgIcon'

// 初始化多语言
import { setupI18n } from '@/plugins/vueI18n'

// 引入状态管理
import { setupStore } from '@/store'

// 全局组件
import { setupGlobCom } from '@/components'

// 引入element-plus
import { setupElementPlus } from '@/plugins/elementPlus'

// 引入全局样式
import '@/styles/index.less'

// 引入动画
import '@/plugins/animate.css'

// 路由
import { setupRouter } from './router'

// 权限
import { setupPermission } from './directives'

import { createApp } from 'vue'

import App from './App.vue'

import './permission'
import { clearLogs } from './utils/fileUtil'
import { useStorage } from '@/hooks/web/useStorage'
import { useEasyTierStore } from '@/store/modules/easytier'

// 引入 Tauri API
import { getCurrentWindow } from '@tauri-apps/api/window'

// 创建实例
const setupAll = async () => {
  await clearLogs()

  const app = createApp(App)

  await setupI18n(app)

  setupStore(app)

  const easyTierStore = useEasyTierStore()

  setupGlobCom(app)

  setupElementPlus(app)

  setupRouter(app)

  setupPermission(app)

  app.mount('#app')

  // 检查启动设置
  const { getStorage } = useStorage('localStorage')

  // 1. 启动后最小化
  if (getStorage('settings.minimizeOnStart') === 'true') {
    // 延迟一下确保窗口已经创建
    setTimeout(() => {
      getCurrentWindow().hide()
    }, 100)
  }

  // 2. 启动后自动运行网络
  if (getStorage('settings.autoRunNetwork') === 'true') {
    easyTierStore.autorun()
  }
}

setupAll()
