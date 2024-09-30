interface Props {
  containerId: string;
  contentId: string;
  height: string;
  columns?: number;
  onNavigateOffFinalPage?: () => void | Promise<void>;
}

type BookStateNode = {
  node: Node;
} & (
  | {
      splitWithFollowingNode?: false;
      originalNodeBeforeSplit?: never;
    }
  | {
      splitWithFollowingNode: true;
      originalNodeBeforeSplit: Node;
    }
);

class BookState {
  public pastNodes: BookStateNode[];
  public remainingNodes: BookStateNode[];
  public currentNodes: BookStateNode[];

  constructor(contentNodes: Node[], startOnNode?: Node) {
    this.currentNodes = [];

    if (startOnNode == null) {
      this.pastNodes = [];
      this.remainingNodes = contentNodes.map((node) => ({ node }));
    } else {
      const indexOfStart = contentNodes.indexOf(startOnNode);
      if (indexOfStart === -1) {
        throw Error("startOnNode not in contentNodes");
      }
      this.pastNodes = contentNodes.slice(0, indexOfStart).map((node) => ({ node }));
      this.remainingNodes = contentNodes.slice(indexOfStart).map((node) => ({ node }));
    }
  }

  popNextNode(): BookStateNode | undefined {
    return this.remainingNodes.shift();
  }

  unPopNextNode(node: BookStateNode) {
    this.remainingNodes.unshift(node);
  }

  popNextNodeBackwards(): BookStateNode | undefined {
    return this.pastNodes.pop();
  }

  unPopNextNodeBackwards(node: BookStateNode) {
    this.pastNodes.push(node);
  }

  addCurrentNode(node: BookStateNode) {
    this.currentNodes.push(node);
  }

  addCurrentNodeBackwards(node: BookStateNode) {
    this.currentNodes.unshift(node);
  }

  fistVisibleNode(): Node | undefined {
    return this.currentNodes[0].node;
  }

  turnPage() {
    this.pastNodes = [...this.pastNodes, ...this.currentNodes];
    this.currentNodes = [];
    this.rejoinSplitNodes();
  }

  turnPageBackwards() {
    this.remainingNodes = [...this.currentNodes, ...this.remainingNodes];
    this.currentNodes = [];
    this.rejoinSplitNodes();
  }

  lastPage() {
    return this.remainingNodes.length === 0;
  }

  firstPage() {
    return this.pastNodes.length === 0;
  }

  addSplitNodeForward(toCurrent: Node, toRemaining: Node, original: Node) {
    this.currentNodes.push({
      node: toCurrent,
      splitWithFollowingNode: true,
      originalNodeBeforeSplit: original,
    });
    this.remainingNodes.unshift({ node: toRemaining });
  }

  addSplitNodeBackwards(toPast: Node, toCurrent: Node, original: Node) {
    this.currentNodes.unshift({ node: toCurrent });
    this.pastNodes.push({
      node: toPast,
      splitWithFollowingNode: true,
      originalNodeBeforeSplit: original,
    });
  }

  private rejoinSplitNodes() {
    for (const arr of [this.pastNodes, this.remainingNodes]) {
      while (true) {
        const splitIndex = arr.findIndex((node) => node.splitWithFollowingNode);
        if (splitIndex === -1) {
          break;
        }

        if (splitIndex + 1 < arr.length) {
          arr.splice(splitIndex + 1, 1);
          arr[splitIndex] = { node: arr[splitIndex].originalNodeBeforeSplit };
        } else {
          break;
        }
      }
    }
  }
}

