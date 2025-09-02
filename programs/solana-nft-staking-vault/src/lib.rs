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

declare_id!("DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1");

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

        // Transfer mint authority to vault PDA
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

        Ok(())
    }

    pub fn stake_nft(ctx: Context<StakeNft>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let user_stake = &mut ctx.accounts.user_stake;
        let clock = Clock::get()?;

        // Check if vault is not paused
        require!(!vault.paused, ErrorCode::VaultPaused);

        // Verify NFT is valid (amount = 1, decimals = 0)
        require!(
            ctx.accounts.nft_mint.decimals == 0,
            ErrorCode::InvalidNft
        );
        require!(
            ctx.accounts.user_nft_token_account.amount == 1,
            ErrorCode::InvalidNft
        );

        // Verify NFT belongs to authorized collection via metadata
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

        // Rate limiting: prevent multiple stakes in short time
        if user_stake.last_update_timestamp > 0 {
            require!(
                clock.unix_timestamp - user_stake.last_update_timestamp >= 1, // 1 second minimum
                ErrorCode::TooFrequent
            );
        }

        // Update rewards before changing stake
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

        // Transfer NFT to vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_nft_token_account.to_account_info(),
                to: ctx.accounts.vault_nft_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, 1)?;

        // Update user stake info
        user_stake.user = ctx.accounts.user.key();
        user_stake.staked_nfts = user_stake.staked_nfts
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        user_stake.last_update_timestamp = clock.unix_timestamp;

        // Update vault info
        vault.total_staked = vault.total_staked
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;

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

        // Check if vault is not paused
        require!(!vault.paused, ErrorCode::VaultPaused);
        require!(user_stake.staked_nfts > 0, ErrorCode::NoNftsStaked);

        // Rate limiting
        require!(
            clock.unix_timestamp - user_stake.last_update_timestamp >= 1,
            ErrorCode::TooFrequent
        );

        // Calculate pending rewards
        let time_elapsed = clock.unix_timestamp - user_stake.last_update_timestamp;
        let rewards_earned = calculate_rewards(
            time_elapsed, 
            vault.reward_rate_per_second, 
            user_stake.staked_nfts as u64
        )?;
        
        user_stake.pending_rewards = user_stake.pending_rewards
            .checked_add(rewards_earned)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transfer NFT back to user
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

        // Update user stake info
        user_stake.staked_nfts = user_stake.staked_nfts
            .checked_sub(1)
            .ok_or(ErrorCode::MathUnderflow)?;
        user_stake.last_update_timestamp = clock.unix_timestamp;

        // Update vault info
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

        // Check if vault is not paused
        require!(!vault.paused, ErrorCode::VaultPaused);

        // Rate limiting for claims (minimum 60 seconds between claims)
        require!(
            clock.unix_timestamp - user_stake.last_update_timestamp >= 60,
            ErrorCode::TooFrequentClaim
        );

        // Calculate total pending rewards
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

        // Check for reasonable reward amount (prevent overflow attacks)
        let max_reward = vault.reward_rate_per_second
            .checked_mul(86400) // Max 24 hours worth
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(user_stake.staked_nfts as u64)
            .ok_or(ErrorCode::MathOverflow)?;
        
        require!(total_rewards <= max_reward, ErrorCode::ExcessiveRewardClaim);

        // Mint rewards to user
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

        // Reset user rewards
        user_stake.pending_rewards = 0;
        user_stake.last_update_timestamp = clock.unix_timestamp;

        emit!(RewardsClaimed {
            user: ctx.accounts.user.key(),
            amount: total_rewards,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // Administrative functions
    pub fn pause_vault(ctx: Context<PauseVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.paused, ErrorCode::AlreadyPaused);
        
        vault.paused = true;
        
        emit!(VaultPaused {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn unpause_vault(ctx: Context<PauseVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.paused, ErrorCode::NotPaused);
        
        vault.paused = false;
        
        emit!(VaultUnpaused {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

// Helper function for reward calculation with time validation
fn calculate_rewards(
    time_elapsed: i64,
    reward_rate_per_second: u64,
    staked_nfts: u64,
) -> Result<u64> {
    // Validate time_elapsed is reasonable (max 30 days)
    require!(
        time_elapsed >= 0 && time_elapsed <= 2_592_000, // 30 days
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

    /// NFT Metadata account for collection verification
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

    #[account(
        constraint = authority.key() == vault.authority @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,
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
}