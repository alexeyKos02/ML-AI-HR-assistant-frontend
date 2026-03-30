import { ref, watch } from 'vue'
import type { StoredCandidate } from '@/types'

const CANDIDATES_KEY = 'hr_candidates'
const ROLE_KEY = 'hr_role'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

// Module-level singletons — state shared across all component instances
const candidates = ref<StoredCandidate[]>(load<StoredCandidate[]>(CANDIDATES_KEY, []))
const role = ref<string>(load<string>(ROLE_KEY, ''))

watch(candidates, (v) => localStorage.setItem(CANDIDATES_KEY, JSON.stringify(v)), { deep: true })
watch(role, (v) => localStorage.setItem(ROLE_KEY, v))

export function useCandidates() {
  function addCandidate(candidate: StoredCandidate) {
    if (!candidates.value.find((c) => c.id === candidate.id)) {
      candidates.value = [...candidates.value, candidate]
    }
  }

  function removeCandidate(id: string) {
    candidates.value = candidates.value.filter((c) => c.id !== id)
  }

  function clearAll() {
    candidates.value = []
  }

  return { candidates, role, addCandidate, removeCandidate, clearAll }
}
