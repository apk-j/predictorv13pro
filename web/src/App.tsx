import { useEffect, useState } from 'react'
import './index.css'
import { SiteCard } from './components/SiteCard'
import { BottomNav } from './components/BottomNav'
import { Toast } from './components/Toast'
import { LoginModal } from './components/LoginModal'
import { PaywallModal } from './components/PaywallModal'
import { PredictionsPage } from './components/PredictionsPage'
import { useAuth } from './state/AuthContext'
import { getSites, connect } from './lib/api'
import type { ApiSite } from './lib/api'
import { SITES as STATIC_SITES } from './data/sites'

function App() {
  const [selected, setSelected] = useState<string>('sports-aviator')
  const { token, logout } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [screen, setScreen] = useState<'home'|'predictions'>(() => {
    const h = window.location.hash
    if (h === '#/predictions') return 'predictions'
    if (h === '#/' || h === '' || !h) {
      const s = localStorage.getItem('screen')
      return (s === 'predictions' || s === 'home') ? (s as 'home'|'predictions') : 'home'
    }
    return 'home'
  })
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState<string>('Login Successful')
  const [sites, setSites] = useState<ApiSite[]>([])
  const [deferredSiteId, setDeferredSiteId] = useState<string | null>(null)
  const [connectedId, setConnectedId] = useState<string | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.catch(() => {})
    }
    getSites()
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setSites(rows)
        } else {
          // Fallback to static sites if API returns empty
          const fallback: ApiSite[] = STATIC_SITES.map(s => ({ id: s.id, name: s.name, active: 1, dark: s.dark ? 1 : 0 }))
          setSites(fallback)
        }
      })
      .catch((err) => {
        console.warn(err)
        // Fallback to static sites on error
        const fallback: ApiSite[] = STATIC_SITES.map(s => ({ id: s.id, name: s.name, active: 1, dark: s.dark ? 1 : 0 }))
        setSites(fallback)
      })
  }, [])

  // Initialize connected siteId from storage and keep in sync
  useEffect(() => {
    try {
      const id = localStorage.getItem('connected.siteId')
      setConnectedId(id || null)
    } catch {}
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'connected.siteId') {
        try {
          const id = localStorage.getItem('connected.siteId')
          setConnectedId(id || null)
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (token && deferredSiteId) {
      // Attempt to connect; if payment required, open paywall
      connect(token, deferredSiteId)
        .then(res => {
          setToastMsg(`Connected to ${res.site}`)
          setToastVisible(true)
          setTimeout(()=>setToastVisible(false), 2500)
          try { localStorage.setItem('connected.site', res.site) } catch {}
          try { localStorage.setItem('connected.siteId', deferredSiteId) } catch {}
          setConnectedId(deferredSiteId)
          setScreen('predictions')
          setDeferredSiteId(null)
        })
        .catch((e:any) => {
          if (String(e?.message).toLowerCase().includes('payment required')) {
            setPayOpen(true)
          } else {
            setToastMsg(e.message || 'Failed to connect')
            setToastVisible(true)
            setTimeout(()=>setToastVisible(false), 2500)
          }
        })
    }
  }, [token, deferredSiteId])

  useEffect(() => {
    try { localStorage.setItem('screen', screen) } catch {}
    // keep hash in sync so browser back works
    const targetHash = screen === 'predictions' ? '#/predictions' : '#/'
    if (window.location.hash !== targetHash) {
      // change hash without causing full reload
      window.location.hash = targetHash
    }
  }, [screen])

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash
      const nextScreen = (h === '#/predictions') ? 'predictions' : 'home'
      setScreen(nextScreen)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const tryConnect = async (siteId: string) => {
    setDeferredSiteId(siteId)
    if (!token) { setLoginOpen(true); return }
    // Attempt to connect; if payment is required, open the paywall
    connect(token, siteId)
      .then(res => {
        setToastMsg(`Connected to ${res.site}`)
        setToastVisible(true)
        setTimeout(()=>setToastVisible(false), 2500)
        try { localStorage.setItem('connected.site', res.site) } catch {}
        try { localStorage.setItem('connected.siteId', siteId) } catch {}
        setConnectedId(siteId)
        setScreen('predictions')
        setDeferredSiteId(null)
      })
      .catch((e:any) => {
        if (String(e?.message).toLowerCase().includes('payment required')) {
          setPayOpen(true)
        } else {
          setToastMsg(e.message || 'Failed to connect')
          setToastVisible(true)
          setTimeout(()=>setToastVisible(false), 2500)
        }
      })
  }

  return (
    <div className="screen">
      <Toast message={toastMsg} visible={toastVisible} />

      <header className="header">
        <div className="header-bar">
          <div className="brand">Aviator Predictor V13 Pro</div>
          <div className="header-actions">
            {token && (
              <button className="btn header-logout" onClick={logout}>Logout</button>
            )}
          </div>
        </div>
      </header>

      <main className="content">
        {screen === 'home' && (
          <>
            {(() => {
              const hero = import.meta.env.DEV ? '/bettingsites/AVATAR.jpeg' : '/assets/bettingsites/AVATAR.jpeg'
              return <img src={hero} alt="Aviator banner" className="hero-img" />
            })()}
            <h2 className="title">CHOOSE YOUR FAVORITE CASINO<br/>PLATFORM TO PROCEED</h2>
            <section className="grid">
              {sites.map((s) => (
                <SiteCard
                  key={s.id}
                  site={{ id: s.id, name: s.name, dark: !!s.dark, label: connectedId===s.id ? 'Active' : undefined }}
                  selected={selected === s.id}
                  onClick={() => { setSelected(s.id); tryConnect(s.id) }}
                />
              ))}
            </section>
          </>
        )}
        {screen === 'predictions' && (
          <PredictionsPage />
        )}
      </main>

      <BottomNav />
      <LoginModal
        open={loginOpen}
        onClose={()=>setLoginOpen(false)}
        onSuccess={()=>{
          setToastMsg('Login Successful')
          setToastVisible(true)
          setTimeout(()=>setToastVisible(false), 2500)
          // If a site was selected, attempt to connect; open paywall if needed
          if (deferredSiteId && token) {
            connect(token, deferredSiteId)
              .then(res => {
                setToastMsg(`Connected to ${res.site}`)
                setToastVisible(true)
                setTimeout(()=>setToastVisible(false), 2500)
                try { localStorage.setItem('connected.site', res.site) } catch {}
                try { localStorage.setItem('connected.siteId', deferredSiteId) } catch {}
                setConnectedId(deferredSiteId)
                setScreen('predictions')
                setDeferredSiteId(null)
              })
              .catch((e:any) => {
                if (String(e?.message).toLowerCase().includes('payment required')) {
                  setPayOpen(true)
                } else {
                  setToastMsg(e.message || 'Failed to connect')
                  setToastVisible(true)
                  setTimeout(()=>setToastVisible(false), 2500)
                }
              })
          }
        }}
      />
      <PaywallModal
        open={payOpen}
        siteId={deferredSiteId ?? undefined}
        onClose={()=>setPayOpen(false)}
        onSuccess={()=>{
          // After successful payment, connect to the deferred site if any
          if (token && deferredSiteId) {
            connect(token, deferredSiteId)
              .then(res => {
                setToastMsg(`Connected to ${res.site}`)
                setToastVisible(true)
                setTimeout(()=>setToastVisible(false), 2500)
                try { localStorage.setItem('connected.site', res.site) } catch {}
                try { localStorage.setItem('connected.siteId', deferredSiteId) } catch {}
                setConnectedId(deferredSiteId)
                setScreen('predictions')
                setDeferredSiteId(null)
              })
              .catch((e:any) => {
                if (String(e?.message).toLowerCase().includes('payment required')) {
                  setPayOpen(true)
                } else {
                  setToastMsg(e.message || 'Failed to connect')
                  setToastVisible(true)
                  setTimeout(()=>setToastVisible(false), 2500)
                }
              })
          }
        }}
      />
    </div>
  )
}

export default App
