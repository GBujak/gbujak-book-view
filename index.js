class BookState {
    constructor(contentNodes, startOnNode) {
        this.currentNodes = [];
        if (startOnNode == null) {
            this.pastNodes = [];
            this.remainingNodes = contentNodes.map((node) => ({ node }));
        }
        else {
            const indexOfStart = contentNodes.indexOf(startOnNode);
            if (indexOfStart === -1) {
                throw Error("startOnNode not in contentNodes");
            }
            this.pastNodes = contentNodes.slice(0, indexOfStart).map((node) => ({ node }));
            this.remainingNodes = contentNodes.slice(indexOfStart).map((node) => ({ node }));
        }
    }
    popNextNode() {
        return this.remainingNodes.shift();
    }
    unPopNextNode(node) {
        this.remainingNodes.unshift(node);
    }
    popNextNodeBackwards() {
        return this.pastNodes.pop();
    }
    unPopNextNodeBackwards(node) {
        this.pastNodes.push(node);
    }
    addCurrentNode(node) {
        this.currentNodes.push(node);
    }
    addCurrentNodeBackwards(node) {
        this.currentNodes.unshift(node);
    }
    fistVisibleNode() {
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
    addSplitNodeForward(toCurrent, toRemaining, original) {
        this.currentNodes.push({
            node: toCurrent,
            splitWithFollowingNode: true,
            originalNodeBeforeSplit: original,
        });
        this.remainingNodes.unshift({ node: toRemaining });
    }
    addSplitNodeBackwards(toPast, toCurrent, original) {
        this.currentNodes.unshift({ node: toCurrent });
        this.pastNodes.push({
            node: toPast,
            splitWithFollowingNode: true,
            originalNodeBeforeSplit: original,
        });
    }
    rejoinSplitNodes() {
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
                else {
                    break;
                }
            }
        }
    }
}
function createBookView({ containerId, contentId, height, columns = 2, onNavigateOffFinalPage = () => { }, }) {
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
        let bookStateNode;
        while ((bookStateNode = bookViewState.popNextNode()) != undefined) {
            const clonedNode = bookStateNode.node.cloneNode(true);
            bookDiv.appendChild(clonedNode);
            if (overflowsParent(bookDiv, clonedNode)) {
                clonedNode.remove();
                const splitNodeInserted = tryPutSplitNode(bookStateNode.node);
                if (!splitNodeInserted) {
                    bookViewState.unPopNextNode(bookStateNode);
                }
                return;
            }
            bookViewState.addCurrentNode(bookStateNode);
        }
    }
    function tryPutSplitNode(node) {
        let lastNonOverlapping = null;
        console.log("trying to splie");
        for (const [beforeElement, afterElement] of splitChild(node)) {
            console.log({ beforeElement, afterElement });
            bookDiv.append(beforeElement);
            const overflows = overflowsParent(bookDiv, beforeElement);
            beforeElement.remove();
            afterElement.remove();
            if (!overflows) {
                lastNonOverlapping = [beforeElement, afterElement];
                continue;
            }
            if (lastNonOverlapping != null) {
                bookDiv.append(lastNonOverlapping[0]);
                bookViewState.addSplitNodeForward(lastNonOverlapping[0], lastNonOverlapping[1], node);
                return true;
            }
            else {
                return false;
            }
        }
        return false;
    }
    function layoutContentBackwards() {
        let bookStateNode;
        while ((bookStateNode = bookViewState.popNextNodeBackwards()) != undefined) {
            const clonedNode = bookStateNode.node.cloneNode(true);
            bookDiv.insertBefore(clonedNode, bookDiv.firstChild);
            if (overflowsParent(bookDiv, bookDiv.lastChild)) {
                clonedNode.remove();
                const splitNodeInserted = tryPutSplitNodeBackwards(bookStateNode.node);
                if (!splitNodeInserted) {
                    bookViewState.unPopNextNodeBackwards(bookStateNode);
                }
                return;
            }
            bookViewState.addCurrentNodeBackwards(bookStateNode);
        }
    }
    function tryPutSplitNodeBackwards(node) {
        let lastNonOverlapping = null;
        for (const [beforeElement, afterElement] of splitChild(node, true)) {
            bookDiv.insertBefore(afterElement, bookDiv.firstChild);
            const overflows = overflowsParent(bookDiv, bookDiv.lastChild);
            beforeElement.remove();
            afterElement.remove();
            if (!overflows) {
                lastNonOverlapping = [beforeElement, afterElement];
                continue;
            }
            if (lastNonOverlapping != null) {
                bookDiv.insertBefore(lastNonOverlapping[1], bookDiv.firstChild);
                bookViewState.addSplitNodeBackwards(lastNonOverlapping[0], lastNonOverlapping[1], node);
                return true;
            }
            else {
                return false;
            }
        }
        return false;
    }
    function overflowsParent(parent, child) {
        return (child.offsetTop - parent.offsetTop > parent.offsetHeight - child.offsetHeight ||
            child.offsetLeft - parent.offsetLeft > parent.offsetWidth - child.offsetWidth + 100);
    }
    layoutContent();
    function containerClickHandler(event) {
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
    function containerKeyboardHandler(event) { }
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
    function* iterIndex(length, reverse) {
        if (reverse) {
            for (let i = length - 1; i >= 0; i--) {
                yield i;
            }
        }
        else {
            for (let i = 0; i < length; i++) {
                yield i;
            }
        }
    }
    function* splitChild(element, reverse = false) {
        const children = Array.from(element.childNodes);
        for (const i of iterIndex(children.length, reverse)) {
            const child = children[i];
            switch (child.nodeType) {
                case Node.ELEMENT_NODE:
                    for (const [nodesBefore, nodesAfter] of segmentsGenerator(Array.from(child.childNodes), reverse)) {
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
                    for (const [textBefore, textAfter] of stringSegmentsGenerator(child.textContent, reverse)) {
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
    function* stringSegmentsGenerator(text, reverse = false) {
        const fragments = text.split(/[ ]+/);
        for (const [leftStrings, rightStrings] of segmentsGenerator(fragments, reverse)) {
            yield [leftStrings.join(" "), rightStrings.join(" ")];
        }
    }
    function* segmentsGenerator(values, reverse = false) {
        if (reverse) {
            for (let i = values.length - 1; i > 0; i--) {
                yield [values.slice(0, i), values.slice(i)];
            }
        }
        else {
            for (let i = 1; i < values.length; i++) {
                yield [values.slice(0, i), values.slice(i)];
            }
        }
    }
    function addConentToNode(parent, content) {
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
    function addTextToNode(node, textContent) {
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
