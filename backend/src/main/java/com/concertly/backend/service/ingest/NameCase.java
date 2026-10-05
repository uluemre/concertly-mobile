package com.concertly.backend.service.ingest;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bilet sitelerinden gelen etkinlik adlarını okunur hale getirir.
 *
 * Bazı siteler (Zorlu PSM, BiletimGo) adı tamamen büyük harfle ve HTML kaçışlarıyla
 * veriyor. Doğru yazım sayfadaki bir metinde geçiyorsa oradan alınır; yoksa kelime
 * kelime küçültülür.
 */
public final class NameCase {

    private NameCase() {}

    /**
     * Ad tamamen büyük harfle geliyor ("THE CINEMATIC ORCHESTRA", "EMİR ERSOY &quot;…&quot;").
     * Açıklama metninde aynı ad doğru yazımıyla geçiyorsa oradan alınır; yoksa kelime
     * kelime küçültülür. Türkçe kuralı (I→ı) yalnız Türkçe harf taşıyan kelimelere
     * uygulanır, yoksa "NIGHT" "Nıght" olurdu.
     */
    public static String properName(String rawName, String description) {
        String name = decodeEntities(rawName);
        if (name == null) return null;
        name = name.trim();
        if (name.isEmpty()) return null;
        if (!isAllUpper(name)) return name;
        String desc = decodeEntities(description);
        if (desc != null) {
            int at = fold(desc).indexOf(fold(name));
            if (at >= 0) {
                String found = desc.substring(at, at + name.length());
                if (!isAllUpper(found)) return found;
            }
            return byWord(name, desc);
        }
        return titleCase(name);
    }

    private static final java.util.regex.Pattern WORD = java.util.regex.Pattern.compile("[\\p{L}\\p{N}'’]+");

    /**
     * Tam ad metinde geçmiyorsa kelime kelime: "BAHADIR MACİT İSTANBUL KONSERİ" →
     * metindeki "Bahadır", "Macit" yazımları alınır; bulunamayan kelime kurala göre küçültülür.
     */
    static String byWord(String name, String text) {
        java.util.Map<String, String> known = new java.util.HashMap<>();
        java.util.regex.Matcher w = WORD.matcher(text);
        while (w.find()) {
            String word = w.group();
            if (!isAllUpper(word)) known.putIfAbsent(fold(word), word);
        }
        StringBuilder out = new StringBuilder();
        java.util.regex.Matcher m = WORD.matcher(name);
        int last = 0;
        while (m.find()) {
            out.append(name, last, m.start());
            String word = m.group();
            String found = known.get(fold(word));
            out.append(found != null ? capitalizeFirst(found) : titleCase(word));
            last = m.end();
        }
        out.append(name.substring(last));
        return out.toString();
    }

    /** Metindeki kelime küçük harfle geçiyorsa ("konseri") ilk harfi büyütülür. */
    private static String capitalizeFirst(String word) {
        if (word.isEmpty() || !Character.isLowerCase(word.charAt(0))) return word;
        boolean turkish = word.chars().anyMatch(ch -> TURKISH_LETTERS.indexOf(ch) >= 0) || word.charAt(0) == 'i';
        return word.substring(0, 1).toUpperCase(turkish ? TR : Locale.ROOT) + word.substring(1);
    }

    /** Uzunluk değiştirmeden büyük/küçük ve I/ı/İ/i farkını yok sayar (indexOf için). */
    static String fold(String value) {
        StringBuilder sb = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            if (c == 'İ' || c == 'I' || c == 'ı') sb.append('i');
            else sb.append(Character.toLowerCase(c));
        }
        return sb.toString();
    }

    private static final Pattern NUMERIC_ENTITY = Pattern.compile("&#(x[0-9a-fA-F]+|[0-9]+);");

    /** &quot; &amp; &#39; &#x27; &#xA; gibi kaçışları çözer. */
    public static String decodeEntities(String value) {
        if (value == null) return null;
        Matcher m = NUMERIC_ENTITY.matcher(value);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String code = m.group(1);
            int cp = code.startsWith("x") ? Integer.parseInt(code.substring(1), 16) : Integer.parseInt(code);
            m.appendReplacement(sb, Matcher.quoteReplacement(cp == 0xA || cp == 0xD ? " " : new String(Character.toChars(cp))));
        }
        m.appendTail(sb);
        return sb.toString().replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ");
    }

    private static final Locale TR = Locale.forLanguageTag("tr");

    public static boolean isAllUpper(String value) {
        boolean letter = false;
        for (char c : value.toCharArray()) {
            if (Character.isLetter(c)) {
                letter = true;
                if (Character.isLowerCase(c)) return false;
            }
        }
        return letter;
    }

    private static final String TURKISH_LETTERS = "ŞĞÜÖÇİşğüöçı";

    /**
     * "GAYE SU AKYOL İLE" → "Gaye Su Akyol İle". Türkçe harf taşıyan kelimeye Türkçe
     * küçültme (I→ı), taşımayana genel küçültme (I→i) uygulanır.
     */
    public static String titleCase(String value) {
        StringBuilder lowered = new StringBuilder(value.length());
        for (String word : value.split("(?<=\\s)|(?=\\s)")) {
            boolean turkish = word.chars().anyMatch(ch -> TURKISH_LETTERS.indexOf(ch) >= 0);
            lowered.append(word.toLowerCase(turkish ? TR : Locale.ROOT));
        }
        String lower = lowered.toString();
        StringBuilder sb = new StringBuilder(lower.length());
        boolean start = true;
        for (int i = 0; i < lower.length(); i++) {
            char c = lower.charAt(i);
            if (start && Character.isLetter(c)) {
                sb.append(String.valueOf(c).toUpperCase(TR));
                start = false;
            } else {
                sb.append(c);
                if (Character.isWhitespace(c) || c == '"' || c == '(' || c == '-' || c == '/') start = true;
                else if (Character.isLetter(c)) start = false;
            }
        }
        return sb.toString();
    }
}
