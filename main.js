const { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, Tray } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_NAME = '宝の喝水提醒';
const APP_ID = 'com.bao.water-reminder';
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
const developerMode = true;

const defaultState = {
  date: todayKey(),
  cups: 0,
  goal: 8,
  // Sacred water tokens: earned from daily hydration completion and spent on blessings.
  totalCoins: 0,
  // Sacred water coins: earned from blessing rewards and saved for future shops.
  blessingCoins: 0,
  rareSkinFragments: 0,
  lastCoinAwardDate: null,
  lastBlessingDrawDate: null,
  blessingHistory: [],
  intervalMinutes: 60,
  customIntervalMinutes: 45,
  paused: false,
  launchAtStartup: false,
  ownedSkins: ['sacred'],
  activeSkin: 'sacred',
  developerMode
};

const skinCatalog = [
  { id: 'origin', name: '原初', price: 1 }
];

const blessingRewards = [
  { id: 'water_coin_5', label: '5 圣水金币', type: 'blessingCoins', amount: 5, chance: 50 },
  { id: 'water_coin_10', label: '10 圣水金币', type: 'blessingCoins', amount: 10, chance: 30 },
  { id: 'water_coin_20', label: '20 圣水金币', type: 'blessingCoins', amount: 20, chance: 15 },
  { id: 'water_coin_50', label: '50 圣水金币', type: 'blessingCoins', amount: 50, chance: 4 },
  { id: 'rare_skin_fragment', label: '稀有外观碎片', type: 'rareSkinFragments', amount: 1, chance: 1 }
];

const reminderMessages = [
  '今天也要做喝水大王！！！',
  '水牛提醒您：该喝水了哞',
  '让你喝水你就喝水，犟嘴呢怎么（bushi',
  '喝水啦喝水啦 水喝多了才有尿',
  '哦 my love~ 喝点水~哦耶~',
  'Only You~~~ 多喝一点水~',
  '水时已到（瞄准--',
  '新事件已触发：饮水',
  '滴滴 - 检测到羚羊缺水'
];

const rareReminderMessage = '恭喜你运气爆棚触发超稀有补水奖励！！！！！！凭此截图可向开发者领取奖励~~~';

let mainWindow;
let tray;
let reminderTimer;
let state = { ...defaultState };
let dataFilePath;
let isQuitting = false;

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getReminderMessage() {
  return Math.random() < 0.02 ? rareReminderMessage : randomItem(reminderMessages);
}

function ensureTodayState() {
  state.developerMode = developerMode;
  state.ownedSkins = Array.isArray(state.ownedSkins) && state.ownedSkins.length > 0 ? state.ownedSkins : ['sacred'];
  if (!state.ownedSkins.includes('sacred')) {
    state.ownedSkins.unshift('sacred');
  }
  state.activeSkin = state.ownedSkins.includes(state.activeSkin) ? state.activeSkin : 'sacred';

  const currentDate = todayKey();

  if (state.date !== currentDate) {
    state.date = currentDate;
    state.cups = 0;
    saveState();
  }
}

function readState() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const savedState = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
      state = { ...defaultState, ...savedState };
    }
  } catch (error) {
    console.error('Failed to read saved data:', error);
    state = { ...defaultState };
  }

  ensureTodayState();
}

function getLaunchAtStartupTarget() {
  if (process.defaultApp) {
    return null;
  }

  const options = {
    path: process.execPath
  };

  return options;
}

function getDevelopmentLaunchAtStartupTarget() {
  return {
    path: process.execPath,
    args: [app.getAppPath()]
  };
}

function clearDevelopmentLaunchAtStartup() {
  app.setLoginItemSettings({
    ...getDevelopmentLaunchAtStartupTarget(),
    openAtLogin: false
  });
}

