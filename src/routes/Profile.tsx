import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Badge, Card, Empty, Field, Loading, Stat } from '../components/ui';
import { duration, money, timeAgo } from '../lib/format';
import { PATHS, rankOf } from '../lib/ranks';

interface Attempt {
  id: number;
  crime_id: string;
  success: boolean;
  payout: number;
  respect_gained: number;
  arrested: boolean;
  created_at: string;
  crimes: { name: string } | null;
}

export default function Profile() {
  const { character, city, district } = useCharacter();
  const { me, act } = useSession();

  const [bio, setBio] = useState(character.bio);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Attempt[] | null>(null);

  useEffect(() => {
    api.crimes.history(25).then((r) => setHistory(r as unknown as Attempt[])).catch(() => setHistory([]));
  }, []);

  const r = rankOf(character.rank_id);
  const age = duration((Date.now() - new Date(character.created_at).getTime()) / 1000);

  return (
    <>
      <h1>{character.display_name}</h1>
      <div className="row" style={{ marginTop: -4, marginBottom: 18 }}>
        <Badge kind={character.path}>{r.label}</Badge>
        <Badge>{district.name}, {city.short_code}</Badge>
        <span className="faint tiny">Alive {age} · account {me?.profile.username}</span>
      </div>

      <div className="grid grid-2">
        <Card title="The record">
          <div className="grid grid-3">
            <Stat label="Respect" value={character.respect.toLocaleString()} />
            <Stat label="Clean" value={money(character.clean)} tone="clean" />
            <Stat label="Dirty" value={money(character.dirty)} tone="dirty" />
            <Stat label="Heat" value={Math.round(character.heat)} tone="heat" />
            <Stat label="Health" value={`${character.health}/100`} />
            <Stat label="Nerve" value={`${character.nerve}/${character.nerve_max}`} tone="nerve" />
          </div>
          <hr />
          <div className="label" style={{ marginBottom: 4 }}>{PATHS[character.path].label}</div>
          <p className="tiny dim" style={{ margin: 0 }}>{r.blurb}</p>
        </Card>

        <Card title="Your story">
          <Field label="Bio" hint="Public. 500 characters. Everybody can read it, including the police.">
            <textarea
              value={bio}
              maxLength={500}
              rows={7}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Where you came from, and who you say you are."
            />
          </Field>
          <div className="between">
            <span className="tiny faint mono">{bio.length}/500</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving || bio === character.bio}
              onClick={async () => {
                setSaving(true);
                await act(() => api.player.updateBio(bio), 'Saved.');
                setSaving(false);
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Card>
      </div>

      <Card title="Rap sheet" flush>
        {history === null && <Loading label="Pulling the file" />}
        {history?.length === 0 && <Empty>Clean as a whistle. For now.</Empty>}
        {history && history.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Job</th><th>Outcome</th>
                  <th className="num">Take</th><th className="num">Respect</th><th className="num">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.crimes?.name ?? h.crime_id}</td>
                    <td>
                      {h.arrested
                        ? <span style={{ color: 'var(--blood)' }}>Arrested</span>
                        : h.success
                          ? <span style={{ color: 'var(--clean)' }}>Clean</span>
                          : <span className="dim">Botched</span>}
                    </td>
                    <td className="num" style={{ color: h.payout ? 'var(--dirty)' : undefined }}>
                      {h.payout ? money(h.payout) : '—'}
                    </td>
                    <td className="num">{h.respect_gained || '—'}</td>
                    <td className="num faint">{timeAgo(h.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
