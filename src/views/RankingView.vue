<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import { useCandidates } from '@/composables/useCandidates'
import { rankCandidates, evaluateCandidate } from '@/api/hrApi'
import type { RankResult, EvaluationResult, SkillResult } from '@/types'

const router = useRouter()
const { candidates, effectiveRole, activeVacancy, refresh } = useCandidates()

const loading = ref(true)
const error = ref('')
const ranked = ref<RankResult[]>([])
const rankLabel = ref('')
const minScore = ref(0)
const expandedId = ref<string | null>(null)
const skillsCache = ref<Record<string, EvaluationResult>>({})
const loadingSkills = ref<string | null>(null)

const filtered = computed(() =>
  ranked.value.filter(r => r.score >= minScore.value)
)

function nameFor(id: string): string {
  return candidates.value.find((c) => c.candidate_id === id)?.filename ?? id
}

function candidateScore(v: SkillResult): number {
  return v.candidate_score ?? (v as any).score ?? 0
}
function requiredLevel(v: SkillResult): number {
  return v.required_level ?? 100
}

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

async function toggleExpand(candidateId: string) {
  if (expandedId.value === candidateId) {
    expandedId.value = null
    return
  }
  expandedId.value = candidateId
  if (!skillsCache.value[candidateId]) {
    loadingSkills.value = candidateId
    try {
      skillsCache.value[candidateId] = await evaluateCandidate(
        candidateId, rankLabel.value, activeVacancy.value?.hash
      )
    } finally {
      loadingSkills.value = null
    }
  }
}

function goToEvaluate(candidateId: string) {
  router.push({ name: 'evaluate', params: { candidateId } })
}

