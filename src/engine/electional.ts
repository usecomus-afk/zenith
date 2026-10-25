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

export const ELECTIONAL_CATEGORIES: Record<ElectionalCategoryId, ElectionalPresetQuestion> = {
  career: {
    id: 'career',
    icon: '💼',
    shortLabel: 'Yeni İş & Kariyer',
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
    icon: '🤝',
    shortLabel: 'Önemli Görüşme & İmza',
    sampleQuestion: 'Önemli bir görüşme yapmak veya sözleşme imzalamak için hangi günü seçmeliyim?',
    title: 'Önemli Görüşme, Müzakere, Sözleşme ve Resmi İmza Zamanlaması',
    targetHouses: [3, 7, 10, 1],
    primaryBodies: ['mercury', 'venus', 'jupiter', 'sun'],
    targetAngles: ['asc', 'dsc', 'mc'],
    avoidRetrogrades: ['mercury', 'venus'],
    methodologyText:
      'Doğum haritanızdaki 3. Ev (İletişim, Sözleşme, İmza), 7. Ev (DSC / Muhatap ve Ortaklık), bu evlerin yöneticileri ve Natal Merkür/Venüs/Jüpiter derecelerinizle önümüzdeki 30 günlük gerçek gökyüzü açıları taranır.'
  },
  family: {
    id: 'family',
    icon: '🏡',
    shortLabel: 'Aile, Ev & Taşınma',
    sampleQuestion: 'Aile konusunda karar vermek, ev veya taşınma adımı için uygun gün hangisi?',
    title: 'Ailevi Kararlar, Ev Düzeni, Gayrimenkul ve Yuva Zamanlaması',
    targetHouses: [4, 2, 7],
    primaryBodies: ['moon', 'venus', 'jupiter', 'saturn', 'sun'],
    targetAngles: ['ic', 'asc'],
    avoidRetrogrades: ['venus', 'mercury'],
    methodologyText:
      'Doğum haritanızdaki 4. Ev (IC / Kökler, Aile, Gayrimenkul), 2. Ev (Güvenlik), 4. Ev Yöneticiniz ve Natal Ay/Venüs/Jüpiter konumlarınızla önümüzdeki 30 günün gerçek gökyüzü boylamları eşleştirilir.'
  },
  finance: {
    id: 'finance',
    icon: '💰',
    shortLabel: 'Finans, Yatırım & Bütçe',
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
    icon: '💖',
    shortLabel: 'İlişki & Duygusal Adım',
    sampleQuestion: 'İlişki konuşması, barışma veya duygusal bir başlangıç için en uygun gün hangisi?',
    title: 'İkili İlişkiler, Romantik Başlangıç ve Duygusal Uzlaşma Zamanlaması',
    targetHouses: [7, 5, 1],
    primaryBodies: ['venus', 'moon', 'sun', 'jupiter', 'mars'],
    targetAngles: ['dsc', 'asc'],
    avoidRetrogrades: ['venus'],
    methodologyText:
      'Doğum haritanızdaki 7. Ev (DSC / İkili İlişkiler ve Ortaklık), 5. Ev (Aşk ve Kalp Bağları), bu evlerin yöneticileri ve Natal Venüs/Ay/Güneş derecelerinizle 30 günlük gerçek gökyüzü açıları hesaplanır.'
  },
  education: {
    id: 'education',
    icon: '🎓',
    shortLabel: 'Eğitim, Sınav & Seyahat',
    sampleQuestion: 'Eğitim başvurusu, akademik adım veya seyahat/vize için en uygun gün hangisi?',
    title: 'Akademik Başvuru, Eğitim, Hukuki Süreç ve Uluslararası/Seyahat Zamanlaması',
    targetHouses: [9, 3, 10],
    primaryBodies: ['jupiter', 'mercury', 'sun', 'uranus'],
    targetAngles: ['mc', 'asc'],
    avoidRetrogrades: ['mercury'],
    methodologyText:
      'Doğum haritanızdaki 9. Ev (Yükseköğrenim, Yurt Dışı, Vizyon, Hukuk), 3. Ev (Sınav ve Zihin), bu evlerin yöneticileri ve Natal Jüpiter/Merkür derecelerinizle 30 günlük gerçek gökyüzü hareketleri taranır.'
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
    phaseName = '🌑 Yeniay Fazı';
  } else if (elong < 67.5) {
    phaseName = '🌒 Büyüyen Hilal';
  } else if (elong < 112.5) {
    phaseName = '🌓 İlk Dördün';
  } else if (elong < 157.5) {
    phaseName = '🌔 Büyüyen Ay';
  } else if (elong < 202.5) {
    phaseName = '🌕 Dolunay Fazı';
  } else if (elong < 247.5) {
    phaseName = '🌖 Küçülen Ay';
  } else if (elong < 292.5) {
    phaseName = '🌗 Son Dördün';
  } else {
    phaseName = '🌘 Balsamik Ay';
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

  for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
    const sampleDate = new Date(baseDate.getTime() + dayOffset * 86400000);
    const dateIso = formatDateIsoLocal(sampleDate, tz);
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
      keyTransitedHouses
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
      day.verdictLabel = '🌟 En Uygun (Yüksek Uyum)';
    } else if (day.netScore > 4 && day.supportiveEvidences.length >= day.challengingEvidences.length) {
      day.verdict = 'favorable';
      day.verdictLabel = '✦ Destekleyici Gün';
    } else if (day.netScore <= minScore * 0.5 && day.challengingEvidences.length > 0) {
      day.verdict = 'caution';
      day.verdictLabel = '⚠️ Dikkat / Gerilimli Açı';
    } else {
      day.verdict = 'neutral';
      day.verdictLabel = '⚖️ Dengeli / Nötr Gün';
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
    d.verdictLabel = '🌟 En Uygun Gün';
  }

  const cautionDays = sortedByCaution.slice(0, 3);
  for (const d of cautionDays) {
    if (!topOptimalDays.some((opt) => opt.dateIso === d.dateIso)) {
      d.verdict = 'caution';
      d.verdictLabel = '⚠️ Dikkat Edilmesi Önerilen Gün';
    }
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
