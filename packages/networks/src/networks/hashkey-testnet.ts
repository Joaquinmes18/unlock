import { NetworkConfig } from '@unlock-protocol/types'

export const hashkeyTestnet: NetworkConfig = {
  chain: 'hashkey-testnet',
  description: 'Unlock Protocol port on HSKChain Testnet',
  explorer: {
    name: 'HSKChain Testnet Explorer',
    urls: {
      address: (address: string) =>
        `https://testnet-explorer.hsk.xyz/address/${address}`,
      base: 'https://testnet-explorer.hsk.xyz',
      token: (address: string, holder: string) =>
        `https://testnet-explorer.hsk.xyz/token/${address}?a=${holder}`,
      transaction: (hash: string) =>
        `https://testnet-explorer.hsk.xyz/tx/${hash}`,
    },
  },
  featured: false,
  id: 133,
  isTestNetwork: true,
  name: 'HSKChain Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'HSK',
    symbol: 'HSK',
  },
  provider: 'https://testnet.hsk.xyz',
  publicLockVersionToDeploy: 15,
  publicProvider: 'https://testnet.hsk.xyz',
  // Required by NetworkConfig; no subgraph has been deployed for this port.
  subgraph: {
    endpoint: '',
    graphId: '',
  },
  // Required by NetworkConfig; populate only after deployment on chain 133.
  unlockAddress: '',
}

export default hashkeyTestnet
