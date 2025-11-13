import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getPaypalConfig, createPaypalOrder, capturePaypalOrder, cancelPayments, grantSiteAccess } from '../lib/api'
import { useAuth } from '../state/AuthContext'

export const PaywallModal: React.FC<{ open: boolean; siteId?: string; onClose: () => void; onSuccess: () => void }>
 = ({ open, siteId, onClose, onSuccess }) => {
  const { token } = useAuth()
const [, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState<'paybill'|'paypal'|'crypto'>('paybill')
const [, setPhone] = useState('')
  const amount = useMemo(()=> Number(import.meta.env.VITE_SUBSCRIPTION_AMOUNT || 500), [])
  const cryptoUsdAmount = useMemo(()=> Number(import.meta.env.VITE_CRYPTO_USD_AMOUNT || 10.11), [])
  const paybillShortcode = import.meta.env.VITE_PAYBILL_SHORTCODE || '123456'
  const paybillAccount = import.meta.env.VITE_PAYBILL_ACCOUNT || 'AVIATOR'
  const paypalLink = import.meta.env.VITE_PAYPAL_LINK || ''
  const paypalContainerRef = useRef<HTMLDivElement | null>(null)
  const [paypalReady, setPaypalReady] = useState(false)
  const [approveUrl, setApproveUrl] = useState('')
  // Cancel flag to stop background loops while modal is closing
  const cancellingRef = useRef(false)
  // Live market conversion for Crypto tab
  const [cryptoRates, setCryptoRates] = useState<{ btcUsd: number; usdtUsd: number; ethUsd: number } | null>(null)
  const [cryptoLoading, setCryptoLoading] = useState(false)
  // Crypto confirmation countdown
  const [cryptoCountdownEnd, setCryptoCountdownEnd] = useState<number | null>(null)
  const [cryptoRemaining, setCryptoRemaining] = useState(0)
  const [copied, setCopied] = useState(false)
  const [paybillTxId, setPaybillTxId] = useState('')
  const [showErrorToast, setShowErrorToast] = useState(false)
  // Clear Paybill error when user edits transaction ID
  useEffect(() => { if (method === 'paybill') setError('') }, [paybillTxId])

  // Pop up error toast for Paybill confirm error
  useEffect(() => {
    if (error === 'incorrect transaction ID, Please retry!') {
      setShowErrorToast(true)
      const id = setTimeout(() => setShowErrorToast(false), 2000)
      return () => clearTimeout(id)
    }
    setShowErrorToast(false)
  }, [error])

  // Clear PayPal errors when switching to PayPal tab
  useEffect(() => {
    if (method === 'paypal') setError('')
  }, [method])

  // Auto-dismiss PayPal errors after a short delay (8s)
  useEffect(() => {
    if (method !== 'paypal' || !error) return
    const isPaypalError = /paypal/i.test(error)
    if (!isPaypalError) return
    const id = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(id)
  }, [error, method])

  // Load PayPal JS SDK and render buttons when tab is active
  useEffect(() => {
    // Keep hook call order consistent across renders; guard inside effect
    if (method !== 'paypal' || !open) return
    let cancelled = false
    const run = async () => {
      try {
        const config = await getPaypalConfig()
        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || config.clientId
        const currency = config.currency || 'USD'
        const env = (config.env || 'sandbox').toLowerCase()
        if (!clientId) { setError('PayPal is not configured (missing clientId)'); return }
        // If SDK already present, skip loading
        const hasSdk = typeof (window as any).paypal !== 'undefined'
        if (!hasSdk) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            // PayPal SDK expects lowercase 'capture' for intent
            script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&components=buttons&intent=capture`
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load PayPal SDK'))
            document.head.appendChild(script)
          })
        }
        if (cancelled) return
        setPaypalReady(true)
        // Render buttons
        const paypal = (window as any).paypal
        if (paypal && paypalContainerRef.current) {
          paypal.Buttons({
            onClick: () => {
              // Clear any previous PayPal error when user retries
              setError('')
            },
            createOrder: async () => {
              // Reset error state at the start of a new attempt
              setError('')
              if (!token) throw new Error('Login required')
              const order = await createPaypalOrder(token)
              // Save approve URL for full-page fallback
              const fallbackApprove = `${env === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com'}/checkoutnow?token=${order.id}`
              setApproveUrl(order.approveUrl || fallbackApprove)
              return order.id
            },
            onApprove: async (data: any) => {
              try {
                if (!token) throw new Error('Login required')
                await capturePaypalOrder(token, data.orderID)
                // Grant per-site access after successful capture
                if (siteId) {
                  try { await grantSiteAccess(token, siteId, 'paypal') } catch (e: any) { setError(e.message || 'Access grant failed') }
                }
                onSuccess(); onClose()
              } catch (e: any) {
                setError(e.message || 'PayPal capture failed')
              }
            },
            onError: (err: any) => {
              const msg = String(err?.message || 'Unknown')
              // Guidance for sandbox iframe login issues
              const hint = /refused to connect|frame|x-frame-options/i.test(msg)
                ? ' · If sandbox login is blocked, click “Open PayPal”.'
                : ''
              setError('PayPal error: ' + msg + hint)
            }
          }).render(paypalContainerRef.current)
        }
      } catch (e: any) {
        setError(e.message || 'Failed to initialize PayPal')
      }
    }
    run()
    return () => { cancelled = true }
  }, [method, open, token])
  const btc = import.meta.env.VITE_CRYPTO_BTC_ADDRESS || 'bc1qexamplebtcaddress'
  const usdtTron = import.meta.env.VITE_CRYPTO_USDT_TRON || 'TRONexampleaddress'
  const usdtEth = import.meta.env.VITE_CRYPTO_USDT_ETH || '0xexampleethaddress'
  const ethAddress = import.meta.env.VITE_CRYPTO_ETH_ADDRESS || '0xexampleethaddress'
  const openApprove = () => { if (approveUrl) window.open(approveUrl, '_blank', 'noopener') }
  // Fetch live KES rates for BTC, USDT, ETH when Crypto tab opens
  useEffect(() => {
    if (method !== 'crypto' || !open) return
    let cancelled = false
    const controller = new AbortController()
    const timeoutMs = 7000
    let timeoutId: any
    const run = async () => {
      setCryptoLoading(true)
      try {
        // Add timeout + abort to avoid hanging in installed app windows
        timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether,ethereum&vs_currencies=usd',
          { signal: controller.signal, cache: 'no-store', mode: 'cors' }
        )
        const data = await res.json()
        if (cancelled) return
        const btcUsd = data?.bitcoin?.usd
        const usdtUsd = data?.tether?.usd
        const ethUsd = data?.ethereum?.usd
        if ([btcUsd, usdtUsd, ethUsd].some(v => typeof v !== 'number')) throw new Error('Rate fetch failed')
        setCryptoRates({ btcUsd, usdtUsd, ethUsd })
      } catch (e: any) {
        setCryptoRates(null)
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        if (!cancelled) setCryptoLoading(false)
      }
    }
    run()
    return () => { cancelled = true; try { if (timeoutId) clearTimeout(timeoutId); controller.abort() } catch {}
    }
  }, [method, open])
  const btcAmount = useMemo(() => cryptoRates ? cryptoUsdAmount / cryptoRates.btcUsd : null, [cryptoUsdAmount, cryptoRates])
  const usdtAmount = useMemo(() => cryptoRates ? cryptoUsdAmount / cryptoRates.usdtUsd : null, [cryptoUsdAmount, cryptoRates])
  const ethAmount = useMemo(() => cryptoRates ? cryptoUsdAmount / cryptoRates.ethUsd : null, [cryptoUsdAmount, cryptoRates])
  const formatCryptoAmount = (value: number | null, symbol: 'BTC'|'USDT'|'ETH') => {
    if (value == null) return '—'
    const v = value
    if (symbol === 'BTC') {
      return `${v < 0.0001 ? v.toFixed(8) : v.toFixed(6)} BTC`
    }
    if (symbol === 'ETH') {
      return `${v < 0.001 ? v.toFixed(6) : v.toFixed(5)} ETH`
    }
    return `${v.toFixed(2)} USDT`
  }
  // Copy-only numeric amount (no symbol)
  const formatCryptoAmountNumber = (value: number | null, symbol: 'BTC'|'USDT'|'ETH') => {
    if (value == null) return ''
    const v = value
    if (symbol === 'BTC') {
      return v < 0.0001 ? v.toFixed(8) : v.toFixed(6)
    }
    if (symbol === 'ETH') {
      return v < 0.001 ? v.toFixed(6) : v.toFixed(5)
    }
    return v.toFixed(2)
  }
  // Start 45-minute countdown (2700 seconds)
  const startCryptoCountdown = () => {
    if (!cryptoCountdownEnd) setCryptoCountdownEnd(Date.now() + 45 * 60 * 1000)
  }
  // Tick countdown while Crypto tab is open
  useEffect(() => {
    if (method !== 'crypto' || !open || !cryptoCountdownEnd) return
    const tick = () => {
      const s = Math.max(0, Math.floor((cryptoCountdownEnd - Date.now()) / 1000))
      setCryptoRemaining(s)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [method, open, cryptoCountdownEnd])
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }
  if (!open) return null
  // Removed unused validPhone to resolve TS warning 6133

  // Removed unused activate() to avoid TS warning 6133

  const handleCancel = async () => {
    cancellingRef.current = true
    // Clear local UI state and timers
    setLoading(false)
    setError('')
    setPaybillTxId('')
    setPhone('')
    setCryptoCountdownEnd(null)
    setCryptoRemaining(0)
    setPaypalReady(false)
    // Attempt to cancel any pending payments server-side
    try { if (token) await cancelPayments(token) } catch {}
    // Close modal
    onClose()
  }

  // Removed unused pollForActivation to resolve TS warning 6133

  const openPayPal = () => {
    if (paypalLink) window.open(paypalLink, '_blank')
  }


  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      if (method === 'crypto') startCryptoCountdown()
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  const cryptoWaiting = cryptoCountdownEnd !== null && cryptoRemaining > 0
  return (
    <div className="modal">
      <div className="modal-card">
        {copied && (
          <div className="copy-toast">Copied to clipboard</div>
        )}
        {showErrorToast && (
          <div className="error-toast">incorrect transaction ID, Please retry!</div>
        )}
        <h3>Unlock Predictions</h3>
        <p>One-time subscription. Choose a payment method.</p>
        <div className="pay-tabs">
          <button className={`tab tab--paybill ${method==='paybill'?'active':''}`} onClick={()=>setMethod('paybill')}>
            <span className="brand-icon brand-icon--paybill">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9z"/></svg>
            </span>
            Paybill
          </button>
          <button className={`tab tab--paypal ${method==='paypal'?'active':''}`} onClick={()=>setMethod('paypal')}>
            <span className="brand-icon brand-icon--paypal">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M7 20l2-12h8a4 4 0 0 1 0 8H13l-1 4H7z"/></svg>
            </span>
            PayPal
          </button>
          <button className={`tab tab--crypto ${method==='crypto'?'active':''}`} onClick={()=>setMethod('crypto')}>
            <span className="brand-icon brand-icon--crypto">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#111" d="M12 2l9 5v10l-9 5-9-5V7l9-5z"/></svg>
            </span>
            Crypto
          </button>
        </div>

        {/* M-PESA STK and Airtel STK removed */}

        {method==='paybill' && (
          <div className="pay-section">
            <div className="brand-banner brand-banner--paybill">
              <span className="brand-icon brand-icon--paybill">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9z"/></svg>
              </span>
              <div>
                <div className="brand-title">M‑PESA Paybill</div>
                <div className="brand-note">Pay via Lipa na M‑PESA Paybill</div>
              </div>
            </div>
            <div className="info">Paybill Shortcode: <strong>{paybillShortcode}</strong></div>
            <div className="info">Account: <strong>{paybillAccount}</strong></div>
            <div className="info">Amount: <strong>KES {amount}</strong></div>
            <div className="password-row">
              <input
                value={paybillTxId}
                onChange={e=>setPaybillTxId(e.target.value)}
                placeholder="Enter M‑PESA transaction ID"
              />
              <button
                className="btn primary"
                onClick={()=>{ setError('incorrect transaction ID, Please retry!') }}
                disabled={!paybillTxId.trim()}
              >
                Confirm
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        )}

        {method==='paypal' && (
          <div className="pay-section">
            <div className="brand-banner brand-banner--paypal">
              <span className="brand-icon brand-icon--paypal">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M7 20l2-12h8a4 4 0 0 1 0 8H13l-1 4H7z"/></svg>
              </span>
              <div>
                <div className="brand-title">PayPal</div>
                <div className="brand-note">Pay securely with PayPal — $10</div>
              </div>
            </div>
            {!paypalReady && <div className="info">Loading PayPal…</div>}
            <div ref={paypalContainerRef} style={{ minHeight: 45 }}></div>
            <div className="modal-actions">
              <button className="btn" onClick={handleCancel}>Cancel</button>
              {approveUrl && <button className="btn" onClick={openApprove}>Open PayPal</button>}
              {!approveUrl && paypalLink && <button className="btn" onClick={openPayPal}>Open PayPal</button>}
            </div>
          </div>
        )}

        {method==='crypto' && (
          <div className="pay-section">
            <div className="brand-banner brand-banner--crypto">
              <span className="brand-icon brand-icon--crypto">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#111" d="M12 2l9 5v10l-9 5-9-5V7l9-5z"/></svg>
              </span>
              <div>
                <div className="brand-title">Crypto</div>
                <div className="brand-note">Pay with BTC, USDT or ETH</div>
              </div>
            </div>
            {cryptoLoading && <div className="info">Fetching live rates…</div>}
            {!cryptoLoading && !cryptoRates && <div className="info">Showing live amounts may be unavailable right now.</div>}
            {cryptoCountdownEnd && cryptoRemaining > 0 && (
              <div className="info info--red">Waiting for confirmation · {formatTime(cryptoRemaining)} remaining</div>
            )}
            <div className="info">BTC: <strong>{btc}</strong> <button className="link link-inline link--blue" onClick={()=>copy(btc)}>Copy</button></div>
            <div className="info">Amount: <strong>{formatCryptoAmount(btcAmount, 'BTC')}</strong> <button className="link link-inline link--blue" onClick={()=>copy(formatCryptoAmountNumber(btcAmount, 'BTC'))}>Copy amount</button></div>
            <div className="info">USDT (TRC20): <strong>{usdtTron}</strong> <button className="link link-inline link--blue" onClick={()=>copy(usdtTron)}>Copy</button></div>
            <div className="info">Amount: <strong>{formatCryptoAmount(usdtAmount, 'USDT')}</strong> <button className="link link-inline link--blue" onClick={()=>copy(formatCryptoAmountNumber(usdtAmount, 'USDT'))}>Copy amount</button></div>
            <div className="info">USDT (ERC20): <strong>{usdtEth}</strong> <button className="link link-inline link--blue" onClick={()=>copy(usdtEth)}>Copy</button></div>
            <div className="info">Amount: <strong>{formatCryptoAmount(usdtAmount, 'USDT')}</strong> <button className="link link-inline link--blue" onClick={()=>copy(formatCryptoAmountNumber(usdtAmount, 'USDT'))}>Copy amount</button></div>
            <div className="info">ETH: <strong>{ethAddress}</strong> <button className="link link-inline link--blue" onClick={()=>copy(ethAddress)}>Copy</button></div>
            <div className="info">Amount: <strong>{formatCryptoAmount(ethAmount, 'ETH')}</strong> <button className="link link-inline link--blue" onClick={()=>copy(formatCryptoAmountNumber(ethAmount, 'ETH'))}>Copy amount</button></div>
            <div className="modal-actions">
              <button className="btn" onClick={handleCancel}>Cancel</button>
              <button
                className="btn primary"
                onClick={()=>{ if (!cryptoWaiting) startCryptoCountdown() }}
                disabled={cryptoWaiting}
              >
                {cryptoWaiting ? 'Waiting…' : 'I have sent'}
              </button>
            </div>
          </div>
        )}

        {error && method==='paypal' ? (
          <div className="error">
            {error}
            {' '}•{' '}
            <button
              type="button"
              className="link link-inline"
              onClick={() => setError('')}
            >
              Try again
            </button>
          </div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : null}
      </div>
    </div>
  )
}