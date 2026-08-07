/** @jsxImportSource @opentui/solid */

import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createMemo, Show } from "solid-js";

interface ChainProgress {
	chain: string;
	step: number;
	steps: number;
	agent?: string;
	activity: string;
	elapsed: number;
}

function progressFromMetadata(metadata: Record<string, unknown> | undefined): ChainProgress | undefined {
	if (!metadata || metadata.status !== "running") return;
	if (typeof metadata.chain !== "string" || typeof metadata.activity !== "string") return;
	if (typeof metadata.step !== "number" || typeof metadata.steps !== "number") return;

	return {
		chain: metadata.chain,
		step: metadata.step,
		steps: metadata.steps,
		agent: typeof metadata.agent === "string" ? metadata.agent : undefined,
		activity: metadata.activity,
		elapsed: typeof metadata.chainElapsed === "number" ? metadata.chainElapsed : 0,
	};
}

function ProgressLine(props: { api: TuiPluginApi }) {
	const theme = () => props.api.theme.current;
	const progress = createMemo(() => {
		const route = props.api.route.current;
		if (route.name !== "session" || !("params" in route)) return;
		const sessionID = route.params?.sessionID;
		if (typeof sessionID !== "string") return;

		const messages = props.api.state.session.messages(sessionID);
		for (const message of messages.toReversed()) {
			const part = props.api.state.part(message.id)
				.findLast((candidate) => candidate.type === "tool" && candidate.tool === "run_chain");
			if (!part || part.type !== "tool") continue;
			if (part.state.status !== "running") return;
			return progressFromMetadata(part.state.metadata);
		}
	});
	const detail = createMemo(() => {
		const current = progress();
		if (!current) return "";
		if (current.step === 0) return current.activity;
		const agent = current.agent ? ` ${current.agent}` : "";
		return `step ${current.step}/${current.steps}${agent} | ${current.activity}`;
	});

	return (
		<Show when={progress()}>
			{(current) => (
				<box paddingLeft={2} paddingRight={2} paddingBottom={1}>
					<text fg={theme().textMuted}>
						<span style={{ fg: theme().accent, bold: true }}>Agent Chain</span>
						{` | ${current().chain} | ${detail()} | ${current().elapsed}s`}
					</text>
				</box>
			)}
		</Show>
	);
}

const tui: TuiPlugin = async (api) => {
	api.slots.register({
		order: 100,
		slots: {
			app_bottom() {
				return <ProgressLine api={api} />;
			},
		},
	});
};

export default {
	id: "agent-chain-status",
	tui,
} satisfies TuiPluginModule;
