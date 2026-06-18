// TechPact Frontend logic: Handles Simulator Mode & Real Aptos Wallet Mode

// --- Constants ---
const SIM_CREATOR_ADDR = "0x1111111111111111111111111111111111111111111111111111111111111111";
const SIM_REVIEWER_ADDR = "0x2222222222222222222222222222222222222222222222222222222222222222";
const MODULE_ADDRESS = "0xcafe"; // Default compilation/test address. Change on deploy.
const APTOS_NODE_URL = "https://api.testnet.aptoslabs.com/v1";

// --- Application State ---
let state = {
    mode: 'simulation', // 'simulation' or 'chain'
    activeUser: 'creator', // 'creator' or 'reviewer' (relevant for simulation)
    walletConnected: false,
    walletAddress: null,
    pacts: [], // Contains pacts (both simulated and cached chain pacts)
    simBalanceCreator: 100.0, // Simulated APT
    simBalanceReviewer: 5.0,  // Simulated APT
};

// --- DOM Elements ---
const btnSimMode = document.getElementById('btn-sim-mode');
const btnChainMode = document.getElementById('btn-chain-mode');
const walletConnectBtn = document.getElementById('wallet-connect-btn');
const walletBtnText = document.getElementById('wallet-btn-text');
const walletBanner = document.getElementById('wallet-banner');
const walletBannerText = document.getElementById('wallet-banner-text');

// Stats Elements
const statActive = document.getElementById('stat-active');
const statAchieved = document.getElementById('stat-achieved');
const statStaked = document.getElementById('stat-staked');
const statRate = document.getElementById('stat-rate');

// Form Elements
const pactForm = document.getElementById('pact-form');
const pactTitle = document.getElementById('pact-title');
const pactReviewer = document.getElementById('pact-reviewer');
const pactStake = document.getElementById('pact-stake');
const pactDuration = document.getElementById('pact-duration');
const pactProof = document.getElementById('pact-proof');
const reviewerHelperBtn = document.getElementById('reviewer-helper-btn');

// Tabs & Lists
const tabActive = document.getElementById('tab-active');
const tabHistory = document.getElementById('tab-history');
const activePactsList = document.getElementById('active-pacts-list');
const historyPactsList = document.getElementById('history-pacts-list');
const activeBadge = document.getElementById('active-badge');
const historyBadge = document.getElementById('history-badge');

// Dock Elements
const reviewerSimDock = document.getElementById('reviewer-sim-dock');
const dockMinimizeBtn = document.getElementById('dock-minimize-btn');
const dockBody = document.getElementById('dock-body');
const btnSwitchCreator = document.getElementById('btn-switch-creator');
const btnSwitchReviewer = document.getElementById('btn-switch-reviewer');
const toastContainer = document.getElementById('toast-container');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Load simulation pacts from localStorage or initialize with defaults
    const savedPacts = localStorage.getItem('techpact_sim_pacts');
    if (savedPacts) {
        state.pacts = JSON.parse(savedPacts);
    } else {
        // Seed default pacts for demonstration
        state.pacts = [
            {
                id: 1,
                creator: SIM_CREATOR_ADDR,
                reviewer: SIM_REVIEWER_ADDR,
                stake_amount: 5.5,
                deadline: Math.floor(Date.now() / 1000) + 120, // 2 mins from now
                milestone_description: "Build DB schemas & write Move unit tests",
                proof_of_work: "https://github.com/aptos-labs/aptos-core",
                status: 0, // 0 = Active, 1 = Achieved, 2 = Failed
                mode: 'simulation'
            },
            {
                id: 2,
                creator: SIM_CREATOR_ADDR,
                reviewer: SIM_REVIEWER_ADDR,
                stake_amount: 10,
                deadline: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
                milestone_description: "Implement front-end glassmorphic UI elements",
                proof_of_work: "https://github.com/my-pact-repo/commit/7f54c2a",
                status: 1, // Achieved
                mode: 'simulation'
            }
        ];
        savePacts();
    }
    
    // Auto fill reviewer address helper
    reviewerHelperBtn.addEventListener('click', () => {
        pactReviewer.value = state.mode === 'simulation' ? SIM_REVIEWER_ADDR : "0x2222222222222222222222222222222222222222222222222222222222222222";
        showToast("Reviewer address prefilled!", "info");
    });

    // Start Live Clock
    setInterval(updateTimers, 1000);
    
    // Render initial lists
    renderPacts();
    updateStats();
    updateUIForMode();
});

