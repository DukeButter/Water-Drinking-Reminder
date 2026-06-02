const { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, Tray } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_NAME = '宝の喝水提醒';
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');

const defaultState = {
  date: todayKey(),
  cups: 0,
  goal: 8,
  intervalMinutes: 60,
  paused: false,
  launchAtStartup: false
};

const reminderMessages = [
  '宝，喝一口水吧，今天也要好好照顾自己。',
  '小小补水时间到了。',
  '喝一口就好，不急，但别忘了自己。',
  '水分补给站上线啦。',
  '给自己一点点清爽，继续慢慢来。'
];

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

function ensureTodayState() {
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

function saveState() {
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
  fs.writeFileSync(dataFilePath, JSON.stringify(state, null, 2), 'utf-8');
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
    showNotification(APP_NAME, randomItem(reminderMessages));
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
  state.launchAtStartup = enabled;

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  dataFilePath = path.join(app.getPath('userData'), 'water-data.json');
  readState();

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
    saveState();
    sendStateToRenderer();
    return state;
  });

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
      state.intervalMinutes = settings.intervalMinutes;
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
