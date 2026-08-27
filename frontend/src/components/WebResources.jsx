import { useEffect, useState } from 'react'
import axios from 'axios'

import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Snackbar
} from '@mui/material'

import SearchIcon from '@mui/icons-material/Search'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DeleteIcon from '@mui/icons-material/Delete'

export default function WebResources() {

  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSummary, setSelectedSummary] = useState('')

  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [resourceToDelete, setResourceToDelete] = useState(null)

  useEffect(() => {

    const loadResources = async () => {

      try {

        const res = await axios.get('/api/web-resources')
        setResources(res.data)

      } catch (err) {

        console.error(err)

      } finally {

        setLoading(false)

      }

    }

    loadResources()

  }, [])

  const filteredResources = resources.filter((resource) => {

    const text = (
      (resource.title || '') +
      (resource.description || '') +
      (resource.tags || '')
    ).toLowerCase()

    return text.includes(search.toLowerCase())

  })

  const formatDate = (date) => {

    if (!date) return ''

    const localDate = new Date(date.replace(' ', 'T'))

    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true

    })

  }

  const getDomain = (url) => {

    try {

      return new URL(url).hostname

    } catch {

      return url

    }

  }

  const copySummary = async (summary) => {

    try {

      await navigator.clipboard.writeText(summary)

      setCopied(true)

    } catch (err) {

      console.error(err)

    }

  }

  const openDeleteDialog = (resource) => {

    setResourceToDelete(resource)

    setDeleteDialogOpen(true)

  }

  const deleteResource = async () => {

    if (!resourceToDelete) return

    try {

        await axios.delete(
            `/api/web-resources/${resourceToDelete.id}`
        )

        setResources(prev =>
            prev.filter(r => r.id !== resourceToDelete.id)
        )

        setDeleteDialogOpen(false)

        setResourceToDelete(null)

    } catch (err) {

        console.error(err)

        alert("Failed to delete website.")

    }

}
  return (

    <Box sx={{ mt: 2 }}>

      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >

        <Typography
          variant="h5"
          fontWeight={700}
          gutterBottom
        >
          🌐 Web Resources
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 3
          }}
        >
          Store and manage AI-generated summaries of analyzed websites.
        </Typography>

        <TextField
          fullWidth
          size="small"
          placeholder="Search websites..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />

        {loading ? (

          <Box
            sx={{
              py: 8,
              textAlign: 'center'
            }}
          >
            <CircularProgress />
          </Box>

        ) : (

          <>

            <Typography
              sx={{
                mb: 2,
                color: 'text.secondary'
              }}
            >
              Total Websites Stored: <strong>{filteredResources.length}</strong>
            </Typography>

            {filteredResources.map((resource) => (

              <Paper
                key={resource.id}
                elevation={0}
                sx={{
                  p: 3,
                  mb: 2,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >

                <Typography
                  variant="h6"
                  sx={{
                    color: 'primary.main',
                    fontWeight: 700
                  }}
                >
                  🌐 {getDomain(resource.title)}
                </Typography>

                <Typography
                  component="a"
                  href={resource.link}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    color: 'text.secondary',
                    textDecoration: 'none',
                    wordBreak: 'break-all',
                    '&:hover': {
                      color: 'primary.main'
                    }
                  }}
                >
                  {resource.link}
                </Typography>

                <Typography
                  sx={{
                    mt: 1,
                    fontSize: 13,
                    color: 'text.secondary'
                  }}
                >
                  📅 {formatDate(resource.created_at)}
                </Typography>

                <Box
                  sx={{
                    mt: 2,
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap'
                  }}
                >
                  {(resource.tags || '').split(',').map(tag => (

                    <Chip
                      key={tag}
                      label={tag.trim()}
                      color="primary"
                      size="small"
                    />

                  ))}
                </Box>

                <Typography
                  sx={{
                    mt: 2,
                    color: 'text.secondary'
                  }}
                >
                  AI-generated summary available.
                </Typography>

                <Box
                  sx={{
                    mt: 3,
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap'
                  }}
                >

                  <Button
                    variant="contained"
                    onClick={() => {

                      setSelectedSummary(resource.description)
                      setDialogOpen(true)

                    }}
                  >
                    View Summary
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => copySummary(resource.description)}
                  >
                    Copy
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<OpenInNewIcon />}
                    href={resource.link}
                    target="_blank"
                  >
                    Visit
                  </Button>

                  <Button
                     variant="outlined"
                     color="error"
                     startIcon={<DeleteIcon />}
                    onClick={() => openDeleteDialog(resource)}
                  >
                    Delete
                  </Button>

                </Box>

              </Paper>

            ))}

          </>

        )}

      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >

        <DialogTitle>

          🤖 AI Website Summary

        </DialogTitle>

        <DialogContent dividers>

          <Typography
            sx={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.9
            }}
          >
            {selectedSummary}
          </Typography>

        </DialogContent>

        <DialogActions>

          <Button
            onClick={() => setDialogOpen(false)}
          >
            Close
          </Button>

        </DialogActions>

      </Dialog>

      <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
      >

        <DialogTitle>
           Delete Website
        </DialogTitle>

        <DialogContent>

            <Typography>

              Are you sure you want to permanently delete this website from Web Resources?

            </Typography>

        </DialogContent>

        <DialogActions>

           <Button
              onClick={() => setDeleteDialogOpen(false)}
           >
              Cancel
           </Button>

           <Button
               variant="contained"
               color="error"
               onClick={deleteResource}
           >
               Delete
           </Button>

        </DialogActions>

    </Dialog>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Summary copied to clipboard!"
      />

    </Box>

  )

}