import {
  AngleId,
  BodyId,
  ChartCalculationResult,
  ElementType,
  PlanetPosition,
  WheelSelection
} from '../types/astrology';
import { ZODIAC_SIGNS, normalizeDeg, shortestAngularDistance } from '../engine/ephemeris';

export const ELEMENT_COLORS: Record<
  ElementType,
  { primary: string; glow: string; bgTint: string; border: string }
> = {
  fire: {
    primary: '#FF5E5B', // Mercan Kırmızısı
    glow: 'rgba(255, 94, 91, 0.45)',
    bgTint: 'rgba(255, 94, 91, 0.14)',
    border: 'rgba(255, 94, 91, 0.55)'
  },
  earth: {
    primary: '#10B981', // Zümrüt Yeşili
    glow: 'rgba(16, 185, 129, 0.45)',
    bgTint: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.55)'
  },
  air: {
    primary: '#F59E0B', // Altın Sarısı
    glow: 'rgba(245, 158, 11, 0.45)',
    bgTint: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.55)'
  },
  water: {
    primary: '#38BDF8', // Okyanus Mavisi
    glow: 'rgba(56, 189, 248, 0.45)',
    bgTint: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.55)'
  }
};

interface PlacedPlanetNode {
  planet: PlanetPosition;
  trueLon: number;
  displayLon: number;
  radialTier: number; // 0, 1, 2 for conjunction staggering
  screenX: number;
  screenY: number;
  hitRadius: number;
}

interface PlacedAngleNode {
  id: AngleId;
  label: string;
  longitude: number;
  screenX: number;
  screenY: number;
  hitRadius: number;
  color: string;
}

