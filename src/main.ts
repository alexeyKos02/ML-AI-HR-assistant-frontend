import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Tooltip from 'primevue/tooltip'

import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

import './style.css'

createApp(App)
    .use(router)
    .use(PrimeVue, {
        theme: {
            preset: Aura,
            options: {
                darkModeSelector: '.p-dark',
            },
        },
    })
    .directive('tooltip', Tooltip)
    .mount('#app')