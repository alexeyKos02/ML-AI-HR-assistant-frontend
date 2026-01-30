<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Slider from 'primevue/slider'

import type { Vacancy } from '@/types/vacancy'
import type { Candidate, AiCandidateEvaluation } from '@/types/candidate'
import { getVacancyById, getCandidatesForVacancyPage } from '@/api/hrApi'

const route = useRoute()
const router = useRouter()

const vacancyId = computed(() => String(route.params.vacancyId))

const loading = ref(true)
const vacancy = ref<Vacancy | null>(null)

// filters
const q = ref('')
const minScore = ref(0)
const selectedSkills = ref<string[]>([])

const availableSkills = computed(() => vacancy.value?.requirements.skills ?? [])
const skillsOptions = computed(() => availableSkills.value.map((s) => ({ label: s, value: s })))

// infinite scroll state
const scrollEl = ref<HTMLElement | null>(null)
const pageSize = 10
const offset = ref(0)
const hasMore = ref(true)
const loadingMore = ref(false)

const items = ref<Array<{ candidate: Candidate; ai: AiCandidateEvaluation }>>([])

onMounted(async () => {
  loading.value = true
  vacancy.value = await getVacancyById(vacancyId.value)
  await reload()
  loading.value = false
})

function scoreSeverity(score: number) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'danger'
}

function openCandidate(candidateId: string) {
  router.push(`/vacancies/${vacancyId.value}/candidates/${candidateId}`)
}

async function reload() {
  offset.value = 0
  hasMore.value = true
  items.value = []
  await loadMore()
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true

  const page = await getCandidatesForVacancyPage(vacancyId.value, offset.value, pageSize, {
    q: q.value,
    minScore: minScore.value,
    skills: selectedSkills.value,
  })

  items.value = [...items.value, ...page.items]
  offset.value = page.nextOffset
  hasMore.value = page.hasMore

  loadingMore.value = false
}

function onScroll() {
  const el = scrollEl.value
  if (!el) return

  const thresholdPx = 260
  const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight

  if (distanceToBottom < thresholdPx) {
    loadMore()
  }
}

// debounce for filters
let t: number | null = null
watch([q, minScore, selectedSkills], () => {
  if (t) window.clearTimeout(t)
  t = window.setTimeout(() => {
    reload()
  }, 250)
})
</script>

<template>
  <div class="screen">
    <!-- fixed header -->
    <div class="screen__header">
      <div class="header__left">
        <Button label="Назад" icon="pi pi-arrow-left" severity="secondary" @click="router.push('/vacancies')" />
        <div class="title-block">
          <div class="title" v-if="vacancy">{{ vacancy.title }}</div>
          <div class="title" v-else>Вакансия</div>
          <div class="subtitle" v-if="vacancy">{{ vacancy.shortDescription }}</div>
        </div>
      </div>

      <div class="header__right" v-if="vacancy">
        <Tag :value="`Level: ${vacancy.requirements.experienceLevel}`" severity="info" />
        <Tag :value="`Min years: ${vacancy.requirements.yearsMin}`" severity="contrast" />
      </div>
    </div>

    <div class="screen__content">
      <div v-if="loading" class="loading">
        <Skeleton height="120px" class="w-full mb-3" />
        <Skeleton height="420px" class="w-full" />
      </div>

      <template v-else>
        <Card v-if="vacancy" class="match-card">
          <template #title>Подбор кандидатов</template>
          <template #content>
            <div class="match-section">
              <div class="match-section__title">Ключевые требования</div>
              <div class="req-tags">
                <Tag v-for="s in vacancy.requirements.skills" :key="s" :value="s" severity="secondary" />
              </div>
            </div>

            <div class="match-divider" />

            <div class="match-section">
              <div class="match-section__title">Поиск и фильтры</div>

              <div class="filters2">
                <div class="filters2__row">
                  <div class="search">
                    <i class="pi pi-search search__icon" />
                    <InputText v-model="q" class="search__input" placeholder="Поиск кандидата / компании / ролей / навыков..." />
                  </div>

                  <div class="score">
                    <div class="score__top">
                      <div class="score__label">Min AI score</div>
                      <div class="score__value">{{ minScore }}%</div>
                    </div>
                    <Slider v-model="minScore" :min="0" :max="100" />
                  </div>
                </div>

                <MultiSelect
                    v-model="selectedSkills"
                    :options="skillsOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Навыки (из требований вакансии)"
                    display="chip"
                    class="skills-ms"
                />
              </div>
            </div>
          </template>
        </Card>

        <div class="candidates-title">Кандидаты</div>

        <!-- Separate scroll container with infinite scroll -->
        <div ref="scrollEl" class="candidates-scroll" @scroll="onScroll">
          <div class="cards">
            <button
                v-for="x in items"
                :key="x.candidate.id"
                class="candidate-card"
                @click="openCandidate(x.candidate.id)"
            >
              <div class="card-head">
                <div>
                  <div class="name">{{ x.candidate.firstName }} {{ x.candidate.lastName }}</div>
                  <div class="meta">Опыт: {{ x.candidate.experienceYears }} лет</div>
                </div>

                <div class="ai">
                  <Tag :severity="scoreSeverity(x.ai.overallScore)" :value="`${x.ai.overallScore}%`" />
                  <ProgressBar
                      :value="x.ai.overallScore"
                      :showValue="false"
                      style="height: 8px; width: 180px"
                      :class="`pb pb--${scoreSeverity(x.ai.overallScore)}`"
                  />
                </div>
              </div>

              <div class="work-title">Компании</div>

              <div class="work-scroll">
                <div v-for="w in x.candidate.resume.workHistory" :key="w.company + w.period" class="work-item">
                  <div class="work-company">{{ w.company }}</div>
                  <div class="work-role">{{ w.role }} • {{ w.period }}</div>
                </div>
              </div>
            </button>

            <div v-if="loadingMore" class="more">
              Загрузка ещё...
            </div>

            <div v-else-if="!hasMore && items.length" class="more muted">
              Конец списка
            </div>

            <div v-else-if="!items.length" class="more muted">
              Ничего не найдено
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.screen {
  min-height: calc(100vh - 70px);
}

