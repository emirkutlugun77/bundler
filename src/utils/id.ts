export function generateUid(prefix: string = ""): string {
	const rnd = Math.random().toString(36).slice(2, 10);
	const time = Date.now().toString(36);
	return `${prefix}${prefix ? "_" : ""}${time}${rnd}`;
}

export function toShortUid(id: string, size: number = 6): string {
	if (id.length <= size * 2) return id;
	return `${id.slice(0, size)}...${id.slice(-size)}`;
}



