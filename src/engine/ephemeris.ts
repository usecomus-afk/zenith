import {
  Body,
  MakeTime,
  GeoVector,
  Rotation_EQJ_ECT,
  RotateVector,
  SphereFromVector,
  SiderealTime,
  e_tilt,
  AstroTime
} from 'astronomy-engine';
import {
  AngleId,
  AnglePosition,
  AspectType,
  BirthInput,
  BodyId,
  ChartCalculationResult,
  ElementType,
  HouseCusp,
  ModalityType,
  NatalAspect,
  PlanetPosition,
  TransitAspect,
  ZodiacSignId,
  ZodiacSignMeta
} from '../types/astrology';
import { resolveLocalToUtc } from '../data/locations';
import { buildChartSyntheses, generateTransitBulletin } from './interpretation';

export const ZODIAC_SIGNS: ZodiacSignMeta[] = [
  {
    id: 'aries',
    index: 0,
    name: 'Koç',
    shortName: 'Koç',
    glyph: '♈\uFE0E',
    element: 'fire',
    elementName: 'Ateş',
    modality: 'cardinal',
    modalityName: 'Öncü',
    ruler: 'mars',
    classicalRuler: 'mars',
    keywords: ['Başlatıcı İrade', 'Cesaret', 'Otonomi']
  },
  {
    id: 'taurus',
    index: 1,
    name: 'Boğa',
    shortName: 'Boğ',
    glyph: '♉\uFE0E',
    element: 'earth',
    elementName: 'Toprak',
    modality: 'fixed',
    modalityName: 'Sabit',
    ruler: 'venus',
    classicalRuler: 'venus',
    keywords: ['İstikrar', 'Duyusal Değer', 'Somutlaştırma']
  },
  {
    id: 'gemini',
    index: 2,
    name: 'İkizler',
    shortName: 'İki',
    glyph: '♊\uFE0E',
    element: 'air',
    elementName: 'Hava',
    modality: 'mutable',
    modalityName: 'Değişken',
    ruler: 'mercury',
    classicalRuler: 'mercury',
    keywords: ['Analitik Merak', 'İletişim Ağı', 'Esneklik']
  },
  {
    id: 'cancer',
    index: 3,
    name: 'Yengeç',
    shortName: 'Yen',
    glyph: '♋\uFE0E',
    element: 'water',
    elementName: 'Su',
    modality: 'cardinal',
    modalityName: 'Öncü',
    ruler: 'moon',
    classicalRuler: 'moon',
    keywords: ['Duygusal Hafıza', 'Koruyuculuk', 'Aidiyet']
  },
  {
    id: 'leo',
    index: 4,
    name: 'Aslan',
    shortName: 'Asl',
    glyph: '♌\uFE0E',
    element: 'fire',
    elementName: 'Ateş',
    modality: 'fixed',
    modalityName: 'Sabit',
    ruler: 'sun',
    classicalRuler: 'sun',
    keywords: ['Yaratıcı Öz', 'Karizma', 'Egemenlik']
  },
  {
    id: 'virgo',
    index: 5,
    name: 'Başak',
    shortName: 'Baş',
    glyph: '♍\uFE0E',
    element: 'earth',
    elementName: 'Toprak',
    modality: 'mutable',
    modalityName: 'Değişken',
    ruler: 'mercury',
    classicalRuler: 'mercury',
    keywords: ['Metodoloji', 'Arındırma', 'Ustalık']
  },
  {
    id: 'libra',
    index: 6,
    name: 'Terazi',
    shortName: 'Ter',
    glyph: '♎\uFE0E',
    element: 'air',
    elementName: 'Hava',
    modality: 'cardinal',
    modalityName: 'Öncü',
    ruler: 'venus',
    classicalRuler: 'venus',
    keywords: ['Diplomasi', 'Estetik Denge', 'Adalet']
  },
  {
    id: 'scorpio',
    index: 7,
    name: 'Akrep',
    shortName: 'Akr',
    glyph: '♏\uFE0E',
    element: 'water',
    elementName: 'Su',
    modality: 'fixed',
    modalityName: 'Sabit',
    ruler: 'pluto',
    classicalRuler: 'mars',
    keywords: ['Dönüşüm', 'Stratejik Derinlik', 'Manyetizma']
  },
  {
    id: 'sagittarius',
    index: 8,
    name: 'Yay',
    shortName: 'Yay',
    glyph: '♐\uFE0E',
    element: 'fire',
    elementName: 'Ateş',
    modality: 'mutable',
    modalityName: 'Değişken',
    ruler: 'jupiter',
    classicalRuler: 'jupiter',
    keywords: ['Vizyoner Ufuk', 'Felsefe', 'Keşif']
  },
  {
    id: 'capricorn',
    index: 9,
    name: 'Oğlak',
    shortName: 'Oğl',
    glyph: '♑\uFE0E',
    element: 'earth',
    elementName: 'Toprak',
    modality: 'cardinal',
    modalityName: 'Öncü',
    ruler: 'saturn',
    classicalRuler: 'saturn',
    keywords: ['Mimari Disiplin', 'Otorite', 'Kalıcı Başarı']
  },
  {
    id: 'aquarius',
    index: 10,
    name: 'Kova',
    shortName: 'Kov',
    glyph: '♒\uFE0E',
    element: 'air',
    elementName: 'Hava',
    modality: 'fixed',
    modalityName: 'Sabit',
    ruler: 'uranus',
    classicalRuler: 'saturn',
    keywords: ['İnovasyon', 'Kolektif Bilinç', 'Özgünlük']
  },
  {
    id: 'pisces',
    index: 11,
    name: 'Balık',
    shortName: 'Bal',
    glyph: '♓\uFE0E',
    element: 'water',
    elementName: 'Su',
    modality: 'mutable',
    modalityName: 'Değişken',
    ruler: 'neptune',
    classicalRuler: 'jupiter',
    keywords: ['Sezgisel Bütünlük', 'Empati', 'Aşkınlık']
  }
];