/* ===== Sticky header (не “карточка”, а плашка) ===== */
.screen__header {
  position: sticky;
  top: 0;
  z-index: 20;

  background: var(--surface-ground);
  padding: 14px 0 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.10);

  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.screen__header::after {
  content: '';
  display: block;
  height: 2px;
  margin-top: 10px;
  background: var(--app-grad);
  opacity: 0.18;
}

.header__left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title {
  font-weight: 900;
  font-size: 18px;
  letter-spacing: -0.2px;
}

.subtitle {
  color: var(--text-color-secondary);
  font-size: 12px;
  line-height: 1.35;
}

.header__right {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* ===== Main content ===== */
.screen__content {
  padding-bottom: 10px;
}

/* ===== Match card (requirements + filters in one card) ===== */
.match-card {
  margin: 14px 0;
}

.match-section__title {
  font-weight: 900;
  margin-bottom: 10px;
}

.match-divider {
  height: 1px;
  background: rgba(15, 23, 42, 0.10);
  margin: 14px 0;
}

/* Requirements tags */
.req-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ===== Filters (new layout) ===== */
.filters2 {
  display: grid;
  gap: 12px;
}

.filters2__row {
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  gap: 12px;
  align-items: start;
}

/* Search input with icon */
.search {
  position: relative;
}

.search__icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-color-secondary);
  pointer-events: none;
  font-size: 14px;
  line-height: 1;
}

.search :deep(.p-inputtext) {
  width: 100%;
  height: 42px;
  border-radius: 12px;
  padding-left: 44px;
}

.search :deep(.p-inputtext:focus) {
  box-shadow: 0 0 0 3px var(--app-ring);
  border-color: rgba(37, 99, 235, 0.45);
}

/* Score block */
.score {
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  padding: 10px 12px;
}

.score__top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 8px;
}

.score__label {
  color: var(--text-color-secondary);
  font-size: 12px;
  font-weight: 700;
}

.score__value {
  font-weight: 900;
  font-size: 12px;
  color: var(--app-accent);
  background: rgba(37, 99, 235, 0.10);
  border: 1px solid rgba(37, 99, 235, 0.18);
  padding: 3px 8px;
  border-radius: 999px;
}

.score :deep(.p-slider) {
  width: 100%;
}

.score :deep(.p-slider .p-slider-range) {
  background: var(--app-accent);
}

/* MultiSelect full width */
.skills-ms {
  width: 100%;
}

.skills-ms :deep(.p-multiselect) {
  width: 100%;
  border-radius: 12px;
}

/* ===== Candidates list ===== */
.candidates-title {
  font-weight: 900;
  margin: 6px 0 10px;
}

.candidates-scroll {
  height: 520px;
  overflow: auto;
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 14px;
  background: var(--surface-card);
  box-shadow: var(--app-shadow-sm);
}

.cards {
  padding: 12px;
  display: grid;
  gap: 12px;
}

/* Candidate “card-button” */
.candidate-card {
  width: 100%;
  text-align: left;
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 14px;
  background: var(--surface-card);
  padding: 12px;
  cursor: pointer;
  transition: box-shadow 140ms ease, border-color 140ms ease, background-color 140ms ease;
}

.candidate-card:hover {
  border-color: rgba(37, 99, 235, 0.28);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.98);
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.name {
  font-weight: 900;
}

.meta {
  color: var(--text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.ai {
  display: grid;
  gap: 6px;
  justify-items: end;
}

/* Make progressbar width stable in cards */
.ai :deep(.p-progressbar) {
  width: 180px;
}

.work-title {
  margin-top: 10px;
  font-weight: 800;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.work-scroll {
  margin-top: 8px;
  max-height: 90px;
  overflow: auto;
  border: 1px dashed rgba(15, 23, 42, 0.14);
  border-radius: 12px;
  padding: 8px;
  background: rgba(15, 23, 42, 0.03);
}

.work-item + .work-item {
  margin-top: 8px;
}

.work-company {
  font-weight: 800;
  font-size: 13px;
}

.work-role {
  color: var(--text-color-secondary);
  font-size: 12px;
  margin-top: 2px;
}

.more {
  padding: 8px 4px;
  text-align: center;
}

.muted {
  color: var(--text-color-secondary);
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .filters2__row {
    grid-template-columns: 1fr;
  }

  .ai {
    justify-items: start;
  }

  .ai :deep(.p-progressbar) {
    width: 100%;
  }
}

.pb :deep(.p-progressbar-value) {
  transition: background-color 140ms ease;
}

.pb--success :deep(.p-progressbar-value) {
  background: #16a34a; /* green */
}

.pb--warning :deep(.p-progressbar-value) {
  background: #f59e0b; /* amber */
}

.pb--danger :deep(.p-progressbar-value) {
  background: #ef4444; /* red */
}

</style>