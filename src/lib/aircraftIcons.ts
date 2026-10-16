// src/lib/aircraftIcons.ts
import type maplibregl from 'maplibre-gl';

export type CategoryIconId = 'plane-airliner' | 'plane-heavy' | 'plane-light' | 'plane-helicopter';

/**
 * Generates an SDF-ready 64x64 pixel canvas for the airliner silhouette.
 * Top-down swept-wing commercial airliner with twin engine nacelles.
 */
function drawAirlinerIcon(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';

  ctx.beginPath();
  // Nose
  ctx.moveTo(32, 2);
  // Right fuselage to wing root
  ctx.lineTo(35, 18);
  // Right inner wing with engine
  ctx.lineTo(44, 25);
  ctx.lineTo(44, 28);
  ctx.lineTo(47, 28);
  ctx.lineTo(47, 25);
  // Right wing tip
  ctx.lineTo(62, 34);
  ctx.lineTo(62, 38);
  // Right trailing edge
  ctx.lineTo(36, 33);
  // Right aft fuselage
  ctx.lineTo(34, 52);
  // Right horizontal stabilizer
  ctx.lineTo(45, 59);
  ctx.lineTo(45, 62);
  // Tail cone
  ctx.lineTo(32, 58);
  // Left horizontal stabilizer
  ctx.lineTo(19, 62);
  ctx.lineTo(19, 59);
  // Left aft fuselage
  ctx.lineTo(30, 52);
  // Left trailing edge
  ctx.lineTo(28, 33);
  // Left wing tip
  ctx.lineTo(2, 38);
  ctx.lineTo(2, 34);
  // Left inner wing with engine
  ctx.lineTo(17, 25);
  ctx.lineTo(17, 28);
  ctx.lineTo(20, 28);
  ctx.lineTo(20, 25);
  // Left fuselage to nose
  ctx.lineTo(29, 18);
  ctx.closePath();
  ctx.fill();
}

/**
 * Generates an SDF-ready 64x64 pixel canvas for the heavy transport silhouette.
 * Widebody aircraft with wide wingspan and 4 distinct engine pods.
 */
function drawHeavyIcon(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';

  ctx.beginPath();
  // Rounded wide nose
  ctx.moveTo(32, 1);
  ctx.lineTo(36, 16);
  // Engine 1
  ctx.lineTo(43, 23);
  ctx.lineTo(43, 27);
  ctx.lineTo(45, 27);
  ctx.lineTo(45, 23);
  // Engine 2
  ctx.lineTo(51, 28);
  ctx.lineTo(51, 32);
  ctx.lineTo(53, 32);
  ctx.lineTo(53, 28);
  // Wide wingtip with raked winglet
  ctx.lineTo(63, 33);
  ctx.lineTo(63, 38);
  ctx.lineTo(37, 34);
  // Aft body
  ctx.lineTo(35, 50);
  // Large horizontal stabilizer
  ctx.lineTo(48, 59);
  ctx.lineTo(48, 63);
  ctx.lineTo(32, 59);
  ctx.lineTo(16, 63);
  ctx.lineTo(16, 59);
  ctx.lineTo(29, 50);
  ctx.lineTo(27, 34);
  // Left wing tip
  ctx.lineTo(1, 38);
  ctx.lineTo(1, 33);
  // Engine 3
  ctx.lineTo(11, 28);
  ctx.lineTo(11, 32);
  ctx.lineTo(13, 32);
  ctx.lineTo(13, 28);
  // Engine 4
  ctx.lineTo(19, 23);
  ctx.lineTo(19, 27);
  ctx.lineTo(21, 27);
  ctx.lineTo(21, 23);
  ctx.lineTo(28, 16);
  ctx.closePath();
  ctx.fill();
}

/**
 * Generates an SDF-ready 64x64 pixel canvas for the light general aviation silhouette.
 * Straight/tapered wing, compact fuselage, clean light prop profile.
 */
function drawLightIcon(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';

  ctx.beginPath();
  // Spinner / nose
  ctx.moveTo(32, 4);
  ctx.lineTo(34, 18);
  // Right straight wing
  ctx.lineTo(59, 20);
  ctx.lineTo(59, 25);
  ctx.lineTo(34, 25);
  // Narrow fuselage
  ctx.lineTo(33, 50);
  // Stabilizer
  ctx.lineTo(43, 56);
  ctx.lineTo(43, 60);
  ctx.lineTo(32, 58);
  ctx.lineTo(21, 60);
  ctx.lineTo(21, 56);
  ctx.lineTo(31, 50);
  // Left straight wing
  ctx.lineTo(30, 25);
  ctx.lineTo(5, 25);
  ctx.lineTo(5, 20);
  ctx.lineTo(30, 18);
  ctx.closePath();
  ctx.fill();
}

/**
 * Generates an SDF-ready 64x64 pixel canvas for a helicopter / rotorcraft silhouette.
 * Rotor hub with 4 rotor blades, pod fuselage, tail boom and tail rotor.
 */
function drawHelicopterIcon(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';

  // Rotor Blades (Cross)
  ctx.fillRect(30.5, 4, 3, 44);  // Vertical blade pair
  ctx.fillRect(10, 24.5, 44, 3);  // Horizontal blade pair

  // Rotor Hub Circle
  ctx.beginPath();
  ctx.arc(32, 26, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage Pod
  ctx.beginPath();
  ctx.ellipse(32, 25, 6, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail Boom
  ctx.beginPath();
  ctx.moveTo(30.5, 36);
  ctx.lineTo(30.5, 56);
  ctx.lineTo(33.5, 56);
  ctx.lineTo(33.5, 36);
  ctx.closePath();
  ctx.fill();

  // Tail Rotor and Fin
  ctx.fillRect(27, 54, 10, 2);
  ctx.fillRect(35, 50, 2, 10);
}

/**
 * Registers all 4 category SDF icons with MapLibre instance.
 */
export function registerAircraftSdfIcons(map: maplibregl.Map): void {
  const iconCanvas = document.createElement('canvas');
  iconCanvas.width = 64;
  iconCanvas.height = 64;
  const ctx = iconCanvas.getContext('2d');
  if (!ctx) return;

  // 1. Airliner
  drawAirlinerIcon(ctx);
  const airlinerData = ctx.getImageData(0, 0, 64, 64);
  if (!map.hasImage('plane-airliner')) {
    map.addImage('plane-airliner', airlinerData, { sdf: true });
  }

  // 2. Heavy
  drawHeavyIcon(ctx);
  const heavyData = ctx.getImageData(0, 0, 64, 64);
  if (!map.hasImage('plane-heavy')) {
    map.addImage('plane-heavy', heavyData, { sdf: true });
  }

  // 3. Light
  drawLightIcon(ctx);
  const lightData = ctx.getImageData(0, 0, 64, 64);
  if (!map.hasImage('plane-light')) {
    map.addImage('plane-light', lightData, { sdf: true });
  }

  // 4. Helicopter
  drawHelicopterIcon(ctx);
  const heliData = ctx.getImageData(0, 0, 64, 64);
  if (!map.hasImage('plane-helicopter')) {
    map.addImage('plane-helicopter', heliData, { sdf: true });
  }

  // Also register default 'plane' alias to airliner for backward compatibility
  if (!map.hasImage('plane')) {
    map.addImage('plane', airlinerData, { sdf: true });
  }
}

