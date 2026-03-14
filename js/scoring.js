/**
 * Pick 6 Scoring Engine
 *
 * Scoring: each team earns seed × round_multiplier points per round survived.
 * Multipliers are cumulative: R64=×1, R32=×2, S16=×3, E8=×4, F4=×5, Championship=×6
 *
 * Example: A seed-8 team that wins 3 games earns: 8×1 + 8×2 + 8×3 = 48 points
 */

const ROUND_MULTIPLIERS = [1, 2, 3, 4, 5, 6];
const ROUND_NAMES = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'];

/**
 * Points a single team contributes for a given seed and win count.
 */
function calculateTeamPoints(seed, wins) {
  let points = 0;
  for (let r = 0; r < Math.min(wins, ROUND_MULTIPLIERS.length); r++) {
    points += seed * ROUND_MULTIPLIERS[r];
  }
  return points;
}

/**
 * Score a single entry against current team results.
 * @param {Object} entry - { name, email, teams: [{displayName, seed},...], tod }
 * @param {Object} teamResults - { "Duke (1)": { wins: 2, alive: true }, ... }
 * @returns Scored entry with totalPoints, teamsAlive, gamesPlayed, todPoints, teamDetails
 */
function calculateEntryScore(entry, teamResults) {
  let totalPoints = 0;
  let teamsAlive = 0;
  let gamesPlayed = 0;
  let todPoints = 0;
  const teamDetails = [];

  for (const team of (entry.teams || [])) {
    const result = teamResults[team.displayName] || { wins: 0, alive: true };
    const points = calculateTeamPoints(team.seed, result.wins);

    totalPoints += points;
    if (result.alive) teamsAlive++;
    gamesPlayed += result.wins;

    if (team.displayName === entry.tod) {
      todPoints = points;
    }

    teamDetails.push({
      ...team,
      wins: result.wins,
      points,
      alive: result.alive,
    });
  }

  return { totalPoints, teamsAlive, gamesPlayed, todPoints, teamDetails };
}

/**
 * Score all entries, sort by standings, and assign ranks.
 * Tiebreaker order: points → teams alive → TOD points
 */
function scoreAllEntries(entries, teamResults) {
  const scored = entries.map(entry => {
    const score = calculateEntryScore(entry, teamResults);
    return { ...entry, ...score };
  });

  scored.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.teamsAlive !== a.teamsAlive) return b.teamsAlive - a.teamsAlive;
    return b.todPoints - a.todPoints;
  });

  // Assign ranks with ties
  for (let i = 0; i < scored.length; i++) {
    if (i === 0) {
      scored[i].rank = 1;
    } else {
      const prev = scored[i - 1];
      const curr = scored[i];
      const tied =
        curr.totalPoints === prev.totalPoints &&
        curr.teamsAlive === prev.teamsAlive &&
        curr.todPoints === prev.todPoints;
      scored[i].rank = tied ? prev.rank : i + 1;
    }
  }

  return scored;
}

/**
 * Aggregate pick counts and points per team for the Team Analysis tab.
 */
function getTeamAnalysis(entries, teamResults, teams) {
  const analysis = {};

  for (const team of teams) {
    const key = team.displayName;
    const result = teamResults[key] || { wins: 0, alive: true };
    analysis[key] = {
      ...team,
      pickCount: 0,
      pickPercentage: 0,
      pointsScored: calculateTeamPoints(team.seed, result.wins),
      result,
    };
  }

  for (const entry of entries) {
    for (const team of (entry.teams || [])) {
      if (analysis[team.displayName]) {
        analysis[team.displayName].pickCount++;
      }
    }
  }

  const total = entries.length;
  for (const key in analysis) {
    analysis[key].pickPercentage =
      total > 0 ? Math.round((analysis[key].pickCount / total) * 100) : 0;
  }

  return Object.values(analysis)
    .filter(t => t.pickCount > 0 || true) // show all teams
    .sort((a, b) => b.pickCount - a.pickCount);
}

/**
 * Validate a new entry before submission.
 * Returns array of error strings (empty = valid).
 */
function validateEntry(entry) {
  const errors = [];

  if (!entry.name || entry.name.trim().length < 2) {
    errors.push('Please enter your name (min 2 characters).');
  }

  if (!entry.teams || entry.teams.length !== 6) {
    errors.push('You must select exactly 6 teams.');
    return errors; // Can't continue without 6 teams
  }

  // No duplicates
  const names = entry.teams.map(t => t.displayName);
  if (new Set(names).size !== names.length) {
    errors.push('You cannot pick the same team more than once.');
  }

  // Must be sorted ascending by seed
  for (let i = 1; i < entry.teams.length; i++) {
    if (entry.teams[i].seed < entry.teams[i - 1].seed) {
      errors.push(
        `Teams must go from best seed (lowest #) to worst seed (highest #). ` +
        `Check the order of your picks.`
      );
      break;
    }
  }

  // TOD must be one of the 6 picks
  if (!entry.tod) {
    errors.push('Please select your Team of Destiny.');
  } else if (!names.includes(entry.tod)) {
    errors.push('Your Team of Destiny must be one of your 6 picked teams.');
  }

  return errors;
}
