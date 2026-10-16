export type AircraftCategory = 'light' | 'airliner' | 'heavy' | 'helicopter';

/** One state vector returned by the OpenSky `/states/all` endpoint. */
export type RawStateVector = [
  icao24: string,
  callsign: string | null,
  originCountry: string,
  timePosition: number | null,
  lastContact: number,
  longitude: number | null,
  latitude: number | null,
  baroAltitude: number | null,
  onGround: boolean,
  velocity: number | null,
  heading: number | null,
  verticalRate: number | null,
  sensors: number[] | null,
  geoAltitude: number | null,
  squawk: string | null,
  spi: boolean,
  positionSource: number,
  category?: number,
];

/** Normalized aircraft fields used by the application. */
export interface Aircraft {
  icao24: string;
  callsign: string;
  originCountry: string;
  timePosition: number | null;
  lastContact: number;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;
  geoAltitude: number | null;
  squawk: string | null;
  positionSource: number;
  category: AircraftCategory;
}
