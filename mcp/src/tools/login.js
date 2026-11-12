import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSessionEnv, sessionMeetsMinimum } from '../auth/session_env.js';
import { captureSessionWithPlaywright } from '../auth/playwright_capture.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function defaultEnvPath() {
  return path.join(packageRoot, 'mcp', '.env');
}

export async function upsellerLogin(args = {}, options = {}, deps = {}) {
  const envPath = path.resolve(args.envPath || options.envPath || process.env.UPSELLER_ENV_FILE || defaultEnvPath());
  const timeoutMs = args.timeoutMs ?? options.timeoutMs;
  const capture = deps.captureSession || captureSessionWithPlaywright;
  const session = await capture({
    timeoutMs,
    headless: args.headless === true,
    startUrl: args.startUrl,
    userDataDir: args.userDataDir,
    channel: args.channel,
  });
  const cookie = String(session?.cookie || '');
  const deviceId = String(session?.deviceId || '');
  if (!sessionMeetsMinimum(cookie, deviceId)) {
    throw new Error('未能从浏览器会话提取有效 Cookie/DeviceId；请确认已在打开的页面登录 Upseller');
  }
  const written = writeSessionEnv({ cookie, deviceId, envPath });
  return {
    ok: true,
    stage: 'login-saved',
    envPath: written.envPath,
    cookieLen: written.cookieLen,
    deviceIdLen: written.deviceIdLen,
    mode: written.mode,
    source: session.source || 'unknown',
    hint: '已写入本机 mcp/.env（仅长度回执）。请勿把 Cookie 发给他人；每人使用自己电脑上的登录态。重启 MCP 后生效。',
  };
}

export const loginToolSchema = {
  name: 'upseller_login',
  description:
    '在本机打开浏览器登录 Upseller（或复用已登录资料），抓取会话写入本机 mcp/.env。成功只返回 cookieLen/deviceIdLen，永不回显 Cookie/DeviceId。供 Codex 在客户说「登录 Upseller」时调用。每人自己电脑登录，禁止共用 .env。',
  inputSchema: {
    type: 'object',
    properties: {
      timeoutMs: {
        type: 'integer',
        minimum: 5000,
        maximum: 600000,
        default: 300000,
        description: '等待用户在浏览器完成登录的最长时间',
      },
      headless: { type: 'boolean', default: false, description: '必须为 false 才能让用户看见并登录；测试可注入 capturer' },
      envPath: { type: 'string', description: '可选；默认交付目录 mcp/.env' },
      userDataDir: { type: 'string', description: '可选；持久化浏览器资料目录，便于已登录直接抓取' },
      startUrl: { type: 'string' },
    },
  },
};
