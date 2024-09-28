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
  }

  turnPageBackwards() {
    this.remainingNodes = [...this.currentNodes, ...this.remainingNodes];
    this.currentNodes = [];
  }

  lastPage() {
    return this.remainingNodes.length === 0;
  }

  firstPage() {
    return this.pastNodes.length === 0;
  }

  addSplitNodeForward(toCurrent: Node, toRemaining: Node) {
    this.currentNodes.push({ node: toCurrent });
    this.remainingNodes.shift();
    this.remainingNodes.unshift({ node: toRemaining });
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

  function* splitChild(element: HTMLElement): Generator<[Node, Node]> {
    const fullTextSize = element.textContent.length;
    for (let splitPercent = 1; splitPercent < 100; splitPercent += 1) {
      const textToFind = fullTextSize * (splitPercent / 100);
      let currentText = 0;
      let child: Node;

      for (const childIter of Array.from(element.childNodes)) {
        currentText += childIter.textContent.length;
        child = childIter;
        if (currentText > textToFind) {
          break;
        }
      }

      if (child == null) {
        return;
      }

      switch (child.nodeType) {
        case Node.ELEMENT_NODE:
          const lengthToFind = currentText - textToFind;
          let currentLength = 0;
          let foundChild: Node;

          for (const c of Array.from(child.childNodes)) {
            foundChild = c;
            currentLength += c.textContent.length;
            if (currentLength > lengthToFind) {
              break;
            }
          }

          const holder1 = child.cloneNode();
          const holder2 = child.cloneNode();

          let appendingTo = holder1;

          for (const n of Array.from(child.childNodes)) {
            appendingTo.appendChild(n.cloneNode(true));
            if (n == foundChild) {
              appendingTo = holder2;
            }
          }

          yield [holder1, holder2];

          break;

        case Node.TEXT_NODE:
          const text = child.textContent;
          let spaceIndex = 0;
          const findSpaceIndex = text.length - (currentText - textToFind);
          for (let i = 0; i < text.length; i++) {
            if (text[i] === " ") {
              spaceIndex = i;
            }

            if (i >= findSpaceIndex) {
              break;
            }
          }

          const element1 = document.createElement("p");
          element1.textContent = text.slice(0, spaceIndex);
          const element2 = document.createElement("p");
          element2.textContent = text.slice(spaceIndex + 1, text.length);

          yield [element1, element2];

          break;
      }
    }
  }

  function* stringSegmentsGenerator(text: string): Generator<[string, string]> {
    const fragments = text.split(/[ ]+/);
    for (const [leftStrings, rightStrings] of segmentsGenerator(fragments)) {
      yield [leftStrings.join(" "), rightStrings.join(" ")];
    }
  }

  function* segmentsGenerator<T>(values: T[]): Generator<[T[], T[]]> {
    for (let i = 1; i < values.length; i++) {
      yield [values.slice(0, i), values.slice(i)];
    }
  }

  return () => {
    bookDiv.remove();
    container.removeEventListener("click", containerClickHandler);
    container.removeEventListener("keyup", containerKeyboardHandler);
  };
}
