import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request } from '@playwright/test'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(frontend, '..', 'backend')
const testingRoot = resolve(backend, 'storage', 'framework', 'testing')
const runDirectory = resolve(testingRoot, `demo-${Date.now()}-${randomBytes(4).toString('hex')}`)
const database = join(runDirectory, 'database.sqlite').replaceAll('\\', '/')
const privateRoot = join(runDirectory, 'private').replaceAll('\\', '/')
const backendUrl = 'http://127.0.0.1:18081'
const frontendUrl = 'http://127.0.0.1:15174'
const password = `Demo-${randomBytes(18).toString('base64url')}`
const php = process.env.DEMO_PHP || 'php'
const children = []

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`)
}

async function assertPortFree(port) {
  await new Promise((resolvePromise, reject) => {
    const server = createServer()
    server.once('error', () => reject(new Error(`Port ${port} is in use. Stop that server before starting the isolated demo.`)))
    server.listen(port, '127.0.0.1', () => server.close(resolvePromise))
  })
}

async function waitFor(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Demo server exited before ${url} became ready.`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch { /* Server is still starting. */ }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 300))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: 'ignore', shell: false })
  children.push(child)
  return child
}

function stop(child) {
  if (!child.pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } else {
    child.kill('SIGTERM')
  }
}

function removeDemoDirectory(target) {
  const insideTesting = relative(testingRoot, target)
  if (!insideTesting || insideTesting === '..' || insideTesting.startsWith(`..${sep}`)
    || !/^demo-\d+-[a-f0-9]{8}$/.test(insideTesting)) {
    throw new Error('Refusing to remove a path outside isolated demo storage.')
  }
  rmSync(target, { recursive: true, force: true })
}

function cleanOldDemoDirectories() {
  if (!existsSync(testingRoot)) return
  for (const entry of readdirSync(testingRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && /^demo-\d+-[a-f0-9]{8}$/.test(entry.name)) {
      removeDemoDirectory(resolve(testingRoot, entry.name))
    }
  }
}

async function checkEndpoints() {
  const guest = await request.newContext({ baseURL: backendUrl, extraHTTPHeaders: { Accept: 'application/json' } })
  const siteResponse = await guest.get('/api/public/site')
  if (!siteResponse.ok()) throw new Error('Public site endpoint failed.')
  const site = await siteResponse.json()
  if (site.buildings.length !== 2 || site.buildings.flatMap(building => building.rooms).length !== 18 || JSON.stringify(site).includes('[DEMO]')) {
    throw new Error('Public site returned an unexpected room count or private demo data.')
  }
  for (const path of ['/api/tenants', '/api/contracts', '/api/utility-bills', '/api/staff-users']) {
    if ((await guest.get(path)).status() !== 401) throw new Error(`Guest access check failed: ${path}`)
  }
  await guest.dispose()

  const owner = await request.newContext({ baseURL: backendUrl, extraHTTPHeaders: { Accept: 'application/json' } })
  const csrf = await (await owner.get('/api/csrf')).json()
  const login = await owner.post('/api/login', { headers: { 'X-CSRF-TOKEN': csrf.token }, data: { email: 'demo-owner@example.test', password } })
  if (!login.ok()) throw new Error(`Demo owner login failed (${login.status()}).`)
  const paths = ['/api/me', '/api/buildings', '/api/rooms', '/api/tenants', '/api/contracts',
    '/api/staff/dashboard', '/api/staff/ledgers', '/api/staff-users', '/api/utility-bills', '/api/contract-template']
  const results = await Promise.all(paths.map(async path => [path, await owner.get(path)]))
  for (const [path, response] of results) {
    if (!response.ok()) throw new Error(`Demo endpoint failed: ${path} (${response.status()})`)
  }
  const rooms = await results.find(([path]) => path === '/api/rooms')[1].json()
  const tenants = await results.find(([path]) => path === '/api/tenants')[1].json()
  const contracts = await results.find(([path]) => path === '/api/contracts')[1].json()
  const bills = await results.find(([path]) => path === '/api/utility-bills')[1].json()
  const dashboard = await results.find(([path]) => path === '/api/staff/dashboard')[1].json()
  const ledgers = await results.find(([path]) => path === '/api/staff/ledgers')[1].json()
  if (rooms.length !== 18 || tenants.length !== 6 || contracts.length !== 6 || bills.length !== 4
    || !dashboard.expiring_contracts.length || !dashboard.repair_checklists.length || Object.keys(ledgers).length !== 6) {
    throw new Error('Seeded records did not appear in the management endpoints.')
  }
  const endedRoomId = contracts.find(contract => contract.status === 'ended').room_id
  for (const path of [`/api/rooms/${rooms[0].id}`, `/api/rooms/${rooms[0].id}/inspections`,
    `/api/rooms/${endedRoomId}/inspections`]) {
    const response = await owner.get(path)
    if (!response.ok()) throw new Error(`Demo detail endpoint failed: ${path}`)
  }
  const moveOutInspections = await (await owner.get(`/api/rooms/${endedRoomId}/inspections`)).json()
  const privatePhoto = moveOutInspections.find(inspection => inspection.photos.length)?.photos[0]
  const privateInspection = moveOutInspections.find(inspection => inspection.photos.length)
  if (!privatePhoto || !(await owner.get(`/api/inspections/${privateInspection.id}/photos/${privatePhoto.id}`)).ok()) {
    throw new Error('Private sample inspection photo failed.')
  }
  const billWithFile = bills.find(bill => bill.file_name)
  if (!billWithFile || !(await owner.get(`/api/utility-bills/${billWithFile.id}/file`)).ok()) {
    throw new Error('Private sample bill download failed.')
  }
  const contractWithFile = contracts.find(contract => contract.files.length)
  if (!contractWithFile || !(await owner.get(`/api/contracts/${contractWithFile.id}/files/${contractWithFile.files[0].id}`)).ok()) {
    throw new Error('Private sample contract download failed.')
  }
  const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
  const to = new Date().toISOString().slice(0, 10)
  const exportResponse = await owner.get(`/api/staff/payments-export?from=${from}&to=${to}`)
  if (!exportResponse.ok() || !exportResponse.headers()['content-type']?.includes('text/csv')) {
    throw new Error('Staff reconciliation export failed.')
  }
  await owner.dispose()
  const staff = await request.newContext({ baseURL: backendUrl, extraHTTPHeaders: { Accept: 'application/json' } })
  const staffCsrf = await (await staff.get('/api/csrf')).json()
  if (!(await staff.post('/api/login', { headers: { 'X-CSRF-TOKEN': staffCsrf.token }, data: { email: 'demo-staff@example.test', password } })).ok()
    || (await staff.get('/api/staff-users')).status() !== 403) {
    throw new Error('Staff role check failed.')
  }
  await staff.dispose()
  console.log(`Demo API checks passed: ${rooms.length} rooms, ${tenants.length} tenants, ${contracts.length} contracts, ${bills.length} bills, private files, and guest access.`)
}

