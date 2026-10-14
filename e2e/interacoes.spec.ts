import { expect, test, type Page } from '@playwright/test'

async function login(page: Page, name: string) {
  await page.getByPlaceholder('Ex.: Ana').fill(name)
  await page.getByRole('button', { name: 'Entrar como convidado' }).click()
}
async function anchorNow(page: Page, name: string) {
  const box = await page.locator(`[data-anchor="${name}"]`).first().boundingBox()
  if (!box) throw new Error(`token ${name} não está visível`)
  return { x: box.x, y: box.y }
}
/** Posição na tela, esperando a câmera/token pararem de se mover. */
async function anchor(page: Page, name: string) {
  let prev = await anchorNow(page, name)
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150)
    const cur = await anchorNow(page, name)
    if (Math.abs(cur.x - prev.x) < 0.5 && Math.abs(cur.y - prev.y) < 0.5) return cur
    prev = cur
  }
  return prev
}
async function tokenPos(page: Page, name: string) {
  return page.evaluate((n) => {
    const t = Object.values(JSON.parse(localStorage.getItem('mesa-arcana:tokens') || '{}')).find((x: any) => x.name === n) as any
    return { x: t.x, y: t.y }
  }, name)
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10)
  await page.mouse.up()
}

test('interações no mapa: mover, paredes, menu do token, efeitos e novo personagem', async ({ context }) => {
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
  await expect(gm.getByTestId('theater-view')).toBeVisible()
  await gm.getByRole('tab', { name: 'Cenas' }).click()
  await gm.getByRole('button', { name: 'Ativar' }).click()
  await expect(gm.getByTestId('map-view')).toBeVisible()

  const pl = await context.newPage()
  pl.on('pageerror', (e) => errors.push(`[jogadora] ${e.message}`))
  await pl.goto(`/convite/${code}`)
  await login(pl, 'Bia')
  await pl.getByRole('button', { name: 'Entrar', exact: true }).click()
  await pl.getByTestId('enter-table').click()
  await expect(pl.getByTestId('map-view')).toBeVisible()
  await pl.getByRole('tab', { name: 'Fichas' }).click()
  await pl.locator('[data-testid="character-row"]', { hasText: 'Brunhilda' }).getByRole('button', { name: 'Assumir' }).click()
  await pl.waitForTimeout(1500)

  // arrastar duas casas para a direita
  const before = await tokenPos(pl, 'Brunhilda')
  const a = await anchor(pl, 'Brunhilda')
  const b = await anchor(pl, 'Sombra') // Sombra está 2 casas abaixo de Brunhilda (mesma coluna)
  const cell = Math.abs(b.y - a.y) / 2
  await drag(pl, a, { x: a.x + cell * 2, y: a.y })
  await expect.poll(() => tokenPos(pl, 'Brunhilda')).toEqual({ x: before.x + 140, y: before.y })
  // o mestre vê a mudança
  await expect.poll(async () => (await anchor(gm, 'Brunhilda')).x).toBeGreaterThan((await anchor(gm, 'Sombra')).x + 50)

  // tentar atravessar a parede de cima: volta para onde estava
  const now = await tokenPos(pl, 'Brunhilda')
  const a2 = await anchor(pl, 'Brunhilda')
  await drag(pl, a2, { x: a2.x, y: a2.y - cell * 3 })
  await pl.waitForTimeout(800)
  expect(await tokenPos(pl, 'Brunhilda')).toEqual(now)

  // ping (Alt+clique) e efeito de magia do mestre
  await pl.keyboard.down('Alt')
  await pl.mouse.click(a2.x + 40, a2.y + 40)
  await pl.keyboard.up('Alt')
  await gm.getByTestId('tool-spell').click()
  const g = await anchor(gm, 'Irmã Lúcia')
  await gm.mouse.click(g.x, g.y)
  await gm.waitForTimeout(400)
  await gm.screenshot({ path: 'test-results/10-bola-de-fogo.png' })
  await pl.screenshot({ path: 'test-results/11-bola-de-fogo-jogadora.png' })

  // menu do token: mestre oculta Sombra e a jogadora deixa de vê-la
  await gm.getByTestId('tool-select').click()
  const e = await anchor(gm, 'Sombra')
  await expect(async () => {
    await gm.mouse.click(e.x, e.y, { button: 'right' })
    await expect(gm.getByRole('button', { name: 'Ocultar dos jogadores' })).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20_000 })
  await gm.getByRole('button', { name: 'Ocultar dos jogadores' }).click()
  await expect(pl.locator('[data-anchor="Sombra"]')).toHaveCount(0)
  await expect(gm.locator('[data-anchor="Sombra"]')).toHaveCount(1)

  // dano pelo mestre aparece na barra (ficha da Brunhilda)
  await gm.mouse.click((await anchor(gm, 'Brunhilda')).x, (await anchor(gm, 'Brunhilda')).y)
  await gm.getByRole('button', { name: 'Dano' }).click()
  await pl.getByRole('tab', { name: 'Fichas' }).click()
  await expect(pl.locator('[data-testid="character-row"]', { hasText: 'Brunhilda' })).toBeVisible()
  await expect.poll(() => pl.evaluate(() => (Object.values(JSON.parse(localStorage.getItem('mesa-arcana:characters') || '{}')).find((c: any) => c.name === 'Brunhilda') as any).sheet.pv)).toBe(18)

  // nova personagem pelo assistente
  await pl.getByTestId('new-character').click()
  await pl.getByTestId('wizard-name').fill('Thalia')
  await pl.getByRole('button', { name: /Arcanista/ }).click()
  for (let i = 0; i < 4; i++) await pl.getByTestId('wizard-next').click()
  await pl.getByTestId('wizard-create').click()
  await expect(pl.getByRole('dialog').locator('input[value="Thalia"]')).toBeVisible()
  await pl.screenshot({ path: 'test-results/12-nova-ficha.png' })
  await pl.keyboard.press('Escape')

  // paredes: o mestre desenha uma parede nova
  await gm.getByTestId('tool-walls').click()
  const walls0 = await gm.evaluate(() => (Object.values(JSON.parse(localStorage.getItem('mesa-arcana:scenes') || '{}')).find((s: any) => s.kind === 'map') as any).walls.length)
  const s = await anchor(gm, 'Sombra')
  await gm.mouse.click(s.x + cell * 2, s.y)
  await gm.mouse.click(s.x + cell * 2, s.y - cell * 2)
  await gm.keyboard.press('Escape')
  await expect.poll(() => gm.evaluate(() => (Object.values(JSON.parse(localStorage.getItem('mesa-arcana:scenes') || '{}')).find((s: any) => s.kind === 'map') as any).walls.length)).toBe(walls0 + 1)

  expect(errors).toEqual([])
})
