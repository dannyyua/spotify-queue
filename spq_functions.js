var spQ_deviceId = "";
var spQ_connectionId = "";
var spQ_subdomain = "";
var spQ_isUnlocked = false;
var spQ_accessToken = "";
var spQ_accessTokenExpiry = 0;

const HIGHLIGHTED_CLASS = 'eRuZMo_HNLjb1IalIeRb';
const FADED_CLASS = 'Svg-sc-ytk21e-0 ewCuAY';

const Action = {
	SendToTop: 0,
	SendToBottom: 1,
	ShuffleQueue: 2,
	ReverseQueue: 3
};

const QueueType = {
	Queue: 0,
	NextUp: 1
};

// Detect when a context menu is opened, add the options
new MutationObserver(function() {
	// Do nothing if the queue page is not open
	if (!window.location.pathname.startsWith('/queue')) return;

	const contextMenus = document.querySelectorAll("#context-menu > ul");
	
	for (const menu of contextMenus) {
		updateMenu(menu);
	}
}).observe(document.body, { childList: true });

// Add new options to the context menu
function updateMenu(menu) {
	// Get the index of the 'Remove from queue' button, used to determine valid menu
	const rqIndx = [...menu.children].findIndex((c) => c.firstChild.children[1].innerText === 'Remove from queue');
	const nextButton = menu.children[rqIndx+1].firstChild.children[1];

	// Check if new buttons have been added yet
	if (rqIndx !== -1 && nextButton.innerText !== 'Send to top') {
		// Create 4 new cloned buttons
		for (let i = 0; i < 4; i++) {
			menu.insertBefore(menu.children[rqIndx].cloneNode(true), menu.children[rqIndx+1]);
		}

		const leftArrow = document.querySelector("[data-testid='top-bar-back-button']").firstChild;
		const shuffleIcon = document.querySelector("[data-testid='control-button-shuffle']").firstChild;
		const reverseIcon = document.querySelector("[data-testid='control-button-repeat']").firstChild;

		// Update cloned buttons icons
		menu.children[rqIndx+1].firstChild.firstChild.replaceWith(leftArrow.cloneNode(true));
		menu.children[rqIndx+1].firstChild.firstChild.setAttribute('transform', 'rotate(90)');
		menu.children[rqIndx+2].firstChild.firstChild.replaceWith(leftArrow.cloneNode(true));
		menu.children[rqIndx+2].firstChild.firstChild.setAttribute('transform', 'rotate(-90)');
		menu.children[rqIndx+3].firstChild.firstChild.replaceWith(shuffleIcon.cloneNode(true));
		menu.children[rqIndx+4].firstChild.firstChild.replaceWith(reverseIcon.cloneNode(true));

		// Update classes to match appearance with other buttons
		for (let i = 1; i < 5; i++) {
			menu.children[rqIndx+i].firstChild.firstChild.setAttribute('class', FADED_CLASS);
		}
		
		// Update cloned buttons text
		menu.children[rqIndx+1].firstChild.children[1].innerText = 'Send to top';
		menu.children[rqIndx+2].firstChild.children[1].innerText = 'Send to bottom';
		menu.children[rqIndx+3].firstChild.children[1].innerText = 'Shuffle queue';
		menu.children[rqIndx+4].firstChild.children[1].innerText = 'Reverse queue';

		// Check if user selected song in "Next in queue"
		let res = initButtons(QueueType.Queue, menu, rqIndx);

		// Check if user selected song in "Next up/Next from"
		if (res === -1) initButtons(QueueType.NextUp, menu, rqIndx);
	}
}

// Modify song list, then send API call to update queue
async function updateQueue(queueType, index, action) {
	const authToken = await getOAuthToken();
	const subdomain = await getSubdomain();
	const songLists = await getSongLists();

	if (queueType === QueueType.Queue) {
		updateSongList(songLists.queueSongs, index, action);
	} else if (queueType === QueueType.NextUp) {
		updateSongList(songLists.nextSongs, index, action);
	} else {
		console.log("Unknown queue type");
	}

	let body = {command: {
		next_tracks: [...songLists.queueSongs, ...songLists.nextSongs],
		endpoint: 'set_queue',
	}};
	
	fetch(`https://${subdomain}.spotify.com/connect-state/v1/player/command/from/${spQ_deviceId}/to/${spQ_deviceId}`, {
		headers: {
			authorization: `Bearer ${authToken}`
		},
		body: JSON.stringify(body),
		method: "POST"
	});
}

