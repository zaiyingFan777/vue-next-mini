import { extend } from '@vue/shared'
import { baseParse } from './parse'
import { transform } from './transform'
import { transformElement } from './transforms/transformElement'
import { transformText } from './transforms/transformText'
import { generate } from './codegen'

export function baseCompile(template: string, options = {}) {
  // 1.生成ast
  const ast = baseParse(template)
  console.log(ast, '第一步 ast 结果')

  // 2.ast转为javascript ast
  transform(
    ast,
    extend(options, {
      nodeTransforms: [transformElement, transformText]
    })
  )
  console.log(ast, '第二步 js ast 结果')
  // 3.将javascript ast转为render函数
  return generate(ast)
}
