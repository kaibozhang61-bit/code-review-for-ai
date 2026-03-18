import type { ChangeSet } from './types';

export function createDemoChangeSet(): ChangeSet {
	return {
		id: 'demo-review',
		changes: [
			{
				filePath: 'src/example.ts',
				originalContent: [
					"export async function fetchUser(id: string) {",
					"\tconst response = await fetch(`/api/users/${id}`);",
					"\treturn response.json();",
					"}",
					'',
				].join('\n'),
				proposedContent: [
					"export async function fetchUser(id: string) {",
					"\tconst response = await fetch(`/api/users/${id}`);",
					'',
					'\tif (!response.ok) {',
					"\t\tthrow new Error('Failed to load user');",
					'\t}',
					'',
					'\tconst user = await response.json();',
					'\treturn {',
					'\t\t...user,',
					'\t\tdisplayName: user.displayName ?? user.name,',
					'\t};',
					'}',
					'',
				].join('\n'),
				description:
					'Adds basic error handling and normalizes the user payload with a displayName fallback.',
			},
			{
				filePath: 'src/types/user.ts',
				originalContent: [
					'export interface User {',
					'\tid: string;',
					'\tname: string;',
					'}',
					'',
				].join('\n'),
				proposedContent: [
					'export interface User {',
					'\tid: string;',
					'\tname: string;',
					'\tdisplayName?: string;',
					'}',
					'',
				].join('\n'),
				description: 'Extends the User type to support the normalized displayName field.',
			},
		],
	};
}
