import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook to execute async service calls with loading, error, and refetch support
 */
export function useFetch(asyncFn, immediate = true, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFn(...args)
      setData(result)
      return result
    } catch (err) {
      setError(err.message || 'Something went wrong')
      throw err
    } finally {
      setLoading(false)
    }
  }, [asyncFn])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [execute, immediate, ...deps])

  return { data, loading, error, refetch: execute, setData }
}
