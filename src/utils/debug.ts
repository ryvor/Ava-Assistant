import dotenv from 'dotenv';
dotenv.config({ quiet: true });

type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const levelOrder: Record<Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const envLevel = (process.env.DEBUG_LEVEL || 'info').toLowerCase() as Level;
const ACTIVE_LEVEL: Level = levelOrder[envLevel] ? envLevel : 'info';

function shouldLog(level: Level) {
  return levelOrder[level] >= levelOrder[ACTIVE_LEVEL];
}

export function debugLog(level: Level, ...args: any[]) {
  if (!shouldLog(level)) return;
  const prefix = level === 'info' ? '[AVA]' : `[AVA ${level.toUpperCase()}]`;
  switch (level) {
    case 'warn':
      console.warn(prefix, ...args);
      break;
    case 'error':
    case 'fatal':
      console.error(prefix, ...args);
      break;
    default:
      console.log(prefix, ...args);
  }
}
