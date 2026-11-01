import zlib, struct, math, os

def lerp(a, b, t): return a + (b - a) * t

def seg_dist(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    L2 = dx * dx + dy * dy
    if L2 == 0: return math.hypot(px - x1, py - y1)
    t = ((px - x1) * dx + (py - y1) * dy) / L2
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))

def rrect_dist(px, py, w, h, r):
    """到圆角矩形边框的有符号距离（内部为负）"""
    cx, cy = w / 2, h / 2
    qx = abs(px - cx) - (w / 2 - r)
    qy = abs(py - cy) - (h / 2 - r)
    ox, oy = max(qx, 0), max(qy, 0)
    return math.hypot(ox, oy) + min(max(qx, qy), 0) - r

def smooth(e0, e1, x):
    t = (x - e0) / (e1 - e0) if e1 != e0 else 0
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return t * t * (3 - 2 * t)

def render(size):
    S = float(size)
    pad = S * 0.035
    w = h = S - 2 * pad
    r = S * 0.235
    # 背景渐变：左上暖橙 → 右下深赭
    c1 = (0xEF, 0x8A, 0x5E)
    c2 = (0xC2, 0x4A, 0x28)
    # 白色 ¥ 的线段（归一化到画布比例）
    lw = S * 0.062
    segs = [
        (0.315, 0.255, 0.500, 0.475),
        (0.685, 0.255, 0.500, 0.475),
        (0.500, 0.470, 0.500, 0.790),
        (0.345, 0.560, 0.655, 0.560),
        (0.345, 0.665, 0.655, 0.665),
    ]
    segs = [(a * S, b * S, c * S, d * S) for a, b, c, d in segs]

    buf = bytearray(size * size * 4)
    for y in range(size):
        py = y + 0.5
        row = y * size * 4
        for x in range(size):
            px = x + 0.5
            d = rrect_dist(px, py, w, h, r) + 0 - 0
            # 把坐标平移到圆角矩形内部坐标系
            d = rrect_dist(px - pad, py - pad, w, h, r)
            inside = 1.0 - smooth(-1.0, 1.0, d)
            if inside <= 0.001:
                continue
            # 渐变按对角线
            t = (px + py) / (2 * S)
            cr = lerp(c1[0], c2[0], t)
            cg = lerp(c1[1], c2[1], t)
            cb = lerp(c1[2], c2[2], t)
            # ¥ 距离场
            md = min(seg_dist(px, py, *s) for s in segs) - lw / 2
            ink = 1.0 - smooth(-1.2, 1.2, md)
            if ink > 0.001:
                # 白字带一点点暖调，不要死白
                cr = lerp(cr, 255, ink)
                cg = lerp(cg, 252, ink)
                cb = lerp(cb, 247, ink)
            i = row + x * 4
            buf[i] = int(cr)
            buf[i + 1] = int(cg)
            buf[i + 2] = int(cb)
            buf[i + 3] = int(inside * 255)
    return bytes(buf)

def write_png(path, size, rgba):
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(raw), 9)

    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', comp)
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)

base = r'C:/Users/lenovo/WorkBuddy/2026-10-21-14-07-25/app/res'
targets = [('mipmap-mdpi', 48), ('mipmap-hdpi', 72), ('mipmap-xhdpi', 96),
           ('mipmap-xxhdpi', 144), ('mipmap-xxxhdpi', 192)]
for folder, size in targets:
    p = os.path.join(base, folder, 'ic_launcher.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    write_png(p, size, render(size))
    print(f'{folder}/ic_launcher.png  {size}x{size}  {os.path.getsize(p)} bytes')

# 大图预览用
write_png(r'C:/Users/lenovo/WorkBuddy/2026-10-21-14-07-25/app/_icon_preview.png', 256, render(256))
print('预览图已生成')
