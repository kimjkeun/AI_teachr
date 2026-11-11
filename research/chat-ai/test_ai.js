// apps-script.gs 의 AI 부분을 가짜 Apps Script 환경에서 시험 (실제 OpenAI 호출 없음)
const fs = require("fs");
const vm = require("vm");

function makeEnv(propsInit, fetchImpl) {
  const props = Object.assign({}, propsInit);
  const cache = {};
  const rows = [["id", "room", "kind", "이름", "내용", "시각", "강사", "삭제"]];
  const fetches = [];
  const env = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: (d, tz, f) => env.__today, computeDigest: () => [], base64Encode: () => "", DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 } },
    ContentService: { createTextOutput: (s) => ({ setMimeType: () => ({ text: s }) }), MimeType: { JSON: 1 } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getLastRow: () => rows.length,
        appendRow: (r) => rows.push(r),
        getDataRange: () => ({ getValues: () => rows, getDisplayValues: () => rows.map(r => r.map(String)) }),
        getRange: () => ({ setValue() {}, getDisplayValues: () => [] }),
      }) }) },
    UrlFetchApp: { fetch: (url, opt) => { fetches.push({ url, opt }); return fetchImpl(url, opt); } },
    __today: "2026-11-12",
  };
  vm.createContext(env);
  vm.runInContext(fs.readFileSync(process.argv[2], "utf8"), env);
  return { env, props, cache, rows, fetches };
}
const ok200 = (text) => () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ choices: [{ message: { content: text } }] }) });
const call = (E, d) => JSON.parse(E.env.chatPost_(Object.assign({ room: "lesson03", action: "chat_ai", cid: "abcdef123456" }, d)).setMimeType ? "{}" : "{}");
function post(E, d) { const r = E.env.doPost({ postData: { contents: JSON.stringify(Object.assign({ room: "lesson03", action: "ai_ask", name: "김선생", text: "엑셀 평균은 어떻게 구해요?", cid: "abcdef1234567" }, d)) } }); return JSON.parse(r.text || r.setMimeType().text); }

let pass = 0, fail = 0;
const t = (name, cond, extra) => { if (cond) { pass++; console.log("  OK  ", name); } else { fail++; console.log("  FAIL", name, extra || ""); } };

// 1) 키/모델이 없으면 꺼진 상태
let E = makeEnv({}, ok200("답"));
t("키 없음 -> ai_off", post(E, {}).error === "ai_off");
t("키 없으면 OpenAI 를 부르지 않음", E.fetches.length === 0);

// 2) 정상 호출
E = makeEnv({ OPENAI_API_KEY: "sk-TEST", OPENAI_MODEL: "model-x" }, ok200("평균은 AVERAGE 함수를 쓰면 됩니다."));
let r = post(E, {});
t("정상 -> ok", r.ok === true, JSON.stringify(r));
t("OpenAI 에 한 번 호출", E.fetches.length === 1);
const sent = JSON.parse(E.fetches[0].opt.payload);
t("모델 이름은 스크립트 속성에서", sent.model === "model-x");
t("출력 상한 max_completion_tokens 전송", sent.max_completion_tokens === 1000);
t("키는 헤더로만 (본문에 없음)", E.fetches[0].opt.headers.Authorization === "Bearer sk-TEST" && !E.fetches[0].opt.payload.includes("sk-TEST"));
t("질문자 이름·번호는 OpenAI 로 보내지 않음", !E.fetches[0].opt.payload.includes("김선생") && !E.fetches[0].opt.payload.includes("abcdef"));
t("시트에 질문과 AI 답 2줄 추가", E.rows.length === 3 && E.rows[1][2] === "msg" && E.rows[1][4].replace(/^'/, "").startsWith("@AI ") && E.rows[2][2] === "ai" && E.rows[2][3] === "AI");
t("응답 메시지 목록에 ai 종류 포함", Array.isArray(r.messages) && r.messages.some(m => m.kind === "ai"));
t("시트의 ' 는 읽을 때 사라져 \"@AI 질문\"으로 보임", r.messages.some(m => m.text.startsWith("@AI ")));

// 3) 거름: 개인정보, 이름 사칭, 잘못된 입력
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, ok200("답"));
t("전화번호 -> pii", post(E, { text: "김철수 010-1234-5678 학부모 문자 써줘" }).error === "pii");
t("주민번호 모양 -> pii", post(E, { text: "901231-1234567 이 학생", cid: "zzzzzzzz11111" }).error === "pii");
t("pii 는 OpenAI 로 안 감", E.fetches.length === 0);
t("이름이 AI -> bad_input", post(E, { name: "AI", cid: "qqqqqqqq22222" }).error === "bad_input");
t("cid 가 너무 짧으면 -> bad_input", post(E, { cid: "abc" }).error === "bad_input");
t("빈 질문 -> bad_input", post(E, { text: "   ", cid: "wwwwwwww33333" }).error === "bad_input");
// 일반 채팅에서 'AI' 이름 사칭 막기
r = JSON.parse(E.env.chatPost_({ room: "lesson03", action: "chat", name: " a I ", text: "안녕", kind: "msg" }).setMimeType ? "" : "{}" ) ;

// 4) 연속 질문 간격, 사용자당 20회, 하루 전체 300회
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, ok200("답"));
post(E, {});
t("바로 다시 물으면 too_fast", post(E, {}).error === "too_fast");
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, ok200("답"));
let okCount = 0, last;
for (let i = 0; i < 25; i++) { E.cache = null; for (const k of Object.keys(E.cache || {})) delete E.cache[k]; last = post(E, { cid: "user0000000001" }); if (last.ok) okCount++; Object.keys(E.env).length; E.env.CacheService.getScriptCache().remove("airate:user00000000"); }
t("한 사람은 20번까지만 성공", okCount === 20, "성공 " + okCount);
t("21번째는 ai_user_limit", last.error === "ai_user_limit");
t("다른 사람은 아직 가능", (E.env.CacheService.getScriptCache().remove("airate:other00000001"), post(E, { cid: "other00000001" }).ok === true));

