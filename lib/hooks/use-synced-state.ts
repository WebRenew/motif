import { useState, useCallback, useRef, type MutableRefObject } from 'react'

/**
 * A hook that combines useState with a ref that stays in sync.
 * 
 * This is useful when you need to:
 * 1. Avoid stale closures in callbacks (read from ref)
 * 2. Still trigger re-renders when state changes (from setState)
 * 3. Have both state and ref always synchronized
 * 
 * @example
 * const [nodes, setNodes, nodesRef] = useSyncedState<Node[]>([])
 * 
 * // In a callback that shouldn't re-create on state change:
 * const handleSomething = useCallback(() => {
 *   // Read latest value from ref (no stale closure)
 *   const currentNodes = nodesRef.current
 * }, []) // Empty deps since we use ref
 * 
 * // When updating state:
 * setNodes(nds => nds.filter(n => n.id !== deletedId))
 * // Both state AND ref are updated atomically
 */
export function useSyncedState<T>(
  initialValue: T | (() => T)
): [T, (updater: T | ((prev: T) => T)) => void, MutableRefObject<T>] {
  const [state, setStateInternal] = useState<T>(initialValue)
  const ref = useRef<T>(state)

  // Keep ref in sync with initial value if it's lazy
  if (ref.current === undefined && typeof initialValue === 'function') {
    ref.current = (initialValue as () => T)()
  }

  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    setStateInternal((prevState) => {
      const newState = typeof updater === 'function' 
        ? (updater as (prev: T) => T)(prevState) 
        : updater
      ref.current = newState
      return newState
    })
  }, [])

  return [state, setState, ref]
}

/**
 * A variant that only provides the setter and ref (no state value).
 * Use this when you never need to read the state directly in render,
 * only in callbacks via the ref.
 * 
 * This avoids re-renders when state changes, but still keeps the ref updated.
 * Useful for tracking values that don't affect rendering.
 */
export function useSyncedRef<T>(
  initialValue: T
): [(updater: T | ((prev: T) => T)) => void, MutableRefObject<T>] {
  const ref = useRef<T>(initialValue)

  const setRef = useCallback((updater: T | ((prev: T) => T)) => {
    const newValue = typeof updater === 'function'
      ? (updater as (prev: T) => T)(ref.current)
      : updater
    ref.current = newValue
  }, [])

  return [setRef, ref]
}