onMounted(async () => {
  try {
    if (!effectiveRole.value) {
      router.replace({ name: 'workspace' })
      return
    }
    rankLabel.value = effectiveRole.value
    await refresh()
    if (!candidates.value.length) {
      router.replace({ name: 'workspace' })
      return
    }
    const ids = candidates.value.map((c) => c.candidate_id)
    ranked.value = await rankCandidates(effectiveRole.value, ids, activeVacancy.value?.hash)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка ранжирования'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="ranking-page">
    <div class="page-header">
      <Button icon="pi pi-arrow-left" text label="Назад" @click="router.push({ name: 'workspace' })" />
      <div>
        <h1 class="page-title">Рейтинг кандидатов</h1>
        <p class="page-subtitle">Роль: <strong>{{ rankLabel }}</strong></p>
      </div>
    </div>

        <Card>
          <template #content>
            <div v-if="loading" class="spinner-wrap">
              <ProgressSpinner />
              <span class="spinner-label">Ранжируем кандидатов…</span>
            </div>

            <div v-else-if="error" class="error-wrap">
              <i class="pi pi-exclamation-circle error-icon" />
              <span>{{ error }}</span>
            </div>

            <div v-else-if="!ranked.length" class="empty-wrap">
              Сервер не вернул результаты.
            </div>

            <template v-else>
              <!-- Filter -->
              <div class="filter-bar">
                <span class="filter-label">Минимальный балл: <strong>{{ minScore }}</strong></span>
                <input type="range" min="0" max="100" step="5" v-model.number="minScore" class="filter-slider" />
                <span class="filter-count">{{ filtered.length }} из {{ ranked.length }}</span>
              </div>

              <div class="rank-list">
                <template v-for="(item, i) in filtered" :key="item.candidate_id">
                  <!-- Main row -->
                  <div
                    class="rank-row"
                    :class="{ 'rank-row--expanded': expandedId === item.candidate_id }"
                    @click="toggleExpand(item.candidate_id)"
                  >
                    <span class="rank-pos" :class="`rank-pos--${i < 3 ? i + 1 : 'rest'}`">#{{ i + 1 }}</span>
                    <i class="pi pi-file-pdf rank-file-icon" />
                    <span class="rank-name" :title="nameFor(item.candidate_id)">{{ nameFor(item.candidate_id) }}</span>
                    <ProgressBar :value="item.score" class="rank-bar" />
                    <span class="rank-score" :style="{ color: scoreColor(item.score) }">{{ item.score.toFixed(1) }}</span>
                    <i
                      class="pi rank-chevron"
                      :class="expandedId === item.candidate_id ? 'pi-chevron-up' : 'pi-chevron-down'"
                    />
                    <Button icon="pi pi-arrow-right" text rounded size="small" @click.stop="goToEvaluate(item.candidate_id)" />
                  </div>

                  <!-- Expanded skills -->
                  <div v-if="expandedId === item.candidate_id" class="skill-expand">
                    <div v-if="loadingSkills === item.candidate_id" class="skill-expand__loading">
                      <i class="pi pi-spin pi-spinner" /> Загружаем навыки…
                    </div>
                    <div v-else-if="skillsCache[item.candidate_id]" class="skill-expand__grid">
                      <div
                        v-for="[skill, data] in Object.entries(skillsCache[item.candidate_id] ?? {}).sort(([,a],[,b]) => candidateScore(b) - candidateScore(a))"
                        :key="skill"
                        class="skill-mini"
                      >
                        <span class="skill-mini__name">{{ skill }}</span>
                        <div class="skill-mini__right">
                          <div class="skill-mini__bar-row">
                            <ProgressBar :value="candidateScore(data)" class="skill-mini__bar" />
                            <span class="skill-mini__score" :style="{ color: scoreColor(candidateScore(data)) }">
                              {{ candidateScore(data) }}<span class="skill-mini__req"> / {{ requiredLevel(data) }}</span>
                            </span>
                          </div>
                          <p class="skill-mini__reason">{{ data.reason }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </template>
        </Card>
  </div>
</template>

<style scoped>
.ranking-page {
  max-width: 760px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.page-subtitle {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.spinner-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 56px 20px;
  color: var(--text-color-secondary);
}
.spinner-label {
  font-size: 14px;
}

.error-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 28px;
  color: #dc2626;
  font-size: 14px;
}
.error-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.empty-wrap {
  padding: 40px;
  text-align: center;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 16px;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 8px;
}
.filter-label {
  font-size: 13px;
  color: var(--text-color-secondary);
  white-space: nowrap;
}
.filter-slider {
  flex: 1;
  accent-color: var(--app-accent, #10b981);
}
.filter-count {
  font-size: 12px;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 120ms;
}
.rank-row:hover {
  background: rgba(15, 23, 42, 0.04);
}
.rank-row--expanded {
  background: rgba(16, 185, 129, 0.05);
}

.rank-chevron {
  font-size: 12px;
  color: var(--text-color-secondary);
  flex-shrink: 0;
}

.skill-expand {
  margin: 0 10px 8px 46px;
  padding: 12px 16px;
  background: var(--surface-50, #f8fafc);
  border-radius: 8px;
}
.skill-expand__loading {
  font-size: 13px;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.skill-expand__grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.skill-mini {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 10px;
  align-items: start;
}
.skill-mini__name {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  padding-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-mini__right {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.skill-mini__bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.skill-mini__bar {
  flex: 1;
  height: 8px;
}
:deep(.skill-mini__bar .p-progressbar) {
  height: 8px;
}
.skill-mini__score {
  font-size: 13px;
  font-weight: 700;
  width: 60px;
  text-align: right;
  flex-shrink: 0;
  white-space: nowrap;
}
.skill-mini__req {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-color-secondary);
}
.skill-mini__reason {
  margin: 0;
  font-size: 11px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.rank-pos {
  font-size: 13px;
  font-weight: 700;
  width: 36px;
  text-align: center;
  flex-shrink: 0;
}
.rank-pos--1 { color: #f59e0b; }
.rank-pos--2 { color: #9ca3af; }
.rank-pos--3 { color: #cd7c2e; }
.rank-pos--rest { color: var(--text-color-secondary); }

.rank-file-icon {
  color: #e74c3c;
  font-size: 16px;
  flex-shrink: 0;
}
.rank-name {
  width: 200px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-bar {
  flex: 1;
}
:deep(.rank-bar .p-progressbar) {
  height: 8px;
}
.rank-score {
  font-size: 14px;
  font-weight: 700;
  width: 48px;
  text-align: right;
  flex-shrink: 0;
  color: var(--app-accent);
}
</style>
