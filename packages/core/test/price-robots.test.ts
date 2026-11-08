import { describe, expect, it } from 'vitest';
import { formatPrice, parsePrice } from '../src/price';
import { crawlDelaySeconds, isAllowed, parseRobots } from '../src/robots';

describe('parsePrice (real visitcyprus.com cost strings + local variants)', () => {
  it.each([
    ['FREE', { isFree: true, min: 0, max: 0 }],
    ['free', { isFree: true }],
    ['Free', { isFree: true }],
    ['Δωρεάν', { isFree: true }],
    ['Είσοδος ελεύθερη', { isFree: true }],
    ['Бесплатно', { isFree: true }],
    ['€0', { isFree: true }],
  ])('%s → free', (input, expected) => {
    expect(parsePrice(input)).toMatchObject({ ...expected, confident: true });
  });

  it('single price', () => {
    expect(parsePrice('€60')).toMatchObject({ isFree: false, min: 60, max: 60, currency: 'EUR', confident: true });
  });
  it('ranges with en dash', () => {
    expect(parsePrice('€20 – €70')).toMatchObject({ isFree: false, min: 20, max: 70, currency: 'EUR' });
    expect(parsePrice('20-30€')).toMatchObject({ min: 20, max: 30 });
  });
  it('"from" prices have no maximum', () => {
    expect(parsePrice('από €10')).toMatchObject({ min: 10, max: null });
    expect(parsePrice('от 15 €')).toMatchObject({ min: 15, max: null });
    expect(parsePrice('From €12.50')).toMatchObject({ min: 12.5, max: null });
  });
  it('decimal comma and thousands', () => {
    expect(parsePrice('€12,50')).toMatchObject({ min: 12.5 });
    expect(parsePrice('€1.200')).toMatchObject({ min: 1200 });
  });
  it('never guesses on unclear input', () => {
    expect(parsePrice('TBA')).toMatchObject({ isFree: null, min: null, confident: false });
    expect(parsePrice('By donation')).toMatchObject({ isFree: null, confident: false });
    expect(parsePrice('Free for kids, €10 adults')).toMatchObject({ isFree: false, min: null, confident: false });
    expect(parsePrice('Season 2026')).toMatchObject({ min: null, confident: false });
    expect(parsePrice('')).toMatchObject({ isFree: null, confident: false });
  });
  it('formats', () => {
    expect(formatPrice({ isFree: true, min: 0, max: 0, currency: null }, 'ru')).toBe('Бесплатно');
    expect(formatPrice({ isFree: false, min: 20, max: 70, currency: 'EUR' }, 'en')).toBe('€20 – €70');
    expect(formatPrice({ isFree: null, min: null, max: null, currency: null, text: 'By donation' }, 'en')).toBe('By donation');
  });
});

// Captured from https://www.rialto.com.cy/robots.txt on 2026-11-08
const RIALTO = `User-agent: *
Allow: /
Disallow: *?lightbox=

# Optimization for Google Ads Bot
User-agent: AdsBot-Google-Mobile
User-agent: AdsBot-Google
Disallow: /_partials*
Disallow: /pro-gallery-webapp/v1/galleries/*

# Block PetalBot
User-agent: PetalBot
Disallow: /

# Crawl delay for overly enthusiastic bots
User-agent: dotbot
Crawl-delay: 10

Sitemap: https://www.rialto.com.cy/el_el-sitemap.xml`;

describe('robots.txt (RFC 9309)', () => {
  const r = parseRobots(RIALTO);
  const UA = 'passtra-bot/1.0 (+https://passtra.app/bot)';

  it('does not confuse another bot’s "Disallow: /" with ours', () => {
    expect(isAllowed(r, UA, '/events')).toBe(true);
    expect(isAllowed(r, 'PetalBot', '/events')).toBe(false);
  });
  it('applies wildcard rules', () => {
    expect(isAllowed(r, UA, '/gallery?lightbox=1')).toBe(false);
  });
  it('groups consecutive user-agent lines', () => {
    expect(isAllowed(r, 'AdsBot-Google', '/_partials/x')).toBe(false);
    expect(isAllowed(r, 'AdsBot-Google-Mobile', '/_partials/x')).toBe(false);
    expect(isAllowed(r, 'AdsBot-Google', '/events')).toBe(true);
  });
  it('reads crawl-delay and sitemaps', () => {
    expect(crawlDelaySeconds(r, 'dotbot')).toBe(10);
    expect(crawlDelaySeconds(r, UA)).toBeUndefined();
    expect(r.sitemaps).toEqual(['https://www.rialto.com.cy/el_el-sitemap.xml']);
  });
  it('longest match wins; Allow wins ties; $ anchors', () => {
    const x = parseRobots(`User-agent: *\nDisallow: /events/\nAllow: /events/public\nDisallow: /*.pdf$\nAllow: /a\nDisallow: /a`);
    expect(isAllowed(x, UA, '/events/private')).toBe(false);
    expect(isAllowed(x, UA, '/events/public/1')).toBe(true);
    expect(isAllowed(x, UA, '/files/x.pdf')).toBe(false);
    expect(isAllowed(x, UA, '/files/x.pdf?download=1')).toBe(true);
    expect(isAllowed(x, UA, '/a')).toBe(true);
  });
  it('empty Disallow allows all; full Disallow for * blocks', () => {
    expect(isAllowed(parseRobots('User-agent: *\nDisallow:'), UA, '/x')).toBe(true);
    expect(isAllowed(parseRobots('User-agent: *\nDisallow: /'), UA, '/x')).toBe(false);
    expect(isAllowed(parseRobots(''), UA, '/x')).toBe(true);
  });
  it('a specific group for our bot overrides *', () => {
    const x = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: passtra-bot\nAllow: /events');
    expect(isAllowed(x, UA, '/events')).toBe(true);
  });
});
