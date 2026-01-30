import type { Vacancy } from '@/types/vacancy'
import type { Candidate, AiCandidateEvaluation } from '@/types/candidate'
import { vacanciesMock, candidatesMock, aiByVacancyCandidateMock } from '@/mock/hr.mock'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function getVacancies(): Promise<Vacancy[]> {
    await delay(120)
    return vacanciesMock
}

export async function getVacancyById(vacancyId: string): Promise<Vacancy | null> {
    await delay(120)
    return vacanciesMock.find((v) => v.id === vacancyId) ?? null
}

export async function getTopCandidatesForVacancy(vacancyId: string): Promise<Array<{ candidate: Candidate; ai: AiCandidateEvaluation }>> {
    await delay(160)

    const aiMap = aiByVacancyCandidateMock[vacancyId] ?? {}
    // На моках: берём всех, сортируем по overallScore, режем top-10
    return candidatesMock
        .map((c) => ({ candidate: c, ai: aiMap[c.id] }))
        .filter((x): x is { candidate: Candidate; ai: AiCandidateEvaluation } => Boolean(x.ai))
        .sort((a, b) => b.ai.overallScore - a.ai.overallScore)
        .slice(0, 10)
}

export async function getCandidatesForVacancy(vacancyId: string): Promise<Array<{ candidate: Candidate; ai: AiCandidateEvaluation }>> {
    // сейчас то же, что top — потом будет пагинация/поиск
    return getTopCandidatesForVacancy(vacancyId)
}

export async function getCandidateById(candidateId: string): Promise<Candidate | null> {
    await delay(120)
    return candidatesMock.find((c) => c.id === candidateId) ?? null
}

export async function getAiEvaluation(vacancyId: string, candidateId: string): Promise<AiCandidateEvaluation | null> {
    await delay(120)
    return aiByVacancyCandidateMock[vacancyId]?.[candidateId] ?? null
}

export type CandidatesQuery = {
    q?: string
    minScore?: number
    skills?: string[]
}

export type CandidatesPage = {
    items: Array<{ candidate: Candidate; ai: AiCandidateEvaluation }>
    hasMore: boolean
    nextOffset: number
}

export async function getCandidatesForVacancyPage(
    vacancyId: string,
    offset: number,
    limit: number,
    query: CandidatesQuery,
): Promise<CandidatesPage> {
    await delay(180)

    const aiMap = aiByVacancyCandidateMock[vacancyId] ?? {}

    const base = candidatesMock
        .map((c) => ({ candidate: c, ai: aiMap[c.id] }))
        .filter((x): x is { candidate: Candidate; ai: AiCandidateEvaluation } => Boolean(x.ai))
        .sort((a, b) => b.ai.overallScore - a.ai.overallScore)

    const q = (query.q ?? '').trim().toLowerCase()
    const minScore = query.minScore ?? 0
    const skills = (query.skills ?? []).map((s) => s.toLowerCase())

    const filtered = base.filter((x) => {
        if (x.ai.overallScore < minScore) return false

        if (skills.length) {
            const candidateSkills = x.candidate.resume.keySkills.map((s) => s.toLowerCase())
            const hasAnySkill = skills.some((s) => candidateSkills.includes(s))
            if (!hasAnySkill) return false
        }

        if (!q) return true

        const fullName = `${x.candidate.firstName} ${x.candidate.lastName}`.toLowerCase()
        const inCompanies = x.candidate.resume.workHistory.some((w) => w.company.toLowerCase().includes(q))
        const inRoles = x.candidate.resume.workHistory.some((w) => w.role.toLowerCase().includes(q))
        const inSkills = x.candidate.resume.keySkills.some((s) => s.toLowerCase().includes(q))

        return fullName.includes(q) || inCompanies || inRoles || inSkills
    })

    const pageItems = filtered.slice(offset, offset + limit)
    const nextOffset = offset + pageItems.length

    return {
        items: pageItems,
        hasMore: nextOffset < filtered.length,
        nextOffset,
    }
}