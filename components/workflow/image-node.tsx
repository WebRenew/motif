"use client"

import { useCallback, useState } from "react"
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { Upload, Loader2, RefreshCw, Download, ImageIcon, Sparkles, Maximize2 } from "lucide-react"
import { toast } from "sonner"
import { ImageLightbox } from "./image-lightbox"

export type ImageNodeData = {
  imageUrl: string
  aspect?: "square" | "portrait" | "landscape"
  isInput?: boolean
  isGenerating?: boolean
}

export function ImageNode({ id, data, selected }: NodeProps) {
  const { imageUrl, aspect = "square", isInput = false, isGenerating = false } = data as ImageNodeData
  const { setNodes } = useReactFlow()
  const [showLightbox, setShowLightbox] = useState(false)

  const getDimensions = () => {
    switch (aspect) {
      case "portrait":
        return "w-[280px] h-[380px]"
      case "landscape":
        return "w-[420px] h-[280px]"
      default:
        return "w-[280px] h-[280px]"
    }
  }

  const handleUpload = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type", {
          description: "Please upload an image file (PNG, JPG, GIF, WebP, or SVG)",
        })
        return
      }

      // Validate file size (max 10MB)
      const maxSizeInBytes = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSizeInBytes) {
        toast.error("File too large", {
          description: `Image size must be less than 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        })
        return
      }

      const reader = new FileReader()

      reader.onerror = () => {
        toast.error("Failed to read file", {
          description: "There was an error reading the image file. Please try again.",
        })
      }

      reader.onload = (event) => {
        const result = event.target?.result as string

        // Additional validation: ensure result is a valid data URL
        if (!result || !result.startsWith("data:image/")) {
          toast.error("Invalid image", {
            description: "The uploaded file is not a valid image.",
          })
          return
        }

        // Optional: Validate image dimensions
        const img = new Image()
        img.onload = () => {
          // Warn if image is very large
          if (img.width > 4096 || img.height > 4096) {
            toast.warning("Large image detected", {
              description: `Image is ${img.width}x${img.height}px. Large images may affect performance.`,
            })
          }

          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === id ? { ...node, data: { ...node.data, imageUrl: result } } : node,
            ),
          )

          toast.success("Image uploaded", {
            description: `${file.name} (${(file.size / 1024).toFixed(0)}KB)`,
          })
        }

        img.onerror = () => {
          toast.error("Invalid image", {
            description: "The uploaded file could not be loaded as an image.",
          })
        }

        img.src = result
      }

      reader.readAsDataURL(file)
    }
    input.click()
  }, [id, setNodes])

  const handleDownload = useCallback(() => {
    if (!imageUrl) return

    const link = document.createElement("a")
    link.href = imageUrl
    link.download = `motif-image-${id}-${Date.now()}.png`

    if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
      link.click()
    } else {
      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          link.href = url
          link.click()
          URL.revokeObjectURL(url)
        })
        .catch(() => {
          window.open(imageUrl, "_blank")
        })
    }
  }, [imageUrl, id])

  return (
    <div
      className={`bg-card rounded-2xl p-3 shadow-md transition-all ${getDimensions()} ${selected ? "ring-2 ring-node-selected" : ""} group`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-node-handle !border-none" />
      <div className="w-full h-full rounded-xl overflow-hidden bg-muted relative">
        {isGenerating ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted to-muted/50">
            <div className="relative">
              <div className="absolute inset-0 animate-ping">
                <Sparkles className="w-8 h-8 text-primary/30" />
              </div>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <span className="text-xs font-medium text-muted-foreground animate-pulse">Generating...</span>
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          </div>
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl || "/placeholder.svg"}
              alt="Workflow image"
              className={`w-full h-full ${aspect === "landscape" ? "object-contain" : "object-cover"} cursor-pointer`}
              onClick={() => setShowLightbox(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center gap-4 bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLightbox(true)
                }}
                className="flex flex-col items-center gap-1 text-primary-foreground hover:scale-110 transition-transform cursor-pointer pointer-events-auto"
              >
                <Maximize2 className="w-5 h-5" />
                <span className="text-xs font-medium">Expand</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleUpload()
                }}
                className="flex flex-col items-center gap-1 text-primary-foreground hover:scale-110 transition-transform cursor-pointer pointer-events-auto"
              >
                <RefreshCw className="w-5 h-5" />
                <span className="text-xs font-medium">Replace</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload()
                }}
                className="flex flex-col items-center gap-1 text-primary-foreground hover:scale-110 transition-transform cursor-pointer pointer-events-auto"
              >
                <Download className="w-5 h-5" />
                <span className="text-xs font-medium">Download</span>
              </button>
            </div>
          </>
        ) : isInput ? (
          <button
            onClick={handleUpload}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Upload className="w-8 h-8" />
            <span className="text-xs font-medium">Upload Image</span>
          </button>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/20 rounded-lg">
            <div className="p-3 rounded-full bg-muted-foreground/5">
              <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <span className="text-xs text-muted-foreground/40 font-medium">Output</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-node-handle !border-none" />

      {/* Lightbox for full-size image viewing */}
      {showLightbox && imageUrl && (
        <ImageLightbox
          imageUrl={imageUrl}
          alt="Workflow image"
          onClose={() => setShowLightbox(false)}
        />
      )}
    </div>
  )
}
