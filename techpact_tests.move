#[test_only]
module techpact::accountability_tests {
    use std::signer;
    use std::string;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::timestamp;
    use techpact::accountability;

    // Helper to setup test environment with AptosCoin and accounts
    fun setup_test(
        aptos_framework: &signer,
        creator: &signer,
        reviewer: &signer,
        stake_amount: u64
    ) {
        timestamp::set_time_has_started_for_testing(aptos_framework);

        let creator_addr = signer::address_of(creator);
        let reviewer_addr = signer::address_of(reviewer);

        account::create_account_for_test(creator_addr);
        account::create_account_for_test(reviewer_addr);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);

        coin::register<AptosCoin>(creator);
        coin::register<AptosCoin>(reviewer);

        let coins = coin::mint<AptosCoin>(stake_amount, &mint_cap);
        coin::deposit(creator_addr, coins);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(aptos_framework = @0x1, creator = @0x11, reviewer = @0x22)]
    fun test_create_pact_success(
        aptos_framework: &signer,
        creator: &signer,
        reviewer: &signer
    ) {
        let stake = 1000;
        setup_test(aptos_framework, creator, reviewer, stake);
        
        let creator_addr = signer::address_of(creator);
        let reviewer_addr = signer::address_of(reviewer);

        // Initial balance check
        assert!(coin::balance<AptosCoin>(creator_addr) == stake, 0);

        let milestone = string::utf8(b"Complete 5 Leetcode Dynamic Programming questions");
        let initial_proof = string::utf8(b"https://github.com/my-repo");
        let deadline = timestamp::now_seconds() + 3600; // 1 hour from now

        accountability::create_pact(
            creator,
            reviewer_addr,
            stake,
            deadline,
            milestone,
            initial_proof
        );

        // Check that the stake was withdrawn
        assert!(coin::balance<AptosCoin>(creator_addr) == 0, 1);
        assert!(accountability::get_pact_count(creator_addr) == 1, 2);

        let (pact_reviewer, pact_stake, pact_deadline, pact_proof, pact_desc, pact_status) = 
            accountability::get_pact(creator_addr, 1);

        assert!(pact_reviewer == reviewer_addr, 3);
        assert!(pact_stake == stake, 4);
        assert!(pact_deadline == deadline, 5);
        assert!(pact_proof == initial_proof, 6);
        assert!(pact_desc == milestone, 7);
        assert!(pact_status == 0, 8); // Active
    }

    #[test(aptos_framework = @0x1, creator = @0x11, reviewer = @0x22)]
    fun test_update_proof_success(
        aptos_framework: &signer,
        creator: &signer,
        reviewer: &signer
    ) {
        let stake = 1000;
        setup_test(aptos_framework, creator, reviewer, stake);
        
        let creator_addr = signer::address_of(creator);
        let reviewer_addr = signer::address_of(reviewer);
        let deadline = timestamp::now_seconds() + 3600;

        accountability::create_pact(
            creator,
            reviewer_addr,
            stake,
            deadline,
            string::utf8(b"Milestone"),
            string::utf8(b"initial_proof")
        );

        let new_proof = string::utf8(b"commit-sha-12345");
        accountability::update_proof(creator, 1, new_proof);

        let (_, _, _, pact_proof, _, _) = accountability::get_pact(creator_addr, 1);
        assert!(pact_proof == new_proof, 1);
    }

    #[test(aptos_framework = @0x1, creator = @0x11, reviewer = @0x22)]
    fun test_resolve_pact_achieved(
        aptos_framework: &signer,
        creator: &signer,
        reviewer: &signer
    ) {
        let stake = 1000;
        setup_test(aptos_framework, creator, reviewer, stake);
        
        let creator_addr = signer::address_of(creator);
        let reviewer_addr = signer::address_of(reviewer);
        let deadline = timestamp::now_seconds() + 3600;

        accountability::create_pact(
            creator,
            reviewer_addr,
            stake,
            deadline,
            string::utf8(b"Milestone"),
            string::utf8(b"proof")
        );

        // Resolve as Achieved
        accountability::resolve_pact(reviewer, creator_addr, 1, true);

        // Creator should get the stake back
        assert!(coin::balance<AptosCoin>(creator_addr) == stake, 1);
        // Reviewer should have 0 balance change
        assert!(coin::balance<AptosCoin>(reviewer_addr) == 0, 2);

        let (_, _, _, _, _, pact_status) = accountability::get_pact(creator_addr, 1);
        assert!(pact_status == 1, 3); // Achieved
    }

    #[test(aptos_framework = @0x1, creator = @0x11, reviewer = @0x22)]
    fun test_resolve_pact_failed(
        aptos_framework: &signer,
        creator: &signer,
        reviewer: &signer
    ) {
        let stake = 1000;
        setup_test(aptos_framework, creator, reviewer, stake);
        
        let creator_addr = signer::address_of(creator);
        let reviewer_addr = signer::address_of(reviewer);
        let deadline = timestamp::now_seconds() + 3600;

        accountability::create_pact(
            creator,
            reviewer_addr,
            stake,
            deadline,
            string::utf8(b"Milestone"),
            string::utf8(b"proof")
        );

        // Resolve as Failed
        accountability::resolve_pact(reviewer, creator_addr, 1, false);

        // Creator has 0 balance
        assert!(coin::balance<AptosCoin>(creator_addr) == 0, 1);
        // Reviewer gets the stake
        assert!(coin::balance<AptosCoin>(reviewer_addr) == stake, 2);

        let (_, _, _, _, _, pact_status) = accountability::get_pact(creator_addr, 1);
        assert!(pact_status == 2, 3); // Failed
    }

    #[test(aptos_framework = @0x1, creator = @0x11, reviewer = @0x22)]
    fun test_admit_defeat(
        aptos_framework: &signer,
        creator: &signer,
        reviewer: &signer
    ) {
        let stake = 1000;
        setup_test(aptos_framework, creator, reviewer, stake);
        
        let creator_addr = signer::address_of(creator);
        let reviewer_addr = signer::address_of(reviewer);
        let deadline = timestamp::now_seconds() + 3600;

        accountability::create_pact(
            creator,
            reviewer_addr,
            stake,
            deadline,
            string::utf8(b"Milestone"),
            string::utf8(b"proof")
        );

        // Creator admits defeat
        accountability::admit_defeat(creator, 1);

        // Creator has 0 balance
        assert!(coin::balance<AptosCoin>(creator_addr) == 0, 1);
        // Reviewer gets the stake
        assert!(coin::balance<AptosCoin>(reviewer_addr) == stake, 2);

        let (_, _, _, _, _, pact_status) = accountability::get_pact(creator_addr, 1);
        assert!(pact_status == 2, 3); // Failed
    }

    #[test(aptos_framework = @0x1, creator = @0x11, reviewer = @0x22, attacker = @0x33)]
    #[expected_failure(abort_code = 0x50002, location = techpact::accountability)]
    fun test_unauthorized_reviewer(
        aptos_framework: &signer,
        creator: &signer,
        reviewer: &signer,
        attacker: &signer
    ) {
        let stake = 1000;
        setup_test(aptos_framework, creator, reviewer, stake);
        account::create_account_for_test(signer::address_of(attacker));
        
        let creator_addr = signer::address_of(creator);
        let reviewer_addr = signer::address_of(reviewer);
        let deadline = timestamp::now_seconds() + 3600;

        accountability::create_pact(
            creator,
            reviewer_addr,
            stake,
            deadline,
            string::utf8(b"Milestone"),
            string::utf8(b"proof")
        );

        // Attacker attempts to resolve the pact
        accountability::resolve_pact(attacker, creator_addr, 1, true);
    }
}
