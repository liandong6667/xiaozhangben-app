# -*- coding: utf-8 -*-
"""给小猫图加一枚「像素风金币」，重点是层次感（不是把贴纸糊嘴上）。

思路（从后到前）：
  1. 围巾 / 脸颊上投一层柔和投影     -> 金币浮起来，不是平的
  2. 金币本体（棕边 + 金色环 + ¥ 符号，照用户给的像素币）
  3. 币顶被下唇咬住的「缺口」+ 唇线压在币上 -> 咬合关系
  4. 咬合处的接触阴影               -> 币和嘴贴住的暗部
"""
import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngutil import read_png, write_png
from make_cat_icon import resample, round_mask, content_box

ART = r"D:/小账本/.build/icon_src/cat_orig.png"

# ---- 参考币的配色（从用户给的像素图取的）----
RIM   = (113, 62, 45)     # #713E2D 棕描边
G_HI  = (254, 254, 182)   # #FEFEB6 高光
G_L1  = (255, 226, 109)   # #FFE26D 亮金
G_L2  = (254, 206, 70)    # #FECE46 中金
G_D1  = (253, 195, 36)    # #FDC324 深金
G_D2  = (235, 167, 70)    # #EBA746 暗面

# ---- 猫脸的几何（1080 母图上量的）----
MOUTH_CX, MOUTH_CY = 462, 575
LIP_BOTTOM = 592          # 嘴线最低点
LINE_W = 12               # 猫的描边粗细


def smooth(e0, e1, x):
    if e0 == e1:
        return 1.0 if x >= e1 else 0.0
    t = (x - e0) / (e1 - e0)
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return t * t * (3 - 2 * t)


def blend(px, w, x, y, col, a):
    if a <= 0.002 or not (0 <= x < w):
        return
    i = (y * w + x) * 4
    px[i]     = int(px[i] * (1 - a) + col[0] * a)
    px[i + 1] = int(px[i + 1] * (1 - a) + col[1] * a)
    px[i + 2] = int(px[i + 2] * (1 - a) + col[2] * a)


def blur_into(dst, w, h, src, rad):
    """把 src（float alpha 层）做半径 rad 的箱型模糊，叠加到 dst 上"""
    if rad <= 0:
        for y in range(h):
            for x in range(w):
                a = src[y * w + x]
                if a > 0.002:
                    blend(dst, w, x, y, RIM, a * 0.20)
        return
    tmp = [0.0] * (w * h)
    for y in range(h):
        row = y * w
        acc = 0.0
        for x in range(-rad, w + rad):
            if 0 <= x < w:
                acc += src[row + x]
            if x - rad - 1 >= 0:
                acc -= src[row + x - rad - 1]
            if 0 <= x - rad < w:
                tmp[row + x - rad] = acc / (2 * rad + 1)
    out = [0.0] * (w * h)
    for x in range(w):
        acc = 0.0
        for y in range(-rad, h + rad):
            if 0 <= y < h:
                acc += tmp[y * w + x]
            if y - rad - 1 >= 0:
                acc -= tmp[(y - rad - 1) * w + x]
            if 0 <= y - rad < h:
                out[(y - rad) * w + x] = acc / (2 * rad + 1)
    for y in range(h):
        for x in range(w):
            a = out[y * w + x]
            if a > 0.002:
                blend(dst, w, x, y, RIM, a * 0.20)


