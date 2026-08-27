import React, { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, Paper, Button, IconButton, Avatar,
  Chip, CircularProgress, Alert, Tooltip
} from '@mui/material'
import { Mic, Stop, SmartToy, Person, VolumeUp } from '@mui/icons-material'
import axios from 'axios'

export default function VoiceAgent() {
  const [messages, setMessages]       = useState([])
  const [listening, setListening]     = useState(false)
  const [processing, setProcessing]   = useState(false)
  const [sessionActive, setSession]   = useState(false)
  const [userName, setUserName]       = useState('')
  const [nameInput, setNameInput]     = useState('')
  const [liveText, setLiveText]       = useState('')
  const [stats, setStats]             = useState({ chunks: 0, topics: 0, turns: 0 })
  const [status, setStatus]           = useState({ color: 'grey', text: 'Ready' })
  const [complete, setComplete]       = useState(false)
  const recognitionRef = useRef(null)
  const synthRef       = useRef(window.speechSynthesis)
  const bottomRef      = useRef()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const addMsg = (role, text) => setMessages(m => [...m, { role, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])

  const setS = (color, text) => setStatus({ color, text })

  const startSession = async () => {
    const name = nameInput.trim()
    if (!name) return
    setUserName(name)
    const uid = 'voice-' + name.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now()
    window._voiceUserId = uid
    window._voiceUserName = name
    setS('amber', 'Starting...')
    try {
      const res = await axios.post('/api/voice/start', { user_id: uid, user_name: name })
      addMsg('bot', res.data.message)
      setSession(true)
      setS('green', 'Session active — click mic to speak')
      speakText(res.data.message)
    } catch { addMsg('bot', "Hi! I'm Alex. Tell me about your role."); setSession(true); setS('green', 'Ready') }
  }

  const toggleMic = () => { listening ? stopListening() : startListening() }

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition requires Google Chrome.')
      return
    }
    synthRef.current?.cancel()
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onstart = () => { setListening(true); setS('red', 'Listening... click to stop'); setLiveText('') }
    rec.onresult = e => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      setLiveText(final || interim)
      if (final) { stopListening(); sendVoiceTurn(final.trim()) }
    }
    rec.onerror = () => { stopListening(); setS('amber', 'Could not hear. Try again.') }
    rec.onend = () => { if (listening) stopListening() }
    rec.start()
    recognitionRef.current = rec
  }

  const stopListening = () => {
    setListening(false)
    try { recognitionRef.current?.stop() } catch {}
    setS('green', 'Session active')
  }

  const sendVoiceTurn = async (text) => {
    if (!text || processing || complete) return
    addMsg('user', text)
    setProcessing(true)
    setS('amber', 'Alex is thinking...')
    setLiveText('')
    try {
      const res = await axios.post('/api/voice/turn', {
        user_id: window._voiceUserId,
        user_name: window._voiceUserName,
        message: text
      })
      addMsg('bot', res.data.message)
      setStats(s => ({ chunks: res.data.chunks_extracted || s.chunks, topics: res.data.topics_covered || s.topics, turns: s.turns + 1 }))
      speakText(res.data.message)
      if (res.data.session_complete) { setComplete(true); setS('green', 'Session complete') }
      else setS('green', 'Session active — click mic to speak')
    } catch { addMsg('bot', 'Error. Please try again.'); setS('red', 'Error') }
    finally { setProcessing(false) }
  }

  const speakText = (text) => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95
    const voices = synthRef.current.getVoices()
    const v = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'))
    if (v) utt.voice = v
    synthRef.current.speak(utt)
  }

  const statusColors = { grey: '#6b7280', green: '#22c55e', red: '#dc2626', amber: '#f59e0b' }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', gap: 2 }}>
      {/* Status bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: statusColors[status.color], flexShrink: 0 }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{status.text}</Typography>
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <Chip label={`${stats.turns} turns`} size="small" sx={{ fontSize: 11, fontWeight: 600 }} />
          <Chip label={`${stats.chunks} items`} size="small" sx={{ bgcolor: 'rgba(220,38,38,0.12)', color: 'primary.main', fontSize: 11, fontWeight: 600 }} />
          <Chip label={`${stats.topics} topics`} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 11, fontWeight: 600 }} />
        </Box>
      </Box>

      {/* Start screen */}
      {!sessionActive && (
        <Paper elevation={0} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2, gap: 2, p: 4 }}>
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mic sx={{ fontSize: 36, color: 'primary.main' }} />
          </Box>
          <Typography variant="h6">Voice Interview with Alex</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 360 }}>
            Alex will ask you questions and listen to your responses. Works best in Google Chrome.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <input
              placeholder="Enter your name..."
              value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startSession()}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2a4060', background: '#0f1e30', color: 'white', fontSize: 14, outline: 'none', width: 220 }}
            />
            <Button variant="contained" onClick={startSession} disabled={!nameInput.trim()}>Start</Button>
          </Box>
          <Typography variant="caption" sx={{ color: '#f59e0b' }}>⚠ Allow microphone access when Chrome asks</Typography>
        </Paper>
      )}

      {/* Active session */}
      {sessionActive && (
        <>
          {/* Chat transcript */}
          <Paper elevation={0} sx={{ flex: 1, overflow: 'auto', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {messages.map((msg, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: msg.role === 'bot' ? 'primary.main' : '#1d6fab', fontSize: 13, flexShrink: 0 }}>
                  {msg.role === 'bot' ? <SmartToy sx={{ fontSize: 16 }} /> : <Person sx={{ fontSize: 16 }} />}
                </Avatar>
                <Paper elevation={0} sx={{ maxWidth: '72%', px: 1.5, py: 1, bgcolor: msg.role === 'bot' ? 'background.paper' : '#1d4a7a', border: '1px solid', borderColor: 'divider', borderRadius: msg.role === 'bot' ? '4px 12px 12px 12px' : '12px 4px 12px 12px' }}>
                  <Typography sx={{ fontSize: 14, lineHeight: 1.7 }}>{msg.text}</Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.3 }}>{msg.time}</Typography>
                </Paper>
              </Box>
            ))}
            {processing && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main' }}><SmartToy sx={{ fontSize: 16 }} /></Avatar>
                <Paper elevation={0} sx={{ px: 2, py: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '4px 12px 12px 12px' }}>
                  <CircularProgress size={14} color="primary" />
                </Paper>
              </Box>
            )}
            <div ref={bottomRef} />
          </Paper>

          {/* Live transcription */}
          <Box sx={{ p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 2, minHeight: 44, bgcolor: 'rgba(255,255,255,0.02)' }}>
            <Typography sx={{ fontSize: 13, color: liveText ? 'text.primary' : 'text.secondary', fontStyle: liveText ? 'normal' : 'italic' }}>
              {liveText || (listening ? 'Listening...' : 'Your speech will appear here as you talk...')}
            </Typography>
          </Box>

          {/* Mic button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, py: 1 }}>
            <Box sx={{ position: 'relative' }}>
              {listening && (
                <>
                  <Box sx={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '2px solid rgba(220,38,38,0.4)', animation: 'ping 1.5s infinite', '@keyframes ping': { '0%': { transform: 'scale(1)', opacity: 0.7 }, '100%': { transform: 'scale(1.4)', opacity: 0 } } }} />
                  <Box sx={{ position: 'absolute', inset: -20, borderRadius: '50%', border: '2px solid rgba(220,38,38,0.2)', animation: 'ping 1.5s 0.5s infinite', '@keyframes ping': { '0%': { transform: 'scale(1)', opacity: 0.5 }, '100%': { transform: 'scale(1.4)', opacity: 0 } } }} />
                </>
              )}
              <IconButton
                onClick={toggleMic}
                disabled={processing || complete}
                sx={{
                  width: 72, height: 72,
                  bgcolor: listening ? '#1d6fab' : 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: listening ? '#1558a0' : '#b91c1c' },
                  '&:disabled': { bgcolor: 'divider' },
                  boxShadow: listening ? '0 0 20px rgba(29,111,171,0.5)' : '0 0 20px rgba(220,38,38,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {listening ? <Stop sx={{ fontSize: 32 }} /> : <Mic sx={{ fontSize: 32 }} />}
              </IconButton>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {complete ? 'Session complete ✓' : listening ? 'Click to stop recording' : 'Click to speak'}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  )
}
