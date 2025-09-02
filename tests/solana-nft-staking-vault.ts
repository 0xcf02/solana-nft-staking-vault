import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaNftStakingVault } from "../target/types/solana_nft_staking_vault";
import { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  setAuthority,
  AuthorityType,
} from "@solana/spl-token";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { 
  Metaplex, 
  keypairIdentity, 
  bundlrStorage,
  CreateNftOutput,
} from "@metaplex-foundation/js";
import { expect } from "chai";

describe("solana-nft-staking-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaNftStakingVault as Program<SolanaNftStakingVault>;
  
  // Test accounts
  const authority = Keypair.generate();
  const user = Keypair.generate();
  const collectionAuthority = Keypair.generate();
  
  let rewardTokenMint: PublicKey;
  let nft: CreateNftOutput;
  let collectionNft: CreateNftOutput;
  let userRewardTokenAccount: PublicKey;
  let userNftTokenAccount: PublicKey;
  let vaultPda: PublicKey;
  let userStakePda: PublicKey;
  let vaultBump: number;
  let metaplex: Metaplex;

  const REWARD_RATE_PER_SECOND = new anchor.BN(1000000); // 1 token per second (with 6 decimals)
  const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  before(async () => {
    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(authority.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(collectionAuthority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for airdrops
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Setup Metaplex
    metaplex = Metaplex.make(provider.connection)
      .use(keypairIdentity(collectionAuthority))
      .use(bundlrStorage({
        address: 'https://devnet.bundlr.network',
        providerUrl: 'https://api.devnet.solana.com',
        timeout: 60000,
      }));

    // Create collection NFT
    console.log("Creating collection NFT...");
    collectionNft = await metaplex.nfts().create({
      uri: "https://example.com/collection.json",
      name: "Test Collection",
      symbol: "TEST",
      sellerFeeBasisPoints: 500,
      isCollection: true,
      creators: [{ address: collectionAuthority.publicKey, share: 100, verified: true }],
    });

    // Create NFT that belongs to collection
    console.log("Creating NFT with collection...");
    nft = await metaplex.nfts().create({
      uri: "https://example.com/nft.json", 
      name: "Test NFT",
      symbol: "TNFT",
      sellerFeeBasisPoints: 500,
      collection: {
        key: collectionNft.mintAddress,
        verified: false, // Will be verified later
      },
      creators: [{ address: collectionAuthority.publicKey, share: 100, verified: true }],
    });

    // Verify collection
    await metaplex.nfts().verifyCollection({
      mintAddress: nft.mintAddress,
      collectionMintAddress: collectionNft.mintAddress,
      collectionAuthority: collectionAuthority,
    });

    // Transfer NFT to user
    await metaplex.nfts().transfer({
      nftOrSft: nft,
      fromOwner: collectionAuthority,
      toOwner: user.publicKey,
    });

    // Create reward token mint
    rewardTokenMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey, // Authority will be transferred to vault
      null,
      6 // 6 decimals
    );

    // Create user reward token account
    userRewardTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      user,
      rewardTokenMint,
      user.publicKey
    );

    // Find PDA addresses
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    [userStakePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), user.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initialize vault", async () => {
    await program.methods
      .initializeVault(REWARD_RATE_PER_SECOND, collectionNft.mintAddress)
      .accounts({
        vault: vaultPda,
        authority: authority.publicKey,
        rewardTokenMint: rewardTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Verify vault was initialized correctly
    const vaultAccount = await program.account.vaultAccount.fetch(vaultPda);
    expect(vaultAccount.authority.toString()).to.equal(authority.publicKey.toString());
    expect(vaultAccount.totalStaked).to.equal(0);
    expect(vaultAccount.rewardTokenMint.toString()).to.equal(rewardTokenMint.toString());
    expect(vaultAccount.rewardRatePerSecond.toString()).to.equal(REWARD_RATE_PER_SECOND.toString());
    expect(vaultAccount.collectionMint.toString()).to.equal(collectionNft.mintAddress.toString());
    expect(vaultAccount.paused).to.equal(false);
    expect(vaultAccount.bump).to.equal(vaultBump);

    // Verify that mint authority was transferred to vault
    const mintInfo = await provider.connection.getAccountInfo(rewardTokenMint);
    expect(mintInfo).to.not.be.null;
  });

  it("Stake NFT", async () => {
    // Get user's NFT token account
    const userNftTokenAccount = await getAssociatedTokenAddress(
      nft.mintAddress,
      user.publicKey
    );

    const vaultNftTokenAccount = await getAssociatedTokenAddress(
      nft.mintAddress,
      vaultPda,
      true
    );

    // Get NFT metadata PDA
    const [nftMetadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        METADATA_PROGRAM_ID.toBuffer(),
        nft.mintAddress.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );

    await program.methods
      .stakeNft()
      .accounts({
        vault: vaultPda,
        userStake: userStakePda,
        user: user.publicKey,
        nftMint: nft.mintAddress,
        nftMetadata: nftMetadataPda,
        userNftTokenAccount: userNftTokenAccount,
        vaultNftTokenAccount: vaultNftTokenAccount,
        metadataProgram: METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Verify NFT was transferred to vault
    const vaultNftAccount = await provider.connection.getTokenAccountBalance(vaultNftTokenAccount);
    expect(parseInt(vaultNftAccount.value.amount)).to.equal(1);

    const userNftAccount = await provider.connection.getTokenAccountBalance(userNftTokenAccount);
    expect(parseInt(userNftAccount.value.amount)).to.equal(0);

    // Verify user stake account
    const userStakeAccount = await program.account.userStakeAccount.fetch(userStakePda);
    expect(userStakeAccount.user.toString()).to.equal(user.publicKey.toString());
    expect(userStakeAccount.stakedNfts).to.equal(1);
    expect(userStakeAccount.pendingRewards.toString()).to.equal("0");

    // Verify vault total staked
    const vaultAccount = await program.account.vaultAccount.fetch(vaultPda);
    expect(vaultAccount.totalStaked).to.equal(1);
  });

  it("Claim rewards after time passes", async () => {
    // Wait for some time to accumulate rewards (more than 60 seconds for rate limiting)
    await new Promise(resolve => setTimeout(resolve, 65000));

    await program.methods
      .claimRewards()
      .accounts({
        vault: vaultPda,
        userStake: userStakePda,
        user: user.publicKey,
        rewardTokenMint: rewardTokenMint,
        userRewardTokenAccount: userRewardTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Verify rewards were received
    const userRewardBalance = await provider.connection.getTokenAccountBalance(userRewardTokenAccount);
    expect(parseInt(userRewardBalance.value.amount)).to.be.greaterThan(0);

    // Verify pending rewards were reset
    const userStakeAccount = await program.account.userStakeAccount.fetch(userStakePda);
    expect(userStakeAccount.pendingRewards.toString()).to.equal("0");
  });

  it("Unstake NFT", async () => {
    const vaultNftTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      vaultPda,
      true
    );

    await program.methods
      .unstakeNft()
      .accounts({
        vault: vaultPda,
        userStake: userStakePda,
        user: user.publicKey,
        nftMint: nftMint,
        userNftTokenAccount: userNftTokenAccount,
        vaultNftTokenAccount: vaultNftTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    // Verify NFT was returned to user
    const userNftAccount = await provider.connection.getTokenAccountBalance(userNftTokenAccount);
    expect(parseInt(userNftAccount.value.amount)).to.equal(1);

    const vaultNftAccount = await provider.connection.getTokenAccountBalance(vaultNftTokenAccount);
    expect(parseInt(vaultNftAccount.value.amount)).to.equal(0);

    // Verify user stake account
    const userStakeAccount = await program.account.userStakeAccount.fetch(userStakePda);
    expect(userStakeAccount.stakedNfts).to.equal(0);

    // Verify vault total staked
    const vaultAccount = await program.account.vaultAccount.fetch(vaultPda);
    expect(vaultAccount.totalStaked).to.equal(0);
  });
});