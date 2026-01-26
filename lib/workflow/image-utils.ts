import type { WorkflowImage, WorkflowTextInput } from "@/lib/types/workflow"
import { logger } from "@/lib/logger"

/**
 * Detects media type from URL or returns default PNG
 */
function detectMediaType(url: string): string {
  if (url.includes("data:")) {
    const match = url.match(/data:([^;]+);/)
    if (match) return match[1]
  } else if (url.endsWith(".jpg") || url.endsWith(".jpeg")) {
    return "image/jpeg"
  } else if (url.endsWith(".webp")) {
    return "image/webp"
  }
  return "image/png"
}

/**
 * Sanitizes base64 data URLs by removing whitespace and newlines
 */
function sanitizeDataUrl(url: string): string {
  // Only process data URLs
  if (!url.startsWith("data:")) {
    return url
  }

  // Extract parts: data:image/png;base64,<base64data>
  const match = url.match(/^(data:[^;]+;base64,)(.+)$/)
  if (!match) {
    return url // Return as-is if format doesn't match
  }

  const [, prefix, base64Data] = match
  // Remove all whitespace characters (spaces, newlines, tabs, etc.)
  const cleanedBase64 = base64Data.replace(/\s+/g, "")

  return `${prefix}${cleanedBase64}`
}

/**
 * Gathers input images from connected nodes for a given node
 * Images are sorted by Y position (top to bottom) and assigned sequence numbers
 * 
 * For capture nodes with frame strips, this includes frameStripInfo metadata
 * so the AI generation can understand it's looking at an animation sequence.
 */
export function getInputImagesFromNodes(
  nodeId: string,
  nodes: { id: string; type?: string; data: Record<string, unknown>; position?: { x: number; y: number } }[],
  edges: { source: string; target: string }[],
): WorkflowImage[] {
  try {
    const incomingEdges = edges.filter((e) => e.target === nodeId)
    const inputNodeIds = incomingEdges.map((e) => e.source)

    // Collect image nodes with their Y positions and optional frame strip info
    const imageNodesWithPosition: Array<{
      node: { id: string; type?: string; data: Record<string, unknown>; position?: { x: number; y: number } }
      url: string
      mediaType: string
      frameStripInfo?: { totalFrames: number; excludedFrames: number[] }
    }> = []

    for (const inputId of inputNodeIds) {
      const inputNode = nodes.find((n) => n.id === inputId)

      if (!inputNode) continue

      if (inputNode.type === "imageNode" && inputNode.data.imageUrl) {
        const url = inputNode.data.imageUrl as string
        const mediaType = detectMediaType(url)
        // Sanitize data URLs to remove any whitespace that might cause base64 decode errors
        const sanitizedUrl = sanitizeDataUrl(url)
        imageNodesWithPosition.push({ node: inputNode, url: sanitizedUrl, mediaType })
      }

      // Handle capture nodes - prefer individual frameUrls over legacy videoUrl strip
      if (inputNode.type === "captureNode") {
        const frameUrls = inputNode.data.frameUrls as string[] | undefined
        const excludedFrames = (inputNode.data.excludedFrames as number[]) || []

        if (frameUrls && frameUrls.length > 0) {
          // New approach: individual frames - add each as separate image
          frameUrls.forEach((frameUrl, index) => {
            // Skip excluded frames
            if (excludedFrames.includes(index)) return

            const mediaType = detectMediaType(frameUrl)
            const sanitizedUrl = sanitizeDataUrl(frameUrl)
            imageNodesWithPosition.push({
              node: inputNode,
              url: sanitizedUrl,
              mediaType,
            })
          })

          logger.debug('Capture node individual frames added', {
            nodeId: inputNode.id,
            totalFrames: frameUrls.length,
            includedFrames: frameUrls.length - excludedFrames.length,
          })
        } else if (inputNode.data.videoUrl) {
          // Legacy fallback: horizontal strip
          const url = inputNode.data.videoUrl as string
          const mediaType = detectMediaType(url)
          const sanitizedUrl = sanitizeDataUrl(url)
          const totalFrames = (inputNode.data.totalFrames as number) || 1

          imageNodesWithPosition.push({
            node: inputNode,
            url: sanitizedUrl,
            mediaType,
            frameStripInfo: { totalFrames, excludedFrames },
          })

          logger.debug('Capture node frame strip added (legacy)', {
            nodeId: inputNode.id,
            totalFrames,
            excludedFrames: excludedFrames.length,
          })
        }
      }
    }

    // Filter out nodes without valid positions before sorting
    const nodesWithValidPosition = imageNodesWithPosition.filter(
      item => item.node.position && typeof item.node.position.y === "number" && Number.isFinite(item.node.position.y)
    )

    // Nodes without positions (shouldn't happen in practice, but defensive)
    const nodesWithoutPosition = imageNodesWithPosition.filter(
      item => !item.node.position || typeof item.node.position.y !== "number" || !Number.isFinite(item.node.position.y)
    )

    // Sort valid nodes by Y position (top to bottom)
    nodesWithValidPosition.sort((a, b) => {
      return a.node.position!.y - b.node.position!.y  // Safe to use ! after filter
    })

    // Combine: positioned nodes first (sorted), then unpositioned nodes (shouldn't normally exist)
    const sortedNodes = [...nodesWithValidPosition, ...nodesWithoutPosition]

    // Build final array with sequence numbers and frame strip info
    const inputImages: WorkflowImage[] = sortedNodes.map((item, index) => ({
      url: item.url,
      mediaType: item.mediaType,
      sequenceNumber: sortedNodes.length >= 2 ? index + 1 : undefined,
      frameStripInfo: item.frameStripInfo,
    }))

    return inputImages
  } catch (error) {
    logger.error('Error getting input images', {
      nodeId,
      error: error instanceof Error ? error.message : String(error),
    })
    // Return empty array as safe fallback
    return []
  }
}