export class NatalWheelCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chart: ChartCalculationResult;
  private selection: WheelSelection = { kind: 'planet', id: 'sun' };
  private onSelectCallback: (sel: WheelSelection) => void;

  // Interactive Transform State
  private userRotationDeg = 0;
  private zoomScale = 1.0;
  private panX = 0;
  private panY = 0;
  private showTransitRing = true;
  private touchRotateEnabled = false;

  // Hit-testing caches
  private placedPlanets: PlacedPlanetNode[] = [];
  private placedAngles: PlacedAngleNode[] = [];
  private centerX = 0;
  private centerY = 0;
  private outerRadius = 0;
  private houseInnerRadius = 0;
  private houseOuterRadius = 0;

  // Touch / Pointer gesture tracking
  private activePointers = new Map<number, { x: number; y: number }>();
  private isDragging = false;
  private dragMoved = false;
  private lastPointerAngle = 0;
  private initialPinchDistance = 0;
  private initialPinchZoom = 1;
  private initialPinchAngle = 0;
  private initialPinchRotation = 0;
  private resizeObserver: ResizeObserver;

  constructor(
    canvas: HTMLCanvasElement,
    chart: ChartCalculationResult,
    onSelect: (sel: WheelSelection) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D Canvas context başlatılamadı.');
    }
    this.ctx = context;
    this.chart = chart;
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

  public setSelection(selection: WheelSelection, notify = false): void {
    this.selection = selection;
    this.render();
    if (notify) {
      this.onSelectCallback(selection);
    }
  }

  public getSelection(): WheelSelection {
    return this.selection;
  }

  public setShowTransitRing(show: boolean): void {
    this.showTransitRing = show;
    this.render();
  }

  public getShowTransitRing(): boolean {
    return this.showTransitRing;
  }

  public setTouchRotateEnabled(enabled: boolean): void {
    this.touchRotateEnabled = enabled;
    this.canvas.style.touchAction = enabled ? 'none' : 'pan-y pinch-zoom';
  }

  public getTouchRotateEnabled(): boolean {
    return this.touchRotateEnabled;
  }

  public resetView(): void {
    this.userRotationDeg = 0;
    this.zoomScale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.render();
  }

  public rotateBy(deltaDeg: number): void {
    this.userRotationDeg = normalizeDeg(this.userRotationDeg + deltaDeg);
    this.render();
  }

  public adjustZoom(delta: number): void {
    this.zoomScale = Math.max(0.85, Math.min(2.5, this.zoomScale + delta));
    if (this.zoomScale <= 1.02) {
      this.panX = 0;
      this.panY = 0;
    }
    this.render();
  }

  /**
   * Converts an astrological ecliptic longitude (0..360) into Canvas radians.
   * Standard Western chart: ASC is anchored at 9 o'clock (Math.PI radians),
   * and zodiac longitude increases counter-clockwise.
   */
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
    fontPx = 14
  ): void {
    if (glyph === '♀' || glyph === '♂') {
      const s = fontPx * 0.44;
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1.5, fontPx * 0.125);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (glyph === '♀') {
        const cy = y - s * 0.34;
        const r = s * 0.54;
        ctx.arc(x, cy, r, 0, Math.PI * 2);
        ctx.moveTo(x, cy + r);
        ctx.lineTo(x, y + s * 0.96);
        ctx.moveTo(x - s * 0.42, y + s * 0.58);
        ctx.lineTo(x + s * 0.42, y + s * 0.58);
      } else {
        const cx = x - s * 0.22;
        const cy = y + s * 0.22;
        const r = s * 0.54;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        const sx = cx + r * Math.SQRT1_2;
        const sy = cy - r * Math.SQRT1_2;
        const ex = x + s * 0.85;
        const ey = y - s * 0.85;
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.moveTo(ex - s * 0.52, ey);
        ctx.lineTo(ex, ey);
        ctx.lineTo(ex, ey + s * 0.52);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.textAlign = 'center';
    const m = ctx.measureText(glyph);
    if (
      typeof m.actualBoundingBoxAscent === 'number' &&
      typeof m.actualBoundingBoxDescent === 'number' &&
      (m.actualBoundingBoxAscent > 0 || m.actualBoundingBoxDescent > 0)
    ) {
      const yOffset = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(glyph, x, y + yOffset);
    } else {
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, x, y + 0.5);
    }
  }

  /**
   * Inverse mapping from a canvas point (x, y) to ecliptic longitude (0..360)
   */
  private canvasPointToLon(x: number, y: number): number {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const ascLon = this.chart.angles.asc.longitude;
    return normalizeDeg(180 - angleDeg + this.userRotationDeg + ascLon);
  }

  public resizeAndRender(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const availableWidth = parent.clientWidth || window.innerWidth - 28;
    const isMobileViewport = window.innerWidth < 640;
    const maxAllowed = isMobileViewport
      ? Math.min(availableWidth, window.innerHeight * 0.62, 460)
      : Math.min(availableWidth, 560);
    const size = Math.max(250, Math.floor(maxAllowed));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  /**
   * Computes non-overlapping angular positions & radial tiers for natal planets
   */
  private computePlanetNodes(baseOuterR: number): PlacedPlanetNode[] {
    const sorted = [...this.chart.planets].sort((a, b) => a.longitude - b.longitude);
    const nodes: PlacedPlanetNode[] = sorted.map((p) => ({
      planet: p,
      trueLon: p.longitude,
      displayLon: p.longitude,
      radialTier: 0,
      screenX: 0,
      screenY: 0,
      hitRadius: 20
    }));

    // Assign radial tiers when true longitudes are within 5.5 degrees (conjunctions)
    for (let i = 1; i < nodes.length; i++) {
      const dist = shortestAngularDistance(nodes[i].trueLon, nodes[i - 1].trueLon);
      if (dist < 5.8) {
        nodes[i].radialTier = (nodes[i - 1].radialTier + 1) % 3;
      }
    }
    if (nodes.length > 1) {
      const wrapDist = shortestAngularDistance(
        nodes[0].trueLon,
        nodes[nodes.length - 1].trueLon
      );
      if (wrapDist < 5.8 && nodes[0].radialTier === nodes[nodes.length - 1].radialTier) {
        nodes[0].radialTier = (nodes[nodes.length - 1].radialTier + 1) % 3;
      }
    }

    // Iterative angular relaxation for glyphs on the same radial tier
    const minSepDeg = 4.2;
    for (let iter = 0; iter < 18; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        const nextIdx = (i + 1) % nodes.length;
        const a = nodes[i];
        const b = nodes[nextIdx];
        let diff = normalizeDeg(b.displayLon - a.displayLon);
        if (diff > 180) diff -= 360;
        const absDiff = Math.abs(diff);
        const requiredSep = a.radialTier === b.radialTier ? minSepDeg : 2.2;
        if (absDiff < requiredSep) {
          const push = (requiredSep - absDiff) * 0.5;
          a.displayLon = normalizeDeg(a.displayLon - push);
          b.displayLon = normalizeDeg(b.displayLon + push);
        }
      }
    }

    // Calculate screen coordinates
    for (const node of nodes) {
      const tierOffset = node.radialTier * (baseOuterR * 0.068);
      const r = baseOuterR * 0.67 - tierOffset;
      const rad = this.lonToCanvasRad(node.displayLon);
      node.screenX = this.centerX + Math.cos(rad) * r;
      node.screenY = this.centerY + Math.sin(rad) * r;
      node.hitRadius = Math.max(18, baseOuterR * 0.065) * this.zoomScale;
    }

    return nodes;
  }

  public render(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    const ctx = this.ctx;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    this.centerX = width / 2 + this.panX;
    this.centerY = height / 2 + this.panY;

    const maxR = (Math.min(width, height) / 2 - 14) * this.zoomScale;
    const transitBandR = this.showTransitRing ? maxR : maxR;
    const zodiacOuterR = this.showTransitRing ? maxR * 0.90 : maxR * 0.96;
    const zodiacInnerR = zodiacOuterR * 0.82;
    const houseNumberInnerR = zodiacInnerR * 0.52;
    const aspectCircleR = zodiacInnerR * 0.46;

    this.outerRadius = maxR;
    this.houseOuterRadius = zodiacInnerR;
    this.houseInnerRadius = aspectCircleR;

    // 1. Deep Ambient Cosmic Halo Background
    const bgGrad = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      aspectCircleR * 0.1,
      this.centerX,
      this.centerY,
      maxR * 1.06
    );
    bgGrad.addColorStop(0, '#131926');
    bgGrad.addColorStop(0.55, '#0E131D');
    bgGrad.addColorStop(1, '#0B0E14');

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, maxR * 1.02, 0, Math.PI * 2);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 2. Optional Outer Live Transit Ring
    if (this.showTransitRing) {
      this.drawTransitRing(ctx, zodiacOuterR, transitBandR);
    }

    // 3. Outer Zodiac Belt (12 Signs, Element Colors, Glyphs, Names & Degree Ticks)
    this.drawZodiacBelt(ctx, zodiacInnerR, zodiacOuterR);

    // 4. Placidus House Slices (1..12) + Highlight Selected House
    this.drawHouseSlices(ctx, aspectCircleR, houseNumberInnerR, zodiacInnerR);

    // 5. Central Aspect Geometry Web
    this.drawAspectWeb(ctx, aspectCircleR);

    // 6. Cardinal Axes (ASC-DSC Gold Horizon & MC-IC Turquoise Meridian)
    this.drawCardinalAxes(ctx, aspectCircleR, zodiacInnerR, zodiacOuterR);

    // 7. Natal Planets, Degree Labels & Conjunction Tiering
    this.placedPlanets = this.computePlanetNodes(zodiacInnerR);
    this.drawNatalPlanets(ctx, zodiacInnerR, aspectCircleR);

    // 8. Center Sacred Core Medallion
    this.drawCenterHub(ctx, aspectCircleR * 0.14);

    ctx.restore();
  }

  private drawTransitRing(
    ctx: CanvasRenderingContext2D,
    innerR: number,
    outerR: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, outerR, 0, Math.PI * 2);
    ctx.arc(this.centerX, this.centerY, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    const midR = (innerR + outerR) / 2;
    const sortedTransits = [...this.chart.transitPlanets].sort(
      (a, b) => a.longitude - b.longitude
    );
    const displayLons = sortedTransits.map((p) => p.longitude);

    // Prevent overlap on transit ring
    for (let iter = 0; iter < 10; iter++) {
      for (let i = 0; i < displayLons.length; i++) {
        const j = (i + 1) % displayLons.length;
        let diff = normalizeDeg(displayLons[j] - displayLons[i]);
        if (diff > 180) diff -= 360;
        if (Math.abs(diff) < 4.0) {
          const push = (4.0 - Math.abs(diff)) * 0.5;
          displayLons[i] = normalizeDeg(displayLons[i] - push);
          displayLons[j] = normalizeDeg(displayLons[j] + push);
        }
      }
    }

    sortedTransits.forEach((tp, idx) => {
      const trueRad = this.lonToCanvasRad(tp.longitude);
      const dispRad = this.lonToCanvasRad(displayLons[idx]);

      const tickX1 = this.centerX + Math.cos(trueRad) * innerR;
      const tickY1 = this.centerY + Math.sin(trueRad) * innerR;
      const tickX2 = this.centerX + Math.cos(dispRad) * (midR - 7);
      const tickY2 = this.centerY + Math.sin(dispRad) * (midR - 7);

      ctx.beginPath();
      ctx.moveTo(tickX1, tickY1);
      ctx.lineTo(tickX2, tickY2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const gx = this.centerX + Math.cos(dispRad) * midR;
      const gy = this.centerY + Math.sin(dispRad) * midR;

      // Check if this transit planet has an active tight aspect
      const hasActive = this.chart.activeTransits.some(
        (at) => at.transitBody.id === tp.id
      );

      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(8, (outerR - innerR) * 0.36), 0, Math.PI * 2);
      ctx.fillStyle = hasActive ? 'rgba(6, 182, 212, 0.26)' : 'rgba(21, 25, 33, 0.9)';
      ctx.fill();
      ctx.strokeStyle = hasActive ? '#06B6D4' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = hasActive ? 1.4 : 0.8;
      ctx.stroke();

      const trFontPx = Math.max(10, Math.round((outerR - innerR) * 0.46));
      ctx.fillStyle = hasActive ? '#67E8F9' : '#94A3B8';
      ctx.font = `600 ${trFontPx}px "Apple Symbols", "Segoe UI Symbol", "Inter", system-ui, sans-serif`;
      this.drawCenteredGlyph(ctx, tp.glyph, gx, gy, trFontPx);
    });

    ctx.restore();
  }

  private drawZodiacBelt(
    ctx: CanvasRenderingContext2D,
    innerR: number,
    outerR: number
  ): void {
    const bandWidth = outerR - innerR;

    for (const sign of ZODIAC_SIGNS) {
      const startLon = sign.index * 30;
      const endLon = (sign.index + 1) * 30;
      const midLon = startLon + 15;

      // Note: Canvas arc angles go clockwise, while our lonToCanvasRad decreases as lon increases
      const startRad = this.lonToCanvasRad(startLon);
      const endRad = this.lonToCanvasRad(endLon);
      const midRad = this.lonToCanvasRad(midLon);
      const elStyle = ELEMENT_COLORS[sign.element];

      const sel = this.selection;
      const isSignHighlighted =
        (sel?.kind === 'planet' &&
          this.chart.planets.find((p) => p.id === sel.id)?.sign.id ===
            sign.id) ||
        (sel?.kind === 'angle' &&
          this.chart.angles[sel.id].sign.id === sign.id);

      // Draw sector background
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, outerR, endRad, startRad, false);
      ctx.arc(this.centerX, this.centerY, innerR, startRad, endRad, true);
      ctx.closePath();

      ctx.fillStyle = isSignHighlighted ? elStyle.bgTint : 'rgba(21, 25, 33, 0.88)';
      ctx.fill();

      // Outer colored element arc
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, outerR - 1.5, endRad, startRad, false);
      ctx.strokeStyle = elStyle.primary;
      ctx.lineWidth = isSignHighlighted ? 4 : 2.5;
      ctx.stroke();

      // Radial divider line between signs
      const divX1 = this.centerX + Math.cos(startRad) * innerR;
      const divY1 = this.centerY + Math.sin(startRad) * innerR;
      const divX2 = this.centerX + Math.cos(startRad) * outerR;
      const divY2 = this.centerY + Math.sin(startRad) * outerR;
      ctx.beginPath();
      ctx.moveTo(divX1, divY1);
      ctx.lineTo(divX2, divY2);
      ctx.strokeStyle = '#2D333B';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Degree ticks along the inner zodiac ring (every 1°, 5°, 10°)
      for (let d = 1; d < 30; d++) {
        const tickRad = this.lonToCanvasRad(startLon + d);
        const tickLen = d % 10 === 0 ? bandWidth * 0.22 : d % 5 === 0 ? bandWidth * 0.15 : bandWidth * 0.08;
        const tx1 = this.centerX + Math.cos(tickRad) * innerR;
        const ty1 = this.centerY + Math.sin(tickRad) * innerR;
        const tx2 = this.centerX + Math.cos(tickRad) * (innerR + tickLen);
        const ty2 = this.centerY + Math.sin(tickRad) * (innerR + tickLen);
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle =
          d % 10 === 0 ? 'rgba(226, 232, 240, 0.45)' : 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = d % 10 === 0 ? 1.1 : 0.75;
        ctx.stroke();
      }

      // Sign Glyph & Short Name
      const glyphR = innerR + bandWidth * 0.62;
      const labelR = innerR + bandWidth * 0.29;
      const gx = this.centerX + Math.cos(midRad) * glyphR;
      const gy = this.centerY + Math.sin(midRad) * glyphR;
      const lx = this.centerX + Math.cos(midRad) * labelR;
      const ly = this.centerY + Math.sin(midRad) * labelR;

      ctx.save();
      if (isSignHighlighted) {
        ctx.shadowColor = elStyle.primary;
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = elStyle.primary;
      ctx.font = `700 ${Math.max(13, Math.round(bandWidth * 0.38))}px "Inter", "Segoe UI Symbol", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.glyph, gx, gy);
      ctx.restore();

      ctx.fillStyle = isSignHighlighted ? '#F8FAFC' : '#94A3B8';
      ctx.font = `600 ${Math.max(8, Math.round(bandWidth * 0.19))}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.name.toLocaleUpperCase('tr-TR'), lx, ly);
    }

    // Inner & Outer ring borders
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = '#2D333B';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawHouseSlices(
    ctx: CanvasRenderingContext2D,
    aspectR: number,
    numberRingR: number,
    zodiacInnerR: number
  ): void {
    const houses = this.chart.houses;

    for (let i = 0; i < 12; i++) {
      const cusp = houses[i];
      const nextCusp = houses[(i + 1) % 12];
      const startRad = this.lonToCanvasRad(cusp.longitude);
      const endRad = this.lonToCanvasRad(nextCusp.longitude);

      const sel = this.selection;
      const isSelectedHouse =
        (sel?.kind === 'house' && sel.house === cusp.house) ||
        (sel?.kind === 'planet' &&
          this.chart.planets.find((p) => p.id === sel.id)?.house ===
            cusp.house);

      // Fill slice if selected
      if (isSelectedHouse) {
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, zodiacInnerR, endRad, startRad, false);
        ctx.arc(this.centerX, this.centerY, aspectR, startRad, endRad, true);
        ctx.closePath();
        ctx.fillStyle =
          this.selection?.kind === 'house'
            ? 'rgba(56, 189, 248, 0.13)'
            : 'rgba(245, 158, 11, 0.07)';
        ctx.fill();
      }

      // Cusp spoke line (skip 1, 4, 7, 10 as they are drawn as bold cardinal axes)
      const isCardinal =
        cusp.house === 1 || cusp.house === 4 || cusp.house === 7 || cusp.house === 10;
      if (!isCardinal) {
        const x1 = this.centerX + Math.cos(startRad) * aspectR;
        const y1 = this.centerY + Math.sin(startRad) * aspectR;
        const x2 = this.centerX + Math.cos(startRad) * zodiacInnerR;
        const y2 = this.centerY + Math.sin(startRad) * zodiacInnerR;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isSelectedHouse
          ? 'rgba(56, 189, 248, 0.6)'
          : 'rgba(45, 51, 59, 0.95)';
        ctx.lineWidth = isSelectedHouse ? 1.5 : 1;
        ctx.stroke();
      }

      // House number badge (1..12)
      const spanDeg = normalizeDeg(nextCusp.longitude - cusp.longitude);
      const midLon = normalizeDeg(cusp.longitude + spanDeg / 2);
      const midRad = this.lonToCanvasRad(midLon);
      const numR = (aspectR + numberRingR) * 0.5;
      const nx = this.centerX + Math.cos(midRad) * numR;
      const ny = this.centerY + Math.sin(midRad) * numR;

      ctx.beginPath();
      ctx.arc(nx, ny, Math.max(9, aspectR * 0.085), 0, Math.PI * 2);
      ctx.fillStyle = isSelectedHouse
        ? 'rgba(56, 189, 248, 0.25)'
        : 'rgba(15, 20, 28, 0.85)';
      ctx.fill();
      ctx.strokeStyle = isSelectedHouse ? '#38BDF8' : 'rgba(45, 51, 59, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isSelectedHouse ? '#F8FAFC' : '#64748B';
      ctx.font = `700 ${Math.max(9, Math.round(aspectR * 0.095))}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cusp.house), nx, ny + 0.5);
    }

    // Subtle house number ring divider
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, numberRingR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(45, 51, 59, 0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Inner aspect boundary circle
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, aspectR, 0, Math.PI * 2);
    ctx.strokeStyle = '#2D333B';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  private drawCardinalAxes(
    ctx: CanvasRenderingContext2D,
    aspectR: number,
    zodiacInnerR: number,
    zodiacOuterR: number
  ): void {
    this.placedAngles = [];
    const { asc, dsc, mc, ic } = this.chart.angles;

    const drawAxisLine = (
      angleA: typeof asc,
      angleB: typeof dsc,
      color: string,
      glowColor: string
    ) => {
      const radA = this.lonToCanvasRad(angleA.longitude);
      const radB = this.lonToCanvasRad(angleB.longitude);

      const ax1 = this.centerX + Math.cos(radA) * aspectR;
      const ay1 = this.centerY + Math.sin(radA) * aspectR;
      const ax2 = this.centerX + Math.cos(radA) * (zodiacInnerR + 4);
      const ay2 = this.centerY + Math.sin(radA) * (zodiacInnerR + 4);

      const bx1 = this.centerX + Math.cos(radB) * aspectR;
      const by1 = this.centerY + Math.sin(radB) * aspectR;
      const bx2 = this.centerX + Math.cos(radB) * zodiacInnerR;
      const by2 = this.centerY + Math.sin(radB) * zodiacInnerR;

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;

      // Primary pole (ASC or MC)
      ctx.beginPath();
      ctx.moveTo(ax1, ay1);
      ctx.lineTo(ax2, ay2);
      ctx.stroke();

      // Opposite pole (DSC or IC)
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(bx1, by1);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
      ctx.restore();

      // Place interactive pill badges for both ends
      const badgeR = zodiacInnerR * 0.89;
      for (const ang of [angleA, angleB]) {
        const rad = this.lonToCanvasRad(ang.longitude);
        const bx = this.centerX + Math.cos(rad) * badgeR;
        const by = this.centerY + Math.sin(rad) * badgeR;
        const isSelected =
          this.selection?.kind === 'angle' && this.selection.id === ang.id;

        ctx.save();
        if (isSelected) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
        }
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(12, zodiacOuterR * 0.045), 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? color : '#0B0E14';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2.2 : 1.6;
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#0B0E14' : color;
        ctx.font = `800 ${Math.max(8, Math.round(zodiacOuterR * 0.033))}px "Inter", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ang.shortLabel, bx, by + 0.5);
        ctx.restore();

        this.placedAngles.push({
          id: ang.id,
          label: ang.shortLabel,
          longitude: ang.longitude,
          screenX: bx,
          screenY: by,
          hitRadius: Math.max(16, zodiacOuterR * 0.055),
          color
        });
      }
    };

    // Horizon Axis: ASC - DSC (Gold)
    drawAxisLine(asc, dsc, '#F59E0B', 'rgba(245, 158, 11, 0.55)');
    // Meridian Zenith Axis: MC - IC (Turquoise)
    drawAxisLine(mc, ic, '#06B6D4', 'rgba(6, 182, 212, 0.55)');
  }

  private drawAspectWeb(ctx: CanvasRenderingContext2D, aspectR: number): void {
    const getPointLon = (id: BodyId | AngleId): number | null => {
      const p = this.chart.planets.find((pl) => pl.id === id);
      if (p) return p.longitude;
      if (id in this.chart.angles) {
        return this.chart.angles[id as AngleId].longitude;
      }
      return null;
    };

    const selectedId =
      this.selection?.kind === 'planet' || this.selection?.kind === 'angle'
        ? this.selection.id
        : null;

    for (const aspect of this.chart.natalAspects) {
      const lonA = getPointLon(aspect.bodyA);
      const lonB = getPointLon(aspect.bodyB);
      if (lonA === null || lonB === null) continue;

      const isRelatedToSelection =
        !selectedId || aspect.bodyA === selectedId || aspect.bodyB === selectedId;

      const radA = this.lonToCanvasRad(lonA);
      const radB = this.lonToCanvasRad(lonB);

      const x1 = this.centerX + Math.cos(radA) * (aspectR - 2);
      const y1 = this.centerY + Math.sin(radA) * (aspectR - 2);
      const x2 = this.centerX + Math.cos(radB) * (aspectR - 2);
      const y2 = this.centerY + Math.sin(radB) * (aspectR - 2);

      // Opacity and thickness based on orb accuracy & selection state
      const orbFactor = Math.max(0.2, 1 - aspect.orb / aspect.maxOrb);
      const alpha = isRelatedToSelection
        ? selectedId
          ? 0.92
          : 0.35 + orbFactor * 0.45
        : 0.08;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = aspect.color;
      ctx.lineWidth =
        isRelatedToSelection && selectedId
          ? 1.6 + orbFactor * 1.4
          : 0.8 + orbFactor * 1.1;

      if (aspect.type === 'sextile') {
        ctx.setLineDash([4, 3]);
      }

      if (aspect.type === 'conjunction') {
        // Draw golden arc glow along the inner rim for conjunctions
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, aspectR - 3, radA, radB, true);
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Draw aspect symbol at midpoint when a specific planet/angle is selected
      if (selectedId && isRelatedToSelection && aspect.type !== 'conjunction') {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(mx, my, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#0B0E14';
        ctx.fill();
        ctx.strokeStyle = aspect.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = aspect.color;
        ctx.font = '700 10px "Inter", "Segoe UI Symbol", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(aspect.glyph, mx, my + 0.5);
      }

      ctx.restore();
    }
  }

  private drawNatalPlanets(
    ctx: CanvasRenderingContext2D,
    zodiacInnerR: number,
    aspectR: number
  ): void {
    for (const node of this.placedPlanets) {
      const { planet, trueLon, displayLon, screenX, screenY } = node;
      const trueRad = this.lonToCanvasRad(trueLon);
      const dispRad = this.lonToCanvasRad(displayLon);
      const elStyle = ELEMENT_COLORS[planet.sign.element];

      const isSelected =
        this.selection?.kind === 'planet' && this.selection.id === planet.id;

      // 1. Exact degree tick & leader line from zodiac inner rim to planet node
      const rimX = this.centerX + Math.cos(trueRad) * zodiacInnerR;
      const rimY = this.centerY + Math.sin(trueRad) * zodiacInnerR;
      const kneeR = zodiacInnerR * 0.94;
      const kneeX = this.centerX + Math.cos(trueRad) * kneeR;
      const kneeY = this.centerY + Math.sin(trueRad) * kneeR;

      const nodeRadius = Math.max(13, zodiacInnerR * 0.068);
      const edgeX = screenX + Math.cos(dispRad) * (nodeRadius + 2);
      const edgeY = screenY + Math.sin(dispRad) * (nodeRadius + 2);

      ctx.beginPath();
      ctx.moveTo(rimX, rimY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(edgeX, edgeY);
      ctx.strokeStyle = isSelected ? elStyle.primary : 'rgba(148, 163, 184, 0.42)';
      ctx.lineWidth = isSelected ? 1.6 : 0.9;
      ctx.stroke();

      // Exact degree dot on the aspect circle too
      const innerDotX = this.centerX + Math.cos(trueRad) * (aspectR - 2);
      const innerDotY = this.centerY + Math.sin(trueRad) * (aspectR - 2);
      ctx.beginPath();
      ctx.arc(innerDotX, innerDotY, isSelected ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? elStyle.primary : '#94A3B8';
      ctx.fill();

      // 2. Planet Circular Badge
      ctx.save();
      if (isSelected) {
        ctx.shadowColor = elStyle.primary;
        ctx.shadowBlur = 18;
      }

      ctx.beginPath();
      ctx.arc(screenX, screenY, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? elStyle.primary : '#151921';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#FFFFFF' : elStyle.primary;
      ctx.lineWidth = isSelected ? 2.2 : 1.5;
      ctx.stroke();

      // Planet Glyph
      const natalFontPx = Math.max(12, Math.round(nodeRadius * 1.05));
      ctx.fillStyle = isSelected ? '#0B0E14' : '#F8FAFC';
      ctx.font = `700 ${natalFontPx}px "Apple Symbols", "Segoe UI Symbol", "Inter", sans-serif`;
      this.drawCenteredGlyph(ctx, planet.glyph, screenX, screenY, natalFontPx);
      ctx.restore();

      // 3. Degree + Retrograde Label inward along the ray
      const degInt = Math.floor(planet.signDegree);
      const degLabel = `${degInt}°${planet.isRetrograde ? '℞' : ''}`;
      const labelDist = nodeRadius + Math.max(10, zodiacInnerR * 0.048);
      const lx = screenX - Math.cos(dispRad) * labelDist;
      const ly = screenY - Math.sin(dispRad) * labelDist;

      ctx.fillStyle = isSelected
        ? '#FDE68A'
        : planet.isRetrograde
          ? '#FCA5A5'
          : '#CBD5E1';
      ctx.font = `600 ${Math.max(8, Math.round(zodiacInnerR * 0.042))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(degLabel, lx, ly);
    }
  }

  private drawCenterHub(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0B0E14';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#38BDF8';
    ctx.fill();
    ctx.restore();
  }

  private bindInteractionEvents(): void {
    const getLocalCoords = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      // On touch devices when single-finger scroll mode is active, allow native vertical page scroll unless 2 fingers or mouse
      if (e.pointerType === 'touch' && !this.touchRotateEnabled && this.activePointers.size === 0) {
        const pt = getLocalCoords(e.clientX, e.clientY);
        this.activePointers.set(e.pointerId, pt);
        this.isDragging = false;
        this.dragMoved = false;
        return;
      }

      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore pointer capture errors on passive touch
      }
      const pt = getLocalCoords(e.clientX, e.clientY);
      this.activePointers.set(e.pointerId, pt);

      if (this.activePointers.size === 1) {
        this.isDragging = true;
        this.dragMoved = false;
        this.lastPointerAngle =
          (Math.atan2(pt.y - this.centerY, pt.x - this.centerX) * 180) / Math.PI;
      } else if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        this.initialPinchDistance = Math.hypot(
          pts[1].x - pts[0].x,
          pts[1].y - pts[0].y
        );
        this.initialPinchZoom = this.zoomScale;
        this.initialPinchAngle =
          (Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI;
        this.initialPinchRotation = this.userRotationDeg;
      }
    });

    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.activePointers.has(e.pointerId)) return;
      const prevPt = this.activePointers.get(e.pointerId)!;
      const pt = getLocalCoords(e.clientX, e.clientY);
      this.activePointers.set(e.pointerId, pt);

      if (e.pointerType === 'touch' && !this.touchRotateEnabled && this.activePointers.size === 1) {
        if (Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y) > 8) {
          this.dragMoved = true;
        }
        return;
      }

      if (this.activePointers.size === 1 && this.isDragging) {
        const currentAngle =
          (Math.atan2(pt.y - this.centerY, pt.x - this.centerX) * 180) / Math.PI;
        let deltaAngle = currentAngle - this.lastPointerAngle;
        if (deltaAngle > 180) deltaAngle -= 360;
        if (deltaAngle < -180) deltaAngle += 360;

        if (Math.abs(deltaAngle) > 0.6) {
          this.dragMoved = true;
          this.userRotationDeg = normalizeDeg(this.userRotationDeg + deltaAngle);
          this.lastPointerAngle = currentAngle;
          this.render();
        }
      } else if (this.activePointers.size === 2) {
        this.dragMoved = true;
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (this.initialPinchDistance > 10) {
          const scaleRatio = dist / this.initialPinchDistance;
          this.zoomScale = Math.max(
            0.85,
            Math.min(2.5, this.initialPinchZoom * scaleRatio)
          );
        }
        const pinchAngle =
          (Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI;
        const rotDiff = pinchAngle - this.initialPinchAngle;
        this.userRotationDeg = normalizeDeg(this.initialPinchRotation + rotDiff);
        this.render();
      }
    });

    const handlePointerUp = (e: PointerEvent) => {
      const pt = getLocalCoords(e.clientX, e.clientY);
      const wasTap = this.activePointers.size === 1 && !this.dragMoved;
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size === 0) {
        this.isDragging = false;
      }

      if (wasTap) {
        this.handleHitTest(pt.x, pt.y);
      }
    };

    this.canvas.addEventListener('pointerup', handlePointerUp);
    this.canvas.addEventListener('pointercancel', handlePointerUp);

    // Desktop wheel zoom
    this.canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        this.adjustZoom(delta);
      },
      { passive: false }
    );
  }

  private handleHitTest(x: number, y: number): void {
    // 1. Check Natal Planets first
    for (const node of this.placedPlanets) {
      const dist = Math.hypot(x - node.screenX, y - node.screenY);
      if (dist <= node.hitRadius) {
        this.setSelection({ kind: 'planet', id: node.planet.id }, true);
        return;
      }
    }

    // 2. Check Cardinal Angles (ASC, MC, DSC, IC)
    for (const ang of this.placedAngles) {
      const dist = Math.hypot(x - ang.screenX, y - ang.screenY);
      if (dist <= ang.hitRadius) {
        this.setSelection({ kind: 'angle', id: ang.id }, true);
        return;
      }
    }

    // 3. Check House Slices (between houseInnerRadius and houseOuterRadius)
    const distFromCenter = Math.hypot(x - this.centerX, y - this.centerY);
    if (
      distFromCenter >= this.houseInnerRadius * 0.85 &&
      distFromCenter <= this.houseOuterRadius
    ) {
      const clickedLon = this.canvasPointToLon(x, y);
      for (let i = 0; i < 12; i++) {
        const start = this.chart.houses[i].longitude;
        const end = this.chart.houses[(i + 1) % 12].longitude;
        const span = normalizeDeg(end - start);
        const rel = normalizeDeg(clickedLon - start);
        if (rel < span) {
          this.setSelection({ kind: 'house', house: i + 1 }, true);
          return;
        }
      }
    }
  }
}
