import React, { useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Loading } from '../components/ui';
import { money } from '../game/format';

/**
 * The screen you get when your character has been killed. There is no revive
 * button and there is not going to be one — the only thing on offer is a new
 * life, and whatever you had the sense to put in the vault.
 */
export default function Dead({ onNewCharacter }) {
  const { signOut } = useGame();
  const [info, setInfo] = useState(null);
  const [graves, setGraves] = useState([]);

  useEffect(() => {
    api.auth.me().then(setInfo).catch(() => setInfo(null));
    api.combat.graves().then(setGraves).catch(() => setGraves([]));
  }, []);

  if (!info) return <Loading what="Identifying the body" />;

  const mine = graves.find((g) => g.username === info.user?.username);
  const quantum = info.user?.quantum || 0;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-title" style={{ color: 'var(--blood)' }}>You Are Dead</div>
        <div className="auth-sub">Somebody wanted it more</div>

        <Card>
          {mine ? (
            <p className="muted" style={{ marginTop: 0 }}>
              <strong>{mine.name}</strong> — {mine.rankId} — was killed
              {mine.killedByName ? <> by <strong>{mine.killedByName}</strong></> : null}
              {mine.cause === 'war' ? ' in an open war between families.' : ' on a contract.'}
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>Your character is gone.</p>
          )}

          <hr />

          <div className="list-row">
            <span style={{ flex: 1 }}>Cash on you</span>
            <span className="mono danger">gone</span>
          </div>
          <div className="list-row">
            <span style={{ flex: 1 }}>Rank, family, property</span>
            <span className="mono danger">gone</span>
          </div>
          <div className="list-row">
            <span style={{ flex: 1 }}>Quantum Bank</span>
            <span className="mono money-clean">{money(quantum)}</span>
          </div>

          <p className="flavour" style={{ marginTop: 14 }}>
            {quantum > 0
              ? 'The vault held. Withdraw it once your new character is on their feet.'
              : 'You kept nothing back. Next time, pay the fee.'}
          </p>

          <button className="btn-brass btn-block" onClick={onNewCharacter}>
            Start a new character
          </button>
          <p className="faint tiny" style={{ textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
            You can take a different road this time.
          </p>
        </Card>

        {graves.length > 0 && (
          <Card title="Recently buried">
            {graves.slice(0, 8).map((g) => (
              <div className="list-row" key={g.id}>
                <div style={{ flex: 1 }}>
                  <div>{g.name} <span className="faint tiny">{g.rankId}</span></div>
                  <div className="faint tiny">
                    {g.family ? `${g.family.name} family · ` : ''}
                    {g.killedByName ? `killed by ${g.killedByName}` : 'killed'}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
