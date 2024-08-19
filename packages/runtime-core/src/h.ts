import { isArray, isObject } from '@vue/shared'
import { createVNode, isVNode, VNode } from './vnode'

export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  // 获取用户传递的参数数量
  const l = arguments.length
  // 如果用户只传递了两个参数，那么证明第二个参数可能是props 也可能是children
  if (l === 2) {
    // 如果 第二个参数是对象，但不是数组。则第二个参数只有两种可能性：1. VNode 2.普通的props
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // 如果是VNode，则第二个参数代表了children
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren])
      }
      // 如果不是VNode，则第二个参数代表了 props
      // 对象但不是数组也不是vnode只能是props
      return createVNode(type, propsOrChildren, null)
    }
    // 如果第二个参数不是单纯的 object，则 第二个参数代表了 children
    // 第二个参数可能就是一个字符串或者数字，那就作为children
    else {
      return createVNode(type, null, propsOrChildren)
    }
  }
  // 如果用户传递了三个或以上的参数，那么证明第二个参数一定代表了 props
  else {
    // 如果参数在三个以上，则从第二个参数开始，把后续所有参数都作为children
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    }
    // 如果传递的参数只有三个，则children是单纯的children
    else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    // 触发createVNode方法，创建VNode实例
    return createVNode(type, propsOrChildren, children)
  }
}
