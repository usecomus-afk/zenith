import {
  AngleId,
  AspectType,
  BodyId,
  ChartCalculationResult
} from '../types/astrology';
import { resolveLocalToUtc } from '../data/locations';
import {
  MAJOR_ASPECT_DEFS,
  computePlanetsForUtc,
  formatDegreeMinute,
  normalizeDeg,
  shortestAngularDistance
} from './ephemeris';
import { HOUSE_THEMES } from './interpretation';

export type ElectionalCategoryId =
  | 'career'
  | 'meeting'
  | 'family'
  | 'finance'
  | 'relationship'
  | 'education';

export interface ElectionalPresetQuestion {
  id: ElectionalCategoryId;
  icon: string;
  shortLabel: string;
  sampleQuestion: string;
  title: string;
  targetHouses: number[];
  primaryBodies: BodyId[];
  targetAngles: AngleId[];
  avoidRetrogrades: BodyId[];
  methodologyText: string;
}

const ICON_CAREER = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 12h20"/></svg>`;
const ICON_MEETING = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`;
const ICON_FAMILY = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M9 21v-6h6v6"/></svg>`;
const ICON_FINANCE = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
const ICON_RELATIONSHIP = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572"/></svg>`;
const ICON_EDUCATION = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>`;

export const ELECTIONAL_CATEGORIES: Record<ElectionalCategoryId, ElectionalPresetQuestion> = {
  career: {
    id: 'career',
    icon: ICON_CAREER,
    shortLabel: 'İş & Kariyer',
    sampleQuestion: 'Yeni iş başlangıcı ve kariyer adımı için en uygun gün hangisi?',
    title: 'Yeni İş Başlangıcı, Kariyer Atılımı ve Terfi Zamanlaması',
    targetHouses: [10, 6, 2, 1],
    primaryBodies: ['sun', 'jupiter', 'saturn', 'mars', 'mercury'],
    targetAngles: ['mc', 'asc'],
    avoidRetrogrades: ['mercury', 'mars'],
    methodologyText:
      'Doğum haritanızdaki 10. Ev (MC / Kariyer Zirvesi), 6. Ev (Günlük Operasyon), 2. Ev (Gelir), bu evlerin yöneticileri (dispozitörleri) ve Natal Güneş/Jüpiter/Satürn derecelerinizle önümüzdeki 30 günün gerçek gökyüzü koordinatları karşılaştırılır.'
  },
  meeting: {
    id: 'meeting',
    icon: ICON_MEETING,
    shortLabel: 'Görüşme & İmza',
    sampleQuestion: 'Önemli bir görüşme yapmak veya sözleşme imzalamak için hangi günü seçmeliyim?',
    title: 'Önemli Görüşme, Müzakere, Sözleşme ve Resmi İmza Zamanlaması',
    targetHouses: [3, 7, 10, 1],
    primaryBodies: ['mercury', 'venus', 'jupiter', 'sun'],
    targetAngles: ['asc', 'dsc', 'mc'],
    avoidRetrogrades: ['mercury', 'venus'],
    methodologyText:
      'Doğum haritanızdaki 3. Ev (İletişim, Sözleşme, İmza), 7. Ev (DSC / Muhatap ve Ortaklık), bu evlerin yöneticileri ve Natal Merkür/Venüs/Jüpiter derecelerinizle önümüzdeki 30 günlük gerçek gökyüzü açıları taranır.'
  },
  education: {
    id: 'education',
    icon: ICON_EDUCATION,
    shortLabel: 'Eğitim & Seyahat',
    sampleQuestion: 'Eğitim başvurusu, akademik adım veya seyahat/vize için en uygun gün hangisi?',
    title: 'Akademik Başvuru, Eğitim, Hukuki Süreç ve Uluslararası/Seyahat Zamanlaması',
    targetHouses: [9, 3, 10],
    primaryBodies: ['jupiter', 'mercury', 'sun', 'uranus'],
    targetAngles: ['mc', 'asc'],
    avoidRetrogrades: ['mercury'],
    methodologyText:
      'Doğum haritanızdaki 9. Ev (Yükseköğrenim, Yurt Dışı, Vizyon, Hukuk), 3. Ev (Sınav ve Zihin), bu evlerin yöneticileri ve Natal Jüpiter/Merkür derecelerinizle 30 günlük gerçek gökyüzü hareketleri taranır.'
  },
  finance: {
    id: 'finance',
    icon: ICON_FINANCE,
    shortLabel: 'Finans & Yatırım',
    sampleQuestion: 'Finansal yatırım, alım-satım veya bütçe hamlesi için en uygun gün hangisi?',
    title: 'Finansal Yatırım, Sermaye Yönetimi ve Alım-Satım Zamanlaması',
    targetHouses: [2, 8, 10],
    primaryBodies: ['jupiter', 'venus', 'sun', 'mercury', 'pluto'],
    targetAngles: ['mc', 'asc'],
    avoidRetrogrades: ['mercury', 'venus'],
    methodologyText:
      'Doğum haritanızdaki 2. Ev (Nakit Akışı ve Öz Kaynaklar), 8. Ev (Yatırım, Kredi, Ortak Sermaye), bu evlerin yöneticileri ve Natal Jüpiter/Venüs derecelerinizle 30 günlük gerçek ephemeris verisi çarpıştırılır.'
  },
  relationship: {
    id: 'relationship',
    icon: ICON_RELATIONSHIP,
    shortLabel: 'İlişki & Duygusal',
    sampleQuestion: 'İlişki konuşması, barışma veya duygusal bir başlangıç için en uygun gün hangisi?',
    title: 'İkili İlişkiler, Romantik Başlangıç ve Duygusal Uzlaşma Zamanlaması',
    targetHouses: [7, 5, 1],
    primaryBodies: ['venus', 'moon', 'sun', 'jupiter', 'mars'],
    targetAngles: ['dsc', 'asc'],
    avoidRetrogrades: ['venus'],
    methodologyText:
      'Doğum haritanızdaki 7. Ev (DSC / İkili İlişkiler ve Ortaklık), 5. Ev (Aşk ve Kalp Bağları), bu evlerin yöneticileri ve Natal Venüs/Ay/Güneş derecelerinizle 30 günlük gerçek gökyüzü açıları hesaplanır.'
  },
  family: {
    id: 'family',
    icon: ICON_FAMILY,
    shortLabel: 'Aile & Ev',
    sampleQuestion: 'Aile konusunda karar vermek, ev veya taşınma adımı için uygun gün hangisi?',
    title: 'Ailevi Kararlar, Ev Düzeni, Gayrimenkul ve Yuva Zamanlaması',
    targetHouses: [4, 2, 7],
    primaryBodies: ['moon', 'venus', 'jupiter', 'saturn', 'sun'],
    targetAngles: ['ic', 'asc'],
    avoidRetrogrades: ['venus', 'mercury'],
    methodologyText:
      'Doğum haritanızdaki 4. Ev (IC / Kökler, Aile, Gayrimenkul), 2. Ev (Güvenlik), 4. Ev Yöneticiniz ve Natal Ay/Venüs/Jüpiter konumlarınızla önümüzdeki 30 günün gerçek gökyüzü boylamları eşleştirilir.'
  }
};

export interface DayAspectEvidence {
  transitBodyName: string;
  transitBodyGlyph: string;
  transitSignName: string;
  transitSignGlyph: string;
  transitDegreeFormatted: string;
  transitHouse: number;
  isTransitRetro: boolean;
  natalTargetName: string;
  natalTargetGlyph: string;
  natalSignName: string;
  natalDegreeFormatted: string;
  natalHouse: number;
  aspectType: AspectType;
  aspectName: string;
  aspectGlyph: string;
  exactAngle: number;
  orb: number;
  orbFormatted: string;
  nature: 'supportive' | 'challenging';
  weightDelta: number;
  reasonTag: string;
}

export interface DailyElectionalEvaluation {
  dateIso: string; // YYYY-MM-DD
  dateFormatted: string; // e.g. "28 Ekim 2026 Çarşamba"
  shortDateFormatted: string; // e.g. "28 Eki"
  dayOffset: number; // 0..30
  netScore: number; // Raw deterministic astrological score
  alignmentIndex: number; // Normalized 0..100 scale based on real aspect weights
  verdict: 'optimal' | 'favorable' | 'neutral' | 'caution';
  verdictLabel: string;
  moonSignName: string;
  moonSignGlyph: string;
  moonDegreeFormatted: string;
  moonNatalHouse: number;
  lunarPhaseName: string;
  lunarElongationDeg: number;
  retrogradeBodies: string[];
  supportiveEvidences: DayAspectEvidence[];
  challengingEvidences: DayAspectEvidence[];
  keyTransitedHouses: Array<{ bodyName: string; bodyGlyph: string; signName: string; degreeFormatted: string; house: number }>;
  daySummaryNarrative: string;
  favorableTopics: string[];
  cautionTopics: string[];
  personalAdvice: string;
}

export interface CosmicNotificationItem {
  id: string;
  scope: 'daily' | 'weekly';
  tone: 'optimal' | 'caution' | 'info';
  badgeLabel: string;
  title: string;
  dateLabel: string;
  narrative: string;
  favorableHighlights: string[];
  cautionHighlights: string[];
  adviceText: string;
  targetCategoryId?: ElectionalCategoryId;
  targetDateIso?: string;
}

export interface WeeklyDayDigestItem {
  dateIso: string;
  dateFormatted: string;
  shortDateFormatted: string;
  verdict: 'optimal' | 'favorable' | 'neutral' | 'caution';
  verdictLabel: string;
  netScore: number;
  moonSignGlyph: string;
  moonSignName: string;
  moonNatalHouse: number;
  lunarPhaseName: string;
  bestCategoryId: ElectionalCategoryId;
  bestCategoryLabel: string;
  cautionCategoryLabel: string;
  summaryText: string;
  adviceText: string;
}

export interface CosmicNotificationsBundle {
  unreadKey: string;
  generatedDateFormatted: string;
  generatedWeekRangeFormatted: string;
  totalCount: number;
  dailyNotifications: CosmicNotificationItem[];
  weeklyNotifications: CosmicNotificationItem[];
  weeklyDayDigest: WeeklyDayDigestItem[];
}

export interface ElectionalForecastResult {
  queryText: string;
  category: ElectionalPresetQuestion;
  natalFocusSummary: {
    targetHousesLabel: string;
    personalHouseRulers: Array<{ house: number; cuspSign: string; cuspDegree: string; rulerName: string; rulerGlyph: string; rulerNatalSign: string; rulerNatalHouse: number }>;
  };
  startDateFormatted: string;
  endDateFormatted: string;
  topOptimalDays: DailyElectionalEvaluation[];
  cautionDays: DailyElectionalEvaluation[];
  allDays: DailyElectionalEvaluation[];
}

/**
 * Classifies a natural-language Turkish question into the matching ElectionalCategoryId
 */
export function detectElectionalCategoryFromQuery(query: string): ElectionalCategoryId {
  const q = query.toLocaleLowerCase('tr-TR').trim();
  if (!q) return 'career';

  if (
    q.includes('aile') ||
    q.includes('ev ') ||
    q.includes('evim') ||
    q.includes('taşın') ||
    q.includes('gayrimenkul') ||
    q.includes('tapu') ||
    q.includes('kira') ||
    q.includes('ebeveyn') ||
    q.includes('anne') ||
    q.includes('baba') ||
    q.includes('yuva')
  ) {
    return 'family';
  }

  if (
    q.includes('görüşme') ||
    q.includes('toplantı') ||
    q.includes('mülakat') ||
    q.includes('imza') ||
    q.includes('sözleşme') ||
    q.includes('kontrat') ||
    q.includes('anlaşma') ||
    q.includes('konuşma') ||
    q.includes('müzakere') ||
    q.includes('sunum')
  ) {
    return 'meeting';
  }

  if (
    q.includes('yatırım') ||
    q.includes('para') ||
    q.includes('finans') ||
    q.includes('bütçe') ||
    q.includes('kredi') ||
    q.includes('borç') ||
    q.includes('alım') ||
    q.includes('satım') ||
    q.includes('borsa') ||
    q.includes('maaş') ||
    q.includes('ticaret')
  ) {
    return 'finance';
  }

  if (
    q.includes('ilişki') ||
    q.includes('aşk') ||
    q.includes('sevgili') ||
    q.includes('evlilik') ||
    q.includes('nişan') ||
    q.includes('barış') ||
    q.includes('flört') ||
    q.includes('partner') ||
    q.includes('duygusal') ||
    q.includes('eşim')
  ) {
    return 'relationship';
  }

  if (
    q.includes('eğitim') ||
    q.includes('sınav') ||
    q.includes('okul') ||
    q.includes('akademik') ||
    q.includes('tez') ||
    q.includes('seyahat') ||
    q.includes('yolculuk') ||
    q.includes('vize') ||
    q.includes('yurt dışı') ||
    q.includes('hukuk') ||
    q.includes('dava')
  ) {
    return 'education';
  }

  return 'career';
}

function getLunarPhaseInfo(sunLon: number, moonLon: number): {
  phaseName: string;
  elongationDeg: number;
  isWaxing: boolean;
} {
  const elong = normalizeDeg(moonLon - sunLon);
  const isWaxing = elong < 180;
  let phaseName = 'Yeniay Fazı';
  if (elong < 22.5 || elong >= 337.5) {
    phaseName = 'Yeniay Fazı';
  } else if (elong < 67.5) {
    phaseName = 'Büyüyen Hilal';
  } else if (elong < 112.5) {
    phaseName = 'İlk Dördün';
  } else if (elong < 157.5) {
    phaseName = 'Büyüyen Ay';
  } else if (elong < 202.5) {
    phaseName = 'Dolunay Fazı';
  } else if (elong < 247.5) {
    phaseName = 'Küçülen Ay';
  } else if (elong < 292.5) {
    phaseName = 'Son Dördün';
  } else {
    phaseName = 'Balsamik Ay';
  }
  return { phaseName, elongationDeg: elong, isWaxing };
}

function formatDateIsoLocal(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

/**
 * Deterministically evaluates the next 30 days (today + 30 days = 31 days) using real ephemeris positions
 * (`computePlanetsForUtc`) against the user's Natal Chart (`chart`).
 * Zero synthetic or random data is used.
 */
export function evaluateThirtyDayElectionalForecast(
  chart: ChartCalculationResult,
  queryText: string,
  explicitCategoryId?: ElectionalCategoryId,
  baseDate: Date = new Date()
): ElectionalForecastResult {
  const categoryId = explicitCategoryId || detectElectionalCategoryFromQuery(queryText);
  const category = ELECTIONAL_CATEGORIES[categoryId];
  const tz = chart.input.location.timezone;

  // Identify the user's personal natal House Rulers (Dispositors) for the category's target houses
  const personalHouseRulers = category.targetHouses.map((houseNum) => {
    const cusp = chart.houses[houseNum - 1];
    const rulerPlanet =
      chart.planets.find((p) => p.id === cusp.rulerId) || chart.planets[0];
    return {
      house: houseNum,
      cuspSign: cusp.sign.name,
      cuspDegree: cusp.degreeFormatted,
      rulerId: rulerPlanet.id,
      rulerName: rulerPlanet.name,
      rulerGlyph: rulerPlanet.glyph,
      rulerNatalSign: rulerPlanet.sign.name,
      rulerNatalHouse: rulerPlanet.house
    };
  });

  const personalRulerIds = new Set<BodyId>(personalHouseRulers.map((r) => r.rulerId));
  const targetHouseSet = new Set<number>(category.targetHouses);
  const primaryBodySet = new Set<BodyId>(category.primaryBodies);
  const targetAngleSet = new Set<AngleId>(category.targetAngles);

  const natalTargets: Array<{
    id: BodyId | AngleId;
    name: string;
    glyph: string;
    signName: string;
    degreeFormatted: string;
    longitude: number;
    house: number;
    isAngle: boolean;
  }> = [
    ...chart.planets.map((p) => ({
      id: p.id,
      name: p.name,
      glyph: p.glyph,
      signName: p.sign.name,
      degreeFormatted: p.degreeFormatted,
      longitude: p.longitude,
      house: p.house,
      isAngle: false
    })),
    {
      id: 'asc',
      name: 'Yükselen (ASC)',
      glyph: 'ASC',
      signName: chart.angles.asc.sign.name,
      degreeFormatted: chart.angles.asc.degreeFormatted,
      longitude: chart.angles.asc.longitude,
      house: 1,
      isAngle: true
    },
    {
      id: 'mc',
      name: 'Tepe Noktası (MC)',
      glyph: 'MC',
      signName: chart.angles.mc.sign.name,
      degreeFormatted: chart.angles.mc.degreeFormatted,
      longitude: chart.angles.mc.longitude,
      house: 10,
      isAngle: true
    },
    {
      id: 'dsc',
      name: 'Alçalan (DSC)',
      glyph: 'DSC',
      signName: chart.angles.dsc.sign.name,
      degreeFormatted: chart.angles.dsc.degreeFormatted,
      longitude: chart.angles.dsc.longitude,
      house: 7,
      isAngle: true
    },
    {
      id: 'ic',
      name: 'Dip Noktası (IC)',
      glyph: 'IC',
      signName: chart.angles.ic.sign.name,
      degreeFormatted: chart.angles.ic.degreeFormatted,
      longitude: chart.angles.ic.longitude,
      house: 4,
      isAngle: true
    }
  ];

  const allDays: DailyElectionalEvaluation[] = [];

  const baseIso = formatDateIsoLocal(baseDate, tz);
  const [targetYear, targetMonth] = baseIso.split('-').map(Number);
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dayOffset = dayNum - 1;
    const dateIso = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    // Evaluate at 12:00 Local Time for that date
    const { utcDate: noonUtc } = resolveLocalToUtc(dateIso, '12:00', tz);
    const dayPlanets = computePlanetsForUtc(noonUtc, chart.houses);

    const sunPos = dayPlanets.find((p) => p.id === 'sun')!;
    const moonPos = dayPlanets.find((p) => p.id === 'moon')!;
    const lunarInfo = getLunarPhaseInfo(sunPos.longitude, moonPos.longitude);

    const supportiveEvidences: DayAspectEvidence[] = [];
    const challengingEvidences: DayAspectEvidence[] = [];
    let netScore = 0;

    // 1. Check real transiting Moon and primary planets passing through the user's target Natal Houses
    const keyTransitedHouses: Array<{
      bodyName: string;
      bodyGlyph: string;
      signName: string;
      degreeFormatted: string;
      house: number;
    }> = [];

    for (const tp of dayPlanets) {
      if (targetHouseSet.has(tp.house)) {
        if (
          tp.id === 'sun' ||
          tp.id === 'moon' ||
          tp.id === 'mercury' ||
          tp.id === 'venus' ||
          tp.id === 'jupiter' ||
          tp.id === 'mars'
        ) {
          keyTransitedHouses.push({
            bodyName: tp.name,
            bodyGlyph: tp.glyph,
            signName: tp.sign.name,
            degreeFormatted: tp.degreeFormatted,
            house: tp.house
          });
          if (tp.id === 'moon' && tp.house === category.targetHouses[0]) {
            netScore += 7;
          } else if (tp.id === 'venus' || tp.id === 'jupiter' || tp.id === 'sun') {
            netScore += 4;
          }
        }
      }
    }

    // 2. Check Retrograde status of category-sensitive personal planets (Mercury, Venus, Mars)
    const retrogradeBodies: string[] = [];
    for (const tp of dayPlanets) {
      if (tp.isRetrograde && tp.id !== 'true_node') {
        retrogradeBodies.push(`${tp.glyph} ${tp.name} ℞ (${tp.sign.name} ${tp.degreeFormatted})`);
        if (category.avoidRetrogrades.includes(tp.id)) {
          netScore -= 8;
        }
      }
    }

    // 3. Evaluate all real astronomical aspects between dayPlanets and natalTargets
    for (const tp of dayPlanets) {
      if (tp.id === 'true_node') continue;
      const isMoon = tp.id === 'moon';
      const maxAllowedOrb = isMoon ? 3.2 : 2.2;

      for (const nt of natalTargets) {
        // Check relevance to the asked question category:
        const isTargetHouseNatal = targetHouseSet.has(nt.house);
        const isPersonalHouseRuler =
          !nt.isAngle && personalRulerIds.has(nt.id as BodyId);
        const isPrimaryNatalBody =
          !nt.isAngle && primaryBodySet.has(nt.id as BodyId);
        const isTargetAngle = nt.isAngle && targetAngleSet.has(nt.id as AngleId);
        const isPrimaryTransitBody =
          primaryBodySet.has(tp.id) || personalRulerIds.has(tp.id) || isMoon;
        const isTransitInTargetHouse = targetHouseSet.has(tp.house);

        const relevanceCount =
          (isTargetHouseNatal ? 1 : 0) +
          (isPersonalHouseRuler ? 2 : 0) +
          (isPrimaryNatalBody ? 1 : 0) +
          (isTargetAngle ? 2 : 0) +
          (isPrimaryTransitBody ? 1 : 0) +
          (isTransitInTargetHouse ? 1 : 0);

        if (relevanceCount < 2) continue;

        const actualAngle = shortestAngularDistance(tp.longitude, nt.longitude);

        for (const def of MAJOR_ASPECT_DEFS) {
          const orb = Math.abs(actualAngle - def.exactAngle);
          if (orb <= maxAllowedOrb) {
            const tightnessFactor = 1 + (maxAllowedOrb - orb) / maxAllowedOrb; // 1.0 .. 2.0
            const relevanceMultiplier =
              1 + Math.min(3, relevanceCount) * 0.28;

            // Determine whether conjunction is supportive or challenging based on planet nature
            const isMaleficTransit =
              tp.id === 'saturn' || tp.id === 'mars' || tp.id === 'pluto';
            const isSupportive =
              def.type === 'trine' ||
              def.type === 'sextile' ||
              (def.type === 'conjunction' && !isMaleficTransit);

            const basePoints =
              def.type === 'trine'
                ? 11
                : def.type === 'sextile'
                  ? 8
                  : def.type === 'conjunction'
                    ? isMaleficTransit
                      ? -9
                      : 12
                    : def.type === 'square'
                      ? -11
                      : -10;

            const weightDelta = Math.round(
              basePoints * tightnessFactor * relevanceMultiplier * (isMoon ? 0.72 : 1.0)
            );
            netScore += weightDelta;

            let reasonTag = `${nt.house}. Ev Konusu`;
            if (isPersonalHouseRuler) {
              const ruledHouse = personalHouseRulers.find((r) => r.rulerId === nt.id)?.house;
              reasonTag = `${ruledHouse}. Ev Yöneticiniz (${nt.name})`;
            } else if (isTargetAngle) {
              reasonTag = `${nt.name} Ekseni`;
            } else if (isTargetHouseNatal) {
              reasonTag = `Natal ${nt.house}. Ev (${HOUSE_THEMES[nt.house].shortArena.split(',')[0]})`;
            }

            const evidence: DayAspectEvidence = {
              transitBodyName: tp.name,
              transitBodyGlyph: tp.glyph,
              transitSignName: tp.sign.name,
              transitSignGlyph: tp.sign.glyph,
              transitDegreeFormatted: tp.degreeFormatted,
              transitHouse: tp.house,
              isTransitRetro: tp.isRetrograde,
              natalTargetName: nt.name,
              natalTargetGlyph: nt.glyph,
              natalSignName: nt.signName,
              natalDegreeFormatted: nt.degreeFormatted,
              natalHouse: nt.house,
              aspectType: def.type,
              aspectName: def.typeName,
              aspectGlyph: def.glyph,
              exactAngle: def.exactAngle,
              orb,
              orbFormatted: formatDegreeMinute(orb),
              nature: isSupportive ? 'supportive' : 'challenging',
              weightDelta,
              reasonTag
            };

            if (isSupportive) {
              supportiveEvidences.push(evidence);
            } else {
              challengingEvidences.push(evidence);
            }
            break;
          }
        }
      }
    }

    supportiveEvidences.sort((a, b) => a.orb - b.orb);
    challengingEvidences.sort((a, b) => a.orb - b.orb);

    const dateFormatted = noonUtc.toLocaleDateString('tr-TR', {
      timeZone: tz,
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    });
    const shortDateFormatted = noonUtc.toLocaleDateString('tr-TR', {
      timeZone: tz,
      day: '2-digit',
      month: 'short'
    });

    allDays.push({
      dateIso,
      dateFormatted,
      shortDateFormatted,
      dayOffset,
      netScore,
      alignmentIndex: 50, // Normalized across the 30-day window below
      verdict: 'neutral',
      verdictLabel: 'Dengeli / Standart Akış',
      moonSignName: moonPos.sign.name,
      moonSignGlyph: moonPos.sign.glyph,
      moonDegreeFormatted: moonPos.degreeFormatted,
      moonNatalHouse: moonPos.house,
      lunarPhaseName: lunarInfo.phaseName,
      lunarElongationDeg: lunarInfo.elongationDeg,
      retrogradeBodies,
      supportiveEvidences,
      challengingEvidences,
      keyTransitedHouses,
      daySummaryNarrative: '',
      favorableTopics: [],
      cautionTopics: [],
      personalAdvice: ''
    });
  }

  // Deterministic normalization across the real 31-day astronomical scores
  const scores = allDays.map((d) => d.netScore);
  const minScore = Math.min(...scores, -25);
  const maxScore = Math.max(...scores, 25);
  const span = Math.max(1, maxScore - minScore);

  for (const day of allDays) {
    const ratio = (day.netScore - minScore) / span;
    day.alignmentIndex = Math.round(18 + ratio * 78); // Real relative scale 18..96

    if (day.netScore >= maxScore * 0.55 && day.supportiveEvidences.length > 0) {
      day.verdict = 'optimal';
      day.verdictLabel = 'En Uygun (Yüksek Uyum)';
    } else if (day.netScore > 4 && day.supportiveEvidences.length >= day.challengingEvidences.length) {
      day.verdict = 'favorable';
      day.verdictLabel = 'Destekleyici Gün';
    } else if (day.netScore <= minScore * 0.5 && day.challengingEvidences.length > 0) {
      day.verdict = 'caution';
      day.verdictLabel = 'Dikkat / Gerilimli Açı';
    } else {
      day.verdict = 'neutral';
      day.verdictLabel = 'Dengeli / Nötr Gün';
    }
  }

  const sortedByBest = [...allDays].sort((a, b) => {
    if (b.netScore !== a.netScore) return b.netScore - a.netScore;
    return a.dayOffset - b.dayOffset;
  });

  const sortedByCaution = [...allDays]
    .filter((d) => d.challengingEvidences.length > 0 && d.netScore < 0)
    .sort((a, b) => a.netScore - b.netScore);

  const topOptimalDays = sortedByBest.slice(0, 4);
  for (const d of topOptimalDays) {
    d.verdict = 'optimal';
    d.verdictLabel = 'En Uygun Gün';
  }

  const cautionDays = sortedByCaution.slice(0, 3);
  for (const d of cautionDays) {
    if (!topOptimalDays.some((opt) => opt.dateIso === d.dateIso)) {
      d.verdict = 'caution';
      d.verdictLabel = 'Dikkat Edilmesi Önerilen Gün';
    }
  }

  for (const day of allDays) {
    populateDayNarrativeAndAdvice(day, category);
  }

  return {
    queryText: queryText.trim() || category.sampleQuestion,
    category,
    natalFocusSummary: {
      targetHousesLabel: category.targetHouses.map((h) => `${h}. Ev`).join(', '),
      personalHouseRulers: personalHouseRulers.map((r) => ({
        house: r.house,
        cuspSign: r.cuspSign,
        cuspDegree: r.cuspDegree,
        rulerName: r.rulerName,
        rulerGlyph: r.rulerGlyph,
        rulerNatalSign: r.rulerNatalSign,
        rulerNatalHouse: r.rulerNatalHouse
      }))
    },
    startDateFormatted: allDays[0].dateFormatted,
    endDateFormatted: allDays[allDays.length - 1].dateFormatted,
    topOptimalDays,
    cautionDays,
    allDays
  };
}

const CATEGORY_SPECIFIC_GUIDANCE: Record<
  ElectionalCategoryId,
  {
    favorablePool: string[];
    cautionPool: string[];
    optimalAdvice: string;
    favorableAdvice: string;
    neutralAdvice: string;
    cautionAdvice: string;
  }
> = {
  career: {
    favorablePool: [
      'Yeni iş başvurusu, CV/portfolyo gönderimi ve mülakat randevusu',
      'Üst yönetimle terfi, görev tanımı veya maaş artışı görüşmesi',
      'Yeni bir projeyi, markayı veya profesyonel girişimi resmen başlatma',
      'Liderlik üstlenme, ekip organizasyonu ve stratejik iş planı sunumu'
    ],
    cautionPool: [
      'Üstlerle veya otorite figürleriyle ani ego ve güç çekişmelerine girmek',
      'Hazırlıksız veya alternatif planı olmadan fevri istifa / yol ayrımı kararı almak',
      'Operasyonel detayları doğrulanmamış büyük iş yüklerini tek başına üstlenmek'
    ],
    optimalAdvice:
      'Bugün kariyer ve profesyonel görünürlük evleriniz gökyüzünden güçlü destek alıyor. Ertelediğiniz üst düzey görüşmeleri, resmi başvuruları veya lansman adımlarını bugün somutlaştırın; özgüvenli ve net duruşunuz hızla karşılık bulacaktır.',
    favorableAdvice:
      'Gökyüzü akışı mesleki girişimleriniz için yapıcı bir zemin sunuyor. Günlük iş akışınızı büyütmek, profesyonel bağlantılar kurmak ve projelerinizi görünür kılmak için bugünün destekleyici açılarından yararlanabilirsiniz.',
    neutralAdvice:
      'Kariyer alanında bugün aşırı uçlarda bir gerilim ya da ekstra sıçrama baskısı bulunmuyor. Rutin görevleri tamamlamak, stratejik hazırlık yapmak ve mevcut projeleri sağlamlaştırmak için ideal bir denge günü.',
    cautionAdvice:
      'Bugün mesleki eksenlerinizde gerilimli açılar aktif olduğundan iş ortamında sabırsızlık veya iletişim sertliği yaşanabilir. Kritik terfi/maaş taleplerini veya radikal kariyer kararlarını birkaç gün erteleyin; bugün esnek kalın ve mevcut işleri korumaya odaklanın.'
  },
  meeting: {
    favorablePool: [
      'Resmi sözleşme, protokol, ortaklık veya ticari kontrat imzalamak',
      'Stratejik işbirliği, müşteri sunumu ve ikna odaklı müzakereler yürütmek',
      'Önemli yazışmaları, teklif dosyalarını ve resmi başvuruları onaylamak',
      'Arabuluculuk, uzlaşma ve net iletişim gerektiren kritik toplantılar yapmak'
    ],
    cautionPool: [
      'Küçük maddeleri ve hukuki/mali yükümlülükleri okumadan evrak imzalamak',
      'Toplantılarda karşı tarafı dinlemeden savunmacı veya sert üslup kullanmak',
      'Sözlü vaatlere güvenip yazılı teyit almadan bağlayıcı anlaşmaya girmek'
    ],
    optimalAdvice:
      'Zihinsel berraklık ve diplomasi kanallarınız bugün en yüksek uyum seviyesinde. Önemli imzaları atmak, zorlu bir müzakereyi masada lehinize çevirmek ve kalıcı mutabakat sağlamak için bugünü güvenle değerlendirebilirsiniz.',
    favorableAdvice:
      'İletişim ve ortaklık evleriniz uyumlu çalışıyor. Toplantı organize etmek, teklif sunmak ve karşılıklı güven inşa etmek için akıcı bir gün; düşüncelerinizi açık ve yapılandırılmış biçimde ifade edin.',
    neutralAdvice:
      'Görüşme ve yazışmalar için standart, sakin bir akış hakim. Taslak sözleşmeleri gözden geçirmek, bilgi toplamak ve ön görüşmeler yapmak için uygun bir zemin.',
    cautionAdvice:
      'Bugün iletişim ve anlaşma ekseninizde yanlış anlaşılmalara veya fikir çatışmalarına açık sert açılar var. Bağlayıcı bir imzayı mümkünse destekleyici bir güne bırakın; bugün toplantı yapmanız şartsa tüm koşulları yazılı olarak iki kez doğrulayın ve esnek bir dil kullanın.'
  },
  education: {
    favorablePool: [
      'Akademik başvuru, yüksek lisans/doktora, burs veya sertifika kaydı yapmak',
      'Vize başvurusu, pasaport/resmi evrak işlemleri ve uluslararası yazışmalar',
      'Uzun mesafeli seyahat planlaması, bilet/konaklama rezervasyonu ve rota seçimi',
      'Hukuki danışmanlık almak, yayıncılık veya tez/araştırma sunumu gerçekleştirmek'
    ],
    cautionPool: [
      'Seyahat ve vize evraklarında son dakika eksikleri veya tarih/saat dalgınlığı',
      'Akademik veya hukuki süreçlerde prosedür ve yönetmelikleri göz ardı etmek',
      'Doğrulanmamış bilgi kaynaklarına dayanarak uzun vadeli eğitim/rota kararı vermek'
    ],
    optimalAdvice:
      'Vizyon, yükseköğrenim ve uluslararası ufuklar eviniz bugün güçlü bir göksel rüzgar alıyor. Eğitim başvuruları, vize/yurt dışı adımları, akademik sunumlar ve yeni bir uzmanlık alanına başlamak için yılın en verimli pencerelerinden biri.',
    favorableAdvice:
      'Zihinsel odaklanma ve öğrenme kapasiteniz bugün oldukça açık. Sınav hazırlığı, araştırma, dil pratiği ve seyahat organizasyonlarında hızlı ve kalıcı ilerleme kaydedebilirsiniz.',
    neutralAdvice:
      'Eğitim ve seyahat konularında dengeli bir gün. Mevcut ders/okuma programınızı sürdürmek, evrak arşivlemek ve araştırma notlarınızı düzenlemek için verimli bir ritim sunar.',
    cautionAdvice:
      'Bugün 3. ve 9. ev eksenlerinizdeki gerilimli açılar zihinsel dağınıklık veya seyahat/evrak gecikmeleri yaratabilir. Resmi vize/okul başvurularında belgelerinizi mutlaka çift kontrol edin; yolda veya trafikte zaman payı bırakarak esnek hareket edin.'
  },
  finance: {
    favorablePool: [
      'Uzun vadeli yatırım, portföy çeşitlendirme ve birikim/fon yapılandırması',
      'Bütçe planlaması, gelir-gider optimizasyonu ve alacak/tahsilat takibi',
      'Yüksek değerli alım-satım işlemleri, ticari fiyatlandırma ve kazanç anlaşmaları',
      'Kredi, vergi, sigorta veya ortaklı sermaye konularında rasyonel yeniden yapılandırma'
    ],
    cautionPool: [
      'Anlık heyecanla veya FOMO (fırsatı kaçırma korkusu) ile spekülatif risk almak',
      'Gelir-gider dengesini hesaplamadan yüksek faizli borç veya kefalet altına girmek',
      'Piyasa koşullarını ve sözleşme maliyetlerini araştırmadan büyük harcama yapmak'
    ],
    optimalAdvice:
      'Öz kaynaklar ve finansal büyüme evleriniz bugün natal haritanızla yüksek rezonans içinde. Stratejik yatırım kararları, alım-satım hamleleri ve gelir artırıcı finansal anlaşmalar için gökyüzü somut ve kalıcı bereket vadediyor.',
    favorableAdvice:
      'Maddi konularda sağduyulu ve kazançlı adımlar atabileceğiniz destekleyici bir gün. Bütçenizi güçlendirecek anlaşmalar yapabilir, finansal planlarınızı güvenle devreye alabilirsiniz.',
    neutralAdvice:
      'Finansal piyasalarda ve kişisel bütçenizde standart bir denge günü. Büyük riskler almak yerine mevcut hesapları denetlemek ve piyasa analizi yapmak için uygundur.',
    cautionAdvice:
      'Bugün finans eksenlerinizde sert açılar devrede olduğundan dürtüsel harcamalara veya yanıltıcı mali beklentilere karşı temkinli olunmalı. Büyük meblağlı alım-satımları ve borçlanma kararlarını birkaç gün erteleyin; paranızı ve bütçe esnekliğinizi koruyun.'
  },
  relationship: {
    favorablePool: [
      'İlk buluşma, romantik tanışma veya ilişkiyi bir üst seviyeye taşıyan adımlar',
      'Partnerle açık kalpli konuşma, kırgınlıkları onarma ve duygusal uzlaşma',
      'Söz, nişan, yıldönümü kutlaması veya ortak gelecek planı paylaşımı',
      'Sosyal davetlere katılma, estetik/öz-bakım yenilenmesi ve kalp bağlarını güçlendirme'
    ],
    cautionPool: [
      'Geçmişteki kapanmış konuları öfkeyle yeniden açıp duygusal restleşmeye girmek',
      'Partnerin niyetini sormadan varsayımlar üzerinden kıskançlık veya alınganlık yapmak',
      'Kendi duygusal sınırlarınızı yok sayarak aşırı fedakarlık veya tam tersi soğuk duvar örmek'
    ],
    optimalAdvice:
      'Kalp çakranız, çekim gücünüz ve ikili ilişkiler eviniz bugün gökyüzünün en sıcak ve birleştirici açılarını alıyor. Sevginizi ifade etmek, romantik bir başlangıç yapmak veya ilişkinizde derin bir güven sayfası açmak için muazzam bir gün.',
    favorableAdvice:
      'Duygusal empati ve uyum enerjisi bugün yanınızda. Sevdiklerinizle kaliteli vakit geçirmek, samimi paylaşımlar yapmak ve sosyal çevrenizde sıcak bağlar kurmak için çok elverişli.',
    neutralAdvice:
      'İlişkilerde sakin, huzurlu ve kendi akışında ilerleyen bir gün. Büyük duygusal konuşmalar için zorlamak yerine doğal ve rahat paylaşımlara odaklanabilirsiniz.',
    cautionAdvice:
      'Bugün ilişki ekseninizde duygusal hassasiyetleri veya yanlış anlaşılmaları tetikleyebilecek gerilimli açılar mevcut. Partnerinizle kritik ve gergin konuları bugün konuşmak yerine dinlemeyi ve empatiyi seçin; esnek ve sakin kalmak ilişkinizi koruyacaktır.'
  },
  family: {
    favorablePool: [
      'Ev kiralama, konut/gayrimenkul alım-satımı veya tapu/kontrat işlemleri',
      'Taşınma, tadilat, dekorasyon ve yaşam alanını güzelleştirme/düzenleme adımları',
      'Aile büyükleriyle bir araya gelme, aile içi önemli kararlar ve miras/mülk uzlaşması',
      'Evde huzur, köklenme, misafir ağırlama ve duygusal güvenliği pekiştirme'
    ],
    cautionPool: [
      'Aile içinde eski kuşak çatışmalarını veya hassas aile sırlarını kaşımak',
      'Teknik tesisat/ekspertiz kontrolü yapmadan aceleyle ev veya mülk kaparosunu vermek',
      'Ev içi tadilat ve taşınma süreçlerinde bütçe ve zaman sınırlarını kontrolsüz bırakmak'
    ],
    optimalAdvice:
      'Haritanızın kökler, yuva ve gayrimenkul evi (4. Ev / IC) bugün gökyüzünden tam destek alıyor. Ev, mülk, taşınma, dekorasyon veya ailevi konularda kalıcı huzur ve sağlam temel kuracak adımları bugün gönül rahatlığıyla atabilirsiniz.',
    favorableAdvice:
      'Ev ve aile düzeninizde içsel huzuru büyüten destekleyici bir gökyüzü var. Yaşam alanınızı düzenlemek ve aile bireyleriyle dayanışma kurmak için çok uygun bir gün.',
    neutralAdvice:
      'Ev ve aile yaşamında dingin, rutin bir gün. Ev içi organizasyon, temizlik ve dinlenme için dengeli bir atmosfer sunuyor.',
    cautionAdvice:
      'Bugün yuva ve aile ekseninizde duygusal dalgalanma veya ev içi aksaklık yaratabilecek sert açılar bulunuyor. Aile bireylerine karşı sabırlı ve kapsayıcı olun; gayrimenkul veya tadilat kararlarında ise acele etmeyip koşulları esnek biçimde yeniden değerlendirin.'
  }
};

function populateDayNarrativeAndAdvice(
  day: DailyElectionalEvaluation,
  category: ElectionalPresetQuestion
): void {
  const guide = CATEGORY_SPECIFIC_GUIDANCE[category.id];
  const moonHouseTheme = HOUSE_THEMES[day.moonNatalHouse] || HOUSE_THEMES[1];
  const topSup = day.supportiveEvidences[0];
  const secondSup = day.supportiveEvidences[1];
  const topChal = day.challengingEvidences[0];
  const secondChal = day.challengingEvidences[1];

  const favTopics: string[] = [];
  const cautTopics: string[] = [];

  if (day.verdict === 'optimal' || day.verdict === 'favorable') {
    favTopics.push(guide.favorablePool[0], guide.favorablePool[1]);
    if (day.verdict === 'optimal') {
      favTopics.push(guide.favorablePool[2]);
    }
    if (topSup) {
      const supHouseTheme = HOUSE_THEMES[topSup.natalHouse] || HOUSE_THEMES[1];
      favTopics.push(
        `${topSup.natalTargetName} (${topSup.natalHouse}. Ev) desteğiyle ${supHouseTheme.transitActionDomain} somut adım atmak`
      );
    } else {
      favTopics.push(
        `Ay'ın ${day.moonNatalHouse}. Ev geçişiyle ${moonHouseTheme.transitActionDomain} odaklanmak`
      );
    }

    if (topChal) {
      const chalHouseTheme = HOUSE_THEMES[topChal.natalHouse] || HOUSE_THEMES[1];
      cautTopics.push(
        `Transit ${topChal.transitBodyName} – Natal ${topChal.natalTargetName} (${topChal.aspectName}) nedeniyle ${chalHouseTheme.transitActionDomain} aşırı aceleci davranmamak`
      );
    } else if (day.retrogradeBodies.length > 0) {
      cautTopics.push(
        `Gökyüzündeki ℞ Retro hareket (${day.retrogradeBodies[0].split(' ')[1]}) sebebiyle resmi detayları ve iletişimleri son kez teyit etmek`
      );
    } else {
      cautTopics.push(guide.cautionPool[0]);
    }
  } else if (day.verdict === 'caution') {
    cautTopics.push(guide.cautionPool[0], guide.cautionPool[1]);
    if (topChal) {
      const chalHouseTheme = HOUSE_THEMES[topChal.natalHouse] || HOUSE_THEMES[1];
      cautTopics.push(
        `Transit ${topChal.transitBodyName} ile Natal ${topChal.natalTargetName} arasındaki ${topChal.aspectName} (${topChal.orbFormatted} orb) nedeniyle ${chalHouseTheme.transitActionDomain} gerilim ve sert tepkilerden kaçınmak`
      );
    }
    if (secondChal) {
      cautTopics.push(
        `${secondChal.transitBodyName} – ${secondChal.natalTargetName} (${secondChal.aspectName}) etkisiyle ${secondChal.reasonTag} alanında riskli taahhütlerden uzak durmak`
      );
    }
    favTopics.push(
      `${category.shortLabel} alanında bağlayıcı yeni riskler almak yerine mevcut planları gözden geçirmek ve stratejik hazırlık yapmak`,
      `Ay ${day.moonSignName} burcunda (${day.moonNatalHouse}. Ev) ilerlerken ${moonHouseTheme.transitActionDomain} gözlemci ve esnek kalmak`
    );
    if (topSup) {
      favTopics.push(
        `Transit ${topSup.transitBodyName} – Natal ${topSup.natalTargetName} (${topSup.aspectName}) desteğini kriz çözümü ve içsel denge için kullanmak`
      );
    }
  } else {
    // Neutral / balanced day
    favTopics.push(
      guide.favorablePool[1],
      `Ay'ın ${day.moonSignName} (${day.moonNatalHouse}. Ev) seyriyle ${moonHouseTheme.transitActionDomain} planlı ve istikrarlı ilerlemek`
    );
    if (topSup) {
      favTopics.push(
        `Transit ${topSup.transitBodyName} – Natal ${topSup.natalTargetName} (${topSup.aspectName}) akışıyla destekleyici ön hazırlıklar yapmak`
      );
    }
    cautTopics.push(guide.cautionPool[0]);
    if (topChal) {
      cautTopics.push(
        `${topChal.transitBodyName} – ${topChal.natalTargetName} (${topChal.aspectName}) temasına karşı iletişimde esneklik payı bırakmak`
      );
    }
  }

  day.favorableTopics = favTopics;
  day.cautionTopics = cautTopics;

  // Build rich daySummaryNarrative & personalAdvice
  const moonContext = `Bu tarihte Ay <strong>${day.moonSignGlyph} ${day.moonSignName}</strong> burcunda (<strong>${day.lunarPhaseName}</strong>) ve doğum haritanızın <em>${moonHouseTheme.shortArena.toLocaleLowerCase('tr-TR')}</em> alanını yöneten <strong>${day.moonNatalHouse}. Evinizde</strong> ilerliyor.`;

  if (day.verdict === 'optimal') {
    const supDesc = topSup
      ? `Özellikle gökyüzündeki <strong>${topSup.transitBodyName}</strong> ile doğum haritanızdaki <strong>${topSup.natalTargetName} (${topSup.natalHouse}. Ev)</strong> arasında oluşan <strong>${topSup.orbFormatted}</strong> dar orblu <strong>${topSup.aspectName}</strong> açısı${secondSup ? ` ve <strong>${secondSup.transitBodyName}–${secondSup.natalTargetName}</strong> desteği` : ''}, <strong>${category.shortLabel}</strong> hedefleriniz için kapıları ardına kadar açıyor.`
      : `Hedef evlerinizden geçen iyicil gezegenler <strong>${category.shortLabel}</strong> konularında yüksek bir akış yaratıyor.`;
    day.daySummaryNarrative = `${moonContext} ${supDesc}`;
    day.personalAdvice = guide.optimalAdvice;
  } else if (day.verdict === 'favorable') {
    const supDesc = topSup
      ? `Transit <strong>${topSup.transitBodyName}</strong> ile Natal <strong>${topSup.natalTargetName}</strong> arasındaki uyumlu <strong>${topSup.aspectName}</strong> açısı, <strong>${category.shortLabel}</strong> adımlarınızda somut ilerleme ve kolaylaştırıcı koşullar sağlıyor.`
      : `Gökyüzü ritmi <strong>${category.shortLabel}</strong> girişimlerinizde istikrarlı ve yapıcı bir zemin sunuyor.`;
    day.daySummaryNarrative = `${moonContext} ${supDesc}`;
    day.personalAdvice = guide.favorableAdvice;
  } else if (day.verdict === 'caution') {
    const chalDesc = topChal
      ? `Gökyüzündeki <strong>${topChal.transitBodyName}</strong> ile doğum haritanızdaki <strong>${topChal.natalTargetName} (${topChal.natalHouse}. Ev)</strong> arasında gerçekleşen <strong>${topChal.orbFormatted}</strong> orblu zorlayıcı <strong>${topChal.aspectName}</strong> açısı${secondChal ? ` ve <strong>${secondChal.transitBodyName}–${secondChal.natalTargetName}</strong> gerilimi` : ''}, <strong>${category.shortLabel}</strong> konularında beklenmedik gecikmelere, baskıya veya fikir ayrılıklarına işaret ediyor.`
      : `Bu tarihte <strong>${category.shortLabel}</strong> ekseninizde zorlayıcı gökyüzü açıları ve retro hassasiyetleri öne çıkıyor.`;
    day.daySummaryNarrative = `${moonContext} ${chalDesc}`;
    day.personalAdvice = guide.cautionAdvice;
  } else {
    const balDesc = topSup
      ? `Transit <strong>${topSup.transitBodyName}–${topSup.natalTargetName}</strong> desteği mevcut olmakla birlikte gökyüzü genel olarak dengeli ve standart bir seyir izliyor.`
      : `Gökyüzü <strong>${category.shortLabel}</strong> konularında keskin bir baskı ya da olağanüstü bir ivme yaratmadan sakin ve dengeli bir akış sunuyor.`;
    day.daySummaryNarrative = `${moonContext} ${balDesc}`;
    day.personalAdvice = guide.neutralAdvice;
  }
}