// Initialise buttons to become usable
function initButtons(queueType, menu, rqIndx) {
	let queue;
	let selectedIndex = -1;

	if (queueType === QueueType.Queue) {
		queue = getQueueSongs();
	} else if (queueType === QueueType.NextUp) {
		queue = getNextSongs();
	} else {
		console.log("Unknown queue type");
	}

	if (!queue) return selectedIndex;

	for (var i = 0; i < queue.children.length; i++) {
		const row = queue.children[i];
		if (row.firstChild.classList.contains(HIGHLIGHTED_CLASS)
			|| row.firstChild.getAttribute("data-context-menu-open") === "true") {
			selectedIndex = row.ariaRowIndex-1;

			menu.children[rqIndx+1].onclick = () => { updateQueue(queueType, selectedIndex, Action.SendToTop) };
			menu.children[rqIndx+2].onclick = () => { updateQueue(queueType, selectedIndex, Action.SendToBottom) };
			menu.children[rqIndx+3].onclick = () => { updateQueue(queueType, selectedIndex, Action.ShuffleQueue) };
			menu.children[rqIndx+4].onclick = () => { updateQueue(queueType, selectedIndex, Action.ReverseQueue) };
			break;
		}
	}

	return selectedIndex;
}

// Modify song list locally before sending to API
function updateSongList(list, index, action) {
	if (action === Action.SendToTop) {
		const temp = list[index];
		list.splice(index, 1);
		list.unshift(temp);
	} else if (action === Action.SendToBottom) {
		const temp = list[index];
		list.splice(index, 1);
		list.push(temp);
	} else if (action === Action.ShuffleQueue) {
		// Fisher-Yates shuffle
		var j, temp;
		for (var i = list.length-1; i > 0; i--) {
			j = Math.floor(Math.random() * (i+1));
			temp = list[i];
			list[i] = list[j];
			list[j] = temp;
		}
	} else if (action === Action.ReverseQueue) {
		var temp;
		for (var i = 0; i < list.length/2; i++) {
			temp = list[i];
			list[i] = list[list.length-i-1];
			list[list.length-i-1] = temp;
		}
	} else {
		console.log("Unknown action");
	}

	return list;
}

// Get current songs in queue and next up/next from
async function getSongLists() {
	let queueSongs = [];
	let nextSongs = [];

	const authToken = await getOAuthToken();
	const subdomain = await getSubdomain();

	const response = await fetch(`https://${subdomain}.spotify.com/connect-state/v1/devices/hobs_${spQ_deviceId.slice(0, 35)}`, {
		headers: {
		  authorization: `Bearer ${authToken}`,
		  "x-spotify-connection-id": spQ_connectionId
		},
		body: '{"member_type":"CONNECT_STATE","device":{"device_info":{"capabilities":{"can_be_player":false,"hidden":true,"needs_full_player_state":true}}}}',
		method: "PUT"
	  });
	
	const data = await response.json();

	for (const track of data["player_state"]["next_tracks"]) {
		if (track["provider"] === "queue") {
			queueSongs.push(track);
		} else if (track["provider"] === "context") {
			nextSongs.push(track);
		}
	}

	return {queueSongs: queueSongs, nextSongs: nextSongs};
}

// Spotify sometimes locks use of the menu, this will allow the user to regain control of the added buttons
async function unlockMenu() {
	spQ_isUnlocked = true;
	const authToken = await getOAuthToken();
	const subdomain = await getSubdomain();
	
	fetch(`https://${subdomain}.spotify.com/connect-state/v1/connect/transfer/from/${spQ_deviceId}/to/${spQ_deviceId}`, {
	  headers: {
		authorization: `Bearer ${authToken}`
	  },
	  body: '{"transfer_options":{"restore_paused":"pause"}}',
	  method: "POST"
	}).then(function(response) {
		if (!response.ok) {
			setTimeout(() => { unlockMenu() }, 500);
		}
	});
}

async function getOAuthToken() {
	if (Date.now() > spQ_accessTokenExpiry) {
		const response = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player");
		const data = await response.json();
		spQ_accessToken = data["accessToken"];
		spQ_accessTokenExpiry = data["accessTokenExpirationTimestampMs"];
	}

	return spQ_accessToken;
}

async function getSubdomain() {
	if (spQ_subdomain === "") {
		const response = await fetch("https://apresolve.spotify.com/?type=spclient");
		const data = await response.json();

		var subd = "";
		for (var i = 0; data["spclient"][0][i] !== "."; i++) {
			subd += data["spclient"][0][i];
		}
		spQ_subdomain = subd;
	}

	return spQ_subdomain;
}

chrome.runtime.onMessage.addListener(
	function(message) {
		if (message.deviceId && message.connectionId) {
			spQ_deviceId = message.deviceId;
			spQ_connectionId = message.connectionId;
			if (!spQ_isUnlocked) unlockMenu();
		}
	}
);
