// dev: trigger nodemon reload
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { db, init, seedSites, removeWhiteVariantSites } from './db'
import {
  signToken,
  verifyToken,
  findUserByEmail,
  createUser,
  comparePassword,
  ensureAdminSeed,
  generateResetCode,
  createPasswordReset,
  getLatestActiveReset,
  markResetUsed,
  updateUserPassword,
} from './auth'

// Explicitly load server/.env regardless of process CWD
dotenv.config({ path: path.resolve(__dirname, '../.env') })
init()
seedSites()
removeWhiteVariantSites()
ensureAdminSeed()

const app = express()
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean)
app.use(cors(allowed.length ? { origin: allowed } : undefined))
app.use(express.json())

// Helpers
function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.replace('Bearer ', '')
  try {
    const payload = verifyToken(token) as any
    req.user = payload
    next()
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

function formatTimestampYYYYMMDDHHMMSS(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const HH = pad(d.getHours())
  const MM = pad(d.getMinutes())
  const SS = pad(d.getSeconds())
  return `${yyyy}${mm}${dd}${HH}${MM}${SS}`
}

// Public endpoints
app.get('/api/health', (_, res) => res.json({ ok: true }))
app.get('/api/sites', (_, res) => {
  const rows = db.prepare('SELECT * FROM sites WHERE active = 1').all()
  res.json(rows)
})

// Auth
app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passOk = typeof password === 'string' && password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  if (!emailOk) return res.status(400).json({ error: 'Invalid email format' })
  if (!passOk) return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' })
  const existing = findUserByEmail(email)
  if (existing) return res.status(409).json({ error: 'Email already registered' })
  const id = createUser(email, password)
  const token = signToken({ id, email, role: 'user' })
  res.json({ token })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  const user = findUserByEmail(email)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const ok = comparePassword(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const token = signToken({ id: user.id, email: user.email, role: user.role })
  res.json({ token })
})

// Forgot/reset password
app.post('/api/auth/forgot', (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Missing email' })
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailOk) return res.status(400).json({ error: 'Invalid email format' })
  const user = findUserByEmail(email)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const code = generateResetCode()
  createPasswordReset(user.id, code)
  // Demo: return code in response. In production, email this code to the user.
  res.json({ ok: true, code, expiresMinutes: 10 })
})

app.post('/api/auth/reset', (req, res) => {
  const { email, code, newPassword } = req.body
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'Missing fields' })
  const passOk = typeof newPassword === 'string' && newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword)
  if (!passOk) return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' })
  const user = findUserByEmail(email)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const reset = getLatestActiveReset(user.id)
  if (!reset) return res.status(400).json({ error: 'No active reset request' })
  const now = new Date()
  const expired = new Date(reset.expires_at) < now
  if (expired) return res.status(400).json({ error: 'Reset code expired' })
  const ok = comparePassword(String(code), reset.code_hash)
  if (!ok) return res.status(400).json({ error: 'Invalid reset code' })
  updateUserPassword(user.id, newPassword)
  markResetUsed(reset.id)
  const token = signToken({ id: user.id, email: user.email, role: user.role })
  res.json({ token })
})

// Subscription (payment) flow
app.post('/api/subscribe', requireAuth, (req: any, res) => {
  const userId = req.user.id
  const { provider = 'demo', reference } = req.body || {}
  const now = new Date().toISOString()
  const existing = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any
  if (existing) {
    db.prepare('UPDATE subscriptions SET status=?, provider=?, updated_at=? WHERE id=?').run('active', provider, now, existing.id)
  } else {
    db.prepare('INSERT INTO subscriptions (user_id,status,provider,created_at,updated_at) VALUES (?,?,?,?,?)')
      .run(userId, 'active', provider, now, now)
  }
  res.json({ status: 'active', provider, reference })
})

