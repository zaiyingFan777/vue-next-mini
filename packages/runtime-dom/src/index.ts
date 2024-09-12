import { createRenderer } from '@vue/runtime-core'
import { extend, isString } from '@vue/shared'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'

// 合并 patchProp 和 nodeOps
const rendererOptions = /*#__PURE__*/ extend({ patchProp }, nodeOps)

let renderer

function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions))
}

// 导出 render（解构出来的 render）
export const render = (...args) => {
  console.log(args, 'args')
  // 在函数体内部打印，args => array, ...args 解构数组（param1, param2, param3, ...）
  ensureRenderer().render(...args)
}

/**
 * 创建并生成 app 实例
 * 1. createApp 中，必然要生成对应的 vnode
 * const app = createApp(App)
 * 2. mount 方法，必然要触发 render，生成 vnode
 * app.mount('#app')
 */
export const createApp = (...args) => {
  const app = ensureRenderer().createApp(...args)

  // 获取到 mount 挂载方法
  const { mount } = app
  // 对该方法进行重构，标准化 container，在重新触发 mount 进行挂载
  // 如果是'#app'那么通过document.querySelector('#app')，如果本身已经是Element不做操作
  app.mount = (containerOrSelector: Element | string) => {
    const container = normalizeContainer(containerOrSelector)
    if (!container) return
    mount(container)
  }

  return app
}

/**
 * 标准化 container 容器
 */
function normalizeContainer(container: Element | string): Element | null {
  if (isString(container)) {
    // '#app'
    const res = document.querySelector(container)
    return res
  }
  return container
}
