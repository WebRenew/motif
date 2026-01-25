import { useCallback, useRef, type MutableRefObject } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { toast } from 'sonner'

type HistoryState = { nodes: Node[]; edges: Edge[] }

type UseWorkflowHistoryOptions = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void
  isExecutingRef: MutableRefObject<boolean>
  maxHistorySize?: number
}

type UseWorkflowHistoryReturn = {
  /** Push current state to history (call after state-changing operations) */
  pushToHistory: () => void
  /** Undo to previous state (returns true if undo was performed) */
  undoImpl: () => boolean
  /** Redo to next state (returns true if redo was performed) */
  redoImpl: () => boolean
  /** Initialize history with initial state */
  initializeHistory: (state: HistoryState) => void
  /** Direct access to history ref (for debugging) */
  historyRef: MutableRefObject<HistoryState[]>
  /** Direct access to history index ref (for debugging) */
  historyIndexRef: MutableRefObject<number>
}

/**
 * Deep clone a node to prevent mutation issues in history.
 * Clones the node object and its data property.
 */
function cloneNode(node: Node): Node {
  return {
    ...node,
    data: { ...node.data },
    // Clone position if present to prevent mutation
    position: node.position ? { ...node.position } : node.position,
  }
}

/**
 * Deep clone an edge to prevent mutation issues in history.
 */
function cloneEdge(edge: Edge): Edge {
  return { ...edge }
}

/**
 * Deep clone a history state (nodes and edges) to prevent mutation.
 */
function cloneHistoryState(state: HistoryState): HistoryState {
  return {
    nodes: state.nodes.map(cloneNode),
    edges: state.edges.map(cloneEdge),
  }
}

/**
 * Hook for managing undo/redo history for workflow state.
 * 
 * IMPORTANT: This hook deep-clones node/edge data to prevent mutation issues.
 * Without deep cloning, mutating node.data elsewhere would corrupt history states.
 * 
 * Usage:
 * ```ts
 * const { pushToHistory, undoImpl, redoImpl, initializeHistory } = useWorkflowHistory({
 *   nodesRef,
 *   edgesRef,
 *   setNodes,
 *   setEdges,
 *   isExecutingRef,
 * })
 * 
 * // After any state-changing operation:
 * pushToHistory()
 * 
 * // For undo/redo buttons or keyboard shortcuts:
 * const handleUndo = () => {
 *   if (undoImpl()) {
 *     debouncedSave()
 *   }
 * }
 * ```
 */
export function useWorkflowHistory({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  isExecutingRef,
  maxHistorySize = 50,
}: UseWorkflowHistoryOptions): UseWorkflowHistoryReturn {
  const historyRef = useRef<HistoryState[]>([])
  const historyIndexRef = useRef(-1)

  // Initialize history with a given state (deep cloned)
  const initializeHistory = useCallback((state: HistoryState) => {
    historyRef.current = [cloneHistoryState(state)]
    historyIndexRef.current = 0
  }, [])

  // Push current state to history (deep cloned to prevent mutation issues)
  const pushToHistory = useCallback(() => {
    // Don't record history during execution
    if (isExecutingRef.current) return

    // Deep clone current state to prevent mutation issues
    const currentState = cloneHistoryState({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    })

    // Remove any future history if we're not at the end
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    }

    // Add new state
    historyRef.current.push(currentState)
    historyIndexRef.current++

    // Limit history size
    if (historyRef.current.length > maxHistorySize) {
      historyRef.current.shift()
      historyIndexRef.current--
    }
  }, [nodesRef, edgesRef, isExecutingRef, maxHistorySize])

  // Undo - restore previous state (deep cloned to prevent mutation)
  const undoImpl = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      toast.info('Nothing to undo')
      return false
    }

    historyIndexRef.current--
    const previousState = historyRef.current[historyIndexRef.current]

    // Deep clone when restoring to prevent mutating history
    setNodes(previousState.nodes.map(cloneNode))
    setEdges(previousState.edges.map(cloneEdge))

    toast.success('Undo')
    return true
  }, [setNodes, setEdges])

  // Redo - restore next state (deep cloned to prevent mutation)
  const redoImpl = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      toast.info('Nothing to redo')
      return false
    }

    historyIndexRef.current++
    const nextState = historyRef.current[historyIndexRef.current]

    // Deep clone when restoring to prevent mutating history
    setNodes(nextState.nodes.map(cloneNode))
    setEdges(nextState.edges.map(cloneEdge))

    toast.success('Redo')
    return true
  }, [setNodes, setEdges])

  return {
    pushToHistory,
    undoImpl,
    redoImpl,
    initializeHistory,
    historyRef,
    historyIndexRef,
  }
}