// STK push endpoints (demo vs live). In live mode, do not auto-activate; track payment and await callback.
const PAYMENTS_MODE = (process.env.PAYMENTS_MODE || 'demo').toLowerCase() // 'demo' | 'live'

function normalizeMsisdn(phone: string) {
  const digits = String(phone).replace(/\D/g, '')
  // Convert common Kenyan formats to 2547XXXXXXXX
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('7')) return `254${digits}`
  return digits
}

app.post('/api/payments/mpesa/stkpush', requireAuth, async (req: any, res) => {
  return res.status(410).json({ error: 'provider_disabled' })
  const { phone } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'Missing phone' })
  const amount = Number(process.env.SUBSCRIPTION_AMOUNT || 500)
  const now = new Date().toISOString()
  let requestId = 'mpesa_'+Math.random().toString(36).slice(2)
  const msisdn = normalizeMsisdn(phone)

  if (PAYMENTS_MODE === 'demo') {
    // Demo: create payment success immediately
    db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(req.user.id, 'mpesa', amount, 'success', requestId, msisdn, now, now)
    // Mark subscription active
    const existing = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id) as any
    if (existing) {
      db.prepare('UPDATE subscriptions SET status=?, provider=?, updated_at=? WHERE id=?').run('active', 'mpesa', now, existing.id)
    } else {
      db.prepare('INSERT INTO subscriptions (user_id,status,provider,created_at,updated_at) VALUES (?,?,?,?,?)')
        .run(req.user.id, 'active', 'mpesa', now, now)
    }
    return res.json({ ok: true, requestId, amount })
  }

  // Live: attempt Safaricom Daraja STK push
  try {
    const baseUrl = (process.env.DARAJA_ENV || 'sandbox').toLowerCase() === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke'
    const consumerKey = process.env.DARAJA_CONSUMER_KEY || ''
    const consumerSecret = process.env.DARAJA_CONSUMER_SECRET || ''
    const businessShortCode = process.env.BUSINESS_SHORTCODE || ''
    const passkey = process.env.DARAJA_PASSKEY || ''
    const callbackBase = process.env.CALLBACK_BASE_URL || ''

    if (!consumerKey || !consumerSecret || !businessShortCode || !passkey || !callbackBase) {
      // Missing configuration; record pending and return
      db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(req.user.id, 'mpesa', amount, 'pending', requestId, phone, now, now)
      return res.status(400).json({ ok: true, requestId, amount, warning: 'missing_daraja_env' })
    }

    if (typeof fetch !== 'function') {
      db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(req.user.id, 'mpesa', amount, 'pending', requestId, phone, now, now)
      return res.status(500).json({ ok: true, requestId, amount, warning: 'fetch_not_available' })
    }

    const timestamp = formatTimestampYYYYMMDDHHMMSS(new Date())
    const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64')
    const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')

    const tokenResp = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET', headers: { Authorization: `Basic ${basic}` }
    })
    if (!tokenResp.ok) {
      const text = await tokenResp.text()
      console.error('Daraja token error', tokenResp.status, text)
      db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(req.user.id, 'mpesa', amount, 'pending', requestId, phone, now, now)
      return res.status(502).json({ ok: true, requestId, amount, error: 'daraja_token_failed' })
    }
    const tokenJson = await tokenResp.json() as any
    const accessToken = tokenJson.access_token

    const callBackURL = `${callbackBase}/api/payments/mpesa/callback`
    // Allow configuring LNMO transaction type and PartyB via environment
    const stkTransactionType = process.env.DARAJA_STK_TRANSACTION_TYPE || 'CustomerPayBillOnline'
    const stkPartyB = process.env.DARAJA_STK_PARTYB || businessShortCode

    const stkPayload = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: stkTransactionType,
      Amount: amount,
      PartyA: msisdn,
      PartyB: stkPartyB,
      PhoneNumber: msisdn,
      CallBackURL: callBackURL,
      AccountReference: 'AVIATOR',
      TransactionDesc: 'Subscription',
    }

    const stkResp = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(stkPayload)
    })
    const stkText = await stkResp.text()
    if (!stkResp.ok) {
      console.error('Daraja STK error', stkResp.status, stkText)
      db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(req.user.id, 'mpesa', amount, 'pending', requestId, phone, now, now)
      return res.status(502).json({ ok: true, requestId, amount, error: 'daraja_stk_failed', details: stkText })
    }

    let stkJson: any = {}
    try { stkJson = JSON.parse(stkText) } catch {}
    requestId = stkJson.CheckoutRequestID || requestId

    db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(req.user.id, 'mpesa', amount, 'pending', requestId, msisdn, now, now)
    return res.json({ ok: true, requestId, amount, providerResponse: stkJson })
  } catch (e) {
    console.error('mpesa stkpush live error', e)
    db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(req.user.id, 'mpesa', amount, 'pending', requestId, msisdn, now, now)
    return res.status(500).json({ ok: true, requestId, amount, error: 'mpesa_stkpush_failed' })
  }
})