def glyph_yen(u, v, r, th):
    """¥ 符号：两条斜杠 + 竖 + 两道横杠。u,v 是币本地坐标（已去旋转）"""
    hw = 0.40 * r          # 斜杠起点横向半宽
    d1 = math.hypot(u - 0, v - (-0.02 * r))  # 汇聚点
    # 斜杠：从 (±hw, -0.56r) 到 (0, -0.02r)
    best = 9e9
    for sx in (-1, 1):
        ax, ay = sx * hw, -0.56 * r
        bx, by = 0.0, -0.02 * r
        vx, vy = bx - ax, by - ay
        t = ((u - ax) * vx + (v - ay) * vy) / (vx * vx + vy * vy)
        t = max(0.0, min(1.0, t))
        px_, py_ = ax + vx * t, ay + vy * t
        best = min(best, math.hypot(u - px_, v - py_))
    # 竖杠
    best = min(best, math.hypot(u - 0, v - max(-0.02 * r, min(0.60 * r, v))))
    # 两道横杠
    for hy in (0.14 * r, 0.40 * r):
        best = min(best, math.hypot(max(-0.34 * r, min(0.34 * r, u)) - u, v - hy))
    return best < th


def draw_coin(px, W, H, cx, cy, r, ang, bit=None):
    """画金币本体（不含投影）。bit=None 为平滑版，bit=n 时用 n×n 像素格"""
    ca, sa = math.cos(ang), math.sin(ang)
    rim = max(2.0, r * 0.085)
    th = max(1.5, r * 0.085)          # ¥ 笔画粗细
    x0, x1 = int(cx - r - 4), int(cx + r + 5)
    y0, y1 = int(cy - r - 4), int(cy + r + 5)
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy

            if bit:
                # 像素版：先把坐标吸附到 n×n 网格中心
                u0 = dx * ca + dy * sa
                v0 = -dx * sa + dy * ca
                step = (2 * r) / bit
                gi = math.floor((u0 + r) / step)
                gj = math.floor((v0 + r) / step)
                u = (gi + 0.5) * step - r
                v = (gj + 0.5) * step - r
                ccx, ccy = u * ca - v * sa, u * sa + v * ca
                lim = step * 0.5 * 1.02
                cover = 1.0 - smooth(lim - 0.6, lim + 0.6, max(abs(dx - ccx), abs(dy - ccy)))
                d = math.hypot(u, v)
                if d > r - rim * 0.15:          # 方块中心落在圆外就不画
                    cover = 0.0
            else:
                u = dx * ca + dy * sa
                v = -dx * sa + dy * ca
                d = math.hypot(u, v)
                cover = 1.0 - smooth(r - 1.0, r + 1.0, d)

            if cover <= 0.003:
                continue

            if d > r - rim:
                col = RIM
            elif d > r - rim * 2.1:
                col = G_D1
            else:
                if glyph_yen(u, v, r, th):
                    col = RIM
                else:
                    # 右上亮、左下暗
                    L = (-u - v) / (1.35 * r)          # -1..1
                    L = max(-1.0, min(1.0, L))
                    if L > 0:
                        t = L
                        col = tuple(G_L2[i] + (G_L1[i] - G_L2[i]) * t for i in range(3))
                        if L > 0.82:
                            col = tuple(col[i] + (G_HI[i] - col[i]) * (L - 0.82) / 0.18 * 0.9 for i in range(3))
                    else:
                        t = -L
                        col = tuple(G_L2[i] + (G_D2[i] - G_L2[i]) * t * 0.95 for i in range(3))

            blend(px, W, x, y, [int(c) for c in col], cover)
    return rim


def lip_mask(apx, aw, ah, x0=392, x1=540, y0=536, y1=604, thr=170):
    """把原图嘴线的暗像素抓出来（画完金币再盖回去 = 嘴唇压在币前面）"""
    out = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            i = (y * aw + x) * 4
            lum = (apx[i] * 299 + apx[i + 1] * 587 + apx[i + 2] * 114) // 1000
            if lum < thr:
                out.append((x, y, apx[i], apx[i + 1], apx[i + 2]))
    return out


