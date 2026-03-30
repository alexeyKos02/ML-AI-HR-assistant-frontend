export interface StoredCandidate {
  id: string
  filename: string
  uploadedAt: string
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