app.post('/api/payments/airtel/stkpush', requireAuth, (req: any, res) => {
  return res.status(410).json({ error: 'provider_disabled' })
  const { phone } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'Missing phone' })
  const amount = Number(process.env.SUBSCRIPTION_AMOUNT || 500)
  const now = new Date().toISOString()
  const requestId = 'airtel_'+Math.random().toString(36).slice(2)

  if (PAYMENTS_MODE === 'demo') {
    db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(req.user.id, 'airtel', amount, 'success', requestId, phone, now, now)
    const existing = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id) as any
    if (existing) {
      db.prepare('UPDATE subscriptions SET status=?, provider=?, updated_at=? WHERE id=?').run('active', 'airtel', now, existing.id)
    } else {
      db.prepare('INSERT INTO subscriptions (user_id,status,provider,created_at,updated_at) VALUES (?,?,?,?,?)')
        .run(req.user.id, 'active', 'airtel', now, now)
    }
    return res.json({ ok: true, requestId, amount })
  }

  // Live: record pending and perform integration once credentials are provided
  const apiKey = process.env.AIRTEL_API_KEY || ''
  const apiSecret = process.env.AIRTEL_API_SECRET || ''
  const merchantId = process.env.AIRTEL_MERCHANT_ID || ''
  const callbackBase = process.env.CALLBACK_BASE_URL || ''

  db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.user.id, 'airtel', amount, 'pending', requestId, phone, now, now)

  const missing = (!apiKey || !apiSecret || !merchantId || !callbackBase)
  // TODO: Use AIRTEL_ENV to select sandbox/production and implement token + STK call.
  return res.json({ ok: true, requestId, amount, warning: missing ? 'missing_airtel_env' : undefined })
})

// Payment status for current user (latest)
app.get('/api/payments/latest', requireAuth, (req: any, res) => {
  const row = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id) as any
  if (!row) return res.json({ status: 'none' })
  res.json({ status: row.status, provider: row.provider, requestId: row.request_id, amount: row.amount })
})

// PayPal Checkout (live REST integration)
app.get('/api/payments/paypal/config', (_, res) => {
  const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
  const clientId = process.env.PAYPAL_CLIENT_ID || ''
  const currency = process.env.PAYPAL_CURRENCY || 'USD'
  res.json({ env, clientId, currency })
})

