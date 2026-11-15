process.env.PLAYWRIGHT_BROWSERS_PATH = '0'
process.argv.push('--portfolio')
await import('./run-demo.mjs')
