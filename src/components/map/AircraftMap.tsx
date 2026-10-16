// src/components/map/AircraftMap.tsx
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
// @ts-ignore -- the bundler resolves this CSS asset, but TypeScript may not have declarations for it.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

// Free dark theme basemap that requires no API keys
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function AircraftMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { selectAircraft } = useAircraftStore();

  useEffect(() => {
    if (map.current || !mapContainer.current) return; // Initialize map only once

    // 1. Initialize MapLibre
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [79.1325, 12.9692], // Defaulting near Vellore for testing
      zoom: 5,
      pitch: 0,
      antialias: true,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', async () => {
      if (!map.current) return;

      // 2. Draw the aircraft icon locally so the map doesn't depend on an
      // external SVG being reachable and decodable by the browser.
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 64;
      iconCanvas.height = 64;
      const context = iconCanvas.getContext('2d');
      if (!context) return;

      context.fillStyle = '#fff';
      context.beginPath();
      context.moveTo(32, 3);  // nose
      context.lineTo(38, 25);
      context.lineTo(58, 37);
      context.lineTo(58, 43);
      context.lineTo(38, 38);
      context.lineTo(36, 55);
      context.lineTo(43, 60);
      context.lineTo(43, 63);
      context.lineTo(32, 60);
      context.lineTo(21, 63);
      context.lineTo(21, 60);
      context.lineTo(28, 55);
      context.lineTo(26, 38);
      context.lineTo(6, 43);
      context.lineTo(6, 37);
      context.lineTo(26, 25);
      context.closePath();
      context.fill();

      map.current.addImage('plane-icon', context.getImageData(0, 0, 64, 64), { sdf: true });

      // 3. Add the GeoJSON Source (empty initially)
      map.current.addSource('aircraft-data', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // 4. Add the Symbol Layer
      map.current.addLayer({
        id: 'aircraft-layer',
        type: 'symbol',
        source: 'aircraft-data',
        layout: {
          'icon-image': 'plane-icon',
          'icon-size': 0.05,
          'icon-rotate': ['get', 'heading'], // Rotates the icon based on true_track
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          // Dynamic coloring based on status (matching our tailwind config)
          'icon-color': [
            'match',
            ['get', 'status'],
            'live', '#FFCB70',    // cc.accent (VIT Goldenrod)
            'aging', '#F59E0B',   // status.aging
            'stale', '#F97316',   // status.stale
            /* default */ '#64748B' 
          ]
        }
      });

      // 5. Handle Click Events for Selection
      map.current.on('click', 'aircraft-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const clickedId = e.features[0].properties.icao24;
          selectAircraft(clickedId);
        }
      });

      // Change cursor to pointer when hovering over a plane
      map.current.on('mouseenter', 'aircraft-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'aircraft-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [selectAircraft]);

  // 6. Subscribe to Zustand store changes outside of the React render cycle
  // This is the performance secret: it updates WebGL without triggering React component re-renders
  useEffect(() => {
    return useAircraftStore.subscribe((state) => {
      if (!map.current || !map.current.isStyleLoaded()) return;

      const source = map.current.getSource('aircraft-data') as maplibregl.GeoJSONSource;
      if (!source) return;

      // Convert our Aircraft dictionary into a GeoJSON FeatureCollection
      const features: GeoJSON.Feature[] = Object.values(state.aircraft)
        .filter(plane => plane.longitude && plane.latitude) // Only map planes with coordinates
        .map(plane => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [plane.longitude, plane.latitude]
          },
          properties: {
            icao24: plane.icao24,
            heading: plane.heading || 0,
            status: plane.status
          }
        }));

      source.setData({
        type: 'FeatureCollection',
        features
      });
    });
  }, []);

  return <div ref={mapContainer} className="aircraft-map-container" />;
}
