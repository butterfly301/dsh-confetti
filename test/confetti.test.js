import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CLIENT_CODE = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function setupConfetti({ pack, reducedMotion = false }) {
  const listeners = new Map();
  const fired = [];
  const canvas = { id: 'dsh-confetti-canvas', style: {}, setAttribute() {}, remove() {} };

  const confettiFn = Object.assign((opts) => fired.push(opts), {
    create: () => {
      const inst = (opts) => fired.push(opts);
      inst.reset = () => {};
      return inst;
    },
  });

  const windowMock = {
    confetti: confettiFn,
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(evt) {
      for (const fn of listeners.get(evt.type) || []) fn(evt);
    },
  };

  let loadedMod = null;
  windowMock.__ModuleLoader__ = { load(m) { loadedMod = m; } };

  const sandbox = {
    window: windowMock,
    document: {
      getElementById: () => null,
      createElement: () => canvas,
      body: { appendChild() {} },
      documentElement: { appendChild() {} },
    },
    console,
  };
  vm.runInNewContext(CLIENT_CODE, sandbox);

  const formSubs = new Set();
  let formValue = { pack };
  let cleanup = null;
  loadedMod.factory().apply({
    configForms: {
      get: () => ({
        getSnapshot: () => ({ status: 'ready', value: formValue }),
        subscribe: (fn) => { formSubs.add(fn); return () => formSubs.delete(fn); },
      }),
    },
    effect(fn) {
      cleanup = fn();
      return cleanup;
    },
  });

  return {
    fired,
    async trigger(detail) {
      windowMock.dispatchEvent({ type: 'dsh:confetti', detail });
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
    },
    setPack(next) {
      formValue = { pack: next };
      for (const fn of formSubs) fn();
    },
    dispose() { cleanup?.(); },
  };
}

test('fires confetti with pack defaults and ignores when reduced-motion or pack=false', async () => {
  const h = setupConfetti({
    pack: { colors: ['#ffd700'], particleCount: 90, spread: 60, originY: 0.7 },
    reducedMotion: false,
  });
  await h.trigger();
  assert.equal(h.fired.length, 1);
  assert.deepEqual(h.fired[0].colors, ['#ffd700']);
  assert.equal(h.fired[0].particleCount, 90);

  // Multiple triggers always fire (no cooldown)
  await h.trigger();
  await h.trigger();
  assert.equal(h.fired.length, 3);

  // Disabled via pack: false
  h.setPack(false);
  await h.trigger();
  assert.equal(h.fired.length, 3);
  h.dispose();

  // Reduced motion skips completely
  const rm = setupConfetti({
    pack: { colors: ['#ffd700'], particleCount: 90, spread: 60, originY: 0.7 },
    reducedMotion: true,
  });
  await rm.trigger();
  assert.equal(rm.fired.length, 0);
  rm.dispose();
});
