// Shared helper for reading/writing JSON collections in Netlify Blobs.
import { getStore } from '@netlify/blobs'

const STORE_NAME = 'manpower-tracker'
const VALID_KEYS = ['accounts', 'jobs', 'workers', 'assignments', 'requests']

function store() {
  return getStore(STORE_NAME)
}

function assertValidKey(key) {
  if (!VALID_KEYS.includes(key)) {
    throw new Error(`Unknown collection key: ${key}`)
  }
}

// Returns the array for a collection, or [] if it doesn't exist yet.
export async function readCollection(key) {
  assertValidKey(key)
  const data = await store().get(key, { type: 'json' })
  return Array.isArray(data) ? data : []
}

// Overwrites a collection entirely with the given array.
export async function writeCollection(key, arr) {
  assertValidKey(key)
  await store().setJSON(key, arr)
}

// Reads multiple collections at once.
export async function readCollections(keys) {
  const entries = await Promise.all(keys.map(async (k) => [k, await readCollection(k)]))
  return Object.fromEntries(entries)
}
