// "Konser Günü" yardımcıları: canlı geri sayım, hava kodu → ikon/metin,
// havaya göre akıllı hazırlık listesi.
import { useEffect, useState } from 'react';

/**
 * Sunucunun hesapladığı "başlamasına kalan saniye"den canlı geri sayım.
 * Hedef, yanıtın geldiği andan hesaplanır — telefonun saat dilimi ya da
 * saatinin yanlış olması geri sayımı kaydırmaz.
 */
export function useCountdown(secondsUntilStart, receivedAt) {
  const target = receivedAt + Math.max(0, secondsUntilStart || 0) * 1000;
  const [left, setLeft] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    setLeft(Math.max(0, target - Date.now()));
    if (target <= Date.now()) return undefined;
    const timer = setInterval(() => {
      const next = Math.max(0, target - Date.now());
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [target]);

  const total = Math.floor(left / 1000);
  return {
    total,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

// WMO hava kodları (Open-Meteo) → Ionicons adı + çeviri anahtarı
export function weatherLook(code) {
  if (code === 0) return { icon: 'sunny', key: 'cday_wx_clear' };
  if (code <= 2) return { icon: 'partly-sunny', key: 'cday_wx_partly' };
  if (code === 3) return { icon: 'cloudy', key: 'cday_wx_cloudy' };
  if (code === 45 || code === 48) return { icon: 'cloud-outline', key: 'cday_wx_fog' };
  if (code >= 51 && code <= 57) return { icon: 'rainy', key: 'cday_wx_drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: 'rainy', key: 'cday_wx_rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: 'snow', key: 'cday_wx_snow' };
  if (code >= 95) return { icon: 'thunderstorm', key: 'cday_wx_storm' };
  return { icon: 'thermometer', key: 'cday_wx_unknown' };
}

const isWet = (w) => w && (w.precipitationProbability >= 40
  || (w.weatherCode >= 51 && w.weatherCode <= 67) || w.weatherCode >= 80);

/** Havaya göre tek cümlelik öneri anahtarı (yoksa null). */
export function weatherAdviceKey(w) {
  if (!w) return null;
  if (w.weatherCode >= 95) return 'cday_advice_storm';
  if (isWet(w)) return 'cday_advice_rain';
  if (w.apparentTemperature <= 8) return 'cday_advice_cold';
  if (w.apparentTemperature <= 16) return 'cday_advice_cool';
  if (w.apparentTemperature >= 28) return 'cday_advice_hot';
  if (w.windKmh >= 35) return 'cday_advice_wind';
  return 'cday_advice_nice';
}

/** Konsere götürülecekler — temel liste + havaya göre eklenenler. */
export function prepChecklist(w) {
  const items = [
    { id: 'ticket', icon: 'ticket', key: 'cday_item_ticket' },
    { id: 'id', icon: 'id-card', key: 'cday_item_id' },
    { id: 'power', icon: 'battery-charging', key: 'cday_item_power' },
    { id: 'earplugs', icon: 'headset', key: 'cday_item_earplugs' },
    { id: 'route', icon: 'subway', key: 'cday_item_route' },
  ];
  if (isWet(w)) items.push({ id: 'rain', icon: 'umbrella', key: 'cday_item_raincoat', weather: true });
  if (w && w.apparentTemperature <= 16) items.push({ id: 'warm', icon: 'shirt', key: 'cday_item_warm', weather: true });
  if (w && w.apparentTemperature >= 26) items.push({ id: 'water', icon: 'water', key: 'cday_item_water', weather: true });
  return items;
}
