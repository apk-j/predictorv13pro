// In dev, use relative path so Vite proxy can route to the API
const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

export type ApiSite = { id: string; name: string; active: number; dark: number }

async function parseError(res: Response, fallback: string) {
  const status = res.status
  let text = ''
  try { text = await res.text() } catch {}
  // Try JSON first
  try {
    const data = JSON.parse(text)
    const msg = (data?.error || data?.message || '')
    const details = (data?.details || '')
    if (msg && details) return `${msg}: ${details}`
    if (msg) return msg
  } catch {}
  // Fallback to plain text
  if (text) return text
  return `${fallback} (http ${status})`
}

export async function getSites(): Promise<ApiSite[]> {
  const res = await fetch(`${BASE}/api/sites`)
  if (!res.ok) {
    const msg = await parseError(res, 'Failed to load sites')
    console.warn('[getSites] non-OK response', res.status, msg)
    return []
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    try {
      const text = await res.text()
      if (/<!doctype html/i.test(text) || /<html/i.test(text)) {
        console.warn('[getSites] HTML challenge intercepted; returning empty list')
        return []
      }
    } catch {}
    console.warn('[getSites] Non-JSON response; returning empty list')
    return []
  }
  try {
    const data = await res.json()
    if (Array.isArray(data)) return data
    console.warn('[getSites] Unexpected JSON shape; returning empty list')
    return []
  } catch (e) {
    console.warn('[getSites] JSON parse failed; returning empty list')
    return []
  }
}

export async function register(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) {
    const msg = await parseError(res, 'Registration failed')
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(()=> '')
    if (/<!doctype html/i.test(text) || /<html/i.test(text)) {
      throw new Error('Registration blocked by upstream challenge')
    }
    throw new Error(text || 'Registration failed')
  }
  return res.json() as Promise<{ token: string }>
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) {
    const msg = await parseError(res, 'Login failed')
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(()=> '')
    if (/<!doctype html/i.test(text) || /<html/i.test(text)) {
      throw new Error('Login blocked by upstream challenge')
    }
    throw new Error(text || 'Login failed')
  }
  return res.json() as Promise<{ token: string }>
}

export async function forgotPassword(email: string) {
  const res = await fetch(`${BASE}/api/auth/forgot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  if (!res.ok) {
    const msg = await parseError(res, 'Request failed')
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(()=> '')
    if (/<!doctype html/i.test(text) || /<html/i.test(text)) {
      throw new Error('Request blocked by upstream challenge')
    }
    throw new Error(text || 'Request failed')
  }
  return res.json() as Promise<{ ok: boolean; code?: string; expiresMinutes?: number }>
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const res = await fetch(`${BASE}/api/auth/reset`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword })
  })
  if (!res.ok) {
    const msg = await parseError(res, 'Reset failed')
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(()=> '')
    if (/<!doctype html/i.test(text) || /<html/i.test(text)) {
      throw new Error('Reset blocked by upstream challenge')
    }
    throw new Error(text || 'Reset failed')
  }
  return res.json() as Promise<{ token: string }>
}

export async function getSubscription(token: string) {
  const res = await fetch(`${BASE}/api/subscription`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Subscription fetch failed')
  return res.json() as Promise<{ status: string }>
}

export async function subscribe(token: string) {
  const res = await fetch(`${BASE}/api/subscribe`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'demo' }) })
  if (!res.ok) throw new Error('Subscription failed')
  return res.json() as Promise<{ status: string }>
}

export async function connect(token: string, siteId: string) {
  const res = await fetch(`${BASE}/api/connect/${siteId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const msg = await parseError(res, 'Connection failed')
    throw new Error(msg)
  }
  return res.json() as Promise<{ connected: boolean; site: string; token: string }>
}

export async function subscribeWithProvider(token: string, provider: string, reference?: string) {
  const res = await fetch(`${BASE}/api/subscribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, reference })
  })
  if (!res.ok) throw new Error('Subscription failed')
  return res.json() as Promise<{ status: string; provider: string }>
}

export async function initMpesaStk(token: string, phone: string) {
  const res = await fetch(`${BASE}/api/payments/mpesa/stkpush`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  })
  if (!res.ok) {
    try { const data = await res.json(); throw new Error(data?.error || 'MPESA push failed') } catch { throw new Error('MPESA push failed') }
  }
  return res.json() as Promise<{ ok: boolean; requestId: string; amount: number }>
}

export async function initAirtelStk(token: string, phone: string) {
  const res = await fetch(`${BASE}/api/payments/airtel/stkpush`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  })
  if (!res.ok) {
    try { const data = await res.json(); throw new Error(data?.error || 'Airtel push failed') } catch { throw new Error('Airtel push failed') }
  }
  return res.json() as Promise<{ ok: boolean; requestId: string; amount: number }>
}

export async function getLatestPaymentStatus(token: string) {
  const res = await fetch(`${BASE}/api/payments/latest`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Payment status fetch failed')
  return res.json() as Promise<{ status: string; provider?: string; requestId?: string; amount?: number }>
}

export async function cancelPayments(token: string) {
  const res = await fetch(`${BASE}/api/payments/cancel`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const msg = await parseError(res, 'Cancel payments failed')
    throw new Error(msg)
  }
  return res.json() as Promise<{ ok: boolean }>
}

export async function getPaypalConfig() {
  const res = await fetch(`${BASE}/api/payments/paypal/config`)
  if (!res.ok) throw new Error('PayPal config fetch failed')
  return res.json() as Promise<{ env: string; clientId: string; currency: string }>
}

export async function createPaypalOrder(token: string) {
  try {
    const res = await fetch(`${BASE}/api/payments/paypal/create-order`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      const msg = await parseError(res, 'PayPal order failed')
      throw new Error(msg)
    }
    return res.json() as Promise<{ id: string; approveUrl?: string | null }>
  } catch (e: any) {
    throw new Error(e?.message || 'PayPal order failed')
  }
}

export async function capturePaypalOrder(token: string, orderId: string) {
  try {
    const res = await fetch(`${BASE}/api/payments/paypal/capture`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    })
    if (!res.ok) {
      const msg = await parseError(res, 'PayPal capture failed')
      throw new Error(msg)
    }
    return res.json() as Promise<{ ok: boolean; orderId: string }>
  } catch (e: any) {
    throw new Error(e?.message || 'PayPal capture failed')
  }
}

export async function grantSiteAccess(token: string, siteId: string, provider: string) {
  const res = await fetch(`${BASE}/api/access/${siteId}/grant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider })
  })
  if (!res.ok) {
    const msg = await parseError(res, 'Grant access failed')
    throw new Error(msg)
  }
  return res.json() as Promise<{ ok: boolean; siteId: string; status: string }>
}