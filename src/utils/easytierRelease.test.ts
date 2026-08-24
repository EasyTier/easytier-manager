import assert from 'node:assert/strict'
import { normalizeCoreReleases } from './easytierRelease'

const digest = `sha256:${'a'.repeat(64)}`
const macosAsset = (tagName: string) => ({
  name: `easytier-macos-aarch64-${tagName}.zip`,
  digest
})

const releases = normalizeCoreReleases(
  [
    {
      tag_name: 'v2.6.3',
      name: 'v2.6.3',
      draft: false,
      prerelease: true,
      assets: [macosAsset('v2.6.3')]
    },
    {
      tag_name: 'v2.6.4',
      name: 'v2.6.4',
      draft: false,
      prerelease: false,
      assets: [macosAsset('v2.6.4')]
    },
    {
      tag_name: 'v2.6.4',
      name: 'duplicate',
      draft: false,
      prerelease: false,
      assets: [macosAsset('v2.6.4')]
    },
    {
      tag_name: 'v9.0.0',
      name: 'draft',
      draft: true,
      prerelease: false,
      assets: [macosAsset('v9.0.0')]
    },
    {
      tag_name: 'v8.0.0',
      name: 'wrong platform',
      draft: false,
      prerelease: false,
      assets: [{ name: 'easytier-linux-x86_64-v8.0.0.zip', digest }]
    },
    {
      tag_name: 'v7.0.0',
      name: 'invalid digest',
      draft: false,
      prerelease: false,
      assets: [{ name: 'easytier-macos-aarch64-v7.0.0.zip', digest: 'sha256:invalid' }]
    }
  ],
  'macos',
  'aarch64'
)

assert.deepEqual(
  releases.map((release) => release.tag_name),
  ['v2.6.4', 'v2.6.3']
)
assert.deepEqual(
  releases.filter((release) => !release.prerelease).map((release) => release.tag_name),
  ['v2.6.4']
)

console.log('release normalization tests passed')
