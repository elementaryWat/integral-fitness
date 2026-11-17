"""Wrep logo: three slanted bars (lime, lime, cyan) on black, plus the WREP · FITNESS wordmark.
Regenerates every app icon and the iOS splash lockup: python3 assets/brand/make_icons.py"""
import json, os
from PIL import Image, ImageDraw, ImageFont

LIME, CYAN, BG = (200, 245, 60), (108, 199, 232), (0, 0, 0)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def logo(size, bg=BG, circle=False, scale=1.0, colors=(LIME, LIME, CYAN)):
    """Three slanted bars (tall, medium, short), vertically centred, as in the brand sheet."""
    S = 4 * size  # supersample for smooth edges
    img = Image.new('RGB', (S, S), (0, 0, 0) if circle else bg)
    if circle:
        ImageDraw.Draw(img).ellipse((0, 0, S - 1, S - 1), fill=bg)
    cx = cy = S / 2
    u = S * scale
    w, r, k = 0.135 * u, 0.028 * u, 0.20          # bar width, corner radius, slant (dx per dy)
    bars = [(-0.184, 0.53), (0.0, 0.37), (0.184, 0.20)]  # (centre x offset, height) in icon units
    for (dx, h), col in zip(bars, colors):
        layer = Image.new('L', (S, S), 0)
        x0 = cx + dx * u - w / 2
        y0 = cy - h * u / 2
        ImageDraw.Draw(layer).rounded_rectangle((x0, y0, x0 + w, y0 + h * u), radius=r, fill=255)
        # Shear: top leans right. Output x = input x + k*(cy - y)  =>  input x = x + k*y - k*cy.
        layer = layer.transform((S, S), Image.AFFINE, (1, k, -k * cy, 0, 1, 0), resample=Image.BICUBIC)
        img.paste(Image.new('RGB', (S, S), col), (0, 0), layer)
    return img.resize((size, size), Image.LANCZOS)

ring = logo  # previous name kept for the calls below

def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)

# iOS
ios = os.path.join(ROOT, 'ios/IntegralFitness/Images.xcassets/AppIcon.appiconset')
contents = json.load(open(os.path.join(ios, 'Contents.json')))
for im in contents['images']:
    pts = float(im['size'].split('x')[0]); sc = int(im['scale'][0])
    px = int(pts * sc)
    name = f"icon-{px}.png"
    save(ring(px), os.path.join(ios, name))
    im['filename'] = name
json.dump(contents, open(os.path.join(ios, 'Contents.json'), 'w'), indent=2)

# Android (square + round launcher icons)
for folder, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    base = os.path.join(ROOT, f'android/app/src/main/res/mipmap-{folder}')
    save(ring(px), os.path.join(base, 'ic_launcher.png'))
    save(logo(px, circle=True, scale=0.82), os.path.join(base, 'ic_launcher_round.png'))

# Zepp OS watch app (round icon, 248 px source)
save(logo(248, circle=True, scale=0.85), os.path.join(ROOT, 'watch/assets/bip6/icon.png'))

# Brand reference
for old in ('recomp-icon-1024.png', 'recomp-icon-lime-1024.png'):
    if os.path.exists(os.path.join(ROOT, 'assets/brand', old)):
        os.remove(os.path.join(ROOT, 'assets/brand', old))
save(logo(1024), os.path.join(ROOT, 'assets/brand/wrep-icon-1024.png'))
save(logo(1024, bg=LIME, colors=((5, 5, 5), (5, 5, 5), (122, 150, 36))), os.path.join(ROOT, 'assets/brand/wrep-icon-lime-1024.png'))

# Wordmark lockup: bars + WREP + FITNESS (transparent, for the splash screen and the brand sheet)
TEXT = (244, 245, 240)
FONTS = os.path.join(ROOT, 'assets/fonts')

def bars(h):
    """The three bars alone, h px tall, on transparent."""
    m = logo(h * 2, bg=(0, 0, 0)).convert('L')  # luminance as a mask of the bars
    src = logo(h * 2)
    rgba = src.convert('RGBA')
    rgba.putalpha(m.point(lambda v: 255 if v > 8 else 0))
    box = rgba.getbbox()
    return rgba.crop(box).resize((round((box[2] - box[0]) * h / (box[3] - box[1])), h), Image.LANCZOS)

def lockup(scale=1):
    word = ImageFont.truetype(os.path.join(FONTS, 'BarlowCondensed-Black.ttf'), 120 * scale)
    tag = ImageFont.truetype(os.path.join(FONTS, 'JetBrainsMono-SemiBold.ttf'), 22 * scale)
    mark = bars(118 * scale)
    wb = word.getbbox('WREP')
    ww, wh = wb[2] - wb[0], wb[3] - wb[1]
    track = 9 * scale
    tw = sum(tag.getlength(c) for c in 'FITNESS') + track * 6
    gap = 34 * scale
    W = mark.width + gap + max(ww, tw) + 8 * scale
    H = max(mark.height, wh + 44 * scale) + 8 * scale
    img = Image.new('RGBA', (int(W), int(H)), (0, 0, 0, 0))
    img.paste(mark, (0, int((H - mark.height) / 2)), mark)
    d = ImageDraw.Draw(img)
    x = mark.width + gap
    y = (H - (wh + 38 * scale)) / 2
    d.text((x - wb[0], y - wb[1]), 'WREP', font=word, fill=TEXT)
    tx, ty = x + 4 * scale, y + wh + 16 * scale
    for c in 'FITNESS':
        d.text((tx, ty), c, font=tag, fill=LIME)
        tx += tag.getlength(c) + track
    return img

splash = os.path.join(ROOT, 'ios/IntegralFitness/Images.xcassets/SplashLogo.imageset')
for k in (1, 2, 3):
    save(lockup(k), os.path.join(splash, f'splash@{k}x.png'))
json.dump({'images': [{'idiom': 'universal', 'filename': f'splash@{k}x.png', 'scale': f'{k}x'} for k in (1, 2, 3)], 'info': {'version': 1, 'author': 'xcode'}},
          open(os.path.join(splash, 'Contents.json'), 'w'), indent=2)
on_black = Image.new('RGBA', (1600, 600), (0, 0, 0, 255))
lk = lockup(2)
on_black.paste(lk, ((1600 - lk.width) // 2, (600 - lk.height) // 2), lk)
save(on_black.convert('RGB'), os.path.join(ROOT, 'assets/brand/wrep-lockup.png'))
print('ok')
