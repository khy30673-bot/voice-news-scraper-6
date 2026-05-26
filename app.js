'use strict';

/* ============================================================
   음성 뉴스 스크랩 — 통합 프로토타입
   조각 1: 진행 단계 음성 안내
   조각 2: 완료 신호 (분량 + 구성 + 강조 + 행동 안내)
   조각 3: 3계층 점진적 공개 (헤드라인 / 요약 / 전문)
   조각 4: 요약 먼저 읽기 (스트리밍 중 요약부터 음성 출력)
   ============================================================ */

/* ---------- 데이터 ---------- */
var QUESTION = '이번 주 한국은행 기준금리 관련 기사 찾아줘';

var ARTICLES = [
  {
    tag: '경제', fresh: true,
    headline: '한국은행, 기준금리 동결 결정',
    summary: '한국은행 금융통화위원회가 기준금리를 현 수준에서 동결했습니다. 물가 둔화세와 가계부채 부담을 함께 고려한 결정으로, 시장 예상과 부합했습니다.',
    full: '한국은행 금융통화위원회는 오늘 회의에서 기준금리를 현 수준으로 유지하기로 만장일치 결정했습니다. 위원회는 소비자물가 상승률이 목표 범위에 근접하고 있으나, 가계부채 증가세와 환율 변동성을 감안할 때 신중한 기조가 필요하다고 설명했습니다. 한국은행 총재는 향후 통화정책을 물가와 금융안정 상황을 균형 있게 보며 결정하겠다고 밝혔습니다.'
  },
  {
    tag: '경제', fresh: true,
    headline: '전문가들, 연내 금리 인하 시점 전망 엇갈려',
    summary: '기준금리 동결 이후 시장 전문가들의 연내 인하 전망이 엇갈리고 있습니다. 물가 경로와 미국 통화정책이 핵심 변수로 꼽힙니다.',
    full: '한국은행의 기준금리 동결 결정 이후 증권가에서는 연내 금리 인하 시점을 둘러싼 전망이 엇갈리고 있습니다. 일부 기관은 하반기 인하 가능성을 제시한 반면, 다른 기관은 물가 둔화 속도와 미국 연방준비제도의 정책 방향을 더 지켜봐야 한다며 신중론을 폈습니다. 공통적으로 환율과 가계부채가 핵심 변수로 지목됐습니다.'
  },
  {
    tag: '경제', fresh: true,
    headline: '기준금리 동결에 부동산·대출 시장 영향 주목',
    summary: '기준금리가 동결되면서 주택담보대출 금리와 부동산 시장에 미칠 영향에 관심이 쏠립니다.',
    full: '기준금리 동결 결정으로 주택담보대출 변동금리와 부동산 거래 심리에 미칠 영향이 주목받고 있습니다. 시장에서는 당분간 대출 금리가 큰 폭으로 움직이지 않을 것으로 보면서도, 향후 통화정책 방향에 따라 거래량이 달라질 수 있다고 분석했습니다. 금융당국은 가계부채 관리 기조를 유지하겠다고 밝혔습니다.'
  },
  {
    tag: '정치', fresh: false,
    headline: '국회 기재위, 통화정책 점검 청문회 일정 논의',
    summary: '국회 기획재정위원회가 한국은행 통화정책을 점검하기 위한 청문회 일정을 논의했습니다.',
    full: '국회 기획재정위원회는 최근 기준금리 결정과 가계부채 동향을 점검하기 위한 청문회 개최 일정을 논의했습니다. 여야는 청문회에서 물가 안정 대책과 금융 취약계층 지원 방안을 함께 다루기로 의견을 모았습니다. 구체적인 일정은 간사 간 협의를 거쳐 확정될 예정입니다.'
  }
];

/* ---------- 진행 단계 정의 ---------- */
var STEPS = [
  { label: '질문을 듣고 있습니다', voice: '질문을 듣고 있습니다.' },
  { label: '질문 인식 완료', voice: '질문이 인식되었습니다. ' + QUESTION },
  { label: '정보를 찾는 중입니다', voice: '정보를 찾는 중입니다. 잠시만 기다려 주세요.' },
  { label: '답변 문장을 작성하는 중입니다', voice: '답변 문장을 작성하는 중입니다.' }
];

