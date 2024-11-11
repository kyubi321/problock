const { network, ethers } = require("hardhat");

async function moveBlocks(number) {
    for (let index = 0; index < number; index++) {
        await network.provider.request({
            method: "evm_mine",
            params: [],
        });
    }
    console.log(`Moved ${number} blocks`);
}

async function moveTime(number) {
    await network.provider.send("evm_increaseTime", [number]);
    console.log(`Moved forward in time ${number} seconds`);
}

describe("DAO Contract Testing Flow", function () {
    it("Proposal to Executed Flow", async function () {

        /* ------------ Get Deployer's Address/Identity -------------*/
        const [deployer] = await ethers.getSigners();

        /* ------------ Deployment -------------*/
        const GovToken = await ethers.deployContract("GovToken", [deployer.address]);
        const TimeLock = await ethers.deployContract("TimeLock", [
            0, 
            [deployer.address], 
            [deployer.address], 
            deployer.address
        ]);
        const Cert = await ethers.deployContract("Cert", [TimeLock.address]);
        const MyGovernor = await ethers.deployContract("MyGovernor", [
            GovToken.address, 
            TimeLock.address
        ]);

        console.log("TimeLock: ", TimeLock.address);
        console.log("Cert: ", Cert.address);
        console.log("MyGovernor: ", MyGovernor.address);
        console.log("GovToken: ", GovToken.address);

        /* ------------ Balance and Voting Power -------------*/
        const balance = await GovToken.balanceOf(deployer.address);
        console.log(`Deployer's balance: ${balance}`);

        let votes = await GovToken.getVotes(deployer.address);
        console.log(`Votes before delegation: ${votes}`);

        const transactionResponse = await GovToken.delegate(deployer.address);
        await transactionResponse.wait(1);

        votes = await GovToken.getVotes(deployer.address);
        console.log(`Votes after delegation: ${votes}`);

        /* ------------ Assign Roles to Governor Contract -------------*/
        // Get Roles, GrantRole - TimeLock
        // Get the role identifiers
        const PROPOSER_ROLE = await TimeLock.PROPOSER_ROLE();
        const EXECUTOR_ROLE = await TimeLock.EXECUTOR_ROLE();

        // Grant roles (assuming the deployer has the TIMELOCK_ADMIN_ROLE)
        await TimeLock.connect(deployer).grantRole(PROPOSER_ROLE, MyGovernor.address);
        await TimeLock.connect(deployer).grantRole(EXECUTOR_ROLE, MyGovernor.address);

        /* ------------ Proposal -------------*/
        const transferCalldata = Cert.interface.encodeFunctionData("issue", [101, "An", "EDP", "A", "25th June"]);

        const proposeTx = await MyGovernor.propose(
            [Cert.address],
            [0],
            [transferCalldata],
            "Proposal #1: Issue certificate"
        );
        await proposeTx.wait();
        const filter = MyGovernor.filters.ProposalCreated();
        const events = await MyGovernor.queryFilter(filter, proposeTx.blockNumber, proposeTx.blockNumber);

        const proposalId = events[0].args.proposalId;
        console.log(`Proposal ID Generated: ${proposalId}`);

        /* ------------ #0 Pending -------------*/
        let proposalState = await MyGovernor.state(proposalId);
        console.log(`Current Proposal State: ${proposalState}`);

        await moveBlocks(100);

        /* ------------ #1 Active = Voting -------------*/
        proposalState = await MyGovernor.state(proposalId);
        console.log(`Current Proposal State: ${proposalState}`);

        let voteTx = await MyGovernor.castVoteWithReason(proposalId, 1, "Yes, I approve");
        await voteTx.wait(1);

        const proposalVotes = await MyGovernor.proposalVotes(proposalId);
        console.log("Against Votes:", proposalVotes.againstVotes.toString());
        console.log("For Votes:", proposalVotes.forVotes.toString());
        console.log("Abstain Votes:", proposalVotes.abstainVotes.toString());

        await moveBlocks(100);

        /* ------------ #4 Succeeded -------------*/
        proposalState = await MyGovernor.state(proposalId);
        console.log(`Current Proposal State: ${proposalState}`);

        /* ------------ #5 Queued -------------*/
        const descriptionHash = ethers.utils.id("Proposal #1: Issue certificate");

        const queueTx = await MyGovernor.connect(deployer).queue(
            [Cert.address],
            [0],
            [transferCalldata],
            descriptionHash
        );
        await queueTx.wait(1);

        proposalState = await MyGovernor.state(proposalId);
        console.log(`Current Proposal State after queuing: ${proposalState}`);

        await moveTime(40);
        await moveBlocks(1);

        /* ------------ #7 Execute -------------*/        
        const executeTx = await MyGovernor.connect(deployer).execute(
            [Cert.address],
            [0],
            [transferCalldata],
            descriptionHash
        );
        await executeTx.wait(1);

        proposalState = await MyGovernor.state(proposalId);
        console.log(`Current Proposal State after execution: ${proposalState}`);

        /* ------------ Verify -------------*/
        console.log(await Cert.Certificates(101));
    });
});
