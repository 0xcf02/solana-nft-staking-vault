use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer, MintTo, SetAuthority},
    metadata::{
        mpl_token_metadata::types::{CollectionDetails, DataV2},
        Metadata, MetadataAccount,
    },
};
use spl_token::instruction::AuthorityType;

declare_id!("B8XmBimHbyZkzL1hsaYJM5BHwbPV2vVGf9eWtWc1zQ9P");

#[program]
pub mod solana_nft_staking_vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        reward_rate_per_second: u64,
        collection_mint: Pubkey,
    ) -> Result<()> {
        require!(reward_rate_per_second > 0, ErrorCode::InvalidRewardRate);
        
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.total_staked = 0;
        vault.reward_token_mint = ctx.accounts.reward_token_mint.key();
        vault.reward_rate_per_second = reward_rate_per_second;
        vault.collection_mint = collection_mint;
        vault.bump = ctx.bumps.vault;
        vault.paused = false;
        vault.last_update_timestamp = Clock::get()?.unix_timestamp;
        
        // Initialize RBAC & Governance
        vault.upgrade_authority = ctx.accounts.authority.key();
        vault.version = 1;
        vault.upgrade_locked = false;
        vault.pending_upgrade = None;

        // Initialize Circuit Breaker & Security
        vault.circuit_breaker = CircuitBreakerState::new();
        vault.daily_limit = DailyLimits::new();

        let seeds = &[b"vault".as_ref(), &[vault.bump]];
        let signer = &[&seeds[..]];

        let set_authority_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                account_or_mint: ctx.accounts.reward_token_mint.to_account_info(),
                current_authority: ctx.accounts.authority.to_account_info(),
            },
            signer,
        );

        token::set_authority(
            set_authority_ctx, 
            AuthorityType::MintTokens, 
            Some(vault.key())
        )?;

        // Verify that mint authority was transferred successfully
        let mint_info = ctx.accounts.reward_token_mint.to_account_info();
        let mint_account = Mint::try_deserialize(&mut &mint_info.data.borrow()[..])?;
        require!(
            mint_account.mint_authority == anchor_lang::prelude::COption::Some(vault.key()),
            ErrorCode::MintAuthorityTransferFailed
        );

        Ok(())
    }

    pub fn stake_nft(ctx: Context<StakeNft>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let user_stake = &mut ctx.accounts.user_stake;
        let clock = Clock::get()?;

        require!(!vault.paused, ErrorCode::VaultPaused);

        // Circuit breaker check
        require!(
            vault.circuit_breaker.can_execute(clock.unix_timestamp),
            ErrorCode::CircuitBreakerActive
        );

        // Daily limits check
        vault.daily_limit.reset_if_new_day(clock.unix_timestamp);
        require!(
            vault.daily_limit.can_stake(),
            ErrorCode::DailyLimitExceeded
        );
        require!(
            ctx.accounts.nft_mint.decimals == 0,
            ErrorCode::InvalidNft
        );
        require!(
            ctx.accounts.user_nft_token_account.amount == 1,
            ErrorCode::InvalidNft
        );

        let metadata_account = &ctx.accounts.nft_metadata;
        require!(
            metadata_account.collection.is_some(),
            ErrorCode::NoCollectionFound
        );
        
        let collection = metadata_account.collection.as_ref().unwrap();
        require!(
            collection.verified,
            ErrorCode::CollectionNotVerified
        );
        require!(
            collection.key == vault.collection_mint,
            ErrorCode::WrongCollection
        );

        if user_stake.last_update_timestamp > 0 {
            require!(
                clock.unix_timestamp - user_stake.last_update_timestamp >= 300, // 5 minutes
                ErrorCode::TooFrequent
            );
        }

        if user_stake.staked_nfts > 0 {
            let time_elapsed = clock.unix_timestamp - user_stake.last_update_timestamp;
            let rewards_earned = calculate_rewards(
                time_elapsed, 
                vault.reward_rate_per_second, 
                user_stake.staked_nfts as u64
            )?;
            
            user_stake.pending_rewards = user_stake.pending_rewards
                .checked_add(rewards_earned)
                .ok_or(ErrorCode::MathOverflow)?;
        }

        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_nft_token_account.to_account_info(),
                to: ctx.accounts.vault_nft_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, 1)?;

        user_stake.user = ctx.accounts.user.key();
        user_stake.staked_nfts = user_stake.staked_nfts
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        user_stake.last_update_timestamp = clock.unix_timestamp;

        vault.total_staked = vault.total_staked
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;

        // Record successful stake
        vault.daily_limit.record_stake();
        vault.circuit_breaker.on_success();

        emit!(NftStaked {
            user: ctx.accounts.user.key(),
            nft_mint: ctx.accounts.nft_mint.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn unstake_nft(ctx: Context<UnstakeNft>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let user_stake = &mut ctx.accounts.user_stake;
        let clock = Clock::get()?;

        require!(!vault.paused, ErrorCode::VaultPaused);
        require!(user_stake.staked_nfts > 0, ErrorCode::NoNftsStaked);
        require!(
            clock.unix_timestamp - user_stake.last_update_timestamp >= 300, // 5 minutes
            ErrorCode::TooFrequent
        );

        let time_elapsed = clock.unix_timestamp - user_stake.last_update_timestamp;
        let rewards_earned = calculate_rewards(
            time_elapsed, 
            vault.reward_rate_per_second, 
            user_stake.staked_nfts as u64
        )?;
        
        user_stake.pending_rewards = user_stake.pending_rewards
            .checked_add(rewards_earned)
            .ok_or(ErrorCode::MathOverflow)?;

        let seeds = &[b"vault".as_ref(), &[vault.bump]];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_nft_token_account.to_account_info(),
                to: ctx.accounts.user_nft_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, 1)?;

        user_stake.staked_nfts = user_stake.staked_nfts
            .checked_sub(1)
            .ok_or(ErrorCode::MathUnderflow)?;
        user_stake.last_update_timestamp = clock.unix_timestamp;

        vault.total_staked = vault.total_staked
            .checked_sub(1)
            .ok_or(ErrorCode::MathUnderflow)?;

        emit!(NftUnstaked {
            user: ctx.accounts.user.key(),
            nft_mint: ctx.accounts.nft_mint.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let user_stake = &mut ctx.accounts.user_stake;
        let clock = Clock::get()?;

        require!(!vault.paused, ErrorCode::VaultPaused);

        // Circuit breaker check
        require!(
            vault.circuit_breaker.can_execute(clock.unix_timestamp),
            ErrorCode::CircuitBreakerActive
        );

        require!(
            clock.unix_timestamp - user_stake.last_update_timestamp >= 60,
            ErrorCode::TooFrequentClaim
        );

        let time_elapsed = clock.unix_timestamp - user_stake.last_update_timestamp;
        let rewards_earned = calculate_rewards(
            time_elapsed, 
            vault.reward_rate_per_second, 
            user_stake.staked_nfts as u64
        )?;
        
        let total_rewards = user_stake.pending_rewards
            .checked_add(rewards_earned)
            .ok_or(ErrorCode::MathOverflow)?;

        require!(total_rewards > 0, ErrorCode::NoRewardsToClaim);

        // Daily limits check
        vault.daily_limit.reset_if_new_day(clock.unix_timestamp);
        require!(
            vault.daily_limit.can_claim(total_rewards),
            ErrorCode::DailyLimitExceeded
        );

        // Anti-exploitation: Maximum reward per day per NFT
        let max_reward_per_nft_per_day = vault.reward_rate_per_second
            .checked_mul(86400)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let max_total_reward = max_reward_per_nft_per_day
            .checked_mul(user_stake.staked_nfts as u64)
            .ok_or(ErrorCode::MathOverflow)?;
        
        require!(total_rewards <= max_total_reward, ErrorCode::ExcessiveRewardClaim);

        // Additional safety: Check if reward amount seems reasonable
        let time_since_init = clock.unix_timestamp - vault.last_update_timestamp;
        let theoretical_max = vault.reward_rate_per_second
            .checked_mul(time_since_init as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(user_stake.staked_nfts as u64)
            .ok_or(ErrorCode::MathOverflow)?;
        
        require!(total_rewards <= theoretical_max, ErrorCode::ExcessiveRewardClaim);

        // Verify mint has sufficient authority
        let mint_info = ctx.accounts.reward_token_mint.to_account_info();
        let mint_account = Mint::try_deserialize(&mut &mint_info.data.borrow()[..])?;
        require!(
            mint_account.mint_authority == anchor_lang::prelude::COption::Some(vault.key()),
            ErrorCode::InvalidMintAuthority
        );

        let seeds = &[b"vault".as_ref(), &[vault.bump]];
        let signer = &[&seeds[..]];

        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.reward_token_mint.to_account_info(),
                to: ctx.accounts.user_reward_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        );
        token::mint_to(mint_ctx, total_rewards)?;

        user_stake.pending_rewards = 0;
        user_stake.last_update_timestamp = clock.unix_timestamp;

        // Record successful claim
        vault.daily_limit.record_claim(total_rewards);
        vault.circuit_breaker.on_success();

        emit!(RewardsClaimed {
            user: ctx.accounts.user.key(),
            amount: total_rewards,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn pause_vault(ctx: Context<PauseVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let pauser_role = &ctx.accounts.user_role;
        
        require!(!vault.paused, ErrorCode::AlreadyPaused);
        require!(
            pauser_role.role.can_pause_vault(),
            ErrorCode::InsufficientPermissions
        );
        
        vault.paused = true;
        
        emit!(VaultPaused {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn unpause_vault(ctx: Context<PauseVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let unpauser_role = &ctx.accounts.user_role;
        
        require!(vault.paused, ErrorCode::NotPaused);
        require!(
            unpauser_role.role.can_pause_vault(),
            ErrorCode::InsufficientPermissions
        );
        
        vault.paused = false;
        
        emit!(VaultUnpaused {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    // RBAC Functions
    pub fn grant_role(
        ctx: Context<ManageRole>, 
        user: Pubkey,
        role: Role
    ) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let granter_role_account = &ctx.accounts.granter_role;
        
        // Only SuperAdmin can grant roles
        require!(
            granter_role_account.role.can_manage_roles(),
            ErrorCode::InsufficientPermissions
        );

        let role_account = &mut ctx.accounts.user_role;
        role_account.user = user;
        role_account.role = role;
        role_account.granted_by = ctx.accounts.granter.key();
        role_account.granted_at = Clock::get()?.unix_timestamp;

        emit!(RoleGranted {
            user,
            role: role.clone(),
            granted_by: ctx.accounts.granter.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn revoke_role(ctx: Context<ManageRole>) -> Result<()> {
        let granter_role_account = &ctx.accounts.granter_role;
        
        require!(
            granter_role_account.role.can_manage_roles(),
            ErrorCode::InsufficientPermissions
        );

        let role_account = &mut ctx.accounts.user_role;
        let user = role_account.user;

        emit!(RoleRevoked {
            user,
            revoked_by: ctx.accounts.granter.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // Upgrade Functions
    pub fn propose_upgrade(
        ctx: Context<ProposeUpgrade>,
        new_version: u32,
        timelock_seconds: i64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let proposer_role = &ctx.accounts.proposer_role;

        require!(!vault.upgrade_locked, ErrorCode::UpgradesLocked);
        require!(vault.pending_upgrade.is_none(), ErrorCode::UpgradePending);
        require!(
            proposer_role.role.can_manage_upgrades(),
            ErrorCode::InsufficientPermissions
        );
        require!(new_version > vault.version, ErrorCode::InvalidVersion);
        require!(
            timelock_seconds >= 3600, // Minimum 1 hour
            ErrorCode::InvalidTimelock
        );

        let scheduled_timestamp = Clock::get()?.unix_timestamp + timelock_seconds;

        vault.pending_upgrade = Some(PendingUpgrade {
            new_version,
            scheduled_timestamp,
            proposer: ctx.accounts.proposer.key(),
        });

        emit!(UpgradeProposed {
            new_version,
            scheduled_timestamp,
            proposer: ctx.accounts.proposer.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn execute_upgrade(ctx: Context<ExecuteUpgrade>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let executor_role = &ctx.accounts.executor_role;
        
        require!(
            executor_role.role.can_manage_upgrades(),
            ErrorCode::InsufficientPermissions
        );

        let pending_upgrade = vault.pending_upgrade.as_ref()
            .ok_or(ErrorCode::NoUpgradePending)?;

        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= pending_upgrade.scheduled_timestamp,
            ErrorCode::TimelockNotExpired
        );

        // Execute upgrade
        vault.version = pending_upgrade.new_version;
        vault.pending_upgrade = None;

        emit!(UpgradeExecuted {
            new_version: vault.version,
            executor: ctx.accounts.executor.key(),
            timestamp: now,
        });

        Ok(())
    }

    pub fn cancel_upgrade(ctx: Context<CancelUpgrade>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let canceller_role = &ctx.accounts.canceller_role;
        
        require!(
            canceller_role.role.can_manage_upgrades(),
            ErrorCode::InsufficientPermissions
        );
        require!(vault.pending_upgrade.is_some(), ErrorCode::NoUpgradePending);

        vault.pending_upgrade = None;

        emit!(UpgradeCancelled {
            cancelled_by: ctx.accounts.canceller.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn lock_upgrades(ctx: Context<LockUpgrades>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let locker_role = &ctx.accounts.locker_role;
        
        require!(
            locker_role.role.can_manage_upgrades(),
            ErrorCode::InsufficientPermissions
        );
        require!(!vault.upgrade_locked, ErrorCode::UpgradesAlreadyLocked);

        vault.upgrade_locked = true;
        vault.pending_upgrade = None;

        emit!(UpgradesLocked {
            locked_by: ctx.accounts.locker.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_reward_rate: Option<u64>,
        new_collection_mint: Option<Pubkey>,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let updater_role = &ctx.accounts.updater_role;
        
        require!(
            updater_role.role.can_update_config(),
            ErrorCode::InsufficientPermissions
        );

        if let Some(rate) = new_reward_rate {
            require!(rate > 0, ErrorCode::InvalidRewardRate);
            vault.reward_rate_per_second = rate;
        }

        if let Some(mint) = new_collection_mint {
            vault.collection_mint = mint;
        }

        emit!(ConfigUpdated {
            updated_by: ctx.accounts.updater.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

fn calculate_rewards(
    time_elapsed: i64,
    reward_rate_per_second: u64,
    staked_nfts: u64,
) -> Result<u64> {
    require!(
        time_elapsed >= 0 && time_elapsed <= 172_800, // 48 hours max
        ErrorCode::InvalidTimeElapsed
    );

    let time_elapsed = time_elapsed as u64;
    let rewards = time_elapsed
        .checked_mul(reward_rate_per_second)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_mul(staked_nfts)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(rewards)
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VaultAccount::INIT_SPACE,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub reward_token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeNft<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStakeAccount::INIT_SPACE,
        seeds = [b"user_stake", user.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStakeAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            nft_mint.key().as_ref()
        ],
        seeds::program = metadata_program.key(),
        bump
    )]
    pub nft_metadata: Account<'info, MetadataAccount>,

    #[account(
        mut,
        constraint = user_nft_token_account.mint == nft_mint.key(),
        constraint = user_nft_token_account.owner == user.key(),
        constraint = user_nft_token_account.amount == 1
    )]
    pub user_nft_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = nft_mint,
        associated_token::authority = vault
    )]
    pub vault_nft_token_account: Account<'info, TokenAccount>,

    pub metadata_program: Program<'info, Metadata>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnstakeNft<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(
        mut,
        seeds = [b"user_stake", user.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStakeAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_nft_token_account.mint == nft_mint.key(),
        constraint = user_nft_token_account.owner == user.key()
    )]
    pub user_nft_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = vault
    )]
    pub vault_nft_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(
        mut,
        seeds = [b"user_stake", user.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStakeAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = reward_token_mint.key() == vault.reward_token_mint
    )]
    pub reward_token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = reward_token_mint,
        associated_token::authority = user
    )]
    pub user_reward_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PauseVault<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"role", authority.key().as_ref()],
        bump
    )]
    pub user_role: Account<'info, AccountRole>,
}

#[derive(Accounts)]
pub struct ManageRole<'info> {
    #[account(seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub granter: Signer<'info>,

    #[account(
        seeds = [b"role", granter.key().as_ref()],
        bump
    )]
    pub granter_role: Account<'info, AccountRole>,

    #[account(
        init_if_needed,
        payer = granter,
        space = 8 + AccountRole::INIT_SPACE,
        seeds = [b"role", user_role.user.as_ref()],
        bump
    )]
    pub user_role: Account<'info, AccountRole>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeUpgrade<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    #[account(
        seeds = [b"role", proposer.key().as_ref()],
        bump
    )]
    pub proposer_role: Account<'info, AccountRole>,
}

#[derive(Accounts)]
pub struct ExecuteUpgrade<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub executor: Signer<'info>,

    #[account(
        seeds = [b"role", executor.key().as_ref()],
        bump
    )]
    pub executor_role: Account<'info, AccountRole>,
}

#[derive(Accounts)]
pub struct CancelUpgrade<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub canceller: Signer<'info>,

    #[account(
        seeds = [b"role", canceller.key().as_ref()],
        bump
    )]
    pub canceller_role: Account<'info, AccountRole>,
}

