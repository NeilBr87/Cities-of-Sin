import React, { useState } from 'react';

/**
 * A player's picture, everywhere a player is listed.
 *
 * If they have uploaded one it is used. If they have not — or the URL is dead —
 * they get a placeholder built from their own name: initials over a colour
 * derived from a hash of the username. That makes the fallback *stable and
 * distinct per player* rather than one grey silhouette repeated down the page,
 * so you can still tell people apart at a glance in an attack list.
 */

// Muted, smoky tones only. A bright random hue would fight the whole palette.
const PLACEHOLDER_COLOURS = [
  '#6b4a4a', '#4a5a6b', '#5a5a45', '#4a5f52', '#5f4a5f',
  '#6b5a3f', '#455a5f', '#5f4545', '#4f4f5f', '#5a4a3a',
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initials(player) {
  const a = (player?.firstName || player?.username || '?').trim()[0] || '?';
  const b = (player?.lastName || '').trim()[0] || '';
  return (a + b).toUpperCase();
}

export default function Avatar({ player, size = 36, className = '' }) {
  const [broken, setBroken] = useState(false);
  const src = player?.avatar;
  const dead = !!player?.deadAt;

  const style = {
    width: size,
    height: size,
    minWidth: size,
    fontSize: Math.round(size * 0.38),
  };

  if (src && !broken) {
    return (
      <img
        className={`avatar ${dead ? 'avatar-dead' : ''} ${className}`}
        style={style}
        src={src}
        alt=""
        onError={() => setBroken(true)}
      />
    );
  }

  const colour = PLACEHOLDER_COLOURS[hash(player?.username || player?.firstName || '') % PLACEHOLDER_COLOURS.length];
  return (
    <div
      className={`avatar avatar-placeholder ${dead ? 'avatar-dead' : ''} ${className}`}
      style={{ ...style, background: colour }}
      aria-hidden="true"
    >
      {initials(player)}
    </div>
  );
}

/** Avatar + name + whatever you pass as the second line. The standard list row. */
export function PlayerLine({ player, size = 36, children, name }) {
  return (
    <>
      <Avatar player={player} size={size} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {name}
        {children}
      </div>
    </>
  );
}
