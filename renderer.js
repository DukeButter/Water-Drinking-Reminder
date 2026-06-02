const encouragementMessages = [
  '水分 +1，圣光也 +1。',
  '宝完成了一次小小补水仪式。',
  '生命之水已收入背包，状态恢复中。',
  '圣杯轻轻发光，今天也在好好照顾自己。',
  '补给成功，心情和水分都亮了一格。',
  '今日圣水记录更新，宝很棒。'
];

const completeMessages = [
  '宝完成了今日补水仪式。',
  '圣水已满，今天的宝被好好照顾到了。',
  '生命之水收集完成，圣光也为你亮起来了。'
];

const cupsCount = document.querySelector('#cupsCount');
const goalCount = document.querySelector('#goalCount');
const cupWater = document.querySelector('#cupWater');
const drinkButton = document.querySelector('#drinkButton');
const undoButton = document.querySelector('#undoButton');
const encouragement = document.querySelector('#encouragement');
const goalInput = document.querySelector('#goalInput');
const pausedInput = document.querySelector('#pausedInput');
const startupInput = document.querySelector('#startupInput');
const progressFill = document.querySelector('#progressFill');
const progressSegments = document.querySelector('#progressSegments');
const intervalButtons = [...document.querySelectorAll('[data-minutes]')];

const segmentPalette = [
  { base: '#49c9f3', deep: '#268abd', glow: 'rgba(73, 201, 243, 0.5)' },
  { base: '#7be4ff', deep: '#36a9cf', glow: 'rgba(123, 228, 255, 0.52)' },
  { base: '#a9f1ff', deep: '#63c5da', glow: 'rgba(169, 241, 255, 0.55)' },
  { base: '#b8f6df', deep: '#69cba7', glow: 'rgba(184, 246, 223, 0.48)' },
  { base: '#d9f6a8', deep: '#9ecf62', glow: 'rgba(217, 246, 168, 0.5)' },
  { base: '#fff2a8', deep: '#d6b95c', glow: 'rgba(255, 242, 168, 0.58)' },
  { base: '#ffd86f', deep: '#d79b36', glow: 'rgba(255, 216, 111, 0.66)' },
  { base: '#ffbd45', deep: '#c87b22', glow: 'rgba(255, 189, 69, 0.72)' }
];
let currentState = null;
let completionTonePlayedForToday = false;

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function playCompletionTone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audioContext = new AudioContext();
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.9);
  gain.connect(audioContext.destination);

  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + index * 0.12);
    oscillator.connect(gain);
    oscillator.start(audioContext.currentTime + index * 0.12);
    oscillator.stop(audioContext.currentTime + 0.72 + index * 0.08);
  });

  window.setTimeout(() => audioContext.close(), 1100);
}

function celebrateCompletion() {
  document.body.classList.remove('ritual-complete-flash');
  window.requestAnimationFrame(() => {
    document.body.classList.add('ritual-complete-flash');
  });

  if (!completionTonePlayedForToday) {
    completionTonePlayedForToday = true;
    playCompletionTone();
  }
}

function renderProgressSegments(state) {
  if (!progressSegments) return;

  progressSegments.innerHTML = '';
  progressSegments.style.setProperty('--segment-count', state.goal);

  for (let index = 0; index < state.goal; index += 1) {
    const segment = document.createElement('span');
    const isFilled = index < state.cups;
    const charge = state.goal <= 1 ? 1 : index / (state.goal - 1);
    const paletteIndex = Math.min(segmentPalette.length - 1, Math.floor(charge * segmentPalette.length));
    const palette = segmentPalette[paletteIndex];

    segment.className = isFilled ? 'filled' : '';
    segment.style.setProperty('--charge', charge.toFixed(2));
    segment.style.setProperty('--segment-color', palette.base);
    segment.style.setProperty('--segment-deep', palette.deep);
    segment.style.setProperty('--segment-glow', palette.glow);
    progressSegments.appendChild(segment);
  }
}
function render(state) {
  currentState = state;

  const progress = Math.min(state.cups / state.goal, 1);
  const percent = Math.round(progress * 100);
  const isComplete = state.cups >= state.goal;

  cupsCount.textContent = state.cups;
  goalCount.textContent = state.goal;
  goalInput.value = state.goal;
  pausedInput.checked = state.paused;
  startupInput.checked = state.launchAtStartup;
  undoButton.disabled = state.cups <= 0;
  progressFill.style.width = `${percent}%`;
  renderProgressSegments(state);
  cupWater.style.height = `${Math.max(12, percent)}%`;
  document.body.classList.toggle('goal-complete', isComplete);

  if (!isComplete) {
    completionTonePlayedForToday = false;
  }

  intervalButtons.forEach((button) => {
    const isActive = Number(button.dataset.minutes) === state.intervalMinutes;
    button.classList.toggle('active', isActive);
  });
}

async function saveSettings(partialSettings) {
  const nextState = await window.waterApp.updateSettings(partialSettings);
  render(nextState);
}

drinkButton.addEventListener('click', async () => {
  const wasComplete = currentState && currentState.cups >= currentState.goal;
  const nextState = await window.waterApp.drinkWater();
  const isComplete = nextState.cups >= nextState.goal;

  render(nextState);
  encouragement.textContent = isComplete ? randomItem(completeMessages) : randomItem(encouragementMessages);
  drinkButton.classList.remove('pop');
  window.requestAnimationFrame(() => drinkButton.classList.add('pop'));

  if (isComplete && !wasComplete) {
    celebrateCompletion();
  }
});
undoButton.addEventListener('click', async () => {
  const nextState = await window.waterApp.undoWater();
  render(nextState);
  encouragement.textContent = '已撤回一杯，补水记录重新校准。';
});

goalInput.addEventListener('change', () => {
  const goal = Number(goalInput.value);
  saveSettings({ goal });
});

pausedInput.addEventListener('change', () => {
  saveSettings({ paused: pausedInput.checked });
});

startupInput.addEventListener('change', () => {
  saveSettings({ launchAtStartup: startupInput.checked });
});

intervalButtons.forEach((button) => {
  button.addEventListener('click', () => {
    saveSettings({ intervalMinutes: Number(button.dataset.minutes) });
  });
});

window.waterApp.onStateChanged(render);

window.waterApp.getState().then(render);