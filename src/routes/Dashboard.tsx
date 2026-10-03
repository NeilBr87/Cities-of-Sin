import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useCharacter } from '../state/SessionProvider';
import { Alert, Badge, Card, Empty, Meter, Stat } from '../components/ui';
import { duration, money, timeAgo } from '../lib/format';
import { rankOf } from '../lib/ranks';
import type { GameEvent } from '../lib/types';

export default function Dashboard() {
  const { character, city, district, vault } = useCharacter();
  const [feed, setFeed] = useState<GameEvent[]>([]);

  // The activity feed is the cheapest possible proof that other people are
  // playing. It is also the hook that makes an empty server feel less empty.
  useEffect(() => {
    const scopes = ['global', `city:${city.id}`, `district:${district.id}`, `character:${character.id}`];
    api.events.recent(scopes).then(setFeed).catch(() => setFeed([]));

    return api.events.subscribe((e) => {
      if (scopes.includes(e.scope)) setFeed((f) => [e, ...f].slice(0, 25));
    });
  }, [city.id, district.id, character.id]);

  const r = rankOf(character.rank_id);

  return (
    <>
      <h1>{character.display_name}</h1>
      <p className="flavour" style={{ marginTop: -6 }}>{r.blurb}</p>

      {character.jailed && (
        <Alert kind="error">
          You are in a cell in {city.name} for another {duration(character.jail_seconds_left)}.{' '}
          <Link to="/app/prison">Head to the block</Link> — there are ways out.
        </Alert>
      )}

      {character.immune && (
        <Alert kind="warn">
          You are under new-arrival protection for{' '}
          {duration((new Date(character.immune_until).getTime() - Date.now()) / 1000)}. Nobody can
          touch you until it lapses. Use it.
        </Alert>
      )}

      <div className="grid grid-2">
        <Card title="Standing">
          <div className="grid grid-3">
            <Stat label="Clean" value={money(character.clean)} tone="clean" sub="Spendable" />
            <Stat label="Dirty" value={money(character.dirty)} tone="dirty" sub="Wash it first" />
            <Stat label="Vault" value={money(vault)} sub="Survives death" />
            <Stat label="Respect" value={character.respect.toLocaleString()} sub="Unlocks work" />
            <Stat label="Heat" value={Math.round(character.heat)} tone="heat" sub="Cools slowly" />
            <Stat label="Nerve" value={`${character.nerve}/${character.nerve_max}`} tone="nerve" />
          </div>

          <hr />

          <div className="col" style={{ gap: 12 }}>
            <div>
              <div className="between tiny faint" style={{ marginBottom: 4 }}>
                <span>Heat</span><span className="mono">{Math.round(character.heat)}/100</span>
              </div>
              <Meter value={character.heat} max={100} kind="heat" />
            </div>
            <div>
              <div className="between tiny faint" style={{ marginBottom: 4 }}>
                <span>Health</span><span className="mono">{character.health}/100</span>
              </div>
              <Meter value={character.health} max={100} kind="health" />
            </div>
          </div>

          <hr />

          <div className="row">
            <Badge kind={character.path}>{r.label}</Badge>
            <Badge>{city.short_code}</Badge>
            <Badge>{district.name}</Badge>
            {character.heat >= 45 && <Badge kind="hot">Wanted</Badge>}
          </div>
        </Card>

        <Card
          title="Where you are"
          action={<Link to="/app/district" className="btn btn-sm btn-ghost">Look around</Link>}
        >
          <h2 style={{ marginBottom: 2 }}>{district.name}</h2>
          <div className="label" style={{ marginBottom: 10 }}>{city.name}</div>
          <p className="flavour">{district.flavour}</p>

          <hr />

          <div className="grid grid-2">
            <Stat
              label="Wealth"
              value={`${district.wealth.toFixed(2)}×`}
              sub="Multiplier on every payout here"
            />
            <Stat
              label="Policing"
              value={`${district.policing.toFixed(2)}×`}
              sub="Multiplier on heat and arrest odds"
            />
          </div>

          <hr />

          <div className="label" style={{ marginBottom: 6 }}>{city.signature_label}</div>
          <p className="tiny dim" style={{ margin: 0 }}>{city.signature_blurb}</p>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card
          title="Next moves"
        >
          <div className="col">
            <Link to="/app/crimes" className="btn btn-primary btn-block">Find work</Link>
            <Link to="/app/bank" className="btn btn-block">
              Wash {money(character.dirty)} dirty
            </Link>
            <Link to="/app/chat" className="btn btn-block">Talk to somebody</Link>
          </div>
          <p className="tiny faint" style={{ marginTop: 12, marginBottom: 0 }}>
            Nerve returns one point every five minutes, so the game is meant to be
            checked on, not ground. Heat cools three points an hour whatever you do.
          </p>
        </Card>

        <Card title="The word on the street">
          {feed.length === 0 && <Empty>Quiet. Suspiciously quiet.</Empty>}
          <div className="col" style={{ gap: 8 }}>
            {feed.map((e) => (
              <div key={e.id} className="between" style={{ alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 13 }}>{e.body}</span>
                <span className="tiny faint mono nowrap">{timeAgo(e.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
