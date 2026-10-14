import { expect, test } from '@playwright/test'

test('efeitos sonoros carregam e tocam (arquivos reais via Howler)', async ({ page }) => {
  const sfx: string[] = []
  const bad: string[] = []
  page.on('response', (r) => {
    if (r.url().includes('/sfx/')) (r.ok() ? sfx : bad).push(r.url().split('/sfx/')[1])
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByPlaceholder('Ex.: Ana').fill('Mestre')
  await page.getByRole('button', { name: 'Entrar como convidado' }).click()
  await page.getByRole('button', { name: 'Nova campanha' }).click()
  await page.getByText('Incluir aventura de exemplo').click()
  await page.getByRole('button', { name: 'Criar e abrir a mesa' }).click()
  await page.getByTestId('open-prep').click()
  await expect(page.getByTestId('map-view')).toBeVisible()
  await page.getByTestId('chat-input').fill('2d20')
  await page.getByTestId('chat-input').press('Enter')
  await expect(page.getByTestId('roll-badge')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('tool-spell').click()
  await page.mouse.click(500, 400)
  await page.waitForTimeout(1500)
  expect(bad).toEqual([])
  expect(sfx).toEqual(expect.arrayContaining(['dado-agitar.mp3', 'bola-de-fogo.mp3']))
  expect(sfx.some((f) => f.startsWith('dado-') && f !== 'dado-agitar.mp3')).toBe(true)
  expect(errors).toEqual([])
})
