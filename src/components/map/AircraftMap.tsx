// src/components/map/AircraftMap.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
// @ts-ignore -- bundler resolves CSS asset
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAircraftStore } from '../../lib/state/useAircraftStore';
import { interpolateHeading, projectCoordinates } from '../../lib/deadReckoning';
import { registerAircraftSdfIcons } from '../../lib/aircraftIcons';
import type { TrackedAircraft } from '../../lib/state/types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * Altitude color gradient mapping:
 * Ground: Slate grey
 * Low (0 - 1500m): Warm orange
 * Low-Mid (1500 - 4500m): Golden yellow
 * Mid (4500 - 8500m): Electric cyan
 * High (8500 - 11000m): Sky/Indigo
 * Ultra High (> 11000m): Cool violet
 * Emergency: Flash red
 */
export function getAltitudeColor(
  altitudeMeters: number | null,
  onGround: boolean,
  isEmergency?: boolean
): string {
  if (isEmergency) return '#ef4444';
  if (onGround) return '#64748b';
  if (altitudeMeters == null) return '#22d3ee';
  if (altitudeMeters <= 1500) return '#fb923c'; // Warm orange
  if (altitudeMeters <= 4500) return '#facc15'; // Golden yellow
  if (altitudeMeters <= 8500) return '#22d3ee'; // Electric cyan
  if (altitudeMeters <= 11000) return '#818cf8'; // Sky / Indigo
  return '#a78bfa'; // Cool violet
}

/**
 * Calculates a 60-second forward velocity vector end point.
 */
function getVelocityVectorCoord(
  lat: number,
  lon: number,
  velocity: number | null,
  heading: number | null,
  seconds = 60
): [number, number] | null {
  if (!velocity || velocity <= 5 || heading == null) return null;
  const projected = projectCoordinates(lat, lon, velocity, heading, seconds, 90);
  return [projected.longitude, projected.latitude];
}

/**
 * Returns climb/descent arrow symbol for ATC data block.
 */
function getVerticalRateSymbol(vrate: number | null): string {
  if (vrate == null || Math.abs(vrate) < 1.2) return '→';
  return vrate > 1.2 ? '↑' : '↓';
}

function generateRangeRings(center: [number, number], radiiNm = [25, 50, 100, 150]) {
  const [centerLon, centerLat] = center;
  const features: GeoJSON.Feature[] = [];

  radiiNm.forEach((nm) => {
    const km = nm * 1.852;
    const points: [number, number][] = [];
    const steps = 64;

    for (let i = 0; i <= steps; i++) {
      const angle = (i * 2 * Math.PI) / steps;
      const dx = (km * Math.sin(angle)) / (111.32 * Math.cos((centerLat * Math.PI) / 180));
      const dy = (km * Math.cos(angle)) / 110.574;
      points.push([centerLon + dx, centerLat + dy]);
    }

    features.push({
      type: 'Feature',
      properties: { radiusNm: `${nm} NM` },
      geometry: { type: 'LineString', coordinates: points },
    });
  });

  return features;
}

