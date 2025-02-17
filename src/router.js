import { createRouter, createWebHistory } from "vue-router"
import Interface from "./components/Interface.vue"
import Stage from "./components/Stage.vue"
import Sequence from "./components/Sequence.vue"

const routes = [
  {
    path: "/",
    name: "Squence",
    component: Sequence,
  },
  {
    path: "/legacy",
    name: "Old Stage",
    component: Stage,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
