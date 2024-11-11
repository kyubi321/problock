const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // Get the deployer's account
    const [deployer] = await ethers.getSigners();

    console.log(`Deploying contracts with the account: ${deployer.address}`);

    // Deploy the GovToken contract
    const GovToken = await ethers.getContractFactory("GovToken");
    const govToken = await GovToken.deploy(deployer.address);
    await govToken.deployed();

    console.log(`GovToken deployed to: ${govToken.address}`);

    // Deploy the TimeLock contract
    const TimeLock = await ethers.getContractFactory("TimeLock");
    const timeLock = await TimeLock.deploy(0, [deployer.address], [deployer.address], deployer.address);
    await timeLock.deployed();

    console.log(`TimeLock deployed to: ${timeLock.address}`);

    // Deploy the Cert contract
    const Cert = await ethers.getContractFactory("Cert");
    const cert = await Cert.deploy(timeLock.address);
    await cert.deployed();

    console.log(`Cert deployed to: ${cert.address}`);

    // Deploy the MyGovernor contract
    const MyGovernor = await ethers.getContractFactory("MyGovernor");
    const myGovernor = await MyGovernor.deploy(govToken.address, timeLock.address);
    await myGovernor.deployed();

    console.log(`MyGovernor deployed to: ${myGovernor.address}`);

    // Delegate votes to the deployer
    const transactionResponse = await govToken.delegate(deployer.address);
    await transactionResponse.wait(1);

    // Get the role identifiers
    const PROPOSER_ROLE = await timeLock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timeLock.EXECUTOR_ROLE();

    // Grant roles (assuming the deployer has the TIMELOCK_ADMIN_ROLE)
    await timeLock.grantRole(PROPOSER_ROLE, myGovernor.address);
    await timeLock.grantRole(EXECUTOR_ROLE, myGovernor.address);

    // Save the contract addresses to a JSON file
    saveAddresses({
        GovToken: govToken.address,
        TimeLock: timeLock.address,
        Cert: cert.address,
        MyGovernor: myGovernor.address
    });
}

function saveAddresses(addresses) {
    const filePath = './deployedAddresses.json';
    fs.writeFileSync(filePath, JSON.stringify(addresses, null, 2));
    console.log(`Contract addresses saved to ${filePath}`);
}

// Execute the main function
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
