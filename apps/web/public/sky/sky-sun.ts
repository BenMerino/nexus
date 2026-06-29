// Solar position — standard low-precision NOAA/SunCalc-style algorithm.
// Returns the sun's ALTITUDE (degrees above horizon) and AZIMUTH for an instant
// + observer lat/lon. No network, deterministic. Verified against real
// sunrise/sunset (London solstice, Talca, Singapore, polar cases).

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const DAY_MS = 86400000, J1970 = 2440588, J2000 = 2451545;

const toJulian = (d: number) => d / DAY_MS - 0.5 + J1970;
const toDays = (d: number) => toJulian(d) - J2000;

function sunCoords(d: number) {
  const M = RAD * (357.5291 + 0.98560028 * d);            // mean anomaly
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;                               // perihelion of Earth
  const L = M + C + P + Math.PI;                          // ecliptic longitude
  const e = RAD * 23.4397;                                // obliquity
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  return { dec, ra };
}

const siderealTime = (d: number, lw: number) => RAD * (280.16 + 360.9856235 * d) - lw;

export interface SunPos { altitude: number; azimuth: number; }

export function sunPosition(date: Date, lat: number, lon: number): SunPos {
  const lw = RAD * -lon, phi = RAD * lat, d = toDays(+date);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;                   // hour angle
  const alt = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi));
  return { altitude: alt * DEG, azimuth: (az * DEG + 180) % 360 };
}