/**
 * Generates Daily (Today) and Weekly (Next 7 Days) explanatory cosmic notifications
 * personalized to the user's natal chart and real-time ephemeris.
 */
export function generateCosmicNotifications(
  chart: ChartCalculationResult,
  nowDate: Date = new Date()
): CosmicNotificationsBundle {
  const tz = chart.input.location.timezone;
  const todayIso = formatDateIsoLocal(nowDate, tz);

  // Evaluate all 6 categories for the current month to extract today's and this week's multi-domain insights
  const categoryIds: ElectionalCategoryId[] = [
    'career',
    'meeting',
    'finance',
    'relationship',
    'education',
    'family'
  ];

  const forecastsByCat: Record<ElectionalCategoryId, ElectionalForecastResult> = {} as Record<
    ElectionalCategoryId,
    ElectionalForecastResult
  >;
  for (const cid of categoryIds) {
    forecastsByCat[cid] = evaluateThirtyDayElectionalForecast(
      chart,
      ELECTIONAL_CATEGORIES[cid].sampleQuestion,
      cid,
      nowDate
    );
  }

  // Also ensure we cover the next 7 calendar days even if today is near the end of the month
  const nextMonthDate = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 15, 12, 0, 0);
  const nextMonthForecastsByCat: Record<ElectionalCategoryId, ElectionalForecastResult> =
    {} as Record<ElectionalCategoryId, ElectionalForecastResult>;
  for (const cid of categoryIds) {
    nextMonthForecastsByCat[cid] = evaluateThirtyDayElectionalForecast(
      chart,
      ELECTIONAL_CATEGORIES[cid].sampleQuestion,
      cid,
      nextMonthDate
    );
  }

  const getDayEvalForCategory = (
    cid: ElectionalCategoryId,
    iso: string
  ): DailyElectionalEvaluation | undefined => {
    return (
      forecastsByCat[cid].allDays.find((d) => d.dateIso === iso) ||
      nextMonthForecastsByCat[cid].allDays.find((d) => d.dateIso === iso)
    );
  };

  // Build 7-day ISO list starting from today
  const sevenDayIsos: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(nowDate.getTime() + i * 86400000);
    sevenDayIsos.push(formatDateIsoLocal(d, tz));
  }

  const todayCareerDay =
    getDayEvalForCategory('career', todayIso) || forecastsByCat.career.allDays[0];
  const generatedDateFormatted = todayCareerDay.dateFormatted;

  const lastWeekDayEval =
    getDayEvalForCategory('career', sevenDayIsos[6]) || todayCareerDay;
  const generatedWeekRangeFormatted = `${todayCareerDay.shortDateFormatted} – ${lastWeekDayEval.dateFormatted}`;

  // 1. DAILY NOTIFICATIONS
  const dailyNotifications: CosmicNotificationItem[] = [];

  // Daily #1: Today's Multi-Category Best vs Caution Assessment
  const todayCatRankings = categoryIds
    .map((cid) => {
      const ev = getDayEvalForCategory(cid, todayIso) || forecastsByCat[cid].allDays[0];
      return {
        cid,
        cat: ELECTIONAL_CATEGORIES[cid],
        eval: ev
      };
    })
    .sort((a, b) => b.eval.netScore - a.eval.netScore);

  const bestTodayCat = todayCatRankings[0];
  const secondBestTodayCat = todayCatRankings[1];
  const worstTodayCat = todayCatRankings[todayCatRankings.length - 1];
  const moonHouseMeta = HOUSE_THEMES[todayCareerDay.moonNatalHouse] || HOUSE_THEMES[1];

  dailyNotifications.push({
    id: `daily-overview-${todayIso}`,
    scope: 'daily',
    tone: bestTodayCat.eval.netScore >= 5 ? 'optimal' : 'info',
    badgeLabel: 'Günlük Kozmik Pusula',
    title: `Bugünün Enerji Odakları: ${bestTodayCat.cat.shortLabel} ve ${todayCareerDay.moonNatalHouse}. Ev Gündemi`,
    dateLabel: todayCareerDay.dateFormatted,
    narrative: `Bugün Ay <strong>${todayCareerDay.moonSignGlyph} ${todayCareerDay.moonSignName} (${todayCareerDay.moonDegreeFormatted})</strong> konumunda, <strong>${todayCareerDay.lunarPhaseName}</strong> evresinde ve doğum haritanızın <strong>${todayCareerDay.moonNatalHouse}. Evinde</strong> (${moonHouseMeta.shortArena.toLocaleLowerCase('tr-TR')}) ilerliyor. Gökyüzü hesaplamalarına göre bugün haritanızda en yüksek desteği <strong>${bestTodayCat.cat.shortLabel}</strong> (Net Skor: ${bestTodayCat.eval.netScore >= 0 ? '+' : ''}${bestTodayCat.eval.netScore}) ve <strong>${secondBestTodayCat.cat.shortLabel}</strong> alanları alırken, <strong>${worstTodayCat.cat.shortLabel}</strong> konularında daha esnek ve tedbirli olunması öneriliyor.`,
    favorableHighlights: [
      `${bestTodayCat.cat.shortLabel}: ${bestTodayCat.eval.favorableTopics[0]}`,
      `${secondBestTodayCat.cat.shortLabel}: ${secondBestTodayCat.eval.favorableTopics[0]}`,
      `Ay ${todayCareerDay.moonNatalHouse}. Evde: ${moonHouseMeta.transitActionDomain} girişim ve düzenlemeler`
    ],
    cautionHighlights:
      worstTodayCat.eval.netScore < 0
        ? [
            `${worstTodayCat.cat.shortLabel}: ${worstTodayCat.eval.cautionTopics[0]}`,
            ...(worstTodayCat.eval.cautionTopics[1] ? [worstTodayCat.eval.cautionTopics[1]] : [])
          ]
        : [
            `Genel Akış: ${bestTodayCat.eval.cautionTopics[0]}`
          ],
    adviceText: bestTodayCat.eval.personalAdvice,
    targetCategoryId: bestTodayCat.cid,
    targetDateIso: todayIso
  });

  // Daily #2: Today's Active Tight Personal Transits Notification
  const activeTransits = chart.activeTransits;
  if (activeTransits.length > 0) {
    const topTr = activeTransits[0];
    const secondTr = activeTransits[1];
    const harmoniousList = activeTransits.filter((t) => t.nature === 'harmonious');
    const challengingList = activeTransits.filter((t) => t.nature === 'challenging');

    dailyNotifications.push({
      id: `daily-transits-${todayIso}`,
      scope: 'daily',
      tone:
        challengingList.length > harmoniousList.length
          ? 'caution'
          : harmoniousList.length > 0
            ? 'optimal'
            : 'info',
      badgeLabel: `Günlük Kişisel Transit (${activeTransits.length} Aktif Açı)`,
      title: `Bugün Sizi Etkileyen En Keskin Gökyüzü Açısı: ${topTr.headline}`,
      dateLabel: `Bugün • ±2.0° Dar Orb Analizi`,
      narrative: `${topTr.summary}${secondTr ? ` Ayrıca gökyüzünde <strong>${secondTr.headline}</strong> (${secondTr.orb.toFixed(2)}° orb) etkisi de bugün eşzamanlı olarak çalışıyor.` : ''}`,
      favorableHighlights:
        harmoniousList.length > 0
          ? harmoniousList
              .slice(0, 3)
              .map(
                (t) =>
                  `${t.transitBody.name} ${t.glyph} Natal ${t.natalTarget.name} (${t.orb.toFixed(2)}°): ${t.actionAdvice}`
              )
          : [
              `Mevcut dinamik açıları yüksek farkındalık, odaklanma ve stratejik planlama için değerlendirin.`
            ],
      cautionHighlights:
        challengingList.length > 0
          ? challengingList
              .slice(0, 3)
              .map(
                (t) =>
                  `${t.transitBody.name} ${t.glyph} Natal ${t.natalTarget.name} (${t.orb.toFixed(2)}°): ${t.actionAdvice}`
              )
          : [
              `Bugün ±2.0° dar orb içinde sert/gerilimli bir majör transit baskısı bulunmuyor; akışı güvenle değerlendirebilirsiniz.`
            ],
      adviceText: topTr.actionAdvice
    });
  }

  // Daily #3: If today has specific Caution aspects or Retrogrades, add a dedicated Daily Caution/Flexibility Advisory
  if (worstTodayCat.eval.netScore < 0 || todayCareerDay.retrogradeBodies.length > 0) {
    const topChal = worstTodayCat.eval.challengingEvidences[0];
    dailyNotifications.push({
      id: `daily-caution-${todayIso}`,
      scope: 'daily',
      tone: 'caution',
      badgeLabel: 'Günlük Dikkat & Esneklik Rehberi',
      title: `Bugün ${worstTodayCat.cat.shortLabel} Alanında Neye Dikkat Etmelisiniz?`,
      dateLabel: todayCareerDay.dateFormatted,
      narrative: `${worstTodayCat.eval.daySummaryNarrative}${todayCareerDay.retrogradeBodies.length > 0 ? ` Gökyüzünde şu an <strong>${todayCareerDay.retrogradeBodies.join(', ')}</strong> retro (℞) harekette olduğundan aceleci kararlar yerine iki kez kontrol prensibiyle ilerlemek sizi koruyacaktır.` : ''}`,
      favorableHighlights: worstTodayCat.eval.favorableTopics.slice(0, 2),
      cautionHighlights: worstTodayCat.eval.cautionTopics,
      adviceText: `${worstTodayCat.eval.personalAdvice}${topChal ? ` Özellikle ${topChal.transitBodyName}–${topChal.natalTargetName} (${topChal.aspectName}) etkisi geçerken sabırlı ve esnek kalın.` : ''}`,
      targetCategoryId: worstTodayCat.cid,
      targetDateIso: todayIso
    });
  }

  // 2. WEEKLY NOTIFICATIONS & 7-DAY DIGEST
  const weeklyDayDigest: WeeklyDayDigestItem[] = [];
  for (const iso of sevenDayIsos) {
    const rankings = categoryIds
      .map((cid) => {
        const ev = getDayEvalForCategory(cid, iso) || forecastsByCat[cid].allDays[0];
        return { cid, cat: ELECTIONAL_CATEGORIES[cid], eval: ev };
      })
      .sort((a, b) => b.eval.netScore - a.eval.netScore);

    const best = rankings[0];
    const worst = rankings[rankings.length - 1];
    const baseEval = best.eval;

    let overallVerdict: 'optimal' | 'favorable' | 'neutral' | 'caution' = baseEval.verdict;
    let overallVerdictLabel = baseEval.verdictLabel;
    if (worst.eval.netScore < -14 && best.eval.netScore < 10) {
      overallVerdict = 'caution';
      overallVerdictLabel = 'Dikkat / Esneklik Günü';
    } else if (best.eval.netScore >= 14) {
      overallVerdict = 'optimal';
      overallVerdictLabel = `${best.cat.shortLabel} İçin En Uygun`;
    } else if (best.eval.netScore >= 6) {
      overallVerdict = 'favorable';
      overallVerdictLabel = `${best.cat.shortLabel} Destekleyici`;
    }

    const summaryText =
      overallVerdict === 'caution'
        ? worst.eval.daySummaryNarrative
        : best.eval.daySummaryNarrative;
    const adviceText =
      overallVerdict === 'caution' ? worst.eval.personalAdvice : best.eval.personalAdvice;

    weeklyDayDigest.push({
      dateIso: iso,
      dateFormatted: baseEval.dateFormatted,
      shortDateFormatted: baseEval.shortDateFormatted,
      verdict: overallVerdict,
      verdictLabel: overallVerdictLabel,
      netScore: best.eval.netScore,
      moonSignGlyph: baseEval.moonSignGlyph,
      moonSignName: baseEval.moonSignName,
      moonNatalHouse: baseEval.moonNatalHouse,
      lunarPhaseName: baseEval.lunarPhaseName,
      bestCategoryId: best.cid,
      bestCategoryLabel: best.cat.shortLabel,
      cautionCategoryLabel: worst.cat.shortLabel,
      summaryText,
      adviceText
    });
  }

  const weeklyNotifications: CosmicNotificationItem[] = [];

  // Weekly #1: Best Opportunity Days of the Next 7 Days
  const bestWeekDays = [...weeklyDayDigest]
    .sort((a, b) => b.netScore - a.netScore)
    .slice(0, 3);
  const topWeekDay = bestWeekDays[0];
  const topWeekCatEval =
    getDayEvalForCategory(topWeekDay.bestCategoryId, topWeekDay.dateIso) || todayCareerDay;

  weeklyNotifications.push({
    id: `weekly-optimal-${todayIso}`,
    scope: 'weekly',
    tone: 'optimal',
    badgeLabel: 'Haftalık Fırsat Bildirimi (7 Gün)',
    title: `Bu Haftanın En Yüksek Uyumlu Günleri: ${bestWeekDays.map((d) => d.shortDateFormatted).join(', ')}`,
    dateLabel: generatedWeekRangeFormatted,
    narrative: `Önümüzdeki 7 günlük gerçek ephemeris taramasına göre doğum haritanızla en güçlü pozitif açıların kurulduğu lider gün <strong>${topWeekDay.dateFormatted}</strong> (En güçlü alan: <strong>${topWeekDay.bestCategoryLabel}</strong>, Skor: +${topWeekDay.netScore}). Önemli başlangıçlarınızı, kritik görüşmelerinizi, imzalarınızı veya finansal/duygusal adımlarınızı bu destekleyici günlere planlayarak gökyüzü rüzgarını arkanıza alabilirsiniz.`,
    favorableHighlights: bestWeekDays.map((d) => {
      const ev = getDayEvalForCategory(d.bestCategoryId, d.dateIso) || todayCareerDay;
      return `${d.dateFormatted} (${d.bestCategoryLabel} • Ay ${d.moonSignName} ${d.moonNatalHouse}. Ev): ${ev.favorableTopics[0]}`;
    }),
    cautionHighlights: [
      `Fırsat günlerinde dahi ${topWeekCatEval.cautionTopics[0].toLocaleLowerCase('tr-TR')} ilkesini göz önünde bulundurun.`
    ],
    adviceText: `Bu hafta en kritik adımlarınızı ${topWeekDay.dateFormatted} ve ${bestWeekDays[1]?.dateFormatted || topWeekDay.dateFormatted} tarihlerine odaklayın; hazırlıklarınızı bu tarihlere kadar tamamlayın.`,
    targetCategoryId: topWeekDay.bestCategoryId,
    targetDateIso: topWeekDay.dateIso
  });

  // Weekly #2: Caution / Flexibility Days of the Next 7 Days
  const weekCautionCandidates = categoryIds.flatMap((cid) =>
    sevenDayIsos
      .map((iso) => {
        const ev = getDayEvalForCategory(cid, iso);
        return ev ? { cid, cat: ELECTIONAL_CATEGORIES[cid], eval: ev } : null;
      })
      .filter(
        (item): item is { cid: ElectionalCategoryId; cat: ElectionalPresetQuestion; eval: DailyElectionalEvaluation } =>
          Boolean(item && item.eval.challengingEvidences.length > 0 && item.eval.netScore < 0)
      )
  );
  weekCautionCandidates.sort((a, b) => a.eval.netScore - b.eval.netScore);

  // Deduplicate by dateIso
  const uniqueCautionWeekDays: Array<{
    cid: ElectionalCategoryId;
    cat: ElectionalPresetQuestion;
    eval: DailyElectionalEvaluation;
  }> = [];
  for (const item of weekCautionCandidates) {
    if (!uniqueCautionWeekDays.some((u) => u.eval.dateIso === item.eval.dateIso)) {
      uniqueCautionWeekDays.push(item);
    }
    if (uniqueCautionWeekDays.length >= 3) break;
  }

  if (uniqueCautionWeekDays.length > 0) {
    const worstWk = uniqueCautionWeekDays[0];
    weeklyNotifications.push({
      id: `weekly-caution-${todayIso}`,
      scope: 'weekly',
      tone: 'caution',
      badgeLabel: 'Haftalık Dikkat & Esneklik Uyarısı',
      title: `Bu Hafta Esnek Olunması Önerilen Günler: ${uniqueCautionWeekDays.map((u) => u.eval.shortDateFormatted).join(', ')}`,
      dateLabel: generatedWeekRangeFormatted,
      narrative: `Bu hafta içerisinde özellikle <strong>${worstWk.eval.dateFormatted}</strong> tarihinde <strong>${worstWk.cat.shortLabel}</strong> ekseninizde zorlayıcı gökyüzü açıları (Skor: ${worstWk.eval.netScore}) öne çıkıyor. Bu günlerde kesin ve geri dönüşsüz taahhütlere girmek veya gerilimli tartışmaları büyütmek yerine esnek kalmak, koşulları gözlemlemek ve dinlenmeye/hazırlığa vakit ayırmak çok daha sağlıklı sonuç verecektir.`,
      favorableHighlights: uniqueCautionWeekDays.map(
        (u) => `${u.eval.shortDateFormatted} için doğru strateji: ${u.eval.favorableTopics[0]}`
      ),
      cautionHighlights: uniqueCautionWeekDays.map(
        (u) =>
          `${u.eval.dateFormatted} (${u.cat.shortLabel}): ${u.eval.cautionTopics[0]}`
      ),
      adviceText: worstWk.eval.personalAdvice,
      targetCategoryId: worstWk.cid,
      targetDateIso: worstWk.eval.dateIso
    });
  } else {
    weeklyNotifications.push({
      id: `weekly-calm-${todayIso}`,
      scope: 'weekly',
      tone: 'info',
      badgeLabel: 'Haftalık Denge Raporu',
      title: `Bu Hafta Keskin Gökyüzü Türbülansı Yok — İstikrarlı Akış`,
      dateLabel: generatedWeekRangeFormatted,
      narrative: `Önümüzdeki 7 gün boyunca doğum haritanızın ana eksenlerini ağır biçimde zorlayan sert bir açı kümelenmesi görünmüyor. Haftayı planlı, dengeli ve uzun vadeli hedeflerinize odaklanarak verimli geçirebilirsiniz.`,
      favorableHighlights: [
        `Kariyer, iletişim ve ilişkilerde istikrarlı adımlar atabilirsiniz.`,
        `Ay'ın burç ve ev geçişlerini takip ederek günlük ritminizi optimize edebilirsiniz.`
      ],
      cautionHighlights: [
        `Rutin işlerde rehavete kapılmadan planlı disiplininizi koruyun.`
      ],
      adviceText: `Haftanın sakin ve destekleyici akışını, yarım kalan projelerinizi tamamlamak ve yeni adımlarınızı sağlam temellere oturtmak için kullanın.`,
      targetCategoryId: 'career',
      targetDateIso: todayIso
    });
  }

  // Weekly #3: 7-Day Lunar & House Transit Roadmap
  const visitedSigns = Array.from(new Set(weeklyDayDigest.map((d) => `${d.moonSignGlyph} ${d.moonSignName}`)));
  const visitedHouses = Array.from(new Set(weeklyDayDigest.map((d) => `${d.moonNatalHouse}. Ev`)));

  weeklyNotifications.push({
    id: `weekly-lunar-roadmap-${todayIso}`,
    scope: 'weekly',
    tone: 'info',
    badgeLabel: 'Haftalık Ay & Ev Rotası',
    title: `7 Günlük Duygusal & Pratik Odak Haritanız (${visitedSigns.join(' → ')})`,
    dateLabel: generatedWeekRangeFormatted,
    narrative: `Bu hafta boyunca Ay sırasıyla <strong>${visitedSigns.join(', ')}</strong> burçlarından geçerek doğum haritanızda <strong>${visitedHouses.join(', ')}</strong> alanlarını aydınlatacak. Ay'ın geçtiği ev, o gün zihninizin ve duygusal ihtiyaçlarınızın hangi yaşam sahnesine odaklanacağını belirler.`,
    favorableHighlights: weeklyDayDigest.slice(0, 4).map((d) => {
      const hm = HOUSE_THEMES[d.moonNatalHouse] || HOUSE_THEMES[1];
      return `${d.shortDateFormatted} (Ay ${d.moonSignName} • ${d.moonNatalHouse}. Ev): ${hm.shortArena}`;
    }),
    cautionHighlights:
      todayCareerDay.retrogradeBodies.length > 0
        ? [
            `Hafta genelinde aktif retrolar: ${todayCareerDay.retrogradeBodies.join(' • ')}`
          ]
        : [
            `Ay burç değiştirirken (geçiş saatlerinde) duygusal dalgalanmalara karşı merkezde kalın.`
          ],
    adviceText: `Aşağıdaki 7 günlük takvim özetinden her günün özel tavsiyesini inceleyebilir ve istediğiniz güne dokunarak tam açı raporunu açabilirsiniz.`
  });

  return {
    unreadKey: todayIso,
    generatedDateFormatted,
    generatedWeekRangeFormatted,
    totalCount: dailyNotifications.length + weeklyNotifications.length,
    dailyNotifications,
    weeklyNotifications,
    weeklyDayDigest
  };
}
