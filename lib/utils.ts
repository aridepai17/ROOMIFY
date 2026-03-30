export const HOSTING_CONFIG_KEY = "roomify_hosting_config";
export const HOSTING_DOMAIN_SUFFIX = ".puter.site";
const SUBDOMAIN_REGEX = /^[a-z0-9-]+$/i;

const isValidSubdomain = (subdomain: string): boolean =>
	SUBDOMAIN_REGEX.test(subdomain) && !subdomain.includes(".") && !subdomain.includes("/");

export const isHostedUrl = (value: unknown): value is string => {
	if (typeof value !== "string") return false;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return false;
		if (!url.hostname.endsWith(HOSTING_DOMAIN_SUFFIX)) return false;
		const subdomain = url.hostname.slice(0, -HOSTING_DOMAIN_SUFFIX.length);
		if (!subdomain || !isValidSubdomain(subdomain)) return false;
		return true;
	} catch {
		return false;
	}
};

export const createHostingSlug = () =>
	`roomify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeHost = (subdomain: string): string | null => {
	if (!subdomain || !isValidSubdomain(subdomain)) return null;
	return subdomain.endsWith(HOSTING_DOMAIN_SUFFIX)
		? subdomain
		: `${subdomain}${HOSTING_DOMAIN_SUFFIX}`;
};

export const getHostedUrl = (
	hosting: { subdomain: string },
	filePath: string,
): string | null => {
	if (!hosting?.subdomain) return null;
	const host = normalizeHost(hosting.subdomain);
	if (!host) return null;
	return `https://${host}/${filePath}`;
};

export const getImageExtension = (contentType: string, url: string): string => {
	const type = (contentType || "").toLowerCase();
	const typeMatch = type.match(/image\/(png|jpeg|webp|gif|svg\+xml|svg)/);
	if (typeMatch?.[1]) {
		const ext = typeMatch[1].toLowerCase();
		return ext === "jpeg" || ext === "jpg"
			? "jpg"
			: ext === "svg+xml"
				? "svg"
				: ext;
	}

	const dataMatch = url.match(/^data:image\/([a-z0-9+.-]+);/i);
	if (dataMatch?.[1]) {
		const ext = dataMatch[1].toLowerCase();
		return ext === "jpeg" || ext === "jpg"
			? "jpg"
			: ext === "svg+xml"
				? "svg"
				: ext;
	}

	const extMatch = url.match(/\.([a-z0-9]+)(?:$|[?#])/i);
	if (extMatch?.[1]) return extMatch[1].toLowerCase();

	return "png";
};

export const dataUrlToBlob = (
	dataUrl: string,
): { blob: Blob; contentType: string } | null => {
	try {
		const match = dataUrl.match(/^data:([^,]*?)(;base64)?,([\s\S]*)$/i);
		if (!match) return null;
		const contentType = match[1] || "";
		const isBase64 = !!match[2];
		const data = match[3] || "";
		const raw = isBase64
			? atob(data.replace(/\s/g, ""))
			: decodeURIComponent(data);
		const bytes = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i += 1) {
			bytes[i] = raw.charCodeAt(i);
		}
		return { blob: new Blob([bytes], { type: contentType }), contentType };
	} catch {
		return null;
	}
};

export const fetchBlobFromUrl = async (
	url: string,
): Promise<{ blob: Blob; contentType: string } | null> => {
	if (url.startsWith("data:")) {
		return dataUrlToBlob(url);
	}

	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error("Failed to fetch image");
		return {
			blob: await response.blob(),
			contentType: response.headers.get("content-type") || "",
		};
	} catch {
		return null;
	}
};

export const imageUrlToPngBlob = async (url: string): Promise<Blob | null> => {
	if (typeof window === "undefined") return null;

	try {
		const img = new Image();
		img.crossOrigin = "anonymous";

		const loaded = await new Promise<HTMLImageElement>(
			(resolve, reject) => {
				img.onload = () => resolve(img);
				img.onerror = () => reject(new Error("Failed to load image"));
				img.src = url;
			},
		);

		const width = loaded.naturalWidth || loaded.width;
		const height = loaded.naturalHeight || loaded.height;
		if (!width || !height) return null;

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;

		ctx.drawImage(loaded, 0, 0, width, height);

		return await new Promise<Blob | null>((resolve) => {
			canvas.toBlob((result) => resolve(result), "image/png");
		});
	} catch {
		return null;
	}
};
