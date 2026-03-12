import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import JobDetailPage from './pages/JobDetailPage';
import AIToolsPage from './pages/AIToolsPage';
import StatsPage from './pages/StatsPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-surface">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/job/:id" element={<JobDetailPage />} />
          <Route path="/ai-tools" element={<AIToolsPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </div>
    </Router>
  );
}
