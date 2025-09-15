// Frontend validation utilities for input sanitization and validation
import { PublicKey } from '@solana/web3.js'

export interface ValidationResult {
  isValid: boolean
  error?: string
  sanitizedValue?: any
}

export interface ValidationRule<T> {
  validate: (value: T) => ValidationResult
  message?: string
}

// Base validation functions
export const validators = {
  // Required field validation
  required: <T>(value: T): ValidationResult => {
    const isValid = value !== null && value !== undefined && value !== ''
    return {
      isValid,
      error: isValid ? undefined : 'This field is required',
      sanitizedValue: value
    }
  },

  // String validations
  minLength: (min: number) => (value: string): ValidationResult => {
    const sanitized = String(value || '').trim()
    const isValid = sanitized.length >= min
    return {
      isValid,
      error: isValid ? undefined : `Minimum length is ${min} characters`,
      sanitizedValue: sanitized
    }
  },

  maxLength: (max: number) => (value: string): ValidationResult => {
    const sanitized = String(value || '').trim()
    const isValid = sanitized.length <= max
    return {
      isValid,
      error: isValid ? undefined : `Maximum length is ${max} characters`,
      sanitizedValue: sanitized
    }
  },

  // Numeric validations
  number: (value: any): ValidationResult => {
    const num = Number(value)
    const isValid = !isNaN(num) && isFinite(num)
    return {
      isValid,
      error: isValid ? undefined : 'Must be a valid number',
      sanitizedValue: isValid ? num : undefined
    }
  },

  integer: (value: any): ValidationResult => {
    const num = Number(value)
    const isValid = Number.isInteger(num)
    return {
      isValid,
      error: isValid ? undefined : 'Must be a whole number',
      sanitizedValue: isValid ? num : undefined
    }
  },

  positiveNumber: (value: any): ValidationResult => {
    const num = Number(value)
    const isValid = !isNaN(num) && num > 0
    return {
      isValid,
      error: isValid ? undefined : 'Must be a positive number',
      sanitizedValue: isValid ? num : undefined
    }
  },

  range: (min: number, max: number) => (value: any): ValidationResult => {
    const num = Number(value)
    const isValid = !isNaN(num) && num >= min && num <= max
    return {
      isValid,
      error: isValid ? undefined : `Must be between ${min} and ${max}`,
      sanitizedValue: isValid ? num : undefined
    }
  },

  // Solana-specific validations
  publicKey: (value: string): ValidationResult => {
    if (!value || typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Public key is required'
      }
    }

    const sanitized = value.trim()
    
    try {
      const pubkey = new PublicKey(sanitized)
      return {
        isValid: true,
        sanitizedValue: pubkey.toString()
      }
    } catch {
      return {
        isValid: false,
        error: 'Invalid public key format'
      }
    }
  },

  signature: (value: string): ValidationResult => {
    if (!value || typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Transaction signature is required'
      }
    }

    const sanitized = value.trim()
    
    // Basic signature format validation (base58, ~88 characters)
    const signatureRegex = /^[A-HJ-NP-Za-km-z1-9]{87,88}$/
    const isValid = signatureRegex.test(sanitized)
    
    return {
      isValid,
      error: isValid ? undefined : 'Invalid transaction signature format',
      sanitizedValue: isValid ? sanitized : undefined
    }
  },

  // Time validations
  futureTimestamp: (value: any): ValidationResult => {
    const timestamp = Number(value)
    const now = Date.now() / 1000
    const isValid = !isNaN(timestamp) && timestamp > now
    
    return {
      isValid,
      error: isValid ? undefined : 'Timestamp must be in the future',
      sanitizedValue: isValid ? timestamp : undefined
    }
  },

  timelock: (value: any): ValidationResult => {
    const hours = Number(value)
    const isValid = !isNaN(hours) && hours >= 1 && hours <= 168 // 1 hour to 1 week
    
    return {
      isValid,
      error: isValid ? undefined : 'Timelock must be between 1 hour and 1 week',
      sanitizedValue: isValid ? hours * 3600 : undefined // Convert to seconds
    }
  },

  // NFT mint validation
  nftMint: (value: string): ValidationResult => {
    const pubKeyResult = validators.publicKey(value)
    if (!pubKeyResult.isValid) {
      return {
        isValid: false,
        error: 'Invalid NFT mint address'
      }
    }

    // Additional NFT-specific validation could go here
    return pubKeyResult
  },

  // Amount validations (for tokens)
  tokenAmount: (decimals: number = 6) => (value: any): ValidationResult => {
    const num = Number(value)
    if (isNaN(num) || num < 0) {
      return {
        isValid: false,
        error: 'Invalid token amount'
      }
    }

    // Check for excessive decimal places
    const maxDecimalPlaces = decimals
    const decimalPlaces = (num.toString().split('.')[1] || '').length
    
    if (decimalPlaces > maxDecimalPlaces) {
      return {
        isValid: false,
        error: `Maximum ${maxDecimalPlaces} decimal places allowed`
      }
    }

    // Convert to lamports/base units
    const baseAmount = Math.floor(num * Math.pow(10, decimals))
    
    return {
      isValid: true,
      sanitizedValue: baseAmount
    }
  },

  // Email validation (if needed for notifications)
  email: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, error: 'Email is required' }
    }

    const sanitized = String(value).trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isValid = emailRegex.test(sanitized)

    return {
      isValid,
      error: isValid ? undefined : 'Invalid email format',
      sanitizedValue: isValid ? sanitized : undefined
    }
  },

  // URL validation
  url: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, error: 'URL is required' }
    }

    const sanitized = String(value).trim()
    
    try {
      const url = new URL(sanitized)
      const isValid = ['http:', 'https:'].includes(url.protocol)
      
      return {
        isValid,
        error: isValid ? undefined : 'Invalid URL format',
        sanitizedValue: isValid ? sanitized : undefined
      }
    } catch {
      return {
        isValid: false,
        error: 'Invalid URL format'
      }
    }
  },

  // Version validation
  version: (value: any): ValidationResult => {
    const version = Number(value)
    const isValid = Number.isInteger(version) && version > 0
    
    return {
      isValid,
      error: isValid ? undefined : 'Version must be a positive integer',
      sanitizedValue: isValid ? version : undefined
    }
  },

  // Role validation
  role: (value: string): ValidationResult => {
    const validRoles = ['SuperAdmin', 'Admin', 'Moderator', 'Operator']
    const sanitized = String(value).trim()
    const isValid = validRoles.includes(sanitized)
    
    return {
      isValid,
      error: isValid ? undefined : `Role must be one of: ${validRoles.join(', ')}`,
      sanitizedValue: isValid ? sanitized : undefined
    }
  },

  // Array validation
  arrayMinLength: (min: number) => (value: any[]): ValidationResult => {
    const isArray = Array.isArray(value)
    const isValid = isArray && value.length >= min
    
    return {
      isValid,
      error: isValid ? undefined : `Must contain at least ${min} items`,
      sanitizedValue: isValid ? value : undefined
    }
  },

  arrayMaxLength: (max: number) => (value: any[]): ValidationResult => {
    const isArray = Array.isArray(value)
    const isValid = isArray && value.length <= max
    
    return {
      isValid,
      error: isValid ? undefined : `Must contain at most ${max} items`,
      sanitizedValue: isValid ? value : undefined
    }
  }
}

