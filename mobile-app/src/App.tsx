import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import { Preferences } from '@capacitor/preferences'
import ConsentPage from './pages/ConsentPage'
import LoginPage from './pages/LoginPage'
import RequestAccessPage from './pages/RequestAccessPage'
import MainPage from './pages/MainPage'
import SettingsPage from './pages/SettingsPage'

// Types
interface UserData {
  device_id: string
  username: string
  device_name: string
  user_id?: string
  profile_image_url?: string | null
}

interface AppContextType {
  userData: UserData | null
  setUserData: (data: UserData | null) => void
  hasConsented: boolean
  setHasConsented: (value: boolean) => void
  isAuthenticated: boolean
  setIsAuthenticated: (value: boolean) => void
  isTracking: boolean
  setIsTracking: (value: boolean) => void
  locationEnabled: boolean
  setLocationEnabled: (value: boolean) => void
  serverUrl: string
  wsUrl: string
  clearUserData: () => void
  logout: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useAppContext must be used within AppProvider')
  return context
}

// Storage keys
const STORAGE_KEYS = {
  USER_DATA: 'user_data',
  HAS_CONSENTED: 'has_consented',
  IS_AUTHENTICATED: 'is_authenticated',
  IS_TRACKING: 'is_tracking',
  LOCATION_ENABLED: 'location_enabled'
}

function App() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [hasConsented, setHasConsented] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Server configuration - UPDATE THIS TO YOUR MACHINE'S IP
  const serverUrl = 'http://192.168.1.3:3000' // Change to your IP
  const wsUrl = 'ws://192.168.1.3:8080' // Change to your IP

  // Load saved state on startup
  useEffect(() => {
    async function loadState() {
      try {
        const [userDataResult, consentResult, authResult, trackingResult, locationResult] = await Promise.all([
          Preferences.get({ key: STORAGE_KEYS.USER_DATA }),
          Preferences.get({ key: STORAGE_KEYS.HAS_CONSENTED }),
          Preferences.get({ key: STORAGE_KEYS.IS_AUTHENTICATED }),
          Preferences.get({ key: STORAGE_KEYS.IS_TRACKING }),
          Preferences.get({ key: STORAGE_KEYS.LOCATION_ENABLED })
        ])

        if (userDataResult.value) {
          setUserData(JSON.parse(userDataResult.value))
        }
        if (consentResult.value) {
          setHasConsented(consentResult.value === 'true')
        }
        if (authResult.value) {
          setIsAuthenticated(authResult.value === 'true')
        }
        if (trackingResult.value) {
          setIsTracking(trackingResult.value === 'true')
        }
        if (locationResult.value) {
          setLocationEnabled(locationResult.value === 'true')
        }
      } catch (error) {
        console.error('Error loading state:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadState()
  }, [])

  // Save state changes
  useEffect(() => {
    if (isLoading) return

    if (userData) {
      Preferences.set({ key: STORAGE_KEYS.USER_DATA, value: JSON.stringify(userData) })
    }
  }, [userData, isLoading])

  useEffect(() => {
    if (isLoading) return
    Preferences.set({ key: STORAGE_KEYS.HAS_CONSENTED, value: String(hasConsented) })
  }, [hasConsented, isLoading])

  useEffect(() => {
    if (isLoading) return
    Preferences.set({ key: STORAGE_KEYS.IS_AUTHENTICATED, value: String(isAuthenticated) })
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    if (isLoading) return
    Preferences.set({ key: STORAGE_KEYS.IS_TRACKING, value: String(isTracking) })
  }, [isTracking, isLoading])

  useEffect(() => {
    if (isLoading) return
    Preferences.set({ key: STORAGE_KEYS.LOCATION_ENABLED, value: String(locationEnabled) })
  }, [locationEnabled, isLoading])

  // Clear all user data
  const clearUserData = async () => {
    await Promise.all([
      Preferences.remove({ key: STORAGE_KEYS.USER_DATA }),
      Preferences.remove({ key: STORAGE_KEYS.HAS_CONSENTED }),
      Preferences.remove({ key: STORAGE_KEYS.IS_AUTHENTICATED }),
      Preferences.remove({ key: STORAGE_KEYS.IS_TRACKING }),
      Preferences.remove({ key: STORAGE_KEYS.LOCATION_ENABLED })
    ])
    setUserData(null)
    setHasConsented(false)
    setIsAuthenticated(false)
    setIsTracking(false)
    setLocationEnabled(false)
  }

  // Logout (keep consent, clear auth)
  const logout = async () => {
    await Promise.all([
      Preferences.remove({ key: STORAGE_KEYS.USER_DATA }),
      Preferences.remove({ key: STORAGE_KEYS.IS_AUTHENTICATED }),
      Preferences.remove({ key: STORAGE_KEYS.IS_TRACKING }),
      Preferences.remove({ key: STORAGE_KEYS.LOCATION_ENABLED })
    ])
    setUserData(null)
    setIsAuthenticated(false)
    setIsTracking(false)
    setLocationEnabled(false)
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <AppContext.Provider value={{
      userData,
      setUserData,
      hasConsented,
      setHasConsented,
      isAuthenticated,
      setIsAuthenticated,
      isTracking,
      setIsTracking,
      locationEnabled,
      setLocationEnabled,
      serverUrl,
      wsUrl,
      clearUserData,
      logout
    }}>
      <BrowserRouter>
        <div className="h-screen bg-dark-bg overflow-hidden">
          <Routes>
            {/* Consent flow */}
            {!hasConsented && (
              <Route path="*" element={<ConsentPage />} />
            )}

            {/* Authentication flow */}
            {hasConsented && !isAuthenticated && (
              <>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/request-access" element={<RequestAccessPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            )}

            {/* Main app (authenticated) */}
            {hasConsented && isAuthenticated && userData && (
              <>
                <Route path="/" element={<MainPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </div>
      </BrowserRouter>
    </AppContext.Provider>
  )
}

export default App
