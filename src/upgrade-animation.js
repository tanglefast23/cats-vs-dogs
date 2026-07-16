export const UPGRADE_TIMING = Object.freeze({
  concealMs: 150,
  revealDelayMs: 230,
  smokeMs: 720,
  totalMs: 980,
});

export function describeUpgrade(before, after) {
  if (!before || !after) return null;
  const level = Number(after.level ?? 1);
  const copies = Number(after.copies ?? 1);
  const promoted = level > Number(before.level ?? 1);

  if (promoted) {
    return {
      kind: 'level-up',
      level,
      label: `LEVEL ${level}!`,
      intensity: level >= 3 ? 'ultimate' : 'level-up',
    };
  }

  return {
    kind: 'stack',
    level,
    label: `${copies} / 3`,
    intensity: 'standard',
  };
}

export function describeProductionUpgrade(before, after) {
  const reveal = describeUpgrade(before, after);
  if (!reveal) return null;
  return reveal.kind === 'level-up'
    ? { ...reveal, note: 'PRODUCTION BOOST!' }
    : reveal;
}
