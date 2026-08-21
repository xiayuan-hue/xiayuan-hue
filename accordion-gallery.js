class AccordionGallery {
  constructor(container, options = {}) {
    this.container = container;
    this.items = options.items || [];
    this.defaultIndex = options.defaultIndex ?? 2;
    this.accentColor = options.accentColor || '#ffffff';
    this.overlayColor = options.overlayColor || '#060010';
    this.textColor = options.textColor || '#ffffff';
    this.height = options.height || 460;
    this.gap = options.gap || 10;
    this.radius = options.radius || 16;
    this.expandRatio = options.expandRatio ?? 0.52;
    this.orientation = options.orientation || 'horizontal';
    this.duration = options.duration ?? 0.6;
    this.parallax = options.parallax ?? 0.5;
    this.tilt = options.tilt ?? 8;
    this.stagger = options.stagger ?? 0.06;
    this.trigger = options.trigger || 'hover';
    this.showLabels = options.showLabels ?? true;
    this.grayscale = options.grayscale ?? true;
    this.ease = options.ease || 'cubic-bezier(0.19, 1, 0.22, 1)';
    this.className = options.className || '';

    this.active = Math.min(Math.max(this.defaultIndex, 0), this.items.length - 1);
    this.panels = [];
    this.mediaEls = [];
    this.bars = [];
    this.texts = [];
    this.mediaSize = 320;
    this.animationFrame = null;

    this.init();
  }

  init() {
    const vertical = this.orientation === 'vertical';
    const count = this.items.length;

    this.container.className = `accordion-gallery${vertical ? ' accordion-gallery--vertical' : ''}${this.className ? ' ' + this.className : ''}`;
    this.container.style.setProperty('--ag-accent', this.accentColor);
    this.container.style.setProperty('--ag-overlay', this.overlayColor);
    this.container.style.setProperty('--ag-text', this.textColor);
    this.container.style.setProperty('--ag-gap', this.gap + 'px');
    this.container.style.setProperty('--ag-radius', this.radius + 'px');
    this.container.style.height = vertical ? Math.round(this.height * 1.6) + 'px' : this.height + 'px';

    this.container.innerHTML = '';
    this.panels = [];
    this.mediaEls = [];
    this.bars = [];
    this.texts = [];

    this.items.forEach((item, i) => {
      const panel = document.createElement(item.link ? 'a' : 'div');
      panel.className = 'ag-panel';
      panel.style.borderRadius = this.radius + 'px';
      if (item.link) panel.href = item.link;
      panel.dataset.index = i;

      const frame = document.createElement('span');
      frame.className = 'ag-panel__frame';

      const media = document.createElement('span');
      media.className = 'ag-panel__media';

      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.alt || item.label || '';
      img.draggable = false;
      img.loading = 'lazy';
      media.appendChild(img);

      const overlay = document.createElement('span');
      overlay.className = 'ag-panel__overlay';
      overlay.setAttribute('aria-hidden', 'true');

      frame.appendChild(media);
      frame.appendChild(overlay);

      panel.appendChild(frame);

      if (this.showLabels && item.label) {
        const label = document.createElement('span');
        label.className = 'ag-panel__label';
        label.setAttribute('aria-hidden', 'true');

        const bar = document.createElement('span');
        bar.className = 'ag-panel__bar';

        const text = document.createElement('span');
        text.className = 'ag-panel__text';
        text.textContent = item.label;

        label.appendChild(bar);
        label.appendChild(text);
        panel.appendChild(label);

        this.bars.push(bar);
        this.texts.push(text);
      }

      panel.addEventListener('mouseenter', () => {
        if (this.trigger === 'hover') {
          this.setActive(i);
        }
      });

      panel.addEventListener('click', (e) => {
        if (i !== this.active) {
          e.preventDefault();
          this.setActive(i);
        }
      });

      panel.addEventListener('focus', () => this.setActive(i));

      panel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.setActive((i + 1) % count);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.setActive((i - 1 + count) % count);
        }
      });

      this.container.appendChild(panel);
      this.panels.push(panel);
      this.mediaEls.push(media);
    });

    this.observeResize();
    this.applyLayout(false);
  }

  observeResize() {
    const measure = () => {
      const rect = this.container.getBoundingClientRect();
      const total = this.orientation === 'vertical' ? rect.height : rect.width;
      const usable = Math.max(total - this.gap * (this.items.length - 1), 120);
      this.mediaSize = Math.max(140, usable * Math.min(Math.max(this.expandRatio, 0.2), 0.9));
      this.applyLayout(true);
    };

    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(measure);
      this.ro.observe(this.container);
    } else {
      window.addEventListener('resize', measure);
    }
    measure();
  }

  setActive(index) {
    this.active = index;
    this.applyLayout(true);
  }

  applyLayout(animate) {
    const panels = this.panels;
    if (!panels.length) return;

    const r = Math.min(Math.max(this.expandRatio, 0.2), 0.9);
    const grow = this.items.length > 1 ? (r * (this.items.length - 1)) / (1 - r) : 1;
    const vertical = this.orientation === 'vertical';

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = animate && !prefersReduced ? this.duration * 1000 : 0;

    panels.forEach((panel, i) => {
      if (!panel) return;
      const isActive = i === this.active;
      const media = this.mediaEls[i];

      const rot = isActive ? 0 : i < this.active ? this.tilt : -this.tilt;
      const rotateY = vertical ? 0 : rot;
      const rotateX = vertical ? -rot : 0;

      this.animateValue(panel, 'flexGrow', isActive ? grow : 1, duration);
      this.animateValue(panel, 'rotateY', rotateY, duration);
      this.animateValue(panel, 'rotateX', rotateX, duration);

      if (media) {
        const gray = this.grayscale ? (isActive ? 0 : 1) : 0;
        
        // 不移动图片位置，让它始终填满面板
        this.animateValue(media, 'translateX', 0, duration);
        this.animateValue(media, 'translateY', 0, duration);
        media.style.setProperty('--ag-gray', gray);
        media.style.setProperty('--ag-dim', isActive ? 0 : 0.35);
      }

      if (this.showLabels) {
        const bar = this.bars[i];
        const text = this.texts[i];
        if (bar) {
          this.animateValue(bar, 'opacity', isActive ? 1 : 0, duration);
          this.animateValue(bar, 'translateX', isActive ? 0 : -14, duration);
        }
        if (text) {
          const textDelay = isActive ? this.stagger * 1000 : 0;
          setTimeout(() => {
            this.animateValue(text, 'opacity', isActive ? 1 : 0, duration);
            this.animateValue(text, 'translateX', isActive ? 0 : -14, duration);
          }, textDelay);
        }
      }
    });
  }

  animateValue(el, prop, value, duration) {
    if (!el) return;
    const transformProps = ['translateX', 'translateY', 'rotateX', 'rotateY'];
    const isTransform = transformProps.includes(prop);

    if (isTransform) {
      const currentTransform = el.style.transform || '';
      const newTransform = this.setTransformValue(currentTransform, prop, value);
      if (duration > 0) {
        el.style.transition = `transform ${duration}ms ${this.ease}, opacity ${duration}ms ${this.ease}, flex-grow ${duration}ms ${this.ease}`;
      }
      el.style.transform = newTransform;
    } else if (prop === 'flexGrow') {
      if (duration > 0) {
        el.style.transition = `flex-grow ${duration}ms ${this.ease}`;
      }
      el.style.flexGrow = value;
    } else if (prop === 'opacity') {
      if (duration > 0) {
        el.style.transition = `opacity ${duration}ms ${this.ease}`;
      }
      el.style.opacity = value;
    }
  }

  setTransformValue(transform, prop, value) {
    const units = { translateX: 'px', translateY: 'px', rotateX: 'deg', rotateY: 'deg' };
    const unit = units[prop] || '';
    const regex = new RegExp(`${prop}\\(([^)]+)\\)`);
    if (regex.test(transform)) {
      return transform.replace(regex, `${prop}(${value}${unit})`);
    }
    return `${transform} ${prop}(${value}${unit})`.trim();
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.ro) {
      this.ro.disconnect();
    } else {
      window.removeEventListener('resize', this.measure);
    }
    this.container.innerHTML = '';
  }
}

window.AccordionGallery = AccordionGallery;