// Validation composer for chaining validations
export class ValidationChain<T> {
  private rules: ValidationRule<T>[] = []

  static for<T>(value: T): ValidationChain<T> {
    return new ValidationChain<T>()
  }

  add(rule: ValidationRule<T>): ValidationChain<T> {
    this.rules.push(rule)
    return this
  }

  required(): ValidationChain<T> {
    return this.add({ validate: validators.required })
  }

  custom(validateFn: (value: T) => ValidationResult): ValidationChain<T> {
    return this.add({ validate: validateFn })
  }

  validate(value: T): ValidationResult {
    let sanitizedValue = value

    for (const rule of this.rules) {
      const result = rule.validate(sanitizedValue)
      
      if (!result.isValid) {
        return result
      }
      
      if (result.sanitizedValue !== undefined) {
        sanitizedValue = result.sanitizedValue
      }
    }

    return {
      isValid: true,
      sanitizedValue
    }
  }
}

// Form validation utilities
export interface FormValidationRules {
  [key: string]: ValidationRule<any>[] | ValidationChain<any>
}

export interface FormErrors {
  [key: string]: string | undefined
}

export function validateForm(
  values: Record<string, any>,
  rules: FormValidationRules
): { isValid: boolean; errors: FormErrors; sanitizedValues: Record<string, any> } {
  const errors: FormErrors = {}
  const sanitizedValues: Record<string, any> = {}
  let isValid = true

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = values[field]
    
    if (fieldRules instanceof ValidationChain) {
      const result = fieldRules.validate(value)
      if (!result.isValid) {
        errors[field] = result.error
        isValid = false
      } else {
        sanitizedValues[field] = result.sanitizedValue
      }
    } else {
      // Array of rules
      let fieldSanitizedValue = value
      
      for (const rule of fieldRules) {
        const result = rule.validate(fieldSanitizedValue)
        
        if (!result.isValid) {
          errors[field] = result.error
          isValid = false
          break
        }
        
        if (result.sanitizedValue !== undefined) {
          fieldSanitizedValue = result.sanitizedValue
        }
      }
      
      if (isValid || !errors[field]) {
        sanitizedValues[field] = fieldSanitizedValue
      }
    }
  }

  return { isValid, errors, sanitizedValues }
}