// --- LocalStorage Helpers ---
function savePacts() {
    localStorage.setItem('techpact_sim_pacts', JSON.stringify(state.pacts));
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <div class="toast-message">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate out and remove
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- Navigation Tabs ---
tabActive.addEventListener('click', () => {
    tabActive.classList.add('active');
    tabHistory.classList.remove('active');
    activePactsList.classList.remove('hidden');
    historyPactsList.classList.add('hidden');
});

tabHistory.addEventListener('click', () => {
    tabHistory.classList.add('active');
    tabActive.classList.remove('active');
    historyPactsList.classList.remove('hidden');
    activePactsList.classList.add('hidden');
});

// --- Mode Switchers ---
btnSimMode.addEventListener('click', () => {
    state.mode = 'simulation';
    btnSimMode.classList.add('active');
    btnChainMode.classList.remove('active');
    reviewerSimDock.style.display = 'block';
    updateUIForMode();
    showToast("Switched to Simulator Mode (Offline testing)", "info");
});

btnChainMode.addEventListener('click', () => {
    state.mode = 'chain';
    btnChainMode.classList.add('active');
    btnSimMode.classList.remove('active');
    reviewerSimDock.style.display = 'none';
    updateUIForMode();
    showToast("Switched to Aptos Blockchain Mode. Connect wallet to read/write on-chain.", "info");
});

// Minimize simulation dock
dockMinimizeBtn.addEventListener('click', () => {
    reviewerSimDock.classList.toggle('minimized');
    const isMinimized = reviewerSimDock.classList.contains('minimized');
    dockMinimizeBtn.innerHTML = isMinimized ? '<i class="fa-solid fa-chevron-up"></i>' : '<i class="fa-solid fa-chevron-down"></i>';
});

// Switch active simulation user
btnSwitchCreator.addEventListener('click', () => {
    state.activeUser = 'creator';
    btnSwitchCreator.classList.add('active');
    btnSwitchReviewer.classList.remove('active');
    renderPacts();
    showToast("Viewing dashboard as Creator (Developer A)", "info");
});

btnSwitchReviewer.addEventListener('click', () => {
    state.activeUser = 'reviewer';
    btnSwitchReviewer.classList.add('active');
    btnSwitchCreator.classList.remove('active');
    renderPacts();
    showToast("Viewing dashboard as Peer Reviewer (Developer B)", "info");
});

// --- Wallet Connect ---
walletConnectBtn.addEventListener('click', async () => {
    if (state.mode === 'simulation') {
        // Toggle simulated wallet
        if (state.walletConnected) {
            state.walletConnected = false;
            state.walletAddress = null;
            walletBtnText.innerText = "Connect Wallet";
            walletBanner.classList.add('hidden');
            showToast("Simulated Wallet disconnected", "info");
        } else {
            state.walletConnected = true;
            state.walletAddress = SIM_CREATOR_ADDR;
            walletBtnText.innerText = "Disconnect Sim Wallet";
            walletBanner.classList.remove('hidden');
            walletBannerText.innerText = `Simulated Wallet Connected: ${shortenAddress(SIM_CREATOR_ADDR)}`;
            showToast("Simulated Wallet Connected: 0x1111...1111", "success");
        }
    } else {
        // Real wallet connection (Petra/Martian)
        if (typeof window.aptos !== 'undefined') {
            try {
                if (state.walletConnected) {
                    await window.aptos.disconnect();
                    state.walletConnected = false;
                    state.walletAddress = null;
                    walletBtnText.innerText = "Connect Wallet";
                    walletBanner.classList.add('hidden');
                    showToast("Wallet disconnected", "info");
                } else {
                    walletBtnText.innerText = "Connecting...";
                    const account = await window.aptos.connect();
                    state.walletConnected = true;
                    state.walletAddress = account.address;
                    walletBtnText.innerText = shortenAddress(account.address);
                    walletBanner.classList.remove('hidden');
                    walletBannerText.innerText = `Connected to Aptos Account: ${account.address}`;
                    showToast("Wallet successfully connected!", "success");
                    // Fetch on-chain pacts if available
                    fetchOnChainPacts();
                }
            } catch (err) {
                console.error(err);
                walletBtnText.innerText = "Connect Wallet";
                showToast(`Wallet connection failed: ${err.message || err}`, "error");
            }
        } else {
            showToast("Aptos Wallet extension (e.g. Petra) not detected. Please install Petra Wallet.", "error");
            // Open Petra installation page
            window.open("https://petra.app/", "_blank");
        }
    }
});

// --- Create Pact Action ---
pactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!state.walletConnected) {
        showToast("Please connect your wallet first!", "error");
        return;
    }

    const title = pactTitle.value;
    const reviewer = pactReviewer.value.trim();
    const stake = parseFloat(pactStake.value);
    const duration = parseInt(pactDuration.value);
    const proof = pactProof.value.trim();
    const deadline = Math.floor(Date.now() / 1000) + duration;

    // Basic address check
    if (!reviewer.startsWith('0x') || reviewer.length < 10) {
        showToast("Invalid reviewer Aptos address", "error");
        return;
    }

    if (state.mode === 'simulation') {
        // Verify balance
        if (state.simBalanceCreator < stake) {
            showToast("Insufficient simulated balance!", "error");
            return;
        }

        // Subtract stake
        state.simBalanceCreator -= stake;

        const newPact = {
            id: state.pacts.length + 1,
            creator: SIM_CREATOR_ADDR,
            reviewer: reviewer,
            stake_amount: stake,
            deadline: deadline,
            milestone_description: title,
            proof_of_work: proof,
            status: 0,
            mode: 'simulation'
        };

        state.pacts.unshift(newPact);
        savePacts();
        pactForm.reset();
        
        showToast(`TechPact established! Staked ${stake} APT locked inside contract.`, "success");
        renderPacts();
        updateStats();
    } else {
        // Real On-chain execution
        try {
            showToast("Submitting transaction to Aptos network...", "info");
            
            // Octas calculation (1 APT = 10^8 Octas)
            const stakeInOctas = Math.floor(stake * 100000000);
            
            const payload = {
                type: "entry_function_payload",
                function: `${MODULE_ADDRESS}::accountability::create_pact`,
                type_arguments: [],
                arguments: [
                    reviewer,
                    stakeInOctas.toString(),
                    deadline.toString(),
                    title,
                    proof
                ]
            };

            const pendingTx = await window.aptos.signAndSubmitTransaction(payload);
            showToast(`Transaction submitted! Hash: ${shortenAddress(pendingTx.hash)}. Waiting for block confirmation...`, "info");
            
            // Wait for txn confirmation
            // In a real production dApp, we can query the ledger REST API to confirm completion
            setTimeout(() => {
                showToast("TechPact successfully deployed on-chain!", "success");
                pactForm.reset();
                fetchOnChainPacts();
            }, 5000);

        } catch (err) {
            console.error(err);
            showToast(`Blockchain transaction failed: ${err.message || err}`, "error");
        }
    }
});