export default function AircraftMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const selectedId = useAircraftStore((state) => state.selectedId);
  const hoveredId = useAircraftStore((state) => state.hoveredId);
  const setHoveredId = useAircraftStore((state) => state.setHoveredId);
  const chaseCameraId = useAircraftStore((state) => state.chaseCameraId);
  const viewMode = useAircraftStore((state) => state.viewMode);
  const activeSector = useAircraftStore((state) => state.activeSector);
  const radarSweepEnabled = useAircraftStore((state) => state.radarSweepEnabled);
  const densityHeatmapEnabled = useAircraftStore((state) => state.densityHeatmapEnabled);
  const rangeRingsEnabled = useAircraftStore((state) => state.rangeRingsEnabled);

  // Hover Tooltip Position & Data state
  const [tooltipData, setTooltipData] = useState<{
    plane: TrackedAircraft;
    x: number;
    y: number;
  } | null>(null);

  // Live dynamic coordinate interpolation store for dead reckoning & smooth transitions
  const currentRenderPositions = useRef<
    Record<
      string,
      {
        lon: number;
        lat: number;
        heading: number;
        targetLon: number;
        targetLat: number;
        targetHeading: number;
        displayAltitude: number;
        lastUpdate: number;
        velocity: number;
        spawnTime: number; // for staggered entry ripple
        opacity: number;
      }
    >
  >({});

  // 1. Initialize MapLibre
  useEffect(() => {
    if (mapInstance.current || !mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: activeSector.center,
      zoom: activeSector.zoom,
      pitch: viewMode === '3d' ? 60 : 0,
      bearing: viewMode === '3d' ? -15 : 0,
      antialias: true,
      maxPitch: 80,
    });
    mapInstance.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      // 1.1 Register 4-Category SDF Icons (airliner, heavy, light, helicopter)
      registerAircraftSdfIcons(map);

      // 1.2 Custom Tint Palette for Night Operations
      try {
        for (const layer of map.getStyle().layers) {
          const name = `${layer.id} ${'source-layer' in layer ? layer['source-layer'] : ''}`.toLowerCase();
          if (layer.type === 'background') {
            map.setPaintProperty(layer.id, 'background-color', '#070b14');
          } else if (layer.type === 'fill' && /(water|ocean|lake|river)/.test(name)) {
            map.setPaintProperty(layer.id, 'fill-color', '#0b1626');
          } else if (layer.type === 'fill' && /(land|earth|park|landcover)/.test(name)) {
            map.setPaintProperty(layer.id, 'fill-color', '#0c1524');
          } else if (layer.type === 'line' && /(boundary|admin_0|admin-0|country.border)/.test(name)) {
            map.setPaintProperty(layer.id, 'line-color', '#1e3853');
            map.setPaintProperty(layer.id, 'line-width', 0.8);
          } else if (layer.type === 'line' && /(road|highway|transport)/.test(name)) {
            map.setPaintProperty(layer.id, 'line-color', '#13283e');
            map.setPaintProperty(layer.id, 'line-opacity', 0.4);
          }
        }
      } catch (err) {
        console.warn('Style paint property override notice:', err);
      }

      // 1.3 Radar Graticule Grid
      const gridFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        gridFeatures.push({
          type: 'Feature',
          properties: { axis: 'longitude' },
          geometry: { type: 'LineString', coordinates: [[lon, -80], [lon, 80]] },
        });
      }
      for (let lat = -80; lat <= 80; lat += 5) {
        gridFeatures.push({
          type: 'Feature',
          properties: { axis: 'latitude' },
          geometry: { type: 'LineString', coordinates: [[-180, lat], [180, lat]] },
        });
      }
      map.addSource('radar-graticule', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: gridFeatures },
      });
      map.addLayer({
        id: 'radar-graticule-lines',
        type: 'line',
        source: 'radar-graticule',
        paint: {
          'line-color': '#22d3ee',
          'line-opacity': 0.08,
          'line-width': 0.7,
          'line-dasharray': [2, 3],
        },
      });

      // 1.4 Range Rings Layer
      map.addSource('range-rings-data', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: generateRangeRings(activeSector.center) },
      });
      map.addLayer({
        id: 'range-rings-line',
        type: 'line',
        source: 'range-rings-data',
        paint: {
          'line-color': '#22d3ee',
          'line-opacity': 0.22,
          'line-width': 1.1,
          'line-dasharray': [4, 4],
        },
      });

      // 1.5 Density Heatmap Layer
      map.addSource('aircraft-density', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-heat',
        type: 'heatmap',
        source: 'aircraft-density',
        layout: {
          visibility: densityHeatmapEnabled ? 'visible' : 'none',
        },
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': 1.2,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(7, 11, 20, 0)',
            0.2, 'rgba(34, 211, 238, 0.2)',
            0.5, 'rgba(56, 189, 248, 0.45)',
            0.8, 'rgba(168, 85, 247, 0.7)',
            1.0, 'rgba(239, 68, 68, 0.85)',
          ],
          'heatmap-radius': 35,
          'heatmap-opacity': 0.75,
        },
      });

      // ==========================================
      // LAYER STACK (BOTTOM TO TOP)
      // ==========================================

      // Layer 1: Trails Layer (Fading line gradient by altitude)
      map.addSource('aircraft-trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-trail-lines',
        type: 'line',
        source: 'aircraft-trails',
        paint: {
          'line-color': ['get', 'color'],
          'line-opacity': ['get', 'opacity'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 12, 2.2],
        },
      });

      // Layer 2: Shadows Layer (Offset down-right proportional to altitude)
      map.addSource('aircraft-shadows', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-shadow-symbols',
        type: 'symbol',
        source: 'aircraft-shadows',
        layout: {
          'icon-image': ['get', 'iconImage'],
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 0.2,
            8, 0.42,
            12, 0.8,
          ],
          'icon-offset': ['get', 'shadowOffset'],
        },
        paint: {
          'icon-color': '#000000',
          'icon-opacity': ['get', 'shadowOpacity'],
        },
      });

      // Layer 3: Altitude Stems (3D Mode)
      map.addSource('altitude-stems', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'altitude-stem-lines',
        type: 'line',
        source: 'altitude-stems',
        paint: {
          'line-color': ['get', 'color'],
          'line-opacity': 0.65,
          'line-width': 1.2,
          'line-dasharray': [1, 2],
        },
      });
      map.addLayer({
        id: 'ground-shadow-dots',
        type: 'circle',
        source: 'altitude-stems',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 3.5,
          'circle-color': '#000000',
          'circle-opacity': 0.75,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': ['get', 'color'],
        },
      });

      // Layer 4: Glow Layer (Only for Selected, Hovered, or Emergency)
      map.addSource('aircraft-glows', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-glow-circles',
        type: 'circle',
        source: 'aircraft-glows',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 10,
            8, 16,
            12, 26,
          ],
          'circle-color': ['get', 'glowColor'],
          'circle-opacity': ['get', 'glowOpacity'],
          'circle-blur': 0.8,
        },
      });

      // Layer 5: Velocity Vectors (60s forward prediction line)
      map.addSource('aircraft-velocity-vectors', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'velocity-vector-lines',
        type: 'line',
        source: 'aircraft-velocity-vectors',
        minzoom: 7.2,
        paint: {
          'line-color': ['get', 'color'],
          'line-opacity': 0.6,
          'line-width': 1.2,
          'line-dasharray': [2, 2],
        },
      });

      // Layer 6: Distant Soft Glowing Dots (Zoom < 5 LOD)
      map.addSource('aircraft-dots-data', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-dots',
        type: 'circle',
        source: 'aircraft-dots-data',
        maxzoom: 5.5,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, 2.5,
            5, 4.5,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.4,
        },
      });

      // Layer 7: Main Aircraft Symbol Layer (SDF Icons with Altitude Gradient & Dark Halo)
      map.addSource('aircraft-live-data', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-symbols',
        type: 'symbol',
        source: 'aircraft-live-data',
        minzoom: 4.5,
        layout: {
          'icon-image': ['get', 'iconImage'],
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4.5, ['*', ['get', 'sizeFactor'], 0.24],
            8, ['*', ['get', 'sizeFactor'], 0.48],
            12, ['*', ['get', 'sizeFactor'], 0.88],
          ],
          'symbol-sort-key': ['get', 'priority'],
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-halo-color': 'rgba(0, 0, 0, 0.85)',
          'icon-halo-width': 1.5,
          'icon-halo-blur': 0.5,
          'icon-opacity': ['get', 'opacity'],
        },
      });

      // Layer 8: Leader Lines (Connects aircraft to ATC Data Blocks at zoom >= 8.5)
      map.addSource('aircraft-leader-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-leader-lines-layer',
        type: 'line',
        source: 'aircraft-leader-lines',
        minzoom: 8.5,
        paint: {
          'line-color': ['get', 'color'],
          'line-opacity': 0.5,
          'line-width': 1.0,
        },
      });

      // Layer 9: ATC-Style Data Blocks (Collision-handled 2-line labels)
      map.addLayer({
        id: 'aircraft-atc-data-blocks',
        type: 'symbol',
        source: 'aircraft-live-data',
        minzoom: 7.8,
        layout: {
          'text-field': ['get', 'atcLabel'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7.8, 9,
            12, 11,
          ],
          'text-offset': [1.8, -1.2],
          'text-anchor': 'bottom-left',
          'text-justify': 'left',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'symbol-sort-key': ['get', 'priority'],
        },
        paint: {
          'text-color': ['get', 'labelColor'],
          'text-halo-color': '#070b14',
          'text-halo-width': 2,
          'text-halo-blur': 0.5,
          'text-opacity': ['get', 'labelOpacity'],
        },
      });

      // Layer 10: Selection Reticle (Pulsing ring & rotating dashed circle)
      map.addSource('selection-ring', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'selection-ring-circle',
        type: 'circle',
        source: 'selection-ring',
        paint: {
          'circle-radius': 22,
          'circle-color': 'rgba(34, 211, 238, 0.08)',
          'circle-stroke-color': '#22d3ee',
          'circle-stroke-width': 1.8,
        },
      });

      // Layer 11: Emergency Shockwave Ripple
      map.addSource('emergency-ripples', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'emergency-ripple-circles',
        type: 'circle',
        source: 'emergency-ripples',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': 'rgba(239, 68, 68, 0.12)',
          'circle-stroke-color': '#ef4444',
          'circle-stroke-width': 2,
        },
      });

      // 1.12 Click & Hover Event Handlers
      map.on('click', 'aircraft-symbols', (e) => {
        if (e.features && e.features.length > 0) {
          const clickedIcao = e.features[0].properties?.icao24;
          if (clickedIcao) {
            selectAircraft(clickedIcao);
          }
        }
      });

      map.on('mousemove', 'aircraft-symbols', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features.length > 0) {
          const icao = e.features[0].properties?.icao24;
          if (icao) {
            setHoveredId(icao);
            const plane = useAircraftStore.getState().aircraft[icao];
            if (plane) {
              setTooltipData({
                plane,
                x: e.point.x,
                y: e.point.y,
              });
            }
          }
        }
      });

      map.on('mouseleave', 'aircraft-symbols', () => {
        map.getCanvas().style.cursor = '';
        setHoveredId(null);
        setTooltipData(null);
      });
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectAircraft, setHoveredId]);

  // 2. Camera View Mode Switch (2D / 3D Tilt / Globe)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (viewMode === '2d') {
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1200,
        easing: (t) => t * (2 - t),
      });
    } else if (viewMode === '3d') {
      map.easeTo({
        pitch: 60,
        bearing: -15,
        duration: 1400,
        easing: (t) => t * (2 - t),
      });
    } else if (viewMode === 'globe') {
      map.easeTo({
        pitch: 35,
        zoom: Math.max(1.8, activeSector.zoom - 2.8),
        duration: 1600,
        easing: (t) => t * (2 - t),
      });
    }
  }, [viewMode, activeSector.zoom]);

  // 3. Handle Sector Transitions
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    map.flyTo({
      center: activeSector.center,
      zoom: activeSector.zoom,
      duration: 1800,
      essential: true,
    });

    const ringsSource = map.getSource('range-rings-data') as maplibregl.GeoJSONSource;
    if (ringsSource) {
      ringsSource.setData({
        type: 'FeatureCollection',
        features: generateRangeRings(activeSector.center),
      });
    }
  }, [activeSector]);

  // 4. Overlays Toggle Visibility
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('aircraft-heat')) return;
    map.setLayoutProperty('aircraft-heat', 'visibility', densityHeatmapEnabled ? 'visible' : 'none');
  }, [densityHeatmapEnabled]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('range-rings-line')) return;
    map.setLayoutProperty('range-rings-line', 'visibility', rangeRingsEnabled ? 'visible' : 'none');
  }, [rangeRingsEnabled]);

  // 5. Chase Camera Follow
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !selectedId) return;

    const plane = useAircraftStore.getState().aircraft[selectedId];
    if (plane && Number.isFinite(plane.longitude) && Number.isFinite(plane.latitude)) {
      map.flyTo({
        center: [plane.longitude, plane.latitude],
        zoom: Math.max(map.getZoom(), 7.2),
        duration: 1200,
      });
    }
  }, [selectedId]);

  // 6. WebGL 60 FPS Dead Reckoning & Progressive LOD Animation Loop
  useEffect(() => {
    let animId: number;
    let lastFrameTime = performance.now();
    let emergencyRippleRadius = 15;

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;

      emergencyRippleRadius = 15 + ((now / 40) % 45);

      const map = mapInstance.current;
      if (!map || !map.isStyleLoaded()) return;

      const currentZoom = map.getZoom();
      const store = useAircraftStore.getState();
      const aircraftDict = store.aircraft;
      const filters = store.filters;
      const selected = store.selectedId;
      const hovered = store.hoveredId;
      const is3D = store.viewMode === '3d';
      const sectorCenter = store.activeSector.center;

      // Batched GeoJSON Feature Collections
      const symbolFeatures: GeoJSON.Feature[] = [];
      const dotFeatures: GeoJSON.Feature[] = [];
      const shadowFeatures: GeoJSON.Feature[] = [];
      const trailFeatures: GeoJSON.Feature[] = [];
      const stemFeatures: GeoJSON.Feature[] = [];
      const glowFeatures: GeoJSON.Feature[] = [];
      const vectorFeatures: GeoJSON.Feature[] = [];
      const leaderFeatures: GeoJSON.Feature[] = [];
      const selectionFeatures: GeoJSON.Feature[] = [];
      const emergencyFeatures: GeoJSON.Feature[] = [];
      const heatFeatures: GeoJSON.Feature[] = [];

      const renderPositions = currentRenderPositions.current;

      for (const icao in aircraftDict) {
        const plane = aircraftDict[icao];
        if (!Number.isFinite(plane.longitude) || !Number.isFinite(plane.latitude)) continue;

        // Ground aircraft filter check
        if (plane.onGround && !filters.showGroundAircraft) continue;

        // Spatial Context Filter (Ghost State instead of deletion)
        let isFilteredOut = false;
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          const matches =
            plane.callsign.toLowerCase().includes(q) ||
            plane.icao24.toLowerCase().includes(q) ||
            plane.originCountry.toLowerCase().includes(q);
          if (!matches) isFilteredOut = true;
        }
        if (filters.airborneOnly && plane.onGround) isFilteredOut = true;
        const alt = plane.baroAltitude || 0;
        if (alt < filters.minAltitude || alt > filters.maxAltitude) isFilteredOut = true;
        const speedKmh = (plane.velocity || 0) * 3.6;
        if (speedKmh < filters.minSpeed) isFilteredOut = true;

        // Initialize render position if new contact
        if (!renderPositions[icao]) {
          // Staggered ripple appearance calculation based on distance from sector center
          const distFromCenter = Math.hypot(plane.longitude - sectorCenter[0], plane.latitude - sectorCenter[1]);
          const spawnDelayMs = Math.min(1200, distFromCenter * 80);

          renderPositions[icao] = {
            lon: plane.longitude,
            lat: plane.latitude,
            heading: plane.heading || 0,
            targetLon: plane.longitude,
            targetLat: plane.latitude,
            targetHeading: plane.heading || 0,
            displayAltitude: plane.baroAltitude || 0,
            lastUpdate: now,
            velocity: plane.velocity || 0,
            spawnTime: now + spawnDelayMs,
            opacity: 0,
          };
        }

        const rp = renderPositions[icao];
        rp.targetLon = plane.longitude;
        rp.targetLat = plane.latitude;
        rp.targetHeading = plane.heading || 0;
        rp.velocity = plane.velocity || 0;

        // Staggered Entry Fade-in
        if (now < rp.spawnTime) continue;
        const ageSinceSpawn = (now - rp.spawnTime) / 400; // 400ms fade in
        rp.opacity = Math.min(1, ageSinceSpawn);

        // Smooth Altitude Transition for gradual color shifting
        if (plane.baroAltitude != null) {
          rp.displayAltitude += (plane.baroAltitude - rp.displayAltitude) * 0.08;
        }

        // Dead reckoning: continuous coordinate glide
        if (rp.velocity > 5 && rp.targetHeading != null) {
          const projected = projectCoordinates(
            rp.lat,
            rp.lon,
            rp.velocity,
            rp.targetHeading,
            dt,
            20
          );
          rp.lat = projected.latitude;
          rp.lon = projected.longitude;
        } else {
          rp.lat += (rp.targetLat - rp.lat) * 0.14;
          rp.lon += (rp.targetLon - rp.lon) * 0.14;
        }

        // Shortest-path angle lerp
        rp.heading = interpolateHeading(rp.heading, rp.targetHeading, 0.15);

        const isPlaneSelected = selected === icao;
        const isPlaneHovered = hovered === icao;
        const isEmergency = Boolean(plane.isEmergency || plane.squawk === '7700');

        // Color based on smoothly transitioning altitude
        const color = getAltitudeColor(rp.displayAltitude, plane.onGround, isEmergency);

        // Opacity & Freshness: Dim non-selected planes to 40% when a selection exists
        let finalOpacity = plane.status === 'live' ? 1.0 : plane.status === 'aging' ? 0.85 : plane.status === 'stale' ? 0.6 : 0.35;
        if (selected && !isPlaneSelected) {
          finalOpacity *= 0.4;
        }
        if (isFilteredOut) {
          finalOpacity = 0.12;
        }
        finalOpacity *= rp.opacity;

        // Size factor by category and interaction state
        let sizeFactor = plane.category === 'heavy' ? 1.15 : plane.category === 'light' ? 0.85 : 1.0;
        if (plane.onGround) sizeFactor *= 0.7;
        if (isPlaneSelected || isPlaneHovered) sizeFactor *= 1.25;

        // Priority for collision sorting (Selected & Emergency always win)
        const priority = isPlaneSelected ? 0 : isEmergency ? 1 : plane.onGround ? 3 : 2;

        const callsignStr = plane.callsign.trim() || plane.icao24.toUpperCase();
        const vRateSymbol = getVerticalRateSymbol(plane.verticalRate);
        const flStr = plane.baroAltitude ? `FL${Math.round((plane.baroAltitude * 3.28084) / 100)}` : 'GND';
        const speedKts = plane.velocity != null ? `${Math.round(plane.velocity * 1.94384)}kt` : '';

        // ATC Data Block formatted string
        const atcLabel = currentZoom >= 11
          ? `${callsignStr} ${vRateSymbol}\n${flStr} ${speedKts}`
          : `${callsignStr} ${vRateSymbol}`;

        const iconImage = `plane-${plane.category || 'airliner'}`;

        // 1. Symbol Layer Feature
        symbolFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [rp.lon, rp.lat] },
          properties: {
            icao24: plane.icao24,
            heading: rp.heading,
            color,
            opacity: finalOpacity,
            iconImage,
            sizeFactor,
            priority,
            atcLabel: isFilteredOut ? '' : atcLabel,
            labelColor: isEmergency ? '#ef4444' : '#e2e8f0',
            labelOpacity: isFilteredOut ? 0 : isPlaneSelected ? 1 : currentZoom >= 8 ? finalOpacity : 0,
          },
        });

        // 2. Distant Soft Glowing Dot Feature (Zoom < 5)
        dotFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [rp.lon, rp.lat] },
          properties: {
            color,
            opacity: finalOpacity,
          },
        });

        // 3. Shadow Layer Feature (Offset down-right by altitude)
        const shadowOffsetDistance = Math.min(8, Math.max(1, (rp.displayAltitude / 12000) * 8));
        shadowFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [rp.lon, rp.lat] },
          properties: {
            iconImage,
            heading: rp.heading,
            shadowOffset: [shadowOffsetDistance, shadowOffsetDistance],
            shadowOpacity: plane.onGround ? 0 : Math.min(0.28, finalOpacity * 0.3),
          },
        });

        // 4. Glow Feature (Only for selected, hovered, or emergency)
        if (isPlaneSelected || isPlaneHovered || isEmergency) {
          const idleShimmer = 0.75 + Math.sin(now / 200) * 0.15;
          glowFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [rp.lon, rp.lat] },
            properties: {
              glowColor: isEmergency ? '#ef4444' : '#22d3ee',
              glowOpacity: isEmergency ? idleShimmer : 0.8,
            },
          });
        }

        // 5. 60-Second Velocity Vector Feature (Zoom >= 7.5)
        if (currentZoom >= 7.2 && !plane.onGround && rp.velocity > 5) {
          const vectorEnd = getVelocityVectorCoord(rp.lat, rp.lon, rp.velocity, rp.heading, 60);
          if (vectorEnd) {
            vectorFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [[rp.lon, rp.lat], vectorEnd],
              },
              properties: { color },
            });
          }
        }

        // 6. Leader Line Feature (Connects aircraft to ATC Data Block at zoom >= 8.5)
        if (currentZoom >= 8.5 && !isFilteredOut) {
          // Calculated offset for leader line endpoint
          const leaderEnd: [number, number] = [rp.lon + 0.04, rp.lat + 0.03];
          leaderFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[rp.lon, rp.lat], leaderEnd],
            },
            properties: { color },
          });
        }

        // 7. Selection Reticle
        if (isPlaneSelected) {
          selectionFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [rp.lon, rp.lat] },
            properties: {},
          });
        }

        // 8. Emergency Ripple Feature
        if (isEmergency) {
          emergencyFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [rp.lon, rp.lat] },
            properties: { radius: emergencyRippleRadius },
          });
        }

        // 9. 3D Altitude Stems
        if (is3D && !plane.onGround && rp.displayAltitude > 100) {
          const altOffset = Math.min(0.85, (rp.displayAltitude / 12000) * 0.45);
          const topCoord: [number, number] = [rp.lon, rp.lat + altOffset];
          const groundCoord: [number, number] = [rp.lon, rp.lat];

          stemFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [groundCoord, topCoord] },
            properties: { color },
          });

          stemFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: groundCoord },
            properties: { color },
          });
        }

        // 10. Trails Feature (Faint for all at close zoom, full for selected)
        if (plane.history && plane.history.length > 1) {
          const shouldShowTrail = isPlaneSelected || currentZoom >= 11;
          if (shouldShowTrail) {
            const trailCoords = plane.history
              .filter((h) => Number.isFinite(h.longitude) && Number.isFinite(h.latitude))
              .map((h) => [h.longitude, h.latitude]);

            if (trailCoords.length > 1) {
              trailFeatures.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: trailCoords },
                properties: {
                  color,
                  opacity: isPlaneSelected ? 0.9 : 0.25,
                },
              });
            }
          }
        }

        // 11. Heatmap Feature
        heatFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [rp.lon, rp.lat] },
          properties: {},
        });
      }

      // Single batched GeoJSON update per frame
      (map.getSource('aircraft-live-data') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: symbolFeatures,
      });

      (map.getSource('aircraft-dots-data') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: dotFeatures,
      });

      (map.getSource('aircraft-shadows') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: shadowFeatures,
      });

      (map.getSource('aircraft-glows') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: glowFeatures,
      });

      (map.getSource('aircraft-velocity-vectors') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: vectorFeatures,
      });

      (map.getSource('aircraft-leader-lines') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: leaderFeatures,
      });

      (map.getSource('aircraft-trails') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: trailFeatures,
      });

      (map.getSource('altitude-stems') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: stemFeatures,
      });

      (map.getSource('selection-ring') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: selectionFeatures,
      });

      (map.getSource('emergency-ripples') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: emergencyFeatures,
      });

      if (densityHeatmapEnabled) {
        (map.getSource('aircraft-density') as maplibregl.GeoJSONSource)?.setData({
          type: 'FeatureCollection',
          features: heatFeatures,
        });
      }

      // Smooth Chase Camera Easing
      if (chaseCameraId && renderPositions[chaseCameraId]) {
        const cp = renderPositions[chaseCameraId];
        map.easeTo({
          center: [cp.lon, cp.lat],
          duration: 100,
          essential: false,
        });
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [chaseCameraId, densityHeatmapEnabled]);

  return (
    <div className="map-wrapper-layer">
      <div ref={mapContainer} className="aircraft-map-container" />

      {/* Atmospheric Rotating Radar Sweep Overlay */}
      {radarSweepEnabled && <div className="radar-sweep-beam-overlay" aria-hidden="true" />}

      {/* Interactive Hover Tooltip Card */}
      {tooltipData && (
        <AircraftHoverCard
          plane={tooltipData.plane}
          x={tooltipData.x}
          y={tooltipData.y}
        />
      )}

      {/* Emergency Squawk Screen-Edge Alert */}
      <EmergencyVignetteAlert />
    </div>
  );
}

