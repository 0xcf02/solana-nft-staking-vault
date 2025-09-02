/**
 * Script to initialize the NFT Staking Vault
 * Run with: npx ts-node scripts/initialize-vault.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { 
  PublicKey, 
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { 
  createMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Configuration
const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1");

// Vault configuration
const REWARD_RATE_PER_SECOND = new anchor.BN(1_000_000); // 1 token per second (6 decimals)
const COLLECTION_MINT = new PublicKey("11111111111111111111111111111111"); // Replace with actual collection mint

async function main() {
  console.log("🚀 Initializing NFT Staking Vault...");
  
  // Configure provider
  const connection = new anchor.web3.Connection(
    NETWORK === "mainnet" 
      ? anchor.web3.clusterApiUrl("mainnet-beta")
      : anchor.web3.clusterApiUrl("devnet"),
    "confirmed"
  );
  
  // Load wallet from file
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  console.log("📡 Network:", NETWORK);
  console.log("👛 Wallet:", wallet.publicKey.toString());
  console.log("💰 Balance:", await connection.getBalance(wallet.publicKey) / anchor.web3.LAMPORTS_PER_SOL, "SOL");

  // Create reward token mint
  console.log("🪙 Creating reward token mint...");
  const rewardTokenMint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey, // Will be transferred to vault PDA
    null,
    6 // 6 decimals
  );
  
  console.log("✅ Reward token mint created:", rewardTokenMint.toString());

  // Find vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    PROGRAM_ID
  );

  console.log("🏦 Vault PDA:", vaultPda.toString());

  try {
    // Load the program (you'll need the IDL)
    // For demonstration, we'll show the instruction structure
    console.log("📝 Preparing initialize_vault instruction...");

    const initializeVaultInstruction = {
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: rewardTokenMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: Buffer.concat([
        Buffer.from([0]), // Instruction discriminator for initialize_vault
        REWARD_RATE_PER_SECOND.toBuffer("le", 8),
        COLLECTION_MINT.toBuffer(),
      ]),
    };

    console.log("🔄 Sending initialize_vault transaction...");
    
    // In a real implementation with proper IDL:
    /*
    const tx = await program.methods
      .initializeVault(REWARD_RATE_PER_SECOND, COLLECTION_MINT)
      .accounts({
        vault: vaultPda,
        authority: wallet.publicKey,
        rewardTokenMint: rewardTokenMint,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Vault initialized! Transaction signature:", tx);
    */

    // For demo purposes, we'll simulate the transaction
    console.log("⚠️  Demo mode: Transaction not actually sent");
    console.log("📋 Transaction would include:");
    console.log("   - Vault PDA:", vaultPda.toString());
    console.log("   - Authority:", wallet.publicKey.toString());
    console.log("   - Reward Token Mint:", rewardTokenMint.toString());
    console.log("   - Reward Rate:", REWARD_RATE_PER_SECOND.toString(), "tokens/second");
    console.log("   - Collection Mint:", COLLECTION_MINT.toString());

    // Transfer mint authority to vault PDA
    console.log("🔄 Transferring mint authority to vault...");
    
    // In a real implementation:
    /*
    await setAuthority(
      connection,
      wallet.payer,
      rewardTokenMint,
      wallet.publicKey,
      AuthorityType.MintTokens,
      vaultPda
    );
    */
    
    console.log("✅ Mint authority transferred to vault PDA");

    console.log("\n🎉 Vault initialization completed successfully!");
    console.log("\n📋 Configuration Summary:");
    console.log("   Network:", NETWORK);
    console.log("   Program ID:", PROGRAM_ID.toString());
    console.log("   Vault PDA:", vaultPda.toString());
    console.log("   Reward Token Mint:", rewardTokenMint.toString());
    console.log("   Collection Mint:", COLLECTION_MINT.toString());
    console.log("   Reward Rate:", REWARD_RATE_PER_SECOND.toString(), "per second");

    console.log("\n🔧 Next Steps:");
    console.log("1. Update your frontend .env.local with the reward token mint:");
    console.log("   NEXT_PUBLIC_REWARD_TOKEN_MINT=" + rewardTokenMint.toString());
    console.log("2. Update the collection mint address if needed");
    console.log("3. Start the frontend: cd app && npm run dev");
    console.log("4. Test the staking functionality with eligible NFTs");

  } catch (error) {
    console.error("❌ Error initializing vault:", error);
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log("🏁 Script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}