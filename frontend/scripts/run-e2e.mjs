import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(frontend, '..', 'backend')
const testingRoot = resolve(backend, 'storage', 'framework', 'testing')
const runDirectory = resolve(testingRoot, `e2e-${Date.now()}-${randomBytes(4).toString('hex')}`)
const database = join(runDirectory, 'database.sqlite').replaceAll('\\', '/')
const backendUrl = 'http://127.0.0.1:18080'
const frontendUrl = 'http://127.0.0.1:15173'
const testPassword = `E2e-${randomBytes(18).toString('base64url')}`
const browserPath = '0'
const php = process.env.E2E_PHP || 'php'
const children = []

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`)
}

async function assertPortFree(port) {
  await new Promise((resolvePromise, reject) => {
    const server = createServer()
    server.once('error', () => reject(new Error(`Port ${port} is in use; stop that server before running isolated tests.`)))
    server.listen(port, '127.0.0.1', () => server.close(resolvePromise))
  })
}

async function waitFor(url, processHandle) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (processHandle.exitCode !== null) throw new Error(`Test server exited before ${url} became ready.`)
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

async function main() {
  if (!existsSync(join(backend, 'vendor', 'autoload.php'))) throw new Error('Install backend Composer dependencies first.')
  await Promise.all([assertPortFree(18080), assertPortFree(15173)])
  mkdirSync(runDirectory, { recursive: true })
  const fd = openSync(database, 'w')
  closeSync(fd)

  const backendEnv = {
    ...process.env,
    APP_ENV: 'e2e', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`,
    APP_URL: backendUrl, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '',
    SESSION_DRIVER: 'database', CACHE_STORE: 'array', QUEUE_CONNECTION: 'sync',
    E2E_TEST_PASSWORD: testPassword,
  }
  run(php, ['artisan', 'migrate', '--seed', '--force', '--no-interaction'], backend, backendEnv)
  run(php, ['artisan', 'db:seed', '--class=E2eSeeder', '--force', '--no-interaction'], backend, backendEnv)

  const laravel = start(php, ['artisan', 'serve', '--host=127.0.0.1', '--port=18080', '--tries=1', '--no-reload', '--no-interaction'], backend, backendEnv)
  await waitFor(`${backendUrl}/api/public/site`, laravel)
  const vite = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host=127.0.0.1', '--port=15173', '--strictPort', '--configLoader', 'native'], frontend, { ...process.env, E2E_BACKEND_URL: backendUrl })
  await waitFor(frontendUrl, vite)

  const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
    cwd: frontend,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserPath, E2E_ISOLATED: '1', E2E_BASE_URL: frontendUrl, E2E_TEST_PASSWORD: testPassword },
    stdio: 'inherit', shell: false,
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

try {
  await main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  for (const child of children.reverse()) stop(child)
  const insideTesting = relative(testingRoot, runDirectory)
  if (insideTesting && insideTesting !== '..' && !insideTesting.startsWith(`..${sep}`)) {
    try { rmSync(runDirectory, { recursive: true, force: true }) } catch (error) { console.error(`Could not remove isolated test database: ${error}`) }
  }
}
