<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
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
  const f = candidates.value.find((c) => c.candidate_id === id)?.filename ?? id
  return f.replace(/\.pdf$/i, '')
}

function candidateScore(v: SkillResult): number {
  return v.candidate_score ?? (v as any).score ?? 0
}
function requiredLevel(v: SkillResult): number {
  return v.required_level ?? 100
}
function fitScore(v: SkillResult): number {
  const req = requiredLevel(v)
  return req > 0 ? Math.min(Math.round(candidateScore(v) / req * 100), 100) : candidateScore(v)
}

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function medalLabel(i: number): string {
  return ['🥇', '🥈', '🥉'][i] ?? String(i + 1)
}

function sortedSkills(id: string) {
  const cache = skillsCache.value[id]
  if (!cache) return []
  return Object.entries(cache).sort(([, a], [, b]) => fitScore(b) - fitScore(a))
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
    if (!effectiveRole.value) { router.replace({ name: 'workspace' }); return }
    rankLabel.value = effectiveRole.value
    await refresh()
    if (!candidates.value.length) { router.replace({ name: 'workspace' }); return }
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
    <!-- Header -->
    <div class="page-header">
      <Button icon="pi pi-arrow-left" text label="Назад" @click="router.push({ name: 'workspace' })" />
      <div>
        <h1 class="page-title">Рейтинг кандидатов</h1>
        <p class="page-subtitle">Роль: <strong>{{ rankLabel }}</strong></p>
      </div>
    </div>

    <!-- States -->
    <div v-if="loading" class="spinner-wrap">
      <ProgressSpinner />
      <span class="spinner-label">Ранжируем кандидатов…</span>
    </div>
    <div v-else-if="error" class="error-wrap">
      <i class="pi pi-exclamation-circle error-icon" />
      <span>{{ error }}</span>
    </div>
    <div v-else-if="!ranked.length" class="empty-wrap">Сервер не вернул результаты.</div>

    <template v-else>
      <!-- Filter -->
      <div class="filter-bar">
        <span class="filter-label">Минимальный балл: <strong>{{ minScore }}</strong></span>
        <input type="range" min="0" max="100" step="5" v-model.number="minScore" class="filter-slider" />
        <span class="filter-count">{{ filtered.length }} из {{ ranked.length }}</span>
      </div>

      <!-- List -->
      <div class="rank-list">
        <template v-for="(item, i) in filtered" :key="item.candidate_id">

          <!-- Row -->
          <div
            class="rank-card"
            :class="{ 'rank-card--expanded': expandedId === item.candidate_id, [`rank-card--top${i + 1}`]: i < 3 }"
            @click="toggleExpand(item.candidate_id)"
          >
            <!-- Medal -->
            <div class="rank-medal" :class="`rank-medal--${i < 3 ? i + 1 : 'rest'}`">
              <span>{{ medalLabel(i) }}</span>
            </div>

            <!-- Info -->
            <div class="rank-info">
              <div class="rank-info__top">
                <span class="rank-name" :title="nameFor(item.candidate_id)">{{ nameFor(item.candidate_id) }}</span>
                <span class="rank-score" :style="{ color: scoreColor(item.score) }">{{ item.score.toFixed(1) }}</span>
              </div>

              <!-- Skill dots (shown once loaded) -->
              <div v-if="skillsCache[item.candidate_id]" class="rank-dots">
                <span
                  v-for="[skill, data] in sortedSkills(item.candidate_id)"
                  :key="skill"
                  class="rank-dot"
                  :style="{ background: scoreColor(fitScore(data)) }"
                  :title="`${skill}: ${candidateScore(data)} / ${requiredLevel(data)}`"
                />
              </div>
              <div v-else class="rank-dots rank-dots--placeholder">
                <span v-for="n in 6" :key="n" class="rank-dot rank-dot--empty" />
              </div>
            </div>

            <!-- Actions -->
            <div class="rank-actions">
              <i class="pi rank-chevron" :class="expandedId === item.candidate_id ? 'pi-chevron-up' : 'pi-chevron-down'" />
              <Button icon="pi pi-arrow-right" text rounded size="small" @click.stop="goToEvaluate(item.candidate_id)" />
            </div>
          </div>

          <!-- Expanded skills -->
          <div v-if="expandedId === item.candidate_id" class="skill-panel">
            <div v-if="loadingSkills === item.candidate_id" class="skill-panel__loading">
              <i class="pi pi-spin pi-spinner" /> Загружаем навыки…
            </div>
            <div v-else class="skill-grid">
              <div
                v-for="[skill, data] in sortedSkills(item.candidate_id)"
                :key="skill"
                class="skill-card"
              >
                <div class="skill-card__header">
                  <span class="skill-card__name">{{ skill }}</span>
                  <span class="skill-card__score" :style="{ color: scoreColor(fitScore(data)) }">
                    {{ candidateScore(data) }}<span class="skill-card__req"> / {{ requiredLevel(data) }}</span>
                  </span>
                </div>
                <ProgressBar :value="candidateScore(data)" class="skill-card__bar" />
                <p class="skill-card__reason">{{ data.reason }}</p>
              </div>
            </div>
          </div>

        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ranking-page {
  max-width: 820px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.page-title { margin: 0; font-size: 22px; font-weight: 700; }
.page-subtitle { margin: 4px 0 0; color: var(--text-color-secondary); font-size: 14px; }

.spinner-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 56px 20px;
  color: var(--text-color-secondary);
}
.spinner-label { font-size: 14px; }

.error-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 28px;
  color: #dc2626;
  font-size: 14px;
}
.error-icon { font-size: 20px; flex-shrink: 0; }

