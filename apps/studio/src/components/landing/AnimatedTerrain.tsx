import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;

float ridge(float x) {
  return 1.0 - abs(sin(x));
}

float terrain(vec2 p, float t) {
  vec2 q = p * 0.0014;

  float r1 = ridge(q.x * 0.7 + q.y * 0.3 + t * 0.003);
  float r2 = ridge(q.y * 0.8 - q.x * 0.3 + t * 0.004 + 1.6);
  float r3 = ridge(q.x * 0.5 + q.y * 0.7 + t * 0.005 + 3.1);
  float r4 = sin(q.x * 0.9 + q.y * 0.4 + t * 0.006 + 0.8) * 0.5 + 0.5;

  return r1 * 0.38 + r2 * 0.30 + r3 * 0.20 + r4 * 0.12;
}

vec3 calcNormal(vec2 p, float t) {
  float eps = 1.5;
  float h = terrain(p, t);
  float hx = terrain(p + vec2(eps, 0.0), t);
  float hy = terrain(p + vec2(0.0, eps), t);
  return normalize(vec3(h - hx, h - hy, eps));
}

void main() {
  vec2 p = v_uv * u_resolution;
  float t = u_time;

  float h = terrain(p, t);
  vec3 n = calcNormal(p, t);

  vec3 light = normalize(vec3(0.4, 0.6, 0.7));
  float diff = max(0.0, dot(n, light));

  vec3 view = vec3(0.0, 0.0, 1.0);
  float rim = pow(1.0 - max(0.0, dot(n, view)), 3.0);

  float ambient = 0.10;
  float brightness = ambient + diff * 0.50 + rim * 0.40;
  brightness = smoothstep(0.0, 1.0, brightness);

  float vignette = 1.0 - length(v_uv - 0.5) * 0.5;
  float c = 0.025 + brightness * 0.045;
  c *= vignette;

  fragColor = vec4(vec3(c), 1.0);
}`;

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string,
): WebGLProgram | null {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vs);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export function AnimatedTerrain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      console.warn('WebGL2 not supported');
      return;
    }

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) return;

    const positionLoc = gl.getAttribLocation(program, 'a_position');
    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const startTime = performance.now();
    let animationId: number;

    function resize(entry?: ResizeObserverEntry) {
      const dpr = window.devicePixelRatio || 1;
      const w = entry?.contentRect.width ?? window.innerWidth;
      const h = entry?.contentRect.height ?? window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform2f(resolutionLoc, canvas!.width, canvas!.height);
    }

    function draw(now: number) {
      const elapsed = (now - startTime) / 1000;
      gl!.uniform1f(timeLoc, elapsed);

      gl!.clearColor(0, 0, 0, 1);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

      animationId = requestAnimationFrame(draw);
    }

    gl.useProgram(program);
    resize();
    animationId = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(([entry]) => resize(entry));
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
