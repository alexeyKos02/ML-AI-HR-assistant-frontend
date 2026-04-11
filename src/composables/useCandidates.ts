import { ref, watch } from 'vue'
import type { CandidateInfo } from '@/types'
import { getCandidates } from '@/api/hrApi'

const ROLE_KEY = 'hr_role'
const EFFECTIVE_ROLE_KEY = 'hr_effective_role'
const VACANCY_KEY = 'hr_active_vacancy'

function loadFromStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function loadVacancyFromStorage(): { hash: string; filename: string } | null {
  try {
    const raw = localStorage.getItem(VACANCY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Module-level singletons
const candidates = ref<CandidateInfo[]>([])
const role = ref<string>(loadFromStorage(ROLE_KEY))
const effectiveRole = ref<string>(loadFromStorage(EFFECTIVE_ROLE_KEY))
const activeVacancy = ref<{ hash: string; filename: string } | null>(loadVacancyFromStorage())
const selectedCandidateIds = ref<Set<string>>(new Set())

watch(role, (v) => {
  localStorage.setItem(ROLE_KEY, v)
  if (v) {
    effectiveRole.value = v
    localStorage.setItem(EFFECTIVE_ROLE_KEY, v)
  }
})

watch(effectiveRole, (v) => {
  localStorage.setItem(EFFECTIVE_ROLE_KEY, v)
})

watch(activeVacancy, (v) => {
  if (v) localStorage.setItem(VACANCY_KEY, JSON.stringify(v))
  else localStorage.removeItem(VACANCY_KEY)
}, { deep: true })

export function useCandidates() {
  async function refresh() {
    candidates.value = await getCandidates()
    // Auto-select new candidates (those not yet in selection set)
    const next = new Set(selectedCandidateIds.value)
    candidates.value.forEach(c => next.add(c.candidate_id))
    selectedCandidateIds.value = next
  }

  return { candidates, role, effectiveRole, activeVacancy, selectedCandidateIds, refresh }
}