// --- Update Proof Action ---
window.submitProof = function(pactId) {
    const proofInput = document.getElementById(`proof-input-${pactId}`);
    const proofVal = proofInput.value.trim();

    if (!proofVal) {
        showToast("Proof cannot be empty!", "error");
        return;
    }

    const pactIndex = state.pacts.findIndex(p => p.id === pactId && p.mode === state.mode);
    if (pactIndex === -1) return;

    if (state.mode === 'simulation') {
        state.pacts[pactIndex].proof_of_work = proofVal;
        savePacts();
        showToast("Proof of work link uploaded successfully!", "success");
        renderPacts();
    } else {
        // On-chain update
        updateProofOnChain(pactId, proofVal);
    }
};

async function updateProofOnChain(pactId, proofVal) {
    try {
        showToast("Submitting proof update to blockchain...", "info");
        const payload = {
            type: "entry_function_payload",
            function: `${MODULE_ADDRESS}::accountability::update_proof`,
            type_arguments: [],
            arguments: [
                pactId.toString(),
                proofVal
            ]
        };

        const pendingTx = await window.aptos.signAndSubmitTransaction(payload);
        showToast(`Tx submitted: ${shortenAddress(pendingTx.hash)}. Confirming...`, "info");
        
        setTimeout(() => {
            showToast("Proof link updated on-chain!", "success");
            fetchOnChainPacts();
        }, 5000);
    } catch (err) {
        console.error(err);
        showToast(`Failed to update proof on-chain: ${err.message}`, "error");
    }
}

