'use client'

import { useState, useCallback } from 'react'
import Header from '@/components/header'
import ASCIIBannerStrip from '@/components/layout/ASCIIBannerStrip'

const STORAGE_KEY = 'glomalin-banner-disabled'

interface BannerSectionProps {
  user: {
    email: string
    fullName: string | null
    role: string
  }
}

function readPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export default function BannerSection({ user }: BannerSectionProps) {
  const [bannerDisabled, setBannerDisabled] = useState<boolean>(readPreference)

  const toggleBanner = useCallback(() => {
    setBannerDisabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false')
      } catch {
        // localStorage unavailable (private browsing, quota exceeded)
      }
      return next
    })
  }, [])

  return (
    <>
      <Header
        user={user}
        bannerDisabled={bannerDisabled}
        onBannerToggle={toggleBanner}
      />
      {!bannerDisabled && (
        <>
          {/* 72px desktop / 48px mobile */}
          <div className="hidden md:block">
            <ASCIIBannerStrip height={72} />
          </div>
          <div className="block md:hidden">
            <ASCIIBannerStrip height={48} nodeCount={6} />
          </div>
        </>
      )}
    </>
  )
}
