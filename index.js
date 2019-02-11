#!/usr/bin/env node

const clubhouse = require('commander')
const fetch = require('node-fetch')
const { version } = require('./package.json')
const authorizeGoogle = require('./google-auth')
const { google } = require('googleapis')
const readline = require('readline')

const API_HOST = 'https://api.clubhouse.io'
const TOKEN = process.env.CLUBHOUSE_API_TOKEN
const SPREADSHEET_ID = '1Zsyutqnb-uYZHPXt3QNninmsHPxODhaPEd16XLHTgj4'
const sheets = google.sheets({ version: 'v4' })

const userInput = readline.createInterface(process.stdin, process.stdout)

authorizeGoogle(auth => google.options({ auth }))

//const sheetIds = {
//  Web: 1167460974,
//  Design: 1514012959,
//  Mobile: 2076622121
//}

function getFormattedDate (date) {
  const year = date.getFullYear()
  const month = ('0' + (date.getMonth() + 1)).slice(-2)
  const day = ('0' + date.getDate()).slice(-2)
  return `${year}-${month}-${day}`
}

function question (text) {
  return new Promise((resolve, reject) => {
    userInput.question(text, answer => {
      resolve(answer)
    })
  })
}

async function pushPointsToGoogleSheet (end, pointsByTeam) {
  for (const team in pointsByTeam) {
    const numberOfMembers = await question(`How many team members for ${team}? `)
    const { feature, chore, bug } = pointsByTeam[team]
    const request = {
      spreadsheetId: SPREADSHEET_ID,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      range: `${team}!A:D`,
      resource: {
        majorDimension: 'ROWS',
        values: [
          ['CLI', end, feature, chore, bug, numberOfMembers]
        ]
      }
    }

    sheets.spreadsheets.values.append(request, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err)
    //  const request = {
    //    spreadsheetId: SPREADSHEET_ID,
    //    resource: {
    //      requests: [{
    //        copyPaste: {
    //          source: {
    //            sheetId: 0,
    //            startRowIndex: 47,
    //            endRowIndex: 47,
    //            startColumnIndex: 6,
    //            endColumnIndex: 9
    //          },
    //          destination: {
    //            sheetId: 0,
    //            startRowIndex: 48,
    //            endRowIndex: 48,
    //            startColumnIndex: 6,
    //            endColumnIndex: 9
    //          },
    //          pasteType: 'PASTE_FORMAT',
    //          pasteOrientation: 'NORMAL'
    //        }
    //      }]
    //    }
    //  }
    //  sheets.spreadsheets.batchUpdate(request, (err, res) => {
    //    if (err) return console.log('The API returned an error: ' + err)
    //    console.log(res)
    //  })
    })
  }
  console.log('Points successfully sent to Google Sheets :)')
  userInput.close()
}

async function search (path, stories) {
  const { next, data } = await fetch(`${API_HOST}${path}&token=${TOKEN}`).then(res => res.json())
  let newStories = stories.slice().concat(data)
  if (next) newStories = search(next, newStories)
  return newStories
}

function massagePointsByTeam (teams, stories) {
  const pointsByTeam = {}
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i].name

    pointsByTeam[team] = {
      feature: 0,
      chore: 0,
      bug: 0
    }

    stories.filter(story => {
      return teams[i].project_ids.includes(story.project_id)
    }).forEach(story => {
      pointsByTeam[team][story.story_type] += story.estimate || 0
    })
  }

  return pointsByTeam
}

async function pushPoints (numberOfDays, endDate = getFormattedDate(new Date())) {
  const startDate = new Date()
  startDate.setDate(new Date(endDate).getDate() - (numberOfDays - 1))
  const start = getFormattedDate(startDate)
  const end = endDate
  console.log(`Finding point values from ${start} to ${end}`)
  if (!TOKEN) return console.log('CLUBHOUSE_API_TOKEN environment variable is not set')

  console.log('fetching teams...')
  const teams = await fetch(`${API_HOST}/api/v2/teams?token=${TOKEN}`).then(res => res.json())

  console.log('fetching stories...')
  const path = '/api/v2/search/stories'
  const query = `?query=completed:${start}..${end}&page_size=25`
  const stories = await search(`${path}${query}`, [])
  const pointsByTeam = massagePointsByTeam(teams, stories)

  console.log('Pushing data to Google Sheets...')
  console.log(pointsByTeam)
  pushPointsToGoogleSheet(end, pointsByTeam)
}

clubhouse
  .version(version)

clubhouse
  .command('push-points <number-of-days> [end-date]')
  .description('Push story point values to Google Sheets for a specified number of days')
  .action(pushPoints)

clubhouse
  .command('*')
  .description('show help menu if command does not exist')
  .action(() => {
    clubhouse.help()
  })

clubhouse.parse(process.argv)

if (!clubhouse.args.length) {
  clubhouse.help()
}
