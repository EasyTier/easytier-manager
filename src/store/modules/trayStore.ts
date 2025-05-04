import pkg from '@/../package.json'
import { defaultWindowIcon } from '@tauri-apps/api/app'
import { Menu } from '@tauri-apps/api/menu'
import { TrayIcon } from '@tauri-apps/api/tray'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { saveWindowState, StateFlags } from '@tauri-apps/plugin-window-state'
import { defineStore } from 'pinia'

// 托盘状态管理
export const useTrayStore = defineStore(
  'tray',
  () => {
    const DEFAULT_TRAY_NAME = 'main'
    const getTray = async () => {
      return await TrayIcon.getById(DEFAULT_TRAY_NAME)
    }
    // 退出应用程序
    const onQuit = async () => {
      await saveWindowState(StateFlags.ALL)
      await getCurrentWindow().destroy()
    }

    // 切换窗口显示/隐藏状态
    const toggleVisibility = async () => {
      const window = getCurrentWindow()
      console.log('window', window)

      const isVisible = await window.isVisible()
      const isMinimized = await window.isMinimized()
      if (!isVisible || isMinimized) {
        // 确保窗口显示并取消最小化
        await window.show()
        await window.unminimize()
        // 恢复任务栏图标
        await window.setSkipTaskbar(false)
        await window.setFocus()
      } else {
        // 先隐藏窗口再最小化
        await window.hide()
        await window.minimize()
        // 隐藏任务栏图标
        await window.setSkipTaskbar(true)
      }
    }

    // 处理窗口关闭事件
    const handleWindowClose = async () => {
      const window = getCurrentWindow()

      // 监听窗口关闭事件
      await window.onCloseRequested(async (event) => {
        // 阻止默认关闭行为
        event.preventDefault()
        // 先隐藏窗口再最小化
        await window.hide()
        await window.minimize()
        // 隐藏任务栏图标
        await window.setSkipTaskbar(true)
      })
    }

    // 保存事件处理函数的引用
    const trayEventHandler = async (event: any) => {
      if (event.type === 'Click' || event.type === 'DoubleClick') {
        if (event.button === 'Left') {
          await toggleVisibility()
        }
      }
    }
    // 设置托盘图标
    const setTrayIcon = async (trayInstance?: TrayIcon | null) => {
      if (!trayInstance) {
        trayInstance = await getTray()
      }
      try {
        // 使用绝对路径
        const iconPath = (await import.meta.env.PROD)
          ? `${process.cwd()}/resources/icons/icon.ico`
          : 'icons/icon.ico'
        await trayInstance?.setIcon(iconPath)
      } catch (error) {
        console.error('设置托盘图标失败:', error)
      }
    }

    // 设置托盘图标状态
    const setTrayIconState = async (isRunning: boolean = false, trayInstance?: TrayIcon | null) => {
      if (!trayInstance) {
        trayInstance = await getTray()
      }
      try {
        const iconName = isRunning ? 'icon-inactive.ico' : 'icon.ico'
        const iconPath = (await import.meta.env.PROD)
          ? `${process.cwd()}/resources/icons/${iconName}`
          : `icons/${iconName}`
        await trayInstance?.setIcon(iconPath)
      } catch (error) {
        console.error('设置托盘图标状态失败:', error)
      }
    }

    // 设置托盘提示文本
    const setTrayTooltip = async (tooltip?: string | undefined, trayInstance?: TrayIcon | null) => {
      if (!trayInstance) {
        trayInstance = await getTray()
      }
      try {
        if (tooltip) {
          await trayInstance?.setTooltip(`${pkg.displayName}\n${pkg.version}\n${tooltip}`)
        } else {
          await trayInstance?.setTooltip(`${pkg.displayName}\n${pkg.version}`)
        }
      } catch (error) {
        console.error('设置托盘提示文本失败:', error)
      }
    }

    // 右键菜单配置
    const menuItems = {
      items: [
        {
          id: 'open',
          text: '显示 / 隐藏',
          action: toggleVisibility
        },
        {
          id: 'quit',
          text: '退出',
          action: onQuit
        }
      ]
    }
    // 销毁托盘
    // const destroyTray = async () => {
    //   try {
    //     await TrayIcon.removeById(DEFAULT_TRAY_NAME)
    //     tray = null
    //   } catch (error) {
    //     console.error('销毁托盘时发生错误:', error)
    //     // 确保状态被重置
    //     tray = null
    //   }
    // }

    // 初始化托盘
    const initTray = async () => {
      let tray: TrayIcon | null = null
      // 检查托盘是否已存在
      try {
        tray = await getTray()
        if (tray) {
          return
        }
      } catch (_error) {
        // 托盘不存在，继续创建
      }
      try {
        const menu = await Menu.new(menuItems)
        const options = {
          id: DEFAULT_TRAY_NAME,
          title: pkg.displayName,
          tooltip: `${pkg.displayName}\n${pkg.version}`,
          menu,
          menuOnLeftClick: false,
          action: trayEventHandler
        }

        tray = await TrayIcon.new(options)
        tray.setIcon(await defaultWindowIcon())
        // await setTrayIcon(tray)
        await setTrayTooltip(undefined, tray)
        handleWindowClose()
      } catch (error) {
        console.error('初始化托盘失败:', error)
      }
    }

    return {
      initTray,
      getTray,
      setTrayIcon,
      setTrayIconState,
      setTrayTooltip
    }
  },
  {
    persist: {
      key: 'tray',
      storage: localStorage
      // pick: ['tray']
    }
  }
)
