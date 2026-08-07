/**
 * Agent Chain — Sequential pipeline orchestrator
 *
 * Runs opinionated, repeatable agent workflows. Chains are defined in
 * .pi/agents/agent-chain.yaml — each chain is a sequence of agent steps
 * with prompt templates. The user's original prompt flows into step 1,
 * the output becomes $INPUT for step 2's prompt template, and so on.
 * $ORIGINAL is always the user's original prompt.
 *
 * The primary Pi agent has NO codebase tools — it can ONLY kick off the
 * pipeline via the `run_chain` tool. On boot you select a chain; the
 * agent decides when to run it based on the user's prompt.
 *
 * Agents maintain session context within a Pi session — re-running the
 * chain lets each agent resume where it left off.
 *
 * Commands:
 *   /chain             — switch active chain
 *   /chain-list        — list all available chains
 *
 * Usage: pi -e ai/extensions/agent-chain.ts
 */

import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

// ── Types ────────────────────────────────────────

interface ChainStep {
	agent: string;
	prompt: string;
}

interface ChainDef {
	name: string;
	description: string;
	steps: ChainStep[];
}

interface AgentDef {
	name: string;
	description: string;
	tools: string;
	systemPrompt: string;
}

interface StepState {
	agent: string;
	status: "pending" | "running" | "done" | "error";
	elapsed: number;
	lastWork: string;
}

// ── Display Name Helper ──────────────────────────

