/**
 * Ses oynatıcısını gerçekten durdurur.
 *
 * DİKKAT: expo-audio'da `player.remove()` yalnızca oynatıcıyı bellekten
 * düşürür — çalmayı DURDURMAZ. Sadece remove çağrıldığında ses native
 * tarafta önizlemenin sonuna kadar çalmaya devam eder. Bu yüzden önce
 * `pause()` gerekir.
 *
 * Bu ihmal üç oyunda birden hataya yol açmıştı: günün şarkısında 1 saniyelik
 * kesit yerine tüm parça çalıyordu, quiz ve blind rank'te ise her yeni parça
 * öncekinin üstüne biniyordu.
 */
export function stopPlayer(player) {
  if (!player) return;
  // Kaynak zaten serbest bırakılmışsa çağrılar hata atabilir; ses susmalı,
  // ekran akışı bozulmamalı.
  try { player.pause(); } catch {}
  try { player.remove(); } catch {}
}
