"""강의자료(lessons/01~04.html)에서 채팅 AI 도우미가 참고할 요약 파일 assets/ai-context.md 를 만듭니다.

실행:  python research/chat-ai/build_context.py        (저장소 맨 위 폴더에서)
- 공통 설명은 research/chat-ai/context-header.md 를 손으로 고칩니다.
- 차시별 내용은 강의자료 HTML에서 뽑습니다: 단계 제목, 입력 명령, 에이전트에게 말할 프롬프트, 주의·팁, 자주 묻는 질문.
- 강의자료를 고친 뒤 이 스크립트를 다시 실행해 assets/ai-context.md 를 갱신하고 push 하면, Apps Script 를 다시 배포하지 않아도 AI 도우미가 새 내용을 알게 됩니다(최대 6시간 뒤).
"""
import re, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LESSONS = [  # (번호, 파일, 채팅방 이름)
    ("01", "lessons/01.html", "lesson01"),
    ("02", "lessons/02.html", "lesson02"),
    ("03", "lessons/03.html", "lesson04"),     # 03 자료의 채팅방은 예전 기록 보존을 위해 04 를 씀
    ("04", "lessons/04.html", "lessonm4"),
]
MAX_CHARS = 8000   # 한 차시 요약의 상한(글자). 넘으면 설명 문장을 줄입니다.


class Grab(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []          # (종류, 글)
        self.stack = []          # (태그, 클래스집합)
        self.buf = None          # 현재 모으는 글
        self.kind = None
        self.kind_tag = None
        self.cmd_label = ""
        self.in_script = False

    def cls(self):
        return set(c for _, cs in self.stack for c in cs)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cs = set((a.get("class") or "").split())
        if tag in ("script", "style"):
            self.in_script = True
        self.stack.append((tag, cs))
        if self.in_script:
            return
        if tag == "h1":
            self.start("h1")
        elif tag == "h2":
            self.start("h2")
        elif tag == "h3":
            self.start("h3")
        elif tag == "summary":
            self.start("q")
        elif tag == "pre" and "cmd" in self.cls():
            # 'prompt' 모양의 상자는 에이전트에게 말하는 문장, 나머지는 PowerShell 등에 입력하는 명령
            self.cmd_label = "에이전트에게" if "prompt" in self.cls() else ""
            self.start("cmd")
        elif tag == "span" and "lbl" in cs:
            self.start("lbl")
        elif tag == "p" and not ({"chat-msg"} & self.cls()):
            ancestors = self.cls()
            if "note" in ancestors:
                self.start("note")
            elif "tip" in ancestors:
                self.start("tip")
            elif "body" in ancestors:
                self.start("a")
            else:
                self.start("p")
        elif tag == "div" and ("note" in cs or "tip" in cs):
            self.start("note" if "note" in cs else "tip")
        elif tag == "li":
            self.start("li")

    def start(self, kind):
        self.flush()
        self.kind, self.buf = kind, []
        self.kind_tag = self.stack[-1][0]

    def flush(self):
        if self.kind and self.buf is not None:
            text = re.sub(r"\s+", " ", "".join(self.buf)).strip()
            if self.kind == "lbl":
                self.cmd_label = text
            elif text:
                self.items.append((self.kind, text, self.cmd_label if self.kind == "cmd" else ""))
        self.kind, self.buf, self.kind_tag = None, None, None

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.in_script = False
        if self.kind and tag == self.kind_tag:
            self.flush()
        if self.stack:
            self.stack.pop()

    def handle_data(self, data):
        if self.in_script:
            return
        if self.buf is not None:
            self.buf.append(data)


def digest(path, keep_prose=True):
    g = Grab()
    g.feed(Path(path).read_text(encoding="utf-8"))
    g.flush()
    out, seen = [], set()
    allow_p = False      # 설명 문장은 단계 첫 문단과 소제목 첫 문단만 (220자까지)
    for kind, text, label in g.items:
        key = (kind, text)
        if key in seen:
            continue
        seen.add(key)
        if kind == "h1":
            out.append(f"제목: {text}")
        elif kind == "h2":
            out.append(f"\n### {text}")
            allow_p = True
        elif kind == "h3":
            text = re.sub(r"^(\d+-\d+)(?=\S)", r"\1 ", text)   # 번호와 제목 사이 띄우기
            out.append(f"- {text}")
            allow_p = True
        elif kind == "cmd":
            if "에이전트" in label:
                out.append(f"    · 에이전트에게 말하기: {text}")
            else:
                out.append(f"    · 입력: {text}")
        elif kind == "q":
            out.append(f"- 질문: {text}")
        elif kind == "a":
            out.append(f"    답: {text}")
        elif kind in ("note", "tip"):
            out.append(f"    ※ {text}")
        elif kind in ("p", "li") and keep_prose and allow_p and len(text) > 25:
            out.append("    " + (text if len(text) <= 220 else text[:220].rstrip() + "…"))
            allow_p = False
    return "\n".join(out)


def main():
    header = (ROOT / "research/chat-ai/context-header.md").read_text(encoding="utf-8").strip()
    parts = [header]
    for no, rel, room in LESSONS:
        text = digest(ROOT / rel, keep_prose=True)
        if len(text) > MAX_CHARS:
            text = digest(ROOT / rel, keep_prose=False)      # 설명 문장을 빼고 다시
        parts.append(f"\n<<<LESSON {no}>>>\n(채팅방 이름: {room})\n{text}")
    out = "\n".join(parts).rstrip() + "\n"
    (ROOT / "assets/ai-context.md").write_text(out, encoding="utf-8", newline="\n")
    print("assets/ai-context.md", len(out), "글자")
    for no, rel, room in LESSONS:
        seg = out.split(f"<<<LESSON {no}>>>")[1].split("<<<LESSON")[0]
        print(f"  차시 {no}: {len(seg)}글자")


if __name__ == "__main__":
    sys.exit(main())
