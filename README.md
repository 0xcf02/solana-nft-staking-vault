Solana NFT Staking Vault
A decentralized NFT staking platform built on Solana that allows holders of specific NFT collections to stake their assets and earn continuous rewards in custom tokens.

🚀 Features
NFT Staking: Stake NFTs from eligible collections for rewards
Continuous Rewards: Earn reward tokens per second based on staking duration
Modern Web Interface: React/Next.js dApp with responsive design
Multi-Wallet Support: Compatible with Phantom, Solflare, Backpack and more
Security Focused: Audited smart contracts with comprehensive testing

📋 Smart Contracts
solana-nft-staking-vault: Main staking contract handling NFT deposits and rewards
VaultAccount: Global vault state management
UserStakeAccount: Individual user staking state tracking

🛠 Technology Stack
Anchor Framework 0.30.1: Solana program development
Solana Blockchain: High-performance blockchain platform
Next.js 14: React framework with App Router
TypeScript: Type-safe development
Tailwind CSS: Utility-first CSS framework
SPL Token Program: Token operations on Solana
Metaplex: NFT metadata standard

⚙️ Setup & Installation
# Clone the repository
git clone https://github.com/0xcf02/solana-nft-staking-vault
cd solana-nft-staking-vault

# Install dependencies
npm install
cd app && npm install

# Configure Solana CLI for Devnet
solana config set --url devnet
solana-keygen new

# Build the program
anchor build

🧪 Testing
# Run all tests
anchor test

# Run with detailed output
anchor test --skip-deploy

# Lint code
npm run lint

🚀 Deployment
Devnet Deployment
anchor deploy

Mainnet Deployment
# Configure for mainnet
solana config set --url mainnet-beta

# Update Anchor.toml for mainnet
# [programs.mainnet]
# solana_nft_staking_vault = "YOUR_PROGRAM_ID"

# Deploy to mainnet
anchor deploy --provider.cluster mainnet

🏗 Project Structure
├── programs/
│   └── solana-nft-staking-vault/
│       ├── src/lib.rs              # Main smart contract
│       └── Cargo.toml              # Rust dependencies
├── app/                            # Next.js frontend
│   ├── src/
│   │   ├── app/                    # App Router pages
│   │   ├── components/             # React components
│   │   ├── hooks/                  # Custom hooks
│   │   ├── contexts/               # React contexts
│   │   └── utils/                  # Utility functions
│   └── package.json
├── tests/
│   └── solana-nft-staking-vault.ts # Program tests
├── scripts/
│   ├── deploy.sh                   # Deployment script
│   └── initialize-vault.ts         # Vault initialization
├── Anchor.toml                     # Anchor configuration
└── package.json                    # Project dependencies

📖 How It Works
1. **Connect Wallet**: Support for popular Solana wallets
2. **View NFTs**: Browse eligible NFTs for staking
3. **Stake NFTs**: Transfer NFTs to secure vault contract
4. **Earn Rewards**: Accumulate reward tokens over time
5. **Claim Rewards**: Withdraw accumulated reward tokens
6. **Unstake NFTs**: Retrieve NFTs from the vault

🔧 Configuration
Key parameters in the staking contract:

**Smart Contract Configuration**
```rust
// Reward rate per second (6 decimals)
const REWARD_RATE_PER_SECOND: u64 = 1_000_000; // 1 token/sec

// Eligible collection mint
const COLLECTION_MINT: Pubkey = pubkey!("YourCollectionMintHere");
```

**Frontend Configuration**
```typescript
export const PROGRAM_CONFIG = {
  PROGRAM_ID: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
  REWARD_TOKEN_MINT: 'YourRewardTokenMintHere',
  COLLECTION_MINT: 'YourCollectionMintHere',
}
```

**Frontend Development**
```bash
# Navigate to frontend directory
cd app

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev

# Access at http://localhost:3000
```

🌐 Network Support
Devnet: For development and testing
Mainnet: For production deployment
Local Network: For local development with test validator

🔒 Security Features
Ownership Verification: Only NFT owners can stake their assets
Program Derived Addresses: Secure account derivation
Rigorous Validations: Comprehensive mint and account verification
Extensive Testing: Complete test coverage for all scenarios
Security Audited: Code reviewed for vulnerabilities

📚 Additional Resources
- [Solana Documentation](https://docs.solana.com/)
- [Anchor Book](https://book.anchor-lang.com/)
- [Metaplex Documentation](https://docs.metaplex.com/)
- [Solana Cookbook](https://solanacookbook.com/)

📄 License
MIT License - see LICENSE file for details

🤝 Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

Built with ❤️ using Anchor Framework and modern Solana development tools.

👨‍💻 Author
**Jose Ronaldo Pereira (0xcf02)**

LinkedIn: (https://www.linkedin.com/in/ronaldo-pereira-b1b700175)

GitHub: (https://www.github.com/0xcf02)
