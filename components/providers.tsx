"use client"

import type { ReactNode } from "react"
import { AuthProvider, useAuth } from "@/lib/context/auth-context"
import { AuthModal } from "@/components/auth-modal"

function AuthModalWrapper() {
  const { showAuthModal } = useAuth()
  return <AuthModal isOpen={showAuthModal} />
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthModalWrapper />
    </AuthProvider>
  )
}