// Specific validation schemas for the application
export const validationSchemas = {
  // Upgrade proposal validation
  upgradeProposal: {
    newVersion: [
      { validate: validators.required },
      { validate: validators.version }
    ],
    timelockHours: [
      { validate: validators.required },
      { validate: validators.timelock }
    ]
  },

  // Role management validation
  roleGrant: {
    userPublicKey: [
      { validate: validators.required },
      { validate: validators.publicKey }
    ],
    role: [
      { validate: validators.required },
      { validate: validators.role }
    ]
  },

  // Configuration update validation
  configUpdate: {
    rewardRate: [
      { validate: validators.positiveNumber },
      { validate: validators.range(1, 1000000) }
    ],
    collectionMint: [
      { validate: validators.publicKey }
    ]
  },

  // NFT staking validation
  nftStaking: {
    nftMint: [
      { validate: validators.required },
      { validate: validators.nftMint }
    ]
  }
}

// Real-time validation hook for React components
export function useFormValidation(
  initialValues: Record<string, any>,
  rules: FormValidationRules
) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = useCallback((field: string, value: any) => {
    const fieldRules = rules[field]
    if (!fieldRules) return

    if (fieldRules instanceof ValidationChain) {
      const result = fieldRules.validate(value)
      setErrors(prev => ({
        ...prev,
        [field]: result.isValid ? undefined : result.error
      }))
    } else {
      // Array of rules
      for (const rule of fieldRules) {
        const result = rule.validate(value)
        if (!result.isValid) {
          setErrors(prev => ({
            ...prev,
            [field]: result.error
          }))
          return
        }
      }
      
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }, [rules])

  const setValue = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    if (touched[field]) {
      validateField(field, value)
    }
  }, [touched, validateField])

  const setTouched = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validateField(field, values[field])
  }, [values, validateField])

  const validateAll = useCallback(() => {
    const result = validateForm(values, rules)
    setErrors(result.errors)
    return result
  }, [values, rules])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const hasErrors = Object.values(errors).some(error => error !== undefined)
  const isFormTouched = Object.values(touched).some(Boolean)

  return {
    values,
    errors,
    touched,
    setValue,
    setTouched,
    validateAll,
    validateField,
    reset,
    hasErrors,
    isFormTouched,
    isValid: !hasErrors && isFormTouched
  }
}

// Input sanitization utilities
export const sanitize = {
  // Remove potentially dangerous characters
  basic: (input: string): string => {
    return String(input)
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .trim()
  },

  // Sanitize for display in HTML
  html: (input: string): string => {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  },

  // Sanitize numeric input
  numeric: (input: string): string => {
    return String(input).replace(/[^0-9.-]/g, '')
  },

  // Sanitize public key input
  publicKey: (input: string): string => {
    return String(input)
      .replace(/[^A-HJ-NP-Za-km-z1-9]/g, '') // Base58 characters only
      .slice(0, 50) // Reasonable max length
  }
}