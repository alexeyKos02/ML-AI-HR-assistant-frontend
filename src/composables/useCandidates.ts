import { ref, watch } from 'vue'
import type { CandidateInfo } from '@/types'
import { getCandidates } from '@/api/hrApi'

const ROLE_KEY = 'hr_role'
const EFFECTIVE_ROLE_KEY = 'hr_effective_role'

function loadFromStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

// Module-level singletons
const candidates = ref<CandidateInfo[]>([])
const role = ref<string>(loadFromStorage(ROLE_KEY))
const effectiveRole = ref<string>(loadFromStorage(EFFECTIVE_ROLE_KEY))

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

export function useCandidates() {
  async function refresh() {
    candidates.value = await getCandidates()
  }

  return { candidates, role, effectiveRole, refresh }
}
