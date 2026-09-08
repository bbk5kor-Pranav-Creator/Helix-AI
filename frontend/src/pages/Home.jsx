import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Paper, Chip, Grid,
  Card, CardContent, CardActionArea, Divider, CircularProgress
} from '@mui/material'
import {
  Chat, Mic, CloudUpload, Hub, ArrowForward,
  Psychology, Speed, Storage, Security,
  CheckCircle, TrendingUp, Groups, Description
} from '@mui/icons-material'
import axios from 'axios'

const FEATURES = [
  { icon: <Psychology sx={{ fontSize: 28, color: '#3b82f6' }} />, title: 'AI-Powered Interviews', desc: 'Alex conducts intelligent, context-aware interviews that adapt based on uploaded documents and previous conversations.' },
  { icon: <Speed sx={{ fontSize: 28, color: '#10b981' }} />, title: 'Real-time Extraction', desc: 'Every response is instantly analysed and structured into searchable knowledge items with domain classification.' },
  { icon: <Storage sx={{ fontSize: 28, color: '#8b5cf6' }} />, title: 'Structured Knowledge Base', desc: 'All captured expertise is stored in a queryable SQLite database, browsable by topic, date, or employee.' },
  { icon: <Security sx={{ fontSize: 28, color: '#f59e0b' }} />, title: 'Document Context', desc: 'Upload PDFs and images — Alex reads them and uses that knowledge to ask smarter, role-specific follow-up questions.' },
  { icon: <Groups sx={{ fontSize: 28, color: '#ec4899' }} />, title: 'Multi-Employee Support', desc: 'Interview multiple employees in parallel. Each session is tracked separately with full conversation history.' },
  { icon: <TrendingUp sx={{ fontSize: 28, color: '#06b6d4' }} />, title: 'Knowledge Analytics', desc: 'Browse the Knowledge Hub for topic-wise, date-wise, and user-wise summaries with confidence scoring.' },
  { icon: <CloudUpload sx={{ fontSize: 28, color: '#14b8a6' }} />, title: 'Web Knowledge Extraction', desc: 'Analyse web pages and URLs to extract useful information and make external knowledge searchable.' }, 
  { icon: <Description sx={{ fontSize: 28, color: '#f97316' }} />, title: 'Intelligent Document Processing', desc: 'Upload PDF documents and automatically extract their content for analysis, retrieval, and contextual understanding.' }, 
  { icon: <Hub sx={{ fontSize: 28, color: '#a855f7' }} />, title: 'Knowledge Intelligence', desc: 'Transform extracted knowledge into topics, entities, processes, relationships, risks, and actionable insights.' },
] 

const AGENT_CARDS = [
  {
    icon: <Chat sx={{ fontSize: 40, color: '#3b82f6' }} />,
    title: 'Text Agent',
    subtitle: 'Interview via chat',
    desc: 'Type your answers at your own pace. Switch between Interview Mode and Ask Alex mode to query what has already been learned.',
    path: '/text-agent',
    color: '#3b82f6',
    badge: 'Chat + Query',
  },
  {
    icon: <Mic sx={{ fontSize: 40, color: '#dc2626' }} />,
    title: 'Voice Agent',
    subtitle: 'Speak naturally',
    desc: 'Alex listens to your voice, extracts knowledge in real-time, and reads responses aloud. Hands-free and intuitive.',
    path: '/voice-agent',
    color: '#dc2626',
    badge: 'Speech Recognition',
  },
]

const RESOURCE_LINKS = [
  { label: 'Upload Files',    path: '/upload',        color: '#10b981' },
  { label: 'Knowledge Hub',  path: '/knowledge-hub', color: '#8b5cf6' },
  { label: 'Docupedia',      path: '/docupedia',     color: '#f59e0b' },
  { label: 'SharePoint',     path: '/sharepoint',    color: '#3b82f6' },
  { label: 'Jira',           path: '/jira',          color: '#06b6d4' },
  { label: 'Teams',          path: '/teams',         color: '#ec4899' },
]

