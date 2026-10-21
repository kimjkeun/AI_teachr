/* 왼쪽 목차(#toc)에서 지금 보고 있는 단계를 표시 */
(() => {
  const links = [...document.querySelectorAll("#toc a[href^='#']")];
  const pairs = links.map(a => [a, document.getElementById(a.getAttribute("href").slice(1))]).filter(p => p[1]);
  if (!pairs.length) return;
  let cur = null, ticking = false;
  const update = () => {
    ticking = false;
    const line = 120;
    let hit = null;
    for (const [a, sec] of pairs) if (sec.getBoundingClientRect().top <= line) hit = a;
    // 맨 아래까지 내리면 마지막 항목
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) hit = pairs[pairs.length - 1][0];
    if (hit === cur) return;
    if (cur) { cur.classList.remove("now"); cur.removeAttribute("aria-current"); }
    cur = hit;
    if (cur) { cur.classList.add("now"); cur.setAttribute("aria-current", "location"); }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();
})();
