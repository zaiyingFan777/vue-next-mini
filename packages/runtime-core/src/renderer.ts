import { ShapeFlags } from 'packages/shared/src/shapeFlags'
import { Fragment, Comment, Text, isSameVNodeType } from './vnode'
import { EMPTY_OBJ, isString } from '@vue/shared'
import { normalizeVNode, renderComponentRoot } from './componentRenderUtils'
import { createComponentInstance, setupComponent } from './component'
import { queuePreFlushCb } from './scheduler'
import { ReactiveEffect } from 'packages/reactivity/src/effect'
import { createAppAPI } from 'packages/runtime-core/src/apiCreateApp'

// renderer 渲染器本身

/**
 * 渲染器配置对象
 */
export interface RendererOptions {
  /**
   * 为指定 element 的 prop 打补丁
   */
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
  /**
   * 为指定的 element 设置 text
   */
  setElementText(node: Element, text: string): void
  /**
   * 插入指定的 el 到 parent 中， anchor 表示插入的位置，即：锚点
   */
  insert(el, parent: Element, anchor?): void
  /**
   * 创建指定的 element
   */
  createElement(type: string)
  /**
   * 卸载指定 dom
   */
  remove(el): void
  /**
   * 创建 Text 节点
   */
  createText(text: string)
  /**
   * 设置 Text
   */
  setText(node, text): void
  /**
   * 设置 Comment
   */
  createComment(text: string)
}

/**
 * 对外暴漏的创建渲染器的方法
 */
export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options)
}

/**
 * 生成 renderer 渲染器
 * @param options 兼容性操作配置对象
 * @returns
 */
