import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

import {
  Box, Typography, Paper, Select, MenuItem, ListSubheader,
  FormControl, Button, Chip, CircularProgress,
  Alert, Snackbar
} from '@mui/material'

import {
  Sparkles, Globe, FileText, Check, Layers, ListChecks,
  Server, Wrench, Cpu, Workflow, AlertTriangle, HelpCircle,
  GitBranch, Copy, Download
} from 'lucide-react'

import { PDFDownloadLink } from '@react-pdf/renderer'
import KnowledgeReportPDF from '../components/knowledge/KnowledgeReportPDF'

// ============================================================
// ANIMATION VARIANTS
// ============================================================
const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
}

// ============================================================
// LOADING STAGE LABELS
// ============================================================
const LOADING_STEPS = [
  'Identifying topics',
  'Extracting key facts',
  'Finding systems and tools',
  'Mapping relationships'
]

// ============================================================
// SMALL PRESENTATIONAL PIECES
// ============================================================
function SectionCard({ icon, title, children }) {
  return (
    <motion.div variants={fadeInUp}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.2, sm: 3 },
          mb: 2.5,
          borderRadius: 3,
          background: 'linear-gradient(145deg, rgba(15,30,50,0.9), rgba(10,22,38,0.9))',
          border: '1px solid #22385a'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 2, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(220,38,38,0.14)', color: '#f87171', flexShrink: 0
          }}>
            {icon}
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{title}</Typography>
        </Box>
        {children}
      </Paper>
    </motion.div>
  )
}

function ChipRow({ items, color }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {items.map((item, idx) => (
        <Chip
          key={idx}
          label={item}
          size="small"
          sx={{
            bgcolor: color || 'rgba(56,189,248,0.12)',
            color: '#e0f2fe',
            border: '1px solid #2a4060',
            fontWeight: 500,
            fontSize: 12.5
          }}
        />
      ))}
    </Box>
  )
}

