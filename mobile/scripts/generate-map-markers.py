"""Harita işaretçilerini PNG olarak üretir (mobile/assets/map). mobile/ içinden: python scripts/generate-map-markers.py (Pillow + Windows fontları gerekir)."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = 'assets/map'
os.makedirs(OUT, exist_ok=True)

COLORS = {
    'rock': '#E94560', 'pop': '#7C3AED', 'jazz': '#F5A623',
    'electronic': '#00D4AA', 'rap': '#3B82F6',
}
BG = '#16161F'
NOTE_FONT = 'C:/Windows/Fonts/seguisym.ttf'
BOLD_FONT = 'C:/Windows/Fonts/seguibl.ttf'


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def save_scaled(draw_fn, base_size, name):
    """1x / @2x / @3x varyantları (React Native yoğunluğa göre seçer)."""
    for scale, suffix in ((1, ''), (2, '@2x'), (3, '@3x')):
        S = 4 * scale  # süper örnekleme
        w, h = base_size[0] * S, base_size[1] * S
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw_fn(im, S)
        im = im.resize((base_size[0] * scale, base_size[1] * scale), Image.LANCZOS)
        im.save(os.path.join(OUT, f'{name}{suffix}.png'))


def pin(color, selected):
    size = 40 if selected else 32
    c = hex_rgb(color)

    def draw(im, S):
        d = ImageDraw.Draw(im)
        W = im.size[0]
        pad = 2 * S
        border = (4 if selected else 3) * S
        # gölge
        d.ellipse([pad + S, pad + 2 * S, W - pad + S, W - pad + 2 * S], fill=(0, 0, 0, 90))
        d.ellipse([pad, pad, W - pad, W - pad], fill=c + (255,))
        inner = pad + border
        bg = c if selected else hex_rgb(BG)
        d.ellipse([inner, inner, W - inner, W - inner], fill=bg + (255,))
        font = ImageFont.truetype(NOTE_FONT, int(W * 0.42))
        glyph = '\u266B'
        bbox = d.textbbox((0, 0), glyph, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        fg = (255, 255, 255, 255) if selected else c + (255,)
        d.text(((W - tw) / 2 - bbox[0], (W - th) / 2 - bbox[1]), glyph, font=font, fill=fg)

    return draw, (size, size)


def cluster(label, size):
    c = hex_rgb('#E94560')

    def draw(im, S):
        d = ImageDraw.Draw(im)
        W = im.size[0]
        pad = 2 * S
        d.ellipse([pad + S, pad + 2 * S, W - pad + S, W - pad + 2 * S], fill=(0, 0, 0, 90))
        d.ellipse([pad, pad, W - pad, W - pad], fill=(255, 255, 255, 255))
        inner = pad + 3 * S
        d.ellipse([inner, inner, W - inner, W - inner], fill=c + (255,))
        fs = int(W * (0.36 if len(label) <= 3 else 0.30))
        font = ImageFont.truetype(BOLD_FONT, fs)
        bbox = d.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text(((W - tw) / 2 - bbox[0], (W - th) / 2 - bbox[1]), label, font=font, fill=(255, 255, 255, 255))

    return draw, (size, size)


for key, color in COLORS.items():
    for selected in (False, True):
        fn, size = pin(color, selected)
        save_scaled(fn, size, f'pin-{key}{"-sel" if selected else ""}')

# Küme aralıkları: etiket, boyut
CLUSTERS = [('2', '2+', 38), ('5', '5+', 40), ('10', '10+', 44), ('25', '25+', 46),
            ('50', '50+', 50), ('100', '100+', 54), ('250', '250+', 56), ('500', '500+', 58)]
for key, label, size in CLUSTERS:
    fn, sz = cluster(label, size)
    save_scaled(fn, sz, f'cluster-{key}')

print(sorted(os.listdir(OUT))[:6], len(os.listdir(OUT)))
