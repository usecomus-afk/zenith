import {
  AnglePosition,
  AspectType,
  BodyId,
  FourLayerSynthesis,
  HouseCusp,
  NatalAspect,
  PlanetPosition,
  TransitAspect,
  ZodiacSignId
} from '../types/astrology';

export const HOUSE_THEMES: Record<
  number,
  {
    title: string;
    shortArena: string;
    arenaDescription: string;
    transitActionDomain: string;
  }
> = {
  1: {
    title: '1. Ev — Kimlik, Persona ve Başlangıç İradesi',
    shortArena: 'Bireysel duruş, fiziksel vitalite ve dış dünyaya ilk projeksiyon',
    arenaDescription:
      'kişisel kimlik inşası, dış dünyaya verdiğiniz ilk izlenim, bedensel enerji ve hayata karşı geliştirdiğiniz refleksif savunma/atılım mekanizmaları',
    transitActionDomain: 'kişisel girişimler, imaj yenileme ve otonom kararlarda'
  },
  2: {
    title: '2. Ev — Özdeğer, Finansal Kaynaklar ve Yetenekler',
    shortArena: 'Maddi güvenlik, gelir mimarisi ve somut öz-değer algısı',
    arenaDescription:
      'maddi-manevi özdeğer duygunuz, nakit akışı ve servet biriktirme stratejileriniz, sahip olduğunuz doğuştan gelen yetenekleri somut değere dönüştürme biçiminiz',
    transitActionDomain: 'bütçe planlaması, gelir artırıcı hamleler ve kaynak yönetiminde'
  },
  3: {
    title: '3. Ev — Zihinsel Mimari, İletişim ve Yakın Çevre',
    shortArena: 'Analitik düşünce, sözlü/yazılı ifade, kardeşler ve kısa yolculuklar',
    arenaDescription:
      'bilgiyi işleme ve aktarma tarzınız, entelektüel merakınız, yakın çevre/kardeş ilişkileriniz, ticari sözleşmeler ve günlük karar trafiğiniz',
    transitActionDomain: 'müzakereler, yazılı projeler, eğitim ve iletişim trafiğinde'
  },
  4: {
    title: '4. Ev — Kökler, İçsel Güvenlik ve Yaşam Temeli (IC)',
    shortArena: 'Aile mirası, mahremiyet, gayrimenkul ve psikolojik çapa',
    arenaDescription:
      'ruhsal kökleriniz, ailevi genetik/kültürel mirasınız, ev ve yaşam alanınız, en mahrem duygusal güvenlik ihtiyacınız ve içsel huzur merkeziniz',
    transitActionDomain: 'ev/gayrimenkul düzenlemeleri, ailevi konular ve içsel dengelenmede'
  },
  5: {
    title: '5. Ev — Yaratıcı İfade, Aşk, Sahne ve SpekülatifCesaret',
    shortArena: 'Özgün yaratıcılık, romantik çekim, çocuklar ve yaşam sevinci',
    arenaDescription:
      'kalpten gelen otantik yaratıcılığınız, romantik flört ve sahne enerjiniz, hobileriniz, çocuklarla ilişkiniz ve hesaplı risk/spekülasyon iştahınız',
    transitActionDomain: 'yaratıcı projeler, sahne önü sunumlar, aşk ve spekülatif adımlarda'
  },
  6: {
    title: '6. Ev — Metodoloji, Günlük Ritüeller, Sağlık ve Ustalık',
    shortArena: 'Çalışma disiplini, operasyonel verimlilik ve bedensel sağlık',
    arenaDescription:
      'günlük çalışma sistematiğiniz, mesleki zanaat ve detay ustalığınız, birlikte çalıştığınız ekip dinamikleri ile bedensel-zihinsel hijyen ve sağlık rutinleriniz',
    transitActionDomain: 'iş akışı optimizasyonu, sağlık/beslenme rutinleri ve teknik görevlerde'
  },
  7: {
    title: '7. Ev — İkili İlişkiler, Sözleşmeler ve Ayna Dinamikleri',
    shortArena: 'Evlilik, stratejik ortaklıklar, açık rakipler ve diplomasi',
    arenaDescription:
      'birebir yakın ilişkileriniz, evlilik ve iş ortaklıklarınız, hukuki kontratlar, diplomasi tarzınız ve karşı tarafta deneyimlediğiniz psikolojik projeksiyonlar',
    transitActionDomain: 'ortaklık görüşmeleri, kontrat imzaları ve ikili ilişki dengelerinde'
  },
  8: {
    title: '8. Ev — Kriz Yönetimi, Paylaşılan Sermaye ve Derin Dönüşüm',
    shortArena: 'Yatırımlar, vergi/kredi, psikolojik metamorfoz ve okült derinlik',
    arenaDescription:
      'ortaklaşa finansal kaynaklar (yatırım, kredi, miras, vergi), kriz anlarında küllerinden doğma kapasiteniz, derin psikolojik bağlanma ve stratejik sezginiz',
    transitActionDomain: 'finansal ve stratejik kararlarda, yatırım/borç yapılandırmalarında'
  },
  9: {
    title: '9. Ev — Yüksek Vizyon, Akademi, Uluslararası Ufuklar ve Felsefe',
    shortArena: 'Hayat felsefesi, yükseköğrenim, yayıncılık ve küresel açılım',
    arenaDescription:
      'dünya görüşünüz ve inanç mimariniz, akademik/uzmanlık çalışmalarınız, uluslararası bağlantılar, uzak yolculuklar, hukuk ve yayıncılık vizyonunuz',
    transitActionDomain: 'akademik/hukuki girişimler, uluslararası projeler ve vizyoner planlarda'
  },
  10: {
    title: '10. Ev — Kariyer Zirvesi (Zenith / MC), Toplumsal Statü ve Miras',
    shortArena: 'Profesyonel otorite, kamusal itibar, liderlik ve uzun vadeli hedefler',
    arenaDescription:
      'toplum önündeki görünürlüğünüz, kariyer zirveniz, otorite figürleriyle ilişkiniz, profesyonel itibarınız ve dünyaya bırakmak istediğiniz kalıcı eser',
    transitActionDomain: 'kariyer hamleleri, üst düzey sunumlar ve liderlik sorumluluklarında'
  },
  11: {
    title: '11. Ev — Gelecek İdealleri, Sosyal Ağlar ve Kolektif İnovasyon',
    shortArena: 'Vizyoner topluluklar, stratejik dostluklar ve kariyer getirileri',
    arenaDescription:
      'uzun vadeli gelecek projeksiyonlarınız, dahil olduğunuz entelektüel/sosyal networkler, ekip sinerjisi ve toplumsal fayda üreten yenilikçi idealleriniz',
    transitActionDomain: 'network genişletme, ekip projeleri ve teknoloji/gelecek yatırımlarında'
  },
  12: {
    title: '12. Ev — Kolektif Bilinçdışı, Ruhsal İzolasyon ve Perde Arkası Güç',
    shortArena: 'Sezgisel kuluçka, bilinçaltı arşivi, rüyalar ve stratejik hazırlık',
    arenaDescription:
      'bilinçdışı kodlarınız, sahne arkasında yürüttüğünüz stratejik hazırlıklar, rüya ve sezgi kanallarınız, ruhsal arınma ve sınırları aşan empati kapasiteniz',
    transitActionDomain: 'perde arkası strateji geliştirme, ruhsal detoks ve sezgisel analizlerde'
  }
};

