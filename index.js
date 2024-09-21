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
    var columnDivs = [];
    var container = document.getElementById(containerId);
    var content = document.getElementById(contentId);
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
    for (var i = 0; i < columns; i++) {
        var div = document.createElement("div");
        columnDivs.push(div);
        div.style.height = height;
        container.appendChild(div);
    }
    container.style.display = "grid";
    container.style.gap = "1rem";
    container.style.gridTemplateColumns = "repeat(".concat(columns, ", 1fr)");
    content.style.display = "none";
    function layoutContent() {
        divLoop: for (var _i = 0, columnDivs_1 = columnDivs; _i < columnDivs_1.length; _i++) {
            var div = columnDivs_1[_i];
            var node = void 0;
            while ((node = bookViewState.popNextNode()) != undefined) {
                var clonedNode = node.cloneNode(true);
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
        divLoop: for (var _i = 0, _a = reverse(columnDivs); _i < _a.length; _i++) {
            var div = _a[_i];
            var node = void 0;
            while ((node = bookViewState.popNextNodeBackwards()) != undefined) {
                var clonedNode = node.cloneNode(true);
                div.insertBefore(clonedNode, div.firstChild);
                if (overflowsParent(div, div.lastChild)) {
                    clonedNode.remove();
                    bookViewState.unPopNextNodeBackwards();
                    continue divLoop;
                }
            }
        }
    }
    function overflowsParent(parent, child) {
        return (child.offsetTop - parent.offsetTop >
            parent.offsetHeight - child.offsetHeight);
    }
    function reverse(array) {
        var tmp = __spreadArray([], array, true);
        tmp.reverse();
        return tmp;
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
        for (var _i = 0, columnDivs_2 = columnDivs; _i < columnDivs_2.length; _i++) {
            var column = columnDivs_2[_i];
            column.innerHTML = "";
        }
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
        for (var _i = 0, columnDivs_3 = columnDivs; _i < columnDivs_3.length; _i++) {
            var div = columnDivs_3[_i];
            div.remove();
        }
        container.removeEventListener("click", containerClickHandler);
        container.removeEventListener("keyup", containerKeyboardHandler);
    };
}
