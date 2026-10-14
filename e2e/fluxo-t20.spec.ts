import { expect, test, type Page } from '@playwright/test'

async function login(page: Page, name: string) {
  await page.getByPlaceholder('Ex.: Ana').fill(name)
  await page.getByRole('button', { name: 'Entrar como convidado' }).click()
}

test('mestre prepara campanha T20, jogador cria ficha no assistente e passa o próprio turno', async ({ context }) => {
  const errors: string[] = []
  const gm = await context.newPage()
  gm.on('pageerror', (e) => errors.push(`[gm] ${e.message}`))
  await gm.goto('/')
  await login(gm, 'Mestre')
  await gm.getByRole('button', { name: 'Nova campanha' }).click()
  await gm.getByRole('textbox').first().fill('Ameaça em Valkaria')
  await gm.getByText('Incluir aventura de exemplo').click() // desmarca
  await gm.getByRole('button', { name: 'Criar e abrir a mesa' }).click()

  // saguão de preparação
  await expect(gm.getByText('Preparação do mestre')).toBeVisible()
  await expect(gm.getByText('Tormenta20 ·')).toBeVisible()
  await gm.getByPlaceholder(/Em Arton/).fill('Uma ameaça ronda a capital do Reinado.')
  await gm.getByPlaceholder(/Em Arton/).blur()
  const code = (await gm.getByTestId('invite-code').textContent())!.trim()
  await gm.screenshot({ path: 'test-results/20-saguao-mestre.png', fullPage: true })

  // jogador entra pelo convite e cria a ficha
  const pl = await context.newPage()
  pl.on('pageerror', (e) => errors.push(`[jogador] ${e.message}`))
  await pl.goto(`/convite/${code}`)
  await login(pl, 'Caio')
  await pl.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(pl.getByText('Uma ameaça ronda a capital do Reinado.')).toBeVisible()
  await pl.getByTestId('create-sheet').click()
  await pl.getByTestId('wizard-name').fill('Kael')
  await pl.getByRole('button', { name: /Arcanista/ }).click()
  await pl.getByTestId('wizard-next').click()
  await pl.getByRole('button', { name: 'Rolar atributos' }).click()
  await pl.getByTestId('wizard-next').click()
  await pl.getByText('Misticismo').click()
  await pl.getByText('Vontade').click()
  await pl.getByTestId('wizard-next').click()
  await pl.getByTestId('wizard-next').click()
  await pl.screenshot({ path: 'test-results/21-assistente-revisao.png' })
  await pl.getByTestId('wizard-create').click()
  await expect(pl.getByRole('dialog').locator('input[value="Kael"]')).toBeVisible()
  await pl.screenshot({ path: 'test-results/22-ficha-t20.png' })
  await pl.keyboard.press('Escape')
  await expect(gm.getByText('Kael (Humano Arcanista 1)')).toBeVisible()

  // mestre inicia a sessão; jogador entra na mesa
  await gm.getByTestId('start-session').click()
  await expect(gm.getByTestId('map-view')).toBeVisible()
  await expect(pl.getByText('Sessão 1 em andamento!')).toBeVisible()
  await pl.getByTestId('enter-table').click()
  await expect(pl.getByTestId('map-view')).toBeVisible()

  // mestre adiciona um goblin e inicia o combate
  await gm.getByRole('tab', { name: 'Fichas' }).click()
  await gm.getByRole('button', { name: 'Bestiário' }).click()
  await gm.locator('div', { hasText: /^Goblin/ }).getByRole('button', { name: 'Adicionar' }).first().click()
  await gm.getByRole('tab', { name: 'Combate' }).click()
  await gm.getByTestId('start-combat').click()
  await expect(gm.getByTestId('turn-bar')).toBeVisible()
  await expect(pl.getByTestId('turn-bar')).toBeVisible()

  // avança até ser a vez do Kael, e o jogador encerra o próprio turno
  const isKaelTurn = () => pl.getByRole('button', { name: 'Encerrar meu turno' }).isVisible()
  if (!(await isKaelTurn())) await gm.getByTestId('end-turn').click()
  await expect(pl.getByRole('button', { name: 'Encerrar meu turno' })).toBeVisible()
  await pl.screenshot({ path: 'test-results/23-sua-vez.png' })
  await pl.getByRole('button', { name: 'Encerrar meu turno' }).click()
  await expect(pl.getByRole('button', { name: 'Encerrar meu turno' })).toHaveCount(0)
  await expect(pl.getByTestId('chat-log').getByText(/Vez de Goblin/).first()).toBeVisible()

  expect(errors).toEqual([])
})
