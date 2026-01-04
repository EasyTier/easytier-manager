import { resolve } from 'path'
import type { ConfigEnv, UserConfig } from 'vite'
import { loadEnv } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import progress from 'vite-plugin-progress'
import EslintPlugin from 'vite-plugin-eslint'
import { ViteEjsPlugin } from 'vite-plugin-ejs'
import PurgeIcons from 'vite-plugin-purge-icons'
import ServerUrlCopy from 'vite-plugin-url-copy'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import { createStyleImportPlugin, ElementPlusResolve } from 'vite-plugin-style-import'
import UnoCSS from 'unocss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import VueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
const root = process.cwd()

function pathResolve(dir: string) {
  return resolve(root, '.', dir)
}

export default ({ command, mode }: ConfigEnv): UserConfig => {
  let env = {} as any
  const isBuild = command === 'build'
  if (!isBuild) {
    env = loadEnv(process.argv[3] === '--mode' ? process.argv[4] : process.argv[3], root)
  } else {
    env = loadEnv(mode, root)
  }
  return {
    base: env.VITE_BASE_PATH,
    plugins: [
      Vue({
        script: {
          // 开启defineModel
          defineModel: true
        }
      }),
      VueJsx(),
      ServerUrlCopy(),
      isBuild ? undefined : progress(),
      isBuild
        ? undefined
        : VueDevTools({
            // 启用 Vue DevTools
            componentInspector: true
            // 将默认编辑器从 VS Code 更改为 WebStorm
            // launchEditor: 'webstorm'
          }),
      env.VITE_USE_ALL_ELEMENT_PLUS_STYLE === 'false'
        ? createStyleImportPlugin({
            resolves: [ElementPlusResolve()],
            libs: [
              {
                libraryName: 'element-plus',
                esModule: true,
                resolveStyle: (name) => {
                  if (name === 'click-outside') {
                    return ''
                  }
                  return `element-plus/es/components/${name.replace(/^el-/, '')}/style/css`
                }
              }
            ]
          })
        : undefined,
      isBuild
        ? undefined
        : EslintPlugin({
            cache: false,
            failOnWarning: false,
            failOnError: false,
            include: ['src/**/*.vue', 'src/**/*.ts', 'src/**/*.tsx'] // 检查的文件
          }),
      VueI18nPlugin({
        runtimeOnly: true,
        compositionOnly: true,
        include: [resolve(__dirname, 'src/locales/**')]
      }),
      createSvgIconsPlugin({
        iconDirs: [pathResolve('src/assets/svgs')],
        symbolId: 'icon-[dir]-[name]',
        svgoOptions: true
      }),
      PurgeIcons(),
      ViteEjsPlugin({
        title: env.VITE_APP_TITLE
      }),
      UnoCSS()
    ],

    css: {
      preprocessorOptions: {
        less: {
          additionalData: `@import "${pathResolve('src/styles/variables.module.less').replace(/\\/g, '/')}";`,
          javascriptEnabled: true,
          math: 'always'
        }
      }
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.less', '.css'],
      alias: [
        {
          find: 'vue-i18n',
          replacement: 'vue-i18n/dist/vue-i18n.cjs.js'
        },
        {
          find: /\@\//,
          replacement: `${pathResolve('src')}/`
        }
      ]
    },
    esbuild: {
      pure: env.VITE_DROP_CONSOLE === 'true' ? ['console.log'] : undefined,
      drop: env.VITE_DROP_DEBUGGER === 'true' ? ['debugger'] : undefined
    },
    build: {
      target: 'ESNext',
      outDir: env.VITE_OUT_DIR || 'dist',
      assetsDir: 'assets',
      sourcemap: env.VITE_SOURCEMAP === 'true',
      // 使用 esbuild 作为压缩器，比 terser 快 20-40 倍
      minify: 'esbuild',
      reportCompressedSize: false, // 禁用 gzip 压缩大小报告，提升打包速度
      chunkSizeWarningLimit: 2000, // 调整 chunk 大小警告的限制
      // 启用多线程打包
      // brotliSize: false,
      // 开启实验性的并行构建功能
      // experimentalParallelBuild: true,
      // terserOptions: {
      //   compress: {
      //     drop_console: env.VITE_DROP_CONSOLE === 'true',
      //     drop_debugger: env.VITE_DROP_DEBUGGER === 'true'
      //   }
      // },
      rollupOptions: {
        maxParallelFileOps: 3,
        plugins: env.VITE_USE_BUNDLE_ANALYZER === 'true' ? [visualizer()] : undefined,
        // 拆包
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('element-plus')) {
                return 'element-plus'
              }
              if (
                id.includes('vue') ||
                id.includes('pinia') ||
                id.includes('vue-router') ||
                id.includes('vue-i18n')
              ) {
                return 'vue-chunks'
              }
              // Monaco Editor 不分割语言模块，避免循环依赖
              if (id.includes('monaco-editor')) {
                return 'monaco-editor'
              }
              // 将较大的第三方库单独拆分，避免 vendor 过大
              const largeLibs = ['xgplayer', 'cropperjs', 'axios', 'qs', 'qrcode', '@zxcvbn-ts']
              if (largeLibs.some((lib) => id.includes(lib))) {
                return 'libs'
              }
              return 'vendor'
            }
          }
        }
        // output: {
        //   manualChunks: undefined, // 禁用代码分割
        //   chunkFileNames: 'assets/js/[name]-[hash].js',
        //   entryFileNames: 'assets/js/[name]-[hash].js',
        //   assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
        // }
      },
      cssCodeSplit: !(env.VITE_USE_CSS_SPLIT === 'false')
      // cssTarget: ['chrome31']
    },
    worker: {
      format: 'es'
    },
    server: {
      port: 4000,
      host: '0.0.0.0',
      proxy: {
        // 选项写法
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      hmr: {
        overlay: false
      },
      watch: {
        // tell vite to ignore watching `src-tauri`
        ignored: ['**/src-tauri/**']
      }
    },
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'vue-types',
        'element-plus/es/locale/lang/zh-cn',
        'element-plus/es/locale/lang/en',
        '@iconify/iconify',
        '@vueuse/core',
        'axios',
        'qs',
        'qrcode',
        'vue-json-pretty',
        '@zxcvbn-ts/core',
        'dayjs',
        'cropperjs'
      ]
    },
    clearScreen: false,
    // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
    envPrefix: ['VITE_', 'TAURI_ENV_*']
  }
}
