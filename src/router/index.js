import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LearnView from '@/views/LearnView.vue'
import AdminView from '@/views/AdminView.vue'

// Hash history (#/learn): merge pe GitHub Pages fără configurare în plus.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/learn', name: 'learn', component: LearnView },
    { path: '/admin', name: 'admin', component: AdminView },
  ],
})

export default router
