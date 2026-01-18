"use client"

import { useEffect, useCallback } from "react"
import { X, Download, ZoomIn, ZoomOut } from "lucide-react"
import { useState } from "react"

interface ImageLightboxProps {
  imageUrl: string
  alt?: string
  onClose: () => void
}

export function ImageLightbox({ imageUrl, alt = "Workflow image", onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Stop propagation to prevent React Flow from handling these keys
      e.stopPropagation()
      
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault()
        setScale((s) => Math.min(s + 0.25, 4))
      } else if (e.key === "-") {
        e.preventDefault()
        setScale((s) => Math.max(s - 0.25, 0.5))
      } else if (e.key === "0") {
        e.preventDefault()
        setScale(1)
        setPosition({ x: 0, y: 0 })
      }
    },
    [onClose]
  )

  useEffect(() => {
    // Use capture phase to intercept events before React Flow handles them
    document.addEventListener("keydown", handleKeyDown, { capture: true })
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true })
      document.body.style.overflow = ""
    }
  }, [handleKeyDown])

  const handleDownload = useCallback(() => {
    const link = document.createElement("a")
    link.href = imageUrl
    link.download = `motif-image-${Date.now()}.png`

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
  }, [imageUrl])

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 4))
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5))
  const handleReset = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((s) => Math.max(0.5, Math.min(4, s + delta)))
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1 bg-black/50 rounded-lg p-1 backdrop-blur-sm">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleZoomOut()
            }}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Zoom out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleReset()
            }}
            className="px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors min-w-[3rem]"
            title="Reset zoom (0)"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleZoomIn()
            }}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Zoom in (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDownload()
          }}
          className="p-2 text-white/70 hover:text-white bg-black/50 hover:bg-white/10 rounded-lg backdrop-blur-sm transition-colors"
          title="Download image"
        >
          <Download className="w-5 h-5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="p-2 text-white/70 hover:text-white bg-black/50 hover:bg-white/10 rounded-lg backdrop-blur-sm transition-colors"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-white/40">
        <span>Scroll to zoom</span>
        <span>•</span>
        <span>Drag to pan when zoomed</span>
        <span>•</span>
        <span>Esc to close</span>
      </div>

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl transition-transform duration-100"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          }}
          onMouseDown={handleMouseDown}
          draggable={false}
        />
      </div>
    </div>
  )
}
