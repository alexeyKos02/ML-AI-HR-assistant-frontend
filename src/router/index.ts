import { createRouter, createWebHistory } from 'vue-router'
import VacanciesBoardView from '@/views/VacanciesBoardView.vue'
import VacancyScreenView from '@/views/VacancyScreenView.vue'
import CandidateProfileView from '@/views/CandidateProfileView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/vacancies' },

    // 1) Экран выбора вакансии + top-10
    { path: '/vacancies', name: 'vacancies', component: VacanciesBoardView },

    // 2) Full-screen экран вакансии + расширенный список кандидатов
    { path: '/vacancies/:vacancyId', name: 'vacancy', component: VacancyScreenView },

    // 4) Детальный профиль кандидата под конкретную вакансию (для AI-оценки именно “под вакансию”)
    {
      path: '/vacancies/:vacancyId/candidates/:candidateId',
      name: 'candidate',
      component: CandidateProfileView,
    },
  ],
})