import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Tooltip, Divider, Avatar, Badge, Menu, MenuItem, Button
} from '@mui/material'
import {
  Chat, Mic, CloudUpload, Share, Groups, Email,
  BugReport, Settings, AccountTree, RocketLaunch,
  Notifications, Help, Info, Home, MenuOpen, ChevronLeft,
  MenuBook, Hub, Dashboard, Language 
} from '@mui/icons-material'

const SIDEBAR_WIDTH     = 235
const SIDEBAR_COLLAPSED = 64

const NAV_ITEMS = [
  { label: 'Home',            path: '/',              icon: <Dashboard /> },
  { label: 'Text Agent',      path: '/text-agent',    icon: <Chat /> },
  { label: 'Voice Agent',     path: '/voice-agent',   icon: <Mic /> },
  { label: 'Upload Files',    path: '/upload',        icon: <CloudUpload /> },
  { label: 'Upload URL',      path: '/upload-url',    icon: <Language /> },
  { label: 'Knowledge Hub',   path: '/knowledge-hub', icon: <Hub /> },
  { type: 'divider', label: 'Resources' },
  { label: 'Docupedia',       path: '/docupedia',     icon: <MenuBook /> },
  { label: 'SharePoint',      path: '/sharepoint',    icon: <Share /> },
  { label: 'Teams',           path: '/teams',         icon: <Groups /> },
  { label: 'Outlook',         path: '/outlook',       icon: <Email /> },
  { label: 'Jira',            path: '/jira',          icon: <BugReport /> },
  { label: 'SolMan',          path: '/solman',        icon: <Settings /> },
  { label: 'Signavio',        path: '/signavio',      icon: <AccountTree /> },
  { label: 'Track & Release', path: '/track-release', icon: <RocketLaunch /> },
]

const PAGE_LABELS = {
  '/':              'Home',
  '/home':          'Home',
  '/about':         'About',
  '/help':          'Help & Documentation',
  '/text-agent':    'Text Agent',
  '/voice-agent':   'Voice Agent',
  '/upload':        'Upload Files',
  '/upload-url': 'Upload URL',
  '/knowledge-hub': 'Knowledge Hub',
  '/docupedia':     'Docupedia',
  '/sharepoint':    'SharePoint',
  '/teams':         'Teams',
  '/outlook':       'Outlook',
  '/jira':          'Jira',
  '/solman':        'SolMan',
  '/signavio':      'Signavio',
  '/track-release': 'Track & Release',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [anchorEl, setAnchorEl]   = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const sidebarW = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH
  const currentLabel = PAGE_LABELS[location.pathname] || 'Dashboard'

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>

      {/* ── SIDEBAR ── */}
      <Drawer variant="permanent" sx={{
        width: sidebarW, flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: sidebarW, boxSizing: 'border-box',
          bgcolor: 'background.paper',
          borderRight: '1px solid', borderColor: 'divider',
          transition: 'width 0.2s ease', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column',
        },
      }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.8, borderBottom: '1px solid', borderColor: 'divider', minHeight: 56, flexShrink: 0 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
          {!collapsed && (
            <Typography sx={{ ml: 1.5, fontWeight: 800, fontSize: 12, letterSpacing: 2.5, color: 'primary.main' }}>
              HELIX AI            </Typography>
          )}
          <IconButton onClick={() => setCollapsed(!collapsed)} sx={{ ml: 'auto', color: 'text.secondary', p: 0.5 }}>
            {collapsed ? <MenuOpen fontSize="small" /> : <ChevronLeft fontSize="small" />}
          </IconButton>
        </Box>

        {/* Nav */}
        <List dense sx={{ pt: 1, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_ITEMS.map((item, idx) => {
            if (item.type === 'divider') return (
              <Box key={idx}>
                <Divider sx={{ my: 0.5, borderColor: 'divider' }} />
                {!collapsed && (
                  <Typography sx={{ px: 2.5, py: 0.5, fontSize: 10, fontWeight: 700, color: 'text.secondary', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {item.label}
                  </Typography>
                )}
              </Box>
            )
            const active = location.pathname === item.path || (item.path === '/' && location.pathname === '/')
            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.3 }}>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <ListItemButton
                    component={NavLink} to={item.path}
                    end={item.path === '/'}
                    sx={{
                      mx: 1, borderRadius: 2, px: collapsed ? 1 : 1.5, py: 0.9,
                      bgcolor: active ? 'rgba(220,38,38,0.12)' : 'transparent',
                      borderLeft: active ? '3px solid #dc2626' : '3px solid transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                      transition: 'all 0.15s',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      minHeight: 40,
                    }}
                  >
                    <ListItemIcon sx={{ color: active ? 'primary.main' : 'text.secondary', minWidth: collapsed ? 0 : 34, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'white' : 'text.secondary', noWrap: true }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            )
          })}
        </List>

        {/* Bottom user */}
        {!collapsed && (
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12 }}>B</Avatar>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>Helix AI</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Knowledge Agent</Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* ── MAIN ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Navbar */}
        <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', zIndex: 10 }}>
          <Toolbar sx={{ gap: 0.5, minHeight: '56px !important' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', mr: 2 }}>
              {currentLabel}
            </Typography>

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Navbar text buttons */}
            <Button
              startIcon={<Home sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/')}
              size="small"
              sx={{ color: location.pathname === '/' ? 'white' : 'text.secondary', fontWeight: location.pathname === '/' ? 700 : 400, fontSize: 13, px: 1.5,
                bgcolor: location.pathname === '/' ? 'rgba(255,255,255,0.06)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: 'white' } }}>
              Home
            </Button>
            <Button
              startIcon={<Info sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/about')}
              size="small"
              sx={{ color: location.pathname === '/about' ? 'white' : 'text.secondary', fontWeight: location.pathname === '/about' ? 700 : 400, fontSize: 13, px: 1.5,
                bgcolor: location.pathname === '/about' ? 'rgba(255,255,255,0.06)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: 'white' } }}>
              About
            </Button>
            <Button
              startIcon={<Help sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/help')}
              size="small"
              sx={{ color: location.pathname === '/help' ? 'white' : 'text.secondary', fontWeight: location.pathname === '/help' ? 700 : 400, fontSize: 13, px: 1.5,
                bgcolor: location.pathname === '/help' ? 'rgba(255,255,255,0.06)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: 'white' } }}>
              Help
            </Button>

            <Tooltip title="Notifications">
              <IconButton size="small" sx={{ color: 'text.secondary', ml: 0.5 }}>
                <Badge badgeContent={0} color="primary"><Notifications fontSize="small" /></Badge>
              </IconButton>
            </Tooltip>

            <IconButton onClick={e => setAnchorEl(e.currentTarget)} size="small" sx={{ ml: 0.5 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12 }}>B</Avatar>
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
              PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid #2a4060' } }}>
              <MenuItem onClick={() => { navigate('/'); setAnchorEl(null) }}>Home</MenuItem>
              <MenuItem onClick={() => { navigate('/about'); setAnchorEl(null) }}>About</MenuItem>
              <MenuItem onClick={() => { navigate('/help'); setAnchorEl(null) }}>Help</MenuItem>
              <Divider sx={{ borderColor: '#2a4060' }} />
              <MenuItem onClick={() => setAnchorEl(null)}>Sign out</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