E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, ok200("답"));
let total = 0, lastErr;
for (let i = 0; i < 320; i++) { const cid = "u" + String(i).padStart(8, "0") + "xyz"; const x = post(E, { cid }); if (x.ok) total++; else lastErr = x.error; }
t("하루 전체 300번까지만 성공", total === 300, "성공 " + total);
t("300번 넘으면 ai_day_limit", lastErr === "ai_day_limit");
E.env.__today = "2026-11-13";
t("다음 날 0시(한국 시간)에 초기화", post(E, { cid: "newday000001x" }).ok === true);

// 5) OpenAI 실패 시 횟수를 되돌림
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, () => ({ getResponseCode: () => 429, getContentText: () => "{}" }));
r = post(E, { cid: "fail0000000001" });
t("OpenAI 429 -> ai_failed", r.error === "ai_failed");
t("실패하면 사용 횟수를 되돌림", JSON.parse(E.props.AI_USAGE).total === 0 && JSON.parse(E.props.AI_USAGE).users["fail00000000"] === 0, E.props.AI_USAGE);
t("실패하면 시트에 아무것도 안 씀", E.rows.length === 1);
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, () => { throw new Error("network"); });
t("네트워크 예외 -> ai_failed", post(E, { cid: "net00000000001" }).error === "ai_failed");
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, ok200("   "));
t("빈 답 -> ai_failed", post(E, { cid: "empty000000001" }).error === "ai_failed");

// 6) 끄기 스위치
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m", AI_ENABLED: "off" }, ok200("답"));
t("AI_ENABLED=off -> ai_off", post(E, {}).error === "ai_off" && E.fetches.length === 0);

// 7) 긴 답은 잘라서 저장, 시트 수식 방지
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, ok200("=HYPERLINK(\"x\")" + "가".repeat(2000)));
post(E, { cid: "long0000000001" });
t("답은 900자까지만 저장", E.rows[2][4].length <= 901, E.rows[2][4].length);
t("=로 시작하는 답은 수식으로 실행되지 않게 ' 를 붙임", E.rows[2][4].startsWith("'="));
E = makeEnv({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m" }, ok200("답"));
post(E, { text: "가".repeat(500), cid: "q0000000000001" });
t("질문은 300자까지만 OpenAI 로 보냄", JSON.parse(E.fetches[0].opt.payload).messages[1].content.length === 300);

// 8) 일반 채팅의 AI 이름 사칭 방지
E = makeEnv({}, ok200("답"));
const rr = E.env.doPost({ postData: { contents: JSON.stringify({ room: "lesson03", action: "chat", name: "A I", text: "저는 AI입니다", kind: "msg" }) } });
const body = JSON.parse(rr.text || rr.setMimeType().text);
t("일반 채팅에서 이름 'A I' 는 거부", body.error === "bad_name", JSON.stringify(body));
console.log("\n통과 " + pass + " / 실패 " + fail);
process.exit(fail ? 1 : 0);

