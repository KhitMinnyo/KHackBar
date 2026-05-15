// ============================================================
// config.js - Shared configuration constants
// ============================================================
// All modules reference window.KHackBar.Config for shared values.
// This file must be loaded BEFORE any other module that uses it.

window.KHackBar = window.KHackBar || {};

window.KHackBar.Config = {
  // --- Fuzzer ---
  FUZZ_DELAY: 300,         // ms between fuzz requests
  REQUEST_TIMEOUT: 30000,  // ms per individual fuzz request timeout

  // --- Audit ---
  MAX_AUDIT_LOGS: 500,     // max audit log entries retained

  // --- Settings / Config ---
  CONFIG_RELOAD_DELAY: 500, // ms delay before page reload after config import

  // --- UI ---
  STATUS_TIMEOUT: 3000,    // ms before status message auto-clears
  AUDIT_REFRESH_DELAY: 100 // ms delay before audit log refresh after opening settings panel
};
