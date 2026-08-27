import React, { useState, useEffect, useRef } from 'react'
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip, Tooltip,
  CircularProgress, Alert, LinearProgress, Dialog, DialogTitle,
  DialogContent, Snackbar
} from '@mui/material'
import { CloudUpload, Delete, Visibility, PictureAsPdf, Image, Close, InsertDriveFile, Description } from '@mui/icons-material'
import axios from 'axios'

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_EXT  = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx'
const ACCEPT_LABEL  = 'PDF, Word (DOC/DOCX), PNG, JPG, WEBP'

export default function UploadFiles() {
  const [files, setFiles]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError]         = useState('')
  const [toast, setToast]         = useState('')
  const [preview, setPreview]     = useState(null)
  const [dragging, setDragging]   = useState(false)
  const inputRef = useRef()

  const load = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/files')
      setFiles(res.data)
    } catch { setError('Could not load files.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleFiles = async (fileList) => {
    const valid = Array.from(fileList).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ACCEPTED_TYPES.includes(f.type) || ['pdf','doc','docx','png','jpg','jpeg','webp'].includes(ext)
    })
    if (!valid.length) {
      setToast(`Only ${ACCEPT_LABEL} files are supported.`)
      return
    }

    setUploading(true)
    setUploadPct(0)
    try {
      for (let i = 0; i < valid.length; i++) {
        const fd = new FormData()
        fd.append('file', valid[i])
        await axios.post('/api/files/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: e => setUploadPct(Math.round((e.loaded / e.total) * 100))
        })
        setUploadPct(Math.round(((i + 1) / valid.length) * 100))
      }
      setToast(`${valid.length} file${valid.length > 1 ? 's' : ''} uploaded successfully`)
      load()
    } catch (e) {
      setToast(e?.response?.data?.detail || 'Upload failed. Please try again.')
    } finally { setUploading(false); setUploadPct(0) }
  }

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/files/${id}`)
      setToast('File deleted')
      load()
    } catch { setToast('Error deleting file.') }
  }

  const handlePreview = async (file) => {
    if (['doc', 'docx'].includes(file.file_type)) {
      // For Word files show extracted text instead of raw file
      try {
        const res = await axios.get(`/api/files/${file.id}/text`)
        setPreview({ type: 'text', text: res.data.text, name: file.original_name })
      } catch { setToast('Could not load file text.') }
      return
    }
    try {
      const res = await axios.get(`/api/files/${file.id}/content`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setPreview({ url, type: file.file_type, name: file.original_name })
    } catch { setToast('Could not open file.') }
  }

  const fileIcon = (type) => {
    if (type === 'pdf')  return <PictureAsPdf sx={{ color: '#ef4444' }} />
    if (['png','jpg','jpeg','webp'].includes(type)) return <Image sx={{ color: '#3b82f6' }} />
    if (['doc','docx'].includes(type)) return <Description sx={{ color: '#3b82f6' }} />
    return <InsertDriveFile sx={{ color: 'text.secondary' }} />
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const pdfCount  = files.filter(f => f.file_type === 'pdf').length
  const imgCount  = files.filter(f => ['png','jpg','jpeg','webp'].includes(f.file_type)).length
  const wordCount = files.filter(f => ['doc','docx'].includes(f.file_type)).length

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">Upload Files</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Upload PDFs, Word documents, or images. Alex will automatically read these as context
          during interviews and ask specific questions based on their content.
        </Typography>
      </Box>

      {/* Drop Zone */}
      <Paper elevation={0}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        sx={{
          border: '2px dashed', borderColor: dragging ? 'primary.main' : 'divider',
          borderRadius: 3, p: 5, textAlign: 'center', cursor: 'pointer', mb: 3,
          bgcolor: dragging ? 'rgba(220,38,38,0.05)' : 'background.paper',
          transition: 'all 0.2s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(220,38,38,0.03)' }
        }}>
        <input ref={inputRef} type="file" multiple hidden
          accept={ACCEPTED_EXT}
          onChange={e => handleFiles(e.target.files)} />
        <CloudUpload sx={{ fontSize: 48, color: dragging ? 'primary.main' : 'text.secondary', mb: 1 }} />
        <Typography fontWeight={600} sx={{ mb: 0.5 }}>
          {dragging ? 'Drop files here' : 'Drag & drop files here'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          or click to browse — <strong>{ACCEPT_LABEL}</strong> supported
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
          {['PDF', 'DOCX', 'DOC', 'PNG', 'JPG', 'WEBP'].map(ext => (
            <Chip key={ext} label={ext} size="small"
              sx={{ fontSize: 11, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }} />
          ))}
        </Box>
        <Button variant="contained" size="small" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>
          Browse Files
        </Button>
      </Paper>

      {/* Upload progress */}
      {uploading && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Uploading...</Typography>
            <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>{uploadPct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={uploadPct} color="primary" sx={{ borderRadius: 1 }} />
        </Box>
      )}

      {/* AI Context notice */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 2 }}>
        <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 600, mb: 0.5 }}>🤖 AI Context</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          All uploaded files are automatically read by Alex during Text and Voice interviews.
          Alex will ask specific questions referencing content from your documents —
          not generic questions.
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip label={`${files.length} total`}   size="small" sx={{ bgcolor: 'rgba(220,38,38,0.12)', color: 'primary.main', fontWeight: 600 }} />
        <Chip label={`${pdfCount} PDFs`}         size="small" sx={{ bgcolor: 'rgba(239,68,68,0.1)',  color: '#ef4444', fontWeight: 600 }} />
        <Chip label={`${wordCount} Word`}         size="small" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600 }} />
        <Chip label={`${imgCount} Images`}        size="small" sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }} />
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>File Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Pages</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell>AI Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={24} color="primary" /></TableCell></TableRow>
            ) : files.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                No files uploaded yet. Use the drop zone above.
              </TableCell></TableRow>
            ) : files.map((file, idx) => (
              <TableRow key={file.id} hover>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{idx + 1}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {fileIcon(file.file_type)}
                    <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{file.original_name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={file.file_type?.toUpperCase()} size="small" sx={{ fontSize: 10, fontWeight: 700 }} />
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{formatBytes(file.file_size)}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                  {file.page_count ? `${file.page_count} pages` : '—'}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                  {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={file.text_extracted ? '✓ Ready for AI' : '✗ Not extracted'}
                    size="small"
                    sx={{ fontSize: 10, fontWeight: 600,
                      bgcolor: file.text_extracted ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color:   file.text_extracted ? '#22c55e' : '#ef4444' }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Preview / View Text">
                    <IconButton size="small" onClick={() => handlePreview(file)}
                      sx={{ color: 'text.secondary', '&:hover': { color: '#3b82f6' } }}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => handleDelete(file.id)}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {preview?.name}
          <IconButton onClick={() => setPreview(null)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: preview?.type === 'text' ? 3 : 0 }}>
          {preview?.type === 'pdf'
            ? <iframe src={preview.url} width="100%" height="600px" style={{ border: 'none' }} title="PDF Preview" />
            : preview?.type === 'text'
            ? <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1, maxHeight: 560, overflow: 'auto' }}>
                <Typography sx={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {preview.text || 'No text extracted from this file.'}
                </Typography>
              </Box>
            : <img src={preview?.url} alt="preview" style={{ width: '100%', maxHeight: 600, objectFit: 'contain' }} />
          }
        </DialogContent>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')}
        message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} />
    </Box>
  )
}