function displayName(name: string): string {
	return name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function sessionKey(name: string): string {
	return name.toLowerCase().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = basename(process.execPath).toLowerCase();
	if (!/^(node|bun)(\.exe)?$/.test(execName)) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

// ── Chain YAML Parser ────────────────────────────

function parseChainYaml(raw: string): ChainDef[] {
	const chains: ChainDef[] = [];
	let current: ChainDef | null = null;
	let currentStep: ChainStep | null = null;

	for (const line of raw.split("\n")) {
		// Chain name: top-level key
		const chainMatch = line.match(/^(\S[^:]*):$/);
		if (chainMatch) {
			if (current && currentStep) {
				current.steps.push(currentStep);
				currentStep = null;
			}
			current = { name: chainMatch[1].trim(), description: "", steps: [] };
			chains.push(current);
			continue;
		}

		// Chain description
		const descMatch = line.match(/^\s+description:\s+(.+)$/);
		if (descMatch && current && !currentStep) {
			let desc = descMatch[1].trim();
			if ((desc.startsWith('"') && desc.endsWith('"')) ||
				(desc.startsWith("'") && desc.endsWith("'"))) {
				desc = desc.slice(1, -1);
			}
			current.description = desc;
			continue;
		}

		// "steps:" label — skip
		if (line.match(/^\s+steps:\s*$/) && current) {
			continue;
		}

		// Step agent line
		const agentMatch = line.match(/^\s+-\s+agent:\s+(.+)$/);
		if (agentMatch && current) {
			if (currentStep) {
				current.steps.push(currentStep);
			}
			currentStep = { agent: agentMatch[1].trim(), prompt: "" };
			continue;
		}

		// Step prompt line
		const promptMatch = line.match(/^\s+prompt:\s+(.+)$/);
		if (promptMatch && currentStep) {
			let prompt = promptMatch[1].trim();
			if ((prompt.startsWith('"') && prompt.endsWith('"')) ||
				(prompt.startsWith("'") && prompt.endsWith("'"))) {
				prompt = prompt.slice(1, -1);
			}
			prompt = prompt.replace(/\\n/g, "\n");
			currentStep.prompt = prompt;
			continue;
		}
	}

	if (current && currentStep) {
		current.steps.push(currentStep);
	}

	return chains;
}

// ── Frontmatter Parser ───────────────────────────

function parseAgentFile(filePath: string): AgentDef | null {
	try {
		const raw = readFileSync(filePath, "utf-8");
		const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
		if (!match) return null;

		const frontmatter: Record<string, string> = {};
		for (const line of match[1].split("\n")) {
			const idx = line.indexOf(":");
			if (idx > 0) {
				frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
			}
		}

		if (!frontmatter.name) return null;

		return {
			name: frontmatter.name,
			description: frontmatter.description || "",
			tools: frontmatter.tools || "read,grep,find,ls",
			systemPrompt: match[2].trim(),
		};
	} catch {
		return null;
	}
}

function scanAgentDirs(cwd: string): Map<string, AgentDef> {
	const dirs = [
		join(cwd, "agents"),
		join(cwd, ".claude", "agents"),
		join(cwd, CONFIG_DIR_NAME, "agents"),
	];

	const agents = new Map<string, AgentDef>();

	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		try {
			for (const file of readdirSync(dir)) {
				if (!file.endsWith(".md")) continue;
				const fullPath = resolve(dir, file);
				const def = parseAgentFile(fullPath);
				if (def && !agents.has(def.name.toLowerCase())) {
					agents.set(def.name.toLowerCase(), def);
				}
			}
		} catch {}
	}

	return agents;
}

// ── Extension ────────────────────────────────────

export default function (pi: ExtensionAPI) {
	let allAgents: Map<string, AgentDef> = new Map();
	let chains: ChainDef[] = [];
	let activeChain: ChainDef | null = null;
	let widgetCtx: any;
	let sessionDir = "";
	const agentSessions: Map<string, string | null> = new Map();

	// Per-step state for the active chain
	let stepStates: StepState[] = [];

	function loadChains(cwd: string, parentSessionId: string) {
		const safeSessionId = parentSessionId.replace(/[^\w.-]+/g, "_");
		sessionDir = join(cwd, CONFIG_DIR_NAME, "agent-sessions", "chain", safeSessionId);
		if (!existsSync(sessionDir)) {
			mkdirSync(sessionDir, { recursive: true });
		}

		allAgents = scanAgentDirs(cwd);

		agentSessions.clear();
		for (const agent of allAgents.values()) {
			const agentKey = sessionKey(agent.name);
			const agentSessionDir = join(sessionDir, agentKey);
			const hasSession = existsSync(agentSessionDir) && readdirSync(agentSessionDir).some(file => file.endsWith(".jsonl"));
			agentSessions.set(agentKey, hasSession ? agentSessionDir : null);
		}

		const chainPath = join(cwd, CONFIG_DIR_NAME, "agents", "agent-chain.yaml");
		if (existsSync(chainPath)) {
			try {
				chains = parseChainYaml(readFileSync(chainPath, "utf-8"))
					.filter(chain => chain.name && chain.steps.length > 0)
					.filter(chain => chain.steps.every(step => step.agent && step.prompt));
			} catch {
				chains = [];
			}
		} else {
			chains = [];
		}
	}

	function activateChain(chain: ChainDef) {
		activeChain = chain;
		stepStates = chain.steps.map(s => ({
			agent: s.agent,
			status: "pending" as const,
			elapsed: 0,
			lastWork: "",
		}));
		updateWidget();
	}

	// ── Card Rendering ──────────────────────────

	function renderCard(state: StepState, colWidth: number, theme: any): string[] {
		const w = Math.max(1, colWidth - 2);
		const truncate = (s: string, max: number) => {
			if (max <= 0) return "";
			if (s.length <= max) return s;
			if (max <= 3) return s.slice(0, max);
			return s.slice(0, max - 3) + "...";
		};

		const statusColor = state.status === "pending" ? "dim"
			: state.status === "running" ? "accent"
			: state.status === "done" ? "success" : "error";
		const statusIcon = state.status === "pending" ? "○"
			: state.status === "running" ? "●"
			: state.status === "done" ? "✓" : "✗";

		const name = displayName(state.agent);
		const nameText = truncate(name, w - 1);
		const nameStr = theme.fg("accent", theme.bold(nameText));
		const nameVisible = nameText.length;

		const statusStr = `${statusIcon} ${state.status}`;
		const timeStr = state.status !== "pending" ? ` ${Math.round(state.elapsed / 1000)}s` : "";
		const statusText = truncate(statusStr + timeStr, w - 1);
		const statusLine = theme.fg(statusColor, statusText);
		const statusVisible = statusText.length;

		const workRaw = state.lastWork || "";
		const workText = workRaw ? truncate(workRaw, Math.min(50, w - 1)) : "";
		const workLine = workText ? theme.fg("muted", workText) : theme.fg("dim", "—");
		const workVisible = workText ? workText.length : 1;

		const top = "┌" + "─".repeat(w) + "┐";
		const bot = "└" + "─".repeat(w) + "┘";
		const border = (content: string, visLen: number) =>
			theme.fg("dim", "│") + content + " ".repeat(Math.max(0, w - visLen)) + theme.fg("dim", "│");

		return [
			theme.fg("dim", top),
			border(" " + nameStr, 1 + nameVisible),
			border(" " + statusLine, 1 + statusVisible),
			border(" " + workLine, 1 + workVisible),
			theme.fg("dim", bot),
		];
	}

	function updateWidget() {
		if (!widgetCtx) return;

		widgetCtx.ui.setWidget("agent-chain", (_tui: any, theme: any) => {
			const text = new Text("", 0, 1);

			return {
				render(width: number): string[] {
					if (!activeChain || stepStates.length === 0) {
						text.setText(theme.fg("dim", "No chain active. Use /chain to select one."));
						return text.render(width);
					}

					if (width < 12) {
						const summary = stepStates.map(s => `${s.status === "done" ? "✓" : s.status === "running" ? "●" : s.status === "error" ? "✗" : "○"} ${displayName(s.agent)}`);
						text.setText(summary.map(line => truncateToWidth(line, width)).join("\n"));
						return text.render(width);
					}

					const arrowWidth = 5; // " ──▶ "
					const cols = stepStates.length;
					const totalArrowWidth = arrowWidth * (cols - 1);
					const horizontal = width >= cols * 12 + totalArrowWidth;
					const colWidth = horizontal ? Math.floor((width - totalArrowWidth) / cols) : width;
					const cards = stepStates.map(s => renderCard(s, colWidth, theme));
					const outputLines: string[] = [];

					if (horizontal) {
						const arrowRow = 2;
						for (let line = 0; line < cards[0].length; line++) {
							let row = cards[0][line];
							for (let c = 1; c < cols; c++) {
								row += line === arrowRow ? theme.fg("dim", " ──▶ ") : " ".repeat(arrowWidth);
								row += cards[c][line];
							}
							outputLines.push(row);
						}
					} else {
						cards.forEach((card, index) => {
							if (index > 0) outputLines.push(theme.fg("dim", "▼"));
							outputLines.push(...card);
						});
					}

					text.setText(outputLines.join("\n"));
					return text.render(width);
				},
				invalidate() {
					text.invalidate();
				},
			};
		});
	}

	// ── Run Agent (subprocess) ──────────────────

	function runAgent(
		agentDef: AgentDef,
		task: string,
		stepIndex: number,
		ctx: any,
		signal?: AbortSignal,
	): Promise<{ output: string; exitCode: number; elapsed: number }> {
		const model = ctx.model
			? `${ctx.model.provider}/${ctx.model.id}`
			: "openrouter/google/gemini-3-flash-preview";

		const agentKey = sessionKey(agentDef.name);
		const agentSessionDir = join(sessionDir, agentKey);
		mkdirSync(agentSessionDir, { recursive: true });
		const hasSession = agentSessions.get(agentKey);

		const args = [
			"--mode", "json",
			"-p",
			"--no-extensions",
			"--model", model,
			"--tools", agentDef.tools,
			"--thinking", "off",
			"--append-system-prompt", agentDef.systemPrompt,
			"--session-dir", agentSessionDir,
		];

		if (hasSession) {
			args.push("-c");
		}

		args.push(task);

		const textChunks: string[] = [];
		const startTime = Date.now();
		const state = stepStates[stepIndex];

		return new Promise((resolve) => {
			const invocation = getPiInvocation(args);
			const proc = spawn(invocation.command, invocation.args, {
				cwd: ctx.cwd,
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env },
			});

			const timer = setInterval(() => {
				state.elapsed = Date.now() - startTime;
				updateWidget();
			}, 1000);

			let buffer = "";
			let stderr = "";
			let finalOutput = "";
			let assistantError = "";
			let aborted = false;

			const abort = () => {
				aborted = true;
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (proc.exitCode === null) proc.kill("SIGKILL");
				}, 5000).unref();
			};
			if (signal?.aborted) abort();
			else signal?.addEventListener("abort", abort, { once: true });

			const processEvent = (event: any) => {
				if (event.type === "message_update") {
					const delta = event.assistantMessageEvent;
					if (delta?.type === "text_delta") {
						textChunks.push(delta.delta || "");
						const full = textChunks.join("");
						state.lastWork = full.split("\n").filter((line: string) => line.trim()).pop() || "";
						updateWidget();
					}
				} else if (event.type === "message_end" && event.message?.role === "assistant") {
					finalOutput = (event.message.content || [])
						.filter((part: any) => part.type === "text")
						.map((part: any) => part.text || "")
						.join("");
					if (event.message.stopReason === "error" || event.message.stopReason === "aborted") {
						assistantError = event.message.errorMessage || `Agent ${event.message.stopReason}`;
					}
				}
			};

			proc.stdout!.setEncoding("utf-8");
			proc.stdout!.on("data", (chunk: string) => {
				buffer += chunk;
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						processEvent(JSON.parse(line));
					} catch {}
				}
			});

			proc.stderr!.setEncoding("utf-8");
			proc.stderr!.on("data", (chunk: string) => {
				stderr += chunk;
			});

			proc.on("close", (code) => {
				if (buffer.trim()) {
					try { processEvent(JSON.parse(buffer)); } catch {}
				}

				signal?.removeEventListener("abort", abort);
				clearInterval(timer);
				const elapsed = Date.now() - startTime;
				state.elapsed = elapsed;
				const output = aborted
					? "Agent run cancelled"
					: assistantError || finalOutput || textChunks.join("") || stderr.trim();
				state.lastWork = output.split("\n").filter((l: string) => l.trim()).pop() || "";
				const exitCode = aborted || assistantError ? 1 : code ?? 1;

				if (exitCode === 0) {
					agentSessions.set(agentKey, agentSessionDir);
				}

				resolve({ output, exitCode, elapsed });
			});

			proc.on("error", (err) => {
				signal?.removeEventListener("abort", abort);
				clearInterval(timer);
				resolve({
					output: `Error spawning agent: ${err.message}`,
					exitCode: 1,
					elapsed: Date.now() - startTime,
				});
			});
		});
	}

	// ── Run Chain (sequential pipeline) ─────────

	async function runChain(
		task: string,
		ctx: any,
		signal?: AbortSignal,
	): Promise<{ output: string; success: boolean; elapsed: number }> {
		if (!activeChain) {
			return { output: "No chain active", success: false, elapsed: 0 };
		}

		const chainStart = Date.now();

		// Reset all steps to pending
		stepStates = activeChain.steps.map(s => ({
			agent: s.agent,
			status: "pending" as const,
			elapsed: 0,
			lastWork: "",
		}));
		updateWidget();

		let input = task;
		const originalPrompt = task;

		for (let i = 0; i < activeChain.steps.length; i++) {
			const step = activeChain.steps[i];
			stepStates[i].status = "running";
			updateWidget();

			const resolvedPrompt = step.prompt.replace(
				/\$(INPUT|ORIGINAL)/g,
				(_match, variable: "INPUT" | "ORIGINAL") => variable === "INPUT" ? input : originalPrompt,
			);

			const agentDef = allAgents.get(step.agent.toLowerCase());
			if (!agentDef) {
				stepStates[i].status = "error";
				stepStates[i].lastWork = `Agent "${step.agent}" not found`;
				updateWidget();
				return {
					output: `Error at step ${i + 1}: Agent "${step.agent}" not found. Available: ${Array.from(allAgents.keys()).join(", ")}`,
					success: false,
					elapsed: Date.now() - chainStart,
				};
			}

			const result = await runAgent(agentDef, resolvedPrompt, i, ctx, signal);

			if (result.exitCode !== 0) {
				stepStates[i].status = "error";
				updateWidget();
				return {
					output: `Error at step ${i + 1} (${step.agent}): ${result.output}`,
					success: false,
					elapsed: Date.now() - chainStart,
				};
			}

			stepStates[i].status = "done";
			updateWidget();

			input = result.output;
		}

		return { output: input, success: true, elapsed: Date.now() - chainStart };
	}

	// ── run_chain Tool ──────────────────────────

	pi.registerTool({
		name: "run_chain",
		label: "Run Chain",
		description: "Execute the active agent chain pipeline. Each step runs sequentially — output from one step feeds into the next. Agents maintain session context across runs.",
		parameters: Type.Object({
			task: Type.String({ description: "The task/prompt for the chain to process" }),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const { task } = params as { task: string };

			if (onUpdate) {
				onUpdate({
					content: [{ type: "text", text: `Starting chain: ${activeChain?.name}...` }],
					details: { chain: activeChain?.name, task, status: "running" },
				});
			}

			const result = await runChain(task, ctx, signal);

			const truncated = result.output.length > 8000
				? result.output.slice(0, 8000) + "\n\n... [truncated]"
				: result.output;

			const status = result.success ? "done" : "error";
			const summary = `[chain:${activeChain?.name}] ${status} in ${Math.round(result.elapsed / 1000)}s`;

			return {
				content: [{ type: "text", text: `${summary}\n\n${truncated}` }],
				details: {
					chain: activeChain?.name,
					task,
					status,
					elapsed: result.elapsed,
					fullOutput: result.output,
				},
			};
		},

		renderCall(args, theme) {
			const task = (args as any).task || "";
			const preview = task.length > 60 ? task.slice(0, 57) + "..." : task;
			return new Text(
				theme.fg("toolTitle", theme.bold("run_chain ")) +
				theme.fg("accent", activeChain?.name || "?") +
				theme.fg("dim", " — ") +
				theme.fg("muted", preview),
				0, 0,
			);
		},

		renderResult(result, options, theme) {
			const details = result.details as any;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (options.isPartial || details.status === "running") {
				return new Text(
					theme.fg("accent", `● ${details.chain || "chain"}`) +
					theme.fg("dim", " running..."),
					0, 0,
				);
			}

			const icon = details.status === "done" ? "✓" : "✗";
			const color = details.status === "done" ? "success" : "error";
			const elapsed = typeof details.elapsed === "number" ? Math.round(details.elapsed / 1000) : 0;
			const header = theme.fg(color, `${icon} ${details.chain}`) +
				theme.fg("dim", ` ${elapsed}s`);

			if (options.expanded && details.fullOutput) {
				const output = details.fullOutput.length > 4000
					? details.fullOutput.slice(0, 4000) + "\n... [truncated]"
					: details.fullOutput;
				return new Text(header + "\n" + theme.fg("muted", output), 0, 0);
			}

			return new Text(header, 0, 0);
		},
	});

	// ── Commands ─────────────────────────────────

	pi.registerCommand("chain", {
		description: "Switch active chain",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			if (chains.length === 0) {
				ctx.ui.notify(`No chains defined in ${CONFIG_DIR_NAME}/agents/agent-chain.yaml`, "warning");
				return;
			}

			const options = chains.map(c => {
				const steps = c.steps.map(s => displayName(s.agent)).join(" → ");
				const desc = c.description ? ` — ${c.description}` : "";
				return `${c.name}${desc} (${steps})`;
			});

			const choice = await ctx.ui.select("Select Chain", options);
			if (choice === undefined) return;

			const idx = options.indexOf(choice);
			activateChain(chains[idx]);
			const flow = chains[idx].steps.map(s => displayName(s.agent)).join(" → ");
			ctx.ui.setStatus("agent-chain", `Chain: ${chains[idx].name} (${chains[idx].steps.length} steps)`);
			ctx.ui.notify(
				`Chain: ${chains[idx].name}\n${chains[idx].description}\n${flow}`,
				"info",
			);
		},
	});

	pi.registerCommand("chain-list", {
		description: "List all available chains",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			if (chains.length === 0) {
				ctx.ui.notify(`No chains defined in ${CONFIG_DIR_NAME}/agents/agent-chain.yaml`, "warning");
				return;
			}

			const list = chains.map(c => {
				const desc = c.description ? `  ${c.description}` : "";
				const steps = c.steps.map((s, i) =>
					`  ${i + 1}. ${displayName(s.agent)}`
				).join("\n");
				return `${c.name}:${desc ? "\n" + desc : ""}\n${steps}`;
			}).join("\n\n");

			ctx.ui.notify(list, "info");
		},
	});

	// ── System Prompt Override ───────────────────

	pi.on("before_agent_start", async (_event, _ctx) => {
		if (!activeChain) return {};

		const flow = activeChain.steps.map(s => displayName(s.agent)).join(" → ");
		const desc = activeChain.description ? `\n${activeChain.description}` : "";

		// Build pipeline steps summary
		const steps = activeChain.steps.map((s, i) => {
			const agentDef = allAgents.get(s.agent.toLowerCase());
			const agentDesc = agentDef?.description || "";
			return `${i + 1}. **${displayName(s.agent)}** — ${agentDesc}`;
		}).join("\n");

		// Build full agent catalog (like agent-team.ts)
		const seen = new Set<string>();
		const agentCatalog = activeChain.steps
			.filter(s => {
				const key = s.agent.toLowerCase();
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.map(s => {
				const agentDef = allAgents.get(s.agent.toLowerCase());
				if (!agentDef) return `### ${displayName(s.agent)}\nAgent not found.`;
				return `### ${displayName(agentDef.name)}\n${agentDef.description}\n**Tools:** ${agentDef.tools}\n**Role:** ${agentDef.systemPrompt}`;
			})
			.join("\n\n");

		return {
			systemPrompt: `${_event.systemPrompt}\n\nYou are an orchestrator with a sequential pipeline called "${activeChain.name}" at your disposal.${desc}
Delegate implementation work through the run_chain tool.

## Active Chain: ${activeChain.name}
Flow: ${flow}

${steps}

## Agent Details

${agentCatalog}

## When to Use run_chain
- Significant work: new features, refactors, multi-file changes, anything non-trivial
- Tasks that benefit from the full pipeline: planning, building, reviewing
- When you want structured, multi-agent collaboration on a problem

## How run_chain Works
- Pass a clear task description to run_chain
- Each step's output feeds into the next step as $INPUT
- Agents maintain session context — they remember previous work within this session
- You can run the chain multiple times with different tasks if needed
- After the chain completes, review the result and summarize for the user

## Guidelines
- Use run_chain for repository work; it is your only execution tool
- Keep chain tasks focused and clearly described`,
		};
	});

	// ── Session Start ───────────────────────────

	pi.on("session_start", async (_event, _ctx) => {
		if (!_ctx.isProjectTrusted()) {
			_ctx.ui.notify(`Agent Chain will not load project agents from an untrusted ${CONFIG_DIR_NAME} directory.`, "warning");
			return;
		}

		// Clear widget with both old and new ctx — one of them will be valid
		if (widgetCtx) {
			widgetCtx.ui.setWidget("agent-chain", undefined);
		}
		_ctx.ui.setWidget("agent-chain", undefined);
		widgetCtx = _ctx;

		// Each parent Pi session gets isolated, resumable subagent sessions.
		stepStates = [];
		activeChain = null;
		loadChains(_ctx.cwd, _ctx.sessionManager.getSessionId());

		if (chains.length === 0) {
			_ctx.ui.notify(`No chains found in ${CONFIG_DIR_NAME}/agents/agent-chain.yaml`, "warning");
			return;
		}

		// Default to first chain — use /chain to switch
		activateChain(chains[0]);

		// The primary agent only orchestrates; chain steps own codebase tools.
		pi.setActiveTools(["run_chain"]);

		const flow = activeChain!.steps.map(s => displayName(s.agent)).join(" → ");
		_ctx.ui.setStatus("agent-chain", `Chain: ${activeChain!.name} (${activeChain!.steps.length} steps)`);
		_ctx.ui.notify(
			`Chain: ${activeChain!.name}\n${activeChain!.description}\n${flow}\n\n` +
			`/chain             Switch chain\n` +
			`/chain-list        List all chains`,
			"info",
		);

		// Footer: model | chain name | context bar
		_ctx.ui.setFooter((_tui, theme, _footerData) => ({
			dispose: () => {},
			invalidate() {},
			render(width: number): string[] {
				const model = _ctx.model?.id || "no-model";
				const usage = _ctx.getContextUsage();
				const pct = Math.max(0, Math.min(100, usage?.percent ?? 0));
				const filled = Math.round(pct / 10);
				const bar = "#".repeat(filled) + "-".repeat(10 - filled);

				const chainLabel = activeChain
					? theme.fg("accent", activeChain.name)
					: theme.fg("dim", "no chain");

				const left = theme.fg("dim", ` ${model}`) +
					theme.fg("muted", " · ") +
					chainLabel;
				const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}% `);
				const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));

				return [truncateToWidth(left + pad + right, width)];
			},
		}));
	});
}