.empty-wrap {
  padding: 40px;
  text-align: center;
  color: var(--text-color-secondary);
  font-size: 14px;
}

/* Filter */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.filter-label { font-size: 13px; color: var(--text-color-secondary); white-space: nowrap; }
.filter-slider { flex: 1; accent-color: var(--app-accent, #10b981); }
.filter-count { font-size: 12px; color: var(--text-color-secondary); white-space: nowrap; }

/* List */
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Card */
.rank-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
  background: #fff;
  cursor: pointer;
  transition: background 120ms, box-shadow 120ms;
}
.rank-card:hover {
  background: var(--surface-50, #f8fafc);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.rank-card--expanded {
  background: var(--surface-50, #f8fafc);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-color: transparent;
}

/* Medal */
.rank-medal {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background: var(--surface-100, #f1f5f9);
}
.rank-medal--1 { background: #fef9ec; }
.rank-medal--2 { background: #f4f4f5; }
.rank-medal--3 { background: #fdf4ec; }
.rank-medal--rest {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-secondary);
}

/* Info */
.rank-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rank-info__top {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.rank-name {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.rank-score {
  font-size: 22px;
  font-weight: 800;
  flex-shrink: 0;
  line-height: 1;
}

/* Dots */
.rank-dots {
  display: flex;
  gap: 5px;
  align-items: center;
}
.rank-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: transform 200ms;
}
.rank-dot--empty {
  background: var(--surface-border);
}
.rank-card:hover .rank-dot:not(.rank-dot--empty) {
  transform: scale(1.2);
}

/* Actions */
.rank-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.rank-chevron {
  font-size: 13px;
  color: var(--text-color-secondary);
}

/* Skill panel */
.skill-panel {
  margin: 0 0 4px;
  padding: 16px;
  background: var(--surface-50, #f8fafc);
  border: 1px solid var(--surface-border);
  border-top: none;
  border-radius: 0 0 8px 8px;
}
.skill-panel__loading {
  font-size: 13px;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Skill grid */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.skill-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.skill-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.skill-card__name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-card__score {
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
}
.skill-card__req {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-color-secondary);
}
.skill-card__bar {
  height: 6px;
}
:deep(.skill-card__bar .p-progressbar) {
  height: 6px;
}
.skill-card__reason {
  margin: 0;
  font-size: 11px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}
</style>
