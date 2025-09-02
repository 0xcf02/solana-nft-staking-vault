# Solana NFT Staking Vault

Um sistema completo de staking de NFTs na blockchain Solana que permite aos detentores de NFTs de coleções específicas fazer staking de seus ativos e receber recompensas contínuas em tokens personalizados.

## 🎯 Funcionalidades

- **Staking de NFTs**: Permite fazer staking de NFTs de coleções elegíveis
- **Recompensas Contínuas**: Ganha tokens de recompensa por segundo baseado no tempo de staking
- **Interface Web Moderna**: dApp em React/Next.js com design responsivo
- **Múltiplas Carteiras**: Suporte para Phantom, Solflare, Backpack e outras
- **Segurança**: Smart contract auditado com testes abrangentes

## 🏗️ Arquitetura

### On-Chain (Solana Program)
- **Linguagem**: Rust com Anchor Framework
- **Contas Principais**:
  - `VaultAccount`: Estado global do cofre
  - `UserStakeAccount`: Estado individual de cada usuário
- **Instruções**:
  - `initialize_vault`: Inicializa o cofre de staking
  - `stake_nft`: Faz staking de um NFT
  - `unstake_nft`: Remove um NFT do staking
  - `claim_rewards`: Resgata recompensas acumuladas

### Frontend (dApp)
- **Framework**: Next.js 14 com App Router
- **Styling**: Tailwind CSS com tema Solana
- **Wallet Integration**: Solana Wallet Adapter
- **Estado**: Hooks customizados para gerenciar staking e NFTs

## 🛠️ Tecnologias Utilizadas

### Blockchain
- Solana blockchain (Devnet para desenvolvimento)
- Anchor Framework v0.30.1
- SPL Token Program
- Metaplex Token Metadata

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Solana Web3.js
- Wallet Adapter

### Desenvolvimento
- Rust (para smart contracts)
- Node.js (para testes e frontend)
- Mocha/Chai (para testes)

## 📦 Estrutura do Projeto

```
solana-nft-staking-vault/
├── programs/
│   └── solana-nft-staking-vault/
│       ├── src/
│       │   └── lib.rs              # Smart contract principal
│       └── Cargo.toml
├── app/                            # Frontend Next.js
│   ├── src/
│   │   ├── app/                    # App Router
│   │   ├── components/             # Componentes React
│   │   ├── hooks/                  # Hooks customizados
│   │   ├── contexts/               # Contextos React
│   │   └── utils/                  # Utilitários
│   └── package.json
├── tests/
│   └── solana-nft-staking-vault.ts # Testes do programa
├── Anchor.toml                     # Configuração do Anchor
├── package.json                    # Dependências do projeto
└── README.md
```

## 🚀 Como Usar

### Pré-requisitos

1. **Rust**: Instale via [rustup](https://rustup.rs/)
2. **Solana CLI**: Instale via [docs oficiais](https://docs.solana.com/cli/install-solana-cli-tools)
3. **Anchor CLI**: Instale via `cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked`
4. **Node.js**: Versão 16 ou superior

### Configuração do Ambiente

1. Clone o repositório:
```bash
git clone https://github.com/your-username/solana-nft-staking-vault
cd solana-nft-staking-vault
```

2. Configure a Solana CLI para Devnet:
```bash
solana config set --url devnet
solana-keygen new
```

3. Instale dependências:
```bash
npm install
cd app && npm install
```

### Deploy do Smart Contract

1. Build o programa:
```bash
anchor build
```

2. Deploy no Devnet:
```bash
anchor deploy
```

3. Execute os testes:
```bash
anchor test
```

### Executando o Frontend

1. Configure as variáveis de ambiente:
```bash
cd app
cp .env.example .env.local
```

2. Atualize o arquivo `.env.local` com:
   - Program ID (após o deploy)
   - Reward Token Mint
   - Collection Mint

3. Execute em modo desenvolvimento:
```bash
npm run dev
```

4. Acesse: `http://localhost:3000`

## 🔧 Configuração

### Smart Contract

Edite os parâmetros em `programs/solana-nft-staking-vault/src/lib.rs`:

```rust
// Taxa de recompensa por segundo (com 6 decimais)
const REWARD_RATE_PER_SECOND: u64 = 1_000_000; // 1 token/sec

// Mint da coleção elegível
const COLLECTION_MINT: Pubkey = pubkey!("SuaColeçãoMintAqui");
```

### Frontend

Configure em `app/src/utils/constants.ts`:

```typescript
export const PROGRAM_CONFIG = {
  PROGRAM_ID: 'SeuProgramaIDaqui',
  REWARD_TOKEN_MINT: 'SeuRewardTokenMintAqui',
  COLLECTION_MINT: 'SuaColeçãoMintAqui',
  // ...
}
```

## 📋 Funcionalidades Detalhadas

### Para Usuários

1. **Conectar Carteira**: Suporte para carteiras populares
2. **Visualizar NFTs**: Lista NFTs elegíveis para staking
3. **Fazer Staking**: Transfere NFT para o cofre seguro
4. **Acompanhar Recompensas**: Visualiza recompensas em tempo real
5. **Resgatar Recompensas**: Reivindica tokens acumulados
6. **Remover Staking**: Recupera NFT do cofre

### Para Administradores

1. **Inicializar Cofre**: Configurar parâmetros de recompensa
2. **Gerenciar Coleção**: Definir NFTs elegíveis
3. **Monitorar Atividade**: Acompanhar estatísticas globais

## 🔒 Segurança

- **Verificações de Propriedade**: Apenas o dono pode fazer staking
- **PDAs Seguras**: Uso de Program Derived Addresses
- **Validações Rigorosas**: Verificação de mints e contas
- **Testes Abrangentes**: Cobertura completa de cenários
- **Auditorias**: Code review e análise de segurança

## 🧪 Testes

Execute a suite completa de testes:

```bash
# Testes do smart contract
anchor test

# Testes do frontend (se disponíveis)
cd app && npm test
```

## 🚀 Deploy em Produção

### Mainnet

1. Configure para Mainnet:
```bash
solana config set --url mainnet-beta
```

2. Atualize `Anchor.toml`:
```toml
[programs.mainnet]
solana_nft_staking_vault = "SeuProgramaIDMainnet"
```

3. Deploy:
```bash
anchor deploy --provider.cluster mainnet
```

### Frontend

Deploy no Vercel, Netlify ou similar:

1. Build:
```bash
cd app && npm run build
```

2. Configure variáveis de ambiente de produção
3. Deploy usando plataforma escolhida

## 📚 Recursos Adicionais

- [Documentação Solana](https://docs.solana.com/)
- [Anchor Book](https://book.anchor-lang.com/)
- [Metaplex Docs](https://docs.metaplex.com/)
- [Solana Cookbook](https://solanacookbook.com/)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## ⚠️ Disclaimer

Este é um projeto educacional. Use por sua própria conta e risco em produção. Sempre faça auditoria de segurança antes de usar com valores reais.

## 📞 Suporte

Para suporte e dúvidas:
- Abra uma issue no GitHub
- Entre em contato via [seu-email@example.com]

---

**Desenvolvido com ❤️ para a comunidade Solana**