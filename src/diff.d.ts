declare module 'diff' {
	export interface StructuredPatchHunk {
		oldStart: number;
		oldLines: number;
		newStart: number;
		newLines: number;
		lines: string[];
	}

	export interface StructuredPatch {
		hunks: StructuredPatchHunk[];
	}

	export function structuredPatch(
		oldFileName: string,
		newFileName: string,
		oldStr: string,
		newStr: string,
		oldHeader?: string,
		newHeader?: string,
		options?: unknown,
	): StructuredPatch;
}