app.post('/api/payments/paypal/create-order', requireAuth, async (req: any, res) => {
  try {
    const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
    const clientId = process.env.PAYPAL_CLIENT_ID || ''
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || ''
    const currency = process.env.PAYPAL_CURRENCY || 'USD'
    const amountStr = String(Number(process.env.PAYPAL_AMOUNT || 10))
    if (!clientId || !clientSecret) return res.status(400).json({ error: 'missing_paypal_env' })

    const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenResp = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    })
    if (!tokenResp.ok) {
      const text = await tokenResp.text()
      console.error('PayPal token error', tokenResp.status, text)
      let err = 'paypal_token_failed'
      try { const j = JSON.parse(text); err = (j?.error || j?.name || err) } catch {}
      return res.status(502).json({ error: err, details: text })
    }
    const tokenJson = await tokenResp.json() as any
    const accessToken = tokenJson.access_token

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: currency, value: amountStr } }],
    }
    const orderResp = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    })
    const orderText = await orderResp.text()
    if (!orderResp.ok) {
      console.error('PayPal create-order error', orderResp.status, orderText)
      let err = 'paypal_create_failed'
      let details: string | undefined
      try {
        const j = JSON.parse(orderText)
        err = (j?.details?.[0]?.issue || j?.name || err)
        details = (j?.details?.[0]?.description || j?.message)
      } catch {}
      return res.status(502).json({ error: err, details: details || orderText })
    }
    const orderJson = JSON.parse(orderText)
    const orderId = orderJson.id
    const approveUrl = Array.isArray(orderJson.links)
      ? (orderJson.links.find((l: any) => l?.rel === 'approve')?.href || null)
      : null
    const now = new Date().toISOString()
    db.prepare('INSERT INTO payments (user_id,provider,amount,status,request_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(req.user.id, 'paypal', Number(process.env.PAYPAL_AMOUNT || 10), 'pending', orderId, now, now)
    return res.json({ id: orderId, approveUrl })
  } catch (e) {
    console.error('paypal create-order error', e)
    return res.status(500).json({ error: 'paypal_create_failed' })
  }
})

app.post('/api/payments/paypal/capture', requireAuth, async (req: any, res) => {
  try {
    const { orderId } = req.body || {}
    if (!orderId) return res.status(400).json({ error: 'missing_order_id' })
    const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
    const clientId = process.env.PAYPAL_CLIENT_ID || ''
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || ''
    if (!clientId || !clientSecret) return res.status(400).json({ error: 'missing_paypal_env' })
    const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenResp = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    })
    if (!tokenResp.ok) {
      const text = await tokenResp.text()
      console.error('PayPal token error', tokenResp.status, text)
      let err = 'paypal_token_failed'
      try { const j = JSON.parse(text); err = (j?.error || j?.name || err) } catch {}
      return res.status(502).json({ error: err, details: text })
    }
    const tokenJson = await tokenResp.json() as any
    const accessToken = tokenJson.access_token

    const capResp = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    })
    const capText = await capResp.text()
    if (!capResp.ok) {
      console.error('PayPal capture error', capResp.status, capText)
      let err = 'paypal_capture_failed'
      let details: string | undefined
      try {
        const j = JSON.parse(capText)
        err = (j?.details?.[0]?.issue || j?.name || err)
        details = (j?.details?.[0]?.description || j?.message)
      } catch {}
      // Mark failed
      const nowFail = new Date().toISOString()
      db.prepare('UPDATE payments SET status=?, updated_at=? WHERE request_id=?')
        .run('failed', nowFail, orderId)
      return res.status(502).json({ error: err, details: details || capText })
    }
    const now = new Date().toISOString()
    const amount = Number(process.env.SUBSCRIPTION_AMOUNT || 500)
    db.prepare('UPDATE payments SET status=?, updated_at=? WHERE request_id=?')
      .run('success', now, orderId)
    const existing = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id) as any
    if (existing) {
      db.prepare('UPDATE subscriptions SET status=?, provider=?, updated_at=? WHERE id=?').run('active', 'paypal', now, existing.id)
    } else {
      db.prepare('INSERT INTO subscriptions (user_id,status,provider,created_at,updated_at) VALUES (?,?,?,?,?)')
        .run(req.user.id, 'active', 'paypal', now, now)
    }
    return res.json({ ok: true, orderId })
  } catch (e) {
    console.error('paypal capture error', e)
    return res.status(500).json({ error: 'paypal_capture_failed' })
  }
})

