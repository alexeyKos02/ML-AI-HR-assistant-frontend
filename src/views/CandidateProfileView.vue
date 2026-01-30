<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import ProgressBar from 'primevue/progressbar'
import ScrollPanel from 'primevue/scrollpanel'
import Skeleton from 'primevue/skeleton'

import type { Candidate, AiCandidateEvaluation } from '@/types/candidate'
import type { Vacancy } from '@/types/vacancy'
import { getCandidateById, getVacancyById, getAiEvaluation } from '@/api/hrApi'

const route = useRoute()
const router = useRouter()

const vacancyId = computed(() => String(route.params.vacancyId))
const candidateId = computed(() => String(route.params.candidateId))

const loading = ref(true)
const vacancy = ref<Vacancy | null>(null)
const candidate = ref<Candidate | null>(null)
const ai = ref<AiCandidateEvaluation | null>(null)

onMounted(async () => {
  loading.value = true
  vacancy.value = await getVacancyById(vacancyId.value)
  candidate.value = await getCandidateById(candidateId.value)
  ai.value = await getAiEvaluation(vacancyId.value, candidateId.value)
  loading.value = false
})

function recTag(rec: AiCandidateEvaluation['recommendation']) {
  if (rec === 'fit') return { value: 'Подходит', severity: 'success' as const }
  if (rec === 'conditional') return { value: 'Условно', severity: 'warning' as const }
  return { value: 'Не подходит', severity: 'danger' as const }
}

function scoreTone(score: number) {
  if (score >= 80) return 'success' as const
  if (score >= 60) return 'warning' as const
  return 'danger' as const
}
</script>

<template>
  <div class="profile">
    <div class="profile__top">
      <Button
          label="Назад к вакансии"
          icon="pi pi-arrow-left"
          severity="secondary"
          @click="router.push(`/vacancies/${vacancyId}`)"
      />
      <div class="top-meta" v-if="vacancy">
        <Tag severity="info" :value="vacancy.title" />
      </div>
    </div>

    <div v-if="loading" class="loading">
      <Skeleton height="520px" class="w-full" />
    </div>

    <div v-else-if="candidate" class="grid">
      <Card class="left">
        <template #title>
          <div class="name-row">
            <div class="name">{{ candidate.firstName }} {{ candidate.lastName }}</div>
            <Tag severity="secondary" :value="`Опыт: ${candidate.experienceYears} лет`" />
          </div>
        </template>

        <template #content>
          <ScrollPanel class="left-scroll">
            <div class="section">
              <div class="section__title">О себе</div>
              <div class="text">{{ candidate.resume.about }}</div>
            </div>

            <Divider />

            <div class="section">
              <div class="section__title">Ключевые навыки</div>
              <div class="tags">
                <Tag v-for="s in candidate.resume.keySkills" :key="s" :value="s" severity="secondary" />
              </div>
            </div>

            <Divider />

            <div class="section">
              <div class="section__title">Награды и достижения</div>
              <ul class="list">
                <li v-for="a in candidate.resume.achievements" :key="a">{{ a }}</li>
              </ul>
            </div>

            <Divider />

            <div class="section">
              <div class="section__title">История работы</div>
              <div class="jobs">
                <div v-for="w in candidate.resume.workHistory" :key="w.company + w.period" class="job">
                  <div class="job__head">
                    <div class="job__company">{{ w.company }}</div>
                    <div class="job__period">{{ w.period }}</div>
                  </div>
                  <div class="job__role">{{ w.role }}</div>
                  <ul class="list">
                    <li v-for="r in w.responsibilities" :key="r">{{ r }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </ScrollPanel>
        </template>
      </Card>

      <Card class="right ai-card">
        <template #title>
          <div class="ai-title">
            <span>AI-оценка</span>
            <Tag v-if="ai" v-bind="recTag(ai.recommendation)" />
          </div>
        </template>

        <template #content>
          <div v-if="!ai" class="muted">AI-оценка недоступна (mock)</div>

          <template v-else>
            <div class="kpi">
              <div class="kpi__label">Общее соответствие</div>
              <div class="kpi__value">
                {{ ai.overallScore }}%
              </div>
              <ProgressBar
                  :value="ai.overallScore"
                  :showValue="false"
                  style="height: 10px"
                  :class="`pb pb--${scoreTone(ai.overallScore)}`"
              />
            </div>

            <Divider />

            <div class="kpi">
              <div class="kpi__label">Соответствие возраста</div>
              <div class="kpi__value" >
                {{ ai.ageFitScore }}%
              </div>
              <ProgressBar
                  :value="ai.ageFitScore"
                  :showValue="false"
                  style="height: 10px"
                  :class="`pb pb--${scoreTone(ai.ageFitScore)}`"
              />
            </div>

            <Divider />

            <div class="section">
              <div class="section__title">Оценка ключевых навыков</div>
              <div class="skills">
                <div v-for="s in ai.skillRatings" :key="s.skill" class="skill">
                  <div class="skill__row">
                    <div class="skill__name">{{ s.skill }}</div>
                    <div class="skill__score">
                      {{ s.score }}%
                    </div>
                  </div>
                  <ProgressBar
                      :value="s.score"
                      :showValue="false"
                      style="height: 8px"
                      :class="`pb pb--${scoreTone(s.score)}`"
                  />
                </div>
              </div>
            </div>

            <Divider />

            <div class="section">
              <div class="section__title">Сильные стороны</div>
              <ul class="list">
                <li v-for="x in ai.strengths" :key="x">{{ x }}</li>
              </ul>
            </div>

            <Divider />

            <div class="section">
              <div class="section__title">Зоны риска</div>
              <ul class="list">
                <li v-for="x in ai.risks" :key="x">{{ x }}</li>
              </ul>
            </div>
          </template>
        </template>
      </Card>
    </div>

    <div v-else class="muted">Кандидат не найден</div>
  </div>
</template>

<style scoped>
.profile__top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 6px 0 14px;
}

