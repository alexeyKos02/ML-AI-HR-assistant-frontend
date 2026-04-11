<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import { useCandidates } from '@/composables/useCandidates'
import { uploadResume, uploadVacancy, getVacancies, deleteVacancy, deleteCandidate } from '@/api/hrApi'

const router = useRouter()
const { candidates, role, effectiveRole, activeVacancy, selectedCandidateIds, refresh } = useCandidates()

const allSelected = computed(() => candidates.value.length > 0 && candidates.value.every(c => selectedCandidateIds.value.has(c.candidate_id)))
const someSelected = computed(() => candidates.value.some(c => selectedCandidateIds.value.has(c.candidate_id)))

function toggleCandidate(id: string) {
  const next = new Set(selectedCandidateIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedCandidateIds.value = next
}

function toggleAll() {
  if (allSelected.value) {
    selectedCandidateIds.value = new Set()
  } else {
    selectedCandidateIds.value = new Set(candidates.value.map(c => c.candidate_id))
  }
}

interface QueuedFile {
  id: number
  file: File
  name: string
}

interface UploadItem {
  id: number
  name: string
  status: 'uploading' | 'error'
  error?: string
}

let _uploadId = 0

const queue = ref<QueuedFile[]>([])
const uploading = ref<UploadItem[]>([])
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const vacancies = ref<{ hash: string; filename: string; uploaded_at?: string }[]>([])
const vacancyInputRef = ref<HTMLInputElement | null>(null)
const vacancyUploading = ref(false)
const vacancyError = ref('')

async function loadVacancies() {
  const res = await getVacancies()
  vacancies.value = res.vacancies
  // Если активная вакансия не в списке — сбросить
  if (activeVacancy.value && !res.vacancies.find(v => v.hash === activeVacancy.value?.hash)) {
    activeVacancy.value = null
    effectiveRole.value = role.value
  }
  // Если нет активной вакансии и нет роли, и есть вакансии — выбрать первую
  if (!activeVacancy.value && !role.value && res.vacancies.length > 0) {
    const first = res.vacancies[0]!
    selectVacancy(first)
  }
}

function selectVacancy(v: { hash: string; filename: string } | null) {
  activeVacancy.value = v
  if (v) {
    role.value = ''
    effectiveRole.value = v.filename.replace('.pdf', '')
  }
}

async function onVacancyChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const file = input.files[0]!
  vacancyUploading.value = true
  vacancyError.value = ''
  try {
    const res = await uploadVacancy(file)
    await loadVacancies()
    const uploaded = vacancies.value.find(v => v.hash === res.hash)
    if (uploaded) selectVacancy(uploaded)
  } catch (e) {
    vacancyError.value = e instanceof Error ? e.message : 'Ошибка загрузки'
  } finally {
    vacancyUploading.value = false
    input.value = ''
  }
}

const hasVacancy = computed(() => !!activeVacancy.value)
const hasRole = computed(() => role.value.trim().length > 0)
const canRank = computed(() => (hasVacancy.value || hasRole.value) && selectedCandidateIds.value.size >= 1)

function clearVacancy() {
  activeVacancy.value = null
  effectiveRole.value = role.value
}

async function onDeleteVacancy(v: { hash: string; filename: string }, e: Event) {
  e.stopPropagation()
  try {
    await deleteVacancy(v.hash)
    if (activeVacancy.value?.hash === v.hash) {
      activeVacancy.value = null
      effectiveRole.value = role.value
    }
    await loadVacancies()
  } catch (err) {
    vacancyError.value = err instanceof Error ? err.message : 'Ошибка удаления'
  }
}

const deletingCandidate = ref<string | null>(null)

