'use client'

import { useState, useEffect } from 'react'
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

export default function BannerSection({ user }: BannerSectionProps) {
  const [bannerDisabled, setBannerDisabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  // Sync to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, bannerDisabled ? 'true' : 'false')
  }, [bannerDisabled])

  const toggleBanner = () => {
    setBannerDisabled((prev) => !prev)
  }

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
