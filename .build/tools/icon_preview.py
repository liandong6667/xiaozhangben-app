"""按**真机实测**的遮罩参数预览图标大小，横向对比几档。

2026-10-27 用标尺图量出来的事实（别再凭想象调参数）：
  · 自适应图标的前景画布是 108dp
  · 系统只显示中间 72dp 那一块（= 画布的 66.7%），画布最外圈完全不可见
  · 遮罩是圆角方形，圆角半径约为可见边长的 25%
所以「桌面上猫占多大」= FIT_H / 0.667，跟 FIT_H 本身不是一回事。
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngutil import write_png
from make_cat_icon import resample
import make_adaptive_icon as M

ART = '../icon_src/cat_orig_clean.png'
OUT = '../icon_src'
STEPS = [0.42, 0.48, 0.54, 0.62, 0.70]
VISIBLE = 0.6667      # 可见区占画布的比例（实测）
CORNER = 0.25         # 圆角半径占可见边长的比例（实测）
TILE = 132            # 对比图每格边长


def squircle(px, size, rad_ratio, bg):
    r = size * rad_ratio
    for y in range(size):
        for x in range(size):
            qx = abs(x - (size - 1) / 2) - (size / 2 - r)
            qy = abs(y - (size - 1) / 2) - (size / 2 - r)
            d = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r
            a = 1.0 if d <= -1 else (0.0 if d >= 1 else (1 - d) / 2)
            i = (y * size + x) * 4
            for c in range(3):
                px[i + c] = int(px[i + c] * a + bg[c] * (1 - a))
            px[i + 3] = 255


def main():
    size = 432
    tiles = []
    for f in STEPS:
        M.FIT_H = f
        _, fg, info = M.build_foreground(ART, size)
        # 白底合成（背景层）
        img = bytearray(b'\xff\xff\xff\xff' * (size * size))
        for i in range(size * size):
            a = fg[i * 4 + 3]
            if a:
                k = a / 255.0
                for c in range(3):
                    img[i * 4 + c] = int(fg[i * 4 + c] * k + 255 * (1 - k))
        # 只取中间 66.7%（画布最外圈系统不显示）
        v = int(round(size * VISIBLE))
        off = (size - v) // 2
        cut = bytearray(v * v * 4)
        for y in range(v):
            si = ((off + y) * size + off) * 4
            cut[y * v * 4:(y + 1) * v * 4] = img[si:si + v * 4]
        squircle(cut, v, CORNER, (250, 250, 250))    # 圆角 + 桌面色
        small = resample(cut, v, v, TILE, TILE)
        tiles.append(small)
        share = f / VISIBLE * 100
        print('FIT_H=%.2f → 桌面上猫高约占图标 %.0f%%' % (f, share))

    gap = 18
    w = len(STEPS) * TILE + (len(STEPS) + 1) * gap
    h = TILE + gap * 2
    sheet = bytearray(b'\xf2\xf0\xec\xff' * (w * h))
    for k, small in enumerate(tiles):
        ox = gap + k * (TILE + gap)
        for y in range(TILE):
            for x in range(TILE):
                si = (y * TILE + x) * 4
                di = ((gap + y) * w + ox + x) * 4
                sheet[di:di + 4] = small[si:si + 4]
    write_png(os.path.join(OUT, 'size_compare.png'), w, h, sheet)
    print('对比图 size_compare.png')


if __name__ == '__main__':
    main()