const PLANET_ARCHETYPES: Record<
  BodyId,
  {
    coreFunction: string;
    driveVerb: string;
  }
> = {
  sun: {
    coreFunction: 'Yaratıcı yaşam iradeniz, bilinçli egonuz ve otantik kimlik çekirdeğiniz',
    driveVerb: 'parlamak ve merkez kurmak'
  },
  moon: {
    coreFunction: 'Duygusal regülasyon sisteminiz, içgüdüsel hafızanız ve aidiyet pusulanız',
    driveVerb: 'güvende hissetmek ve beslemek'
  },
  mercury: {
    coreFunction: 'Bilişsel işlemciniz, analitik muhakeme yeteneğiniz ve iletişim protokolünüz',
    driveVerb: 'analiz etmek, bağlantı kurmak ve ifade etmek'
  },
  venus: {
    coreFunction: 'İlişki kurma estetiğiniz, değer hiyerarşiniz ve çekim/uyum mıknatısınız',
    driveVerb: 'değer üretmek, uyumlamak ve cezbetmek'
  },
  mars: {
    coreFunction: 'Eylem motorunuz, sınır koruma refleksiniz ve rekabetçi fetih enerjiniz',
    driveVerb: 'harekete geçmek, savunmak ve fethetmek'
  },
  jupiter: {
    coreFunction: 'Büyüme çarpanınız, bilgelik vizyonunuz ve bolluk/fırsat radarınız',
    driveVerb: 'genişletmek, anlamlandırmak ve bereketlendirmek'
  },
  saturn: {
    coreFunction: 'Yapısal omurganız, zaman/sorumluluk ustalığınız ve kalıcı inşaat gücünüz',
    driveVerb: 'yapılandırmak, sınamak ve kalıcılaştırmak'
  },
  uranus: {
    coreFunction: 'Radikal yenilikçiliğiniz, özgürleşme dürtünüz ve paradigma kırıcı dehanız',
    driveVerb: 'özgürleştirmek, devrim yapmak ve uyandırmak'
  },
  neptune: {
    coreFunction: 'Aşkın hayal gücünüz, sanatsal/ruhsal geçirgenliğiniz ve idealizm okyanusunuz',
    driveVerb: 'çözündürmek, ilham vermek ve birleştirmek'
  },
  pluto: {
    coreFunction: 'Kökten dönüştürücü kudretiniz, kriz simyacılığınız ve psikolojik nüfuzunuz',
    driveVerb: 'dönüştürmek, yeniden doğurmak ve güçlendirmek'
  },
  true_node: {
    coreFunction: 'Tekamül pusulanız, konfor alanınızın ötesindeki büyüme ve kader yönünüz',
    driveVerb: 'evrimleşmek ve yeni deneyime açılmak'
  }
};

