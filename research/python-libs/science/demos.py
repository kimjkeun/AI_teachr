"""RDKit · SciPy · mendeleev · Skyfield 예시 결과 만들기."""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(sys.argv[1])
plt.rcParams.update({"font.family": "Malgun Gothic", "axes.unicode_minus": False, "savefig.dpi": 200, "font.size": 11})


# ---------- 1. RDKit: 알코올·산 구조식 ----------
def rdkit_demo():
    from rdkit import Chem
    from rdkit.Chem import Draw, Descriptors, rdMolDescriptors
    mols = [("Methanol", "CO"), ("Ethanol", "CCO"), ("1-Propanol", "CCCO"),
            ("Acetic acid", "CC(=O)O"), ("Benzene", "c1ccccc1"), ("Glucose", "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O")]
    ms, legends = [], []
    print("\n[RDKit] 분자식과 분자량")
    for name, smi in mols:
        m = Chem.MolFromSmiles(smi)
        f, mw = rdMolDescriptors.CalcMolFormula(m), Descriptors.MolWt(m)
        ms.append(m); legends.append(f"{name}  {f}  ({mw:.1f})")
        print(f"  {name:12s} SMILES={smi:10.10s}  {f:9s} 분자량 {mw:6.2f}")
    img = Draw.MolsToGridImage(ms, molsPerRow=3, subImgSize=(300, 240), legends=legends)
    img.save(OUT / "1_rdkit.png")


# ---------- 2. SciPy: 용수철 실험 추세선 ----------
def scipy_demo():
    from scipy.optimize import curve_fit
    from scipy import stats
    m = np.array([0, 50, 100, 150, 200, 250, 300])               # 추 질량 (g)
    L = np.array([10.0, 12.6, 14.9, 17.6, 19.8, 22.7, 24.9])      # 용수철 길이 (cm), 가상의 측정값
    (k, b), _ = curve_fit(lambda x, k, b: k * x + b, m, L)
    r = stats.pearsonr(m, L).statistic
    print(f"\n[SciPy] 추세선: L = {k:.4f}·m + {b:.2f}   (상관계수 r = {r:.4f})")
    print(f"  → 추 100 g마다 {k*100:.2f} cm 늘어남, 추가 없을 때 길이 {b:.2f} cm")
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    ax.scatter(m, L, color="#1F5E46", zorder=3, label="측정값")
    xs = np.linspace(0, 320, 50)
    ax.plot(xs, k * xs + b, color="#B3402A", lw=1.6, label=f"추세선  L = {k:.4f}m + {b:.2f}")
    ax.set(xlabel="추의 질량 m (g)", ylabel="용수철 길이 L (cm)", title="용수철에 매단 추의 질량과 길이 (가상 실험값)")
    ax.grid(alpha=.3); ax.legend(loc="upper left")
    fig.tight_layout(); fig.savefig(OUT / "2_scipy.png")


# ---------- 3. mendeleev: 원자 반지름의 주기성 ----------
def mendeleev_demo():
    from mendeleev import element
    els = [element(z) for z in range(1, 21)]
    print("\n[mendeleev] 1~20번 원소 (일부)")
    print("  번호 기호 이름        원자량   원자반지름(pm) 전기음성도")
    for e in els[:6] + els[10:12]:
        print(f"  {e.atomic_number:>3} {e.symbol:>3}  {e.name:10s} {e.atomic_weight:7.3f}   {e.atomic_radius or 0:>6}       {e.en_pauling or '-'}")
    # 교과서처럼 공유 결합 반지름(Pyykkö)을 쓰고, 비활성 기체(He, Ne, Ar)는 뺌
    noble = {2, 10, 18}
    fig, ax = plt.subplots(figsize=(7.4, 4.2))
    for seg in ([1], range(3, 10), range(11, 18), range(19, 21)):
        pts = [els[i - 1] for i in seg]
        ax.plot([e.atomic_number for e in pts], [e.covalent_radius_pyykko for e in pts], "-o", color="#1F5E46", ms=5)
    for e in els:
        if e.atomic_number not in noble:
            ax.annotate(e.symbol, (e.atomic_number, e.covalent_radius_pyykko), xytext=(0, 7), textcoords="offset points", ha="center", fontsize=9)
    for p in (2.5, 10.5, 18.5):
        ax.axvline(p, color="#999", ls=":", lw=1)
    ax.margins(y=0.12)
    ax.set(xlabel="원자 번호", ylabel="공유 결합 반지름 (pm)", title="원자 번호에 따른 원자 반지름 (비활성 기체 제외, 점선: 주기 경계)", xticks=range(1, 21))
    ax.grid(alpha=.25, axis="y")
    fig.tight_layout(); fig.savefig(OUT / "3_mendeleev.png")


