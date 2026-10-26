import {
  BodyId,
  ChartCalculationResult,
  PlanetPosition
} from '../types/astrology';
import { ZODIAC_SIGNS, normalizeDeg, shortestAngularDistance } from '../engine/ephemeris';
import { ELEMENT_COLORS } from './NatalWheelCanvas';

interface PlacedLivePlanetNode {
  planet: PlanetPosition;
  trueLon: number;
  displayLon: number;
  radialTier: number;
  screenX: number;
  screenY: number;
  hitRadius: number;
  hasTightTransit: boolean;
}

interface PlacedNatalRefNode {
  planet: PlanetPosition;
  displayLon: number;
  screenX: number;
  screenY: number;
}

export class LiveSkyWheelCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chart: ChartCalculationResult;
  private selectedBodyId: BodyId | null;
  private onSelectCallback: (bodyId: BodyId | null) => void;
  private userRotationDeg = 0;

  private placedLiveNodes: PlacedLivePlanetNode[] = [];
  private placedNatalRefs: PlacedNatalRefNode[] = [];
  private centerX = 0;
  private centerY = 0;
  private resizeObserver: ResizeObserver;

  constructor(
    canvas: HTMLCanvasElement,
    chart: ChartCalculationResult,
    initialBodyId: BodyId | null,
    onSelect: (bodyId: BodyId | null) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canlı Gökyüzü 2D Canvas başlatılamadı.');
    }
    this.ctx = context;
    this.chart = chart;
    this.selectedBodyId = initialBodyId;
    this.onSelectCallback = onSelect;

    this.bindInteractionEvents();
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeAndRender();
    });
    if (this.canvas.parentElement) {
      this.resizeObserver.observe(this.canvas.parentElement);
    }
    this.resizeAndRender();
  }

  public setChart(chart: ChartCalculationResult): void {
    this.chart = chart;
    this.render();
  }

  public setSelectedBody(bodyId: BodyId | null, notify = false): void {
    this.selectedBodyId = bodyId;
    this.render();
    if (notify) {
      this.onSelectCallback(bodyId);
    }
  }

  public rotateBy(deltaDeg: number): void {
    this.userRotationDeg = normalizeDeg(this.userRotationDeg + deltaDeg);
    this.render();
  }

  public resetRotation(): void {
    this.userRotationDeg = 0;
    this.render();
  }

  private lonToCanvasRad(longitude: number): number {
    const ascLon = this.chart.angles.asc.longitude;
    const relDeg = normalizeDeg(longitude - ascLon);
    const totalDeg = 180 - relDeg + this.userRotationDeg;
    return (totalDeg * Math.PI) / 180;
  }

  private drawCenteredGlyph(
    ctx: CanvasRenderingContext2D,
    glyph: string,
    x: number,
    y: number,
    fontPx: number
  ): void {
    if (glyph === '♀') {
      const r = fontPx * 0.27;
      const cy = y - fontPx * 0.12;
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineWidth = Math.max(1.5, fontPx * 0.115);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.moveTo(x, cy + r);
      ctx.lineTo(x, y + fontPx * 0.38);
      ctx.moveTo(x - fontPx * 0.19, y + fontPx * 0.21);
      ctx.lineTo(x + fontPx * 0.19, y + fontPx * 0.21);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (glyph === '♂') {
      const r = fontPx * 0.26;
      const cx = x - fontPx * 0.08;
      const cy = y + fontPx * 0.08;
      const tipX = x + fontPx * 0.31;
      const tipY = y - fontPx * 0.31;
      const arm = fontPx * 0.19;
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineWidth = Math.max(1.5, fontPx * 0.115);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.moveTo(cx + r * 0.707, cy - r * 0.707);
      ctx.lineTo(tipX, tipY);
      ctx.moveTo(tipX - arm, tipY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX, tipY + arm);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText(glyph);
    if (
      typeof metrics.actualBoundingBoxAscent === 'number' &&
      typeof metrics.actualBoundingBoxDescent === 'number' &&
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent > 0
    ) {
      const opticalY =
        y + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      ctx.fillText(glyph, x, opticalY);
    } else {
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, x, y);
    }
  }

  public resizeAndRender(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const availableWidth = parent.clientWidth || window.innerWidth - 36;
    const isMobile = window.innerWidth < 640;
    const maxAllowed = isMobile
      ? Math.min(availableWidth, 390)
      : Math.min(availableWidth, 430);
    const size = Math.max(250, Math.floor(maxAllowed));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  private computeLiveNodes(zodiacInnerR: number): PlacedLivePlanetNode[] {
    const sorted = [...this.chart.transitPlanets].sort((a, b) => a.longitude - b.longitude);
    const nodes: PlacedLivePlanetNode[] = sorted.map((p) => ({
      planet: p,
      trueLon: p.longitude,
      displayLon: p.longitude,
      radialTier: 0,
      screenX: 0,
      screenY: 0,
      hitRadius: 18,
      hasTightTransit: this.chart.activeTransits.some((at) => at.transitBody.id === p.id)
    }));

    for (let i = 1; i < nodes.length; i++) {
      const dist = shortestAngularDistance(nodes[i].trueLon, nodes[i - 1].trueLon);
      if (dist < 6.0) {
        nodes[i].radialTier = (nodes[i - 1].radialTier + 1) % 2;
      }
    }

    const minSepDeg = 4.6;
    for (let iter = 0; iter < 16; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        const nextIdx = (i + 1) % nodes.length;
        const a = nodes[i];
        const b = nodes[nextIdx];
        let diff = normalizeDeg(b.displayLon - a.displayLon);
        if (diff > 180) diff -= 360;
        const absDiff = Math.abs(diff);
        const req = a.radialTier === b.radialTier ? minSepDeg : 2.4;
        if (absDiff < req) {
          const push = (req - absDiff) * 0.5;
          a.displayLon = normalizeDeg(a.displayLon - push);
          b.displayLon = normalizeDeg(b.displayLon + push);
        }
      }
    }

    for (const node of nodes) {
      const tierOffset = node.radialTier * (zodiacInnerR * 0.082);
      const r = zodiacInnerR * 0.78 - tierOffset;
      const rad = this.lonToCanvasRad(node.displayLon);
      node.screenX = this.centerX + Math.cos(rad) * r;
      node.screenY = this.centerY + Math.sin(rad) * r;
      node.hitRadius = Math.max(16, zodiacInnerR * 0.072);
    }

    return nodes;
  }

  private computeNatalRefNodes(natalRingR: number): PlacedNatalRefNode[] {
    const sorted = [...this.chart.planets].sort((a, b) => a.longitude - b.longitude);
    const displayLons = sorted.map((p) => p.longitude);

    for (let iter = 0; iter < 10; iter++) {
      for (let i = 0; i < displayLons.length; i++) {
        const j = (i + 1) % displayLons.length;
        let diff = normalizeDeg(displayLons[j] - displayLons[i]);
        if (diff > 180) diff -= 360;
        if (Math.abs(diff) < 4.2) {
          const push = (4.2 - Math.abs(diff)) * 0.5;
          displayLons[i] = normalizeDeg(displayLons[i] - push);
          displayLons[j] = normalizeDeg(displayLons[j] + push);
        }
      }
    }

    return sorted.map((p, idx) => {
      const rad = this.lonToCanvasRad(displayLons[idx]);
      return {
        planet: p,
        displayLon: displayLons[idx],
        screenX: this.centerX + Math.cos(rad) * natalRingR,
        screenY: this.centerY + Math.sin(rad) * natalRingR
      };
    });
  }

  public render(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    const ctx = this.ctx;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    this.centerX = width / 2;
    this.centerY = height / 2;

    const maxR = Math.min(width, height) / 2 - 10;
    const zodiacOuterR = maxR * 0.96;
    const zodiacInnerR = zodiacOuterR * 0.81;
    const natalRingR = zodiacInnerR * 0.50;
    const coreR = zodiacInnerR * 0.22;

    // 1. Warm Editorial Sky Dome & Subtle Coordinate Dots (usecomus.com palette)
    const skyGrad = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      coreR * 0.2,
      this.centerX,
      this.centerY,
      maxR * 1.02
    );
    skyGrad.addColorStop(0, '#FFFCFA');
    skyGrad.addColorStop(0.58, '#F6F1E8');
    skyGrad.addColorStop(1, '#EDE8DE');

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, maxR, 0, Math.PI * 2);
    ctx.fillStyle = skyGrad;
    ctx.fill();

    // Subtle outer celestial coordinate halo
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, maxR - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(59, 109, 17, 0.32)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    this.drawStarfield(ctx, zodiacInnerR);

    // 2. Outer Zodiac Belt (Natal Chart Style)
    this.drawZodiacBelt(ctx, zodiacInnerR, zodiacOuterR);

    // 3. Personal Natal House Sectors & Cardinal Axes
    this.drawNatalHouseOverlay(ctx, natalRingR, zodiacInnerR, zodiacOuterR);

    // 4. Inner Natal Reference Ring & Live Sky Synastry Aspect Beams
    this.placedLiveNodes = this.computeLiveNodes(zodiacInnerR);
    this.placedNatalRefs = this.computeNatalRefNodes(natalRingR);

    this.drawLiveAspectBeams(ctx, natalRingR);
    this.drawNatalReferenceRing(ctx, natalRingR);

    // 5. Primary Celestial Ring: Live Sky Planets (Medallions & Degrees)
    this.drawLiveSkyPlanets(ctx, zodiacInnerR);

    // 6. Central Celestial Astrolabe Hub
    this.drawCenterCelestialHub(ctx, coreR);

    ctx.restore();
  }

  private drawStarfield(ctx: CanvasRenderingContext2D, maxStarR: number): void {
    ctx.save();
    for (let i = 0; i < 32; i++) {
      const seedAngle = ((i * 137.5) % 360) * (Math.PI / 180);
      const rRatio = 0.26 + ((i * 29) % 70) / 100;
      const r = maxStarR * rRatio;
      const sx = this.centerX + Math.cos(seedAngle) * r;
      const sy = this.centerY + Math.sin(seedAngle) * r;
      const radius = i % 5 === 0 ? 1.35 : 0.85;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle =
        i % 4 === 0 ? 'rgba(59, 109, 17, 0.22)' : 'rgba(154, 107, 34, 0.18)';
      ctx.fill();
    }
    ctx.restore();
  }

  private drawZodiacBelt(
    ctx: CanvasRenderingContext2D,
    innerR: number,
    outerR: number
  ): void {
    const bandWidth = outerR - innerR;
    const selectedPlanet = this.chart.transitPlanets.find(
      (p) => p.id === this.selectedBodyId
    );

    for (const sign of ZODIAC_SIGNS) {
      const startLon = sign.index * 30;
      const endLon = (sign.index + 1) * 30;
      const midLon = startLon + 15;

      const startRad = this.lonToCanvasRad(startLon);
      const endRad = this.lonToCanvasRad(endLon);
      const midRad = this.lonToCanvasRad(midLon);
      const elStyle = ELEMENT_COLORS[sign.element];
      const isHighlighted = selectedPlanet?.sign.id === sign.id;

      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, outerR, endRad, startRad, false);
      ctx.arc(this.centerX, this.centerY, innerR, startRad, endRad, true);
      ctx.closePath();
      ctx.fillStyle = isHighlighted ? elStyle.bgTint : 'rgba(255, 252, 250, 0.92)';
      ctx.fill();

      // Element-colored outer rim
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, outerR - 1.5, endRad, startRad, false);
      ctx.strokeStyle = elStyle.primary;
      ctx.lineWidth = isHighlighted ? 3.6 : 2.2;
      ctx.stroke();

      // Sign boundary divider
      const dx1 = this.centerX + Math.cos(startRad) * innerR;
      const dy1 = this.centerY + Math.sin(startRad) * innerR;
      const dx2 = this.centerX + Math.cos(startRad) * outerR;
      const dy2 = this.centerY + Math.sin(startRad) * outerR;
      ctx.beginPath();
      ctx.moveTo(dx1, dy1);
      ctx.lineTo(dx2, dy2);
      ctx.strokeStyle = '#C8C4B0';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 5° and 10° degree ticks
      for (let d = 5; d < 30; d += 5) {
        const tickRad = this.lonToCanvasRad(startLon + d);
        const tickLen = d % 10 === 0 ? bandWidth * 0.22 : bandWidth * 0.13;
        const tx1 = this.centerX + Math.cos(tickRad) * innerR;
        const ty1 = this.centerY + Math.sin(tickRad) * innerR;
        const tx2 = this.centerX + Math.cos(tickRad) * (innerR + tickLen);
        const ty2 = this.centerY + Math.sin(tickRad) * (innerR + tickLen);
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle =
          d % 10 === 0 ? 'rgba(44, 44, 26, 0.42)' : 'rgba(92, 86, 77, 0.22)';
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }

      // Sign glyph & short label
      const glyphR = innerR + bandWidth * 0.62;
      const labelR = innerR + bandWidth * 0.27;
      const gx = this.centerX + Math.cos(midRad) * glyphR;
      const gy = this.centerY + Math.sin(midRad) * glyphR;
      const lx = this.centerX + Math.cos(midRad) * labelR;
      const ly = this.centerY + Math.sin(midRad) * labelR;

      ctx.save();
      if (isHighlighted) {
        ctx.shadowColor = elStyle.glow;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = elStyle.primary;
      ctx.font = `700 ${Math.max(12, Math.round(bandWidth * 0.38))}px "DM Sans", "Segoe UI Symbol", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.glyph, gx, gy);
      ctx.restore();

      ctx.fillStyle = isHighlighted ? '#2C2C1A' : '#5C564D';
      ctx.font = `600 ${Math.max(7, Math.round(bandWidth * 0.18))}px "DM Sans", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.shortName.toLocaleUpperCase('tr-TR'), lx, ly);
    }

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = '#C8C4B0';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  private drawNatalHouseOverlay(
    ctx: CanvasRenderingContext2D,
    innerR: number,
    zodiacInnerR: number,
    zodiacOuterR: number
  ): void {
    const houses = this.chart.houses;
    const selectedLive = this.chart.transitPlanets.find(
      (p) => p.id === this.selectedBodyId
    );

    for (let i = 0; i < 12; i++) {
      const cusp = houses[i];
      const nextCusp = houses[(i + 1) % 12];
      const startRad = this.lonToCanvasRad(cusp.longitude);
      const endRad = this.lonToCanvasRad(nextCusp.longitude);

      const isTransitedHouse = selectedLive?.house === cusp.house;

      if (isTransitedHouse) {
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, zodiacInnerR, endRad, startRad, false);
        ctx.arc(this.centerX, this.centerY, innerR, startRad, endRad, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(59, 109, 17, 0.11)';
        ctx.fill();
      }

      const isCardinal =
        cusp.house === 1 || cusp.house === 4 || cusp.house === 7 || cusp.house === 10;
      const x1 = this.centerX + Math.cos(startRad) * innerR;
      const y1 = this.centerY + Math.sin(startRad) * innerR;
      const x2 = this.centerX + Math.cos(startRad) * zodiacInnerR;
      const y2 = this.centerY + Math.sin(startRad) * zodiacInnerR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      if (isCardinal) {
        ctx.strokeStyle =
          cusp.house === 1 || cusp.house === 7
            ? 'rgba(154, 107, 34, 0.7)'
            : 'rgba(59, 109, 17, 0.7)';
        ctx.lineWidth = 1.8;
      } else {
        ctx.strokeStyle = isTransitedHouse
          ? 'rgba(59, 109, 17, 0.6)'
          : '#D5CFC0';
        ctx.lineWidth = isTransitedHouse ? 1.4 : 0.9;
      }
      ctx.stroke();

      // House number label along the inner boundary of the live planet belt
      let span = normalizeDeg(nextCusp.longitude - cusp.longitude);
      if (span === 0) span = 30;
      const midLon = normalizeDeg(cusp.longitude + span / 2);
      const midRad = this.lonToCanvasRad(midLon);
      const numR = innerR + (zodiacInnerR - innerR) * 0.13;
      const nx = this.centerX + Math.cos(midRad) * numR;
      const ny = this.centerY + Math.sin(midRad) * numR;

      ctx.fillStyle = isTransitedHouse ? '#27500A' : '#5C564D';
      ctx.font = `${isTransitedHouse ? '700' : '600'} 9px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${cusp.house}`, nx, ny);
    }

    // Small ASC / MC axis tags on the outer rim
    const axes: Array<{ label: string; lon: number; color: string }> = [
      { label: 'ASC', lon: this.chart.angles.asc.longitude, color: '#9A6B22' },
      { label: 'MC', lon: this.chart.angles.mc.longitude, color: '#3B6D11' }
    ];
    for (const ax of axes) {
      const rad = this.lonToCanvasRad(ax.lon);
      const tx = this.centerX + Math.cos(rad) * (zodiacOuterR - 2);
      const ty = this.centerY + Math.sin(rad) * (zodiacOuterR - 2);
      ctx.save();
      ctx.fillStyle = '#FFFCFA';
      ctx.strokeStyle = ax.color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ax.color;
      ctx.font = '700 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ax.label, tx, ty);
      ctx.restore();
    }
  }

  private drawLiveAspectBeams(ctx: CanvasRenderingContext2D, natalRingR: number): void {
    ctx.save();

    // Draw all active tight transits (<= 2.0 deg), emphasizing those belonging to selectedBodyId
    for (const tr of this.chart.activeTransits) {
      const liveNode = this.placedLiveNodes.find((n) => n.planet.id === tr.transitBody.id);
      if (!liveNode) continue;

      let targetX = 0;
      let targetY = 0;
      const natalNode = this.placedNatalRefs.find((n) => n.planet.id === tr.natalTarget.id);
      if (natalNode) {
        targetX = natalNode.screenX;
        targetY = natalNode.screenY;
      } else {
        const rad = this.lonToCanvasRad(tr.natalTarget.longitude);
        targetX = this.centerX + Math.cos(rad) * natalRingR;
        targetY = this.centerY + Math.sin(rad) * natalRingR;
      }

      const isSelected = tr.transitBody.id === this.selectedBodyId;
      const beamColor =
        tr.nature === 'harmonious'
          ? '#3B6D11'
          : tr.nature === 'challenging'
            ? '#B84322'
            : '#9A6B22';

      ctx.beginPath();
      ctx.moveTo(liveNode.screenX, liveNode.screenY);
      ctx.lineTo(targetX, targetY);
      ctx.strokeStyle = isSelected ? beamColor : `${beamColor}66`;
      ctx.lineWidth = isSelected ? 2.2 : 1.15;
      if (!isSelected) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
        ctx.shadowColor = beamColor;
        ctx.shadowBlur = 8;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);

      if (isSelected) {
        const mx = (liveNode.screenX + targetX) / 2;
        const my = (liveNode.screenY + targetY) / 2;
        ctx.beginPath();
        ctx.arc(mx, my, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFCFA';
        ctx.fill();
        ctx.strokeStyle = beamColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = beamColor;
        ctx.font = '700 10px "Apple Symbols", "Segoe UI Symbol", sans-serif';
        this.drawCenteredGlyph(ctx, tr.glyph, mx, my, 10);
      }
    }

    ctx.restore();
  }

  private drawNatalReferenceRing(
    ctx: CanvasRenderingContext2D,
    natalRingR: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, natalRingR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(237, 232, 222, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(154, 107, 34, 0.42)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const ref of this.placedNatalRefs) {
      const isTargetOfSelected = this.chart.activeTransits.some(
        (at) =>
          at.transitBody.id === this.selectedBodyId &&
          at.natalTarget.id === ref.planet.id
      );

      const nodeR = isTargetOfSelected ? 10.5 : 8.5;
      ctx.beginPath();
      ctx.arc(ref.screenX, ref.screenY, nodeR, 0, Math.PI * 2);
      ctx.fillStyle = isTargetOfSelected ? '#F7EFE0' : '#FFFCFA';
      ctx.fill();
      ctx.strokeStyle = isTargetOfSelected
        ? '#9A6B22'
        : '#C8C4B0';
      ctx.lineWidth = isTargetOfSelected ? 1.5 : 1;
      ctx.stroke();

      const fontPx = isTargetOfSelected ? 11 : 9.5;
      ctx.fillStyle = isTargetOfSelected ? '#8C5A14' : '#5C564D';
      ctx.font = `600 ${fontPx}px "Apple Symbols", "Segoe UI Symbol", "DM Sans", sans-serif`;
      this.drawCenteredGlyph(ctx, ref.planet.glyph, ref.screenX, ref.screenY, fontPx);
    }

    ctx.restore();
  }

  private drawLiveSkyPlanets(
    ctx: CanvasRenderingContext2D,
    zodiacInnerR: number
  ): void {
    ctx.save();

    for (const node of this.placedLiveNodes) {
      const p = node.planet;
      const isSelected = p.id === this.selectedBodyId;
      const elStyle = ELEMENT_COLORS[p.sign.element];
      const trueRad = this.lonToCanvasRad(node.trueLon);

      // True ecliptic degree pointer tick to zodiac inner rim
      const rimX = this.centerX + Math.cos(trueRad) * zodiacInnerR;
      const rimY = this.centerY + Math.sin(trueRad) * zodiacInnerR;

      ctx.beginPath();
      ctx.moveTo(rimX, rimY);
      ctx.lineTo(node.screenX, node.screenY);
      ctx.strokeStyle = isSelected
        ? '#3B6D11'
        : node.hasTightTransit
          ? 'rgba(59, 109, 17, 0.55)'
          : 'rgba(92, 86, 77, 0.35)';
      ctx.lineWidth = isSelected ? 1.7 : 1;
      ctx.stroke();

      // Exact point dot on zodiac inner circle
      ctx.beginPath();
      ctx.arc(rimX, rimY, isSelected ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#3B6D11' : elStyle.primary;
      ctx.fill();

      const medR = isSelected
        ? Math.max(14, zodiacInnerR * 0.088)
        : Math.max(12, zodiacInnerR * 0.076);

      ctx.save();
      if (isSelected || node.hasTightTransit) {
        ctx.shadowColor = isSelected ? 'rgba(59, 109, 17, 0.36)' : 'rgba(44, 40, 32, 0.2)';
        ctx.shadowBlur = isSelected ? 14 : 6;
        ctx.shadowOffsetY = 2;
      } else {
        ctx.shadowColor = 'rgba(44, 40, 32, 0.18)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
      }

      const medGrad = ctx.createRadialGradient(
        node.screenX - medR * 0.28,
        node.screenY - medR * 0.28,
        medR * 0.1,
        node.screenX,
        node.screenY,
        medR
      );
      if (isSelected) {
        medGrad.addColorStop(0, '#4C8A17');
        medGrad.addColorStop(1, '#27500A');
      } else if (node.hasTightTransit) {
        medGrad.addColorStop(0, '#F5FBEF');
        medGrad.addColorStop(1, '#DCECC8');
      } else {
        medGrad.addColorStop(0, '#FFFFFF');
        medGrad.addColorStop(0.7, '#FFFCFA');
        medGrad.addColorStop(1, '#EAE2D3');
      }

      ctx.beginPath();
      ctx.arc(node.screenX, node.screenY, medR, 0, Math.PI * 2);
      ctx.fillStyle = medGrad;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(node.screenX, node.screenY, medR, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected
        ? '#27500A'
        : node.hasTightTransit
          ? '#3B6D11'
          : elStyle.primary;
      ctx.lineWidth = isSelected ? 2.2 : node.hasTightTransit ? 1.6 : 1.2;
      ctx.stroke();

      const glyphPx = Math.round(medR * 1.08);
      ctx.fillStyle = isSelected ? '#FFFCFA' : '#2C2C1A';
      ctx.font = `700 ${glyphPx}px "Apple Symbols", "Segoe UI Symbol", "DM Sans", system-ui, sans-serif`;
      this.drawCenteredGlyph(ctx, p.glyph, node.screenX, node.screenY, glyphPx);

      // Degree badge next to medallion
      const degLabel = `${Math.floor(p.signDegree)}°`;
      const degR = medR + 8;
      const dispRad = this.lonToCanvasRad(node.displayLon);
      const dx = node.screenX - Math.cos(dispRad) * degR;
      const dy = node.screenY - Math.sin(dispRad) * degR;

      ctx.fillStyle = isSelected ? '#27500A' : '#5C564D';
      ctx.font = '600 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(degLabel, dx, dy);

      if (p.isRetrograde) {
        ctx.fillStyle = '#B84322';
        ctx.font = '700 7.5px "DM Sans", sans-serif';
        ctx.fillText('℞', node.screenX + medR * 0.72, node.screenY - medR * 0.72);
      }
    }

    ctx.restore();
  }

  private drawCenterCelestialHub(ctx: CanvasRenderingContext2D, coreR: number): void {
    const selectedLive =
      this.chart.transitPlanets.find((p) => p.id === this.selectedBodyId) ||
      this.chart.transitPlanets[0];

    ctx.save();
    const grad = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      2,
      this.centerX,
      this.centerY,
      coreR
    );
    grad.addColorStop(0, '#FFFCFA');
    grad.addColorStop(1, '#EAF3DE');

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, coreR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#3B6D11';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    if (selectedLive) {
      ctx.fillStyle = '#27500A';
      const centerGlyphPx = Math.max(13, Math.round(coreR * 0.52));
      ctx.font = `700 ${centerGlyphPx}px "Apple Symbols", "Segoe UI Symbol", "DM Sans", sans-serif`;
      this.drawCenteredGlyph(
        ctx,
        selectedLive.glyph,
        this.centerX,
        this.centerY - coreR * 0.18,
        centerGlyphPx
      );

      ctx.fillStyle = '#2C2C1A';
      ctx.font = `700 ${Math.max(8, Math.round(coreR * 0.24))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${selectedLive.sign.glyph} ${Math.floor(selectedLive.signDegree)}°`,
        this.centerX,
        this.centerY + coreR * 0.34
      );
    }

    ctx.restore();
  }

  private bindInteractionEvents(): void {
    this.canvas.addEventListener('click', (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const node of this.placedLiveNodes) {
        const dist = Math.hypot(x - node.screenX, y - node.screenY);
        if (dist <= node.hitRadius) {
          const isSame = this.selectedBodyId === node.planet.id;
          this.setSelectedBody(isSame ? null : node.planet.id, true);
          return;
        }
      }
    });
  }
}