async function onDeleteCandidate(candidateId: string, e: Event) {
  e.stopPropagation()
  deletingCandidate.value = candidateId
  try {
    await deleteCandidate(candidateId)
    await refresh()
  } catch (err) {
    console.error('Delete candidate failed', err)
  } finally {
    deletingCandidate.value = null
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await refresh()
    if (!candidates.value.some(c => c.status === 'processing')) {
      stopPolling()
    }
  }, 4000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

onMounted(async () => {
  await refresh()
  await loadVacancies()
  if (candidates.value.some(c => c.status === 'processing')) startPolling()
})

onUnmounted(stopPolling)

function addToQueue(files: FileList | File[]) {
  const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
  if (!pdfs.length) return
  const newItems: QueuedFile[] = pdfs.map((f) => ({ id: ++_uploadId, file: f, name: f.name }))
  queue.value.push(...newItems)
}

function removeFromQueue(id: number) {
  queue.value = queue.value.filter((q) => q.id !== id)
}

async function submitQueue() {
  if (!queue.value.length) return
  const toUpload = [...queue.value]
  queue.value = []

  const items: UploadItem[] = toUpload.map((q) => ({ id: q.id, name: q.name, status: 'uploading' }))
  uploading.value.push(...items)

  await Promise.all(
    toUpload.map(async (queued) => {
      const id = queued.id
      try {
        await uploadResume(queued.file, role.value.trim() || 'General')
        uploading.value = uploading.value.filter((u) => u.id !== id)
        await refresh()
        startPolling()
      } catch (e) {
        const item = uploading.value.find((u) => u.id === id)
        if (item) {
          item.status = 'error'
          item.error = e instanceof Error ? e.message : 'Ошибка загрузки'
        }
        setTimeout(() => {
          uploading.value = uploading.value.filter((u) => u.id !== id)
        }, 4000)
      }
    }),
  )
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files) addToQueue(e.dataTransfer.files)
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addToQueue(input.files)
  input.value = ''
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function goToEvaluate(id: string) {
  router.push({ name: 'evaluate', params: { candidateId: id } })
}

function goToRanking() {
  router.push({ name: 'ranking' })
}
</script>

<template>
  <div class="workspace">
    <!-- Left: setup -->
    <div class="workspace__left">
      <Card>
        <template #title>
          <div class="panel-title">
            <i class="pi pi-briefcase" />
            <span>Настройка скрининга</span>
          </div>
        </template>
        <template #content>
          <div class="field">
            <label class="field-label">Роль / Должность</label>
            <InputText
              v-model="role"
              placeholder="напр. Frontend Developer"
              class="w-full"
              @input="clearVacancy"
            />
          </div>

          <div v-if="!hasRole" class="divider-or">или</div>

          <div v-if="!hasRole" class="field">
            <label class="field-label">
              Вакансия
              <Button
                icon="pi pi-upload"
                text
                rounded
                size="small"
                v-tooltip.top="'Загрузить новую вакансию'"
                @click="vacancyInputRef?.click()"
                :loading="vacancyUploading"
                style="margin-left: 4px; height: 20px; width: 20px;"
              />
            </label>

            <div v-if="vacancies.length" class="vacancy-list">
              <div
                v-for="v in vacancies"
                :key="v.hash"
                class="vacancy-item"
                :class="{ 'vacancy-item--active': activeVacancy?.hash === v.hash }"
                @click="selectVacancy(v)"
              >
                <i class="pi pi-file-pdf vacancy-item__icon" />
                <span class="vacancy-item__name" :title="v.filename">{{ v.filename.replace('.pdf', '') }}</span>
                <span v-if="v.uploaded_at" class="vacancy-item__date">{{ formatDate(v.uploaded_at) }}</span>
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  size="small"
                  severity="danger"
                  @click="(e) => onDeleteVacancy(v, e)"
                />
              </div>
            </div>
            <span v-else class="field-hint">Вакансий пока нет. Загрузите PDF.</span>

            <input ref="vacancyInputRef" type="file" accept=".pdf" hidden @change="onVacancyChange" />
            <span v-if="vacancyError" class="field-hint" style="color: #dc2626">{{ vacancyError }}</span>
          </div>

          <div class="field">
            <label class="field-label">Загрузить резюме</label>
            <div
              class="upload-zone"
              :class="{ 'upload-zone--drag': isDragging }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="onDrop"
              @click="fileInputRef?.click()"
            >
              <i class="pi pi-cloud-upload upload-zone__icon" />
              <span class="upload-zone__text">
                Перетащите PDF сюда или <span class="upload-zone__link">выберите файл</span>
              </span>
              <span class="upload-zone__hint">Только PDF · поддерживается несколько файлов</span>
              <input
                ref="fileInputRef"
                type="file"
                accept=".pdf,application/pdf"
                multiple
                hidden
                @change="onFileChange"
              />
            </div>
          </div>

          <!-- Очередь: файлы выбраны, но ещё не загружены -->
          <div v-if="queue.length" class="upload-queue">
            <div
              v-for="item in queue"
              :key="item.id"
              class="upload-queue__item upload-queue__item--queued"
            >
              <i class="pi pi-file-pdf" />
              <span class="upload-queue__name">{{ item.name }}</span>
              <button class="upload-queue__remove" @click="removeFromQueue(item.id)" title="Убрать">
                <i class="pi pi-times" />
              </button>
            </div>
            <Button
              label="Загрузить"
              icon="pi pi-upload"
              class="upload-submit-btn"
              @click="submitQueue"
            />
          </div>

          <!-- Прогресс загрузки -->
          <div v-if="uploading.length" class="upload-queue">
            <div
              v-for="item in uploading"
              :key="item.id"
              class="upload-queue__item"
              :class="{ 'upload-queue__item--error': item.status === 'error' }"
            >
              <i :class="item.status === 'error' ? 'pi pi-times-circle' : 'pi pi-spin pi-spinner'" />
              <span class="upload-queue__name">{{ item.name }}</span>
              <span v-if="item.status === 'uploading'" class="upload-queue__status">загрузка…</span>
              <span v-else class="upload-queue__error">{{ item.error }}</span>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Right: candidates -->
    <div class="workspace__right">
      <Card>
        <template #title>
          <div class="candidates-header">
            <div class="panel-title">
              <input
                type="checkbox"
                class="select-all-checkbox"
                :checked="allSelected"
                :indeterminate="someSelected && !allSelected"
                @change="toggleAll"
                v-tooltip.top="allSelected ? 'Снять выбор' : 'Выбрать всех'"
              />
              <i class="pi pi-users" />
              <span>Кандидаты</span>
              <span class="badge">{{ candidates.length }}</span>
            </div>
            <div class="rank-btn-wrap">
              <Button
                icon="pi pi-sort-amount-down"
                :label="`Ранжировать (${selectedCandidateIds.size})`"
                :disabled="!canRank"
                @click="goToRanking"
              />
              <span v-if="!hasVacancy && !hasRole" class="rank-hint">Укажите роль или выберите вакансию</span>
              <span v-else-if="!selectedCandidateIds.size" class="rank-hint">Выберите хотя бы одно резюме</span>
            </div>
          </div>
        </template>
        <template #content>
          <div v-if="!candidates.length" class="empty-candidates">
            <i class="pi pi-inbox empty-candidates__icon" />
            <span>Кандидатов пока нет. Загрузите резюме для начала работы.</span>
          </div>
          <div v-else class="candidate-list">
            <div
              v-for="c in candidates"
              :key="c.candidate_id"
              class="candidate-row"
              :class="{ 'candidate-row--unselected': !selectedCandidateIds.has(c.candidate_id) }"
              @click="toggleCandidate(c.candidate_id)"
            >
              <input
                type="checkbox"
                class="candidate-checkbox"
                :checked="selectedCandidateIds.has(c.candidate_id)"
                @click.stop="toggleCandidate(c.candidate_id)"
              />
              <i class="pi pi-file-pdf candidate-row__icon" />
              <div class="candidate-row__info">
                <span class="candidate-row__name">{{ c.filename }}</span>
                <span class="candidate-row__meta">
                  <span class="candidate-row__pos">{{ c.position }}</span>
                  · {{ formatDate(c.uploaded_at) }}
                </span>
              </div>
              <span
                v-if="c.status === 'processing'"
                class="status-badge status-badge--processing"
                v-tooltip.top="'Резюме обрабатывается…'"
              >
                <i class="pi pi-spin pi-spinner" />
              </span>
              <span
                v-else-if="c.status === 'error'"
                class="status-badge status-badge--error"
                v-tooltip.top="'Ошибка обработки'"
              >
                <i class="pi pi-exclamation-triangle" />
              </span>
              <Button
                v-tooltip.top="c.status === 'processing' ? 'Подождите — резюме ещё обрабатывается' : hasVacancy || hasRole ? 'Оценить кандидата' : 'Укажите роль или загрузите вакансию'"
                icon="pi pi-chart-bar"
                text
                rounded
                size="small"
                :disabled="(!hasVacancy && !hasRole) || c.status === 'processing'"
                @click.stop="goToEvaluate(c.candidate_id)"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                size="small"
                severity="danger"
                v-tooltip.top="'Удалить кандидата'"
                :loading="deletingCandidate === c.candidate_id"
                @click.stop="(e) => onDeleteCandidate(c.candidate_id, e)"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 20px;
  align-items: start;
}