function createBookView({
  containerId,
  contentId,
  height,
  columns = 2,
  onNavigateOffFinalPage = () => {},
}: Props) {
  const container = document.getElementById(containerId);
  const content = document.getElementById(contentId);

  const bookDiv = document.createElement("div");
  container.appendChild(bookDiv);

  content.style.display = "none";
  bookDiv.style.height = height;
  bookDiv.style.columnCount = columns + "";
  bookDiv.style.columnGap = "1rem";

  // const originalContentStyle = structuredClone(content.style);
  // const originalContainerStyle = structuredClone(container.style);

  if (container == null) {
    throw Error("Could not find container with ID " + containerId);
  }

  if (content == null) {
    throw Error("Could not find content with ID " + contentId);
  }

  if (columns < 1) {
    throw Error("Invalid column count " + columns);
  }

  (() => {
    const children = container.children;
    if (children.length != 1 && children[0] != content) {
      throw Error("Expecting content to be a direct and only child of container");
    }
  })();

  const bookViewState = new BookState(Array.from(content.children));

  function layoutContent() {
    let bookStateNode: BookStateNode | undefined;
    while ((bookStateNode = bookViewState.popNextNode()) != undefined) {
      const clonedNode = bookStateNode.node.cloneNode(true) as HTMLElement;
      bookDiv.appendChild(clonedNode);

      if (overflowsParent(bookDiv, clonedNode)) {
        clonedNode.remove();
        const splitNodeInserted = tryPutSplitNode(bookStateNode.node as HTMLElement);
        if (!splitNodeInserted) {
          bookViewState.unPopNextNode(bookStateNode);
        }
        return;
      }

      bookViewState.addCurrentNode(bookStateNode);
    }
  }

  function tryPutSplitNode(node: HTMLElement): boolean {
    const result: [Node, Node] | undefined = binarySearchSplitChild({
      child: node,
      reverse: false,
      check: ([[nBefore], [nPlusOneBefore]]): "left" | "right" | "done" => {
        bookDiv.append(nBefore);
        const nBeforeOverflows = overflowsParent(bookDiv, nBefore);
        nBefore.remove();

        if (nBeforeOverflows) {
          return "left";
        }

        bookDiv.append(nPlusOneBefore);
        const nPlusOneBeforeOverflows = overflowsParent(bookDiv, nPlusOneBefore);
        nPlusOneBefore.remove();

        if (nPlusOneBeforeOverflows) {
          return "done";
        } else {
          return "right";
        }
      },
    });

    if (result == undefined) {
      return false;
    } else {
      const [before, after] = result;
      bookViewState.addSplitNodeForward(before, after, node);
      bookDiv.append(before);
      return true;
    }
  }

  function layoutContentBackwards() {
    let bookStateNode: BookStateNode | undefined;
    while ((bookStateNode = bookViewState.popNextNodeBackwards()) != undefined) {
      const clonedNode = bookStateNode.node.cloneNode(true) as HTMLElement;
      bookDiv.insertBefore(clonedNode, bookDiv.firstChild);

      if (overflowsParent(bookDiv, bookDiv.lastChild as HTMLElement)) {
        clonedNode.remove();
        const splitNodeInserted = tryPutSplitNodeBackwards(bookStateNode.node as HTMLElement);
        if (!splitNodeInserted) {
          bookViewState.unPopNextNodeBackwards(bookStateNode);
        }
        return;
      }

      bookViewState.addCurrentNodeBackwards(bookStateNode);
    }
  }

  function tryPutSplitNodeBackwards(node: HTMLElement): boolean {
    const result: [Node, Node] | undefined = binarySearchSplitChild({
      child: node,
      reverse: true,
      check: ([[, nAfter], [, nMinusOneAfter]]): "left" | "right" | "done" => {
        bookDiv.append(nAfter);
        const nAfterOverflows = overflowsParent(bookDiv, nAfter);
        nAfter.remove();

        if (nAfterOverflows) {
          return "left";
        }

        bookDiv.append(nMinusOneAfter);
        const nMinusOneAfterOverflows = overflowsParent(bookDiv, nMinusOneAfter);
        nMinusOneAfter.remove();

        if (nMinusOneAfterOverflows) {
          return "done";
        } else {
          return "right";
        }
      },
    });

    if (result == undefined) {
      return false;
    } else {
      const [before, after] = result;
      bookViewState.addSplitNodeBackwards(before, after, node);
      bookDiv.insertBefore(after, node.firstChild);
      return true;
    }
  }

  function overflowsParent(parent: HTMLElement, child: HTMLElement) {
    return (
      child.offsetTop - parent.offsetTop > parent.offsetHeight - child.offsetHeight ||
      child.offsetLeft - parent.offsetLeft > parent.offsetWidth - child.offsetWidth + 100
    );
  }

  layoutContent();

  function containerClickHandler(event: MouseEvent) {
    console.log(bookViewState);

    let bounds = container.getBoundingClientRect();
    let x = event.clientX - bounds.left;
    let y = event.clientY - bounds.top;

    const percentWidth = (x / container.offsetWidth) * 100;

    if (percentWidth < 20.0 && !bookViewState.firstPage()) {
      doTurnPageBackwards();
    }

    if (percentWidth > 80.0 && !bookViewState.lastPage()) {
      doTurnPage();
    }
  }

  function clearColumnHtml() {
    bookDiv.innerHTML = "";
  }

  function containerKeyboardHandler(event: KeyboardEvent) {}

  container.addEventListener("click", containerClickHandler);
  container.addEventListener("keyup", containerKeyboardHandler);

  function doTurnPage() {
    bookViewState.turnPage();
    clearColumnHtml();
    layoutContent();
  }

  function doTurnPageBackwards() {
    bookViewState.turnPageBackwards();
    clearColumnHtml();
    layoutContentBackwards();

    if (bookViewState.firstPage()) {
      bookViewState.turnPageBackwards();
      clearColumnHtml();
      layoutContent();
    }
  }

  function doRelayoutCurrentPage() {
    bookViewState.turnPageBackwards();
    clearColumnHtml();
    layoutContent();
  }

  function binarySearchSplitChild({
    child,
    reverse = false,
    check,
  }: {
    child: Node;
    reverse?: boolean;
    check: (
      values: [[HTMLElement, HTMLElement], [HTMLElement, HTMLElement]],
    ) => "left" | "right" | "done";
  }): [Node, Node] | undefined {
    switch (child.nodeType) {
      case Node.ELEMENT_NODE:
        return binarySearchNodeSegments(child, check, reverse);

      case Node.TEXT_NODE:
        return binarySearchStringSegments(child.textContent, check, reverse);
    }
    return undefined;
  }

  function binarySearchStringSegments(
    text: string,
    check: (values: [[Node, Node], [Node, Node]]) => "left" | "right" | "done",
    reverse: boolean = false,
  ): [Node, Node] | undefined {
    return binarySearch(
      text.split(/[ ]+/).length,
      (index): [[Node, Node], [Node, Node]] => {
        const [a, b] = getStringSegment(text, index, reverse);
        const [c, d] = getStringSegment(text, index + 1, reverse);

        const aNode = document.createElement("p");
        aNode.append(...a);

        const bNode = document.createElement("p");
        bNode.append(...b);

        const cNode = document.createElement("p");
        cNode.append(...c);

        const dNode = document.createElement("p");
        dNode.append(...d);

        return [
          [aNode, bNode],
          [cNode, dNode],
        ];
      },
      check,
    )[0];
  }

  function binarySearchNodeSegments(
    node: Node,
    check: (values: [[Node, Node], [Node, Node]]) => "left" | "right" | "done",
    reverse: boolean = false,
  ): [Node, Node] | undefined {
    const childNodes = Array.from(node.childNodes);
    return binarySearch(
      node.childNodes.length,
      (index): [[Node, Node], [Node, Node]] => {
        const [a, b] = getSegments(childNodes, index, reverse);
        const [c, d] = getSegments(childNodes, index + 1, reverse);

        const aNode = node.cloneNode() as HTMLElement;
        aNode.append(...a);

        const bNode = node.cloneNode() as HTMLElement;
        bNode.append(...b);

        const cNode = node.cloneNode() as HTMLElement;
        cNode.append(...c);

        const dNode = node.cloneNode() as HTMLElement;
        dNode.append(...d);

        return [
          [aNode, bNode],
          [cNode, dNode],
        ];
      },
      check,
    )[0];
  }

  function binarySearch<T>(
    size: number,
    getValue: (index: number) => T,
    check: (arg: T) => "left" | "right" | "done",
  ): T | undefined {
    let left = 0;
    let right = size - 1;

    while (left <= right) {
      const m = Math.floor((left + right) / 2);
      const value = getValue(m);

      switch (check(value)) {
        case "left":
          left = m + 1;
          break;

        case "right":
          right = m - 1;
          break;

        case "done":
          return value;
      }
    }

    return undefined;
  }

  function getStringSegment(
    text: string,
    index: number,
    reverse: boolean = false,
  ): [string, string] {
    const fragments = text.split(/[ ]+/);
    const result = getSegments(fragments, index, reverse);
    return result.map((it) => it.join(" ")) as [string, string];
  }

  function getSegments<T>(values: T[], index: number, reverse: boolean = false): [T[], T[]] {
    const i = index + 1; // Make 0 index not have an empty array on any side
    if (reverse) {
      return [values.slice(0, values.length - i), values.slice(values.length - i)];
    } else {
      return [values.slice(0, i), values.slice(i)];
    }
  }

  function addTextToNode(node: Node, textContent: string) {
    const element = document.createElement("p");
    element.textContent = textContent;
    node.appendChild(element);
  }

  return () => {
    bookDiv.remove();
    container.removeEventListener("click", containerClickHandler);
    container.removeEventListener("keyup", containerKeyboardHandler);
  };
}
