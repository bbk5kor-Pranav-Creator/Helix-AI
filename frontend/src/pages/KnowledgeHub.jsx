import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Tabs, Tab, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Accordion, AccordionSummary, AccordionDetails, TextField,
  InputAdornment, Select, MenuItem, FormControl, InputLabel,
  Grid, Card, CardContent, Divider, Alert, LinearProgress, Tooltip
} from '@mui/material'
import {
  ExpandMore, Search, Topic, CalendarMonth, Person,
  Psychology, TrendingUp, QuestionAnswer, Lightbulb,
  CheckCircle, Warning, Hub
} from '@mui/icons-material'
import axios from 'axios'
import WebResources from '../components/WebResources'

const DOMAIN_COLOR = { process:'#3b82f6', technical:'#8b5cf6', relationship:'#10b981', tacit:'#f59e0b', contact:'#ec4899', company:'#06b6d4' }
const DOMAIN_ICON  = { process:'🔄', technical:'⚙️', relationship:'🤝', tacit:'💡', contact:'📋', company:'🏢' }
const domainColor  = d => DOMAIN_COLOR[(d||'').toLowerCase().split('|')[0].trim()] || '#6b7280'
const domainIcon   = d => DOMAIN_ICON[(d||'').toLowerCase().split('|')[0].trim()] || '📌'

function StatCard({ icon, label, value, color }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 130 }}>
      <CardContent sx={{ p: '16px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ fontSize: 20 }}>{icon}</Box>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</Typography>
        </Box>
        <Typography sx={{ fontSize: 32, fontWeight: 800, color: color || 'primary.main', lineHeight: 1 }}>{value ?? '—'}</Typography>
      </CardContent>
    </Card>
  )
}

