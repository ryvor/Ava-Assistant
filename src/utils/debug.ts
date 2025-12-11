import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// treat DEBUG_MODE='true' as ON, anything else as OFF
const DEBUG = process.env.DEBUG_MODE === 'true';

export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[AVA DEBUG]', ...args);
  }
}