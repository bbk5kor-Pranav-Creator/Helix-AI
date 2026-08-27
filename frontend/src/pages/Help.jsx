import React, { useState } from 'react'
import { Box, Typography, Paper, Accordion, AccordionSummary, AccordionDetails, Chip, Divider, Button } from '@mui/material'
import { ExpandMore, Chat, Mic, CloudUpload, Hub, ArrowForward } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

const FAQS = [
  { q: 'How do I start an interview?', a: 'Go to Text Agent or Voice Agent from the sidebar. Enter your name and click Start Session. Alex will greet you and begin asking questions about your role.' },
  { q: 'What is the difference between Interview Mode and Ask Alex?', a: 'Interview Mode is for capturing your knowledge — Alex asks you questions. Ask Alex mode lets you query the existing knowledge base — ask things like "What did Harsh discuss?" or "What topics were covered on June 19?"' },
  { q: 'How does Alex use uploaded documents?', a: 'When you upload a PDF or image in the Upload Files section, Alex extracts the text and injects it as context before each conversation turn. Alex will ask more specific, document-aware questions as a result.' },
  { q: 'What are Tags on resource pages?', a: 'Tags are comma-separated labels you add to resource entries (e.g. "hr, finance, process"). They let you filter and find entries quickly, and Alex can use them to understand what each resource is about.' },
  { q: 'Can I continue a previous session?', a: 'Yes — in the Text Agent sidebar, previous sessions are listed. Click any session to load the full conversation history. If the session was not completed, you can continue from where you left off.' },
  { q: 'Where is my data stored?', a: 'All data is stored locally in backend/data/knowledge_agent.db (SQLite). Uploaded files are in backend/uploads/. Nothing is sent to any external service except the Groq API for LLM inference.' },
  { q: 'How do I view captured knowledge?', a: 'Go to Knowledge Hub in the sidebar. Use the tabs to browse by Topic, Date, or Employee. The Conversations tab shows full chat transcripts per session.' },
  { q: 'What file types can I upload?', a: 'PDF, PNG, JPG, and WEBP files are supported. PDFs are parsed with pdfplumber for full text extraction. Images require pytesseract for OCR (optional install).' },
  { q: 'The voice agent is not working — what do I do?', a: 'Voice recognition requires Google Chrome. Allow microphone access when prompted. Make sure both the backend (port 8000) and frontend (port 5173) are running.' },
  { q: 'How do I run the project?', a: 'Run the backend: cd backend && venv\\Scripts\\activate && python main.py. Then in a second terminal: cd frontend && npm run dev. Open http://localhost:5173.' },
]

const SHORTCUTS = [
  { key: 'Enter',          desc: 'Send message in Text Agent' },
  { key: 'Shift + Enter', desc: 'New line in Text Agent input' },
  { key: 'Click mic',     desc: 'Start / stop recording in Voice Agent' },
  { key: 'Collapse sidebar', desc: 'Click the arrow icon at top of sidebar' },
]

export default function Help() {
  const navigate = useNavigate()
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Chip label="Help & Documentation" size="small" sx={{ mb: 1.5, bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontWeight: 700 }} />
        <Typography variant="h5" sx={{ mb: 1 }}>How to Use the Platform</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
          Everything you need to get started with Helix AI.
        </Typography>
      </Box>

      {/* Quick start */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #2a4060', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 2 }}>⚡ Quick Start</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[
            { step: '1', icon: <CloudUpload sx={{ fontSize: 18, color: '#10b981' }} />, title: 'Upload Documents', desc: 'Upload PDFs or images so Alex can ask smarter questions', path: '/upload' },
            { step: '2', icon: <Chat sx={{ fontSize: 18, color: '#3b82f6' }} />,        title: 'Start Interview', desc: 'Open Text Agent, enter your name, and start talking to Alex', path: '/text-agent' },
            { step: '3', icon: <Hub sx={{ fontSize: 18, color: '#8b5cf6' }} />,         title: 'Browse Knowledge', desc: 'Explore everything Alex learned in the Knowledge Hub', path: '/knowledge-hub' },
          ].map(s => (
            <Paper key={s.step} elevation={0} onClick={() => navigate(s.path)}
              sx={{ flex: 1, minWidth: 180, p: 2, border: '1px solid #2a4060', borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: '#3b82f6' }, transition: 'border-color 0.2s' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white' }}>{s.step}</Box>
                {s.icon}
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{s.title}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.6 }}>{s.desc}</Typography>
            </Paper>
          ))}
        </Box>
      </Paper>

      {/* Keyboard shortcuts */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid #2a4060', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>⌨️ Shortcuts & Tips</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {SHORTCUTS.map(s => (
            <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip label={s.key} size="small" sx={{ fontFamily: 'monospace', bgcolor: 'rgba(255,255,255,0.06)', color: 'text.primary', fontSize: 11, fontWeight: 700, minWidth: 110 }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{s.desc}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* FAQs */}
      <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>Frequently Asked Questions</Typography>
      {FAQS.map((faq, i) => (
        <Accordion key={i} elevation={0} disableGutters
          sx={{ mb: 0.5, border: '1px solid #2a4060', borderRadius: '8px !important', '&:before': { display: 'none' }, bgcolor: 'background.paper' }}>
          <AccordionSummary expandIcon={<ExpandMore sx={{ color: 'text.secondary' }} />}>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{faq.q}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.8 }}>{faq.a}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}

      <Box sx={{ mt: 3 }}>
        <Button variant="contained" onClick={() => navigate('/')} sx={{ mr: 1 }}>Back to Home</Button>
        <Button variant="outlined" href="http://localhost:8000/docs" target="_blank"
          sx={{ borderColor: '#2a4060', color: 'text.secondary' }}>API Docs →</Button>
      </Box>
    </Box>
  )
}
