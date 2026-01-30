import type { Vacancy } from '@/types/vacancy'
import type { Candidate, AiCandidateEvaluation } from '@/types/candidate'

export const vacanciesMock: Vacancy[] = [
    {
        id: 'v1',
        title: 'Senior Frontend Engineer (Vue 3)',
        shortDescription: 'Разработка HR SaaS интерфейсов, работа с таблицами/карточками/дашбордами.',
        requirements: {
            skills: ['Vue 3', 'TypeScript', 'PrimeVue', 'REST', 'UX'],
            experienceLevel: 'senior',
            yearsMin: 4,
        },
    },
    {
        id: 'v2',
        title: 'Backend Engineer (Node.js)',
        shortDescription: 'API для подбора персонала, интеграции, оценка кандидатов, хранение профилей.',
        requirements: {
            skills: ['Node.js', 'PostgreSQL', 'REST', 'Docker'],
            experienceLevel: 'middle',
            yearsMin: 3,
        },
    },
]

export const candidatesMock: Candidate[] = [
    {
        id: 'c1',
        firstName: 'Анна',
        lastName: 'Петрова',
        age: 28,
        experienceYears: 6,
        resume: {
            about: 'Люблю продуктовую разработку, делаю понятные интерфейсы и поддерживаемый код.',
            achievements: ['Выстроила дизайн-систему на 30+ компонентов', 'Снизила время загрузки на 35%'],
            keySkills: ['Vue 3', 'TypeScript', 'PrimeVue', 'Performance', 'Design Systems'],
            workHistory: [
                {
                    company: 'Acme',
                    role: 'Frontend Engineer',
                    period: '2022–2025',
                    responsibilities: ['Vue 3 SPA', 'Компонентная библиотека', 'Оптимизация производительности'],
                },
                {
                    company: 'Beta',
                    role: 'Frontend Developer',
                    period: '2019–2022',
                    responsibilities: ['UI для CRM', 'Интеграции с REST', 'Визуализация данных'],
                },
            ],
        },
    },
    {
        id: 'c2',
        firstName: 'Илья',
        lastName: 'Смирнов',
        age: 35,
        experienceYears: 10,
        resume: {
            about: 'Сильный в архитектуре фронтенда, люблю сложные формы и data-heavy интерфейсы.',
            achievements: ['Миграция монолита на модульную архитектуру', 'Лидил команду 6 разработчиков'],
            keySkills: ['Vue', 'TypeScript', 'Architecture', 'Forms', 'DX'],
            workHistory: [
                {
                    company: 'Gamma',
                    role: 'Lead Frontend',
                    period: '2021–2025',
                    responsibilities: ['Архитектура', 'Код-ревью', 'Сложные формы', 'Планирование'],
                },
                {
                    company: 'Delta',
                    role: 'Frontend Engineer',
                    period: '2016–2021',
                    responsibilities: ['SPA', 'UI-kit', 'Инструменты разработчика'],
                },
            ],
        },
    },
]

export const aiByVacancyCandidateMock: Record<string, Record<string, AiCandidateEvaluation>> = {
    v1: {
        c1: {
            overallScore: 92,
            ageFitScore: 85,
            skillRatings: [
                { skill: 'Vue 3', score: 95 },
                { skill: 'TypeScript', score: 90 },
                { skill: 'PrimeVue', score: 88 },
                { skill: 'REST', score: 80 },
                { skill: 'UX', score: 86 },
            ],
            strengths: ['Сильный опыт с компонентами/дизайн-системой', 'Хорошая производительность и качество UI'],
            risks: ['Нужно проверить опыт с крупными enterprise-проектами'],
            recommendation: 'fit',
        },
        c2: {
            overallScore: 86,
            ageFitScore: 78,
            skillRatings: [
                { skill: 'Vue 3', score: 82 },
                { skill: 'TypeScript', score: 88 },
                { skill: 'PrimeVue', score: 70 },
                { skill: 'REST', score: 84 },
                { skill: 'UX', score: 76 },
            ],
            strengths: ['Архитектура и лидерство', 'Уверенно в сложных формах'],
            risks: ['PrimeVue/конкретный UI-stack нужно добрать'],
            recommendation: 'conditional',
        },
    },
    v2: {
        c1: {
            overallScore: 55,
            ageFitScore: 80,
            skillRatings: [
                { skill: 'Node.js', score: 30 },
                { skill: 'PostgreSQL', score: 40 },
                { skill: 'REST', score: 70 },
                { skill: 'Docker', score: 35 },
            ],
            strengths: ['Хорошее понимание REST и продуктового контекста'],
            risks: ['Недостаточно backend-опыта'],
            recommendation: 'no',
        },
        c2: {
            overallScore: 60,
            ageFitScore: 75,
            skillRatings: [
                { skill: 'Node.js', score: 45 },
                { skill: 'PostgreSQL', score: 50 },
                { skill: 'REST', score: 72 },
                { skill: 'Docker', score: 40 },
            ],
            strengths: ['Архитектурное мышление'],
            risks: ['Нужно подтверждение реального бекенд-опыта'],
            recommendation: 'conditional',
        },
    },
}