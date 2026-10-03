import { describe, expect, it } from 'vitest';
import { duration, money, nameOf, shortMoney } from './format';

// Note: the game *rules* are in Postgres and belong in pgTAP tests, not here.
// This file covers the pure display helpers, which is all the client owns.

describe('money', () => {
  it('formats and rounds', () => {
    expect(money(1234)).toBe('$1,234');
    expect(money(1234.6)).toBe('$1,235');
  });

  it('survives null', () => {
    expect(money(null)).toBe('$0');
    expect(money(undefined)).toBe('$0');
  });
});

describe('shortMoney', () => {
  it('abbreviates above ten thousand', () => {
    expect(shortMoney(9999)).toBe('$9,999');
    expect(shortMoney(25_000)).toBe('$25K');
    expect(shortMoney(2_500_000)).toBe('$2.5M');
    expect(shortMoney(3_000_000)).toBe('$3M');
  });

  it('keeps the sign', () => {
    expect(shortMoney(-2_500_000)).toBe('-$2.5M');
  });
});

describe('duration', () => {
  it('steps through the units', () => {
    expect(duration(45)).toBe('45s');
    expect(duration(90)).toBe('1m 30s');
    expect(duration(3600)).toBe('1h');
    expect(duration(5400)).toBe('1h 30m');
    expect(duration(90_000)).toBe('1d 1h');
  });

  it('never goes negative', () => {
    expect(duration(-10)).toBe('0s');
  });
});

describe('nameOf', () => {
  it("renders Johnny 'The Boy' Smith", () => {
    expect(nameOf({ first_name: 'Johnny', nickname: 'The Boy', last_name: 'Smith' }))
      .toBe("Johnny 'The Boy' Smith");
  });

  it('drops the quotes when there is no nickname', () => {
    expect(nameOf({ first_name: 'Johnny', nickname: null, last_name: 'Smith' }))
      .toBe('Johnny Smith');
    expect(nameOf({ first_name: 'Johnny', last_name: 'Smith' }))
      .toBe('Johnny Smith');
  });
});
