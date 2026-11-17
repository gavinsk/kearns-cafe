// Kearns Café — QR code scanner using the iPad camera (jsQR does the decoding).
// Use: const s = Scanner.open(containerElement, (text) => keepScanning?); ... s.stop();
// The callback returns true to keep scanning, false to stop.

window.Scanner = (function () {
  "use strict";

  let facing = "user";   // front camera faces the customer (like a Square stand)

  function open(container, onResult) {
    let stream = null;
    let stopped = false;
    let timer = null;
    let lastText = "";
    let lastTime = 0;

    container.innerHTML = `
      <div class="scan-box">
        <video class="scan-video" playsinline muted autoplay></video>
        <div class="scan-frame"><i></i><i></i><i></i><i></i></div>
        <div class="scan-error hidden"></div>
      </div>
      <button class="btn-small scan-flip">🔄 Switch camera</button>`;
    const video = container.querySelector("video");
    const errorBox = container.querySelector(".scan-error");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    container.querySelector(".scan-flip").onclick = () => {
      facing = facing === "user" ? "environment" : "user";
      startCamera();
    };

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.classList.remove("hidden");
    }

    function stopCamera() {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    async function startCamera() {
      stopCamera();
      errorBox.classList.add("hidden");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError("This device can't use the camera here. (It needs to be opened from the https:// website.)");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) { stopCamera(); return; }
        video.srcObject = stream;
        video.classList.toggle("mirror", facing === "user");
        await video.play().catch(() => {});
      } catch (e) {
        showError("Camera is blocked. Ask a grown-up to allow camera access for this app in Settings, then try again.");
      }
    }

    function tick() {
      if (stopped) return;
      if (video.readyState >= 2 && video.videoWidth) {
        // Shrink the frame first: much faster to scan, and plenty sharp for a card
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code && code.data) {
          const now = Date.now();
          // Don't report the same wrong code over and over
          if (code.data !== lastText || now - lastTime > 2000) {
            lastText = code.data;
            lastTime = now;
            const keepGoing = onResult(code.data);
            if (!keepGoing) { api.stop(); return; }
          }
        }
      }
      timer = setTimeout(tick, 150);
    }

    const api = {
      stop() {
        stopped = true;
        clearTimeout(timer);
        stopCamera();
        video.srcObject = null;
      },
    };

    startCamera();
    tick();
    return api;
  }

  return { open };
})();
