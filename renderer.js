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

const coinMessages = [
  '今日目标完成，像素金币 +1。',
  '圣水补给达标，金币收入小金库。',
  '今日仪式圆满，获得一枚亮闪闪金币。'
];

const cupsCount = document.querySelector('#cupsCount');
const goalCount = document.querySelector('#goalCount');
const coinCount = document.querySelector('#coinCount');
const blessingCoinCount = document.querySelector('#blessingCoinCount');
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
const blessingButton = document.querySelector('#blessingButton');
const blessingStatus = document.querySelector('#blessingStatus');
const blessingResult = document.querySelector('#blessingResult');
const blessingOverlay = document.querySelector('#blessingOverlay');
const developerBadge = document.querySelector('#developerBadge');
const rewardSlot = document.querySelector('#rewardSlot');
const slotRewardIcon = document.querySelector('#slotRewardIcon');
const slotRewardName = document.querySelector('#slotRewardName');
const slotRewardValue = document.querySelector('#slotRewardValue');
const rewardCard = document.querySelector('#rewardCard');
const rewardIcon = document.querySelector('#rewardIcon');
const rewardTitle = document.querySelector('#rewardTitle');
const rewardSubtitle = document.querySelector('#rewardSubtitle');

const blessingRollItems = [
  { label: '5 圣水金币', value: '+5', rarity: 'common', icon: 'gold-small' },
  { label: '10 圣水金币', value: '+10', rarity: 'common', icon: 'gold-small' },
  { label: '20 圣水金币', value: '+20', rarity: 'rare', icon: 'gold-large' },
  { label: '50 圣水金币', value: '+50', rarity: 'epic', icon: 'chest-open' },
  { label: '稀有外观碎片', value: '+1', rarity: 'legendary', icon: 'fragment' },
  { label: '蓝宝石圣物', value: '???', rarity: 'legendary', icon: 'sapphire' },
  { label: '钻石圣物', value: '???', rarity: 'legendary', icon: 'diamond' },
  { label: '封印宝箱', value: '???', rarity: 'epic', icon: 'chest-closed' },
  { label: '大量圣水金币', value: '+50', rarity: 'epic', icon: 'chest-open' },
  { label: '一堆圣水金币', value: '+20', rarity: 'rare', icon: 'gold-large' }
];

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
let blessingAnimationRunning = false;

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function playBlessingCue(cue) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audioContext = new AudioContext();
  const gain = audioContext.createGain();
  const cueMap = {
    open: [220, 330],
    pillar: [392, 523.25, 784],
    roll: [659.25],
    lock: [784, 1046.5],
    jackpot: [523.25, 659.25, 783.99, 1046.5]
  };
  const notes = cueMap[cue] || cueMap.open;

  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(cue === 'jackpot' ? 0.07 : 0.035, audioContext.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + (cue === 'roll' ? 0.16 : 0.72));
  gain.connect(audioContext.destination);

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = cue === 'roll' ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + index * 0.07);
    oscillator.connect(gain);
    oscillator.start(audioContext.currentTime + index * 0.07);
    oscillator.stop(audioContext.currentTime + 0.2 + index * 0.09);
  });

  window.setTimeout(() => audioContext.close(), 900);
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
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getBlessingAvailability(state) {
  if (state.developerMode) {
    return { available: true, status: 'Developer Mode：无限赐福测试已开启。' };
  }

  const isComplete = state.cups >= state.goal;
  const drawnToday = state.lastBlessingDrawDate === getTodayKey();

  if (!isComplete) {
    return { available: false, status: '完成今日补水后，可开启一次赐福。' };
  }

  if (drawnToday) {
    return { available: false, status: '今日赐福已开启，明天再来。' };
  }

  return { available: true, status: '今日目标已完成，赐福正在发光。' };
}

function describeReward(reward) {
  if (!reward) return '圣水瓶正在等待今日的光。';
  return reward.type === 'rareSkinFragments' ? `获得 ${reward.label} x${reward.amount}` : `获得 ${reward.label}`;
}

