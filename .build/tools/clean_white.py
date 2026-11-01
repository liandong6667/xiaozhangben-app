"""把图标素材的背景白统一成纯白 #FFFFFF，并从边缘抹掉 JPEG 噪点。

原图（微信转来的 JPG）白底是 254,254,254，混着 253/252/251 的噪点；
图标画布是 255,255,255，两者并排时能看出一块偏灰的"脏白"。
"""
import sys
from collections import deque


def clean_white(px, w, h, thr=238, target=(255, 255, 255)):
    """从四条边往里洪泛，把连通的近白像素统一成 target。返回改动像素数。"""
    n = 0
    seen = bytearray(w * h)
    q = deque()

    def lum(i):
        return (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) // 1000

    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not seen[i] and lum(i) >= thr:
                seen[i] = 1
                q.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not seen[i] and lum(i) >= thr:
                seen[i] = 1
                q.append(i)

    while q:
        i = q.popleft()
        j = i * 4
        if (px[j], px[j + 1], px[j + 2]) != target:
            px[j], px[j + 1], px[j + 2] = target
            n += 1
        px[j + 3] = 255
        x, y = i % w, i // w
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                k = ny * w + nx
                if not seen[k] and lum(k) >= thr:
                    seen[k] = 1
                    q.append(k)
    return n
