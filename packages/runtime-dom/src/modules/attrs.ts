/**
 * 通过 setAttribute 设置属性
 * @param value newValue
 */
export function patchAttr(el: any, key: string, value: any) {
  if (value == null) {
    // value为null，移除key属性
    el.removeAttribute(key)
  } else {
    el.setAttribute(key, value)
  }
}