#[derive(Accounts)]
pub struct LockUpgrades<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub locker: Signer<'info>,

    #[account(
        seeds = [b"role", locker.key().as_ref()],
        bump
    )]
    pub locker_role: Account<'info, AccountRole>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub updater: Signer<'info>,

    #[account(
        seeds = [b"role", updater.key().as_ref()],
        bump
    )]
    pub updater_role: Account<'info, AccountRole>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultAccount {
    pub authority: Pubkey,
    pub total_staked: u32,
    pub reward_token_mint: Pubkey,
    pub reward_rate_per_second: u64,
    pub collection_mint: Pubkey,
    pub paused: bool,
    pub last_update_timestamp: i64,
    pub bump: u8,
    // RBAC & Governance
    pub upgrade_authority: Pubkey,
    pub version: u32,
    pub upgrade_locked: bool,
    pub pending_upgrade: Option<PendingUpgrade>,
    // Circuit Breaker & Security
    pub circuit_breaker: CircuitBreakerState,
    pub daily_limit: DailyLimits,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CircuitBreakerState {
    pub failure_count: u32,
    pub last_failure_timestamp: i64,
    pub blocked: bool,
    pub total_transactions: u64,
    pub failed_transactions: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct DailyLimits {
    pub max_stakes_per_day: u32,
    pub max_claims_per_day: u32,
    pub max_total_rewards_per_day: u64,
    pub stakes_today: u32,
    pub claims_today: u32,
    pub rewards_claimed_today: u64,
    pub last_reset_timestamp: i64,
}

impl CircuitBreakerState {
    pub fn new() -> Self {
        Self {
            failure_count: 0,
            last_failure_timestamp: 0,
            blocked: false,
            total_transactions: 0,
            failed_transactions: 0,
        }
    }

    pub fn can_execute(&self, current_timestamp: i64) -> bool {
        const FAILURE_THRESHOLD: u32 = 10;
        const RESET_TIMEOUT: i64 = 600; // 10 minutes

        if !self.blocked {
            return true;
        }

        // Reset if timeout has passed
        if current_timestamp - self.last_failure_timestamp > RESET_TIMEOUT {
            return true;
        }

        self.failure_count < FAILURE_THRESHOLD
    }

    pub fn on_success(&mut self) {
        self.total_transactions += 1;
        if self.blocked && self.failure_count > 0 {
            self.failure_count = self.failure_count.saturating_sub(1);
            if self.failure_count == 0 {
                self.blocked = false;
            }
        }
    }

    pub fn on_failure(&mut self, current_timestamp: i64) {
        const FAILURE_THRESHOLD: u32 = 10;
        
        self.total_transactions += 1;
        self.failed_transactions += 1;
        self.failure_count += 1;
        self.last_failure_timestamp = current_timestamp;

        if self.failure_count >= FAILURE_THRESHOLD {
            self.blocked = true;
        }
    }
}

impl DailyLimits {
    pub fn new() -> Self {
        Self {
            max_stakes_per_day: 100,
            max_claims_per_day: 50,  
            max_total_rewards_per_day: 1_000_000_000, // 1000 tokens with 6 decimals
            stakes_today: 0,
            claims_today: 0,
            rewards_claimed_today: 0,
            last_reset_timestamp: 0,
        }
    }

    pub fn reset_if_new_day(&mut self, current_timestamp: i64) {
        const SECONDS_PER_DAY: i64 = 86400;
        
        if current_timestamp - self.last_reset_timestamp > SECONDS_PER_DAY {
            self.stakes_today = 0;
            self.claims_today = 0;
            self.rewards_claimed_today = 0;
            self.last_reset_timestamp = current_timestamp;
        }
    }

    pub fn can_stake(&self) -> bool {
        self.stakes_today < self.max_stakes_per_day
    }

    pub fn can_claim(&self, reward_amount: u64) -> bool {
        self.claims_today < self.max_claims_per_day &&
        self.rewards_claimed_today + reward_amount <= self.max_total_rewards_per_day
    }

    pub fn record_stake(&mut self) {
        self.stakes_today += 1;
    }

    pub fn record_claim(&mut self, reward_amount: u64) {
        self.claims_today += 1;
        self.rewards_claimed_today += reward_amount;
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct PendingUpgrade {
    pub new_version: u32,
    pub scheduled_timestamp: i64,
    pub proposer: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct AccountRole {
    pub user: Pubkey,
    pub role: Role,
    pub granted_by: Pubkey,
    pub granted_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum Role {
    SuperAdmin,
    Admin, 
    Moderator,
    Operator,
}

impl Role {
    pub fn can_pause_vault(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::Admin | Role::Moderator)
    }

    pub fn can_update_config(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::Admin)
    }

    pub fn can_manage_roles(&self) -> bool {
        matches!(self, Role::SuperAdmin)
    }

    pub fn can_moderate_users(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::Admin | Role::Moderator)
    }

    pub fn can_manage_treasury(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::Admin)
    }

    pub fn can_manage_upgrades(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::Admin)
    }
}

