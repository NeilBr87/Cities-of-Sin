import { useState } from 'react';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Alert, Card, Field, Stat } from '../components/ui';
import { money } from '../lib/format';

// Display copies of the game_config values. The server is the authority.
const LAUNDER_RATE = 0.6;
const LAUNDER_CAP = 25000;
const VAULT_FEE = 0.1;
const VAULT_MIN = 1000;

export default function Bank() {
  const { character, vault } = useCharacter();
  const { act } = useSession();

  const [washAmount, setWashAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const wash = Number(washAmount) || 0;
  const deposit = Number(depositAmount) || 0;
  const withdraw = Number(withdrawAmount) || 0;

  // Say *why* an amount is refused rather than just greying the button out. A
  // disabled control with no explanation reads as the app being broken.
  const allowanceLeft = Math.max(0, LAUNDER_CAP - (character.laundered_amount ?? 0));
  const washProblem =
    wash <= 0 ? null
      : wash > character.dirty ? `You are only carrying ${money(character.dirty)} dirty.`
        : wash > allowanceLeft
          ? `Washing that much would attract attention. ${money(allowanceLeft)} left in this window.`
          : null;

  async function run(fn: () => Promise<unknown>, success: string, clear: () => void) {
    setBusy(true);
    const ok = await act(fn, success);
    if (ok) clear();
    setBusy(false);
  }

  return (
    <>
      <h1>Money</h1>
      <p className="flavour" style={{ marginTop: -6 }}>
        Dirty money spends nowhere. Clean money spends everywhere and can be
        taken off your body. The vault is the only thing that outlives you.
      </p>

      <Card title="What you have">
        <div className="grid grid-3">
          <Stat label="Clean" value={money(character.clean)} tone="clean" sub="Bail, tickets, everything" />
          <Stat label="Dirty" value={money(character.dirty)} tone="dirty" sub="Useless until washed" />
          <Stat label="In the vault" value={money(vault)} sub="Survives assassination" />
        </div>
      </Card>

      <div className="grid grid-2">
        <Card title="Launder">
          <p className="tiny dim">
            No front, no favours: you lose {Math.round((1 - LAUNDER_RATE) * 100)}% off the top, and
            there is a cap on how much you can push through in a day. Owning a
            front improves both — that arrives with property.
          </p>
          <Field label="Dirty money to wash">
            <input
              type="number"
              min={1}
              max={character.dirty}
              value={washAmount}
              onChange={(e) => setWashAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
          <div className="row" style={{ marginBottom: 12 }}>
            <button
              type="button" className="btn btn-sm btn-ghost"
              onClick={() => setWashAmount(String(Math.min(character.dirty, allowanceLeft)))}
            >
              All of it
            </button>
            {wash > 0 && !washProblem && (
              <span className="tiny dim">
                You get back <span className="money-clean">{money(Math.floor(wash * LAUNDER_RATE))}</span>
              </span>
            )}
          </div>

          {washProblem && <div className="field-error" style={{ marginBottom: 10 }}>{washProblem}</div>}

          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy || wash <= 0 || !!washProblem}
            onClick={() => void run(
              () => api.money.launder(wash),
              'Washed. The difference bought somebody a favour.',
              () => setWashAmount(''),
            )}
          >
            Wash it
          </button>

          <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
            {money(allowanceLeft)} of your {money(LAUNDER_CAP)} allowance left in this window.
          </p>
        </Card>

        <Card title="The vault">
          <p className="tiny dim">
            A safe-deposit box that belongs to you, not to your character. It costs{' '}
            {Math.round(VAULT_FEE * 100)}% to put money in, minimum {money(VAULT_MIN)}, and it is
            the only money a new character inherits if this one is killed.
          </p>

          <Field label="Deposit clean money">
            <input
              type="number" min={VAULT_MIN} max={character.clean}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
          {deposit > 0 && deposit < VAULT_MIN && (
            <div className="field-error" style={{ marginTop: -8, marginBottom: 10 }}>
              The vault does not take deposits under {money(VAULT_MIN)}.
            </div>
          )}
          {deposit > character.clean && (
            <div className="field-error" style={{ marginTop: -8, marginBottom: 10 }}>
              You only have {money(character.clean)} clean.
            </div>
          )}
          {deposit >= VAULT_MIN && deposit <= character.clean && (
            <p className="tiny dim" style={{ marginTop: -8 }}>
              {money(Math.floor(deposit * (1 - VAULT_FEE)))} lands in the vault.
            </p>
          )}
          <button
            type="button"
            className="btn btn-block"
            disabled={busy || deposit < VAULT_MIN || deposit > character.clean}
            onClick={() => void run(
              () => api.money.vaultDeposit(deposit),
              'Banked. Nobody can take that off you.',
              () => setDepositAmount(''),
            )}
          >
            Deposit
          </button>

          <hr />

          <Field label="Withdraw">
            <input
              type="number" min={1} max={vault}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
          <button
            type="button"
            className="btn btn-block"
            disabled={busy || withdraw <= 0 || withdraw > vault}
            onClick={() => void run(
              () => api.money.vaultWithdraw(withdraw),
              'Withdrawn — and back at risk.',
              () => setWithdrawAmount(''),
            )}
          >
            Withdraw
          </button>

          {vault === 0 && (
            <Alert kind="warn">
              The vault is empty. Everything you own right now dies with you.
            </Alert>
          )}
        </Card>
      </div>
    </>
  );
}
