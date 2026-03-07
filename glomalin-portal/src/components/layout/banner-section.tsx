'use client'

import { useState, useCallback } from 'react'
import Header from '@/components/header'
import ASCIIBannerStrip from '@/components/layout/ASCIIBannerStrip'
import { type SceneType, nextScene } from '@/components/layout/scene-types'

const STORAGE_KEY = 'glomalin-banner-disabled'
const SCENE_KEY = 'glomalin-scene'

const VALID_SCENES: SceneType[] = ['mycelium', 'drone', 'seasonal']

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

function readScenePreference(): SceneType {
  if (typeof window === 'undefined') return 'mycelium'
  try {
    const stored = localStorage.getItem(SCENE_KEY)
    if (stored && VALID_SCENES.includes(stored as SceneType)) {
      return stored as SceneType
    }
    return 'mycelium'
  } catch {
    return 'mycelium'
  }
}

export default function BannerSection({ user }: BannerSectionProps) {
  const [bannerDisabled, setBannerDisabled] = useState<boolean>(readPreference)
  const [scene, setScene] = useState<SceneType>(readScenePreference)

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

  const handleNodeClick = useCallback(() => {
    setScene((current) => {
      const next = nextScene(current)
      try {
        localStorage.setItem(SCENE_KEY, next)
      } catch {
        // localStorage unavailable
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
            <ASCIIBannerStrip height={72} scene={scene} onNodeClick={handleNodeClick} />
          </div>
          <div className="block md:hidden">
            <ASCIIBannerStrip height={48} nodeCount={6} scene={scene} onNodeClick={handleNodeClick} />
          </div>
        </>
      )}
    </>
  )
}
