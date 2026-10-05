---
name: concertly-commit
description: Emre bir değişikliği test edip "sıkıntı yok / commit atacağım" dediğinde ona verilecek güvenli commit komutlarını hazırlar. Claude commit ya da push ÇALIŞTIRMAZ; yalnızca komutları metin olarak verir.
---

# Concertly commit hazırlığı

Claude `git commit`, `git push`, `git add` ÇALIŞTIRMAZ. Emre komutları kendisi çalıştırır.
Yıkıcı komutlar da yasak: `git checkout -- <dosya>`, `git restore`, `git reset --hard`, `git stash`.

## Adımlar

1. `git status -s` ile değişenleri gör. Yalnızca bu işe ait dosyaları seç.
2. Emre'ye PowerShell için şu biçimde ver (repo kökünden):

   ```powershell
   git add <dosya1> <dosya2> ...
   git commit -m "<tip>: <kısa İngilizce açıklama>"
   git push origin main
   ```

3. Kurallar:
   - `git add .` ya da `git add -A` ÖNERME. Dosyaları tek tek yaz.
   - Commit mesajına Co-Authored-By satırı EKLEME.
   - Mesaj: conventional commit (`feat`, `fix`, `perf`, `style`, `chore`, `refactor`), İngilizce, küçük harf, sonda nokta yok. Mesajın başında boşluk olmasın.
   - `.claude/agents/` altındaki takip edilmeyen dosyaları Emre ayrıca istemedikçe ekleme.
   - Push sonrası canlıya bir şey çıkmaz (Render auto-deploy kapalı). Backend değişikliği varsa bunu belirt.
4. Emre "attım" deyince `git log origin/main --oneline -1` ile push'u doğrula ve hafızadaki durum notunu güncelle.