function syncLaunchAtStartupState() {
  const launchTarget = getLaunchAtStartupTarget();
  if (!launchTarget) {
    clearDevelopmentLaunchAtStartup();
    state.launchAtStartup = false;
    return;
  }

  state.launchAtStartup = launchTarget ? app.getLoginItemSettings(launchTarget).openAtLogin : false;
}

function saveState() {
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
  fs.writeFileSync(dataFilePath, JSON.stringify(state, null, 2), 'utf-8');
}

function isGoalComplete() {
  return state.cups >= state.goal;
}

function awardDailyTokensIfGoalComplete() {
  const currentDate = todayKey();
  const isComplete = isGoalComplete();
  const alreadyAwardedToday = state.lastCoinAwardDate === currentDate;

  if (!isComplete || alreadyAwardedToday) {
    return false;
  }

  state.totalCoins += 3;
  state.lastCoinAwardDate = currentDate;
  return true;
}

function pickBlessingReward() {
  const roll = Math.random() * 100;
  let cursor = 0;

  for (const reward of blessingRewards) {
    cursor += reward.chance;
    if (roll < cursor) {
      return reward;
    }
  }

  return blessingRewards[0];
}

function drawDailyBlessing() {
  ensureTodayState();

  if (!developerMode && state.totalCoins < 1) {
    return { ok: false, reason: 'token-insufficient', state };
  }

  if (!developerMode) {
    state.totalCoins -= 1;
  }

  const reward = pickBlessingReward();
  const result = {
    id: reward.id,
    label: reward.label,
    type: reward.type,
    amount: reward.amount,
    date: todayKey(),
    awardedAt: new Date().toISOString()
  };

  if (reward.type === 'blessingCoins') {
    state.blessingCoins += reward.amount;
  }

  if (reward.type === 'rareSkinFragments') {
    state.rareSkinFragments += reward.amount;
  }

  if (!developerMode) {
    state.lastBlessingDrawDate = todayKey();
  }
  state.lastBlessingReward = result;
  state.blessingHistory = [result, ...(state.blessingHistory || [])].slice(0, 30);
  saveState();
  sendStateToRenderer();

  return { ok: true, reward: result, state };
}

function getSkinById(skinId) {
  return skinCatalog.find((skin) => skin.id === skinId);
}

function buySkin(skinId) {
  ensureTodayState();

  const skin = getSkinById(skinId);
  if (!skin) {
    return { ok: false, reason: 'skin-not-found', state };
  }

  if (state.ownedSkins.includes(skin.id)) {
    state.activeSkin = skin.id;
    saveState();
    sendStateToRenderer();
    return { ok: true, reason: 'already-owned', state };
  }

  if ((state.blessingCoins || 0) < skin.price) {
    return { ok: false, reason: 'coin-insufficient', state };
  }

  state.blessingCoins -= skin.price;
  state.ownedSkins.push(skin.id);
  state.activeSkin = skin.id;
  saveState();
  sendStateToRenderer();

  return { ok: true, state };
}

function equipSkin(skinId) {
  ensureTodayState();

  if (!state.ownedSkins.includes(skinId)) {
    return { ok: false, reason: 'skin-not-owned', state };
  }

  state.activeSkin = skinId;
  saveState();
  sendStateToRenderer();

  return { ok: true, state };
}

