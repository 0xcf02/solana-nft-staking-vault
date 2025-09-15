'use client'

import { useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useStaking } from '@/hooks/useStaking'
import { useFormValidation, validationSchemas, sanitize } from '@/utils/validation'
import toast from 'react-hot-toast'

const UpgradeManager = () => {
  const { 
    vaultData, 
    userPermissions,
    proposeUpgrade,
    executeUpgrade,
    cancelUpgrade,
    setUpgradeAuthority,
    lockUpgrades,
    loading
  } = useStaking()
  
  const [actionLoading, setActionLoading] = useState(false)

  // Form validation for upgrade proposal
  const upgradeForm = useFormValidation(
    { newVersion: '', timelockHours: '24' },
    validationSchemas.upgradeProposal
  )

  // Form validation for authority change
  const authorityForm = useFormValidation(
    { userPublicKey: '' },
    { userPublicKey: validationSchemas.roleGrant.userPublicKey }
  )

  const canManageUpgrades = userPermissions?.canUpdateConfig || false

  const handleProposeUpgrade = async () => {
    const validation = upgradeForm.validateAll()
    
    if (!validation.isValid) {
      toast.error('Please fix validation errors')
      return
    }

    const { newVersion, timelockHours } = validation.sanitizedValues

    // Version validation would go here when vaultData structure includes version
    // if (newVersion <= (vaultData?.version || 0)) {
    //   toast.error('New version must be higher than current version')
    //   upgradeForm.setValue('newVersion', '')
    //   return
    // }

    try {
      setActionLoading(true)
      await proposeUpgrade(newVersion, timelockHours)
      upgradeForm.reset()
      toast.success('Upgrade proposal submitted successfully')
    } catch (error) {
      console.error('Error proposing upgrade:', error)
      toast.error('Failed to propose upgrade')
    } finally {
      setActionLoading(false)
    }
  }

  const handleExecuteUpgrade = async () => {
    // Pending upgrade logic will be implemented when vaultData structure is complete
    // if (!vaultData?.pendingUpgrade) return

    // const now = Date.now() / 1000
    // const scheduledTime = vaultData.pendingUpgrade.scheduledTimestamp.toNumber()

    // if (now < scheduledTime) {
    //   const hoursRemaining = Math.ceil((scheduledTime - now) / 3600)
    //   toast.error(`Timelock not expired. ${hoursRemaining} hours remaining`)
    //   return
    // }

    try {
      setActionLoading(true)
      await executeUpgrade()
    } catch (error) {
      console.error('Error executing upgrade:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelUpgrade = async () => {
    try {
      setActionLoading(true)
      await cancelUpgrade()
    } catch (error) {
      console.error('Error cancelling upgrade:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSetUpgradeAuthority = async () => {
    const validation = authorityForm.validateAll()
    
    if (!validation.isValid) {
      toast.error('Please enter a valid public key')
      return
    }

    try {
      const authorityPubkey = new PublicKey(validation.sanitizedValues.userPublicKey)
      setActionLoading(true)
      await setUpgradeAuthority(authorityPubkey)
      authorityForm.reset()
      toast.success('Upgrade authority updated successfully')
    } catch (error) {
      console.error('Error setting upgrade authority:', error)
      toast.error('Failed to update upgrade authority')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLockUpgrades = async () => {
    if (!confirm('This action is irreversible. Are you sure you want to lock all future upgrades?')) {
      return
    }

    try {
      setActionLoading(true)
      await lockUpgrades()
    } catch (error) {
      console.error('Error locking upgrades:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getTimeRemaining = (timestamp: number) => {
    const now = Date.now() / 1000
    const remaining = timestamp - now
    
    if (remaining <= 0) return 'Ready to execute'
    
    const hours = Math.ceil(remaining / 3600)
    return `${hours} hour(s) remaining`
  }

  if (!canManageUpgrades) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Upgrade Management</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Access Denied
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>You don't have permission to manage upgrades. Contact a system administrator.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Upgrade Management</h2>
      
      {/* Current Version Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Current System Status</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Version:</span>
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">
              v1.0 {/* Version will be available when vaultData structure is complete */}
            </span>
          </div>
          <div>
            <span className="font-medium">Upgrades:</span>
            <span className="ml-2 px-2 py-1 rounded bg-green-100 text-green-800">
              🔓 Unlocked {/* Upgrade lock status will be available when vaultData structure is complete */}
            </span>
          </div>
          <div className="col-span-2">
            <span className="font-medium">Upgrade Authority:</span>
            <span className="ml-2 text-xs font-mono text-gray-600">
              {vaultData?.authority?.toString() || 'Unknown'} {/* Using authority instead of upgradeAuthority */}
            </span>
          </div>
        </div>
      </div>

      {/* Pending Upgrade Info - Commented out until vault data structure is complete */}
      {/* {vaultData?.pendingUpgrade && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">⏳ Pending Upgrade</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">New Version:</span>
              <span className="ml-2">v{vaultData.pendingUpgrade.newVersion}</span>
            </div>
            <div>
              <span className="font-medium">Scheduled:</span>
              <span className="ml-2">{formatTimestamp(vaultData.pendingUpgrade.scheduledTimestamp.toNumber())}</span>
            </div>
            <div>
              <span className="font-medium">Status:</span>
              <span className="ml-2">{getTimeRemaining(vaultData.pendingUpgrade.scheduledTimestamp.toNumber())}</span>
            </div>
            <div>
              <span className="font-medium">Proposer:</span>
              <span className="ml-2 text-xs font-mono">{vaultData.pendingUpgrade.proposer.toString()}</span>
            </div>
          </div>
          
          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleExecuteUpgrade}
              disabled={actionLoading || loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Executing...' : 'Execute Upgrade'}
            </button>
            <button
              onClick={handleCancelUpgrade}
              disabled={actionLoading || loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Cancelling...' : 'Cancel Upgrade'}
            </button>
          </div>
        </div>
      )} */}

      {/* Upgrade Actions */}
      {vaultData && ( /* Show actions when vault data is available */
        <div className="space-y-6">
          {/* Propose Upgrade */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Propose New Upgrade</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Version
                </label>
                <input
                  type="number"
                  value={upgradeForm.values.newVersion}
                  onChange={(e) => upgradeForm.setValue('newVersion', e.target.value)}
                  onBlur={() => upgradeForm.setTouched('newVersion')}
                  min={2} // Static minimum version since vaultData.version doesn't exist yet
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    upgradeForm.errors.newVersion 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="e.g., 2"
                />
                {upgradeForm.errors.newVersion && (
                  <p className="mt-1 text-sm text-red-600">{upgradeForm.errors.newVersion}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timelock (hours)
                </label>
                <input
                  type="number"
                  value={upgradeForm.values.timelockHours}
                  onChange={(e) => upgradeForm.setValue('timelockHours', e.target.value)}
                  onBlur={() => upgradeForm.setTouched('timelockHours')}
                  min="1"
                  max="168"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    upgradeForm.errors.timelockHours 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="24"
                />
                {upgradeForm.errors.timelockHours && (
                  <p className="mt-1 text-sm text-red-600">{upgradeForm.errors.timelockHours}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleProposeUpgrade}
              disabled={actionLoading || loading || !upgradeForm.isValid}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Proposing...' : 'Propose Upgrade'}
            </button>
          </div>

          {/* Set Upgrade Authority */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Transfer Upgrade Authority</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Authority Public Key
              </label>
              <input
                type="text"
                value={authorityForm.values.userPublicKey}
                onChange={(e) => {
                  const sanitized = sanitize.publicKey(e.target.value)
                  authorityForm.setValue('userPublicKey', sanitized)
                }}
                onBlur={() => authorityForm.setTouched('userPublicKey')}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 font-mono text-sm ${
                  authorityForm.errors.userPublicKey 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Enter public key..."
                maxLength={50}
              />
              {authorityForm.errors.userPublicKey && (
                <p className="mt-1 text-sm text-red-600">{authorityForm.errors.userPublicKey}</p>
              )}
            </div>
            <button
              onClick={handleSetUpgradeAuthority}
              disabled={actionLoading || loading || !authorityForm.isValid}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Setting...' : 'Set Authority'}
            </button>
          </div>

          {/* Lock Upgrades */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <h3 className="text-lg font-semibold text-red-700 mb-4">🔒 Permanent Upgrade Lock</h3>
            <p className="text-sm text-red-600 mb-4">
              <strong>Warning:</strong> This action is irreversible. Once locked, no future upgrades will be possible.
            </p>
            <button
              onClick={handleLockUpgrades}
              disabled={actionLoading || loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Locking...' : 'Lock All Future Upgrades'}
            </button>
          </div>
        </div>
      )}

      {/* Upgrade lock status will be shown when vaultData structure is complete */}
      {/* {vaultData?.upgradeLocked && (
        <div className="text-center p-8 bg-gray-100 rounded-lg">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Upgrades Permanently Locked</h3>
          <p className="text-gray-600">No further upgrades are possible for this vault.</p>
        </div>
      )} */}
    </div>
  )
}

export default UpgradeManager