import React, { useState, useEffect } from "react";
import { Text } from "ink";

const DOTS_FRAMES = ["", ".", "..", "..."];
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const PULSE_FRAMES = ["█", "▓", "▒", "░"];

export function Dots({ label = "Loading" }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % DOTS_FRAMES.length), 300);
    return () => clearInterval(t);
  }, []);
  return <Text>{label}{DOTS_FRAMES[i]}</Text>;
}

export function Spinner({ label = "" }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(t);
  }, []);
  return <Text>{SPINNER_FRAMES[i]} {label}</Text>;
}

export function TypingIndicator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % DOTS_FRAMES.length), 400);
    return () => clearInterval(t);
  }, []);
  return <Text color="gray">assistant is typing{DOTS_FRAMES[i]}</Text>;
}

export function AgentActivity({ label = "Agent working" }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % SPINNER_FRAMES.length), 100);
    return () => clearInterval(t);
  }, []);
  return <Text>{SPINNER_FRAMES[i]} {label}</Text>;
}
