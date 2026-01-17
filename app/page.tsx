"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { WorkflowCanvas, type WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"
import { ToolsMenu } from "@/components/tools-menu"
import { MotifLogo } from "@/components/motif-logo"
import { Loader2 } from "lucide-react"

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [gridOpacity, setGridOpacity] = useState(1)
  const [initialZoom, setInitialZoom] = useState<number | null>(null)
  const canvasRef = useRef<WorkflowCanvasHandle>(null)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  const handleZoomChange = useCallback(
    (zoom: number) => {
      if (initialZoom === null) {
        setInitialZoom(zoom)
        return
      }

      const zoomRatio = zoom / initialZoom

      if (zoomRatio > 1) {
        const opacity = Math.max(0, 1 - (zoomRatio - 1) * 2)
        setGridOpacity(opacity)
      } else {
        const targetOpacity = Math.min(1, 1 - (1 - zoomRatio) * 0.5)
        setGridOpacity(targetOpacity)
      }
    },
    [initialZoom],
  )

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
      <div className="absolute inset-0 bg-grid-plus transition-opacity duration-150" style={{ opacity: gridOpacity }} />

      <main className="relative w-full h-screen overflow-hidden">
        <div className="absolute top-4 left-[20px] right-4 z-10 flex items-center justify-between">
          {/* Logo pill */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 -m-4 rounded-full bg-glow/40 blur-xl" />
            <div
              className="relative flex flex-shrink-0 items-center gap-2 border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-primary-foreground backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg"
              style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <MotifLogo width={45} height={16} />
            </div>
          </div>

          <ToolsMenu />
        </div>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        )}

        <div className={`w-full h-full transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}>
          <WorkflowCanvas ref={canvasRef} onZoomChange={handleZoomChange} />
        </div>
      </main>
    </div>
  )
}
