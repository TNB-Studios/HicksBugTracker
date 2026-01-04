import { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import BoardSelector from './components/BoardSelector/BoardSelector';
import FilterPanel from './components/Filters/FilterPanel';
import Board from './components/Board/Board';
import AdminSettings from './components/AdminSettings/AdminSettings';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdminSettings, setShowAdminSettings] = useState(false);

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
          <h1>Hicks Bug Hunt</h1>
          <BoardSelector />
          <div className="user-info">
            <span>{user.name || user.email}</span>
            {user.isAdmin && <span className="admin-badge">Admin</span>}
            {user.isAdmin && (
              <button className="settings-btn" onClick={() => setShowAdminSettings(true)}>
                Settings
              </button>
            )}
            <a href={import.meta.env.DEV ? 'http://localhost:5000/logout' : '/logout'} className="btn btn-secondary btn-small">Logout</a>
          </div>
        </header>
        <FilterPanel />
        <main className="app-main">
          <Board />
        </main>
        {showAdminSettings && (
          <AdminSettings onClose={() => setShowAdminSettings(false)} />
        )}
      </div>
    </AppProvider>
  );
}

export default App;
