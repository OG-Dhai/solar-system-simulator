"""Generate simple, original placeholder textures for the Solar System Simulator.

Every image is computed from noise, colour gradients and random dots; nothing is
derived from third-party imagery. Output file names and sizes match the files the
app expects in public/textures/.

Usage: python3 scripts/generate-placeholder-textures.py public/textures
Requires: Pillow, NumPy
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 2048, 1024
RNG = np.random.default_rng(20260110)


def value_noise(w, h, scale, octaves=4, seed=0):
    """Smooth tileable-in-x value noise in [0, 1]."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gx, gy = max(2, int(scale * 2 ** o)), max(2, int(scale * 2 ** o / 2))
        grid = rng.random((gy + 1, gx))
        grid = np.concatenate([grid, grid[:, :1]], axis=1)  # wrap horizontally
        img = Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * (np.asarray(img) / 255.0)
        total += amp
        amp *= 0.5
    return out / total


def colorize(t, stops):
    """Map t in [0, 1] through a list of (position, (r, g, b)) colour stops."""
    pos = np.array([p for p, _ in stops])
    cols = np.array([c for _, c in stops], dtype=float)
    rgb = np.stack([np.interp(t, pos, cols[:, k]) for k in range(3)], axis=-1)
    return rgb.clip(0, 255).astype(np.uint8)


