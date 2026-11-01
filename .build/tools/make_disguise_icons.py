"""生成「换个样子」用的图标：计算器 / 备忘录。

## 为什么要自己画

本机装不上 Pillow（没网），`.build/tools/pngutil.py` 只有极简 PNG 读写。
所以这里自己光栅化：**按 4 倍超采样画，再降采样**，边缘才有抗锯齿。

## 产物

每种样式两套，跟现有 ic_launcher 一个规格：
- `mipmap-{mdpi..xxxhdpi}/ic_<key>.png`  —— legacy 方块图（Android 7.x 兜底）
- `drawable-{mdpi..xxxhdpi}/ic_<key>_fg.png` —— 自适应前景层（108dp 画布，透明底）
- `mipmap-anydpi-v26/ic_<key>.xml` + `values/colors.xml` 里的背景色

## 前景为什么不能画满

自适应图标 108dp 画布里，**最外圈根本不可见**，系统只露中间 72dp
（2026-10-27 用 ruler.py 在真机上量过）。所以图案控制在中心 60% 以内，
任何遮罩（圆 / 方圆 / 方）都不会切到。

用法：
  python make_disguise_icons.py            # 写进 app/res/
  python make_disguise_icons.py --dry      # 只在 .build/_icon_prev 出预览
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngutil import write_png

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # D:/小账本
RES = os.path.join(HERE, "app", "res")

SS = 4  # 超采样倍数

DENS = [("mdpi", 1.0), ("hdpi", 1.5), ("xhdpi", 2.0), ("xxhdpi", 3.0), ("xxxhdpi", 4.0)]

# 各款式：背景色（自适应背景层 & legacy 底色）、前景主色
STYLES = {
    "calc": dict(bg=(0x37, 0x47, 0x4F), fg=(0xFF, 0xFF, 0xFF), acc=(0x9E, 0xD8, 0xC8)),
    "note": dict(bg=(0xF2, 0xC1, 0x4E), fg=(0xFF, 0xFF, 0xFF), acc=(0xB9, 0xA8, 0x8A)),
}


class Canvas:
    """RGBA 画布，坐标用归一化 0..1，画的时候自动乘尺寸。"""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = bytearray(w * h * 4)

    def _blend(self, x, y, col):
        i = (y * self.w + x) * 4
        p = self.px
        a = col[3] / 255.0
        if a >= 0.999:
            p[i], p[i + 1], p[i + 2], p[i + 3] = col[0], col[1], col[2], 255
            return
        for k in range(3):
            p[i + k] = int(col[k] * a + p[i + k] * (1 - a) + 0.5)
        p[i + 3] = min(255, int(col[3] + p[i + 3] * (1 - a) + 0.5))

    def rrect(self, x0, y0, x1, y1, r, col):
        """圆角矩形，坐标归一化。"""
        W, H = self.w, self.h
        ax, ay, bx, by = x0 * W, y0 * H, x1 * W, y1 * H
        rr = r * min(W, H)
        rr = max(0.0, min(rr, (bx - ax) / 2.0, (by - ay) / 2.0))
        for y in range(int(ay), int(by) + 1):
            if y < 0 or y >= H:
                continue
            for x in range(int(ax), int(bx) + 1):
                if x < 0 or x >= W:
                    continue
                # 到圆角中心的距离
                dx = 0.0
                if x < ax + rr:
                    dx = ax + rr - x
                elif x > bx - rr:
                    dx = x - (bx - rr)
                dy = 0.0
                if y < ay + rr:
                    dy = ay + rr - y
                elif y > by - rr:
                    dy = y - (by - rr)
                if dx or dy:
                    if (dx * dx + dy * dy) ** 0.5 > rr:
                        continue
                self._blend(x, y, col)

    def disc(self, cx, cy, r, col):
        W, H = self.w, self.h
        px, py, pr = cx * W, cy * H, r * min(W, H)
        for y in range(int(py - pr), int(py + pr) + 1):
            if y < 0 or y >= H:
                continue
            for x in range(int(px - pr), int(px + pr) + 1):
                if x < 0 or x >= W:
                    continue
                if (x - px) ** 2 + (y - py) ** 2 <= pr * pr:
                    self._blend(x, y, col)

    def down(self, factor):
        """盒式降采样（超采样 → 抗锯齿）。"""
        w, h = self.w // factor, self.h // factor
        out = bytearray(w * h * 4)
        for y in range(h):
            for x in range(w):
                r = g = b = a = 0
                for dy in range(factor):
                    base = ((y * factor + dy) * self.w + x * factor) * 4
                    for dx in range(factor):
                        i = base + dx * 4
                        al = self.px[i + 3]
                        r += self.px[i] * al
                        g += self.px[i + 1] * al
                        b += self.px[i + 2] * al
                        a += al
                o = (y * w + x) * 4
                if a:
                    out[o] = min(255, r // a)
                    out[o + 1] = min(255, g // a)
                    out[o + 2] = min(255, b // a)
                out[o + 3] = min(255, a // (factor * factor))
        return w, h, out


def draw_calc(c):
    """计算器：白机身 + 浅绿屏幕 + 九颗深色按键。"""
    s = STYLES["calc"]
    key = s["bg"] + (255,)          # 按键用底色，白机身上才看得见
    acc = s["acc"] + (255,)
    body = (0xFF, 0xFF, 0xFF, 255)
    c.rrect(0.20, 0.14, 0.80, 0.86, 0.09, body)          # 机身
    c.rrect(0.26, 0.20, 0.74, 0.38, 0.045, acc)          # 屏幕
    # 3 列 × 3 行按键
    for row in range(3):
        for col in range(3):
            x0 = 0.27 + col * 0.165
            y0 = 0.44 + row * 0.135
            c.rrect(x0, y0, x0 + 0.115, y0 + 0.085, 0.03, key)


def draw_note(c):
    """备忘录：白纸 + 三条横线 + 左上角折角。"""
    s = STYLES["note"]
    acc = s["acc"] + (255,)
    paper = (0xFF, 0xFF, 0xFF, 255)
    c.rrect(0.21, 0.15, 0.79, 0.85, 0.08, paper)
    for i in range(3):
        y = 0.31 + i * 0.16
        x1 = 0.72 if i < 2 else 0.58
        c.rrect(0.29, y, x1, y + 0.062, 0.031, acc)


def build(key, px_size, foreground):
    """画一张。foreground=True 时不铺底色（自适应前景层要透明）。"""
    s = STYLES[key]
    canvas = Canvas(px_size * SS, px_size * SS)
    if not foreground:
        canvas.rrect(0.0, 0.0, 1.0, 1.0, 0.0, s["bg"] + (255,))
        # 自适应前景要把图案收进中心 60%，legacy 方块图可以稍大一点
        scale = 1.0
    else:
        scale = 1.0
    inner = Canvas(px_size * SS, px_size * SS)
    if key == "calc":
        draw_calc(inner)
    else:
        draw_note(inner)
    # 叠到主画布上；foreground 时把图案缩到中心区域
    if foreground:
        box = int(px_size * SS * 0.34)          # 居中 32%..68% 的位置留白
        side = px_size * SS - box * 2
        small = resize_nn(inner, side)
        blit(canvas, small, side, box)
    else:
        blit(canvas, inner.px, inner.w, 0)
    return canvas.down(SS)


def resize_nn(src, size):
    """最近邻缩放（src 是 Canvas，只取它的像素）。"""
    w, h, px = src.w, src.h, src.px
    out = bytearray(size * size * 4)
    for y in range(size):
        sy = min(h - 1, y * h // size)
        for x in range(size):
            sx = min(w - 1, x * w // size)
            si = (sy * w + sx) * 4
            oi = (y * size + x) * 4
            out[oi:oi + 4] = px[si:si + 4]
    return out


def blit(dst, src_px, src_w, offset):
    """把方形 src **按 alpha 合成**到 dst 的 (offset, offset)。

    注意：这里必须合成，不能整块 copy。前景画布大部分是透明的，
    直接 copy 会把已经铺好的底色一起擦成透明 —— 第一版就是这么翻的：
    出来的计算器只剩一张白纸，深色底全没了。
    """
    for y in range(src_w):
        for x in range(src_w):
            si = (y * src_w + x) * 4
            a = src_px[si + 3]
            if not a:
                continue
            dst._blend(x + offset, y + offset, src_px[si:si + 4])


def main():
    dry = "--dry" in sys.argv
    for key in STYLES:
        for dens, mult in DENS:
            lg = int(round(48 * mult))
            fgdp = int(round(108 * mult))
            if dry:
                os.makedirs(".build/_icon_prev", exist_ok=True)
                w, h, px = build(key, lg, False)
                write_png(".build/_icon_prev/%s_%d.png" % (key, lg), w, h, px)
                continue
            d1 = os.path.join(RES, "mipmap-" + dens)
            d2 = os.path.join(RES, "drawable-" + dens)
            os.makedirs(d1, exist_ok=True)
            os.makedirs(d2, exist_ok=True)
            w, h, px = build(key, lg, False)
            write_png(os.path.join(d1, "ic_%s.png" % key), w, h, px)
            w, h, px = build(key, fgdp, True)
            write_png(os.path.join(d2, "ic_%s_fg.png" % key), w, h, px)
            print("  %-6s %-8s legacy %dpx / fg %dpx" % (key, dens, lg, fgdp))

    if not dry:
        # 自适应图标 xml
        xml_dir = os.path.join(RES, "mipmap-anydpi-v26")
        os.makedirs(xml_dir, exist_ok=True)
        for key in STYLES:
            p = os.path.join(xml_dir, "ic_%s.xml" % key)
            open(p, "w", encoding="utf-8").write(
                '<?xml version="1.0" encoding="utf-8"?>\n'
                '<!-- 换样子用的自适应图标（%s）。背景纯色 + 透明前景，\n'
                '     图案收在中心 60%% 以内，圆/方圆/方任何遮罩都切不到。 -->\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@color/ic_%s_bg" />\n'
                '    <foreground android:drawable="@drawable/ic_%s_fg" />\n'
                '</adaptive-icon>\n' % (key, key, key))
            print("  写 mipmap-anydpi-v26/ic_%s.xml" % key)
        print("记得在 values/colors.xml 里加 ic_calc_bg / ic_note_bg")


if __name__ == "__main__":
    main()
