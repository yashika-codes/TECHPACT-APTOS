module techpact::accountability {
    use std::error;
    use std::signer;
    use std::string::String;
    use std::vector;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    // --- Error Codes ---
    const ENOT_FOUND: u64 = 1;
    const ENOT_REVIEWER: u64 = 2;
    const EPACT_NOT_ACTIVE: u64 = 3;
    const EINVALID_DEADLINE: u64 = 4;
    const EINVALID_STAKE: u64 = 5;
    const EPACT_EXPIRED: u64 = 6;
    const ENOT_CREATOR: u64 = 7;

    // --- Status Constants ---
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_ACHIEVED: u8 = 1;
    const STATUS_FAILED: u8 = 2;

    // --- Data Structures ---

    struct Pact has store {
        id: u64,
        reviewer: address,
        stake: Coin<AptosCoin>,
        stake_amount: u64,
        deadline: u64, // Unix timestamp in seconds
        proof_of_work: String,
        milestone_description: String,
        status: u8,
    }

    struct PactRegistry has key {
        pacts: vector<Pact>,
        next_pact_id: u64,
    }

    // --- Events ---

    #[event]
    struct PactCreated has drop, store {
        pact_id: u64,
        creator: address,
        reviewer: address,
        stake_amount: u64,
        deadline: u64,
        milestone_description: String,
    }

    #[event]
    struct ProofUpdated has drop, store {
        pact_id: u64,
        creator: address,
        proof_of_work: String,
    }

    #[event]
    struct PactResolved has drop, store {
        pact_id: u64,
        creator: address,
        reviewer: address,
        achieved: bool,
        stake_amount: u64,
    }

    // --- Public Entry Functions ---

    /// Creates a new accountability pact. The creator deposits `stake_amount` of AptosCoin,
    /// which will be held in the contract resource storage.
    public entry fun create_pact(
        creator: &signer,
        reviewer: address,
        stake_amount: u64,
        deadline: u64,
        milestone_description: String,
        proof_of_work: String
    ) acquires PactRegistry {
        let creator_addr = signer::address_of(creator);
        
        // Assertions
        assert!(stake_amount > 0, error::invalid_argument(EINVALID_STAKE));
        assert!(deadline > timestamp::now_seconds(), error::invalid_argument(EINVALID_DEADLINE));
        
        // Withdraw the staked coins from the creator's balance
        let stake_coin = coin::withdraw<AptosCoin>(creator, stake_amount);

        // Initialize PactRegistry if it doesn't exist under creator's account
        if (!exists<PactRegistry>(creator_addr)) {
            move_to(creator, PactRegistry {
                pacts: vector::empty<Pact>(),
                next_pact_id: 1,
            });
        };

        let registry = borrow_global_mut<PactRegistry>(creator_addr);
        let pact_id = registry.next_pact_id;
        registry.next_pact_id = pact_id + 1;

        let new_pact = Pact {
            id: pact_id,
            reviewer,
            stake: stake_coin,
            stake_amount,
            deadline,
            proof_of_work,
            milestone_description,
            status: STATUS_ACTIVE,
        };

        vector::push_back(&mut registry.pacts, new_pact);

        // Emit PactCreated event
        event::emit(PactCreated {
            pact_id,
            creator: creator_addr,
            reviewer,
            stake_amount,
            deadline,
            milestone_description,
        });
    }

    /// Allows the creator to update their proof of work (e.g. GitHub commit SHA or URL).
    /// Can only be done while the pact is active.
    public entry fun update_proof(
        creator: &signer,
        pact_id: u64,
        proof_of_work: String
    ) acquires PactRegistry {
        let creator_addr = signer::address_of(creator);
        assert!(exists<PactRegistry>(creator_addr), error::not_found(ENOT_FOUND));

        let registry = borrow_global_mut<PactRegistry>(creator_addr);
        let (found, index) = find_pact_by_id(&registry.pacts, pact_id);
        assert!(found, error::not_found(ENOT_FOUND));

        let pact = vector::borrow_mut(&mut registry.pacts, index);
        assert!(pact.status == STATUS_ACTIVE, error::invalid_state(EPACT_NOT_ACTIVE));
        
        pact.proof_of_work = proof_of_work;

        // Emit ProofUpdated event
        event::emit(ProofUpdated {
            pact_id,
            creator: creator_addr,
            proof_of_work,
        });
    }

    /// Called by the designated reviewer to mark a pact as Achieved (true) or Failed (false).
    /// If Achieved, the creator gets their coins back.
    /// If Failed, the reviewer receives the coins.
    public entry fun resolve_pact(
        reviewer: &signer,
        creator_addr: address,
        pact_id: u64,
        achieved: bool
    ) acquires PactRegistry {
        let reviewer_addr = signer::address_of(reviewer);
        assert!(exists<PactRegistry>(creator_addr), error::not_found(ENOT_FOUND));

        let registry = borrow_global_mut<PactRegistry>(creator_addr);
        let (found, index) = find_pact_by_id(&registry.pacts, pact_id);
        assert!(found, error::not_found(ENOT_FOUND));

        let pact = vector::borrow_mut(&mut registry.pacts, index);
        assert!(pact.status == STATUS_ACTIVE, error::invalid_state(EPACT_NOT_ACTIVE));
        assert!(pact.reviewer == reviewer_addr, error::permission_denied(ENOT_REVIEWER));

        // Extract coins from the pact
        let stake_amount = pact.stake_amount;
        let stake_coins = coin::extract(&mut pact.stake, stake_amount);

        if (achieved) {
            pact.status = STATUS_ACHIEVED;
            coin::deposit<AptosCoin>(creator_addr, stake_coins);
        } else {
            pact.status = STATUS_FAILED;
            coin::deposit<AptosCoin>(reviewer_addr, stake_coins);
        };

        // Emit PactResolved event
        event::emit(PactResolved {
            pact_id,
            creator: creator_addr,
            reviewer: reviewer_addr,
            achieved,
            stake_amount,
        });
    }

    /// Allows the creator to admit defeat and forfeit their staked coins directly to the reviewer.
    public entry fun admit_defeat(
        creator: &signer,
        pact_id: u64
    ) acquires PactRegistry {
        let creator_addr = signer::address_of(creator);
        assert!(exists<PactRegistry>(creator_addr), error::not_found(ENOT_FOUND));

        let registry = borrow_global_mut<PactRegistry>(creator_addr);
        let (found, index) = find_pact_by_id(&registry.pacts, pact_id);
        assert!(found, error::not_found(ENOT_FOUND));

        let pact = vector::borrow_mut(&mut registry.pacts, index);
        assert!(pact.status == STATUS_ACTIVE, error::invalid_state(EPACT_NOT_ACTIVE));

        // Extract coins from the pact
        let stake_amount = pact.stake_amount;
        let stake_coins = coin::extract(&mut pact.stake, stake_amount);
        let reviewer_addr = pact.reviewer;

        pact.status = STATUS_FAILED; // Marked as Failed (admitted defeat)

        coin::deposit<AptosCoin>(reviewer_addr, stake_coins);

        // Emit PactResolved event (achieved = false since creator admitted defeat)
        event::emit(PactResolved {
            pact_id,
            creator: creator_addr,
            reviewer: reviewer_addr,
            achieved: false,
            stake_amount,
        });
    }

    // --- View Functions ---

    #[view]
    public fun get_pact(
        creator_addr: address,
        pact_id: u64
    ): (address, u64, u64, String, String, u8) acquires PactRegistry {
        assert!(exists<PactRegistry>(creator_addr), error::not_found(ENOT_FOUND));
        let registry = borrow_global<PactRegistry>(creator_addr);
        let (found, index) = find_pact_by_id(&registry.pacts, pact_id);
        assert!(found, error::not_found(ENOT_FOUND));
        let pact = vector::borrow(&registry.pacts, index);
        (
            pact.reviewer,
            pact.stake_amount,
            pact.deadline,
            pact.proof_of_work,
            pact.milestone_description,
            pact.status
        )
    }

    #[view]
    public fun get_pact_count(creator_addr: address): u64 acquires PactRegistry {
        if (!exists<PactRegistry>(creator_addr)) {
            0
        } else {
            let registry = borrow_global<PactRegistry>(creator_addr);
            vector::length(&registry.pacts)
        }
    }

    // --- Private Helper Functions ---

    fun find_pact_by_id(pacts: &vector<Pact>, pact_id: u64): (bool, u64) {
        let len = vector::length(pacts);
        let i = 0;
        while (i < len) {
            let pact = vector::borrow(pacts, i);
            if (pact.id == pact_id) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }
}
