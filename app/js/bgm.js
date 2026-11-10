// 배경음악: 시작 버튼을 누르면 반복 재생하고, 버튼 하나로 켜고 끈다.
// 브라우저는 사용자가 누르기 전에는 소리를 못 내게 하므로, 첫 재생은 시작 버튼 클릭 안에서 부른다.
// 켬/끔은 이 기기에 기억해 둔다(다음에 열어도 꺼 둔 상태 유지).

const KEY = 'herschel-bgm-muted';

/** button: 켜기/끄기 버튼, opts: { src, volume, labelOn, labelOff } */
export function createBgm(button, { src, volume, labelOn, labelOff }) {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = volume;

  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* 저장소를 못 쓰는 브라우저 */ }
  let started = false;

  function render() {
    button.textContent = muted ? '🔇' : '🔊';
    button.title = button.ariaLabel = muted ? labelOff : labelOn;
    button.classList.toggle('off', muted);
  }

  function play() {
    if (muted || !started || document.hidden) return;
    audio.play().catch(() => { /* 자동 재생이 막히면 다음 클릭 때 다시 시도 */ });
  }

  button.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* 무시 */ }
    started = true;
    if (muted) audio.pause(); else play();
    render();
  });

  // 다른 앱·탭으로 가면 멈추고, 돌아오면 이어서 튼다
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause(); else play();
  });

  render();
  return {
    /** 시작 버튼을 누를 때 부른다 */
    start() { started = true; play(); },
  };
}
