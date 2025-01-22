import { createRouter, createWebHistory } from 'vue-router';
import Interface from './components/Interface.vue';
import Stage from './components/Stage.vue';

const routes = [
  {
    path: '/',
    name: 'Stage',
    component: Stage,
  },
  {
    path: '/interface',
    name: 'Interface',
    component: Interface,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;  