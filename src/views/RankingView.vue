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
  return candidates.value.find((c) => c.candidate_id === id)?.filename?.replace(/\.pdf$/i, '') ?? id
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
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#d97706'
  return '#dc2626'
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
    <div class="page-header">
      <Button icon="pi pi-arrow-left" text label="Назад" @click="router.push({ name: 'workspace' })" />
      <div>
        <h1 class="page-title">Рейтинг кандидатов</h1>
        <p class="page-subtitle">по роли <strong>{{ rankLabel }}</strong></p>
      </div>
    </div>

    <div v-if="loading" class="spinner-wrap">
      <ProgressSpinner />
      <span class="spinner-label">Ранжируем кандидатов…</span>
    </div>
    <div v-else-if="error" class="error-wrap">
      <i class="pi pi-exclamation-circle" />
      <span>{{ error }}</span>
    </div>
    <div v-else-if="!ranked.length" class="empty-wrap">Сервер не вернул результаты.</div>

    <template v-else>
      <div class="filter-bar">
        <span class="filter-label">Порог: <strong>{{ minScore }}</strong></span>
        <input type="range" min="0" max="100" step="5" v-model.number="minScore" class="filter-slider" />
        <span class="filter-count">{{ filtered.length }} / {{ ranked.length }}</span>
      </div>

      <div class="rank-list">
        <template v-for="(item, i) in filtered" :key="item.candidate_id">

          <div
            class="rank-row"
            :class="{ 'is-expanded': expandedId === item.candidate_id }"
            @click="toggleExpand(item.candidate_id)"
          >
            <!-- Position -->
            <span class="rank-num" :class="{ 'rank-num--top': i < 3 }">{{ i + 1 }}</span>

            <!-- Main content -->
            <div class="rank-body">
              <div class="rank-top">
                <span class="rank-name">{{ nameFor(item.candidate_id) }}</span>
                <span class="rank-score" :style="{ color: scoreColor(item.score) }">{{ item.score.toFixed(1) }}</span>
              </div>

              <!-- Dots -->
              <div class="dots">
                <template v-if="skillsCache[item.candidate_id]">
                  <span
                    v-for="[skill, data] in sortedSkills(item.candidate_id)"
                    :key="skill"
                    class="dot"
                    :style="{ background: scoreColor(fitScore(data)) }"
                    :title="`${skill}: ${candidateScore(data)} / ${requiredLevel(data)}`"
                  />
                </template>
                <template v-else>
                  <span v-for="n in 6" :key="n" class="dot dot--empty" />
                </template>
              </div>
            </div>

            <!-- Controls -->
            <div class="rank-controls" @click.stop>
              <button class="icon-btn" @click="goToEvaluate(item.candidate_id)" title="Открыть оценку">
                <i class="pi pi-arrow-right" />
              </button>
              <i class="pi chevron" :class="expandedId === item.candidate_id ? 'pi-chevron-up' : 'pi-chevron-down'" />
            </div>
          </div>

          <!-- Skills panel -->
          <div v-if="expandedId === item.candidate_id" class="skills-panel">
            <div v-if="loadingSkills === item.candidate_id" class="skills-loading">
              <i class="pi pi-spin pi-spinner" /> Загружаем…
            </div>
            <div v-else class="skills-grid">
              <div v-for="[skill, data] in sortedSkills(item.candidate_id)" :key="skill" class="skill-item">
                <div class="skill-item__head">
                  <span class="skill-item__name">{{ skill }}</span>
                  <span class="skill-item__score" :style="{ color: scoreColor(fitScore(data)) }">
                    {{ candidateScore(data) }}<span class="skill-item__req">/{{ requiredLevel(data) }}</span>
                  </span>
                </div>
                <ProgressBar :value="candidateScore(data)" class="skill-item__bar" />
                <p class="skill-item__reason">{{ data.reason }}</p>
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
  max-width: 780px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.page-subtitle {
  margin: 3px 0 0;
  color: var(--text-color-secondary);
  font-size: 13px;
}

.spinner-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 0;
  color: var(--text-color-secondary);
}
.spinner-label { font-size: 14px; }

.error-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px;
  color: #dc2626;
  font-size: 14px;
}

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
}
.filter-label {
  font-size: 12px;
  color: var(--text-color-secondary);
  white-space: nowrap;
}
.filter-slider {
  flex: 1;
  accent-color: var(--app-accent, #10b981);
  cursor: pointer;
}
.filter-count {
  font-size: 12px;
  color: var(--text-color-secondary);
  white-space: nowrap;
  min-width: 36px;
  text-align: right;
}

/* List */
.rank-list {
  display: flex;
  flex-direction: column;
}

/* Row */
.rank-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 12px;
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
  transition: background 120ms;
}
.rank-row:first-child { border-top: 1px solid var(--surface-border); }
.rank-row:hover { background: rgba(0,0,0,0.02); }
.rank-row.is-expanded { background: rgba(0,0,0,0.02); }

/* Position number */
.rank-num {
  font-size: 20px;
  font-weight: 300;
  color: var(--text-color-secondary);
  width: 28px;
  text-align: center;
  flex-shrink: 0;
  opacity: 0.5;
  font-variant-numeric: tabular-nums;
}
.rank-num--top {
  opacity: 1;
  font-weight: 600;
  color: var(--text-color);
}

/* Body */
.rank-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.rank-top {
  display: flex;
  align-items: baseline;
  gap: 12px;
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
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* Dots */
.dots {
  display: flex;
  gap: 4px;
  align-items: center;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.8;
}
.dot--empty {
  background: var(--surface-border);
  opacity: 1;
}

/* Controls */
.rank-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  color: var(--text-color-secondary);
  font-size: 13px;
  display: flex;
  align-items: center;
  transition: background 120ms, color 120ms;
}
.icon-btn:hover {
  background: rgba(0,0,0,0.06);
  color: var(--text-color);
}
.chevron {
  font-size: 12px;
  color: var(--text-color-secondary);
  padding: 6px;
  opacity: 0.6;
}

/* Skills panel */
.skills-panel {
  padding: 16px 12px 20px 56px;
  border-bottom: 1px solid var(--surface-border);
  background: rgba(0,0,0,0.015);
}
.skills-loading {
  font-size: 13px;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.skills-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 24px;
}

.skill-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.skill-item__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
}
.skill-item__name {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);
}
.skill-item__score {
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
}
.skill-item__req {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-color-secondary);
}
.skill-item__bar {
  height: 4px;
}
:deep(.skill-item__bar .p-progressbar) {
  height: 4px;
  border-radius: 2px;
}
.skill-item__reason {
  margin: 0;
  font-size: 11px;
  color: var(--text-color-secondary);
  line-height: 1.6;
}
</style>
