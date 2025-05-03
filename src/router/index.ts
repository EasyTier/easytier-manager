import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'
import type { App } from 'vue'
import { Layout } from '@/utils/routerHelper'
import { useI18n } from '@/hooks/web/useI18n'
import { NO_RESET_WHITE_LIST } from '@/constants'

const { t } = useI18n()

export const constantRouterMap: AppRouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    name: 'Index',
    meta: {},
    children: [
      {
        path: '',
        component: () => import('@/views/index/index.vue'),
        name: 'UserIndex',
        meta: {
          title: t('router.workplace'),
          icon: 'la:network-wired'
        }
      }
    ]
  },
  {
    path: '/config',
    component: Layout,
    name: 'config',
    meta: {},
    children: [
      {
        path: '',
        component: () => import('@/views/config/index.vue'),
        name: 'UserConfig',
        meta: {
          title: t('easytier.config'),
          icon: 'hugeicons:google-doc'
        }
      }
    ]
  },
  {
    path: '/configWeb',
    component: Layout,
    name: 'configWeb',
    meta: {},
    children: [
      {
        path: '',
        component: () => import('@/views/configWeb/index.vue'),
        name: 'UserWebConfig',
        meta: {
          title: t('easytier.configWeb'),
          icon: 'hugeicons:google-doc'
        }
      }
    ]
  },
  {
    path: '/setting',
    component: Layout,
    name: 'setting',
    meta: {},
    children: [
      {
        path: '',
        component: () => import('@/views/setting/index.vue'),
        name: 'UserSetting',
        meta: {
          title: t('common.setting'),
          icon: 'tdesign:setting-1'
        }
      }
    ]
  }
]

export const asyncRouterMap: AppRouteRecordRaw[] = []

const router = createRouter({
  history: createWebHashHistory(),
  strict: true,
  routes: constantRouterMap as RouteRecordRaw[],
  scrollBehavior: () => ({ left: 0, top: 0 })
})

export const resetRouter = (): void => {
  router.getRoutes().forEach((route) => {
    const { name } = route
    if (name && !NO_RESET_WHITE_LIST.includes(name as string)) {
      router.hasRoute(name) && router.removeRoute(name)
    }
  })
}

export const setupRouter = (app: App<Element>) => {
  app.use(router)
}

export default router
