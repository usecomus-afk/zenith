import {
  AngleId,
  AnglePosition,
  BodyId,
  HouseCusp,
  PlanetPosition,
  RoyalStarAnalysis,
  RoyalStarConjunction,
  RoyalStarId,
  ZodiacSignMeta
} from '../types/astrology';
import { HOUSE_THEMES } from './interpretation';

const PRECESSION_ARCSEC_PER_YEAR = 50.2888; // ~1° every 71.58 years
const J2000_JD = 2451545.0;

interface RoyalStarStaticDef {
  id: RoyalStarId;
  name: string;
  persianTitle: string;
  archangel: string;
  constellation: string;
  planetaryNature: string;
  j2000Longitude: number;
  eclipticLatitude: number;
  magnitude: number;
  criticalDegreeLabel: string;
  coreArchetype: string;
  royalPromise: string;
  nemesisShadowTest: string;
}

export const ROYAL_STAR_DEFS: RoyalStarStaticDef[] = [
  {
    id: 'aldebaran',
    name: 'Aldebaran',
    persianTitle: "Doğu'nun Muhafızı (İlkbahar Ekinoksu Bekçisi)",
    archangel: 'Başmelek Mikail (Michael)',
    constellation: "α Tauri (Boğa Takımyıldızı — Boğa'nın Kızıl Gözü)",
    planetaryNature: 'Mars Doğasında (Cesaret, Öncülük, Ticari & Zihinsel Hâkimiyet)',
    j2000Longitude: 69.7892, // 09° 47' İkizler (J2000.0)
    eclipticLatitude: -5.467,
    magnitude: 0.86,
    criticalDegreeLabel: "09°–10° İkizler (J2000: 09° 47' İkizler)",
    coreArchetype: 'Dürüstlük, Sözün Namusu, Stratejik Zekâ ve Öncü Liderlik',
    royalPromise:
      'Aldebaran; iletişim, ticaret, sözleşmeler, entelektüel liderlik ve stratejik girişimlerde olağanüstü bir yükseliş, servet ve kamusal saygınlık vaat eder. Kişiye karmaşık krizleri zekâ ve cesaretle yönetme kudreti verir.',
    nemesisShadowTest:
      'Aldebaran’ın büyük kraliyet sınavı **Ahlaki Bütünlük ve Dürüstlük (Integrity)** sınavıdır. Başarıya ulaşırken doğruluktan sapmak, bilgiyi veya sözü manipülasyon aracı yapmak ya da etik dışı kısa yollara başvurmak yıldızın verdiği gücü hızla geri almasına yol açar. Özü sözü bir kalındığında ise sarsılmaz bir zafer sağlar.'
  },
  {
    id: 'regulus',
    name: 'Regulus',
    persianTitle: "Kuzey'in Muhafızı (Yaz Gündönümü Bekçisi)",
    archangel: 'Başmelek Rafael (Raphael)',
    constellation: "α Leonis (Aslan Takımyıldızı — Aslan'ın Kalbi / Cor Leonis)",
    planetaryNature: 'Mars & Jüpiter Doğasında (Krallık, Asalet, Zafer ve Doğal Otorite)',
    j2000Longitude: 149.8289, // 29° 50' Aslan (J2000.0) -> 2012 sonrası 00° Başak
    eclipticLatitude: 0.465,
    magnitude: 1.36,
    criticalDegreeLabel: "29° Aslan – 00° Başak (J2000: 29° 50' Aslan; 2012 sonrası 00° Başak)",
    coreArchetype: 'Krallık, Doğal Otorite, Yüce Gönüllülük ve Zirve Liderliği',
    royalPromise:
      'Ekliptik düzlemine en yakın Kraliyet Yıldızı olan Regulus (Küçük Kral); kişiye doğuştan gelen bir asalet, bağımsızlık, üst düzey yöneticilik, şöhret ve toplumsal zirveye çıkma gücü bahşeder.',
    nemesisShadowTest:
      'Regulus’un büyük kraliyet sınavı **İntikam Arzusundan ve Kibirden Arınma** sınavıdır. Güç ve makam elde edildiğinde yapılan haksızlıklara öç alma dürtüsüyle karşılık vermek veya egoya/kibre yenik düşmek sert bir gözden düşüş tetikler. İntikamı ilahi adalete bırakıp adil ve bağışlayıcı kalındığında taht kalıcı olur.'
  },
  {
    id: 'antares',
    name: 'Antares',
    persianTitle: "Batı'nın Muhafızı (Sonbahar Ekinoksu Bekçisi)",
    archangel: 'Başmelek Uriel (Oriel)',
    constellation: "α Scorpii (Akrep Takımyıldızı — Akrep'in Kalbi / Cor Scorpii)",
    planetaryNature: 'Mars & Jüpiter Doğasında (Tutku, Korkusuzluk ve Kriz Dönüştürücü Kudret)',
    j2000Longitude: 249.7611, // 09° 46' Yay (J2000.0)
    eclipticLatitude: -4.571,
    magnitude: 1.06,
    criticalDegreeLabel: "09°–10° Yay (J2000: 09° 46' Yay)",
    coreArchetype: 'Stratejik Cesaret, Krizlerde Küllerinden Doğma ve Dönüştürücü Tutku',
    royalPromise:
      'Antares; en zorlu kriz anlarında bile geri adım atmayan bir stratejik cesaret, derin sezgi, büyük ölçekli vizyoner başarı ve imkânsız görünen mücadeleleri kazanma kudreti verir.',
    nemesisShadowTest:
      'Antares’in büyük kraliyet sınavı **Takıntı (Obsesyon), Aşırılık ve Kendi Kendini Sabote Etmeme** sınavıdır. Hırsın yıkıcı bir tutkuya veya ya-hep-ya-hiç uçlarına dönüşmesi kişiyi kendi eliyle yıpratabilir. Tutku; bilgelik, stratejik ölçü ve yapıcı dönüşüm için kullanıldığında eşsiz bir zafer getirir.'
  },
  {
    id: 'fomalhaut',
    name: 'Fomalhaut',
    persianTitle: "Güney'in Muhafızı (Kış Gündönümü Bekçisi)",
    archangel: 'Başmelek Cebrail (Gabriel)',
    constellation: 'α Piscis Austrini (Güney Balığı Takımyıldızı)',
    planetaryNature: 'Venüs & Merkür Doğasında (Mistik İlham, Sanatsal/Ruhsal Yüceliş ve Karizma)',
    j2000Longitude: 333.8644, // 03° 52' Balık (J2000.0)
    eclipticLatitude: -21.132,
    magnitude: 1.16,
    criticalDegreeLabel: "03°–04° Balık (J2000: 03° 52' Balık)",
    coreArchetype: 'İlahi İlham, Vizyoner İdealler, Sanatsal/Ruhsal Ölümsüzlük ve Büyüleyici Etki',
    royalPromise:
      'Fomalhaut; maddi dünyanın ötesine geçen yüksek bir sezgi, sanatsal ve felsefi deha, kitleleri büyüleyen bir karizma ve adını kalıcı bir eserle ölümsüzleştirme potansiyeli sunar.',
    nemesisShadowTest:
      'Fomalhaut’un büyük kraliyet sınavı **Ruhsal ve Etik İdealleri Maddi Çıkara Satmama** sınavıdır. Saf vizyonun, sanatın veya manevi değerlerin salt maddi kazanç ya da illüzyon uğruna yozlaştırılması yıldızın desteğini keser. İdealler saf, samimi ve bütüne hizmet edecek şekilde korunduğunda mucizevi kapılar açılır.'
  }
];