// --- Creator admits defeat ---
window.admitDefeat = function(pactId) {
    if (!confirm("Are you sure you want to admit defeat? Your staked APT coins will be immediately transferred to the Peer Reviewer.")) {
        return;
    }

    const pactIndex = state.pacts.findIndex(p => p.id === pactId && p.mode === state.mode);
    if (pactIndex === -1) return;

    if (state.mode === 'simulation') {
        const pact = state.pacts[pactIndex];
        pact.status = 2; // Failed
        
        // Reviewer gets the stake
        state.simBalanceReviewer += pact.stake_amount;
        
        savePacts();
        showToast("Defeat admitted. Stake coins transferred to reviewer.", "danger");
        renderPacts();
        updateStats();
    } else {
        admitDefeatOnChain(pactId);
    }
};

async function admitDefeatOnChain(pactId) {
    try {
        showToast("Submitting forfeit transaction...", "info");
        const payload = {
            type: "entry_function_payload",
            function: `${MODULE_ADDRESS}::accountability::admit_defeat`,
            type_arguments: [],
            arguments: [pactId.toString()]
        };

        const pendingTx = await window.aptos.signAndSubmitTransaction(payload);
        showToast(`Tx submitted: ${shortenAddress(pendingTx.hash)}. Confirming...`, "info");
        
        setTimeout(() => {
            showToast("Defeat admitted on-chain. Stake released to Reviewer.", "success");
            fetchOnChainPacts();
        }, 5000);
    } catch (err) {
        console.error(err);
        showToast(`Forfeit transaction failed: ${err.message}`, "error");
    }
}

// --- Reviewer resolves pact ---
window.resolvePact = function(pactId, achieved) {
    const pactIndex = state.pacts.findIndex(p => p.id === pactId && p.mode === state.mode);
    if (pactIndex === -1) return;

    const pact = state.pacts[pactIndex];

    if (state.mode === 'simulation') {
        if (achieved) {
            pact.status = 1; // Achieved
            state.simBalanceCreator += pact.stake_amount; // Refund Creator
            showToast(`Pact Achieved! Stake refunded to Creator.`, "success");
        } else {
            pact.status = 2; // Failed
            state.simBalanceReviewer += pact.stake_amount; // Fine/Reward Reviewer
            showToast(`Pact marked Failed. Stake transferred to Reviewer.`, "danger");
        }
        
        savePacts();
        renderPacts();
        updateStats();
    } else {
        resolvePactOnChain(pact.creator, pactId, achieved);
    }
};

async function resolvePactOnChain(creatorAddr, pactId, achieved) {
    try {
        showToast(`Resolving pact as ${achieved ? 'Achieved' : 'Failed'}...`, "info");
        const payload = {
            type: "entry_function_payload",
            function: `${MODULE_ADDRESS}::accountability::resolve_pact`,
            type_arguments: [],
            arguments: [
                creatorAddr,
                pactId.toString(),
                achieved
            ]
        };

        const pendingTx = await window.aptos.signAndSubmitTransaction(payload);
        showToast(`Tx submitted: ${shortenAddress(pendingTx.hash)}. Confirming...`, "info");
        
        setTimeout(() => {
            showToast(`Pact resolved on-chain!`, "success");
            fetchOnChainPacts();
        }, 5000);
    } catch (err) {
        console.error(err);
        showToast(`Failed to resolve pact on-chain: ${err.message}`, "error");
    }
}

