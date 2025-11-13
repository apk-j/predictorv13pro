import React, { useState } from 'react'
import { login, register } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import ForgotPasswordModal from './ForgotPasswordModal'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void }

export const LoginModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { login: setToken } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [agree, setAgree] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  if (!open) return null
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const validPassword = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)
  const canSubmit = !loading && validEmail && validPassword && (mode==='login' || agree)
  const submit = async () => {
    if (!canSubmit) return
    setLoading(true); setError('')
    try {
      const res = mode === 'login' ? await login(email, password) : await register(email, password)
      setToken(res.token)
      onSuccess()
      onClose()
    } catch (e: any) { setError(e.message || 'Error') }
    finally { setLoading(false) }
  }
  return (
    <div className="modal">
      <div className="modal-card">
        <h3>
          {mode === 'login' ? (
            <>
              Login{' '}
              <button
                type="button"
                className="link link-inline"
                onClick={() => setMode('register')}
              >
                New here? Register
              </button>
            </>
          ) : (
            <>
              Create account{' '}
              <button
                type="button"
                className="link link-inline"
                onClick={() => setMode('login')}
              >
                Have an account? Login
              </button>
            </>
          )}
        </h3>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label>
          Password
          <div className="password-row">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters, letters and numbers" />
            <button type="button" className="link link-inline password-toggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          {mode==='register' && !validPassword && password.length>0 && (
            <div className="error">Use at least 8 characters with letters and numbers.</div>
          )}
        </label>
        {mode==='register' && (
          <label className="consent-label">
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} />
            I agree to the{' '}
            <button type="button" className="link link-inline" onClick={()=>window.dispatchEvent(new CustomEvent('open-legal', { detail: 'terms' }))}>Terms of Service</button>
            {' '}and{' '}
            <button type="button" className="link link-inline" onClick={()=>window.dispatchEvent(new CustomEvent('open-legal', { detail: 'privacy' }))}>Privacy Policy</button>
          </label>
        )}
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={!canSubmit}>{loading?'Please wait…':'Continue'}</button>
        </div>
        <div className="switch-mode">
          {mode==='login' && (
            <>
              <button className="link" onClick={()=>setForgotOpen(true)}>Forgot password?</button>
            </>
          )}
        </div>
      </div>
      <ForgotPasswordModal open={forgotOpen} onClose={()=>setForgotOpen(false)} onSuccess={onSuccess} />
    </div>
  )
}