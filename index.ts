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

  popNextNode(): Node | undefined {
    const node = this.remainingNodes.shift();
    if (node != null) {
      this.currentNodes.push(node);
    }
    return node?.node;
  }

  unPopNextNode() {
    this.remainingNodes.unshift(this.currentNodes.pop());
  }

  popNextNodeBackwards(): Node | undefined {
    const node = this.pastNodes.pop();
    if (node != null) {
      this.currentNodes.unshift(node);
    }
    return node?.node;
  }

  unPopNextNodeBackwards() {
    this.pastNodes.push(this.currentNodes.shift());
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
    this.currentNodes.push({ node: toCurrent });
    this.remainingNodes.shift();
    this.remainingNodes.unshift({ node: toRemaining });
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
    console.log("Laying out content");
    let node: Node | undefined;
    while ((node = bookViewState.popNextNode()) != undefined) {
      const clonedNode = node.cloneNode(true) as HTMLElement;
      bookDiv.append(clonedNode);

      if (overflowsParent(bookDiv, clonedNode)) {
        clonedNode.remove();
        bookViewState.unPopNextNode();

        let lastNotOverflowing: [Node, Node] | null = null;

        for (const [element1, element2] of splitChild(
          bookViewState.remainingNodes[0].node as HTMLElement,
        )) {
          const clonedSplit = element1.cloneNode(true);
          bookDiv.append(clonedSplit);
          if (!overflowsParent(bookDiv, clonedSplit as HTMLElement)) {
            lastNotOverflowing = [element1, element2];
            (clonedSplit as HTMLElement).remove();
            (element1 as HTMLElement).remove();
            (element2 as HTMLElement).remove();
          } else if (lastNotOverflowing != null) {
            (clonedSplit as HTMLElement).remove();
            bookViewState.addSplitNodeForward(lastNotOverflowing[0], lastNotOverflowing[1]);
            bookDiv.append(lastNotOverflowing[0]);
          }
        }
        return;
      }
    }
  }

  function layoutContentBackwards() {
    console.log("Laying out content backwards");
    let node: Node | undefined;
    while ((node = bookViewState.popNextNodeBackwards()) != undefined) {
      const clonedNode = node.cloneNode(true) as HTMLElement;
      bookDiv.insertBefore(clonedNode, bookDiv.firstChild);

      if (overflowsParent(bookDiv, bookDiv.lastChild as HTMLElement)) {
        clonedNode.remove();
        bookViewState.unPopNextNodeBackwards();
        return;
      }
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

  function* iterIndex(length: number, reverse: boolean): Generator<number> {
    if (reverse) {
      for (let i = length - 1; i >= 0; i--) {
        yield i;
      }
    } else {
      for (let i = 0; i < length; i++) {
        yield i;
      }
    }
  }

  function* splitChild(element: HTMLElement, reverse: boolean = false): Generator<[Node, Node]> {
    const children = Array.from(element.childNodes);

    for (const i of iterIndex(children.length, reverse)) {
      const child = children[i];

      switch (child.nodeType) {
        case Node.ELEMENT_NODE:
          for (const [nodesBefore, nodesAfter] of segmentsGenerator(
            Array.from(child.childNodes),
            reverse,
          )) {
            const element1 = child.cloneNode();
            for (const node of [...children.slice(0, i), ...nodesBefore]) {
              addConentToNode(element1, node);
            }

            const element2 = child.cloneNode();
            for (const node of [...children.slice(i + 1), ...nodesAfter]) {
              addConentToNode(element2, node);
            }

            yield [element1, element2];
          }
          break;

        case Node.TEXT_NODE:
          for (const [textBefore, textAfter] of stringSegmentsGenerator(
            child.textContent,
            reverse,
          )) {
            const element1 = document.createElement("p");
            for (const node of children.slice(0, i)) {
              addConentToNode(element1, node);
            }
            addTextToNode(element1, textBefore);

            const element2 = document.createElement("p");
            for (const node of children.slice(i + 1)) {
              addConentToNode(element2, node);
            }
            addTextToNode(element2, textAfter);

            yield [element1, element2];
          }
          break;
      }
    }
  }

  function* stringSegmentsGenerator(
    text: string,
    reverse: boolean = false,
  ): Generator<[string, string]> {
    const fragments = text.split(/[ ]+/);
    for (const [leftStrings, rightStrings] of segmentsGenerator(fragments, reverse)) {
      yield [leftStrings.join(" "), rightStrings.join(" ")];
    }
  }

  function* segmentsGenerator<T>(values: T[], reverse: boolean = false): Generator<[T[], T[]]> {
    if (reverse) {
      for (let i = values.length - 1; i > 0; i--) {
        yield [values.slice(0, i), values.slice(i)];
      }
    } else {
      for (let i = 1; i < values.length; i++) {
        yield [values.slice(0, i), values.slice(i)];
      }
    }
  }

  function addConentToNode(parent: Node, content: Node) {
    switch (content.nodeType) {
      case Node.ELEMENT_NODE:
        parent.appendChild(content);
        break;

      case Node.TEXT_NODE:
        addTextToNode(parent, content.textContent);
        break;

      default:
        break;
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