export const BODY_META: Array<{ id: BodyId; name: string; glyph: string; astroBody?: Body }> = [
  { id: 'sun', name: 'Güneş', glyph: '☉', astroBody: Body.Sun },
  { id: 'moon', name: 'Ay', glyph: '☽', astroBody: Body.Moon },
  { id: 'mercury', name: 'Merkür', glyph: '☿', astroBody: Body.Mercury },
  { id: 'venus', name: 'Venüs', glyph: '♀', astroBody: Body.Venus },
  { id: 'mars', name: 'Mars', glyph: '♂', astroBody: Body.Mars },
  { id: 'jupiter', name: 'Jüpiter', glyph: '♃', astroBody: Body.Jupiter },
  { id: 'saturn', name: 'Satürn', glyph: '♄', astroBody: Body.Saturn },
  { id: 'uranus', name: 'Uranüs', glyph: '♅', astroBody: Body.Uranus },
  { id: 'neptune', name: 'Neptün', glyph: '♆', astroBody: Body.Neptune },
  { id: 'pluto', name: 'Plüton', glyph: '♇', astroBody: Body.Pluto },
  { id: 'true_node', name: 'Kuzey Ay Düğümü', glyph: '☊' }
];

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function normalizeDeg(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

export function shortestAngularDistance(lonA: number, lonB: number): number {
  const diff = Math.abs(normalizeDeg(lonA) - normalizeDeg(lonB));
  return diff > 180 ? 360 - diff : diff;
}

export function formatDegreeMinute(degInSign: number): string {
  const clamped = Math.max(0, Math.min(29.9999, degInSign));
  const deg = Math.floor(clamped);
  const min = Math.floor((clamped - deg) * 60);
  return `${String(deg).padStart(2, '0')}° ${String(min).padStart(2, '0')}'`;
}

export function getSignFromLongitude(longitude: number): {
  sign: ZodiacSignMeta;
  signDegree: number;
  degreeFormatted: string;
  fullFormatted: string;
} {
  const norm = normalizeDeg(longitude);
  const index = Math.floor(norm / 30) % 12;
  const sign = ZODIAC_SIGNS[index];
  const signDegree = norm - index * 30;
  const degreeFormatted = formatDegreeMinute(signDegree);
  return {
    sign,
    signDegree,
    degreeFormatted,
    fullFormatted: `${degreeFormatted} ${sign.name}`
  };
}

/**
 * Computes True Geocentric Tropical Ecliptic of Date coordinates (longitude, latitude)
 */
function getTrueTropicalEcliptic(body: Body, time: AstroTime): { lon: number; lat: number } {
  const eqjVec = GeoVector(body, time, true);
  const rotMatrix = Rotation_EQJ_ECT(time);
  const ectVec = RotateVector(rotMatrix, eqjVec);
  const sphere = SphereFromVector(ectVec);
  return {
    lon: normalizeDeg(sphere.lon),
    lat: sphere.lat
  };
}

/**
 * Computes the Instantaneous True Lunar North Node (Gerçek Kuzey Ay Düğümü)
 * using the Moon's geocentric ecliptic position and velocity vectors: n = k x (r x v)
 */
function getTrueLunarNorthNodeLon(time: AstroTime): number {
  const dtDays = 0.01; // ~14.4 minutes
  const tMinus = time.AddDays(-dtDays);
  const tPlus = time.AddDays(dtDays);

  const rVec = RotateVector(Rotation_EQJ_ECT(time), GeoVector(Body.Moon, time, true));
  const rMinus = RotateVector(Rotation_EQJ_ECT(tMinus), GeoVector(Body.Moon, tMinus, true));
  const rPlus = RotateVector(Rotation_EQJ_ECT(tPlus), GeoVector(Body.Moon, tPlus, true));

  const vx = (rPlus.x - rMinus.x) / (2 * dtDays);
  const vy = (rPlus.y - rMinus.y) / (2 * dtDays);
  const vz = (rPlus.z - rMinus.z) / (2 * dtDays);

  // Specific angular momentum h = r x v
  const hx = rVec.y * vz - rVec.z * vy;
  const hy = rVec.z * vx - rVec.x * vz;

  // Ascending node vector n = (-hy, hx, 0)
  const nodeLonRad = Math.atan2(hx, -hy);
  return normalizeDeg(nodeLonRad * RAD2DEG);
}

/**
 * Computes the 4 Astrological Angles (ASC, DSC, MC, IC) and 12 Placidus House Cusps
 */
export function computePlacidusHousesAndAngles(
  utcDate: Date,
  latitude: number,
  longitude: number
): {
  angles: Record<AngleId, AnglePosition>;
  houses: HouseCusp[];
  localSiderealTimeDeg: number;
  houseSystem: 'Placidus' | 'Placidus (Yüksek Enlem Porphyry Uyarlaması)';
} {
  const time = MakeTime(utcDate);
  // Apparent Greenwich Sidereal Time in hours -> degrees
  const gmstHours = SiderealTime(time);
  const lstDeg = normalizeDeg(gmstHours * 15 + longitude);
  const ramcRad = lstDeg * DEG2RAD;

  // True obliquity of the ecliptic
  const tilt = e_tilt(time);
  const epsRad = tilt.tobl * DEG2RAD;
  const latRad = latitude * DEG2RAD;

  // 1. Midheaven (MC - 10th cusp) & IC (4th cusp)
  const mcRad = Math.atan2(Math.sin(ramcRad), Math.cos(ramcRad) * Math.cos(epsRad));
  const mcLon = normalizeDeg(mcRad * RAD2DEG);
  const icLon = normalizeDeg(mcLon + 180);

  // 2. Ascendant (ASC - 1st cusp) & Descendant (DSC - 7th cusp)
  // Standard formula preserving quadrant
  const ascY = Math.cos(ramcRad);
  const ascX = -Math.sin(ramcRad) * Math.cos(epsRad) - Math.tan(latRad) * Math.sin(epsRad);
  const ascLon = normalizeDeg(Math.atan2(ascY, ascX) * RAD2DEG);
  const dscLon = normalizeDeg(ascLon + 180);

  // Check if extreme latitude requires Porphyry fallback
  const maxSafeLat = 89.5 - tilt.tobl;
  let highLatFallback = Math.abs(latitude) >= maxSafeLat;

  const solvePlacidusCusp = (
    fraction: number,
    isDiurnal: boolean,
    initialLon: number
  ): number | null => {
    let lon = normalizeDeg(initialLon);
    for (let iter = 0; iter < 30; iter++) {
      const sinDec = Math.sin(lon * DEG2RAD) * Math.sin(epsRad);
      const cosDec = Math.sqrt(Math.max(1e-12, 1 - sinDec * sinDec));
      const tanDec = sinDec / cosDec;
      const arg = Math.tan(latRad) * tanDec;
      if (Math.abs(arg) >= 0.9998) {
        return null; // Circumpolar failure at extreme latitude
      }
      const adDeg = Math.asin(arg) * RAD2DEG;
      let targetRaDeg: number;
      if (isDiurnal) {
        // Above horizon from MC towards ASC (H11: f=1/3, H12: f=2/3)
        const dsaDeg = 90 + adDeg;
        targetRaDeg = normalizeDeg(lstDeg + fraction * dsaDeg);
      } else {
        // Below horizon from IC towards ASC backwards (H2: f=2/3 from IC, H3: f=1/3 from IC)
        const nsaDeg = 90 - adDeg;
        const raIcDeg = normalizeDeg(lstDeg + 180);
        targetRaDeg = normalizeDeg(raIcDeg - fraction * nsaDeg);
      }
      const raRad = targetRaDeg * DEG2RAD;
      const nextLon = normalizeDeg(
        Math.atan2(Math.sin(raRad), Math.cos(raRad) * Math.cos(epsRad)) * RAD2DEG
      );
      if (shortestAngularDistance(nextLon, lon) < 1e-4) {
        return nextLon;
      }
      lon = nextLon;
    }
    return lon;
  };

  // Porphyry trisection helper for initial guesses or high-latitude fallback
  const arcMCToASC = normalizeDeg(ascLon - mcLon);
  const arcASCToIC = normalizeDeg(icLon - ascLon);

  const porphyry11 = normalizeDeg(mcLon + arcMCToASC / 3);
  const porphyry12 = normalizeDeg(mcLon + (2 * arcMCToASC) / 3);
  const porphyry2 = normalizeDeg(ascLon + arcASCToIC / 3);
  const porphyry3 = normalizeDeg(ascLon + (2 * arcASCToIC) / 3);

  let cusp11 = porphyry11;
  let cusp12 = porphyry12;
  let cusp2 = porphyry2;
  let cusp3 = porphyry3;

  if (!highLatFallback) {
    const p11 = solvePlacidusCusp(1 / 3, true, porphyry11);
    const p12 = solvePlacidusCusp(2 / 3, true, porphyry12);
    const p2 = solvePlacidusCusp(2 / 3, false, porphyry2);
    const p3 = solvePlacidusCusp(1 / 3, false, porphyry3);

    if (p11 !== null && p12 !== null && p2 !== null && p3 !== null) {
      cusp11 = p11;
      cusp12 = p12;
      cusp2 = p2;
      cusp3 = p3;
    } else {
      highLatFallback = true;
    }
  }

  const rawCusps: number[] = [
    ascLon, // House 1
    cusp2, // House 2
    cusp3, // House 3
    icLon, // House 4
    normalizeDeg(cusp11 + 180), // House 5
    normalizeDeg(cusp12 + 180), // House 6
    dscLon, // House 7
    normalizeDeg(cusp2 + 180), // House 8
    normalizeDeg(cusp3 + 180), // House 9
    mcLon, // House 10
    cusp11, // House 11
    cusp12 // House 12
  ];

  const houses: HouseCusp[] = rawCusps.map((lon, idx) => {
    const info = getSignFromLongitude(lon);
    return {
      house: idx + 1,
      longitude: lon,
      sign: info.sign,
      signDegree: info.signDegree,
      degreeFormatted: info.degreeFormatted,
      rulerId: info.sign.ruler
    };
  });

  const makeAngle = (
    id: AngleId,
    name: string,
    shortLabel: string,
    glyph: string,
    lon: number
  ): AnglePosition => {
    const info = getSignFromLongitude(lon);
    return {
      id,
      name,
      shortLabel,
      glyph,
      longitude: lon,
      sign: info.sign,
      signDegree: info.signDegree,
      degreeFormatted: info.degreeFormatted,
      fullFormatted: info.fullFormatted
    };
  };

  const angles: Record<AngleId, AnglePosition> = {
    asc: makeAngle('asc', 'Yükselen (Ascendant)', 'ASC', 'ASC', ascLon),
    dsc: makeAngle('dsc', 'Alçalan (Descendant)', 'DSC', 'DSC', dscLon),
    mc: makeAngle('mc', 'Tepe Noktası (Zenith / MC)', 'MC', 'MC', mcLon),
    ic: makeAngle('ic', 'Dip Noktası (Imum Coeli)', 'IC', 'IC', icLon)
  };

  return {
    angles,
    houses,
    localSiderealTimeDeg: lstDeg,
    houseSystem: highLatFallback
      ? 'Placidus (Yüksek Enlem Porphyry Uyarlaması)'
      : 'Placidus'
  };
}

/**
 * Determines which house (1..12) an ecliptic longitude falls into
 */
export function findHouseForLongitude(lon: number, houses: HouseCusp[]): number {
  const normLon = normalizeDeg(lon);
  for (let i = 0; i < 12; i++) {
    const start = houses[i].longitude;
    const end = houses[(i + 1) % 12].longitude;
    const span = normalizeDeg(end - start);
    const rel = normalizeDeg(normLon - start);
    if (rel < span) {
      return i + 1;
    }
  }
  return 1;
}

const EXALTATION_MAP: Partial<Record<BodyId, ZodiacSignId>> = {
  sun: 'aries',
  moon: 'taurus',
  mercury: 'virgo',
  venus: 'pisces',
  mars: 'capricorn',
  jupiter: 'cancer',
  saturn: 'libra'
};

const FALL_MAP: Partial<Record<BodyId, ZodiacSignId>> = {
  sun: 'libra',
  moon: 'scorpio',
  mercury: 'pisces',
  venus: 'virgo',
  mars: 'cancer',
  jupiter: 'capricorn',
  saturn: 'aries'
};

function evaluateDignity(
  bodyId: BodyId,
  sign: ZodiacSignMeta
): 'Yönetici' | 'Yücelim' | 'Zarar' | 'Düşüş' | 'Peregrin' {
  if (sign.ruler === bodyId || sign.classicalRuler === bodyId) return 'Yönetici';
  if (EXALTATION_MAP[bodyId] === sign.id) return 'Yücelim';
  const oppSign = ZODIAC_SIGNS[(sign.index + 6) % 12];
  if (oppSign.ruler === bodyId || oppSign.classicalRuler === bodyId) return 'Zarar';
  if (FALL_MAP[bodyId] === sign.id) return 'Düşüş';
  return 'Peregrin';
}

/**
 * Computes all 10 major planets + True Node for a given UTC Date and House Cusps
 */
export function computePlanetsForUtc(utcDate: Date, houses: HouseCusp[]): PlanetPosition[] {
  const time = MakeTime(utcDate);
  const dtDays = 0.02; // ~28.8 minutes for velocity differentiation
  const tMinus = time.AddDays(-dtDays);
  const tPlus = time.AddDays(dtDays);

  return BODY_META.map((meta) => {
    let lon = 0;
    let lat = 0;
    let lonMinus = 0;
    let lonPlus = 0;

    if (meta.id === 'true_node') {
      lon = getTrueLunarNorthNodeLon(time);
      lonMinus = getTrueLunarNorthNodeLon(tMinus);
      lonPlus = getTrueLunarNorthNodeLon(tPlus);
    } else if (meta.astroBody !== undefined) {
      const pos = getTrueTropicalEcliptic(meta.astroBody, time);
      const posMinus = getTrueTropicalEcliptic(meta.astroBody, tMinus);
      const posPlus = getTrueTropicalEcliptic(meta.astroBody, tPlus);
      lon = pos.lon;
      lat = pos.lat;
      lonMinus = posMinus.lon;
      lonPlus = posPlus.lon;
    }

    let deltaLon = lonPlus - lonMinus;
    if (deltaLon > 180) deltaLon -= 360;
    if (deltaLon < -180) deltaLon += 360;
    const speed = deltaLon / (2 * dtDays);

    const signInfo = getSignFromLongitude(lon);
    const house = findHouseForLongitude(lon, houses);

    return {
      id: meta.id,
      name: meta.name,
      glyph: meta.glyph,
      longitude: lon,
      latitude: lat,
      speed,
      isRetrograde: speed < 0,
      sign: signInfo.sign,
      signDegree: signInfo.signDegree,
      degreeFormatted: signInfo.degreeFormatted,
      fullFormatted: signInfo.fullFormatted,
      house,
      dispositorId: signInfo.sign.ruler,
      dignity: evaluateDignity(meta.id, signInfo.sign)
    };
  });
}

interface AspectDefinition {
  type: AspectType;
  typeName: string;
  glyph: string;
  exactAngle: number;
  baseOrb: number;
  luminaryOrb: number;
  nature: 'harmonious' | 'challenging' | 'intense';
  color: string;
}

export const MAJOR_ASPECT_DEFS: AspectDefinition[] = [
  {
    type: 'conjunction',
    typeName: 'Kavuşum',
    glyph: '☌',
    exactAngle: 0,
    baseOrb: 7.0,
    luminaryOrb: 9.0,
    nature: 'intense',
    color: '#9A6B22' // Sıcak Bronz-Altın (usecomus sand)
  },
  {
    type: 'sextile',
    typeName: 'Sekstil',
    glyph: '⚹',
    exactAngle: 60,
    baseOrb: 5.0,
    luminaryOrb: 6.0,
    nature: 'harmonious',
    color: '#2B5B6C' // Derin Ege / Adaçayı Mavisi
  },
  {
    type: 'square',
    typeName: 'Kare',
    glyph: '□',
    exactAngle: 90,
    baseOrb: 6.5,
    luminaryOrb: 8.0,
    nature: 'challenging',
    color: '#B84322' // Terracotta Kiremit (usecomus rai-accent)
  },
  {
    type: 'trine',
    typeName: 'Üçgen',
    glyph: '△',
    exactAngle: 120,
    baseOrb: 7.0,
    luminaryOrb: 8.5,
    nature: 'harmonious',
    color: '#3B6D11' // Botanik Yeşili (usecomus green)
  },
  {
    type: 'opposition',
    typeName: 'Karşıt',
    glyph: '☍',
    exactAngle: 180,
    baseOrb: 7.0,
    luminaryOrb: 9.0,
    nature: 'challenging',
    color: '#9C4E24' // Koyu Terracotta
  }
];

/**
 * Computes Natal Major Aspects with dynamic orbs based on planet category (Luminaries vs Personal vs Outer)
 */
export function computeNatalAspects(
  planets: PlanetPosition[],
  angles: Record<AngleId, AnglePosition>
): NatalAspect[] {
  const aspects: NatalAspect[] = [];

  type AspectPoint = {
    id: BodyId | AngleId;
    name: string;
    glyph: string;
    longitude: number;
    speed: number;
    isLuminary: boolean;
    isAngle: boolean;
  };

  const points: AspectPoint[] = [
    ...planets.map((p) => ({
      id: p.id,
      name: p.name,
      glyph: p.glyph,
      longitude: p.longitude,
      speed: p.speed,
      isLuminary: p.id === 'sun' || p.id === 'moon',
      isAngle: false
    })),
    {
      id: 'asc',
      name: 'Yükselen (ASC)',
      glyph: 'ASC',
      longitude: angles.asc.longitude,
      speed: 0,
      isLuminary: false,
      isAngle: true
    },
    {
      id: 'mc',
      name: 'Tepe Noktası (MC)',
      glyph: 'MC',
      longitude: angles.mc.longitude,
      speed: 0,
      isLuminary: false,
      isAngle: true
    }
  ];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i];
      const b = points[j];
      if (a.isAngle && b.isAngle) continue;

      const actualAngle = shortestAngularDistance(a.longitude, b.longitude);

      for (const def of MAJOR_ASPECT_DEFS) {
        const maxOrb =
          a.isLuminary || b.isLuminary
            ? def.luminaryOrb
            : a.isAngle || b.isAngle
              ? def.baseOrb * 0.75
              : def.baseOrb;

        const orb = Math.abs(actualAngle - def.exactAngle);
        if (orb <= maxOrb) {
          // Determine applying vs separating by stepping 1 hour forward
          const futureLonA = normalizeDeg(a.longitude + a.speed / 24);
          const futureLonB = normalizeDeg(b.longitude + b.speed / 24);
          const futureAngle = shortestAngularDistance(futureLonA, futureLonB);
          const futureOrb = Math.abs(futureAngle - def.exactAngle);

          aspects.push({
            id: `${a.id}-${def.type}-${b.id}`,
            bodyA: a.id,
            bodyAName: a.name,
            bodyAGlyph: a.glyph,
            bodyB: b.id,
            bodyBName: b.name,
            bodyBGlyph: b.glyph,
            type: def.type,
            typeName: def.typeName,
            glyph: def.glyph,
            exactAngle: def.exactAngle,
            actualAngle,
            orb,
            maxOrb,
            isApplying: futureOrb < orb,
            nature: def.nature,
            color: def.color
          });
          break;
        }
      }
    }
  }

  return aspects.sort((x, y) => x.orb - y.orb);
}

