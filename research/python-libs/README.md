# 파이썬 라이브러리 시험 결과 (2026-11-11)

03 "파이썬으로 일하기"를 준비하면서 에이전트 없이 직접 돌려 본 결과입니다. 강의 페이지에는 아직 들어가 있지 않습니다.

| 폴더 | 내용 | 결과 |
|---|---|---|
| `tikz/` | LaTeX + TikZ로 모의고사 양식 그래프 (이차함수 꼭짓점·절편, 삼차함수 넓이 S) | 기출 느낌에 가장 가까움. MiKTeX 필요(수백 MB) |
| `matplotlib/` | 같은 그래프를 matplotlib으로 (`graphs`), y = x³과 y = ln x (`cubic_ln`) | TikZ와 거의 같음. 설치가 가벼워 연수 실습에 적합 |
| `science/` | RDKit 구조식, SciPy 추세선, mendeleev 원자 반지름, Skyfield 밤하늘 높이 | 모두 동작함 |

## 다시 만들기

```powershell
python -m venv venv
venv\Scripts\python -m pip install matplotlib numpy scipy rdkit mendeleev skyfield
venv\Scripts\python matplotlib\graphs.py matplotlib
venv\Scripts\python matplotlib\cubic_ln.py matplotlib
venv\Scripts\python science\demos.py science
pdflatex tikz\graphs.tex
```

- 스크립트는 첫 번째 인자로 받은 폴더에 그림을 저장합니다.
- `science/demos.py`는 처음 실행할 때 Skyfield 천체 데이터(`de421.bsp`, 약 17 MB)를 `science/skydata/`에 내려받습니다. 저장소에는 넣지 않았습니다.
- 그래프의 한글 글꼴은 Windows의 맑은 고딕, 수식 글씨는 STIX(Times 계열)입니다.

## 알게 된 점
- 시험지 양식은 "흑백, 기울어진 수식 글씨, 원점을 지나는 화살표 축, 격자·눈금 없음, 필요한 점과 점선만"으로 프롬프트에 적으면 됩니다. 글씨가 선과 겹치는지는 한두 번 확인해야 합니다.
- mendeleev의 기본 `atomic_radius`는 원소마다 출처가 달라 He·Ne·Ar 값이 교과서와 다르게 튑니다. 교과서와 맞추려면 공유 결합 반지름(`covalent_radius_pyykko`)을 쓰고 비활성 기체를 뺍니다.
- Skyfield 결과(2026-11-11 서울: 20시에 토성만 보임, 화성·목성은 자정 무렵 뜸)는 천문 앱과 대조해 검증하지 않았습니다.
