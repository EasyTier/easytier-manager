import assert from 'node:assert/strict'
import { DEFAULT_RPC_PORTAL, normalizeRpcPortal } from './rpcPortal'

assert.equal(normalizeRpcPortal(), DEFAULT_RPC_PORTAL)
assert.equal(normalizeRpcPortal('  '), DEFAULT_RPC_PORTAL)
assert.equal(normalizeRpcPortal('0.0.0.0:15888'), DEFAULT_RPC_PORTAL)
assert.equal(normalizeRpcPortal('[::]:15888'), DEFAULT_RPC_PORTAL)
assert.equal(normalizeRpcPortal('127.0.0.1:15900'), '127.0.0.1:15900')

console.log('rpc portal normalization tests passed')