/* ---------- TTS 엔진 ---------- */
var TTS = {
  enabled: true,
  rate: 0.8,
  voice: null,
  voices: [],
  voicesReady: false,            // 한국어 음성 목록 로딩 완료 여부
  supported: 'speechSynthesis' in window,
  _keepAliveTimer: null,         // Chrome 장문 음성 멈춤 버그 보정용

  init: function () {
    if (!this.supported) return;
    var self = this;
    function load() {
      var koVoices = window.speechSynthesis.getVoices().filter(function (v) {
        return v.lang && v.lang.toLowerCase().indexOf('ko') === 0;
      });
      if (koVoices.length > 0) {
        self.voices = koVoices;
        self.voicesReady = true;
      }
      self.populateSelect();
    }
    load();
    window.speechSynthesis.onvoiceschanged = load;
    /* 일부 브라우저는 onvoiceschanged가 늦거나 안 오므로, 안전망으로 재시도 */
    var tries = 0;
    var retry = setInterval(function () {
      tries++;
      if (self.voicesReady || tries > 20) { clearInterval(retry); return; }
      load();
    }, 250);
  },

  /* 음성 목록이 준비될 때까지 기다린 뒤 콜백 실행 (최대 약 3초) */
  whenReady: function (cb) {
    if (!this.supported || this.voicesReady) { cb(); return; }
    var self = this;
    var waited = 0;
    var timer = setInterval(function () {
      waited += 150;
      if (self.voicesReady || waited >= 3000) {
        clearInterval(timer);
        cb();
      }
    }, 150);
  },

  populateSelect: function () {
    var sel = document.getElementById('voice-select');
    if (!sel) return;
    if (this.voices.length === 0) {
      sel.innerHTML = '<option>한국어 음성 없음</option>';
      sel.disabled = true;
      var warn = document.getElementById('tts-warning');
      if (warn) warn.hidden = false;
      return;
    }
    sel.innerHTML = '';
    var self = this;
    this.voices.forEach(function (v, i) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = v.name;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    if (!this.voice) this.voice = this.voices[0];
    sel.onchange = function () { self.voice = self.voices[+sel.value]; };
  },

  speak: function (text, onEnd) {
    if (!this.supported || !this.enabled) {
      /* 음성이 꺼져 있으면 즉시 완료로 간주 (흐름이 멈추지 않도록) */
      if (onEnd) setTimeout(onEnd, 0);
      return;
    }
    var self = this;

    function doSpeak() {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = self.rate;
      if (self.voice) u.voice = self.voice;

      u.onend = function () {
        self._stopKeepAlive();
        if (onEnd) onEnd();
      };
      u.onerror = function () {
        self._stopKeepAlive();
        if (onEnd) onEnd();   // 오류가 나도 흐름이 멈추지 않도록
      };

      self._startKeepAlive();
      window.speechSynthesis.speak(u);
    }

    /* 진행 중 음성을 멈춘 뒤, 취소 처리가 끝날 시간을 짧게 두고 재생.
       cancel() 직후 곧바로 speak()하면 음성이 씹히는 브라우저 버그를 피한다. */
    window.speechSynthesis.cancel();
    setTimeout(doSpeak, 130);
  },

  /* Chrome은 약 15초 이상의 음성에서 재생이 임의로 멈추는 버그가 있다.
     주기적으로 pause/resume을 호출해 재생을 유지한다. */
  _startKeepAlive: function () {
    var self = this;
    this._stopKeepAlive();
    this._keepAliveTimer = setInterval(function () {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        self._stopKeepAlive();
      }
    }, 10000);
  },

  _stopKeepAlive: function () {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
    }
  },

  stop: function () {
    this._stopKeepAlive();
    if (this.supported) window.speechSynthesis.cancel();
  }
};


/* ---------- 화면 출력 (라이브 리전) ---------- */
function announce(text, kind, onEnd) {
  var box = document.getElementById('readout');
  document.getElementById('readout-text').textContent = text;
  box.className = 'readout' + (kind === 'done' ? ' done' : '');
  TTS.speak(text, onEnd);
}

function setTiming(text) {
  document.getElementById('timing').textContent = text || '';
}

/* ---------- 조각 1: 진행 단계 안내 렌더 ---------- */
function renderSteps(activeIdx) {
  var ol = document.getElementById('steps');
  ol.innerHTML = '';
  STEPS.forEach(function (s, i) {
    var li = document.createElement('li');
    var state = i < activeIdx ? 'done' : (i === activeIdx ? 'active' : '');
    li.className = state;
    var mark = document.createElement('span');
    mark.className = 'step-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = i < activeIdx ? '✓' : String(i + 1);
    var txt = document.createElement('span');
    txt.textContent = s.label;
    li.appendChild(mark);
    li.appendChild(txt);
    ol.appendChild(li);
  });
}

