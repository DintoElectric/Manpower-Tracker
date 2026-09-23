// Wraps useLiveData in a context so any page can pull { jobs, workers,
// assignments, requests, accounts, loading, error, refresh } without
// each page needing its own fetch logic or prop drilling from App.jsx.
import { createContext, useContext } from 'react'
import { useLiveData } from '../hooks/useLiveData'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const value = useLiveData()
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
