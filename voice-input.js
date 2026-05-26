'use strict';

/* ============================================================
   음성 입력 모듈 — 마이크 권한 접근성 안내 + 음성 인식(STT)
   저시력 사용자를 위해 권한 요청의 전/후 상황을 음성·텍스트로 안내
   ============================================================ */

var VoiceInput = {
  recognition: null,
  supported: false,
  listening: false,
  onResult: null,        // 인식 완료 시 호출될 콜백 (텍스트 전달)
  onAnnounce: null,      // 안내 메시지를 화면/음성으로 내보낼 콜백

  /* 브라우저 지원 여부 확인 및 초기화 */
  init: function (announceFn, resultFn) {
    this.onAnnounce = announceFn;
    this.onResult = resultFn;

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.supported = false;
      return false;
    }
    this.supported = true;
    this.recognition = new SR();
    this.recognition.lang = 'ko-KR';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    var self = this;

    this.recognition.onresult = function (e) {
      var text = e.results[0][0].transcript;
      self.listening = false;
      self.announce('말씀하신 내용을 인식했습니다. ' + text, 'done');
      if (self.onResult) self.onResult(text);
    };

    this.recognition.onerror = function (e) {
      self.listening = false;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        self.announce(
          '마이크 권한이 거부되어 음성 입력을 사용할 수 없습니다. ' +
          '브라우저 주소창 옆의 자물쇠 아이콘에서 마이크를 허용으로 바꾼 뒤 다시 시도해 주세요. ' +
          '음성 입력 없이 진행하려면 아래 예시 질문 버튼을 이용할 수 있습니다.',
          'warn'
        );
      } else if (e.error === 'no-speech') {
        self.announce('음성이 감지되지 않았습니다. 마이크 버튼을 다시 누르고 또렷하게 말씀해 주세요.', 'warn');
      } else if (e.error === 'audio-capture') {
        self.announce('마이크 장치를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해 주세요.', 'warn');
      } else {
        self.announce('음성 인식 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'warn');
      }
    };

    this.recognition.onend = function () {
      self.listening = false;
    };

    return true;
  },

  announce: function (msg, kind) {
    if (this.onAnnounce) this.onAnnounce(msg, kind);
  },

  /* 현재 마이크 권한 상태를 미리 조회 (지원 브라우저 한정) */
  checkPermission: function () {
    if (!navigator.permissions || !navigator.permissions.query) {
      return Promise.resolve('unknown');
    }
    return navigator.permissions.query({ name: 'microphone' })
      .then(function (status) { return status.state; })
      .catch(function () { return 'unknown'; });
  },

  /* 권한 안내 → 음성 인식 시작 전체 흐름 */
  start: function () {
    if (!this.supported) {
      this.announce(
        '이 브라우저는 음성 인식을 지원하지 않습니다. ' +
        '크롬 또는 엣지 브라우저에서 열면 음성으로 질문할 수 있습니다. ' +
        '지금은 아래 예시 질문 버튼으로 진행해 주세요.',
        'warn'
      );
      return;
    }
    if (this.listening) return;

    var self = this;

    this.checkPermission().then(function (state) {
      if (state === 'granted') {
        /* 이미 허용된 상태 — 바로 듣기 시작 */
        self.beginListening();
      } else if (state === 'denied') {
        self.announce(
          '마이크 권한이 차단되어 있습니다. ' +
          '브라우저 주소창 옆 자물쇠 아이콘을 눌러 마이크를 허용으로 바꾼 뒤 다시 시도해 주세요.',
          'warn'
        );
      } else {
        /* 권한을 아직 안 물어봤거나 알 수 없음 — 팝업 전에 미리 안내 */
        self.announce(
          '잠시 후 브라우저가 마이크 사용 권한을 묻는 창을 띄웁니다. ' +
          '음성으로 질문하려면 허용을 선택해 주세요. 창은 화면 위쪽에 나타납니다.',
          'progress'
        );
        /* 사용자가 안내를 듣고 인지할 시간을 준 뒤 권한 요청 */
        setTimeout(function () { self.beginListening(); }, 2600);
      }
    });
  },

  /* 실제 음성 인식 시작 (이 시점에 권한 팝업이 뜰 수 있음) */
  beginListening: function () {
    if (this.listening) return;
    this.listening = true;
    this.announce('지금 듣고 있습니다. 질문을 말씀해 주세요.', 'progress');
    try {
      this.recognition.start();
    } catch (err) {
      this.listening = false;
      this.announce('음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.', 'warn');
    }
  },

  /* 듣기 중단 */
  stop: function () {
    if (this.recognition && this.listening) {
      this.recognition.stop();
      this.listening = false;
    }
  }
};
