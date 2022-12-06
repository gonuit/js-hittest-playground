"use strict";
// HIT TESTS
class Offset {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    subtract(other) {
        return new Offset(this.x - other.x, this.y - other.y);
    }
    get distance() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
}
Offset.zero = new Offset(0, 0);
class HitTestEntry {
    constructor(target, localPosition) {
        this.target = target;
        this.localPosition = localPosition;
    }
}
class HitTestResult {
    constructor() {
        this._path = [];
        this.add = (entry) => {
            this._path.push(entry);
        };
        this.contains = (target) => {
            return this._path.some((entry) => entry.target == target);
        };
        this.common = (other) => {
            return this.path.filter((entry) => other.contains(entry.target));
        };
        this.without = (other) => {
            return this.path.filter((entry) => !other.contains(entry.target));
        };
    }
    get path() {
        return this._path;
    }
}
const defaultHitTestChildren = (result, position, children) => {
    for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        const transformedPosition = position.subtract(child.offset);
        const isHit = child.hitTest(result, transformedPosition);
        if (isHit) {
            return true;
        }
    }
    return false;
};
var HitTestEventType;
(function (HitTestEventType) {
    HitTestEventType["down"] = "down";
    HitTestEventType["move"] = "move";
    HitTestEventType["up"] = "up";
    HitTestEventType["enter"] = "enter";
    HitTestEventType["exit"] = "exit";
    HitTestEventType["click"] = "click";
    HitTestEventType["cancel"] = "cancel";
})(HitTestEventType || (HitTestEventType = {}));
class HitTestEvent {
    constructor(event, type) {
        this.event = event;
        this.type = type;
    }
}
// RENDERING
class Margin {
    constructor(left, top, right, bottom) {
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
    }
    deflate(rect) {
        return new Rect(rect.left + this.left, rect.top + this.top, rect.width - this.left - this.right, rect.height - this.top - this.bottom);
    }
}
Margin.all = (margin) => new Margin(margin, margin, margin, margin);
Margin.zero = new Margin(0, 0, 0, 0);
class Size {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
    contains(offset) {
        return (offset.x >= 0.0 &&
            offset.x < this.width &&
            offset.y >= 0.0 &&
            offset.y < this.height);
    }
}
class Rect {
    constructor(left, top, width, height) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
        this.toString = () => `Rect(x: ${this.left}, y: ${this.top}, size:${this.width}x${this.height})`;
    }
    get size() {
        return new Size(this.width, this.height);
    }
    get center() {
        return new Offset(this.left + this.width / 2, this.top + this.height / 2);
    }
    get values() {
        return [this.left, this.top, this.width, this.height];
    }
    get shortestSide() {
        return Math.min(this.width, this.height);
    }
}
class Box {
    get offset() {
        // offset of the Box relative to the parent.
        // (this is a huge simplification, normally the parent sets the offsets for their children depending on the layout algorithm)
        return new Offset(this.margin.left, this.margin.top);
    }
    get size() {
        // size of the Box
        return this.rect.size;
    }
    constructor(options) {
        this.layout = (rect) => {
            const surface = this.margin.deflate(rect);
            this.rect = surface;
            for (const child of this.children) {
                child.layout(surface);
            }
        };
        this.paint = (context) => {
            if (this.hovered) {
                context.shadowColor = "black";
                context.shadowBlur = 20;
            }
            context.fillStyle = this.color;
            context.fillRect(...this.rect.values);
            context.shadowBlur = 0;
            // paint children
            for (const child of this.children) {
                child.paint(context);
            }
        };
        // this object
        this.hovered = false;
        this.handleEvent = (event, _) => {
            var _a;
            switch (event.type) {
                case HitTestEventType.move:
                    break;
                case HitTestEventType.enter:
                    this.hovered = true;
                    break;
                case HitTestEventType.exit:
                    this.hovered = false;
                    break;
                case HitTestEventType.click:
                    (_a = this.onClick) === null || _a === void 0 ? void 0 : _a.call(this);
                    break;
            }
            if (event.type !== HitTestEventType.move) {
                console.log(this.name, event.type);
            }
        };
        this.name = options.name;
        this.color = options.color;
        this.margin = options.margin;
        this.children = options.children;
        this.onClick = options.onClick;
    }
    hitTestChildren(result, position) {
        return defaultHitTestChildren(result, position, this.children);
    }
    hitTestSelf(position) {
        return this.size.contains(position);
    }
    hitTest(result, position) {
        if (this.hitTestChildren(result, position) || this.hitTestSelf(position)) {
            result.add(new HitTestEntry(this, position));
            return true;
        }
        else {
            return false;
        }
    }
}
// CORE
class Renderer {
    constructor(canvasElement, children) {
        this.canvasElement = canvasElement;
        this.children = children;
        this.rect = new Rect(0, 0, 0, 0);
        this.running = false;
        this.start = () => {
            window.addEventListener("resize", this.layout);
            window.addEventListener("load", this.layout);
            this.canvasElement.addEventListener("mousemove", this.hitTest);
            this.canvasElement.addEventListener("mousedown", this.hitTest);
            this.canvasElement.addEventListener("mouseup", this.hitTest);
            this.running = true;
            requestAnimationFrame(this.render);
        };
        this.stop = () => {
            window.removeEventListener("resize", this.layout);
            window.removeEventListener("load", this.layout);
            this.canvasElement.removeEventListener("mousemove", this.hitTest);
            this.canvasElement.removeEventListener("mousedown", this.hitTest);
            this.canvasElement.removeEventListener("mouseup", this.hitTest);
            this.running = false;
        };
        this.render = () => {
            this._context.clearRect(...this.rect.values); // clear canvas
            for (const child of this.children) {
                child.paint(this._context);
            }
            if (this.running === true) {
                requestAnimationFrame(this.render);
            }
        };
        // tuple of consecutive hit test results
        this.mouseState = [
            new HitTestResult(),
            new HitTestResult(),
        ];
        this.hitTest = (event) => {
            const result = new HitTestResult();
            const position = new Offset(event.x, event.y);
            defaultHitTestChildren(result, position, this.children);
            if (event.type === "mousedown") {
                this.tapped = result;
                this.tapped.path.forEach((entry) => {
                    entry.target.handleEvent(new HitTestEvent(event, HitTestEventType.down), entry);
                });
            }
            else if (event.type === "mousemove") {
                this.mouseState[0] = this.mouseState[1];
                this.mouseState[1] = result;
                const lastState = this.mouseState[0];
                const newState = this.mouseState[1];
                newState.without(lastState).forEach((entry) => {
                    entry.target.handleEvent(new HitTestEvent(event, HitTestEventType.enter), entry);
                });
                lastState.without(newState).forEach((entry) => {
                    entry.target.handleEvent(new HitTestEvent(event, HitTestEventType.exit), entry);
                });
                lastState.common(newState).forEach((activeEntry) => {
                    activeEntry.target.handleEvent(new HitTestEvent(event, HitTestEventType.move), activeEntry);
                });
            }
            else if (event.type === "mouseup") {
                if (this.tapped.path.length > 0) {
                    // up gesture
                    result.path.forEach((entry) => {
                        entry.target.handleEvent(new HitTestEvent(event, HitTestEventType.up), entry);
                    });
                    // click gesture
                    // We take into account all Boxes - this is a simplification, gesture arenas should be introduced
                    this.tapped.common(result).forEach((entry) => {
                        entry.target.handleEvent(new HitTestEvent(event, HitTestEventType.click), entry);
                    });
                    this.tapped.without(result).forEach((entry) => {
                        entry.target.handleEvent(new HitTestEvent(event, HitTestEventType.cancel), entry);
                    });
                    this.tapped = undefined;
                }
            }
        };
        this.layout = () => {
            const newRect = new Rect(0, 0, this.canvasElement.offsetWidth, this.canvasElement.offsetHeight);
            this.canvasElement.width = newRect.width;
            this.canvasElement.height = newRect.height;
            this.rect = newRect;
            for (const child of this.children) {
                child.layout(newRect);
            }
        };
        this._context = canvasElement.getContext("2d");
        this.layout();
    }
}
// SETUP
const main = () => {
    const canvas = document.getElementById("canvas");
    const renderer = new Renderer(canvas, [
        new Box({
            name: "red",
            margin: new Margin(100, 50, 100, 50),
            color: "red",
            children: [
                new Box({
                    name: "blue",
                    onClick: () => {
                        console.log("BLUE");
                    },
                    margin: Margin.all(100),
                    color: "blue",
                    children: [],
                }),
            ],
        }),
    ]);
    renderer.start();
};
main();
