import React, { useState, useRef, useEffect } from 'react'
import {
  Box, TextField, IconButton, Typography, Paper, Chip,
  CircularProgress, Avatar, Tooltip, Button, Select,
  MenuItem, FormControl, InputLabel, Divider
} from '@mui/material'
import { Send, SmartToy, Person, Delete, Psychology } from '@mui/icons-material'
import axios from 'axios'

export default function TextAgent() {
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [mode, setMode]           = useState('interview')
  const [userName, setUserName]   = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [started, setStarted]     = useState(false)
  const [stats, setStats]         = useState({ chunks: 0, topics: 0 })
  const [sessions, setSessions]   = useState([])
  const [selSession, setSelSession] = useState(null)
  const bottomRef = useRef()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { loadSessions() }, [])

  const loadSessions = async () => {
    try {
      const res = await axios.get('/api/sessions')
      setSessions(res.data || [])
    } catch {}
  }

  const addMsg = (role, text) => setMessages(m => [...m, {
    role, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }])

  const startSession = async () => {
    if (!userName.trim()) return
    const uid = 'text-' + userName.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now()
    setSessionId(uid)
    setMessages([])
    setSelSession(null)
    try {
      const res = await axios.post('/api/voice/start', { user_id: uid, user_name: userName })
      addMsg('bot', res.data.message)
      setStarted(true)
      loadSessions()
    } catch {
      addMsg('bot', "Hi! I'm Alex. What does a typical week in your role look like?")
      setStarted(true)
    }
  }

  const loadPrevSession = (sess) => {
    setSelSession(sess.user_id)
    setUserName(sess.user_name)
    setSessionId(sess.user_id)
    setStarted(sess.status !== 'completed')
    setMessages((sess.conversation_history || []).map(m => ({
      role: m.role === 'assistant' ? 'bot' : 'user',
      text: m.content,
      time: ''
    })))
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    if (mode === 'query') {
      // Detect self-introduction in query mode — auto-switch to interview
      const tl = text.toLowerCase().trim()
      const isIntro = (
        /^(hi|hey|hello|hii|good morning|good afternoon)/.test(tl) ||
        /i am\s+\w+|myself\s+\w+|my name is\s+\w+|i'm\s+\w+/.test(tl) ||
        (tl.split(' ').length <= 5 && /(intern|developer|engineer|manager|analyst|consultant)/.test(tl))
      )
      if (isIntro) {
        // Extract name from intro
        let detectedName = ''
        const nameMatch = text.match(/(?:i am|i'm|myself|name is)\s+([A-Za-z]+)/i)
        if (nameMatch) detectedName = nameMatch[1]
        else {
          // take last word as name if short intro
          const words = text.trim().split(/\s+/)
          if (words.length <= 4) detectedName = words[words.length - 1]
        }
        if (detectedName && detectedName.toLowerCase() !== 'intern' && detectedName.length > 1) {
          setUserName(detectedName)
          setMode('interview')
          addMsg('user', text)
          addMsg('bot', `Nice to meet you, ${detectedName}! Switching you to Interview Mode now. Let me start capturing your expertise — what does a typical day in your role look like?`)
          // Auto-start session
          const uid = 'text-' + detectedName.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now()
          setSessionId(uid)
          setStarted(true)
          try {
            await axios.post('/api/voice/start', { user_id: uid, user_name: detectedName })
          } catch {}
          return
        } else {
          // greeting without clear name — ask for name
          addMsg('user', text)
          addMsg('bot', "Hi there! It looks like you want to start an interview. Switch to Interview Mode using the dropdown above and enter your name to begin.")
          return
        }
      }

      addMsg('user', text)
      setLoading(true)
      try {
        const res = await axios.post('/api/query', { question: text })
        addMsg('bot', res.data.answer)
      } catch {
        try {
          const res = await axios.get('/api/knowledge')
          const answer = buildAnswer(text, res.data || [])
          addMsg('bot', answer)
        } catch { addMsg('bot', 'Could not fetch knowledge base.') }
      }
      finally { setLoading(false) }
      return
    }

    if (!started) { addMsg('bot', 'Please enter your name and start a session first.'); return }
    addMsg('user', text)
    setLoading(true)
    try {
      const res = await axios.post('/api/voice/turn', { user_id: sessionId, user_name: userName, message: text })
      addMsg('bot', res.data.message)
      setStats({ chunks: res.data.chunks_extracted || 0, topics: res.data.topics_covered || 0 })
      if (res.data.session_complete) {
        setStarted(false)
        loadSessions()
      }
    } catch { addMsg('bot', 'Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  const buildAnswer = (q, knowledge) => {
    if (!knowledge.length) return "I haven't captured any knowledge yet. Complete an interview session first."
    const ql = q.toLowerCase()
    const people = [...new Set(knowledge.map(c => c.employee_name).filter(Boolean))]

    if (ql.includes('who') && (ql.includes('talk') || ql.includes('interview') || ql.includes('people')))
      return `I've spoken with ${people.length} people: ${people.join(', ')}.`

    if (ql.includes('how many') && ql.includes('item'))
      return `I've captured ${knowledge.length} knowledge items total.`

    const personMatch = people.find(p => ql.includes(p.toLowerCase().split(' ')[0].toLowerCase()))
    if (personMatch) {
      const items = knowledge.filter(c => c.employee_name === personMatch)
      const byDomain = {}
      items.forEach(c => { const d = c.domain || 'general'; if (!byDomain[d]) byDomain[d] = []; byDomain[d].push(c) })
      let reply = `Here's what I learned from ${personMatch} (${items.length} items):\n\n`
      Object.entries(byDomain).forEach(([dom, chunks]) => {
        reply += `${dom.toUpperCase()}:\n`
        chunks.slice(0,4).forEach(c => { reply += `• ${c.content}\n` })
        if (chunks.length > 4) reply += `  (+${chunks.length-4} more)\n`
        reply += '\n'
      })
      return reply.trim()
    }

    const kw = ql.split(' ').filter(w => w.length > 3 && !['what','when','where','which','have','about','tell','from','this','that','with','they','were','been','does'].includes(w))
    const matches = knowledge.filter(c => kw.some(k => (c.content||'').toLowerCase().includes(k) || (c.topic||'').toLowerCase().includes(k)))
    if (matches.length) {
      return `Found ${matches.length} relevant items:\n\n` + matches.slice(0,6).map(c => `• [${c.topic}] ${c.content} — ${c.employee_name}`).join('\n')
    }

    const topics = [...new Set(knowledge.map(c=>c.topic).filter(Boolean))]
    return `I have ${knowledge.length} knowledge items from ${people.join(', ')}.\n\nTop topics: ${topics.slice(0,6).join(', ')}.\n\nTry asking about a specific person or topic.`
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 90px)', gap: 2 }}>

      {/* Sessions sidebar */}
      <Box sx={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>Sessions</Typography>
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {sessions.map(s => (
            <Paper key={s.user_id} elevation={0} onClick={() => loadPrevSession(s)}
              sx={{ p: 1.2, cursor: 'pointer', border: '1px solid', borderColor: selSession===s.user_id ? 'primary.main' : 'divider', borderRadius: 2, bgcolor: selSession===s.user_id ? 'rgba(220,38,38,0.08)' : 'background.paper', '&:hover': { borderColor: 'primary.main' }, transition: 'all 0.15s' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 12, noWrap: true }}>{s.user_name}</Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{s.chunks_extracted} items · {s.status}</Typography>
            </Paper>
          ))}
          {!sessions.length && <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', py: 2 }}>No sessions yet</Typography>}
        </Box>
      </Box>

      {/* Main chat */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Mode</InputLabel>
            <Select value={mode} label="Mode" onChange={e => setMode(e.target.value)}>
              <MenuItem value="interview">
                <Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>🎤 Interview Mode</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Alex interviews you — type your answers</Typography></Box>
              </MenuItem>
              <MenuItem value="query">
                <Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>🔍 Ask Alex</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Query uploaded docs & knowledge base</Typography></Box>
              </MenuItem>
            </Select>
          </FormControl>
          {/* Active mode indicator */}
          <Box sx={{ px: 1.5, py: 0.7, bgcolor: mode === 'interview' ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)',
            border: '1px solid', borderColor: mode === 'interview' ? 'rgba(34,197,94,0.25)' : 'rgba(59,130,246,0.25)',
            borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: mode === 'interview' ? '#22c55e' : '#3b82f6', flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: mode === 'interview' ? '#22c55e' : '#3b82f6' }}>
              {mode === 'interview' ? 'INTERVIEW — Alex will ask you questions' : 'ASK ALEX — query your documents & interviews'}
            </Typography>
          </Box>
          {!started && mode === 'interview' && (
            <>
              <TextField size="small" placeholder="Your name" value={userName} onChange={e => setUserName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startSession()} sx={{ width: 180 }} />
              <Button variant="contained" size="small" onClick={startSession} disabled={!userName.trim()}>Start Session</Button>
            </>
          )}
          {started && (
            <>
              <Chip label={`👤 ${userName}`} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#22c55e' }} />
              <Chip label={`${stats.chunks} items captured`} size="small" sx={{ bgcolor: 'rgba(220,38,38,0.12)', color: 'primary.main' }} />
            </>
          )}
          {mode === 'query' && <Chip label="🔍 Ask Alex Mode" size="small" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6' }} />}
          <Tooltip title="Clear chat">
            <IconButton size="small" onClick={() => setMessages([])} sx={{ ml: 'auto', color: 'text.secondary' }}><Delete fontSize="small" /></IconButton>
          </Tooltip>
        </Box>

        {/* Messages */}
        <Paper elevation={0} sx={{ flex: 1, overflow: 'auto', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {messages.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <SmartToy sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
              <Typography sx={{ fontSize: 14 }}>{mode === 'interview' ? 'Enter your name above to start the interview' : 'Ask Alex anything about the captured knowledge'}</Typography>
              {mode === 'query' && (
                <Box sx={{ mt: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 500, mx: 'auto' }}>
                  {['What have you learned?','Who have you talked to?','What did Harsh discuss?','What topics were covered?'].map(q => (
                    <Chip key={q} label={q} size="small" onClick={() => { setInput(q) }} variant="outlined"
                      sx={{ fontSize: 11, cursor: 'pointer', '&:hover': { borderColor: 'primary.main', color: 'white' } }} />
                  ))}
                </Box>
              )}
            </Box>
          )}
          {messages.map((msg, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: msg.role === 'bot' ? 'primary.main' : '#1d6fab', fontSize: 13, flexShrink: 0 }}>
                {msg.role === 'bot' ? <SmartToy sx={{ fontSize: 16 }} /> : <Person sx={{ fontSize: 16 }} />}
              </Avatar>
              <Box sx={{ maxWidth: '74%' }}>
                <Paper elevation={0} sx={{
                  px: 1.5, py: 1,
                  bgcolor: msg.role === 'bot' ? 'background.paper' : '#1d4a7a',
                  border: '1px solid', borderColor: 'divider',
                  borderRadius: msg.role === 'bot' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                }}>
                  <Typography sx={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{msg.text}</Typography>
                </Paper>
                {msg.time && <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.3, px: 0.5, textAlign: msg.role === 'user' ? 'right' : 'left' }}>{msg.time}</Typography>}
              </Box>
            </Box>
          ))}
          {loading && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main' }}><SmartToy sx={{ fontSize: 16 }} /></Avatar>
              <Paper elevation={0} sx={{ px: 2, py: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '4px 12px 12px 12px', display: 'flex', gap: 0.5, alignItems: 'center' }}>
                {[0,1,2].map(i => (
                  <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.secondary',
                    animation: 'bounce 1.2s infinite', animationDelay: `${i*0.2}s`,
                    '@keyframes bounce': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } } }} />
                ))}
              </Paper>
            </Box>
          )}
          <div ref={bottomRef} />
        </Paper>

        {/* Input */}
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
          <TextField fullWidth multiline maxRows={4} size="small"
            placeholder={mode === 'query' ? 'Ask: "What did Harsh discuss?" or "What topics were covered today?"' : 'Type your answer to Alex...'}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          <IconButton onClick={send} disabled={loading || !input.trim()}
            sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 2, px: 2, alignSelf: 'flex-end',
              '&:hover': { bgcolor: '#b91c1c' }, '&:disabled': { bgcolor: 'divider' } }}>
            <Send />
          </IconButton>
        </Box>
      </Box>
    </Box>
  )
}
