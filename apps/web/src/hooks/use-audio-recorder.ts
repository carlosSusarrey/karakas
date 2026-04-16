"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioRecorderOptions {
  chunkIntervalMs?: number;
  onChunkReady: (chunk: Blob) => void;
  onError: (error: string) => void;
}

export function useAudioRecorder({
  chunkIntervalMs = 5 * 60 * 1000,
  onChunkReady,
  onError,
}: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setIsSupported(
      typeof MediaRecorder !== "undefined" &&
        typeof navigator?.mediaDevices?.getUserMedia === "function"
    );
  }, []);

  const flushChunk = useCallback(() => {
    if (chunksRef.current.length > 0) {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      if (blob.size > 0) {
        onChunkReady(blob);
      }
    }
  }, [onChunkReady]);

  const startNewRecorder = useCallback(
    (stream: MediaStream) => {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      // Schedule chunk flush by stopping and restarting
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          recorder.onstop = () => {
            flushChunk();
            // Start a new recorder for the next chunk
            if (streamRef.current && streamRef.current.active) {
              startNewRecorder(streamRef.current);
            }
          };
        }
      }, chunkIntervalMs);
    },
    [chunkIntervalMs, flushChunk]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);
      startNewRecorder(stream);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        onError("Microphone permission denied");
      } else {
        onError("Failed to start recording");
      }
    }
  }, [startNewRecorder, onError]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      recorder.onstop = () => {
        flushChunk();
      };
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, [flushChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { isRecording, isSupported, startRecording, stopRecording };
}
