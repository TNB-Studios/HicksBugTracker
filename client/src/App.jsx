import { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import BoardSelector from './components/BoardSelector/BoardSelector';
import FilterPanel from './components/Filters/FilterPanel';
import Board from './components/Board/Board';
import ListView from './components/ListView/ListView';
import AdminSettings from './components/AdminSettings/AdminSettings';
import './App.css';

const APP_VERSION = '0.1.6.26';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [viewMode, setViewMode] = useState('board'); // 'board' or 'list'

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
      <div className="app">
        <header className="app-header">
          <h1 className="app-title" onClick={() => setShowAbout(true)}>Hicks Bug Hunt</h1>
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
        </header>
        <FilterPanel />
        <main className={`app-main ${viewMode === 'list' ? 'app-main-list' : ''}`}>
          {viewMode === 'board' ? <Board /> : <ListView />}
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
    </AppProvider>
  );
}

export default App;
