/**
 * JetStream 3 data service — Treeherder Performance API
 *
 * Fetches 90 days of 'score' time-series for Firefox and its primary competitor
 * on four tracked platforms, using the Treeherder Performance API directly.
 *
 * Adapted from ../../../shared/jetstream.js — self-contained for this project.
 *
 * Platforms:
 *   windows     → windows11-64-24h2-shippable
 *   osx         → macosx1500-aarch64-shippable  (M4)
 *   linux       → linux1804-64-shippable-qr
 *   android-a55 → android-hw-a55-14-0-aarch64-shippable
 */

import { cachedFetch, clearCache } from '../utils/cache.js'

const TREEHERDER_BASE = 'https://treeherder.mozilla.org/api'
const FRAMEWORK = 13
const JETSTREAM_SUITE = 'jetstream3'
const INTERVAL_90_DAYS = 90 * 24 * 60 * 60
const CACHE_KEY = 'jetstream-all-platforms'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export const PLATFORMS = {
  windows:      'windows11-64-24h2-shippable',
  osx:          'macosx1500-aarch64-shippable',
  linux:        'linux1804-64-shippable-qr',
  'android-a55': 'android-hw-a55-14-0-aarch64-shippable',
}

export const PLATFORM_LABELS = {
  windows:      'Windows 11',
  osx:          'Mac OSX (M4)',
  linux:        'Linux',
  'android-a55': 'Android (A55)',
}

const FIREFOX_APPS = new Set(['firefox', 'fenix'])

async function fetchSignatures(platformString, repository = 'mozilla-central') {
  const url = `${TREEHERDER_BASE}/project/${repository}/performance/signatures/?framework=${FRAMEWORK}&platform=${platformString}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Treeherder signatures error: ${response.status}`)
  return response.json()
}

async function fetchSeriesPoints(sigId, repository = 'mozilla-central') {
  const url = `${TREEHERDER_BASE}/performance/summary/?repository=${repository}&signature=${sigId}&framework=${FRAMEWORK}&interval=${INTERVAL_90_DAYS}&all_data=true`
  const response = await fetch(url)
  if (!response.ok) return []
  const data = await response.json()
  if (!Array.isArray(data) || !data[0]?.data) return []
  return data[0].data
    .map(pt => {
      const ts = pt.push_timestamp
      const ms = typeof ts === 'string' ? new Date(ts).getTime() : ts * 1000
      return { date: new Date(ms), value: pt.value }
    })
    .sort((a, b) => a.date - b.date)
}

async function fetchPlatformData(osKey) {
  const platformString = PLATFORMS[osKey]
  if (!platformString) throw new Error(`Unknown OS key: ${osKey}`)

  const sigs = await fetchSignatures(platformString)

  let fxSig = null
  let competitorSig = null

  for (const sig of Object.values(sigs)) {
    if (sig.suite !== JETSTREAM_SUITE || sig.test !== 'score') continue
    if (FIREFOX_APPS.has(sig.application)) {
      if (!fxSig) fxSig = sig
    } else if (!competitorSig) {
      competitorSig = sig
    }
    if (fxSig && competitorSig) break
  }

  const [fxPoints, competitorPoints] = await Promise.all([
    fxSig         ? fetchSeriesPoints(fxSig.id)         : Promise.resolve([]),
    competitorSig ? fetchSeriesPoints(competitorSig.id) : Promise.resolve([]),
  ])

  return {
    osKey,
    label: PLATFORM_LABELS[osKey],
    competitorApp: competitorSig?.application ?? null,
    fxPoints,
    competitorPoints,
  }
}

/**
 * Fetches JetStream 3 'score' time-series for all four tracked platforms in parallel.
 *
 * @param {boolean} useCache - Whether to use the 30-minute in-memory cache (default: true)
 * @returns {Promise<Array>} Array of { osKey, label, competitorApp, fxPoints, competitorPoints }
 *   where fxPoints/competitorPoints are { date: Date, value: number }[] sorted ascending.
 */
export async function fetchJetstreamAllPlatforms(useCache = true) {
  if (useCache) {
    return cachedFetch(
      CACHE_KEY,
      () => Promise.all(Object.keys(PLATFORMS).map(fetchPlatformData)),
      CACHE_TTL
    )
  }
  return Promise.all(Object.keys(PLATFORMS).map(fetchPlatformData))
}

/**
 * Clears the JetStream 3 in-memory cache.
 */
export function clearJetstreamCache() {
  clearCache(CACHE_KEY)
}
