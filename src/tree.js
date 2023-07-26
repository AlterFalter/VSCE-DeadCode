class TreeNodeProvider() {
    constructor(_context, debug) {
        this._context = _context;
        this._debug = debug;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        buildCounter = _context.workspaceState.get('buildCounter', 1);
        expandedNodes = _context.workspaceState.get('expandedNodes', {});
    }

    getChildren(node)
    {
        if (node === undefined) {
            var result = [];

            var availableNodes = nodes.filter(function (node) {
                return node.nodes === undefined || (node.nodes.length + (node.todos ? node.todos.length : 0) > 0);
            });
            var rootNodes = availableNodes.filter(isVisible);
            if (rootNodes.length > 0) {
                if (config.shouldGroup()) {
                    rootNodes.sort(function (a, b) {
                        return a.name > b.name;
                    });
                }
                result = rootNodes;
            }

            var filterStatusNode = { label: "", notExported: true, isStatusNode: true };
            var includeGlobs = this._context.workspaceSt
            ate.get('includeGlobs') || [];
            var excludeGlobs = this._context.workspaceState.get('excludeGlobs') || [];
            var totalFilters = includeGlobs.length + excludeGlobs.length;
            var tooltip = "";

            if (currentFilter) {
                tooltip += "Tree Filter: \"" + currentFilter + "\"\n";
                totalFilters++;
            }

            if (includeGlobs.length + excludeGlobs.length > 0) {
                includeGlobs.map(function (glob) {
                    tooltip += "Include: " + glob + "\n";
                });
                excludeGlobs.map(function (glob) {
                    tooltip += "Exclude: " + glob + "\n";
                });
            }

            if (totalFilters > 0) {
                filterStatusNode.label = totalFilters + " filter" + (totalFilters === 1 ? '' : 's') + " active";
                filterStatusNode.tooltip = tooltip + "\nRight click for filter options";
            }

            if (result.length === 0) {
                if (filterStatusNode.label !== "") {
                    filterStatusNode.label += ", ";
                }
                filterStatusNode.label += "Nothing found";
                filterStatusNode.icon = "issues";

                filterStatusNode.empty = availableNodes.length === 0;
            }

            if (filterStatusNode.label !== "") {
                result.unshift(filterStatusNode);
            }

            if (config.shouldShowScanModeInTree()) {
                var scanMode = config.scanMode();
                if (scanMode === 'workspace') {
                    scanMode += " and open files";
                }
                var scanModeNode = {
                    label: "Scan mode: " + scanMode, notExported: true, isStatusNode: true, icon: "search"
                };
                result.unshift(scanModeNode);
            }

            return result;
        }
        else if (node.type === PATH) {
            if (config.shouldCompactFolders() && node.tag === undefined) {
                while (node.nodes && node.nodes.length === 1 && node.nodes[0].nodes.length > 0) {
                    node = node.nodes[0];
                }
            }

            if (node.nodes && node.nodes.length > 0) {
                return node.nodes.filter(isVisible);
            }
            else {
                return node.todos.filter(isVisible);
            }
        }
        else if (node.type === TODO) {
            if (node.extraLines && node.extraLines.length > 0) {
                return node.extraLines.filter(isVisible);
            }
            else {
                return node.text;
            }
        }
    }

    getParent(node)
    {
        return node.parent;
    }

    getTreeItem(node)
    {
        var treeItem;
        try {
            treeItem = new vscode.TreeItem(node.label + (node.pathLabel ? (" " + node.pathLabel) : ""));
        }
        catch (e) {
            console.log("Failed to create tree item: " + e);
        }

        treeItem.id = node.id;
        treeItem.fsPath = node.fsPath;

        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;

        if (node.fsPath) {
            treeItem.node = node;
            if (config.showBadges() && !node.tag) {
                treeItem.resourceUri = vscode.Uri.file(node.fsPath);
            }

            if (treeItem.node.type === TODO) {
                treeItem.tooltip = config.tooltipFormat();
                treeItem.tooltip = utils.formatLabel(config.tooltipFormat(), node);
            }
            else {
                treeItem.tooltip = treeItem.fsPath;
            }

            if (node.type === PATH) {
                if (config.shouldCompactFolders() && node.tag === undefined) {
                    var onlyChild = node.nodes.length === 1 ? node.nodes[0] : undefined;
                    var onlyChildParent = node;
                    while (onlyChild && onlyChild.nodes.length > 0 && onlyChildParent.nodes.length === 1) {
                        treeItem.label += "/" + onlyChild.label;
                        onlyChildParent = onlyChild;
                        onlyChild = onlyChild.nodes[0];
                    }
                }

                if (expandedNodes[node.fsPath] !== undefined) {
                    treeItem.collapsibleState = (expandedNodes[node.fsPath] === true) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
                }
                else {
                    treeItem.collapsibleState = config.shouldExpand() ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
                }

                if (node.isWorkspaceNode || node.tag) {
                    treeItem.iconPath = icons.getIcon(this._context, node.tag ? node.tag : node.label, this._debug);
                }
                else if (node.nodes && node.nodes.length > 0) {
                    treeItem.iconPath = vscode.ThemeIcon.Folder;
                }
                else {
                    treeItem.iconPath = vscode.ThemeIcon.File;
                }
            }
            else if (node.type === TODO) {
                if (node.extraLines && node.extraLines.length > 0) {
                    treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                }

                if (config.shouldHideIconsWhenGroupedByTag() !== true || config.shouldGroup() !== true) {
                    if (node.isExtraLine !== true) {
                        treeItem.iconPath = icons.getIcon(this._context, node.tag ? node.tag : node.label, this._debug);
                    }
                    else {
                        treeItem.iconPath = "no-icon";
                    }
                }

                var format = config.labelFormat();
                if (format !== "") {
                    treeItem.label = utils.formatLabel(format, node) + (node.pathLabel ? (" " + node.pathLabel) : "");
                }

                treeItem.command = {
                    command: "todo-tree.revealTodo",
                    title: "",
                    arguments: [
                        node.fsPath,
                        node.line,
                        node.column,
                        node.endColumn
                    ]
                };
            }
        }
        else {
            treeItem.description = node.label;
            treeItem.label = "";
            treeItem.tooltip = node.tooltip;
            treeItem.iconPath = new vscode.ThemeIcon(node.icon);
        }

        if (config.shouldShowCounts() && node.type === PATH) {
            var tagCounts = {};
            countTags(node, tagCounts, false);
            var total = Object.values(tagCounts).reduce(function (a, b) { return a + b; }, 0);
            treeItem.description = total.toString();
        }

        if (node.isFolder === true) {
            treeItem.contextValue = "folder";
        }
        else if (!node.isRootTagNode && !node.isWorkspaceNode && !node.isStatusNode && node.type !== TODO) {
            treeItem.contextValue = "file";
        }

        return treeItem;
    }

    clear(folders)
    {
        nodes = [];

        workspaceFolders = folders;

        addWorkspaceFolders();
    }

    rebuild()
    {
        initialized = true;
        buildCounter = (buildCounter + 1) % 100;
    }

    refresh()
    {
        if (config.shouldShowTagsOnly()) {
            if (config.shouldSortTree()) {
                nodes.sort(config.shouldGroup() ? sortByTagAndLine : (config.shouldSortTagsOnlyViewAlphabetically() ? sortByLabelAndLine : sortByFilenameAndLine));
                nodes.forEach(function (node) {
                    if (node.todos) {
                        node.todos.sort(config.shouldSortTagsOnlyViewAlphabetically() ? sortByLabelAndLine : sortByFilenameAndLine);
                    }
                });
            }
        }

        this._onDidChangeTreeData.fire();
    }

    filter(text, children)
    {
        var matcher = new RegExp(text, config.showFilterCaseSensitive() ? "" : "i");

        if (children === undefined) {
            currentFilter = text;
            children = nodes;
        }
        children.forEach(child => {
            if (child.type === TODO) {
                var match = matcher.test(child.label);
                child.visible = !text || match;
            }

            if (child.nodes !== undefined) {
                this.filter(text, child.nodes);
            }
            if (child.todos !== undefined) {
                this.filter(text, child.todos);
            }
            if (child.extraLines !== undefined) {
                this.filter(text, child.extraLines);
            }
            if ((child.nodes && child.nodes.length > 0) || (child.todos && child.todos.length > 0) || (child.extraLines && child.extraLines.length > 0)) {
                var visibleNodes = child.nodes ? child.nodes.filter(isVisible).length : 0;
                var visibleTodos = child.todos ? child.todos.filter(isVisible).length : 0;
                var visibleExtraLines = child.extraLines ? child.extraLines.filter(isVisible).length : 0;
                child.visible = visibleNodes + visibleTodos + visibleExtraLines > 0;
            }
        });
    }

    clearTreeFilter(children)
    {
        currentFilter = undefined;

        if (children === undefined) {
            children = nodes;
        }
        children.forEach(function (child) {
            child.visible = true;
            if (child.nodes !== undefined) {
                this.clearTreeFilter(child.nodes);
            }
            if (child.todos !== undefined) {
                this.clearTreeFilter(child.todos);
            }
            if (child.extraLines !== undefined) {
                this.clearTreeFilter(child.extraLines);
            }
        }, this);
    }

    add(result)
    {
        if (nodes.length === 0) {
            addWorkspaceFolders();
        }

        var rootNode = locateWorkspaceNode(result.file);
        var todoNode = createTodoNode(result);

        if (config.shouldHideFromTree(todoNode.tag ? todoNode.tag : todoNode.label)) {
            todoNode.hidden = true;
        }

        var childNode;
        if (config.shouldShowTagsOnly()) {
            if (config.shouldGroup()) {
                if (todoNode.tag) {
                    childNode = nodes.find(findTagNode, todoNode.tag);
                    if (childNode === undefined) {
                        childNode = createTagNode(result.file, todoNode.tag);
                        nodes.push(childNode);
                    }
                }
                else if (nodes.find(findTodoNode, todoNode) === undefined) {
                    nodes.push(todoNode);
                }
            }
            else {
                if (nodes.find(findTodoNode, todoNode) === undefined) {
                    nodes.push(todoNode);
                }
            }
        }
        else if (config.shouldFlatten() || rootNode === undefined) {
            childNode = locateFlatChildNode(rootNode, result, todoNode.tag);
        }
        else if (rootNode) {
            var relativePath = path.relative(rootNode.fsPath, result.file);
            var pathElements = [];
            if (relativePath !== "") {
                pathElements = relativePath.split(path.sep);
            }
            childNode = locateTreeChildNode(rootNode, pathElements, todoNode.tag);
        }

        if (childNode) {
            if (childNode.todos === undefined) {
                childNode.todos = [];
            }

            childNode.expanded = result.expanded;

            if (childNode.todos.find(findTodoNode, todoNode) === undefined) {
                todoNode.parent = childNode;
                childNode.todos.push(todoNode);
                childNode.showCount = true;
            }
        }
    }

    reset(filename, children)
    {
        var root = children === undefined;
        if (children === undefined) {
            children = nodes;
        }
        children = children.filter(function (child) {
            var keep = true;
            if (child.nodes !== undefined) {
                this.reset(filename, child.nodes);
            }
            if (child.type === TODO && !child.tag && child.fsPath == filename) // no tag (e.g. markdown)
            {
                keep = false;
            }
            else if (child.type === TODO && child.parent === undefined && child.fsPath == filename) // top level todo node
            {
                keep = false;
            }
            else if (child.fsPath === filename || child.isRootTagNode) {
                if (config.shouldShowTagsOnly()) {
                    if (child.todos) {
                        child.todos = child.todos.filter(function (todo) {
                            return todo.fsPath !== filename;
                        });
                    }
                }
                else {
                    child.todos = [];
                }
            }
            return keep;
        }, this);

        if (root) {
            nodes = children;
        }
    }

    remove(callback, filename, children)
    {
        function removeNodesByFilename(children, me) {
            return children.filter(function (child) {
                if (child.nodes !== undefined) {
                    child.nodes = me.remove(callback, filename, child.nodes);
                }
                var shouldRemove = (child.fsPath === filename);
                if (shouldRemove) {
                    delete expandedNodes[child.fsPath];
                    me._context.workspaceState.update('expandedNodes', expandedNodes);
                    if (callback) {
                        callback(child.fsPath);
                    }
                }
                return shouldRemove === false;
            }, me);
        }

        function removeEmptyNodes(children, me) {
            return children.filter(function (child) {
                if (child.nodes !== undefined) {
                    child.nodes = me.remove(callback, filename, child.nodes);
                }
                var shouldRemove = (child.nodes && child.todos && child.nodes.length + child.todos.length === 0 && child.isWorkspaceNode !== true);
                if (shouldRemove) {
                    delete expandedNodes[child.fsPath];
                    me._context.workspaceState.update('expandedNodes', expandedNodes);
                    if (callback) {
                        callback(child.fsPath);
                    }
                }
                return shouldRemove !== true;
            }, me);
        }

        var root = children === undefined;
        if (children === undefined) {
            children = nodes;
        }

        children = removeNodesByFilename(children, this);
        children = removeEmptyNodes(children, this);

        if (root) {
            nodes = children;
        }

        return children;
    }

    getElement(filename, found, children)
    {
        if (children === undefined) {
            children = nodes;
        }
        children.forEach(function (child) {
            if (child.fsPath === filename) {
                found(child);
            }
            else if (child.nodes !== undefined) {
                return this.getElement(filename, found, child.nodes);
            }
        }, this);
    }

    setExpanded(path, expanded)
    {
        expandedNodes[path] = expanded;
        this._context.workspaceState.update('expandedNodes', expandedNodes);
    }

    clearExpansionState()
    {
        expandedNodes = {};
        this._context.workspaceState.update('expandedNodes', expandedNodes);
    }

    getTagCountsForStatusBar(fileFilter)
    {
        var tagCounts = {};
        return countChildTags(nodes, tagCounts, true, fileFilter);
    }

    exportChildren(parent, children)
    {
        children.forEach(function (child) {
            if (child.type === PATH) {
                parent[child.label] = {};
                this.exportChildren(parent[child.label], this.getChildren(child));
            }
            else if (!child.notExported) {
                var format = config.labelFormat();
                var itemLabel = "line " + (child.line + 1);
                if (config.shouldShowTagsOnly() === true) {
                    itemLabel = child.fsPath + " " + itemLabel;
                }
                parent[itemLabel] = (format !== "") ?
                    utils.formatLabel(format, child) + (child.pathLabel ? (" " + child.pathLabel) : "") :
                    child.label;
            }
        }, this);
        return parent;
    }

    exportTree()
    {
        var exported = {};
        var children = this.getChildren();
        exported = this.exportChildren(exported, children);
        return exported;
    }

    getFirstNode()
    {
        var availableNodes = nodes.filter(function (node) {
            return node.nodes === undefined || (node.nodes.length + (node.todos ? node.todos.length : 0) > 0);
        });
        var rootNodes = availableNodes.filter(isVisible);
        if (rootNodes.length > 0) {
            return rootNodes[0];
        }
        return undefined;
    }
}