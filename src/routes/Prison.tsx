import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Card, Empty, Loading, Stat } from '../components/ui';
import ChatPanel from '../components/ChatPanel';
import { duration, money, nameOf } from '../lib/format';
import { rankOf } from '../lib/ranks';

const BAIL_PER_SECOND = 8;

interface Inmate {
  id: string;
  first_name: string;
  nickname: string | null;
  last_name: string;
  path: string;
  rank_id: string;
  jail_until: string;
}

export default function Prison() {
  const { character, city } = useCharacter();
  const { act } = useSession();
  const [inmates, setInmates] = useState<Inmate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  const jailCity = character.jail_city_id ?? city.id;

  useEffect(() => {
    api.prison.inmates(jailCity).then((r) => setInmates(r as Inmate[])).catch(() => setInmates([]));
  }, [jailCity, character.jailed]);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const bail = Math.round(character.jail_seconds_left * BAIL_PER_SECOND);

  return (
    <>
      <h1>{character.jailed ? 'Inside' : 'The Block'}</h1>
      <p className="flavour" style={{ marginTop: -6 }}>
        {character.jailed
          ? 'Sentences here are short on purpose. Nobody logs in to wait.'
          : 'You are on the right side of the bars. Today.'}
      </p>

      <div className="grid grid-2">
        <Card title={character.jailed ? 'Your sentence' : 'Your record'}>
          {character.jailed ? (
            <>
              <div className="grid grid-2">
                <Stat label="Time left" value={duration(character.jail_seconds_left)} />
                <Stat label="Bail" value={money(bail)} tone="clean" sub="Clean money only" />
              </div>
              <hr />
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={busy || character.clean < bail}
                onClick={async () => {
                  setBusy(true);
                  await act(() => api.prison.postBail(), 'Out. Expensive, but out.');
                  setBusy(false);
                }}
              >
                Post bail — {money(bail)}
              </button>
              {character.clean < bail && (
                <p className="tiny" style={{ color: 'var(--blood)', marginTop: 8, marginBottom: 0 }}>
                  You cannot cover it. Sit tight, or find somebody who can.
                </p>
              )}
              <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
                Bail falls as your sentence runs down, so waiting is always cheaper
                than paying. Heat still cools while you are in here.
              </p>
            </>
          ) : (
            <>
              <p className="dim" style={{ fontSize: 14 }}>
                You are not inside. Failing a job with high heat is the fastest way
                to change that — heat raises both the odds of being caught and the
                odds a botched job turns into an arrest.
              </p>
              <div className="grid grid-2">
                <Stat label="Your heat" value={Math.round(character.heat)} tone="heat" />
                <Stat label="Arrest threshold" value="45" sub="Police can move on you above this" />
              </div>
            </>
          )}
        </Card>

        <Card title={`Currently held in ${city.name}`} flush>
          {inmates === null && <Loading label="Reading the roll" />}
          {inmates?.length === 0 && <Empty>Cells are empty. Somebody is not doing their job.</Empty>}
          {inmates && inmates.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Name</th><th>Rank</th><th className="num">Out in</th></tr>
                </thead>
                <tbody>
                  {inmates.map((i) => (
                    <tr key={i.id}>
                      <td>{nameOf(i)}</td>
                      <td className="dim">{rankOf(i.rank_id).label}</td>
                      <td className="num">
                        {duration((new Date(i.jail_until).getTime() - Date.now()) / 1000)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {character.jailed && character.jail_city_id && (
        <Card title="The yard">
          <ChatPanel channel={`prison:${character.jail_city_id}`} />
        </Card>
      )}
    </>
  );
}
