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
        const result = binarySearchSplitChild({
            child: node,
            reverse: false,
            check: ([[nBefore], [nPlusOneBefore]]) => {
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
                }
                else {
                    return "right";
                }
            },
        });
        if (result == undefined) {
            return false;
        }
        else {
            const [before, after] = result;
            bookViewState.addSplitNodeForward(before, after, node);
            bookDiv.append(before);
            return true;
        }
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
        const result = binarySearchSplitChild({
            child: node,
            reverse: true,
            check: ([[, nAfter], [, nMinusOneAfter]]) => {
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
                }
                else {
                    return "right";
                }
            },
        });
        if (result == undefined) {
            return false;
        }
        else {
            const [before, after] = result;
            bookViewState.addSplitNodeBackwards(before, after, node);
            bookDiv.insertBefore(after, node.firstChild);
            return true;
        }
    }
    function overflowsParent(parent, child) {
        return (child.offsetTop - parent.offsetTop > parent.offsetHeight - child.offsetHeight ||
            child.offsetLeft - parent.offsetLeft > parent.offsetWidth - child.offsetWidth + 100);
    }
    layoutContent();
    function containerClickHandler(event) {
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
    function binarySearchSplitChild({ child, reverse = false, check, }) {
        switch (child.nodeType) {
            case Node.ELEMENT_NODE:
                return binarySearchNodeSegments(child, check, reverse);
            case Node.TEXT_NODE:
                return binarySearchStringSegments(child.textContent, check, reverse);
        }
        return undefined;
    }
    function binarySearchStringSegments(text, check, reverse = false) {
        return binarySearch(text.split(/[ ]+/).length, (index) => {
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
        }, check)[0];
    }
    function binarySearchNodeSegments(node, check, reverse = false) {
        const childNodes = Array.from(node.childNodes);
        return binarySearch(node.childNodes.length, (index) => {
            const [a, b] = getSegments(childNodes, index, reverse);
            const [c, d] = getSegments(childNodes, index + 1, reverse);
            const aNode = node.cloneNode();
            aNode.append(...a);
            const bNode = node.cloneNode();
            bNode.append(...b);
            const cNode = node.cloneNode();
            cNode.append(...c);
            const dNode = node.cloneNode();
            dNode.append(...d);
            return [
                [aNode, bNode],
                [cNode, dNode],
            ];
        }, check)[0];
    }
    function binarySearch(size, getValue, check) {
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
    function getStringSegment(text, index, reverse = false) {
        const fragments = text.split(/[ ]+/);
        const result = getSegments(fragments, index, reverse);
        return result.map((it) => it.join(" "));
    }
    function getSegments(values, index, reverse = false) {
        const i = index + 1; // Make 0 index not have an empty array on any side
        if (reverse) {
            return [values.slice(0, values.length - i), values.slice(values.length - i)];
        }
        else {
            return [values.slice(0, i), values.slice(i)];
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
