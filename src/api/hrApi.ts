import type { CandidateInfo, EvaluationResult, RankResult, UploadResponse } from '@/types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function uploadResume(file: File, position: string): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('position', position)
  return request<UploadResponse>('/api/upload', { method: 'POST', body: form })
}

export async function getCandidates(): Promise<CandidateInfo[]> {
  return request<CandidateInfo[]>('/api/candidates')
}

export async function getPositions(): Promise<string[]> {
  const res = await request<{ positions: string[] }>('/api/positions')
  return res.positions
}

export async function evaluateCandidate(candidateId: string, role: string): Promise<EvaluationResult> {
  return request<EvaluationResult>('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: candidateId, role }),
  })
}

export async function rankCandidates(role: string, candidateIds: string[]): Promise<RankResult[]> {
  return request<RankResult[]>('/api/rank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, candidate_ids: candidateIds }),
  })
}

export async function uploadVacancy(file: File): Promise<{ status: string; filename: string; length: number }> {
  const form = new FormData()
  form.append('file', file)
  return request('/api/vacancy', { method: 'POST', body: form })
}

export async function getVacancy(): Promise<{ vacancy: { filename: string; length: number } | null }> {
  return request('/api/vacancy')
}

export async function healthCheck(): Promise<{ api: string; redis: string }> {
  return request<{ api: string; redis: string }>('/api/health')
}
