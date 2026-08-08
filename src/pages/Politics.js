import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Empty, Loading, Badge, Tabs } from '../components/ui';
import { money, fullName, timeAgo } from '../game/format';
import { CONFIG } from '../game/economy';
import { PATHS, rank } from '../game/ranks';

export default function Politics() {
  const { me, act } = useGame();
  const [tab, setTab] = useState('elections');
  const [parties, setParties] = useState(null);
  const [elections, setElections] = useState(null);
  const [offices, setOffices] = useState([]);
  const [form, setForm] = useState({ name: '', motto: '', logo: '★', colour: '#2f6f8f' });
  const [spend, setSpend] = useState({});

  const load = useCallback(() => {
    api.politics.parties().then(setParties).catch(() => setParties({ parties: [], slotsRemaining: 0 }));
    api.politics.elections().then(setElections).catch(() => setElections([]));
    api.politics.offices().then(setOffices).catch(() => setOffices([]));
  }, []);
  useEffect(load, [load]);

  if (!parties || !elections) return <Loading what="Reading the ballot" />;

  const isPolitician = me?.path === PATHS.POLITICIAN;

  return (
    <>
      <h1>Politics</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        Councilmen hold a district and run every week. Mayors hold a city and run every month.
        The President holds everything and runs every two months.
      </p>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'elections', label: 'Elections' },
          { id: 'offices', label: 'Who holds what' },
          { id: 'parties', label: 'Parties' },
        ]}
      />

      {tab === 'elections' && (
        <div className="grid grid-2">
          {elections.length === 0 && <Empty>No open races.</Empty>}
          {elections
            .filter((e) => e.seat === 'nation' || (e.seat === 'city' && e.scopeId === me.cityId) || (e.seat === 'district' && e.scopeId === me.districtId))
            .map((e) => (
              <Card key={e.id} title={`${rank(e.rankId).label} — ${e.scopeName}`}>
                <p className="faint tiny" style={{ marginTop: 0 }}>
                  Closes {timeAgo(e.closesAt)} from now · {e.candidates.length} candidate(s)
                  {e.seat === 'nation' && ' · every player in every city votes'}
                </p>

                {e.candidates.length === 0 && <Empty>Nobody is standing. The seat is there for the taking.</Empty>}

                {e.candidates.map((c) => (
                  <div className="list-row" key={c.playerId}>
                    <div style={{ flex: 1 }}>
                      <div>{c.player ? fullName(c.player) : 'Unknown'}</div>
                      <div className="row" style={{ gap: 6, marginTop: 3 }}>
                        {c.party && <Badge kind="politician">{c.party.logo} {c.party.name}</Badge>}
                        <span className="faint tiny">{c.votes} votes · {money(c.spend)} spent</span>
                      </div>
                    </div>
                    <button
                      className="btn-sm"
                      disabled={e.youVoted}
                      onClick={() => act(() => api.politics.vote(e.id, c.playerId), 'Vote cast.').then(load)}
                    >
                      {e.youVoted ? 'Voted' : 'Vote'}
                    </button>
                  </div>
                ))}

                {isPolitician && !e.youStand && (
                  <button
                    className="btn-brass btn-sm"
                    style={{ marginTop: 10 }}
                    disabled={me.clean < (CONFIG.CAMPAIGN_FEE[e.seat] ?? 0)}
                    onClick={() => act(() => api.politics.standFor(e.seat, e.scopeId), 'You are on the ballot.').then(load)}
                  >
                    {me.clean < (CONFIG.CAMPAIGN_FEE[e.seat] ?? 0)
                      ? `Filing fee is ${money(CONFIG.CAMPAIGN_FEE[e.seat])}`
                      : `Stand for this seat (${money(CONFIG.CAMPAIGN_FEE[e.seat])})`}
                  </button>
                )}

                {isPolitician && e.youStand && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <input
                      type="number"
                      style={{ width: 140 }}
                      placeholder="Campaign spend"
                      value={spend[e.id] || ''}
                      onChange={(ev) => setSpend({ ...spend, [e.id]: ev.target.value })}
                    />
                    <button
                      className="btn-sm"
                      onClick={() => act(() => api.politics.campaign(e.id, Number(spend[e.id] || 0)), 'Money spent, hands shaken.').then(load)}
                    >
                      Campaign
                    </button>
                  </div>
                )}
              </Card>
            ))}
        </div>
      )}

      {tab === 'offices' && (
        <Card title="Sitting office holders">
          {offices.length === 0 ? <Empty>Every seat is vacant.</Empty> : (
            ['nation', 'city', 'district'].map((seat) => (
              <div key={seat}>
                <h3 style={{ marginTop: 14 }}>
                  {seat === 'nation' ? 'The Presidency' : seat === 'city' ? 'Mayors' : 'Councilmen'}
                </h3>
                {offices.filter((o) => o.seat === seat).map((o) => (
                  <div className="list-row" key={o.id}>
                    <div style={{ flex: 1 }}>
                      <div>{o.scopeName}</div>
                      <div className="faint tiny">
                        {o.holder ? fullName(o.holder) : 'vacant'} · term ends {new Date(o.termEndsAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'parties' && (
        <>
          <div className="grid grid-2">
            {parties.parties.map((p) => (
              <Card key={p.id}>
                <div className="card-header">
                  <h3 style={{ color: p.colour }}>{p.logo} {p.name}</h3>
                  <Badge>{p.memberCount} members</Badge>
                </div>
                <p className="flavour" style={{ marginTop: 0 }}>{p.motto || '—'}</p>
                <div className="faint tiny">Leader: {p.leader ? fullName(p.leader) : 'vacant'}</div>
                {isPolitician && String(me.partyId) !== String(p.id) && (
                  <button className="btn-sm" style={{ marginTop: 10 }} onClick={() => act(() => api.politics.joinParty(p.id), `Joined ${p.name}.`).then(load)}>
                    Join
                  </button>
                )}
              </Card>
            ))}
          </div>

          {isPolitician && !me.partyId && parties.slotsRemaining > 0 && (
            <Card title="Found a party">
              <p className="faint tiny" style={{ marginTop: 0 }}>
                {parties.slotsRemaining} of five slots left. Costs {money(CONFIG.PARTY_FOUNDING_COST)}. The founder leads it.
              </p>
              <div className="grid grid-2">
                <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Logo"><input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} maxLength={4} /></Field>
              </div>
              <Field label="Motto"><input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} maxLength={80} /></Field>
              <Field label="Colour"><input type="color" value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} /></Field>
              <button
                className="btn-brass"
                disabled={me.clean < CONFIG.PARTY_FOUNDING_COST || form.name.length < 3}
                onClick={() => act(() => api.politics.createParty(form), `${form.name} is on the ballot.`).then(load)}
              >
                Found the party
              </button>
            </Card>
          )}
        </>
      )}
    </>
  );
}
