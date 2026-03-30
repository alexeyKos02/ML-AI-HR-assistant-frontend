import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '@/views/WorkspaceView.vue'
import RankingView from '@/views/RankingView.vue'
import EvaluationView from '@/views/EvaluationView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/workspace' },
    { path: '/workspace', name: 'workspace', component: WorkspaceView },
    { path: '/ranking', name: 'ranking', component: RankingView },
    { path: '/evaluate/:candidateId', name: 'evaluate', component: EvaluationView },
  ],
})
