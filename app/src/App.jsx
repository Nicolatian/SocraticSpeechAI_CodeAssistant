import { useEffect, useState } from 'react'
import pearSprite from './assets/pearProgrammerSprite.png'
import MainPage from './MainPage.jsx'
import './App.css'

function ArrowIcon() {
  return (
    <svg
      className="btn-arrow"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  )
}

function App() {
  const [userId, setUserId] = useState('')
  const [currentPage, setCurrentPage] = useState('loading')

  // Check the URL after the component has mounted
  useEffect(() => {
    function checkPage() {
      if (window.location.pathname === '/MainPage') {
        setCurrentPage('main')
      } else {
        setCurrentPage('home')
      }
    }

    checkPage()

    // Listen for browser back/forward navigation
    window.addEventListener('popstate', checkPage)

    return () => {
      window.removeEventListener('popstate', checkPage)
    }
  }, [])

  
async function handleLogin(event) {
  event.preventDefault()

  const trimmedId = userId.trim()

  if (!trimmedId) {
    return
  }

  // Package the User ID as JSON
  const loginData = {
    userId: trimmedId
  }

  try {
    const response = await fetch('/api/log-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    })

    if (!response.ok) {
      throw new Error('Could not register user.')
    }

    // Save the User ID in F12 application session storage for later use
    sessionStorage.setItem('pear-user-id', trimmedId)

    // Navigate to MainPage
    window.history.pushState({}, '', '/MainPage')
    setCurrentPage('main')

  } catch (error) {
    console.error(error)
    alert('Could not log in. Please try again.')
  }
}

  function handleExit() {
    setUserId('')
    window.close()
  }

  if (currentPage === 'loading') {
    return <main>Loading PEAR...</main>
  }

  if (currentPage === 'main') {
    return <MainPage />
  }

  return (
    <main className="start-page">
      {/* LEFT SIDE: title, info and login */}
      <section className="login-panel">
        <h1 className="logo-title">Programming Pear</h1>

        <div className="info">
          <h2>Hvad er Pear Programmer?</h2>
          <p>
            Pear Programmer er en hjemmeside, der lærer dig at skrive og køre
            Python-kode direkte i browseren.
          </p>

          <h2>Hvordan virker det?</h2>
          <p>
            Pear Programmer bruger Pyodide, som gør det muligt at køre
            Python-kode direkte i browseren. Du skriver din kode i
            kodeeditoren og ser resultatet med det samme.
          </p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <label className="visually-hidden" htmlFor="login-id">
            Login ID
          </label>
          <input
            id="login-id"
            className="login-input"
            type="text"
            placeholder="Insert LogIn ID"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="username"
            required
          />

          <button type="submit" className="btn btn-login">
            <span>Log ind</span>
            <ArrowIcon />
          </button>
        </form>
      </section>

      {/* RIGHT SIDE: purple stage with the pear */}
      <section className="stage" aria-label="Pear Programmer">
        <div className="pear-wrap">
          <p className="speech-bubble">Er du klar til at lære noget kode?!</p>
          <img
            src={pearSprite}
            className="pear"
            alt="Pear Programmer Sprite"
          />
        </div>
      </section>
    </main>
  )
}

export default App
