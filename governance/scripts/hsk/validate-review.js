// Provider-only inspection. No environment secrets, signing, or state mutation.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  Contract,
  JsonRpcProvider,
  ZeroAddress,
  getAddress,
  keccak256,
} = require('ethers')
const contracts = require('@unlock-protocol/contracts')

const addresses = {
  unlock: '0x56c7b33a4e06e79E7611787170DA26339E58b4Eb',
  implementation: '0x5451C57dA3A8a3f0f04a74475702501628170211',
  template: '0x04D257Fa68fca523B6709E3A5bcbBA57e8518d5B',
  lock: '0xB212200F82b70d7a93ac3b17eF14E81899d6f2F5',
  creator: '0x5b7ED3833EBF4D9899d7aB4799FAF4d40bb6cC65',
  buyer: '0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe',
}
const implementationSlot =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
const adminSlot =
  '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103'
const purchaseHash =
  '0x04bf5e6f03bf8f6184a6f20bab62aab39007270181c45049709e253376aa2cad'
const allowed = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_call',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionReceipt',
  'eth_getBlockByNumber',
  'eth_getBalance',
])
class ReadOnlyProvider extends JsonRpcProvider {
  async send(method, params) {
    if (!allowed.has(method)) throw new Error(`RPC method forbidden: ${method}`)
    return super.send(method, params)
  }
}

// Time-bounded validity is separate from the immutable purchase receipt.
function classifyMembership(membership, timestamp, originalExpiration) {
  assert(membership.supply >= 1n, 'Test token supply disappeared')
  assert.equal(
    membership.token1Owner,
    addresses.buyer,
    'Test token ownership changed'
  )
  const expired = membership.expiration <= BigInt(timestamp)
  assert.equal(
    membership.valid,
    !expired,
    'Membership validity disagrees with expiration'
  )
  assert.equal(
    membership.balance,
    expired ? 0n : 1n,
    'Valid-key balance disagrees with expiration'
  )
  if (membership.expiration !== originalExpiration)
    return 'test membership expiration changed; inspect extension/cancellation'
  return expired ? 'expired test membership' : 'active test membership'
}

