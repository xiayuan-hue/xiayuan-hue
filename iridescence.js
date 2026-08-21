import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createIridescence(container, options = {}) {
  const {
    color = [0.8509803921568627, 0.7764705882352941, 0.5450980392156862],
    speed = 1.0,
    amplitude = 0.1,
    mouseReact = false
  } = options;

  const mousePos = { x: 0.5, y: 0.5 };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new Renderer({ dpr });
  const gl = renderer.gl;
  gl.clearColor(1, 1, 1, 0);

  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);

  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(...color) },
      uResolution: {
        value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)
      },
      uMouse: { value: new Float32Array([mousePos.x, mousePos.y]) },
      uAmplitude: { value: amplitude },
      uSpeed: { value: speed }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  function resize() {
    const scale = 1;
    const w = container.offsetWidth || 1;
    const h = container.offsetHeight || 1;
    renderer.setSize(w * scale, h * scale);
    program.uniforms.uResolution.value = new Color(
      gl.canvas.width,
      gl.canvas.height,
      gl.canvas.width / gl.canvas.height
    );
  }

  let ro = null;
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();

  let isVisible = true;
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => {
      if (entries[0]) isVisible = entries[0].isIntersecting;
    }, { root: null, threshold: 0.01 });
    io.observe(container);
  }

  function handleMouseMove(e) {
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    mousePos.x = x;
    mousePos.y = y;
    program.uniforms.uMouse.value[0] = x;
    program.uniforms.uMouse.value[1] = y;
  }

  if (mouseReact) {
    container.addEventListener('mousemove', handleMouseMove);
  }

  let animateId;
  const update = (t) => {
    animateId = requestAnimationFrame(update);
    if (!isVisible && document.hidden) return;
    program.uniforms.uTime.value = t * 0.001;
    renderer.render({ scene: mesh });
  };
  animateId = requestAnimationFrame(update);

  return {
    destroy() {
      cancelAnimationFrame(animateId);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
      if (io) io.disconnect();
      if (mouseReact) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      try {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      } catch (e) { /* ignore */ }
      try { geometry.remove(); } catch (e) { /* ignore */ }
      try { program.remove(); } catch (e) { /* ignore */ }
      try { mesh.remove(); } catch (e) { /* ignore */ }
      renderer.destroy();
    },
    setColor(newColor) {
      program.uniforms.uColor.value = new Color(...newColor);
    },
    setSpeed(newSpeed) {
      program.uniforms.uSpeed.value = newSpeed;
    },
    setAmplitude(newAmplitude) {
      program.uniforms.uAmplitude.value = newAmplitude;
    }
  };
}
