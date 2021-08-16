const crypto = require('crypto')
const http = require('http')
const fs = require('fs')

const _ = require('lodash')
const express = require('express')
const Twitter = require('twitter-lite')

const app = express()
const server = http.createServer(app)

app.use(express.static('./'))

const indexTemplate = fs.readFileSync('index_template.html', 'utf8')
let winnersJsonString = fs.readFileSync('winners.json', 'utf8')

const createFetchRetweetersIds = (client) => async (tweetId) => {
	const allIds = []
	let nextCursor = -1

	do {
		const { ids, next_cursor } = await client.get("statuses/retweeters/ids", {
			id: tweetId,
			stringify_ids: true,
			cursor: nextCursor,
		})

		allIds.push(...ids)
		nextCursor = next_cursor
	} while (nextCursor !== 0)

	return allIds
}

async function generateWinners () {
	const user = new Twitter({
		consumer_key: process.env.TWITTER_CONSUMER_KEY,
		consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
	})

	const response = await user.getBearerToken()
	const client = new Twitter({
		bearer_token: response.access_token,
	})

	const { ids: followersIds } = await client.get("followers/ids", {
		screen_name: "parallelo3301",
		stringify_ids: true,
		count: 5000,
	})
	const followersIdsMap = followersIds.reduce((acc, b) => { acc[b] = true; return acc }, {})

	const fetchRetweetersIds = createFetchRetweetersIds(client)

	// friends, family, ...
	const excludedWinners = {
		'624826462': true,
	}

	// main tweet: 1425869656229875715 + giveaway tweet 1425869664962367492
	const [
		retweetersMain,
		retweetersGiveaway,
	] = await Promise.all([
		fetchRetweetersIds("1425869656229875715"),
		fetchRetweetersIds("1425869664962367492"),
	])

	// let's take all retweeters of the main and the giveaway tweet, exclude friends,
	// filter to only the followers and make unique list of them
	
	const allContestants = [...retweetersMain, ...retweetersGiveaway]
	const contestantsWithoutExcluded = allContestants.filter(id => ! excludedWinners[id])
	const contestantsWhichFollows = contestantsWithoutExcluded.filter(id => followersIdsMap[id])
	const validUniqueContestantsIds = [...new Set(contestantsWhichFollows)]

	// shuffle contestants
	const randomlyShuffled = _.shuffle(validUniqueContestantsIds)

	// and we have a winners! congratulations!
	const winners = randomlyShuffled.slice(0, 6)

	// let's fetch winners data
	const winnersData = await client.get("users/lookup", {
		user_id: winners.join(','),
	})

	const winnersDataMap = winnersData.reduce((acc, user) => {
		if (user && user.id_str) {
			acc[user.id_str] = user
		}
		return acc
	}, {})

	const winnersWithData = winners.map(w => {
		const data = winnersDataMap[w]

		return {
			id: w,
			screen_name: data.screen_name,
		}
	})

	const winnersTHM = winnersWithData.slice(0, 3)
	const winnersHTB = winnersWithData.slice(3, 6)

	winnersJsonString = JSON.stringify({
		thm: winnersTHM,
		htb: winnersHTB,
	})
	
	// save to file
	fs.writeFileSync('winners.json', winnersJsonString)
}

app.get('/generate', async (req, res) => {
	// run only once
	if (JSON.parse(winnersJsonString).thm.length) {
		res.send('already_created')
		return
	}

	const shasum = crypto.createHash('sha1')
	shasum.update('s4lt3d :-) ' + req.query.hash)
	const hash = shasum.digest('hex')

	if (hash === '82f1036dc3c4bba54fc55364132fe53a22eda18a') {
		await generateWinners()
		res.send('ok')
		return
	}

	res.send('err')
})

app.get('/', (req, res) => {
	const output = indexTemplate.replace('WINNERS_JSON', winnersJsonString)
	res.send(output)
})

server.listen(3000, '0.0.0.0', () => {
	console.log('listening on *:3000')
})
