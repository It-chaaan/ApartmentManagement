import { expect, test } from '@playwright/test'
import { ownerEmail } from './helpers'

test.skip(process.env.E2E_MFA !== '1', 'Run this flow with npm run test:e2e:mfa')

test('owner requests an email code before reaching the dashboard on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/staff')
  await page.getByLabel('Email address').fill(ownerEmail)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('six-digit sign-in code was sent')
  expect((await page.request.get('/api/me', { headers: { Accept: 'application/json' } })).status()).toBe(403)
  await expect(page.getByLabel('Six-digit code')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send a new code' })).toBeVisible()
})
