"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { initializeUser } from "@/lib/supabase/workflows"
import { createWorkflow } from "@/lib/supabase/workflows"
import { MotifLogo } from "@/components/motif-logo"

export default function Home() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Prevent double-initialization in React 18 Strict Mode
    if (hasInitialized.current) return
    hasInitialized.current = true

    async function createAndRedirect() {
      try {
        // Initialize user
        const userId = await initializeUser()

        if (!userId) {
          setError("Could not authenticate. Please refresh to try again.")
          return
        }

        // Create new workflow
        const workflowId = await createWorkflow(userId, "My Workflow")

        if (!workflowId) {
          setError("Could not create workflow. Please refresh to try again.")
          return
        }

        // Redirect to the new workflow
        router.push(`/w/${workflowId}`)
      } catch (err) {
        console.error("[Home] Failed to create workflow:", err)
        setError("An error occurred. Please refresh to try again.")
      }
    }

    createAndRedirect()
  }, [router])

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
      <div className="absolute inset-0 bg-grid-plus" />

      <main className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute top-4 left-[20px]">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 -m-4 rounded-full bg-glow/40 blur-xl" />
            <div
              className="relative flex flex-shrink-0 items-center gap-2 border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-primary-foreground backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg"
              style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <MotifLogo width={45} height={16} />
            </div>
          </div>
        </div>

        {error ? (
          <div className="text-center">
            <p className="text-lg text-destructive mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Creating new workflow...</p>
          </div>
        )}
      </main>
    </div>
  )
}
