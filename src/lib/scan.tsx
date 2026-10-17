/**
 * สแกนโค้ดด้วยกล้องมือถือ (รองรับ Data Matrix, QR, บาร์โค้ดทั่วไป)
 *
 * ใช้ 2 ทาง:
 *  1) ตัวอ่านโค้ดที่ติดมากับเบราว์เซอร์ (Android/Chrome) — เร็วและแม่นที่สุด
 *  2) ถ้าเบราว์เซอร์ไม่มี (เช่น iPhone) ค่อยโหลดตัวอ่านสำรองมาใช้ตอนเปิดกล้องเท่านั้น
 *     (ไฟล์ก้อนนี้ไม่ได้ติดไปกับแอปตอนเปิดครั้งแรก)
 */
import { useEffect, useRef, useState } from "react";
import { X, Loader2, CameraOff } from "lucide-react";

type Props = { onResult: (text: string) => void; onClose: () => void };

const FORMATS = ["data_matrix", "qr_code", "code_128", "code_39", "ean_13", "ean_8", "itf"];

/** ตัวอ่านสำรอง — โหลดเมื่อจำเป็น */
async function makeFallbackReader() {
  const z = await import("@zxing/library");
  const reader = new z.MultiFormatReader();
  const hints = new Map();
  hints.set(z.DecodeHintType.POSSIBLE_FORMATS, [
    z.BarcodeFormat.DATA_MATRIX, z.BarcodeFormat.QR_CODE, z.BarcodeFormat.CODE_128,
    z.BarcodeFormat.CODE_39, z.BarcodeFormat.EAN_13, z.BarcodeFormat.EAN_8, z.BarcodeFormat.ITF,
  ]);
  hints.set(z.DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  return (data: ImageData) => {
    const { width: w, height: h, data: px } = data;
    const lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) {
      lum[i] = (px[j] * 306 + px[j + 1] * 601 + px[j + 2] * 117) >> 10; // เทาแบบถ่วงน้ำหนักสายตา
    }
    const bmp = new z.BinaryBitmap(new z.HybridBinarizer(new z.RGBLuminanceSource(lum, w, h)));
    try {
      return reader.decode(bmp).getText();
    } catch {
      return null;
    } finally {
      reader.reset();
    }
  };
}

export function CameraScan({ onResult, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    let stream: MediaStream | null = null;
    let timer = 0;

    const stop = () => {
      dead = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setErr("เครื่องนี้เปิดกล้องผ่านเว็บไม่ได้ ใช้เครื่องสแกนยิงแทนได้เลย");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        const name = (e as DOMException)?.name || "";
        setErr(name === "NotAllowedError"
          ? "ยังไม่ได้อนุญาตให้ใช้กล้อง — เปิดสิทธิ์กล้องให้เว็บนี้ในตั้งค่าเบราว์เซอร์ก่อน"
          : "เปิดกล้องไม่ได้ ลองปิดแอปอื่นที่ใช้กล้องอยู่ แล้วลองใหม่");
        return;
      }
      if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = video.current;
      if (!v) return;
      v.srcObject = stream;
      try { await v.play(); } catch { /* บางเครื่องเล่นเองอยู่แล้ว */ }
      setReady(true);

      // เลือกตัวอ่านโค้ด
      let detect: ((c: HTMLCanvasElement, d: ImageData) => Promise<string | null>) | null = null;
      const BD = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
      if (BD) {
        try {
          const supported: string[] = await BD.getSupportedFormats();
          const use = FORMATS.filter((f) => supported.includes(f));
          if (use.includes("data_matrix")) {
            const d = new BD({ formats: use });
            detect = async (c) => {
              const hit = await d.detect(c);
              return hit?.[0]?.rawValue || null;
            };
          }
        } catch { detect = null; }
      }
      if (!detect) {
        const decode = await makeFallbackReader();
        detect = async (_c, img) => decode(img);
      }
      if (dead) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

      const tick = async () => {
        if (dead || !video.current) return;
        const vw = video.current.videoWidth, vh = video.current.videoHeight;
        if (vw && vh) {
          // ตัดเฉพาะกรอบกลางจอ อ่านแม่นกว่าและเบากว่า
          const side = Math.floor(Math.min(vw, vh) * 0.72);
          const sx = Math.floor((vw - side) / 2), sy = Math.floor((vh - side) / 2);
          canvas.width = side; canvas.height = side;
          ctx.drawImage(video.current, sx, sy, side, side, 0, 0, side, side);
          try {
            const text = await detect!(canvas, ctx.getImageData(0, 0, side, side));
            if (text && !dead) { stop(); onResult(text.trim()); return; }
          } catch { /* เฟรมนี้อ่านไม่ออก อ่านเฟรมถัดไป */ }
        }
        timer = window.setTimeout(tick, 120);
      };
      tick();
    })();

    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-black">
      <div className="flex items-center justify-between px-4 pb-3" style={{ paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
        <div className="font-disp text-[15px] font-bold text-white">สแกนโค้ด</div>
        <button onClick={onClose} aria-label="ปิด"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
          <X size={18} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted autoPlay className="h-full w-full object-cover" />
        {!err && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-[72%] rounded-3xl border-2 border-white/90" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,.45)" }} />
          </div>
        )}
        {!ready && !err && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 size={26} className="animate-spin" />
          </div>
        )}
        {err && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white">
            <CameraOff size={30} className="mb-3 opacity-70" />
            <p className="text-[13.5px] leading-relaxed opacity-90">{err}</p>
          </div>
        )}
      </div>

      <p className="px-8 py-5 text-center text-[12.5px] leading-relaxed text-white/70"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
        เล็งให้โค้ดอยู่ในกรอบ ระบบจะอ่านเองอัตโนมัติ
      </p>
    </div>
  );
}
