import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { forgotPassword, resetPassword } from '../lib/api'
import { useAuth } from '../state/AuthContext'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void }

export const ForgotPasswordModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { login: setToken } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [requested, setRequested] = useState(false)
  const [serverCode, setServerCode] = useState<string | undefined>(undefined)
  const [expiresMinutes, setExpiresMinutes] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  if (!open) return null

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const validPassword = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword)

  const requestCode = async () => {
    if (!validEmail) { setError('Enter a valid email'); return }
    setLoading(true); setError('')
    try {
      const res = await forgotPassword(email)
      setRequested(true)
      setServerCode(res.code)
      setExpiresMinutes(res.expiresMinutes)
    } catch (e: any) {
      setError(e.message || 'Request failed')
    } finally { setLoading(false) }
  }

  const submitReset = async () => {
    if (!validEmail || !code || !validPassword) return
    setLoading(true); setError('')
    try {
      const res = await resetPassword(email, code, newPassword)
      setToken(res.token)
      onSuccess()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Reset failed')
    } finally { setLoading(false) }
  }

  const content = (
    <div className="modal modal--forgot">
      <div className="modal-card">
        <h3>Reset password</h3>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
        {!requested ? (
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={requestCode} disabled={!validEmail || loading}>{loading ? 'Sending…' : 'Send code'}</button>
          </div>
        ) : (
          <>
            {serverCode && (
              <div className="info">Use code <strong>{serverCode}</strong>{expiresMinutes ? ` (expires in ${expiresMinutes} min)` : ''}.</div>
            )}
            <label>Code<input value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code" /></label>
            <label>
              New password
              <div className="password-row">
                <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters, letters and numbers" />
                <button type="button" className="link link-inline password-toggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
              {!validPassword && newPassword.length>0 && (
                <div className="error">Use at least 8 characters with letters and numbers.</div>
              )}
            </label>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={submitReset} disabled={!validEmail || !code || !validPassword || loading}>{loading?'Please wait…':'Reset password'}</button>
            </div>
          </>
        )}
        {error && !requested && <div className="error">{error}</div>}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

export default ForgotPasswordModal