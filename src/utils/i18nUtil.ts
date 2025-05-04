// src/utils/i18n.ts
import { i18n } from '@/plugins/vueI18n'

export const t = (key: string) => {
  // @ts-ignore
  return i18n.global.t(key)
}
