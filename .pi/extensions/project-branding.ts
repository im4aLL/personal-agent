import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BRANDING = "Customized Pi Coding Agent v1.0.0 / Hadi";

export default function projectBranding(pi: ExtensionAPI): void {
	pi.on("session_start", (event, ctx) => {
		if (ctx.mode !== "tui" || event.reason !== "startup") return;

		ctx.ui.notify(BRANDING, "info");
	});
}
