import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { SessionProvider, useSession } from './state/SessionProvider';
import Layout from './components/Layout';
import Toasts from './components/Toasts';

import Setup from './routes/Setup';
import Landing from './routes/Landing';
import Auth from './routes/Auth';
import CreateCharacter from './routes/CreateCharacter';
import Dashboard from './routes/Dashboard';
import Crimes from './routes/Crimes';
import District from './routes/District';
import Families from './routes/Families';
import Family from './routes/Family';
import Travel from './routes/Travel';
import Bank from './routes/Bank';
import Prison from './routes/Prison';
import Chat from './routes/Chat';
import Leaderboard from './routes/Leaderboard';
import Profile from './routes/Profile';

function Splash() {
  return (
    <div className="auth-wrap">
      <div className="brand-mark" style={{ fontSize: 30 }}>Cities of <span>Sin</span></div>
      <span className="spinner" />
    </div>
  );
}

/** Everything under /app. Signed in, and holding a living character. */
function Game() {
  const { booting, session, me } = useSession();

  if (booting) return <Splash />;
  if (!session) return <Navigate to="/signin" replace />;
  if (!me?.character) return <CreateCharacter />;

  return (
    <Layout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="crimes" element={<Crimes />} />
        <Route path="district" element={<District />} />
        <Route path="families" element={<Families />} />
        <Route path="family" element={<Family />} />
        <Route path="travel" element={<Travel />} />
        <Route path="bank" element={<Bank />} />
        <Route path="prison" element={<Prison />} />
        <Route path="chat" element={<Chat />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Layout>
  );
}

/** Signed-in visitors skip the marketing page. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { booting, session } = useSession();
  if (booting) return <Splash />;
  if (session) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function Shell() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Auth mode="signup" /></PublicOnly>} />
      <Route path="/signin" element={<PublicOnly><Auth mode="signin" /></PublicOnly>} />
      <Route path="/app/*" element={<Game />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  if (!isConfigured) return <Setup />;

  return (
    <BrowserRouter>
      <SessionProvider>
        <Shell />
        <Toasts />
      </SessionProvider>
    </BrowserRouter>
  );
}
