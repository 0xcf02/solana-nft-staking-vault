// Error handling utilities for robust error management
import toast from 'react-hot-toast'

export enum ErrorType {
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  PROGRAM_ERROR = 'PROGRAM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  VAULT_PAUSED = 'VAULT_PAUSED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  NFT_NOT_ELIGIBLE = 'NFT_NOT_ELIGIBLE',
  UPGRADE_LOCKED = 'UPGRADE_LOCKED',
  METADATA_FETCH_FAILED = 'METADATA_FETCH_FAILED',
}

export interface AppError {
  type: ErrorType
  message: string
  code?: string | number
  details?: any
  retryable?: boolean
  timestamp: number
}

export class StakingError extends Error {
  public readonly type: ErrorType
  public readonly code?: string | number
  public readonly details?: any
  public readonly retryable: boolean
  public readonly timestamp: number

  constructor(
    type: ErrorType,
    message: string,
    options: {
      code?: string | number
      details?: any
      retryable?: boolean
    } = {}
  ) {
    super(message)
    this.name = 'StakingError'
    this.type = type
    this.code = options.code
    this.details = options.details
    this.retryable = options.retryable ?? false
    this.timestamp = Date.now()
  }

  toAppError(): AppError {
    return {
      type: this.type,
      message: this.message,
      code: this.code,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp,
    }
  }
}

// Error message mappings for user-friendly display
const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.WALLET_NOT_CONNECTED]: 'Please connect your wallet to continue',
  [ErrorType.TRANSACTION_FAILED]: 'Transaction failed. Please try again',
  [ErrorType.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action',
  [ErrorType.PROGRAM_ERROR]: 'Smart contract error occurred',
  [ErrorType.NETWORK_ERROR]: 'Network connection error. Please check your connection',
  [ErrorType.VALIDATION_ERROR]: 'Invalid input provided',
  [ErrorType.TIMEOUT_ERROR]: 'Operation timed out. Please try again',
  [ErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred',
  [ErrorType.RATE_LIMITED]: 'Too many requests. Please wait before trying again',
  [ErrorType.VAULT_PAUSED]: 'Vault is currently paused for maintenance',
  [ErrorType.INSUFFICIENT_BALANCE]: 'Insufficient balance to complete transaction',
  [ErrorType.NFT_NOT_ELIGIBLE]: 'NFT is not eligible for staking',
  [ErrorType.UPGRADE_LOCKED]: 'Upgrades are permanently locked',
  [ErrorType.METADATA_FETCH_FAILED]: 'Failed to load NFT metadata',
}

// Program error code mappings
const PROGRAM_ERROR_CODES: Record<number, ErrorType> = {
  6000: ErrorType.PROGRAM_ERROR, // Math overflow
  6001: ErrorType.PROGRAM_ERROR, // Math underflow  
  6002: ErrorType.VALIDATION_ERROR, // No NFTs staked
  6003: ErrorType.VALIDATION_ERROR, // No rewards to claim
  6004: ErrorType.NFT_NOT_ELIGIBLE, // Invalid NFT
  6005: ErrorType.NFT_NOT_ELIGIBLE, // No collection found
  6006: ErrorType.NFT_NOT_ELIGIBLE, // Collection not verified
  6007: ErrorType.NFT_NOT_ELIGIBLE, // Wrong collection
  6008: ErrorType.VAULT_PAUSED, // Vault is paused
  6009: ErrorType.RATE_LIMITED, // Operation too frequent
  6010: ErrorType.RATE_LIMITED, // Claim too frequent
  6011: ErrorType.VALIDATION_ERROR, // Invalid time elapsed
  6012: ErrorType.VALIDATION_ERROR, // Excessive reward claim
  6013: ErrorType.VALIDATION_ERROR, // Invalid reward rate
  6014: ErrorType.VAULT_PAUSED, // Already paused
  6015: ErrorType.VAULT_PAUSED, // Not paused
  6016: ErrorType.INSUFFICIENT_PERMISSIONS, // Unauthorized
  6017: ErrorType.INSUFFICIENT_PERMISSIONS, // Insufficient permissions
  6018: ErrorType.UPGRADE_LOCKED, // Upgrades locked
  6019: ErrorType.PROGRAM_ERROR, // Upgrade pending
  6020: ErrorType.PROGRAM_ERROR, // No upgrade pending
  6021: ErrorType.VALIDATION_ERROR, // Invalid version
  6022: ErrorType.VALIDATION_ERROR, // Invalid timelock
  6023: ErrorType.PROGRAM_ERROR, // Timelock not expired
  6024: ErrorType.UPGRADE_LOCKED, // Upgrades already locked
}

export function parseError(error: any): StakingError {
  // Handle wallet errors
  if (error?.message?.includes('Wallet not connected')) {
    return new StakingError(
      ErrorType.WALLET_NOT_CONNECTED,
      ERROR_MESSAGES[ErrorType.WALLET_NOT_CONNECTED],
      { retryable: true }
    )
  }

  // Handle program errors
  if (error?.code && PROGRAM_ERROR_CODES[error.code]) {
    const errorType = PROGRAM_ERROR_CODES[error.code]
    return new StakingError(
      errorType,
      ERROR_MESSAGES[errorType],
      { 
        code: error.code,
        details: error.logs,
        retryable: errorType === ErrorType.RATE_LIMITED || errorType === ErrorType.VAULT_PAUSED
      }
    )
  }

  // Handle network errors
  if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
    return new StakingError(
      ErrorType.NETWORK_ERROR,
      ERROR_MESSAGES[ErrorType.NETWORK_ERROR],
      { retryable: true }
    )
  }

  // Handle timeout errors
  if (error?.message?.includes('timeout') || error?.name === 'TimeoutError') {
    return new StakingError(
      ErrorType.TIMEOUT_ERROR,
      ERROR_MESSAGES[ErrorType.TIMEOUT_ERROR],
      { retryable: true }
    )
  }

  // Handle transaction failures
  if (error?.signature || error?.message?.includes('Transaction')) {
    return new StakingError(
      ErrorType.TRANSACTION_FAILED,
      ERROR_MESSAGES[ErrorType.TRANSACTION_FAILED],
      { 
        code: error.signature,
        details: error.logs,
        retryable: true 
      }
    )
  }

  // Handle Anchor/Solana specific errors
  if (error?.error?.errorCode) {
    const code = error.error.errorCode.number || error.error.errorCode
    const errorType = PROGRAM_ERROR_CODES[code] || ErrorType.PROGRAM_ERROR
    return new StakingError(
      errorType,
      error.error.errorMessage || ERROR_MESSAGES[errorType],
      { 
        code,
        details: error.logs,
        retryable: errorType === ErrorType.RATE_LIMITED
      }
    )
  }

  // Default unknown error
  return new StakingError(
    ErrorType.UNKNOWN_ERROR,
    error?.message || ERROR_MESSAGES[ErrorType.UNKNOWN_ERROR],
    { details: error }
  )
}

