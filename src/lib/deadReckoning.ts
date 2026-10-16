// src/lib/deadReckoning.ts

const EARTH_RADIUS = 6371000; // meters

/**
 * Calculates shortest angular difference between two headings in degrees (-180 to +180).
 * Prevents awkward 359° -> 1° full spins.
 */
export function shortestAngleDiff(target: number, current: number): number {
  return ((((target - current + 540) % 360) + 360) % 360) - 180;
}

/**
 * Smoothly interpolates an angle towards a target angle using shortest path.
 */
export function interpolateHeading(current: number, target: number, factor: number = 0.15): number {
  const diff = shortestAngleDiff(target, current);
  return (current + diff * factor + 360) % 360;
}

/**
 * Projects an aircraft's geographic coordinates forward in time based on ground speed (velocity)
 * and true track (heading) using great-circle dead reckoning.
 *
 * @param lat Current latitude in degrees
 * @param lon Current longitude in degrees
 * @param velocity Ground speed in meters/second
 * @param heading True track heading in degrees (0=North, 90=East)
 * @param elapsedSeconds Time elapsed since actual position measurement
 * @param maxSeconds Maximum extrapolation limit to prevent drifting off in lost-link scenarios
 */
export function projectCoordinates(
  lat: number,
  lon: number,
  velocity: number | null,
  heading: number | null,
  elapsedSeconds: number,
  maxSeconds: number = 20
): { latitude: number; longitude: number } {
  if (!velocity || velocity <= 0 || heading == null || elapsedSeconds <= 0) {
    return { latitude: lat, longitude: lon };
  }

  // Cap extrapolation time to prevent ungrounded divergence
  const dt = Math.min(Math.max(0, elapsedSeconds), maxSeconds);
  if (dt <= 0) return { latitude: lat, longitude: lon };

  const distance = velocity * dt;
  const headingRad = (heading * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  const deltaLat = (distance * Math.cos(headingRad)) / EARTH_RADIUS;
  const deltaLon = (distance * Math.sin(headingRad)) / (EARTH_RADIUS * Math.cos(latRad) || 1);

  const newLat = lat + (deltaLat * 180) / Math.PI;
  const newLon = lon + (deltaLon * 180) / Math.PI;

  return {
    latitude: Math.max(-85, Math.min(85, newLat)),
    longitude: ((((newLon + 180) % 360) + 360) % 360) - 180,
  };
}

