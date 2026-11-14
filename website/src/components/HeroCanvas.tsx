"use client";

import { useEffect, useRef } from "react";

interface Dot {
  x: number;
  y: number;
  baseRadius: number;
  offsetX: number;
  offsetY: number;
  isCopper: boolean;
  phase: number;
}

const CREAM = "#F4F0E9";
const INK = "#151412";
const COPPER = "#B4552D";

function createDots(width: number, height: number, dpr: number): Dot[] {
  const spacing = 18 * dpr;
  const cols = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  const dots: Dot[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      dots.push({
        x: (col + 0.5) * spacing,
        y: (row + 0.5) * spacing,
        baseRadius: (1.5 + Math.random() * 1.4) * dpr,
        offsetX: 0,
        offsetY: 0,
        isCopper: Math.random() < 0.05,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  return dots;
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

interface WebGLScene {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  position: WebGLBuffer;
  radius: WebGLBuffer;
  color: WebGLBuffer;
  positionLoc: number;
  radiusLoc: number;
  colorLoc: number;
  resolutionLoc: WebGLUniformLocation | null;
  shaders: WebGLShader[];
}

function initWebGL(canvas: HTMLCanvasElement): WebGLScene | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    desynchronized: true,
  });
  if (!gl) return null;

  const vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec2 a_position;
      attribute float a_radius;
      attribute vec3 a_color;
      uniform vec2 u_resolution;
      varying vec3 v_color;
      void main() {
        vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
        gl_PointSize = a_radius * 2.0;
        v_color = a_color;
      }
    `
  );

  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      varying vec3 v_color;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float alpha = smoothstep(0.5, 0.42, length(p));
        if (alpha <= 0.0) discard;
        gl_FragColor = vec4(v_color, alpha);
      }
    `
  );

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  const position = gl.createBuffer();
  const radius = gl.createBuffer();
  const color = gl.createBuffer();

  if (!program || !position || !radius || !color) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    return null;
  }

  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return {
    gl,
    program,
    position,
    radius,
    color,
    positionLoc: gl.getAttribLocation(program, "a_position"),
    radiusLoc: gl.getAttribLocation(program, "a_radius"),
    colorLoc: gl.getAttribLocation(program, "a_color"),
    resolutionLoc: gl.getUniformLocation(program, "u_resolution"),
    shaders: [vertexShader, fragmentShader],
  };
}

function bindAttribute(
  gl: WebGLRenderingContext,
  buffer: WebGLBuffer,
  location: number,
  data: Float32Array,
  size: number,
  usage: number
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function renderWebGL(
  scene: WebGLScene,
  width: number,
  height: number,
  dots: Dot[]
) {
  const { gl, program, position, radius, color } = scene;
  const positions = new Float32Array(dots.length * 2);
  const radii = new Float32Array(dots.length);
  const colors = new Float32Array(dots.length * 3);

  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i];
    positions[i * 2] = dot.x + dot.offsetX;
    positions[i * 2 + 1] = dot.y + dot.offsetY;
    radii[i] = dot.baseRadius;
    const hex = dot.isCopper ? COPPER : INK;
    colors[i * 3] = parseInt(hex.slice(1, 3), 16) / 255;
    colors[i * 3 + 1] = parseInt(hex.slice(3, 5), 16) / 255;
    colors[i * 3 + 2] = parseInt(hex.slice(5, 7), 16) / 255;
  }

  gl.viewport(0, 0, width, height);
  gl.clearColor(
    parseInt(CREAM.slice(1, 3), 16) / 255,
    parseInt(CREAM.slice(3, 5), 16) / 255,
    parseInt(CREAM.slice(5, 7), 16) / 255,
    1
  );
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniform2f(scene.resolutionLoc, width, height);

  bindAttribute(gl, position, scene.positionLoc, positions, 2, gl.DYNAMIC_DRAW);
  bindAttribute(gl, radius, scene.radiusLoc, radii, 1, gl.DYNAMIC_DRAW);
  bindAttribute(gl, color, scene.colorLoc, colors, 3, gl.STATIC_DRAW);

  gl.drawArrays(gl.POINTS, 0, dots.length);
}

function renderCanvas2D(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dots: Dot[]
) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, width, height);
  for (const dot of dots) {
    ctx.beginPath();
    ctx.arc(dot.x + dot.offsetX, dot.y + dot.offsetY, dot.baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = dot.isCopper ? COPPER : INK;
    ctx.fill();
  }
}

function updateDots(
  dots: Dot[],
  time: number,
  pointer: { x: number; y: number; active: boolean },
  dpr: number
): void {
  const maxOffset = 4.5 * dpr;
  const influence = 170 * dpr;

  for (const dot of dots) {
    const flowX =
      Math.sin(time * 0.28 + dot.phase * 1.7) * 0.55 +
      Math.cos(time * 0.19 + dot.phase * 2.3) * 0.35;
    const flowY =
      Math.cos(time * 0.24 + dot.phase * 1.9) * 0.55 +
      Math.sin(time * 0.14 + dot.phase * 2.1) * 0.35;

    dot.offsetX = flowX * maxOffset;
    dot.offsetY = flowY * maxOffset;

    if (pointer.active) {
      const dx = pointer.x - dot.x;
      const dy = pointer.y - dot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < influence && dist > 0.001) {
        const force = (1 - dist / influence) * 0.16;
        dot.offsetX += dx * force;
        dot.offsetY += dy * force;
      }
    }
  }
}

export function HeroCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const scene = initWebGL(canvas);
    const ctx = scene ? null : canvas.getContext("2d", { alpha: false });
    if (!scene && !ctx) return;

    let dots: Dot[] = [];
    let frame = 0;
    let visible = true;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    const pointer = { x: 0, y: 0, active: false };

    const draw = () => {
      if (scene) renderWebGL(scene, width, height, dots);
      else if (ctx) renderCanvas2D(ctx, width, height, dots);
    };

    const loop = () => {
      if (reduced || !visible) {
        frame = 0;
        return;
      }
      updateDots(dots, performance.now() * 0.001, pointer, dpr);
      draw();
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!frame && !reduced && visible) {
        frame = requestAnimationFrame(loop);
      }
    };

    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      dots = createDots(width, height, dpr);
      draw();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer.active = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      pointer.x = x * dpr;
      pointer.y = y * dpr;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      if (reduced) {
        stop();
        draw();
      } else {
        start();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { rootMargin: "120px" }
    );

    const resizeObserver = new ResizeObserver(resize);

    resize();
    observer.observe(canvas);
    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave);
    mediaQuery.addEventListener("change", onReducedChange);

    if (reduced) draw();
    else start();

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      mediaQuery.removeEventListener("change", onReducedChange);
      if (scene) {
        scene.gl.deleteProgram(scene.program);
        scene.gl.deleteBuffer(scene.position);
        scene.gl.deleteBuffer(scene.radius);
        scene.gl.deleteBuffer(scene.color);
        for (const shader of scene.shaders) scene.gl.deleteShader(shader);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full ${className}`}
      style={{ background: CREAM }}
      aria-hidden="true"
    />
  );
}
