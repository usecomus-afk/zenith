export type ZodiacSignId =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export type ElementType = 'fire' | 'earth' | 'air' | 'water';
export type ModalityType = 'cardinal' | 'fixed' | 'mutable';

export type BodyId =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'true_node';

export type AngleId = 'asc' | 'dsc' | 'mc' | 'ic';

export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export interface ZodiacSignMeta {
  id: ZodiacSignId;
  index: number; // 0..11
  name: string;
  shortName: string;
  glyph: string;
  element: ElementType;
  elementName: string;
  modality: ModalityType;
  modalityName: string;
  ruler: BodyId;
  classicalRuler: BodyId;
  keywords: string[];
}

export interface CityLocation {
  id: string;
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string; // IANA timezone e.g. 'Europe/Istanbul'
}

export interface BirthInput {
  fullName: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  location: CityLocation;
}

export interface PlanetPosition {
  id: BodyId;
  name: string;
  glyph: string;
  longitude: number; // 0..360 geocentric tropical
  latitude: number;
  speed: number; // deg/day
  isRetrograde: boolean;
  sign: ZodiacSignMeta;
  signDegree: number; // 0..29.999
  degreeFormatted: string; // e.g. "18° 42'"
  fullFormatted: string; // e.g. "18° 42' Akrep"
  house: number; // 1..12
  dispositorId: BodyId;
  dignity?: 'Yönetici' | 'Yücelim' | 'Zarar' | 'Düşüş' | 'Peregrin';
}

export interface AnglePosition {
  id: AngleId;
  name: string;
  shortLabel: string;
  glyph: string;
  longitude: number;
  sign: ZodiacSignMeta;
  signDegree: number;
  degreeFormatted: string;
  fullFormatted: string;
}

export interface HouseCusp {
  house: number; // 1..12
  longitude: number; // 0..360
  sign: ZodiacSignMeta;
  signDegree: number;
  degreeFormatted: string;
  rulerId: BodyId;
}

export interface NatalAspect {
  id: string;
  bodyA: BodyId | AngleId;
  bodyAName: string;
  bodyAGlyph: string;
  bodyB: BodyId | AngleId;
  bodyBName: string;
  bodyBGlyph: string;
  type: AspectType;
  typeName: string;
  glyph: string;
  exactAngle: number; // 0, 60, 90, 120, 180
  actualAngle: number;
  orb: number; // absolute difference from exactAngle
  maxOrb: number;
  isApplying: boolean;
  nature: 'harmonious' | 'challenging' | 'intense';
  color: string;
}

export interface TransitAspect {
  id: string;
  transitBody: PlanetPosition;
  natalTarget: PlanetPosition | AnglePosition;
  natalHouse: number;
  transitHouse: number;
  type: AspectType;
  typeName: string;
  glyph: string;
  exactAngle: number;
  orb: number; // <= 2.0 deg
  isApplying: boolean;
  nature: 'harmonious' | 'challenging' | 'intense';
  headline: string;
  summary: string;
  actionAdvice: string;
  intensityScore: number; // 0..100 based on orb tightness & planet weight
}

export interface FourLayerSynthesis {
  planet: PlanetPosition;
  layer1Location: {
    title: string;
    signTheme: string;
    houseArena: string;
    narrative: string;
  };
  layer2AspectModulation: {
    title: string;
    dominantTone: string;
    aspectBullets: Array<{
      aspect: NatalAspect;
      modulationText: string;
    }>;
    synthesisText: string;
  };
  layer3Dispositor: {
    title: string;
    rulerName: string;
    rulerGlyph: string;
    rulerSign: string;
    rulerHouse: number;
    isSelfRuled: boolean;
    isMutualReception: boolean;
    chainNarrative: string;
  };
  layer4TransitSummary: {
    title: string;
    hasTightTransit: boolean;
    activeTransits: TransitAspect[];
    bulletinText: string;
  };
}

export interface ChartCalculationResult {
  input: BirthInput;
  utcDate: Date;
  transitUtcDate: Date;
  utcOffsetHours: number;
  utcOffsetFormatted: string;
  julianDay: number;
  localSiderealTimeDeg: number;
  houseSystem: 'Placidus' | 'Placidus (Yüksek Enlem Porphyry Uyarlaması)';
  planets: PlanetPosition[];
  angles: Record<AngleId, AnglePosition>;
  houses: HouseCusp[];
  natalAspects: NatalAspect[];
  transitPlanets: PlanetPosition[];
  activeTransits: TransitAspect[];
  syntheses: Record<BodyId, FourLayerSynthesis>;
  elementCounts: Record<ElementType, { count: number; percentage: number; bodies: string[] }>;
  modalityCounts: Record<ModalityType, { count: number; percentage: number; bodies: string[] }>;
  chartRuler: PlanetPosition;
}

export type WheelSelection =
  | { kind: 'planet'; id: BodyId }
  | { kind: 'angle'; id: AngleId }
  | { kind: 'house'; house: number }
  | null;
