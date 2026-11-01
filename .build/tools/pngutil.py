"""极简 PNG 读写（不依赖 Pillow，本机没网装不了）。

只支持 8bit、非隔行的 RGB / RGBA / 灰度 / 调色板 —— 够处理 AI 出的图和我们的图标。
"""
import zlib, struct


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def read_png(path):
    """返回 (width, height, bytearray RGBA)"""
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', '不是 PNG'
    pos = 8
    w = h = bitdepth = colortype = interlace = None
    idat = bytearray()
    plte = None
    trns = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if typ == b'IHDR':
            w, h, bitdepth, colortype, comp, filt, interlace = struct.unpack('>IIBBBBB', body)
        elif typ == b'PLTE':
            plte = body
        elif typ == b'tRNS':
            trns = body
        elif typ == b'IDAT':
            idat += body
        elif typ == b'IEND':
            break
    assert bitdepth == 8, f'只支持 8bit，实际 {bitdepth}'
    assert interlace == 0, '不支持隔行 PNG'
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colortype]
    raw = zlib.decompress(bytes(idat))
    stride = w * ch
    out = bytearray(stride * h)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        ft = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if ft == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif ft == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif ft == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif ft == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                c = prev[i - ch] if i >= ch else 0
                line[i] = (line[i] + _paeth(a, prev[i], c)) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line

    rgba = bytearray(w * h * 4)
    if colortype == 2:
        for i in range(w * h):
            rgba[i * 4] = out[i * 3]
            rgba[i * 4 + 1] = out[i * 3 + 1]
            rgba[i * 4 + 2] = out[i * 3 + 2]
            rgba[i * 4 + 3] = 255
    elif colortype == 6:
        rgba[:] = out
    elif colortype == 0:
        for i in range(w * h):
            v = out[i]
            rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v
            rgba[i * 4 + 3] = 255
    elif colortype == 4:
        for i in range(w * h):
            v = out[i * 2]
            rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v
            rgba[i * 4 + 3] = out[i * 2 + 1]
    elif colortype == 3:
        n = len(plte) // 3
        for i in range(w * h):
            idx = out[i]
            idx = idx if idx < n else 0
            rgba[i * 4] = plte[idx * 3]
            rgba[i * 4 + 1] = plte[idx * 3 + 1]
            rgba[i * 4 + 2] = plte[idx * 3 + 2]
            rgba[i * 4 + 3] = trns[idx] if trns and idx < len(trns) else 255
    else:
        raise ValueError(f'不支持的颜色类型 {colortype}')
    return w, h, rgba


def write_png(path, w, h, rgba):
    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(raw), 9)

    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', comp)
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
