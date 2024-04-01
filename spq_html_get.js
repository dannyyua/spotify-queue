function getQueueSongs() {
	const queueList = document.querySelector('[aria-label="Next in queue"]');

	return queueList;
}

function getNextSongs() {
	const nextList = document.querySelector('[aria-label="Next up"], [aria-label^="Next from"]');

	return nextList;
}
