import React, { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export const InstallButton: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    try {
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setDeferred(null)
    } catch {}
  }

  if (installed || !deferred) return null

  return (
    <button className="nav-btn" aria-label="Install App" onClick={install} title="Install App">
      <span className="install-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 20h14v-2H5v2zm7-18v10.17l3.59-3.58L17 10l-5 5-5-5 1.41-1.41L11 12.17V2h1z" />
        </svg>
      </span>
    </button>
  )
}