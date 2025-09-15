# 🏛️ Solana NFT Staking Vault

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Anchor](https://img.shields.io/badge/Anchor-0.30.1-blueviolet)](https://github.com/coral-xyz/anchor)
[![Solana](https://img.shields.io/badge/Solana-1.18-green)](https://solana.com/)
[![Security](https://img.shields.io/badge/Security-Audited-success)](./SECURITY_AUDIT_FIXES.md)

An enterprise-grade decentralized NFT staking platform built on Solana that allows holders of specific NFT collections to stake their assets and earn continuous rewards in custom tokens. Features complete RBAC system, upgradability, and advanced security mechanisms.

## 🚀 Features

### Core Functionality
- **NFT Staking**: Stake NFTs from eligible collections for rewards
- **Continuous Rewards**: Earn reward tokens per second based on staking duration
- **Collection Verification**: Strict Metaplex metadata validation
- **Real-time Tracking**: Live reward calculation and staking statistics

### Enterprise Features
- **🔐 RBAC System**: Complete role-based access control with 4 hierarchical levels
- **🔄 Upgradability**: Smart contract upgrades with timelock and governance
- **⏸️ Emergency Controls**: Pause/unpause functionality for critical situations
- **📊 Rate Limiting**: Intelligent spam prevention and DoS protection
- **🛡️ Security Audit**: Complete security fixes and vulnerability patches
- **📈 Admin Dashboard**: Full administrative interface with role management

### Technical Excellence
- **Modern Web Interface**: React/Next.js dApp with responsive design
- **Multi-Wallet Support**: Compatible with Phantom, Solflare, Backpack and more
- **Type Safety**: Complete TypeScript implementation with generated types
- **Comprehensive Testing**: 100% test coverage for all scenarios

### Performance & UX Enhancements
- **🚀 Virtual Scrolling**: Handle thousands of NFTs without performance degradation
- **⚡ Smart Caching**: Intelligent multi-layer caching system with TTL
- **🔄 Lazy Loading**: Progressive image loading for optimal bandwidth usage
- **📊 Performance Monitoring**: Real-time performance metrics and profiling
- **🎯 Bundle Optimization**: Advanced code splitting and tree shaking
- **♿ Accessibility**: Full WCAG 2.1 AA compliance with screen reader support
- **🧪 E2E Testing**: Comprehensive Playwright test suite for all user flows

## 🏗️ Architecture

### Smart Contracts
- **`solana-nft-staking-vault`**: Main staking contract with RBAC and upgradability
- **`VaultAccount`**: Global vault state with version management and governance
- **`UserStakeAccount`**: Individual user staking state tracking
- **`AccountRole`**: User role assignments with permissions

### Role-Based Access Control (RBAC)
| Role | Permissions | Description |
|------|-------------|-------------|
| **SuperAdmin** | Full access | Can manage all aspects including roles |
| **Admin** | High-level operations | Can pause, configure, and manage treasury |
| **Moderator** | User management | Can pause vault and moderate users |
| **Operator** | Basic access | Read-only operations |

### Upgradability System
- **Timelock Protection**: Minimum 1-hour delay for upgrades
- **Governance Integration**: Role-based upgrade proposals
- **Version Management**: Automatic migration and compatibility checks
- **Permanent Lock**: Irreversible upgrade prevention for decentralization

## 🛠️ Technology Stack

**Backend:**
- Anchor Framework 0.30.1 - Solana program development
- Rust - High-performance smart contract language
- SPL Token Program - Token operations on Solana
- Metaplex - NFT metadata standard and verification

**Frontend:**
- Next.js 14 - React framework with App Router
- TypeScript - Type-safe development
- Tailwind CSS - Utility-first CSS framework
- Solana Wallet Adapter - Multi-wallet integration

**Performance & Optimization:**
- React Virtual Scrolling - Efficient rendering for large lists
- Smart Caching Layer - Multi-tier caching with intelligent TTL
- Bundle Splitting - Optimized code splitting and lazy loading
- Performance Profiling - Real-time metrics and monitoring
- Progressive Enhancement - Graceful degradation and error recovery

**Security & Testing:**
- Anchor Testing Framework - Comprehensive smart contract testing
- Jest Unit Testing - Complete frontend component and hook testing  
- Playwright E2E Testing - Full user flow automation and validation
- Accessibility Testing - WCAG 2.1 compliance with axe-core integration
- Performance Testing - Load testing and bundle size monitoring
- Custom Security Audits - Vulnerability assessment and fixes
- Rate Limiting - DoS protection mechanisms
- Event Logging - Complete audit trail

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+ and npm
- Rust and Cargo
- Solana CLI tools
- Anchor CLI

### Installation Steps
```bash
# Clone the repository
git clone https://github.com/0xcf02/solana-nft-staking-vault
cd solana-nft-staking-vault

# Install dependencies
npm install
cd app && npm install && cd ..

# Configure Solana CLI for Devnet
solana config set --url devnet
solana-keygen new

# Build the program
anchor build

# Deploy to devnet
anchor deploy
```

### Frontend Setup
```bash
# Navigate to frontend
cd app

# Copy environment template
cp .env.example .env.local

# Configure your environment variables
# NEXT_PUBLIC_PROGRAM_ID=your_program_id
# NEXT_PUBLIC_REWARD_TOKEN_MINT=your_reward_token
# NEXT_PUBLIC_COLLECTION_MINT=your_collection

# Start development server
npm run dev
```

## 🧪 Testing

### Smart Contract Tests
```bash
# Run all tests
anchor test

# Run specific test suites
anchor test --grep "Staking"
anchor test --grep "RBAC"
anchor test --grep "Upgrade"

# Run with detailed output
anchor test --skip-deploy -- --nocapture
```

### Frontend Testing
```bash
cd app

# Run all tests with coverage
npm run test:coverage

# Run unit tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run accessibility tests
npm run test:e2e -- --grep "Accessibility"

# Run performance tests
npm run test:e2e -- --grep "Performance"

# Lint and type checking
npm run lint
npm run lint:fix  
npm run type-check

# Bundle size analysis
npm run build:analyze

# Performance audit with Lighthouse
npm run perf
```

## 🚀 Deployment

### Devnet Deployment
```bash
# Deploy program
anchor deploy

# Initialize vault
npm run init:vault

# Verify deployment
anchor test --skip-build
```

### Mainnet Deployment
```bash
# Configure for mainnet
solana config set --url mainnet-beta

# Update Anchor.toml
# [programs.mainnet]
# solana_nft_staking_vault = "YOUR_PROGRAM_ID"

# Deploy with upgradability
anchor deploy --provider.cluster mainnet

# Initialize with production settings
npm run init:vault -- --cluster mainnet
```

## 🏗️ Project Structure

```
├── programs/
│   └── solana-nft-staking-vault/
│       ├── src/lib.rs              # Main smart contract with RBAC & upgrades
│       └── Cargo.toml              # Rust dependencies with security features
├── app/                            # Next.js frontend application
│   ├── src/
│   │   ├── app/                    # App Router pages and layouts
│   │   ├── components/             # React components
│   │   │   ├── NFTGrid.tsx         # Enhanced NFT grid with virtualization
│   │   │   ├── VirtualizedList.tsx # Virtual scrolling component
│   │   │   ├── LazyWrapper.tsx     # Lazy loading wrapper
│   │   │   ├── MonitoringDashboard.tsx # Performance monitoring
│   │   │   ├── RBACAdmin.tsx       # Role management interface
│   │   │   ├── UpgradeManager.tsx  # Upgrade management dashboard
│   │   │   └── StakingDashboard.tsx # Main staking interface
│   │   ├── hooks/                  # Custom React hooks
│   │   │   ├── useStaking.ts       # Enhanced staking with performance monitoring
│   │   │   ├── useNFTs.ts          # Smart NFT fetching with caching
│   │   │   └── __tests__/          # Unit tests for hooks
│   │   ├── utils/                  # Utility functions and configs
│   │   │   ├── performance.ts      # Performance utilities and profiling
│   │   │   ├── monitoring.ts       # User action tracking and analytics
│   │   │   ├── cache.ts           # Intelligent caching system
│   │   │   ├── retry.ts           # Retry logic for resilience
│   │   │   ├── errorHandling.ts   # Circuit breaker and error handling
│   │   │   └── __tests__/         # Unit tests for utilities
│   │   └── __tests__/
│   │       └── e2e/               # End-to-end tests
│   │           ├── wallet-connection.spec.ts
│   │           ├── nft-grid.spec.ts
│   │           ├── staking-operations.spec.ts
│   │           ├── performance.spec.ts
│   │           └── accessibility.spec.ts
│   ├── next.config.js             # Optimized Next.js configuration
│   ├── playwright.config.ts       # E2E testing configuration
│   ├── jest.config.js            # Unit testing configuration
│   └── package.json              # Frontend dependencies
├── tests/
│   └── solana-nft-staking-vault.ts # Comprehensive smart contract test suite
├── docs/                           # Documentation
│   ├── RBAC_IMPLEMENTATION.md      # RBAC system documentation
│   ├── UPGRADABILITY_GUIDE.md      # Upgrade system guide
│   └── SECURITY_AUDIT_FIXES.md     # Security audit report
├── scripts/
│   ├── initialize-vault.ts         # Vault initialization
│   └── admin-commands.ts          # Administrative utilities
├── Anchor.toml                     # Anchor configuration (upgradeable: true)
└── package.json                   # Project dependencies
```

## 📖 How It Works

### For Users
1. **Connect Wallet** - Support for popular Solana wallets with auto-reconnection
2. **View Eligible NFTs** - Browse NFTs with virtual scrolling and advanced filtering
3. **Search & Filter** - Find NFTs by name, attributes, or staking status
4. **Stake NFTs** - Transfer NFTs with transaction retry and circuit breaker protection
5. **Batch Operations** - Stake multiple NFTs simultaneously for efficiency
6. **Earn Rewards** - Accumulate reward tokens automatically per second
7. **Monitor Progress** - Real-time dashboard with performance metrics
8. **Claim Rewards** - Withdraw accumulated reward tokens anytime
9. **Unstake NFTs** - Retrieve NFTs from vault when desired
10. **Performance Stats** - View caching statistics and system performance

### For Administrators
1. **Role Management** - Assign and manage user roles via RBAC system
2. **Vault Control** - Pause/unpause operations during emergencies
3. **Upgrade Management** - Propose and execute smart contract upgrades
4. **Security Monitoring** - Track all operations via comprehensive event logs
5. **Configuration Updates** - Modify reward rates and system parameters

## 🔧 Configuration

### Smart Contract Configuration
```rust
// Core vault parameters
pub struct VaultAccount {
    pub authority: Pubkey,              // Main vault authority
    pub reward_rate_per_second: u64,    // Tokens earned per second per NFT
    pub collection_mint: Pubkey,        // Eligible NFT collection
    pub paused: bool,                   // Emergency pause state
    
    // RBAC & Governance
    pub upgrade_authority: Pubkey,      // Who can propose upgrades
    pub version: u32,                   // Current contract version
    pub upgrade_locked: bool,           // Permanent upgrade prevention
    pub pending_upgrade: Option<PendingUpgrade>, // Scheduled upgrades
}
```

### Frontend Configuration
```typescript
export const PROGRAM_CONFIG = {
  PROGRAM_ID: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
  REWARD_TOKEN_MINT: 'YourRewardTokenMintHere',
  COLLECTION_MINT: 'YourCollectionMintHere',
}
```

### RBAC Configuration
```typescript
// Role-based permissions system
interface Permission {
  can_pause_vault: boolean;      // Emergency pause/unpause
  can_update_config: boolean;    // Modify vault parameters
  can_manage_roles: boolean;     // Assign/revoke user roles
  can_moderate_users: boolean;   // User management actions
  can_manage_treasury: boolean;  // Treasury operations
}
```

## 🌐 Network Support

- **Devnet**: Development and testing environment
- **Mainnet**: Production deployment with full security
- **Localnet**: Local development with test validator
- **Custom RPC**: Support for custom Solana RPC endpoints

## 🔒 Security & Governance Features

### Security Implementations
- **✅ Collection Verification**: Strict Metaplex metadata validation
- **✅ NFT Validation**: Ensures only real NFTs (decimals=0, amount=1)
- **✅ Mint Authority Control**: Proper reward token minting permissions
- **✅ Time Attack Protection**: Prevents timestamp manipulation
- **✅ Math Overflow Prevention**: Safe arithmetic operations
- **✅ Rate Limiting**: Prevents spam and DoS attacks
- **✅ Emergency Pause**: Immediate halt capability for security issues

### Governance Mechanisms
- **Timelock Protection**: Minimum delay for sensitive operations
- **Role-Based Permissions**: Granular access control system
- **Upgrade Proposals**: Democratic upgrade process with review period
- **Event Logging**: Complete audit trail for all operations
- **Version Management**: Automated migration and compatibility

### Audit Results
All critical vulnerabilities have been identified and fixed:
- Collection verification bypass (CRITICAL) ✅ Fixed
- Mint authority issues (CRITICAL) ✅ Fixed  
- Time manipulation attacks (HIGH) ✅ Fixed
- Missing input validation (MEDIUM) ✅ Fixed

## 🎯 Administrative Commands

### Role Management
```bash
# Grant role to user
anchor run grant-role -- --user <PUBKEY> --role Admin

# Revoke role from user  
anchor run revoke-role -- --user <PUBKEY>

# List all roles
anchor run list-roles
```

### Vault Management
```bash
# Pause vault (emergency)
anchor run pause-vault

# Unpause vault
anchor run unpause-vault

# Update reward rate
anchor run update-rewards -- --rate 2000000
```

### Upgrade Management
```bash
# Propose upgrade
anchor run propose-upgrade -- --version 2 --timelock 86400

# Execute approved upgrade
anchor run execute-upgrade

# Lock upgrades permanently
anchor run lock-upgrades
```

## 📚 API Reference

### Core Functions
- `initialize_vault(reward_rate, collection_mint)` - Initialize staking vault
- `stake_nft(nft_mint)` - Stake an eligible NFT
- `unstake_nft(nft_mint)` - Withdraw staked NFT
- `claim_rewards()` - Claim accumulated reward tokens

### Administrative Functions
- `pause_vault()` / `unpause_vault()` - Emergency controls
- `grant_role(user, role)` / `revoke_role(user)` - RBAC management
- `propose_upgrade(version, timelock)` - Governance functions
- `execute_upgrade()` - Apply approved upgrades

### Query Functions
- `get_vault_data()` - Vault state and statistics
- `get_user_stake(user)` - User staking information
- `get_user_role(user)` - User permissions and role

## 🔍 Monitoring & Analytics

### Event Types
- **NftStaked/NftUnstaked** - Staking operations
- **RewardsClaimed** - Token withdrawals
- **VaultPaused/VaultUnpaused** - Emergency actions
- **RoleGranted/RoleRevoked** - Permission changes
- **UpgradeProposed/UpgradeExecuted** - Governance actions

### Metrics Dashboard
- Total Value Locked (TVL) in NFTs
- Active stakers and reward distribution
- Administrative actions and governance activity
- System health and performance metrics

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Implement** your changes with tests
4. **Run** the full test suite (`anchor test`)
5. **Commit** your changes (`git commit -m 'Add amazing feature'`)
6. **Push** to the branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

### Development Guidelines
- Follow Rust and TypeScript best practices
- Maintain 100% test coverage for smart contracts
- Include documentation for new features
- Ensure security considerations are addressed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links & Resources

- **Live Demo**: [https://your-demo-url.com](https://your-demo-url.com)
- **Documentation**: [Complete guides](./docs/)
- **Security Audit**: [Audit report](./SECURITY_AUDIT_FIXES.md)
- **Solana Documentation**: [https://docs.solana.com/](https://docs.solana.com/)
- **Anchor Book**: [https://book.anchor-lang.com/](https://book.anchor-lang.com/)

## 👨‍💻 Author

**Jose Ronaldo Pereira (0xcf02)**
- LinkedIn: [linkedin.com/in/ronaldo-pereira-b1b700175](https://www.linkedin.com/in/ronaldo-pereira-b1b700175)
- GitHub: [github.com/0xcf02](https://www.github.com/0xcf02)
- Portfolio: Enterprise Solana & Web3 Development

---

**Built with ❤️ using Anchor Framework and modern Solana development practices.**

*Ready for production deployment with enterprise-grade security and governance.*