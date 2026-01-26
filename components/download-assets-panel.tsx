"use client"

import { useState, useEffect, useCallback, type RefObject } from "react"
import type { Node } from "@xyflow/react"
import {
  Download,
  FileCode,
  Image as ImageIcon,
  Video,
  CheckSquare,
  Square,
  X,
} from "lucide-react"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
import type { WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"
import JSZip from "jszip"

interface DownloadableAsset {
  id: string
  name: string
  type: "image" | "code" | "video"
  content: string // URL for images/videos, actual content for code
  extension: string
  nodeLabel?: string
}

interface DownloadAssetsPanelProps {
  canvasRef?: RefObject<WorkflowCanvasHandle | null>
  onClose: () => void
}

/** Helper to get image extension from URL */
function getImageExtension(url: string): string {
  if (url.includes("data:image/png")) return "png"
  if (url.includes("data:image/jpeg") || url.includes("data:image/jpg")) return "jpg"
  if (url.includes("data:image/webp")) return "webp"
  if (url.includes("data:image/gif")) return "gif"
  const match = url.match(/\.(\w+)(?:\?|$)/)
  return match?.[1] || "png"
}

/** Helper to get code file extension from language */
function getCodeExtension(language: string): string {
  const extensions: Record<string, string> = {
    tsx: "tsx",
    typescript: "ts",
    javascript: "js",
    jsx: "jsx",
    css: "css",
    html: "html",
    json: "json",
    markdown: "md",
    python: "py",
    rust: "rs",
    go: "go",
  }
  return extensions[language.toLowerCase()] || "txt"
}

/** Extract downloadable assets from workflow nodes */
function extractDownloadableAssets(nodes: Node[]): DownloadableAsset[] {
  const assets: DownloadableAsset[] = []

  for (const node of nodes) {
    const data = node.data as Record<string, unknown>

    // Image nodes with content
    if (node.type === "imageNode" && data.imageUrl && typeof data.imageUrl === "string") {
      assets.push({
        id: node.id,
        name: (data.label as string) || "Image",
        type: "image",
        content: data.imageUrl,
        extension: getImageExtension(data.imageUrl),
        nodeLabel: data.label as string,
      })
    }

    // Code nodes with content
    if (node.type === "codeNode" && data.content && typeof data.content === "string") {
      const language = (data.language as string) || "txt"
      assets.push({
        id: node.id,
        name: (data.label as string) || `Code (${language})`,
        type: "code",
        content: data.content,
        extension: getCodeExtension(language),
        nodeLabel: data.label as string,
      })
    }

    // Capture nodes with video or frames
    if (node.type === "captureNode") {
      if (data.videoUrl && typeof data.videoUrl === "string") {
        assets.push({
          id: `${node.id}-video`,
          name: "Animation Capture",
          type: "video",
          content: data.videoUrl,
          extension: "webp",
        })
      }
      if (Array.isArray(data.frameUrls)) {
        (data.frameUrls as string[]).forEach((url, index) => {
          assets.push({
            id: `${node.id}-frame-${index}`,
            name: `Frame ${index + 1}`,
            type: "image",
            content: url,
            extension: "webp",
          })
        })
      }
    }
  }

  return assets
}

export function DownloadAssetsPanel({ canvasRef, onClose }: DownloadAssetsPanelProps) {
  const [downloadableAssets, setDownloadableAssets] = useState<DownloadableAsset[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)

  // Extract downloadable assets on mount
  useEffect(() => {
    if (!canvasRef?.current) return

    const nodes = canvasRef.current.getNodes()
    const assets = extractDownloadableAssets(nodes)
    setDownloadableAssets(assets)
    // Select all by default
    setSelectedAssets(new Set(assets.map((a) => a.id)))
  }, [canvasRef])

  // Toggle single asset selection
  const handleToggleAsset = useCallback((assetId: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev)
      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }
      return next
    })
  }, [])

  // Select/deselect all assets
  const handleToggleAll = useCallback(() => {
    if (selectedAssets.size === downloadableAssets.length) {
      setSelectedAssets(new Set())
    } else {
      setSelectedAssets(new Set(downloadableAssets.map((a) => a.id)))
    }
  }, [selectedAssets.size, downloadableAssets])

  // Fetch a single asset with timeout (60s default, generous for large files)
  const fetchAssetWithTimeout = async (
    asset: DownloadableAsset,
    timeoutMs = 60000
  ): Promise<{ asset: DownloadableAsset; blob: Blob } | { asset: DownloadableAsset; error: string }> => {
    // Validate URL format - only allow http(s), data, and blob URLs
    const url = asset.content
    const isValidUrl = 
      url.startsWith("https://") || 
      url.startsWith("http://") || 
      url.startsWith("data:") || 
      url.startsWith("blob:")
    
    if (!isValidUrl) {
      return { asset, error: "Invalid URL format" }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) {
        return { asset, error: `HTTP ${response.status}` }
      }
      const blob = await response.blob()
      return { asset, blob }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { asset, error: message.includes("aborted") ? "Timeout" : message }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Download selected assets as zip
  const handleDownload = useCallback(async () => {
    // Prevent double-clicks / race conditions
    if (isDownloading) return
    
    if (selectedAssets.size === 0) {
      toast.error("No assets selected")
      return
    }

    setIsDownloading(true)
    try {
      const zip = new JSZip()
      const selectedList = downloadableAssets.filter((a) => selectedAssets.has(a.id))
      const failedAssets: string[] = []

      // Track filenames to avoid duplicates
      const usedNames = new Set<string>()
      const getUniqueName = (baseName: string, ext: string): string => {
        let name = `${baseName}.${ext}`
        let counter = 1
        while (usedNames.has(name)) {
          name = `${baseName}-${counter}.${ext}`
          counter++
        }
        usedNames.add(name)
        return name
      }

      // Sanitize filename with fallback for edge cases
      const getSafeName = (asset: DownloadableAsset): string => {
        let safeName = (asset.nodeLabel || asset.name)
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase()
        if (!safeName) {
          safeName = `asset-${asset.id.slice(0, 8)}`
        }
        return safeName
      }

      // Separate code assets (no fetch needed) from media assets
      const codeAssets = selectedList.filter((a) => a.type === "code")
      const mediaAssets = selectedList.filter((a) => a.type !== "code")

      // Add code assets directly
      for (const asset of codeAssets) {
        const filename = getUniqueName(getSafeName(asset), asset.extension)
        zip.file(filename, asset.content)
      }

      // Fetch media assets in parallel batches to avoid memory issues
      const BATCH_SIZE = 5
      for (let i = 0; i < mediaAssets.length; i += BATCH_SIZE) {
        const batch = mediaAssets.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(batch.map((asset) => fetchAssetWithTimeout(asset)))

        for (const result of results) {
          if ("blob" in result) {
            const filename = getUniqueName(getSafeName(result.asset), result.asset.extension)
            zip.file(filename, result.blob)
          } else {
            failedAssets.push(result.asset.name)
            logger.error("Failed to fetch asset", {
              assetId: result.asset.id,
              error: result.error,
            })
          }
        }
      }

      const successCount = selectedList.length - failedAssets.length

      if (successCount === 0) {
        toast.error("All downloads failed")
        return
      }

      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `motif-assets-${new Date().toISOString().split("T")[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      if (failedAssets.length > 0) {
        toast.warning(`Downloaded ${successCount} asset${successCount !== 1 ? "s" : ""}, ${failedAssets.length} failed`)
      } else {
        toast.success(`Downloaded ${successCount} asset${successCount !== 1 ? "s" : ""}`)
      }
      onClose()
    } catch (error) {
      logger.error("Failed to create zip", { error: error instanceof Error ? error.message : String(error) })
      toast.error("Failed to download assets")
    } finally {
      setIsDownloading(false)
    }
  }, [selectedAssets, downloadableAssets, onClose, isDownloading])

  return (
    <div
      className="fixed left-16 top-1/2 -translate-y-1/2 z-40 w-72 max-h-[70vh] rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-xl overflow-hidden"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-medium text-foreground">Download Assets</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Select All control */}
      {downloadableAssets.length > 0 && (
        <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between gap-2">
          <button
            onClick={handleToggleAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {selectedAssets.size === downloadableAssets.length ? (
              <CheckSquare className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {selectedAssets.size === downloadableAssets.length ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-muted-foreground">
            {selectedAssets.size} of {downloadableAssets.length}
          </span>
        </div>
      )}

      {/* Panel Content */}
      <div
        className="overflow-y-auto max-h-[calc(70vh-140px)]"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(0,0,0,0.15) transparent",
        }}
      >
        {downloadableAssets.length > 0 ? (
          <div className="p-2 space-y-1">
            {downloadableAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => handleToggleAsset(asset.id)}
                className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer transition-colors"
              >
                <button
                  className="flex-shrink-0 text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleAsset(asset.id)
                  }}
                >
                  {selectedAssets.has(asset.id) ? (
                    <CheckSquare className="w-4 h-4 text-node-selected" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <div className="flex-shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                  {asset.type === "image" ? (
                    <ImageIcon className="w-3.5 h-3.5" />
                  ) : asset.type === "video" ? (
                    <Video className="w-3.5 h-3.5" />
                  ) : (
                    <FileCode className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">.{asset.extension}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Download className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No assets to download</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Run your workflow to generate outputs</p>
          </div>
        )}
      </div>

      {/* Download Button Footer */}
      {downloadableAssets.length > 0 && (
        <div className="px-3 py-3 border-t border-border/50">
          <button
            onClick={handleDownload}
            disabled={selectedAssets.size === 0 || isDownloading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-node-selected text-white font-medium text-sm hover:bg-node-selected/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download {selectedAssets.size} {selectedAssets.size === 1 ? "asset" : "assets"}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
