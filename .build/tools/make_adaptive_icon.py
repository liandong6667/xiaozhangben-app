"""生成 Android 自适应图标（adaptive icon）的前景层。

## 为什么要有这个脚本

原来只给了 legacy PNG（`mipmap-*/ic_launcher.png`，圆角方形白底 + 猫）。
Android 8 以后，启动器会把这种 legacy 图标当成"一整张图"，**再缩进自己
108dp 画布的安全区里**，然后套遮罩 —— 等于缩了两圈。桌面上量出来猫只剩
七成宽、五成高，用户一直在说"小猫太小了"。

自适应图标不会二次缩放：前景层按 108dp 原样铺满，只被遮罩裁。所以只要
把猫画大，桌面就真的大。

## 猫为什么只能按高度撑

母图内容框是横向构图（含胡子约 1.34:1）。按宽度撑满时纵向只用到 ~70%，
上下白一大截，这正是"看着小"的主因。改成按高度撑满，横向溢出的部分是
**胡子尖**，被遮罩裁掉不影响辨识。

用法：
  python make_adaptive_icon.py <母图.png>            # 出预览，不写 res
  python make_adaptive_icon.py <母图.png> --install  # 写进 app/res/drawable-*/
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngutil import read_png, write_png
from make_cat_icon import resample, content_box

FIT_H = 0.45        # 猫的高度占 108dp 前景画布的比例 —— 用户亲自定下的档位
# ↑ 这个数不是拍的，是三轮返工量出来的。2026-10-27 用标尺图（ruler.py）在真机量过：
#   · 108dp 画布的**最外圈根本不可见**，系统只显示中间 72dp（=画布 66.7%）
#   · 遮罩是圆角方形，可见区（白方块 168px）只占系统给的图标框（189px）的 89%
#   所以「猫占图标多大」和 FIT_H 差两层，不能直接换算。
#   实测对照（按图标框 189px 量）：
#     FIT_H=0.45 → 猫占白方块 62% 高、85% 宽，上下各留 32px、左右各 12px（对称）
#     FIT_H=0.70 → 占可见区 105%，耳朵尖被削、两侧被切
#   ✅ 0.45 是**最终定版**：2026-10-27 23:15 用户看到后说「手机重启之后那个挺好的」。
#   中途试过 0.53（想让它占图标框 2/3），被用户否掉 —— 别再往上调。
VB = 0.50           # 内容垂直中心（0.5 = 正中）

# 自适应图标前景层：108dp 画布
FOREGROUND_DP = 108
DENS = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0}


def build_foreground(art_path, size):
    """把母图内容按高度缩放铺到 size×size 的透明画布上，横向溢出居中裁掉。"""
    aw, ah, apx = read_png(art_path)
    x0, y0, x1, y1 = content_box(apx, aw, ah)
    bw, bh = x1 - x0, y1 - y0

    target_h = size * FIT_H
    scale = target_h / bh
    dw, dh = int(round(bw * scale)), int(round(bh * scale))

    # 先裁母图内容区，再一次性缩小 —— 避免二次重采样糊掉描边
    crop = bytearray(bw * bh * 4)
    for y in range(bh):
        si = ((y0 + y) * aw + x0) * 4
        crop[y * bw * 4:(y + 1) * bw * 4] = apx[si:si + bw * 4]
    cat = resample(crop, bw, bh, dw, dh)

    # 前景层必须透底：背景色由 <background> 那一层给
    canvas = bytearray(size * size * 4)
    ox = (size - dw) // 2
    oy = int(size * VB) - dh // 2

    for y in range(dh):
        dy = oy + y
        if dy < 0 or dy >= size:
            continue
        for x in range(dw):
            dx = ox + x
            if dx < 0 or dx >= size:
                continue          # 横向溢出的就是胡子尖，裁掉
            si = (y * dw + x) * 4
            di = (dy * size + dx) * 4
            canvas[di:di + 4] = cat[si:si + 4]
    return size, canvas, (scale, ox, oy, x0, y0, dw, dh)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    art = args[0]
    install = '--install' in sys.argv
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, '..', 'icon_src')

    size, fg, info = build_foreground(art, 432)
    scale, ox, oy, x0, y0, dw, dh = info
    print('前景 432: 猫 %dx%d  横向溢出 %d px（两侧各裁 %d）'
          % (dw, dh, max(0, dw - size), max(0, (dw - size) // 2)))

    # 白色背景 + 白底猫的合成预览（就是桌面上的样子）
    preview = bytearray(b'\xff\xff\xff\xff' * (size * size))
    for i in range(size * size):
        a = fg[i * 4 + 3]
        if a:
            k = a / 255.0
            for c in range(3):
                preview[i * 4 + c] = int(fg[i * 4 + c] * k + 255 * (1 - k))
    write_png(os.path.join(out, 'adaptive_fg_108dp.png'), size, size, fg)
    write_png(os.path.join(out, 'adaptive_preview.png'), size, size, preview)
    print('预览已生成 adaptive_fg_108dp.png / adaptive_preview.png')

    if install:
        res = 'D:/小账本/app/res'
        for name, k in DENS.items():
            px = int(round(FOREGROUND_DP * k))
            folder = os.path.join(res, 'drawable-' + name)
            os.makedirs(folder, exist_ok=True)
            _, img, _ = build_foreground(art, px)
            p = os.path.join(folder, 'ic_launcher_foreground.png')
            write_png(p, px, px, img)
            print('drawable-%s/ic_launcher_foreground.png %dx%d → %d bytes'
                  % (name, px, px, os.path.getsize(p)))


if __name__ == '__main__':
    main()