// Provider callbacks (skeletons). Wire these URLs at the provider dashboards.
app.post('/api/payments/mpesa/callback', (req, res) => {
  // Parse Safaricom STK callback and update payment + subscription
  const now = new Date().toISOString()
  const body = req.body || {}
  // Expected Safaricom payload: { Body: { stkCallback: { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata: { Item: [...] } } } }
  const stk = body?.Body?.stkCallback || {}
  const requestId = stk?.CheckoutRequestID || body?.requestId
  const resultCode = typeof stk?.ResultCode !== 'undefined' ? Number(stk.ResultCode) : Number(body?.resultCode)
  const resultDesc = stk?.ResultDesc || body?.resultDesc
  let amount: number | null = null
  let receipt: string | null = null
  let phone: string | null = null
  const items: any[] = stk?.CallbackMetadata?.Item || []
  items.forEach((it: any) => {
    if (it?.Name === 'Amount') amount = Number(it?.Value)
    if (it?.Name === 'MpesaReceiptNumber') receipt = String(it?.Value || '')
    if (it?.Name === 'PhoneNumber') phone = String(it?.Value || '')
  })

  if (!requestId) return res.status(400).json({ error: 'Missing requestId' })
  const status = resultCode === 0 ? 'success' : 'failed'

  db.prepare('UPDATE payments SET status=?, external_id=?, amount=?, phone=?, updated_at=? WHERE request_id=?')
    .run(status, receipt, amount, phone, now, requestId)

  if (status === 'success') {
    const p = db.prepare('SELECT * FROM payments WHERE request_id = ?').get(requestId) as any
    if (p) {
      const existing = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(p.user_id) as any
      if (existing) {
        db.prepare('UPDATE subscriptions SET status=?, provider=?, updated_at=? WHERE id=?').run('active', 'mpesa', now, existing.id)
      } else {
        db.prepare('INSERT INTO subscriptions (user_id,status,provider,created_at,updated_at) VALUES (?,?,?,?,?)')
          .run(p.user_id, 'active', 'mpesa', now, now)
      }

      // After successful STK, perform B2B settlement (optional)
      const settleAmount = typeof amount === 'number' && amount > 0 ? amount : Number(process.env.SUBSCRIPTION_AMOUNT || 0)
      const accountRef = process.env.DARAJA_B2B_ACCOUNT_REFERENCE || 'TestAccount'
      performB2BSettlement({ amount: settleAmount, accountRef })
        .then((resp: any) => {
          const ref = resp?.providerResponse?.ConversationID || resp?.providerResponse?.OriginatorConversationID || null
          db.prepare('UPDATE payments SET b2b_ref = ?, updated_at = ? WHERE id = ?').run(ref, new Date().toISOString(), p.id)
        })
        .catch((err: any) => console.error('B2B settlement call failed', err))
    }
  }
  res.json({ ok: true, requestId, status, resultDesc })
})

app.post('/api/payments/airtel/callback', (req, res) => {
  const { requestId, resultCode, externalId, amount, phone } = req.body || {}
  const now = new Date().toISOString()
  if (!requestId) return res.status(400).json({ error: 'Missing requestId' })
  const status = Number(resultCode) === 0 ? 'success' : 'failed'
  db.prepare('UPDATE payments SET status=?, external_id=?, amount=?, phone=?, updated_at=? WHERE request_id=?')
    .run(status, externalId || null, amount || null, phone || null, now, requestId)
  if (status === 'success') {
    const p = db.prepare('SELECT * FROM payments WHERE request_id = ?').get(requestId) as any
    const existing = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(p.user_id) as any
    if (existing) {
      db.prepare('UPDATE subscriptions SET status=?, provider=?, updated_at=? WHERE id=?').run('active', 'airtel', now, existing.id)
    } else {
      db.prepare('INSERT INTO subscriptions (user_id,status,provider,created_at,updated_at) VALUES (?,?,?,?,?)')
        .run(p.user_id, 'active', 'airtel', now, now)
    }
  }
  res.json({ ok: true })
})