# ---------- 4. Skyfield: 오늘 밤 서울 하늘 ----------
def skyfield_demo():
    from datetime import datetime, timedelta, timezone
    from skyfield.api import Loader, wgs84
    from skyfield import almanac
    load = Loader(str(OUT / "skydata"))
    ts, eph = load.timescale(), load("de421.bsp")
    kst = timezone(timedelta(hours=9))
    t = ts.from_datetime(datetime(2026, 11, 11, 20, 0, tzinfo=kst))
    seoul = eph["earth"] + wgs84.latlon(37.5665, 126.9780)
    names = {"Moon": "달", "Mercury": "수성", "Venus": "금성", "Mars": "화성", "Jupiter barycenter": "목성", "Saturn barycenter": "토성"}
    dirs = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"]
    print("\n[Skyfield] 2026-11-11 20:00 서울 하늘")
    rows = []
    for key, ko in names.items():
        alt, az, _ = seoul.at(t).observe(eph[key]).apparent().altaz()
        d = dirs[int((az.degrees + 22.5) // 45) % 8]
        seen = "보임" if alt.degrees > 0 else "지평선 아래"
        print(f"  {ko:3s}  높이 {alt.degrees:6.1f}°  방위 {az.degrees:6.1f}° ({d})  {seen}")
        rows.append((ko, alt.degrees, az.degrees))
    phase = almanac.moon_phase(eph, t).degrees
    print(f"  달의 위상각 {phase:.0f}° (0°=삭, 90°=상현, 180°=망, 270°=하현)")
    f = almanac.sunrise_sunset(eph, wgs84.latlon(37.5665, 126.9780))
    t0 = ts.from_datetime(datetime(2026, 11, 11, 0, 0, tzinfo=kst)); t1 = ts.from_datetime(datetime(2026, 11, 12, 0, 0, tzinfo=kst))
    times, ev = almanac.find_discrete(t0, t1, f)
    print("  " + ", ".join(f"{'일출' if e else '일몰'} {tt.astimezone(kst):%H:%M}" for tt, e in zip(times, ev)))
    # 밤사이 높이 변화: 11일 17시 ~ 12일 7시
    hours = np.arange(17, 31.01, 0.25)
    tt = ts.from_datetimes([datetime(2026, 11, 11, tzinfo=kst) + timedelta(hours=float(h)) for h in hours])
    colors = {"달": "#E2B93B", "금성": "#B3402A", "화성": "#D9822B", "목성": "#1F5E46", "토성": "#4A6FA5", "수성": "#888888"}
    fig, ax = plt.subplots(figsize=(7.6, 4.2))
    ax.axhspan(-90, 0, color="#CCCCCC", alpha=.35)
    ax.text(25, -24, "지평선 아래 (안 보임)", ha="center", va="center", fontsize=9, color="#666")
    for key, ko in names.items():
        alt = seoul.at(tt).observe(eph[key]).apparent().altaz()[0].degrees
        ax.plot(hours, alt, lw=2, color=colors[ko], label=ko)
    ax.set(xlim=(17, 31), ylim=(-30, 75), ylabel="높이 (°)", title="2026년 11월 11일 밤, 서울에서 본 행성과 달의 높이")
    ax.set_xticks(range(17, 32, 2)); ax.set_xticklabels([f"{h % 24}시" for h in range(17, 32, 2)])
    ax.grid(alpha=.25); ax.legend(ncol=6, loc="upper center", fontsize=9, frameon=False)
    fig.tight_layout(); fig.savefig(OUT / "4_skyfield.png")


for fn in (rdkit_demo, scipy_demo, mendeleev_demo, skyfield_demo):
    fn()
