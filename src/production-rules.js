export const WORKER_ROLE = Object.freeze({
  COOK: 'cook',
  TRADER: 'trader',
  WEAPONSMITH: 'weaponsmith',
  ARMOURER: 'armourer',
});

export const WORKER_INFO = Object.freeze({
  [WORKER_ROLE.COOK]: Object.freeze({
    name: 'Whisker Biscuit',
    shortName: 'Biscuit',
    blurb: 'Makes healing food',
    station: 'cookfire',
    productionRounds: 1,
    output: Object.freeze({
      1: Object.freeze({ kind: 'food', quantity: 1 }),
      2: Object.freeze({ kind: 'food', quantity: 2 }),
      3: Object.freeze({ kind: 'food', quantity: 4 }),
    }),
  }),
  [WORKER_ROLE.TRADER]: Object.freeze({
    name: 'Cashmere Cat',
    shortName: 'Cashmere',
    blurb: 'Makes collectible coins',
    station: 'market',
    productionRounds: 1,
    output: Object.freeze({
      1: Object.freeze({ kind: 'coins', quantity: 2 }),
      2: Object.freeze({ kind: 'coins', quantity: 3 }),
      3: Object.freeze({ kind: 'coins', quantity: 5 }),
    }),
  }),
  [WORKER_ROLE.WEAPONSMITH]: Object.freeze({
    name: 'Clawhammer',
    shortName: 'Hammer',
    blurb: 'Forges attack weapons',
    station: 'weapon-forge',
    productionRounds: 2,
    output: Object.freeze({
      1: Object.freeze({ kind: 'weapon', tier: 1, quantity: 1 }),
      2: Object.freeze({ kind: 'weapon', tier: 2, quantity: 1 }),
      3: Object.freeze({ kind: 'weapon', tier: 3, quantity: 1 }),
    }),
  }),
  [WORKER_ROLE.ARMOURER]: Object.freeze({
    name: 'Pawladin',
    shortName: 'Pawladin',
    blurb: 'Builds blocking armour',
    station: 'armour-forge',
    productionRounds: 2,
    output: Object.freeze({
      1: Object.freeze({ kind: 'armour', tier: 1, quantity: 1 }),
      2: Object.freeze({ kind: 'armour', tier: 2, quantity: 1 }),
      3: Object.freeze({ kind: 'armour', tier: 3, quantity: 1 }),
    }),
  }),
});

export const FOOD_HEAL = 2;

export const WEAPON_INFO = Object.freeze({
  1: Object.freeze({ attack: 1 }),
  2: Object.freeze({ attack: 2 }),
  3: Object.freeze({ attack: 3 }),
});

export const ARMOUR_INFO = Object.freeze({
  1: Object.freeze({ block: 2, uses: 3 }),
  2: Object.freeze({ block: 3, uses: 3 }),
  3: Object.freeze({ block: 4, uses: 3 }),
});

export function outputForWorker(role, level = 1) {
  const info = WORKER_INFO[role];
  const output = info?.output[level] ?? info?.output[1];
  return output ? { ...output } : null;
}

export function sameInventoryItem(left, right) {
  return Boolean(left && right && left.kind === right.kind && (left.tier ?? null) === (right.tier ?? null));
}

export function workerShopEntries() {
  return Object.values(WORKER_ROLE).map((role) => ({ category: 'worker', role }));
}
