import React, { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  MessageSquare, Mic, Upload, Share2, Users, Mail,
  Bug, Settings, BarChart3, Rocket, GitBranch, BookOpen,
  Brain, Home, Info, HelpCircle, Bell, ChevronRight, Menu, X
} from 'lucide-react'
import './Layout.css'

const NAV_ITEMS = [
  { path: '/text-agent',    label: 'Text Agent',      icon: MessageSquare, group: 'Agents' },
  { path: '/voice-agent',   label: 'Voice Agent',     icon: Mic,           group: 'Agents' },
  { path: '/upload',        label: 'Upload Files',    icon: Upload,        group: 'Agents' },
  { path: '/sharepoint',    label: 'SharePoint',      icon: Share2,        group: 'Resources' },
  { path: '/teams',         label: 'Teams',           icon: Users,         group: 'Resources' },
  { path: '/outlook',       label: 'Outlook',         icon: Mail,          group: 'Resources' },
  { path: '/jira',          label: 'Jira',            icon: Bug,           group: 'Resources' },
  { path: '/solman',        label: 'SAP SolMan',      icon: Settings,      group: 'Resources' },
  { path: '/signavio',      label: 'Signavio',        icon: BarChart3,     group: 'Resources' },
  { path: '/track-release', label: 'Track & Release', icon: Rocket,        group: 'Resources' },
  { path: '/interview-data',label: 'Interview Data',  icon: BookOpen,      group: 'Resources' },
  { path: '/knowledge',     label: 'Knowledge Base',  icon: Brain,         group: 'Analytics' },
]

const groups = ['Agents', 'Resources', 'Analytics']

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="layout">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="menu-toggle" onClick={() => setSidebarOpen(v => !v)}>
            {sidebarOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
          <div className="brand">
            <div className="brand-dot" />
            <span className="brand-name">BOSCH</span>
            <span className="brand-sep">|</span>
            <span className="brand-sub">Knowledge Dashboard</span>
          </div>
        </div>
        <div className="navbar-center">
          <a href="#" className="nav-link-top active">Home</a>
          <a href="#" className="nav-link-top">About</a>
          <a href="#" className="nav-link-top">Help</a>
          <a href="#" className="nav-link-top">Documentation</a>
        </div>
        <div className="navbar-right">
          <button className="icon-btn" title="Notifications"><Bell size={16}/></button>
          <button className="icon-btn" title="Help"><HelpCircle size={16}/></button>
          <div className="user-avatar">BK</div>
        </div>
      </nav>

      <div className="body-wrap">
        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
          <div className="sidebar-inner">
            {groups.map(group => {
              const items = NAV_ITEMS.filter(i => i.group === group)
              return (
                <div key={group} className="nav-group">
                  {sidebarOpen && <div className="nav-group-label">{group}</div>}
                  {items.map(item => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                        title={!sidebarOpen ? item.label : ''}
                      >
                        <Icon size={16} className="nav-icon" />
                        {sidebarOpen && <span className="nav-label">{item.label}</span>}
                        {sidebarOpen && <ChevronRight size={12} className="nav-arrow" />}
                      </NavLink>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
