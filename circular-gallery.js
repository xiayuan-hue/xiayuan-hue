import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function lerp(p1, p2, t) {
  return p1 + (p2 - p1) * t;
}

function autoBind(instance) {
  const proto = Object.getPrototypeOf(instance);
  Object.getOwnPropertyNames(proto).forEach(key => {
    if (key !== 'constructor' && typeof instance[key] === 'function') {
      instance[key] = instance[key].bind(instance);
    }
  });
}

function getFontSize(font) {
  const match = font.match(/(\d+)px/);
  return match ? parseInt(match[1], 10) : 30;
}

function createTextTexture(gl, text, font, color) {
  font = font || 'bold 30px monospace';
  color = color || 'white';
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = font;
  const metrics = context.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const textHeight = Math.ceil(getFontSize(font) * 1.2);
  canvas.width = textWidth + 20;
  canvas.height = textHeight + 20;
  context.font = font;
  context.fillStyle = color;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = canvas;
  return { texture, width: canvas.width, height: canvas.height };
}

class Title {
  constructor({ gl, plane, renderer, text, textColor, font }) {
    autoBind(this);
    this.gl = gl;
    this.plane = plane;
    this.renderer = renderer;
    this.text = text;
    this.textColor = textColor || '#ffffff';
    this.font = font || 'bold 30px Figtree';
    this.createMesh();
  }

  createMesh() {
    const { texture, width, height } = createTextTexture(this.gl, this.text, this.font, this.textColor);
    const geometry = new Plane(this.gl);
    const program = new Program(this.gl, {
      vertex: `
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform sampler2D tMap;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tMap, vUv);
          if (color.a < 0.1) discard;
          gl_FragColor = color;
        }
      `,
      uniforms: { tMap: { value: texture } },
      transparent: true
    });
    this.mesh = new Mesh(this.gl, { geometry, program });
    const aspect = width / height;
    const textHeight = this.plane.scale.y * 0.15;
    const textWidth = textHeight * aspect;
    this.mesh.scale.set(textWidth, textHeight, 1);
    this.mesh.position.y = -this.plane.scale.y * 0.5 - textHeight * 0.5 - 0.05;
    this.mesh.setParent(this.plane);
  }
}

class Media {
  constructor({
    geometry,
    gl,
    image,
    index,
    length,
    renderer,
    scene,
    screen,
    text,
    viewport,
    bend,
    textColor,
    borderRadius,
    font
  }) {
    this.extra = 0;
    this.geometry = geometry;
    this.gl = gl;
    this.image = image;
    this.index = index;
    this.length = length;
    this.renderer = renderer;
    this.scene = scene;
    this.screen = screen;
    this.text = text;
    this.viewport = viewport;
    this.bend = bend;
    this.textColor = textColor || '#ffffff';
    this.borderRadius = borderRadius || 0;
    this.font = font || 'bold 30px Figtree';
    this.createShader();
    this.createMesh();
    this.createTitle();
    this.onResize();
  }

  createShader() {
    const texture = new Texture(this.gl, {
      generateMipmaps: true
    });
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = (sin(p.x * 4.0 + uTime) * 1.5 + cos(p.y * 2.0 + uTime) * 1.5) * (0.1 + uSpeed * 0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        uniform float uBorderRadius;
        varying vec2 vUv;
        
        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }
        
        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );
          vec4 color = texture2D(tMap, uv);
          
          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          
          float edgeSmooth = 0.002;
          float alpha = 1.0 - smoothstep(-edgeSmooth, edgeSmooth, d);
          
          gl_FragColor = vec4(color.rgb, alpha);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
        uBorderRadius: { value: this.borderRadius }
      },
      transparent: true
    });
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
    };
  }

  createMesh() {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program
    });
    this.plane.setParent(this.scene);
  }

  createTitle() {
    this.title = new Title({
      gl: this.gl,
      plane: this.plane,
      renderer: this.renderer,
      text: this.text,
      textColor: this.textColor,
      font: this.font
    });
  }

  update(scroll, direction) {
    this.plane.position.x = this.x - scroll.current - this.extra;

    const x = this.plane.position.x;
    const H = this.viewport.width / 2;

    if (this.bend === 0) {
      this.plane.position.y = 0;
      this.plane.rotation.z = 0;
    } else {
      const B_abs = Math.abs(this.bend);
      const R = (H * H + B_abs * B_abs) / (2 * B_abs);
      const effectiveX = Math.min(Math.abs(x), H);

      const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
      if (this.bend > 0) {
        this.plane.position.y = -arc;
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R);
      } else {
        this.plane.position.y = arc;
        this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R);
      }
    }

    this.speed = scroll.current - scroll.last;
    this.program.uniforms.uTime.value += 0.04;
    this.program.uniforms.uSpeed.value = this.speed;

    const planeOffset = this.plane.scale.x / 2;
    const viewportOffset = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.x - planeOffset > viewportOffset;
    if (direction === 'right' && this.isBefore) {
      this.extra -= this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
    if (direction === 'left' && this.isAfter) {
      this.extra += this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
  }

  onResize(params = {}) {
    const { screen, viewport } = params;
    if (screen) this.screen = screen;
    if (viewport) {
      this.viewport = viewport;
      if (this.plane && this.plane.program && this.plane.program.uniforms && this.plane.program.uniforms.uViewportSizes) {
        this.plane.program.uniforms.uViewportSizes.value = [this.viewport.width, this.viewport.height];
      }
    }
    if (!this.screen || !this.viewport) return;
    this.scale = this.screen.height / 1500;
    this.plane.scale.y = (this.viewport.height * (900 * this.scale)) / this.screen.height;
    this.plane.scale.x = (this.viewport.width * (700 * this.scale)) / this.screen.width;
    this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
    this.padding = 2;
    this.width = this.plane.scale.x + this.padding;
    this.widthTotal = this.width * this.length;
    this.x = this.width * this.index;
  }
}

