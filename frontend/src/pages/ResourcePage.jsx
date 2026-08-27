import React, { useState, useEffect } from 'react'
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Chip, Tooltip,
  CircularProgress, Alert, InputAdornment, Snackbar, Stack
} from '@mui/material'
import { Add, Edit, Delete, OpenInNew, Search, Link, Close, LocalOffer } from '@mui/icons-material'
import axios from 'axios'

const EMPTY_FORM = { title: '', link: '', description: '', tags: '' }

const TAG_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#dc2626']
const tagColor = (tag) => TAG_COLORS[Math.abs(tag.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % TAG_COLORS.length]

export default function ResourcePage({ resourceKey, label }) {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [open, setOpen]         = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [toast, setToast]       = useState('')
  const [deleting, setDeleting] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`/api/resources/${resourceKey}`)
      setRows(res.data)
    } catch { setError('Could not load data. Make sure the backend is running.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [resourceKey])

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setOpen(true) }
  const openEdit   = (row) => { setForm({ title: row.title, link: row.link || '', description: row.description || '', tags: row.tags || '' }); setEditId(row.id); setOpen(true) }
  const handleClose = () => { setOpen(false); setForm(EMPTY_FORM); setEditId(null) }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await axios.put(`/api/resources/${resourceKey}/${editId}`, form)
        setToast('Entry updated successfully')
      } else {
        await axios.post(`/api/resources/${resourceKey}`, form)
        setToast('Entry created successfully')
      }
      handleClose(); load()
    } catch { setToast('Error saving. Please try again.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try { await axios.delete(`/api/resources/${resourceKey}/${id}`); setToast('Entry deleted'); load() }
    catch { setToast('Error deleting.') }
    finally { setDeleting(null) }
  }

  // All unique tags across all rows
  const allTags = [...new Set(rows.flatMap(r => (r.tags || '').split(',').map(t => t.trim()).filter(Boolean)))]

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.link?.toLowerCase().includes(q) || (r.tags || '').toLowerCase().includes(q)
    const matchTag = !tagFilter || (r.tags || '').split(',').map(t => t.trim()).includes(tagFilter)
    return matchSearch && matchTag
  })

  const parseTags = (tagStr) => (tagStr || '').split(',').map(t => t.trim()).filter(Boolean)

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5">{label}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Manage {label} resources — links, tools, and references available to the AI agents.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ flexShrink: 0 }}>
          Add Resource
        </Button>
      </Box>

      {/* Search + Tag filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small" placeholder={`Search ${label}...`}
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ width: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }}
        />
        {allTags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mr: 0.5 }}>Tags:</Typography>
            <Chip label="All" size="small" onClick={() => setTagFilter('')}
              sx={{ fontSize: 11, bgcolor: !tagFilter ? 'primary.main' : 'rgba(255,255,255,0.06)', color: !tagFilter ? 'white' : 'text.secondary' }} />
            {allTags.map(tag => (
              <Chip key={tag} label={tag} size="small" onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                sx={{ fontSize: 11, bgcolor: tagFilter === tag ? `${tagColor(tag)}22` : 'rgba(255,255,255,0.04)', color: tagColor(tag), border: `1px solid ${tagColor(tag)}44` }} />
            ))}
          </Box>
        )}
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Chip label={`${rows.length} total`} size="small" sx={{ bgcolor: 'rgba(220,38,38,0.12)', color: 'primary.main', fontWeight: 600 }} />
        {search || tagFilter ? <Chip label={`${filtered.length} shown`} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontWeight: 600 }} /> : null}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={36}>#</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Link</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Added</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={24} color="primary" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                {search || tagFilter ? 'No results match your filters.' : `No ${label} resources yet. Click "Add Resource" to create one.`}
              </TableCell></TableRow>
            ) : filtered.map((row, idx) => (
              <TableRow key={row.id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{idx + 1}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary', minWidth: 140 }}>{row.title}</TableCell>
                <TableCell sx={{ minWidth: 160 }}>
                  {row.link ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography component="a" href={row.link} target="_blank" rel="noopener noreferrer"
                        sx={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {row.link}
                      </Typography>
                      <IconButton size="small" href={row.link} target="_blank" sx={{ color: 'text.secondary', p: 0.2 }}><OpenInNew sx={{ fontSize: 12 }} /></IconButton>
                    </Box>
                  ) : <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>—</Typography>}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 13, maxWidth: 260 }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {row.description || '—'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                    {parseTags(row.tags).map(tag => (
                      <Chip key={tag} label={tag} size="small"
                        onClick={() => setTagFilter(tag)}
                        sx={{ fontSize: 10, height: 20, bgcolor: `${tagColor(tag)}18`, color: tagColor(tag), border: `1px solid ${tagColor(tag)}33`, cursor: 'pointer' }} />
                    ))}
                    {parseTags(row.tags).length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>—</Typography>}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(row)} sx={{ color: 'text.secondary', '&:hover': { color: '#3b82f6' } }}><Edit fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => handleDelete(row.id)} disabled={deleting === row.id} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                      {deleting === row.id ? <CircularProgress size={14} /> : <Delete fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography fontWeight={700}>{editId ? `Edit ${label} Entry` : `Add ${label} Resource`}</Typography>
          <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title *" fullWidth size="small" autoFocus
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={`e.g. ${label} Main Site`} />
          <TextField label="Link / URL" fullWidth size="small"
            value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
            placeholder="https://..."
            InputProps={{ startAdornment: <InputAdornment position="start"><Link fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
          <TextField label="Description" fullWidth size="small" multiline rows={3}
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What is this resource? How should the AI use it?" />
          <TextField label="Tags" fullWidth size="small"
            value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="e.g. documentation, hr, finance  (comma separated)"
            InputProps={{ startAdornment: <InputAdornment position="start"><LocalOffer fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }}
            helperText="Separate multiple tags with commas" />
          {/* Tag preview */}
          {form.tags && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {parseTags(form.tags).map(tag => (
                <Chip key={tag} label={tag} size="small"
                  sx={{ fontSize: 11, bgcolor: `${tagColor(tag)}18`, color: tagColor(tag), border: `1px solid ${tagColor(tag)}44` }} />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            {editId ? 'Save Changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')}
        message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} />
    </Box>
  )
}
