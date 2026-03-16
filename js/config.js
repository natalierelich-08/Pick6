/**
 * Pick 6 Configuration Manager
 *
 * All runtime config (GAS endpoint, CSV URL, teams) is stored in localStorage
 * so the static site on GitHub Pages can be configured without a rebuild.
 *
 * Admins set these values via admin.html.
 */

const CONFIG_KEY   = 'pick6_config';
const TEAMS_KEY    = 'pick6_teams';
const OVERRIDES_KEY = 'pick6_overrides'; // Manual win-count overrides

const DEFAULT_CONFIG = {
  gasEndpoint:    '',  // Google Apps Script Web App URL (for form submissions)
  sheetsCsvUrl:   '',  // Published Google Sheets CSV URL (for reading entries)
  tournamentYear: 2026,
  poolName:       'Pick 6 Pool',
  adminPassword:  '',  // Optional: protect admin page
  useManualOverrides: false, // When true, bypass ESPN and use manual win counts
};

const AppConfig = {
  get() {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : { ...DEFAULT_CONFIG };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },

  set(updates) {
    const current = this.get();
    const next = { ...current, ...updates };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  },

  isConfigured() {
    const cfg = this.get();
    return !!(cfg.gasEndpoint && cfg.sheetsCsvUrl);
  },

  // Teams: array of { name, seed, region, displayName, espnName? }
  getTeams() {
    try {
      const stored = localStorage.getItem(TEAMS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  setTeams(teams) {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  },

  // Manual overrides: { "Duke (1)": { wins: 3, alive: false } }
  getOverrides() {
    try {
      const stored = localStorage.getItem(OVERRIDES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  },

  setOverrides(overrides) {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  },
};

/**
 * Parse Google Sheets CSV into entry objects.
 * Expected column order (from GAS script):
 * [0] Timestamp, [1] Name, [2] Email, [3-8] Team1-Team6, [9] TOD
 */
async function fetchEntries(csvUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
  let response;
  try {
    response = await fetch(csvUrl, { signal: controller.signal });
  } catch (e) {
    clearTimeout(timeout);
    throw new Error(`Could not reach Google Sheets: ${e.message}. Check your CSV URL in Admin.`);
  }
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`Failed to fetch entries (HTTP ${response.status})`);

  const text = await response.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return []; // No entries yet

  const entries = [];
  const teams = AppConfig.getTeams();

  for (let i = 1; i < lines.length; i++) { // Skip header row
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 10) continue;

    const [timestamp, name, email, t1, t2, t3, t4, t5, t6, tod] = cols;
    if (!name || !t1) continue;

    const entryTeams = [t1, t2, t3, t4, t5, t6]
      .filter(Boolean)
      .map(displayName => {
        const match = teams.find(t => t.displayName === displayName);
        return match
          ? { displayName: match.displayName, seed: match.seed, name: match.name }
          : { displayName, seed: parseSeedFromDisplay(displayName), name: displayName.replace(/\s*\(\d+\)$/, '') };
      });

    entries.push({
      timestamp,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      teams: entryTeams,
      tod: tod?.trim() || '',
    });
  }

  return entries;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseSeedFromDisplay(displayName) {
  const match = displayName.match(/\((\d+)\)/);
  return match ? parseInt(match[1]) : 99;
}