// Interactive Hover Card for detailed progressive disclosure
function AircraftHoverCard({
  plane,
  x,
  y,
}: {
  plane: TrackedAircraft;
  x: number;
  y: number;
}) {
  const alt = plane.baroAltitude;
  const speedKmh = plane.velocity != null ? Math.round(plane.velocity * 3.6) : null;
  const speedKts = plane.velocity != null ? Math.round(plane.velocity * 1.94384) : null;
  const flStr = alt ? `FL${Math.round((alt * 3.28084) / 100)} (${Math.round(alt).toLocaleString()}m)` : 'GROUND';

  return (
    <div
      className="aircraft-hover-tooltip radar-glass-panel"
      style={{
        left: `${x + 18}px`,
        top: `${y - 20}px`,
      }}
    >
      <div className="hover-tooltip-head">
        <span className="hover-tooltip-callsign font-mono">
          {plane.callsign.trim() || plane.icao24.toUpperCase()}
        </span>
        <span className="hover-tooltip-category font-mono">
          {(plane.category || 'airliner').toUpperCase()}
        </span>
      </div>

      <div className="hover-tooltip-body font-mono">
        <div><span>ALT:</span> <b>{flStr}</b></div>
        <div><span>SPEED:</span> <b>{speedKmh ? `${speedKmh} km/h (${speedKts} kts)` : '—'}</b></div>
        <div><span>HEADING:</span> <b>{plane.heading != null ? `${Math.round(plane.heading)}°` : '—'}</b></div>
        <div><span>ORIGIN:</span> <b>{plane.originCountry || 'International'}</b></div>
      </div>
    </div>
  );
}

// Emergency Squawk 7700 Vignette Alert
function EmergencyVignetteAlert() {
  const chaos = useAircraftStore((state) => state.chaos);
  const aircraft = useAircraftStore((state) => state.aircraft);

  const hasEmergency =
    chaos.forceEmergencySquawk ||
    Object.values(aircraft).some((a) => a.isEmergency || a.squawk === '7700');

  if (!hasEmergency) return null;

  return (
    <div className="emergency-vignette-flash" role="alert" aria-live="assertive">
      <div className="emergency-banner-top">
        <span className="emergency-dot animate-ping" />
        <span>MAYDAY / SQUAWK 7700 BROADCAST DETECTED IN SECTOR</span>
      </div>
    </div>
  );
}
