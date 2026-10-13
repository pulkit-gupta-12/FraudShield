import React from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { PageStub } from './PageStub.jsx'

export function ProfilePage() {
  const { user } = useAuth()
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageStub
        title="User Profile & Settings"
        description={`Manage credentials, notification channels, and active security sessions for ${user?.name || 'Account'}.`}
        role={user?.role}
      />
    </div>
  )
}