function normalizeDegLocal(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

function shortestAngularDistLocal(lonA: number, lonB: number): number {
  const diff = Math.abs(normalizeDegLocal(lonA) - normalizeDegLocal(lonB));
  return diff > 180 ? 360 - diff : diff;
}

function formatDegMinLocal(degInSign: number): string {
  const clamped = Math.max(0, Math.min(29.9999, degInSign));
  const deg = Math.floor(clamped);
  const min = Math.floor((clamped - deg) * 60);
  return `${String(deg).padStart(2, '0')}° ${String(min).padStart(2, '0')}'`;
}

function formatOrbDegMin(orbDeg: number): string {
  const deg = Math.floor(orbDeg);
  const min = Math.round((orbDeg - deg) * 60);
  if (min === 60) {
    return `${deg + 1}° 00'`;
  }
  return `${deg}° ${String(min).padStart(2, '0')}'`;
}

function findHouseForLongitude(lon: number, houses: HouseCusp[]): number {
  const normLon = normalizeDegLocal(lon);
  for (let i = 0; i < 12; i++) {
    const start = houses[i].longitude;
    const end = houses[(i + 1) % 12].longitude;
    const span = normalizeDegLocal(end - start);
    const rel = normalizeDegLocal(normLon - start);
    if (rel < span) {
      return houses[i].house;
    }
  }
  return 1;
}

const TARGET_ROLE_DESCRIPTIONS: Record<
  BodyId | AngleId,
  {
    domainLabel: string;
    giftFocus: string;
    testFocus: string;
  }
> = {
  sun: {
    domainLabel: 'Öz Kimlik, Yaşam İradesi ve Otorite Figürü (Güneş)',
    giftFocus:
      'bilinçli kimliğinize, liderlik duruşunuza ve yaşam amacınıza doğrudan kraliyet mührü vurur; bulunduğunuz ortamda doğal bir merkez ve otorite olmanızı sağlar',
    testFocus:
      'ego yönetimi, kişisel güç kullanımı ve liderlik kararlarınızda yıldızın etik ilkesinden asla taviz vermemenizi şart koşar'
  },
  moon: {
    domainLabel: 'Duygusal Merkez, Sezgi, Halkla İlişkiler ve İçgüdü (Ay)',
    giftFocus:
      'duygusal zekânıza, sezgisel isabetinize ve kitlelerle/halkla kurduğunuz empatik bağa olağanüstü bir manyetizma ve koruyucu güç kazandırır',
    testFocus:
      'duygusal dalgalanmalar, ailevi süreçler ve güvenlik arayışında tepkisel ya da manipülatif uçlara kaymadan içsel saflığı korumanızı ister'
  },
  mercury: {
    domainLabel: 'Zihinsel Mimari, Söz, Ticaret ve Stratejik Analiz (Merkür)',
    giftFocus:
      'sözlerinize, yazılı/sözlü ifadenize, ticari zekânıza ve stratejik planlama yeteneğinize keskin bir ikna gücü ve entelektüel üstünlük verir',
    testFocus:
      'sözleşmelerde, ticari hamlelerde ve bilgi paylaşımında kurnazlık veya bilgi çarpıtma tuzağına düşmeden mutlak şeffaflıkla hareket etmenizi talep eder'
  },
  venus: {
    domainLabel: 'İlişkiler, Finansal Çekim, Sanat ve Değerler (Venüs)',
    giftFocus:
      'sosyal cazibenize, sanatsal/estetik yeteneklerinize, diplomasi gücünüze ve finansal bolluk kanallarınıza yüksek bir zarafet ve bereket taşır',
    testFocus:
      'ikili ilişkilerde ve maddi değer kazanımlarında çıkar odaklı bağlardan veya yüzeysel hazlardan kaçınıp gerçek değer ve sadakate bağlı kalmanızı sınar'
  },
  mars: {
    domainLabel: 'Eylem Gücü, Cesaret, Girişim ve Mücadele İradesi (Mars)',
    giftFocus:
      'girişimcilik cesaretinize, yürütme gücünüze ve kriz anlarındaki liderlik refleksinize yenilmez bir komutan kararlılığı ve hız kazandırır',
    testFocus:
      'öfke kontrolü, rekabet ve güç mücadelelerinde yıkıcı/intikamcı hamlelerden uzak durup enerjinizi yalnızca yapıcı zaferlere yönlendirmenizi gerektirir'
  },
  jupiter: {
    domainLabel: 'Bolluk, Yüksek Vizyon, Hukuk ve Toplumsal Genişleme (Jüpiter)',
    giftFocus:
      'vizyonunuza, akademik/uluslararası ufuklarınıza, servet ve bilgelik kapasitenize büyük ölçekli bir koruma, prestij ve genişleme fırsatı sunar',
    testFocus:
      'büyüme ve başarı geldiğinde kibir, abartı veya ahlaki üstünlük kompleksine kapılmadan adil ve cömert kalmanızı şart koşar'
  },
  saturn: {
    domainLabel: 'Kariyer İnşası, Disiplin, Kalıcı Yapılar ve Otorite (Satürn)',
    giftFocus:
      'sabır, disiplin ve kurumsal ustalıkla inşa ettiğiniz yapıların zamana meydan okuyan bir zirveye ve sarsılmaz bir toplumsal statüye ulaşmasını sağlar',
    testFocus:
      'sorumluluk taşırken katılık, korku veya aşırı kontrolcülük yerine adil düzen ve sarsılmaz iş ahlakıyla hareket etmenizi sınar'
  },
  uranus: {
    domainLabel: 'İnovasyon, Özgünlük, Teknoloji ve Kolektif Uyanış (Uranüs)',
    giftFocus:
      'çağın ilerisindeki fikirlerinize, teknolojik/bilimsel özgünlüğünüze ve reformcu vizyonunuza ani sıçramalar ve öncü bir etki gücü verir',
    testFocus:
      'değişim yaratırken yıkıcı isyankârlık yerine kolektif fayda üreten bilinçli devrimler yapmanızı ister'
  },
  neptune: {
    domainLabel: 'Ruhsal Vizyon, Sanatsal İlham ve Kolektif Empati (Neptün)',
    giftFocus:
      'sanatsal yaratıcılığınıza, ruhsal sezgilerinize ve kitleleri etkileyen vizyoner hayal gücünüze aşkın bir derinlik kazandırır',
    testFocus:
      'hayal kırıklığı, illüzyon veya kaçış eğilimlerine kapılmadan ruhsal ideallerinizi somut ve temiz bir zeminde yaşatmanızı sınar'
  },
  pluto: {
    domainLabel: 'Derin Dönüşüm, Kriz Yönetimi ve Küllerinden Doğma (Plüton)',
    giftFocus:
      'en büyük krizleri bile muazzam bir güce dönüştürme, psikolojik nüfuz ve köklü sistemleri yeniden inşa etme kudreti verir',
    testFocus:
      'güç tutkusu, obsesif kontrol veya perde arkası güç oyunlarından tamamen uzak durup dönüşüm gücünü şifa ve yeniden inşa için kullanmanızı şart koşar'
  },
  true_node: {
    domainLabel: 'Kadersel Yaşam Yolu ve Tekâmül Pusulası (Kuzey Ay Düğümü)',
    giftFocus:
      'bu yaşamdaki kadersel büyüme rotanızın doğrudan bir Kraliyet Yıldızı tarafından korunduğunu ve doğru yolda ilerledikçe beklenmedik kapıların açılacağını gösterir',
    testFocus:
      'konfor alanına sığınmak yerine yıldızın işaret ettiği yüksek etik standartları yaşam felsefeniz haline getirmenizi ister'
  },
  asc: {
    domainLabel: 'Yükselen Burç Ekseni — Kimlik, Persona ve Hayat Rotası (ASC / 1. Ev)',
    giftFocus:
      'doğum anınızda Doğu ufkunda yükselerek tüm yaşam rotanıza, fiziksel duruşunuza ve ilk izleniminize doğrudan kraliyet karizması ve öncü bir kader mührü kazandırır',
    testFocus:
      'hayata karşı aldığınız her kişisel kararda ve dış dünyaya sunduğunuz kimlikte yıldızın etik sınavını bizzat temsil etmenizi gerektirir'
  },
  mc: {
    domainLabel: 'Tepe Noktası (Zenith) — Kariyer Zirvesi ve Toplumsal Statü (MC / 10. Ev)',
    giftFocus:
      'haritanın en yüksek zirvesinde (Zenith) parlayarak mesleki yaşamınızda, kamusal itibarınızda ve toplumsal statünüzde en üst düzey başarı ve tanınırlık potansiyeli açar',
    testFocus:
      'kariyer zirvesine tırmanırken ve otorite kullanırken yıldızın gölge sınavına (etik ihlal, kibir, takıntı veya idealleri satma) karşı en yüksek özeni göstermenizi şart koşar'
  },
  dsc: {
    domainLabel: 'Alçalan Ekseni — Evlilik, Ortaklıklar ve Sözleşmeler (DSC / 7. Ev)',
    giftFocus:
      'ikili ilişkileriniz, stratejik ortaklıklarınız ve eş/ortak figürleriniz üzerinden hayatınıza güçlü, nüfuzlu ve kaderinizi büyüten kişiler çeker',
    testFocus:
      'ortaklıklarda, sözleşmelerde ve açık rekabette adalet, sadakat ve dürüstlük dengesini korumanızı sınar'
  },
  ic: {
    domainLabel: 'Dip Noktası — Aile Kökleri, İçsel Temel ve Miras (IC / 4. Ev)',
    giftFocus:
      'aile köklerinizden gelen derin bir mirası, güçlü bir içsel çapayı ve yaşamınızın ikinci yarısında/özel hayatınızda kuracağınız sarsılmaz bir kaleyi temsil eder',
    testFocus:
      'özel yaşamınızda ve ailevi köklerinizde geçmişin gölgelerini arındırıp sağlam bir içsel ahlak temeli kurmanızı ister'
  }
};

function buildConjunctionInterpretation(
  starDef: RoyalStarStaticDef,
  targetId: BodyId | AngleId,
  targetName: string,
  targetGlyph: string,
  targetFormatted: string,
  targetHouse: number,
  orb: number,
  starFormatted: string
): RoyalStarConjunction {
  const tier: RoyalStarConjunction['tier'] = orb <= 0.5 ? 'partile' : 'active';
  const tierLabel =
    tier === 'partile'
      ? 'Tam (Partil) Kraliyet Mührü (≤0°30′)'
      : 'Kritik Derece Kraliyet Kavuşumu (≤1°00′)';

  const roleMeta = TARGET_ROLE_DESCRIPTIONS[targetId];
  const houseMeta = HOUSE_THEMES[targetHouse] || HOUSE_THEMES[1];
  const orbFormatted = formatOrbDegMin(orb);

  const headline = `${starDef.name} (${starFormatted}) ☌ Natal ${targetGlyph} ${targetName} (${targetFormatted}) — ${targetHouse}. Ev`;

  const promiseText = `Doğum haritanızda **${starDef.name}** (${starDef.persianTitle}) ile **${targetGlyph} ${targetName}** arasında **${orbFormatted}** orb ile **${tierLabel}** bulunuyor. Bu kavuşum, **${targetHouse}. Ev** (${houseMeta.shortArena}) yaşam alanınızda ${roleMeta.giftFocus}. ${starDef.royalPromise}`;

  const shadowTestText = `**${starDef.name} × ${targetName} Kraliyet Sınavı:** ${starDef.nemesisShadowTest} Özellikle **${targetHouse}. Ev** (${houseMeta.arenaDescription}) konularında bu yerleşim, ${roleMeta.testFocus}.`;

  let actionAdvice = '';
  if (starDef.id === 'aldebaran') {
    actionAdvice = `${targetHouse}. ev konularında ve ${targetName} temalarında sözünüzü senet bilin; şeffaflık, dürüstlük ve entelektüel cesaretle attığınız her adım sizi kalıcı bir liderliğe taşıyacaktır.`;
  } else if (starDef.id === 'regulus') {
    actionAdvice = `${targetHouse}. evdeki liderlik ve ${targetName} gücünüzü kullanırken egodan, kibirden ve rövanş duygusundan uzak durun; yüce gönüllü ve adil duruşunuz zirvedeki yerinizi perçinleyecektir.`;
  } else if (starDef.id === 'antares') {
    actionAdvice = `${targetHouse}. ev süreçlerinde ${targetName} enerjinizi yıkıcı hırs veya takıntıya dönüştürmeden, stratejik soğukkanlılık ve dönüştürücü bilgelikle yönetin.`;
  } else {
    actionAdvice = `${targetHouse}. ev sahnesinde ${targetName} yeteneklerinizi kullanırken yüksek vizyonunuzu ve etik/ruhsal ideallerinizi kısa vadeli maddi çıkarlara feda etmeyin; saflığınız en büyük mıknatısınızdır.`;
  }

  return {
    starId: starDef.id,
    starName: starDef.name,
    targetKind:
      targetId === 'asc' || targetId === 'mc' || targetId === 'dsc' || targetId === 'ic'
        ? 'angle'
        : 'planet',
    targetId,
    targetName,
    targetGlyph,
    targetLongitude: 0,
    targetFormatted,
    targetHouse,
    orb,
    orbFormatted,
    tier,
    tierLabel,
    headline,
    promiseText,
    shadowTestText,
    actionAdvice
  };
}

/**
 * Personal & social planets eligible for personal Royal Star conjunctions in a birth chart.
 * Generational outer planets (Uranus, Neptune, Pluto) and mathematical points (True Node, Chiron, DSC, IC)
 * are excluded so that collective generation-wide placements do not produce false personal detections.
 */
const ELIGIBLE_ROYAL_STAR_PLANETS: ReadonlySet<BodyId> = new Set<BodyId>([
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn'
]);

/**
 * Strict classical fixed-star conjunction orb: 1°00' (1.0 degree).
 */
const ROYAL_STAR_MAX_ORB_DEG = 1.0;

/**
 * Computes the 4 Royal Stars of Persia (Aldebaran, Regulus, Antares, Fomalhaut)
 * for the given birth chart:
 * 1. Applies precession of the equinoxes from J2000.0 to the exact birth Julian Day.
 * 2. Determines the Zodiac Sign, exact degree/minute, and Placidus House placement.
 * 3. Scans the 7 personal/social natal planets (Sun..Saturn) and 2 primary angles (ASC, MC)
 *    for exact critical-degree conjunctions (0° aspect within <=1.0° orb).
 * 4. Generates comprehensive astronomical & astrological interpretations (Royal Promise, Shadow Test & House Arena).
 */
export function computeRoyalStarsForChart(
  julianDay: number,
  planets: PlanetPosition[],
  angles: Record<AngleId, AnglePosition>,
  houses: HouseCusp[],
  zodiacSigns: ZodiacSignMeta[]
): RoyalStarAnalysis[] {
  const yearsSinceJ2000 = (julianDay - J2000_JD) / 365.25;
  const precessionDeg = (yearsSinceJ2000 * PRECESSION_ARCSEC_PER_YEAR) / 3600;

  type CandidateTarget = {
    id: BodyId | AngleId;
    name: string;
    glyph: string;
    longitude: number;
    formatted: string;
    house: number;
    maxConjunctionOrb: number;
  };

  const candidates: CandidateTarget[] = [
    ...planets
      .filter((p) => ELIGIBLE_ROYAL_STAR_PLANETS.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        glyph: p.glyph,
        longitude: p.longitude,
        formatted: `${p.sign.glyph} ${p.degreeFormatted} ${p.sign.name}`,
        house: p.house,
        maxConjunctionOrb: ROYAL_STAR_MAX_ORB_DEG
      })),
    {
      id: 'asc',
      name: 'Yükselen (ASC)',
      glyph: 'ASC',
      longitude: angles.asc.longitude,
      formatted: `${angles.asc.sign.glyph} ${angles.asc.degreeFormatted} ${angles.asc.sign.name}`,
      house: 1,
      maxConjunctionOrb: ROYAL_STAR_MAX_ORB_DEG
    },
    {
      id: 'mc',
      name: 'Tepe Noktası (MC / Zenith)',
      glyph: 'MC',
      longitude: angles.mc.longitude,
      formatted: `${angles.mc.sign.glyph} ${angles.mc.degreeFormatted} ${angles.mc.sign.name}`,
      house: 10,
      maxConjunctionOrb: ROYAL_STAR_MAX_ORB_DEG
    }
  ];

  return ROYAL_STAR_DEFS.map((starDef) => {
    const birthLongitude = normalizeDegLocal(starDef.j2000Longitude + precessionDeg);
    const signIndex = Math.floor(birthLongitude / 30) % 12;
    const sign = zodiacSigns[signIndex];
    const signDegree = birthLongitude - signIndex * 30;
    const degreeFormatted = formatDegMinLocal(signDegree);
    const fullFormatted = `${degreeFormatted} ${sign.name}`;
    const house = findHouseForLongitude(birthLongitude, houses);
    const houseMeta = HOUSE_THEMES[house] || HOUSE_THEMES[1];

    const conjunctions: RoyalStarConjunction[] = [];
    let bestCandidate = candidates[0];
    let bestDist = 999;

    for (const cand of candidates) {
      const dist = shortestAngularDistLocal(birthLongitude, cand.longitude);
      if (dist < bestDist) {
        bestDist = dist;
        bestCandidate = cand;
      }

      if (dist <= cand.maxConjunctionOrb) {
        const conj = buildConjunctionInterpretation(
          starDef,
          cand.id,
          cand.name,
          cand.glyph,
          cand.formatted,
          cand.house,
          dist,
          `${sign.glyph} ${fullFormatted}`
        );
        conj.targetLongitude = cand.longitude;
        conjunctions.push(conj);
      }
    }

    conjunctions.sort((a, b) => a.orb - b.orb);

    const housePlacementInterpretation = `Doğum anınızda **${starDef.name}**, ekinoks presesyonu ile **${sign.glyph} ${fullFormatted}** derecesinde ve haritanızın **${house}. Evinde** (${houseMeta.shortArena}) konumlanmaktadır. Bu yerleşim, yaşamınızda ${houseMeta.arenaDescription} konularının **${starDef.coreArchetype}** ilkeleriyle korunduğunu; bu yaşam alanında yükselmek için yıldızın etik sınavına sadık kalmanız gerektiğini gösterir.`;

    return {
      id: starDef.id,
      name: starDef.name,
      persianTitle: starDef.persianTitle,
      archangel: starDef.archangel,
      constellation: starDef.constellation,
      planetaryNature: starDef.planetaryNature,
      j2000Longitude: starDef.j2000Longitude,
      birthLongitude,
      eclipticLatitude: starDef.eclipticLatitude,
      magnitude: starDef.magnitude,
      criticalDegreeLabel: starDef.criticalDegreeLabel,
      sign,
      signDegree,
      degreeFormatted,
      fullFormatted,
      house,
      coreArchetype: starDef.coreArchetype,
      royalPromise: starDef.royalPromise,
      nemesisShadowTest: starDef.nemesisShadowTest,
      housePlacementInterpretation,
      conjunctions,
      closestTarget: {
        id: bestCandidate.id,
        name: bestCandidate.name,
        glyph: bestCandidate.glyph,
        formatted: bestCandidate.formatted,
        house: bestCandidate.house,
        distanceDeg: bestDist,
        distanceFormatted: formatOrbDegMin(bestDist)
      }
    };
  });
}
