#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

interface AgentDefinition {
	name: string;
	description: string;
	tools: string[];
	color?: string;
	skills: string[];
	mode: "subagent" | "primary" | "all";
	prompt: string;
}

const repoRoot = resolve(import.meta.dir, "../..");
const sourceDir = join(repoRoot, ".pi", "agents");
const targets = {
	claude: join(repoRoot, ".claude", "agents"),
	claudeCommands: join(repoRoot, ".claude", "commands"),
	claudeSkills: join(repoRoot, ".claude", "skills"),
	opencode: join(repoRoot, ".opencode", "agents"),
	piPrompts: join(repoRoot, ".pi", "prompts"),
};
const checkOnly = process.argv.includes("--check");

function unquote(value: string): string {
	const trimmed = value.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return JSON.parse(trimmed);
	}
	if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
		return trimmed.slice(1, -1).replace(/''/g, "'");
	}
	return trimmed;
}

function parseAgent(path: string): AgentDefinition | null {
	const raw = readFileSync(path, "utf8");
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) return null;

	const scalars = new Map<string, string>();
	const lists = new Map<string, string[]>();
	let activeList: string | null = null;

	for (const line of match[1].split(/\r?\n/)) {
		const listItem = line.match(/^\s+-\s+(.+)$/);
		if (listItem && activeList) {
			lists.get(activeList)!.push(unquote(listItem[1]));
			continue;
		}

		const field = line.match(/^([a-zA-Z][a-zA-Z0-9-]*):(?:\s*(.*))?$/);
		if (!field) continue;
		const [, key, value = ""] = field;
		if (value.trim()) {
			scalars.set(key, unquote(value));
			activeList = null;
		} else {
			lists.set(key, []);
			activeList = key;
		}
	}

	const name = scalars.get("name");
	const description = scalars.get("description");
	if (!name || !description) return null;
	if (basename(path, ".md") !== name) {
		throw new Error(`${path}: filename must match agent name "${name}"`);
	}

	const tools = (scalars.get("tools") ?? "read,grep,find,ls")
		.split(",")
		.map((tool) => tool.trim())
		.filter(Boolean);
	const supportedTools = new Set(["read", "write", "edit", "bash", "grep", "find", "ls"]);
	const unsupportedTools = tools.filter((tool) => !supportedTools.has(tool));
	if (unsupportedTools.length > 0) {
		throw new Error(`${path}: unsupported cross-client tools: ${unsupportedTools.join(", ")}`);
	}

	const mode = scalars.get("mode") ?? "subagent";
	const supportedModes = new Set(["subagent", "primary", "all"]);
	if (!supportedModes.has(mode)) {
		throw new Error(`${path}: unsupported mode "${mode}" (expected subagent, primary, or all)`);
	}

	return {
		name,
		description,
		tools,
		color: scalars.get("color"),
		skills: lists.get("skills") ?? [],
		mode: mode as AgentDefinition["mode"],
		prompt: match[2].trim(),
	};
}

function yamlString(value: string): string {
	return JSON.stringify(value);
}

function renderClaude(agent: AgentDefinition): string {
	const toolMap: Record<string, string> = {
		read: "Read",
		write: "Write",
		edit: "Edit",
		bash: "Bash",
		grep: "Grep",
		find: "Glob",
		ls: "Glob",
	};
	const tools = [...new Set(agent.tools.map((tool) => toolMap[tool]).filter(Boolean))];
	const lines = [
		"---",
		`name: ${agent.name}`,
		`description: ${yamlString(agent.description)}`,
		`tools: ${tools.join(", ")}`,
	];
	if (agent.color) lines.push(`color: ${agent.color}`);
	if (agent.skills.length > 0) {
		lines.push("skills:", ...agent.skills.map((skill) => `  - ${skill}`));
	}
	lines.push("---", "", agent.prompt, "");
	return lines.join("\n");
}

