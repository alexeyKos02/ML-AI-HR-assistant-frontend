<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import { useCandidates } from '@/composables/useCandidates'
import { evaluateCandidate } from '@/api/hrApi'
import type { EvaluationResult } from '@/types'

const route = useRoute()
const router = useRouter()
const { candidates, effectiveRole, activeVacancy } = useCandidates()

const candidateId = computed(() => route.params.candidateId as string)
const filename = computed(
  () => candidates.value.find((c) => c.candidate_id === candidateId.value)?.filename ?? candidateId.value,
)

const currentIndex = computed(() => candidates.value.findIndex(c => c.candidate_id === candidateId.value))
const prevCandidate = computed(() => currentIndex.value > 0 ? candidates.value[currentIndex.value - 1] : null)
const nextCandidate = computed(() => currentIndex.value < candidates.value.length - 1 ? candidates.value[currentIndex.value + 1] : null)

function goToCandidate(id: string) {
  router.replace({ name: 'evaluate', params: { candidateId: id } })
}

const loading = ref(true)
const error = ref('')
const evaluation = ref<EvaluationResult>({})
const evalLabel = ref('')

const sortedSkills = computed(() =>
  Object.entries(evaluation.value).sort(([, a], [, b]) => b.score - a.score),
)

const overallScore = computed(() => {
  const vals = Object.values(evaluation.value)
  if (!vals.length) return 0
  return Math.round(vals.reduce((s, v) => s + v.score, 0) / vals.length)
})

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Сильное совпадение'
  if (score >= 50) return 'Среднее совпадение'
  return 'Слабое совпадение'
}

async function loadEvaluation() {
  if (!candidateId.value) {
    await router.replace({ name: 'workspace' })
    return
  }
  loading.value = true
  error.value = ''
  evaluation.value = {}
  evalLabel.value = effectiveRole.value || 'Кандидат'
  try {
    evaluation.value = await evaluateCandidate(candidateId.value, evalLabel.value, activeVacancy.value?.hash)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка оценки'
  } finally {
    loading.value = false
  }
}

onMounted(loadEvaluation)
watch(candidateId, loadEvaluation)
</script>

<template>
  <div class="eval-page">
    <div class="page-header">
      <Button icon="pi pi-arrow-left" text label="Назад" @click="router.back()" />
      <div class="page-header__info">
        <h1 class="page-title" :title="filename">{{ filename }}</h1>
        <p class="page-subtitle">Роль: <strong>{{ evalLabel }}</strong></p>
      </div>
      <div class="page-header__nav">
        <Button
          icon="pi pi-chevron-left"
          text rounded size="small"
          :disabled="!prevCandidate"
          v-tooltip.top="prevCandidate?.filename ?? ''"
          @click="prevCandidate && goToCandidate(prevCandidate.candidate_id)"
        />
        <span class="nav-counter">{{ currentIndex + 1 }} / {{ candidates.length }}</span>
        <Button
          icon="pi pi-chevron-right"
          text rounded size="small"
          :disabled="!nextCandidate"
          v-tooltip.top="nextCandidate?.filename ?? ''"
          @click="nextCandidate && goToCandidate(nextCandidate.candidate_id)"
        />
      </div>
    </div>

    <div class="eval-layout">
      <!-- Overall score card -->
      <Card v-if="!loading && !error && sortedSkills.length" class="score-card">
        <template #content>
          <div class="overall">
            <div class="overall__ring">
              <svg viewBox="0 0 44 44" class="ring-svg">
                <circle cx="22" cy="22" r="18" class="ring-track" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  class="ring-fill"
                  :style="{
                    strokeDasharray: `${(overallScore / 100) * 113} 113`,
                    stroke: scoreColor(overallScore),
                  }"
                />
              </svg>
              <span class="overall__pct" :style="{ color: scoreColor(overallScore) }">{{ overallScore }}</span>
            </div>
            <div class="overall__meta">
              <span class="overall__label">Общий балл</span>
              <span class="overall__verdict" :style="{ color: scoreColor(overallScore) }">
                {{ scoreLabel(overallScore) }}
              </span>
            </div>
          </div>
        </template>
      </Card>

      <!-- Skills card -->
      <Card class="skills-card">
        <template #title>
          <div class="section-title">
            <i class="pi pi-chart-bar" />
            Оценка навыков
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="spinner-wrap">
            <ProgressSpinner />
            <span class="spinner-label">Оцениваем кандидата…</span>
          </div>

          <div v-else-if="error" class="error-wrap">
            <i class="pi pi-exclamation-circle error-icon" />
            <span>{{ error }}</span>
          </div>

          <div v-else-if="!sortedSkills.length" class="empty-wrap">
            Сервер не вернул данные оценки.
          </div>

          <div v-else class="skills">
            <div v-for="[skill, data] in sortedSkills" :key="skill" class="skill-row">
              <span class="skill-name">{{ skill }}</span>
              <div class="skill-right">
                <div class="skill-bar-row">
                  <ProgressBar :value="data.score" class="skill-bar" />
                  <span class="skill-score" :style="{ color: scoreColor(data.score) }">{{ data.score }}%</span>
                </div>
                <p class="skill-reason">{{ data.reason }}</p>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.eval-page {
  max-width: 720px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.page-header__info {
  flex: 1;
  min-width: 0;
}
.page-header__nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.nav-counter {
  font-size: 13px;
  color: var(--text-color-secondary);
  min-width: 44px;
  text-align: center;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520px;
}
.page-subtitle {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.eval-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Overall score */
.score-card :deep(.p-card-body) {
  padding: 20px 24px;
}
.overall {
  display: flex;
  align-items: center;
  gap: 20px;
}
.overall__ring {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}
.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-track {
  fill: none;
  stroke: var(--surface-border);
  stroke-width: 4;
}
.ring-fill {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dasharray 600ms ease;
}
.overall__pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
}
.overall__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.overall__label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-color-secondary);
}
.overall__verdict {
  font-size: 18px;
  font-weight: 700;
}

/* Skills */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

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

.skills {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.skill-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 14px;
  align-items: start;
}
.skill-name {
  font-size: 14px;
  font-weight: 600;
  text-align: right;
  padding-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-right {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.skill-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.skill-bar {
  flex: 1;
  height: 10px;
}
:deep(.skill-bar .p-progressbar) {
  height: 10px;
}
.skill-score {
  font-size: 14px;
  font-weight: 700;
  width: 44px;
  text-align: right;
  flex-shrink: 0;
}
.skill-reason {
  margin: 0;
  font-size: 12px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}
</style>