/* ---------- 조각 2: 완료 신호 생성 ---------- */
function buildCompletionMessage() {
  var total = ARTICLES.length;
  var freshCount = ARTICLES.filter(function (a) { return a.fresh; }).length;
  var cats = {};
  ARTICLES.forEach(function (a) { cats[a.tag] = (cats[a.tag] || 0) + 1; });
  var catPhrase = Object.keys(cats).map(function (k) {
    return k + ' ' + cats[k] + '건';
  }).join(', ');
  return '답변이 완료되었습니다. 기사 ' + total + '건을 찾았습니다. '
       + '구성은 ' + catPhrase + '이며, 이 중 ' + freshCount + '건은 오늘 새로 올라온 기사입니다. '
       + '가장 주목할 기사는 ' + ARTICLES[0].headline + '입니다. '
       + '위아래 화살표로 기사를 이동하고, 오른쪽 화살표로 자세히 펼치며, S 키로 스크랩할 수 있습니다.';
}

/* ---------- 조각 3 + 4: 기사 목록 상태 ---------- */
var state = {
  layers: ARTICLES.map(function () { return 0; }),   // 0=헤드라인 1=요약 2=전문
  scrapped: ARTICLES.map(function () { return false; }),
  focus: 0,
  running: false
};

function articleVoiceText(i) {
  var a = ARTICLES[i], layer = state.layers[i];
  var prefix = state.scrapped[i] ? '스크랩됨. ' : '';
  if (layer === 0) return prefix + '헤드라인. ' + a.tag + '. ' + a.headline + (a.fresh ? '. 오늘 새 기사.' : '.');
  if (layer === 1) return prefix + '요약. ' + a.summary;
  return prefix + '전문. ' + a.full;
}

function renderArticles() {
  var ul = document.getElementById('article-list');
  ul.innerHTML = '';
  ARTICLES.forEach(function (a, i) {
    var layer = state.layers[i];
    var li = document.createElement('li');
    li.className = 'article' + (i === state.focus ? ' focused' : '');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', i === state.focus ? 'true' : 'false');

    var head = document.createElement('div');
    head.className = 'article-head';

    var tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = a.tag;
    head.appendChild(tag);

    var hl = document.createElement('span');
    hl.className = 'headline';
    hl.textContent = a.headline;
    head.appendChild(hl);

    if (a.fresh) {
      var fr = document.createElement('span');
      fr.className = 'fresh';
      fr.textContent = '오늘';
      head.appendChild(fr);
    }

    var depth = document.createElement('span');
    depth.className = 'depth';
    depth.textContent = '●'.repeat(layer + 1) + '○'.repeat(2 - layer);
    depth.setAttribute('aria-label', (layer + 1) + '계층까지 펼침');
    head.appendChild(depth);

    if (state.scrapped[i]) {
      var sm = document.createElement('span');
      sm.className = 'scrap-mark';
      sm.textContent = '★';
      sm.setAttribute('aria-label', '스크랩됨');
      head.appendChild(sm);
    }
    li.appendChild(head);

    if (layer >= 1) {
      var sum = document.createElement('div');
      sum.className = 'article-body';
      sum.innerHTML = '<span class="body-label">요약</span>';
      sum.appendChild(document.createTextNode(a.summary));
      li.appendChild(sum);
    }
    if (layer >= 2) {
      var full = document.createElement('div');
      full.className = 'article-body full';
      full.innerHTML = '<span class="body-label">전문</span>';
      full.appendChild(document.createTextNode(a.full));
      /* 원문 링크가 있으면 클릭 가능한 링크로 제공 */
      if (a.link) {
        var linkWrap = document.createElement('div');
        linkWrap.style.marginTop = '0.5rem';
        var link = document.createElement('a');
        link.href = a.link;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = '원문 기사 보기 (새 창)';
        link.className = 'article-link';
        linkWrap.appendChild(link);
        full.appendChild(linkWrap);
      }
      li.appendChild(full);
    }

    li.addEventListener('click', function () {
      state.focus = i;
      renderArticles();
      document.getElementById('article-list').focus();
      announce(articleVoiceText(i), 'done');
    });

    ul.appendChild(li);
  });
}

