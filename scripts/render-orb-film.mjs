#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FPS = Number(process.env.FILM_FPS ?? 30);
const DURATION = 12.4;
const SOURCE_URL = process.env.FILM_URL ?? "http://127.0.0.1:3000/builds/muse-desk-orb/film?render=1";
const OUTPUT = resolve(
  process.env.FILM_OUTPUT ?? join(ROOT, "site/public/builds/muse-desk-orb/concept-demo.mp4"),
);
const POSTER = resolve(
  process.env.FILM_POSTER ?? join(ROOT, "site/public/builds/muse-desk-orb/concept-poster.webp"),
);
const CHROME = process.env.CHROME_PATH ?? (
  process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome"
);

const workspace = await mkdtemp(join(tmpdir(), "hackshop-orb-film-"));
const frames = join(workspace, "frames");
const profile = join(workspace, "chrome-profile");
await mkdir(frames, { recursive: true });
await mkdir(profile, { recursive: true });
await mkdir(dirname(OUTPUT), { recursive: true });
await mkdir(dirname(POSTER), { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  "--hide-scrollbars",
  "--mute-audio",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--no-first-run",
  "--no-default-browser-check",
  "--force-device-scale-factor=1",
  "--window-size=1920,1080",
  "--remote-debugging-port=9223",
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

function wait(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchJson(url, init) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  throw lastError ?? new Error(`Could not reach ${url}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const callback = this.pending.get(message.id);
      if (!callback) return;
      this.pending.delete(message.id);
      if (message.error) callback.reject(new Error(message.error.message));
      else callback.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

try {
  await fetchJson("http://127.0.0.1:9223/json/version");
  const target = await fetchJson(
    "http://127.0.0.1:9223/json/new?about%3Ablank",
    { method: "PUT" },
  );
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const cdp = new CdpClient(socket);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Emulation.setVisibleSize", { width: 1920, height: 1080 });
  await cdp.send("Page.navigate", { url: SOURCE_URL });

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: "Boolean(window.__hackshopFilmReady && window.__hackshopFilmSetTime)",
      returnByValue: true,
    });
    if (result.result?.value) break;
    if (attempt === 199) throw new Error("Film route did not become ready");
    await wait(100);
  }

  const viewport = await cdp.send("Runtime.evaluate", {
    expression: "JSON.stringify({innerWidth,innerHeight,devicePixelRatio,film:document.querySelector('main')?.getBoundingClientRect().toJSON(),canvas:document.querySelector('canvas')?.getBoundingClientRect().toJSON()})",
    returnByValue: true,
  });
  process.stdout.write(`Viewport ${viewport.result?.value}\n`);

  const totalFrames = Math.round(DURATION * FPS);
  for (let index = 0; index < totalFrames; index += 1) {
    const seconds = index / FPS;
    await cdp.send("Runtime.evaluate", {
      expression: `window.__hackshopFilmSetTime(${seconds})`,
      awaitPromise: true,
    });
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const filename = join(frames, `frame-${String(index).padStart(4, "0")}.png`);
    await writeFile(filename, Buffer.from(shot.data, "base64"));
    if (index % FPS === 0) process.stdout.write(`Rendered ${Math.round(seconds)}s / ${DURATION}s\r`);
  }
  process.stdout.write(`Rendered ${DURATION}s / ${DURATION}s\n`);
  socket.close();

  await run("ffmpeg", [
    "-y",
    "-framerate", String(FPS),
    "-i", join(frames, "frame-%04d.png"),
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "16",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    OUTPUT,
  ]);
  await run("ffmpeg", [
    "-y",
    "-ss", "1.8",
    "-i", OUTPUT,
    "-frames:v", "1",
    "-c:v", "libwebp",
    "-quality", "90",
    POSTER,
  ]);
  process.stdout.write(`${OUTPUT}\n${POSTER}\n`);
} finally {
  chrome.kill("SIGTERM");
  await Promise.race([
    new Promise((resolvePromise) => chrome.once("exit", resolvePromise)),
    wait(1500),
  ]);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await rm(workspace, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await wait(250);
    }
  }
}