// --- Fetch On-chain data ---
async function fetchOnChainPacts() {
    if (!state.walletAddress) return;

    try {
        // Query the number of pacts the connected account has
        const countUrl = `${APTOS_NODE_URL}/view`;
        const countResponse = await fetch(countUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                function: `${MODULE_ADDRESS}::accountability::get_pact_count`,
                type_arguments: [],
                arguments: [state.walletAddress]
            })
        });
        
        if (!countResponse.ok) {
            console.log("No PactRegistry initialized for this address yet.");
            return;
        }

        const countData = await countResponse.json();
        const pactCount = parseInt(countData[0]);

        const loadedPacts = [];
        for (let i = 1; i <= pactCount; i++) {
            const detailResponse = await fetch(countUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    function: `${MODULE_ADDRESS}::accountability::get_pact`,
                    type_arguments: [],
                    arguments: [state.walletAddress, i.toString()]
                })
            });

            if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                // detailData structure: (reviewer, stake_amount, deadline, proof_of_work, milestone_description, status)
                // stake_amount is in octas (divide by 10^8)
                loadedPacts.push({
                    id: i,
                    creator: state.walletAddress,
                    reviewer: detailData[0],
                    stake_amount: parseFloat(detailData[1]) / 100000000,
                    deadline: parseInt(detailData[2]),
                    proof_of_work: detailData[3],
                    milestone_description: detailData[4],
                    status: parseInt(detailData[5]),
                    mode: 'chain'
                });
            }
        }

        // Merge/update state pacts
        state.pacts = state.pacts.filter(p => p.mode !== 'chain').concat(loadedPacts);
        renderPacts();
        updateStats();
        showToast("Fetched latest accountability pacts from Aptos Network", "success");
    } catch (err) {
        console.error("Error fetching on-chain data: ", err);
        showToast("Could not load on-chain pacts. Check if contract address is correct in app.js.", "error");
    }
}

// --- Render Pacts Lists ---
function renderPacts() {
    const activeList = state.pacts.filter(p => p.status === 0 && p.mode === state.mode);
    const historyList = state.pacts.filter(p => p.status !== 0 && p.mode === state.mode);

    activeBadge.innerText = activeList.length;
    historyBadge.innerText = historyList.length;

    // Render Active
    if (activeList.length === 0) {
        activePactsList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-box-open"></i>
                <p>No active pacts. Create one on the left to start!</p>
            </div>
        `;
    } else {
        activePactsList.innerHTML = activeList.map(p => renderPactCard(p)).join('');
    }

    // Render History
    if (historyList.length === 0) {
        historyPactsList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-history"></i>
                <p>Your resolved pacts will appear here.</p>
            </div>
        `;
    } else {
        historyPactsList.innerHTML = historyList.map(p => renderPactCard(p)).join('');
    }
}

