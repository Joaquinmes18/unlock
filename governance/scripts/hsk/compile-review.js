// Compile the same packaged Solidity sources selected by the official deployers.
// No deployment tasks, signers, or blockchain requests are used.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const hre = require('hardhat')
const {
  copyAndBuildContractsAtVersion,
} = require('@unlock-protocol/hardhat-helpers')

async function main() {
  hre.network.provider.request = async () => {
    throw new Error('RPC is forbidden during review compilation')
  }
  for (const [name, version] of [
    ['Unlock', 14],
    ['PublicLock', 15],
  ]) {
    const packaged = require.resolve(
      `@unlock-protocol/contracts/dist/${name}/${name}V${version}.sol`
    )
    const tracked = path.resolve(
      __dirname,
      `../../../packages/contracts/src/contracts/${name}/${name}V${version}.sol`
    )
    assert.equal(
      fs.readFileSync(packaged, 'utf8'),
      fs.readFileSync(tracked, 'utf8')
    )
  }
  const names = await copyAndBuildContractsAtVersion(
    path.resolve(__dirname, '../deployments'),
    [
      { contractName: 'Unlock', version: 14 },
      { contractName: 'PublicLock', version: 15 },
    ]
  )
  for (const name of names) {
    const artifact = await hre.artifacts.readArtifact(name)
    assert.notEqual(artifact.bytecode, '0x')
    assert.notEqual(artifact.deployedBytecode, '0x')
    assert.equal(Object.keys(artifact.linkReferences).length, 0)
    const build = await hre.artifacts.getBuildInfo(name)
    assert(build, 'Compiler build info is required for review')
    console.log(
      JSON.stringify({
        compiler: build.solcLongVersion,
        optimizer: build.input.settings.optimizer,
        evmVersion: build.input.settings.evmVersion,
      })
    )
    console.log(
      `${name}: ${(artifact.deployedBytecode.length - 2) / 2} runtime bytes`
    )
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
