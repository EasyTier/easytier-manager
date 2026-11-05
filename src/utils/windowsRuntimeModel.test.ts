import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyProcess,
  configRuntime,
  directStartBlock,
  serviceActionBlock,
  type WindowsSnapshot,
  type WindowsProcess,
  type WindowsService
} from './windowsRuntimeModel'

const config = 'C:\\EasyTier\\config\\alpha.toml'
const core: WindowsProcess = {
  pid: 100,
  parentPid: 50,
  name: 'easytier-core.exe',
  commandLine: `easytier-core.exe --config-file "${config}"`
}
const service: WindowsService = {
  name: 'easytier-alpha',
  pid: 50,
  state: 'Running',
  imagePath: 'C:\\EasyTier\\resource\\nssm.exe',
  application: 'C:\\EasyTier\\resource\\easytier-core.exe',
  args: `--config-file "${config}"`,
  configKnown: true,
  nssm: true
}
const snapshot = (
  processes: WindowsProcess[] = [],
  services: WindowsService[] = []
): WindowsSnapshot => ({ processes, services, processesKnown: true, servicesKnown: true })

test('NSSM core child belongs to the service; wrapper is not a second core instance', () => {
  const state = snapshot(
    [core, { pid: 50, parentPid: 4, name: 'nssm.exe', commandLine: '' }],
    [service]
  )
  assert.equal(classifyProcess(state, core), 'service')
  assert.equal(configRuntime(state, config).mode, 'service')
  assert.equal(state.processes.filter((p) => p.name === 'easytier-core.exe').length, 1)
})
test('walks intermediate wrapper children and handles official SCM core PID', () => {
  const intermediate = { pid: 50, parentPid: 40, name: 'cmd.exe', commandLine: '' }
  assert.equal(
    classifyProcess(snapshot([core, intermediate], [{ ...service, pid: 40 }]), core),
    'service'
  )
  const official = { ...service, nssm: false, pid: 100, imagePath: core.commandLine! }
  assert.equal(configRuntime(snapshot([core], [official]), config).mode, 'service')
})
test('registration is independent from process source and uses full paths', () => {
  const state = configRuntime(snapshot([core], [{ ...service, pid: 0, state: 'Stopped' }]), config)
  assert.equal(state.mode, 'direct')
  assert.equal(state.registration, 'installed')
  const other = configRuntime(snapshot([core], [service]), 'D:\\Other\\config\\alpha.toml')
  assert.equal(other.mode, 'stopped')
  assert.equal(other.registration, 'absent')
})
test('queries denied or missing command lines stay unknown', () => {
  for (const broken of [
    { ...snapshot([core]), servicesKnown: false },
    { ...snapshot(), processesKnown: false },
    snapshot([{ ...core, commandLine: null }]),
    snapshot([core, { pid: 50, parentPid: 4, name: 'nssm.exe', commandLine: '' }])
  ]) {
    assert.equal(configRuntime(broken, config).mode, 'unknown')
    assert.equal(directStartBlock(configRuntime(broken, config)), 'runtime.unknownBlocked')
  }
})
test('automatic start skips stopped and pending services even without a core PID', () => {
  for (const state of ['Stopped', 'Start Pending', 'Running', 'Stop Pending']) {
    const runtime = configRuntime(snapshot([], [{ ...service, pid: 0, state }]), config)
    assert.equal(runtime.mode, 'stopped')
    assert.equal(directStartBlock(runtime, true), 'runtime.autoSkipped')
    assert.equal(
      directStartBlock(runtime),
      state === 'Stopped' ? undefined : 'runtime.manageService'
    )
  }
  assert.equal(directStartBlock(configRuntime(snapshot(), config), true), undefined)
})
test('NSSM relative config resolves from AppDirectory; case and extended paths match', () => {
  const relative = {
    ...service,
    args: '--config-file "..\\config\\alpha.toml"',
    directory: 'C:\\EasyTier\\resource'
  }
  assert.equal(
    configRuntime(snapshot([], [relative]), '\\\\?\\c:\\easytier\\CONFIG\\ALPHA.TOML').registration,
    'installed'
  )
})
test('mixed direct/service instances and unresolvable service config fail closed', () => {
  const second = { ...core, pid: 200, parentPid: 999 }
  assert.equal(configRuntime(snapshot([core, second], [service]), config).mode, 'unknown')
  const runtime = configRuntime(
    snapshot([], [{ ...service, configKnown: false, args: '' }]),
    config
  )
  assert.equal(runtime.registration, 'unknown')
  assert.equal(directStartBlock(runtime, true), 'runtime.unknownBlocked')
})
test('reused parent PID does not falsely turn a direct process into a service', () => {
  const child = { ...core, created: '2026-01-01T00:00:00Z' }
  const parent = {
    pid: 50,
    parentPid: 0,
    name: 'nssm.exe',
    commandLine: '',
    created: '2026-01-02T00:00:00Z'
  }
  assert.equal(classifyProcess(snapshot([child, parent], [service]), child), 'direct')
})

test('service start is blocked while direct run exists, and absent/unknown services cannot be operated', () => {
  const registered = configRuntime(
    snapshot([core], [{ ...service, pid: 0, state: 'Stopped' }]),
    config
  )
  assert.equal(serviceActionBlock(registered, 'start'), 'runtime.stopDirectFirst')
  for (const action of ['start', 'stop'] as const) {
    assert.equal(
      serviceActionBlock(configRuntime(snapshot(), config), action),
      'runtime.unknownBlocked'
    )
    assert.equal(
      serviceActionBlock({ ...registered, registration: 'unknown' }, action),
      'runtime.unknownBlocked'
    )
  }
  assert.equal(serviceActionBlock({ ...registered, mode: 'stopped' }, 'start'), undefined)
  assert.equal(
    serviceActionBlock(configRuntime(snapshot([core], [service]), config), 'stop'),
    undefined
  )
})
