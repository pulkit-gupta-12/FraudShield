import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSystemConfig, getModelInfo } from '../services/model.js'
import { THRESHOLD as DEFAULT_THRESHOLD, REVIEW_FLOOR as DEFAULT_REVIEW_FLOOR } from '../config/constants.js'

const ModelConfigContext = createContext({
  threshold: DEFAULT_THRESHOLD,
  reviewFloor: DEFAULT_REVIEW_FLOOR,
  loading: false,
  reloadConfig: () => {},
})

export function ModelConfigProvider({ children }) {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [reviewFloor, setReviewFloor] = useState(DEFAULT_REVIEW_FLOOR)
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    const token = localStorage.getItem('fraudshield_access')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await getSystemConfig().catch(() => getModelInfo())
      if (data) {
        if (data.threshold !== undefined) {
          setThreshold(Number(data.threshold))
        } else if (data.fraudThreshold !== undefined) {
          setThreshold(Number(data.fraudThreshold))
        }

        if (data.reviewFloor !== undefined) {
          setReviewFloor(Number(data.reviewFloor))
        } else if (data.suspiciousThreshold !== undefined) {
          setReviewFloor(Number(data.suspiciousThreshold))
        }
      }
    } catch (err) {
      // Fall back to default constants
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()

    const handleThresholdUpdate = (e) => {
      if (e.detail) {
        if (e.detail.threshold !== undefined) setThreshold(Number(e.detail.threshold))
        if (e.detail.reviewFloor !== undefined) setReviewFloor(Number(e.detail.reviewFloor))
      }
    }

    window.addEventListener('threshold-updated', handleThresholdUpdate)
    return () => {
      window.removeEventListener('threshold-updated', handleThresholdUpdate)
    }
  }, [fetchConfig])

  return (
    <ModelConfigContext.Provider
      value={{
        threshold,
        reviewFloor,
        loading,
        reloadConfig: fetchConfig,
      }}
    >
      {children}
    </ModelConfigContext.Provider>
  )
}

export function useModelConfig() {
  const ctx = useContext(ModelConfigContext)
  if (!ctx) {
    throw new Error('useModelConfig must be used within a ModelConfigProvider')
  }
  return ctx
}