export function handleError(error: any, context?: string): StakingError {
  const stakingError = parseError(error)
  
  // Log error for debugging
  console.error(`[${context || 'Unknown'}] Error:`, {
    type: stakingError.type,
    message: stakingError.message,
    code: stakingError.code,
    details: stakingError.details,
    timestamp: stakingError.timestamp,
  })

  // Show user-friendly toast
  const toastMessage = stakingError.retryable 
    ? `${stakingError.message} (You can retry)`
    : stakingError.message

  if (stakingError.type === ErrorType.NETWORK_ERROR || stakingError.retryable) {
    toast.error(toastMessage, {
      duration: 6000,
      id: `error-${stakingError.type}`, // Prevent duplicate toasts
    })
  } else {
    toast.error(toastMessage, {
      duration: 4000,
      id: `error-${stakingError.type}`,
    })
  }

  return stakingError
}

// Helper function for retry logic
export function shouldRetry(error: StakingError, attemptCount: number): boolean {
  const MAX_RETRIES = 3
  
  if (attemptCount >= MAX_RETRIES) {
    return false
  }

  return error.retryable && [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.TRANSACTION_FAILED,
  ].includes(error.type)
}

// Circuit breaker helper
export function createCircuitBreaker() {
  let failureCount = 0
  let lastFailureTime = 0
  const FAILURE_THRESHOLD = 5
  const RESET_TIMEOUT = 30000 // 30 seconds

  return {
    canExecute(): boolean {
      const now = Date.now()
      
      // Reset if timeout has passed
      if (now - lastFailureTime > RESET_TIMEOUT) {
        failureCount = 0
      }
      
      return failureCount < FAILURE_THRESHOLD
    },
    
    onSuccess(): void {
      failureCount = 0
    },
    
    onFailure(): void {
      failureCount++
      lastFailureTime = Date.now()
    },
    
    getStatus(): { failures: number; blocked: boolean; resetIn: number } {
      const now = Date.now()
      const resetIn = Math.max(0, RESET_TIMEOUT - (now - lastFailureTime))
      
      return {
        failures: failureCount,
        blocked: failureCount >= FAILURE_THRESHOLD,
        resetIn,
      }
    }
  }
}