def draw_ao(px, W, H, cx, cy, r, ang):
    """金币边上的接触阴影（环境光遮蔽）：币外的暗环，让币真的“浮”在脸/围巾上"""
    out = int(r * 0.22) + 2
    for y in range(max(0, int(cy - r - out)), min(H, int(cy + r + out) + 1)):
        for x in range(max(0, int(cx - r - out)), min(W, int(cx + r + out) + 1)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= r - 0.5:
                continue
            t = (d - r) / (out * 0.9)
            a = 0.34 * (1.0 - smooth(0.0, 1.0, t))
            if a > 0.004:
                blend(px, W, x, y, (95, 62, 45), a)


def draw_mouth_patch(px, W, H, mx, my, rx, ry):
    """张开的小嘴：深色口腔。金币从里面探出来 = 最明确的“咬着”"""
    col = (74, 74, 74)
    for y in range(int(my - ry - 4), int(my + ry + 5)):
        for x in range(int(mx - rx - 4), int(mx + rx + 5)):
            if not (0 <= x < W and 0 <= y < H):
                continue
            u = (x + 0.5 - mx) / rx
            v = (y + 0.5 - my) / ry
            d = math.hypot(u, v)
            a = 1.0 - smooth(0.94, 1.04, d)
            if a > 0.004:
                blend(px, W, x, y, col, a)


def make(art, size=512, cx=470, cy=680, r=88, ang=-0.10, notch=True,
         bit=None, shadow=True, notch_h=16.0, notch_hw=44.0, out=None,
         lip_over=False, ao=True, mouth=None, mouth_outline=True, erase_lip=None):
    aw, ah, apx = read_png(art)
    box = content_box(apx, aw, ah)
    bw, bh = box[2] - box[0], box[3] - box[1]
    target = size * 0.87
    scale = min(target / bw, target / bh)
    dw, dh = int(bw * scale), int(bh * scale)
    crop = bytearray(bw * bh * 4)
    for y in range(bh):
        si = ((box[1] + y) * aw + box[0]) * 4
        crop[y * bw * 4:(y + 1) * bw * 4] = apx[si:si + bw * 4]
    cat = resample(crop, bw, bh, dw, dh)
    canvas = bytearray([255] * (size * size * 4))
    ox = (size - dw) // 2
    oy = int(size * 0.47) - dh // 2
    for y in range(dh):
        di = ((oy + y) * size + ox) * 4
        canvas[di:di + dw * 4] = cat[y * dw * 4:(y + 1) * dw * 4]

    # ---- 换算到成品坐标 ----
    sc = scale
    CX = (cx - box[0]) * sc + ox
    CY = (cy - box[1]) * sc + oy
    R = r * sc
    LIP = (LIP_BOTTOM - box[1]) * sc + oy
    LW = LINE_W * sc

    # ---- 1. 投影（落在围巾上，右下偏移）----
    if shadow:
        layer = [0.0] * (size * size)
        shx, shy = 6 * sc, 10 * sc
        for y in range(max(0, int(CY - R)), min(size, int(CY + R) + 2)):
            for x in range(max(0, int(CX - R)), min(size, int(CX + R) + 2)):
                d = math.hypot(x + 0.5 - CX - shx, y + 0.5 - CY - shy)
                if d < R:
                    layer[y * size + x] = 1.0 - smooth(R - 2, R + 2, d)
        blur_into(canvas, size, size, layer, max(3, int(7 * sc)))

    # ---- 2. 金币 ----
    if erase_lip:
        ex0, ey0, ex1, ey1 = erase_lip
        for y in range(int((ey0 - box[1]) * sc) + oy, int((ey1 - box[1]) * sc) + oy):
            for x in range(int((ex0 - box[0]) * sc) + ox, int((ex1 - box[0]) * sc) + ox):
                if 0 <= x < size and 0 <= y < size:
                    i = (y * size + x) * 4
                    canvas[i] = canvas[i + 1] = canvas[i + 2] = 255

    rimw = draw_coin(canvas, size, size, CX, CY, R, ang, bit)

    # ---- 2.2 接触阴影（币外一圈暗）----
    if ao:
        draw_ao(canvas, size, size, CX, CY, R, ang)

    # ---- 2.3 张开的小嘴（盖住币的上半，币就像从嘴里探出来）----
    if mouth:
        mx, my, rx, ry = mouth
        draw_mouth_patch(canvas, size, size,
                         (mx - box[0]) * sc + ox, (my - box[1]) * sc + oy,
                         rx * sc, ry * sc)

    # ---- 2.5 嘴唇压回币前（咬合的关键：嘴线在币上，说明唇在前面）----
    if lip_over:
        lips = lip_mask(apx, aw, ah)
        rad = max(1, int(round(LINE_W * sc / 2)))
        for (ax, ay, r_, g_, b_) in lips:
            sx = int((ax - box[0]) * sc) + ox
            sy = int((ay - box[1]) * sc) + oy
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    if dx * dx + dy * dy > rad * rad + 1:
                        continue
                    X, Y = sx + dx, sy + dy
                    if 0 <= X < size and 0 <= Y < size:
                        d = math.hypot(X + 0.5 - CX, Y + 0.5 - CY)
                        a = 1.0 if d < R else 0.0
                        if a:
                            i = (Y * size + X) * 4
                            canvas[i] = r_
                            canvas[i + 1] = g_
                            canvas[i + 2] = b_

    # ---- 3. 咬合缺口：把币顶压进下唇以下，并用唇线补上 ----
    if notch:
        top = CY - R
        for y in range(int(top - 2), int(LIP + notch_h) + 3):
            if not (0 <= y < size):
                continue
            for x in range(int(CX - notch_hw * sc) - 2, int(CX + notch_hw * sc) + 3):
                if not (0 <= x < size):
                    continue
                t = (x - CX) / (notch_hw * sc)          # -1..1
                if abs(t) > 1:
                    continue
                cut = LIP + notch_h * sc * (1 - t * t)  # 中间切得深，两边回到唇线
                if y < cut:
                    i = (y * size + x) * 4
                    # 只清金币覆盖区（白底区域保持原样）
                    canvas[i:i + 3] = b"\xff\xff\xff"
        # 缺口边缘补一条唇线
        for x in range(int(CX - notch_hw * sc) - 2, int(CX + notch_hw * sc) + 3):
            t = max(-1.0, min(1.0, (x - CX) / (notch_hw * sc)))
            cy_ = LIP + notch_h * sc * (1 - t * t)
            for dy in range(int(-LW / 2) - 1, int(LW / 2) + 2):
                y = int(cy_) + dy
                if 0 <= y < size and 0 <= x < size:
                    a = 1.0 - smooth(LW * 0.42, LW * 0.52, abs(dy))
                    blend(canvas, size, x, y, (73, 73, 73), a)

    # ---- 4. 接触阴影：唇线下方一道浅浅的暗 ----
    for x in range(int(CX - notch_hw * sc) - 2, int(CX + notch_hw * sc) + 3):
        t = max(-1.0, min(1.0, (x - CX) / (notch_hw * sc)))
        cy_ = LIP + notch_h * sc * (1 - t * t)
        for dy in range(2, int(LW * 1.1) + 2):
            y = int(cy_) + dy
            if 0 <= y < size and 0 <= x < size:
                a = (1.0 - dy / (LW * 1.2)) * 0.30
                if a > 0:
                    blend(canvas, size, x, y, (120, 80, 55), a)

    round_mask(canvas, size)
    if out:
        write_png(out, size, size, canvas)
    return size, canvas


if __name__ == "__main__":
    S = 320
    outs = []
    # (名字, 参数)
    tests = [
        ("a_top_lip",  dict(cx=470, cy=680, r=88, ang=-0.10, notch=False)),
        ("b_notch",    dict(cx=470, cy=680, r=88, ang=-0.10, notch=True)),
        ("c_tilt",     dict(cx=492, cy=672, r=88, ang=-0.26, notch=True)),
        ("d_big",      dict(cx=470, cy=700, r=104, ang=-0.12, notch=True, notch_h=20, notch_hw=52)),
    ]
    for name, kw in tests:
        make(ART, 512, out=f"D:/小账本/.build/icon_src/coin_{name}.png", **kw)
        print("ok", name)
