import React, { useState } from 'react'
import axios from 'axios'

import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  Chip,
  CircularProgress,
  Snackbar
} from '@mui/material'

import ContentCopyIcon from '@mui/icons-material/ContentCopy'

export default function UploadURL() {

  const [url, setUrl] = useState('')
  const [instruction, setInstruction] = useState('')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [urlError, setUrlError] = useState('')


  const normalizeURL = (value) => {
  const text = value.trim()

  // Supports:
  // https://example.com
  // [https://example.com](https://example.com)
  const markdownMatch = text.match(
    /^\[.*?\]\((https?:\/\/[^)]+)\)$/
  )

  if (markdownMatch) {
    return markdownMatch[1]
  }

  return text
}

const analyzeURL = async () => {

  setUrlError('')
  setSummary('')

  const normalizedURL = normalizeURL(url)

  // Validate normalized URL
  try {
    new URL(normalizedURL)
  } catch {
    setUrlError('Please enter a valid website URL.')
    return
  }

  try {

    setLoading(true)

    const res = await axios.post('/api/analyze-url', {
      url: normalizedURL,
      instruction: instruction
    })

    setSummary(res.data.message)

    } catch (err) {

      if (err.response?.data?.message) {
        setSummary(err.response.data.message)
      } else if (err.message) {
        setSummary(err.message)
      } else {
        setSummary('Something went wrong while analyzing the website.')
      }

    } finally {
      setLoading(false)
    }
  }

  const copySummary = async () => {

    if (!summary) return

    try {

      await navigator.clipboard.writeText(summary)
      setCopied(true)

    } catch (err) {
      console.error(err)
    }
  }

  return (

    <Box>

      {/* Header */}
      <Box sx={{ mb: 3 }}>

        <Typography variant="h5">
          Upload Website URL
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.5
          }}
        >
          Paste a website URL and optionally tell Alex exactly what you want to analyze.
        </Typography>

      </Box>

      {/* URL + Instruction Input */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >

        {/* Website URL */}
        <TextField
          fullWidth
          label="Website URL"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={!!urlError}
          helperText={urlError}
          onKeyDown={(e) => {

            if (
              e.key === 'Enter' &&
              url.trim() &&
              !loading
            ) {
              analyzeURL()
            }

          }}
          sx={{ mb: 3 }}
        />

        {/* User Instruction */}
        <TextField
          fullWidth
          multiline
          minRows={4}
          label="What would you like me to analyze?"
          placeholder="Example: Summarize the main points of this website and provide actionable insights."
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          helperText="Optional. Leave this empty for a general analysis of the website."
          sx={{ mb: 3 }}
        />

        {/* Analyze Button */}
        <Button
          variant="contained"
          size="large"
          onClick={analyzeURL}
          disabled={loading || !url.trim()}
          startIcon={
            loading ? (
              <CircularProgress
                size={18}
                color="inherit"
              />
            ) : null
          }
        >
          {loading ? 'Analyzing Website...' : 'Analyze'}
        </Button>

      </Paper>

      {/* AI Context */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mt: 3,
          bgcolor: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 2
        }}
      >

        <Typography
          variant="body2"
          sx={{
            color: '#3b82f6',
            fontWeight: 600,
            mb: 0.5
          }}
        >
          🤖 AI Context
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary'
          }}
        >
          Alex will fetch the webpage, analyze its content, and follow your instruction when generating the AI response. If no instruction is provided, a general analysis will be generated.
        </Typography>

      </Paper>

      {/* AI Summary */}
      <Paper
        elevation={0}
        sx={{
          mt: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >

        <Box
          sx={{
            bgcolor: 'rgba(220,38,38,0.08)',
            px: 3,
            py: 2
          }}
        >

          <Typography
            variant="h6"
            fontWeight={700}
          >
            🤖 AI Analysis
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary'
            }}
          >
            Generated using Groq Llama 3.3
          </Typography>

        </Box>

        <Divider />

        <Box sx={{ p: 3 }}>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2
            }}
          >

            <Chip
              label="Website Analysis"
              color="primary"
              size="small"
            />

            {summary && (

              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={copySummary}
              >
                Copy Summary
              </Button>

            )}

          </Box>

          <Typography
            sx={{
              whiteSpace: 'pre-wrap',
              textAlign: 'justify',
              lineHeight: 1.9,
              fontSize: 15,
              color: 'text.primary'
            }}
          >
            {summary ||
              'Analysis will appear here after analyzing the website.'}
          </Typography>

        </Box>

      </Paper>

      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        message="Summary copied to clipboard!"
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
      />

    </Box>
  )
}