// Pulls the live public content of jzbarbershop.com (the same API the original
// site reads) into src/data/snapshot.json and optimised images into public/media.
// Nothing here is edited by hand: run `npm run sync` to refresh after content
// changes in the admin panel.
import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import sharp from 'sharp'

const ORIGIN = process.env.JZ_ORIGIN || 'https://www.jzbarbershop.com'
const API = `${ORIGIN}/api/Public/`
const FILES = `${ORIGIN}/storage/jz-public/`
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const MEDIA_DIR = path.join(ROOT, 'public/media')
const OUT = path.join(ROOT, 'src/data/snapshot.json')

async function getJson(endpoint) {
  const res = await fetch(API + endpoint)
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`)
  return res.json()
}

const media = {}
const written = new Set()

// Downloads one image and stores it as WebP. `key` is the path used by the API
// (e.g. "Gallery/<uuid>") so the frontend can map live data to local files.
async function saveImage(key, url, maxWidth = 1600) {
  if (!key || media[key]) return media[key]
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  ! image ${key}: HTTP ${res.status}`)
    return null
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const slug = key.startsWith('http')
    ? 'post-' + createHash('sha1').update(key.split('?')[0]).digest('hex').slice(0, 12)
    : key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const file = `${slug}.webp`
  const img = sharp(buf).rotate()
  const meta = await img.metadata()
  const width = Math.min(meta.width || maxWidth, maxWidth)
  const out = await img.resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
  await writeFile(path.join(MEDIA_DIR, file), out.data)
  written.add(file)
  media[key] = { src: `/media/${file}`, w: out.info.width, h: out.info.height }
  return media[key]
}

async function main() {
  await mkdir(MEDIA_DIR, { recursive: true })
  console.log(`Syncing from ${ORIGIN}`)

  const mainPageInfo = await getJson('MainPageInfo')
  const departmentCodes = await getJson('DepartmentCodes')
  const departments = {}
  const feeds = {}

  for (const code of departmentCodes) {
    const dept = await getJson(`DepartmentDataByCode?departmentCode=${encodeURIComponent(code)}`)
    departments[code] = dept
    const keys = [
      dept.imageMain,
      dept.imageContacts,
      ...(dept.gallery || []).map((g) => g.path),
      ...(dept.services || []).map((s) => s.imageUrl),
      ...(dept.teamMembers || []).map((t) => t.profilePicUrl),
    ].filter(Boolean)
    for (const key of keys) await saveImage(key, FILES + key)

    try {
      const feed = await getJson(`FacebookFeed?siteKey=${encodeURIComponent(code)}&limit=10`)
      const posts = []
      for (const p of feed.data || []) {
        const att = p.attachments?.data?.[0]
        const picture = att?.media?.image?.src || p.full_picture
        const image = picture ? await saveImage(picture, picture, 1080) : null
        posts.push({
          id: p.id,
          message: p.message || '',
          created_time: p.created_time,
          permalink_url: p.permalink_url,
          type: att?.type || null,
          image: image ? picture : null,
        })
      }
      feeds[code] = posts
    } catch (e) {
      console.warn(`  ! feed ${code}: ${e.message}`)
      feeds[code] = []
    }
  }

  // Remove images that are no longer referenced.
  for (const f of await readdir(MEDIA_DIR)) {
    if (!written.has(f)) await unlink(path.join(MEDIA_DIR, f))
  }

  const snapshot = { syncedAt: new Date().toISOString(), origin: ORIGIN, mainPageInfo, departmentCodes, departments, feeds, media }
  await writeFile(OUT, JSON.stringify(snapshot, null, 1) + '\n')
  console.log(`Wrote ${path.relative(ROOT, OUT)} and ${written.size} images`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
