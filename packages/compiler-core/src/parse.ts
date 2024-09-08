import { ElementTypes, NodeTypes } from './ast'

/**
 * 标签类型，包含：开始和结束
 */
const enum TagType {
  Start,
  End
}

/**
 * 解析器上下文
 */
export interface ParserContext {
  // 模板数据源
  source: string
}

/**
 * 创建解析器上下文
 */
function createParserContext(content: string): ParserContext {
  // 合成 context 上下文对象
  return {
    source: content
  }
}

/**
 * 创建 ast 的根节点
 */
export function createRoot(children) {
  return {
    type: NodeTypes.ROOT,
    children,
    loc: {}
  }
}

/**
 * 基础的 parse 方法，生成 AST
 * 生成 ast 对象
 * 1.构建 parse 方法，生成 context 实例
 * 2.构建 parseChildren ，处理所有子节点（最复杂）
 * 2.1构建有限自动状态机解析模板
 * 2.2扫描 token 生成 AST 结构
 * 3.生成 AST，构建测试
 * @param content tempalte 模板
 * @returns
 */
export function baseParse(content: string) {
  // 1.创建 parser 对象，为解析器的上下的上下文对象
  const context = createParserContext(content)
  console.log(context, '上下文对象')

  // 2.构建 parseChildren方法，处理所有的子节点
  const children = parseChildren(context, [])
  console.log(children, '构建好的children的ast')

  // 3.生成 AST
  return createRoot(children)
}

/**
 * 解析子节点
 * @param context 上下文对象
 * @param mode 文本模型
 * @param ancestors 祖先节点
 * @returns
 */
function parseChildren(context: ParserContext, ancestors) {
  // 存放所有的 node 节点数据的数组
  const nodes = []

  /**
   * 循环解析所有 node 节点，可以理解为对 token 的处理。
   * 例如：<div>hello world</div>，此时的处理顺序为：
   * 1.<div
   * 2.>
   * 3.hello world
   * 4.</
   * 5.div>
   * 解析 template 模板
   * 当前不为结束标签
   */
  while (!isEnd(context, ancestors)) {
    const s = context.source

    let node

    if (startsWith(s, '{{')) {
      // TODO: 模板语法 {{ state }}
    }
    // < 意味着一个标签的开始
    else if (s[0] === '<') {
      // 以 < 开始，后面跟 a-z，表示，这是一个标签的开始
      if (/[a-z]/i.test(s[1])) {
        // 此时要处理 Element
        // 标签的开始 <div，因此这里要处理标签
        node = parseElement(context, ancestors)
      }
    }

    // node不存在意味着上面的两个 if 都没有进入，那么我们就认为此时的 token 为文本节点
    if (!node) {
      // 当前s不为模板语法、标签的开始，此时node只可能为文本节点
      // hello world</div>
      node = parseText(context)
    }

    // 将处理好的 node 放到 nodes里
    pushNode(nodes, node)
  }

  return nodes
}

/**
 * 解析 Element 元素。例如：<div>
 */
function parseElement(context: ParserContext, ancestors) {
  // -- 先处理开始标签 --
  // 1.解析 element 的开始标签
  const element = parseTag(context, TagType.Start)

  // -- 处理子节点 --
  // <div>hello world</div>
  // 上面处理好了<div>开始标签，然后将处理的结果：
  // {
  //   type: 1,
  //   tag: 'div',
  //   tagType: 0,
  //   props: [],
  //   children: []
  // } 放到 ancestors数组中，然后接着处理 hello world
  ancestors.push(element)
  // 2.处理children(hello world)
  // !!!递归触发 parseChildren
  const children = parseChildren(context, ancestors)
  // 递归下降算法（ancestors就为栈，比如<div>hello world</div> 他先存的就是<div>相关信息，这层处理完毕后，再弹出div）
  // 栈：[root, div] 处理 hello world ，处理结束后，将div标签，从ancestors中移除
  // 处理完children，将<div>父级标签，从ancestors中移除
  ancestors.pop()

  // 为了子节点赋值
  element.children = children

  // -- 最后处理结束标签 --
  // 3.hello world 处理完判断是否为结束标签
  if (startsWithEndTagOpen(context.source, element.tag)) {
    // 如果是结束标签的开始 </div>
    // 处理</div>
    parseTag(context, TagType.End)
  }

  return element
}

/**
 * 处理 element 标签（解析标签）
 * @param context 上下文对象
 * @param type
 */
