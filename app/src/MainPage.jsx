import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useEffect, useRef, useState } from 'react'
import pearSprite from './assets/pearProgrammerSprite.png'
import pearExplainingSprite from './assets/pearProgrammerExplainingSprite.png'
import pearHappySprite from './assets/pearProgrammerHAPPYSprite.png'
import pearThinkingSprite from './assets/pearProgrammerThinkingSprite.png'
import { exercises } from './exercises.js'
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
}
  const [isChatLogOpen, setIsChatLogOpen] = useState(false)
  const categoryDialogRef = useRef(null)
  const [selectedCategory, setSelectedCategory] = useState(
    () => new URLSearchParams(window.location.search).get('category') ?? '',
  )
  const selectedExercise = exercises[selectedCategory]
  //States of initial code, scroll position of the editor, and line count for line numbers
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
  const [sentCodeCharacters, setSentCodeCharacters] = useState(null)
  const [history, setHistory] = useState([])

// Python code editor state
const [consoleOutput, setConsoleOutput] = useState('Press Run code to see the output here.')
const [codeWorks, setCodeWorks] = useState(false)
const [hasRunCode, setHasRunCode] = useState(false)
const [isRunningCode, setIsRunningCode] = useState(false)
const pythonWorkerRef = useRef(null)
const runIdRef = useRef(0)

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
    const worker = new Worker(`${import.meta.env.BASE_URL}python.worker.js`, {
      type: 'module',
    })

    pythonWorkerRef.current = worker

    worker.onmessage = (event) => {
      const result = event.data

      // Ignore older code runs
      if (result.id !== runIdRef.current) {
        return
      }

      setConsoleOutput(result.output)
      setCodeWorks(result.codeWorks)
      setHasRunCode(true)
      setIsRunningCode(false)
    }

    worker.onerror = (event) => {
      setConsoleOutput(`Error in Python worker: ${event.message}`)
      setCodeWorks(false)
      setHasRunCode(true)
      setIsRunningCode(false)
    }

    return () => {
      worker.terminate()
      pythonWorkerRef.current = null
    }
  }, [])

  //Handle button click for category selection
  function handleCategorySelect(event) {
    const { value: category } = event.currentTarget
    const exercise = exercises[category]
    if (!exercise) {
      return
    }

    setSelectedCategory(category)
    setCode(exercise.starterCode)
    previousSubmittedCodeRef.current = exercise.starterCode
    setHistory([])
    setQuestion('')
    setRequestError('')
    setStreamingAnswer('')
    runIdRef.current += 1
    setConsoleOutput('Press Run code to see the output here.')
    setCodeWorks(false)
    setHasRunCode(false)
    setIsRunningCode(false)
    window.history.replaceState(null, '', `${window.location.pathname}?category=${category}`)
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
        const result = await response.json()
        throw new Error(result.error || `Request failed (${response.status}).`)
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
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'Could not send the question.',
      )
    } finally {
      setIsSending(false)
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
  }

  async function handleRunCode() {
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
    setConsoleOutput('Running code...')
    setCodeWorks(false)
    setHasRunCode(false)

        // Check that this is still the latest run
    if (runId !== runIdRef.current || !pythonWorkerRef.current) {
      return
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
        aria-expanded={isChatLogOpen}
        aria-controls="chat-log-panel"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H11l-4.5 4v-4h-.75A2.75 2.75 0 0 1 3 13.25v-7.5A2.75 2.75 0 0 1 5.75 3" />
          <path d="M7.5 8h9M7.5 11.5h6" />
        </svg>
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
            {isRunningCode
              ? 'Executing Python...'
              : hasRunCode
                ? codeWorks
                  ? 'Code works'
                  : 'Code has an error'
                : 'Not run yet'}
          </div>
        </section>
      </div>

      <form className="prompt-form" onSubmit={handleQuestionSubmit}>
        {selectedExercise && (
          <section className="exercise-briefing" aria-label="Exercise instructions">
            <strong>{selectedExercise.label} exercise</strong>
            <p>{selectedExercise.explanation}</p>
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
