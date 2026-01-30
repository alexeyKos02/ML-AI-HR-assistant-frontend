export type CandidateWorkItem = {
  company: string
  role: string
  period: string
  responsibilities: string[]
}

export type CandidateResume = {
  about: string
  achievements: string[]
  keySkills: string[]
  workHistory: CandidateWorkItem[]
}

export type Candidate = {
  id: string
  firstName: string
  lastName: string
  age: number
  experienceYears: number
  resume: CandidateResume
}

export type AiSkillRating = {
  skill: string
  score: number // 0..100
}

export type AiCandidateEvaluation = {
  overallScore: number // 0..100
  ageFitScore: number // 0..100
  skillRatings: AiSkillRating[]
  strengths: string[]
  risks: string[]
  recommendation: 'fit' | 'conditional' | 'no'
}