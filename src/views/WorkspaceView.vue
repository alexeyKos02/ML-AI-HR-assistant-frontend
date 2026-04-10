<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useCandidates } from '@/composables/useCandidates'
import { uploadResume, uploadVacancy, getVacancies } from '@/api/hrApi'

const router = useRouter()
const { candidates, role, effectiveRole, activeVacancy, refresh } = useCandidates()

interface UploadItem {
  name: string
  status: 'uploading' | 'error'
  error?: string
}

const uploading = ref<UploadItem[]>([])
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const vacancies = ref<{ hash: string; filename: string }[]>([])
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
  if (!activeVacancy.value && !role.value && res.vacancies.length) {
    selectVacancy(res.vacancies[0])
  }
}

function selectVacancy(v: { hash: string; filename: string } | null | undefined) {
  activeVacancy.value = v ?? null
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
    vacancyError.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    vacancyUploading.value = false
    input.value = ''
  }
}

const hasVacancy = computed(() => !!activeVacancy.value)
const hasRole = computed(() => role.value.trim().length > 0)
const canRank = computed(() => (hasVacancy.value || hasRole.value) && candidates.value.length >= 1)

function clearVacancy() {
  activeVacancy.value = null
  effectiveRole.value = role.value
}

onMounted(() => { refresh(); loadVacancies() })

async function handleFiles(files: FileList | File[]) {
  const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
  if (!pdfs.length) return

  const items: UploadItem[] = pdfs.map((f) => ({ name: f.name, status: 'uploading' }))
  uploading.value.push(...items)

  await Promise.all(
    pdfs.map(async (file, i) => {
      const item = items[i]!
      try {
        await uploadResume(file, role.value.trim() || 'General')
        uploading.value = uploading.value.filter((u) => u !== item)
        await refresh()
      } catch (e) {
        item.status = 'error'
        item.error = e instanceof Error ? e.message : 'Upload failed'
        setTimeout(() => {
          uploading.value = uploading.value.filter((u) => u !== item)
        }, 4000)
      }
    }),
  )
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) handleFiles(input.files)
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
            <span>Screening Setup</span>
          </div>
        </template>
        <template #content>
          <div class="field">
            <label class="field-label">Role / Position</label>
            <InputText
              v-model="role"
              placeholder="e.g. Frontend Developer"
              class="w-full"
              @input="clearVacancy"
            />
          </div>

          <div v-if="!hasRole" class="divider-or">or</div>

          <div v-if="!hasRole" class="field">
            <label class="field-label">Vacancy</label>

            <div class="vacancy-row">
              <Select
                :modelValue="activeVacancy"
                :options="vacancies"
                optionLabel="filename"
                placeholder="Select vacancy"
                class="vacancy-select"
                @update:modelValue="selectVacancy"
              />
              <Button
                icon="pi pi-upload"
                text
                rounded
                size="small"
                v-tooltip.top="'Upload new vacancy'"
                @click="vacancyInputRef?.click()"
                :loading="vacancyUploading"
              />
              <Button
                v-if="activeVacancy"
                icon="pi pi-times"
                text
                rounded
                size="small"
                severity="danger"
                @click="clearVacancy"
              />
            </div>
            <input ref="vacancyInputRef" type="file" accept=".pdf" hidden @change="onVacancyChange" />
            <span v-if="vacancyError" class="field-hint" style="color: #dc2626">{{ vacancyError }}</span>
          </div>

          <div class="field">
            <label class="field-label">Upload Resumes</label>
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
                Drop PDF files here or <span class="upload-zone__link">browse</span>
              </span>
              <span class="upload-zone__hint">PDF only · multiple files supported</span>
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

          <div v-if="uploading.length" class="upload-queue">
            <div
              v-for="item in uploading"
              :key="item.name"
              class="upload-queue__item"
              :class="{ 'upload-queue__item--error': item.status === 'error' }"
            >
              <i :class="item.status === 'error' ? 'pi pi-times-circle' : 'pi pi-file-pdf'" />
              <span class="upload-queue__name">{{ item.name }}</span>
              <span v-if="item.status === 'uploading'" class="upload-queue__status">uploading…</span>
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
              <i class="pi pi-users" />
              <span>Candidates</span>
              <span class="badge">{{ candidates.length }}</span>
            </div>
            <Button
              icon="pi pi-sort-amount-down"
              label="Rank All"
              :disabled="!canRank"
              @click="goToRanking"
            />
          </div>
        </template>
        <template #content>
          <div v-if="!candidates.length" class="empty-candidates">
            <i class="pi pi-inbox empty-candidates__icon" />
            <span>No candidates yet. Upload resumes to get started.</span>
          </div>
          <div v-else class="candidate-list">
            <div
              v-for="c in candidates"
              :key="c.candidate_id"
              class="candidate-row"
            >
              <i class="pi pi-file-pdf candidate-row__icon" />
              <div class="candidate-row__info">
                <span class="candidate-row__name">{{ c.filename }}</span>
                <span class="candidate-row__meta">
                  <span class="candidate-row__pos">{{ c.position }}</span>
                  · {{ formatDate(c.uploaded_at) }}
                </span>
              </div>
              <Button
                v-tooltip.top="hasVacancy || hasRole ? 'Evaluate this candidate' : 'Enter a role or upload a vacancy first'"
                icon="pi pi-chart-bar"
                text
                rounded
                size="small"
                :disabled="!hasVacancy && !hasRole"
                @click="goToEvaluate(c.candidate_id)"
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

.vacancy-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.vacancy-select {
  flex: 1;
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
.upload-queue__item--error {
  background: #fef2f2;
  color: #dc2626;
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
  align-items: center;
  justify-content: space-between;
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