const SIGN_EXPRESSION_STYLE: Record<ZodiacSignId, string> = {
  aries: 'doğrudan, öncü, cesur ve yüksek ivmeli bir refleksle',
  taurus: 'sabırlı, duyusal, ayakları yere basan ve kalıcı değer üreten bir istikrarla',
  gemini: 'çok yönlü, meraklı, kavramsal bağlantılar kuran çevik bir zihinle',
  cancer: 'sezgisel, koruyucu, duygusal derinliği ve kök bağlılığı yüksek bir duyarlılıkla',
  leo: 'vekarlı, yaratıcı, sahneyi ve merkezi doğal biçimde dolduran sıcak bir özgüvenle',
  virgo: 'analitik, kusursuzu arayan, metodik ve işlevsel ustalık odaklı bir titizlikle',
  libra: 'diplomatik, estetik, stratejik denge ve adalet gözeten zarif bir perspektifle',
  scorpio: 'stratejik, yüzeyi delip öze inen, krizde güçlenen manyetik bir yoğunlukla',
  sagittarius: 'vizyoner, felsefi, sınırları aşan ve büyük resmi kucaklayan bir coşkuyla',
  capricorn: 'disiplinli, stratejik, uzun vadeli zirveyi hedefleyen kurumsal bir ciddiyetle',
  aquarius: 'özgün, bağımsız, geleceği bugünden okuyan rasyonel ve yenilikçi bir vizyonla',
  pisces: 'empatik, sezgisel, görünmeyeni hisseden bütüncül ve sanatsal bir akışkanlıkla'
};

/**
 * Generates specific aspect modulation commentary between two bodies
 */
