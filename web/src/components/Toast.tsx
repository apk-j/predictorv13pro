import React from 'react'

type Props = {
  message: string
  visible: boolean
}

export const Toast: React.FC<Props> = ({ message, visible }) => {
  if (!visible) return null
  return (
    <div className="toast">
      <span className="checkmark" />
      <span>{message}</span>
    </div>
  )
}