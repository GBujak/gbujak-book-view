interface Props {
  containerId: string;
  contentId: string;
  height: string;
  columns?: number;
  onNavigateOffFinalPage?: () => void | Promise<void>;
}

class BookState {
  public pastNodes: Node[];
  public remainingNodes: Node[];
  public currentNodes: Node[];

  constructor(columnCount: number, contentNodes: Node[], startOnNode?: Node) {
    this.currentNodes = [];

    if (startOnNode == null) {
      this.pastNodes = [];
      this.remainingNodes = contentNodes;
    } else {
      const indexOfStart = contentNodes.indexOf(startOnNode);
      if (indexOfStart === -1) {
        throw Error("startOnNode not in contentNodes");
      }
      this.pastNodes = contentNodes.slice(0, indexOfStart);
      this.remainingNodes = contentNodes.slice(indexOfStart);
    }
  }

  popNextNode(): Node | undefined {
    const node = this.remainingNodes.shift();
    if (node != null) {
      this.currentNodes.push(node);
    }
    return node;
  }

  unPopNextNode() {
    this.remainingNodes.unshift(this.currentNodes.pop());
  }

  popNextNodeBackwards(): Node | undefined {
    const node = this.pastNodes.pop();
    if (node != null) {
      this.currentNodes.unshift(node);
    }
    return node;
  }

  unPopNextNodeBackwards() {
    this.pastNodes.push(this.currentNodes.shift());
  }

  fistVisibleNode(): Node | undefined {
    return this.currentNodes[0];
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
}

function createBookView({
  containerId,
  contentId,
  height,
  columns = 2,
  onNavigateOffFinalPage = () => {},
}: Props) {
  const columnDivs: HTMLDivElement[] = [];
  const container = document.getElementById(containerId);
  const content = document.getElementById(contentId);
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
      throw Error(
        "Expecting content to be a direct and only child of container"
      );
    }
  })();

  const bookViewState = new BookState(columns, Array.from(content.children));
  console.log(Array.from(content.children));

  for (let i = 0; i < columns; i++) {
    const div = document.createElement("div");
    columnDivs.push(div);
    div.style.height = height;
    container.appendChild(div);
  }

  container.style.display = "grid";
  container.style.gap = "1rem";
  container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  content.style.display = "none";

  function layoutContent() {
    divLoop: for (const div of columnDivs) {
      let node: Node | undefined;
      while ((node = bookViewState.popNextNode()) != undefined) {
        const clonedNode = node.cloneNode(true) as HTMLElement;
        div.append(clonedNode);

        if (overflowsParent(div, clonedNode)) {
          clonedNode.remove();
          bookViewState.unPopNextNode();
          continue divLoop;
        }
      }
    }
  }

  function layoutContentBackwards() {
    divLoop: for (const div of reverse(columnDivs)) {
      let node: Node | undefined;
      while ((node = bookViewState.popNextNodeBackwards()) != undefined) {
        const clonedNode = node.cloneNode(true) as HTMLElement;
        div.insertBefore(clonedNode, div.firstChild);

        if (overflowsParent(div, div.lastChild as HTMLElement)) {
          clonedNode.remove();
          bookViewState.unPopNextNodeBackwards();
          continue divLoop;
        }
      }
    }
  }

  function overflowsParent(parent: HTMLElement, child: HTMLElement) {
    return (
      child.offsetTop - parent.offsetTop >
      parent.offsetHeight - child.offsetHeight
    );
  }

  function reverse<T>(array: T[]): T[] {
    const tmp = [...array];
    tmp.reverse();
    return tmp;
  }

  layoutContent();

  function containerClickHandler(event: MouseEvent) {
    let bounds = container.getBoundingClientRect();
    let x = event.clientX - bounds.left;
    let y = event.clientY - bounds.top;

    const percentWidth = (x / container.offsetWidth) * 100;

    console.log(bookViewState);

    if (percentWidth < 20.0 && !bookViewState.firstPage()) {
      doTurnPageBackwards();
    }

    if (percentWidth > 80.0 && !bookViewState.lastPage()) {
      doTurnPage();
    }
  }

  function clearColumnHtml() {
    for (const column of columnDivs) {
      column.innerHTML = "";
    }
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

  setInterval(() => {
    doRelayoutCurrentPage();
  }, 1000);

  return () => {
    for (const div of columnDivs) {
      div.remove();
    }

    container.removeEventListener("click", containerClickHandler);
    container.removeEventListener("keyup", containerKeyboardHandler);
  };
}
