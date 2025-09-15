import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock Solana wallet adapter
jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: jest.fn(() => ({
    wallet: null,
    publicKey: null,
    connected: false,
    connecting: false,
    disconnect: jest.fn(),
    connect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn(),
    signMessage: jest.fn(),
  })),
  useConnection: jest.fn(() => ({
    connection: {
      rpcEndpoint: 'https://api.devnet.solana.com',
      commitment: 'confirmed',
      getLatestBlockhash: jest.fn(),
      getAccountInfo: jest.fn(),
      getTokenAccountBalance: jest.fn(),
      requestAirdrop: jest.fn(),
    },
  })),
}))

// Mock Solana web3.js
jest.mock('@solana/web3.js', () => ({
  PublicKey: jest.fn().mockImplementation((key) => ({
    toString: () => key,
    toBuffer: () => Buffer.from(key),
  })),
  Connection: jest.fn(),
  Transaction: jest.fn(),
  SystemProgram: {
    programId: 'SystemProgram',
  },
  LAMPORTS_PER_SOL: 1000000000,
}))

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}))

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock performance.mark and performance.measure
global.performance.mark = jest.fn()
global.performance.measure = jest.fn()
global.performance.getEntriesByName = jest.fn().mockReturnValue([{ duration: 100 }])
global.performance.clearMarks = jest.fn()
global.performance.clearMeasures = jest.fn()

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn()
global.URL.revokeObjectURL = jest.fn()