async function main() {
  const provider = new ReadOnlyProvider('https://testnet.hsk.xyz', 133, {
    cacheTimeout: -1,
  })
  try {
    assert.equal((await provider.getNetwork()).chainId, 133n)
    const blockNumber = await provider.getBlockNumber()
    const block = await provider.getBlock(blockNumber)
    assert(block, 'Snapshot block unavailable')
    const at = { blockTag: blockNumber }
    const unlock = new Contract(
      addresses.unlock,
      contracts.UnlockV14.abi,
      provider
    )
    const template = new Contract(
      addresses.template,
      contracts.PublicLockV15.abi,
      provider
    )
    const lock = new Contract(
      addresses.lock,
      contracts.PublicLockV15.abi,
      provider
    )
    assert.equal(await unlock.unlockVersion(at), 14n)
    assert.equal(await unlock.publicLockLatestVersion(at), 15n)
    assert.equal(await unlock.publicLockAddress(at), addresses.template)
    assert.equal(await unlock.publicLockImpls(15, at), addresses.template)
    assert.equal(await unlock.publicLockVersions(addresses.template, at), 15n)
    assert.equal(await template.publicLockVersion(at), 15n)
    assert.equal(await template.isLockManager(addresses.creator, at), false)
    assert.equal(await lock.publicLockVersion(at), 15n)
    assert.equal(await lock.unlockProtocol(at), addresses.unlock)
    assert.equal(await lock.tokenAddress(at), ZeroAddress)
    assert.equal(await lock.keyPrice(at), 100000000000000n)
    assert.equal(await lock.name(at), 'HSK Hackathon Creator Membership')
    assert.equal(await lock.expirationDuration(at), 2592000n)
    assert.equal(await lock.maxNumberOfKeys(at), 100n)
    assert.equal(await lock.maxKeysPerAddress(at), 1n)
    assert.equal(await lock.isLockManager(addresses.creator, at), true)
    for (const hook of [
      'onKeyPurchaseHook',
      'onKeyCancelHook',
      'onKeyExtendHook',
      'onKeyGrantHook',
      'onKeyTransferHook',
      'onTokenURIHook',
      'onValidKeyHook',
      'onHasRoleHook',
    ]) {
      assert.equal(await lock[hook](at), ZeroAddress)
    }
    const storageAddress = async (address, slot) =>
      getAddress(
        `0x${(await provider.getStorage(address, slot, blockNumber)).slice(-40)}`
      )
    assert.equal(
      await storageAddress(addresses.unlock, implementationSlot),
      addresses.implementation
    )
    assert.equal(
      await storageAddress(addresses.lock, implementationSlot),
      addresses.template
    )
    const unlockAdmin = await storageAddress(addresses.unlock, adminSlot)
    const lockAdmin = await storageAddress(addresses.lock, adminSlot)
    assert.equal(lockAdmin, await unlock.proxyAdminAddress(at))
    const adminOwner = async (address) =>
      new Contract(
        address,
        ['function owner() view returns (address)'],
        provider
      ).owner(at)
    // Confirm the receipt and archive-state proof at the purchase block, not latest.
    const receipt = await provider.getTransactionReceipt(purchaseHash)
    assert(
      receipt && receipt.status === 1,
      'Successful purchase receipt required'
    )
    assert.equal(receipt.to, addresses.lock)
    assert.equal(receipt.from, addresses.buyer)
    const logs = receipt.logs
      .filter((log) => getAddress(log.address) === addresses.lock)
      .map((log) => lock.interface.parseLog(log))
      .filter(Boolean)
    const mint = logs.find(
      (event) =>
        event.name === 'Transfer' &&
        event.args.from === ZeroAddress &&
        event.args.to === addresses.buyer &&
        event.args.tokenId === 1n
    )
    const payment = logs.find((event) => event.name === 'PaymentReceipt')
    assert(mint, 'Membership mint event missing')
    assert(payment, 'Purchase receipt event missing')
    assert.deepEqual([...payment.args.tokenIds], [1n])
    assert.equal(payment.args.purchases, 1n)
    assert.equal(payment.args.extensions, 0n)
    assert.equal(payment.args.payer, addresses.buyer)
    assert.equal(payment.args.tokenAddress, ZeroAddress)
    assert.equal(payment.args.totalPaid, 100000000000000n)
    const then = { blockTag: receipt.blockNumber }
    assert.equal(await lock.getHasValidKey(addresses.buyer, then), true)
    assert.equal(await lock.balanceOf(addresses.buyer, then), 1n)
    assert.equal(await lock.totalSupply(then), 1n)
    assert.equal(await lock.ownerOf(1, then), addresses.buyer)
    assert.equal(
      await provider.getBalance(addresses.lock, receipt.blockNumber),
      100000000000000n
    )
    const originalExpiration = await lock.keyExpirationTimestampFor(1, then)
    const results = {
      chainId: 133,
      blockNumber,
      deployment: 'PASS',
      addresses,
      unlockOwner: await unlock.owner(at),
      unlockAdmin,
      unlockAdminOwner: await adminOwner(unlockAdmin),
      lockAdmin,
      lockAdminOwner: await adminOwner(lockAdmin),
      protocolFee: await unlock.protocolFee(at),
      governanceToken: await unlock.udt(at),
      wrappedNativeToken: await unlock.weth(at),
      metadataBase: await unlock.globalBaseTokenURI(at),
      historicalProof: {
        status: 'PASS',
        purchaseHash,
        blockNumber: receipt.blockNumber,
        balance: 1,
        supply: 1,
        tokenId: 1,
        valid: true,
        paidWei: '100000000000000',
        originalExpiration,
      },
      membership: {
        valid: await lock.getHasValidKey(addresses.buyer, at),
        balance: await lock.balanceOf(addresses.buyer, at),
        supply: await lock.totalSupply(at),
        token1Owner: await lock.ownerOf(1, at),
        expiration: await lock.keyExpirationTimestampFor(1, at),
      },
      runtimeMatches: {},
    }
    results.currentMembershipStatus = classifyMembership(
      results.membership,
      block.timestamp,
      originalExpiration
    )
    // Full deployed-runtime equality, including Solidity metadata. A version getter
    // alone is insufficient to establish correspondence with a local implementation.
    for (const [name, version, address] of [
      ['Unlock', 14, addresses.implementation],
      ['PublicLock', 15, addresses.template],
    ]) {
      const artifactPath = path.resolve(
        __dirname,
        `../../artifacts/contracts/past-versions/${name}V${version}.sol/${name}.json`
      )
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
      const debug = JSON.parse(
        fs.readFileSync(artifactPath.replace('.json', '.dbg.json'), 'utf8')
      )
      const build = JSON.parse(
        fs.readFileSync(
          path.resolve(path.dirname(artifactPath), debug.buildInfo),
          'utf8'
        )
      )
      const tracked = path.resolve(
        __dirname,
        `../../../packages/contracts/src/contracts/${name}/${name}V${version}.sol`
      )
      assert.equal(
        build.input.sources[artifact.sourceName].content,
        fs.readFileSync(tracked, 'utf8'),
        'Artifact compiler input differs from tracked versioned source'
      )
      const metadata = JSON.parse(
        build.output.contracts[artifact.sourceName][name].metadata
      )
      const code = await provider.getCode(address, blockNumber)
      assert.notEqual(code, '0x')
      results.runtimeMatches[name] = {
        exact: code.toLowerCase() === artifact.deployedBytecode.toLowerCase(),
        bytes: (code.length - 2) / 2,
        onchainKeccak256: keccak256(code),
        artifactKeccak256: keccak256(artifact.deployedBytecode),
        compiler: build.solcLongVersion,
        optimizer: build.input.settings.optimizer,
        evmVersion: build.input.settings.evmVersion,
        metadata: metadata.settings.metadata,
      }
    }
    console.log(
      JSON.stringify(
        results,
        (_, value) => (typeof value === 'bigint' ? value.toString() : value),
        2
      )
    )
    for (const result of Object.values(results.runtimeMatches)) {
      assert.equal(
        result.exact,
        true,
        'Runtime mismatch: inspect compiler input/settings; do not infer a match from version alone'
      )
    }
  } finally {
    provider.destroy()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = { classifyMembership, ReadOnlyProvider }
