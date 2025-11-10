import { defineConfig } from "tsdown";

export default defineConfig({
	exports: {
		all: true,
	},
	minify: true,
	platform: "node",
});