function createFallbackIcon() {
  const iconSvg = `
    <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#15142b"/>
      <path d="M32 10C22 22 17 30 17 39c0 9 6.8 15 15 15s15-6 15-15c0-9-5-17-15-29Z" fill="#71e7ff"/>
      <path d="M25 39c2 5 6 7 12 6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <path d="M43 14l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" fill="#ff8fd8"/>
    </svg>
  `;

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`);
}

function createAppIcon() {
  const icon = nativeImage.createFromPath(ICON_PATH);

  // If the custom icon cannot be read, use a small built-in fallback.
  return icon.isEmpty() ? createFallbackIcon() : icon;
}

function createWindowIcon() {
  return createAppIcon().resize({ width: 64, height: 64 });
}

function createTrayIcon() {
  return createAppIcon().resize({ width: 32, height: 32 });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 650,
    minWidth: 360,
    minHeight: 560,
    title: APP_NAME,
    icon: createWindowIcon(),
    backgroundColor: '#15142b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      showNotification('我会在托盘里陪着你', '需要的时候点托盘图标就能回来。');
    }
  });
}

function sendStateToRenderer() {
  ensureTodayState();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state-changed', state);
  }
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return;

  new Notification({
    title,
    body,
    silent: false
  }).show();
}

function scheduleReminder() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }

  if (state.paused) return;

  const delay = state.intervalMinutes * 60 * 1000;
  reminderTimer = setInterval(() => {
    ensureTodayState();
    showNotification(APP_NAME, getReminderMessage());
  }, delay);
}

function buildTrayMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: state.paused ? '恢复提醒' : '暂停提醒',
      click: () => {
        state.paused = !state.paused;
        saveState();
        scheduleReminder();
        buildTrayMenu();
        sendStateToRenderer();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(APP_NAME);
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
  buildTrayMenu();
}

function setLaunchAtStartup(enabled) {
  const launchTarget = getLaunchAtStartupTarget();
  if (!launchTarget) {
    clearDevelopmentLaunchAtStartup();
    state.launchAtStartup = false;
    showNotification('开机召唤需要安装版', '当前是 Electron 开发模式，注册后会显示 Electron 标志；请用打包后的应用开启。');
    return;
  }

  state.launchAtStartup = enabled;
  app.setLoginItemSettings({
    ...launchTarget,
    openAtLogin: enabled
  });
  syncLaunchAtStartupState();
}

app.whenReady().then(() => {
  app.setName(APP_NAME);
  app.setAppUserModelId(APP_ID);
  Menu.setApplicationMenu(null);
  dataFilePath = path.join(app.getPath('userData'), 'water-data.json');
  readState();
  syncLaunchAtStartupState();

  createMainWindow();
  createTray();
  scheduleReminder();

  ipcMain.handle('get-state', () => {
    ensureTodayState();
    return state;
  });

  ipcMain.handle('drink-water', () => {
    ensureTodayState();
    state.cups += 1;
    awardDailyTokensIfGoalComplete();
    saveState();
    sendStateToRenderer();
    return state;
  });

  ipcMain.handle('draw-blessing', () => drawDailyBlessing());

  ipcMain.handle('buy-skin', (_, skinId) => buySkin(skinId));

  ipcMain.handle('equip-skin', (_, skinId) => equipSkin(skinId));

  ipcMain.handle('undo-water', () => {
    ensureTodayState();
    state.cups = Math.max(0, state.cups - 1);
    saveState();
    sendStateToRenderer();
    return state;
  });

  ipcMain.handle('update-settings', (_, settings) => {
    ensureTodayState();

    if (typeof settings.goal === 'number') {
      state.goal = Math.max(1, Math.min(30, Math.round(settings.goal)));
    }

    if (typeof settings.intervalMinutes === 'number') {
      state.intervalMinutes = Math.max(1, Math.min(1440, Math.round(settings.intervalMinutes)));
    }

    if (typeof settings.customIntervalMinutes === 'number') {
      state.customIntervalMinutes = Math.max(1, Math.min(1440, Math.round(settings.customIntervalMinutes)));
    }

    if (typeof settings.paused === 'boolean') {
      state.paused = settings.paused;
    }

    if (typeof settings.launchAtStartup === 'boolean') {
      setLaunchAtStartup(settings.launchAtStartup);
    }

    saveState();
    scheduleReminder();
    buildTrayMenu();
    sendStateToRenderer();
    return state;
  });

  ipcMain.handle('show-window', () => {
    mainWindow.show();
    mainWindow.focus();
  });
});

// Keep the app alive in the tray even when the window is hidden.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
});

