// HIT TESTS

class Offset {
  constructor(public readonly x: number, public readonly y: number) {}

  public subtract(other: Offset): Offset {
    return new Offset(this.x - other.x, this.y - other.y);
  }

  public static zero = new Offset(0, 0);
}

class HitTestEntry {
  constructor(
    public readonly target: Box,
    public readonly localPosition: Offset
  ) {}
}

class HitTestResult {
  private _path: Array<HitTestEntry> = [];
  public get path(): Array<HitTestEntry> {
    return this._path;
  }

  public add = (entry: HitTestEntry): void => {
    this._path.push(entry);
  };

  public contains = (target: Box): boolean => {
    return this._path.some((entry) => entry.target == target);
  };

  public common = (other: HitTestResult): Array<HitTestEntry> => {
    return this.path.filter((entry) => other.contains(entry.target));
  };

  public without = (other: HitTestResult): Array<HitTestEntry> => {
    return this.path.filter((entry) => !other.contains(entry.target));
  };
}

const defaultHitTestChildren = (
  result: HitTestResult,
  position: Offset,
  children: Array<Box>
) => {
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

enum HitTestEventType {
  down = "down",
  move = "move",
  up = "up",
  enter = "enter",
  exit = "exit",
  click = "click",
  cancel = "cancel",
}

class HitTestEvent {
  constructor(
    public readonly event: MouseEvent,
    public readonly type: HitTestEventType
  ) {}
}

// RENDERING

class Margin {
  constructor(
    readonly left: number,
    readonly top: number,
    readonly right: number,
    readonly bottom: number
  ) {}
  public static all = (margin: number) =>
    new Margin(margin, margin, margin, margin);

  public static zero = new Margin(0, 0, 0, 0);

  public deflate(rect: Rect) {
    const left = rect.left + this.left;
    const top = rect.top + this.top;
    return new Rect(
      rect.left + this.left,
      rect.top + this.top,
      rect.width - this.left - this.right,
      rect.height - this.top - this.bottom
    );
  }
}

class Size {
  constructor(readonly width: number, readonly height: number) {}

  public contains(offset: Offset): boolean {
    return (
      offset.x >= 0.0 &&
      offset.x < this.width &&
      offset.y >= 0.0 &&
      offset.y < this.height
    );
  }
}

class Rect {
  constructor(
    readonly left: number,
    readonly top: number,
    readonly width: number,
    readonly height: number
  ) {}

  public get size(): Size {
    return new Size(this.width, this.height);
  }

  public get values(): [number, number, number, number] {
    return [this.left, this.top, this.width, this.height];
  }

  public toString = (): string =>
    `Rect(x: ${this.left}, y: ${this.top}, size:${this.width}x${this.height})`;
}

interface BoxOptions {
  name: string;
  color: string;
  margin: Margin;
  children: Array<Box>;
  onClick?: VoidFunction;
}

class Box {
  public readonly name: string;
  public readonly color: string;
  public readonly margin: Margin;
  public readonly children: Array<Box>;
  public readonly onClick?: VoidFunction;
  /// set during layout
  protected rect?: Rect;
  public get offset(): Offset {
    // offset of the Box relative to the parent.
    // (this is a huge simplification, normally the parent sets the offsets for their children depending on the layout algorithm)
    return new Offset(this.margin.left, this.margin.top);
  }
  public get size(): Size {
    // size of the Box
    return this.rect!.size;
  }

  constructor(options: BoxOptions) {
    this.name = options.name;
    this.color = options.color;
    this.margin = options.margin;
    this.children = options.children;
    this.onClick = options.onClick;
  }

  public layout = (rect: Rect) => {
    const surface = this.margin.deflate(rect);
    this.rect = surface;

    for (const child of this.children) {
      child.layout(surface);
    }
  };

  public paint = (context: CanvasRenderingContext2D) => {
    if (this._hovered) {
      context.shadowColor = "black";
      context.shadowBlur = 20;
    }

    context.fillStyle = this.color;
    context.fillRect(...this.rect!.values);

    context.shadowBlur = 0;

    // paint children
    for (const child of this.children) {
      child.paint(context);
    }
  };

  public hitTestChildren(result: HitTestResult, position: Offset): boolean {
    return defaultHitTestChildren(result, position, this.children);
  }
  public hitTestSelf(position: Offset): boolean {
    return this.size.contains(position);
  }

  public hitTest(result: HitTestResult, position: Offset): boolean {
    if (this.hitTestChildren(result, position) || this.hitTestSelf(position)) {
      result.add(new HitTestEntry(this, position));
      return true;
    } else {
      return false;
    }
  }

  private _hovered: boolean = false;

  public handleEvent = (event: HitTestEvent, entry: HitTestEntry) => {
    switch (event.type) {
      case HitTestEventType.move:
        break;
      case HitTestEventType.enter:
        this._hovered = true;
        break;
      case HitTestEventType.exit:
        this._hovered = false;
        break;
      case HitTestEventType.click:
        this.onClick?.();
        break;
    }
    if (event.type !== HitTestEventType.move) {
      console.log(this.name, event.type);
    }
  };
}

// CORE

class Renderer {
  protected rect: Rect = new Rect(0, 0, 0, 0);
  protected running: boolean = false;
  private readonly _context: CanvasRenderingContext2D;

  constructor(
    readonly canvasElement: HTMLCanvasElement,
    readonly children: Array<Box>
  ) {
    this._context = canvasElement.getContext("2d")!;
    this.layout();
  }

  public start = () => {
    window.addEventListener("resize", this.layout);
    window.addEventListener("load", this.layout);
    this.canvasElement.addEventListener("mousemove", this.hitTest);
    this.canvasElement.addEventListener("mousedown", this.hitTest);
    this.canvasElement.addEventListener("mouseup", this.hitTest);

    this.running = true;
    requestAnimationFrame(this.render);
  };

  public stop = () => {
    window.removeEventListener("resize", this.layout);
    window.removeEventListener("load", this.layout);
    this.canvasElement.removeEventListener("mousemove", this.hitTest);
    this.canvasElement.removeEventListener("mousedown", this.hitTest);
    this.canvasElement.removeEventListener("mouseup", this.hitTest);

    this.running = false;
  };

  protected render = () => {
    this._context.clearRect(...this.rect.values); // clear canvas

    for (const child of this.children) {
      child.paint(this._context);
    }

    if (this.running === true) {
      requestAnimationFrame(this.render);
    }
  };

  // Boxes that were tapped during the mousedown event
  protected tapped?: HitTestResult;
  // tuple of consecutive hit test results
  protected mouseState: [HitTestResult, HitTestResult] = [
    new HitTestResult(),
    new HitTestResult(),
  ];

  protected hitTest = (event: MouseEvent) => {
    const result = new HitTestResult();
    const position = new Offset(event.x, event.y);
    defaultHitTestChildren(result, position, this.children);

    if (event.type === "mousedown") {
      this.tapped = result;
      this.tapped.path.forEach((entry) => {
        entry.target.handleEvent(
          new HitTestEvent(event, HitTestEventType.down),
          entry
        );
      });
    } else if (event.type === "mousemove") {
      this.mouseState[0] = this.mouseState[1];
      this.mouseState[1] = result;

      const lastState = this.mouseState[0];
      const newState = this.mouseState[1];

      newState.without(lastState).forEach((enteredEntry) => {
        enteredEntry.target.handleEvent(
          new HitTestEvent(event, HitTestEventType.enter),
          enteredEntry
        );
      });

      lastState.without(newState).forEach((exitedEntry) => {
        exitedEntry.target.handleEvent(
          new HitTestEvent(event, HitTestEventType.exit),
          exitedEntry
        );
      });

      lastState.common(newState).forEach((activeEntry) => {
        activeEntry.target.handleEvent(
          new HitTestEvent(event, HitTestEventType.move),
          activeEntry
        );
      });
    } else if (event.type === "mouseup") {
      if (this.tapped!.path.length > 0) {
        // up gesture
        result.path.forEach((entry) => {
          entry.target.handleEvent(
            new HitTestEvent(event, HitTestEventType.up),
            entry
          );
        });

        // click gesture
        // We take into account all Boxes - this is a simplification, gesture arenas should be introduced
        const entry = this.tapped!.path[0];
        this.tapped!.common(result).forEach((clickedEntry) => {
          clickedEntry.target.handleEvent(
            new HitTestEvent(event, HitTestEventType.click),
            clickedEntry
          );
        });
        this.tapped!.without(result).forEach((canceledEntry) => {
          canceledEntry.target.handleEvent(
            new HitTestEvent(event, HitTestEventType.cancel),
            entry
          );
        });

        this.tapped = undefined;
      }
    }
  };

  protected layout = () => {
    const newRect = new Rect(
      0,
      0,
      this.canvasElement.offsetWidth,
      this.canvasElement.offsetHeight
    );
    this.canvasElement.width = newRect.width;
    this.canvasElement.height = newRect.height;
    this.rect = newRect;

    for (const child of this.children) {
      child.layout(newRect);
    }
  };
}

// SETUP

const main = () => {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  const renderer = new Renderer(canvas, [
    new Box({
      name: "red",
      margin: new Margin(100, 50, 100, 50),
      color: "red",
      children: [
        new Box({
          name: "blue",
          onClick: () => {
            // console.log("BLUE");
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