function getAspectModulationText(
  primary: PlanetPosition,
  aspect: NatalAspect
): string {
  const isBodyA = aspect.bodyA === primary.id;
  const partnerId = isBodyA ? aspect.bodyB : aspect.bodyA;
  const partnerName = isBodyA ? aspect.bodyBName : aspect.bodyAName;
  const orbText = `${aspect.orb.toFixed(1)}° orb, ${
    aspect.isApplying ? 'yaklaşan/güçlenen' : 'uzaklaşan/deneyimlenmiş'
  }`;

  const pairKey = [primary.id, partnerId].sort().join('-');

  // Specialized archetypal pair modulations
  if (pairKey === 'saturn-sun') {
    if (aspect.type === 'conjunction' || aspect.type === 'square' || aspect.type === 'opposition') {
      return `${partnerName} ile ${aspect.typeName} (${orbText}): Kimlik ifadenize yüksek bir öz-denetim, ciddiyet ve mimari disiplin tonu entegre ediyor. Erken yaşta üstlenilen sorumluluklar zamanla sarsılmaz bir otoriteye dönüşür.`;
    }
    return `${partnerName} ile ${aspect.typeName} (${orbText}): Yaratıcı iradenizi yapılandırılmış, sabırlı ve uzun vadeli stratejiyle birleştirerek kalıcı başarı inşa etmenizi sağlıyor.`;
  }

  if (pairKey === 'moon-sun') {
    if (aspect.type === 'trine' || aspect.type === 'sextile' || aspect.type === 'conjunction') {
      return `${partnerName} ile ${aspect.typeName} (${orbText}): Bilinçli hedefleriniz ile duygusal ihtiyaçlarınız arasında güçlü bir içsel tutarlılık ve doğal özgüven akışı yaratıyor.`;
    }
    return `${partnerName} ile ${aspect.typeName} (${orbText}): İrade ile duygusal güvenlik arasında dinamik bir gerilim üreterek sizi sürekli kendini aşmaya ve içsel dengeyi aktif olarak kurmaya teşvik ediyor.`;
  }

  if (pairKey === 'jupiter-mars' || pairKey === 'jupiter-sun') {
    return `${partnerName} ile ${aspect.typeName} (${orbText}): Eylem ve vizyon kapasitenizi büyüten, stratejik risk alma cesareti ve liderlik karizması aşılayan yüksek enerjili bir kaldıraç sağlıyor.`;
  }

  if (pairKey === 'mercury-uranus') {
    return `${partnerName} ile ${aspect.typeName} (${orbText}): Zihinsel süreçlerinize şimşek hızında sezgi, kalıp dışı problem çözme yeteneği ve teknolojik/inovatif kavrayış gücü katıyor.`;
  }

  if (pairKey === 'pluto-sun' || pairKey === 'mars-pluto' || pairKey === 'moon-pluto') {
    return `${partnerName} ile ${aspect.typeName} (${orbText}): Psikolojik derinlik, kriz anlarında çelikleşen irade ve girdiği ortamı kökten dönüştüren karizmatik bir yoğunluk kazandırıyor.`;
  }

  if (pairKey === 'neptune-venus' || pairKey === 'moon-neptune') {
    return `${partnerName} ile ${aspect.typeName} (${orbText}): Estetik algınızı, empati yeteneğinizi ve sanatsal/sezgisel duyarlılığınızı incelterek yüksek bir ilham frekansı açıyor.`;
  }

  // General dynamic modulation by aspect nature
  if (aspect.type === 'conjunction') {
    return `${partnerName} ile Kavuşum (${orbText}): ${primary.name} enerjisi ${partnerName} arketipiyle tek bir çekirdekte kaynaşarak bu yaşam alanında odaklanmış, baskın ve ayrılmaz bir vurgu oluşturuyor.`;
  }
  if (aspect.type === 'trine') {
    return `${partnerName} ile Üçgen (${orbText}): ${partnerName} üzerinden zahmetsiz bir akış, doğal yetenek koruması ve özgüvenli bir yaratıcı destek kanalı açıyor.`;
  }
  if (aspect.type === 'sextile') {
    return `${partnerName} ile Sekstil (${orbText}): Bilinçli inisiyatif aldığınızda ${partnerName} temalarıyla verimli işbirliği, zihinsel çeviklik ve somut fırsat üretimi sağlıyor.`;
  }
  if (aspect.type === 'square') {
    return `${partnerName} ile Kare (${orbText}): Konfor alanına yerleşmeyi reddeden, kriz ve sürtünmeyi somut başarıya ve kas gücüne dönüştüren dinamik bir motivasyon motoru çalıştırıyor.`;
  }
  return `${partnerName} ile Karşıt (${orbText}): İlişkiler ve dış dünya aynası üzerinden farkındalık kazandıran, iki kutbu ustalıkla dengelediğinizde bütünsel vizyon sağlayan bir eksen kuruyor.`;
}

