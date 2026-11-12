"""intro03.html (시간으로 움직이는 모션 그래픽)을 프레임으로 찍어 MP4로 만듭니다.

필요: pip install websocket-client imageio-ffmpeg   (임시 가상환경에서 설치하세요)
사용:
  python render_video.py preview out_dir 1,3.5,8     # 지정한 시각(초)의 그림만 PNG로
  python render_video.py video   out_dir 03-intro.mp4 [fps]   # 30초 영상 (기본 30fps, 1920x1080)
브라우저는 이 PC의 Microsoft Edge 를 헤드리스로 띄워 DevTools 프로토콜로 한 프레임씩 찍습니다.
"""
import base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
import websocket

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = "file:///" + os.path.join(HERE, "intro03.html").replace("\\", "/")
PORT = 9333
DURATION = 30.0


class Edge:
    def __init__(self):
        self.profile = tempfile.mkdtemp(prefix="edge-video-")
        self.proc = subprocess.Popen([EDGE, "--headless=new", f"--remote-debugging-port={PORT}", f"--user-data-dir={self.profile}",
                                      "--window-size=1920,1080", "--hide-scrollbars", "--disable-gpu", "--allow-file-access-from-files", "about:blank"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ws_url = None
        for _ in range(60):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=2))
                pages = [t for t in tabs if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if not ws_url:
            raise RuntimeError("Edge 에 연결하지 못했습니다")
        self.ws = websocket.create_connection(ws_url, max_size=None, timeout=60)
        self.n = 0
        self.call("Page.enable")
        self.call("Emulation.setDeviceMetricsOverride", width=1920, height=1080, deviceScaleFactor=1, mobile=False)
        self.call("Page.navigate", url=PAGE)
        for _ in range(60):
            r = self.call("Runtime.evaluate", expression="document.readyState === 'complete' && typeof render === 'function'", returnByValue=True)
            if r["result"]["result"].get("value"):
                break
            time.sleep(0.25)
        time.sleep(0.6)

    def call(self, method, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.n:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg

    def shot(self, t, path):
        self.call("Runtime.evaluate", expression=f"render({t})")
        data = self.call("Page.captureScreenshot", format="png")["result"]["data"]
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass
        self.proc.terminate()
        try:
            self.proc.wait(10)
        except Exception:
            self.proc.kill()
        shutil.rmtree(self.profile, ignore_errors=True)


def main():
    mode, out = sys.argv[1], sys.argv[2]
    e = Edge()
    try:
        if mode == "preview":
            os.makedirs(out, exist_ok=True)
            for s in sys.argv[3].split(","):
                e.shot(float(s), os.path.join(out, f"t{float(s):05.2f}.png"))
            print("preview", out)
        else:
            import imageio_ffmpeg
            fps = int(sys.argv[4]) if len(sys.argv) > 4 else 30
            frames = os.path.join(os.path.dirname(os.path.abspath(out)), "_frames")
            shutil.rmtree(frames, ignore_errors=True)
            os.makedirs(frames)
            total = int(DURATION * fps)
            t0 = time.time()
            for i in range(total):
                e.shot(i / fps, os.path.join(frames, f"f{i:05d}.png"))
                if i % 90 == 0:
                    print(f"  {i}/{total} ({time.time() - t0:.0f}초)", flush=True)
            ff = imageio_ffmpeg.get_ffmpeg_exe()
            subprocess.run([ff, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", os.path.join(frames, "f%05d.png"),
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out], check=True)
            shutil.rmtree(frames, ignore_errors=True)
            print("완료:", out, os.path.getsize(out), "bytes")
    finally:
        e.close()


if __name__ == "__main__":
    main()
