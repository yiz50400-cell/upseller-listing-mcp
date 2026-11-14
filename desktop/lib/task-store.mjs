import fs from 'node:fs';
import path from 'node:path';

const FILE = 'desktop-state.json';

function emptyState() {
  return {
    tasks: [],
    shops: [],
    materials: { images: [], videos: [] },
    settings: {},
  };
}

export function statePath(userDataDir) {
  return path.join(userDataDir, FILE);
}

export function loadState(userDataDir) {
  const file = statePath(userDataDir);
  if (!fs.existsSync(file)) return emptyState();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      ...emptyState(),
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      shops: Array.isArray(parsed.shops) ? parsed.shops : [],
      materials: {
        images: parsed.materials?.images || [],
        videos: parsed.materials?.videos || [],
      },
    };
  } catch {
    return emptyState();
  }
}

export function saveState(userDataDir, state) {
  const file = statePath(userDataDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = {
    ...emptyState(),
    ...state,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
  return payload;
}
