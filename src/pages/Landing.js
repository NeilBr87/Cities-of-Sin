import React from 'react';
import { ERA } from '../game/era';
import { CITIES } from '../game/world';
import { CONFIG } from '../game/economy';
import { PATH_META } from '../game/ranks';
import { DIPLOMACY_META, DIPLOMACY } from '../game/diplomacy';

/**
 * The public front door. Everything here is deliberately concrete — real
 * numbers from the live config, not marketing adjectives, because the players
 * this game wants are the ones who read the numbers.
 */
export default function Landing({ onSignUp, onSignIn }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand" style={{ padding: 0 }}>
          Cities of Sin
          <small>{ERA.label} · {ERA.year}</small>
        </div>
        <div className="spacer" />
        <button className="btn-ghost btn-sm" onClick={onSignIn}>Sign in</button>
        <button className="btn-brass btn-sm" onClick={onSignUp}>Start playing</button>
      </header>

      <section className="hero">
        <h1 className="hero-title">Four cities.<br />Three ways up.<br />One way out.</h1>
        <p className="hero-sub">
          A persistent multiplayer crime RPG. Run rackets for a family, buy the laws that
          protect them, or carry the badge that takes them down. Everything you own can be
          taken by somebody who wants it more.
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn-brass" onClick={onSignUp}>Create your character</button>
          <button className="btn-ghost" onClick={onSignIn}>I already play</button>
        </div>
        <p className="faint tiny" style={{ marginTop: 14 }}>
          Free. No download. {CONFIG.MAX_FAMILIES_PER_CITY} family seats per city and
          somebody is always sitting in one.
        </p>
      </section>

      <section className="landing-section">
        <h2>Pick a life</h2>
        <div className="grid grid-3">
          {Object.values(PATH_META).map((p) => (
            <div className="card" key={p.id}>
              <h3>{p.label}</h3>
              <p className="muted" style={{ marginBottom: 0 }}>{p.blurb}</p>
            </div>
          ))}
        </div>
        <p className="flavour" style={{ marginTop: 14 }}>
          The three need each other. A family cannot reach its biggest scores without a
          politician awarding contracts. A politician cannot fund a campaign on salary alone.
          The police get paid either way — by the city, or by whoever is buying that week.
        </p>
      </section>

      <section className="landing-section">
        <h2>Take the ground, not the points</h2>
        <div className="card">
          <p>
            Every district is a list of <strong>rackets</strong> — the barber shop book in
            Little Italy, Longshoremen Local 13 in San Pedro, the count room on the Strip.
            Buy the ones nobody holds. Take the ones somebody does.
          </p>
          <p className="muted">
            Whoever holds the most rackets in a district controls it. Taking one by force
            is hard on your own and much easier with a crew behind you — which is the entire
            reason crews exist. A family may only run <strong>one crew per district</strong>,
            so growing means spreading out.
          </p>
          <p className="flavour" style={{ marginBottom: 0 }}>
            96 rackets across 24 districts, every one of them named for where it is.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <h2>Death is permanent</h2>
        <div className="grid grid-2">
          <div className="card">
            <h3>Anyone can rob you</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Any player can attack any other and take a cut of the dirty money on them.
              Only a boss can order a killing — they fund the contract, hand it to a captain,
              and the captain picks the shooter from their own crew.
            </p>
          </div>
          <div className="card">
            <h3>And then you start again</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Assassination ends a character for good. You build a new one — and you can take
              a completely different road this time. Everything you were carrying is gone.
            </p>
          </div>
        </div>
        <div className="card" style={{ borderColor: 'var(--brass-dim)' }}>
          <h3>Except the Quantum Bank</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            The one account that outlives your character. It costs{' '}
            {Math.round(CONFIG.QUANTUM_DEPOSIT_FEE * 100)}% to put money in and it earns
            nothing while it sits there — but it is still there when you are not. The players
            who last are the ones who paid that fee early.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <h2>Families make war, and peace</h2>
        <div className="grid grid-4">
          {[DIPLOMACY.NEUTRAL, DIPLOMACY.NAP, DIPLOMACY.WAR, DIPLOMACY.ALLIED].map((s) => {
            const m = DIPLOMACY_META[s];
            return (
              <div className="card" key={s} style={{ borderTop: `2px solid ${m.colour}` }}>
                <h3 style={{ color: m.colour, fontSize: 15 }}>{m.label}</h3>
                <p className="faint tiny" style={{ marginBottom: 0 }}>{m.blurb}</p>
              </div>
            );
          })}
        </div>
        <p className="flavour" style={{ marginTop: 14 }}>
          A pact, a war and an alliance are each limited to one family at a time. Choosing
          an ally is choosing whose war you will be fighting.
        </p>
      </section>

      <section className="landing-section">
        <h2>The map</h2>
        <div className="grid grid-4">
          {CITIES.map((c) => (
            <div className="card" key={c.id}>
              <h3>{c.name}</h3>
              <p className="flavour" style={{ marginTop: 0 }}>{c.tagline}</p>
              <div className="badge">{c.signatureLabel}</div>
              <p className="faint tiny" style={{ marginTop: 8, marginBottom: 0 }}>{c.signatureBlurb}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2 style={{ marginBottom: 6 }}>There is a seat open somewhere</h2>
        <p className="muted">It will not be open for long.</p>
        <button className="btn-brass" onClick={onSignUp}>Create your character</button>
      </section>

      <footer className="landing-foot">
        <span className="faint tiny">
          Cities of Sin · a persistent multiplayer crime RPG · {ERA.label}, {ERA.year}
        </span>
      </footer>
    </div>
  );
}
