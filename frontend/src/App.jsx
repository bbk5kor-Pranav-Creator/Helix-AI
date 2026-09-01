import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Help from './pages/Help'
import TextAgent from './pages/TextAgent'
import VoiceAgent from './pages/VoiceAgent'
import UploadFiles from './pages/UploadFiles'
import UploadURL from './pages/UploadURL'
import UploadPDF from './pages/UploadPDF'
import KnowledgeHub from './pages/KnowledgeHub'
import ResourcePage from './pages/ResourcePage'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#dc2626' },
    secondary: { main: '#3b82f6' },
    background: { default: '#0f1e30', paper: '#1a2e4a' },
    text: { primary: '#dde8f0', secondary: '#7a9bb5' },
    divider: '#2a4060',
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
        containedPrimary: { background: '#dc2626', '&:hover': { background: '#b91c1c' } },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTableCell: {
      styleOverrides: {
        head: { background: '#0f1e30', fontWeight: 700, color: '#7a9bb5', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
})

export const RESOURCE_PAGES = [
  { path: 'docupedia',     label: 'Docupedia' },
  { path: 'sharepoint',    label: 'SharePoint' },
  { path: 'teams',         label: 'Teams' },
  { path: 'outlook',       label: 'Outlook' },
  { path: 'jira',          label: 'Jira' },
  { path: 'solman',        label: 'SolMan' },
  { path: 'signavio',      label: 'Signavio' },
  { path: 'track-release', label: 'Track & Release' },
]

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="home"          element={<Home />} />
            <Route path="about"         element={<About />} />
            <Route path="help"          element={<Help />} />
            <Route path="text-agent"    element={<TextAgent />} />
            <Route path="voice-agent"   element={<VoiceAgent />} />
            <Route path="upload"        element={<UploadFiles />} />
            <Route path="/upload-url" element={<UploadURL />} />
            <Route path="/upload-pdf" element={<UploadPDF />} />
            <Route path="knowledge-hub" element={<KnowledgeHub />} />
            {RESOURCE_PAGES.map(p => (
              <Route key={p.path} path={p.path}
                element={<ResourcePage resourceKey={p.path} label={p.label} />} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
