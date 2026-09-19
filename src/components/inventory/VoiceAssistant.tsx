import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, Loader2, Keyboard, Send } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { runVoiceAssistant, type VoiceTurn } from "@/lib/voice-assistant.functions";

type Mode = "idle" | "recording" | "thinking";

export function VoiceAssistant() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [history, setHistory] = useState<VoiceTurn[]>([]);
  const [typed, setTyped] = useState("");
  const [showText, setShowText] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, mode]);

  function stopMic() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        stopMic();
        await sendAudio(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setMode("recording");
    } catch (e: any) {
      toast.error(e?.message ?? "Microphone unavailable");
      setMode("idle");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function sendAudio(blob: Blob) {
    setMode("thinking");
    try {
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const base64 = btoa(bin);
      const res = await runVoiceAssistant({
        data: { audioBase64: base64, mimeType: blob.type, history },
      });
      setHistory(res.history);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Voice command failed");
    } finally {
      setMode("idle");
    }
  }

  async function sendText() {
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    setMode("thinking");
    try {
      const res = await runVoiceAssistant({ data: { text, history } });
      setHistory(res.history);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Voice command failed");
    } finally {
      setMode("idle");
    }
  }

  function close() {
    if (mode === "recording") stopRecording();
    stopMic();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 transition-transform flex items-center justify-center"
        title="Voice assistant"
        aria-label="Open voice assistant"
      >
        <Mic className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[min(380px,calc(100vw-2.5rem))] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                mode === "recording" && "animate-ping bg-destructive",
                mode === "thinking" && "animate-ping bg-primary",
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                mode === "recording" ? "bg-destructive" : mode === "thinking" ? "bg-primary" : "bg-muted-foreground",
              )}
            />
          </span>
          <span className="text-sm font-medium">Inventory voice assistant</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="px-4 py-3 max-h-[40vh] overflow-y-auto space-y-2 text-sm">
        {history.length === 0 && mode === "idle" && (
          <div className="text-muted-foreground text-xs space-y-1">
            <p className="font-medium text-foreground">Try saying:</p>
            <p>• “Add 50 of resistor 10K to drawer A”</p>
            <p>• “Remove 5 of LM358 from main stock”</p>
            <p>• “Assign 3 ESP32 to Rahul for project Falcon”</p>
            <p>• “How many BC547 do I have?”</p>
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap",
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-muted",
            )}
          >
            {m.content}
          </div>
        ))}
        {mode === "thinking" && (
          <div className="mr-auto bg-muted rounded-2xl px-3 py-2 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
          </div>
        )}
      </div>

      <div className="border-t bg-muted/30 p-3 space-y-2">
        {showText ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText();
            }}
            className="flex items-center gap-2"
          >
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type a command…"
              disabled={mode === "thinking"}
            />
            <Button type="submit" size="icon" disabled={mode === "thinking" || !typed.trim()}>
              <Send className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => setShowText(false)}>
              <Mic className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={mode === "recording" ? stopRecording : startRecording}
              disabled={mode === "thinking"}
              className={cn(
                "flex-1 gap-2",
                mode === "recording" && "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
              )}
            >
              {mode === "recording" ? (
                <>
                  <Square className="h-4 w-4" /> Stop & send
                </>
              ) : mode === "thinking" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Working…
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" /> Hold to speak
                </>
              )}
            </Button>
            <Button size="icon" variant="outline" onClick={() => setShowText(true)} title="Type instead">
              <Keyboard className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground text-center">
          Actions run under your account and respect inventory permissions.
        </p>
      </div>
    </div>
  );
}
