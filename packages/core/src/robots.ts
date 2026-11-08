/**
 * robots.txt parser following RFC 9309:
 * - consecutive User-agent lines share one group; groups matching the crawler are merged
 * - the crawler uses the group(s) whose user-agent token matches its product token
 *   (case-insensitive), otherwise the "*" group, otherwise everything is allowed
 * - most specific (longest) matching rule wins; on a tie, Allow wins
 * - supports "*" wildcards and "$" end anchors
 */
export interface RobotsRule {
  allow: boolean;
  pattern: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelay?: number;
}

export interface Robots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export function parseRobots(text: string): Robots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'sitemap') {
      sitemaps.push(value);
      continue;
    }
    if (!current) continue; // rules before any user-agent are ignored
    if (key === 'allow' || key === 'disallow') {
      // An empty Disallow means "allow everything" — it adds no rule.
      if (value === '') continue;
      current.rules.push({ allow: key === 'allow', pattern: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups, sitemaps };
}

function selectGroups(robots: Robots, userAgent: string): RobotsGroup[] {
  const token = userAgent.toLowerCase().split('/')[0]!.trim();
  const specific = robots.groups.filter((g) => g.agents.some((a) => a !== '*' && (token === a || token.includes(a))));
  if (specific.length) return specific;
  return robots.groups.filter((g) => g.agents.includes('*'));
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Is `path` (path + query, e.g. "/events?page=2") allowed for `userAgent`? */
export function isAllowed(robots: Robots, userAgent: string, path: string): boolean {
  const groups = selectGroups(robots, userAgent);
  if (groups.length === 0) return true;
  let best: { len: number; allow: boolean } | null = null;
  for (const g of groups) {
    for (const r of g.rules) {
      if (!patternToRegex(r.pattern).test(path)) continue;
      const len = r.pattern.length;
      if (!best || len > best.len || (len === best.len && r.allow && !best.allow)) best = { len, allow: r.allow };
    }
  }
  return best ? best.allow : true;
}

export function crawlDelaySeconds(robots: Robots, userAgent: string): number | undefined {
  const delays = selectGroups(robots, userAgent).map((g) => g.crawlDelay).filter((d): d is number => d !== undefined);
  return delays.length ? Math.max(...delays) : undefined;
}