/* ---------- 통합 흐름: 음성 질문 → 진행 안내 → 완료 → 결과 ---------- */
/* 진행 단계는 '음성이 끝나면 2초 쉬고 다음 단계'로 진행된다. */
function runFlow(spokenQuestion) {
  if (state.running) return;
  state.running = true;

  var micBtn = document.getElementById('mic-btn');
  var micLabel = document.getElementById('mic-label');
  var askBtn = document.getElementById('ask-btn');
  micBtn.disabled = true;
  askBtn.disabled = true;
  micBtn.classList.remove('listening');
  micLabel.textContent = '진행 중…';

  /* 인식된 질문을 화면에 표시 */
  var recoEl = document.getElementById('recognized-q');
  var query = spokenQuestion || '';
  if (query) {
    recoEl.textContent = query;
    recoEl.hidden = false;
  }

  document.getElementById('progress-panel').hidden = false;
  document.getElementById('results-panel').hidden = true;

  /* 새 질문마다 기사 상태 초기화 (가상 데이터 ARTICLES 사용) */
  state.layers = ARTICLES.map(function () { return 0; });
  state.scrapped = ARTICLES.map(function () { return false; });
  state.focus = 0;

  var startTime = Date.now();
  function elapsed() { return ((Date.now() - startTime) / 1000).toFixed(1); }

  var GAP = 2000;   // 단계 음성이 끝난 뒤 다음 단계까지의 쉬는 간격(2초)

  /* 진행 단계를 하나씩, 음성이 끝나면 2초 쉬고 다음으로 */
  function runStep(i) {
    if (i >= STEPS.length) {
      /* 모든 진행 단계 완료 → 요약 먼저 읽기 → 완료 신호 */
      afterSteps();
      return;
    }
    renderSteps(i);
    announce(STEPS[i].voice, 'progress', function () {
      setTimeout(function () { runStep(i + 1); }, GAP);
    });
  }

  /* 진행 단계 이후: 요약 먼저 읽기 → 완료 신호 */
  function afterSteps() {
    /* 조각 4: 요약 먼저 읽기 — 첫 기사 요약을 먼저 안내 */
    announce('[요약 먼저 읽기] 첫 기사 요약입니다. ' + ARTICLES[0].summary, 'done', function () {
      setTimeout(function () {
        /* 조각 2: 완료 신호 */
        renderSteps(STEPS.length);
        document.getElementById('results-panel').hidden = false;
        renderArticles();
        announce(buildCompletionMessage(), 'done');
        setTiming('전체 답변 완료: ' + elapsed() + '초');
        micBtn.disabled = false;
        askBtn.disabled = false;
        micLabel.textContent = '마이크 켜고 질문하기';
        state.running = false;
        setTimeout(function () {
          document.getElementById('article-list').focus();
        }, 300);
      }, GAP);
    });
    setTiming('요약 음성 시작: ' + elapsed() + '초 — 전체 답변 완료 전 시점');
  }

  runStep(0);
}

/* ---------- 조각 3: 키보드 탐색 ---------- */
function handleKey(e) {
  var i = state.focus;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (i < ARTICLES.length - 1) state.focus++;
    renderArticles();
    announce(articleVoiceText(state.focus), 'done');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (i > 0) state.focus--;
    renderArticles();
    announce(articleVoiceText(state.focus), 'done');
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (state.layers[i] < 2) {
      state.layers[i]++;
      renderArticles();
      announce(articleVoiceText(i), 'done');
    } else {
      announce('이미 전문까지 펼쳐졌습니다.', 'done');
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (state.layers[i] > 0) {
      state.layers[i]--;
      renderArticles();
      announce(articleVoiceText(i), 'done');
    } else {
      announce('이미 헤드라인 단계입니다.', 'done');
    }
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    state.scrapped[i] = !state.scrapped[i];
    renderArticles();
    announce((state.scrapped[i] ? '스크랩했습니다. ' : '스크랩을 취소했습니다. ') + ARTICLES[i].headline, 'done');
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    announce(articleVoiceText(i), 'done');
  }
}

/* ---------- voice-first 진입 흐름 ---------- */
var entryDismissed = false;   // 진입 화면이 닫혔는지 — '탭하면 멈춤'은 이후에만 작동

