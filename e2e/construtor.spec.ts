import { expect, test } from '@playwright/test'

test('mestre constrói um mapa com salas, porta e tocha; paredes e luzes são geradas', async ({ page }) => {
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
  await page.waitForTimeout(1500)
  await page.keyboard.press('b')
  await expect(page.getByTestId('build-palette')).toBeVisible()

  const box = (await page.getByTestId('map-view').boundingBox())!
  const scene = () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('mesa-arcana:scenes') || '{}'))[0] as any)
  const s0 = await scene()
  // célula → tela (o mapa começa enquadrado na área visível)
  const zoom = Math.min(box.width / s0.map_w, box.height / s0.map_h) * 0.95
  const ox = box.x + box.width / 2 - (s0.map_w / 2) * zoom
  const oy = box.y + box.height / 2 - (s0.map_h / 2) * zoom
  const cell = (cx: number, cy: number) => ({ x: ox + (cx + 8.5) * 70 * zoom, y: oy + (cy + 0.5) * 70 * zoom })
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }) => {
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8)
    await page.mouse.up()
  }

  // duas salas (modo Sala é o padrão) ligadas por um corredor
  await drag(cell(2, 2), cell(10, 9))
  await page.getByTitle('Madeira escura').click()
  await page.getByTitle('Parede de pedra').click()
  await drag(cell(10, 4), cell(19, 12))
  await expect.poll(async () => Object.keys((await scene()).build?.tiles ?? {}).length).toBeGreaterThan(100)

  // porta na parede compartilhada e uma tocha
  await page.getByRole('button', { name: 'Objetos' }).click()
  await page.getByTitle('Porta', { exact: true }).click()
  await page.mouse.click(cell(10, 6).x, cell(10, 6).y)
  await page.getByTitle(/^Tocha/).click()
  await page.mouse.click(cell(4, 4).x, cell(4, 4).y)
  await page.getByTitle(/^Barril/).click()
  await page.mouse.click(cell(8, 7).x, cell(8, 7).y)

  await expect.poll(async () => (await scene()).lights.filter((l: any) => l.auto).length).toBe(1)
  const s1 = await scene()
  expect(s1.walls.filter((w: any) => w.auto && w.kind === 'wall').length).toBeGreaterThan(4)
  expect(s1.walls.filter((w: any) => w.auto && w.kind === 'door').length).toBe(1)
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'test-results/30-construtor.png' })

  // ver o resultado sem a paleta, com escuridão
  await page.keyboard.press('v')
  await page.getByRole('tab', { name: 'Cenas' }).click()
  await page.getByText('Visão dinâmica').click()
  await page.locator('input[type=range]').nth(1).fill('0.2')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/31-construtor-luz.png' })
  expect(errors).toEqual([])
})
