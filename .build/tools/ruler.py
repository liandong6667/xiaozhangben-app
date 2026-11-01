"""临时把图标前景换成标尺，量出启动器实际显示多大一块画布。

自适应图标规定前景是 108dp 画布、72dp 是"保证不被裁"的安全区，但各家
启动器遮罩大小不同（OPPO 明显不是正好 72dp）。靠猜必然调不对，所以画几个
已知半径的同心圆，装到手机上一截图就能量出真实可见范围。

用法：
  python ruler.py out            # 写标尺前景到 res（覆盖正式图，用完必须重装正式版）
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngutil import write_png

SIZE = 432
DENS = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0}


def ring(px, size, r, color, w=3):
    cx = cy = (size - 1) / 2.0
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if abs(d - r) <= w:
                i = (y * size + x) * 4
                px[i:i + 4] = bytes(color)


def build(size):
    px = bytearray(size * size * 4)
    k = size / 432.0
    # 108dp 画布边界（=100%）：红
    for i in range(size):
        for t in range(max(1, int(3 * k))):
            for (x, y) in ((i, t), (i, size - 1 - t)):
                px[(y * size + x) * 4:(y * size + x) * 4 + 4] = b'\xff\x00\x00\xff'
            for (x, y) in ((t, i), (size - 1 - t, i)):
                px[(y * size + x) * 4:(y * size + x) * 4 + 4] = b'\xff\x00\x00\xff'
    # 官方安全区 72dp = 直径 66.7% 画布：蓝
    ring(px, size, size * 0.3333, (0, 90, 255, 255), max(2, int(3 * k)))
    # 86dp：绿      (OPPO 若显示到这里，说明遮罩比官方大)
    ring(px, size, size * (86 / 216.0), (0, 170, 60, 255), max(2, int(3 * k)))
    # 100dp：紫
    ring(px, size, size * (100 / 216.0), (160, 0, 200, 255), max(2, int(3 * k)))
    return size, px


def main():
    res = 'D:/小账本/app/res'
    for name, k in DENS.items():
        # 前景层固定 108dp，各密度只是像素数不同，比例保持一致
        px_size = int(round(108 * k))
        _, img = build(px_size)
        folder = os.path.join(res, 'drawable-' + name)
        p = os.path.join(folder, 'ic_launcher_foreground.png')
        write_png(p, px_size, px_size, img)
        print('标尺 %s %dx%d' % (name, px_size, px_size))


if __name__ == '__main__':
    main()
