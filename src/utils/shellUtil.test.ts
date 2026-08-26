import assert from 'node:assert/strict'
import { extractConfigPath, parseCoreCommandLine } from './coreProcess'

const macosCommand =
  '/Users/dragon/Library/Application Support/easytier-manager-pro/resource/current/easytier-core ' +
  '--file-log-level info --config-file ' +
  '/Users/dragon/Library/Application Support/easytier-manager-pro/config/network-one.toml'

assert.equal(
  extractConfigPath(macosCommand),
  '/Users/dragon/Library/Application Support/easytier-manager-pro/config/network-one.toml'
)
assert.deepEqual(parseCoreCommandLine(macosCommand), {
  configPath:
    '/Users/dragon/Library/Application Support/easytier-manager-pro/config/network-one.toml',
  configFileName: 'network-one',
  fileName: 'network-one.toml',
  rpcPortal: undefined
})

assert.equal(
  extractConfigPath('easytier-core -c "C:\\EasyTier Config\\office.toml"'),
  'C:\\EasyTier Config\\office.toml'
)

console.log('core command line parsing tests passed')
