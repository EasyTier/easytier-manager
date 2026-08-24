export const DEFAULT_RPC_PORTAL = '127.0.0.1:15888'

/** Resolve the address used by easytier-cli, including EasyTier Core's default. */
export function normalizeRpcPortal(portal?: string | null): string {
  const value = String(portal || '').trim()
  if (!value) return DEFAULT_RPC_PORTAL
  return value.replace(/^0\.0\.0\.0/, '127.0.0.1').replace(/^\[?::\]?/, '127.0.0.1')
}
