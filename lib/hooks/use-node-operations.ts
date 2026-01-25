import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { Node } from '@xyflow/react'
import {
  createImageNode,
  createPromptNode,
  createCodeNode,
  createTextInputNode,
  createStickyNoteNode,
  createCaptureNode,
} from '@/lib/workflow/node-factories'

type Position = { x: number; y: number }

type UseNodeOperationsOptions = {
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; flowX: number; flowY: number } | null>>
  pushToHistory: () => void
  debouncedSave: () => void
}

type UseNodeOperationsReturn = {
  handleAddImageNode: (position: Position) => void
  handleAddPromptNode: (position: Position, outputType: 'image' | 'text') => void
  handleAddCodeNode: (position: Position) => void
  handleAddTextInputNode: (position: Position) => void
  handleAddStickyNoteNode: (position: Position) => void
  handleAddCaptureNode: (position: Position) => void
}

/**
 * Hook for node creation operations.
 * 
 * Provides handlers for adding different types of nodes to the workflow.
 * Each handler:
 * 1. Creates the appropriate node type at the given position
 * 2. Adds it to the nodes state
 * 3. Records the change in history
 * 4. Triggers a debounced save
 * 5. Closes the context menu
 */
export function useNodeOperations({
  setNodes,
  setContextMenu,
  pushToHistory,
  debouncedSave,
}: UseNodeOperationsOptions): UseNodeOperationsReturn {

  const handleAddImageNode = useCallback((position: Position) => {
    const newNode = createImageNode(position)
    setNodes((nds) => [...nds, newNode])
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [setNodes, setContextMenu, pushToHistory, debouncedSave])

  const handleAddPromptNode = useCallback((position: Position, outputType: 'image' | 'text') => {
    const newNode = createPromptNode(position, outputType)
    setNodes((nds) => [...nds, newNode])
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [setNodes, setContextMenu, pushToHistory, debouncedSave])

  const handleAddCodeNode = useCallback((position: Position) => {
    const newNode = createCodeNode(position)
    setNodes((nds) => [...nds, newNode])
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [setNodes, setContextMenu, pushToHistory, debouncedSave])

  const handleAddTextInputNode = useCallback((position: Position) => {
    const newNode = createTextInputNode(position)
    setNodes((nds) => [...nds, newNode])
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [setNodes, setContextMenu, pushToHistory, debouncedSave])

  const handleAddStickyNoteNode = useCallback((position: Position) => {
    const newNode = createStickyNoteNode(position)
    setNodes((nds) => [...nds, newNode])
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [setNodes, setContextMenu, pushToHistory, debouncedSave])

  const handleAddCaptureNode = useCallback((position: Position) => {
    const newNode = createCaptureNode(position)
    setNodes((nds) => [...nds, newNode])
    pushToHistory()
    debouncedSave()
    setContextMenu(null)
  }, [setNodes, setContextMenu, pushToHistory, debouncedSave])

  return {
    handleAddImageNode,
    handleAddPromptNode,
    handleAddCodeNode,
    handleAddTextInputNode,
    handleAddStickyNoteNode,
    handleAddCaptureNode,
  }
}
