/**
 * 수요 AI 에이전트 빌더스 · 사전 설문 저장소
 * 구글 스프레드시트 > 확장 프로그램 > Apps Script 에 이 코드를 붙여 넣고
 * "웹 앱"으로 배포하세요. (README.md 참고)
 *
 * 한 사람 = 한 줄. 이름 + 비밀번호 4자리로 본인 응답을 불러오고 고칩니다.
 * 비밀번호는 해시로만 저장하며, B열을 비우면 그 사람의 비밀번호가 초기화됩니다.
 */
const SHEET_NAME = '응답';
const HEADERS = ['key', 'pin', '이름', '기대하는 것', '구독 AI', '참여 가능일', '하고 싶은 말', '처음 제출', '마지막 수정'];
const LIMITS = { name: 30, wants: 800, memo: 400 };
const AI_OPTIONS = ['Claude', 'ChatGPT', 'Gemini', 'Grok', '아직 없음'];
const DATE_OPTIONS = ['10.21', '10.28', '11.04', '11.11', '12.02', '12.09', '12.16'];
const MAX_FAILS = 5;          // 비밀번호 연속 오류 허용 횟수
const LOCK_SECONDS = 600;     // 초과 시 잠금 시간 (10분)

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange('A:I').setNumberFormat('@'); // 10.21 같은 날짜가 숫자로 바뀌지 않도록 텍스트 서식
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.hideColumns(1, 2); // key, pin 은 숨김
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 시트에서 수식으로 실행되지 않도록 = + - @ 로 시작하는 값 앞에 ' 를 붙임
function clean_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function unquote_(s) {
  s = String(s == null ? '' : s);
  return s.charAt(0) === "'" ? s.slice(1) : s;
}
function pick_(arr, allowed) {
  return (Array.isArray(arr) ? arr : []).filter(v => allowed.indexOf(v) !== -1).join(', ');
}
function split_(s) {
  return String(s || '').split(',').map(v => v.trim()).filter(Boolean);
}
// 띄어쓰기·대소문자 차이는 같은 이름으로 봄
function key_(name) {
  return String(name || '').replace(/\s+/g, '').toLowerCase();
}
function hash_(key, pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'wab2026:' + key + ':' + pin, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}
function toRow_(r) {
  return { name: unquote_(r[2]), wants: unquote_(r[3]), ai: split_(r[4]), dates: split_(r[5]), memo: unquote_(r[6]) };
}
function find_(sh, key) {
  const values = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < values.length; i++) if (values[i][0] === key) return { index: i + 1, values: values[i] };
  return null;
}

// 비밀번호 오류 횟수 관리
function locked_(key) {
  return Number(CacheService.getScriptCache().get('fail:' + key) || 0) >= MAX_FAILS;
}
function fail_(key) {
  const c = CacheService.getScriptCache();
  c.put('fail:' + key, String(Number(c.get('fail:' + key) || 0) + 1), LOCK_SECONDS);
}
function clearFails_(key) {
  CacheService.getScriptCache().remove('fail:' + key);
}

// 결과판: 비밀번호를 뺀 모든 응답
function doGet() {
  const values = sheet_().getDataRange().getDisplayValues().slice(1);
  return json_({ ok: true, rows: values.filter(r => r[0]).map(toRow_) });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_input' }); }
  const name = clean_(d.name, LIMITS.name);
  const pin = String(d.pin || '');
  const key = key_(name);
  if (!key || !/^[0-9]{4}$/.test(pin)) return json_({ ok: false, error: 'bad_input' });
  if (locked_(key)) return json_({ ok: false, error: 'locked' });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sh = sheet_();
    const found = find_(sh, key);
    const pinHash = hash_(key, pin);
    // B열이 비어 있으면(운영자가 초기화) 이번에 넣은 비밀번호를 새로 등록
    const pinMatches = found && (!found.values[1] || found.values[1] === pinHash);

    if (d.action === 'load') {
      if (!found) return json_({ ok: false, error: 'not_found' });
      if (!pinMatches) { fail_(key); return json_({ ok: false, error: 'bad_pin' }); }
      clearFails_(key);
      return json_({ ok: true, row: toRow_(found.values) });
    }

    if (d.action === 'save') {
      const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
      const row = [key, pinHash, name, clean_(d.wants, LIMITS.wants), pick_(d.ai, AI_OPTIONS), pick_(d.dates, DATE_OPTIONS), clean_(d.memo, LIMITS.memo)];
      if (found) {
        if (!pinMatches) { fail_(key); return json_({ ok: false, error: 'bad_pin' }); }
        clearFails_(key);
        sh.getRange(found.index, 1, 1, 9).setValues([row.concat([found.values[7], now])]);
        return json_({ ok: true, updated: true });
      }
      sh.appendRow(row.concat([now, now]));
      return json_({ ok: true, created: true });
    }

    return json_({ ok: false, error: 'bad_input' });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}
