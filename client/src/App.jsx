import { useState, useEffect, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import BoardSelector from './components/BoardSelector/BoardSelector';
import FilterPanel from './components/Filters/FilterPanel';
import Board from './components/Board/Board';
import ListView from './components/ListView/ListView';
import AdminSettings from './components/AdminSettings/AdminSettings';
import ClipboardIndicator from './components/ClipboardIndicator/ClipboardIndicator';
import './App.css';

const APP_VERSION = '0.1.10.26';

// Inner component that has access to AppContext
function AppContent({ user, showAdminSettings, setShowAdminSettings, showAbout, setShowAbout }) {
  const {
    tasks,
    columns,
    selectedTaskIds,
    clipboard,
    copyTasks,
    cutTasks,
    pasteTasks
  } = useApp();

  const [viewMode, setViewMode] = useState('board');
  const [triggerNewTask, setTriggerNewTask] = useState(0);

  const handleNewTask = () => setTriggerNewTask(prev => prev + 1);

  // Keyboard shortcuts for clipboard operations
  const handleKeyDown = useCallback((e) => {
    // Don't trigger if user is typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    // Check for Ctrl/Cmd key
    if (!e.ctrlKey && !e.metaKey) return;

    const selectedTasks = selectedTaskIds.length > 0
      ? tasks.filter(t => selectedTaskIds.includes(t._id))
      : [];

    switch (e.key.toLowerCase()) {
      case 'c':
        if (selectedTasks.length > 0) {
          e.preventDefault();
          copyTasks(selectedTasks);
        }
        break;
      case 'x':
        if (selectedTasks.length > 0) {
          e.preventDefault();
          cutTasks(selectedTasks);
        }
        break;
      case 'v':
        if (clipboard) {
          e.preventDefault();
          // Paste into the first column by default, or same column as first selected task
          const firstSelectedTask = selectedTasks[0];
          const targetColumnId = firstSelectedTask?.columnId || columns[0]?._id;
          if (targetColumnId) {
            pasteTasks(targetColumnId);
          }
        }
        break;
    }
  }, [selectedTaskIds, tasks, columns, clipboard, copyTasks, cutTasks, pasteTasks]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title" onClick={() => setShowAbout(true)}>Hicks Bug Hunt</h1>
          <button className="btn btn-primary" onClick={handleNewTask}>+ New Task</button>
        </div>
        <div className="header-center">
          <BoardSelector />
          <div className="view-toggle">
            <span>View:</span>
            <button
              className={`view-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              Board
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
          <ClipboardIndicator />
        </div>
        <div className="header-right">
          <div className="user-info">
            <span>{user.name || user.email}</span>
            {user.isAdmin && <span className="admin-badge">Admin</span>}
            {(user.isAdmin || user.permissions?.canManageEmailRules) && (
              <button className="settings-btn" onClick={() => setShowAdminSettings(true)}>
                Settings
              </button>
            )}
            <a href={import.meta.env.DEV ? 'http://localhost:5000/logout' : '/logout'} className="btn btn-secondary btn-small">Logout</a>
          </div>
        </div>
      </header>
      <FilterPanel />
      <main className={`app-main ${viewMode === 'list' ? 'app-main-list' : ''}`}>
        {viewMode === 'board' ? <Board triggerNewTask={triggerNewTask} /> : <ListView triggerNewTask={triggerNewTask} />}
      </main>
      {showAdminSettings && (
        <AdminSettings user={user} onClose={() => setShowAdminSettings(false)} />
      )}
      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal-content modal-small about-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>About Hicks Bug Hunt</h2>
              <button className="modal-close" onClick={() => setShowAbout(false)}>&times;</button>
            </div>
            <div className="about-content">
              <p className="about-version">Version {APP_VERSION}</p>
              <p>Created by <strong>TNB Studios</strong></p>
              <p>
                <a
                  href="https://github.com/TNB-Studios/HicksBugTracker"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View source on GitHub
                </a>
              </p>
              <p>Code is distributed under the standard MIT license.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api/me' : '/api/me';
    fetch(apiUrl, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    const loginUrl = import.meta.env.DEV
      ? 'http://localhost:5000/login'
      : '/login';

    return (
      <div className="login-page">
        <h1>Hicks Bug Hunt</h1>
        <p>Please log in to continue</p>
        <a href={loginUrl} className="btn btn-primary">Log in</a>
      </div>
    );
  }

  return (
    <AppProvider user={user}>
      <AppContent
        user={user}
        showAdminSettings={showAdminSettings}
        setShowAdminSettings={setShowAdminSettings}
        showAbout={showAbout}
        setShowAbout={setShowAbout}
      />
    </AppProvider>
  );
}

export default App;