.top-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 14px;
  align-items: start;
}

.left-scroll {
  height: 72vh;
}

.name-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.name {
  font-weight: 900;
}

.section__title {
  font-weight: 800;
  margin-bottom: 8px;
}

.text {
  color: var(--text-color-secondary);
  line-height: 1.6;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-color-secondary);
}

.jobs {
  display: grid;
  gap: 12px;
}

.job {
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 10px;
  background: var(--surface-card);
  box-shadow: var(--app-shadow-sm);
}

.job__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.job__company {
  font-weight: 800;
}

.job__period {
  color: var(--text-color-secondary);
  font-size: 12px;
}

.job__role {
  margin-top: 4px;
  font-weight: 700;
  color: var(--text-color-secondary);
}

.ai-card {
  border: 1px solid rgba(15, 23, 42, 0.10);
  box-shadow: var(--app-shadow-sm);
}

.ai-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.kpi__label {
  color: var(--text-color-secondary);
  font-size: 12px;
}

.kpi__value {
  font-weight: 900;
  font-size: 20px;
  margin: 4px 0 8px;
}

.skills {
  display: grid;
  gap: 10px;
}

.skill__row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.skill__name {
  font-weight: 700;
}

.skill__score {
  color: var(--text-color-secondary);
  font-size: 12px;
}

.muted {
  color: var(--text-color-secondary);
}

/* ===== Tone colors ===== */

/* ProgressBar value colors */
.pb :deep(.p-progressbar-value) {
  transition: background-color 140ms ease;
}
.pb--success :deep(.p-progressbar-value) { background: #16a34a; }
.pb--warning :deep(.p-progressbar-value) { background: #f59e0b; }
.pb--danger  :deep(.p-progressbar-value) { background: #ef4444; }

/* Responsive */
@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .left-scroll {
    height: auto;
    max-height: 70vh;
  }

  .name-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>