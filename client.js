window.__ModuleLoader__.load({
  id: 'dsh-confetti',
  factory() {
    const NS = 'dsh-confetti';
    const EVENT_NAME = 'dsh:confetti';
    const VENDOR_URL = '/confetti/vendor/confetti.browser.js';
    const CANVAS_ID = 'dsh-confetti-canvas';

    function isReducedMotion() {
      try {
        return typeof window !== 'undefined'
          && typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        return false;
      }
    }

    function loadVendorScript() {
      if (typeof window !== 'undefined' && typeof window.confetti === 'function') {
        return Promise.resolve(window.confetti);
      }
      if (typeof document === 'undefined') return Promise.resolve(null);
      const existing = document.querySelector('script[data-dsh-confetti]');
      if (existing) {
        return new Promise((resolve) => {
          if (typeof window.confetti === 'function') {
            resolve(window.confetti);
            return;
          }
          if (existing.dataset.dshConfettiState !== undefined) {
            resolve(null);
            return;
          }
          existing.addEventListener('load', () => resolve(window.confetti ?? null), { once: true });
          existing.addEventListener('error', () => resolve(null), { once: true });
        });
      }
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = VENDOR_URL;
        script.async = true;
        script.setAttribute('data-dsh-confetti', '1');
        script.onload = () => {
          script.dataset.dshConfettiState = 'done';
          resolve(window.confetti ?? null);
        };
        script.onerror = () => {
          script.dataset.dshConfettiState = 'error';
          resolve(null);
        };
        (document.head || document.documentElement).appendChild(script);
      });
    }

    function ensureCanvas() {
      if (typeof document === 'undefined') return null;
      let canvas = document.getElementById(CANVAS_ID);
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = CANVAS_ID;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
        (document.body || document.documentElement).appendChild(canvas);
      }
      return canvas;
    }

    function normalizePack(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const colors = Array.isArray(raw.colors)
        ? raw.colors.filter((c) => typeof c === 'string' && c.trim().length > 0)
        : [];
      const particleCount = typeof raw.particleCount === 'number' && Number.isFinite(raw.particleCount)
        ? Math.min(400, Math.max(10, Math.round(raw.particleCount)))
        : 85;
      const spread = typeof raw.spread === 'number' && Number.isFinite(raw.spread)
        ? Math.min(180, Math.max(10, raw.spread))
        : 72;
      const originY = typeof raw.originY === 'number' && Number.isFinite(raw.originY)
        ? Math.min(1, Math.max(0, raw.originY))
        : 0.65;
      return { colors, particleCount, spread, originY };
    }

    return {
      inject: ['configForms'],
      apply(ctx) {
        return ctx.effect(() => {
          const form = ctx.configForms.get(NS);
          let currentPack = null;
          let disposed = false;
          let fireInstance = null;
          let canvas = null;

          const sync = () => {
            const { status, value } = form.getSnapshot();
            if (status === 'loading') return;
            currentPack = status === 'ready' ? normalizePack(value?.pack) : null;
          };

          let pendingFire = null;
          const getFire = () => {
            if (fireInstance) return Promise.resolve(fireInstance);
            if (pendingFire) return pendingFire;
            pendingFire = (async () => {
              const confettiFn = await loadVendorScript();
              if (disposed || typeof confettiFn !== 'function') return null;
              canvas = ensureCanvas();
              if (!canvas || typeof confettiFn.create !== 'function') return confettiFn;
              fireInstance = confettiFn.create(canvas, { resize: true, useWorker: false });
              return fireInstance;
            })().then((value) => {
              pendingFire = null;
              return value;
            }, (error) => {
              pendingFire = null;
              throw error;
            });
            return pendingFire;
          };

          const onConfetti = (event) => {
            if (disposed || !currentPack || isReducedMotion()) return;
            const detail = event?.detail && typeof event.detail === 'object' ? event.detail : {};
            const colors = Array.isArray(detail.colors) && detail.colors.length
              ? detail.colors
              : currentPack.colors;
            const particleCount = typeof detail.particleCount === 'number' && detail.particleCount > 0
              ? detail.particleCount
              : currentPack.particleCount;
            const spread = typeof detail.spread === 'number' && detail.spread > 0
              ? detail.spread
              : currentPack.spread;
            const origin = detail.origin && typeof detail.origin === 'object'
              ? detail.origin
              : { y: currentPack.originY };

            void getFire().then((fire) => {
              if (disposed || typeof fire !== 'function') return;
              fire({
                particleCount,
                spread,
                origin,
                ...(colors.length ? { colors } : {}),
                disableForReducedMotion: true,
              });
            }).catch(() => {});
          };

          if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener(EVENT_NAME, onConfetti);
          }
          const unsub = form.subscribe(sync);
          sync();

          return () => {
            disposed = true;
            if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
              window.removeEventListener(EVENT_NAME, onConfetti);
            }
            try { unsub(); } catch {}
            try { fireInstance?.reset?.(); } catch {}
            fireInstance = null;
            try { canvas?.remove(); } catch {}
            canvas = null;
            try { document.querySelector('script[data-dsh-confetti]')?.remove(); } catch {}
          };
        }, 'dsh-confetti: overlay');
      },
    };
  },
});
