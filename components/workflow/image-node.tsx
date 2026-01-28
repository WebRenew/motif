"use client"

import { useCallback, useState, memo } from "react"
import { createPortal } from "react-dom"
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { Upload, Loader2, RefreshCw, Download, ImageIcon, Sparkles, Maximize2 } from "lucide-react"
import { toast } from "sonner"
import { ImageLightbox } from "./image-lightbox"
import { useVisualSettings } from "@/lib/hooks/use-visual-settings"

export type ImageNodeData = {
  imageUrl: string
  aspect?: "square" | "portrait" | "landscape"
  isInput?: boolean
  isGenerating?: boolean
  sequenceNumber?: number
}

export const ImageNode = memo(function ImageNode({ id, data, selected }: NodeProps) {
  const { imageUrl, aspect = "square", isInput = false, isGenerating = false, sequenceNumber } = data as ImageNodeData
  const { setNodes } = useReactFlow()
  const [showLightbox, setShowLightbox] = useState(false)
  const { settings } = useVisualSettings()
  
  // Brightness-adaptive styling
  const brightness = settings.backgroundBrightness
  const isLightMode = brightness > 50
  const bgOpacity = brightness / 100

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
          // Delay revoke to ensure browser has started the download
          // The click() triggers async browser behavior; immediate revoke may fail
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        })
        .catch(() => {
          window.open(imageUrl, "_blank")
        })
    }
  }, [imageUrl, id])

  return (
    <div
      className={`rounded-2xl p-3 shadow-md transition-all ${getDimensions()} ${selected ? "ring-2 ring-node-selected" : ""} group`}
      style={{ 
        backgroundColor: `rgba(255, 255, 255, ${bgOpacity})`,
        borderColor: isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-node-handle !border-2"
        style={{ borderColor: isLightMode ? 'rgba(255, 255, 255, 0.9)' : 'var(--card)' }}
      />
      {sequenceNumber !== undefined && (
        <div 
          className="absolute top-1 left-1 z-10 flex items-center justify-center w-6 h-6 rounded-full backdrop-blur-sm shadow-lg"
          style={{ 
            backgroundColor: isLightMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(23, 23, 26, 0.95)',
            borderColor: isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          <span className="text-[11px] font-semibold text-white">{sequenceNumber}</span>
        </div>
      )}
      <div 
        className="w-full h-full rounded-xl overflow-hidden relative"
        style={{ backgroundColor: isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'var(--muted)' }}
      >
        {isGenerating ? (
          <div 
            className="w-full h-full flex flex-col items-center justify-center gap-3"
            style={{ 
              background: isLightMode 
                ? 'linear-gradient(to bottom right, rgba(0,0,0,0.03), rgba(0,0,0,0.06))' 
                : 'linear-gradient(to bottom right, var(--muted), rgba(var(--muted), 0.5))'
            }}
          >
            <div className="relative">
              <div className="absolute inset-0 animate-ping">
                <Sparkles className="w-8 h-8 text-primary/30" />
              </div>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <span 
              className="text-xs font-medium animate-pulse"
              style={{ color: isLightMode ? 'rgba(0, 0, 0, 0.5)' : 'var(--muted-foreground)' }}
            >Generating...</span>
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
            className="w-full h-full flex flex-col items-center justify-center gap-2 transition-colors"
            style={{ 
              color: isLightMode ? 'rgba(0, 0, 0, 0.5)' : 'var(--muted-foreground)',
            }}
          >
            <Upload className="w-8 h-8" />
            <span className="text-xs font-medium">Upload Image</span>
          </button>
        ) : (
          <div 
            className="w-full h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg"
            style={{ borderColor: isLightMode ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.1)' }}
          >
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: isLightMode ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)' }}
            >
              <ImageIcon 
                className="w-8 h-8" 
                style={{ color: isLightMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)' }}
              />
            </div>
            <span 
              className="text-xs font-medium"
              style={{ color: isLightMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)' }}
            >Output</span>
          </div>
        )}
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-node-handle !border-2"
        style={{ borderColor: isLightMode ? 'rgba(255, 255, 255, 0.9)' : 'var(--card)' }}
      />

      {/* Lightbox for full-size image viewing - rendered via portal to escape card constraints */}
      {showLightbox && imageUrl && typeof document !== "undefined" &&
        createPortal(
          <ImageLightbox
            imageUrl={imageUrl}
            alt="Workflow image"
            onClose={() => setShowLightbox(false)}
          />,
          document.body
        )
      }
    </div>
  )
})