/**
 * Generates actionable micro-bulletin for a specific transit aspect
 */
export function generateTransitBulletin(
  transitPlanet: PlanetPosition,
  natalTarget: PlanetPosition | AnglePosition,
  aspectType: AspectType,
  aspectName: string,
  orb: number,
  isApplying: boolean,
  natalHouse: number,
  transitHouse: number
): { headline: string; summary: string; actionAdvice: string } {
  const houseInfo = HOUSE_THEMES[natalHouse] || HOUSE_THEMES[1];
  const orbDeg = Math.floor(orb);
  const orbMin = Math.round((orb - orbDeg) * 60);
  const orbFormatted = `${orbDeg}°${String(orbMin).padStart(2, '0')}'`;

  const headline = `Transit ${transitPlanet.name} (${transitPlanet.sign.name}) ${aspectName} Natal ${natalTarget.name} (${natalHouse}. Ev)`;

  let actionClause = '';
  if (aspectType === 'trine' || aspectType === 'sextile') {
    actionClause = `${houseInfo.transitActionDomain} cesur, yapılandırıcı ve akıcı adımlar güçlü biçimde destekleniyor.`;
  } else if (aspectType === 'conjunction') {
    actionClause = `${houseInfo.transitActionDomain} yeni bir döngü tetikleniyor; odaklanmış irade ve bilinçli başlangıçlar için yüksek yoğunluklu bir eşiktesiniz.`;
  } else if (aspectType === 'square') {
    actionClause = `${houseInfo.transitActionDomain} hız ve stres yönetimi önem kazanıyor; aceleci tepkiler yerine stratejik revizyonla engelleri kaldıraca dönüştürebilirsiniz.`;
  } else {
    actionClause = `${houseInfo.transitActionDomain} karşıt görüşleri ve ortaklık dengelerini uzlaştırarak stratejik farkındalık kazanma zamanı.`;
  }

  const summary = `Bugün ${transitHouse}. evinizde ilerleyen transit ${transitPlanet.name}, ${natalHouse}. evinizdeki natal ${natalTarget.name} konumunuza ${aspectName.toLowerCase()} açı yapıyor (Orb: ${orbFormatted}, ${
    isApplying ? 'etki zirveye yaklaşıyor' : 'etki sindiriliyor'
  }); ${actionClause}`;

  const actionAdvice =
    aspectType === 'trine' || aspectType === 'sextile'
      ? `Fırsat Penceresi: ${houseInfo.shortArena} alanında bekleyen kritik görüşme veya girişimleri bugün öne çekin.`
      : aspectType === 'conjunction'
        ? `Odak Noktası: ${natalTarget.name} temsil ettiği temalarda net bir niyet belirleyin ve enerjinizi tek bir hedefe kilitleyin.`
        : `Stratejik Denge: ${houseInfo.shortArena} konularında ego çatışmalarından kaçının, veriye ve uzun vadeli plana sadık kalın.`;

  return { headline, summary, actionAdvice };
}

/**
 * Builds the 4-Layer Personalized Astrological Synthesis for every celestial body
 */
