import { useEffect, useState } from "react";
import type { GanttTask } from "../types/gantt";

type DependencyOverlayProps = {
  tasks: GanttTask[];
  enabled: boolean;
};

type DependencyLine = {
  id: string;
  path: string;
};

type OverlaySize = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

export function DependencyOverlay({
  tasks,
  enabled,
}: DependencyOverlayProps) {
  const [dependencyLines, setDependencyLines] = useState<DependencyLine[]>([]);
  const [overlaySize, setOverlaySize] = useState<OverlaySize>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!enabled) {
      setDependencyLines([]);
      return;
    }

    let animationFrameId = 0;
    let timeoutId = 0;

    function scheduleCalculateLines() {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);

      animationFrameId = window.requestAnimationFrame(() => {
        calculateLines();
      });

      timeoutId = window.setTimeout(() => {
        calculateLines();
      }, 200);
    }

    function calculateLines() {
      const chartElement = document.querySelector<HTMLElement>(
        ".sprint-gantt-chart"
      );

      if (!chartElement) {
        setDependencyLines([]);
        return;
      }

      const chartRect = chartElement.getBoundingClientRect();

      setOverlaySize({
        width: chartElement.scrollWidth,
        height: chartElement.scrollHeight,
      });

      const nextLines: DependencyLine[] = [];

      tasks.forEach((targetTask) => {
        const dependencyIds = parseDependencyIds(targetTask.dependencies);

        dependencyIds.forEach((sourceTaskId) => {
          if (sourceTaskId === targetTask.id) {
            return;
          }

          const sourceElement = findTaskElementById(sourceTaskId);
          const targetElement = findTaskElementById(targetTask.id);

          if (!sourceElement || !targetElement) {
            return;
          }

          const sourceRect = sourceElement.getBoundingClientRect();
          const targetRect = targetElement.getBoundingClientRect();

          const path = buildSmartConnectorPath({
            sourceRect,
            targetRect,
            chartRect,
          });

          nextLines.push({
            id: `${sourceTaskId}-to-${targetTask.id}`,
            path,
          });
        });
      });

      setDependencyLines(nextLines);
    }

    scheduleCalculateLines();

    window.addEventListener("resize", scheduleCalculateLines);
    window.addEventListener("scroll", scheduleCalculateLines, true);

    const chartElement = document.querySelector<HTMLElement>(
      ".sprint-gantt-chart"
    );

    const resizeObserver = new ResizeObserver(() => {
      scheduleCalculateLines();
    });

    if (chartElement) {
      resizeObserver.observe(chartElement);
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", scheduleCalculateLines);
      window.removeEventListener("scroll", scheduleCalculateLines, true);
      resizeObserver.disconnect();
    };
  }, [tasks, enabled]);

  if (!enabled || dependencyLines.length === 0) {
    return null;
  }

  return (
    <svg
      className="dependency-overlay"
      width={overlaySize.width}
      height={overlaySize.height}
      viewBox={`0 0 ${overlaySize.width} ${overlaySize.height}`}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="dependency-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M 0 0 L 8 4 L 0 8 z"
            className="dependency-arrowhead"
          />
        </marker>
      </defs>

      {dependencyLines.map((line) => (
        <path
          key={line.id}
          className="dependency-line"
          d={line.path}
          markerEnd="url(#dependency-arrowhead)"
        />
      ))}
    </svg>
  );
}

function findTaskElementById(taskId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-task-id="${taskId}"]`
  );
}

function parseDependencyIds(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\n;]/)
    .map((dependencyId) => dependencyId.trim())
    .filter(Boolean);
}

function buildSmartConnectorPath({
  sourceRect,
  targetRect,
  chartRect,
}: {
  sourceRect: DOMRect;
  targetRect: DOMRect;
  chartRect: DOMRect;
}): string {
  const sourceCenterX = sourceRect.left + sourceRect.width / 2 - chartRect.left;
  const sourceCenterY = sourceRect.top + sourceRect.height / 2 - chartRect.top;

  const targetCenterX = targetRect.left + targetRect.width / 2 - chartRect.left;
  const targetCenterY = targetRect.top + targetRect.height / 2 - chartRect.top;

  const sourceRight = sourceRect.right - chartRect.left;
  const sourceLeft = sourceRect.left - chartRect.left;
  const sourceTop = sourceRect.top - chartRect.top;
  const sourceBottom = sourceRect.bottom - chartRect.top;

  const targetRight = targetRect.right - chartRect.left;
  const targetLeft = targetRect.left - chartRect.left;
  const targetTop = targetRect.top - chartRect.top;
  const targetBottom = targetRect.bottom - chartRect.top;

  const deltaX = targetCenterX - sourceCenterX;
  const deltaY = targetCenterY - sourceCenterY;

  const isMostlyVertical = Math.abs(deltaY) > Math.abs(deltaX) * 0.85;

  if (isMostlyVertical) {
    const start: Point =
      deltaY >= 0
        ? { x: sourceCenterX, y: sourceBottom }
        : { x: sourceCenterX, y: sourceTop };

    const end: Point =
      deltaY >= 0
        ? { x: targetCenterX, y: targetTop }
        : { x: targetCenterX, y: targetBottom };

    return buildVerticalCurve(start, end);
  }

  const start: Point =
    deltaX >= 0
      ? { x: sourceRight, y: sourceCenterY }
      : { x: sourceLeft, y: sourceCenterY };

  const end: Point =
    deltaX >= 0
      ? { x: targetLeft, y: targetCenterY }
      : { x: targetRight, y: targetCenterY };

  return buildHorizontalCurve(start, end);
}

function buildHorizontalCurve(start: Point, end: Point): string {
  const bendDistance = 24;

  const bendX =
    end.x >= start.x
      ? start.x + bendDistance
      : start.x - bendDistance;

  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `L ${round(bendX)} ${round(start.y)}`,
    `L ${round(bendX)} ${round(end.y)}`,
    `L ${round(end.x)} ${round(end.y)}`
  ].join(" ");
}

function buildVerticalCurve(start: Point, end: Point): string {
  const bendDistance = 24;

  const bendY =
    end.y >= start.y
      ? start.y + bendDistance
      : start.y - bendDistance;

  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `L ${round(start.x)} ${round(bendY)}`,
    `L ${round(end.x)} ${round(bendY)}`,
    `L ${round(end.x)} ${round(end.y)}`
  ].join(" ");
}


function round(value: number): number {
  return Number(value.toFixed(1));
}