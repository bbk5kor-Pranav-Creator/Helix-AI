import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'

import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Tooltip,
  IconButton
} from '@mui/material'

import {
  Search,
  Plus,
  History,
  Sparkles,
  Copy,
  Check,
  Download,
  FileText,
  ExternalLink,
  ArrowRight,
  Eye,
  Trash2,
  Globe,
  RefreshCw
} from 'lucide-react'

// ============================================================
// ANIMATION VARIANTS
// ============================================================
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const cardVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } }
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function UploadURL() {
  // -------------------- STATE --------------------
  const [url, setUrl] = useState('')
  const [instruction, setInstruction] = useState('')
  const [analysisMode, setAnalysisMode] = useState('custom')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [urlError, setUrlError] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  // -------------------- CONVERSATION --------------------
  const [conversationSessionId, setConversationSessionId] = useState(null)
  const [conversationMessages, setConversationMessages] = useState([])
  const [conversationQuestion, setConversationQuestion] = useState('')
  const [conversationLoading, setConversationLoading] = useState(false)
  const [conversationError, setConversationError] = useState('')

  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [clearingHistory, setClearingHistory] = useState(false)

  // -------------------- ANALYSIS MODES --------------------

  const analysisModes = [
    {
      id: 'summary',
      label: 'Summary',
      icon: '✦',
      instruction: 'Give me a concise, well-organized summary of this website. Include only the most important information and avoid unnecessary details.'
    },
    {
      id: 'detailed',
      label: 'Detailed',
      icon: '≡',
      instruction: 'Give me a detailed but well-organized explanation of the important information on this website. Use clear headings and bullet points where useful.'
    },
    {
      id: 'extract',
      label: 'Extract',
      icon: '⌕',
      instruction: 'Extract the specific information that is most relevant from this website. Do not add unrelated information. Clearly state when the requested information is not available.'
    },
    {
      id: 'technical',
      label: 'Technical',
      icon: '⚙',
      instruction: 'Analyze this website from a technical perspective. Identify relevant technologies, systems, architecture, processes, tools, technical terminology, and implementation details supported by the source.'
    },
    {
      id: 'research',
      label: 'Research',
      icon: '◇',
      instruction: 'Analyze this website as a research source. Extract the key concepts, facts, findings, terminology, and useful points, and organize them clearly without inventing information.'
    },
    {
      id: 'custom',
      label: 'Custom',
      icon: '✎',
      instruction: ''
    }
  ]

  const selectAnalysisMode = (mode) => {
    setAnalysisMode(mode)
    const selectedMode = analysisModes.find(item => item.id === mode)
    setInstruction(selectedMode?.instruction || '')
    setError('')
  }

  // -------------------- EXPORT HELPERS --------------------
  const getExportTitle = () => result?.source_title || result?.title || 'Helix AI Analysis'

  const sanitizeFileName = (value) =>
    String(value || 'Helix_AI_Analysis')
      .replace(/[<>:"/\\|?*]+/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 90)

  const escapeXml = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const downloadBlob = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  const exportPdf = () => {
    if (!result?.answer) return

    const title = getExportTitle()
    const sourceUrl = result.source_url || url
    const sourceTitle = result.source_title || title
    const analysisInstruction = result.instruction || instruction || 'Website analysis'

    const escapeHtml = (value) =>
      String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')

    const formattedAnswer = escapeHtml(result.answer).replace(/\r?\n/g, '<br/>')

    const printFrame = document.createElement('iframe')
    printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(printFrame)

    const doc = printFrame.contentWindow.document
    doc.open()
    doc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4; margin: 18mm; }
            body { margin: 0; color: #20242b; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.6; }
            .brand { color: #dc2626; font-size: 10pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px; }
            h1 { margin: 0 0 16px; color: #171a20; font-size: 22pt; line-height: 1.2; }
            .meta { margin-bottom: 24px; padding: 12px 14px; border: 1px solid #d9dee5; border-radius: 8px; background: #f6f8fa; }
            .meta-row { margin: 4px 0; }
            .label { color: #505965; font-weight: 700; }
            h2 { margin: 0 0 10px; color: #dc2626; font-size: 14pt; }
            .answer { overflow-wrap: anywhere; }
            .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #d9dee5; color: #747c87; font-size: 8.5pt; }
          </style>
        </head>
        <body>
          <div class="brand">Helix AI</div>
          <h1>${escapeHtml(sourceTitle)}</h1>
          <div class="meta">
            <div class="meta-row"><span class="label">Source:</span> ${escapeHtml(sourceUrl)}</div>
            <div class="meta-row"><span class="label">Analysis:</span> ${escapeHtml(analysisInstruction)}</div>
            <div class="meta-row"><span class="label">Generated:</span> ${escapeHtml(new Date().toLocaleString())}</div>
          </div>
          <h2>AI Insight</h2>
          <div class="answer">${formattedAnswer}</div>
          <div class="footer">Generated by Helix AI</div>
        </body>
      </html>
    `)
    doc.close()

    setTimeout(() => {
      printFrame.contentWindow.focus()
      printFrame.contentWindow.print()
      setTimeout(() => printFrame.remove(), 1000)
    }, 300)
  }

  const exportDocx = async () => {
    if (!result?.answer) return

    try {
      const { default: JSZip } = await import('jszip')
      const title = getExportTitle()
      const sourceUrl = result.source_url || url
      const sourceTitle = result.source_title || title
      const analysisInstruction = result.instruction || instruction || 'Website analysis'

      const answerParagraphs = String(result.answer)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => `
          <w:p>
            <w:r>
              <w:t xml:space="preserve">${escapeXml(line)}</w:t>
            </w:r>
          </w:p>
        `)
        .join('')

      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:rPr><w:b/><w:color w:val="DC2626"/><w:sz w:val="20"/></w:rPr><w:t>Helix AI</w:t></w:r></w:p>
            <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${escapeXml(sourceTitle)}</w:t></w:r></w:p>
            <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Source: </w:t></w:r><w:r><w:t>${escapeXml(sourceUrl)}</w:t></w:r></w:p>
            <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Analysis: </w:t></w:r><w:r><w:t>${escapeXml(analysisInstruction)}</w:t></w:r></w:p>
            <w:p><w:r><w:rPr><w:b/><w:color w:val="DC2626"/><w:sz w:val="24"/></w:rPr><w:t>AI Insight</w:t></w:r></w:p>
            ${answerParagraphs}
            <w:sectPr>
              <w:pgSz w:w="11906" w:h="16838"/>
              <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
            </w:sectPr>
          </w:body>
        </w:document>`

      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
      const rootRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
      const wordRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`

      const zip = new JSZip()
      zip.file('[Content_Types].xml', contentTypes)
      zip.folder('_rels').file('.rels', rootRelationships)
      const word = zip.folder('word')
      word.file('document.xml', documentXml)
      word.folder('_rels').file('document.xml.rels', wordRelationships)

      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      downloadBlob(blob, `${sanitizeFileName(sourceTitle)}_Helix_AI.docx`)
    } catch (err) {
      setError('DOCX export needs the jszip package. Run "npm install jszip" in the frontend folder and restart the app.')
    }
  }

  // -------------------- CONVERSATION --------------------
  const resetConversation = () => {
    setConversationSessionId(null)
    setConversationMessages([])
    setConversationQuestion('')
    setConversationLoading(false)
    setConversationError('')
  }

  const startConversation = async (analysisData, sourceValue, finalInstruction) => {
    try {
      setConversationError('')

      const response = await axios.post(
        '/api/conversation/start',
        {
          source_type: 'website',
          source: sourceValue,
          title: analysisData?.title || analysisData?.source_title || 'Helix AI Analysis',
          instruction: finalInstruction,
          analysis_id: analysisData?.analysis_id || null
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      )

      if (!response.data?.success || !response.data?.session_id) {
        throw new Error(response.data?.error || 'Unable to start the conversation.')
      }

      setConversationSessionId(response.data.session_id)
      setConversationMessages([])
      return response.data.session_id
    } catch (err) {
      console.error('Conversation start failed:', err)
      setConversationSessionId(null)
      setConversationError(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Unable to start the conversation.'
      )
      return null
    }
  }

  const sendConversationMessage = async () => {
    const question = conversationQuestion.trim()

    if (!question || conversationLoading) return

    if (!conversationSessionId) {
      setConversationError('Conversation is not available for this analysis.')
      return
    }

    const userMessage = {
      role: 'user',
      content: question
    }

    setConversationQuestion('')
    setConversationError('')
    setConversationMessages(prev => [...prev, userMessage])
    setConversationLoading(true)

    try {
      const response = await axios.post(
        '/api/conversation/message',
        {
          session_id: conversationSessionId,
          question
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 180000
        }
      )

      const data = response.data

      if (!data?.success) {
        throw new Error(data?.error || 'Unable to generate the answer.')
      }

      setConversationMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || 'No answer was returned.',
          chunks_used: data.chunks_used,
          conversation_turns: data.conversation_turns
        }
      ])
    } catch (err) {
      console.error('Conversation message failed:', err)

      setConversationMessages(prev => {
        const next = [...prev]
        if (next.length > 0 && next[next.length - 1]?.role === 'user') {
          next.pop()
        }
        return next
      })

      setConversationError(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Unable to answer that question.'
      )

      setConversationQuestion(question)
    } finally {
      setConversationLoading(false)
    }
  }

  const handleConversationKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendConversationMessage()
    }
  }

  // -------------------- HELPERS --------------------
  const normalizeURL = (value) => {
    const text = value.trim()
    const match = text.match(/^\[.*?\]\((https?:\/\/[^)]+)\)$/)
    return match ? match[1] : text
  }

  const getDomain = (sourceURL) => {
    try {
      return new URL(sourceURL).hostname
    } catch {
      return sourceURL
    }
  }

  const formatDate = (value) => {
    if (!value) return ''
    try {
      const date = new Date(value.replace(' ', 'T') + 'Z')
      if (Number.isNaN(date.getTime())) return value
      return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return value
    }
  }

  const copyAnswer = async () => {
    if (!result?.answer) return
    try {
      await navigator.clipboard.writeText(result.answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // -------------------- HISTORY --------------------
  const loadHistory = async () => {
    try {
      setHistoryLoading(true)
      setHistoryError('')
      const response = await axios.get('/api/url-history', {
        params: { limit: 100 },
        timeout: 30000
      })
      if (response.data?.success) {
        setHistory(response.data.analyses || [])
      } else {
        setHistoryError(response.data?.error || 'Unable to load analysis history.')
      }
    } catch (err) {
      console.error(err)
      setHistoryError('Unable to load analysis history. Make sure the backend is running.')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const openHistoryItem = async (analysisId) => {
    try {
      resetConversation()
      setHistoryLoading(true)
      setHistoryError('')
      const response = await axios.get(`/api/url-history/${analysisId}`, { timeout: 30000 })
      if (!response.data?.success) throw new Error(response.data?.error || 'Analysis could not be loaded.')

      const item = response.data.analysis
      const savedConversation = response.data.conversation

      setUrl(item.url || '')
      setInstruction(item.instruction || '')

      const matchedMode = analysisModes.find(
        mode => mode.instruction && mode.instruction === item.instruction
      )

      setAnalysisMode(matchedMode?.id || 'custom')

      const historyResult = {
        success: true,
        analysis_id: item.id,
        title: item.title || 'Untitled Website',
        source_title: item.title || '',
        source_url: item.url || '',
        answer: item.answer || '',
        instruction: item.instruction || '',
        model: item.model,
        extraction_method: item.extraction_method,
        chunks_used: item.chunks_used
      }

      setResult(historyResult)

      if (
        savedConversation?.session_id &&
        Array.isArray(savedConversation.messages)
      ) {
        setConversationSessionId(savedConversation.session_id)

        setConversationMessages(
          savedConversation.messages.map(message => ({
            role: message.role,
            content: message.content,
            chunks_used: Number(message.chunks_used) || 0
          }))
        )
      } else {
        setConversationSessionId(null)
        setConversationMessages([])

        if (item.url) {
          await startConversation(
            historyResult,
            item.url,
            item.instruction || 'Provide a clear and useful general analysis of this website.'
          )
        }
      }

      setConversationQuestion('')
      setConversationError('')
      setCopied(false)
      setError('')
      setUrlError('')
      setShowHistory(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error(err)
      setHistoryError(err.response?.data?.detail || err.message || 'Unable to open this analysis.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const deleteHistoryItem = async (analysisId) => {
    try {
      setDeletingId(analysisId)
      const response = await axios.delete(`/api/url-history/${analysisId}`, { timeout: 30000 })
      if (!response.data?.success) throw new Error(response.data?.error || 'Unable to delete analysis.')

      setHistory(prev => prev.filter(item => item.id !== analysisId))
      if (result?.analysis_id === analysisId) resetAnalysis()
    } catch (err) {
      console.error(err)
      setHistoryError(err.response?.data?.detail || err.message || 'Unable to delete analysis.')
    } finally {
      setDeletingId(null)
    }
  }

  const clearAllHistory = async () => {
    if (history.length === 0) return
    if (!window.confirm('Are you sure you want to clear all analysis history?')) return

    try {
      setClearingHistory(true)
      setHistoryError('')
      const response = await axios.delete('/api/url-history', { timeout: 30000 })
      if (!response.data?.success) throw new Error(response.data?.error || 'Unable to clear history.')

      setHistory([])
      if (result) resetAnalysis()
    } catch (err) {
      console.error(err)
      setHistoryError(err.response?.data?.detail || err.message || 'Unable to clear history.')
    } finally {
      setClearingHistory(false)
    }
  }

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    if (!query) return history
    return history.filter(item => {
      const title = (item.title || '').toLowerCase()
      const urlVal = (item.url || '').toLowerCase()
      const instr = (item.instruction || '').toLowerCase()
      return title.includes(query) || urlVal.includes(query) || instr.includes(query)
    })
  }, [history, historySearch])

  // -------------------- ANALYZE --------------------
  const analyzeURL = async () => {
    setUrlError('')
    setError('')
    setResult(null)
    setCopied(false)
    resetConversation()

    const normalizedURL = normalizeURL(url)

    try {
      const parsed = new URL(normalizedURL)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error()
    } catch {
      setUrlError('Please enter a valid website URL.')
      return
    }

    const finalInstruction = instruction.trim() || 'Provide a clear and useful general analysis of this website.'

    try {
      setLoading(true)
      setLoadingStage(1)
      await new Promise(r => setTimeout(r, 300))
      setLoadingStage(2)
      await new Promise(r => setTimeout(r, 300))
      setLoadingStage(3)

      const response = await axios.post(
        '/api/analyze-url',
        { url: normalizedURL, instruction: finalInstruction },
        { headers: { 'Content-Type': 'application/json' }, timeout: 180000 }
      )

      const data = response.data
      if (!data.success) {
        setError(data.message || 'Website analysis failed.')
        setLoadingStage(0)
        return
      }

      setLoadingStage(4)
      setResult(data)
      loadHistory()

      await startConversation(
        data,
        normalizedURL,
        finalInstruction
      )
    } catch (err) {
      console.error(err)
      if (err.response?.data) {
        setError(err.response.data.message || err.response.data.detail || 'The Helix AI backend returned an error.')
      } else if (err.code === 'ECONNABORTED') {
        setError('The analysis took too long. Please try again.')
      } else if (err.code === 'ERR_NETWORK') {
        setError('Unable to connect to Helix AI. Make sure the FastAPI backend is running on port 8000.')
      } else {
        setError('Something went wrong while analyzing the website.')
      }
      setLoadingStage(0)
    } finally {
      setLoading(false)
    }
  }

  const quickPrompts = [
    'Summarize this website',
    'What are the main points?',
    'Explain what this website is about',
    'Give me a summary in 200 words'
  ]

  const useQuickPrompt = (prompt) => {
    setInstruction(prompt)
    setError('')
  }

  const resetAnalysis = () => {
    setUrl('')
    setInstruction('')
    setAnalysisMode('custom')
    setResult(null)
    resetConversation()
    setError('')
    setUrlError('')
    setLoadingStage(0)
    setCopied(false)
    setShowHistory(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openHistory = () => {
    setShowHistory(true)
    setError('')
    setHistoryError('')
    loadHistory()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // -------------------- LOADING STAGE --------------------
  const LoadingStage = ({ number, label }) => {
    const completed = loadingStage > number
    const active = loadingStage === number

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            minWidth: 28,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: completed ? '#0f3d2e' : active ? '#1a3a5c' : '#0d2235',
            border: completed ? '1.5px solid #34d399' : active ? '1.5px solid #38bdf8' : '1px solid #29445d',
            color: completed ? '#34d399' : '#7dd3fc',
            fontSize: '11px',
            fontWeight: 700
          }}
        >
          {completed ? <Check size={14} strokeWidth={2.5} /> : active ? (
            <CircularProgress size={13} thickness={5} sx={{ color: '#38bdf8' }} />
          ) : number}
        </Box>
        <Typography sx={{ color: completed || active ? '#e0f2fe' : '#64748b', fontSize: '13px', fontWeight: active ? 600 : 400 }}>
          {label}
        </Typography>
      </Box>
    )
  }

  // -------------------- MARKDOWN COMPONENTS --------------------
  const markdownComponents = {
    h1: ({ children }) => <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800, mt: 3, mb: 2, lineHeight: 1.3 }}>{children}</Typography>,
    h2: ({ children }) => <Typography variant="h5" sx={{ color: '#fff', fontWeight: 750, mt: 3.5, mb: 2, lineHeight: 1.3 }}>{children}</Typography>,
    h3: ({ children }) => <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mt: 3, mb: 1.5, lineHeight: 1.35 }}>{children}</Typography>,
    h4: ({ children }) => <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, mt: 2.5, mb: 1.25 }}>{children}</Typography>,
    h5: ({ children }) => <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, mt: 2, mb: 1 }}>{children}</Typography>,
    h6: ({ children }) => <Typography variant="subtitle2" sx={{ color: '#e2e8f0', fontWeight: 700, mt: 2, mb: 1 }}>{children}</Typography>,
    p: ({ children }) => <Typography component="p" sx={{ color: '#cbd9e5', fontSize: '15.5px', lineHeight: 1.85, mb: 2, '&:last-child': { mb: 0 } }}>{children}</Typography>,
    ul: ({ children }) => <Box component="ul" sx={{ color: '#cbd9e5', pl: 3, mb: 2, '& li::marker': { color: '#7a9bb5' } }}>{children}</Box>,
    ol: ({ children }) => <Box component="ol" sx={{ color: '#cbd9e5', pl: 3, mb: 2, '& li::marker': { color: '#7a9bb5' } }}>{children}</Box>,
    li: ({ children }) => <Box component="li" sx={{ color: '#cbd9e5', mb: 1, lineHeight: 1.75, pl: 0.5 }}>{children}</Box>,
    strong: ({ children }) => <Box component="strong" sx={{ color: '#fff', fontWeight: 750 }}>{children}</Box>,
    em: ({ children }) => <Box component="em" sx={{ color: 'inherit', fontStyle: 'italic' }}>{children}</Box>,
    code: ({ children }) => (
      <Box component="code" sx={{ backgroundColor: '#1d3852', color: '#7dd3fc', px: 0.8, py: 0.2, borderRadius: 1, fontSize: '0.9em', fontFamily: 'monospace', wordBreak: 'break-word' }}>
        {children}
      </Box>
    ),
    // "pre" always wraps block code, so it resets the inline "code" badge styling for real code blocks.
    pre: ({ children }) => (
      <Box
        component="pre"
        sx={{
          backgroundColor: '#0f2338',
          border: '1px solid #29445c',
          borderRadius: 2,
          p: 2,
          mb: 2,
          overflowX: 'auto',
          fontSize: '0.88em',
          lineHeight: 1.6,
          '& code': { backgroundColor: 'transparent', color: '#e2e8f0', padding: 0, borderRadius: 0 }
        }}
      >
        {children}
      </Box>
    ),
    a: ({ href, children }) => (
      <Box component="a" href={href} target="_blank" rel="noopener noreferrer" sx={{ color: '#38bdf8', textDecoration: 'none', wordBreak: 'break-word', '&:hover': { textDecoration: 'underline', color: '#7dd3fc' } }}>
        {children}
      </Box>
    ),
    blockquote: ({ children }) => (
      <Box component="blockquote" sx={{ borderLeft: '3px solid #38bdf8', pl: 2.5, ml: 0, my: 2.5, color: '#9bb2c5', fontStyle: 'italic' }}>
        {children}
      </Box>
    ),
    table: ({ children }) => (
      <Box sx={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', mb: 3, borderRadius: 2, border: '1px solid #29445c' }}>
        <Box component="table" sx={{ width: '100%', minWidth: 420, borderCollapse: 'collapse', color: '#dce7ef' }}>{children}</Box>
      </Box>
    ),
    thead: ({ children }) => <Box component="thead" sx={{ backgroundColor: '#1d3852' }}>{children}</Box>,
    tbody: ({ children }) => (
      <Box component="tbody" sx={{ backgroundColor: '#102337', '& tr:nth-of-type(even)': { backgroundColor: '#0d1e30' } }}>
        {children}
      </Box>
    ),
    tr: ({ children }) => <Box component="tr" sx={{ borderBottom: '1px solid #29445c' }}>{children}</Box>,
    th: ({ children }) => <Box component="th" sx={{ padding: '12px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, border: '1px solid #29445c', whiteSpace: 'nowrap' }}>{children}</Box>,
    td: ({ children }) => <Box component="td" sx={{ padding: '12px 14px', color: '#cbd9e5', border: '1px solid #29445c', verticalAlign: 'top', fontSize: '14.5px' }}>{children}</Box>,
    hr: () => <Divider sx={{ borderColor: '#29445c', my: 3 }} />
  }

  // -------------------- HISTORY COLOUR PALETTE --------------------
  const historyPalettes = [
    { color: '#c4b5fd', background: 'rgba(139,92,246,0.18)', border: 'rgba(167,139,250,0.52)', cardTop: 'rgba(48,35,78,0.98)', cardBottom: 'rgba(22,22,38,0.98)', cardBorder: 'rgba(167,139,250,0.38)' },
    { color: '#67e8f9', background: 'rgba(6,182,212,0.17)', border: 'rgba(34,211,238,0.50)', cardTop: 'rgba(25,58,72,0.98)', cardBottom: 'rgba(18,28,38,0.98)', cardBorder: 'rgba(34,211,238,0.36)' },
    { color: '#6ee7b7', background: 'rgba(16,185,129,0.17)', border: 'rgba(52,211,153,0.50)', cardTop: 'rgba(24,61,48,0.98)', cardBottom: 'rgba(18,29,27,0.98)', cardBorder: 'rgba(52,211,153,0.36)' },
    { color: '#fdba74', background: 'rgba(249,115,22,0.17)', border: 'rgba(251,146,60,0.50)', cardTop: 'rgba(66,47,30,0.98)', cardBottom: 'rgba(30,27,23,0.98)', cardBorder: 'rgba(251,146,60,0.36)' },
    { color: '#f9a8d4', background: 'rgba(236,72,153,0.17)', border: 'rgba(244,114,182,0.50)', cardTop: 'rgba(66,34,57,0.98)', cardBottom: 'rgba(29,24,31,0.98)', cardBorder: 'rgba(244,114,182,0.36)' },
    { color: '#93c5fd', background: 'rgba(59,130,246,0.17)', border: 'rgba(96,165,250,0.50)', cardTop: 'rgba(28,48,75,0.98)', cardBottom: 'rgba(19,27,39,0.98)', cardBorder: 'rgba(96,165,250,0.36)' },
    { color: '#f0abfc', background: 'rgba(217,70,239,0.17)', border: 'rgba(232,121,249,0.50)', cardTop: 'rgba(61,32,68,0.98)', cardBottom: 'rgba(27,24,32,0.98)', cardBorder: 'rgba(232,121,249,0.36)' },
    { color: '#a5f3fc', background: 'rgba(20,184,166,0.17)', border: 'rgba(45,212,191,0.50)', cardTop: 'rgba(23,59,61,0.98)', cardBottom: 'rgba(18,28,32,0.98)', cardBorder: 'rgba(45,212,191,0.36)' }
  ]

  const getHistoryAccent = (index) => historyPalettes[index % historyPalettes.length]

  const getHistoryMode = (savedInstruction) => {
    const matched = analysisModes.find(m => m.instruction && m.instruction === savedInstruction)
    return matched?.label || 'Custom'
  }

  const getAnswerPreview = (answer) => {
    if (!answer) return 'No answer available.'
    const plain = answer.replace(/#{1,6}\s*/g, '').replace(/[*_`>-]/g, '').replace(/\s+/g, ' ').trim()
    return plain.length <= 150 ? plain : `${plain.slice(0, 150).trim()}...`
  }

  // -------------------- HISTORY CARD --------------------
  const HistoryCard = ({ item, index }) => {
    const isDeleting = deletingId === item.id
    const modeLabel = getHistoryMode(item.instruction || '')
    const modeAccent = getHistoryAccent(index)
    const preview = getAnswerPreview(item.answer || '')

    return (
      <motion.div variants={cardVariant}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.6 },
            borderRadius: 3,
            background: `linear-gradient(145deg, ${modeAccent.cardTop}, ${modeAccent.cardBottom})`,
            border: `1px solid ${modeAccent.cardBorder}`,
            boxShadow: '0 14px 34px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.025)',
            position: 'relative', overflow: 'hidden',
            transition: 'all 0.24s ease',
            '&::before': {
              content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${modeAccent.border}, transparent)`,
              opacity: 0.85
            },
            '&:hover': {
              borderColor: modeAccent.border, transform: 'translateY(-3px)',
              boxShadow: `0 22px 48px rgba(0,0,0,0.34), 0 0 0 1px ${modeAccent.cardBorder}`
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.7 }}>
                <Box sx={{
                  width: 30, height: 30, minWidth: 30, borderRadius: 1.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #334155, #1e293b)',
                  border: '1px solid #475569', color: '#e2e8f0', fontSize: '13px', fontWeight: 800
                }}>
                  H
                </Box>
                <Typography sx={{
                  color: '#fff', fontSize: { xs: '14px', sm: '15px' }, fontWeight: 750,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {item.title || 'Untitled Website'}
                </Typography>
              </Box>

              <Typography sx={{ color: '#2dd4bf', fontSize: '11px', mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getDomain(item.url)}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mb: 1 }}>
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', px: 1.1, py: 0.4, borderRadius: 5,
                  backgroundColor: modeAccent.background, border: `1px solid ${modeAccent.border}`,
                  color: modeAccent.color, fontSize: '10px', fontWeight: 750
                }}>
                  {modeLabel}
                </Box>
                <Typography sx={{ color: '#94a3b8', fontSize: '9px' }}>Analysis #{item.id}</Typography>
              </Box>

              {item.instruction && (
                <Typography sx={{
                  color: '#cbd5e1', fontSize: '12px', lineHeight: 1.55,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1
                }}>
                  {item.instruction}
                </Typography>
              )}

              <Box sx={{
                px: 1.4, py: 1.15, borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(2,6,23,0.48), rgba(15,23,42,0.30))',
                border: '1px solid rgba(148,163,184,0.16)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)'
              }}>
                <Typography sx={{ color: '#94a3b8', fontSize: '8px', fontWeight: 800, letterSpacing: '1px', mb: 0.45 }}>
                  ANSWER PREVIEW
                </Typography>
                <Typography sx={{
                  color: '#cbd5e1', fontSize: '11px', lineHeight: 1.6,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>
                  {preview}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.4, flexWrap: 'wrap' }}>
                <Typography sx={{ color: '#64748b', fontSize: '10px' }}>{formatDate(item.created_at)}</Typography>
                {item.chunks_used && (
                  <>
                    <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#475569' }} />
                    <Typography sx={{ color: '#64748b', fontSize: '10px' }}>{item.chunks_used} chunks</Typography>
                  </>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              <Tooltip title="Open analysis" arrow>
                <IconButton
                  onClick={() => openHistoryItem(item.id)}
                  disabled={historyLoading || isDeleting}
                  sx={{
                    width: 38, height: 38, color: '#5eead4',
                    background: 'linear-gradient(135deg, rgba(45,212,191,0.16), rgba(14,116,144,0.12))',
                    border: '1px solid rgba(94,234,212,0.34)',
                    boxShadow: '0 8px 20px rgba(20,184,166,0.10)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      color: '#fff', background: 'linear-gradient(135deg, #14b8a6, #0f766e)',
                      borderColor: '#99f6e4', boxShadow: '0 10px 24px rgba(45,212,191,0.30)',
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  <Eye size={17} strokeWidth={2.2} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete" arrow>
                <IconButton
                  onClick={() => deleteHistoryItem(item.id)}
                  disabled={isDeleting}
                  sx={{
                    width: 38, height: 38, color: '#fb7185',
                    background: 'linear-gradient(135deg, rgba(244,63,94,0.16), rgba(127,29,29,0.12))',
                    border: '1px solid rgba(251,113,133,0.34)',
                    boxShadow: '0 8px 20px rgba(244,63,94,0.09)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      color: '#fff', background: 'linear-gradient(135deg, #e11d48, #9f1239)',
                      borderColor: '#fda4af', boxShadow: '0 10px 24px rgba(251,113,133,0.30)',
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  {isDeleting ? <CircularProgress size={14} sx={{ color: '#fb7185' }} /> : <Trash2 size={16} strokeWidth={2.2} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>
      </motion.div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Box sx={{
      minHeight: '100%',
      background: 'radial-gradient(circle at 50% -15%, #1b3b5d 0%, #0b1928 43%, #07111c 100%)',
      color: '#fff',
      borderRadius: 3,
      px: { xs: 2, sm: 3 },
      py: { xs: 2, sm: 3 }
    }}>
      {/* PAGE ACTIONS */}
      <Box sx={{
        maxWidth: 1180, mx: 'auto', display: 'flex', alignItems: 'center',
        justifyContent: 'flex-end', py: 1, mb: { xs: 3, sm: 4 }, gap: 1
      }}>
        <Button
          onClick={resetAnalysis}
          disabled={loading}
          startIcon={<Plus size={15} strokeWidth={2.5} />}
          sx={{
            color: !showHistory ? '#fff' : '#94a3b8',
            backgroundColor: !showHistory ? 'rgba(220,38,38,0.18)' : 'transparent',
            border: !showHistory ? '1px solid #dc2626' : '1px solid transparent',
            borderRadius: 2, px: { xs: 1.4, sm: 1.9 }, py: 0.85, textTransform: 'none',
            fontSize: '12.5px', fontWeight: 650,
            '&:hover': { backgroundColor: 'rgba(220,38,38,0.28)', color: '#fff', borderColor: '#ef4444' }
          }}
        >
          New Analysis
        </Button>

        <Button
          onClick={openHistory}
          disabled={loading}
          startIcon={<History size={15} strokeWidth={2.3} />}
          sx={{
            color: showHistory ? '#fff' : '#94a3b8',
            backgroundColor: showHistory ? 'rgba(220,38,38,0.18)' : 'transparent',
            border: showHistory ? '1px solid #dc2626' : '1px solid transparent',
            borderRadius: 2, px: { xs: 1.4, sm: 1.9 }, py: 0.85, textTransform: 'none',
            fontSize: '12.5px', fontWeight: 650,
            '&:hover': { backgroundColor: 'rgba(220,38,38,0.28)', color: '#fff', borderColor: '#ef4444' }
          }}
        >
          History
          {history.length > 0 && (
            <Box component="span" sx={{
              ml: 0.8, px: 0.7, py: 0.15, borderRadius: 4,
              backgroundColor: '#dc2626', color: '#fff', fontSize: '10px', fontWeight: 800
            }}>
              {history.length}
            </Box>
          )}
        </Button>
      </Box>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div key="history" initial="hidden" animate="visible" exit="hidden" variants={fadeIn}>
            <Box sx={{
              maxWidth: 960, mx: 'auto', position: 'relative',
              '&::before': {
                content: '""', position: 'absolute', top: -120, left: '7%',
                width: '86%', height: 280,
                background: 'radial-gradient(circle, rgba(139,92,246,0.16) 0%, rgba(56,189,248,0.08) 40%, transparent 72%)',
                filter: 'blur(22px)', pointerEvents: 'none'
              },
              '& > *': { position: 'relative', zIndex: 1 }
            }}>
              <motion.div variants={fadeInUp}>
                <Box sx={{ mb: 3.5 }}>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.8,
                    px: 1.15, py: 0.55, mb: 1.15, borderRadius: 5,
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(56,189,248,0.10))',
                    border: '1px solid rgba(167,139,250,0.28)', color: '#c4b5fd',
                    fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase'
                  }}>
                    <History size={13} strokeWidth={2.3} />
                    Your workspace
                  </Box>
                  <Typography sx={{
                    color: '#f8fafc', fontSize: { xs: '32px', sm: '44px' },
                    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif', fontWeight: 850,
                    letterSpacing: '-1.9px',
                    background: 'linear-gradient(100deg, #ffffff 18%, #c4b5fd 62%, #67e8f9 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 34px rgba(139,92,246,0.16)'
                  }}>
                    Analysis History
                  </Typography>
                  <Typography sx={{ color: '#9aaac0', fontSize: '14px', mt: 1.1, maxWidth: 690, lineHeight: 1.7 }}>
                    Revisit your website analyses, continue conversations, and keep your research organized in one place.
                  </Typography>
                </Box>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Paper elevation={0} sx={{
                  p: 1.25, mb: 2.5, borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(25,22,46,0.96), rgba(11,27,44,0.96))',
                  border: '1px solid rgba(139,92,246,0.30)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)',
                  backdropFilter: 'blur(12px)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                      color: '#d8b4fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 40, height: 40, borderRadius: 2,
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.28), rgba(56,189,248,0.14))',
                      border: '1px solid rgba(196,181,253,0.34)',
                      boxShadow: '0 8px 22px rgba(139,92,246,0.14)'
                    }}>
                      <Search size={18} strokeWidth={2.3} />
                    </Box>
                    <TextField
                      fullWidth variant="standard" placeholder="Search your analyses..."
                      value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                      InputProps={{ disableUnderline: true }}
                      sx={{
                        '& .MuiInputBase-input': { color: '#e2e8f0', WebkitTextFillColor: '#e2e8f0', fontSize: '13.5px', fontWeight: 600, py: 1 },
                        '& .MuiInputBase-input::placeholder': { color: '#94a3b8', WebkitTextFillColor: '#94a3b8', opacity: 1 }
                      }}
                    />
                  </Box>
                </Paper>
              </motion.div>

              {historyError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{historyError}</Alert>}

              {history.length > 0 && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  mb: 1.5, px: 0.5, py: 0.2
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <Box sx={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: '#a78bfa',
                      boxShadow: '0 0 12px rgba(167,139,250,0.75)'
                    }} />
                    <Typography sx={{ color: '#aebbd0', fontSize: '11px', fontWeight: 650 }}>
                      {filteredHistory.length} {filteredHistory.length === 1 ? 'analysis' : 'analyses'} saved
                    </Typography>
                  </Box>
                  <Button
                    onClick={clearAllHistory}
                    disabled={clearingHistory || historyLoading}
                    size="small"
                    startIcon={<Trash2 size={13} strokeWidth={2.2} />}
                    sx={{
                      color: '#fb7185', textTransform: 'none', fontSize: '11.5px', fontWeight: 650,
                      borderRadius: 1.7, px: 1.1,
                      '&:hover': {
                        color: '#fff', backgroundColor: 'rgba(244,63,94,0.13)',
                        boxShadow: '0 8px 20px rgba(244,63,94,0.10)'
                      }
                    }}
                  >
                    {clearingHistory ? 'Clearing...' : 'Clear history'}
                  </Button>
                </Box>
              )}

              {historyLoading && history.length === 0 && (
                <Paper elevation={0} sx={{ p: 5, borderRadius: 3, textAlign: 'center', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
                  <CircularProgress size={26} sx={{ color: '#38bdf8', mb: 2 }} />
                  <Typography sx={{ color: '#94a3b8', fontSize: '13px' }}>Loading your analyses...</Typography>
                </Paper>
              )}

              {!historyLoading && history.length === 0 && (
                <motion.div variants={scaleIn}>
                  <Paper elevation={0} sx={{
                    p: { xs: 4, sm: 6 }, borderRadius: 3.5, textAlign: 'center',
                    background: 'linear-gradient(145deg, rgba(24,20,44,0.98), rgba(8,22,37,0.98))',
                    border: '1px solid rgba(139,92,246,0.24)',
                    boxShadow: '0 22px 50px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)'
                  }}>
                    <Box sx={{
                      width: 60, height: 60, mx: 'auto', mb: 2, borderRadius: 2.5,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: '1px solid #ef4444',
                      color: '#fff', fontSize: '24px', fontWeight: 800
                    }}>
                      H
                    </Box>
                    <Typography sx={{ color: '#fff', fontSize: '19px', fontWeight: 750, mb: 1 }}>No analyses yet</Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.7, maxWidth: 450, mx: 'auto', mb: 3 }}>
                      Analyze a website and your results will automatically appear here.
                    </Typography>
                    <Button
                      onClick={resetAnalysis}
                      endIcon={<ArrowRight size={16} strokeWidth={2.5} />}
                      sx={{
                        background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', borderRadius: 2,
                        px: 2.8, py: 1.1, textTransform: 'none', fontWeight: 700, fontSize: '13.5px',
                        boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
                        '&:hover': { background: 'linear-gradient(135deg, #fb923c, #f97316)', boxShadow: '0 10px 28px rgba(249,115,22,0.45)' }
                      }}
                    >
                      Analyze a website
                    </Button>
                  </Paper>
                </motion.div>
              )}

              {!historyLoading && history.length > 0 && filteredHistory.length === 0 && (
                <Paper elevation={0} sx={{ p: 4, borderRadius: 3, textAlign: 'center', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
                  <Typography sx={{ color: '#fff', fontSize: '16px', fontWeight: 700, mb: 1 }}>No matching analyses</Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '12px' }}>Try a different title, URL, or instruction.</Typography>
                </Paper>
              )}

              {filteredHistory.length > 0 && (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredHistory.map((item, index) => <HistoryCard key={item.id} item={item} index={index} />)}
                </motion.div>
              )}
            </Box>
          </motion.div>
        ) : (
          <motion.div key="workspace" initial="hidden" animate="visible" exit="hidden" variants={fadeIn}>
            <>
              {!result && !loading && (
                <motion.div variants={fadeInUp}>
                  <Box sx={{ maxWidth: 850, mx: 'auto', textAlign: 'center', mb: 5 }}>
                    <Typography sx={{
                      fontSize: { xs: '38px', sm: '56px' }, fontWeight: 850, lineHeight: 1.04, letterSpacing: '-2.5px',
                      background: 'linear-gradient(135deg, #ffffff 15%, #ef4444 100%)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                    }}>
                      Understand any website.
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: { xs: '15px', sm: '17px' }, maxWidth: 640, mx: 'auto', mt: 2, lineHeight: 1.7 }}>
                      Give Helix AI a website URL and ask a question. Get a focused, grounded answer from the information that matters.
                    </Typography>
                  </Box>
                </motion.div>
              )}

              {!result && (
                <motion.div variants={scaleIn}>
                  <Paper elevation={0} sx={{
                    maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 }, borderRadius: 3.5,
                    background: 'linear-gradient(145deg, rgba(15,30,50,0.98), rgba(10,22,38,0.98))',
                    border: '1px solid #1e3a5f', boxShadow: '0 30px 80px rgba(0,0,0,0.35)'
                  }}>
                    {/* URL INPUT */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 1.6, borderRadius: 2.5, backgroundColor: '#0a1628', border: '1px solid #1e3a5f', '&:focus-within': { borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.15)' } }}>
                      <Box sx={{ color: '#ef4444', display: 'flex' }}><Globe size={18} strokeWidth={2.2} /></Box>
                      <TextField fullWidth variant="standard" placeholder="Paste a website URL..." value={url}
                        onChange={e => { setUrl(e.target.value); setUrlError(''); setError('') }} disabled={loading} error={!!urlError}
                        onKeyDown={e => { if (e.key === 'Enter' && url.trim() && !loading) analyzeURL() }} InputProps={{ disableUnderline: true }}
                        sx={{ '& .MuiInputBase-input': { color: '#e2e8f0', WebkitTextFillColor: '#e2e8f0', py: 1.55, fontSize: '15px' }, '& .MuiInputBase-input::placeholder': { color: '#64748b', WebkitTextFillColor: '#64748b', opacity: 1 }, '& .MuiInputBase-input.Mui-disabled': { color: '#cbd5e1', WebkitTextFillColor: '#cbd5e1', opacity: 1 } }} />
                    </Box>
                    {urlError && <Typography sx={{ color: '#f87171', fontSize: '12px', mt: 1, ml: 1 }}>{urlError}</Typography>}

                    {/* Modes */}
                    <Box sx={{ mt: 2.2, display: 'flex', gap: 0.85, flexWrap: 'wrap' }}>
                      {analysisModes.map(mode => {
                        const active = analysisMode === mode.id
                        return (
                          <Button
                            key={mode.id} size="small"
                            onClick={() => selectAnalysisMode(mode.id)}
                            disabled={loading}
                            sx={{
                              color: active ? '#fff' : '#94a3b8',
                              backgroundColor: active ? 'rgba(220,38,38,0.25)' : '#0a1628',
                              border: active ? '1px solid #dc2626' : '1px solid #1e3a5f',
                              borderRadius: 5, px: 1.35, py: 0.6, textTransform: 'none',
                              fontSize: '11.5px', fontWeight: active ? 700 : 500, minHeight: 32,
                              '&:hover': { backgroundColor: active ? 'rgba(220,38,38,0.35)' : '#13253f', color: '#fff', borderColor: '#dc2626' },
                              '&.Mui-disabled': { color: active ? '#fecaca' : '#64748b', backgroundColor: active ? 'rgba(220,38,38,0.18)' : '#0a1628', borderColor: active ? '#dc2626' : '#1e3a5f', opacity: 0.8 }
                            }}
                          >
                            <Box component="span" sx={{ mr: 0.6, fontSize: '12px' }}>{mode.icon}</Box>
                            {mode.label}
                          </Button>
                        )
                      })}
                    </Box>

                    {/* Instruction */}
                    <Box sx={{
                      mt: 2.2, borderRadius: 2.5, backgroundColor: '#0a1628', border: '1px solid #1e3a5f',
                      '&:focus-within': { borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.12)' }
                    }}>
                      <TextField
                        fullWidth multiline minRows={4}
                        placeholder={analysisMode === 'custom' ? 'What would you like to know about this website? You can write your own instruction.' : 'Edit this instruction if you want to customize the analysis...'}
                        value={instruction}
                        onChange={e => { setInstruction(e.target.value); setAnalysisMode('custom'); setError('') }}
                        disabled={loading} variant="standard"
                        InputProps={{ disableUnderline: true }}
                        sx={{
                          '& .MuiInputBase-input': { color: '#e2e8f0', WebkitTextFillColor: '#e2e8f0', fontSize: '15px', lineHeight: 1.7, p: 1.6 },
                          '& .MuiInputBase-input::placeholder': { color: '#64748b', WebkitTextFillColor: '#64748b', opacity: 1 },
                          '& .MuiInputBase-input.Mui-disabled': { color: '#cbd5e1', WebkitTextFillColor: '#cbd5e1', opacity: 1 }
                        }}
                      />
                    </Box>

                    <Typography sx={{ color: '#64748b', fontSize: '10.5px', lineHeight: 1.6, mt: 0.9, px: 1 }}>
                      Choose a mode for a quick starting point, or write your own instruction. Your instruction is sent to Helix AI as the analysis request.
                    </Typography>

                    {/* Actions */}
                    <Box sx={{
                      display: 'flex', alignItems: { xs: 'stretch', sm: 'center' },
                      justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mt: 2.2
                    }}>
                      <Box sx={{ display: 'flex', gap: 0.85, flexWrap: 'wrap' }}>
                        {quickPrompts.map(prompt => (
                          <Button
                            key={prompt} size="small"
                            onClick={() => useQuickPrompt(prompt)}
                            disabled={loading}
                            sx={{
                              color: '#cbd5e1', backgroundColor: '#0f172a', border: '1px solid #1e3a5f',
                              borderRadius: 5, px: 1.4, textTransform: 'none', fontSize: '11.5px', fontWeight: 500,
                              '&:hover': { backgroundColor: '#1e293b', color: '#fff', borderColor: '#dc2626' },
                              '&.Mui-disabled': { color: '#94a3b8', backgroundColor: '#0f172a', borderColor: '#1e3a5f', opacity: 0.75 }
                            }}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </Box>

                      <Button
                        variant="contained"
                        onClick={analyzeURL}
                        disabled={loading || !url.trim()}
                        startIcon={loading ? null : <Globe size={17} strokeWidth={2.3} />}
                        endIcon={loading ? null : <ArrowRight size={16} strokeWidth={2.5} />}
                        sx={{
                          minWidth: 160, px: 2.6, py: 1.2, borderRadius: 2.2, textTransform: 'none',
                          fontWeight: 750, fontSize: '14.5px',
                          background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff',
                          boxShadow: '0 10px 28px rgba(249,115,22,0.40)',
                          '&:hover': { background: 'linear-gradient(135deg, #fb923c, #f97316)', boxShadow: '0 12px 32px rgba(249,115,22,0.50)' },
                          '&.Mui-disabled': { background: '#7c2d12', color: '#fdba74', boxShadow: 'none' }
                        }}
                      >
                        {loading ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <CircularProgress size={16} color="inherit" />
                            Analyzing...
                          </Box>
                        ) : 'Analyze'}
                      </Button>
                    </Box>

                    {error && <Alert severity="error" sx={{ mt: 2.2, borderRadius: 2 }}>{error}</Alert>}
                  </Paper>
                </motion.div>
              )}

              {loading && (
                <motion.div variants={fadeInUp}>
                  <Paper elevation={0} sx={{
                    maxWidth: 900, mx: 'auto', mt: 2, p: 2.8, borderRadius: 3,
                    backgroundColor: '#0f172a', border: '1px solid #1e3a5f'
                  }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '14.5px', mb: 2.6 }}>
                      Understanding your website
                    </Typography>
                    <LoadingStage number={1} label="Fetching website content" />
                    <LoadingStage number={2} label="Finding relevant information" />
                    <LoadingStage number={3} label="Generating your answer" />
                  </Paper>
                </motion.div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <Box sx={{ maxWidth: 900, mx: 'auto', mt: 2 }}>
                    {/* Result Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
                      <Box>
                        <Typography sx={{ color: '#ef4444', fontSize: '10px', fontWeight: 800, letterSpacing: '1.7px', mb: 0.8 }}>
                          HELIX AI ANALYSIS
                        </Typography>
                        <Typography sx={{
                          color: '#fff', fontSize: { xs: '25px', sm: '31px' }, fontWeight: 850,
                          letterSpacing: '-0.7px', wordBreak: 'break-word'
                        }}>
                          {result.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.7 }}>
                          <Box component="img" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(result.source_url || '')}&sz=32`} sx={{ width: 16, height: 16, borderRadius: 0.5 }} onError={e => { e.currentTarget.style.display = 'none' }} />
                          <Typography sx={{ color: '#64748b', fontSize: '12px' }}>{getDomain(result.source_url)}</Typography>
                        </Box>
                      </Box>

                      <Box sx={{
                        display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.8,
                        px: 1.4, py: 0.75, borderRadius: 5,
                        backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(52,211,153,0.40)',
                        color: '#34d399', fontSize: '11.5px', fontWeight: 700
                      }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#34d399', boxShadow: '0 0 8px #34d399' }} />
                        Analysis complete
                      </Box>
                    </Box>

                    {/* Answer Card */}
                    <Paper elevation={0} sx={{
                      borderRadius: 3.5, background: 'linear-gradient(145deg, #0f172a, #0c1425)',
                      border: '1px solid #1e3a5f', overflow: 'hidden', boxShadow: '0 25px 65px rgba(0,0,0,0.30)'
                    }}>
                      <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        px: { xs: 2, sm: 3 }, py: 1.5, backgroundColor: 'rgba(7,15,28,0.55)', borderBottom: '1px solid #1e3a5f'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                          <Box sx={{
                            width: 30, height: 30, borderRadius: 1.6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff'
                          }}>
                            <Sparkles size={15} strokeWidth={2.3} />
                          </Box>
                          <Typography sx={{ color: '#e2e8f0', fontSize: '12.5px', fontWeight: 700 }}>AI INSIGHT</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Tooltip title="Download PDF" arrow>
                            <IconButton
                              onClick={exportPdf}
                              disabled={loading || !result?.answer}
                              sx={{
                                width: 36, height: 36, color: '#2dd4bf',
                                backgroundColor: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.35)',
                                '&:hover': { color: '#fff', backgroundColor: '#14b8a6', borderColor: '#5eead4', boxShadow: '0 0 18px rgba(45,212,191,0.35)' }
                              }}
                            >
                              <Download size={16} strokeWidth={2.3} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Download DOCX" arrow>
                            <IconButton
                              onClick={exportDocx}
                              disabled={loading || !result?.answer}
                              sx={{
                                width: 36, height: 36, color: '#c4b5fd',
                                backgroundColor: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)',
                                '&:hover': { color: '#fff', backgroundColor: '#8b5cf6', borderColor: '#c4b5fd', boxShadow: '0 0 18px rgba(167,139,250,0.35)' }
                              }}
                            >
                              <FileText size={16} strokeWidth={2.3} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title={copied ? 'Copied!' : 'Copy answer'} arrow>
                            <Button
                              onClick={copyAnswer}
                              size="small"
                              startIcon={copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2.3} />}
                              sx={{
                                color: copied ? '#34d399' : '#94a3b8',
                                backgroundColor: copied ? 'rgba(52,211,153,0.15)' : '#0f172a',
                                border: copied ? '1px solid rgba(52,211,153,0.40)' : '1px solid #1e3a5f',
                                borderRadius: 1.6, px: 1.4, textTransform: 'none', fontSize: '11.5px', fontWeight: 700, minHeight: 36,
                                '&:hover': { backgroundColor: copied ? 'rgba(52,211,153,0.22)' : '#1e293b', color: copied ? '#6ee7b7' : '#e2e8f0' }
                              }}
                            >
                              {copied ? 'Copied' : 'Copy answer'}
                            </Button>
                          </Tooltip>
                        </Box>
                      </Box>

                      <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {result.answer}
                        </ReactMarkdown>
                      </Box>
                    </Paper>


                    {/* CONVERSATION */}
                    <Paper elevation={0} sx={{
                      mt: 2.5,
                      borderRadius: 3.2,
                      background: 'linear-gradient(145deg, #0f172a, #0b1422)',
                      border: '1px solid #1e3a5f',
                      overflow: 'hidden'
                    }}>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        px: { xs: 2, sm: 2.5 },
                        py: 1.5,
                        borderBottom: '1px solid #1e3a5f',
                        backgroundColor: 'rgba(7,15,28,0.55)'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                          <Box sx={{
                            width: 30,
                            height: 30,
                            borderRadius: 1.6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            color: '#fff'
                          }}>
                            <Sparkles size={15} strokeWidth={2.3} />
                          </Box>
                          <Box>
                            <Typography sx={{ color: '#e2e8f0', fontSize: '12.5px', fontWeight: 750 }}>
                              ASK FOLLOW-UP QUESTIONS
                            </Typography>
                            <Typography sx={{ color: '#64748b', fontSize: '9.5px', mt: 0.2 }}>
                              Continue exploring the same source
                            </Typography>
                          </Box>
                        </Box>

                        {conversationSessionId && (
                          <Box sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.7,
                            px: 1,
                            py: 0.45,
                            borderRadius: 5,
                            backgroundColor: 'rgba(52,211,153,0.10)',
                            border: '1px solid rgba(52,211,153,0.25)'
                          }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#34d399' }} />
                            <Typography sx={{ color: '#6ee7b7', fontSize: '9.5px', fontWeight: 700 }}>
                              Conversation ready
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {conversationMessages.length > 0 && (
                        <Box sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1.5,
                          p: { xs: 1.8, sm: 2.5 },
                          borderBottom: '1px solid #1e3a5f'
                        }}>
                          {conversationMessages.map((message, index) => {
                            const isUser = message.role === 'user'

                            return (
                              <Box
                                key={`${message.role}-${index}`}
                                sx={{
                                  display: 'flex',
                                  justifyContent: isUser ? 'flex-end' : 'flex-start'
                                }}
                              >
                                <Box sx={{
                                  maxWidth: { xs: '94%', sm: '84%' },
                                  px: 1.7,
                                  py: 1.35,
                                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                  background: isUser
                                    ? 'linear-gradient(135deg, rgba(220,38,38,0.24), rgba(153,27,27,0.18))'
                                    : 'linear-gradient(145deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))',
                                  border: isUser
                                    ? '1px solid rgba(239,68,68,0.30)'
                                    : '1px solid #334155'
                                }}>
                                  <Typography sx={{
                                    color: isUser ? '#fca5a5' : '#64748b',
                                    fontSize: '8.5px',
                                    fontWeight: 800,
                                    letterSpacing: '0.9px',
                                    mb: 0.7
                                  }}>
                                    {isUser ? 'YOU' : 'HELIX AI'}
                                  </Typography>

                                  {isUser ? (
                                    <Typography sx={{
                                      color: '#e2e8f0',
                                      fontSize: '13px',
                                      lineHeight: 1.65,
                                      whiteSpace: 'pre-wrap',
                                      overflowWrap: 'anywhere'
                                    }}>
                                      {message.content}
                                    </Typography>
                                  ) : (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                      {message.content}
                                    </ReactMarkdown>
                                  )}

                                  {!isUser && Number(message.chunks_used) > 0 && (
                                    <Typography sx={{ color: '#475569', fontSize: '9px', mt: 0.8 }}>
                                      {message.chunks_used} relevant chunks used
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            )
                          })}
                        </Box>
                      )}

                      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          gap: 1,
                          p: 0.8,
                          borderRadius: 2.4,
                          backgroundColor: '#0a1628',
                          border: '1px solid #1e3a5f',
                          '&:focus-within': {
                            borderColor: '#8b5cf6',
                            boxShadow: '0 0 0 3px rgba(139,92,246,0.12)'
                          }
                        }}>
                          <TextField
                            fullWidth
                            multiline
                            maxRows={5}
                            minRows={1}
                            placeholder="Ask a follow-up question about this source..."
                            value={conversationQuestion}
                            onChange={e => {
                              setConversationQuestion(e.target.value)
                              setConversationError('')
                            }}
                            onKeyDown={handleConversationKeyDown}
                            disabled={conversationLoading || !conversationSessionId}
                            variant="standard"
                            InputProps={{ disableUnderline: true }}
                            sx={{
                              '& .MuiInputBase-input': {
                                color: '#e2e8f0',
                                WebkitTextFillColor: '#e2e8f0',
                                fontSize: '14px',
                                lineHeight: 1.65,
                                px: 0.8,
                                py: 0.55
                              },
                              '& .MuiInputBase-input::placeholder': {
                                color: '#64748b',
                                WebkitTextFillColor: '#64748b',
                                opacity: 1
                              }
                            }}
                          />

                          <Button
                            onClick={sendConversationMessage}
                            disabled={conversationLoading || !conversationSessionId || !conversationQuestion.trim()}
                            sx={{
                              minWidth: 92,
                              height: 40,
                              borderRadius: 1.8,
                              textTransform: 'none',
                              fontSize: '12px',
                              fontWeight: 750,
                              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                              color: '#fff',
                              boxShadow: '0 8px 22px rgba(99,102,241,0.25)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                                boxShadow: '0 10px 26px rgba(99,102,241,0.35)'
                              },
                              '&.Mui-disabled': {
                                background: '#312e81',
                                color: '#a5b4fc',
                                opacity: 0.65
                              }
                            }}
                          >
                            {conversationLoading ? (
                              <CircularProgress size={15} sx={{ color: '#fff' }} />
                            ) : 'Ask'}
                          </Button>
                        </Box>

                        <Typography sx={{
                          color: '#475569',
                          fontSize: '9.5px',
                          mt: 0.8,
                          px: 0.5
                        }}>
                          Press Enter to ask · Shift + Enter for a new line
                        </Typography>

                        {conversationError && (
                          <Alert
                            severity="error"
                            sx={{
                              mt: 1.2,
                              borderRadius: 2,
                              fontSize: '12px'
                            }}
                          >
                            {conversationError}
                          </Alert>
                        )}
                      </Box>
                    </Paper>

                    {/* Source */}
                    <Box sx={{ mt: 2.5, px: 1, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                      <Box>
                        <Typography sx={{ color: '#64748b', fontSize: '9px', letterSpacing: '1.2px', fontWeight: 800 }}>SOURCE</Typography>
                        <Typography component="a" href={result.source_url} target="_blank" rel="noopener noreferrer" sx={{ color: '#ef4444', fontSize: '12.5px', textDecoration: 'none', wordBreak: 'break-all', '&:hover': { color: '#f87171', textDecoration: 'underline' } }}>{result.source_url}</Typography>
                      </Box>
                      <Button component="a" href={result.source_url} target="_blank" rel="noopener noreferrer" size="small" endIcon={<ExternalLink size={13} strokeWidth={2.3} />} sx={{ color: '#94a3b8', textTransform: 'none', fontSize: '11.5px', fontWeight: 600, '&:hover': { color: '#ef4444', backgroundColor: 'rgba(220,38,38,0.08)' } }}>Open source</Button>
                    </Box>

                    {/* Metadata */}
                    {(result.model || result.extraction_method || result.chunks_used) && (
                      <Paper elevation={0} sx={{
                        mt: 2.5, p: 2, borderRadius: 2.5,
                        backgroundColor: 'rgba(15,23,42,0.7)', border: '1px solid #1e3a5f'
                      }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
                          {result.model && (
                            <Box>
                              <Typography sx={{ color: '#64748b', fontSize: '8px', fontWeight: 800, letterSpacing: '1px' }}>AI MODEL</Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '11px', mt: 0.4 }}>{result.model}</Typography>
                            </Box>
                          )}
                          {result.extraction_method && (
                            <Box>
                              <Typography sx={{ color: '#64748b', fontSize: '8px', fontWeight: 800, letterSpacing: '1px' }}>EXTRACTION</Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '11px', mt: 0.4 }}>{result.extraction_method}</Typography>
                            </Box>
                          )}
                          {result.chunks_used && (
                            <Box>
                              <Typography sx={{ color: '#64748b', fontSize: '8px', fontWeight: 800, letterSpacing: '1px' }}>CONTEXT USED</Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: '11px', mt: 0.4 }}>{result.chunks_used} relevant chunks</Typography>
                            </Box>
                          )}
                        </Box>
                      </Paper>
                    )}

                    {/* Bottom Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap', mt: 4, mb: 4 }}>
                      <Button
                        onClick={resetAnalysis}
                        variant="outlined"
                        startIcon={<RefreshCw size={15} strokeWidth={2.3} />}
                        sx={{
                          color: '#94a3b8', borderColor: '#334155', borderRadius: 2.2, px: 3, py: 1.1,
                          textTransform: 'none', fontWeight: 650, fontSize: '13px',
                          '&:hover': { borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.08)', color: '#e2e8f0' }
                        }}
                      >
                        Analyze another website
                      </Button>
                      <Button
                        onClick={openHistory}
                        variant="outlined"
                        startIcon={<History size={15} strokeWidth={2.3} />}
                        sx={{
                          color: '#94a3b8', borderColor: '#334155', borderRadius: 2.2, px: 3, py: 1.1,
                          textTransform: 'none', fontWeight: 650, fontSize: '13px',
                          '&:hover': { borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.08)', color: '#e2e8f0' }
                        }}
                      >
                        View history
                      </Button>
                    </Box>
                  </Box>
                </motion.div>
              )}
            </>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <Box sx={{ maxWidth: 900, mx: 'auto', textAlign: 'center', mt: result ? 2 : 8, pb: 3 }}>
        <Typography sx={{ color: '#475569', fontSize: '10.5px', letterSpacing: '0.3px' }}>
          Helix AI · Intelligent website analysis
        </Typography>
      </Box>
    </Box>
  )
}
