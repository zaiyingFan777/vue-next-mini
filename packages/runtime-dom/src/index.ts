import { createRenderer } from '@vue/runtime-core'
import { extend } from '@vue/shared'
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
