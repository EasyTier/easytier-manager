<script setup lang="ts">
import { computed } from 'vue'
import { Collapse } from '@/components/Collapse'
import { LocaleDropdown } from '@/components/LocaleDropdown'
import { SizeDropdown } from '@/components/SizeDropdown'
import { Breadcrumb } from '@/components/Breadcrumb'
import { useAppStore } from '@/store/modules/app'
import { useDesign } from '@/hooks/web/useDesign'
import { open } from '@tauri-apps/plugin-shell'
import { Icon } from '@/components/Icon'

const { getPrefixCls, variables } = useDesign()
const prefixCls = getPrefixCls('tool-header')
const appStore = useAppStore()

// 计算属性
const breadcrumb = computed(() => appStore.getBreadcrumb)
const hamburger = computed(() => appStore.getHamburger)
// const screenfull = computed(() => appStore.getScreenfull)
const size = computed(() => appStore.getSize)
const layout = computed(() => appStore.getLayout)
const locale = computed(() => appStore.getLocale)

// 方法
const toDocumentEasytierManager = () => open('https://github.com/xlc520/easytier-manager')
const toDocumentEasyTier = () => open('https://github.com/EasyTier/EasyTier')
</script>

<template>
  <div
    :id="`${variables.namespace}-tool-header`"
    :class="[
      prefixCls,
      'h-[var(--top-tool-height)] relative px-[var(--top-tool-p-x)] flex items-center justify-between'
    ]"
  >
    <div v-if="layout !== 'top'" class="h-full flex items-center">
      <Collapse
        v-if="hamburger && layout !== 'cutMenu'"
        class="custom-hover"
        color="var(--top-header-text-color)"
      />
      <Breadcrumb v-if="breadcrumb" class="<md:hidden" />
    </div>
    <div class="h-full flex items-center">
      <!-- <Screenfull v-if="screenfull" class="custom-hover" color="var(--top-header-text-color)" /> -->
      <SizeDropdown v-if="size" class="custom-hover" color="var(--top-header-text-color)" />
      <LocaleDropdown v-if="locale" class="custom-hover" color="var(--top-header-text-color)" />
      <div class="custom-hover" @click="toDocumentEasyTier">
        <el-tooltip trigger="click" content="EasyTier Github" placement="bottom" effect="light">
          <Icon :size="18" icon="devicon:github" class="cursor-pointer" />
        </el-tooltip>
      </div>
      <div class="mr-10 custom-hover" @click="toDocumentEasytierManager">
        <el-tooltip
          trigger="click"
          content="EasyTier 管理器 Github"
          placement="bottom"
          effect="light"
        >
          <Icon :size="18" icon="devicon:github" class="cursor-pointer" />
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
@prefix-cls: ~'@{adminNamespace}-tool-header';

.@{prefix-cls} {
  transition: left var(--transition-time-02);
}
</style>
