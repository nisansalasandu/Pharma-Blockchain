
const SupplyChain = artifacts.require("SupplyChain");

module.exports = function (deployer, network, accounts) {
  const distributor = accounts[1];
  const pharmacy = accounts[2];
  const regulator = accounts[3];

  console.log("Deploying with roles:");
  console.log("Manufacturer:", accounts[0]);
  console.log("Distributor:", distributor);
  console.log("Pharmacy:", pharmacy);
  console.log("Regulator:", regulator);

  deployer.deploy(SupplyChain, distributor, pharmacy, regulator);
};