/**
 * Gathers text inputs from connected code nodes for a given node
 */
function getTextInputsFromNodes(
  nodeId: string,
  nodes: { id: string; type?: string; data: Record<string, unknown> }[],
  edges: { source: string; target: string }[],
): WorkflowTextInput[] {
  const incomingEdges = edges.filter((e) => e.target === nodeId)
  const inputNodeIds = incomingEdges.map((e) => e.source)

  const textInputs: WorkflowTextInput[] = []

  for (const inputId of inputNodeIds) {
    const inputNode = nodes.find((n) => n.id === inputId)

    if (!inputNode) continue

    // Collect text from code nodes
    if (inputNode.type === "codeNode" && inputNode.data.content) {
      const content = inputNode.data.content as string
      const language = inputNode.data.language as string | undefined
      const label = inputNode.data.label as string | undefined

      textInputs.push({
        content,
        language,
        label: label || "Code Input"
      })
    }

    // Collect text from text input nodes
    if (inputNode.type === "textInputNode" && inputNode.data.value) {
      const content = inputNode.data.value as string
      const label = inputNode.data.label as string | undefined

      textInputs.push({
        content,
        label: label || "Text Input"
      })
    }

    // Collect text from prompt nodes (for chaining text outputs)
    // This allows prompt nodes to pass their text output to downstream nodes
    if (inputNode.type === "promptNode" && inputNode.data.lastTextOutput) {
      const content = inputNode.data.lastTextOutput as string
      const label = inputNode.data.title as string | undefined

      textInputs.push({
        content,
        label: label || "Text Input"
      })
    }

    // Collect animation context from capture nodes
    // This passes the captured animation data to downstream prompt nodes for analysis
    if (inputNode.type === "captureNode") {
      logger.debug('Found captureNode input', {
        nodeId: inputNode.id,
        hasAnimationContext: !!inputNode.data.animationContext,
        status: inputNode.data.status,
        dataKeys: Object.keys(inputNode.data),
      })
      
      if (inputNode.data.animationContext) {
        const animationContext = inputNode.data.animationContext as Record<string, unknown>
        const url = inputNode.data.url as string | undefined
        const excludedFrames = inputNode.data.excludedFrames as number[] | undefined
        const totalFrames = inputNode.data.totalFrames as number | undefined
        const includeHtml = inputNode.data.includeHtml !== false // Default to true
        
        // Format animation context as structured text for the AI to analyze
        const content = formatAnimationContextForPrompt(animationContext, url, excludedFrames, totalFrames, includeHtml)
        
        logger.debug('Adding animation context to text inputs', {
          url,
          contentLength: content.length,
          framesCount: (animationContext.frames as unknown[])?.length,
          excludedFrames,
          includeHtml,
        })
        
        textInputs.push({
          content,
          label: "Animation Capture Data"
        })
      }
    }
  }

  return textInputs
}

/**
 * Formats animation context data into a structured text format for AI analysis
 */
