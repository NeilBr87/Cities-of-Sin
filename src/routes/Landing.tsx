import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { PATHS } from '../lib/ranks';
import type { City } from '../lib/types';
import '../styles/landing.css';

const RULES = [
  {
    n: '01',
    title: 'One character, one account',
    body: 'No alts, no second wallet, no voting for yourself twice. What you build is the only thing you have.',
  },
  {
    n: '02',
    title: 'Everything is somebody',
    body: 'Every boss, every mayor, every chief of police is a player. Nothing in this world is run by the server.',
  },
  {
    n: '03',
    title: 'Dirty money is not money',
    body: 'Crime pays in cash nobody will take. Wash it, and lose a cut. Or spend your life carrying a bag around.',
  },
  {
    n: '04',
    title: 'Death is permanent',
    body: 'A boss can order you killed. If it lands, that character is gone. What you banked in the vault survives — nothing else does.',
  },
];

export default function Landing() {
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    // Reference data is world-readable, so the map renders before signup.
    api.world.cities().then(setCities).catch(() => setCities([]));
  }, []);

  return (
    <>
      <nav className="lp-nav">
        <div className="brand-mark">Cities of <span>Sin</span></div>
        <div className="row">
          <Link to="/signin" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link to="/signup" className="btn btn-primary btn-sm">Start</Link>
        </div>
      </nav>

      <header className="lp-hero">
        <div className="lp">
          <div className="lp-eyebrow">A multiplayer crime RPG</div>
          <h1 className="lp-title">
            Everybody
            <em>Takes a Cut</em>
          </h1>
          <p className="lp-lede">
            Four cities. Twenty-four districts. Five families to a city and not a
            sixth. Run the streets, run for office, or run the people who do —
            and try to die of old age.
          </p>
          <div className="lp-cta">
            <Link to="/signup" className="btn btn-primary btn-lg">Get off the bus</Link>
            <Link to="/signin" className="btn btn-lg">I have a name already</Link>
          </div>
          <div className="lp-trust">
            <span>Free to play</span>
            <span>·</span>
            <span>Browser, no download</span>
            <span>·</span>
            <span>One character per person</span>
          </div>
        </div>
      </header>

      <section className="lp-section">
        <div className="lp">
          <div className="lp-section-head">
            <h2>Pick a side of the table</h2>
            <p>
              Three paths, and they need each other. The mafia earns, the
              politicians decide what is legal, and the police decide who
              gets to find out.
            </p>
          </div>
          <div className="lp-paths">
            {Object.values(PATHS).map((p) => (
              <article key={p.id} className={`lp-path ${p.id}`}>
                <h3>{p.label}</h3>
                <div className="lp-path-tag">{p.tagline}</div>
                <p>{p.blurb}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {cities.length > 0 && (
        <section className="lp-section">
          <div className="lp">
            <div className="lp-section-head">
              <h2>Four cities, four rackets</h2>
              <p>Each one runs on something different. Pick where you start; a plane ticket is cheap enough later.</p>
            </div>
            <div className="lp-cities">
              {cities.map((c) => (
                <article key={c.id} className="lp-city">
                  <div className="code">{c.short_code}</div>
                  <div>
                    <h4>{c.name}</h4>
                    <div className="tag">{c.tagline}</div>
                    <p>{c.signature_blurb}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="lp-section">
        <div className="lp">
          <div className="lp-section-head">
            <h2>How it works</h2>
            <p>Four rules that make the rest of it matter.</p>
          </div>
          <div className="lp-rules">
            {RULES.map((r) => (
              <div className="lp-rule" key={r.n}>
                <div className="n">{r.n}</div>
                <div>
                  <h4>{r.title}</h4>
                  <p>{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-closer">
        <div className="lp">
          <h2>Nobody starts made</h2>
          <p>
            You start with two thousand dollars, ten nerve and a name you chose
            yourself. Everything after that is somebody else's decision as much
            as it is yours.
          </p>
          <Link to="/signup" className="btn btn-primary btn-lg">Create your character</Link>
        </div>
      </section>

      <footer className="lp-foot">
        Cities of Sin — a work of fiction. Any resemblance to actual families is
        a coincidence you should not mention.
      </footer>
    </>
  );
}
