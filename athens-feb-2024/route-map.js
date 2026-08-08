// <route-map> — Leaflet map of the sailing route. Self-loads Leaflet (pinned).
(function () {
  const CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  let leafletPromise = null;

  function loadLeaflet() {
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet]')) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = CSS;
        l.integrity = 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H';
        l.crossOrigin = 'anonymous';
        l.setAttribute('data-leaflet', '');
        document.head.appendChild(l);
      }
      if (window.L) return resolve(window.L);
      const s = document.createElement('script');
      s.src = JS;
      s.integrity = 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH';
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve(window.L);
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return leafletPromise;
  }

  const KIND = {
    embark: { fill: '#5fc0a8', ring: '#0d7a63' },
    port: { fill: '#ffffff', ring: '#101b2d' },
    visit: { fill: '#f4b63f', ring: '#b8452b' },
    sea: { fill: '#c9d6e2', ring: '#7f93a8' },
    disembark: { fill: '#e07a5f', ring: '#a4462b' },
  };
  // A stop is a "visit" (day trip / stop, no overnight) when stay === false.
  function kindOf(s) {
    if (s.stay === false) return KIND.visit;
    return KIND[s.kind] || KIND.port;
  }
  function lightFill(s) {
    return s.stay === false || s.kind === 'port';
  }

  class RouteMap extends HTMLElement {
    constructor() {
      super();
      this._stops = [];
      this._markers = new Map();
      this._active = null;
    }

    connectedCallback() {
      this.style.display = 'block';
      this._host = document.createElement('div');
      this._host.style.cssText = 'position:absolute;inset:0;background:#dfe9ef';
      if (getComputedStyle(this).position === 'static') this.style.position = 'relative';
      this.appendChild(this._host);
      loadLeaflet().then((L) => this._init(L)).catch(() => {
        this._host.innerHTML =
          '<div style="display:grid;place-items:center;height:100%;font:14px Rubik,sans-serif;color:#7f93a8">Map unavailable offline</div>';
      });
      this._ro = new ResizeObserver(() => this._map && this._map.invalidateSize());
      this._ro.observe(this);
    }

    disconnectedCallback() {
      this._ro && this._ro.disconnect();
      this._map && this._map.remove();
      this._map = null;
    }

    set stops(v) {
      this._stops = v || [];
      if (this._map) this._draw();
    }
    get stops() {
      return this._stops;
    }

    _init(L) {
      this._L = L;
      this._map = L.map(this._host, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 12,
      }).addTo(this._map);
      this._layer = L.layerGroup().addTo(this._map);
      this._draw();
    }

    _draw() {
      const L = this._L;
      if (!L || !this._map) return;
      this._layer.clearLayers();
      this._markers.clear();
      const pts = this._stops.filter((s) => s.lat != null);
      if (!pts.length) return;
      const line = pts.map((s) => [s.lat, s.lng]);
      L.polyline(line, {
        color: '#101b2d',
        weight: 2,
        opacity: 0.55,
        dashArray: '6 7',
      }).addTo(this._layer);

      pts.forEach((s, i) => {
        const k = kindOf(s);
        const m = L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            html:
              `<div data-pin="${s.id}" style="position:relative;width:28px;height:28px;border-radius:50%;background:${k.fill};` +
              `border:2.5px solid ${k.ring};box-shadow:0 2px 8px rgba(16,27,45,.35);display:grid;place-items:center;` +
              `font:600 12px/1 Rubik,system-ui,sans-serif;color:${lightFill(s) ? '#101b2d' : '#fff'};` +
              `transition:transform .18s ease">${s.label != null ? s.label : i + 1}` +
              `${s.nights != null ? `<span title="לילות" style="position:absolute;top:-8px;left:-8px;min-width:17px;height:17px;padding:0 3px;border-radius:999px;background:#101b2d;color:#fff;font:700 10px/17px Rubik,system-ui,sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.35)">${s.nights}</span>` : ''}</div>`,
          }),
        }).addTo(this._layer);
        m.bindTooltip(s.place, { direction: 'top', offset: [0, -16] });
        m.on('mouseover', () => this._emit('stophover', s.id));
        m.on('mouseout', () => this._emit('stophover', null));
        m.on('click', () => this._emit('stopclick', s.id));
        this._markers.set(s.id, m);
      });
      this._map.fitBounds(L.latLngBounds(line).pad(0.22));
    }

    _emit(name, id) {
      this.dispatchEvent(new CustomEvent(name, { detail: id, bubbles: true }));
    }

    highlight(id) {
      this._active = id;
      this._markers.forEach((m, key) => {
        const el = m.getElement() && m.getElement().querySelector('[data-pin]');
        if (el) {
          el.style.transform = key === id ? 'scale(1.45)' : 'scale(1)';
          el.style.zIndex = key === id ? 900 : 400;
        }
        if (key !== id) m.closeTooltip();
      });
      if (id && this._markers.has(id)) this._markers.get(id).openTooltip();
    }

    focus(id) {
      const m = this._markers.get(id);
      if (m && this._map) this._map.panTo(m.getLatLng(), { animate: true });
      this.highlight(id);
    }
  }

  if (!customElements.get('route-map')) customElements.define('route-map', RouteMap);
})();
