import assert from 'node:assert/strict'
import { appendFileLogLimitArgs, toPositiveInt } from './logArgsUtil'

// 合法值：数字、数字字符串均解析为整数
assert.equal(toPositiveInt(5), 5)
assert.equal(toPositiveInt('20'), 20)
assert.equal(toPositiveInt(3.9), 3)

// 非法值：空值、非数字、非正数都交给内核默认值
assert.equal(toPositiveInt(undefined), undefined)
assert.equal(toPositiveInt(null), undefined)
assert.equal(toPositiveInt(''), undefined)
assert.equal(toPositiveInt('abc'), undefined)
assert.equal(toPositiveInt(0), undefined)
assert.equal(toPositiveInt(-1), undefined)

// 未配置时不追加任何参数
assert.deepEqual(appendFileLogLimitArgs([]), [])
assert.deepEqual(appendFileLogLimitArgs([], undefined, 0), [])

// 只配置一项时只追加对应参数
assert.deepEqual(appendFileLogLimitArgs([], 5), ['--file-log-size', '5'])
assert.deepEqual(appendFileLogLimitArgs([], undefined, 3), ['--file-log-count', '3'])

// 两项都配置时按顺序追加
assert.deepEqual(appendFileLogLimitArgs([], 5, 3), [
  '--file-log-size',
  '5',
  '--file-log-count',
  '3'
])

console.log('log args tests passed')
