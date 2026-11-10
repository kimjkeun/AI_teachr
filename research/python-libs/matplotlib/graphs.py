"""TikZ 테스트와 같은 그래프 두 장을 matplotlib으로 시험지 양식에 맞춰 그리기."""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams.update({
    "font.family": "STIXGeneral",   # Times 계열 (시험지 수식 글씨와 비슷)
    "mathtext.fontset": "stix",
    "font.size": 13,
    "savefig.dpi": 300,
})

LW_CURVE, LW_AXIS = 1.3, 0.8


def exam_axes(ax, xlim, ylim):
    """격자·눈금 없이 원점을 지나는 화살표 축, x / y / O 표시."""
    ax.set_xlim(*xlim); ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.axis("off")
    arrow = dict(arrowstyle="-|>,head_length=0.45,head_width=0.18", lw=LW_AXIS, color="black", shrinkA=0, shrinkB=0)
    ax.annotate("", xy=(xlim[1], 0), xytext=(xlim[0], 0), arrowprops=arrow)
    ax.annotate("", xy=(0, ylim[1]), xytext=(0, ylim[0]), arrowprops=arrow)
    ax.annotate("$x$", xy=(xlim[1], 0), xytext=(4, 0), textcoords="offset points", va="center", ha="left")
    ax.annotate("$y$", xy=(0, ylim[1]), xytext=(0, 3), textcoords="offset points", ha="center", va="bottom")
    ax.text(-0.08, -0.1, "$O$", ha="right", va="top")


def dot(ax, x, y):
    ax.plot(x, y, "o", color="black", ms=4.2, zorder=5)


out = Path(sys.argv[1])

fig, (a1, a2) = plt.subplots(1, 2, figsize=(9.2, 4.6), gridspec_kw={"width_ratios": [1, 1.05], "wspace": 0.25})

# ---------- 1. 이차함수 y = x^2 - 2x - 3 ----------
f = lambda x: x**2 - 2*x - 3
exam_axes(a1, (-2.6, 4.6), (-5, 5.6))
x = np.linspace(-1.75, 3.75, 300)
a1.plot(x, f(x), color="black", lw=LW_CURVE)
a1.plot([1, 1, 0], [0, -4, -4], color="black", lw=0.7, ls=(0, (3, 2)))
for p in [(-1, 0), (3, 0), (1, -4)]:
    dot(a1, *p)
a1.text(-1.08, -0.25, "$-1$", ha="right", va="top")
a1.text(3.08, -0.25, "$3$", ha="left", va="top")
a1.text(1, 0.2, "$1$", ha="center", va="bottom")
a1.text(-0.12, -4, "$-4$", ha="right", va="center")
a1.text(3.8, 4.6, "$y=f(x)$", ha="left", va="center")

# ---------- 2. 삼차함수 y = x(x-2)(x-3), 0~2 넓이 ----------
g = lambda x: x * (x - 2) * (x - 3)
exam_axes(a2, (-0.6, 3.7), (-1.2, 2.7))
x = np.linspace(-0.12, 3.35, 300)
s = np.linspace(0, 2, 200)
a2.fill_between(s, g(s), 0, color="0.83", lw=0)
a2.plot(x, g(x), color="black", lw=LW_CURVE)
a2.text(1.97, -0.06, "$2$", ha="right", va="top")
a2.text(3.04, -0.06, "$3$", ha="left", va="top")
a2.text(0.95, 0.62, "$S$", ha="center", va="center")
a2.text(3.38, 1.6, "$y=f(x)$", ha="left", va="center")

for ext in ("png", "pdf"):
    fig.savefig(out / f"graphs.{ext}", bbox_inches="tight", pad_inches=0.08)
print("saved", out)
