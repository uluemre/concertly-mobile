import AsyncStorage from '@react-native-async-storage/async-storage';
import API from './api';
import { setLaunchCities } from '../constants/cities';

const STORAGE_KEY = 'launchCities';

/**
 * Açık şehirleri yükler: önce telefonda saklanan son liste (anında), sonra sunucu
 * (GET /cities). Hata olursa sessizce varsayılan / son bilinen liste kalır.
 */
export async function loadLaunchCities() {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) setLaunchCities(JSON.parse(cached));
  } catch {}
  try {
    const res = await API.get('/cities');
    const list = res.data?.cities;
    if (Array.isArray(list) && list.length > 0) {
      setLaunchCities(list);
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
    }
  } catch {}
}
