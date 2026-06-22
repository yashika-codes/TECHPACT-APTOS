# 💡 TechPact: Peer Technical Accountability on Aptos

TechPact is a decentralized peer-to-peer technical accountability application built on the Aptos Blockchain using **Move** and **Vanilla Web Technologies**. 

Self-paced technical learning (e.g., completing LeetCode modules, keeping up with a GitHub green streak, or coding side projects) has high dropout rates due to a lack of immediate consequences and social pressure. **TechPact** introduces economic incentive and peer review to make sure you finish what you start.

---

## 🚀 How It Works

1. **Commitment & Stake:** Developer A (the Creator) declares a specific technical milestone (e.g., *"Implement the database layer of my project"*), sets a deadline, deposits a stake in **Aptos Coin (APT)**, and designates Developer B as their Peer Reviewer.
2. **Locked in Resource Storage:** The staked coins are safely held inside the contract's resource storage under the Creator's account. No third party or module owner can drain or steal the locked coins.
3. **Progress Proof:** The Creator links a proof of work string (such as a GitHub commit SHA, pull request URL, or hosted link) to the pact before the deadline passes.
4. **Resolution:** 
   - **Achieved:** If Developer A completes the goal on time, the Peer Reviewer marks it as **Achieved**, and Developer A gets their staked coins refunded.
   - **Failed:** If the deadline passes without completion or if the reviewer rejects the work, the reviewer marks it as **Failed**, and the staked coins are automatically transferred to the Peer Reviewer as compensation for their review time.
   - **Admit Defeat:** At any time, Developer A can admit defeat, immediately forfeiting the stake to the Peer Reviewer.

---

## 🛠️ Smart Contract Architecture

The Move smart contract utilizes two major benefits of the Move language:
1. **Resource Ownership:** The staked coins are stored directly inside the `Pact` struct as a `Coin<AptosCoin>` resource. They do not reside in a centralized pool or operator address.
2. **Access Control:** Strict signer verification ensures only the designated `reviewer` address can trigger the resolution, and only the `creator` can update progress or admit defeat.

### Structs
```move
struct Pact has store {
    id: u64,
    reviewer: address,
    stake: Coin<AptosCoin>,
    stake_amount: u64,
    deadline: u64, // Unix timestamp in seconds
    proof_of_work: String,
    milestone_description: String,
    status: u8, // 0 = Active, 1 = Achieved, 2 = Failed
}

struct PactRegistry has key {
    pacts: vector<Pact>,
    next_pact_id: u64,
}
```

### Entry Functions
* `create_pact(...)`: Establishes a pact, withdraws the stake from the signer, and stores it in the `PactRegistry`.
* `update_proof(...)`: Allows the creator to update the proof link before resolution.
* `resolve_pact(...)`: Invoked by the reviewer to release the stake to the creator (success) or claim it (failure).
* `admit_defeat(...)`: Invoked by the creator to forfeit the stake to the reviewer.

---

## 💻 Frontend Client

The project comes with a modern, glassmorphic dark-mode web interface. 

* **Dual Mode Support:**
  * **Simulator Mode:** Run and test the entire flow (creating, proof-updating, reviewing) entirely in-browser using mock accounts and simulated balances in `localStorage`. No wallet setup or test APT coins required!
  * **Aptos Wallet Mode:** Connects to standard Aptos wallets (like **Petra**) to query pact data and send transactions on-chain.
* **Live Timers:** Dynamic real-time countdown clocks display the remaining time for each active pact.

---

## ⚙️ Development, Testing & Deployment

### 📋 Prerequisites
- Install [Aptos CLI](https://aptos.dev/cli)

### 🧪 Run Unit Tests
To test the smart contract locally:
```bash
aptos move test
```
*Output:*
```text
Running Move unit tests
[ PASS    ] 0xcafe::accountability_tests::test_admit_defeat
[ PASS    ] 0xcafe::accountability_tests::test_create_pact_success
[ PASS    ] 0xcafe::accountability_tests::test_resolve_pact_achieved
[ PASS    ] 0xcafe::accountability_tests::test_resolve_pact_failed
[ PASS    ] 0xcafe::accountability_tests::test_unauthorized_reviewer
[ PASS    ] 0xcafe::accountability_tests::test_update_proof_success
Test result: OK. Total tests: 6; passed: 6; failed: 0
```

### 🚢 Deploying to Testnet
1. Initialize an Aptos profile (if you haven't already):
   ```bash
   aptos init --network testnet
   ```
2. Fund your dev account using the Aptos Faucet:
   ```bash
   aptos account fund-with-faucet --account default
   ```
3. Compile the contract:
   ```bash
   aptos move compile
   ```
4. Publish the package:
   ```bash
   aptos move publish --named-addresses techpact=default
   ```
5. Note the deployed account address and update the `MODULE_ADDRESS` variable in `app.js`:
   ```javascript
   const MODULE_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS";
   ```

### 🖥️ Run the Web Interface Locally
Start a local HTTP server to run the frontend client:
```bash
# Using Node.js http-server
npx http-server ./ -p 8080
```
Then open `http://127.0.0.1:8080` in your web browser.

---
