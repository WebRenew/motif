"use client"

import type { ReactNode } from "react"
import { AuthProvider, useAuth } from "@/lib/context/auth-context"
import { AuthModal } from "@/components/auth-modal"
import { CommandPaletteProvider } from "@/components/command-palette"
import { VisualSettingsProvider } from "@/lib/hooks/use-visual-settings"

function AuthModalWrapper() {
  const { showAuthModal } = useAuth()
  return <AuthModal isOpen={showAuthModal} />
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <VisualSettingsProvider>
        <CommandPaletteProvider>
          {children}
          <AuthModalWrapper />
        </CommandPaletteProvider>
      </VisualSettingsProvider>
    </AuthProvider>
  )
}