function BulletList({ items }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item, idx) => (
        <Box key={idx} sx={{ display: 'flex', gap: 1.2, alignItems: 'flex-start' }}>
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#f87171', mt: '8px', flexShrink: 0 }} />
          <Typography sx={{ fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.6 }}>{item}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function ProcessFlow({ items }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
      {items.map((item, idx) => (
        <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box sx={{
            width: 24, height: 24, minWidth: 24, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
            bgcolor: '#0d2235', border: '1px solid #38bdf8', color: '#7dd3fc'
          }}>
            {idx + 1}
          </Box>
          <Typography sx={{ fontSize: 13.5, color: '#e0f2fe' }}>{item}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function RiskList({ items }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item, idx) => (
        <Box key={idx} sx={{
          display: 'flex', gap: 1.2, alignItems: 'flex-start', p: 1.4,
          borderRadius: 2, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)'
        }}>
          <AlertTriangle size={15} color="#fbbf24" style={{ marginTop: 2, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 13.5, color: '#fde68a', lineHeight: 1.6 }}>{item}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function RelationshipCards({ relationships }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      {relationships.map((rel, idx) => (
        <Box key={idx} sx={{
          p: 2, borderRadius: 2, textAlign: 'center',
          bgcolor: '#0d2235', border: '1px solid #22385a'
        }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{rel.source}</Typography>
          <Typography sx={{ fontSize: 11.5, color: '#7a9bb5', my: 0.4 }}>↓ {rel.relationship}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#7dd3fc' }}>{rel.target}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function QuestionList({ questions, onAsk }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {questions.map((q, idx) => (
        <Box
          key={idx}
          onClick={() => onAsk(q)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.2, p: 1.3, borderRadius: 2,
            bgcolor: '#0d2235', border: '1px solid #22385a', cursor: 'pointer',
            transition: 'all 0.15s',
            '&:hover': { borderColor: '#38bdf8', bgcolor: '#102a42' }
          }}
        >
          <HelpCircle size={14} color="#7dd3fc" style={{ flexShrink: 0 }} />
          <Typography sx={{ fontSize: 13, color: '#e0f2fe', flex: 1 }}>{q}</Typography>
          <Copy size={13} color="#64748b" style={{ flexShrink: 0 }} />
        </Box>
      ))}
    </Box>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function KnowledgeIntelligence() {
  const [sources, setSources] = useState([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState('')

  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const [sourceInfo, setSourceInfo] = useState(null)
  const [knowledge, setKnowledge] = useState(null)
  const [copiedToast, setCopiedToast] = useState(false)

  const timers = useRef([])

  useEffect(() => {
    loadSources()
    return () => timers.current.forEach(clearTimeout)
  }, [])

  const loadSources = async () => {
    try {
      setSourcesLoading(true)
      const [urlRes, pdfRes] = await Promise.all([
        axios.get('/api/url-history', { timeout: 15000 }).catch(() => ({ data: {} })),
        axios.get('/api/pdf-history', { timeout: 15000 }).catch(() => ({ data: {} }))
      ])

      const websiteSources = (urlRes.data?.analyses || []).map(a => ({
        key: `website:${a.id}`,
        id: a.id,
        source_type: 'website',
        title: a.title || a.url,
        ref: a.url,
        created_at: a.created_at
      }))

      const pdfSources = (pdfRes.data?.analyses || []).map(a => ({
        key: `pdf:${a.id}`,
        id: a.id,
        source_type: 'pdf',
        title: a.title || a.filename,
        ref: a.filename,
        created_at: a.created_at
      }))

      const merged = [...websiteSources, ...pdfSources].sort(
        (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
      )

      setSources(merged)
    } finally {
      setSourcesLoading(false)
    }
  }

  const selectedSource = useMemo(
    () => sources.find(s => s.key === selectedKey) || null,
    [sources, selectedKey]
  )

  const runLoadingSteps = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setLoadingStep(1)
    ;[900, 1900, 2900].forEach((delay, idx) => {
      const t = setTimeout(() => setLoadingStep(idx + 2), delay)
      timers.current.push(t)
    })
  }

  const generate = async () => {
    if (!selectedSource || loading) return

    setLoading(true)
    setError('')
    setKnowledge(null)
    setSourceInfo(null)
    runLoadingSteps()

    try {
      const res = await axios.post('/api/knowledge/intelligence', {
        source_type: selectedSource.source_type,
        analysis_id: selectedSource.id
      }, { timeout: 60000 })

      if (res.data?.success) {
        setKnowledge(res.data.knowledge)
        setSourceInfo(res.data.source)
      } else {
        setError(res.data?.message || 'Unable to generate Knowledge Intelligence. Please try again.')
      }
    } catch (err) {
      setError('Unable to generate Knowledge Intelligence. Please try again.')
    } finally {
      timers.current.forEach(clearTimeout)
      timers.current = []
      setLoading(false)
      setLoadingStep(0)
    }
  }

  const copyQuestion = async (question) => {
    try {
      await navigator.clipboard.writeText(question)
      setCopiedToast(true)
    } catch {
      // Clipboard access can be blocked by browser permissions — fail silently.
    }
  }

  const hasList = (list) => Array.isArray(list) && list.length > 0

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', pb: 6 }}>

      {/* ── HEADER ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 2.5, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #dc2626, #b91c1c)'
        }}>
          <Sparkles size={20} color="#fff" />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Knowledge Intelligence</Typography>
          <Typography sx={{ fontSize: 13, color: '#7a9bb5' }}>
            Turn an analyzed source into structured knowledge
          </Typography>
        </Box>
      </Box>

      {/* ── SOURCE SELECTION ── */}
      <Paper elevation={0} sx={{
        p: { xs: 2.2, sm: 3 }, mb: 3, borderRadius: 3,
        background: 'linear-gradient(145deg, rgba(15,30,50,0.9), rgba(10,22,38,0.9))',
        border: '1px solid #22385a'
      }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#7a9bb5', mb: 1.2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Select a source
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <Select
              displayEmpty
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              disabled={sourcesLoading || loading}
              renderValue={(value) => {
                if (!value) return <span style={{ color: '#64748b' }}>Existing PDF / URL</span>
                const s = sources.find(x => x.key === value)
                return s ? s.title : value
              }}
              sx={{
                bgcolor: '#0d2235', color: '#e0f2fe',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2a4060' }
              }}
            >
              {sources.length === 0 && (
                <MenuItem disabled value="">
                  {sourcesLoading ? 'Loading analyzed sources…' : 'No analyzed sources yet — analyze a URL or PDF first'}
                </MenuItem>
              )}

              {sources.filter(s => s.source_type === 'website').length > 0 && (
                <ListSubheader sx={{ bgcolor: '#0d2235', color: '#7a9bb5' }}>Websites</ListSubheader>
              )}
              {sources.filter(s => s.source_type === 'website').map(s => (
                <MenuItem key={s.key} value={s.key}>
                  <Globe size={14} style={{ marginRight: 8, flexShrink: 0 }} />
                  {s.title}
                </MenuItem>
              ))}

              {sources.filter(s => s.source_type === 'pdf').length > 0 && (
                <ListSubheader sx={{ bgcolor: '#0d2235', color: '#7a9bb5' }}>PDFs</ListSubheader>
              )}
              {sources.filter(s => s.source_type === 'pdf').map(s => (
                <MenuItem key={s.key} value={s.key}>
                  <FileText size={14} style={{ marginRight: 8, flexShrink: 0 }} />
                  {s.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            disabled={!selectedSource || loading}
            onClick={generate}
            startIcon={loading ? <CircularProgress size={14} thickness={5} sx={{ color: '#fff' }} /> : <Sparkles size={15} />}
            sx={{ px: 2.5, whiteSpace: 'nowrap' }}
          >
            Generate Knowledge Intelligence
          </Button>

          {knowledge && (
            <PDFDownloadLink
              document={
                <KnowledgeReportPDF
                  knowledge={knowledge}
                  sourceInfo={sourceInfo}
                />
              }
              fileName="Helix_AI_Knowledge_Intelligence_Report.pdf"
              style={{ textDecoration: 'none' }}
            >
              {({ loading: pdfLoading }) => (
                <Button
                  variant="outlined"
                  disabled={loading || pdfLoading}
                  startIcon={
                    pdfLoading
                      ? <CircularProgress size={15} />
                      : <Download size={15} />
                  }
                  sx={{ px: 2.5, whiteSpace: 'nowrap' }}
                >
                  {pdfLoading ? 'Generating Report…' : 'Generate Report'}
                </Button>
              )}
            </PDFDownloadLink>
          )}
        </Box>
      </Paper>

      {/* ── LOADING STATE ── */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Paper elevation={0} sx={{
              p: 3, mb: 3, borderRadius: 3,
              background: 'linear-gradient(145deg, rgba(15,30,50,0.9), rgba(10,22,38,0.9))',
              border: '1px solid #22385a'
            }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#e0f2fe', mb: 2 }}>
                Analyzing knowledge…
              </Typography>
              {LOADING_STEPS.map((label, idx) => {
                const stepNumber = idx + 1
                const completed = loadingStep > stepNumber
                const active = loadingStep === stepNumber
                return (
                  <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.4 }}>
                    <Box sx={{
                      width: 24, height: 24, minWidth: 24, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      bgcolor: completed ? '#0f3d2e' : active ? '#1a3a5c' : '#0d2235',
                      border: completed ? '1.5px solid #34d399' : active ? '1.5px solid #38bdf8' : '1px solid #29445d'
                    }}>
                      {completed
                        ? <Check size={13} color="#34d399" />
                        : active
                          ? <CircularProgress size={12} thickness={5} sx={{ color: '#38bdf8' }} />
                          : <Typography sx={{ fontSize: 11, color: '#64748b' }}>{stepNumber}</Typography>}
                    </Box>
                    <Typography sx={{ fontSize: 13, color: completed || active ? '#e0f2fe' : '#64748b', fontWeight: active ? 600 : 400 }}>
                      {label}
                    </Typography>
                  </Box>
                )
              })}
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ERROR STATE ── */}
      {!loading && error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>Unable to generate Knowledge Intelligence.</Typography>
          <Typography sx={{ fontSize: 12.5 }}>{error === 'Unable to generate Knowledge Intelligence. Please try again.' ? 'Please try again.' : error}</Typography>
        </Alert>
      )}

      {/* ── EMPTY STATE ── */}
      {!loading && !error && !knowledge && (
        <Paper elevation={0} sx={{
          p: { xs: 4, sm: 6 }, textAlign: 'center', borderRadius: 3,
          background: 'linear-gradient(145deg, rgba(15,30,50,0.85), rgba(10,22,38,0.85))',
          border: '1px solid #22385a'
        }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: 3, mx: 'auto', mb: 2.5, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(220,38,38,0.18), rgba(56,189,248,0.10))'
          }}>
            <Sparkles size={24} color="#f87171" />
          </Box>
          <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', mb: 1 }}>
            Turn your documents and websites into structured knowledge.
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: '#7a9bb5', maxWidth: 480, mx: 'auto' }}>
            Select an analyzed PDF or website to discover:
            <br />
            Topics • Facts • Systems • Tools • Processes • Relationships
          </Typography>
        </Paper>
      )}

      {/* ── DASHBOARD ── */}
      <AnimatePresence>
        {!loading && knowledge && (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">

            {sourceInfo && (
              <SectionCard icon={<Layers size={16} />} title="Source">
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', mb: 1.5 }}>
                  {sourceInfo.title || 'Untitled source'}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: '#7a9bb5', textTransform: 'uppercase', letterSpacing: 0.5 }}>Type</Typography>
                    <Chip
                      size="small"
                      icon={sourceInfo.source_type === 'pdf' ? <FileText size={13} /> : <Globe size={13} />}
                      label={sourceInfo.source_type === 'pdf' ? 'PDF' : 'Website'}
                      sx={{ mt: 0.5, bgcolor: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}
                    />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: '#7a9bb5', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {sourceInfo.source_type === 'pdf' ? 'File name' : 'URL'}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#cbd5e1', mt: 0.5, wordBreak: 'break-all' }}>
                      {sourceInfo.url || '—'}
                    </Typography>
                  </Box>
                </Box>
              </SectionCard>
            )}

            {knowledge.summary && (
              <SectionCard icon={<Sparkles size={16} />} title="Summary">
                <Typography sx={{ fontSize: 14, color: '#e0f2fe', lineHeight: 1.75 }}>
                  {knowledge.summary}
                </Typography>
              </SectionCard>
            )}

            {hasList(knowledge.topics) && (
              <SectionCard icon={<Layers size={16} />} title="Topics">
                <ChipRow items={knowledge.topics} />
              </SectionCard>
            )}

            {hasList(knowledge.key_facts) && (
              <SectionCard icon={<ListChecks size={16} />} title="Key Facts">
                <BulletList items={knowledge.key_facts} />
              </SectionCard>
            )}

            {hasList(knowledge.systems) && (
              <SectionCard icon={<Server size={16} />} title="Systems">
                <ChipRow items={knowledge.systems} color="rgba(139,92,246,0.14)" />
              </SectionCard>
            )}

            {hasList(knowledge.tools) && (
              <SectionCard icon={<Wrench size={16} />} title="Tools">
                <ChipRow items={knowledge.tools} color="rgba(20,184,166,0.14)" />
              </SectionCard>
            )}

            {hasList(knowledge.technologies) && (
              <SectionCard icon={<Cpu size={16} />} title="Technologies">
                <ChipRow items={knowledge.technologies} color="rgba(99,102,241,0.14)" />
              </SectionCard>
            )}

            {hasList(knowledge.processes) && (
              <SectionCard icon={<Workflow size={16} />} title="Processes">
                <ProcessFlow items={knowledge.processes} />
              </SectionCard>
            )}

            {hasList(knowledge.risks) && (
              <SectionCard icon={<AlertTriangle size={16} />} title="Risks / Considerations">
                <RiskList items={knowledge.risks} />
              </SectionCard>
            )}

            {hasList(knowledge.suggested_questions) && (
              <SectionCard icon={<HelpCircle size={16} />} title="Suggested Questions">
                <QuestionList questions={knowledge.suggested_questions} onAsk={copyQuestion} />
              </SectionCard>
            )}

            {hasList(knowledge.relationships) && (
              <SectionCard icon={<GitBranch size={16} />} title="Knowledge Relationships">
                <RelationshipCards relationships={knowledge.relationships} />
              </SectionCard>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      <Snackbar
        open={copiedToast}
        autoHideDuration={2200}
        onClose={() => setCopiedToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="Question copied to clipboard"
      />
    </Box>
  )
}
