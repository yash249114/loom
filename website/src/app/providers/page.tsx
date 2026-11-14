import { Metadata } from "next";
import { SectionLabel } from "@/components/SectionLabel";
import { Reveal } from "@/components/Reveal";
import { CopyButton } from "@/components/CopyButton";

export const metadata: Metadata = {
  title: "Providers — Loom",
  description: "Connect Ollama, OpenRouter, Anthropic, Gemini and any OpenAI-compatible endpoint to Loom.",
};

const configExample = `{
  "providerEndpoints": {
    "ollama": {
      "baseURL": "http://127.0.0.1:11434"
    },
    "openrouter": {
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "\${OPENROUTER_API_KEY}"
    },
    "anthropic": {
      "baseURL": "https://api.anthropic.com/v1",
      "apiKey": "\${ANTHROPIC_API_KEY}"
    },
    "gemini": {
      "baseURL": "https://generativelanguage.googleapis.com/v1beta/openai/",
      "apiKey": "\${GEMINI_API_KEY}"
    },
    "custom-openai": {
      "baseURL": "http://localhost:1234/v1",
      "apiKey": "not-needed"
    }
  }
}`;

const adapters = [
  ["ollama", "Ollama (local)", "Native adapter. No key required."],
  ["openai-compatible", "OpenRouter, Groq, DeepSeek, Mistral, LM Studio, vLLM, llama.cpp, custom servers", "One adapter, many endpoints."],
  ["anthropic", "Anthropic Claude", "Native tool calling."],
  ["google", "Google Gemini", "Google's OpenAI-compatible endpoint."],
];

const providers = [
  {
    name: "Ollama",
    kind: "Local",
    desc: "Run models on your own machine. No API key and no network calls.",
    endpoint: "http://127.0.0.1:11434",
    env: null,
    steps: [
      "Install Ollama from ollama.com/download.",
      "Pull a coding model: ollama pull qwen2.5-coder:7b.",
      "Loom discovers Ollama at the default endpoint; override it in .loomrc.json if needed.",
      "Run locally with: loom run --local \"your prompt\".",
    ],
  },
  {
    name: "OpenRouter",
    kind: "OpenAI-compatible",
    desc: "One key for many hosted models, including free-tier options.",
    endpoint: "https://openrouter.ai/api/v1",
    env: "OPENROUTER_API_KEY",
    steps: [
      "Create a key at openrouter.ai/keys.",
      "Export OPENROUTER_API_KEY in your shell.",
      "Optionally set a referer and title header in providerEndpoints.",
      "Verify with: loom providers.",
    ],
  },
  {
    name: "Anthropic",
    kind: "Native",
    desc: "Direct access to Claude models with native tool calling.",
    endpoint: "https://api.anthropic.com/v1",
    env: "ANTHROPIC_API_KEY",
    steps: [
      "Create a key in the Anthropic console.",
      "Export ANTHROPIC_API_KEY.",
      "Verify with: loom models --provider anthropic.",
    ],
  },
  {
    name: "Google Gemini",
    kind: "OpenAI-compatible",
    desc: "Gemini models through Google's OpenAI-compatible endpoint.",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/",
    env: "GEMINI_API_KEY",
    steps: [
      "Create a key in Google AI Studio.",
      "Export GEMINI_API_KEY.",
      "Verify with: loom providers.",
    ],
  },
  {
    name: "Custom endpoint",
    kind: "OpenAI-compatible",
    desc: "LM Studio, vLLM, llama.cpp server, LocalAI or your own proxy.",
    endpoint: "http://localhost:1234/v1 (example)",
    env: "OPENAI_API_KEY (often optional locally)",
    steps: [
      "Start the server and note its base URL, usually ending in /v1.",
      "Add it under providerEndpoints with type openai.",
      "API keys are optional for most local servers.",
    ],
  },
];