function baseCreateRenderer(options: RendererOptions): any {
  /**
   * 解构 options，获取所有的兼容性方法
   */
  const {
    insert: hostInsert,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    setElementText: hostSetElementText,
    remove: hostRemove,
    createText: hostCreateText,
    setText: hostSetText,
    createComment: hostCreateComment
  } = options

  /**
   * 卸载元素
   */
  const unmount = vnode => {
    hostRemove(vnode.el!)
  }

  /**
   * 组件的打补丁操作
   */
  const processComponent = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载
      mountComponent(newVNode, container, anchor)
    } else {
    }
  }

  /**
   * Element 的打补丁操作 (核心方法)
   */
  const processElement = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载操作
      mountElement(newVNode, container, anchor)
    } else {
      // 更新操作
      patchElement(oldVNode, newVNode)
    }
  }

  /**
   * Text 的打补丁操作
   */
  const processText = (oldVNode, newVNode, container, anchor) => {
    // 不存在旧的节点，则为 挂载 操作
    if (oldVNode == null) {
      // 生成节点
      newVNode.el = hostCreateText(newVNode.children as string)
      // 挂载
      hostInsert(newVNode.el, container, anchor)
    }
    // 存在旧的节点，则为 更新 操作
    else {
      const el = (newVNode.el = oldVNode.el!)
      if (newVNode.children !== oldVNode.children) {
        hostSetText(el, newVNode.children as string)
      }
    }
  }

  /**
   * Comment 的打补丁操作
   */
  const processCommentNode = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 生成节点
      newVNode.el = hostCreateComment((newVNode.children as string) || '')
      // 挂载
      hostInsert(newVNode.el, container, anchor)
    } else {
      // 无更新
      // there's no support for dynamic comments（动态注释不受支持）
      newVNode.el = oldVNode.el
    }
  }

  /**
   * Fragment 的打补丁操作
   * 对于 Fragment 它是一个包裹性质的容器，本身并不渲染，只渲染子节点。
   */
  const processFragment = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 因为 Fragment 本身并不渲染，所以它的渲染 仅渲染子节点
      mountChildren(newVNode.children, container, anchor)
    } else {
      // diff
      patchChildren(oldVNode, newVNode, container, anchor)
    }
  }

  /**
   * 挂载子节点（1.fragment mount时需要用到）
   * 循环 children，分别触发 patch 方法进行挂载
   * 因为此时的 children 是一个字符串，所以循环之后的每一个 child 都是一个字符
   * 把字符通过 normalizeVNode 加工之后，将得到一个 Text 节点 类型的 VNode
   * 交给 patch 进行渲染即可
   */
  const mountChildren = (children, container, anchor) => {
    // 处理 Cannot assign to read only property '0' of string 'xxx'
    if (isString(children)) {
      // children为字符串，就让字符串变为数组
      // hello world => ['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'd']
      children = children.split('')
    }
    // 循环 children 数组
    for (let i = 0; i < children.length; i++) {
      // 把字符通过 normalizeVNode 加工得到 Text 节点类型的 VNode
      const child = (children[i] = normalizeVNode(children[i]))
      patch(null, child, container, anchor)
    }
  }

  /**
   * Element 的挂载操作
   */
  const mountElement = (vnode, container, anchor) => {
    const { type, props, shapeFlag } = vnode

    // 创建 element (将创建的el添加到vnode.el属性上)
    const el = (vnode.el = hostCreateElement(type))

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 设置 文本子节点
      hostSetElementText(el, vnode.children as string)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 设置 Array 子节点
      mountChildren(vnode.children, el, anchor)
    }

    // 处理 props
    if (props) {
      // 遍历 props 对象
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }

    // 插入 el 到指定的位置
    hostInsert(el, container, anchor)
  }

  /**
   * 组件 的挂载操作
   */
  const mountComponent = (initialVNode, container, anchor) => {
    // 生成组件实例
    // vnode.component = 组件实例(instance)
    // 组件实例(instance).vnode = vnode
    initialVNode.component = createComponentInstance(initialVNode)
    // 浅拷贝，绑定到同一块内存空间
    const instance = initialVNode.component

    // 标准化组件实例数据
    setupComponent(instance)

    // 设置组件渲染
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  /**
   * 设置组件渲染
   */
  const setupRenderEffect = (instance, initialVNode, container, anchor) => {
    // 组件挂载和更新的方法
    // 挂载的时候执行 effect.run => effect.fn => componentUpdateFn执行，这里生成子树的时候会调用 component.render()函数
    // 然后会读取this.xxx，这时候当前的effect就会被收集到 targetMap中，然后触发依赖会执行 effect.scheduler，再执行 fn 重新渲染
    const componentUpdateFn = () => {
      // 当前处于 mounted 之前，即执行 挂载 逻辑
      if (!instance.isMounted) {
        // 获取 hook
        const { bm, m } = instance

        // 挂载前执行 beforeMount hook
        if (bm) {
          bm()
        }

        // 从 render 中获取需要渲染的内容
        // const component = {
        //   render() {
        //     return h('div', 'hello component')
        //   }
        // }
        // 上面render函数执行生成的vnode
        const subTree = (instance.subTree = renderComponentRoot(instance))

        // 通过 patch 对 subtree，进行打补丁。即：渲染组件
        patch(null, subTree, container, anchor)

        // 组件挂载后 执行 mounted hook
        if (m) {
          m()
        }

        // 把subTree根节点的 el（组件render真实渲染的el），作为组件vnode的el
        initialVNode.el = subTree.el
        // 修改标记位
        instance.isMounted = true
      } else {
        // 组件更新，这时候 instance还是挂载的时候的 instance，基于mount产生的vnode、instance进行的操作，因为 setter 触发effect.scheduler =>
        // effect.run => effect.fn => componentUpdateFn
        // 组件更新逻辑
        // bu、u为组件更新钩子
        // vnode为mount时 组件的vnode
        let { bu, u, next, vnode } = instance
        if (!next) {
          // 拿不到 next，就拿 vnode
          next = vnode
        }

        // 获取下一次的 subtree 的 vnode（更新data.xxx，重新执行render拿到instance.subTree）
        const nextTree = renderComponentRoot(instance)
        // 保存对应的 subtree，以便进行更新操作
        const prevTree = instance.subTree
        // 更新 subtree（vnode.instance.subtree也发生了改变）
        instance.subTree = nextTree

        // 通过 patch 进行更新操作（新老render返回的vnode进行patch）
        patch(prevTree, nextTree, container, anchor)

        // 更新 next （vnode.el = nextTree.el）、vnode的el
        next.el = nextTree.el
      }
    }

    // 创建包含 scheduler 的 effect 实例
    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queuePreFlushCb(update)
    ))

    // 生成 update 函数 (执行effect.run => componentUpdateFn)
    const update = (instance.update = () => effect.run())

    // 触发 update 函数，本质上触发的是 componentUpdateFn
    update()
  }

  /**
   * Element 的打补丁操作
   */
  const patchElement = (oldVNode, newVNode) => {
    // 获取指定的 el，并将 oldVNode.el赋值给 newVNode.el（#app下的div）
    // h('div', {
    //   class: 'test',
    //   id: 'test'
    // }, 'hello render')
    const el = (newVNode.el = oldVNode.el!)

    // 新旧 props
    const oldProps = oldVNode.props || EMPTY_OBJ
    const newProps = newVNode.props || EMPTY_OBJ

    // 更新子节点
    patchChildren(oldVNode, newVNode, el, null)

    // 更新 props
    patchProps(el, newVNode, oldProps, newProps)
  }

  /**
   * 为子节点打补丁
   */
  const patchChildren = (oldVNode, newVNode, container, anchor) => {
    // 旧节点的 children
    const c1 = oldVNode && oldVNode.children
    // 旧节点的 prevShapeFlag
    const prevShapeFlag = oldVNode ? oldVNode.shapeFlag : 0
    // 新节点的 children
    const c2 = newVNode && newVNode.children

    // 新节点的 shapeFlag
    const { shapeFlag } = newVNode

    // 新节点为 TEXT_CHILDREN (单节点diff[新的vnode.children为string])
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 旧节点为 ARRAY_CHILDREN
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // TODO: 卸载旧子节点
      }
      // 新旧子节点不同
      if (c2 !== c1) {
        // 挂载新节点的文本
        hostSetElementText(container, c2 as string)
      }
    }
    // 新节点不为 TEXT_CHILDREN
    else {
      // 旧子节点为 ARRAY_CHILDREN
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 新子节点也为 ARRAY_CHILDREN(多节点diff[新的vnode.children为数组])
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 新老子 vnode 都是数组，这里要进行 diff 运算
          patchKeyedChildren(c1, c2, container, anchor)
        }
        // 新子节点不为 ARRAY_CHILDREN（旧子节点为 ARRAY_CHILDREN），则直接卸载旧子节点
        else {
          // TODO: 卸载
        }
      }
      // 旧节点不为 ARRAY_CHILDREN
      else {
        // 旧子节点为 TEXT_CHILDREN
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 删除旧的文本
          hostSetElementText(container, '')
        }
        // 新子节点为 ARRAY_CHILDREN
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // TODO: 单独挂载新子节点操作
        }
      }
    }
  }

  /**
   * diff（四种操作：添加、删除、移动、打补丁）
   */
  const patchKeyedChildren = (
    oldChildren,
    newChildren,
    container,
    parentAnchor
  ) => {
    /**
     * 索引
     */
    let i = 0
    /**
     * 新的子节点的长度
     */
    const newChildrenLength = newChildren.length
    /**
     * 旧的子节点最大（最后一个）下标
     */
    let oldChildrenEnd = oldChildren.length - 1
    /**
     * 新的子节点最大（最后一个）下标
     */
    let newChildrenEnd = newChildrenLength - 1

    // 1.自前向后的 diff 对比。经过该循环之后，从前开始的相同 vnode 将被处理
    // sync from start：自前向后的对比
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[i]
      const newVNode = normalizeVNode(newChildren[i])
      // 如果 oldVNode 和 newVNode 被认为是同一个 vnode，则直接 patch 即可
      if (isSameVNodeType(oldVNode, newVNode)) {
        // key type 均相同，则进行 patch
        patch(oldVNode, newVNode, container, null)
      }
      // 如果不被认为是同一个 vnode，则直接跳出循环
      else {
        break
      }
      // 下标自增（每次处理成功，则会自增 i 标记，表示：自前向后已处理过的节点数量）
      i++
    }

    // 2.自后向前的 diff 对比。经过该循环之后，从后开始的相同 vnode 将被处理
    // sync from end：自后向前的对比
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[oldChildrenEnd]
      const newVNode = normalizeVNode(newChildren[newChildrenEnd])
      if (isSameVNodeType(oldVNode, newVNode)) {
        // key、type 相同，进行节点的更新 patch 操作
        patch(oldVNode, newVNode, container, null)
      } else {
        break
      }
      oldChildrenEnd--
      newChildrenEnd--
    }

    // 3.新节点多于旧节点的 diff 对比
    // common sequence + mount：新节点多于旧节点，需要挂载（重点就是找插入的锚点）
    // (a b)
    // (a b) c
    // i = 2, e1 = 1, e2 = 2
    // (a b)
    // c (a b)
    // i = 0, e1 = -1, e2 = 0
    if (i > oldChildrenEnd) {
      if (i <= newChildrenEnd) {
        // 情况1
        // (a b)
        // (a b) c
        // i = 2, e1 = 1, e2 = 2
        // nextPos: 3
        // 3 == newChildrenLength anchor: null
        // 情况2
        // (a b)
        // c (a b)
        // i = 0, e1 = -1, e2 = 0
        // nextPos: 1
        // 1 < 3 anchor: newChildren[nextPos].el 即 c (a b) 中的 a
        const nextPos = newChildrenEnd + 1
        // 寻找插入的锚点
        const anchor =
          nextPos < newChildrenLength ? newChildren[nextPos].el : parentAnchor
        // 将新增的插入
        while (i <= newChildrenEnd) {
          patch(null, normalizeVNode(newChildren[i]), container, anchor)
          i++
        }
      }
    }
    // 4.旧节点多于新节点
    // common sequence + unmount：旧节点多于新节点，需要卸载
    // (a b) c
    // (a b)
    // i = 2, e1 = 2, e2 = 1
    // a (b c)
    // (b c)
    // i = 0, e1 = 0, e2 = -1
    else if (i > newChildrenEnd) {
      while (i <= oldChildrenEnd) {
        unmount(oldChildren[i])
        i++
      }
    }
    // 5.乱序场景（最长递增子序列：贪心 + 二分查找，找到最长子序列下标，最长递增子序列的确定，可以帮助我们减少移动的次数）
    // unknown sequence：乱序
    // [i ... e1 + 1]: a b [c d e]   f g
    // [i ... e2 + 1]: a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5 （e1 oldChildrenEnd，e2 newChildrenEnd）
    else {
      // 例子
      // 解释 i，比如下面例子，i 为 2，因为 a b 已经被处理了
      // a b c d e   f g
      // a b e c d h f g

      // 旧子节点的开始索引：oldChildrenStart
      const oldStartIndex = i // 2
      // 新子节点的开始索引：newChildrenStart
      const newStartIndex = i // 2
      // 5.1 创建一个 <key（新节点的 key）:index（新节点的位置）> 的 Map 对象 keyToNewIndexMap。通过该对象可知：新的 child（根据 key 判断指定 child） 更新后的位置（根据对应的 index 判断）在哪里
      const keyToNewIndexMap = new Map() // 上例：{5: 2, 3: 3, 4: 4, 8: 5}
      // 通过循环为 keyToNewIndexMap 填充值（s2 = newChildrenStart; e2 = newChildrenEnd）
      for (i = newStartIndex; i <= newChildrenEnd; i++) {
        // 从 newChildren 中根据开始索引获取每一个 child（c2 = newChildren）
        const nextChild = normalizeVNode(newChildren[i])
        // child 必须存在 key（这也是为什么 v-for 必须要有 key 的原因）
        if (nextChild.key != null) {
          // 把 key 和 对应的索引，放到 keyToNewIndexMap 对象中
          keyToNewIndexMap.set(nextChild.key, i)
        }
      }

      // 5.2 循环 oldChildren ，并尝试进行 patch（打补丁）或 unmount（删除）旧节点
      // a b c d e   f g
      // a b e c d h f g
      // 上例经过5.2处理完为 c d e ，即patch了 c d e 无删除操作（没有要被删除的元素）
      // 经过5.2处理完后 moved为true，maxNewIndexSoFar为4 newIndexToOldIndexMap为[5,3,4,0]，patched为3
      let j // 代表old子序列->新的子序列的 最长递增子序列中 [1,2]从2 1，为了就是5.3中1 2这些元素（c d）不需要操作
      // 记录已经修复的新节点数量
      let patched = 0
      // 新节点待修补的数量 = newChildrenEnd - newChildrenStart + 1
      const toBePatched = newChildrenEnd - newStartIndex + 1 // 4
      // 标记位：节点是否需要移动
      let moved = false
      // 配合 moved 进行使用，它始终保存当前最大的 index 值
      let maxNewIndexSoFar = 0
      // 创建一个 Array 的对象，用来确定最长递增子序列。它的下标表示：《新节点的下标（newIndex），不计算已处理的节点。即：n-c 被认为是 0》，元素表示：《对应旧节点的下标（oldIndex），永远 +1》
      // 但是，需要特别注意的是：oldIndex 的值应该永远 +1 （ 因为 0 代表了特殊含义，他表示《新节点没有找到对应的旧节点，此时需要新增新节点》）。即：旧节点下标为 0， 但是记录时会被记录为 1
      // 上例经过处理后(e c d h)：newIndexToOldIndexMap: [5, 3, 4, 0] 注意老的Index+1操作，0代表了新增的元素
      const newIndexToOldIndexMap = new Array(toBePatched)
      // 遍历 toBePatched ，为 newIndexToOldIndexMap 进行初始化，初始化时，所有的元素为 0
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0 // newIndexToOldIndexMap 初始值：[0, 0, 0, 0]
      // 遍历 oldChildren（s1 = oldChildrenStart; e1 = oldChildrenEnd），获取旧节点，如果当前 已经处理的节点数量 > 待处理的节点数量，那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
      for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
        // c d e
        // 获取旧节点
        const prevChild = oldChildren[i]
        // 如果当前 已经处理的节点数量 > 待处理的节点数量，那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
        if (patched >= toBePatched) {
          // 所有的节点都已经更新完成，剩余的旧节点全部删除即可
          unmount(prevChild)
          continue
        }
        // 新节点需要存在的位置，需要根据旧节点来进行寻找（包含已处理的节点）
        let newIndex
        // 旧节点的 key 存在时
        if (prevChild.key != null) {
          // 根据旧节点的 key，从 keyToNewIndexMap 中可以获取到新节点对应的位置
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {
          // 旧节点的 key 不存在（无 key 节点）
          // 那么我们就遍历所有的新节点，找到《没有找到对应旧节点的新节点，并且该新节点可以和旧节点匹配》，如果能找到，那么 newIndex = 该新节点索引
          for (j = newStartIndex; j <= newChildrenEnd; j++) {
            // 找到《没有找到对应旧节点的新节点，并且该新节点可以和旧节点匹配》
            if (
              newIndexToOldIndexMap[j - newStartIndex] === 0 &&
              isSameVNodeType(prevChild, newChildren[j])
            ) {
              // 如果能找到，那么 newIndex = 该新节点索引
              newIndex = j
              break
            }
          }
        }
        // 最终没有找到新节点的索引，则证明：当前旧节点没有对应的新节点
        if (newIndex === undefined) {
          // 此时，直接删除即可
          unmount(prevChild)
        }
        // 没有进入 if，则表示：当前旧节点找到了对应的新节点，那么接下来就是要判断对于该新节点而言，是要 patch（打补丁）还是 move（移动）
        else {
          // 为 newIndexToOldIndexMap 填充值：下标表示：《新节点的下标（newIndex），不计算已处理的节点。即：n-e 被认为是 0》，元素表示：《对应旧节点的下标（oldIndex），永远 +1》
          // 因为 newIndex 包含已处理的节点，所以需要减去 s2（s2 = newChildrenStart）表示：不计算已处理的节点
          newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1
          // maxNewIndexSoFar 会存储当前最大的 newIndex，它应该是一个递增的，如果没有递增，则证明有节点需要移动
          if (newIndex >= maxNewIndexSoFar) {
            // 持续递增
            maxNewIndexSoFar = newIndex // 3 4
          } else {
            // 没有递增，则需要移动，moved = true 本例子： e newIndex为2，需要移动 因为e本身在后面，新的vnode产生后在前面了 < maxNewIndexSoFar，所以它需要移动
            moved = true
          }
          // 打补丁
          patch(prevChild, newChildren[newIndex], container, null)
          // 自增已处理的节点数量
          patched++
        }
      }

      // 5.3 针对移动和挂载的处理
      // 仅当节点需要移动的时候，我们才需要生成最长递增子序列，否则只需要有一个空数组即可
      // 找到新老子序列中最长公公子序列下表集合newIndexToOldIndexMap，这个集合就是老元素在新元素的下标，倒序碰到这些新下表就不用动
      // 为何要这么存（newIndexToOldIndexMap）？
      // a b c d e   f g
      // a b e c d h f g  从 c d e 到 e c d h 我们需要在新序列中找到老序列的下标，然后尽可能地少操作，那么 c d e 到 e c d h 的最长递增子序列就是[1,2] 这样 从老到新 c d不用动 只需要将e移动即可
      // 为了最少的变动，从old子序列到新的子序列中 求得最长递增子序列。这样尽可能减少节点的移动。
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : [] // [5,3,4,0] => [1,2]，也就是 c d不动
      // j >= 0 表示：初始值为 最长递增子序列的最后下标
      // j < 0 表示：《不存在》最长递增子序列。
      j = increasingNewIndexSequence.length - 1 // 1 increasingNewIndexSequence[1] d元素 2，c元素 1 这些元素不需要操作
      // 倒序循环，以便我们可以使用最后修补的节点作为锚点
      // 从后往前遍历是为了方便找到锚点插入移动
      for (i = toBePatched - 1; i >= 0; i--) {
        // toBePatched: 4，i 从3开始
        // nextIndex（需要更新的新节点下标） = newChildrenStart + i
        const nextIndex = newStartIndex + i // e c d h 下标为 2 3 4 5 nextIndex从5开始
        // 根据 nextIndex 拿到要处理的 新节点
        const nextChild = newChildren[nextIndex]
        // 获取锚点（是否超过了最长长度）
        const anchor =
          nextIndex + 1 < newChildrenLength
            ? newChildren[nextIndex + 1].el
            : parentAnchor
        // 如果 newIndexToOldIndexMap 中保存的 value = 0，则表示：新节点没有用对应的旧节点，此时需要挂载新节点
        if (newIndexToOldIndexMap[i] === 0) {
          // 挂载新节点
          patch(null, nextChild, container, anchor)
        }
        // moved 为 true，表示需要移动
        else if (moved) {
          // j < 0 表示：不存在 最长递增子序列
          // i !== increasingNewIndexSequence[j] 表示：当前节点不在最后位置
          // 那么此时就需要 move （移动）
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor)
          } else {
            // j 随着循环递减
            j--
          }
        }
      }
    }
  }

  /**
   * 移动节点到指定位置
   */
  const move = (vnode, container, anchor) => {
    const { el } = vnode
    hostInsert(el!, container, anchor)
  }

  /**
   * 为 props 打补丁
   * @param vnode newVnode
   */
  const patchProps = (el: Element, vnode, oldProps, newProps) => {
    // 新旧 props 不相同时才进行处理
    if (oldProps !== newProps) {
      // 遍历新的 props，依次触发 hostPatchProp，赋值新属性
      for (const key in newProps) {
        // newVNode的属性
        const next = newProps[key]
        // oldVNode的属性
        const prev = oldProps[key]
        if (next !== prev) {
          hostPatchProp(el, key, prev, next)
        }
      }
      // 存在旧的 props 时
      if (oldProps !== EMPTY_OBJ) {
        // 遍历旧的 props，依次触发 hostPatchProp，删除不存在于新 props 中的旧属性
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null)
          }
        }
      }
    }
  }

  // 打补丁 patch
  const patch = (oldVNode, newVNode, container, anchor = null) => {
    // 新老虚拟dom一致，不需要任何操作
    if (oldVNode === newVNode) {
      return
    }

    /**
     * 判断是否为相同类型节点
     */
    if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
      // 如果不是相同节点，先删除，后挂载
      unmount(oldVNode)
      // 重置oldVNode，这样进入processElement方法时，就进入挂载流程
      oldVNode = null
    }

    const { type, shapeFlag } = newVNode
    // VNode类型
    switch (type) {
      case Text:
        // Text
        processText(oldVNode, newVNode, container, anchor)
        break
      case Comment:
        // Comment
        processCommentNode(oldVNode, newVNode, container, anchor)
        break
      case Fragment:
        // Fragment
        processFragment(oldVNode, newVNode, container, anchor)
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // Element
          processElement(oldVNode, newVNode, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 组件
          processComponent(oldVNode, newVNode, container, anchor)
        }
    }
  }

  /**
   * 渲染函数
   */
  const render = (vnode, container) => {
    // 不存在 vnode 时
    if (vnode == null) {
      // 但是存在旧的 vnode ，之前挂载了元素，现在vnode为null，删除之前挂载的元素
      if (container._vnode) {
        // 直接执行删除操作
        unmount(container._vnode)
      }
    } else {
      // 打补丁（包括了挂载和更新）
      // oldVNode、newVNode、container
      patch(container._vnode || null, vnode, container)
    }

    // 最后构建好的vnode挂载到container._vnode下
    container._vnode = vnode
  }

  return {
    render,
    createApp: createAppAPI(render)
  }
}

