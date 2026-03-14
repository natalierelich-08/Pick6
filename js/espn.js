/**
 * ESPN API Integration
 *
 * Fetches NCAA Tournament game results from ESPN's public scoreboard API.
 * Runs in the browser - no server required.
 *
 * ESPN API endpoint (public, no auth, CORS-enabled):
 * https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
 * groups=100 → filters to NCAA Tournament games only
 */

const ESPNAPI = {
  BASE: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  CACHE_KEY: 'pick6_espn_cache',
  CACHE_TTL_MS: 2 * 60 * 1000, // 2 minutes

  /**
   * Returns all tournament dates for a given year as YYYYMMDD strings.
   * Only returns dates up to today — no point fetching future dates.
   */
  getTournamentDates(year) {
    const dates = [];
    const start = new Date(year, 2, 16); // March 16
    const end   = new Date(Math.min(new Date(year, 3, 9), Date.now())); // April 9 or today, whichever is earlier
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}${m}${day}`);
    }
    return dates;
  },

  /**
   * Fetch all completed tournament games and return per-team win/alive data.
   * Uses a short-lived cache to avoid hammering ESPN on every render.
   *
   * @param {number} year - Tournament year (e.g. 2026)
   * @param {boolean} forceRefresh - Bypass cache
   * @param {Array}   pick6Teams   - Teams config array (for name matching)
   * @returns {Object} { teamResults, lastUpdated, completedGames, errors }
   */
  async fetchResults(year = 2026, forceRefresh = false, pick6Teams = []) {
    // Check cache
    if (!forceRefresh) {
      const cached = this._getCache();
      if (cached) return cached;
    }

    const dates = this.getTournamentDates(year);
    const allEvents = [];
    const errors = [];

    // Fetch each tournament date (parallel batches of 5)
    for (let i = 0; i < dates.length; i += 5) {
      const batch = dates.slice(i, i + 5);
      const fetches = batch.map(date => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout
        return fetch(`${this.BASE}?groups=100&dates=${date}&limit=100`, { signal: controller.signal })
          .then(r => { clearTimeout(timeout); return r.ok ? r.json() : null; })
          .catch(e => { clearTimeout(timeout); errors.push(`${date}: ${e.message}`); return null; });
      });
      const results = await Promise.all(fetches);
      for (const data of results) {
        if (data?.events) allEvents.push(...data.events);
      }
    }

    // Process games into wins/eliminations per team
    const teamWins = {};
    const teamEliminated = new Set();

    for (const event of allEvents) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      // Check if game is final
      const status = comp.status?.type ?? event.status?.type;
      if (!status?.completed) continue;

      for (const competitor of (comp.competitors || [])) {
        const espnName =
          competitor.team?.shortDisplayName ||
          competitor.team?.location ||
          competitor.team?.displayName ||
          '';
        if (!espnName) continue;

        // Map ESPN name → pick6 displayName
        const pick6Name = this._matchTeamName(espnName, pick6Teams) || espnName;

        if (competitor.winner) {
          teamWins[pick6Name] = (teamWins[pick6Name] || 0) + 1;
        } else {
          teamEliminated.add(pick6Name);
        }
      }
    }

    // Build teamResults map: { "Duke (1)": { wins: 2, alive: true } }
    const teamResults = {};
    const allNames = new Set([
      ...Object.keys(teamWins),
      ...teamEliminated,
      ...pick6Teams.map(t => t.displayName),
    ]);

    for (const name of allNames) {
      teamResults[name] = {
        wins: teamWins[name] || 0,
        alive: !teamEliminated.has(name),
      };
    }

    const result = {
      teamResults,
      lastUpdated: new Date().toISOString(),
      completedGames: allEvents.filter(e => e.competitions?.[0]?.status?.type?.completed).length,
      errors,
    };

    this._setCache(result);
    return result;
  },

  /**
   * Match an ESPN short team name (e.g. "Duke") to a pick6 displayName (e.g. "Duke (1)").
   * Falls back to partial matching for common variations.
   */
  _matchTeamName(espnName, pick6Teams) {
    const espnLower = espnName.toLowerCase().trim();

    for (const team of pick6Teams) {
      // Admin-specified ESPN name takes priority
      if (team.espnName && team.espnName.toLowerCase() === espnLower) {
        return team.displayName;
      }

      // Extract base name from "Duke (1)" → "Duke"
      const baseName = team.displayName.replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();

      if (baseName === espnLower) return team.displayName;

      // Partial: ESPN might say "Texas A&M" for "Texas A&M (6)"
      if (espnLower.includes(baseName) || baseName.includes(espnLower)) {
        return team.displayName;
      }
    }

    return null;
  },

  _getCache() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > this.CACHE_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  },

  _setCache(data) {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  },

  clearCache() {
    try { localStorage.removeItem(this.CACHE_KEY); } catch {}
  },
};