/**
 * Real-Time Transit Matcher:
 * Detects tight-orb (±2.0°) major aspects between current sky transits and natal planets/angles.
 */
export function computeActiveTransits(
  transitPlanets: PlanetPosition[],
  natalPlanets: PlanetPosition[],
  natalAngles: Record<AngleId, AnglePosition>,
  maxTransitOrb = 2.0
): TransitAspect[] {
  const results: TransitAspect[] = [];

  const natalTargets: Array<PlanetPosition | AnglePosition> = [
    ...natalPlanets,
    natalAngles.asc,
    natalAngles.mc
  ];

  for (const tPlanet of transitPlanets) {
    for (const nTarget of natalTargets) {
      const actualAngle = shortestAngularDistance(tPlanet.longitude, nTarget.longitude);

      for (const def of MAJOR_ASPECT_DEFS) {
        const orb = Math.abs(actualAngle - def.exactAngle);
        if (orb <= maxTransitOrb) {
          const futureLonT = normalizeDeg(tPlanet.longitude + tPlanet.speed / 24);
          const futureAngle = shortestAngularDistance(futureLonT, nTarget.longitude);
          const futureOrb = Math.abs(futureAngle - def.exactAngle);
          const isApplying = futureOrb < orb;

          const natalHouse =
            'house' in nTarget
              ? nTarget.house
              : nTarget.id === 'asc'
                ? 1
                : nTarget.id === 'mc'
                  ? 10
                  : 7;

          const bulletin = generateTransitBulletin(
            tPlanet,
            nTarget,
            def.type,
            def.typeName,
            orb,
            isApplying,
            natalHouse,
            tPlanet.house
          );

          // Weight outer/slower planets + tight orb higher
          const planetWeight =
            tPlanet.id === 'pluto' || tPlanet.id === 'neptune' || tPlanet.id === 'uranus'
              ? 18
              : tPlanet.id === 'saturn' || tPlanet.id === 'jupiter'
                ? 15
                : tPlanet.id === 'mars'
                  ? 12
                  : 8;
          const orbScore = Math.round(((maxTransitOrb - orb) / maxTransitOrb) * 82);
          const intensityScore = Math.min(100, Math.max(15, orbScore + planetWeight));

          results.push({
            id: `tr-${tPlanet.id}-${def.type}-${nTarget.id}`,
            transitBody: tPlanet,
            natalTarget: nTarget,
            natalHouse,
            transitHouse: tPlanet.house,
            type: def.type,
            typeName: def.typeName,
            glyph: def.glyph,
            exactAngle: def.exactAngle,
            orb,
            isApplying,
            nature: def.nature,
            headline: bulletin.headline,
            summary: bulletin.summary,
            actionAdvice: bulletin.actionAdvice,
            intensityScore
          });
          break;
        }
      }
    }
  }

  return results.sort((a, b) => a.orb - b.orb);
}

