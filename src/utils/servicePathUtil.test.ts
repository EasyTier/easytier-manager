import assert from 'node:assert/strict'
import {
  buildServiceConfigQueryCommand,
  isServiceConfigMatched,
  normalizeWinPath,
  toServicePathConfig,
  type ServicePathConfig
} from './servicePathUtil'

// 路径归一化:引号、扩展长度前缀、分隔符、大小写、尾部斜杠
assert.equal(
  normalizeWinPath('"D:\\Program Files\\easytier-manager-pro\\resource\\nssm.exe"'),
  'd:\\program files\\easytier-manager-pro\\resource\\nssm.exe'
)
assert.equal(
  normalizeWinPath('\\\\?\\D:\\easytier-manager-pro\\resource\\nssm.exe'),
  'd:\\easytier-manager-pro\\resource\\nssm.exe'
)
assert.equal(normalizeWinPath('\\\\?\\UNC\\server\\share\\nssm.exe'), '\\\\server\\share\\nssm.exe')
assert.equal(
  normalizeWinPath('D:/easytier-manager-pro/resource/'),
  'd:\\easytier-manager-pro\\resource'
)
assert.equal(normalizeWinPath('D:\\'), 'd:\\')
assert.equal(normalizeWinPath(''), '')

// 服务配置解析:服务不存在时返回 undefined
assert.equal(toServicePathConfig(null), undefined)
assert.equal(toServicePathConfig({ imagePath: null }), undefined)

const parsed: ServicePathConfig = toServicePathConfig({
  imagePath: 'D:\\easytier-manager-pro\\resource\\nssm.exe',
  application: 'D:\\easytier-manager-pro\\resource\\easytier-core.exe',
  appDirectory: 'D:\\easytier-manager-pro\\resource',
  appParameters: '--file-log-level info --config-file "D:\\easytier-manager-pro\\config\\a.toml"'
})!
assert.equal(parsed.appDirectory, 'D:\\easytier-manager-pro\\resource')

const currentInstall: ServicePathConfig = {
  imagePath: '\\\\?\\D:\\easytier-manager-pro\\resource\\nssm.exe',
  application: 'D:\\easytier-manager-pro\\resource\\easytier-core.exe',
  appDirectory: 'D:/easytier-manager-pro/resource',
  appParameters: '--file-log-level info --config-file "D:\\easytier-manager-pro\\config\\a.toml"'
}

// 同一位置的不同写法应判定为一致(大小写/分隔符/引号/扩展前缀)
assert.equal(
  isServiceConfigMatched(
    {
      imagePath: '"D:\\EasyTier-Manager-Pro\\resource\\nssm.exe"',
      application: 'D:\\easytier-manager-pro\\resource\\easytier-core.exe',
      appDirectory: 'D:\\easytier-manager-pro\\resource\\',
      appParameters: currentInstall.appParameters
    },
    currentInstall
  ),
  true
)

// 指向旧安装目录的服务必须判定为不一致,才能触发移除重装
assert.equal(
  isServiceConfigMatched(
    {
      imagePath: 'D:\\Program Files\\easytier-manager-pro\\resource\\nssm.exe',
      application: 'D:\\Program Files\\easytier-manager-pro\\resource\\easytier-core.exe',
      appDirectory: 'D:\\Program Files\\easytier-manager-pro\\resource',
      appParameters: '--config-file "D:\\Program Files\\easytier-manager-pro\\config\\a.toml"'
    },
    currentInstall
  ),
  false
)

// 参数不一致同样视为不一致
assert.equal(
  isServiceConfigMatched(
    { ...currentInstall, appParameters: '--config-file "D:\\other\\a.toml"' },
    currentInstall
  ),
  false
)

// 服务不存在/读取失败时不能当作已就绪
assert.equal(isServiceConfigMatched(undefined, currentInstall), false)
assert.equal(
  isServiceConfigMatched({ application: currentInstall.application }, currentInstall),
  false
)

// PowerShell 查询命令:服务名中的单引号需转义
const command = buildServiceConfigQueryCommand("easy'tier-x")
assert.ok(command.includes("$n='easy''tier-x'"))
assert.ok(command.includes('ConvertTo-Json -Compress'))

console.log('service path util tests passed')
