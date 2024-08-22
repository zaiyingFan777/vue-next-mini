// 封装 props 操作

import { isOn } from '@vue/shared'
import { patchClass } from './modules/class'
import { patchDOMProp } from './modules/props'
import { patchAttr } from './modules/attrs'
import { patchStyle } from './modules/style'
import { patchEvent } from './modules/events'

/**
 * 为 prop 进行打补丁操作
 */
export const patchProp = (el, key, prevValue, nextValue) => {
  if (key === 'class') {
    patchClass(el, nextValue)
  } else if (key === 'style') {
    // style
    patchStyle(el, prevValue, nextValue)
  } else if (isOn(key)) {
    // event
    patchEvent(el, key, prevValue, nextValue)
  } else if (shouldSetAsProp(el, key)) {
    // 通过 DOM Properties指定 (性能高于Html Attributes，或只能通过 Html Attributes修改的【比如text-area的type】，基本都用dom)
    patchDOMProp(el, key, nextValue)
  } else {
    // 其他属性(Html Attributes)
    patchAttr(el, key, nextValue)
  }
}

/**
 * 判断指定元素的指定属性是否可以通过 DOM Properties 指定
 */
function shouldSetAsProp(el: Element, key: string) {
  // #1787，#2840 表单元素的表单属性是只读的，必须设置为属性 attribute
  if (key === 'form') {
    return false
  }

  // #1526 <input list> 必须设置为属性 attribute
  if (key === 'list' && el.tagName === 'INPUT') {
    return false
  }

  // #2766 <textarea type> 必须设置为属性 attribute
  if (key === 'type' && el.tagName === 'TEXTAREA') {
    return false
  }

  // dom形式获取属性是否在el中
  return key in el
}
