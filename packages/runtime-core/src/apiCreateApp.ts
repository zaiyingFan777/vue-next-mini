import { createVNode } from 'packages/runtime-core/src/vnode'

/**
 * 创建 app 实例，这是一个闭包函数
 * 调用方式：
 * baseCreateRnederer执行后返回的对象
 * {
 *  render,
 *  hydrate,
 *  createApp: createAppAPI(render, hydrate)
 * }
 */
export function createAppAPI<HostElement>(render) {
  return function createApp(rootComponent, rootProps = null) {
    const app = {
      _component: rootComponent,
      _container: null,
      // 挂载方法
      // app.mount('#app')
      mount(rootContainer: HostElement): any {
        // 直接通过 createVNode 方法构建 vnode
        const vnode = createVNode(rootComponent, rootProps)
        // 通过 render 函数进行挂载
        render(vnode, rootContainer)
      }
    }

    return app
  }
}
