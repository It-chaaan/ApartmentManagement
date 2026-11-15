import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const viewport = { width: 1440, height: 900 }

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

function browserFrame(label, screenshot) {
  const image = `data:image/png;base64,${screenshot.toString('base64')}`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } html, body { margin: 0; width: 100%; height: 100%; }
    body { background: radial-gradient(circle at 12% 14%, #e8eff4 0, transparent 32%), linear-gradient(145deg, #dce7ee, #ecf0f2 48%, #cbd9e3); color: #0b1f3a; font-family: Arial, sans-serif; }
    .canvas { width: 1600px; height: 1090px; padding: 61px 80px 0; }
    .window { width: 1440px; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 35px 70px rgba(14, 38, 58, .24), 0 2px 8px rgba(14, 38, 58, .12); border: 1px solid rgba(255,255,255,.8); }
    .toolbar { height: 48px; display: flex; align-items: center; gap: 20px; padding: 0 18px; background: #f4f5f6; border-bottom: 1px solid #d9dde0; }
    .lights { display: flex; gap: 8px; } .lights span { display:block; width:12px; height:12px; border-radius:50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.1); }
    .red { background:#ff5f57; } .yellow { background:#febc2e; } .green { background:#28c840; }
    .arrows { color: #77818b; font-size: 22px; letter-spacing: 8px; margin-left: 12px; line-height: 1; }
    .address { width: 650px; height: 30px; margin: 0 auto; border: 1px solid #d8dde1; border-radius: 7px; background: #fff; display: flex; align-items: center; justify-content: center; color:#5c6770; font-size: 13px; letter-spacing: .01em; }
    .address b { font-size: 11px; margin-right: 7px; color: #6c7981; }
    .screen { width: 1440px; height: 900px; display:block; object-fit: cover; object-position: top left; }
    .caption { display:flex; align-items:center; justify-content:space-between; margin-top: 26px; color:#19344a; }
    .caption strong { font-size: 19px; letter-spacing: -.02em; } .caption span { font-size: 12px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
  </style></head><body><div class="canvas"><div class="window"><div class="toolbar"><div class="lights"><span class="red"></span><span class="yellow"></span><span class="green"></span></div><div class="arrows">‹›</div><div class="address"><b>◆</b> Guillermo Apartment · local demo</div></div><img class="screen" alt="" src="${image}"></div><div class="caption"><strong>${escapeHtml(label)}</strong><span>Guillermo Apartment · Portfolio Preview</span></div></div></body></html>`
}

function contactSheet(images) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } body { margin:0; background:#e4ebef; color:#102d40; font-family:Arial,sans-serif; }
    main { width:1600px; padding:60px 70px; } header { display:flex; justify-content:space-between; align-items:end; margin-bottom:36px; }
    h1 { margin:0; font-size:42px; letter-spacing:-.04em; } small { text-transform:uppercase; letter-spacing:.15em; font-weight:700; color:#5d6e79; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:28px; } article { background:#fff; padding:12px; border-radius:14px; box-shadow:0 15px 36px rgba(19,48,69,.14); }
    img { display:block; width:100%; border-radius:7px; } h2 { font-size:19px; margin:14px 4px 5px; }
  </style></head><body><main><header><div><small>Guillermo Apartment</small><h1>Portfolio screenshots</h1></div><small>Fictional demo records · ${images.length} views</small></header><div class="grid">${images.map(({ label, buffer }) => `<article><img alt="" src="data:image/png;base64,${buffer.toString('base64')}"><h2>${escapeHtml(label)}</h2></article>`).join('')}</div></main></body></html>`
}

export async function capturePortfolio({ frontendUrl, password, outputDirectory }) {
  mkdirSync(outputDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const app = await context.newPage()
  const frames = []

  async function save(name, label) {
    await app.evaluate(async () => { await document.fonts.ready })
    await app.waitForTimeout(350)
    const raw = await app.screenshot({ animations: 'disabled' })
    const frame = await browser.newPage({ viewport: { width: 1600, height: 1090 }, deviceScaleFactor: 2 })
    try {
      await frame.setContent(browserFrame(label, raw), { waitUntil: 'load' })
      const buffer = await frame.screenshot({ animations: 'disabled' })
      writeFileSync(join(outputDirectory, name), buffer)
      frames.push({ label, buffer })
      console.log(`Exported ${name}`)
    } finally {
      await frame.close()
    }
  }

  async function openStaff(section, title) {
    await app.goto(`${frontendUrl}/staff#${section}`)
    await app.getByRole('heading', { level: 1, name: title }).waitFor()
    await app.waitForLoadState('networkidle')
  }

  try {
    await app.goto(frontendUrl)
    await app.getByRole('heading', { level: 1 }).waitFor()
    await app.waitForLoadState('networkidle')
    await save('01-public-home.png', 'Public landing page')

    await app.goto(`${frontendUrl}/staff`)
    await app.getByLabel('Email address').fill('demo-owner@example.test')
    await app.getByLabel('Password', { exact: true }).fill(password)
    await app.getByRole('button', { name: 'Sign in', exact: true }).click()
    await app.getByRole('heading', { level: 1, name: 'Dashboard' }).waitFor()
    await app.waitForLoadState('networkidle')
    await save('02-staff-dashboard.png', 'Staff operations dashboard')

    await openStaff('rooms', 'Rooms')
    await app.getByText('18 of 18 rooms').waitFor()
    await save('03-room-inventory.png', 'Room inventory and availability')

    await openStaff('tenancy', 'Tenants & Contracts')
    await app.getByRole('group', { name: 'Tenancy views' }).getByRole('button', { name: 'Contracts' }).click()
    await app.getByRole('button', { name: 'New contract' }).waitFor()
    await save('04-tenancy-contracts.png', 'Tenant contracts and terms')

    await openStaff('payments', 'Payments & Bills')
    await save('05-rent-ledger.png', 'Rent ledger and payment history')

    await app.getByRole('button', { name: 'Utilities', exact: true }).click()
    await app.getByRole('heading', { name: 'Utility bills', exact: true }).waitFor()
    await app.getByRole('heading', { name: 'Meter-based charges' }).waitFor()
    await save('06-meter-billing.png', 'Meter-based utility review')

    await app.getByRole('heading', { name: 'Utility bills', exact: true }).scrollIntoViewIfNeeded()
    await app.evaluate(() => window.scrollBy(0, 530))
    await save('07-utility-bills.png', 'Utility bills and balances')

    await openStaff('inspections', 'Checklists')
    await save('08-inspections.png', 'Room inspection checklists')

    const overview = await browser.newPage({ viewport: { width: 1600, height: 2600 }, deviceScaleFactor: 1 })
    try {
      await overview.setContent(contactSheet(frames), { waitUntil: 'load' })
      await overview.screenshot({ path: join(outputDirectory, '00-overview.png'), fullPage: true, animations: 'disabled' })
      console.log('Exported 00-overview.png')
    } finally {
      await overview.close()
    }
  } finally {
    await context.close()
    await browser.close()
  }
}
