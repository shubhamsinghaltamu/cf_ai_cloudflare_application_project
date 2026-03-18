import { useState, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import './index.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  id: string
  title: string
  created_at: string
  pinned?: boolean
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768)
  const [warningMessage, setWarningMessage] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load all sessions
  const loadSessions = () => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then((data: Session[]) => {
        // Enforce sorting locally to ensure pins are always at top
        data.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setSessions(data);
      })
      .catch(err => console.error("Failed to load sessions", err))
  }

  useEffect(() => {
    loadSessions()
    
    let sid = localStorage.getItem('cf_ai_session')
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 15)
      localStorage.setItem('cf_ai_session', sid)
    }
    setCurrentSessionId(sid)

    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!currentSessionId) return
    localStorage.setItem('cf_ai_session', currentSessionId)
    // Load chat history for session
    fetch(`/api/history/${currentSessionId}`)
      .then(res => res.json())
      .then((history: Message[]) => {
        if (history.length > 0) {
          setMessages(history.map(m => ({ role: m.role, content: m.content })))
        } else {
          setMessages([{ role: 'assistant', content: 'Hello! I am Llama 3.3. How can I help you today?' }])
        }
      })
      .catch(err => {
        console.error("Failed to load history", err)
        setMessages([{ role: 'assistant', content: 'Welcome! Start typing to begin.' }])
      })
  }, [currentSessionId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleNewChat = () => {
    const sid = Math.random().toString(36).substring(2, 15)
    setCurrentSessionId(sid)
    setMessages([{ role: 'assistant', content: 'Hello! I am Llama 3.3. How can I help you today?' }])
    if (window.innerWidth < 768) setIsSidebarOpen(false)
  }

  const handleSelectSession = (sid: string) => {
    setCurrentSessionId(sid)
    if (window.innerWidth < 768) setIsSidebarOpen(false)
  }

  const handleDeleteChat = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this chat?')) return
    try {
      await fetch(`/api/sessions/${sid}`, { method: 'DELETE' })
      if (currentSessionId === sid) {
        handleNewChat()
      }
      loadSessions()
    } catch (err) {
      console.error("Failed to delete chat", err)
    }
  }

  const handleTogglePin = async (e: React.MouseEvent, sid: string, pinned: boolean) => {
    e.stopPropagation()
    
    // Check limit
    if (!pinned) {
      const pinnedCount = sessions.filter(s => s.pinned).length
      if (pinnedCount >= 3) {
        setWarningMessage('Only 3 chats are allowed to be pinned.')
        setTimeout(() => setWarningMessage(''), 3000)
        return
      }
    }
    
    try {
      await fetch(`/api/sessions/${sid}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !pinned })
      })
      loadSessions()
    } catch (err) {
      console.error("Failed to pin chat", err)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg = input.trim()
    setInput('')
    setIsLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, message: userMsg })
      })
      if (!res.ok) throw new Error('Network response was not ok')
      
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      loadSessions() // Refresh sidebar titles
    } catch (error) {
      console.error("Failed to send message", error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Could not connect to the AI model.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  return (
    <div className="layout">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && window.innerWidth < 768 && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <button className="new-chat-btn" onClick={handleNewChat}>
          + New Chat
        </button>
        {warningMessage && (
          <div className="warning-box">
            {warningMessage}
          </div>
        )}
        <div className="sessions-list">
          {sessions.map(s => (
            <div 
              key={s.id} 
              className={`session-item ${s.id === currentSessionId ? 'active' : ''}`}
              onClick={() => handleSelectSession(s.id)}
            >
              <div className="session-info">
                {s.pinned && <span className="pin-icon">📌</span>}
                <span className="session-title">{s.title.length > 30 ? s.title.substring(0, 30) + '...' : s.title}</span>
              </div>
              <div className="session-actions">
                <button className="action-btn" onClick={(e) => handleTogglePin(e, s.id, s.pinned || false)} title={s.pinned ? "Unpin" : "Pin"}>
                  {s.pinned ? '📍' : '📌'}
                </button>
                <button className="action-btn delete-btn" onClick={(e) => handleDeleteChat(e, s.id)} title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="app-container">
        <div className="header">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
          <span>Cloudflare AI Chat</span>
        </div>
        
        <div className="chat-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant loading-indicator">
              <div className="loading-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <input
              type="text"
              placeholder="Ask Llama 3.3 anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              autoComplete="off"
              autoFocus
            />
            <button onClick={handleSend} disabled={!input.trim() || isLoading}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
