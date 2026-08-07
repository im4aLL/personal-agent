/** @jsxImportSource @opentui/solid */

import type { TuiDialogStack, TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { For, Show, createMemo } from "solid-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface AgentStatus {
	agent: string;
	status: "idle" | "running" | "completed" | "error";
	activity: string;
	elapsed: number;
	contextPct: number;
	runCount: number;
	updatedAt: number;
}

interface DashboardState {
	team: string;
	members: string[];
	agents: AgentStatus[];
	visible: boolean;
}

const DASHBOARD_VISIBLE_KEY = "agent-team:dashboard-visible";

function parseTeams(raw: string): Record<string, string[]> {
	const teams: Record<string, string[]> = {};
	let current: string | undefined;
	for (const sourceLine of raw.split(/\r?\n/)) {
		const teamMatch = sourceLine.match(/^([A-Za-z0-9][A-Za-z0-9_-]*):$/);
		if (teamMatch) {
			current = teamMatch[1];
			teams[current] = [];
			continue;
		}
		const memberMatch = sourceLine.match(/^\s{2}-\s+([A-Za-z0-9][A-Za-z0-9_-]*)$/);
		if (memberMatch && current) teams[current].push(memberMatch[1]);
	}
	return teams;
}

function metadataOf(part: { type: string }) {
	if (part.type !== "tool") return;
	const state = (part as { state?: unknown }).state;
	if (!state || typeof state !== "object" || !("metadata" in state)) return;
	return (state as { metadata?: Record<string, unknown> }).metadata;
}

function statusFrom(value: unknown): AgentStatus | undefined {
	if (!value || typeof value !== "object") return;
	const candidate = value as Record<string, unknown>;
	if (typeof candidate.agent !== "string" || typeof candidate.status !== "string") return;
	if (!["running", "completed", "error"].includes(candidate.status)) return;
	return {
		agent: candidate.agent,
		status: candidate.status as AgentStatus["status"],
		activity: typeof candidate.activity === "string" ? candidate.activity : "",
		elapsed: typeof candidate.elapsed === "number" ? candidate.elapsed : 0,
		contextPct: typeof candidate.contextPct === "number" ? candidate.contextPct : 0,
		runCount: typeof candidate.runCount === "number" ? candidate.runCount : 0,
		updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : 0,
	};
}

function dashboardFor(api: TuiPluginApi, sessionID: string, teams: Record<string, string[]>): DashboardState {
	const teamNames = Object.keys(teams);
	let team = teamNames[0];
	const latest = new Map<string, AgentStatus>();
	let activeAgent: string | undefined;

	const messages = api.state.session.messages(sessionID);
	for (const message of messages) {
		if (message.role === "user" && typeof message.agent === "string") activeAgent = message.agent;
		for (const part of api.state.part(message.id)) {
			const metadata = metadataOf(part);
			if (!metadata) continue;
			if (
				(metadata.kind === "agent-team-selection" || metadata.kind === "agent-team-dispatch")
				&& typeof metadata.team === "string"
				&& teams[metadata.team]
			) {
				team = metadata.team;
			}
			if (metadata.kind !== "agent-team-dispatch" || !Array.isArray(metadata.dispatches)) continue;
			for (const value of metadata.dispatches) {
				const status = statusFrom(value);
				if (!status) continue;
				const previous = latest.get(status.agent);
				if (!previous || status.updatedAt >= previous.updatedAt) latest.set(status.agent, status);
			}
		}
	}

	const members = teams[team] ?? [];
	const agents = members.map((agent) => latest.get(agent) ?? {
		agent,
		status: "idle" as const,
		activity: "ready",
		elapsed: 0,
		contextPct: 0,
		runCount: 0,
		updatedAt: 0,
	});
	return {
		team,
		members,
		agents,
		visible: activeAgent === "agent-team" || [...latest.values()].some((agent) => agent.status === "running"),
	};
}

