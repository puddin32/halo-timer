/*
 * Halo: Combat Evolved respawn-timer presets.
 *
 * Respawn intervals below are seeded with standard competitive values and
 * should be calibrated against the reference APK. Every field is editable
 * in-app (the pencil button on a card) and changes persist to local storage.
 *
 *   name       - label shown on the card and spoken in callouts
 *   interval   - respawn time in seconds
 *   thresholds - seconds-remaining marks at which a callout is spoken
 *   autoRepeat - re-arm the timer automatically after it fires
 */
const HALO_CE_PRESETS = [
  { name: 'Rockets',     interval: 60,  thresholds: [30, 10, 5], autoRepeat: false },
  { name: 'Sniper',      interval: 30,  thresholds: [10, 5],     autoRepeat: false },
  { name: 'Overshield',  interval: 120, thresholds: [30, 10, 5], autoRepeat: false },
  { name: 'Active Camo', interval: 120, thresholds: [30, 10, 5], autoRepeat: false },
];
