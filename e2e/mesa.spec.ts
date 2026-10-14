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
  await expect(gm.getByTestId('start-session')).toBeVisible()
  // aventura de exemplo pronta: 4 heróis + 3 tipos de monstro + mensagem de boas-vindas
  await expect.poll(() => gm.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mesa-arcana:tokens') || '{}')).length), { timeout: 60_000 }).toBe(9)
  await expect.poll(() => gm.evaluate(() => Object.values(JSON.parse(localStorage.getItem('mesa-arcana:chat') || '{}')).length), { timeout: 30_000 }).toBeGreaterThan(0)
  const code = (await gm.getByTestId('invite-code').textContent())!.trim()
  await gm.getByTestId('start-session').click()
  await expect(gm.getByTestId('theater-view')).toBeVisible({ timeout: 60_000 })
  await gm.screenshot({ path: 'test-results/01-mestre-teatro.png' })

  // código de convite
  expect(code).toMatch(/^[A-Z0-9]{6}$/)

  const pl = await context.newPage()
  pl.on('pageerror', (e) => errors.push(`[jogadora] ${e.message}`))
  await pl.goto(`/convite/${code}`)
  await login(pl, 'Ana')
  await pl.getByRole('button', { name: 'Entrar', exact: true }).click()
  await pl.getByTestId('enter-table').click()
  await expect(pl.getByTestId('theater-view')).toBeVisible()

  // jogadora assume uma heroína
  await pl.getByRole('tab', { name: 'Ficha' }).click()
  await pl.getByTestId('claim-Brunhilda').click()
  await expect(pl.getByTestId('my-sheet')).toBeVisible()
  // ataque explicado: acerto separado do dano
  const card = pl.getByTestId('my-sheet').getByTestId('attack-card').first()
  await expect(card.getByText('Para acertar')).toBeVisible()
  await expect(card.getByText('Dano ao acertar')).toBeVisible()
  await expect(card.getByText(/Role um dado de 20 faces/)).toBeVisible()
  await expect(card.getByText(/Role 1 dado de \d+ faces/)).toBeVisible()
  // inventário: itens empilháveis somam; moedas não pesam
  const inv = pl.getByTestId('my-sheet').getByTestId('inventory')
  await inv.getByLabel('Item da lista').selectOption('Poção de cura')
  await inv.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await inv.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(inv.getByTestId('item-row').filter({ hasText: 'Poção de cura' })).toContainText('×2')
  const load = await inv.getByTestId('carry-load').textContent()
  await inv.getByLabel('Item da lista').selectOption({ index: 1 })
  await inv.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(inv.getByTestId('coin-row')).toHaveCount(1)
  await expect(inv.getByTestId('carry-load')).toHaveText(load!)

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
  await expect(pl.getByTestId('roll-badge')).toBeVisible({ timeout: 15_000 })
  await pl.screenshot({ path: 'test-results/04-dados-3d.png' })
  await gm.getByRole('tab', { name: 'Chat' }).click()
  await expect(gm.getByTestId('chat-log').getByText('1d20+5').first()).toBeVisible()

  // ficha com sprite
  await pl.getByRole('tab', { name: 'Ficha' }).click()
  await pl.getByRole('button', { name: 'Ficha completa' }).click()
  await expect(pl.getByRole('dialog')).toBeVisible()
  await pl.waitForTimeout(800)
  await pl.screenshot({ path: 'test-results/05-ficha.png' })
  await pl.keyboard.press('Escape')

  // mestre inicia combate
  await gm.getByRole('tab', { name: 'Combate' }).click()
  await gm.getByTestId('start-combat').click()
  await expect(gm.getByText('Rodada 1')).toBeVisible()
  await gm.getByTestId('next-turn').click()
  await expect(pl.getByTestId('turn-bar')).toBeVisible()
  await gm.screenshot({ path: 'test-results/06-combate.png' })

  // modo 2.5D
  await pl.getByRole('button', { name: 'Modo 2.5D (miniaturas em pé)' }).click()
  await pl.waitForTimeout(1500)
  await pl.screenshot({ path: 'test-results/07-modo-25d.png' })

  expect(errors).toEqual([])
})
