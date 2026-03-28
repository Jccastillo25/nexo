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
}

export function useDirtyState({ initialState }: UseDirtyStateOptions) {
  const [isDirty, setIsDirty] = useState(false)
  const initialRef = useRef(initialState)
  const currentRef = useRef(initialState)

  // Update initial ref if it changes externally (e.g. after a fetch)
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
  }, [])

  // Handle browser beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = '' // Standard way to trigger browser dialog
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  return {
    isDirty,
    checkDirty,
    resetInitial,
  }
}