/**
 * Full end-to-end calculation of Natal Chart, Placidus Houses, Aspects, Real-Time Transits & 4-Layer Synthesis
 */
export function calculateFullChart(
  input: BirthInput,
  transitUtcDate: Date = new Date()
): ChartCalculationResult {
  const { utcDate, offsetHours, offsetFormatted } = resolveLocalToUtc(
    input.birthDate,
    input.birthTime,
    input.location.timezone
  );

  const astroTime = MakeTime(utcDate);
  const julianDay = astroTime.ut + 2451545.0;

  const { angles, houses, localSiderealTimeDeg, houseSystem } =
    computePlacidusHousesAndAngles(
      utcDate,
      input.location.latitude,
      input.location.longitude
    );

  const planets = computePlanetsForUtc(utcDate, houses);
  const natalAspects = computeNatalAspects(planets, angles);

  // Compute current sky transits projected onto the user's natal Placidus houses
  const transitPlanets = computePlanetsForUtc(transitUtcDate, houses);
  const activeTransits = computeActiveTransits(transitPlanets, planets, angles, 2.0);

  // Element & Modality balance (10 planets + ASC)
  const elementCounts: Record<
    ElementType,
    { count: number; percentage: number; bodies: string[] }
  > = {
    fire: { count: 0, percentage: 0, bodies: [] },
    earth: { count: 0, percentage: 0, bodies: [] },
    air: { count: 0, percentage: 0, bodies: [] },
    water: { count: 0, percentage: 0, bodies: [] }
  };

  const modalityCounts: Record<
    ModalityType,
    { count: number; percentage: number; bodies: string[] }
  > = {
    cardinal: { count: 0, percentage: 0, bodies: [] },
    fixed: { count: 0, percentage: 0, bodies: [] },
    mutable: { count: 0, percentage: 0, bodies: [] }
  };

  const corePlanets = planets.filter((p) => p.id !== 'true_node');
  const totalPoints = corePlanets.length + 1; // 10 planets + ASC = 11

  for (const p of corePlanets) {
    elementCounts[p.sign.element].count += 1;
    elementCounts[p.sign.element].bodies.push(`${p.glyph} ${p.name}`);
    modalityCounts[p.sign.modality].count += 1;
    modalityCounts[p.sign.modality].bodies.push(`${p.glyph} ${p.name}`);
  }
  elementCounts[angles.asc.sign.element].count += 1;
  elementCounts[angles.asc.sign.element].bodies.push('ASC Yükselen');
  modalityCounts[angles.asc.sign.modality].count += 1;
  modalityCounts[angles.asc.sign.modality].bodies.push('ASC Yükselen');

  (Object.keys(elementCounts) as ElementType[]).forEach((el) => {
    elementCounts[el].percentage = Math.round((elementCounts[el].count / totalPoints) * 100);
  });
  (Object.keys(modalityCounts) as ModalityType[]).forEach((mod) => {
    modalityCounts[mod].percentage = Math.round(
      (modalityCounts[mod].count / totalPoints) * 100
    );
  });

  const chartRuler =
    planets.find((p) => p.id === angles.asc.sign.ruler) || planets[0];

  const syntheses = buildChartSyntheses(
    planets,
    houses,
    natalAspects,
    activeTransits,
    transitPlanets
  );

  return {
    input,
    utcDate,
    transitUtcDate,
    utcOffsetHours: offsetHours,
    utcOffsetFormatted: offsetFormatted,
    julianDay,
    localSiderealTimeDeg,
    houseSystem,
    planets,
    angles,
    houses,
    natalAspects,
    transitPlanets,
    activeTransits,
    syntheses,
    elementCounts,
    modalityCounts,
    chartRuler
  };
}