function displayName(name: string): string {
	return name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function AgentDashboard(props: { api: TuiPluginApi; teams: Record<string, string[]> }) {
	const theme = () => props.api.theme.current;
	const current = createMemo(() => {
		if (!props.api.kv.get(DASHBOARD_VISIBLE_KEY, true)) return;
		const route = props.api.route.current;
		if (route.name !== "session" || !("params" in route)) return;
		const sessionID = route.params?.sessionID;
		if (typeof sessionID !== "string") return;
		const state = dashboardFor(props.api, sessionID, props.teams);
		return state.visible ? state : undefined;
	});
	const columns = () => {
		const stored = props.api.kv.get("agent-team:grid-columns", 2);
		return typeof stored === "number" && stored >= 1 && stored <= 6 ? stored : 2;
	};
	const cardWidth = () => `${Math.max(16, Math.floor(100 / columns()) - 2)}%` as `${number}%`;
	const statusColor = (status: AgentStatus["status"]) => {
		if (status === "running") return theme().accent;
		if (status === "completed") return theme().success;
		if (status === "error") return theme().error;
		return theme().textMuted;
	};

	return (
		<Show when={current()}>
			{(state) => (
				<box paddingLeft={2} paddingRight={2} paddingBottom={1} flexDirection="column">
					<text fg={theme().textMuted}>
						<span style={{ fg: theme().accent, bold: true }}>Agent Team</span>
						{` | ${state().team} | ${state().members.length} specialists`}
					</text>
					<box flexDirection="row" flexWrap="wrap" gap={1}>
						<For each={state().agents}>
							{(agent) => (
								<box
									width={cardWidth()}
									border
									borderColor={agent.status === "running" ? theme().accent : theme().borderSubtle}
									paddingLeft={1}
									paddingRight={1}
									flexDirection="column"
								>
									<text fg={theme().text}>
										<span style={{ bold: true }}>{displayName(agent.agent)}</span>
									</text>
									<text fg={statusColor(agent.status)}>
										{`${agent.status}${agent.status !== "idle" ? ` | ${Math.round(agent.elapsed / 1000)}s` : ""}`}
									</text>
									<text fg={theme().textMuted}>{agent.activity}</text>
									<Show when={agent.runCount > 0}>
										<text fg={theme().textMuted}>
											{`runs ${agent.runCount} | context ${Math.ceil(agent.contextPct)}%`}
										</text>
									</Show>
								</box>
							)}
						</For>
					</box>
				</box>
			)}
		</Show>
	);
}

function sessionID(api: TuiPluginApi): string | undefined {
	const route = api.route.current;
	if (route.name !== "session" || !("params" in route)) return;
	return typeof route.params?.sessionID === "string" ? route.params.sessionID : undefined;
}

function openTeamSelector(api: TuiPluginApi, teams: Record<string, string[]>, dialog?: TuiDialogStack) {
	const id = sessionID(api);
	if (!id) {
		api.ui.toast({ variant: "warning", message: "Open an Agent Team session before selecting a team" });
		return;
	}
	const stack = dialog ?? api.ui.dialog;
	const DialogSelect = api.ui.DialogSelect;
	const selected = dashboardFor(api, id, teams).team;
	stack.replace(() => (
		<DialogSelect
			title="Select Agent Team"
			current={selected}
			options={Object.entries(teams).map(([name, members]) => ({
				title: name,
				value: name,
				description: members.join(", "),
			}))}
			onSelect={async (option) => {
				stack.clear();
				const response = await api.client.session.promptAsync({
					sessionID: id,
					directory: api.state.path.directory,
					agent: "agent-team",
					parts: [{ type: "text", text: `Call set_agent_team with team exactly ${JSON.stringify(option.value)}. Do not dispatch any work.` }],
				});
				if (response.error) {
					api.ui.toast({ variant: "error", message: `Unable to switch team: ${response.error}` });
					return;
				}
				api.ui.toast({ variant: "info", message: `Team change requested: ${option.value}` });
			}}
		/>
	));
}

function openAgentList(api: TuiPluginApi, teams: Record<string, string[]>, dialog?: TuiDialogStack) {
	const id = sessionID(api);
	if (!id) return;
	const state = dashboardFor(api, id, teams);
	const DialogAlert = api.ui.DialogAlert;
	(dialog ?? api.ui.dialog).replace(() => (
		<DialogAlert
			title={`Agent Team: ${state.team}`}
			message={state.agents.map((agent) => `${displayName(agent.agent)}: ${agent.status} (${agent.activity})`).join("\n")}
		/>
	));
}

function openGridSelector(api: TuiPluginApi, dialog?: TuiDialogStack) {
	const stack = dialog ?? api.ui.dialog;
	const DialogSelect = api.ui.DialogSelect;
	const selected = api.kv.get("agent-team:grid-columns", 2);
	stack.replace(() => (
		<DialogSelect
			title="Agent Team Grid Columns"
			current={selected}
			options={[1, 2, 3, 4, 5, 6].map((count) => ({ title: `${count} columns`, value: count }))}
			onSelect={(option) => {
				api.kv.set("agent-team:grid-columns", option.value);
				stack.clear();
			}}
		/>
	));
}

function toggleDashboard(api: TuiPluginApi) {
	const visible = !api.kv.get(DASHBOARD_VISIBLE_KEY, true);
	api.kv.set(DASHBOARD_VISIBLE_KEY, visible);
	api.ui.toast({ variant: "info", message: `Agent Team dashboard ${visible ? "shown" : "hidden"}` });
}

const tui: TuiPlugin = async (api) => {
	const teamsPath = join(api.state.path.worktree, ".opencode", "agents", "teams.yaml");
	const teams = parseTeams(readFileSync(teamsPath, "utf8"));
	api.slots.register({
		order: 90,
		slots: {
			app_bottom() {
				return <AgentDashboard api={api} teams={teams} />;
			},
		},
	});

	const disposeCommands = api.command?.register(() => [{
		title: "Agent Team: Select team",
		value: "agent-team.select",
		description: "Choose the active specialist team",
		category: "Agent Team",
		slash: { name: "agents-team" },
		onSelect: (dialog) => openTeamSelector(api, teams, dialog),
	}, {
		title: "Agent Team: List agents",
		value: "agent-team.list",
		description: "Show active specialists and status",
		category: "Agent Team",
		slash: { name: "agents-list" },
		onSelect: (dialog) => openAgentList(api, teams, dialog),
	}, {
		title: "Agent Team: Grid columns",
		value: "agent-team.grid",
		description: "Set dashboard column count",
		category: "Agent Team",
		slash: { name: "agents-grid" },
		onSelect: (dialog) => openGridSelector(api, dialog),
	}, {
		title: "Agent Team: Toggle dashboard",
		value: "agent-team.toggle-dashboard",
		description: "Show or hide the Agent Team dashboard",
		category: "Agent Team",
		slash: { name: "agents-toggle" },
		onSelect: () => toggleDashboard(api),
	}]);
	if (disposeCommands) api.lifecycle.onDispose(disposeCommands);
};

export default {
	id: "agent-team-status",
	tui,
} satisfies TuiPluginModule;
