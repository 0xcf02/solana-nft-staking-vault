#!/bin/bash

# Deploy script for Solana NFT Staking Vault
# Make sure you have Solana CLI, Anchor, and Node.js installed

set -e

echo "🚀 Starting deployment process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

# Check if required tools are installed
check_prerequisites() {
    print_color $BLUE "🔍 Checking prerequisites..."
    
    if ! command -v solana &> /dev/null; then
        print_color $RED "❌ Solana CLI not found. Please install it first."
        exit 1
    fi
    
    if ! command -v anchor &> /dev/null; then
        print_color $RED "❌ Anchor CLI not found. Please install it first."
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_color $RED "❌ Node.js not found. Please install it first."
        exit 1
    fi
    
    print_color $GREEN "✅ All prerequisites found!"
}

# Set network (devnet by default)
NETWORK=${1:-devnet}

print_color $YELLOW "📡 Using network: $NETWORK"

# Configure Solana CLI
configure_solana() {
    print_color $BLUE "⚙️ Configuring Solana CLI..."
    solana config set --url $NETWORK
    
    # Show current configuration
    print_color $YELLOW "Current Solana configuration:"
    solana config get
    
    # Check balance
    BALANCE=$(solana balance)
    print_color $YELLOW "Wallet balance: $BALANCE"
    
    if [[ "$BALANCE" == "0 SOL" ]]; then
        print_color $RED "❌ Insufficient balance. Please fund your wallet."
        if [[ "$NETWORK" == "devnet" ]]; then
            print_color $YELLOW "💡 You can get devnet SOL with: solana airdrop 2"
            read -p "Do you want to request an airdrop now? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                solana airdrop 2
                print_color $GREEN "✅ Airdrop requested!"
            fi
        fi
    fi
}

# Build the program
build_program() {
    print_color $BLUE "🔨 Building Anchor program..."
    anchor build
    
    if [ $? -eq 0 ]; then
        print_color $GREEN "✅ Program built successfully!"
    else
        print_color $RED "❌ Program build failed!"
        exit 1
    fi
}

# Deploy the program
deploy_program() {
    print_color $BLUE "🚀 Deploying program to $NETWORK..."
    anchor deploy
    
    if [ $? -eq 0 ]; then
        print_color $GREEN "✅ Program deployed successfully!"
        
        # Get the program ID
        PROGRAM_ID=$(solana address -k target/deploy/solana_nft_staking_vault-keypair.json)
        print_color $YELLOW "📝 Program ID: $PROGRAM_ID"
        
        # Update Anchor.toml with the new program ID if needed
        print_color $BLUE "📝 Updating Anchor.toml..."
        
    else
        print_color $RED "❌ Program deployment failed!"
        exit 1
    fi
}

# Run tests
run_tests() {
    print_color $BLUE "🧪 Running tests..."
    anchor test --skip-local-validator
    
    if [ $? -eq 0 ]; then
        print_color $GREEN "✅ All tests passed!"
    else
        print_color $RED "❌ Some tests failed!"
        read -p "Do you want to continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Initialize the vault (optional)
initialize_vault() {
    print_color $BLUE "🏦 Do you want to initialize the vault?"
    read -p "Initialize vault now? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_color $YELLOW "📝 You'll need to run the initialization separately with your specific parameters."
        print_color $YELLOW "Use: anchor run initialize-vault"
    fi
}

# Setup frontend
setup_frontend() {
    print_color $BLUE "🌐 Setting up frontend..."
    
    if [ -d "app" ]; then
        cd app
        
        print_color $BLUE "📦 Installing frontend dependencies..."
        npm install
        
        if [ $? -eq 0 ]; then
            print_color $GREEN "✅ Frontend dependencies installed!"
        else
            print_color $RED "❌ Failed to install frontend dependencies!"
            cd ..
            return 1
        fi
        
        # Create .env.local if it doesn't exist
        if [ ! -f ".env.local" ]; then
            print_color $BLUE "📝 Creating environment configuration..."
            cat > .env.local << EOL
NEXT_PUBLIC_SOLANA_NETWORK=$NETWORK
NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_REWARD_TOKEN_MINT=11111111111111111111111111111111
NEXT_PUBLIC_COLLECTION_MINT=11111111111111111111111111111111
EOL
            print_color $YELLOW "📝 Created .env.local - please update with your actual token mints!"
        fi
        
        print_color $BLUE "🔨 Building frontend..."
        npm run build
        
        if [ $? -eq 0 ]; then
            print_color $GREEN "✅ Frontend built successfully!"
        else
            print_color $RED "❌ Frontend build failed!"
        fi
        
        cd ..
    else
        print_color $YELLOW "⚠️ Frontend directory not found, skipping frontend setup."
    fi
}

# Main deployment process
main() {
    print_color $GREEN "🎯 Solana NFT Staking Vault Deployment Script"
    print_color $GREEN "=============================================="
    
    check_prerequisites
    configure_solana
    build_program
    deploy_program
    run_tests
    initialize_vault
    setup_frontend
    
    print_color $GREEN "🎉 Deployment completed successfully!"
    print_color $YELLOW "📋 Next steps:"
    print_color $YELLOW "   1. Update your reward token mint in the configuration"
    print_color $YELLOW "   2. Update your collection mint address"
    print_color $YELLOW "   3. Initialize the vault with: anchor run initialize-vault"
    print_color $YELLOW "   4. Start the frontend with: cd app && npm run dev"
    
    if [[ "$NETWORK" == "devnet" ]]; then
        print_color $BLUE "🌐 Frontend will be available at: http://localhost:3000"
    fi
}

# Run main function
main