function renderPactCard(pact) {
    const isCompleted = pact.status !== 0;
    let statusClass = 'status-active-badge';
    let statusText = 'Active';
    let cardClass = '';

    if (pact.status === 1) {
        statusClass = 'status-achieved-badge';
        statusText = 'Achieved';
        cardClass = 'achieved';
    } else if (pact.status === 2) {
        statusClass = 'status-failed-badge';
        statusText = 'Failed';
        cardClass = 'failed';
    }

    const reviewerShort = shortenAddress(pact.reviewer);
    const creatorShort = shortenAddress(pact.creator);

    // Dynamic buttons depending on whether we act as Creator or Reviewer (in simulator)
    let actionHTML = '';

    if (!isCompleted) {
        if (state.mode === 'simulation') {
            if (state.activeUser === 'creator') {
                actionHTML = `
                    <div class="card-actions">
                        <label>Update Proof of Work</label>
                        <div class="proof-input-wrapper">
                            <input type="text" id="proof-input-${pact.id}" placeholder="Enter new URL or commit SHA" value="${pact.proof_of_work}">
                            <button onclick="submitProof(${pact.id})" class="proof-update-btn">Update</button>
                        </div>
                        <div class="action-buttons-row">
                            <button onclick="admitDefeat(${pact.id})" class="btn-card btn-card-danger">
                                <i class="fa-solid fa-flag"></i> Admit Defeat
                            </button>
                        </div>
                    </div>
                `;
            } else if (state.activeUser === 'reviewer') {
                actionHTML = `
                    <div class="card-actions">
                        <span class="reviewer-label">Reviewer Controls</span>
                        <div class="action-buttons-row">
                            <button onclick="resolvePact(${pact.id}, true)" class="btn-card btn-card-success">
                                <i class="fa-solid fa-check"></i> Mark Achieved
                            </button>
                            <button onclick="resolvePact(${pact.id}, false)" class="btn-card btn-card-danger">
                                <i class="fa-solid fa-xmark"></i> Mark Failed
                            </button>
                        </div>
                    </div>
                `;
            }
        } else {
            // Real Blockchain Wallet Mode
            // Show Creator actions if the connected wallet address is the creator, otherwise reviewer actions if matched
            const userIsCreator = state.walletAddress && state.walletAddress.toLowerCase() === pact.creator.toLowerCase();
            const userIsReviewer = state.walletAddress && state.walletAddress.toLowerCase() === pact.reviewer.toLowerCase();

            if (userIsCreator) {
                actionHTML = `
                    <div class="card-actions">
                        <label>Update Proof of Work</label>
                        <div class="proof-input-wrapper">
                            <input type="text" id="proof-input-${pact.id}" placeholder="Enter new URL or commit SHA" value="${pact.proof_of_work}">
                            <button onclick="submitProof(${pact.id})" class="proof-update-btn">Update</button>
                        </div>
                        <div class="action-buttons-row">
                            <button onclick="admitDefeat(${pact.id})" class="btn-card btn-card-danger">
                                <i class="fa-solid fa-flag"></i> Admit Defeat
                            </button>
                        </div>
                    </div>
                `;
            } else if (userIsReviewer) {
                actionHTML = `
                    <div class="card-actions">
                        <span class="reviewer-label">Reviewer Controls</span>
                        <div class="action-buttons-row">
                            <button onclick="resolvePact(${pact.id}, true)" class="btn-card btn-card-success">
                                <i class="fa-solid fa-check"></i> Mark Achieved
                            </button>
                            <button onclick="resolvePact(${pact.id}, false)" class="btn-card btn-card-danger">
                                <i class="fa-solid fa-xmark"></i> Mark Failed
                            </button>
                        </div>
                    </div>
                `;
            } else {
                actionHTML = `
                    <div class="card-actions">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Connect as Creator or Reviewer to interact.</span>
                    </div>
                `;
            }
        }
    } else {
        // Resolved Pact display
        actionHTML = `
            <div class="card-actions">
                <div class="proof-box">
                    <strong>Proof of Work:</strong> 
                    ${pact.proof_of_work ? `<a href="${pact.proof_of_work.startsWith('http') ? pact.proof_of_work : '#'}" target="_blank">${pact.proof_of_work}</a>` : 'No proof submitted'}
                </div>
            </div>
        `;
    }

    return `
        <div class="pact-card ${cardClass}" id="pact-${pact.id}">
            <div class="pact-card-header">
                <h3>${escapeHTML(pact.milestone_description)}</h3>
                <span class="pact-status-badge ${statusClass}">${statusText}</span>
            </div>

            <div class="pact-details">
                <div class="detail-item address">
                    <span>Creator</span>
                    <div class="addr-flex">
                        <span class="addr-text" title="${pact.creator}">${creatorShort}</span>
                        <button onclick="copyToClipboard('${pact.creator}')" class="copy-btn" title="Copy Address"><i class="fa-regular fa-copy"></i></button>
                    </div>
                </div>
                <div class="detail-item address">
                    <span>Peer Reviewer</span>
                    <div class="addr-flex">
                        <span class="addr-text" title="${pact.reviewer}">${reviewerShort}</span>
                        <button onclick="copyToClipboard('${pact.reviewer}')" class="copy-btn" title="Copy Address"><i class="fa-regular fa-copy"></i></button>
                    </div>
                </div>
                <div class="detail-item">
                    <span>Staked Amount</span>
                    <strong style="color: var(--secondary-color);">${pact.stake_amount} APT</strong>
                </div>
                <div class="detail-item">
                    <span>Time Left</span>
                    <div class="countdown-timer" id="timer-${pact.id}" data-deadline="${pact.deadline}" data-completed="${isCompleted}">
                        Calculating...
                    </div>
                </div>
            </div>

            ${actionHTML}
        </div>
    `;
}

