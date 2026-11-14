export function buildLoginWindowOptions(session) {
  return {
    width: 1280,
    height: 900,
    title: '登录 Upseller',
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d12',
    webPreferences: {
      session,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  };
}
