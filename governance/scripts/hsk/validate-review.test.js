const assert = require('node:assert/strict')
const { test } = require('node:test')
const { classifyMembership, ReadOnlyProvider } = require('./validate-review')

const fixture = {
  supply: 1n,
  token1Owner: '0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe',
  expiration: 100n,
  balance: 1n,
  valid: true,
}

test('unexpired proof is active', () => {
  assert.equal(classifyMembership(fixture, 99, 100n), 'active test membership')
})
test('normal expiration is not deployment failure, including exact boundary', () => {
  assert.equal(
    classifyMembership({ ...fixture, balance: 0n, valid: false }, 100, 100n),
    'expired test membership'
  )
})
test('inconsistent validity is rejected', () => {
  assert.throws(() => classifyMembership(fixture, 101, 100n))
})
test('changed expiration is not mislabeled as natural expiry', () => {
  assert.match(
    classifyMembership(
      { ...fixture, expiration: 50n, valid: false, balance: 0n },
      99,
      100n
    ),
    /changed/
  )
})
test('read-only provider rejects transaction methods before any network request', async () => {
  const provider = new ReadOnlyProvider('http://unused.invalid')
  try {
    for (const method of [
      'eth_sendTransaction',
      'eth_sendRawTransaction',
      'personal_sign',
      'eth_sign',
    ]) {
      await assert.rejects(provider.send(method, []), /forbidden/)
    }
  } finally {
    provider.destroy()
  }
})