// --- Live Timer Engine ---
function updateTimers() {
    const timers = document.querySelectorAll('.countdown-timer');
    timers.forEach(timer => {
        const isCompleted = timer.getAttribute('data-completed') === 'true';
        if (isCompleted) {
            timer.innerText = "Resolved";
            timer.className = "countdown-timer";
            return;
        }

        const deadline = parseInt(timer.getAttribute('data-deadline'));
        const now = Math.floor(Date.now() / 1000);
        const diff = deadline - now;

        if (diff <= 0) {
            timer.innerText = "Expired (Review Pending)";
            timer.className = "countdown-timer expired";
        } else {
            const days = Math.floor(diff / 86400);
            const hours = Math.floor((diff % 86400) / 3600);
            const mins = Math.floor((diff % 3600) / 60);
            const secs = diff % 60;

            let timerText = "";
            if (days > 0) timerText += `${days}d `;
            if (hours > 0 || days > 0) timerText += `${hours}h `;
            if (mins > 0 || hours > 0 || days > 0) timerText += `${mins}m `;
            timerText += `${secs}s`;

            timer.innerText = timerText;

            if (diff < 300) { // under 5 minutes
                timer.className = "countdown-timer ending-soon";
            } else {
                timer.className = "countdown-timer";
            }
        }
    });
}

// --- Stats Recalculator ---
function updateStats() {
    const filteredPacts = state.pacts.filter(p => p.mode === state.mode);
    const activeCount = filteredPacts.filter(p => p.status === 0).length;
    const achievedCount = filteredPacts.filter(p => p.status === 1).length;
    const failedCount = filteredPacts.filter(p => p.status === 2).length;

    const totalStaked = filteredPacts.reduce((acc, p) => acc + (p.status === 0 ? p.stake_amount : 0), 0);
    
    statActive.innerText = activeCount;
    statAchieved.innerText = achievedCount;
    statStaked.innerText = `${totalStaked.toFixed(1)} APT`;

    const totalResolved = achievedCount + failedCount;
    if (totalResolved === 0) {
        statRate.innerText = "100%";
    } else {
        const rate = (achievedCount / totalResolved) * 100;
        statRate.innerText = `${Math.round(rate)}%`;
    }
}

// --- UI Toggle for Mode Changes ---
function updateUIForMode() {
    // Reset Form
    pactForm.reset();
    
    if (state.mode === 'simulation') {
        walletBtnText.innerText = state.walletConnected ? "Disconnect Sim Wallet" : "Connect Wallet";
        if (state.walletConnected) {
            walletBanner.classList.remove('hidden');
            walletBannerText.innerText = `Simulated Wallet Connected: ${shortenAddress(SIM_CREATOR_ADDR)}`;
        } else {
            walletBanner.classList.add('hidden');
        }
    } else {
        // Blockchain Mode
        if (state.walletConnected && state.walletAddress) {
            walletBtnText.innerText = shortenAddress(state.walletAddress);
            walletBanner.classList.remove('hidden');
            walletBannerText.innerText = `Connected to Aptos Account: ${state.walletAddress}`;
            fetchOnChainPacts();
        } else {
            state.walletConnected = false;
            state.walletAddress = null;
            walletBtnText.innerText = "Connect Wallet";
            walletBanner.classList.add('hidden');
        }
    }
    
    renderPacts();
    updateStats();
}

// --- Utility Helpers ---
function shortenAddress(addr) {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Address copied to clipboard!", "success");
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
};