def rocky(base, dark, seed, craters=120):
    t = value_noise(W, H, 8, 5, seed)
    img = colorize(t, [(0, dark), (1, base)]).astype(float)
    rng = np.random.default_rng(seed + 1)
    yy, xx = np.mgrid[0:H, 0:W]
    for _ in range(craters):
        cx, cy, r = rng.integers(0, W), rng.integers(H // 8, 7 * H // 8), rng.integers(4, 40)
        d = np.hypot(xx - cx, yy - cy)
        img[d < r] *= 0.82
        img[(d >= r) & (d < r * 1.15)] *= 1.08
    return img.clip(0, 255).astype(np.uint8)


def banded(colors, seed, turbulence=0.04):
    y = np.linspace(0, 1, H)[:, None] + turbulence * (value_noise(W, H, 6, 4, seed) - 0.5)
    bands = (np.sin(y * np.pi * 14) + 1) / 2 * 0.6 + value_noise(W, H, 3, 3, seed + 7) * 0.4
    stops = [(i / (len(colors) - 1), c) for i, c in enumerate(colors)]
    return colorize(bands, stops)


def starfield(density, seed, band=False):
    rng = np.random.default_rng(seed)
    img = np.zeros((H, W, 3), dtype=float)
    if band:
        y = np.linspace(-1, 1, H)[:, None]
        glow = np.exp(-(y * 4) ** 2) * value_noise(W, H, 10, 4, seed + 3)
        img += (glow * 70)[..., None] * np.array([1.0, 0.95, 0.85])
    n = int(W * H * density)
    xs, ys = rng.integers(0, W, n), rng.integers(0, H, n)
    b = rng.random(n) ** 3 * 255
    img[ys, xs] = np.maximum(img[ys, xs], b[:, None])
    return img.clip(0, 255).astype(np.uint8)


def ring_strip(color, seed, w=2048, h=64):
    x = np.linspace(0, 1, w)
    rng = np.random.default_rng(seed)
    alpha = (np.sin(x * 60 + rng.random() * 6) + 1) / 2 * 0.5 + rng.random(w) * 0.2
    alpha *= np.clip(np.sin(x * np.pi) * 1.5, 0, 1)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = color
    rgba[..., 3] = (alpha * 255).clip(0, 255).astype(np.uint8)[None, :]
    return rgba


def earth_like(seed):
    t = value_noise(W, H, 6, 6, seed)
    land = t > 0.55
    img = colorize(t, [(0, (10, 40, 110)), (0.55, (30, 90, 170)), (0.56, (60, 120, 50)), (0.8, (120, 110, 70)), (1, (200, 200, 190))])
    lat = np.abs(np.linspace(-1, 1, H))[:, None]
    img[np.broadcast_to(lat > 0.88, (H, W))] = (235, 240, 245)
    return img, land


KEEP_EXISTING = False


def save(img, path):
    if KEEP_EXISTING and Path(path).exists():
        return
    mode = 'RGBA' if img.ndim == 3 and img.shape[2] == 4 else 'RGB'
    Image.fromarray(img, mode).save(path, 'WEBP', quality=80)


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    rocky_bodies = {
        'mercury': ((170, 160, 150), (80, 75, 70)), 'moon': ((190, 190, 185), (90, 90, 90)),
        'mars': ((200, 110, 70), (110, 50, 30)), 'phobos': ((140, 120, 100), (70, 60, 50)),
        'deimos': ((160, 145, 125), (80, 70, 60)), 'callisto': ((120, 110, 95), (50, 45, 40)),
        'ganymede': ((160, 150, 135), (80, 75, 70)), 'europa': ((225, 215, 195), (150, 120, 90)),
        'io': ((230, 200, 90), (160, 90, 30)), 'titan': ((215, 160, 80), (150, 100, 50)),
        'enceladus': ((240, 245, 250), (180, 190, 200)), 'mimas': ((190, 190, 190), (110, 110, 110)),
        'tethys': ((210, 210, 205), (130, 130, 125)), 'dione': ((200, 200, 200), (120, 120, 120)),
        'rhea': ((195, 195, 190), (110, 110, 105)), 'triton': ((220, 200, 190), (150, 130, 120)),
        'proteus': ((120, 115, 110), (60, 55, 50)), 'larissa': ((130, 125, 120), (65, 60, 55)),
        'nereid': ((150, 145, 140), (75, 70, 65)), 'miranda': ((180, 180, 180), (100, 100, 100)),
        'ariel': ((190, 190, 195), (110, 110, 115)), 'umbriel': ((110, 110, 115), (50, 50, 55)),
        'titania': ((175, 165, 160), (95, 90, 85)), 'oberon': ((160, 145, 135), (85, 75, 70)),
        'pluto': ((215, 190, 160), (120, 90, 70)), 'charon': ((170, 165, 160), (90, 85, 80)),
        'halley': ((70, 65, 60), (30, 28, 25)), 'venus_surface': ((200, 140, 80), (110, 70, 40)),
    }
    for i, (name, (base, dark)) in enumerate(rocky_bodies.items()):
        save(rocky(base, dark, 100 + i), out / f'{name}.webp')

    save(banded([(150, 110, 80), (220, 190, 150), (180, 120, 80), (240, 225, 200)], 1), out / 'jupiter.webp')
    save(banded([(200, 170, 110), (235, 215, 160), (210, 180, 120)], 2, 0.02), out / 'saturn.webp')
    save(banded([(150, 210, 220), (170, 225, 230)], 3, 0.01), out / 'uranus.webp')
    save(banded([(40, 80, 190), (70, 120, 220), (50, 90, 200)], 4, 0.02), out / 'neptune.webp')
    save(banded([(230, 210, 160), (245, 230, 190)], 5, 0.08), out / 'venus.webp')
    save(banded([(235, 220, 170), (250, 240, 200)], 6, 0.1), out / 'venus_atmosphere.webp')
    save(colorize(value_noise(W, H, 16, 5, 7), [(0, (200, 60, 0)), (0.5, (255, 150, 20)), (1, (255, 230, 120))]), out / 'sun.webp')

    day, land = earth_like(8)
    save(day, out / 'earth_daymap.webp')
    night = np.zeros((H, W, 3), dtype=np.uint8)
    lights = land & (RNG.random((H, W)) > 0.985)
    night[lights] = (255, 200, 120)
    save(night, out / 'earth_nightmap.webp')
    clouds = (value_noise(W, H, 10, 5, 9) > 0.58).astype(np.uint8) * 255
    save(np.stack([clouds] * 3, axis=-1), out / 'earth_clouds.webp')
    save(np.full((H, W, 3), (128, 128, 255), dtype=np.uint8), out / 'earth_normal.webp')
    spec = np.where(land, 0, 200).astype(np.uint8)
    save(np.stack([spec] * 3, axis=-1), out / 'earth_specular.webp')

    save(starfield(0.0015, 10), out / 'stars.webp')
    save(starfield(0.0025, 11, band=True), out / 'stars_milky_way.webp')
    g = starfield(0.001, 12)
    g = np.asarray(Image.fromarray(g).resize((1024, 1024)))
    save(g, out / 'galaxy_spiral.webp')

    save(ring_strip((210, 190, 150), 13), out / 'saturn_ring_alpha.webp')
    save(ring_strip((150, 130, 110), 14), out / 'jupiter_ring.webp')
    save(ring_strip((170, 180, 190), 15), out / 'uranus_ring.webp')
    save(ring_strip((150, 160, 180), 16), out / 'neptune_ring.webp')

    tail = np.zeros((575, 1024, 4), dtype=np.uint8)
    x = np.linspace(0, 1, 1024)[None, :]
    y = np.abs(np.linspace(-1, 1, 575))[:, None]
    tail[..., :3] = (200, 220, 255)
    tail[..., 3] = (np.clip(1 - y / (0.1 + 0.6 * x), 0, 1) * (1 - x) * 255).astype(np.uint8)
    if not (KEEP_EXISTING and (out / 'halley_texture.png').exists()):
        Image.fromarray(tail, 'RGBA').save(out / 'halley_texture.png')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--keep-existing']
    KEEP_EXISTING = '--keep-existing' in sys.argv[1:]
    main(args[0] if args else 'public/textures')