function getHiddenBlessingText() {
  return blessingAnimationRunning ? '圣水核心正在光柱中判定赐福。' : '圣水瓶正在等待今日的光。';
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function rewardIconMarkup(icon) {
  const paths = {
    'gold-small': 'assets/rewards/reward-gold-small.png',
    'gold-large': 'assets/rewards/reward-gold-large.png',
    'chest-open': 'assets/rewards/reward-chest-open.png',
    'chest-closed': 'assets/rewards/reward-chest-closed.png',
    sapphire: 'assets/rewards/reward-sapphire.png',
    diamond: 'assets/rewards/reward-diamond.png',
    fragment: 'assets/rewards/reward-fragment.png'
  };

  return '<img src="' + (paths[icon] || paths['gold-small']) + '" alt="">';
}
function getRewardDisplay(reward) {
  return reward.type === 'rareSkinFragments'
    ? { label: '稀有外观碎片', value: '+1', rarity: 'legendary', icon: 'fragment' }
    : {
        label: `${reward.amount} 圣水金币`,
        value: `+${reward.amount}`,
        rarity: reward.amount >= 50 ? 'epic' : reward.amount >= 20 ? 'rare' : 'common',
        icon: reward.amount >= 50 ? 'chest-open' : reward.amount >= 20 ? 'gold-large' : 'gold-small'
      };
}

function setSlotReward(item) {
  rewardSlot.dataset.rarity = item.rarity;
  rewardSlot.dataset.icon = item.icon;
  slotRewardIcon.className = 'slot-reward-icon ' + item.icon;
  slotRewardIcon.innerHTML = rewardIconMarkup(item.icon);
  slotRewardName.textContent = item.label;
  slotRewardValue.textContent = item.value;
  rewardSlot.classList.remove('tick');
  window.requestAnimationFrame(() => rewardSlot.classList.add('tick'));
}

function showReward(reward) {
  const display = getRewardDisplay(reward);
  rewardCard.dataset.rarity = display.rarity;
  rewardCard.dataset.icon = display.icon;
  rewardIcon.className = 'reward-card-icon ' + display.icon;
  rewardIcon.innerHTML = rewardIconMarkup(display.icon);
  rewardTitle.textContent = display.label;
  rewardSubtitle.textContent = display.value;
  rewardCard.classList.add('show');
}

async function rollBlessingSlot(finalReward) {
  const finalDisplay = getRewardDisplay(finalReward);
  const intervals = [36, 36, 38, 40, 42, 46, 52, 58, 68, 82, 102, 132, 172, 230, 310];

  rewardSlot.classList.add('rolling');
  for (let index = 0; index < intervals.length; index += 1) {
    const item = blessingRollItems[index % blessingRollItems.length];
    setSlotReward(item);
    if (index % 3 === 0) playBlessingCue('roll');
    await wait(intervals[index]);
  }

  setSlotReward(finalDisplay);
  rewardSlot.classList.remove('rolling');
  rewardSlot.classList.add('locked');
}

async function playBlessingAnimation(reward) {
  blessingAnimationRunning = true;
  rewardCard.classList.remove('show');
  rewardSlot.classList.remove('locked');
  blessingOverlay.classList.remove('charge', 'pillar', 'rolling', 'finale', 'jackpot');
  blessingOverlay.classList.add('active');
  blessingOverlay.setAttribute('aria-hidden', 'false');

  blessingOverlay.classList.add('charge');
  playBlessingCue('open');
  await wait(520);
  blessingOverlay.classList.add('pillar');
  playBlessingCue('pillar');
  await wait(760);
  blessingOverlay.classList.add('rolling');
  await rollBlessingSlot(reward);
  await wait(240);
  blessingOverlay.classList.add('finale');
  playBlessingCue('lock');
  await wait(360);
  blessingOverlay.classList.add('jackpot');
  playBlessingCue(reward.amount >= 50 || reward.type === 'rareSkinFragments' ? 'jackpot' : 'pillar');
  showReward(reward);
  await wait(2350);

  blessingOverlay.classList.remove('active', 'charge', 'pillar', 'rolling', 'finale', 'jackpot');
  blessingOverlay.setAttribute('aria-hidden', 'true');
  rewardCard.classList.remove('show');
  rewardSlot.classList.remove('locked', 'tick');
  blessingAnimationRunning = false;
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
  coinCount.textContent = state.totalCoins || 0;
  blessingCoinCount.textContent = state.blessingCoins || 0;
  goalInput.value = state.goal;
  pausedInput.checked = state.paused;
  startupInput.checked = state.launchAtStartup;
  undoButton.disabled = state.cups <= 0;
  progressFill.style.width = `${percent}%`;
  renderProgressSegments(state);
  cupWater.style.height = `${Math.max(12, percent)}%`;
  document.body.classList.toggle('goal-complete', isComplete);

  developerBadge.hidden = !state.developerMode;

  const blessingAvailability = getBlessingAvailability(state);
  blessingButton.disabled = blessingAnimationRunning || !blessingAvailability.available;
  blessingStatus.textContent = blessingAvailability.status;
  blessingResult.textContent = blessingAnimationRunning
    ? getHiddenBlessingText()
    : state.lastBlessingReward && state.lastBlessingReward.date === getTodayKey()
      ? describeReward(state.lastBlessingReward)
      : '圣水瓶正在等待今日的光。';

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
  const previousCoins = currentState ? currentState.totalCoins || 0 : 0;
  const nextState = await window.waterApp.drinkWater();
  const isComplete = nextState.cups >= nextState.goal;
  const earnedCoin = (nextState.totalCoins || 0) > previousCoins;

  render(nextState);
  encouragement.textContent = earnedCoin ? randomItem(coinMessages) : isComplete ? randomItem(completeMessages) : randomItem(encouragementMessages);
  drinkButton.classList.remove('pop');
  window.requestAnimationFrame(() => drinkButton.classList.add('pop'));

  if (isComplete && !wasComplete) {
    celebrateCompletion();
  }
});
blessingButton.addEventListener('click', async () => {
  if (blessingAnimationRunning) return;

  blessingAnimationRunning = true;
  blessingButton.disabled = true;
  blessingResult.textContent = '圣水核心正在蓄力，请等待赐福降临。';

  const result = await window.waterApp.drawBlessing();
  blessingResult.textContent = getHiddenBlessingText();

  if (!result.ok) {
    blessingAnimationRunning = false;
    render(result.state);
    blessingResult.textContent = result.reason === 'already-drawn' ? '今日赐福已开启，明天再来。' : '完成今日补水后才可开启赐福。';
    return;
  }

  await playBlessingAnimation(result.reward);
  render(result.state);
  blessingResult.textContent = describeReward(result.reward);
  encouragement.textContent = `圣水赐福完成：${describeReward(result.reward)}。`;
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

