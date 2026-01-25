"use client"

import type { ReactNode } from "react"
import { AuthProvider, useAuth } from "@/lib/context/auth-context"
import { AuthModal } from "@/components/auth-modal"
import { CommandPaletteProvider } from "@/components/command-palette"

function AuthModalWrapper() {
  const { showAuthModal } = useAuth()
  return <AuthModal isOpen={showAuthModal} />
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CommandPaletteProvider>
        {children}
        <AuthModalWrapper />
      </CommandPaletteProvider>
    </AuthProvider>
  )
}
