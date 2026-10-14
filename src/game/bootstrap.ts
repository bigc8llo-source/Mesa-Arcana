import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGame, useMe } from '../store/game'
import { defaultScene, seedSampleCampaign } from './actions'
import { backend } from '../data'

/** Campanhas já preparadas nesta aba (evita criar cenas em dobro). */
const bootstrapped = new Set<string>()

/**
 * Entra na campanha (carrega dados + Realtime) e, numa campanha nova do mestre,
 * cria a aventura de exemplo (?exemplo=1) ou a primeira cena.
 * Retorna a mensagem de progresso enquanto prepara.
 */
export function useCampaignBootstrap(id: string): string | null {
  const user = useGame((s) => s.user)
  const loading = useGame((s) => s.loading)
  const campaign = useGame((s) => s.campaign)
  const campaignId = useGame((s) => s.campaignId)
  const me = useMe()
  const [params, setParams] = useSearchParams()
  const [seeding, setSeeding] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void useGame.getState().enter(id)
    return () => useGame.getState().leave()
  }, [id, user])

  useEffect(() => {
    if (!campaign || campaignId !== id || !me || me.role !== 'gm' || loading || seeding) return
    const s = useGame.getState()
    if (Object.keys(s.scenes).length > 0 || bootstrapped.has(id)) return
    bootstrapped.add(id)
    const sample = params.get('exemplo') === '1'
    if (sample) setParams({}, { replace: true })
    void (async () => {
      // confere no servidor: outra aba/execução pode já ter criado
      if ((await backend.select('scenes', id)).length > 0) return void s.reload()
      if (sample) {
        setSeeding('Preparando a aventura…')
        await seedSampleCampaign(setSeeding)
          .catch((e) => s.set({ error: (e as Error).message }))
          .finally(() => setSeeding(null))
      } else {
        const sc = defaultScene(id, 'Primeira cena')
        await s.save('scenes', sc)
        await s.patch('campaigns', id, { active_scene_id: sc.id })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, campaignId, me?.role, loading])

  return seeding
}
