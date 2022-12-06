### Hit-Testing playground

#### An example of a custom-shaped Box
```typescript
class Circle extends Box {
  public paint = (context: CanvasRenderingContext2D) => {
    const center = this.rect!.center;
    const circle = new Path2D();
    const radius = this.rect!.shortestSide / 2;
    circle.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    context.fillStyle = this.hovered ? "white" : this.color;
    context.fill(circle);
  };

  public hitTestSelf(position: Offset): boolean {
    const rect = this.rect!;
    const center = new Offset(rect.width / 2, rect.height / 2);
    const distance = position.subtract(center).distance;
    return distance <= rect.shortestSide / 2;
  }
}

```