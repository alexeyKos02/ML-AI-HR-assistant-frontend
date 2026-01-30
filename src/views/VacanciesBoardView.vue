<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'

import type { Vacancy } from '@/types/vacancy'
import { getVacancies, getTopCandidatesForVacancy } from '@/api/hrApi'

type TopCandidateItem = {
  candidateId: string
  fullName: string
  age: number
  overallScore: number
}

const router = useRouter()
const vacancies = ref<Vacancy[]>([])
const loading = ref(true)

const expandedVacancyId = ref<string | null>(null)
const topCandidatesByVacancy = ref<Record<string, TopCandidateItem[]>>({})
const topLoadingByVacancy = ref<Record<string, boolean>>({})

onMounted(async () => {
  loading.value = true
  vacancies.value = await getVacancies()
  loading.value = false
})

async function onOpenVacancy(vacancyId: string) {
  expandedVacancyId.value = vacancyId

  if (topCandidatesByVacancy.value[vacancyId]?.length) return

  topLoadingByVacancy.value[vacancyId] = true
  const data = await getTopCandidatesForVacancy(vacancyId)
  topCandidatesByVacancy.value[vacancyId] = data.map((x) => ({
    candidateId: x.candidate.id,
    fullName: `${x.candidate.firstName} ${x.candidate.lastName}`,
    age: x.candidate.age,
    overallScore: x.ai.overallScore,
  }))
  topLoadingByVacancy.value[vacancyId] = false
}

async function onTabOpen(e: { index: number }) {
  const v = vacancies.value[e.index]
  if (!v) return
  await onOpenVacancy(v.id)
}

function openVacancyFull(vacancyId: string) {
  router.push(`/vacancies/${vacancyId}`)
}

function openCandidate(vacancyId: string, candidateId: string) {
  router.push(`/vacancies/${vacancyId}/candidates/${candidateId}`)
}

function scoreSeverity(score: number) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'danger'
}
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h1 class="h1">Вакансии</h1>
        <div class="sub">Кликни вакансию → увидишь Top-10 кандидатов по AI-скорингу</div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <Skeleton height="42px" class="w-full mb-2" />
      <Skeleton height="42px" class="w-full mb-2" />
      <Skeleton height="42px" class="w-full" />
    </div>

    <Accordion v-else :activeIndex="null" @tab-open="onTabOpen">
      <AccordionTab
          v-for="v in vacancies"
          :key="v.id"
      >
        <template #header>
          <div class="acc-header">
            <div class="acc-header__title">
              <div class="acc-title">{{ v.title }}</div>
              <div class="acc-sub">{{ v.shortDescription }}</div>
            </div>

            <div class="acc-header__meta">
              <Tag :value="`${v.requirements.experienceLevel.toUpperCase()} • от ${v.requirements.yearsMin} лет`" severity="info" />
              <Button
                  icon="pi pi-external-link"
                  severity="secondary"
                  size="small"
                  aria-label="Открыть экран вакансии"
                  @click.stop="openVacancyFull(v.id)"
              />
            </div>
          </div>
        </template>
        <div class="inside">
          <div class="inside__title">Top кандидаты</div>

          <div v-if="topLoadingByVacancy[v.id]" class="top-loading">
            <Skeleton height="14px" class="w-full" />
            <Skeleton height="14px" class="w-full" />
            <Skeleton height="14px" class="w-full" />
          </div>

          <div v-else class="top-list">
            <button
                v-for="c in topCandidatesByVacancy[v.id] ?? []"
                :key="c.candidateId"
                class="top-item"
                @click="openCandidate(v.id, c.candidateId)"
            >
              <div class="top-item__left">
                <div class="name">{{ c.fullName }}</div>
                <div class="meta">Возраст: {{ c.age }}</div>
              </div>

              <div class="top-item__right">
                <div class="score-row">
                  <Tag :severity="scoreSeverity(c.overallScore)" :value="`${c.overallScore}%`" />
                </div>
                <ProgressBar :value="c.overallScore" :showValue="false" style="height: 8px" />
              </div>
            </button>

            <div v-if="(topCandidatesByVacancy[v.id]?.length ?? 0) === 0" class="empty">
              Нет кандидатов (mock)
            </div>
          </div>
        </div>
      </AccordionTab>
    </Accordion>
  </div>
</template>
<style scoped>
.page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 6px 0 14px;
}

.h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.2px;
}

.sub {
  margin-top: 6px;
  color: var(--text-color-secondary);
}

/* ===== Accordion as “vacancy cards” ===== */

:deep(.p-accordion) {
  display: grid;
  gap: 12px;
}

/* panel container */
:deep(.p-accordionpanel) {
  border-radius: var(--app-radius);
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: var(--surface-card);
  box-shadow: var(--app-shadow-sm);
}

/* header row */
:deep(.p-accordionheader) {
  background: transparent;
}

/* clickable area */
:deep(.p-accordionheader-link) {
  padding: 16px 16px;
  transition: background-color 140ms ease;
}

/* subtle hover for closed panels */
:deep(.p-accordionpanel:not(.p-accordionpanel-active) .p-accordionheader-link:hover) {
  background: rgba(37, 99, 235, 0.04);
}

/* keep accordion toggle icon space but hide it to prevent layout shift */
:deep(.p-accordionheader-toggle-icon) {
  width: 20px;
  flex: 0 0 20px;
  margin-left: 10px;
  opacity: 0;
  pointer-events: none;
}

/* ===== Vacancy header content ===== */

.acc-header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  width: 100%;
}

.acc-title {
  font-weight: 800;
  font-size: 16px;
}

.acc-sub {
  color: var(--text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.35;
}

.acc-header__meta {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* Make icon-only button look compact and aligned */
:deep(.acc-header__meta .p-button) {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 12px;
}

/* ===== Inside panel ===== */

.inside {
  padding: 14px 16px 16px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.75);
}

.inside__title {
  font-weight: 900;
  margin-bottom: 10px;
}

/* skeleton group */
.top-loading {
  display: grid;
  gap: 10px;
}

/* ===== Top list ===== */

.top-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.top-item {
  width: 100%;
  text-align: left;
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 12px;
  padding: 12px 12px;
  background: var(--surface-card);
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 12px;
  cursor: pointer;
  transition: box-shadow 140ms ease, border-color 140ms ease, background-color 140ms ease;
}

.top-item:hover {
  border-color: rgba(37, 99, 235, 0.28);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.98);
}

.top-item:active {
  filter: brightness(0.99);
}

.top-item__left .name {
  font-weight: 900;
}

.top-item__left .meta {
  color: var(--text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.top-item__right {
  display: grid;
  gap: 6px;
  justify-items: end;
}

.score-row {
  display: flex;
  justify-content: flex-end;
}

/* progress bar width consistency */
.top-item__right :deep(.p-progressbar) {
  width: 100%;
}

/* empty state */
.empty {
  color: var(--text-color-secondary);
  padding: 10px 2px;
}

/* Small screens: stack meta under title, and top-item content vertically */
@media (max-width: 900px) {
  .acc-header {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .acc-header__meta {
    justify-content: flex-start;
  }

  .top-item {
    grid-template-columns: 1fr;
  }

  .top-item__right {
    justify-items: start;
  }

  .score-row {
    justify-content: flex-start;
  }
}
</style>