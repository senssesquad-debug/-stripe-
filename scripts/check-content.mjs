// Compares the bundled snapshot with what jzbarbershop.com publishes right now
// and lists every difference in services, prices, team, contacts and hours.
// Exit code 1 means the snapshot is stale: run `npm run sync`.
import { readFile } from 'node:fs/promises'

const ORIGIN = process.env.JZ_ORIGIN || 'https://www.jzbarbershop.com'
const snapshot = JSON.parse(await readFile(new URL('../src/data/snapshot.json', import.meta.url)))

const fields = ['address', 'email', 'phone', 'socialFb', 'socialIg', 'title', 'isBookingEnabled']
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `workingTime${d}`)

function texts(list = [], key) {
  return Object.fromEntries(list.map((t) => [t.code, typeof key === 'function' ? key(t) : t[key]]))
}

function summarise(d) {
  return {
    contact: Object.fromEntries([...fields, ...days].map((k) => [k, d[k]])),
    descriptions: texts(d.descriptions, (t) => [t.description, t.homeTitle, t.homeDesc, t.policyTitle, t.policyText]),
    services: (d.services || []).map((s) => ({ id: s.id, price: s.price, image: s.imageUrl, texts: texts(s.texts, (t) => [t.title, t.description]) })),
    team: (d.teamMembers || []).map((m) => ({ id: m.id, name: m.firstName, photo: m.profilePicUrl, services: m.services, texts: texts(m.descriptions, 'data') })),
    gallery: (d.gallery || []).map((g) => g.path),
  }
}

let diffs = 0
function compare(a, b, path) {
  if (JSON.stringify(a) === JSON.stringify(b)) return
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) compare(a[k], b[k], `${path}.${k}`)
    return
  }
  diffs++
  console.log(`≠ ${path}\n    snapshot: ${JSON.stringify(a)?.slice(0, 160)}\n    live:     ${JSON.stringify(b)?.slice(0, 160)}`)
}

const codes = await (await fetch(`${ORIGIN}/api/Public/DepartmentCodes`)).json()
compare(snapshot.departmentCodes, codes, 'departmentCodes')
for (const code of codes) {
  const live = await (await fetch(`${ORIGIN}/api/Public/DepartmentDataByCode?departmentCode=${encodeURIComponent(code)}`)).json()
  const snap = snapshot.departments[code]
  if (!snap) {
    diffs++
    console.log(`≠ department ${code} is missing from the snapshot`)
    continue
  }
  compare(summarise(snap), summarise(live), code)
}

console.log(diffs ? `\n${diffs} difference(s) — run \`npm run sync\`.` : `Snapshot matches ${ORIGIN} (synced ${snapshot.syncedAt}).`)
process.exit(diffs ? 1 : 0)
