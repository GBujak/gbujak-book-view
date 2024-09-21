var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var BookState = /** @class */ (function () {
    function BookState(columnCount, contentNodes, startOnNode) {
        this.currentNodes = [];
        if (startOnNode == null) {
            this.pastNodes = [];
            this.remainingNodes = contentNodes;
        }
        else {
            var indexOfStart = contentNodes.indexOf(startOnNode);
            if (indexOfStart === -1) {
                throw Error("startOnNode not in contentNodes");
            }
            this.pastNodes = contentNodes.slice(0, indexOfStart);
            this.remainingNodes = contentNodes.slice(indexOfStart);
        }
    }
    BookState.prototype.popNextNode = function () {
        var node = this.remainingNodes.shift();
        if (node != null) {
            this.currentNodes.push(node);
        }
        return node;
    };
    BookState.prototype.unPopNextNode = function () {
        this.remainingNodes.unshift(this.currentNodes.pop());
    };
    BookState.prototype.popNextNodeBackwards = function () {
        var node = this.pastNodes.pop();
        if (node != null) {
            this.currentNodes.unshift(node);
        }
        return node;
    };
    BookState.prototype.unPopNextNodeBackwards = function () {
        this.pastNodes.push(this.currentNodes.shift());
    };
    BookState.prototype.fistVisibleNode = function () {
        return this.currentNodes[0];
    };
    BookState.prototype.turnPage = function () {
        this.pastNodes = __spreadArray(__spreadArray([], this.pastNodes, true), this.currentNodes, true);
        this.currentNodes = [];
    };
    BookState.prototype.turnPageBackwards = function () {
        this.remainingNodes = __spreadArray(__spreadArray([], this.currentNodes, true), this.remainingNodes, true);
        this.currentNodes = [];
    };
    BookState.prototype.lastPage = function () {
        return this.remainingNodes.length === 0;
    };
    BookState.prototype.firstPage = function () {
        return this.pastNodes.length === 0;
    };
    return BookState;
}());
function createBookView(_a) {
    var containerId = _a.containerId, contentId = _a.contentId, height = _a.height, _b = _a.columns, columns = _b === void 0 ? 2 : _b, _c = _a.onNavigateOffFinalPage, onNavigateOffFinalPage = _c === void 0 ? function () { } : _c;
    var container = document.getElementById(containerId);
    var content = document.getElementById(contentId);
    var bookDiv = document.createElement("div");
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
    (function () {
        var children = container.children;
        if (children.length != 1 && children[0] != content) {
            throw Error("Expecting content to be a direct and only child of container");
        }
    })();
    var bookViewState = new BookState(columns, Array.from(content.children));
    console.log(Array.from(content.children));
    function layoutContent() {
        var node;
        while ((node = bookViewState.popNextNode()) != undefined) {
            var clonedNode = node.cloneNode(true);
            bookDiv.append(clonedNode);
            if (overflowsParent(bookDiv, clonedNode)) {
                clonedNode.remove();
                bookViewState.unPopNextNode();
                return;
            }
        }
    }
    function layoutContentBackwards() {
        var node;
        while ((node = bookViewState.popNextNodeBackwards()) != undefined) {
            var clonedNode = node.cloneNode(true);
            bookDiv.insertBefore(clonedNode, bookDiv.firstChild);
            if (overflowsParent(bookDiv, bookDiv.lastChild)) {
                clonedNode.remove();
                bookViewState.unPopNextNodeBackwards();
                return;
            }
        }
    }
    function overflowsParent(parent, child) {
        return (child.offsetTop - parent.offsetTop >
            parent.offsetHeight - child.offsetHeight ||
            child.offsetLeft - parent.offsetLeft >
                parent.offsetWidth - child.offsetWidth);
    }
    layoutContent();
    function containerClickHandler(event) {
        var bounds = container.getBoundingClientRect();
        var x = event.clientX - bounds.left;
        var y = event.clientY - bounds.top;
        var percentWidth = (x / container.offsetWidth) * 100;
        console.log(bookViewState);
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
    setInterval(function () {
        doRelayoutCurrentPage();
    }, 1000);
    return function () {
        bookDiv.remove();
        container.removeEventListener("click", containerClickHandler);
        container.removeEventListener("keyup", containerKeyboardHandler);
    };
}
