/** @type import('hardhat/config').HardhatUserConfig */
require("@nomiclabs/hardhat-ethers");
module.exports = {
    solidity: {
      version: "0.8.20",
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000,
        },
      },
    },
  };
