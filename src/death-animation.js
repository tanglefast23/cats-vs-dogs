/**
 * How each cat and each dog dies.
 *
 * Every sprite is drawn standing, feet at the bottom of its 32×32 tile. So a half turn
 * puts the unit on its back with all four paws in the air, and it keeps its own
 * silhouette on the way down — a dachshund still reads as a dachshund. That means no unit
 * needs a second "corpse" sprite: the comedy comes from the choreography and from a gag
 * built out of the prop that unit is already carrying.
 *
 * spin    — total degrees turned, signed. Always a half turn mod 360, so it lands
 *           belly-up. 180 is a topple; 540 is a cartwheel and a half.
 * tilt    — the resting lean, so no two corpses lie at the same angle.
 * hop     — launch height in pixels.
 * bounces — how many times it settles before going still.
 * gag     — the signature prop, drawn by the CSS class of the same name.
 * tongue  — whether the tongue lolls out.
 * float   — dies in mid-air instead of hitting the ground (ghosts only).
 */

export const CAT_DEATH = Object.freeze({
  // Purrcy Pew-Pew — the gunslinger's pop-gun goes off one last time and spins him round.
  0: { spin: -540, tilt: 9, hop: 34, bounces: 2, gag: 'gunsmoke-puff', tongue: true },
  // Clawdius — too heavy to fly. The slab of muscle topples like a felled tree and the
  // whole yard feels it.
  1: { spin: 180, tilt: -15, hop: 10, bounces: 1, gag: 'ground-quake', tongue: false },
  // Hissiletoe — far too elegant for this. Faints backwards in a puff of fur.
  2: { spin: 180, tilt: 14, hop: 26, bounces: 2, gag: 'fur-plume', tongue: false },
  // Knotty Kitty — the kitten cartwheels away and its yarn ball rolls off across the yard.
  3: { spin: 900, tilt: 17, hop: 42, bounces: 3, gag: 'yarn-roll', tongue: true },
  // Bombay Boom — the bomb on his back finally goes off. It is a dud. It just fizzles.
  4: { spin: -540, tilt: -11, hop: 30, bounces: 1, gag: 'dud-fizzle', tongue: true },
  // Laserpaw — the visor shorts out, the crystal crown blinks dead.
  5: { spin: 540, tilt: 6, hop: 28, bounces: 1, gag: 'short-circuit', tongue: false },
  // Frosty Paws — freezes solid on the way down and shatters when it lands.
  6: { spin: 180, tilt: -20, hop: 22, bounces: 0, gag: 'frost-shatter', tongue: false },
  // Purrtal — never touches the ground. The hooded phantom turns over in mid-air and
  // comes apart into motes.
  7: { spin: -180, tilt: 12, hop: 46, bounces: 0, gag: 'mote-dissolve', tongue: false, float: true },
  // Faux Paw — the showman milks it. One last bow, and the phantom double waves goodbye.
  8: { spin: 540, tilt: -8, hop: 38, bounces: 2, gag: 'curtain-call', tongue: true },
  // Thunderpaws — electrocutes itself on its own lightning rod and twitches.
  9: { spin: -900, tilt: 20, hop: 36, bounces: 3, gag: 'zap-twitch', tongue: true },
  // Meowstro — the monocle pops off and spins away on the grass. Dignity intact.
  10: { spin: 180, tilt: -6, hop: 24, bounces: 1, gag: 'monocle-pop', tongue: false },
});

export const DOG_DEATH = Object.freeze({
  // Chomps McGraw — the textbook cartoon flop: legs up, tongue out, done.
  scruffy: { spin: 180, tilt: 11, hop: 28, bounces: 2, gag: 'tongue-flop', tongue: true },
  // Fetch Armstrong — his own disc comes back and lands on his face.
  frisbee: { spin: -540, tilt: -13, hop: 36, bounces: 2, gag: 'disc-drop', tongue: true },
  // Bark McEnroe — the tennis ball bounces off his head, twice, unhurried.
  tennis: { spin: 540, tilt: 8, hop: 40, bounces: 3, gag: 'ball-bounce', tongue: true },
  // Howl Pacino — gets out one last cracked note on the way down.
  howler: { spin: 180, tilt: -18, hop: 30, bounces: 1, gag: 'last-howl', tongue: false },
  // Bone Jovi — the long dachshund see-saws on his own belly and the mortar bone clatters out.
  lobber: { spin: -180, tilt: 15, hop: 14, bounces: 3, gag: 'bone-clatter', tongue: true },
  // Barkour Bandit — the spring boots fire once more and ragdoll him into the dirt.
  jumper: { spin: 900, tilt: -9, hop: 48, bounces: 3, gag: 'spring-boing', tongue: true },
  // Sir Flinches-a-Lot — faints stiff as a plank. The security blanket settles over him.
  skittish: { spin: 180, tilt: 21, hop: 18, bounces: 0, gag: 'faint-stiff', tongue: false },
  // Dr. Droolittle — the big saint bernard goes down slowly and his heart tonic spills.
  medic: { spin: -180, tilt: -12, hop: 12, bounces: 1, gag: 'tonic-spill', tongue: true },
  // Growl Gadot — drops the megaphone and it squeals with feedback on the ground.
  growler: { spin: 540, tilt: 17, hop: 32, bounces: 2, gag: 'megaphone-drop', tongue: true },
});

/** The stand-in for anything unrecognised — including Faux Paw's phantom decoy. */
const FALLBACK_DEATH = Object.freeze({
  spin: 180, tilt: 10, hop: 26, bounces: 2, gag: 'tongue-flop', tongue: true,
});

/**
 * The beats of a death, in order. Deaths within one phase play at the same time, so this
 * is the cost of an entire wipe, not the cost per unit.
 */
export const DEATH_TIMING = Object.freeze({
  hitstopMs: 70,   // the killing blow freezes for a frame — the hit lands harder
  launchMs: 170,   // popped off its feet, starting to turn over
  flopMs: 200,     // comes down on its back
  settleMs: 110,   // squash, wobble, go still
  restMs: 60,      // lie there long enough to actually see the pose
  strobeMs: 140,   // flash
  fadeMs: 170,     // and fade out
});

/** Scaled copy for the 1×/2× combat speed toggle; the tuned table itself never changes. */
export function deathTiming(speed = 1) {
  const factor = speed > 0 ? speed : 1;
  return Object.fromEntries(
    Object.entries(DEATH_TIMING).map(([key, ms]) => [key, Math.round(ms / factor)]),
  );
}

export function deathDurationMs(speed = 1) {
  return Object.values(deathTiming(speed)).reduce((total, ms) => total + ms, 0);
}

export function deathSpecFor(kind, key) {
  const table = kind === 'dog' ? DOG_DEATH : kind === 'cat' ? CAT_DEATH : null;
  return table?.[key] ?? FALLBACK_DEATH;
}
