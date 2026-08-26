export interface CoreReleaseAsset {
  name: string
  digest?: string | null
}

export interface CoreRelease {
  id?: number
  tag_name: string
  name: string
  draft: boolean
  prerelease: boolean
  created_at?: string
  published_at?: string
  assets: CoreReleaseAsset[]
}

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: string
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f\d]{64}$/i
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

const parseVersion = (tagName: string): ParsedVersion | null => {
  const match = VERSION_PATTERN.exec(tagName)
  if (!match) return null

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || ''
  }
}

const compareVersionsDescending = (left: CoreRelease, right: CoreRelease) => {
  const leftVersion = parseVersion(left.tag_name)
  const rightVersion = parseVersion(right.tag_name)
  if (!leftVersion || !rightVersion) return right.tag_name.localeCompare(left.tag_name)

  for (const field of ['major', 'minor', 'patch'] as const) {
    if (leftVersion[field] !== rightVersion[field]) {
      return rightVersion[field] - leftVersion[field]
    }
  }

  if (!leftVersion.prerelease && rightVersion.prerelease) return -1
  if (leftVersion.prerelease && !rightVersion.prerelease) return 1
  return rightVersion.prerelease.localeCompare(leftVersion.prerelease, undefined, { numeric: true })
}

export const getCoreAssetName = (osType: string, osArch: string, version: string) =>
  `easytier-${osType}-${osArch}-${version}.zip`

export const normalizeCoreReleases = (
  value: unknown,
  osType: string,
  osArch: string
): CoreRelease[] => {
  if (!Array.isArray(value)) return []

  const releases = new Map<string, CoreRelease>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue

    const release = item as Partial<CoreRelease>
    if (
      typeof release.tag_name !== 'string' ||
      !parseVersion(release.tag_name) ||
      release.draft === true ||
      !Array.isArray(release.assets)
    ) {
      continue
    }

    const assetName = getCoreAssetName(osType, osArch, release.tag_name)
    const hasVerifiedAsset = release.assets.some(
      (asset) =>
        asset?.name === assetName &&
        typeof asset.digest === 'string' &&
        SHA256_DIGEST_PATTERN.test(asset.digest)
    )
    if (!hasVerifiedAsset || releases.has(release.tag_name)) continue

    releases.set(release.tag_name, {
      ...release,
      name: release.name || release.tag_name,
      draft: false,
      prerelease: release.prerelease === true,
      assets: release.assets
    } as CoreRelease)
  }

  return [...releases.values()].sort(compareVersionsDescending)
}
