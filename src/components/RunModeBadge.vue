<script setup lang="ts">
import { useI18n } from '@/hooks/web/useI18n'
import type { RunMode } from '@/utils/windowsRuntimeModel'
defineProps<{ mode: RunMode; showLabel?: boolean }>()
const { t } = useI18n()
</script>

<template>
  <span class="inline-flex items-center gap-6px">
    <span v-if="showLabel !== false">{{ t('runtime.label') }}:</span>
    <el-tag :type="mode === 'unknown' ? 'warning' : 'info'" size="small">
      {{ t('runtime.' + mode) }}
    </el-tag>
    <el-popover :trigger="['hover', 'click']" :width="330" placement="bottom">
      <template #reference>
        <el-button circle text size="small" :aria-label="t('runtime.help')">?</el-button>
      </template>
      <p>{{ t('runtime.directHelp') }}</p>
      <p class="mt-8px">{{ t('runtime.serviceHelp') }}</p>
      <p class="mt-8px">{{ t('runtime.manageService') }}</p>
    </el-popover>
  </span>
</template>
