<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import { useCandidates } from '@/composables/useCandidates'
import { rankCandidates, getVacancy } from '@/api/hrApi'
import type { RankResult } from '@/types'

const router = useRouter()
const { candidates, role, effectiveRole, refresh } = useCandidates()

const loading = ref(true)
const error = ref('')
const ranked = ref<RankResult[]>([])
const rankLabel = ref('')

function nameFor(id: string): string {
  return candidates.value.find((c) => c.candidate_id === id)?.filename ?? id
}

function goToEvaluate(candidateId: string) {
  console.log(`number ${candidateId}`)
  router.push({ name: 'evaluate', params: { candidateId } })
}

onMounted(async () => {
  try {
    if (!effectiveRole.value) {
      const vacancy = await getVacancy()
      const label = vacancy.vacancy?.filename?.replace('.pdf', '') || ''
      if (!label) {
        router.replace({ name: 'workspace' })
        return
      }
      effectiveRole.value = label
    }

    rankLabel.value = effectiveRole.value
    await refresh()

    if (!candidates.value.length) {
      router.replace({ name: 'workspace' })
      return
    }

    const ids = candidates.value.map((c) => c.candidate_id)
    ranked.value = await rankCandidates(effectiveRole.value, ids)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ranking failed'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="ranking-page">
    <div class="page-header">
      <Button icon="pi pi-arrow-left" text label="Back" @click="router.push({ name: 'workspace' })" />
      <div>
        <h1 class="page-title">Candidate Rankings</h1>
        <p class="page-subtitle">Role: <strong>{{ rankLabel }}</strong></p>
      </div>
    </div>

    <Card>
      <template #content>
        <div v-if="loading" class="spinner-wrap">
          <ProgressSpinner />
          <span class="spinner-label">Ranking candidates…</span>
        </div>

        <div v-else-if="error" class="error-wrap">
          <i class="pi pi-exclamation-circle error-icon" />
          <span>{{ error }}</span>
        </div>

        <div v-else-if="!ranked.length" class="empty-wrap">
          No results returned from the server.
        </div>

        <div v-else class="rank-list">
          <div
            v-for="(item, i) in ranked"
            :key="item.candidate_id"
            class="rank-row"
            @click="goToEvaluate(item.candidate_id)"
          >
            <span class="rank-pos" :class="`rank-pos--${i < 3 ? i + 1 : 'rest'}`">#{{ i + 1 }}</span>
            <i class="pi pi-file-pdf rank-file-icon" />
            <span class="rank-name" :title="nameFor(item.candidate_id)">{{ nameFor(item.candidate_id) }}</span>
            <ProgressBar :value="item.score" class="rank-bar" />
            <span class="rank-score">{{ item.score.toFixed(1) }}</span>
            <Button icon="pi pi-arrow-right" text rounded size="small" @click.stop="goToEvaluate(item.candidate_id)" />
          </div>
        </div>
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
