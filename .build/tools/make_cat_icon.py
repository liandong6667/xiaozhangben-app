"""把小账本的图标换成「叼金币的小猫」。

母图是 AI 复刻的干净插画（1024，纯白底、深灰手绘描边）。金币不用 AI 画，
而是本地按像素合成 —— 这样咬合线的位置、线宽、颜色能和原图完全对上，
不会出现「像别在围巾上的徽章」那种违和感。

用法：
  python make_cat_icon.py <干净母图.png>            # 出预览，不写进 res
  python make_cat_icon.py <干净母图.png> --install  # 写进 app/res/mipmap-*/ic_launcher.png
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngutil import read_png, write_png

# ---- 原图里量出来的基准（1024 画布坐标）----
ART = 1024
LINE = (73, 73, 73)          # 描边色 #494949
STROKE = 14                  # 描边粗细（1024 下）
MOUTH_CX, MOUTH_CY = 440, 556   # 嘴的中心
COIN_R = 58                  # 金币半径（比嘴宽一点，两侧能露出金边）
MOUTH_ON_COIN = 0.36         # 嘴线落在金币高度的位置，金币从唇线以下才画出来
CLIP_HALF_W = 56             # 唇线裁剪的横向半宽（≈嘴宽的一半多一点点）
COIN_SQUASH = 0.82           # 纵向压扁比例（<1 就是斜着看的硬币）
COIN_DX = 0                  # 金币相对嘴中心的横向偏移
COIN_CY = MOUTH_CY + int(COIN_R * MOUTH_ON_COIN * 2 * 0.5 + COIN_R * 0.30)

GOLD = (240, 182, 47)        # #F0B62F
GOLD_HI = (249, 212, 112)
GOLD_LO = (214, 154, 26)
DRAW_MOUTH_LINE = True       # 是否把嘴线画到金币上（咬合感来源）
DRAW_COIN = True             # 关掉则直接用母图里的金币（AI 画的那版）
FILL = 0.96                  # 猫占图标宽度的比例（=猫的可见宽度，越大越满）
VBIAS = 0.47                 # 内容垂直中心（0.5 = 正中）
EDGE_PAD = 0.016             # 圆角方形距画布边缘的留白（越小图标越"满"）
CORNER_R = 0.225             # 圆角半径（占画布比例，系统图标常见 22%~24%）


def smooth(e0, e1, x):
    t = (x - e0) / (e1 - e0) if e1 != e0 else 0
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return t * t * (3 - 2 * t)


def mouth_skeleton(apx, aw, ah):
    """从原图里把那条「w」形嘴的中心线抽出来（按列取暗像素的中点）。
    直接描这条线，比自己画弧像得多 —— 猫的嘴是有形状的，不是一段弧。"""
    pts = []
    for x in range(int(MOUTH_CX - 62), int(MOUTH_CX + 62)):
        ys = []
        for y in range(int(MOUTH_CY - 30), int(MOUTH_CY + 18)):
            i = (y * aw + x) * 4
            lum = (apx[i] * 299 + apx[i + 1] * 587 + apx[i + 2] * 114) // 1000
            if lum < 150 and apx[i + 3] > 90:
                ys.append(y)
        if len(ys) >= 3:
            pts.append((x, (min(ys) + max(ys)) / 2.0))
    return pts


def draw_coin(px, w, h, scale, ox, oy, ax0, ay0, mouth_art):
    """在原图上画金币。所有坐标先按 icon 缩放走一遍（ax0/ay0 是裁剪原点）。"""
    cx = (MOUTH_CX + COIN_DX - ax0) * scale + ox
    cy = (COIN_CY - ay0) * scale + oy
    r = COIN_R * scale
    ring = STROKE * scale * 0.9
    bite_w = STROKE * scale * 0.95 if DRAW_MOUTH_LINE else 0.0
    reach = int(r + ring + 3)

    # 嘴线（画布坐标）：按缩放搬到金币上
    path = [((ax - ax0) * scale + ox, (ay - ay0) * scale + oy) for ax, ay in mouth_art]

    # 唇线函数：金币只在唇线**以下**才画出来 —— 金币的上边缘就是猫的嘴
    # （画一整个圆压在脸上，不管怎么调都像个金色鼻子）
    def lip_y(x):
        if not path:
            return cy
        if x <= path[0][0]:
            (xa, ya), (xb, yb) = path[0], path[min(4, len(path) - 1)]
        elif x >= path[-1][0]:
            (xa, ya), (xb, yb) = path[max(0, len(path) - 5)], path[-1]
        else:
            k = 0
            while k + 1 < len(path) and path[k + 1][0] < x:
                k += 1
            (xa, ya), (xb, yb) = path[k], path[k + 1]
        if xb == xa:
            return ya
        return ya + (yb - ya) * (x - xa) / (xb - xa)

    x0, x1 = max(0, int(cx - reach)), min(w, int(cx + reach) + 1)
    y0, y1 = max(0, int(cy - reach)), min(h, int(cy + reach) + 1)
    for y in range(y0, y1):
        for x in range(x0, x1):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            # 椭圆 = 有透视的硬币；正圆贴在脸上永远像贴纸
            d = math.hypot(dx, dy / COIN_SQUASH)
            cover = 1.0 - smooth(r + ring - 1.0, r + ring + 1.0, d)   # 外轮廓抗锯齿
            if cover <= 0.002:
                continue
            # 唇线以上不画，露出猫脸；但只在“嘴的宽度范围内”裁 —— 嘴两侧让币顶露出来，
            # 这样看到的是「嘴唇咬进金币里」，而不是「金币被切掉一半」
            if abs(x + 0.5 - (MOUTH_CX - ax0) * scale - ox) < CLIP_HALF_W * scale:
                cover *= smooth(-1.2, 1.2, (y + 0.5) - lip_y(x))
            if cover <= 0.002:
                continue
            if d > r:
                col = list(LINE)                                      # 描边
            else:
                sh = 1.0 - smooth(r * 0.22, r * 0.62,
                                  math.hypot(dx + r * 0.30, (dy + r * 0.26) / COIN_SQUASH))
                dk = smooth(r * 0.62, r * 1.04,
                            math.hypot(dx - r * 0.26, (dy - r * 0.30) / COIN_SQUASH))
                col = []
                for i in range(3):
                    c = GOLD[i]
                    c = c + (GOLD_HI[i] - c) * sh * 0.50
                    c = c + (GOLD_LO[i] - c) * dk * 0.40
                    col.append(c)
                # 内圈币沿：一圈稍深的金线，是「这是硬币」而不是「这是个球」的关键
                rim_d = abs(d - r * 0.80)
                if rim_d < r * 0.05:
                    k = 1.0 - rim_d / (r * 0.05)
                    for i in range(3):
                        col[i] = col[i] + (GOLD_LO[i] - col[i]) * k * 0.85
            # 咬合线（画在金币上，等于上下唇卡住它）
            bd = min(math.hypot(x + 0.5 - px_, y + 0.5 - py_) for px_, py_ in path) if bite_w > 0 else 1e9
            if bd < bite_w / 2 + 1.0:
                k = 1.0 - smooth(bite_w / 2 - 1.0, bite_w / 2 + 1.0, bd)
                for i in range(3):
                    col[i] = col[i] + (LINE[i] - col[i]) * k
            i = (y * w + x) * 4
            for k2 in range(3):
                px[i + k2] = int(px[i + k2] * (1 - cover) + col[k2] * cover)
            if px[i + 3] < 255:
                px[i + 3] = max(px[i + 3], int(255 * cover))

    # 最后描一遍唇线（不裁），让它像猫的嘴一样压在金币上边缘
    if bite_w > 0 and path:
        sx0 = max(0, int(min(p[0] for p in path) - bite_w))
        sx1 = min(w, int(max(p[0] for p in path) + bite_w) + 1)
        sy0 = max(0, int(min(p[1] for p in path) - bite_w))
        sy1 = min(h, int(max(p[1] for p in path) + bite_w) + 1)
        for y in range(sy0, sy1):
            for x in range(sx0, sx1):
                bd = min(math.hypot(x + 0.5 - px_, y + 0.5 - py_) for px_, py_ in path)
                k = 1.0 - smooth(bite_w / 2 - 1.0, bite_w / 2 + 1.0, bd)
                if k <= 0.004:
                    continue
                i = (y * w + x) * 4
                for c in range(3):
                    px[i + c] = int(px[i + c] * (1 - k) + LINE[c] * k)
    return (x0, y0, x1, y1)


def resample(src, sw, sh, dw, dh):
    """面积平均缩放（缩小时质量最好，放大时退化为双线性）"""
    dst = bytearray(dw * dh * 4)
    xr = sw / dw
    yr = sh / dh
    for y in range(dh):
        fy0, fy1 = y * yr, (y + 1) * yr
        for x in range(dw):
            fx0, fx1 = x * xr, (x + 1) * xr
            r = g = b = a = 0.0
            tot = 0.0
            yy = int(fy0)
            while yy < fy1 and yy < sh:
                wy = min(fy1, yy + 1) - max(fy0, yy)
                if wy <= 0:
                    yy += 1
                    continue
                xx = int(fx0)
                while xx < fx1 and xx < sw:
                    wx = min(fx1, xx + 1) - max(fx0, xx)
                    if wx > 0:
                        i = (yy * sw + xx) * 4
                        wgt = wx * wy
                        r += src[i] * wgt
                        g += src[i + 1] * wgt
                        b += src[i + 2] * wgt
                        a += src[i + 3] * wgt
                        tot += wgt
                    xx += 1
                yy += 1
            i = (y * dw + x) * 4
            if tot <= 0:
                continue
            dst[i] = int(r / tot)
            dst[i + 1] = int(g / tot)
            dst[i + 2] = int(b / tot)
            dst[i + 3] = int(a / tot)
    return dst


def round_mask(px, size, pad_ratio=0.035, rad_ratio=0.235):
    """圆角方形蒙版，形状与旧图标一致"""
    pad = size * pad_ratio
    w = size - 2 * pad
    r = size * rad_ratio
    cx = cy = size / 2
    for y in range(size):
        for x in range(size):
            qx = abs(x + 0.5 - cx) - (w / 2 - r)
            qy = abs(y + 0.5 - cy) - (w / 2 - r)
            ox, oy = max(qx, 0), max(qy, 0)
            d = math.hypot(ox, oy) + min(max(qx, qy), 0) - r
            a = 1.0 - smooth(-1.0, 1.0, d)
            i = (y * size + x) * 4
            px[i + 3] = int(px[i + 3] * a)


def content_box(px, w, h, thr=245, pad_ratio=0.02):
    """自动找内容包围盒（含胡须、尾巴），换尺寸/换母图都不用改常量。"""
    xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            i = (y * w + x) * 4
            if (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) // 1000 < thr:
                xs.append(x)
                ys.append(y)
    pad = int(pad_ratio * max(w, h))
    return (max(0, min(xs) - pad), max(0, min(ys) - pad),
            min(w, max(xs) + pad + 1), min(h, max(ys) + pad + 1))


def build_master(art_path, size=512):
    aw, ah, apx = read_png(art_path)
    box = content_box(apx, aw, ah)
    bw, bh = box[2] - box[0], box[3] - box[1]
    target = size * FILL
    scale = min(target / bw, target / bh)
    dw, dh = int(bw * scale), int(bh * scale)

    # 先裁再缩，只在 1024→更小的方向上重采样，不出糊边
    crop = bytearray(bw * bh * 4)
    for y in range(bh):
        sy = box[1] + y
        si = (sy * aw + box[0]) * 4
        crop[y * bw * 4:(y + 1) * bw * 4] = apx[si:si + bw * 4]
    cat = resample(crop, bw, bh, dw, dh)

    canvas = bytearray(size * size * 4)
    for i in range(size * size):
        canvas[i * 4] = 255
        canvas[i * 4 + 1] = 255
        canvas[i * 4 + 2] = 255
        canvas[i * 4 + 3] = 255
    ox = (size - dw) // 2
    oy = int(size * VBIAS) - dh // 2   # 视觉重心：猫脸略偏上，下边留一点呼吸
    for y in range(dh):
        si = y * dw * 4
        di = ((oy + y) * size + ox) * 4
        canvas[di:di + dw * 4] = cat[si:si + dw * 4]

    if DRAW_COIN:
        mouth_art = mouth_skeleton(apx, aw, ah)
        draw_coin(canvas, size, size, scale, ox, oy, box[0], box[1], mouth_art)

    round_mask(canvas, size, EDGE_PAD, CORNER_R)
    return size, canvas


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    art = args[0]
    install = '--install' in sys.argv
    size, master = build_master(art, 512)
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icon_src')
    os.makedirs(out_dir, exist_ok=True)
    write_png(os.path.join(out_dir, 'icon_master_512.png'), size, size, master)
    print('master 512 已生成')
    for s in (192, 96, 48):
        write_png(os.path.join(out_dir, f'icon_preview_{s}.png'),
                  s, s, resample(master, size, size, s, s))
    print('预览 192/96/48 已生成')
    if install:
        targets = [('mipmap-mdpi', 48), ('mipmap-hdpi', 72), ('mipmap-xhdpi', 96),
                   ('mipmap-xxhdpi', 144), ('mipmap-xxxhdpi', 192)]
        res = r'D:/小账本/app/res'
        for folder, s in targets:
            p = os.path.join(res, folder, 'ic_launcher.png')
            write_png(p, s, s, resample(master, size, size, s, s))
            print(f'{folder}/ic_launcher.png {s}x{s} → {os.path.getsize(p)} bytes')


if __name__ == '__main__':
    main()