// B2B callbacks
app.post('/api/payments/mpesa/b2b/timeout', (req, res) => {
  console.warn('Daraja B2B timeout', req.body)
  res.json({ ok: true })
})
app.post('/api/payments/mpesa/b2b/result', (req, res) => {
  try {
    const body = req.body || {}
    const result = body?.Result || {}
    const conversationId = result?.ConversationID || result?.OriginatorConversationID || null
    const resultDesc = result?.ResultDesc || ''
    const code = result?.ResultCode
    // Log B2B result and optionally update latest payment record
    const p = db.prepare('SELECT * FROM payments ORDER BY id DESC LIMIT 1').get() as any
    if (p) db.prepare('UPDATE payments SET b2b_result = ?, b2b_ref = ? WHERE id = ?').run(resultDesc || null, conversationId || null, p.id)
    res.json({ ok: true })
  } catch (e) {
    console.error('B2B result handler error', e)
    res.status(500).json({ ok: false })
  }
})

app.get('/api/subscription', requireAuth, (req: any, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id) as any
  res.json({ status: sub?.status || 'none' })
})

// Dev helper: reset subscription to none for the current user
app.delete('/api/subscription', requireAuth, (req: any, res) => {
  db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(req.user.id)
  res.json({ status: 'none' })
})

// Cancel any ongoing payment activity for current user and reset subscription
app.post('/api/payments/cancel', requireAuth, (req: any, res) => {
  const userId = req.user.id
  const now = new Date().toISOString()
  // Mark all pending payments as canceled
  db.prepare('UPDATE payments SET status=?, updated_at=? WHERE user_id=? AND status=?')
    .run('canceled', now, userId, 'pending')
  // Reset subscription to none
  db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId)
  res.json({ ok: true })
})

// Connectors: require active subscription
app.post('/api/connect/:siteId', requireAuth, (req: any, res) => {
  const siteId = req.params.siteId
  const access = db.prepare('SELECT * FROM site_access WHERE user_id = ? AND site_id = ?').get(req.user.id, siteId) as any
  if (!access || access.status !== 'granted') return res.status(402).json({ error: 'Payment required' })
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) as any
  if (!site) return res.status(404).json({ error: 'Site not found' })
  // For demo purposes, return a fake connection token/URL
  res.json({ connected: true, site: site.name, token: 'conn_'+siteId })
})

// Grant per-site access (upsert)
app.post('/api/access/:siteId/grant', requireAuth, (req: any, res) => {
  const userId = req.user.id
  const siteId = req.params.siteId
  const { provider = 'demo' } = req.body || {}
  const now = new Date().toISOString()

  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) as any
  if (!site) return res.status(404).json({ error: 'Site not found' })

  const existing = db.prepare('SELECT * FROM site_access WHERE user_id = ? AND site_id = ?').get(userId, siteId) as any
  if (existing) {
    db.prepare('UPDATE site_access SET status=?, provider=?, updated_at=? WHERE id=?').run('granted', provider, now, existing.id)
  } else {
    db.prepare('INSERT INTO site_access (user_id,site_id,status,provider,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run(userId, siteId, 'granted', provider, now, now)
  }
  res.json({ ok: true, siteId, status: 'granted' })
})

// Admin API
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body
  const user = findUserByEmail(email)
  if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' })
  const ok = comparePassword(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Unauthorized' })
  const token = signToken({ id: user.id, email: user.email, role: 'admin' })
  res.json({ token })
})

function requireAdmin(req: any, res: any, next: any) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
    next()
  })
}

app.get('/api/admin/sites', requireAdmin, (_, res) => {
  const rows = db.prepare('SELECT * FROM sites').all()
  res.json(rows)
})

