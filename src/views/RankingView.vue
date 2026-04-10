<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { useCandidates } from '@/composables/useCandidates'
import { evaluateCandidate } from '@/api/hrApi'
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
const evaluatedCount = ref(0)
const totalCount = ref(0)

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
    totalCount.value = ids.length
    evaluatedCount.value = 0

    // Оцениваем каждого по отдельности — показываем прогресс
    const results: RankResult[] = []
    await Promise.all(
      ids.map(async (id) => {
        try {
          const skills = await evaluateCandidate(id, rankLabel.value, activeVacancy.value?.hash)
          skillsCache.value[id] = skills
          const scores = Object.values(skills).map(v =>
            (v.required_level ?? 100) > 0
              ? Math.min((v.candidate_score ?? (v as any).score ?? 0) / (v.required_level ?? 100) * 100, 100)
              : (v.candidate_score ?? (v as any).score ?? 0)
          )
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 0
          results.push({ candidate_id: id, score: avg })
        } catch {}
        evaluatedCount.value++
      })
    )
    ranked.value = results.sort((a, b) => b.score - a.score)
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
    <div v-if="loading" class="progress-wrap">
      <div class="progress-header">
        <span class="progress-label">Оцениваем кандидатов…</span>
        <span class="progress-counter">{{ evaluatedCount }} / {{ totalCount }}</span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: totalCount ? (evaluatedCount / totalCount * 100) + '%' : '0%' }"
        />
      </div>
      <span class="progress-hint">Результаты появляются по мере готовности</span>
    </div>
    <div v-else-if="error" class="error-wrap">
      <i class="pi pi-exclamation-circle error-icon" />
      <span>{{ error }}</span>
    </div>
    <div v-else-if="!ranked.length" class="empty-wrap">Сервер не вернул результаты.</div>

    <template v-else>
      <!-- Filter -->
      <div class="filter-bar">
        <span class="filter-label">Порог</span>
        <div class="filter-track-wrap">
          <input type="range" min="0" max="100" step="5" v-model.number="minScore" class="filter-slider" />
        </div>
        <span class="filter-value">{{ minScore }}</span>
        <span class="filter-count">{{ filtered.length }} / {{ ranked.length }}</span>
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
              <span class="rank-name" :title="nameFor(item.candidate_id)">{{ nameFor(item.candidate_id) }}</span>

              <!-- Skill dots -->
              <div class="rank-dots">
                <span
                  v-for="n in 6"
                  :key="n"
                  class="rank-dot"
                  :style="sortedSkills(item.candidate_id)[n - 1]
                    ? { background: scoreColor(fitScore(sortedSkills(item.candidate_id)[n - 1]![1])) }
                    : {}"
                  :title="sortedSkills(item.candidate_id)[n - 1]
                    ? `${sortedSkills(item.candidate_id)[n - 1]![0]}: ${candidateScore(sortedSkills(item.candidate_id)[n - 1]![1])} / ${requiredLevel(sortedSkills(item.candidate_id)[n - 1]![1])}`
                    : ''"
                />
              </div>
            </div>

            <!-- Score (centered independently) -->
            <span class="rank-score" :style="{ color: scoreColor(item.score) }">{{ item.score.toFixed(1) }}</span>

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
                <ProgressBar :value="fitScore(data)" :showValue="false" class="skill-card__bar" />
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

.progress-wrap {
  padding: 40px 0 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.progress-label {
  font-size: 15px;
  font-weight: 600;
}
.progress-counter {
  font-size: 22px;
  font-weight: 700;
  color: var(--app-accent, #10b981);
  font-variant-numeric: tabular-nums;
}
.progress-track {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-border);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--app-accent, #10b981);
  transition: width 400ms ease;
}
.progress-hint {
  font-size: 12px;
  color: var(--text-color-secondary);
}

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
  gap: 10px;
  margin-bottom: 20px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 10px 14px;
}
.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  white-space: nowrap;
}
.filter-track-wrap {
  flex: 1;
  display: flex;
  align-items: center;
}
.filter-slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--app-accent, #10b981) 0%,
    var(--app-accent, #10b981) v-bind('minScore + "%"'),
    var(--surface-border) v-bind('minScore + "%"'),
    var(--surface-border) 100%
  );
  outline: none;
  cursor: pointer;
}
.filter-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--app-accent, #10b981);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  cursor: pointer;
  transition: box-shadow 150ms;
}
.filter-slider::-webkit-slider-thumb:hover {
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
}
.filter-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--app-accent, #10b981);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  cursor: pointer;
}
.filter-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-accent, #10b981);
  min-width: 28px;
  text-align: center;
}
.filter-count {
  font-size: 12px;
  color: var(--text-color-secondary);
  white-space: nowrap;
  padding-left: 6px;
  border-left: 1px solid var(--surface-border);
}

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
  justify-content: center;
  gap: 7px;
}
.rank-name {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-score {
  font-size: 22px;
  font-weight: 800;
  flex-shrink: 0;
  line-height: 1;
  align-self: center;
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
  background: var(--surface-border);
  transition: background 500ms ease;
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