export default function ProvidersPage() {
  return (
    <div className="bg-cream min-h-screen">
      <div className="mx-auto max-w-[1400px] px-6 py-16 lg:py-24">
        <Reveal>
          <SectionLabel number="—" label="Providers" />
          <h1 className="mt-6 max-w-2xl font-display-medium text-4xl leading-[0.95] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Bring the models you already trust
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink/65">
            Four adapter implementations cover local Ollama, OpenAI-compatible
            APIs, Anthropic and Gemini. Everything else reaches Loom through the
            OpenAI-compatible layer.
          </p>
        </Reveal>

        <section className="mt-16">
          <Reveal>
            <h2 className="font-display-medium text-2xl text-ink">Adapters</h2>
          </Reveal>
          <Reveal className="mt-6 overflow-x-auto">
            <table className="w-full border-t section-rule text-sm">
              <thead>
                <tr className="border-b section-rule">
                  <th scope="col" className="label py-3 pr-6 text-left text-accent">Adapter</th>
                  <th scope="col" className="label py-3 pr-6 text-left text-accent">Covers</th>
                  <th scope="col" className="label py-3 text-left text-accent">Notes</th>
                </tr>
              </thead>
              <tbody>
                {adapters.map(([adapter, covers, note]) => (
                  <tr key={adapter} className="border-b section-rule">
                    <td className="whitespace-nowrap py-4 pr-6 font-mono text-copper-dark">{adapter}</td>
                    <td className="py-4 pr-6 text-ink/70">{covers}</td>
                    <td className="py-4 text-ink/55">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <Reveal className="mt-4">
            <p className="max-w-2xl text-xs text-ink/45">
              Model discovery and capability metadata are heuristic. Loom never
              claims provider-reported benchmarks.
            </p>
          </Reveal>
        </section>

        <section className="mt-20">
          <Reveal>
            <h2 className="font-display-medium text-2xl text-ink">Setup guides</h2>
          </Reveal>
          <div className="mt-8 grid gap-px border section-rule bg-[color:var(--section-hairline)] md:grid-cols-2">
            {providers.map((provider) => (
              <Reveal key={provider.name} className="bg-cream p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display-medium text-xl text-ink">{provider.name}</h3>
                  <span className="border border-copper/40 px-2 py-0.5 label-sm text-copper-dark">
                    {provider.kind}
                  </span>
                </div>
                <p className="mt-3 text-sm text-ink/65">{provider.desc}</p>
                <dl className="mt-4 space-y-2 text-xs">
                  <div>
                    <dt className="label-sm text-accent">Endpoint</dt>
                    <dd className="mt-1 break-all font-mono text-ink/60">{provider.endpoint}</dd>
                  </div>
                  {provider.env && (
                    <div>
                      <dt className="label-sm text-accent">Key</dt>
                      <dd className="mt-1 font-mono text-ink/60">{provider.env}</dd>
                    </div>
                  )}
                </dl>
                <ol className="mt-4 space-y-2 text-sm text-ink/65">
                  {provider.steps.map((step) => (
                    <li key={step} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 flex-shrink-0 bg-copper" aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </Reveal>
            ))}
            <Reveal className="bg-cream p-6">
              <h3 className="font-display-medium text-xl text-ink">Not sure it connects?</h3>
              <p className="mt-3 text-sm text-ink/65">
                Run the doctor to check configuration, provider connectivity and
                Ollama status in one pass.
              </p>
              <pre className="mt-4 overflow-x-auto border section-rule p-3 font-mono text-xs text-ink/70">
                <code>{`loom providers
loom doctor`}</code>
              </pre>
            </Reveal>
          </div>
        </section>

        <section className="mt-20">
          <Reveal>
            <h2 className="font-display-medium text-2xl text-ink">Configuration</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/55">
              Endpoints live in <code className="bg-ink/10 px-1 font-mono">.loomrc.json</code> at
              the workspace root or your home directory. Values in{" "}
              <code className="bg-ink/10 px-1 font-mono">${"{VAR}"}</code> are read from the
              environment at load time.
            </p>
          </Reveal>
          <Reveal className="relative mt-6 border section-rule p-6">
            <CopyButton text={configExample} className="absolute right-4 top-4" />
            <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-ink/75">
              <code>{configExample}</code>
            </pre>
          </Reveal>
        </section>

        <section className="mt-20">
          <Reveal>
            <h2 className="font-display-medium text-2xl text-ink">Caveats worth knowing</h2>
          </Reveal>
          <div className="mt-6 grid gap-px border section-rule bg-[color:var(--section-hairline)] md:grid-cols-2">
            {[
              {
                title: "Model metadata is inferred",
                desc: "Context windows and capability tags come from name patterns, not provider APIs.",
              },
              {
                title: "Tool calling depends on the model",
                desc: "Ollama models vary. qwen2.5-coder and llama3.1+ work best.",
              },
              {
                title: "No built-in rate-limit backoff",
                desc: "Rate limits are handled by the fallback chain, not a retry policy.",
              },
              {
                title: "Local fallback is opt-in",
                desc: "The third fallback tier runs only when fallbackToLocal is enabled.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-cream p-6">
                <h3 className="font-medium text-ink">{item.title}</h3>
                <p className="mt-2 text-sm text-ink/65">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <Reveal>
            <h2 className="font-display-medium text-2xl text-ink">Everything else</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/55">
              Not native adapters. These work through an OpenAI-compatible
              endpoint today, either directly or via OpenRouter.
            </p>
          </Reveal>
          <div className="mt-6 grid gap-px border section-rule bg-[color:var(--section-hairline)] sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Groq", "Via OpenRouter or direct OpenAI-compatible"],
              ["DeepSeek", "Via OpenRouter or direct OpenAI-compatible"],
              ["Mistral", "Via OpenRouter or direct OpenAI-compatible"],
              ["LM Studio", "Local OpenAI-compatible server"],
              ["vLLM", "Local OpenAI-compatible server"],
              ["llama.cpp server", "Local OpenAI-compatible server"],
              ["Azure OpenAI", "OpenAI-compatible"],
              ["Together AI", "Via OpenRouter"],
              ["Fireworks AI", "Via OpenRouter"],
              ["AWS Bedrock", "Planned native adapter"],
              ["Google Vertex AI", "Planned native adapter"],
              ["Cohere / xAI", "Planned native adapters"],
            ].map(([name, access]) => (
              <div key={name} className="bg-cream p-5">
                <h3 className="text-sm font-medium text-ink">{name}</h3>
                <p className="mt-1 text-xs text-ink/50">{access}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
