import { AppProvider } from './context/AppContext';
import BoardSelector from './components/BoardSelector/BoardSelector';
import FilterPanel from './components/Filters/FilterPanel';
import Board from './components/Board/Board';
import './App.css';

function App() {
  return (
    <AppProvider>
      <div className="app">
        <header className="app-header">
          <h1>Hicks Bug Hunt</h1>
          <BoardSelector />
        </header>
        <FilterPanel />
        <main className="app-main">
          <Board />
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
