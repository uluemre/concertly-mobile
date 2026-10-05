---
name: concertly-verify
description: Concertly'de bir değişikliği bitirdikten sonra, Emre'ye "test et" demeden ÖNCE çalıştırılacak doğrulama. Mobilde babel derlemesi + TR/EN çeviri paritesi, backend'de temiz derleme + testler. Kod değiştiren her işin sonunda kullan.
---

# Concertly doğrulama

Hangi tarafa dokunulduysa o adımı koş. Sonucu Emre'ye kısaca bildir (geçti / şu dosyada hata).

## Mobil (`mobile/` altında değişiklik varsa)

```bash
cd mobile && node ../.claude/skills/concertly-verify/verify-mobile.js
```

- Dosya verilmezse git'te değişen `mobile/src/**/*.js` dosyalarını derler; istenirse dosya adları argüman olarak verilir.
- Çeviri paritesi her zaman kontrol edilir. Yeni kullanıcı metni ekledin mi? Hem `tr` hem `en` bloğuna anahtar ekle.
- Tekil biçim: `t(key, { count|n })` sayı 1 iken `<key>_one` varsa onu kullanır; `_one` anahtarı iki dilde de olmalı (parite).
- Babel yalnızca sözdizimini yakalar. Yeni bileşende kullanılan değişkenlerin (ör. `colors`, `t`) kapsamda olduğunu ayrıca gözle kontrol et.

## Backend (`backend/` altında değişiklik varsa)

Pipe KULLANMA (`| tail` çıkış kodunu gizler; Render'da build_failed'a yol açtı). Bellek düşük olduğu için heap sınırla:

```bash
cd backend
MAVEN_OPTS=-Xmx512m ./mvnw -q -o clean package -DskipTests > "$TMP/build.log" 2>&1; echo "build exit: $?"
MAVEN_OPTS=-Xmx512m ./mvnw -q test -DargLine=-Xmx768m > "$TMP/test.log" 2>&1; echo "test exit: $?"
```

- Çıkış kodu 0 değilse log'un sonuna bak, hatayı düzelt, tekrar koş.
- Tek test için: `./mvnw -q test -Dtest="SinifAdiTest"`.
- Backend değiştiyse Emre'ye hatırlat: yerel backend'i (port 8084) kendisi yeniden başlatmalı.

## Sonra

Commit'i Emre atar. Mesaj ve dosya listesi için `concertly-commit` skill'ini kullan.
