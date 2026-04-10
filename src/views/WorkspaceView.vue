<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import ProgressBar from 'primevue/progressbar'
import { useCandidates } from '@/composables/useCandidates'
import { uploadResume, uploadVacancy, getVacancy } from '@/api/hrApi'

const router = useRouter()
const { candidates, role, effectiveRole, refresh } = useCandidates()

interface UploadItem {
  name: string
  status: 'uploading' | 'error'
  error?: string
}

const uploading = ref<UploadItem[]>([])
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const vacancyFile = ref<{ filename: string; length: number } | null>(null)
const vacancyInputRef = ref<HTMLInputElement | null>(null)
const vacancyUploading = ref(false)
const vacancyError = ref('')

async function loadVacancy() {
  const res = await getVacancy()
  if (res.vacancy) {
    vacancyFile.value = res.vacancy
    role.value = ''
    effectiveRole.value = res.vacancy.filename.replace('.pdf', '')
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
    vacancyFile.value = { filename: res.filename, length: res.length }
    role.value = ''
    effectiveRole.value = res.filename.replace('.pdf', '')
  } catch (e) {
    vacancyError.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    vacancyUploading.value = false
    input.value = ''
  }
}

const hasVacancy = computed(() => !!vacancyFile.value)
const hasRole = computed(() => role.value.trim().length > 0)
const canRank = computed(() => (hasVacancy.value || hasRole.value) && candidates.value.length >= 1)

function clearVacancy() {
  vacancyFile.value = null
  role.value = ''
}

onMounted(() => { refresh(); loadVacancy() })

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
          <div v-if="!hasVacancy" class="field">
            <label class="field-label">Role / Position</label>
            <InputText
              v-model="role"
              placeholder="e.g. Frontend Developer"
              class="w-full"
            />
          </div>

          <div v-if="!hasVacancy && !hasRole" class="divider-or">or</div>

          <div v-if="!hasRole" class="field">
            <label class="field-label">Vacancy</label>
            <div class="vacancy-upload" @click="vacancyInputRef?.click()">
              <template v-if="vacancyFile">
                <i class="pi pi-file-pdf" style="color: #e74c3c" />
                <span class="vacancy-upload__name">{{ vacancyFile.filename }}</span>
                <span class="vacancy-upload__hint">click to replace</span>
                <Button icon="pi pi-times" text rounded size="small" @click.stop="clearVacancy" />
              </template>
              <template v-else>
                <i class="pi pi-upload" />
                <span>Upload vacancy PDF</span>
              </template>
              <ProgressBar v-if="vacancyUploading" mode="indeterminate" class="vacancy-upload__bar" />
              <input ref="vacancyInputRef" type="file" accept=".pdf" hidden @change="onVacancyChange" />
            </div>
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
              <ProgressBar
                v-if="item.status === 'uploading'"
                mode="indeterminate"
                class="upload-queue__bar"
              />
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
          <div class="panel-title panel-title--spread">
            <div class="panel-title">
              <i class="pi pi-users" />
              <span>Candidates</span>
              <span v-if="candidates.length" class="count-badge">{{ candidates.length }}</span>
            </div>
            <Button
              label="Rank All"
              icon="pi pi-sort-amount-down"
              size="small"
              :disabled="!canRank"
              v-tooltip.left="!role.trim() ? 'Enter a role first' : !candidates.length ? 'Upload at least one resume' : ''"
              @click="goToRanking"
            />
          </div>
        </template>
        <template #content>
          <div v-if="!candidates.length" class="empty-state">
            <i class="pi pi-inbox empty-state__icon" />
            <span>Upload resumes to get started</span>
          </div>

          <div v-else class="candidate-list">
            <div v-for="c in candidates" :key="c.candidate_id" class="candidate-row">
              <i class="pi pi-file-pdf candidate-row__icon" />
              <div class="candidate-row__info">
                <span class="candidate-row__name" :title="c.filename">{{ c.filename }}</span>
                <span class="candidate-row__date">
                  <span class="candidate-row__position">{{ c.position }}</span>
                  · {{ formatDate(c.uploaded_at) }}
                </span>
              </div>
              <div class="candidate-row__actions">
                <Button
                  v-tooltip.top="role.trim() || hasVacancy ? 'Evaluate this candidate' : 'Enter a role or upload a vacancy first'"
                  icon="pi pi-chart-bar"
                  text
                  rounded
                  size="small"
                  :disabled="!role.trim() && !hasVacancy"
                  @click="goToEvaluate(c.candidate_id)"
                />
              </div>
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
  grid-template-columns: 360px 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 820px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.panel-title--spread {
  justify-content: space-between;
  width: 100%;
}

.count-badge {
  background: var(--app-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 10px;
  padding: 1px 7px;
  min-width: 20px;
  text-align: center;
}

.field {
  margin-bottom: 20px;
}
.field-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-color-secondary);
  margin-bottom: 8px;
}
.field-hint {
  display: block;
  font-size: 11px;
  color: var(--text-color-secondary);
  opacity: 0.7;
  margin-top: 5px;
}

.divider-or {
  display: flex;
  align-items: center;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-color-secondary);
  opacity: 0.5;
  margin: -8px 0 12px;
  gap: 8px;
}
.divider-or::before,
.divider-or::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--surface-border);
}

/* Vacancy upload */
.vacancy-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px dashed var(--surface-border);
  border-radius: var(--app-radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color-secondary);
  transition: border-color 150ms, background 150ms;
}
.vacancy-upload:hover {
  border-color: var(--app-accent);
  background: rgba(37, 99, 235, 0.04);
}
.vacancy-upload__name {
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);
}
.vacancy-upload__hint {
  font-size: 11px;
  opacity: 0.6;
  flex-shrink: 0;
}
.vacancy-upload__bar {
  width: 60px;
  flex-shrink: 0;
}

/* Upload zone */
.upload-zone {
  border: 2px dashed var(--surface-border);
  border-radius: var(--app-radius-sm);
  padding: 36px 20px;
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
  border-color: var(--app-accent);
  background: rgba(37, 99, 235, 0.04);
}
.upload-zone__icon {
  font-size: 30px;
  color: var(--text-color-secondary);
  margin-bottom: 4px;
  transition: color 150ms;
}
.upload-zone--drag .upload-zone__icon,
.upload-zone:hover .upload-zone__icon {
  color: var(--app-accent);
}
.upload-zone__text {
  font-size: 14px;
  color: var(--text-color-secondary);
}
.upload-zone__link {
  color: var(--app-accent);
  font-weight: 600;
}
.upload-zone__hint {
  font-size: 12px;
  color: var(--text-color-secondary);
  opacity: 0.6;
}

/* Upload queue */
.upload-queue {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.upload-queue__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(37, 99, 235, 0.06);
  border-radius: 8px;
  font-size: 13px;
}
.upload-queue__item--error {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}
.upload-queue__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-queue__bar {
  width: 80px;
  flex-shrink: 0;
}
.upload-queue__error {
  font-size: 12px;
  opacity: 0.85;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--text-color-secondary);
  font-size: 14px;
}
.empty-state__icon {
  font-size: 40px;
  opacity: 0.35;
}

/* Candidate list */
.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 480px;
  overflow-y: auto;
}
.candidate-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 10px;
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
.candidate-row__date {
  font-size: 11px;
  color: var(--text-color-secondary);
}
.candidate-row__position {
  font-weight: 600;
  color: var(--app-accent);
}
.candidate-row__actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
