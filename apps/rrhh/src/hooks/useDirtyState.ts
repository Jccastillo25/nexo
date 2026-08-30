'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Perform a deep comparison between two values.
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a.constructor !== b.constructor) return false
    let length, i, keys
    if (Array.isArray(a)) {
      length = a.length
      if (length !== b.length) return false
      for (i = length; i-- !== 0; ) {
        if (!deepEqual(a[i], b[i])) return false
      }
      return true
    }
    keys = Object.keys(a)
    length = keys.length
    if (length !== Object.keys(b).length) return false
    for (i = length; i-- !== 0; ) {
      if (!Object.prototype.hasOwnProperty.call(b, keys[i]!)) return false
    }
    for (i = length; i-- !== 0; ) {
      const key = keys[i]!
      if (!deepEqual(a[key], b[key])) return false
    }
    return true
  }
  return a !== a && b !== b
}

interface UseDirtyStateOptions {
  initialState: any
  onClose?: () => void
}

export function useDirtyState({ initialState, onClose }: UseDirtyStateOptions) {
  const [isDirty, setIsDirty] = useState(false)
  const [showExitGuard, setShowExitGuard] = useState(false)
  
  const initialRef = useRef(initialState)
  const currentRef = useRef(initialState)
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  // Update initial ref if it changes externally
  useEffect(() => {
    initialRef.current = initialState
  }, [initialState])

  const checkDirty = useCallback((currentState: any) => {
    currentRef.current = currentState
    const dirty = !deepEqual(initialRef.current, currentState)
    setIsDirty(dirty)
    return dirty
  }, [])

  const resetInitial = useCallback((newState: any) => {
    initialRef.current = newState
    currentRef.current = newState
    setIsDirty(false)
    setShowExitGuard(false)
  }, [])

  const handleAttemptClose = useCallback(() => {
    if (isDirty) {
      // Save current focus before showing guard
      lastFocusedRef.current = document.activeElement as HTMLElement
      setShowExitGuard(true)
    } else {
      onClose?.()
    }
  }, [isDirty, onClose])

  const cancelExit = useCallback(() => {
    setShowExitGuard(false)
    // Restore focus after a short delay to ensure DOM is ready
    setTimeout(() => {
      if (lastFocusedRef.current) {
        lastFocusedRef.current.focus()
      }
    }, 10)
  }, [])

  const confirmExit = useCallback(() => {
    setShowExitGuard(false)
    onClose?.()
  }, [onClose])

  // Handle Escape key logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // High priority interceptor
        if (showExitGuard) {
          e.preventDefault()
          e.stopPropagation()
          cancelExit()
        } else {
          // Only attempt close if we actually have an onClose handler
          if (onClose) {
            handleAttemptClose()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // Use capture to intercept before others
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [showExitGuard, handleAttemptClose, cancelExit, onClose])

  // Handle browser beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  return {
    isDirty,
    showExitGuard,
    handleAttemptClose,
    cancelExit,
    confirmExit,
    checkDirty,
    resetInitial,
  }
}
