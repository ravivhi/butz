"""Cursive stroke paths for the Butz writing game, traced from a handwriting font.

Renders each Hebrew letter, thins it to a 1-pixel skeleton (Zhang-Suen), takes long strokes from the skeleton (longest
path first) and joins smooth continuations. FIX then puts the strokes in writing order and direction (where to start and
which way to go, from a school writing chart). Letters in DRAWN (font shape unlike the chart) are drawn instead. Writes
src/engine/strokes_cursive.ts (300x300 board) and a preview image with numbered start dots and direction arrows.

usage: python scripts/cursive_strokes.py <font.otf> <out.ts> <preview.png>
"""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

FONT, OUT, PREVIEW = sys.argv[1], sys.argv[2], sys.argv[3]
LETTERS = [chr(c) for c in range(0x05D0, 0x05EB)]
UPM = 1000
PX = 0.4
BOARD = 300
REF = (-250, 760)      # font units that every letter fits into (taller letters are scaled down)
XHEIGHT = 480          # the upper guide line
MARGIN = 14
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

# Writing order per letter: each stroke is a list of pieces (raw stroke index, from, to), joined in order. `from` / `to`
# are 's' (start), 'e' (end) or k, the k-th vertex of that raw stroke in the .txt dump. Unlisted letters keep raw strokes.
FIX: dict[str, list[list[tuple]]] = {
    'א': [[(1, 'e', 's')], [(0, 'e', 's')]],
    'ב': [[(0, 'e', 's')]],
    'ג': [[(2, 'e', 's')], [(0, 'e', 's')]],
    'ד': [[(0, 'e', 2), (1, 3, 's'), (1, 'e', 3), (0, 2, 's')]],
    'ה': [[(0, 'e', 's')], [(1, 'e', 's')]],
    'ו': [[(0, 'e', 's')]],
    'ז': [[(0, 'e', 's')]],
    'ח': [[(0, 5, 's')], [(0, 5, 'e')]],
    'ט': [[(0, 's', 'e')]],
    'י': [[(0, 'e', 's')]],
    'ך': [[(0, 'e', 's')]],
    'כ': [[(0, 'e', 's')]],
    'ל': [[(0, 'e', 3), (0, 3, 's')]],
    'ם': [[(0, 'e', 1)], [(0, 1, 's')]],
    'מ': [[(0, 'e', 2), (0, 2, 1), (0, 1, 's')]],
    'ן': [[(0, 'e', 's')]],
    'נ': [[(0, 'e', 's')]],
    'ס': [[(0, 4, 's'), (0, 'e', 4)]],
    'ע': [[(0, 's', 'e'), (1, 's', 'e')]],
    'ף': [[(0, 's', 'e'), (1, 4, 'e')], [(1, 's', 4)]],
    'פ': [[(0, 'e', 's')]],
    'ץ': [[(1, 6, 'e'), (1, 6, 's')], [(0, 's', 'e'), (2, 'e', 's'), (3, 's', 'e')]],
    'צ': [[(0, 'e', 's')]],
    'ק': [[(0, 'e', 's')], [(1, 'e', 's')]],
    'ר': [[(0, 'e', 's')]],
    'ש': [[(0, 's', 'e'), (1, 's', 'e')]],
    'ת': [[(0, 3, 'e')], [(0, 3, 's')]],
}

