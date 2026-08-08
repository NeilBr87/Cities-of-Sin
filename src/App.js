import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './state/GameContext';
import Layout from './components/Layout';

import Auth from './pages/Auth';
import CreateCharacter from './pages/CreateCharacter';
import Dashboard from './pages/Dashboard';
import Crimes from './pages/Crimes';
import Duty from './pages/Duty';
import Office from './pages/Office';
import District from './pages/District';
import Travel from './pages/Travel';
import Bank from './pages/Bank';
import Market from './pages/Market';
import Property from './pages/Property';
import Families from './pages/Families';
import Family from './pages/Family';
import Politics from './pages/Politics';
import Police from './pages/Police';
import Prison from './pages/Prison';
import ChatPage from './pages/ChatPage';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';

/**
 * HashRouter rather than BrowserRouter: the game is a single-page app that may
 * end up served from static hosting (or from Xano's own file storage) with no
 * server-side rewrite rules. Hash routing works anywhere without configuration.
 */
function Shell() {
  const { booting, authed, me } = useGame();

  if (booting) {
    return (
      <div className="auth-page">
        <div className="auth-title">Cities of Sin</div>
      </div>
    );
  }

  if (!authed) return <Auth />;
  if (!me) return <CreateCharacter />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/crimes" element={<Crimes />} />
        <Route path="/duty" element={<Duty />} />
        <Route path="/office" element={<Office />} />
        <Route path="/district" element={<District />} />
        <Route path="/travel" element={<Travel />} />
        <Route path="/bank" element={<Bank />} />
        <Route path="/market" element={<Market />} />
        <Route path="/property" element={<Property />} />
        <Route path="/families" element={<Families />} />
        <Route path="/family" element={<Family />} />
        <Route path="/politics" element={<Politics />} />
        <Route path="/police" element={<Police />} />
        <Route path="/prison" element={<Prison />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <GameProvider>
        <Shell />
      </GameProvider>
    </HashRouter>
  );
}