app.post('/api/admin/sites', requireAdmin, (req, res) => {
  const { id, name, active = 1, dark = 0 } = req.body
  try {
    db.prepare('INSERT INTO sites (id,name,active,dark) VALUES (?,?,?,?)').run(id, name, active, dark)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Failed to insert site' })
  }
})

app.put('/api/admin/sites/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  const { name, active, dark } = req.body
  db.prepare('UPDATE sites SET name=?, active=?, dark=? WHERE id=?').run(name, active, dark, id)
  res.json({ ok: true })
})

app.delete('/api/admin/sites/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  db.prepare('DELETE FROM sites WHERE id=?').run(id)
  res.json({ ok: true })
})

const port = Number(process.env.PORT || 8080)
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`)
})
async function performB2BSettlement({ amount, accountRef }: { amount: number; accountRef: string }) {
  try {
    const baseUrl = (process.env.DARAJA_ENV || 'sandbox').toLowerCase() === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke'
    const consumerKey = process.env.DARAJA_CONSUMER_KEY || ''
    const consumerSecret = process.env.DARAJA_CONSUMER_SECRET || ''
    const initiator = process.env.DARAJA_INITIATOR_NAME || ''
    const securityCredential = process.env.DARAJA_SECURITY_CREDENTIAL || ''
    const commandId = process.env.DARAJA_B2B_COMMAND_ID || 'BusinessPayBill'
    const partyA = process.env.DARAJA_SOURCE_SHORTCODE || process.env.BUSINESS_SHORTCODE || ''
    const partyB = process.env.DARAJA_DEST_SHORTCODE || ''
    const callbackBase = process.env.CALLBACK_BASE_URL || ''

    if (!consumerKey || !consumerSecret || !initiator || !securityCredential || !partyA || !partyB || !callbackBase) {
      console.warn('B2B not executed: missing env configuration')
      return { ok: false, warning: 'missing_b2b_env' }
    }

    const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
    const tokenResp = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET', headers: { Authorization: `Basic ${basic}` }
    })
    if (!tokenResp.ok) {
      const text = await tokenResp.text()
      console.error('Daraja token error (B2B)', tokenResp.status, text)
      return { ok: false, error: 'daraja_token_failed' }
    }
    const tokenJson = await tokenResp.json() as any
    const accessToken = tokenJson.access_token

    const senderType = Number(process.env.DARAJA_SENDER_IDENTIFIER_TYPE || '4')
    const receiverType = Number(process.env.DARAJA_RECEIVER_IDENTIFIER_TYPE || '4')
    const remarks = process.env.DARAJA_B2B_REMARKS || 'Auto settlement to Loop'

    const payload = {
      Initiator: initiator,
      SecurityCredential: securityCredential,
      CommandID: commandId,
      SenderIdentifierType: senderType,
      ReceiverIdentifierType: receiverType,
      Amount: amount,
      PartyA: partyA,
      PartyB: partyB,
      AccountReference: accountRef,
      Remarks: remarks,
      QueueTimeOutURL: `${callbackBase}/api/payments/mpesa/b2b/timeout`,
      ResultURL: `${callbackBase}/api/payments/mpesa/b2b/result`,
    }

    const b2bResp = await fetch(`${baseUrl}/mpesa/b2b/v1/paymentrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const b2bText = await b2bResp.text()
    if (!b2bResp.ok) {
      console.error('Daraja B2B error', b2bResp.status, b2bText)
      return { ok: false, error: 'daraja_b2b_failed', details: b2bText }
    }
    let b2bJson: any = {}
    try { b2bJson = JSON.parse(b2bText) } catch {}
    return { ok: true, providerResponse: b2bJson }
  } catch (e) {
    console.error('performB2BSettlement error', e)
    return { ok: false, error: 'b2b_exception' }
  }
}