export function buildChartSyntheses(
  planets: PlanetPosition[],
  houses: HouseCusp[],
  natalAspects: NatalAspect[],
  activeTransits: TransitAspect[],
  transitPlanets: PlanetPosition[]
): Record<BodyId, FourLayerSynthesis> {
  const planetMap = new Map<BodyId, PlanetPosition>();
  for (const p of planets) {
    planetMap.set(p.id, p);
  }

  const result = {} as Record<BodyId, FourLayerSynthesis>;

  for (const planet of planets) {
    const arch = PLANET_ARCHETYPES[planet.id];
    const signStyle = SIGN_EXPRESSION_STYLE[planet.sign.id];
    const houseMeta = HOUSE_THEMES[planet.house] || HOUSE_THEMES[1];

    // LAYER 1: Location (Sign + House Synthesis)
    const retroNote = planet.isRetrograde
      ? ` Gezegenin retro (℞) harekette olması, bu enerjinin dışsal onay aramadan önce derin bir içsel süzgeçten geçirildiğini ve özgün bir içgörüyle çalıştığını gösterir.`
      : '';

    const layer1Narrative = `${arch.coreFunction}, **${planet.sign.name}** burcunun ${signStyle} frekansında çalışıyor ve enerjisini doğrudan **${planet.house}. Ev** (${houseMeta.shortArena}) sahnesine akıtıyor. Bu yerleşim, yaşamınızda ${houseMeta.arenaDescription} konularında ${planet.sign.keywords.join(', ').toLocaleLowerCase('tr-TR')} ilkeleriyle merkez kurduğunuzu gösterir.${retroNote}`;

    // LAYER 2: Aspect Modulation
    const relatedAspects = natalAspects.filter(
      (a) => a.bodyA === planet.id || a.bodyB === planet.id
    );

    const aspectBullets = relatedAspects.map((aspect) => ({
      aspect,
      modulationText: getAspectModulationText(planet, aspect)
    }));

    const harmoniousCount = relatedAspects.filter((a) => a.nature === 'harmonious').length;
    const challengingCount = relatedAspects.filter((a) => a.nature === 'challenging').length;
    const intenseCount = relatedAspects.filter((a) => a.nature === 'intense').length;

    let dominantTone = 'Dengeli ve Otonom Frekans';
    let layer2Synthesis = '';

    if (relatedAspects.length === 0) {
      dominantTone = 'Peregrin / Saf Arketipsel İfade';
      layer2Synthesis = `${planet.name} haritanızda majör açı baskısı altında kalmadan tamamen saf ${planet.sign.name} doğasıyla ve otonom bir ritimle çalışmaktadır.`;
    } else if (intenseCount > 0 && challengingCount >= harmoniousCount) {
      dominantTone = 'Yüksek Odaklı, Disiplinli ve Dönüştürücü Ton';
      layer2Synthesis = `${planet.name}, aldığı güçlü kavuşum ve dinamik kare/karşıt açılarla yüksek voltajlı bir gelişim ivmesine sahip. Zorluklar karşısında geri çekilmek yerine krizi ustalığa çeviren bir karakter omurgası üretiyor.`;
    } else if (harmoniousCount > challengingCount) {
      dominantTone = 'Akıcı, Özgüvenli ve Yaratıcı Sentez Tonu';
      layer2Synthesis = `${planet.name}, aldığı üçgen ve sekstil açıların desteğiyle yeteneklerini doğal bir özgüven ve sosyal/zihinsel akışkanlıkla ortaya koyuyor; çevreyle uyumlu fırsat kanalları kolayca açılıyor.`;
    } else {
      dominantTone = 'Dinamik Denge ve Stratejik Adaptasyon Tonu';
      layer2Synthesis = `${planet.name} hem destekleyici üçgen/sekstil hem de tetikleyici kare/karşıt açılarla besleniyor; bu kombinasyon size hem doğal yetenek konforu hem de rehaveti önleyen diri bir mücadele azmi kazandırıyor.`;
    }

    // LAYER 3: Rulership / Dispositor Chain
    const rulerId = planet.sign.ruler;
    const rulerPlanet = planetMap.get(rulerId) || planets[0];
    const isSelfRuled = rulerPlanet.id === planet.id;
    const isMutualReception =
      !isSelfRuled && rulerPlanet.sign.ruler === planet.id;

    let chainNarrative = '';
    if (isSelfRuled) {
      chainNarrative = `**${planet.name}**, kendi yönettiği **${planet.sign.name}** burcunda (**Öz-Yönetici / Domicile**) konumlandığı için başka bir gezegenin aracılığına ihtiyaç duymaz. ${planet.house}. ev konularında tam otonomiye, yüksek öz-güvene ve doğrudan sonuç üretme kudretine sahiptir.`;
    } else if (isMutualReception) {
      chainNarrative = `**${planet.name}** (${planet.sign.name}, ${planet.house}. Ev) ile yöneticisi **${rulerPlanet.name}** (${rulerPlanet.sign.name}, ${rulerPlanet.house}. Ev) arasında **Karşılıklı Ağırlama (Mutual Reception)** bulunuyor! Bu özel astrolojik kilit, ${planet.house}. ev ve ${rulerPlanet.house}. ev yaşam alanlarınızın birbirini kesintisiz besleyen süper-iletken bir ortaklık kurduğunu gösterir.`;
    } else {
      const rulerHouseMeta = HOUSE_THEMES[rulerPlanet.house] || HOUSE_THEMES[1];
      chainNarrative = `${planet.name} (${planet.sign.name}) burcunun yöneticisi (dispozitörü) olan **${rulerPlanet.glyph} ${rulerPlanet.name}**, haritanızda **${rulerPlanet.sign.name}** burcunda ve **${rulerPlanet.house}. Evde** konumlanıyor. Dolayısıyla ${planet.house}. evdeki (${houseMeta.shortArena}) motivasyonunuzun nihai yakıtı ve sonucu, doğrudan ${rulerPlanet.house}. evdeki (${rulerHouseMeta.shortArena}) deneyimlerinize hizmet eder ve oradan yönetilir.`;
    }

    // LAYER 4: Daily Transit Summary
    const matchingTransits = activeTransits.filter(
      (t) => t.natalTarget.id === planet.id
    );
    const transitSelf = transitPlanets.find((tp) => tp.id === planet.id);

    let bulletinText = '';
    if (matchingTransits.length > 0) {
      bulletinText = matchingTransits.map((t) => t.summary).join(' ');
    } else if (transitSelf) {
      const trHouseMeta = HOUSE_THEMES[transitSelf.house] || HOUSE_THEMES[1];
      bulletinText = `Anlık gökyüzünde natal ${planet.name} derecenize ±2° dar orb içinde doğrudan bir majör transit açısı bulunmuyor; ancak gökyüzündeki transit **${transitSelf.glyph} ${transitSelf.name}** şu anda **${transitSelf.fullFormatted}** konumunda ve haritanızın **${transitSelf.house}. Evini** (${trHouseMeta.shortArena}) aydınlatıyor. Bu süreçte ${trHouseMeta.transitActionDomain} dengeli ve hazırlıklı adımlar atabilirsiniz.`;
    }

    result[planet.id] = {
      planet,
      layer1Location: {
        title: `1. Konum Sentezi: ${planet.sign.name} Burcu & ${planet.house}. Ev`,
        signTheme: `${planet.sign.glyph} ${planet.sign.name} (${planet.sign.elementName} / ${planet.sign.modalityName})`,
        houseArena: `${planet.house}. Ev — ${houseMeta.shortArena}`,
        narrative: layer1Narrative
      },
      layer2AspectModulation: {
        title: `2. Açı Modülasyonu (${relatedAspects.length} Majör Açı)`,
        dominantTone,
        aspectBullets,
        synthesisText: layer2Synthesis
      },
      layer3Dispositor: {
        title: `3. Yöneticilik (Dispozitör): ${rulerPlanet.glyph} ${rulerPlanet.name}`,
        rulerName: rulerPlanet.name,
        rulerGlyph: rulerPlanet.glyph,
        rulerSign: rulerPlanet.sign.name,
        rulerHouse: rulerPlanet.house,
        isSelfRuled,
        isMutualReception,
        chainNarrative
      },
      layer4TransitSummary: {
        title: `4. Günlük Transit Özeti (Anlık Gökyüzü Eşleşmesi)`,
        hasTightTransit: matchingTransits.length > 0,
        activeTransits: matchingTransits,
        bulletinText
      }
    };
  }

  return result;
}
