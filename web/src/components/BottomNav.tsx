import React, { useEffect, useState } from 'react'
import { InstallButton } from './InstallButton'
import { LegalModal } from './LegalModal'

export const BottomNav: React.FC = () => {
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  // Change functionality: initiate direct phone call instead of WhatsApp
  const wa = 'tel:+18083010534'
  useEffect(() => {
    const handler = (e: any) => {
      const t = e?.detail
      if (t === 'privacy') setPrivacyOpen(true)
      if (t === 'terms') setTermsOpen(true)
    }
    window.addEventListener('open-legal', handler as any)
    return () => window.removeEventListener('open-legal', handler as any)
  }, [])
  return (
    <nav className="bottom-nav">
      <div className="footer-left">
        <a className="nav-btn" aria-label="Home" href="#/">
          <span className="home-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </span>
        </a>
      </div>
      <div className="footer-center">
        <span className="version">V13.1.0</span>
      </div>
      <div className="footer-right">
        <InstallButton />
        <a
          className="nav-btn"
          aria-label="WhatsApp Support"
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="whatsapp-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.54 3.65 4.75 6.19 6.19l2.2-2.2a1 1 0 0 1 .95-.26c1.14.34 2.34.53 3.57.53a1 1 0 0 1 1 1v3.34a1 1 0 0 1-1 1A19 19 0 0 1 5 5a1 1 0 0 1 1-1h3.34a1 1 0 0 1 1 1c0 1.23.19 2.43.53 3.57a1 1 0 0 1-.26.95l-2.2 2.2z" />
            </svg>
          </span>
        </a>
        <button className="nav-btn footer-link" aria-label="Privacy Policy" onClick={()=>setPrivacyOpen(true)}>Privacy</button>
        <button className="nav-btn footer-link" aria-label="Terms of Service" onClick={()=>setTermsOpen(true)}>Terms</button>
      </div>
      <LegalModal open={privacyOpen} onClose={()=>setPrivacyOpen(false)} type="privacy" />
      <LegalModal open={termsOpen} onClose={()=>setTermsOpen(false)} type="terms" />
    </nav>
  )
}