function renderOpenCode(agent: AgentDefinition): string {
	const enabled = new Set(agent.tools);
	return [
		"---",
		`description: ${yamlString(agent.description)}`,
		`mode: ${agent.mode}`,
		"tools:",
		`  write: ${enabled.has("write")}`,
		`  edit: ${enabled.has("edit")}`,
		`  bash: ${enabled.has("bash")}`,
		"---",
		"",
		agent.prompt,
		"",
	].join("\n");
}

function renderPiPrompt(agent: AgentDefinition): string {
	return [
		"---",
		`description: ${agent.description}`,
		'argument-hint: "[task]"',
		"---",
		"",
		`Use the ${agent.name} agent to \${ARGUMENTS:-work on the current task}.`,
		"",
	].join("\n");
}

function renderClaudeCommand(agent: AgentDefinition): string {
	return [
		"---",
		`description: ${yamlString(agent.description)}`,
		'argument-hint: "<task description>"',
		"---",
		"",
		`Use the Agent tool with subagent_type: "${agent.name}" to handle this task:`,
		"",
		"$ARGUMENTS",
		"",
	].join("\n");
}

function collectFiles(directory: string): string[] {
	return readdirSync(directory)
		.flatMap((entry) => {
			const path = join(directory, entry);
			return statSync(path).isDirectory() ? collectFiles(path) : [path];
		})
		.sort();
}

const agents = readdirSync(sourceDir)
	.filter((file) => file.endsWith(".md"))
	.map((file) => parseAgent(join(sourceDir, file)))
	.filter((agent): agent is AgentDefinition => agent !== null)
	.sort((left, right) => left.name.localeCompare(right.name));

if (agents.length === 0) throw new Error(`No agent definitions found in ${sourceDir}`);

const drift: string[] = [];
let writes = 0;

for (const targetDir of Object.values(targets)) {
	if (!checkOnly) mkdirSync(targetDir, { recursive: true });
}

for (const agent of agents) {
	const outputs = [
		[join(targets.claude, `${agent.name}.md`), renderClaude(agent)],
		[join(targets.opencode, `${agent.name}.md`), renderOpenCode(agent)],
		[join(targets.piPrompts, `${agent.name}.md`), renderPiPrompt(agent)],
		[join(targets.claudeCommands, `${agent.name}.md`), renderClaudeCommand(agent)],
	] as const;

	for (const [path, expected] of outputs) {
		const actual = existsSync(path) ? readFileSync(path, "utf8") : null;
		if (actual === expected) continue;
		if (checkOnly) {
			drift.push(path);
		} else {
			writeFileSync(path, expected);
			writes += 1;
		}
	}
}

const sharedSkillsDir = join(repoRoot, ".agents", "skills");
const skillFiles = collectFiles(sharedSkillsDir);
for (const sourcePath of skillFiles) {
	const destinationPath = join(targets.claudeSkills, relative(sharedSkillsDir, sourcePath));
	const expected = readFileSync(sourcePath);
	const actual = existsSync(destinationPath) ? readFileSync(destinationPath) : null;
	if (actual?.equals(expected)) continue;
	if (checkOnly) {
		drift.push(destinationPath);
	} else {
		mkdirSync(resolve(destinationPath, ".."), { recursive: true });
		writeFileSync(destinationPath, expected);
		writes += 1;
	}
}

if (drift.length > 0) {
	console.error("Generated compatibility files are missing or stale:");
	for (const path of drift) console.error(`- ${path}`);
	console.error("Run: bun ai/scripts/sync-agents.ts");
	process.exit(1);
}

console.log(
	checkOnly
		? `Validated ${agents.length} agents, ${agents.length} Pi prompts, ${agents.length} Claude commands, and ${skillFiles.length} Claude skill files.`
		: `Synchronized ${agents.length} agents, ${agents.length} Pi prompts, ${agents.length} Claude commands, and ${skillFiles.length} Claude skill files (${writes} files updated).`,
);
