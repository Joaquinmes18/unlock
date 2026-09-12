const config = require('./hardhat.config')

module.exports = {
  ...config,
  networks: {
    hashkeyTestnet: config.networks.hashkeyTestnet,
  },
  etherscan: {
    ...config.etherscan,
    enabled: false,
  },
  sourcify: {
    enabled: false,
  },
  blockscout: {
    enabled: false,
  },
}
