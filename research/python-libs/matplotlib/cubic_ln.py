"""y = x^3 과 y = ln x 그래프를 시험지 양식으로 그리기."""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams.update({
    "font.family": "STIXGeneral",
    "mathtext.fontset": "stix",
    "font.size": 13,
    "savefig.dpi": 300,
})

LW_CURVE, LW_AXIS, LW_GUIDE = 1.1, 0.8, 0.7
DASH = (0, (3, 2))


def exam_axes(ax, xlim, ylim):
    ax.set_xlim(*xlim); ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.axis("off")
    arrow = dict(arrowstyle="-|>,head_length=0.45,head_width=0.18", lw=LW_AXIS, color="black", shrinkA=0, shrinkB=0)
    ax.annotate("", xy=(xlim[1], 0), xytext=(xlim[0], 0), arrowprops=arrow)
    ax.annotate("", xy=(0, ylim[1]), xytext=(0, ylim[0]), arrowprops=arrow)
    ax.annotate("$x$", xy=(xlim[1], 0), xytext=(4, 0), textcoords="offset points", va="center", ha="left")
    ax.annotate("$y$", xy=(0, ylim[1]), xytext=(0, 2), textcoords="offset points", ha="center", va="bottom")
    ax.annotate("$O$", xy=(0, 0), xytext=(-3, -3), textcoords="offset points", ha="right", va="top")


def dot(ax, x, y):
    ax.plot(x, y, "o", color="black", ms=3.8, zorder=5)


def guide(ax, x, y):
    """점 (x, y)에서 두 축으로 점선."""
    ax.plot([x, x, 0], [0, y, y], color="black", lw=LW_GUIDE, ls=DASH)


out = Path(sys.argv[1])
fig, (a1, a2) = plt.subplots(1, 2, figsize=(9, 4.8), gridspec_kw={"wspace": 0.3})

# ---------- y = x^3 ----------
exam_axes(a1, (-2.2, 2.4), (-2.6, 2.9))
x = np.linspace(-1.36, 1.36, 300)
a1.plot(x, x**3, color="black", lw=LW_CURVE)
guide(a1, 1, 1); guide(a1, -1, -1)
dot(a1, 1, 1); dot(a1, -1, -1)
a1.annotate("$1$", xy=(1, 0), xytext=(0, -4), textcoords="offset points", ha="center", va="top")
a1.annotate("$1$", xy=(0, 1), xytext=(-4, 0), textcoords="offset points", ha="right", va="center")
a1.annotate("$-1$", xy=(-1, 0), xytext=(0, 4), textcoords="offset points", ha="center", va="bottom")
a1.annotate("$-1$", xy=(0, -1), xytext=(4, 0), textcoords="offset points", ha="left", va="center")
a1.annotate("$y=x^3$", xy=(1.36, 1.36**3), xytext=(4, 0), textcoords="offset points", ha="left", va="center")

# ---------- y = ln x ----------
e = np.e
exam_axes(a2, (-0.7, 4.6), (-2.6, 2.9))
x = np.linspace(np.exp(-2.4), 4.3, 400)
a2.plot(x, np.log(x), color="black", lw=LW_CURVE)
guide(a2, e, 1)
dot(a2, 1, 0); dot(a2, e, 1)
a2.annotate("$1$", xy=(1, 0), xytext=(2, -4), textcoords="offset points", ha="left", va="top")
a2.annotate("$e$", xy=(e, 0), xytext=(0, -4), textcoords="offset points", ha="center", va="top")
a2.annotate("$1$", xy=(0, 1), xytext=(-4, 0), textcoords="offset points", ha="right", va="center")
a2.annotate(r"$y=\ln x$", xy=(4.3, np.log(4.3)), xytext=(-2, 8), textcoords="offset points", ha="center", va="bottom")

for ext in ("png", "pdf"):
    fig.savefig(out / f"cubic_ln.{ext}", bbox_inches="tight", pad_inches=0.08)
print("saved")