function setupEntryScreen() {
  var entry = document.getElementById('entry-screen');

  /* TTS 음성은 사용자 행동 이후에야 재생되므로,
     진입 안내 음성은 첫 행동 직후에 한 번 들려준다.
     음성 목록이 준비된 뒤 재생해야 안내가 누락되지 않는다. */
  function dismissEntry() {
    if (entryDismissed) return;
    entryDismissed = true;
    entry.classList.add('dismissed');

    function startMic() {
      var micBtn = document.getElementById('mic-btn');
      var micLabel = document.getElementById('mic-label');
      micBtn.classList.add('listening');
      micLabel.textContent = '듣는 중…';
      VoiceInput.start();
    }

    /* 누른 즉시 텍스트 안내를 먼저 표시 — 음성 준비를 기다리는 동안에도
       '반응했다'는 신호를 주어 사용자가 불안하지 않게 한다. */
    var readoutText = document.getElementById('readout-text');
    if (readoutText) {
      readoutText.textContent = '음성 뉴스 스크랩을 시작합니다. 곧 마이크 권한을 안내합니다.';
      document.getElementById('readout').className = 'readout';
    }

    /* 음성 목록이 준비될 때까지 기다린 뒤 진입 안내 재생.
       안내 음성이 끝나면 0.6초 쉬고 권한 안내·음성 입력으로 넘어간다.
       (고정 타이머가 아니라 음성 완료 기준이라 어떤 상태에서도 안정적) */
    TTS.whenReady(function () {
      announce('음성 뉴스 스크랩을 시작합니다. 곧 마이크 권한을 안내합니다.', 'progress',
        function () {
          setTimeout(startMic, 600);
        });
      /* 음성이 꺼져 있거나 onEnd가 끝내 오지 않는 경우의 안전망 */
      setTimeout(function () {
        if (!VoiceInput.listening) startMic();
      }, 6000);
    });
  }

  /* 화면 아무 곳 클릭/탭, 또는 아무 키 입력으로 시작 */
  entry.addEventListener('click', dismissEntry);
  entry.addEventListener('keydown', function (e) {
    e.preventDefault();
    dismissEntry();
  });
  document.addEventListener('keydown', function once(e) {
    if (entryDismissed) { document.removeEventListener('keydown', once); return; }
    e.preventDefault();
    dismissEntry();
  });

  /* 진입 화면에 자동 포커스 — 키보드/스크린리더 사용자가 바로 시작 가능 */
  entry.focus();
}

/* ---------- 음성 멈춤 제어: 화면 아무 곳이나 누르면 즉시 멈춤 ---------- */
function setupTapToStop() {
  function stopSpeech(e) {
    /* 진입 화면이 아직 열려 있으면 무시 (진입의 '눌러서 시작'과 충돌 방지) */
    if (!entryDismissed) return;
    /* 음성이 재생 중이 아니면 무시 */
    if (!TTS.supported || !window.speechSynthesis.speaking) return;
    /* 컨트롤(버튼·슬라이더·기사목록 등) 조작은 멈춤 대상에서 제외 */
    var t = e.target;
    if (t.closest && t.closest('button, input, select, a, #article-list')) return;

    TTS.stop();
    announce('음성을 멈췄습니다. 다시 들으려면 R 키를 누르거나 기사를 다시 선택하세요. ' +
             '말하기 속도는 설정에서 조절할 수 있습니다.', 'progress');
  }
  document.addEventListener('click', stopSpeech);
}

/* ---------- 초기화 ---------- */
document.addEventListener('DOMContentLoaded', function () {
  TTS.init();

  /* 음성 입력 모듈 연결: 안내는 announce()로, 인식 결과는 runFlow()로 */
  var voiceOk = VoiceInput.init(
    function (msg, kind) { announce(msg, kind); },
    function (recognizedText) { runFlow(recognizedText); }
  );

  setupEntryScreen();
  setupTapToStop();

  var micBtn = document.getElementById('mic-btn');
  var micLabel = document.getElementById('mic-label');

  micBtn.addEventListener('click', function () {
    if (state.running) return;
    micBtn.classList.add('listening');
    micLabel.textContent = '듣는 중…';
    VoiceInput.start();
  });

  /* 음성 인식 미지원 시 마이크 버튼을 안내용으로 처리 */
  if (!voiceOk) {
    micLabel.textContent = '음성 인식 미지원 — 예시 질문 사용';
  }

  /* 예시 질문(대체) 버튼 — 음성 없이 진행 */
  document.getElementById('ask-btn').addEventListener('click', function () {
    runFlow(QUESTION);
  });

  document.getElementById('article-list').addEventListener('keydown', handleKey);

  var rate = document.getElementById('rate');
  rate.addEventListener('input', function () {
    TTS.rate = parseFloat(rate.value);
    document.getElementById('rate-out').textContent = TTS.rate.toFixed(1) + 'x';
  });

  var toggle = document.getElementById('tts-toggle');
  toggle.addEventListener('click', function () {
    TTS.enabled = !TTS.enabled;
    toggle.setAttribute('aria-checked', TTS.enabled ? 'true' : 'false');
    toggle.textContent = TTS.enabled ? '켜짐' : '꺼짐';
    if (!TTS.enabled) TTS.stop();
  });

  if (!TTS.supported) {
    document.getElementById('tts-warning').hidden = false;
    document.getElementById('voice-select').disabled = true;
  }
});
