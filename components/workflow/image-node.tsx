"use client"

import { useCallback } from "react"
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { Upload, Loader2, RefreshCw, Download, ImageIcon, Sparkles } from "lucide-react"

export type ImageNodeData = {
  imageUrl: string
  aspect?: "square" | "portrait" | "landscape"
  isInput?: boolean
  isGenerating?: boolean
}

export function ImageNode({ id, data, selected }: NodeProps) {
  const { imageUrl, aspect = "square", isInput = false, isGenerating = false } = data as ImageNodeData
  const { setNodes } = useReactFlow()

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
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === id ? { ...node, data: { ...node.data, imageUrl: event.target?.result as string } } : node,
            ),
          )
        }
        reader.readAsDataURL(file)
      }
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
              className={`w-full h-full ${aspect === "landscape" ? "object-contain" : "object-cover"}`}
            />
            <div className="absolute inset-0 flex items-center justify-center gap-4 bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleUpload}
                className="flex flex-col items-center gap-1 text-primary-foreground hover:scale-110 transition-transform cursor-pointer"
              >
                <RefreshCw className="w-5 h-5" />
                <span className="text-xs font-medium">Replace</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex flex-col items-center gap-1 text-primary-foreground hover:scale-110 transition-transform cursor-pointer"
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
    </div>
  )
}
