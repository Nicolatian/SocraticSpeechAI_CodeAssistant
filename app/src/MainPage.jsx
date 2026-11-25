import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useEffect, useRef, useState } from 'react'
import pearSprite from './assets/pearProgrammerSprite.png'
import pearExplainingSprite from './assets/pearProgrammerExplainingSprite.png'
import pearHappySprite from './assets/pearProgrammerHAPPYSprite.png'
import pearThinkingSprite from './assets/pearProgrammerThinkingSprite.png'
import pearKnowledgeIcon from './assets/PearKnowledgeIcon.png'
import { exercises, exercisesByCategory } from './exercises.js'
import './MainPage.css'
import './MainPage.compiler.css'
const MAX_HISTORY_MESSAGES = 12
const MAX_HISTORY_CHARACTERS = 8_000
//Get the most recent messages from the chat history
function getRecentHistory(messages) {
  let startIndex = messages.length
  let characterCount = 0
  while (startIndex >= 2 && messages.length - startIndex < MAX_HISTORY_MESSAGES) {
    const userMessage = messages[startIndex - 2]
    const assistantMessage = messages[startIndex - 1]
    const pairLength = userMessage.content.length + assistantMessage.content.length
    if (characterCount + pairLength > MAX_HISTORY_CHARACTERS) {
      if (startIndex === messages.length) {
        const userContent = userMessage.content.slice(-MAX_HISTORY_CHARACTERS)
        const assistantContent = assistantMessage.content.slice(
          0,
          MAX_HISTORY_CHARACTERS - userContent.length,
        )
        return [
          { ...userMessage, content: userContent },
          { ...assistantMessage, content: assistantContent },
        ]
      }
      break
    }
    characterCount += pairLength
    startIndex -= 2
  }
  return messages.slice(startIndex)
}
async function* readServerEvents(response) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('The server did not start a streaming response.')
  }
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ''
      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .find((line) => line.startsWith('data:'))
          ?.slice(5)
          .trim()
        if (data) {
          yield JSON.parse(data)
        }
      }
      if (done) {
        break
      }
    }
    if (buffer.trim()) {
      const data = buffer
        .split(/\r?\n/)
        .find((line) => line.startsWith('data:'))
        ?.slice(5)
        .trim()
      if (data) {
        yield JSON.parse(data)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
async function readJsonResponse(response, service) {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`${service} returned a non-JSON response (${response.status}).`)
  }
  const body = await response.text()
  if (!body.trim()) {
    throw new Error(`${service} returned an empty response (${response.status}).`)
  }
  try {
    return JSON.parse(body)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${service} returned invalid JSON (${response.status}).`)
    }
    throw error
  }
}
async function getResponseError(response, service) {
  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = await response.text()
    if (body.trim()) {
      try {
        const result = JSON.parse(body)
        if (typeof result?.error === 'string') {
          return result.error
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) {
          throw error
        }
      }
    }
  }
  return `${service} request failed (${response.status}).`
}
function MainPage() {
  const userId = sessionStorage.getItem('pear-user-id')
  const tutorialKey = `pear-tutorial-seen:${userId}`
  const [showTutorial, setShowTutorial] = useState(
    () => Boolean(userId) && sessionStorage.getItem(tutorialKey) !== 'true',
  )
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(!showTutorial)
  //vi bruger id nu tjekker om det førster login så viser den tut
  const [tutorialStep, setTutorialStep] = useState(null)
const tutorialSprites = {
  2: pearExplainingSprite,
  3: pearHappySprite,
  4: pearThinkingSprite,
  5: pearExplainingSprite,
}
  const [isChatLogOpen, setIsChatLogOpen] = useState(false)
  const categoryDialogRef = useRef(null)
  const [selectedCategory, setSelectedCategory] = useState(
    () => new URLSearchParams(window.location.search).get('category') ?? '',
  )
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const exerciseDraftsRef = useRef(new Map())
  const categoryExercises = exercisesByCategory[selectedCategory] ?? []
  const selectedExercise = categoryExercises[exerciseIndex]  //States of initial code, scroll position of the editor, and line count for line numbers
  const [code, setCode] = useState(
    selectedExercise?.starterCode ?? '# Select a category to load its exercise.\n',
  )
  const lineCount = code.split('\n').length
  const previousSubmittedCodeRef = useRef(
    selectedExercise?.starterCode ?? '# Select a category to load its exercise.\n',
  )
  const [editorScrollTop, setEditorScrollTop] = useState(0)
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [streamingAnswer, setStreamingAnswer] = useState('')
  const [requestError, setRequestError] = useState('')
  const [speechError, setSpeechError] = useState('')
  const [speechAudioUrl, setSpeechAudioUrl] = useState('')
  const speechAudioRef = useRef(null)
  const [sentCodeCharacters, setSentCodeCharacters] = useState(null)
  const [history, setHistory] = useState([])
  useEffect(() => {
    if (!speechAudioUrl || !speechAudioRef.current) {
      return
    }
    const audio = speechAudioRef.current
    audio.load()
    audio.play().catch((error) => {
      const playbackWasBlocked =
        error instanceof Error && error.name === 'NotAllowedError'
      setSpeechError(
        playbackWasBlocked
          ? 'Automatic playback was blocked by the browser.'
          : `Audio playback failed: ${
              error instanceof Error ? error.message : 'Unknown playback error.'
            }`,
      )
    })
  }, [speechAudioUrl])
// Python code editor state
const [consoleOutput, setConsoleOutput] = useState('Press Run code to see the output here.')
const [solutionCorrect, setSolutionCorrect] = useState(null)
const [isVerifying, setIsVerifying] = useState(false)
const [verificationError, setVerificationError] = useState('')
const verificationRunsRef = useRef(new Map())
const [codeWorks, setCodeWorks] = useState(false)
const [hasRunCode, setHasRunCode] = useState(false)
const [isRunningCode, setIsRunningCode] = useState(false)
const [runCount, setRunCount] = useState(null)
const [runTrackingError, setRunTrackingError] = useState('')
const pythonWorkerRef = useRef(null)
const runIdRef = useRef(0)
const runStartsRef = useRef(new Map())
useEffect(() => {
  if (!userId) return
  let cancelled = false
  async function loadRunCount() {
    try {
      const response = await fetch(
        `/api/run-count?userId=${encodeURIComponent(userId)}`,
      )
      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Run count API'))
      }
      const result = await readJsonResponse(response, 'Run count API')
      if (!Number.isInteger(result.runCount) || result.runCount < 0) {
        throw new Error('The server returned an invalid run count.')
      }
      if (!cancelled) {
        setRunCount((current) =>
          current === null ? result.runCount : Math.max(current, result.runCount),
        )
        setRunTrackingError('')
      }
    } catch (error) {
      if (!cancelled) {
        setRunTrackingError(
          error instanceof Error ? error.message : 'Could not load run count.',
        )
      }
    }
  }
  loadRunCount()
  return () => {
    cancelled = true
  }
}, [userId])
useEffect(() => {
  try {
    const historyStorageKey = 'pear-programmer-chat-history-v4'
    window.localStorage.removeItem(historyStorageKey)
    Object.keys(exercises).forEach((category) => {
      window.localStorage.removeItem(`${historyStorageKey}:${category}`)
    })
  } catch (error) {
    console.error('Could not remove previously saved chat history.', error)
  }
}, [])
 useEffect(() => {
    if (!showTutorial) return
    let disposed = false
    const tour = driver({
      showProgress: true,
      overlayOpacity: 0.4,
onHighlightStarted: (_element, _step, { state }) => {
  setTutorialStep((state.activeIndex ?? 0) + 1)
},
      disableActiveInteraction: true,
      nextBtnText: 'Næste',
      prevBtnText: 'Tilbage',
      doneBtnText: 'Vælg kategori',
      closeBtnLabel: 'Spring tutorialen over',
      steps: [
        {
          element: '.pear-preview',
          popover: {
            title: 'Hej, jeg er Per!',
            description:
              'Vi finder fejl i små Python-programmer sammen. Jeg stiller spørgsmål og diskuterer med dig, så du selv kan finde frem til en rettelse.',
          },
        },
        {
          element: '.code-editor',
          popover: {
            title: 'Ret koden her',
            description:
              'Hver opgave starter med et lille stykke kode. Her kan du slette eller tilføje kode linjer.',
          },
        },
        {
          element: '.python-console',
          popover: {
            title: 'Kør koden og se resultatet',
            description:
              'Brug "Run code" knappen for at se, hvad programmet udskriver, eller hvilken fejl der eventuelt opstår.',
          },
        },
       {
          element: '.chat-log-toggle',
          popover: {
            title: 'Se samtalen igen',
            description: 'Her kan du genlæse vores samtale, f.eks. hvis du bliver i tvivl om jeg måske hørte forkert.',
          },
        },
        {
          element: '.category-toggle',
          popover: {
            title: 'Vælg lærings-kategori',
            description: 'Her kan du ændre kategori hvis du fortryder eller vil have en pause fra den nuværende.',
          },
        },
      ],
      onDestroyed: () => {
        if (disposed) return 
        
        setTutorialStep(null)
        sessionStorage.setItem(tutorialKey, 'true')
        setShowTutorial(false)
        setIsCategoryDialogOpen(true)
      },
    })
    const frame = requestAnimationFrame(() => tour.drive())
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      if (tour.isActive()) tour.destroy()
    }
  }, [showTutorial, tutorialKey])
  useEffect(() => {
    if (isCategoryDialogOpen && categoryDialogRef.current && !categoryDialogRef.current.open) {
      categoryDialogRef.current.showModal()
    }
  }, [isCategoryDialogOpen])
  // Start the Python worker once. Python runs away from the React UI thread.
  useEffect(() => {
    function recordCodeRunCompletion(runId, codeWorks) {
      const run = runStartsRef.current.get(runId)
      if (!userId || !run) return
      runStartsRef.current.delete(runId)
      fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: run.code,
          exerciseId: run.exerciseId,
          codeWorks,
          durationSeconds: (performance.now() - run.startedAt) / 1000,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(await getResponseError(response, 'Run tracking API'))
          }
          const result = await readJsonResponse(response, 'Run tracking API')
          if (!Number.isInteger(result.runNumber) || result.runNumber < 1) {
            throw new Error('The server returned an invalid run number.')
          }
          setRunCount((current) =>
            current === null ? result.runNumber : Math.max(current, result.runNumber),
          )
          setRunTrackingError('')
        })
        .catch((error) => {
          setRunTrackingError(
            error instanceof Error ? error.message : 'Could not save code run.',
          )
        })
    }
    const worker = new Worker(`${import.meta.env.BASE_URL}python.worker.js`, {
      type: 'module',
    })
    pythonWorkerRef.current = worker
    worker.onmessage = (event) => {
  const result = event.data

  const verificationRun = verificationRunsRef.current.get(result.id)
  verificationRunsRef.current.delete(result.id)

  recordCodeRunCompletion(result.id, result.codeWorks === true)

  // Ignore older code runs
  if (result.id !== runIdRef.current) {
    return
  }

  setConsoleOutput(result.output)
  setCodeWorks(result.codeWorks)
  setHasRunCode(true)
  setIsRunningCode(false)

  // Only verify code that executed successfully
  if (
    result.codeWorks &&
    verificationRun?.exercisePrompt &&
    verificationRun.verificationCriteria.length > 0
  ) {
    verifySolution(
  {
    exercisePrompt: verificationRun.exercisePrompt,
    verificationCriteria: verificationRun.verificationCriteria,
  },
  verificationRun.code,
  result.output,
  result.id
)
  } else {
    setSolutionCorrect(false)
  }
}
    worker.onerror = (event) => {
      recordCodeRunCompletion(runIdRef.current, false)
      setConsoleOutput(`Error in Python worker: ${event.message}`)
      setCodeWorks(false)
      setHasRunCode(true)
      setIsRunningCode(false)
    }
    return () => {
      worker.terminate()
      pythonWorkerRef.current = null
    }
  }, [userId])
  //Handle button click for category selection
   function loadExercise(category, index) {
    const exercise = exercisesByCategory[category]?.[index]
    setSolutionCorrect(null)
    setVerificationError('')
    if (!exercise || isSending) return

    if (selectedExercise) {
      exerciseDraftsRef.current.set(selectedExercise, code)
    }

    setSelectedCategory(category)
    setExerciseIndex(index)
    setCode(exerciseDraftsRef.current.get(exercise) ?? exercise.starterCode)
    previousSubmittedCodeRef.current = exercise.starterCode
    setEditorScrollTop(0)

    setHistory([])
    setQuestion('')
    setRequestError('')
    setSpeechError('')
    setSpeechAudioUrl('')
    setStreamingAnswer('')
    setSentCodeCharacters(null)

    runIdRef.current += 1
    setConsoleOutput('Press Run code to see the output here.')
    setCodeWorks(false)
    setHasRunCode(false)
    setIsRunningCode(false)
  }

  function handleCategorySelect(event) {
    const { value: category } = event.currentTarget

    if (!exercisesByCategory[category] || isSending) return

    if (category !== selectedCategory) {
      loadExercise(category, 0)
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}?category=${category}`,
      )
    }

    categoryDialogRef.current?.close()
  }
  function saveHistory(messages) {
    setHistory(messages)
  }
  async function sendQuestion(
    prompt,
    exercise = selectedExercise,
    codeToSend = code,
    conversation = history,
  ) {
    const trimmedQuestion = prompt.trim()
    if (!trimmedQuestion) {
      return
    }
    const exerciseContext = exercise?.exercisePrompt ?? ''
    const previousCode = previousSubmittedCodeRef.current
    //Send a question to the backend API and handle the response
    setIsSending(true)
    setRequestError('')
    setSpeechError('')
    setSpeechAudioUrl('')
    setStreamingAnswer('')
    setSentCodeCharacters(null)
    try {
      const response = await fetch('/api/ask/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: window.sessionStorage.getItem('pear-user-id'),
          exerciseId: selectedCategory || null,
          question: trimmedQuestion,
          code: codeToSend,
          previousCode,
          history: getRecentHistory(conversation),
          exerciseContext,
        }),
      })
      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Prompt API'))
      }
      if (response.headers.get('content-type')?.includes('text/event-stream') !== true) {
        throw new Error('The server returned an invalid streaming response.')
      }
      const codeCharacters = Number(response.headers.get('x-code-characters'))
      if (codeCharacters !== codeToSend.length) {
        throw new Error(
          'The prompt API did not confirm the editor code. Restart prompt_server.py and try again.',
        )
      }
      let answer = ''
      let responseComplete = false
      for await (const event of readServerEvents(response)) {
        if (typeof event.token === 'string') {
          answer += event.token
          setStreamingAnswer(answer)
        } else if (typeof event.warning === 'string') {
          setRequestError(event.warning)
        } else if (typeof event.error === 'string') {
          throw new Error(event.error)
        } else if (event.done === true) {
          responseComplete = true
        }
      }
      if (!responseComplete) {
        throw new Error('The server ended the response before generation completed.')
      }
      saveHistory([
        ...conversation,
        { role: 'user', content: trimmedQuestion },
        { role: 'assistant', content: answer },
      ])
      setStreamingAnswer('')
      previousSubmittedCodeRef.current = codeToSend
      setSentCodeCharacters(codeCharacters)
      setQuestion('')
      try {
        const speechResponse = await fetch('/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: answer }),
        })
        if (!speechResponse.ok) {
          throw new Error(await getResponseError(speechResponse, 'TTS server'))
        }
        const result = await readJsonResponse(speechResponse, 'TTS server')
        if (typeof result.audioUrl !== 'string') {
          throw new Error('The TTS server returned an invalid audio response.')
        }
        setSpeechAudioUrl(`${result.audioUrl}?v=${Date.now()}`)
      } catch (error) {
        setSpeechError(
          error instanceof Error
            ? `Speech could not be generated: ${error.message}`
            : 'Speech could not be generated.',
        )
      }
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'Could not send the question.',
      )
    } finally {
      setIsSending(false)
    }
  }
  async function verifySolution(exercise, code, output, runId) {
  setIsVerifying(true)
  setSolutionCorrect(null)
  setVerificationError('')

  try {
    const response = await fetch('/api/verify-solution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercisePrompt: exercise.exercisePrompt,
        verificationCriteria: exercise.verificationCriteria,
        code,
        output,
        error: null,
      }),
    })

    if (!response.ok) {
      throw new Error(
        await getResponseError(response, 'Solution verification API')
      )
    }

    const result = await readJsonResponse(
      response,
      'Solution verification API'
    )

    if (typeof result.solutionCorrect !== 'boolean') {
      throw new Error('The verification API returned an invalid result.')
    }

    if (runId === runIdRef.current) {
    setSolutionCorrect(result.solutionCorrect)
}

  } catch (error) {
  if (runId === runIdRef.current) {
    setVerificationError(
      error instanceof Error
        ? error.message
        : 'Could not verify the solution.'
    )
  }
} finally {
  if (runId === runIdRef.current) {
    setIsVerifying(false)
  }
}
}
  async function handleQuestionSubmit(event) {
    event.preventDefault()
    await sendQuestion(question)
  }
  //Clear the chat history
  function handleClearHistory() {
    saveHistory([])
    setRequestError('')
    setSpeechError('')
    setStreamingAnswer('')
  }
  //Handle the tab key in the code editor to insert spaces instead of browser default behavior
  function handleEditorKeyDown(event) {
    if (event.key !== 'Tab') {
      return
    }
    event.preventDefault()
    const editor = event.currentTarget
    editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end')
    setCode(editor.value)
    setCodeWorks(false)
    setHasRunCode(false)
  }
  function handleCodeChange(event) {
    setCode(event.target.value)
    setCodeWorks(false)
    setHasRunCode(false)
    setSolutionCorrect(null)
    setVerificationError('')
  }
  function handleRunCode() {
    if (!code.trim()) {
      setConsoleOutput('Du har ikke skrevet nogen kode. Skriv noget kode og prøv igen.')
      setCodeWorks(false)
      setHasRunCode(true)
      return
    }
    if (!pythonWorkerRef.current) {
      setConsoleOutput('Python kan ikke compile koden. Prøv at genindlæse siden')
      setCodeWorks(false)
      setHasRunCode(true)
      return
    }
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    setIsRunningCode(true)
    setSolutionCorrect(null)
    setVerificationError('')

    verificationRunsRef.current.set(runId, {
      exercisePrompt: selectedExercise?.exercisePrompt ?? '',
      verificationCriteria: selectedExercise?.verificationCriteria ?? [],
      code,
    })
    setConsoleOutput('Running code...')
    setCodeWorks(false)
    setHasRunCode(false)
    if (userId) {
      runStartsRef.current.set(runId, {
        startedAt: performance.now(),
        code,
        exerciseId: selectedCategory || null,
      })
    }
    // Send Python code to the worker
    pythonWorkerRef.current.postMessage({
      id: runId,
      code,
    })
  }
  //Layout with the code, scrollbar and line values integrated
  return (
    <main className="main-page">
      <button
        className="chat-log-toggle"
        type="button"
        onClick={() => setIsChatLogOpen((isOpen) => !isOpen)}
        aria-label={isChatLogOpen ? 'Hide chat log' : 'Show chat log'}
        title={isChatLogOpen ? 'Skjul samtaleloggen' : 'Vis samtaleloggen'}
        aria-expanded={isChatLogOpen}
        aria-controls="chat-log-panel"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H11l-4.5 4v-4h-.75A2.75 2.75 0 0 1 3 13.25v-7.5A2.75 2.75 0 0 1 5.75 3" />
          <path d="M7.5 8h9M7.5 11.5h6" />
        </svg>
      </button>
      <button
  className="category-toggle"
  type="button"
  onClick={() => setIsCategoryDialogOpen(true)}
  disabled={isSending}
  aria-label="Skift læringskategori"
  aria-haspopup="dialog"
  title="Skift læringskategori"
>
  <img src={pearKnowledgeIcon} alt="" />
</button>
      {isChatLogOpen && (
        <section
          className="chat-log-panel"
          id="chat-log-panel"
          aria-label="Chat log"
        >
          <header className="prompt-history-header">
            <span>Historik</span>
            <button
              className="prompt-clear-history"
              type="button"
              onClick={handleClearHistory}
              disabled={isSending}
            >
              Clear history
            </button>
          </header>
          {history.map((message, index) => (
            <article
              className={`prompt-message prompt-message-${message.role}`}
              key={`${index}-${message.role}`}
            >
              <strong>{message.role === 'user' ? 'You' : 'Pear Programmer'}</strong>
              <p>{message.content}</p>
            </article>
          ))}
          {streamingAnswer && (
            <article className="prompt-message prompt-message-assistant">
              <strong>Pear Programmer</strong>
              <p>{streamingAnswer}</p>
            </article>
          )}
          {!history.length && !streamingAnswer && (
            <p className="chat-log-empty">No messages yet.</p>
          )}
        </section>
      )}
      {isCategoryDialogOpen && (
        <dialog
          ref={categoryDialogRef}
          className="category-dialog"
          aria-labelledby="category-dialog-title"
          onClose={() => setIsCategoryDialogOpen(false)}
        >
          <button
  className="category-dialog-close"
  type="button"
  onClick={() => categoryDialogRef.current?.close()}
  aria-label="Luk kategorivælger"
>
  ×
</button>
          <h2 id="category-dialog-title">Vælg en kategori</h2>
          <p>Vælg et emne for at fortsætte.</p>
          <div className="category-options">
            {Object.entries(exercises).map(([category, exercise]) => (
              <button
                key={category}
                type="button"
                value={category}
                onClick={handleCategorySelect}
                aria-pressed={selectedCategory === category}
              >
                {exercise.label}
              </button>
            ))}
          </div>
        </dialog>
      )}
      <section className="pear-stage" aria-label="Pear video preview">
        <a className="counter page-link main-home-link" href="/">
          Hjem
        </a>
        <img
          className="pear-preview"
          src={tutorialSprites[tutorialStep] ?? pearSprite}
          alt="Pear programmer"
        />
      </section>
      <div className="editor-and-output">
        <section className="code-editor" aria-label="Code editor">
          <header className="editor-toolbar">
            <span className="editor-file-name">main.py</span>
            <span className="editor-language">Python</span>
          </header>
          <div className="editor-workspace">
            <pre
              className="editor-line-numbers"
              aria-hidden="true"
              style={{ transform: `translateY(-${editorScrollTop}px)` }}
            >
              {Array.from({ length: lineCount }, (_, index) => index + 1).join('\n')}
            </pre>
            <textarea
              aria-label="Python code"
              className="editor-input"
              value={code}
              onChange={handleCodeChange}
              onKeyDown={handleEditorKeyDown}
              onScroll={(event) => setEditorScrollTop(event.currentTarget.scrollTop)}
              spellCheck="false"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              wrap="off"
            />
          </div>
        </section>
        <section className="python-console" aria-label="Python output">
          <header className="python-console-toolbar">
            <span className="editor-file-name">Output</span>
            <button
              className={`python-run-button${tutorialStep === 3 ? ' tutorial-run-highlight' : ''}`}
              type="button"
              onClick={handleRunCode}
              disabled={isRunningCode}
            >
              {isRunningCode ? 'Running...' : 'Run code'}
            </button>
          </header>
          <pre className="python-console-output" aria-live="polite">
            {consoleOutput}
          </pre>
          <div className="python-console-status" role="status">
            <span>
              {isVerifying
                ? 'Checking solution...'
                : solutionCorrect === null
                  ? 'Not verified'
                  : solutionCorrect
                    ? 'Assignment completed!'
                    : 'Assignment not completed'}
            </span>
            <span>
              {isRunningCode
                ? 'Executing Python...'
                : hasRunCode
                  ? codeWorks
                    ? 'Code works'
                    : 'Code has an error'
                  : 'Not run yet'}
            </span>
            {userId && (
              <span>
                {runCount === null ? 'Loading run count…' : `Your run #${runCount}`}
              </span>
              
            )}
          </div>
          {runTrackingError && (
            <p className="python-console-tracking-error" role="alert">
              Run count could not be updated: {runTrackingError}
            </p>
          )}
        </section>
      </div>
      <form className="prompt-form" onSubmit={handleQuestionSubmit}>
        {speechAudioUrl && (
          <audio
            ref={speechAudioRef}
            hidden
            aria-hidden="true"
            src={speechAudioUrl}
          />
        )}
        {selectedExercise && (
                  <section className="exercise-briefing" aria-label="Exercise instructions">
            <strong>
              Øvelse {exerciseIndex + 1} af {categoryExercises.length} ·{' '}
              {selectedExercise.label}
            </strong>
            <p>{selectedExercise.explanation}</p>

            <nav className="exercise-navigation" aria-label="Øvelsesnavigation">
              {exerciseIndex > 0 && (
                <button
                  className="prompt-submit"
                  type="button"
                  disabled={isSending || isRunningCode}
                  onClick={() => loadExercise(selectedCategory, exerciseIndex - 1)}
                >
                  Forrige øvelse
                </button>
              )}

              {exerciseIndex < categoryExercises.length - 1 && (
                <button
                  className="prompt-submit"
                  type="button"
                  disabled={isSending || isRunningCode}
                  onClick={() => loadExercise(selectedCategory, exerciseIndex + 1)}
                >
                  Næste øvelse
                </button>
              )}
              <details className="exercise-progress" key={selectedCategory}>
  <summary className="prompt-submit exercise-progress-toggle">
    {exercises[selectedCategory].label}{' '}
    <span className="exercise-progress-count">
      {exerciseIndex + 1}/{categoryExercises.length}
    </span>
  </summary>

  <div className="exercise-progress-panel">
    <strong>{exercises[selectedCategory].label}</strong>

    <progress
      aria-label="Placering i kategorien"
      value={exerciseIndex + 1}
      max={categoryExercises.length}
    />

    <ol className="exercise-progress-list">
      {categoryExercises.map((exercise, index) => (
        <li
          key={exercise.label}
          aria-current={index === exerciseIndex ? 'step' : undefined}
        >
          <span>{exercise.label}</span>
          {index === exerciseIndex && <small>Åben nu</small>}
        </li>
      ))}
    </ol>
  </div>
</details>
            </nav>
          </section>
        )}
        <label className="prompt-label" htmlFor="question-input">
          Ask a question
        </label>
        <input
          id="question-input"
          className="prompt-input"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type a question for the LLM"
          required
        />
        <button className="prompt-submit" type="submit" disabled={isSending}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
        {isSending && (
          <p className="prompt-status" role="status">
            Generating response…
          </p>
        )}
        {requestError && (
          <p className="prompt-error" role="alert">
            {requestError}
          </p>
        )}
        {speechError && (
          <p className="prompt-error" role="alert">
            {speechError}
          </p>
        )}
        {sentCodeCharacters !== null && (
          <p className="prompt-context-status" role="status">
            Sent current editor code ({sentCodeCharacters} characters).
          </p>
        )}
      </form>
    </main>
  )
}
export default MainPage
