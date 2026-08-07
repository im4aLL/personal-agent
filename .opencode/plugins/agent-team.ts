import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

interface AgentDefinition {
	name: string;
	description: string;
}

interface DispatchRequest {
	agent: string;
	task: string;
}

interface DispatchStatus {
	agent: string;
	status: "running" | "completed" | "error";
	activity: string;
	elapsed: number;
	contextPct: number;
	runCount: number;
	updatedAt: number;
}

interface DispatchResult {
	agent: string;
	output: string;
	status: "completed" | "error";
	elapsed: number;
	sessionID?: string;
}

interface LiveStatus {
	status: DispatchStatus;
	publish: () => void;
}

const CHILD_TITLE_PREFIX = "[agent-team:v1] ";
const activeTeams = new Map<string, string>();
const activeChildStatuses = new Map<string, LiveStatus>();
const runningAgents = new Set<string>();
const runCounts = new Map<string, number>();
const sessionModels = new Map<string, { providerID: string; modelID: string }>();

function parseTeams(raw: string, path: string): Record<string, string[]> {
	const teams: Record<string, string[]> = {};
	let current: string | undefined;

	for (const [index, sourceLine] of raw.split(/\r?\n/).entries()) {
		const line = sourceLine.trimEnd();
		if (!line.trim() || line.trimStart().startsWith("#")) continue;

		const teamMatch = line.match(/^([A-Za-z0-9][A-Za-z0-9_-]*):$/);
		if (teamMatch) {
			current = teamMatch[1];
			if (teams[current]) throw new Error(`${path}:${index + 1}: duplicate team "${current}"`);
			teams[current] = [];
			continue;
		}

		const memberMatch = line.match(/^\s{2}-\s+([A-Za-z0-9][A-Za-z0-9_-]*)$/);
		if (memberMatch && current) {
			teams[current].push(memberMatch[1]);
			continue;
		}

		throw new Error(`${path}:${index + 1}: unsupported team configuration`);
	}

	if (Object.keys(teams).length === 0) throw new Error(`${path}: no teams defined`);
	for (const [name, members] of Object.entries(teams)) {
		if (members.length === 0) throw new Error(`${path}: team "${name}" has no members`);
		if (new Set(members).size !== members.length) throw new Error(`${path}: team "${name}" has duplicate members`);
	}
	return teams;
}

function parseDescription(raw: string): string {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return "";
	const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
	if (description.startsWith('"') && description.endsWith('"')) {
		try {
			return JSON.parse(description);
		} catch {
			return description.slice(1, -1);
		}
	}
	return description;
}

function loadAgentDefinitions(directory: string): AgentDefinition[] {
	return readdirSync(directory)
		.filter((file) => file.endsWith(".md"))
		.map((file) => ({
			name: basename(file, ".md"),
			description: parseDescription(readFileSync(join(directory, file), "utf8")),
		}));
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	if (error && typeof error === "object") {
		const candidate = error as { name?: unknown; message?: unknown; data?: { message?: unknown } };
		if (typeof candidate.data?.message === "string") return candidate.data.message;
		if (typeof candidate.message === "string") return candidate.message;
		if (typeof candidate.name === "string") return candidate.name;
	}
	return "Unknown OpenCode SDK error";
}

function dispatcherPrompt(
	teams: Record<string, string[]>,
	agents: Map<string, AgentDefinition>,
	defaultTeam: string,
): string {
	const teamCatalog = Object.entries(teams)
		.map(([name, members]) => `- **${name}**: ${members.join(", ")}`)
		.join("\n");
	const agentCatalog = [...agents.values()]
		.map((agent) => `- **${agent.name}**: ${agent.description || "Specialist project agent"}`)
		.join("\n");

	return `You are a dispatcher-only agent. Coordinate specialist agents to accomplish the user's request.

You cannot inspect or change the repository directly. Delegate all repository work through dispatch_agent or dispatch_agents.

## Teams

The default team for each parent session is **${defaultTeam}**.

${teamCatalog}

Use set_agent_team when the user asks to switch teams. Use agent_team_status when they ask which team or agents are active.

## Specialists

${agentCatalog}

## Working rules

- Break substantial requests into focused specialist tasks.
- Use dispatch_agents when independent tasks can run in parallel.
- Use dispatch_agent for sequential work or follow-up on a specialist's prior work.
- A specialist keeps one persistent child session under this parent session, so later dispatches retain its context.
- Review returned results and dispatch follow-up work when needed.
- Never claim repository work that a specialist did not report.
- Do not attempt repository work yourself; your tools are limited to orchestration and questions.`;
}

