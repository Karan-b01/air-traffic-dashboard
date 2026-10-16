// src/components/landing/GlobeHero.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface GlobeHeroProps {
  onTransitionComplete?: () => void;
  isZoomingIn?: boolean;
}

// Major airport coordinates (lat, lon)
const AIRPORT_HUBS = [
  { code: 'DEL', name: 'Delhi', lat: 28.556, lon: 77.1 },
  { code: 'BLR', name: 'Bengaluru', lat: 13.198, lon: 77.706 },
  { code: 'BOM', name: 'Mumbai', lat: 19.089, lon: 72.868 },
  { code: 'DXB', name: 'Dubai', lat: 25.253, lon: 55.365 },
  { code: 'LHR', name: 'London', lat: 51.47, lon: -0.454 },
  { code: 'SIN', name: 'Singapore', lat: 1.35, lon: 103.994 },
  { code: 'HND', name: 'Tokyo', lat: 35.549, lon: 139.779 },
  { code: 'JFK', name: 'New York', lat: 40.641, lon: -73.778 },
  { code: 'SYD', name: 'Sydney', lat: -33.939, lon: 151.175 },
];

const FLIGHT_ROUTES = [
  ['DEL', 'BLR'],
  ['DEL', 'DXB'],
  ['DXB', 'LHR'],
  ['LHR', 'JFK'],
  ['DEL', 'SIN'],
  ['SIN', 'HND'],
  ['SIN', 'SYD'],
  ['BOM', 'LHR'],
  ['BLR', 'SIN'],
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export default function GlobeHero({ onTransitionComplete, isZoomingIn }: GlobeHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const isZoomingRef = useRef(isZoomingIn);
  isZoomingRef.current = isZoomingIn;

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 260);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Globe Root Group
    const globeGroup = new THREE.Group();
    // Tilt to show India / Eurasia beautifully
    globeGroup.rotation.x = 0.35;
    globeGroup.rotation.y = -1.2;
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const RADIUS = 80;

    // 4. Base Earth Sphere (Deep Night Navy)
    const earthGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x050b14,
      emissive: 0x02060d,
      specular: 0x0d283d,
      shininess: 12,
      wireframe: false,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // 5. Grid Lines (Radar Graticule)
    const wireframeGeo = new THREE.SphereGeometry(RADIUS * 1.002, 36, 18);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x16344d,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const wireframeMesh = new THREE.Mesh(wireframeGeo, wireframeMat);
    globeGroup.add(wireframeMesh);

    // 6. Glowing Atmosphere Rim (Custom Shader)
    const atmosphereGeo = new THREE.SphereGeometry(RADIUS * 1.15, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0, 0, 1.0)), 2.2);
          gl_FragColor = vec4(0.13, 0.83, 0.93, 1.0) * intensity * 0.95;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    globeGroup.add(atmosphereMesh);

    // 7. City Light Nodes / Hub Airports
    const hubsByCode: Record<string, THREE.Vector3> = {};
    const hubPointsGeo = new THREE.BufferGeometry();
    const hubPositions: number[] = [];

    AIRPORT_HUBS.forEach((hub) => {
      const v = latLonToVector3(hub.lat, hub.lon, RADIUS * 1.01);
      hubsByCode[hub.code] = v;
      hubPositions.push(v.x, v.y, v.z);

      // Hub outer pulsing ring
      const ringGeo = new THREE.RingGeometry(0.8, 1.6, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(v);
      ring.lookAt(v.clone().multiplyScalar(2));
      globeGroup.add(ring);
    });

    hubPointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(hubPositions, 3));
    const hubPointsMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 3.5,
      transparent: true,
      opacity: 0.95,
    });
    const hubPoints = new THREE.Points(hubPointsGeo, hubPointsMat);
    globeGroup.add(hubPoints);

    // 8. Flight Arcs & Traveling Pulse Particles
    const pulseObjects: { curve: THREE.QuadraticBezierCurve3; progress: number; mesh: THREE.Mesh }[] = [];

    FLIGHT_ROUTES.forEach(([startCode, endCode], idx) => {
      const start = hubsByCode[startCode];
      const end = hubsByCode[endCode];
      if (!start || !end) return;

      // Arc peak control point above globe surface
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const distance = start.distanceTo(end);
      const altitude = RADIUS + distance * 0.22;
      mid.normalize().multiplyScalar(altitude);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(50);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
      const curveMat = new THREE.LineBasicMaterial({
        color: idx % 2 === 0 ? 0x22d3ee : 0x38bdf8,
        transparent: true,
        opacity: 0.45,
      });
      const arcLine = new THREE.Line(curveGeo, curveMat);
      globeGroup.add(arcLine);

      // Glowing pulse traveling along arc
      const pulseGeo = new THREE.SphereGeometry(0.9, 12, 12);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      globeGroup.add(pulseMesh);

      pulseObjects.push({
        curve,
        progress: (idx * 0.14) % 1,
        mesh: pulseMesh,
      });
    });

    // 9. Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0x0e2238, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    dirLight.position.set(150, 100, 120);
    scene.add(dirLight);

    // 10. Mouse Parallax
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      targetTiltX = y * 0.22;
      targetTiltY = x * 0.35;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 11. Responsive Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 12. Animation Loop
    let animationFrameId: number;
    let zoomT = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Mouse Parallax Damping
      currentTiltX += (targetTiltX - currentTiltX) * 0.05;
      currentTiltY += (targetTiltY - currentTiltY) * 0.05;

      // Slow Continuous Earth Rotation
      globeGroup.rotation.y += 0.0012;
      globeGroup.rotation.x = 0.35 + currentTiltX;
      globeGroup.rotation.z = currentTiltY * 0.4;

      // Animate Arcs Pulses
      pulseObjects.forEach((p) => {
        p.progress = (p.progress + 0.004) % 1;
        const pos = p.curve.getPoint(p.progress);
        p.mesh.position.copy(pos);
      });

      // Handle Zoom-in transition when entering radar
      if (isZoomingRef.current) {
        zoomT = Math.min(1, zoomT + 0.025);
        // Smooth camera fly-in into the globe towards India coordinates
        camera.position.z = THREE.MathUtils.lerp(260, 95, zoomT);
        globeGroup.rotation.y = THREE.MathUtils.lerp(globeGroup.rotation.y, -1.35, 0.05);
        globeGroup.rotation.x = THREE.MathUtils.lerp(globeGroup.rotation.x, 0.22, 0.05);

        if (zoomT >= 1 && onTransitionComplete) {
          onTransitionComplete();
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onTransitionComplete]);

  return <div ref={mountRef} className="globe-canvas-wrap" aria-hidden="true" />;
}

