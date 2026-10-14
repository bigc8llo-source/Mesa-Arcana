import { expect, test, type Page } from '@playwright/test'

/**
 * Jogo completo no modo demonstração: mestre e jogadora em duas abas do mesmo navegador
 * (o modo local sincroniza abas via BroadcastChannel, simulando o Supabase Realtime).
 */
async function login(page: Page, name: string) {
  await page.getByPlaceholder('Ex.: Ana').fill(name)
  await page.getByRole('button', { name: 'Entrar como convidado' }).click()
}

test('mestre cria aventura de exemplo e jogadora entra, joga e rola dados', async ({ context }) => {
  const errors: string[] = []
  const gm = await context.newPage()
  gm.on('pageerror', (e) => errors.push(`[gm] ${e.message}`))
  await gm.goto('/')
  await login(gm, 'Mestre')
  await gm.getByRole('button', { name: 'Nova campanha' }).click()
  await gm.getByRole('button', { name: 'Criar e abrir a mesa' }).click()
  await expect(gm.getByTestId('theater-view')).toBeVisible({ timeout: 60_000 })
  await expect(gm.getByText('Preparando a aventura', { exact: false })).toHaveCount(0, { timeout: 60_000 })
  await gm.screenshot({ path: 'test-results/01-mestre-teatro.png' })

  // código de convite
  const code = (await gm.locator('header button[title="Copiar link de convite"] span.font-mono').textContent())!.trim()
  expect(code).toMatch(/^[A-Z0-9]{6}$/)

  const pl = await context.newPage()
  pl.on('pageerror', (e) => errors.push(`[jogadora] ${e.message}`))
  await pl.goto(`/convite/${code}`)
  await login(pl, 'Ana')
  await pl.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(pl.getByTestId('theater-view')).toBeVisible()

  // jogadora assume uma heroína
  await pl.getByRole('tab', { name: 'Fichas' }).click()
  await pl.getByRole('button', { name: 'Assumir' }).first().click()
  await expect(pl.getByText('· Ana').first()).toBeVisible()

  // mestre leva todos para a masmorra
  await gm.getByRole('tab', { name: 'Cenas' }).click()
  await gm.locator('div', { hasText: /^Cripta do Rei Goblin/ }).getByRole('button', { name: 'Ativar' }).click()
  await expect(gm.getByTestId('map-view')).toBeVisible()
  await expect(pl.getByTestId('map-view')).toBeVisible()
  await pl.waitForTimeout(2500)
  await pl.screenshot({ path: 'test-results/02-jogadora-masmorra-nevoa.png' })
  await gm.screenshot({ path: 'test-results/03-mestre-masmorra.png' })

  // rolagem pelo chat aparece para os dois
  await pl.getByRole('tab', { name: 'Chat' }).click()
  await pl.getByTestId('chat-input').fill('1d20+5')
  await pl.getByTestId('chat-input').press('Enter')
  await expect(pl.getByTestId('dice-overlay')).toBeVisible()
  await pl.waitForTimeout(1200)
  await pl.screenshot({ path: 'test-results/04-dados-3d.png' })
  await gm.getByRole('tab', { name: 'Chat' }).click()
  await expect(gm.getByTestId('chat-log').getByText('1d20+5').first()).toBeVisible()
  await expect(pl.getByTestId('roll-badge')).toBeVisible({ timeout: 15_000 })

  // ficha com sprite
  await pl.getByRole('tab', { name: 'Fichas' }).click()
  await pl.getByTestId('character-row').first().click()
  await expect(pl.getByRole('dialog')).toBeVisible()
  await pl.waitForTimeout(800)
  await pl.screenshot({ path: 'test-results/05-ficha.png' })
  await pl.keyboard.press('Escape')

  // mestre inicia combate
  await gm.getByRole('tab', { name: 'Combate' }).click()
  await gm.getByTestId('start-combat').click()
  await expect(gm.getByText('Rodada 1')).toBeVisible()
  await gm.getByTestId('next-turn').click()
  await pl.getByRole('tab', { name: 'Combate' }).click()
  await expect(pl.getByText('Rodada 1')).toBeVisible()
  await gm.screenshot({ path: 'test-results/06-combate.png' })

  // modo 2.5D
  await pl.getByRole('button', { name: 'Modo 2.5D (miniaturas em pé)' }).click()
  await pl.waitForTimeout(1500)
  await pl.screenshot({ path: 'test-results/07-modo-25d.png' })

  expect(errors).toEqual([])
})
