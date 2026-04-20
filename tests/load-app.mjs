import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function createElementStub() {
  return {
    value: "",
    innerHTML: "",
    textContent: "",
    width: 0,
    height: 0,
    className: "",
    files: [],
    style: {},
    disabled: false,
    title: "",
    parentNode: { insertAdjacentElement() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    insertAdjacentElement() {},
    insertBefore() {},
    remove() {},
    setAttribute() {},
    replaceChildren() {},
    closest() {
      return {
        querySelector() {
          return createElementStub();
        },
        parentNode: { insertBefore() {} },
        classList: { add() {} },
      };
    },
    querySelector() {
      return createElementStub();
    },
    addEventListener() {},
    getContext() {
      return {
        clearRect() {},
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        ellipse() {},
        fill() {},
        stroke() {},
        closePath() {},
        fillRect() {},
        strokeRect() {},
        setLineDash() {},
        fillText() {},
      };
    },
    click() {},
  };
}

export function loadApp({ includeUi = false, includeLegacy = false } = {}) {
  const projectRoot = path.resolve(process.cwd());
  const sources = [
    fs.readFileSync(path.join(projectRoot, "simulation.js"), "utf8"),
    fs.readFileSync(path.join(projectRoot, "js", "simulation-febio.js"), "utf8"),
  ];
  if (includeUi) {
    sources.push(fs.readFileSync(path.join(projectRoot, "js", "simulation-ui.js"), "utf8"));
  }
  if (includeLegacy) {
    sources.push(fs.readFileSync(path.join(projectRoot, "js", "simulation-legacy.js"), "utf8"));
  }

  const documentStub = {
    querySelector() {
      return createElementStub();
    },
    createElement() {
      return createElementStub();
    },
  };

  const sandbox = {
    console,
    document: documentStub,
    window: { document: documentStub, __NUCLEAR_SIMU_SKIP_AUTO_INIT__: true },
    Blob: function Blob(parts, opts) {
      this.parts = parts;
      this.opts = opts;
    },
    URL: {
      createObjectURL() {
        return "blob:mock";
      },
      revokeObjectURL() {},
    },
    structuredClone: globalThis.structuredClone,
    setTimeout,
    clearTimeout,
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
    performance: { now() { return 0; } },
    FileReader: function FileReader() {},
    fetch: async () => ({ ok: false, json: async () => ({ ok: false, error: "offline" }) }),
  };

  vm.createContext(sandbox);
  vm.runInContext(sources.join("\n"), sandbox, { filename: "app-bundle.js" });
  return sandbox;
}