export default function Home() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    axios.get('/api/summary/overview').then(r => setStats(r.data)).catch(() => {})
  }, [])

  return (
    <Box>
      {/* ── HERO ── */}
      <Box sx={{
        position: 'relative', borderRadius: 3, overflow: 'hidden', mb: 4,
        background: 'linear-gradient(135deg, #0f1e30 0%, #1a2e4a 50%, #0f2040 100%)',
        border: '1px solid #2a4060', p: { xs: 3, md: 5 },
      }}>
        {/* Background decoration */}
        <Box sx={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(220,38,38,0.06)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -40, left: '40%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(59,130,246,0.05)', pointerEvents: 'none' }} />

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 680 }}>
          <Chip label="Helix AI · Intelligent Knowledge Agent" size="small"
            sx={{ mb: 2, bgcolor: 'rgba(220,38,38,0.15)', color: '#dc2626', fontWeight: 700, letterSpacing: 0.5, border: '1px solid rgba(220,38,38,0.3)' }} />

          <Typography sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 800, lineHeight: 1.15, mb: 2, color: 'white' }}>
            Transforming Human Expertise Into<br />
            <Box component="span" sx={{ color: '#dc2626' }}>Structured, Searchable Organisational Intelligence</Box>
          </Typography>

          <Typography sx={{ fontSize: 16, color: '#7a9bb5', lineHeight: 1.8, mb: 3, maxWidth: 560 }}>
            Alex is an AI interviewer that conducts structured conversations with your employees,
            extracts institutional knowledge, and makes it searchable for future colleagues — via voice or text.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="contained" size="large" startIcon={<Chat />} onClick={() => navigate('/text-agent')}
              sx={{ px: 3, py: 1.2, fontWeight: 700, fontSize: 14 }}>
              Start Text Interview
            </Button>
            <Button variant="outlined" size="large" startIcon={<Mic />} onClick={() => navigate('/voice-agent')}
              sx={{ px: 3, py: 1.2, fontWeight: 700, fontSize: 14, borderColor: '#2a4060', color: 'text.secondary', '&:hover': { borderColor: '#dc2626', color: 'white' } }}>
              Start Voice Interview
            </Button>
          </Box>
        </Box>

        {/* Live stats in hero */}
        {stats && (
          <Box sx={{ position: 'absolute', top: { md: '50%' }, right: { md: 40 }, transform: { md: 'translateY(-50%)' }, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 1.5 }}>
            {[
              { label: 'Knowledge Items', value: stats.total_items, color: '#dc2626' },
              { label: 'Employees',       value: stats.total_employees, color: '#3b82f6' },
              { label: 'Topics Captured', value: stats.total_topics, color: '#10b981' },
            ].map(s => (
              <Box key={s.label} sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(15,30,48,0.7)', border: '1px solid #2a4060', borderRadius: 2, minWidth: 110 }}>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                <Typography sx={{ fontSize: 11, color: '#7a9bb5', mt: 0.3 }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* ── AGENT CARDS ── */}
      <Typography variant="h6" sx={{ mb: 2 }}>Choose Your Interview Mode</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        {AGENT_CARDS.map(card => (
          <Card key={card.path} elevation={0} sx={{
            flex: 1, minWidth: 260,
            border: '1px solid #2a4060', borderRadius: 3, cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { borderColor: card.color, transform: 'translateY(-3px)', boxShadow: `0 8px 24px ${card.color}20` },
          }}>
            <CardActionArea onClick={() => navigate(card.path)} sx={{ p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: `${card.color}15`, borderRadius: 2, flexShrink: 0 }}>
                  {card.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{card.title}</Typography>
                    <Chip label={card.badge} size="small"
                      sx={{ fontSize: 10, height: 20, bgcolor: `${card.color}18`, color: card.color, fontWeight: 600 }} />
                  </Box>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>{card.subtitle}</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.6 }}>{card.desc}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2, color: card.color }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Open {card.title}</Typography>
                <ArrowForward sx={{ fontSize: 16 }} />
              </Box>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      {/* ── STATS BAR (mobile) ── */}
      {stats && (
        <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, mb: 3, flexWrap: 'wrap' }}>
          {[
            { l: 'Items', v: stats.total_items, c: '#dc2626' },
            { l: 'People', v: stats.total_employees, c: '#3b82f6' },
            { l: 'Topics', v: stats.total_topics, c: '#10b981' },
            { l: 'Days', v: stats.active_days, c: '#8b5cf6' },
          ].map(s => (
            <Paper key={s.l} elevation={0} sx={{ flex: 1, minWidth: 80, p: 1.5, border: '1px solid #2a4060', borderRadius: 2, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{s.l}</Typography>
            </Paper>
          ))}
        </Box>
      )}

      {/* ── FEATURES GRID ── */}
      <Typography variant="h6" sx={{ mb: 2 }}>Platform Capabilities</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 4 }}>
        {FEATURES.map((f, i) => (
          <Paper key={i} elevation={0} sx={{ p: 2.5, border: '1px solid #2a4060', borderRadius: 2, '&:hover': { borderColor: '#3a5070' }, transition: 'border-color 0.2s' }}>
            <Box sx={{ mb: 1.5 }}>{f.icon}</Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.8 }}>{f.title}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.7 }}>{f.desc}</Typography>
          </Paper>
        ))}
      </Box>

      {/* ── QUICK LINKS ── */}
      <Typography variant="h6" sx={{ mb: 2 }}>Quick Access</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 4 }}>
        {RESOURCE_LINKS.map(r => (
          <Button key={r.path} variant="outlined" size="small" onClick={() => navigate(r.path)}
            endIcon={<ArrowForward sx={{ fontSize: 13 }} />}
            sx={{ borderColor: '#2a4060', color: 'text.secondary', fontSize: 12, fontWeight: 600,
              '&:hover': { borderColor: r.color, color: r.color, bgcolor: `${r.color}08` } }}>
            {r.label}
          </Button>
        ))}
      </Box>

      {/* ── HOW IT WORKS ── */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #2a4060', borderRadius: 3 }}>
        <Typography variant="h6" sx={{ mb: 2.5 }}>How It Works</Typography>
        <Box sx={{ display: 'flex', gap: 0, flexWrap: 'wrap', position: 'relative' }}>
          {[
            { step: '01', title: 'Upload Context',    desc: 'Upload relevant documents — job descriptions, process docs, system manuals. Alex uses these to ask smarter questions.',   color: '#3b82f6' },
            { step: '02', title: 'Start Interview',   desc: 'Employee starts a text or voice session. Alex conducts a structured, friendly conversation tailored to their role.',       color: '#8b5cf6' },
            { step: '03', title: 'Extract Knowledge', desc: 'Every response is automatically analysed and classified into process, technical, relationship, and tacit knowledge.',       color: '#dc2626' },
            { step: '04', title: 'Browse & Query',    desc: 'Explore captured knowledge in the Knowledge Hub by topic, date, or employee. Future colleagues can search and learn.',    color: '#10b981' },
          ].map((s, i) => (
            <Box key={i} sx={{ flex: 1, minWidth: 180, px: 2, borderLeft: i > 0 ? '1px solid #2a4060' : 'none' }}>
              <Typography sx={{ fontSize: 28, fontWeight: 800, color: s.color, opacity: 0.4, lineHeight: 1, mb: 0.5 }}>{s.step}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.8 }}>{s.title}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.7 }}>{s.desc}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  )
}