function formatAnimationContextForPrompt(
  context: Record<string, unknown>,
  url?: string,
  excludedFrames?: number[],
  totalFrames?: number,
  includeHtml: boolean = true,
): string {
  const sections: string[] = []

  // Header with source URL
  if (url) {
    sections.push(`## Source URL\n${url}`)
  }

  // Frame selection info (if any frames are excluded)
  if (excludedFrames && excludedFrames.length > 0 && totalFrames) {
    const excludedList = excludedFrames.map(i => i + 1).sort((a, b) => a - b).join(', ')
    const includedCount = totalFrames - excludedFrames.length
    sections.push(
      `## Frame Selection\n` +
      `**Important:** The user has excluded frames: ${excludedList} (${excludedFrames.length} of ${totalFrames} frames).\n` +
      `Focus your analysis on the ${includedCount} included frames. Ignore the excluded frames in the frame strip image.`
    )
  }

  // Animation libraries detected
  const libraries = context.libraries as Record<string, boolean> | undefined
  if (libraries) {
    const detected = Object.entries(libraries)
      .filter(([, active]) => active)
      .map(([name]) => name)
    
    if (detected.length > 0) {
      sections.push(`## Animation Libraries Detected\n${detected.join(', ')}`)
    } else {
      sections.push(`## Animation Libraries Detected\nNo major animation libraries detected (likely CSS animations or vanilla JS)`)
    }
  }

  // CSS Keyframes
  const keyframes = context.keyframes as Record<string, Array<{ offset: string; styles: string }>> | undefined
  if (keyframes && Object.keys(keyframes).length > 0) {
    const keyframesSections = Object.entries(keyframes).map(([name, frames]) => {
      const framesText = frames.map(f => `  ${f.offset}: ${f.styles}`).join('\n')
      return `@keyframes ${name} {\n${framesText}\n}`
    })
    sections.push(`## CSS Keyframes\n\`\`\`css\n${keyframesSections.join('\n\n')}\n\`\`\``)
  }

  // Computed styles
  const computedStyles = context.computedStyles as Record<string, string> | undefined
  if (computedStyles) {
    const styleEntries = Object.entries(computedStyles)
      .filter(([, value]) => value && value !== 'none')
      .map(([prop, value]) => `${prop}: ${value}`)
    
    if (styleEntries.length > 0) {
      sections.push(`## Computed Animation Styles\n\`\`\`css\n${styleEntries.join('\n')}\n\`\`\``)
    }
  }

  // Animation frames (sample of captured data)
  const frames = context.frames as Array<Record<string, unknown>> | undefined
  if (frames && frames.length > 0) {
    // Take first, middle, and last frames for analysis
    const sampleIndices = [0, Math.floor(frames.length / 2), frames.length - 1]
    const uniqueIndices = [...new Set(sampleIndices)].filter(i => i < frames.length)
    
    const sampleFrames = uniqueIndices.map(i => {
      const frame = frames[i]
      const relevantProps = Object.entries(frame)
        .filter(([key, value]) => value && value !== 'none' && key !== 'timestamp')
        .map(([key, value]) => `  ${key}: ${value}`)
      return `Frame ${i + 1}/${frames.length} (${frame.timestamp}ms):\n${relevantProps.join('\n')}`
    })
    
    sections.push(`## Captured Animation Frames (${frames.length} total)\n${sampleFrames.join('\n\n')}`)
  }

  // Bounding box
  const boundingBox = context.boundingBox as { x: number; y: number; width: number; height: number } | undefined
  if (boundingBox) {
    sections.push(`## Element Dimensions\nWidth: ${Math.round(boundingBox.width)}px, Height: ${Math.round(boundingBox.height)}px`)
  }

  // HTML snippet (truncated) - only include if enabled
  const html = context.html as string | undefined
  if (html && includeHtml) {
    const truncatedHtml = html.length > 1000 ? html.slice(0, 1000) + '...' : html
    sections.push(`## Element HTML\n\`\`\`html\n${truncatedHtml}\n\`\`\``)
  }

  return sections.join('\n\n')
}

/**
 * Gathers all inputs (images and text) from connected nodes for a given node
 */
export function getAllInputsFromNodes(
  nodeId: string,
  nodes: { id: string; type?: string; data: Record<string, unknown> }[],
  edges: { source: string; target: string }[],
): { images: WorkflowImage[]; textInputs: WorkflowTextInput[] } {
  return {
    images: getInputImagesFromNodes(nodeId, nodes, edges),
    textInputs: getTextInputsFromNodes(nodeId, nodes, edges),
  }
}