/**
 * 获取最长递增子序列下标
 * 维基百科：https://en.wikipedia.org/wiki/Longest_increasing_subsequence
 * 百度百科：https://baike.baidu.com/item/%E6%9C%80%E9%95%BF%E9%80%92%E5%A2%9E%E5%AD%90%E5%BA%8F%E5%88%97/22828111
 */
function getSequence(arr: number[]) {
  // 获取一个数组浅拷贝。注意 p 的元素改变并不会影响 arr
  // 如果数组的元素是基本类型数据 则修改p[i]并不会影响arr，如果数组元素是引用类型数据，则修改p[i]会修改arr[i]
  // p 是一个最终的[回溯数组]，它会在最终的 result 回溯中被使用
  // 它会在每次 result 发生变化时，记录 result 更新前最后一个索引的值
  const p = arr.slice()
  // 定义返回值（最长递增子序列下标），因为下标从 0 开始，所以它的初始值为 0
  const result = [0]
  let i, j, u, v, c
  // 当前数组的长度
  const len = arr.length
  // 对数组中所有的元素进行 for 循环处理，i = 下标
  for (i = 0; i < len; i++) {
    // 根据下标获取当前对应元素
    const arrI = arr[i]
    // 0 代表新建的元素，因此不需要处理
    if (arrI !== 0) {
      // 获取 result 中的最后一个元素，即：当前 result 中保存的最大值的下标
      j = result[result.length - 1]
      // arr[j] = 当前 result 中所保存的最大值
      // arrI = 当前值
      // 如果 arr[j] < arrI 。那么就证明，当前存在更大的序列，那么该下标就需要被放入到 result 的最后位置
      if (arr[j] < arrI) {
        p[i] = j
        // 把当前的下标 i 放入到 result 的最后位置
        result.push(i)
        continue
      }
      // 不满足 arr[j] < arrI 的条件，就证明目前 result 中的最后位置保存着更大的数值的下标。
      // 但是这个下标并不一定是一个递增的序列，比如： [1, 3] 和 [1, 2]
      // 所以我们还需要确定当前的序列是递增的。
      // 计算方式就是通过：二分查找来进行的

      // 初始下标
      u = 0
      // 最终下标
      v = result.length - 1
      // 只有初始下标 < 最终下标时才需要计算
      while (u < v) {
        // (u + v) 转化为 32 位 2 进制，右移 1 位 === 取中间位置（向下取整）例如：8 >> 1 = 4;  9 >> 1 = 4; 5 >> 1 = 2
        // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Right_shift
        // c 表示中间位。即：初始下标 + 最终下标 / 2 （向下取整）
        c = (u + v) >> 1
        // 从 result 中根据 c（中间位），取出中间位的下标。
        // 然后利用中间位的下标，从 arr 中取出对应的值。
        // 即：arr[result[c]] = result 中间位的值
        // 如果：result 中间位的值 < arrI，则 u（初始下标）= 中间位 + 1。即：从中间向右移动一位，作为初始下标。 （下次直接从中间开始，往后计算即可）
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          // 否则，则 v（最终下标） = 中间位。即：下次直接从 0 开始，计算到中间位置 即可。
          v = c
        }
      }
      // 最终，经过 while 的二分运算可以计算出：目标下标位 u
      // 利用 u 从 result 中获取下标，然后拿到 arr 中对应的值：arr[result[u]]
      // 如果：arr[result[u]] > arrI 的，则证明当前  result 中存在的下标 《不是》 递增序列，则需要进行替换
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        // 进行替换，替换为递增序列
        result[u] = i
      }
    }
  }
  // 重新定义 u。此时：u = result 的长度
  u = result.length
  // 重新定义 v。此时 v = result 的最后一个元素
  v = result[u - 1]
  // 回溯
  // 自后向前处理 result，利用 p 中所保存的索引值，进行最后的一次回溯
  // arr [3,2,8,9,5,6,7,11,15,4]
  //   p [x,x,1,2,1,4,5, 6, 7,1]
  // 这里arr最后一个4的下标会进入result中[1,9,5,6,7,8]影响了结果，然后我们通过p来进行回溯，最后得到 result为 [1,4,5,6,7,8] 即 [2,5,6,7,11,15]
  // u: 6 v: 8
  // while 循环
  // 1.result[5] = 8 res: [1,9,5,6,7,8] v = p[v] = 7
  // 2.result[4] = 7 res: [1,9,5,6,7,8] v = p[v] = 6
  // 3.result[3] = 6 res: [1,9,5,6,7,8] v = p[v] = 5
  // 4.result[2] = 5 res: [1,9,5,6,7,8] v = p[v] = 4
  // 5.result[1] = 4 res: [1,4,5,6,7,8] v = p[v] = 1
  // 6.result[0] = 1 res: [1,4,5,6,7,8] v = p[v] = x
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
