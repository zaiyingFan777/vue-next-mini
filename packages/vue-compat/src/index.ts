import { compile } from '@vue/compiler-dom'
import { registerRuntimeCompiler } from 'packages/runtime-core/src/component'

/**
 * 将 code 字符串 转为 函数
 * @param template
 * @param options
 */
function compileToFunction(template, options?) {
  const { code } = compile(template, options)

  const render = new Function(code)()

  console.log('渲染函数：', render.toString())

  return render
}

/**
 * 注册 compiler
 */
registerRuntimeCompiler(compileToFunction)

export { compileToFunction as compile }
