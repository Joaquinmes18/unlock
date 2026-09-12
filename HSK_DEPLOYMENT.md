# HSKChain Testnet Unlock Deployment

For exact source paths, proxy trust assumptions, runtime correspondence and
read-only reproduction commands, see the [contract review guide](docs/HSK_CONTRACT_REVIEW.md).

## Network

- Chain ID: **133**; Hardhat network: `hashkeyTestnet`
- RPC: https://testnet.hsk.xyz
- Explorer: https://testnet-explorer.hsk.xyz
- Native currency: **HSK**, 18 decimals

## Unlock

- Version: **14**
- Proxy: `0x56c7b33a4e06e79E7611787170DA26339E58b4Eb`
- Implementation: `0x5451C57dA3A8a3f0f04a74475702501628170211`

## PublicLock

- Version: **15**
- Registered template: `0x04D257Fa68fca523B6709E3A5bcbBA57e8518d5B`

## Test Membership Lock

- Address: `0xB212200F82b70d7a93ac3b17eF14E81899d6f2F5`
- Name: **HSK Hackathon Creator Membership**
- Duration: **2592000 seconds (30 days)**
- Currency: native HSK (`tokenAddress` is the zero address)
- Price: **100000000000000 wei (0.0001 HSK)**
- Maximum memberships: **100**; maximum keys per address: **1**

## Functional Proof

- Buyer: `0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe`
- Purchase: `0x04bf5e6f03bf8f6184a6f20bab62aab39007270181c45049709e253376aa2cad`
- At purchase block **32998848**, `getHasValidKey(buyer) == true`,
  `balanceOf(buyer) == 1`, and `totalSupply() == 1`.
- Token #1 belongs to the buyer. The lock received **0.0001 HSK**.
- Receipt events: `Transfer` (mint of token #1), `GNPChanged`, and
  `PaymentReceipt` (one purchase, zero extensions).

These are historical proof values; time-limited membership eventually expires.
Read at the confirmed receipt block or a later fresh block to avoid stale state.

## Architecture

Creator → Unlock factory → PublicLock membership → buyer pays native HSK →
`getHasValidKey` verifies access.

The factory creates a lock with
`createUpgradeableLockAtVersion(bytes,uint16)`, using version `15` and encoded
`initialize(address,uint256,address,uint256,uint256,string)` parameters:
creator, duration, zero address, price in wei, maximum memberships, and name.
Extract the address from Unlock's `NewLock` event, not `receipt.contractAddress`.

New integrations use the v15 tuple purchase overload. One native purchase uses
`{ value: 0, recipient: buyer, referrer: zero, protocolReferrer: zero,
keyManager: zero, data: '0x', additionalPeriods: 0 }` and transaction value equal
to `keyPrice()`. The legacy overload also accepts empty `_values` for native
payments: its iteration count is determined by `_recipients.length`.

## Deployment Transactions

The following deployment hashes were supplied with the completed deployment.
Explorer links can be formed as `https://testnet-explorer.hsk.xyz/tx/<hash>`.

| Operation                 | Transaction                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| Unlock deployment         | `0xa930179977724aff736fd0d8b008983b9d589904d04aa41f50771f46275f5237` |
| PublicLock deployment     | `0x247d78f91964752cd17f52686e5887aa8a828d330e73f299595f79cad3031248` |
| PublicLock initialization | `0xaa24f847ed9f82a6d59d3af616e498262c36f626f6f54778bf6187b138f7aefb` |
| Manager revoke            | `0xd5db066430e75ff3899a86fd7d3632630e953a6fa620ca972db495f090c88331` |
| Template registration     | `0x8c1450d582b69c3cbd11f1833f4b5c77e79f3bfe7e8302816e1cf546647486c5` |
| Unlock configuration      | `0x42ce856a67ebe4c67e121c4b7024593c3ade645fddb99b9a53034dcb302cce91` |
| Test Lock creation        | `0x2348140b9a267dde434b12afa99d99c935a9a729ec8a127fecc99558b468dbb7` |
| Test purchase             | `0x04bf5e6f03bf8f6184a6f20bab62aab39007270181c45049709e253376aa2cad` |

## Important Notes

- This is an **HSKChain-compatible Unlock deployment**, not a claim of official
  upstream support or acceptance.
- Locksmith and a subgraph are not required for the onchain membership proof.
- Explorer auto-verification is disabled in
  `governance/hardhat.hashkey-testnet.config.js` using the verification plugins'
  configuration switches. Shared deployment helpers are unchanged.
- The official governance tasks deployed Unlock v14 and PublicLock v15, followed
  by template registration/selection and Unlock configuration.
- This fork contains protocol configuration and deployment work. The product
  repository, https://github.com/David-ZemaP/DevVault-unlock-hashkey, consumes the
  deployed contracts; it should not contain a copy of this monorepo.
- Never store deployer or buyer secrets in source files or documentation.