async function main() {
  if (!existsSync(join(backend, 'vendor', 'autoload.php'))) throw new Error('Install backend Composer dependencies first.')
  await Promise.all([assertPortFree(18081), assertPortFree(15174)])
  cleanOldDemoDirectories()
  if (process.argv.includes('--clean')) {
    console.log('Stopped demo data removed.')
    return
  }
  mkdirSync(runDirectory, { recursive: true })
  closeSync(openSync(database, 'w'))
  const backendEnv = { ...process.env, APP_ENV: 'demo', APP_DEBUG: 'false',
    APP_KEY: `base64:${randomBytes(32).toString('base64')}`, APP_URL: backendUrl,
    DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', LOCAL_FILESYSTEM_ROOT: privateRoot,
    SESSION_DRIVER: 'database', CACHE_STORE: 'array', QUEUE_CONNECTION: 'sync', DEMO_PASSWORD: password }
  run(php, ['artisan', 'migrate', '--seed', '--force', '--no-interaction'], backend, backendEnv)
  run(php, ['artisan', 'db:seed', '--class=DemoSeeder', '--force', '--no-interaction'], backend, backendEnv)
  const router = join(backend, 'vendor', 'laravel', 'framework', 'src', 'Illuminate', 'Foundation', 'resources', 'server.php')
  const laravel = start(php, ['-S', '127.0.0.1:18081', router], join(backend, 'public'), backendEnv)
  await waitFor(`${backendUrl}/api/public/site`, laravel)
  await checkEndpoints()
  const vite = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host=127.0.0.1', '--port=15174', '--strictPort', '--configLoader', 'native'], frontend,
    { ...process.env, E2E_BACKEND_URL: backendUrl, VITE_DEMO_MODE: '1' })
  await waitFor(frontendUrl, vite)
  console.log(`Demo site: ${frontendUrl}/`)
  console.log(`Staff workspace: ${frontendUrl}/staff`)
  console.log('Owner email: demo-owner@example.test')
  console.log('Staff email: demo-staff@example.test')
  console.log(`Temporary password: ${password}`)
  if (process.argv.includes('--check-only')) return
  console.log('Press Ctrl+C to stop. If Windows leaves sample files, run npm run demo:reset.')
  await new Promise(resolvePromise => {
    process.once('SIGINT', resolvePromise)
    process.once('SIGTERM', resolvePromise)
  })
}

try {
  await main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  for (const child of children.reverse()) stop(child)
  try { removeDemoDirectory(runDirectory) } catch (error) { console.error(`Could not remove demo database: ${error}`) }
  process.exit(process.exitCode ?? 0)
}
