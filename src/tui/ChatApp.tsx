import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { Agent } from "../agent/agent.js";
import { SafetyGate } from "../safety/gate.js";
import { createProvider } from "../providers/factory.js";
import { resolveProvider } from "../config/loader.js";
import type {
  LoomConfig,
  Provider,
  Message,
  ToolCall,
  ToolResult,
} from "../core/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { SessionStore } from "../session/store.js";
import type { Session } from "../core/types.js";

interface Props {
  config: LoomConfig;
  provider: Provider;
  providerKey: string;
  registry: ToolRegistry;
  sessions: SessionStore;
  session: Session;
  workspaceRoot: string;
  workspaceContext: string;
  forceLocal?: boolean;
}

interface UIMessage {
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  meta?: string;
}

interface PendingConfirm {
  id: number;
  message: string;
  resolve: (ok: boolean) => void;
}

export const ChatApp: React.FC<Props> = (props) => {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamBuf, setStreamBuf] = useState("");
  const [provider, setProvider] = useState<Provider>(props.provider);
  const [providerKey, setProviderKey] = useState(props.providerKey);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null
  );
  const [autoApprove, setAutoApprove] = useState(false);
  const [sandbox, setSandbox] = useState(props.config.safety.sandbox);
  const [tokenCount, setTokenCount] = useState(0);
  const [routeInfo, setRouteInfo] = useState("");

  const confirmIdRef = useRef(0);

  const safety = useMemo(
    () =>
      new SafetyGate(
        { ...props.config.safety, sandbox },
        (msg) =>
          new Promise<boolean>((resolve) => {
            const id = ++confirmIdRef.current;
            setPendingConfirm({ id, message: msg, resolve });
          }),
        autoApprove
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoApprove, sandbox]
  );

  const agentRef = useRef<Agent | null>(null);

  useEffect(() => {
    const agent = new Agent({
      provider,
      registry: props.registry,
      safety,
      config: props.config,
      workspaceRoot: props.workspaceRoot,
      workspaceContext: props.workspaceContext,
      forceLocal: props.forceLocal,
    });
    agentRef.current = agent;

    agent.onTyped("stream:delta", (d) => {
      setStreamBuf((b) => b + d);
      setTokenCount((t) => t + Math.ceil(d.length / 4));
    });
    agent.onTyped("stream:done", () => {
      setStreamBuf("");
    });
    agent.onTyped("log", (msg) => {
      // Capture routing decisions for display
      if (msg.startsWith("[router]")) {
        setRouteInfo(msg.slice(9).trim());
      }
    });
    agent.onTyped("tool:call", (c: ToolCall) => {
      setMessages((m) => [
        ...m,
        {
          role: "system",
          text: `→ ${c.name}`,
          meta: JSON.stringify(c.arguments).slice(0, 200),
        },
      ]);
    });
    agent.onTyped("tool:result", (r: ToolResult) => {
      const head = r.output.split("\n").slice(0, 6).join("\n");
      setMessages((m) => [
        ...m,
        {
          role: "tool",
          text: r.ok ? `✓ ${r.name}` : `✗ ${r.name}: ${r.error}`,
          meta: r.ok ? head : undefined,
        },
      ]);
    });
    agent.onTyped("agent:error", (e) => {
      setMessages((m) => [
        ...m,
        { role: "system", text: `error: ${e.message}` },
      ]);
    });

    // Load history from session
    if (props.session.messages.length) {
      agent.loadHistory(props.session.messages as Message[]);
      setMessages(
        props.session.messages.map(
          (m): UIMessage => ({
            role: m.role === "tool" ? "tool" : (m.role as UIMessage["role"]),
            text: m.content,
          })
        )
      );
    }

    return () => {
      agent.removeAllListeners();
    };
  }, [provider, safety]);

  // Global input: Escape aborts streaming
  useInput((_input, key) => {
    if (key.escape && streaming) {
      agentRef.current?.abort();
    }
  });

  // Confirm dialog input — only active when a confirm is pending
  useInput(
    (ch) => {
      if (!pendingConfirm) return;
      if (ch === "y" || ch === "Y") handleConfirm(true);
      else if (ch === "n" || ch === "N" || ch === "\u001b") handleConfirm(false);
      else if (ch === "a" || ch === "A") {
        setAutoApprove(true);
        handleConfirm(true);
      }
    },
    { isActive: !!pendingConfirm }
  );

  const handleConfirm = (ok: boolean) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(ok);
      setPendingConfirm(null);
    }
  };

  const onSubmit = async (raw: string) => {
    if (!raw.trim()) return;
    setInput("");

    if (raw.startsWith("/")) {
      handleSlash(raw.trim());
      return;
    }

    setMessages((m) => [...m, { role: "user", text: raw }]);
    setStreaming(true);

    try {
      const final = await agentRef.current!.run(raw);
      setMessages((m) => [...m, { role: "assistant", text: final }]);
      // Persist session
      await props.sessions.update(
        props.session.id,
        agentRef.current!.history
      );
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "system", text: `error: ${e.message}` },
      ]);
    } finally {
      setStreaming(false);
      setStreamBuf("");
    }
  };

  const handleSlash = (cmd: string) => {
    const [name, ...rest] = cmd.slice(1).split(/\s+/);
    const arg = rest.join(" ");
    switch (name) {
      case "exit":
      case "quit":
        exit();
        break;
      case "help":
        setMessages((m) => [...m, { role: "system", text: HELP_TEXT }]);
        break;
      case "clear":
        setMessages([]);
        agentRef.current?.loadHistory([]);
        break;
      case "model": {
        try {
          const { key, cfg } = resolveProvider(props.config, arg || undefined);
          const np = createProvider(key, cfg);
          setProvider(np);
          setProviderKey(key);
          setMessages((m) => [
            ...m,
            {
              role: "system",
              text: `switched to ${key} (${np.model})`,
            },
          ]);
        } catch (e: any) {
          setMessages((m) => [
            ...m,
            { role: "system", text: `error: ${e.message}` },
          ]);
        }
        break;
      }
      case "save":
        props.sessions.update(props.session.id, agentRef.current!.history);
        setMessages((m) => [
          ...m,
          { role: "system", text: `saved session ${props.session.id}` },
        ]);
        break;
      case "tools":
        setMessages((m) => [
          ...m,
          { role: "system", text: props.registry.describe() },
        ]);
        break;
      case "sandbox":
        setSandbox((s) => {
          const next = !s;
          setMessages((m) => [
            ...m,
            { role: "system", text: `sandbox ${next ? "ON" : "OFF"}` },
          ]);
          return next;
        });
        break;
      case "yolo":
        setAutoApprove((a) => {
          const next = !a;
          setMessages((m) => [
            ...m,
            { role: "system", text: `auto-approve ${next ? "ON" : "OFF"}` },
          ]);
          return next;
        });
        break;
      default:
        setMessages((m) => [
          ...m,
          { role: "system", text: `unknown command: /${name}` },
        ]);
    }
  };

  return (
    <Box flexDirection="column">
      {/* Header bar */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          ⌬ Loom
        </Text>
        <Text> · </Text>
        <Text color="green">{providerKey}</Text>
        <Text color="gray"> ({provider.model})</Text>
        <Text color="gray">  ·  ws: {shortenPath(props.workspaceRoot)}</Text>
        <Text color="gray">  ·  msgs: {messages.length}</Text>
        <Text color="gray">  ·  ~tok: {tokenCount}</Text>
        {routeInfo && <Text color="gray">  ·  {routeInfo}</Text>}
        {sandbox && <Text color="yellow">  · SANDBOX</Text>}
        {autoApprove && <Text color="red">  · YOLO</Text>}
      </Box>

      {/* Message history */}
      <Box flexDirection="column" paddingX={1}>
        {messages.map((m, i) => (
          <MessageView key={i} m={m} />
        ))}
        {streaming && streamBuf && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="magenta">assistant:</Text>
            <Text>{streamBuf}</Text>
          </Box>
        )}
        {streaming && !streamBuf && (
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text color="gray"> thinking…</Text>
          </Box>
        )}
      </Box>

      {/* Confirm dialog or input box */}
      {pendingConfirm ? (
        <Box
          borderStyle="round"
          borderColor="yellow"
          paddingX={1}
          marginTop={1}
        >
          <Text color="yellow">[confirm] {pendingConfirm.message} </Text>
          <Text color="gray">  (y)es / (n)o / (a)lways</Text>
        </Box>
      ) : (
        <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
          <Text color="cyan">› </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={onSubmit}
            placeholder={
              streaming ? "(esc to abort)" : "Ask Loom anything, or /help"
            }
          />
        </Box>
      )}
    </Box>
  );
};

const MessageView: React.FC<{ m: UIMessage }> = ({ m }) => {
  if (m.role === "user") {
    return (
      <Box marginTop={1}>
        <Text color="cyan" bold>
          you › {" "}
        </Text>
        <Text>{m.text}</Text>
      </Box>
    );
  }
  if (m.role === "assistant") {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text color="magenta" bold>
          assistant:
        </Text>
        <Text>{m.text}</Text>
      </Box>
    );
  }
  if (m.role === "tool") {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text color="green">{m.text}</Text>
        {m.meta && <Text color="gray">{m.meta}</Text>}
      </Box>
    );
  }
  // system / log messages
  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="yellow">{m.text}</Text>
      {m.meta && <Text color="gray">  {m.meta}</Text>}
    </Box>
  );
};

const HELP_TEXT = `Slash commands:
  /help          Show this help
  /model <key>   Switch provider (alias or name)
  /clear         Clear current conversation
  /save          Persist session
  /tools         List registered tools
  /sandbox       Toggle sandbox mode (no shell exec)
  /yolo          Toggle auto-approve all confirmations
  /exit          Quit
Esc aborts streaming.`;

function shortenPath(p: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return home && p.startsWith(home) ? "~" + p.slice(home.length) : p;
}