.workspace__left,
.workspace__right {
  min-width: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--app-accent, #10b981);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.field {
  margin-bottom: 16px;
}
.field-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-color-secondary);
  margin-bottom: 6px;
}
.field-hint {
  font-size: 12px;
  margin-top: 4px;
  display: block;
}

.vacancy-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.vacancy-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 120ms, border-color 120ms;
}
.vacancy-item:hover {
  background: rgba(15, 23, 42, 0.04);
}
.vacancy-item--active {
  background: rgba(16, 185, 129, 0.08);
  border-color: var(--app-accent, #10b981);
}
.vacancy-item__icon {
  color: #e74c3c;
  font-size: 15px;
  flex-shrink: 0;
}
.vacancy-item__name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vacancy-item__date {
  font-size: 11px;
  color: var(--text-color-secondary);
  flex-shrink: 0;
  white-space: nowrap;
}

.divider-or {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-color-secondary);
  font-size: 13px;
  margin: 4px 0 16px;
}
.divider-or::before,
.divider-or::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--surface-border);
}

.upload-zone {
  border: 2px dashed var(--surface-border);
  border-radius: 10px;
  padding: 28px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 150ms, background 150ms;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.upload-zone:hover,
.upload-zone--drag {
  border-color: var(--app-accent, #10b981);
  background: rgba(16, 185, 129, 0.04);
}
.upload-zone__icon {
  font-size: 28px;
  color: var(--text-color-secondary);
}
.upload-zone__text {
  font-size: 14px;
  color: var(--text-color-secondary);
}
.upload-zone__link {
  color: var(--app-accent, #10b981);
  font-weight: 600;
}
.upload-zone__hint {
  font-size: 12px;
  color: var(--text-color-secondary);
  opacity: 0.7;
}

.upload-queue {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.upload-queue__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--surface-100, #f8fafc);
}
.upload-queue__item--queued {
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.upload-queue__item--error {
  background: #fef2f2;
  color: #dc2626;
}
.upload-queue__remove {
  margin-left: auto;
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
  color: var(--text-color-secondary);
  font-size: 11px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}
.upload-queue__remove:hover {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
}
.upload-submit-btn {
  width: 100%;
  margin-top: 4px;
}
.upload-queue__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-queue__status {
  color: var(--text-color-secondary);
  font-size: 12px;
}
.upload-queue__error {
  font-size: 12px;
  color: #dc2626;
}

.candidates-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.rank-btn-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.rank-hint {
  font-size: 11px;
  color: var(--text-color-secondary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  flex-shrink: 0;
}
.status-badge--processing {
  color: #f59e0b;
}
.status-badge--error {
  color: #ef4444;
}

.empty-candidates {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--text-color-secondary);
  font-size: 14px;
  text-align: center;
}
.empty-candidates__icon {
  font-size: 36px;
  opacity: 0.4;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.candidate-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 6px;
  border-radius: 8px;
  transition: background 120ms;
}
.candidate-row:hover {
  background: rgba(15, 23, 42, 0.04);
  cursor: pointer;
}
.candidate-row--unselected {
  opacity: 0.45;
}
.candidate-checkbox {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--app-accent, #10b981);
}
.select-all-checkbox {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--app-accent, #10b981);
}
.candidate-row__icon {
  color: #e74c3c;
  font-size: 18px;
  flex-shrink: 0;
}
.candidate-row__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.candidate-row__name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.candidate-row__meta {
  font-size: 12px;
  color: var(--text-color-secondary);
}
.candidate-row__pos {
  color: var(--app-accent, #10b981);
  font-weight: 500;
}
</style>