# Letters whose font shape differs from the school chart: drawn on the board (base 219, upper line 89) instead of traced.
# Each stroke is a list of segments (control points in writing order), smoothed separately; segments meet at a corner.
DRAWN: dict[str, list[list[list[tuple[float, float]]]]] = {
    'ג': [[[(185, 89), (185, 115), (185, 139)], [(185, 139), (158, 138), (129, 147), (114, 175), (124, 204), (151, 219), (183, 216)]]],
    'ה': [[[(97, 100), (127, 89), (157, 89), (184, 105), (202, 129), (203, 160), (199, 189), (189, 219)]],
          [[(100, 167), (112, 190), (110, 216)]]],
    'ך': [[[(101, 106), (133, 89), (174, 92), (198, 118), (198, 156), (171, 183), (134, 186), (115, 204), (113, 242), (111, 280)]]],
    'ף': [[[(133, 176), (104, 197), (99, 233), (118, 262), (153, 257), (156, 216), (156, 173), (156, 130), (161, 105), (153, 67),
            (160, 32), (194, 17), (210, 54), (194, 89), (163, 106)], [(163, 106), (131, 84), (96, 82), (90, 120)]]],
    'ץ': [[[(128, 176), (101, 197), (95, 233), (115, 262), (150, 257), (153, 216), (153, 175), (153, 130), (150, 105), (150, 67),
            (156, 29), (194, 19), (205, 59), (185, 97), (150, 105)], [(150, 105), (125, 89), (106, 67)]]],
    'ש': [[[(189, 209), (158, 219), (128, 212), (112, 187), (108, 156), (112, 125), (135, 102), (165, 89), (193, 102), (189, 132),
            (165, 150), (134, 160), (118, 158)]]],
}


