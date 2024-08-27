import { reactive } from '@vue/reactivity'
import { isFunction, isObject } from '@vue/shared'
import { onBeforeMount, onMounted } from './apiLifecycle'

let uid = 0

/**
 * 生命周期钩子
 */
export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm'
}

/**
 * 创建组件实例
 */
export function createComponentInstance(vnode) {
  // 组件的vnode.type就是组件配置对象本身(下例子就是component这个对象)
  // const component = {
  //   render() {
  //     return h('div', 'hello component')
  //   }
  // }
  const type = vnode.type

  const instance = {
    uid: uid++, // 唯一标记
    vnode, // 虚拟节点
    type, // 组件类型
    subTree: null, // render 函数的返回值
    effect: null, // ReactiveEffect 实例
    update: null, // update 函数，触发 effect.run
    render: null, // 组件内的 render 函数（component对象里的render函数）
    // 生命周期相关
    isMounted: false, // 是否挂载
    bc: null, // beforeCreate
    c: null, // created
    bm: null, // beforeMount
    m: null // mounted
  }

  return instance
}

/**
 * 规范化组件实例数据
 */
export function setupComponent(instance) {
  // 为 render 赋值
  const setupResult = setupStatefulComponent(instance)
  return setupResult
}

function setupStatefulComponent(instance) {
  const Component = instance.type

  const { setup } = Component

  // 存在 setup，则直接获取 setup 函数的返回值即可
  if (setup) {
    // composition api
    // const component = {
    //   setup() {
    //     const obj = reactive({
    //       name: '张三'
    //     })

    //     return () => h('div', obj.name)
    //   }
    // }
    // 得到 render 函数 () => h('div', obj.name)
    // 因为像上文那样，可以直接拿到 obj.name，改变不改变 this 都无所谓了
    const setupResult = setup()
    // 赋值 render
    handleSetupResult(instance, setupResult)
  } else {
    // 获取组件实例
    // options api（改变 this 指向 reactive(data)）
    finishComponentSetup(instance)
  }
}

export function handleSetupResult(instance, setupResult) {
  // 存在 setupResult，并且它是一个函数，则 setupResult 就是需要渲染的 render
  if (isFunction(setupResult)) {
    instance.render = setupResult
  }
  finishComponentSetup(instance)
}

/**
 * 给组件实例 instance 赋值 render（vnode中type对象的render函数） 函数
 */
export function finishComponentSetup(instance) {
  const Component = instance.type

  // 组件不存在 render 时，才需要重新赋值
  if (!instance.render) {
    instance.render = Component.render
  }

  // 改变 options 中 this 的指向
  applyOptions(instance)
}

/**
 * 改变 options 中 this 的指向
 */
function applyOptions(instance: any) {
  // const component = {
  //   data() {
  //     return {
  //       msg: 'hello component'
  //     }
  //   },
  //   render() {
  //     return h('div', this.msg)
  //   }
  // }
  const {
    data: dataOptions,
    beforeCreate,
    created,
    beforeMount,
    mounted
  } = instance.type

  // beforeCreate，在初始化数据前
  if (beforeCreate) {
    callHook(beforeCreate, instance.data)
  }

  // 存在 data 选项时
  if (dataOptions) {
    // 触发 dataOptions 函数，拿到 data 对象
    const data = dataOptions()
    // 如果拿到的 data 是一个对象
    if (isObject(data)) {
      // 则把 data 包装成 reactive 的响应性数据，赋值给 instance
      instance.data = reactive(data)
    }
  }

  // created，在初始化数据完毕后
  if (created) {
    callHook(created, instance.data)
  }

  // 将 beforeMount、mounted 等钩子函数注册到组件 instance 上
  // hook 用户传进来的 beforeMount、mounted
  // 并在注册的时候为 hook 修改 this 指向到 instance.data
  function registerLifecycleHook(register: Function, hook?: Function) {
    register(hook?.bind(instance.data), instance)
  }

  // 注册 hooks
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
}

/**
 * 执行钩子的函数
 */
function callHook(hook: Function, proxy) {
  // 未绑定 reactive 后的 data
  // hook()
  // 绑定 reactive 后的 data，改变 hook 内的 this 指针，并执行 hook
  hook.bind(proxy)()
}