export function createCircularGallery(container, options = {}) {
  const {
    items = [],
    bend = 3,
    textColor = '#ffffff',
    borderRadius = 0.05,
    font = 'bold 30px Figtree',
    scrollSpeed = 2,
    scrollEase = 0.05
  } = options;

  container.classList.add('circular-gallery');
  container.tabIndex = 0;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Circular image gallery. Use left and right arrow keys to navigate.');

  const scroll = { ease: scrollEase, current: 0, target: 0, last: 0 };
  let renderer, gl, camera, scene;
  let planeGeometry;
  let medias = [];
  let rafId;
  let isMounted = true;

  function createRenderer() {
    renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    });
    gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    container.appendChild(gl.canvas);
  }

  function createCamera() {
    camera = new Camera(gl);
    camera.fov = 45;
    camera.position.z = 20;
  }

  function createScene() {
    scene = new Transform();
  }

  function createGeometry() {
    planeGeometry = new Plane(gl, {
      heightSegments: 50,
      widthSegments: 100
    });
  }

  function createMedias() {
    const galleryItems = items.length ? items : [
      { image: 'https://picsum.photos/seed/1/800/600', text: 'Item 1' },
      { image: 'https://picsum.photos/seed/2/800/600', text: 'Item 2' },
      { image: 'https://picsum.photos/seed/3/800/600', text: 'Item 3' }
    ];
    
    const mediasImages = galleryItems.concat(galleryItems);
    medias = mediasImages.map((data, index) => {
      return new Media({
        geometry: planeGeometry,
        gl,
        image: data.image,
        index,
        length: mediasImages.length,
        renderer,
        scene,
        screen: null,
        text: data.text,
        viewport: null,
        bend,
        textColor,
        borderRadius,
        font
      });
    });
  }

  let screen = { width: 0, height: 0 };
  let viewport = { width: 0, height: 0 };

  function onResize() {
    screen = {
      width: container.clientWidth,
      height: container.clientHeight
    };
    renderer.setSize(screen.width, screen.height);
    camera.perspective({
      aspect: screen.width / screen.height
    });
    const fov = (camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * camera.position.z;
    const width = height * camera.aspect;
    viewport = { width, height };
    if (medias.length) {
      medias.forEach(media => media.onResize({ screen, viewport }));
    }
  }

  function update() {
    if (!isMounted) return;
    scroll.current = lerp(scroll.current, scroll.target, scroll.ease);
    const direction = scroll.current > scroll.last ? 'right' : 'left';
    if (medias.length) {
      medias.forEach(media => media.update(scroll, direction));
    }
    renderer.render({ scene, camera });
    scroll.last = scroll.current;
    rafId = window.requestAnimationFrame(update);
  }

  function onCheck() {
    if (!medias.length) return;
    const width = medias[0].width;
    const itemIndex = Math.round(Math.abs(scroll.target) / width);
    const item = width * itemIndex;
    scroll.target = scroll.target < 0 ? -item : item;
  }

  let isDown = false;
  let startX = 0;
  let scrollStart = 0;

  function onWheel(e) {
    const delta = e.deltaY || e.wheelDelta || e.detail;
    scroll.target += (delta > 0 ? scrollSpeed : -scrollSpeed) * 0.2;
    debounce(onCheck, 200)();
  }

  function onTouchDown(e) {
    isDown = true;
    scrollStart = scroll.current;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
  }

  function onTouchMove(e) {
    if (!isDown) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const distance = (startX - x) * (scrollSpeed * 0.025);
    scroll.target = scrollStart + distance;
  }

  function onTouchUp() {
    isDown = false;
    onCheck();
  }

  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        scroll.target += scrollSpeed * 5;
        onCheck();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        scroll.target -= scrollSpeed * 5;
        onCheck();
        break;
      case 'Home':
        e.preventDefault();
        scroll.target = 0;
        onCheck();
        break;
    }
  }

  function destroy() {
    isMounted = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousewheel', onWheel);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('mousedown', onTouchDown);
    window.removeEventListener('mousemove', onTouchMove);
    window.removeEventListener('mouseup', onTouchUp);
    window.removeEventListener('touchstart', onTouchDown);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchUp);
    container.removeEventListener('keydown', onKeyDown);
    
    if (gl && gl.canvas && gl.canvas.parentNode) {
      gl.canvas.parentNode.removeChild(gl.canvas);
    }
    
    container.classList.remove('circular-gallery');
    container.removeAttribute('tabindex');
    container.removeAttribute('role');
    container.removeAttribute('aria-label');
  }

  createRenderer();
  createCamera();
  createScene();
  createGeometry();
  createMedias();
  onResize();
  update();

  window.addEventListener('resize', onResize);
  window.addEventListener('mousewheel', onWheel);
  window.addEventListener('wheel', onWheel);
  window.addEventListener('mousedown', onTouchDown);
  window.addEventListener('mousemove', onTouchMove);
  window.addEventListener('mouseup', onTouchUp);
  window.addEventListener('touchstart', onTouchDown, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchUp);
  container.addEventListener('keydown', onKeyDown);

  return { destroy };
}

window.createCircularGallery = createCircularGallery;