/* ─── BY TOPIC ─────────────────────────────── */
function ByTopic({ knowledge }) {
  const [search, setSearch]   = useState('')
  const [domain, setDomain]   = useState('')
  const [person, setPerson]   = useState('')

  const people  = [...new Set(knowledge.map(c => c.employee_name).filter(Boolean))]
  const domains = [...new Set(knowledge.map(c => c.domain).filter(Boolean))]

  let data = knowledge
  if (search) data = data.filter(c => (c.topic||'').toLowerCase().includes(search.toLowerCase()) || (c.content||'').toLowerCase().includes(search.toLowerCase()))
  if (domain) data = data.filter(c => (c.domain||'').toLowerCase().includes(domain.toLowerCase()))
  if (person) data = data.filter(c => c.employee_name === person)

  const byTopic = {}
  data.forEach(c => {
    const key = (c.topic||'Untitled').trim()
    if (!byTopic[key]) byTopic[key] = []
    byTopic[key].push(c)
  })
  const sorted = Object.entries(byTopic).sort((a,b) => (a[1][0]?.domain||'').localeCompare(b[1][0]?.domain||'') || a[0].localeCompare(b[0]))

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Search topics or content..." value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 220 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Domain</InputLabel>
          <Select value={domain} label="Domain" onChange={e => setDomain(e.target.value)}>
            <MenuItem value="">All Domains</MenuItem>
            {domains.map(d => <MenuItem key={d} value={d}>{domainIcon(d)} {d}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Employee</InputLabel>
          <Select value={person} label="Employee" onChange={e => setPerson(e.target.value)}>
            <MenuItem value="">All Employees</MenuItem>
            {people.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>{sorted.length} topics · {data.length} items</Typography>
      {sorted.length === 0 && <Alert severity="info">No topics match your filters.</Alert>}
      {sorted.map(([topicName, chunks]) => {
        const dom      = chunks[0]?.domain || ''
        const color    = domainColor(dom)
        const people2  = [...new Set(chunks.map(c => c.employee_name).filter(Boolean))]
        const dates    = [...new Set(chunks.map(c => (c.extracted_at||'').slice(0,10)).filter(Boolean))].sort().reverse()
        const avgConf  = Math.round(chunks.reduce((s,c) => s + parseFloat(c.confidence||0),0)/chunks.length*100)
        const lSystems = [...new Set(chunks.map(c=>c.linked_system).filter(s=>s&&s!=='null'))]
        const needsFU  = chunks.some(c => c.requires_followup)
        return (
          <Accordion key={topicName} elevation={0} disableGutters
            sx={{ mb: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' }, bgcolor: 'background.paper' }}>
            <AccordionSummary expandIcon={<ExpandMore sx={{ color: 'text.secondary' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, flexWrap: 'wrap', mr: 1 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{topicName}</Typography>
                {chunks.length > 1 && <Chip label={`${chunks.length} items`} size="small" sx={{ bgcolor: 'rgba(220,38,38,0.12)', color: 'primary.main', fontSize: 10, height: 20 }} />}
                <Chip label={`${domainIcon(dom)} ${dom||'general'}`} size="small" sx={{ bgcolor: `${color}18`, color, fontSize: 10, height: 20 }} />
                {people2.map(p => <Chip key={p} label={`👤 ${p}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary', fontSize: 10, height: 20 }} />)}
                {needsFU && <Chip label="⚡ Follow-up" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 10, height: 20 }} />}
                <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 'auto' }}>{dates[0]}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Divider sx={{ mb: 1.5 }} />
              {chunks.map((c, i) => (
                <Box key={i} sx={{ mb: 1.5, pl: 1.5, borderLeft: `3px solid ${color}44` }}>
                  <Typography sx={{ fontSize: 13, color: 'text.primary', lineHeight: 1.7 }}>{c.content}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>👤 {c.employee_name}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>📅 {(c.extracted_at||'').slice(0,10)}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{Math.round(parseFloat(c.confidence||0)*100)}% confidence</Typography>
                    {c.linked_system && c.linked_system !== 'null' && <Chip label={`⚙ ${c.linked_system}`} size="small" sx={{ fontSize: 10, height: 18 }} />}
                    {c.linked_person && c.linked_person !== 'null' && <Chip label={`🔗 ${c.linked_person}`} size="small" sx={{ fontSize: 10, height: 18 }} />}
                  </Box>
                </Box>
              ))}
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Avg confidence</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{avgConf}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={avgConf} sx={{ borderRadius: 1, height: 4, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
              </Box>
              {lSystems.length > 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>Systems: {lSystems.join(', ')}</Typography>}
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Box>
  )
}

/* ─── BY DATE ───────────────────────────────── */
function ByDate({ knowledge }) {
  const [search, setSearch] = useState('')

  let data = knowledge
  if (search) data = data.filter(c => (c.topic||'').toLowerCase().includes(search.toLowerCase()) || (c.employee_name||'').toLowerCase().includes(search.toLowerCase()) || (c.content||'').toLowerCase().includes(search.toLowerCase()))

  const byDate = {}
  data.forEach(c => {
    const d = (c.extracted_at||'').slice(0,10) || 'Unknown'
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(c)
  })
  const sorted = Object.entries(byDate).sort((a,b) => b[0].localeCompare(a[0]))

  const fmtDate = d => { try { return new Date(d).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) } catch { return d } }

  return (
    <Box>
      <TextField size="small" placeholder="Search by person, topic, or content..." value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 2, width: 340 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
      {sorted.length === 0 && <Alert severity="info">No knowledge found.</Alert>}
      {sorted.map(([date, chunks], di) => {
        const people  = [...new Set(chunks.map(c=>c.employee_name).filter(Boolean))]
        const domains = [...new Set(chunks.map(c=>c.domain).filter(Boolean))]
        return (
          <Accordion key={date} elevation={0} disableGutters defaultExpanded={di===0}
            sx={{ mb: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' }, bgcolor: 'background.paper' }}>
            <AccordionSummary expandIcon={<ExpandMore sx={{ color: 'text.secondary' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, mr: 1 }}>
                <CalendarMonth sx={{ color: 'primary.main', fontSize: 18 }} />
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(date)}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{chunks.length} items · {people.join(', ')}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', flexWrap: 'wrap' }}>
                  {domains.slice(0,3).map(d => <Chip key={d} label={`${domainIcon(d)} ${d}`} size="small" sx={{ bgcolor: `${domainColor(d)}18`, color: domainColor(d), fontSize: 10, height: 20 }} />)}
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Divider sx={{ mb: 1.5 }} />
              {people.map(name => {
                const pChunks = chunks.filter(c => c.employee_name === name)
                return (
                  <Box key={name} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{name}</Typography>
                      <Chip label={`${pChunks.length} items`} size="small" sx={{ bgcolor: 'rgba(220,38,38,0.1)', color: 'primary.main', fontSize: 10, height: 20 }} />
                    </Box>
                    {pChunks.slice(0,6).map((c,i) => (
                      <Box key={i} sx={{ mb: 0.8, pl: 1.5, borderLeft: `3px solid ${domainColor(c.domain)}44` }}>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.2 }}>{domainIcon(c.domain)} {c.topic}</Typography>
                        <Typography sx={{ fontSize: 13, color: 'text.primary', lineHeight: 1.6 }}>{c.content}</Typography>
                      </Box>
                    ))}
                    {pChunks.length > 6 && <Typography sx={{ fontSize: 12, color: 'primary.main', pl: 1.5 }}>+{pChunks.length-6} more items</Typography>}
                  </Box>
                )
              })}
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Box>
  )
}

/* ─── BY USER ───────────────────────────────── */
function ByUser({ knowledge }) {
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState(null)

  const people = [...new Set(knowledge.map(c => c.employee_name).filter(Boolean))]

  const filtered = people.filter(p => p.toLowerCase().includes(search.toLowerCase()))

  const getUserData = (name) => {
    const chunks = knowledge.filter(c => c.employee_name === name)
    const byDomain = {}
    const byDate   = {}
    const byTopic  = {}
    chunks.forEach(c => {
      const dom   = c.domain || 'general'
      const date  = (c.extracted_at||'').slice(0,10)
      const topic = c.topic || 'Untitled'
      if (!byDomain[dom])  byDomain[dom]  = []
      if (!byDate[date])   byDate[date]   = []
      if (!byTopic[topic]) byTopic[topic] = []
      byDomain[dom].push(c)
      byDate[date].push(c)
      byTopic[topic].push(c)
    })
    return { chunks, byDomain, byDate, byTopic, dates: Object.keys(byDate).sort().reverse() }
  }

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* User list */}
      <Box sx={{ width: 220, flexShrink: 0 }}>
        <TextField size="small" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} fullWidth sx={{ mb: 1.5 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
        {filtered.map(name => {
          const count = knowledge.filter(c => c.employee_name === name).length
          const isActive = selected === name
          return (
            <Paper key={name} elevation={0} onClick={() => setSelected(isActive ? null : name)}
              sx={{ mb: 0.5, p: 1.5, cursor: 'pointer', border: '1px solid', borderColor: isActive ? 'primary.main' : 'divider', borderRadius: 2, bgcolor: isActive ? 'rgba(220,38,38,0.06)' : 'background.paper', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(220,38,38,0.04)' }, transition: 'all 0.15s' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: isActive ? 'primary.main' : 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: isActive ? 'white' : 'primary.main', flexShrink: 0 }}>
                  {name.charAt(0).toUpperCase()}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{name}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{count} items</Typography>
                </Box>
              </Box>
            </Paper>
          )
        })}
        {filtered.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', py: 2 }}>No employees found</Typography>}
      </Box>

      {/* User detail */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {!selected ? (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
            <Person sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 1 }} />
            <Typography sx={{ color: 'text.secondary' }}>Select an employee to see their knowledge summary</Typography>
          </Paper>
        ) : (() => {
          const { chunks, byDomain, byDate, byTopic, dates } = getUserData(selected)
          const topDomains = Object.entries(byDomain).sort((a,b) => b[1].length - a[1].length)
          const topTopics  = Object.entries(byTopic).sort((a,b) => b[1].length - a[1].length).slice(0,5)
          return (
            <Box>
              {/* User header */}
              <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: 'white' }}>
                    {selected.charAt(0).toUpperCase()}
                  </Box>
                  <Box>
                    <Typography variant="h6">{selected}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{chunks.length} knowledge items · {dates.length} session days · {Object.keys(byDomain).length} domains</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', flexWrap: 'wrap' }}>
                    {dates.map(d => <Chip key={d} label={d} size="small" sx={{ bgcolor: 'rgba(220,38,38,0.1)', color: 'primary.main', fontSize: 10 }} />)}
                  </Box>
                </Box>
                {/* Domain breakdown */}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {topDomains.map(([dom, items]) => (
                    <Chip key={dom} label={`${domainIcon(dom)} ${dom} (${items.length})`} size="small"
                      sx={{ bgcolor: `${domainColor(dom)}18`, color: domainColor(dom), fontSize: 11 }} />
                  ))}
                </Box>
              </Paper>

              {/* Top topics */}
              <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>🏆 Top Topics</Typography>
                {topTopics.map(([topic, items]) => (
                  <Box key={topic} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{topic}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{items.length} items</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={Math.min(100, items.length / chunks.length * 100 * 5)}
                      sx={{ borderRadius: 1, height: 5, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: domainColor(items[0]?.domain) } }} />
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.4 }}>{items[0]?.content?.slice(0,120)}...</Typography>
                  </Box>
                ))}
              </Paper>

              {/* All knowledge by domain */}
              {topDomains.map(([dom, items]) => (
                <Accordion key={dom} elevation={0} disableGutters sx={{ mb: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' }, bgcolor: 'background.paper' }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: 'text.secondary' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography sx={{ fontSize: 18 }}>{domainIcon(dom)}</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{dom}</Typography>
                      <Chip label={items.length} size="small" sx={{ bgcolor: `${domainColor(dom)}18`, color: domainColor(dom), fontSize: 10, height: 20 }} />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Divider sx={{ mb: 1 }} />
                    {items.map((c,i) => (
                      <Box key={i} sx={{ mb: 1, pl: 1.5, borderLeft: `3px solid ${domainColor(dom)}44` }}>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.2 }}>{c.topic}</Typography>
                        <Typography sx={{ fontSize: 13, color: 'text.primary', lineHeight: 1.6 }}>{c.content}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }}>{(c.extracted_at||'').slice(0,10)} · {Math.round(parseFloat(c.confidence||0)*100)}% conf</Typography>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )
        })()}
      </Box>
    </Box>
  )
}

/* ─── CONVERSATION SUMMARY ─────────────────── */
function ConversationSummary({ sessions }) {
  const [selected, setSelected] = useState(null)

  if (!sessions.length) return <Alert severity="info">No sessions found. Complete an interview to see conversation summaries.</Alert>

  const sess = selected ? sessions.find(s => s.user_id === selected) : null

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Session list */}
      <Box sx={{ width: 240, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>Sessions</Typography>
        {sessions.map(s => (
          <Paper key={s.user_id} elevation={0} onClick={() => setSelected(s.user_id === selected ? null : s.user_id)}
            sx={{ mb: 0.5, p: 1.5, cursor: 'pointer', border: '1px solid', borderColor: selected === s.user_id ? 'primary.main' : 'divider', borderRadius: 2, bgcolor: selected === s.user_id ? 'rgba(220,38,38,0.06)' : 'background.paper', '&:hover': { borderColor: 'primary.main' }, transition: 'all 0.15s' }}>
            <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{s.user_name}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4, flexWrap: 'wrap' }}>
              <Chip label={s.status === 'completed' ? '✓ Done' : '● Active'} size="small"
                sx={{ fontSize: 10, height: 18, bgcolor: s.status === 'completed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: s.status === 'completed' ? '#22c55e' : '#f59e0b' }} />
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{s.chunks_extracted || 0} items</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Conversation detail */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {!sess ? (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
            <QuestionAnswer sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 1 }} />
            <Typography sx={{ color: 'text.secondary' }}>Select a session to view its conversation</Typography>
          </Paper>
        ) : (
          <Box>
            <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'white' }}>
                  {sess.user_name?.charAt(0).toUpperCase()}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{sess.user_name}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{sess.chunks_extracted} items · {(sess.conversation_history||[]).length} messages · {sess.last_active?.slice(0,10)}</Typography>
                </Box>
                <Chip label={sess.status} size="small" sx={{ ml: 'auto', bgcolor: sess.status === 'completed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: sess.status === 'completed' ? '#22c55e' : '#f59e0b' }} />
              </Box>
            </Paper>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, maxHeight: 520, overflow: 'auto' }}>
              {(sess.conversation_history || []).map((msg, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1.5, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: msg.role === 'assistant' ? 'primary.main' : '#1d6fab', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                    {msg.role === 'assistant' ? '🤖' : '👤'}
                  </Box>
                  <Paper elevation={0} sx={{ maxWidth: '75%', px: 1.5, py: 1, bgcolor: msg.role === 'assistant' ? 'rgba(255,255,255,0.04)' : '#1d4a7a', border: '1px solid', borderColor: 'divider', borderRadius: msg.role === 'assistant' ? '4px 12px 12px 12px' : '12px 4px 12px 12px' }}>
                    <Typography sx={{ fontSize: 13, lineHeight: 1.7 }}>{msg.content}</Typography>
                  </Paper>
                </Box>
              ))}
              {!(sess.conversation_history||[]).length && <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>No messages in this session yet.</Typography>}
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  )
}

/* ─── OVERVIEW ──────────────────────────────── */
function Overview({ knowledge, sessions }) {
  const people  = [...new Set(knowledge.map(c=>c.employee_name).filter(Boolean))]
  const topics  = [...new Set(knowledge.map(c=>c.topic).filter(Boolean))]
  const domains = [...new Set(knowledge.map(c=>c.domain).filter(Boolean))]
  const days    = [...new Set(knowledge.map(c=>(c.extracted_at||'').slice(0,10)).filter(Boolean))]
  const highConf = knowledge.filter(c => parseFloat(c.confidence||0) >= 0.8).length
  const needsFU  = knowledge.filter(c => c.requires_followup).length

  const domainCounts = {}
  knowledge.forEach(c => { const d = c.domain||'unknown'; domainCounts[d] = (domainCounts[d]||0)+1 })
  const topDomains = Object.entries(domainCounts).sort((a,b)=>b[1]-a[1])

  const personCounts = {}
  knowledge.forEach(c => { if (c.employee_name) personCounts[c.employee_name] = (personCounts[c.employee_name]||0)+1 })

  return (
    <Box>
      {/* Stat cards */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <StatCard icon="📊" label="Total Items"    value={knowledge.length} color="primary.main" />
        <StatCard icon="👥" label="Employees"      value={people.length}   color="#3b82f6" />
        <StatCard icon="🏷" label="Unique Topics"  value={topics.length}   color="#10b981" />
        <StatCard icon="📅" label="Active Days"    value={days.length}     color="#8b5cf6" />
        <StatCard icon="✅" label="High Confidence" value={highConf}       color="#22c55e" />
        <StatCard icon="⚡" label="Needs Follow-up" value={needsFU}        color="#f59e0b" />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {/* Domain breakdown */}
        <Paper elevation={0} sx={{ flex: 1, minWidth: 240, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>📁 By Domain</Typography>
          {topDomains.map(([dom, count]) => (
            <Box key={dom} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ fontSize: 13 }}>{domainIcon(dom)} {dom}</Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{count}</Typography>
              </Box>
              <LinearProgress variant="determinate" value={Math.round(count/knowledge.length*100)}
                sx={{ borderRadius: 1, height: 6, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: domainColor(dom) } }} />
            </Box>
          ))}
        </Paper>

        {/* Per-employee */}
        <Paper elevation={0} sx={{ flex: 1, minWidth: 240, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>👤 Per Employee</Typography>
          {Object.entries(personCounts).sort((a,b)=>b[1]-a[1]).map(([name, count]) => (
            <Box key={name} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{name}</Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{count} items</Typography>
              </Box>
              <LinearProgress variant="determinate" value={Math.round(count/knowledge.length*100)}
                sx={{ borderRadius: 1, height: 6, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: 'primary.main' } }} />
            </Box>
          ))}
        </Paper>

        {/* Sessions */}
        <Paper elevation={0} sx={{ flex: 1, minWidth: 240, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>🗓 Sessions</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map(s => (
                  <TableRow key={s.user_id}>
                    <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{s.user_name}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{s.chunks_extracted}</TableCell>
                    <TableCell>
                      <Chip label={s.status} size="small" sx={{ fontSize: 10, height: 20, bgcolor: s.status==='completed'?'rgba(34,197,94,0.12)':'rgba(245,158,11,0.12)', color: s.status==='completed'?'#22c55e':'#f59e0b' }} />
                    </TableCell>
                  </TableRow>
                ))}
                {!sessions.length && <TableRow><TableCell colSpan={3} sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>No sessions yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  )
}

/* ─── MAIN PAGE ─────────────────────────────── */
const TABS = [
  { label: 'Overview',             icon: <Hub fontSize="small" /> },
  { label: 'By Topic',             icon: <Topic fontSize="small" /> },
  { label: 'By Date',              icon: <CalendarMonth fontSize="small" /> },
  { label: 'By Employee',          icon: <Person fontSize="small" /> },
  { label: 'Conversations',        icon: <QuestionAnswer fontSize="small" /> },
  { label: 'Web Resources',        icon: <>🌐</> },
]

export default function KnowledgeHub() {
  const [tab, setTab]           = useState(0)
  const [knowledge, setKnowledge] = useState([])
  const [sessions, setSessions]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [kRes, sRes] = await Promise.all([
          axios.get('/api/knowledge'),
          axios.get('/api/sessions'),
        ])
        setKnowledge(kRes.data || [])
        setSessions(sRes.data  || [])
      } catch { setError('Could not load data. Make sure the backend is running.') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">Knowledge Hub</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Explore all captured knowledge — browse by topic, date, or employee, and review full conversation histories.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}
        TabIndicatorProps={{ style: { backgroundColor: '#dc2626' } }}>
        {TABS.map((t, i) => (
          <Tab key={i} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>{t.icon}<span>{t.label}</span></Box>}
            sx={{ textTransform: 'none', fontWeight: 500, fontSize: 13, color: 'text.secondary', '&.Mui-selected': { color: 'white', fontWeight: 700 } }} />
        ))}
      </Tabs>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress color="primary" /></Box>
      ) : (
        <>
          {tab === 0 && <Overview   knowledge={knowledge} sessions={sessions} />}
          {tab === 1 && <ByTopic    knowledge={knowledge} />}
          {tab === 2 && <ByDate     knowledge={knowledge} />}
          {tab === 3 && <ByUser     knowledge={knowledge} />}
          {tab === 4 && <ConversationSummary sessions={sessions} />}
          {tab === 5 && <WebResources />}
        </>
      )}
    </Box>
  )
}
