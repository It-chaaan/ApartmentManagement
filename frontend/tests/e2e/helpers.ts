import { expect, type Page } from '@playwright/test'

export const ownerEmail = 'owner@e2e.test'
export const staffEmail = 'staff@e2e.test'

export async function signIn(page: Page, email = ownerEmail) {
  await page.goto('/staff')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

export async function openSection(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Staff pages' }).getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${name}$`, 'i') })).toBeVisible()
}