#[account]
#[derive(InitSpace)]
pub struct UserStakeAccount {
    pub user: Pubkey,
    pub staked_nfts: u32,
    pub pending_rewards: u64,
    pub last_update_timestamp: i64,
}

// Events
#[event]
pub struct NftStaked {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct NftUnstaked {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RewardsClaimed {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct VaultPaused {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaultUnpaused {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RoleGranted {
    pub user: Pubkey,
    pub role: Role,
    pub granted_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RoleRevoked {
    pub user: Pubkey,
    pub revoked_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct UpgradeProposed {
    pub new_version: u32,
    pub scheduled_timestamp: i64,
    pub proposer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct UpgradeExecuted {
    pub new_version: u32,
    pub executor: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct UpgradeCancelled {
    pub cancelled_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct UpgradesLocked {
    pub locked_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ConfigUpdated {
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Math underflow")]
    MathUnderflow,
    #[msg("No NFTs staked")]
    NoNftsStaked,
    #[msg("No rewards to claim")]
    NoRewardsToClaim,
    #[msg("Invalid NFT - must have amount=1 and decimals=0")]
    InvalidNft,
    #[msg("No collection found in NFT metadata")]
    NoCollectionFound,
    #[msg("Collection not verified")]
    CollectionNotVerified,
    #[msg("Wrong collection - NFT not from authorized collection")]
    WrongCollection,
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("Operation too frequent - rate limited")]
    TooFrequent,
    #[msg("Claim too frequent - minimum 60 seconds between claims")]
    TooFrequentClaim,
    #[msg("Invalid time elapsed - must be between 0 and 30 days")]
    InvalidTimeElapsed,
    #[msg("Excessive reward claim - exceeds maximum allowed")]
    ExcessiveRewardClaim,
    #[msg("Invalid reward rate - must be greater than 0")]
    InvalidRewardRate,
    #[msg("Already paused")]
    AlreadyPaused,
    #[msg("Not paused")]
    NotPaused,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Insufficient permissions for this action")]
    InsufficientPermissions,
    #[msg("Upgrades are permanently locked")]
    UpgradesLocked,
    #[msg("An upgrade is already pending")]
    UpgradePending,
    #[msg("No upgrade is currently pending")]
    NoUpgradePending,
    #[msg("Invalid version number")]
    InvalidVersion,
    #[msg("Invalid timelock duration")]
    InvalidTimelock,
    #[msg("Timelock period has not expired")]
    TimelockNotExpired,
    #[msg("Upgrades are already locked")]
    UpgradesAlreadyLocked,
    #[msg("Failed to transfer mint authority to vault")]
    MintAuthorityTransferFailed,
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,
    #[msg("Circuit breaker is active - too many failures")]
    CircuitBreakerActive,
    #[msg("Daily operation limit exceeded")]
    DailyLimitExceeded,
}