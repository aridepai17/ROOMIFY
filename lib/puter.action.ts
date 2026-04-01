import puter from "@heyputer/puter.js";
import { PUTER_WORKER_URL } from "./constants";
import { isHostedUrl } from "./utils";
import {
	getOrCreateHostingConfig,
	uploadImageToHosting,
} from "./puter.hosting";

// Initialize Puter.js if not already initialized
let isPuterInitializing = false;
let puterInitPromise: Promise<void> | null = null;

const initPuter = async (): Promise<void> => {
    if (isPuterInitializing && puterInitPromise) {
        return puterInitPromise;
    }
    
    if (puter.auth) {
        return; // Already initialized
    }
    
    isPuterInitializing = true;
    puterInitPromise = new Promise((resolve, reject) => {
        const checkInit = () => {
            if (puter.auth) {
                console.log('Puter.js initialized successfully');
                resolve();
            } else {
                setTimeout(checkInit, 100);
            }
        };
        
        // Start checking after a short delay
        setTimeout(checkInit, 500);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            if (!puter.auth) {
                reject(new Error('Puter.js initialization timeout'));
            }
        }, 10000);
    });
    
    try {
        await puterInitPromise;
    } finally {
        isPuterInitializing = false;
        puterInitPromise = null;
    }
};

export const signIn = async () => {
	try {
		await initPuter();
		
		if (!puter.auth) {
			throw new Error('Puter.js auth not available');
		}
		return await puter.auth.signIn();
	} catch (error) {
		console.error('Puter signIn error:', error);
		throw error;
	}
};

export const signOut = () => {
	try {
		if (!puter.auth) {
			throw new Error('Puter.js auth not available');
		}
		return puter.auth.signOut();
	} catch (error) {
		console.error('Puter signOut error:', error);
		throw error;
	}
};

export const getCurrentUser = async () => {
	try {
		await initPuter();
		return await puter.auth.getUser();
	} catch {
		return null;
	}
};

export const createProject = async ({
	item,
	visibility = "private",
}: CreateProjectParams): Promise<DesignItem | null | undefined> => {
	if (!PUTER_WORKER_URL) {
		console.warn("Missing VITE_PUTER_WORKER_URL; skip history fetch;");
		return null;
	}

	const projectId = item.id;
	const hosting = await getOrCreateHostingConfig();

	const hostedSource = projectId
		? await uploadImageToHosting({
				hosting,
				url: item.sourceImage,
				projectId,
				label: "source",
			})
		: null;

	const hostedRender =
		projectId && item.renderedImage
			? await uploadImageToHosting({
					hosting,
					url: item.renderedImage,
					projectId,
					label: "rendered",
				})
			: null;

	const resolvedSource =
		hostedSource?.url ||
		(isHostedUrl(item.sourceImage) ? item.sourceImage : "");

	if (!resolvedSource) {
		console.warn("Failed to host source image, skipping save.");
		return null;
	}

	const resolvedRender = hostedRender?.url
		? hostedRender?.url
		: item.renderedImage && isHostedUrl(item.renderedImage)
			? item.renderedImage
			: undefined;

	const {
		sourcePath: _sourcePath,
		renderedPath: _renderedPath,
		publicPath: _publicPath,
		...rest
	} = item;

	const payload = {
		...rest,
		sourceImage: resolvedSource,
		renderedImage: resolvedRender,
	};

	try {
		const response = await puter.workers.exec(
			`${PUTER_WORKER_URL}/api/projects/save`,
			{
				method: "POST",
				body: JSON.stringify({
					project: payload,
					visibility,
				}),
			},
		);

		if (!response.ok) {
			console.error("Failed to save the project", await response.text());
			return null;
		}

		const data = (await response.json()) as { project?: DesignItem | null };

		return data?.project ?? null;
	} catch (e) {
		console.log("Failed to save project", e);
		return null;
	}
};

export const getProjects = async () => {
	if (!PUTER_WORKER_URL) {
		console.warn("Missing VITE_PUTER_WORKER_URL; skip history fetch;");
		return [];
	}

	try {
		const response = await puter.workers.exec(
			`${PUTER_WORKER_URL}/api/projects/list`,
			{ method: "GET" },
		);

		if (!response.ok) {
			console.error("Failed to fetch history", await response.text());
			return [];
		}

		const data = (await response.json()) as {
			projects?: DesignItem[] | null;
		};

		return Array.isArray(data?.projects) ? data?.projects : [];
	} catch (e) {
		console.error("Failed to get projects", e);
		return [];
	}
};

export const getProjectById = async ({ id }: { id: string }) => {
	if (!PUTER_WORKER_URL) {
		console.warn("Missing VITE_PUTER_WORKER_URL; skipping project fetch");
		return null;
	}

	console.log("Fetching project with ID:", id);

	try {
		const response = await puter.workers.exec(
			`${PUTER_WORKER_URL}/api/projects/get?id=${encodeURIComponent(id)}`,
			{ method: "GET" },
		);

		console.log("Fetch project response:", response);

		if (!response.ok) {
			console.error("Failed to fetch project:", await response.text());
			return null;
		}

		const data = (await response.json()) as {
			project?: DesignItem | null;
		};

		console.log("Fetched project data:", data);

		return data?.project ?? null;
	} catch (error) {
		console.error("Failed to fetch project:", error);
		return null;
	}
};
