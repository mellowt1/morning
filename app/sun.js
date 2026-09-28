/* The sun over The Hague, worked out on the device: no request, so it works offline.
 *
 * Loaded in <head> before the stylesheet paints, so a night page is dark from the first
 * frame (no white flash, and a failed weather fetch can no longer turn the night page white).
 * A plain script, no build step: it sets self.MorningSun = { alt, day, dark }.
 * The formula is the low-precision one from the Astronomical Almanac: good to a few
 * hundredths of a degree, so sunrise and sunset land within a minute.
 */
(function (root) {
  'use strict';

  const LAT = 52.08, LON = 4.30, RAD = Math.PI / 180;
  const MIN = 60000, DAY = 86400000;
  const HORIZON = -0.833; // the sun's upper edge on the horizon, with refraction

  /* Altitude of the sun's centre in degrees at the moment ms. */
  function alt(ms) {
    const d = ms / DAY - 10957.5; // days since J2000.0
    const g = (357.529 + 0.98560028 * d) * RAD;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    const e = (23.439 - 0.00000036 * d) * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
    const H = (gmst * 15 + LON) * RAD - ra;
    return Math.asin(Math.sin(LAT * RAD) * Math.sin(dec) + Math.cos(LAT * RAD) * Math.cos(dec) * Math.cos(H)) / RAD;
  }

  /* Sunrise, solar noon, sunset and the noon altitude for the 24 hours from `start` (ms). */
  const days = {};
  function day(start) {
    if (days[start]) return days[start];
    let rise = null, set = null, noon = start, max = -90, prev = alt(start);
    for (let i = 1; i <= 1440; i++) {
      const t = start + i * MIN, a = alt(t);
      if (a > max) { max = a; noon = t; }
      if (rise === null && prev < HORIZON && a >= HORIZON) rise = t - MIN + MIN * ((HORIZON - prev) / (a - prev));
      if (set === null && prev >= HORIZON && a < HORIZON) set = t - MIN + MIN * ((prev - HORIZON) / (prev - a));
      prev = a;
    }
    return (days[start] = { rise, set, noon, max });
  }

  const dark = (ms) => alt(ms) < HORIZON;

  root.MorningSun = { alt, day, dark, HORIZON };

  // Before the first paint: the theme follows the sun and nothing else.
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.theme = dark(Date.now()) ? 'dark' : 'light';
  }
})(typeof self !== 'undefined' ? self : globalThis);
