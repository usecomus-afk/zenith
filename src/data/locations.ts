import { CityLocation } from '../types/astrology';

export const PRESET_LOCATIONS: CityLocation[] = [
  // Türkiye Büyükşehirler ve Popüler İlçeler
  { id: 'tr-ist', name: 'İstanbul', admin1: 'Marmara', country: 'Türkiye', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' },
  { id: 'tr-ist-kadikoy', name: 'Kadıköy, İstanbul', admin1: 'İstanbul', country: 'Türkiye', latitude: 40.9906, longitude: 29.0297, timezone: 'Europe/Istanbul' },
  { id: 'tr-ist-besiktas', name: 'Beşiktaş, İstanbul', admin1: 'İstanbul', country: 'Türkiye', latitude: 41.0422, longitude: 29.0083, timezone: 'Europe/Istanbul' },
  { id: 'tr-ist-sisli', name: 'Şişli, İstanbul', admin1: 'İstanbul', country: 'Türkiye', latitude: 41.0602, longitude: 28.9877, timezone: 'Europe/Istanbul' },
  { id: 'tr-ist-uskudar', name: 'Üsküdar, İstanbul', admin1: 'İstanbul', country: 'Türkiye', latitude: 41.0235, longitude: 29.0151, timezone: 'Europe/Istanbul' },
  { id: 'tr-ist-bakirkoy', name: 'Bakırköy, İstanbul', admin1: 'İstanbul', country: 'Türkiye', latitude: 40.9801, longitude: 28.8722, timezone: 'Europe/Istanbul' },
  { id: 'tr-ist-sariyer', name: 'Sarıyer, İstanbul', admin1: 'İstanbul', country: 'Türkiye', latitude: 41.1669, longitude: 29.0572, timezone: 'Europe/Istanbul' },
  { id: 'tr-ank', name: 'Ankara', admin1: 'İç Anadolu', country: 'Türkiye', latitude: 39.9334, longitude: 32.8597, timezone: 'Europe/Istanbul' },
  { id: 'tr-ank-cankaya', name: 'Çankaya, Ankara', admin1: 'Ankara', country: 'Türkiye', latitude: 39.9032, longitude: 32.8597, timezone: 'Europe/Istanbul' },
  { id: 'tr-ank-yenimahalle', name: 'Yenimahalle, Ankara', admin1: 'Ankara', country: 'Türkiye', latitude: 39.9720, longitude: 32.8091, timezone: 'Europe/Istanbul' },
  { id: 'tr-izm', name: 'İzmir', admin1: 'Ege', country: 'Türkiye', latitude: 38.4237, longitude: 27.1428, timezone: 'Europe/Istanbul' },
  { id: 'tr-izm-karsiyaka', name: 'Karşıyaka, İzmir', admin1: 'İzmir', country: 'Türkiye', latitude: 38.4592, longitude: 27.1153, timezone: 'Europe/Istanbul' },
  { id: 'tr-izm-bornova', name: 'Bornova, İzmir', admin1: 'İzmir', country: 'Türkiye', latitude: 38.4622, longitude: 27.2164, timezone: 'Europe/Istanbul' },
  { id: 'tr-izm-cesme', name: 'Çeşme, İzmir', admin1: 'İzmir', country: 'Türkiye', latitude: 38.3236, longitude: 26.3028, timezone: 'Europe/Istanbul' },
  { id: 'tr-ant', name: 'Antalya', admin1: 'Akdeniz', country: 'Türkiye', latitude: 36.8969, longitude: 30.7133, timezone: 'Europe/Istanbul' },
  { id: 'tr-ant-alanya', name: 'Alanya, Antalya', admin1: 'Antalya', country: 'Türkiye', latitude: 36.5444, longitude: 31.9954, timezone: 'Europe/Istanbul' },
  { id: 'tr-bur', name: 'Bursa', admin1: 'Marmara', country: 'Türkiye', latitude: 40.1885, longitude: 29.0610, timezone: 'Europe/Istanbul' },
  { id: 'tr-bur-nilufer', name: 'Nilüfer, Bursa', admin1: 'Bursa', country: 'Türkiye', latitude: 40.2144, longitude: 28.9396, timezone: 'Europe/Istanbul' },
  { id: 'tr-ada', name: 'Adana', admin1: 'Akdeniz', country: 'Türkiye', latitude: 37.0000, longitude: 35.3213, timezone: 'Europe/Istanbul' },
  { id: 'tr-gaz', name: 'Gaziantep', admin1: 'Güneydoğu Anadolu', country: 'Türkiye', latitude: 37.0662, longitude: 37.3833, timezone: 'Europe/Istanbul' },
  { id: 'tr-kon', name: 'Konya', admin1: 'İç Anadolu', country: 'Türkiye', latitude: 37.8746, longitude: 32.4932, timezone: 'Europe/Istanbul' },
  { id: 'tr-mer', name: 'Mersin', admin1: 'Akdeniz', country: 'Türkiye', latitude: 36.8121, longitude: 34.6415, timezone: 'Europe/Istanbul' },
  { id: 'tr-kay', name: 'Kayseri', admin1: 'İç Anadolu', country: 'Türkiye', latitude: 38.7312, longitude: 35.4787, timezone: 'Europe/Istanbul' },
  { id: 'tr-esk', name: 'Eskişehir', admin1: 'İç Anadolu', country: 'Türkiye', latitude: 39.7767, longitude: 30.5206, timezone: 'Europe/Istanbul' },
  { id: 'tr-diy', name: 'Diyarbakır', admin1: 'Güneydoğu Anadolu', country: 'Türkiye', latitude: 37.9144, longitude: 40.2306, timezone: 'Europe/Istanbul' },
  { id: 'tr-sam', name: 'Samsun', admin1: 'Karadeniz', country: 'Türkiye', latitude: 41.2867, longitude: 36.3300, timezone: 'Europe/Istanbul' },
  { id: 'tr-den', name: 'Denizli', admin1: 'Ege', country: 'Türkiye', latitude: 37.7765, longitude: 29.0864, timezone: 'Europe/Istanbul' },
  { id: 'tr-san', name: 'Şanlıurfa', admin1: 'Güneydoğu Anadolu', country: 'Türkiye', latitude: 37.1591, longitude: 38.7969, timezone: 'Europe/Istanbul' },
  { id: 'tr-mug', name: 'Muğla', admin1: 'Ege', country: 'Türkiye', latitude: 37.2153, longitude: 28.3636, timezone: 'Europe/Istanbul' },
  { id: 'tr-mug-bodrum', name: 'Bodrum, Muğla', admin1: 'Muğla', country: 'Türkiye', latitude: 37.0344, longitude: 27.4305, timezone: 'Europe/Istanbul' },
  { id: 'tr-mug-fethiye', name: 'Fethiye, Muğla', admin1: 'Muğla', country: 'Türkiye', latitude: 36.6217, longitude: 29.1164, timezone: 'Europe/Istanbul' },
  { id: 'tr-mug-marmaris', name: 'Marmaris, Muğla', admin1: 'Muğla', country: 'Türkiye', latitude: 36.8550, longitude: 28.2742, timezone: 'Europe/Istanbul' },
  { id: 'tr-tra', name: 'Trabzon', admin1: 'Karadeniz', country: 'Türkiye', latitude: 41.0027, longitude: 39.7168, timezone: 'Europe/Istanbul' },
  { id: 'tr-koc', name: 'Kocaeli (İzmit)', admin1: 'Marmara', country: 'Türkiye', latitude: 40.7654, longitude: 29.9408, timezone: 'Europe/Istanbul' },
  { id: 'tr-sak', name: 'Sakarya (Adapazarı)', admin1: 'Marmara', country: 'Türkiye', latitude: 40.7731, longitude: 30.3948, timezone: 'Europe/Istanbul' },
  { id: 'tr-tek', name: 'Tekirdağ', admin1: 'Marmara', country: 'Türkiye', latitude: 40.9781, longitude: 27.5117, timezone: 'Europe/Istanbul' },
  { id: 'tr-bal', name: 'Balıkesir', admin1: 'Marmara', country: 'Türkiye', latitude: 39.6484, longitude: 27.8826, timezone: 'Europe/Istanbul' },
  { id: 'tr-ayd', name: 'Aydın', admin1: 'Ege', country: 'Türkiye', latitude: 37.8560, longitude: 27.8416, timezone: 'Europe/Istanbul' },
  { id: 'tr-man', name: 'Manisa', admin1: 'Ege', country: 'Türkiye', latitude: 38.6191, longitude: 27.4289, timezone: 'Europe/Istanbul' },
  { id: 'tr-hat', name: 'Hatay (Antakya)', admin1: 'Akdeniz', country: 'Türkiye', latitude: 36.2021, longitude: 36.1606, timezone: 'Europe/Istanbul' },
  { id: 'tr-mal', name: 'Malatya', admin1: 'Doğu Anadolu', country: 'Türkiye', latitude: 38.3552, longitude: 38.3095, timezone: 'Europe/Istanbul' },
  { id: 'tr-erz', name: 'Erzurum', admin1: 'Doğu Anadolu', country: 'Türkiye', latitude: 39.9043, longitude: 41.2679, timezone: 'Europe/Istanbul' },
  { id: 'tr-van', name: 'Van', admin1: 'Doğu Anadolu', country: 'Türkiye', latitude: 38.4891, longitude: 43.4089, timezone: 'Europe/Istanbul' },
  { id: 'tr-can', name: 'Çanakkale', admin1: 'Marmara', country: 'Türkiye', latitude: 40.1553, longitude: 26.4142, timezone: 'Europe/Istanbul' },
  { id: 'tr-edi', name: 'Edirne', admin1: 'Marmara', country: 'Türkiye', latitude: 41.6771, longitude: 26.5557, timezone: 'Europe/Istanbul' },
  { id: 'tr-siv', name: 'Sivas', admin1: 'İç Anadolu', country: 'Türkiye', latitude: 39.7477, longitude: 37.0179, timezone: 'Europe/Istanbul' },
  { id: 'tr-ord', name: 'Ordu', admin1: 'Karadeniz', country: 'Türkiye', latitude: 40.9862, longitude: 37.8797, timezone: 'Europe/Istanbul' },
  { id: 'tr-gir', name: 'Giresun', admin1: 'Karadeniz', country: 'Türkiye', latitude: 40.9128, longitude: 38.3895, timezone: 'Europe/Istanbul' },
  { id: 'tr-riz', name: 'Rize', admin1: 'Karadeniz', country: 'Türkiye', latitude: 41.0201, longitude: 40.5234, timezone: 'Europe/Istanbul' },
  { id: 'tr-zon', name: 'Zonguldak', admin1: 'Karadeniz', country: 'Türkiye', latitude: 41.4564, longitude: 31.7987, timezone: 'Europe/Istanbul' },
  { id: 'tr-isp', name: 'Isparta', admin1: 'Akdeniz', country: 'Türkiye', latitude: 37.7648, longitude: 30.5566, timezone: 'Europe/Istanbul' },
  { id: 'tr-afy', name: 'Afyonkarahisar', admin1: 'Ege', country: 'Türkiye', latitude: 38.7507, longitude: 30.5567, timezone: 'Europe/Istanbul' },
  { id: 'tr-kut', name: 'Kütahya', admin1: 'Ege', country: 'Türkiye', latitude: 39.4167, longitude: 29.9833, timezone: 'Europe/Istanbul' },
  { id: 'tr-bol', name: 'Bolu', admin1: 'Karadeniz', country: 'Türkiye', latitude: 40.7350, longitude: 31.6061, timezone: 'Europe/Istanbul' },
  { id: 'tr-kah', name: 'Kahramanmaraş', admin1: 'Akdeniz', country: 'Türkiye', latitude: 37.5858, longitude: 36.9371, timezone: 'Europe/Istanbul' },
  { id: 'tr-ela', name: 'Elazığ', admin1: 'Doğu Anadolu', country: 'Türkiye', latitude: 38.6810, longitude: 39.2264, timezone: 'Europe/Istanbul' },
  { id: 'tr-mar', name: 'Mardin', admin1: 'Güneydoğu Anadolu', country: 'Türkiye', latitude: 37.3212, longitude: 40.7245, timezone: 'Europe/Istanbul' },
  { id: 'tr-kar', name: 'Kars', admin1: 'Doğu Anadolu', country: 'Türkiye', latitude: 40.6013, longitude: 43.0975, timezone: 'Europe/Istanbul' },
  // KKTC & Azerbaycan & Dünya Metropolleri
  { id: 'cy-lef', name: 'Lefkoşa', admin1: 'KKTC', country: 'Kıbrıs', latitude: 35.1856, longitude: 33.3823, timezone: 'Asia/Nicosia' },
  { id: 'cy-gir', name: 'Girne', admin1: 'KKTC', country: 'Kıbrıs', latitude: 35.3363, longitude: 33.3173, timezone: 'Asia/Nicosia' },
  { id: 'az-bak', name: 'Bakü', admin1: 'Abşeron', country: 'Azerbaycan', latitude: 40.4093, longitude: 49.8671, timezone: 'Asia/Baku' },
  { id: 'uk-lon', name: 'Londra', admin1: 'England', country: 'Birleşik Krallık', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  { id: 'de-ber', name: 'Berlin', admin1: 'Berlin', country: 'Almanya', latitude: 52.5200, longitude: 13.4050, timezone: 'Europe/Berlin' },
  { id: 'de-mun', name: 'Münih', admin1: 'Bavyera', country: 'Almanya', latitude: 48.1351, longitude: 11.5820, timezone: 'Europe/Berlin' },
  { id: 'fr-par', name: 'Paris', admin1: 'Île-de-France', country: 'Fransa', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
  { id: 'nl-ams', name: 'Amsterdam', admin1: 'North Holland', country: 'Hollanda', latitude: 52.3676, longitude: 4.9041, timezone: 'Europe/Amsterdam' },
  { id: 'ch-zur', name: 'Zürih', admin1: 'Zürich', country: 'İsviçre', latitude: 47.3769, longitude: 8.5417, timezone: 'Europe/Zurich' },
  { id: 'at-vie', name: 'Viyana', admin1: 'Wien', country: 'Avusturya', latitude: 48.2082, longitude: 16.3738, timezone: 'Europe/Vienna' },
  { id: 'it-rom', name: 'Roma', admin1: 'Lazio', country: 'İtalya', latitude: 41.9028, longitude: 12.4964, timezone: 'Europe/Rome' },
  { id: 'es-mad', name: 'Madrid', admin1: 'Madrid', country: 'İspanya', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid' },
  { id: 'us-nyc', name: 'New York', admin1: 'NY', country: 'ABD', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
  { id: 'us-lax', name: 'Los Angeles', admin1: 'CA', country: 'ABD', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles' },
  { id: 'ae-dxb', name: 'Dubai', admin1: 'Dubai', country: 'BAE', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
  { id: 'jp-tyo', name: 'Tokyo', admin1: 'Kanto', country: 'Japonya', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' }
];

function normalizeTr(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export function searchLocalLocations(query: string): CityLocation[] {
  const q = normalizeTr(query);
  if (!q) return PRESET_LOCATIONS.slice(0, 12);

  return PRESET_LOCATIONS.filter((loc) => {
    const target = normalizeTr(`${loc.name} ${loc.admin1 || ''} ${loc.country}`);
    return target.includes(q);
  }).slice(0, 10);
}

export async function searchOnlineLocations(query: string): Promise<CityLocation[]> {
  const localMatches = searchLocalLocations(query);
  if (query.trim().length < 2) {
    return localMatches;
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query.trim()
    )}&count=8&language=tr&format=json`;
    const response = await fetch(url);
    if (!response.ok) return localMatches;
    const data = await response.json();
    if (!data || !Array.isArray(data.results)) return localMatches;

    const remoteLocations: CityLocation[] = data.results.map((item: Record<string, unknown>) => ({
      id: `geo-${item.id || `${item.latitude}-${item.longitude}`}`,
      name: item.admin1
        ? `${String(item.name)}, ${String(item.admin1)}`
        : String(item.name),
      admin1: item.admin1 ? String(item.admin1) : undefined,
      country: item.country ? String(item.country) : 'Dünya',
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      timezone: item.timezone ? String(item.timezone) : 'Europe/Istanbul'
    }));

    // Merge local & remote without duplicates by proximity
    const merged = [...localMatches];
    for (const rem of remoteLocations) {
      const exists = merged.some(
        (m) =>
          Math.abs(m.latitude - rem.latitude) < 0.08 &&
          Math.abs(m.longitude - rem.longitude) < 0.08
      );
      if (!exists) {
        merged.push(rem);
      }
    }
    return merged.slice(0, 12);
  } catch {
    return localMatches;
  }
}

/**
 * Converts a local birth date (YYYY-MM-DD) and birth time (HH:mm) in a given IANA timezone
 * into an exact UTC Date object, automatically resolving historical DST and timezone offsets.
 */
export function resolveLocalToUtc(
  birthDate: string,
  birthTime: string,
  ianaTimezone: string
): { utcDate: Date; offsetHours: number; offsetFormatted: string } {
  const [yearStr, monthStr, dayStr] = birthDate.split('-');
  const [hourStr, minuteStr] = birthTime.split(':');

  const year = Number(yearStr) || 1995;
  const month = Number(monthStr) || 1;
  const day = Number(dayStr) || 1;
  const hour = Number(hourStr) || 12;
  const minute = Number(minuteStr) || 0;

  // Treat the desired wall-clock time first as a UTC timestamp guess
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const getOffsetMinutesAt = (utcMs: number, tz: string): number => {
    try {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      });
      const parts = dtf.formatToParts(new Date(utcMs));
      const map: Record<string, number> = {};
      for (const p of parts) {
        if (p.type !== 'literal') {
          map[p.type] = Number(p.value);
        }
      }
      const tzWallAsUtcMs = Date.UTC(
        map.year,
        (map.month || 1) - 1,
        map.day || 1,
        map.hour || 0,
        map.minute || 0,
        map.second || 0
      );
      return Math.round((tzWallAsUtcMs - utcMs) / 60000);
    } catch {
      return 180; // Default +03:00 fallback
    }
  };

  // Two-pass iterative refinement to handle DST transition edges accurately
  const offsetMin1 = getOffsetMinutesAt(wallAsUtcMs, ianaTimezone);
  const refinedUtcMs1 = wallAsUtcMs - offsetMin1 * 60000;
  const offsetMin2 = getOffsetMinutesAt(refinedUtcMs1, ianaTimezone);
  const finalUtcMs = wallAsUtcMs - offsetMin2 * 60000;

  const offsetHours = offsetMin2 / 60;
  const sign = offsetMin2 >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin2);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');
  const offsetFormatted = `UTC${sign}${hh}:${mm}`;

  return {
    utcDate: new Date(finalUtcMs),
    offsetHours,
    offsetFormatted
  };
}
