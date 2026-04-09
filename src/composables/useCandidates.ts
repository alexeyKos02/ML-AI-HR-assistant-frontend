import { ref, watch } from 'vue'
import type { CandidateInfo } from '@/types'
import { getCandidates } from '@/api/hrApi'

const ROLE_KEY = 'hr_role'

function loadRole(): string {
  try {
    return localStorage.getItem(ROLE_KEY) ?? ''
  } catch {
    return ''
  }
}

// Module-level singletons
const candidates = ref<CandidateInfo[]>([])
const role = ref<string>(loadRole())
const effectiveRole = ref<string>(loadRole())

watch(role, (v) => {
  localStorage.setItem(ROLE_KEY, v)
  if (v) effectiveRole.value = v
})

export function useCandidates() {
  async function refresh() {
    candidates.value = await getCandidates()
  }

  return { candidates, role, effectiveRole, refresh }
}