def catmull(pts, n=8):
    """A smooth curve through the control points (Catmull-Rom), n samples per span."""
    P = [np.array(p, float) for p in [pts[0], *pts, pts[-1]]]
    out = [P[1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(1, n + 1):
            t = k / n
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    return out


def drawn(stroke):
    pts = [q for k, seg in enumerate(stroke) for q in (catmull(seg) if k == 0 else catmull(seg)[1:])]
    res = []
    for x, y in pts:
        q = [int(round(x)), int(round(y))]
        if not res or q != res[-1]:
            res.append(q)
    return res


def piece(raw, i, a, b):
    s = raw[i]
    verts = rdp(s, 6)
    def at(p):
        if p == 's':
            return 0
        if p == 'e':
            return len(s) - 1
        return s.index(verts[p])
    ia, ib = at(a), at(b)
    return s[ia:ib + 1] if ia <= ib else s[ib:ia + 1][::-1]


def zhang_suen(img):
    img = img.copy().astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            p = np.pad(img, 1)
            P2, P3, P4, P5 = p[:-2, 1:-1], p[:-2, 2:], p[1:-1, 2:], p[2:, 2:]
            P6, P7, P8, P9 = p[2:, 1:-1], p[2:, :-2], p[1:-1, :-2], p[:-2, :-2]
            nbrs = [P2, P3, P4, P5, P6, P7, P8, P9]
            B = sum(n.astype(int) for n in nbrs)
            seq = nbrs + [P2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(int) for i in range(8))
            if step == 0:
                c = (P2 * P4 * P6 == 0) & (P4 * P6 * P8 == 0)
            else:
                c = (P2 * P4 * P8 == 0) & (P2 * P6 * P8 == 0)
            m = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if m.any():
                img[m] = 0
                changed = True
    return img


def bfs_far(rem, start):
    par = {start: None}
    q = deque([start])
    last = start
    while q:
        cur = q.popleft()
        last = cur
        y, x = cur
        for dy, dx in N8:
            n = (y + dy, x + dx)
            if n in rem and n not in par:
                par[n] = cur
                q.append(n)
    path, c = [], last
    while c is not None:
        path.append(c)
        c = par[c]
    return last, path[::-1]


def extract(sk, min_len):
    pix = {tuple(int(v) for v in p) for p in np.argwhere(sk)}
    strokes, seen = [], set()
    for p0 in sorted(pix):
        if p0 in seen:
            continue
        comp = {p0}
        q = deque([p0])
        while q:
            y, x = q.popleft()
            for dy, dx in N8:
                n = (y + dy, x + dx)
                if n in pix and n not in comp:
                    comp.add(n)
                    q.append(n)
        seen |= comp
        rem = set(comp)
        while len(rem) >= min_len:
            a = min(rem)
            b, _ = bfs_far(rem, a)
            _, path = bfs_far(rem, b)
            if len(path) < min_len:
                break
            strokes.append(path)
            kill = {(y + dy, x + dx) for (y, x) in path for dy in range(-2, 3) for dx in range(-2, 3)}
            rem -= kill
    return strokes


def merge(paths, eps):
    paths = [list(p) for p in paths]
    while True:
        best = None
        for i in range(len(paths)):
            for j in range(len(paths)):
                if i == j:
                    continue
                for ra in (False, True):
                    for rb in (False, True):
                        A = paths[i][::-1] if ra else paths[i]
                        B = paths[j][::-1] if rb else paths[j]
                        gap = np.hypot(A[-1][0] - B[0][0], A[-1][1] - B[0][1])
                        if gap > eps:
                            continue
                        da = np.array(A[-1], float) - np.array(A[max(0, len(A) - 8)], float)
                        db = np.array(B[min(len(B) - 1, 7)], float) - np.array(B[0], float)
                        cos = float(np.dot(da, db) / (np.linalg.norm(da) * np.linalg.norm(db) + 1e-9))
                        if cos > 0.3 and (best is None or gap < best[0]):
                            best = (gap, i, j, A, B)
        if best is None:
            return paths
        _, i, j, A, B = best
        joined = A + B
        paths = [p for k, p in enumerate(paths) if k not in (i, j)] + [joined]


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float)
    d = np.array(pts, float)
    ab = b - a
    n = np.linalg.norm(ab)
    dist = np.linalg.norm(d - a, axis=1) if n == 0 else np.abs(ab[0] * (d[:, 1] - a[1]) - ab[1] * (d[:, 0] - a[0])) / n
    i = int(np.argmax(dist))
    if dist[i] > eps:
        return rdp(pts[: i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]


def arrow(pd, X, Y, s, color):
    """A small arrowhead a third of the way along a stroke, pointing the writing direction."""
    k = max(1, len(s) // 3)
    (ax, ay), (bx, by) = s[k - 1], s[k]
    d = np.hypot(bx - ax, by - ay) or 1
    ux, uy = (bx - ax) / d, (by - ay) / d
    tip = (X + bx, Y + by)
    left = (X + bx - 14 * ux + 8 * uy, Y + by - 14 * uy - 8 * ux)
    right = (X + bx - 14 * ux - 8 * uy, Y + by - 14 * uy + 8 * ux)
    pd.polygon([tip, left, right], fill=color)


def main():
    tt = TTFont(FONT)
    cmap, gs = tt.getBestCmap(), tt.getGlyphSet()
    font = ImageFont.truetype(FONT, int(UPM * PX))
    out = {}
    dump = []
    prev_img = Image.new("RGB", (9 * 320, 3 * 340), "white")
    pd = ImageDraw.Draw(prev_img)
    for li, ch in enumerate(LETTERS):
        bp = BoundsPen(gs)
        gs[cmap[ord(ch)]].draw(bp)
        x0, y0, x1, y1 = bp.bounds
        lo, hi = min(y0, REF[0]), max(y1, REF[1])
        scale = min((BOARD - 2 * MARGIN) / (REF[1] - REF[0]), (BOARD - 2 * MARGIN) / (hi - lo), (BOARD - 2 * MARGIN) / (x1 - x0 + 1))
        W, H = int(((x1 - x0) + 200) * PX), int(((hi - lo) + 200) * PX)
        img = Image.new("L", (W, H), 0)
        ImageDraw.Draw(img).text(((100 - x0) * PX, (100 + hi) * PX), ch, font=font, fill=255, anchor="ls")
        ox, base = (100 - x0) * PX, (100 + hi) * PX
        sk = zhang_suen((np.array(img) > 128).astype(np.uint8))
        paths = [p for p in merge(extract(sk, 8), eps=7) if len(p) >= 8]
        vpad = ((BOARD - 2 * MARGIN) - (hi - lo) * scale) / 2

        def to_board(p):
            y, x = p
            fx, fy = (x - ox) / PX, (base - y) / PX
            return [round(BOARD / 2 + (fx - (x0 + x1) / 2) * scale, 1), round(MARGIN + vpad + (hi - fy) * scale, 1)]

        raw = [rdp([to_board(q) for q in p], 0.8) for p in paths]
        raw.sort(key=lambda s: (-max(q[0] for q in s), min(q[1] for q in s)))
        fix = FIX.get(ch)
        strokes = [[q for k, pc in enumerate(st) for q in (piece(raw, *pc) if k == 0 else piece(raw, *pc)[1:])] for st in fix] if fix else raw
        dump.append(f"{ch} " + " | ".join(f"{i}: " + " ".join(f"{round(x)},{round(y)}" for x, y in rdp(s, 6)) for i, s in enumerate(raw)))
        line_y = lambda fy: round(MARGIN + vpad + (hi - fy) * scale)
        out[ch] = {"strokes": strokes, "base": line_y(0), "mid": line_y(XHEIGHT)}
        if ch in DRAWN:
            strokes = [drawn(st) for st in DRAWN[ch]]
            out[ch] = {"strokes": strokes, "base": 219, "mid": 89}
        r, c = divmod(li, 9)
        X, Y = (8 - c) * 320 + 10, r * 340 + 30
        pd.rectangle([X, Y, X + 300, Y + 300], outline="#bbb")
        k = scale / PX
        glyph = img.resize((max(1, int(img.width * k)), max(1, int(img.height * k))))
        gx = BOARD / 2 + (-ox / PX - (x0 + x1) / 2) * scale
        gy = MARGIN + vpad + (hi - base / PX) * scale
        prev_img.paste(Image.new("RGB", glyph.size, "#d6d6d6"), (int(X + gx), int(Y + gy)), glyph)
        for yy in (out[ch]["base"], out[ch]["mid"]):
            pd.line([X, Y + yy, X + 300, Y + yy], fill="#9cf")
        cols = ["#e33", "#33e", "#2a2", "#d80", "#a3a"]
        for k, s in enumerate(strokes):
            pd.line([(X + q[0], Y + q[1]) for q in s], fill=cols[k % 5], width=3)
            sx, sy = s[0]
            pd.ellipse([X + sx - 9, Y + sy - 9, X + sx + 9, Y + sy + 9], fill=cols[k % 5])
            pd.text((X + sx + 11, Y + sy - 12), str(k + 1), fill="black", font=ImageFont.truetype("arial.ttf", 20))
            arrow(pd, X, Y, s, cols[k % 5])
        pd.text((X + 5, Y - 25), f"{ch} {ord(ch):04X} {len(strokes)}{' drawn' if ch in DRAWN else '' if fix else ' raw'}", fill="black", font=ImageFont.truetype("arial.ttf", 18))
    prev_img.save(PREVIEW)
    open(PREVIEW + ".txt", "w", encoding="utf-8").write("\n".join(dump) + "\n")
    path = lambda s: "M " + " L ".join(f"{round(x)} {round(y)}" for x, y in s)
    lines = [
        "/* Cursive (כְּתָב) letter strokes for the writing game. Traced from the centerlines of the Dana Yad font (AlefAlefAlef)",
        "   by scripts/cursive_strokes.py (a few letters drawn to match the chart), in the stroke order and direction of a school",
        "   writing chart (where to start, which way to go). A 300x300 board, strokes in writing order, each from its first point.",
        "   `base` / `mid` are the baseline and the upper guide line of that letter. Generated: do not edit by hand. Pure TS. */",
        "",
        "export interface CursiveShape { strokes: string[]; base: number; mid: number }",
        "",
        "export const CURSIVE: Record<string, CursiveShape> = {",
    ]
    for ch in LETTERS:
        o = out[ch]
        lines.append(f"  '{ch}': {{ strokes: [{', '.join(repr(path(s)) for s in o['strokes'])}], base: {o['base']}, mid: {o['mid']} }},")
    lines.append("};")
    open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
    print("ok", {k: len(v["strokes"]) for k, v in out.items()})


main()
