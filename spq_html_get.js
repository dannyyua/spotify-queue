function getQueueSongs() {
	const queueList = document.querySelector('[aria-label="Next in queue"]');

	if (queueList) {
		return queueList.firstChild.children[1];
	}

	return null;
}

function getNextSongs() {
	const nextList = document.querySelector('[aria-label="Next up"], [aria-label^="Next from"]');

	if (nextList) {
		return nextList.firstChild.children[1];
	}

	return null;
}

function getMarketCode() {
	const configText = document.querySelector("#config").innerText;
	const toSearch = '"userCountry":"';
	var marketCode = "";
	for (var i = configText.indexOf(toSearch) + toSearch.length; configText[i] !== '"'; i++) {
		marketCode += configText[i];
	}
	
	return marketCode;
}