export const AgentTeamPlugin = (async ({ client, worktree }) => {
	const teamsPath = join(worktree, ".opencode", "agents", "teams.yaml");
	const agentsPath = join(worktree, ".opencode", "agents");
	const teams = parseTeams(readFileSync(teamsPath, "utf8"), teamsPath);
	const teamNames = Object.keys(teams);
	const defaultTeam = teamNames[0];
	const agentDefinitions = new Map(loadAgentDefinitions(agentsPath).map((agent) => [agent.name, agent]));

	for (const [team, members] of Object.entries(teams)) {
		const missing = members.filter((member) => !agentDefinitions.has(member));
		if (missing.length > 0) throw new Error(`${teamsPath}: team "${team}" references missing agents: ${missing.join(", ")}`);
	}

	const selectedTeam = async (sessionID: string, directory: string) => {
		const cached = activeTeams.get(sessionID);
		if (cached) return cached;

		const messagesResponse = await client.session.messages({
			path: { id: sessionID },
			query: { directory },
		});
		if (messagesResponse.error || !messagesResponse.data) {
			throw new Error(`Unable to recover the active team: ${errorMessage(messagesResponse.error)}`);
		}
		for (const message of messagesResponse.data.toReversed()) {
			for (const part of message.parts.toReversed()) {
				if (part.type !== "tool") continue;
				if (!("metadata" in part.state)) continue;
				const metadata = part.state.metadata;
				if (metadata?.kind !== "agent-team-selection" || typeof metadata.team !== "string" || !teams[metadata.team]) continue;
				activeTeams.set(sessionID, metadata.team);
				return metadata.team;
			}
		}
		return defaultTeam;
	};
	const teamMetadata = async (sessionID: string, directory: string) => {
		const team = await selectedTeam(sessionID, directory);
		return { team, members: teams[team] };
	};

	async function abortChild(sessionID: string, directory: string) {
		try {
			await client.session.abort({
				path: { id: sessionID },
				query: { directory },
				signal: AbortSignal.timeout(5000),
			});
		} catch {
			// Prompt failures carry the actionable error; cancellation is best effort.
		}
	}

	async function dispatch(requests: DispatchRequest[], context: Parameters<ReturnType<typeof tool>["execute"]>[1]) {
		const { team, members } = await teamMetadata(context.sessionID, context.directory);
		const memberSet = new Set(members);
		const invalid = requests.map((request) => request.agent).filter((agent) => !memberSet.has(agent));
		if (invalid.length > 0) {
			throw new Error(`Agents not in active team "${team}": ${[...new Set(invalid)].join(", ")}. Available: ${members.join(", ")}`);
		}
		if (new Set(requests.map((request) => request.agent)).size !== requests.length) {
			throw new Error("A parallel dispatch cannot include the same agent more than once");
		}

		const lockKeys = requests.map((request) => `${context.sessionID}:${request.agent}`);
		const busy = requests.filter((_request, index) => runningAgents.has(lockKeys[index])).map((request) => request.agent);
		if (busy.length > 0) throw new Error(`Agents already running: ${busy.join(", ")}`);
		for (const key of lockKeys) runningAgents.add(key);

		const activeChildren = new Set<string>();
		const abortPromises = new Map<string, Promise<void>>();
		const requestAbort = (childID: string) => {
			let promise = abortPromises.get(childID);
			if (!promise) {
				promise = abortChild(childID, context.directory);
				abortPromises.set(childID, promise);
			}
			return promise;
		};
		const abortActive = () => {
			for (const childID of activeChildren) void requestAbort(childID);
		};
		const ensureNotCancelled = async () => {
			if (!context.abort.aborted) return;
			await Promise.all([...activeChildren].map(requestAbort));
			throw new Error("Dispatch cancelled");
		};
		context.abort.addEventListener("abort", abortActive);

		const startedAt = Date.now();
		const statuses = new Map<string, DispatchStatus>();
		const publish = () => {
			context.metadata({
				title: `${team}: ${[...statuses.values()].filter((status) => status.status === "running").length} running`,
				metadata: {
					kind: "agent-team-dispatch",
					team,
					members,
					dispatches: [...statuses.values()],
					updatedAt: Date.now(),
				},
			});
		};

		try {
			await ensureNotCancelled();
			const [agentsResponse, childrenResponse, providersResponse] = await Promise.all([
				client.app.agents({ query: { directory: context.directory } }),
				client.session.children({ path: { id: context.sessionID }, query: { directory: context.directory } }),
				client.config.providers({ query: { directory: context.directory } }),
			]);
			await ensureNotCancelled();
			if (agentsResponse.error || !agentsResponse.data) {
				throw new Error(`Unable to list OpenCode agents: ${errorMessage(agentsResponse.error)}`);
			}
			if (childrenResponse.error || !childrenResponse.data) {
				throw new Error(`Unable to list child sessions: ${errorMessage(childrenResponse.error)}`);
			}

			const availableAgents = new Map(agentsResponse.data.map((agent) => [agent.name, agent]));
			const unavailable = requests.map((request) => request.agent).filter((agent) => !availableAgents.has(agent));
			if (unavailable.length > 0) throw new Error(`Unavailable OpenCode agents: ${unavailable.join(", ")}`);

			const childByAgent = new Map<string, string>();
			for (const child of childrenResponse.data) {
				if (child.title.startsWith(CHILD_TITLE_PREFIX)) {
					childByAgent.set(child.title.slice(CHILD_TITLE_PREFIX.length), child.id);
				}
			}

			const contextLimits = new Map<string, number>();
			for (const provider of providersResponse.data?.providers ?? []) {
				for (const [modelID, model] of Object.entries(provider.models)) {
					contextLimits.set(`${provider.id}/${modelID}`, model.limit.context);
				}
			}

			const runOne = async (request: DispatchRequest): Promise<DispatchResult> => {
				const runKey = `${context.sessionID}:${request.agent}`;
				const runCount = (runCounts.get(runKey) ?? 0) + 1;
				runCounts.set(runKey, runCount);
				const stepStart = Date.now();
				const status: DispatchStatus = {
					agent: request.agent,
					status: "running",
					activity: "starting",
					elapsed: 0,
					contextPct: 0,
					runCount,
					updatedAt: Date.now(),
				};
				statuses.set(request.agent, status);
				publish();

				let childID = childByAgent.get(request.agent);
				try {
					await ensureNotCancelled();
					if (!childID) {
						const createResponse = await client.session.create({
							body: { parentID: context.sessionID, title: `${CHILD_TITLE_PREFIX}${request.agent}` },
							query: { directory: context.directory },
						});
						if (createResponse.error || !createResponse.data) {
							throw new Error(`Unable to create child session: ${errorMessage(createResponse.error)}`);
						}
						childID = createResponse.data.id;
						childByAgent.set(request.agent, childID);
					}

					activeChildren.add(childID);
					await ensureNotCancelled();
					const liveStatus: LiveStatus = {
						status,
						publish: () => {
							status.elapsed = Date.now() - stepStart;
							status.updatedAt = Date.now();
							publish();
						},
					};
					activeChildStatuses.set(childID, liveStatus);
					const interval = setInterval(liveStatus.publish, 1000);
					const configuredModel = availableAgents.get(request.agent)?.model;
					const effectiveModel = configuredModel ?? sessionModels.get(context.sessionID);

					let promptResponse;
					try {
						await ensureNotCancelled();
						promptResponse = await client.session.prompt({
							path: { id: childID },
							query: { directory: context.directory },
							body: {
								agent: request.agent,
								model: effectiveModel,
								tools: {
									agent_team_status: false,
									dispatch_agent: false,
									dispatch_agents: false,
									set_agent_team: false,
								},
								parts: [{ type: "text", text: request.task }],
							},
						});
						await ensureNotCancelled();
					} finally {
						clearInterval(interval);
						activeChildStatuses.delete(childID);
						activeChildren.delete(childID);
					}

					if (promptResponse.error || !promptResponse.data) {
						throw new Error(errorMessage(promptResponse.error));
					}
					if (promptResponse.data.info.error) throw new Error(errorMessage(promptResponse.data.info.error));

					let output = "";
					for (const part of promptResponse.data.parts) {
						if (part.type === "text" && !part.ignored) output += part.text;
					}
					output = output.trim();
					if (!output) throw new Error("Agent returned no text output");

					status.status = "completed";
					status.activity = "done";
					status.elapsed = Date.now() - stepStart;
					const model = effectiveModel ? `${effectiveModel.providerID}/${effectiveModel.modelID}` : "";
					const limit = contextLimits.get(model);
					if (limit) {
						const inputTokens = promptResponse.data.info.tokens.input + promptResponse.data.info.tokens.cache.read;
						status.contextPct = (inputTokens / limit) * 100;
					}
					status.updatedAt = Date.now();
					publish();
					return { agent: request.agent, output, status: "completed", elapsed: status.elapsed, sessionID: childID };
				} catch (error) {
					if (context.abort.aborted) {
						if (childID) await requestAbort(childID);
						status.status = "error";
						status.activity = "cancelled";
						status.elapsed = Date.now() - stepStart;
						status.updatedAt = Date.now();
						publish();
						throw new Error("Dispatch cancelled");
					}
					status.status = "error";
					status.activity = errorMessage(error);
					status.elapsed = Date.now() - stepStart;
					status.updatedAt = Date.now();
					publish();
					return { agent: request.agent, output: errorMessage(error), status: "error", elapsed: status.elapsed, sessionID: childID };
				}
			};

			const settled = await Promise.allSettled(requests.map(runOne));
			const rejected = settled.find((result) => result.status === "rejected");
			if (rejected?.status === "rejected") throw rejected.reason;
			const results = settled.map((result) => (result as PromiseFulfilledResult<DispatchResult>).value);
			const summary = results.map((result) => {
				const header = `[${result.agent}] ${result.status} in ${Math.round(result.elapsed / 1000)}s`;
				return `${header}\n\n${result.output}`;
			}).join("\n\n---\n\n");
			return {
				title: `${team}: ${results.filter((result) => result.status === "completed").length}/${results.length} completed`,
				output: summary,
				metadata: {
					kind: "agent-team-dispatch",
					team,
					members,
					dispatches: [...statuses.values()],
					elapsed: Date.now() - startedAt,
					updatedAt: Date.now(),
				},
			};
		} finally {
			context.abort.removeEventListener("abort", abortActive);
			for (const key of lockKeys) runningAgents.delete(key);
		}
	}

	return {
		"chat.message": async (input, output) => {
			sessionModels.set(input.sessionID, output.message.model);
		},
		event: async ({ event }) => {
			if (event.type === "session.deleted") {
				activeTeams.delete(event.properties.info.id);
				sessionModels.delete(event.properties.info.id);
				return;
			}
			if (event.type !== "message.part.updated") return;
			const part = event.properties.part;
			const live = activeChildStatuses.get(part.sessionID);
			if (!live) return;
			if (part.type === "tool") live.status.activity = `${part.state.status} ${part.tool}`;
			else if (part.type === "reasoning") live.status.activity = "thinking";
			else if (part.type === "text") live.status.activity = "writing response";
			live.publish();
		},
		config: async (config) => {
			config.agent ??= {};
			config.agent["agent-team"] = {
				description: "Dispatcher-only coordinator for specialist teams from .opencode/agents/teams.yaml",
				mode: "primary",
				color: "accent",
				prompt: dispatcherPrompt(teams, agentDefinitions, defaultTeam),
				tools: {
					apply_patch: false,
					agent_team_status: true,
					bash: false,
					dispatch_agent: true,
					dispatch_agents: true,
					edit: false,
					glob: false,
					grep: false,
					list: false,
					lsp: false,
					question: true,
					read: false,
					set_agent_team: true,
					skill: false,
					task: false,
					todowrite: false,
					webfetch: false,
					websearch: false,
					write: false,
				},
				permission: {
					"*": "deny",
					agent_team_status: "allow",
					dispatch_agent: "allow",
					dispatch_agents: "allow",
					question: "allow",
					set_agent_team: "allow",
				},
			} as typeof config.agent[string];
		},
		tool: {
			dispatch_agent: tool({
				description: "Dispatch one focused task to a specialist in the active team. The specialist's child session persists across calls.",
				args: {
					agent: tool.schema.string().describe("Specialist name from the active team"),
					task: tool.schema.string().min(1).describe("Focused task for the specialist"),
				},
				async execute(args, context) {
					return dispatch([{ agent: args.agent, task: args.task }], context);
				},
			}),
			dispatch_agents: tool({
				description: "Dispatch independent tasks to multiple active-team specialists concurrently.",
				args: {
					dispatches: tool.schema.array(tool.schema.object({
						agent: tool.schema.string().describe("Specialist name from the active team"),
						task: tool.schema.string().min(1).describe("Focused task for this specialist"),
					})).min(1).max(8),
				},
				async execute(args, context) {
					return dispatch(args.dispatches, context);
				},
			}),
			set_agent_team: tool({
				description: `Set the active specialist team for this parent session. Available teams: ${teamNames.join(", ")}.`,
				args: { team: tool.schema.string().describe("Team name") },
				async execute(args, context) {
					if (!teams[args.team]) throw new Error(`Unknown team "${args.team}". Available: ${teamNames.join(", ")}`);
					activeTeams.set(context.sessionID, args.team);
					return {
						title: `Team: ${args.team}`,
						output: `Active team set to ${args.team}: ${teams[args.team].join(", ")}`,
						metadata: { kind: "agent-team-selection", team: args.team, members: teams[args.team], updatedAt: Date.now() },
					};
				},
			}),
			agent_team_status: tool({
				description: "Show the active team and available team names for this parent session.",
				args: {},
				async execute(_args, context) {
					const current = await teamMetadata(context.sessionID, context.directory);
					return `Active team: ${current.team}\nMembers: ${current.members.join(", ")}\nAvailable teams: ${teamNames.join(", ")}`;
				},
			}),
		},
	};
}) satisfies Plugin;
