import React, { createContext, useContext, useEffect, useState } from 'react'

type AuthState = {
  token: string | null
  login: (t: string) => void
  logout: () => void
}

const Ctx = createContext<AuthState | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])
  return (
    <Ctx.Provider value={{ token, login: setToken, logout: () => setToken(null) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}