function parseTag(context: ParserContext, type: TagType): any {
  // -- 处理标签开始部分 ——-

  // 1.解析标签（通过正则获取标签名）
  // /^<\/?([a-z][^\r\n\t\f />]*)/i.exec('<div>hello world</div>')
  // => ["<div", "div", groups: undefined, index: 0, input: "<div>hello world</div>"]
  const match: any = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source)
  // 标签名字 div
  const tag = match[1]

  // 2.移动游标（对模板进行解析处理）
  // match[0]: <div
  // match[0].length(4)，'<div>hello world</div>'.slice(4) => '>hello world</div>'
  advanceBy(context, match[0].length)

  // -- 处理标签结束部分 --
  // 3.判断是否为自闭和标签 例如：<img/>
  // <div> 处理 >
  // '>hello world</div>'.slice(1) => 'hello world</div>'
  let isSelefClosing = startsWith(context.source, '/>')
  // 《继续》对模板进行解析处理，是自动标签则处理两个字符 />，不是则处理一个字符 >
  // 如果是自闭和标签，则右移2位，如果非自闭和标签，则右移1位
  advanceBy(context, isSelefClosing ? 2 : 1)

  // 1、2、3 总结：从'<div>hello world</div>' => 'hello world</div>'

  // 标签类型
  let tagType = ElementTypes.ELEMENT

  return {
    // 节点类型
    // type: 1
    type: NodeTypes.ELEMENT,
    // tag: 'div'
    tag,
    // Element标签类型: 0
    tagType,
    // 属性，目前我们没有做任何处理。但是需要添加上，否则，生成的 ast 放到 vue 源码中会抛出错误
    props: [],
    children: []
  }
}

/**
 * 解析文本
 * @param context
 * @returns
 */
function parseText(context: ParserContext) {
  /**
   * 定义普通文本结束的标记
   * 例如：hello world</div>，那么文本结束的标记就是 <
   * ps: 这也意味着如果你渲染了一个 <div>hel<o</div>的标签，那么你将得到一个错误
   */
  // 白名单（普通文本的结束，如果我们的文本遇到<或者{{就会结束）
  const endTokens = ['<', '{{']

  // hello world</div> 这里肯定不准确，拿到的endIndex，因此需要我们修正
  // endIndex: 17
  // 最终得到普通文本结束的下标
  let endIndex = context.source.length

  // 计算精准的 endIndex，计算的逻辑为：从 context.source 中分别获取'<'，'{{'的下标，取最小值为 endIndex
  for (let i = 0; i < endTokens.length; i++) {
    // 从索引1开始（跳过索引为0的元素）向后搜索第一个<或者{{
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      // 修正 endIndex hello world</div> => 11
      endIndex = index
    }
  }

  // 截取文本，并移动游标到</div>
  const content = parseTextData(context, endIndex)

  // hello world
  return {
    type: NodeTypes.TEXT,
    content
  }
}

/**
 * 从指定位置（length）获取给定长度的文本数据。
 * length: endIndex
 * hello world</div>.slice(0, 11) => hello world
 * @param context
 * @param length
 * @returns
 */
function parseTextData(context: ParserContext, length: number) {
  // 获取指定的文本数据
  const rawText = context.source.slice(0, length)

  // 《继续》对模板进行解析处理
  // 继续游标右移动 => 'hello world</div>'.slice(11) => '</div>'
  advanceBy(context, length)
  // 返回获取到的文本
  return rawText
}

/**
 * nodes.push(node)
 * @param nodes
 * @param node
 */
function pushNode(nodes, node) {
  nodes.push(node)
}

/**
 * 判断当前的标签是否是结束标签，如果不是结束标签返回false，是结束标签返回true
 * 判断是否为结束节点
 * @param context 上下文
 * @param ancestors 祖先节点
 */
function isEnd(context: ParserContext, ancestors) {
  // <div>hello world</div>
  const s = context.source

  // 解析是否为结束标签
  if (startsWith(s, '</')) {
    // 当前是结束标签
    // 比如<div>hello world</div> 解析到</div>
    // 这时候ancestors栈：[{children: [], props: [], tag: "div", tagType: 0, type: 1}] 我们去栈里找 是否能匹配到开头的<div>找到了说明
    // 我们处理了这一轮的标签<div>hello world</div>
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        // 当前为结束标签的开始：</
        return true
      }
    }
  }

  // !'xxx' => false
  return !s
}

/**
 * 判断当前是否为《标签结束的开始》。比如 </div> 就是 div 标签结束的开始
 * @param source 模板。例如：</div>
 * @param tag 标签。例如：div
 * @returns
 */
function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    // <div></div>
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}

/**
 * 是否以指定文本开头
 */
function startsWith(source: string, searchStr: string): boolean {
  return source.startsWith(searchStr)
}

/**
 * 游标右移
 * 前进一步。多次调用，每次调用都会处理一部分的模板内容
 * 以 <div>hello world</div> 为例
 * 1. <div
 * 2. >
 * 3. hello world
 * 4. </div
 * 5. >
 * @param context
 * @param num
 */
function advanceBy(context: ParserContext, numberOfCharacters: number) {
  // template 模板源
  const { source } = context
  // 去除开始部分的无效数据
  // source: <div>hello world</div>，numberOfCharacters: 4
  // >hello world</div>
  context.source = source.slice(numberOfCharacters)
}
