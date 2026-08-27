import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Paper, Chip, Button, Divider, Avatar } from '@mui/material'
import { ArrowForward, Psychology, Code, Storage } from '@mui/icons-material'

const TECH_STACK = [
  { layer: 'Frontend',  tech: 'React 18 + Vite',            color: '#3b82f6', desc: 'Fast, modern SPA with hot module replacement' },
  { layer: 'UI',        tech: 'Material-UI v5',              color: '#8b5cf6', desc: 'Dark-themed enterprise component library' },
  { layer: 'Backend',   tech: 'FastAPI (Python)',             color: '#10b981', desc: 'Async REST API with auto-generated Swagger docs' },
  { layer: 'Database',  tech: 'SQLite',                      color: '#f59e0b', desc: 'Lightweight, file-based structured storage' },
  { layer: 'LLM',       tech: 'Groq · LLaMA 3.3 70B',       color: '#dc2626', desc: 'Ultra-fast inference for conversation & extraction' },
  { layer: 'Speech',    tech: 'Web Speech API',              color: '#06b6d4', desc: 'Browser-native STT and TTS for voice agent' },
  { layer: 'Files',     tech: 'pdfplumber + Pillow',         color: '#ec4899', desc: 'PDF text extraction and image processing' },
]

const KNOWLEDGE_TYPES = [
  { icon: '🔄', label: 'Process',      desc: 'How work gets done day-to-day, workflows, step-by-step procedures' },
  { icon: '⚙️', label: 'Technical',    desc: 'Systems, tools, undocumented configurations, integration knowledge' },
  { icon: '🤝', label: 'Relationship', desc: 'Key contacts, suppliers, stakeholders, internal champions' },
  { icon: '💡', label: 'Tacit',        desc: 'Experience-based know-how that lives only in people\'s heads' },
  { icon: '📋', label: 'Contact',      desc: 'Named individuals and their specific expertise areas' },
]

export default function About() {
  const navigate = useNavigate()
  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Chip label="About Helix AI" size="small" sx={{ mb: 1.5, bgcolor: 'rgba(220,38,38,0.12)', color: '#dc2626', fontWeight: 700 }} />
        <Typography variant="h5" sx={{ mb: 1 }}>Helix AI — Knowledge Capture Agent</Typography>
        <Typography sx={{ color: 'text.secondary', lineHeight: 1.8, fontSize: 15 }}>
          An enterprise-grade AI system designed to capture, structure, and preserve the institutional knowledge
          of employees before it's lost to attrition, retirement, or role transitions.
        </Typography>
      </Box>

      {/* Mission */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #2a4060', borderRadius: 2, bgcolor: 'rgba(220,38,38,0.04)', borderColor: 'rgba(220,38,38,0.2)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1, color: '#dc2626' }}>🎯 Mission</Typography>
        <Typography sx={{ color: 'text.secondary', lineHeight: 1.8, fontSize: 14 }}>
          Every organisation loses critical knowledge when employees leave. Alex solves this by conducting
          structured AI interviews that surface tacit knowledge — the things people know but never write down.
          This knowledge is then stored, searchable, and available to future colleagues who need it most.
        </Typography>
      </Paper>

      {/* Knowledge types */}
      <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>Knowledge Domains Captured</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {KNOWLEDGE_TYPES.map(k => (
          <Paper key={k.label} elevation={0} sx={{ p: 2, border: '1px solid #2a4060', borderRadius: 2, flex: 1, minWidth: 150 }}>
            <Typography sx={{ fontSize: 22, mb: 0.5 }}>{k.icon}</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>{k.label}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.6 }}>{k.desc}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Tech stack */}
      <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>Technology Stack</Typography>
      <Paper elevation={0} sx={{ border: '1px solid #2a4060', borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        {TECH_STACK.map((t, i) => (
          <Box key={t.layer}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.8 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, width: 80, flexShrink: 0 }}>{t.layer}</Typography>
              <Chip label={t.tech} size="small" sx={{ bgcolor: `${t.color}18`, color: t.color, fontWeight: 700, fontSize: 12 }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.desc}</Typography>
            </Box>
            {i < TECH_STACK.length - 1 && <Divider sx={{ borderColor: '#2a4060' }} />}
          </Box>
        ))}
      </Paper>

      {/* API */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid #2a4060', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>📡 API Documentation</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
          The FastAPI backend auto-generates interactive API documentation. Use it to explore all endpoints, test requests, and integrate with other systems.
        </Typography>
        <Button variant="outlined" size="small" href="http://localhost:8000/docs" target="_blank"
          endIcon={<ArrowForward sx={{ fontSize: 13 }} />}
          sx={{ borderColor: '#2a4060', color: 'text.secondary', fontSize: 12, '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' } }}>
          Open API Docs → localhost:8000/docs
        </Button>
      </Paper>

      <Button variant="contained" onClick={() => navigate('/')} sx={{ mr: 1 }}>Go to Home</Button>
      <Button variant="outlined" onClick={() => navigate('/text-agent')} sx={{ borderColor: '#2a4060', color: 'text.secondary' }}>Start Interview</Button>
    </Box>
  )
}
