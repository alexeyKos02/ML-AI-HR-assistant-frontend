export interface CandidateInfo {
  candidate_id: string
  filename: string
  position: string
  uploaded_at: string
  status: 'processing' | 'ready' | 'error'
}

export interface RankResult {
  candidate_id: string
  score: number
}

export type EvaluationResult = Record<string, number>

export interface UploadResponse {
  status: string
  candidate_id: string
  message: string
}
